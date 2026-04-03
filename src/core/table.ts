/**
 * @file table.ts
 * @description Tabla autocontenida con arquitectura minimalista y Symbol storage
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */
import {
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type {
  InferAttributes,
  PickByType,
  QueryOperator,
  WhereOptions,
} from "../@types/index";
import { processIncludes } from "../utils/relations";
import { requireClient, TransactionContext } from "./client";
import type { Schema } from "./decorator";
import { SCHEMA } from "./decorator";

const OP_MAP: Record<string, string> = {
  '=': '=', '<>': '<>', '!=': '<>', '<': '<', '<=': '<=', '>': '>', '>=': '>=',
  in: 'in', include: 'include', contains: 'include',
  $eq: '=', $ne: '<>', $lt: '<', $lte: '<=', $gt: '>', $gte: '>=',
  $in: 'in', $include: 'include', $contains: 'include',
  $exists: 'attribute_exists', $notExists: 'attribute_not_exists',
};
const OPERATORS = new Set(Object.keys(OP_MAP));

type WhereFilters<M> = {
  [K in keyof InferAttributes<M>]?:
  | InferAttributes<M>[K]
  | { [N in QueryOperator]?: InferAttributes<M>[K] };
};

export default class Table<T = any> {
  static [SCHEMA]: Schema;

  constructor(props: Partial<T> = {} as Partial<T>) {
    requireClient();
    const schema = (this.constructor as any)[SCHEMA];

    // Flag de persistencia con closure (no enumerable)
    let __isPersisted = false;
    Object.defineProperty(this, "__isPersisted", {
      enumerable: false,
      configurable: false,
      get: () => __isPersisted,
      set: (v: boolean) => {
        __isPersisted = v;
      },
    });

    for (const column_name in schema.columns) {
      const column = schema.columns[column_name];

      if (column.store?.relation) {
        let relation_value = (props as any)[column_name] ?? undefined;
        let cached: any = undefined;
        let dirty = true;

        Object.defineProperty(this, column_name, {
          enumerable: true,
          configurable: true,
          set: (v: any) => {
            relation_value = v;
            dirty = true;
          },
          get: () => {
            if (relation_value === undefined) return undefined;
            if (!dirty) return cached;

            const RelatedModel = column.store.relation!.model();
            const type = column.store.relation!.type;

            if (type === "HasMany" || type === "ManyToMany") {
              cached = []
                .concat(relation_value ?? [])
                .filter(Boolean)
                .map((item: any) =>
                  item instanceof RelatedModel ? item : new RelatedModel(item)
                );
            } else {
              if (relation_value === null) { cached = null; dirty = false; return null; }
              cached =
                relation_value instanceof RelatedModel
                  ? relation_value
                  : new RelatedModel(relation_value);
            }

            dirty = false;
            return cached;
          },
        });
      } else {
        // Columna normal con closure
        let value = (props as any)[column_name];

        Object.defineProperty(this, column_name, {
          enumerable: true,
          configurable: true,
          get: () => {
            const computed = column.get.reduce((v: any, fn: any) => fn(v), value);
            // Cache default values so they don't regenerate on each access
            if (value == null && computed != null) {
              value = computed;
            }
            return computed;
          },
          set: (next: any) => {
            value = column.set.reduce(
              (accumulated: any, fn: any) => fn(accumulated, value),
              next
            );
          },
        });

        (this as any)[column_name] = (props as any)[column_name];
      }
    }
  }

  public toJSON(): Record<string, unknown> {
    const schema = (this.constructor as any)[SCHEMA];
    const result: Record<string, unknown> = {};

    for (const column_name in schema.columns) {
      const column = schema.columns[column_name];
      const value = (this as any)[column_name];

      if (value === null || value === undefined) continue;

      if (column.store?.relation) {
        result[column_name] = Array.isArray(value)
          ? value.map((item) => (item?.toJSON ? item.toJSON() : item))
          : value?.toJSON
            ? value.toJSON()
            : value;
      } else {
        result[column_name] = value;
      }
    }

    return result;
  }

  /**
   * @description Convierte la instancia a un payload listo para DynamoDB
   * @returns Objeto con nombres de columnas de DB y valores apropiados
   */
  private _toDBPayload(): Record<string, any> {
    const schema = (this.constructor as any)[SCHEMA];
    const payload: Record<string, any> = {};

    for (const prop_name in schema.columns) {
      const column = schema.columns[prop_name];

      // Skip relations
      if (column.store?.relation) {
        continue;
      }

      const value = (this as any)[prop_name];
      const db_name = column.name || prop_name;

      // Skip undefined values (DynamoDB doesn't support them)
      if (value !== undefined) {
        payload[db_name] = value;
      }
    }

    return payload;
  }

  public toString(): string {
    return JSON.stringify(this);
  }

  public async save(): Promise<boolean> {
    const schema: Schema = (this.constructor as any)[SCHEMA];
    const payload = (this as any)._toDBPayload();

    if ((this as any).__isPersisted) {
      await requireClient().send(
        new PutItemCommand({
          TableName: schema.name,
          Item: marshall(payload, { removeUndefinedValues: true }),
        })
      );
      return true;
    }

    const created = await (this.constructor as any).create(
      Object.fromEntries(
        Object.keys(schema.columns)
          .filter(k => !schema.columns[k].store?.relation)
          .map(k => [k, (this as any)[k]])
      )
    );
    for (const key in schema.columns) {
      if (!schema.columns[key].store?.relation) {
        (this as any)[key] = (created as any)[key];
      }
    }
    (this as any).__isPersisted = true;
    return true;
  }

  public async update(data: Partial<InferAttributes<T>>): Promise<boolean> {
    const schema = (this.constructor as any)[SCHEMA];

    // Filtrar relaciones (ignorarlas) en vez de lanzar error
    const filtered_data: any = {};
    for (const key in data) {
      const column = schema.columns[key];
      // Solo incluir campos que NO son relaciones
      if (!column?.store?.relation) {
        filtered_data[key] = data[key];
      }
    }

    const affected = await (this.constructor as any).update(filtered_data, {
      [schema.primary_key]: (this as any)[schema.primary_key],
    });

    if (affected > 0) {
      // Actualizar la instancia con los nuevos valores (incluyendo updated_at)
      for (const key in filtered_data) {
        (this as any)[key] = filtered_data[key];
      }
    }

    return affected > 0;
  }

  public async destroy(): Promise<null> {
    const schema = (this.constructor as any)[SCHEMA];
    const id = (this as any)[schema.primary_key];

    if (!id) throw new Error("Cannot destroy record without ID");

    for (const column_name in schema.columns) {
      if (schema.columns[column_name].store?.softDelete) {
        (this as any)[column_name] = new Date().toISOString();
        await this.save();
        return null;
      }
    }

    return this.forceDestroy();
  }

  public async forceDestroy(): Promise<null> {
    const schema = (this.constructor as any)[SCHEMA];
    const id = (this as any)[schema.primary_key];

    if (!id) throw new Error("Cannot destroy record without ID");

    await requireClient().send(
      new DeleteItemCommand({
        TableName: schema.name,
        Key: marshall({ [schema.primary_key]: id }),
      })
    );

    return null;
  }

  public async attach<R>(
    RelatedModel: new () => R,
    related_id: string,
    pivot_data?: Record<string, any>
  ): Promise<void> {
    const schema = (this.constructor as any)[SCHEMA];
    const primary_key = schema.primary_key || "id";

    // VALIDACIÓN PRIORITARIA: Verificar que la instancia esté persistida
    const local_id = (this as any)[primary_key];
    const is_persisted = (this as any).__isPersisted;

    if (!local_id || !is_persisted) {
      throw new Error(
        "No se puede attach sin ID: la instancia debe persistirse primero con save() o create()"
      );
    }

    const related_table_name = (RelatedModel as any)[SCHEMA]?.name;

    if (!related_table_name) {
      throw new Error("Related model no tiene SCHEMA definido");
    }

    let relation: any = null;
    for (const column_name in schema.columns) {
      const rel = schema.columns[column_name].store?.relation;
      if (
        rel?.type === "ManyToMany" &&
        rel.model()[SCHEMA]?.name === related_table_name
      ) {
        relation = rel;
        break;
      }
    }

    if (!relation) {
      throw new Error(
        `No se encontró relación ManyToMany entre ${schema.name} y ${related_table_name}`
      );
    }

    const foreign_key_value = (this as any)[relation.localKey];

    const result = await requireClient().send(
      new ScanCommand({
        TableName: relation.pivotTable,
        FilterExpression: "#fk = :local_id AND #rk = :related_id",
        ExpressionAttributeNames: {
          "#fk": relation.foreignKey,
          "#rk": relation.relatedKey,
        },
        ExpressionAttributeValues: marshall({
          ":local_id": foreign_key_value,
          ":related_id": related_id,
        }),
      })
    );

    if (result.Items && result.Items.length > 0) return;

    await requireClient().send(
      new PutItemCommand({
        TableName: relation.pivotTable,
        Item: marshall(
          {
            id: `${foreign_key_value}_${related_id}`,
            [relation.foreignKey]: foreign_key_value,
            [relation.relatedKey]: related_id,
            created_at: new Date().toISOString(),
            ...pivot_data,
          },
          { removeUndefinedValues: true }
        ),
      })
    );
  }

  public async detach<R>(
    RelatedModel: new () => R,
    related_id: string
  ): Promise<void> {
    const schema = (this.constructor as any)[SCHEMA];
    const related_table_name = (RelatedModel as any)[SCHEMA]?.name;

    if (!related_table_name) return;

    let relation: any = null;
    for (const column_name in schema.columns) {
      const rel = schema.columns[column_name].store?.relation;
      if (
        rel?.type === "ManyToMany" &&
        rel.model()[SCHEMA]?.name === related_table_name
      ) {
        relation = rel;
        break;
      }
    }

    if (!relation) return;

    const local_id = (this as any)[relation.localKey];
    if (!local_id) return;

    const result = await requireClient().send(
      new ScanCommand({
        TableName: relation.pivotTable,
        FilterExpression: "#fk = :local_id AND #rk = :related_id",
        ExpressionAttributeNames: {
          "#fk": relation.foreignKey,
          "#rk": relation.relatedKey,
        },
        ExpressionAttributeValues: marshall({
          ":local_id": local_id,
          ":related_id": related_id,
        }),
      })
    );

    if (!result.Items || result.Items.length === 0) return;

    await requireClient().send(
      new DeleteItemCommand({
        TableName: relation.pivotTable,
        Key: marshall({ id: unmarshall(result.Items[0]).id }),
      })
    );
  }

  /**
   * Sincronizar relación ManyToMany reemplazando todas las relaciones existentes
   * @param RelatedModel Modelo relacionado
   * @param related_ids Array de IDs a sincronizar
   */
  public async sync<R>(
    RelatedModel: new () => R,
    related_ids: string[]
  ): Promise<void> {
    const schema = (this.constructor as any)[SCHEMA];
    const related_table_name = (RelatedModel as any)[SCHEMA]?.name;

    if (!related_table_name) {
      throw new Error(`No se encontró schema para el modelo relacionado`);
    }

    // Buscar la relación ManyToMany
    let relation: any = null;
    for (const column_name in schema.columns) {
      const rel = schema.columns[column_name].store?.relation;
      if (
        rel?.type === "ManyToMany" &&
        rel.model()[SCHEMA]?.name === related_table_name
      ) {
        relation = rel;
        break;
      }
    }

    if (!relation) {
      throw new Error(
        `No se encontró relación ManyToMany entre ${schema.name} y ${related_table_name}`
      );
    }

    const local_id = (this as any)[relation.localKey];
    if (!local_id) {
      throw new Error(`El valor de ${relation.localKey} no está definido`);
    }

    // 1. Obtener todas las relaciones existentes
    const scan_result = await requireClient().send(
      new ScanCommand({
        TableName: relation.pivotTable,
        FilterExpression: "#fk = :local_id",
        ExpressionAttributeNames: { "#fk": relation.foreignKey },
        ExpressionAttributeValues: marshall({ ":local_id": local_id }),
      })
    );

    const existing_ids = new Set(
      (scan_result.Items || []).map(
        (item) => unmarshall(item)[relation.relatedKey]
      )
    );
    const target_ids = new Set(related_ids);

    // 2. Detach relaciones que no están en la lista objetivo
    for (const existing_id of existing_ids) {
      if (!target_ids.has(existing_id)) {
        await this.detach(RelatedModel, existing_id);
      }
    }

    // 3. Attach nuevas relaciones que no existen
    for (const target_id of target_ids) {
      if (!existing_ids.has(target_id)) {
        await this.attach(RelatedModel, target_id);
      }
    }
  }

  static async create<M extends Table>(
    this: new (data: any) => M,
    data: Partial<InferAttributes<M>>,
    tx?: TransactionContext
  ): Promise<M> {
    const instance = new this(data);
    const schema = (this as any)[SCHEMA];

    const payload = (instance as any)._toDBPayload();
    const pk_db_name = schema.columns[schema.primary_key]?.name || schema.primary_key;
    const condition = {
      expression: 'attribute_not_exists(#pk)',
      names: { '#pk': pk_db_name },
    };

    if (tx) {
      tx.addPut(schema.name, payload, condition);
      tx.onCommit(() => { (instance as any).__isPersisted = true; });
    } else {
      try {
        await requireClient().send(
          new PutItemCommand({
            TableName: schema.name,
            Item: marshall(payload, { removeUndefinedValues: true }),
            ConditionExpression: condition.expression,
            ExpressionAttributeNames: condition.names,
          })
        );
      } catch (e: any) {
        if (e.name === 'ConditionalCheckFailedException') {
          throw new Error(`Record with ${schema.primary_key} '${(instance as any)[schema.primary_key]}' already exists in ${schema.name}`);
        }
        throw e;
      }
      (instance as any).__isPersisted = true;
    }

    return instance;
  }

  /**
   * @description Extract PK value from filters if the filter is a simple PK equality. Returns null otherwise.
   * @description Extrae el valor de PK de los filtros si es una igualdad simple por PK. Retorna null en otro caso.
   */
  private static _extractPK(filters: Record<string, any>): any {
    const schema: Schema = (this as any)[SCHEMA];
    const keys = Object.keys(filters);
    if (keys.length !== 1 || keys[0] !== schema.primary_key) return null;

    const val = filters[schema.primary_key];
    if (val === null || val === undefined) return null;

    // Valor plano o { $eq: value }
    if (typeof val !== 'object' || Array.isArray(val)) return val;
    const op_keys = Object.keys(val);
    if (op_keys.length === 1 && (OP_MAP[op_keys[0]] || op_keys[0]) === '=') return val[op_keys[0]];
    return null;
  }

  static async update<M extends Table>(
    this: new (data: any) => M,
    updates: Partial<InferAttributes<M>>,
    filters: Partial<InferAttributes<M>>,
    tx?: TransactionContext
  ): Promise<number> {
    const schema: Schema = (this as any)[SCHEMA];

    const parsed_updates: any = {};
    for (const key in updates) {
      const column = schema.columns[key];
      if (!column?.store?.relation) {
        parsed_updates[key] = updates[key];
      }
    }

    // Optimización: si el filtro es PK exacta, GetItem directo
    const pk_value = (this as any)._extractPK(filters);
    let records: M[];

    if (pk_value !== null) {
      const client = requireClient();
      const result = await client.send(new GetItemCommand({
        TableName: schema.name,
        Key: marshall({ [schema.primary_key]: pk_value }),
      }));

      if (!result.Item) return 0;

      const raw = unmarshall(result.Item);
      const db_to_prop: Record<string, string> = {};
      for (const p in schema.columns) db_to_prop[schema.columns[p].name] = p;
      const mapped: Record<string, any> = {};
      for (const k in raw) { if (raw[k] != null) mapped[db_to_prop[k] || k] = raw[k]; }

      const instance = new this(mapped);
      (instance as any).__isPersisted = true;
      records = [instance];
    } else {
      records = await (this as any).where(filters);
      if (records.length === 0) return 0;
    }

    for (const record of records) {
      for (const [key, value] of Object.entries(parsed_updates)) {
        (record as any)[key] = value;
      }
      // Auto-renovar campos @UpdatedAt
      for (const col_name in schema.columns) {
        if (schema.columns[col_name].store?.updatedAt && !(col_name in parsed_updates)) {
          (record as any)[col_name] = undefined;
        }
      }

      if (tx) {
        tx.addPut(schema.name, (record as any)._toDBPayload());
      } else {
        await requireClient().send(
          new PutItemCommand({
            TableName: schema.name,
            Item: marshall((record as any)._toDBPayload(), { removeUndefinedValues: true }),
          })
        );
      }
    }

    return records.length;
  }

  static async delete<M extends Table>(
    this: new (data: any) => M,
    filters: Partial<InferAttributes<M>>,
    tx?: TransactionContext
  ): Promise<number> {
    const schema: Schema = (this as any)[SCHEMA];

    // Optimización: si el filtro es PK exacta y no hay softDelete, DeleteItem directo
    const pk_value = (this as any)._extractPK(filters);
    const has_soft_delete = Object.values(schema.columns).some(c => c.store.softDelete);

    if (pk_value !== null && !has_soft_delete) {
      if (tx) {
        tx.addDelete(schema.name, { [schema.primary_key]: pk_value });
      } else {
        await requireClient().send(
          new DeleteItemCommand({
            TableName: schema.name,
            Key: marshall({ [schema.primary_key]: pk_value }),
          })
        );
      }
      return 1;
    }

    // Fallback: where() + delete por cada uno
    const records = await (this as any).where(filters);
    if (records.length === 0) return 0;

    for (const record of records) {
      const id = (record as any)[schema.primary_key];
      if (!id) continue;

      if (tx) {
        tx.addDelete(schema.name, { [schema.primary_key]: id });
      } else {
        await requireClient().send(
          new DeleteItemCommand({
            TableName: schema.name,
            Key: marshall({ [schema.primary_key]: id }),
          })
        );
      }
    }

    return records.length;
  }

  /**
   * @description Atomically increment a numeric field by amount. Uses DynamoDB SET expression.
   * @description Incrementa atómicamente un campo numérico. Usa expresión SET de DynamoDB.
   */
  private static async _atomicAdd<M extends Table>(
    table_class: new (data: any) => M,
    field: string,
    amount: number,
    filters: Record<string, any>,
    tx?: TransactionContext
  ): Promise<number> {
    const schema: Schema = (table_class as any)[SCHEMA];
    const column = schema.columns[field];
    if (!column) throw new Error(`Unknown column '${field}' in ${schema.name}`);
    const db_name = column.name || field;

    const expr = `SET #f = if_not_exists(#f, :zero) + :amt`;
    const names = { '#f': db_name };
    const values = { ':amt': amount, ':zero': 0 };

    const pk_value = (table_class as any)._extractPK(filters);

    if (pk_value !== null) {
      const key = { [schema.primary_key]: pk_value };
      if (tx) {
        tx.addUpdate(schema.name, key, expr, names, values);
      } else {
        await requireClient().send(new UpdateItemCommand({
          TableName: schema.name,
          Key: marshall(key),
          UpdateExpression: expr,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: marshall(values),
        }));
      }
      return 1;
    }

    const records = await (table_class as any).where(filters);
    if (records.length === 0) return 0;

    if (tx) {
      for (const record of records) {
        tx.addUpdate(schema.name, { [schema.primary_key]: (record as any)[schema.primary_key] }, expr, names, values);
      }
    } else {
      const client = requireClient();
      await Promise.all(records.map((record: any) =>
        client.send(new UpdateItemCommand({
          TableName: schema.name,
          Key: marshall({ [schema.primary_key]: record[schema.primary_key] }),
          UpdateExpression: expr,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: marshall(values),
        }))
      ));
    }
    return records.length;
  }

  static async increment<M extends Table>(
    this: new (data: any) => M,
    field: keyof PickByType<InferAttributes<M>, number>,
    amount: number,
    filters: WhereFilters<M>,
    tx?: TransactionContext
  ): Promise<number> {
    return Table._atomicAdd(this, field as string, amount, filters as any, tx);
  }

  static async decrement<M extends Table>(
    this: new (data: any) => M,
    field: keyof PickByType<InferAttributes<M>, number>,
    amount: number,
    filters: WhereFilters<M>,
    tx?: TransactionContext
  ): Promise<number> {
    return Table._atomicAdd(this, field as string, -amount, filters as any, tx);
  }

  public async increment<K extends keyof PickByType<InferAttributes<T>, number>>(
    field: K,
    amount: number = 1
  ): Promise<void> {
    const schema: Schema = (this.constructor as any)[SCHEMA];
    const pk = (this as any)[schema.primary_key];
    if (!pk) throw new Error('Cannot increment without primary key');
    await Table._atomicAdd(this.constructor as any, field as string, amount, { [schema.primary_key]: pk });
    (this as any)[field as string] = ((this as any)[field as string] || 0) + amount;
  }

  public async decrement<K extends keyof PickByType<InferAttributes<T>, number>>(
    field: K,
    amount: number = 1
  ): Promise<void> {
    const schema: Schema = (this.constructor as any)[SCHEMA];
    const pk = (this as any)[schema.primary_key];
    if (!pk) throw new Error('Cannot decrement without primary key');
    await Table._atomicAdd(this.constructor as any, field as string, -amount, { [schema.primary_key]: pk });
    (this as any)[field as string] = ((this as any)[field as string] || 0) - amount;
  }

  static where<M extends Table>(this: new (props?: any) => M, key: keyof InferAttributes<M>, value: InferAttributes<M>[typeof key], options?: WhereOptions<M>): Promise<M[]>;
  static where<M extends Table>(this: new (props?: any) => M, key: keyof InferAttributes<M>, operator: QueryOperator, value: any, options?: WhereOptions<M>): Promise<M[]>;
  static where<M extends Table>(this: new (props?: any) => M, filters: WhereFilters<M>, options?: WhereOptions<M>): Promise<M[]>;
  static async where<M extends Table>(this: new (props?: any) => M, field_or_filters: any, operator_or_value?: any, value?: any, options?: WhereOptions<M>): Promise<M[]> {
    const schema: Schema = (this as any)[SCHEMA];

    // -- Normalización: todas las sobrecargas -> { field: { $op: value } } --
    let raw_filters: Record<string, any>;
    let opts: WhereOptions<M>;

    if (typeof field_or_filters === 'string') {
      if (OPERATORS.has(operator_or_value)) {
        raw_filters = { [field_or_filters]: { [operator_or_value]: value } };
        opts = options || {};
      } else {
        raw_filters = { [field_or_filters]: { $eq: operator_or_value } };
        opts = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      }
    } else {
      raw_filters = field_or_filters ?? {};
      opts = operator_or_value && typeof operator_or_value === 'object' && !Array.isArray(operator_or_value)
        ? operator_or_value : {};
    }

    const filters: Record<string, Record<string, any>> = {};
    for (const [field, val] of Object.entries(raw_filters)) {
      if (val === undefined) continue;
      if (!schema.columns[field]) throw new Error(`Unknown column '${field}' in ${schema.name}`);
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).some(k => OPERATORS.has(k))) {
        filters[field] = val;
      } else {
        filters[field] = { $eq: val };
      }
    }

    if (opts.limit === 0) return [];

    // Soft delete: excluir registros eliminados salvo que se pida lo contrario
    if (!opts._includeTrashed) {
      for (const col_name in schema.columns) {
        if (schema.columns[col_name].store?.softDelete && !(col_name in filters)) {
          filters[col_name] = { $notExists: true };
          break;
        }
      }
    }

    // -- Índice inverso db_name → prop_name --
    const db_to_prop: Record<string, string> = {};
    for (const prop_name in schema.columns) {
      db_to_prop[schema.columns[prop_name].name] = prop_name;
    }

    // -- Detectar mejor índice para QueryCommand --
    // Prioridad: 1) PK con $eq  2) GSI con $eq  3) Scan
    let query_field: string | null = null;
    let query_value: any = null;
    let query_index: string | undefined = undefined;

    // Primero buscar PK
    for (const [field, ops] of Object.entries(filters)) {
      if (field !== schema.primary_key) continue;
      const eq_key = Object.keys(ops).find(k => (OP_MAP[k] || k) === '=');
      if (eq_key && ops[eq_key] !== null) {
        query_field = field;
        query_value = ops[eq_key];
        query_index = undefined;
        break;
      }
    }

    // Si no hay PK, buscar el mejor GSI
    if (!query_field) {
      for (const [field, ops] of Object.entries(filters)) {
        const eq_key = Object.keys(ops).find(k => (OP_MAP[k] || k) === '=');
        if (!eq_key || ops[eq_key] === null) continue;
        const db_name = schema.columns[field]?.name || field;
        if (schema.gsis?.has(db_name)) {
          query_field = field;
          query_value = ops[eq_key];
          query_index = `${db_name}_index`;
          break;
        }
      }
    }

    // -- Construir expressions --
    // El campo elegido para Query va a KeyConditionExpression
    // TODO el resto (incluyendo soft delete, otros filtros) va a FilterExpression (server-side)
    const key_expressions: string[] = [];
    const filter_expressions: string[] = [];
    const attr_names: Record<string, string> = {};
    const attr_values: Record<string, any> = {};
    let idx = 0;

    for (const [field, ops] of Object.entries(filters)) {
      const column = schema.columns[field];
      const db_name = column?.name || field;

      for (const [op_key, op_val] of Object.entries(ops)) {
        if (op_val === undefined) continue;
        const op = OP_MAP[op_key] || op_key;
        const nk = `#a${idx}`;
        const vk = `:v${idx}`;
        attr_names[nk] = db_name;

        // KeyConditionExpression: solo el campo de Query con $eq
        const is_query_key = query_field === field && op === '=' && op_val === query_value;

        if ((op === '=' && op_val === null) || op === 'attribute_not_exists') {
          filter_expressions.push(`attribute_not_exists(${nk})`);
        } else if ((op === '<>' && op_val === null) || op === 'attribute_exists') {
          filter_expressions.push(`attribute_exists(${nk})`);
        } else if (op === 'in' && Array.isArray(op_val)) {
          if (op_val.length === 0) throw new Error(`Operator 'in' requires a non-empty array.`);
          const conds = op_val.map((v, i) => { const k = `${vk}_${i}`; attr_values[k] = v; return `${nk} = ${k}`; });
          filter_expressions.push(`(${conds.join(' OR ')})`);
        } else if (op === 'include') {
          attr_values[vk] = op_val;
          filter_expressions.push(`contains(${nk}, ${vk})`);
        } else if (is_query_key) {
          attr_values[vk] = op_val;
          key_expressions.push(`${nk} ${op} ${vk}`);
        } else {
          attr_values[vk] = op_val;
          filter_expressions.push(`${nk} ${op} ${vk}`);
        }
        idx++;
      }
    }

    // Proyección
    if (opts.attributes?.length) {
      for (const attr of opts.attributes) {
        const col = schema.columns[String(attr)];
        const pk = `#p${idx++}`;
        attr_names[pk] = col?.name || String(attr);
      }
    }

    // -- Ejecución: Query o Scan --
    let use_query = query_field !== null && key_expressions.length > 0;
    let items: any[] = [];

    const base_params: any = { TableName: schema.name };
    if (Object.keys(attr_names).length > 0) base_params.ExpressionAttributeNames = attr_names;
    if (Object.keys(attr_values).length > 0) base_params.ExpressionAttributeValues = marshall(attr_values, { removeUndefinedValues: true });
    if (filter_expressions.length > 0) base_params.FilterExpression = filter_expressions.join(' AND ');
    if (opts.attributes?.length) {
      base_params.ProjectionExpression = Object.keys(attr_names).filter(k => k.startsWith('#p')).join(', ');
    }

    if (use_query) {
      base_params.KeyConditionExpression = key_expressions.join(' AND ');
      if (query_index) base_params.IndexName = query_index;
    }

    const client = requireClient();
    const unmarshal_items = (raw_items: any[]) => {
      for (const item of raw_items) {
        const raw = unmarshall(item);
        const mapped: Record<string, any> = {};
        for (const k in raw) {
          if (raw[k] != null) mapped[db_to_prop[k] || k] = raw[k];
        }
        items.push(mapped);
      }
    };

    // Intentar Query. Si el GSI no existe, fall back a Scan y desregistrar GSI.
    if (use_query && query_index) {
      try {
        let last_key: any;
        do {
          if (last_key) base_params.ExclusiveStartKey = last_key;
          const result = await client.send(new QueryCommand(base_params));
          if (result.Items) unmarshal_items(result.Items);
          last_key = result.LastEvaluatedKey;
        } while (last_key);
      } catch (e: any) {
        if (e.name === 'ResourceNotFoundException' || e.message?.includes('index')) {
          // GSI no existe: remover del cache, mover KeyCondition a Filter, reintentar como Scan
          schema.gsis.delete(query_field!);
          delete base_params.KeyConditionExpression;
          delete base_params.IndexName;
          delete base_params.ExclusiveStartKey;
          const key_as_filter = key_expressions.join(' AND ');
          base_params.FilterExpression = base_params.FilterExpression
            ? `${key_as_filter} AND ${base_params.FilterExpression}`
            : key_as_filter;
          use_query = false;
          items = [];
        } else {
          throw e;
        }
      }
    }

    // Query por PK (sin GSI, no puede fallar por índice faltante) o Scan fallback
    if (!use_query || (use_query && !query_index)) {
      let last_key: any;
      const cmd = use_query ? QueryCommand : ScanCommand;
      do {
        if (last_key) base_params.ExclusiveStartKey = last_key;
        const result = await client.send(new cmd(base_params));
        if (result.Items) unmarshal_items(result.Items);
        last_key = result.LastEvaluatedKey;
      } while (last_key);
    }

    // Ordenar antes de paginar
    if (opts.order) {
      let sort_field = schema.primary_key;
      let sort_dir: 'ASC' | 'DESC' = 'ASC';

      if (typeof opts.order === 'string') {
        sort_dir = opts.order;
        for (const cn in schema.columns) {
          if (schema.columns[cn].store?.createdAt) { sort_field = cn; break; }
        }
      } else {
        const [f] = Object.keys(opts.order);
        sort_field = f;
        sort_dir = opts.order[f];
      }

      items.sort((a, b) => {
        if (a[sort_field] < b[sort_field]) return sort_dir === 'ASC' ? -1 : 1;
        if (a[sort_field] > b[sort_field]) return sort_dir === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    // Paginar
    const skip = opts.skip ?? opts.offset ?? 0;
    if (skip > 0 || opts.limit !== undefined) {
      items = items.slice(skip, opts.limit !== undefined ? skip + opts.limit : undefined);
    }

    // Instanciar
    const instances = items.map((item) => {
      if (opts.attributes) {
        const instance = Object.create(this.prototype);
        for (const attr of opts.attributes) {
          const column = schema.columns[attr as string];
          if (!column) continue;
          const val = item[attr as string] ?? null;
          Object.defineProperty(instance, attr as string, {
            enumerable: true, configurable: true,
            get: () => column.get.reduce((v: any, fn: any) => fn(v), val),
          });
        }
        return instance;
      }
      const instance = new this(item);
      (instance as any).__isPersisted = true;
      return instance;
    });

    if (opts.include) {
      await processIncludes(instances, opts.include as any, this);
    }

    return instances;
  }

  static async first<M extends Table>(
    this: new (props?: any) => M,
    filters: WhereFilters<M>,
    options?: WhereOptions<M>
  ): Promise<M | undefined> {
    const results = await (this as any).where(filters, { ...options, limit: 1 });
    return results[0];
  }

  static async last<M extends Table>(
    this: new (props?: any) => M,
    filters?: WhereFilters<M>,
    options?: WhereOptions<M>
  ): Promise<M | undefined> {
    const results = await (this as any).where(filters ?? {}, { ...options, order: 'DESC' as const, limit: 1 });
    return results[0];
  }
}
