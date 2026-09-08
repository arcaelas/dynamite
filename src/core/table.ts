/**
 * @file table.ts
 * @description Tabla autocontenida con arquitectura minimalista y Symbol storage
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */
import {
  BatchGetItemCommand,
  BatchWriteItemCommand,
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
import { pivotRows, processIncludes } from "../utils/relations";
import { requireClient, TransactionContext } from "./client";
import type { HookType, Schema } from "./decorator";
import { SCHEMA } from "./decorator";

const OP_MAP: Record<string, string> = {
  '=': '=', '<>': '<>', '!=': '<>', '<': '<', '<=': '<=', '>': '>', '>=': '>=',
  in: 'in', include: 'include', contains: 'include',
  $eq: '=', $ne: '<>', $lt: '<', $lte: '<=', $gt: '>', $gte: '>=',
  $in: 'in', $include: 'include', $contains: 'include',
  $exists: 'attribute_exists', $notExists: 'attribute_not_exists',
};
const OPERATORS = new Set(Object.keys(OP_MAP));

/** Segmentos de un Scan que va a leer la tabla completa */
const SCAN_SEGMENTS = 4;

/** Máximo de items por BatchWriteItem que acepta DynamoDB */
const BATCH_WRITE_SIZE = 25;

/** Máximo de claves por BatchGetItem que acepta DynamoDB */
const BATCH_GET_SIZE = 100;

/**
 * @description Evaluates the same filters as FilterExpression over an already-read item.
 * @description Evalúa los mismos filtros que FilterExpression sobre un item ya leído.
 */
const matches = (item: Record<string, any>, filters: Record<string, Record<string, any>>): boolean =>
  Object.entries(filters).every(([field, ops]) =>
    Object.entries(ops).every(([op_key, expected]) => {
      if (expected === undefined) return true;
      const op = OP_MAP[op_key] || op_key;
      const value = item[field];
      if ((op === '=' && expected === null) || op === 'attribute_not_exists') return value === undefined || value === null;
      if ((op === '<>' && expected === null) || op === 'attribute_exists') return value !== undefined && value !== null;
      if (op === 'in') return Array.isArray(expected) && expected.includes(value);
      if (op === 'include') {
        return typeof value === 'string' ? value.includes(String(expected))
          : Array.isArray(value) ? value.includes(expected)
          : false;
      }
      if (value === undefined || value === null) return false;
      return op === '=' ? value === expected
        : op === '<>' ? value !== expected
        : op === '<' ? value < (expected as any)
        : op === '<=' ? value <= (expected as any)
        : op === '>' ? value > (expected as any)
        : value >= (expected as any);
    })
  );

/**
 * @description Splits a list into chunks of the given size.
 * @description Parte una lista en lotes del tamaño dado.
 */
const chunked = <V>(list: V[], size: number): V[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_unused, i) => list.slice(i * size, i * size + size));

type WhereFilters<M> = {
  [K in keyof InferAttributes<M>]?:
  | InferAttributes<M>[K]
  | ({ [N in Exclude<QueryOperator, "in" | "$in">]?: InferAttributes<M>[K] } & { in?: InferAttributes<M>[K][]; $in?: InferAttributes<M>[K][] });
};

/**
 * @description Lifecycle hook signature. `this` is the model instance; update hooks receive the changes delta.
 * @description Firma de un hook de ciclo de vida. `this` es la instancia del modelo; los hooks de update reciben el delta de cambios.
 */
export type HookFn<T = any> = (this: T, changes?: Partial<InferAttributes<T>>) => void | Promise<void>;

/**
 * @description Options for mutation operations. `hook` is opt-in (default false); `tx` runs the operation inside a transaction.
 * @description Opciones para operaciones de mutación. `hook` es opt-in (default false); `tx` ejecuta la operación dentro de una transacción.
 */
export interface MutationOptions {
  hook?: boolean;
  tx?: TransactionContext;
}

/**
 * @description Result of a query: the instances plus the cursor of the next page, when there is one.
 * @description Resultado de una consulta: las instancias más el cursor de la página siguiente, cuando la hay.
 */
export type QueryResult<M> = M[] & { cursor?: Record<string, any> };

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

  public async save(options?: MutationOptions): Promise<boolean> {
    const schema: Schema = (this.constructor as any)[SCHEMA];
    const tx = options?.tx;

    if ((this as any).__isPersisted) {
      if (options?.hook) await Table._run_hooks(this, 'beforeUpdate', {});
      if (tx) {
        tx.addPut(schema.name, (this as any)._toDBPayload());
        if (options?.hook) tx.onCommit(() => Table._run_hooks(this, 'afterUpdate', {}));
      } else {
        await requireClient().send(
          new PutItemCommand({
            TableName: schema.name,
            Item: marshall((this as any)._toDBPayload(), { removeUndefinedValues: true }),
          })
        );
        if (options?.hook) await Table._run_hooks(this, 'afterUpdate', {});
      }
      return true;
    }

    if (options?.hook) await Table._run_hooks(this, 'beforeCreate');
    const created = await (this.constructor as any).create(
      Object.fromEntries(
        Object.keys(schema.columns)
          .filter(k => !schema.columns[k].store?.relation)
          .map(k => [k, (this as any)[k]])
      ),
      { hook: false, tx }
    );
    for (const key in schema.columns) {
      if (!schema.columns[key].store?.relation) {
        (this as any)[key] = (created as any)[key];
      }
    }
    (this as any).__isPersisted = true;
    if (options?.hook) await Table._run_hooks(this, 'afterCreate');
    return true;
  }

  public async update(data: Partial<InferAttributes<T>>, options?: MutationOptions): Promise<boolean> {
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

    // Ruta con hooks: aplicar cambios y persistir sobre esta misma instancia
    if (options?.hook) {
      for (const key in filtered_data) {
        (this as any)[key] = filtered_data[key];
      }
      // Auto-renovar campos @UpdatedAt no incluidos en los cambios
      for (const col_name in schema.columns) {
        if (schema.columns[col_name].store?.updatedAt && !(col_name in filtered_data)) {
          (this as any)[col_name] = undefined;
        }
      }

      await Table._run_hooks(this, 'beforeUpdate', filtered_data);

      const tx = options.tx;
      if (tx) {
        tx.addPut(schema.name, (this as any)._toDBPayload());
        tx.onCommit(() => Table._run_hooks(this, 'afterUpdate', filtered_data));
      } else {
        await requireClient().send(
          new PutItemCommand({
            TableName: schema.name,
            Item: marshall((this as any)._toDBPayload(), { removeUndefinedValues: true }),
          })
        );
        await Table._run_hooks(this, 'afterUpdate', filtered_data);
      }
      return true;
    }

    // La instancia ya tiene el registro completo: se escribe un solo UpdateItem con los
    // campos tocados, sin leerlo antes y sin reescribir las columnas que nadie cambió.
    const touched = Object.keys(filtered_data);
    for (const col_name in schema.columns) {
      if (schema.columns[col_name].store?.updatedAt && !(col_name in filtered_data)) touched.push(col_name);
    }

    if (!options?.tx && touched.length > 0) {
      for (const key of touched) (this as any)[key] = filtered_data[key];

      const names: Record<string, string> = { '#pk': schema.columns[schema.primary_key]?.name || schema.primary_key };
      const values: Record<string, any> = {};
      const assignments: string[] = [];

      touched.forEach((key, position) => {
        const next = (this as any)[key];
        if (next === undefined) return;
        names[`#u${position}`] = schema.columns[key].name || key;
        values[`:u${position}`] = next;
        assignments.push(`#u${position} = :u${position}`);
      });

      if (assignments.length === 0) return true;

      try {
        await requireClient().send(new UpdateItemCommand({
          TableName: schema.name,
          Key: marshall(Table._key(schema, (this as any)[schema.primary_key])),
          UpdateExpression: `SET ${assignments.join(', ')}`,
          ConditionExpression: 'attribute_exists(#pk)',
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
        }));
        return true;
      } catch (e: any) {
        if (e.name === 'ConditionalCheckFailedException') return false;
        throw e;
      }
    }

    const affected = await (this.constructor as any).update(filtered_data, {
      [schema.primary_key]: (this as any)[schema.primary_key],
    }, { tx: options?.tx });

    if (affected > 0) {
      for (const key in filtered_data) {
        (this as any)[key] = filtered_data[key];
      }
    }

    return affected > 0;
  }

  public async destroy(options?: MutationOptions): Promise<null> {
    const schema = (this.constructor as any)[SCHEMA];
    const id = (this as any)[schema.primary_key];

    if (!id) throw new Error("Cannot destroy record without ID");

    if (options?.hook) await Table._run_hooks(this, 'beforeDestroy');

    let soft_col: string | null = null;
    for (const column_name in schema.columns) {
      if (schema.columns[column_name].store?.softDelete) { soft_col = column_name; break; }
    }

    if (soft_col) {
      (this as any)[soft_col] = new Date().toISOString();
      await this.save({ tx: options?.tx });
    } else {
      await this.forceDestroy({ tx: options?.tx });
    }

    if (options?.hook) {
      if (options.tx) options.tx.onCommit(() => Table._run_hooks(this, 'afterDestroy'));
      else await Table._run_hooks(this, 'afterDestroy');
    }

    return null;
  }

  public async forceDestroy(options?: MutationOptions): Promise<null> {
    const schema = (this.constructor as any)[SCHEMA];
    const id = (this as any)[schema.primary_key];

    if (!id) throw new Error("Cannot destroy record without ID");

    if (options?.hook) await Table._run_hooks(this, 'beforeDestroy');

    const tx = options?.tx;
    if (tx) {
      tx.addDelete(schema.name, Table._key(schema, id));
    } else {
      await requireClient().send(
        new DeleteItemCommand({
          TableName: schema.name,
          Key: marshall(Table._key(schema, id)),
        })
      );
    }

    if (options?.hook) {
      if (tx) tx.onCommit(() => Table._run_hooks(this, 'afterDestroy'));
      else await Table._run_hooks(this, 'afterDestroy');
    }

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

    const existing = await pivotRows(relation.pivotTable, relation.foreignKey, foreign_key_value, {
      field: relation.relatedKey,
      value: related_id,
    });

    if (existing.length > 0) return;

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

    const existing = await pivotRows(relation.pivotTable, relation.foreignKey, local_id, {
      field: relation.relatedKey,
      value: related_id,
    });

    if (existing.length === 0) return;

    await Table._batchWrite(relation.pivotTable, existing.map(row => ({
      DeleteRequest: { Key: marshall({ id: row.id }) },
    })));
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

    // 1. Las relaciones existentes salen de una sola Query indexada sobre el pivote
    const rows = await pivotRows(relation.pivotTable, relation.foreignKey, local_id);
    const existing_ids = new Set(rows.map(row => row[relation.relatedKey]));
    const target_ids = new Set(related_ids);

    // 2. Las bajas y las altas viajan juntas en lotes de 25
    const writes = [
      ...rows
        .filter(row => !target_ids.has(row[relation.relatedKey]))
        .map(row => ({ DeleteRequest: { Key: marshall({ id: row.id }) } })),
      ...[...target_ids]
        .filter(id => !existing_ids.has(id))
        .map(id => ({
          PutRequest: {
            Item: marshall({
              id: `${local_id}_${id}`,
              [relation.foreignKey]: local_id,
              [relation.relatedKey]: id,
              created_at: new Date().toISOString(),
            }, { removeUndefinedValues: true }),
          },
        })),
    ];

    if (writes.length > 0) await Table._batchWrite(relation.pivotTable, writes);
  }

  /**
   * @description Builds the DynamoDB key of a record from its primary key value.
   * @description Construye la clave DynamoDB de un registro a partir del valor de su clave primaria.
   */
  private static _key(schema: Schema, value: any): Record<string, any> {
    return { [schema.columns[schema.primary_key]?.name || schema.primary_key]: value };
  }

  /**
   * @description Sends write requests in batches of 25, retrying whatever DynamoDB leaves unprocessed.
   * @description Envía peticiones de escritura en lotes de 25, reintentando lo que DynamoDB deje sin procesar.
   */
  private static async _batchWrite(table_name: string, requests: any[]): Promise<void> {
    const client = requireClient();

    // Un solo registro no necesita lote: el comando directo informa mejor sus errores
    if (requests.length === 1) {
      const [request] = requests;
      await client.send(request.PutRequest
        ? new PutItemCommand({ TableName: table_name, Item: request.PutRequest.Item })
        : new DeleteItemCommand({ TableName: table_name, Key: request.DeleteRequest.Key }) as any);
      return;
    }

    await Promise.all(chunked(requests, BATCH_WRITE_SIZE).map(async (chunk) => {
      let pending = chunk;
      for (let attempt = 0; pending.length > 0; attempt++) {
        const result = await client.send(new BatchWriteItemCommand({ RequestItems: { [table_name]: pending } }));
        pending = (result.UnprocessedItems?.[table_name] ?? []) as any[];
        if (pending.length > 0) await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 50));
      }
    }));
  }

  /**
   * @description Runs the write pipeline of a column over a value, with the current one as reference.
   * @description Ejecuta el pipeline de escritura de una columna sobre un valor, con el actual como referencia.
   */
  private static _apply(column: Schema['columns'][string], next: any, current?: any): any {
    return column.set.reduce((accumulated: any, fn: any) => fn(accumulated, current), next);
  }

  /**
   * @description Run the registered hooks of a given type on an instance, in declaration order.
   * @description Ejecuta los hooks registrados de un tipo dado sobre una instancia, en orden de declaración.
   */
  private static async _run_hooks(instance: any, type: HookType, changes?: any): Promise<void> {
    const schema: Schema = (instance.constructor as any)[SCHEMA];
    for (const method_name of schema.hooks[type]) {
      await instance[method_name]?.(changes);
    }
  }

  static async create<M extends Table>(
    this: new (data: any) => M,
    data: Partial<InferAttributes<M>>,
    options?: MutationOptions
  ): Promise<M> {
    const instance = new this(data);
    const schema = (this as any)[SCHEMA];
    const tx = options?.tx;

    if (options?.hook) await Table._run_hooks(instance, 'beforeCreate');

    const payload = (instance as any)._toDBPayload();
    const pk_db_name = schema.columns[schema.primary_key]?.name || schema.primary_key;
    const condition = {
      expression: 'attribute_not_exists(#pk)',
      names: { '#pk': pk_db_name },
    };

    if (tx) {
      tx.addPut(schema.name, payload, condition);
      tx.onCommit(() => { (instance as any).__isPersisted = true; });
      if (options?.hook) tx.onCommit(() => Table._run_hooks(instance, 'afterCreate'));
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
      if (options?.hook) await Table._run_hooks(instance, 'afterCreate');
    }

    return instance;
  }

  /**
   * @description Creates several records with BatchWriteItem, 25 items per request. It does not check
   * for duplicate primary keys, which BatchWriteItem cannot express: an existing record is overwritten.
   * @description Crea varios registros con BatchWriteItem, 25 items por petición. No comprueba claves
   * primarias duplicadas, que BatchWriteItem no admite: un registro existente se sobreescribe.
   * @param rows Datos de cada registro
   * @param options Opciones de mutación
   * @example
   * const logs = await Log.createMany([{ message: "a" }, { message: "b" }]);
   */
  static async createMany<M extends Table>(
    this: new (data: any) => M,
    rows: Array<Partial<InferAttributes<M>>>,
    options?: MutationOptions
  ): Promise<M[]> {
    const schema: Schema = (this as any)[SCHEMA];
    const instances = rows.map(row => new this(row));
    if (instances.length === 0) return instances;

    if (options?.hook) {
      for (const instance of instances) await Table._run_hooks(instance, 'beforeCreate');
    }

    const tx = options?.tx;
    if (tx) {
      for (const instance of instances) tx.addPut(schema.name, (instance as any)._toDBPayload());
      tx.onCommit(() => { for (const instance of instances) (instance as any).__isPersisted = true; });
      if (options?.hook) {
        tx.onCommit(async () => { for (const instance of instances) await Table._run_hooks(instance, 'afterCreate'); });
      }
      return instances;
    }

    await Table._batchWrite(schema.name, instances.map(instance => ({
      PutRequest: { Item: marshall((instance as any)._toDBPayload(), { removeUndefinedValues: true }) },
    })));

    for (const instance of instances) (instance as any).__isPersisted = true;
    if (options?.hook) {
      for (const instance of instances) await Table._run_hooks(instance, 'afterCreate');
    }

    return instances;
  }

  /**
   * @description Deletes records by primary key with BatchWriteItem, without reading them first.
   * Always a hard delete: it ignores `@DeleteAt` and does not run destroy hooks.
   * @description Elimina registros por clave primaria con BatchWriteItem, sin leerlos antes.
   * Siempre es borrado definitivo: ignora `@DeleteAt` y no ejecuta hooks de destrucción.
   * @param ids Claves primarias a eliminar
   * @param options Opciones de mutación
   * @example
   * await Log.deleteMany(["01H...", "01J..."]);
   */
  static async deleteMany<M extends Table>(
    this: new (data: any) => M,
    ids: Array<string | number>,
    options?: MutationOptions
  ): Promise<number> {
    const schema: Schema = (this as any)[SCHEMA];
    const keys = [...new Set(ids)].filter(id => id !== null && id !== undefined);
    if (keys.length === 0) return 0;

    const tx = options?.tx;
    if (tx) {
      for (const id of keys) tx.addDelete(schema.name, Table._key(schema, id));
      return keys.length;
    }

    await Table._batchWrite(schema.name, keys.map(id => ({
      DeleteRequest: { Key: marshall(Table._key(schema, id)) },
    })));

    return keys.length;
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
    options?: MutationOptions
  ): Promise<number> {
    const schema: Schema = (this as any)[SCHEMA];
    const tx = options?.tx;

    const parsed_updates: any = {};
    for (const key in updates) {
      const column = schema.columns[key];
      if (!column?.store?.relation) {
        parsed_updates[key] = updates[key];
      }
    }

    const pk_value = (this as any)._extractPK(filters);

    // Escritura directa por clave: un solo UpdateItem con los campos tocados y sin leer antes.
    // Solo cuando ningún pipeline de esos campos necesita el valor actual del registro.
    if (pk_value !== null && !tx && !options?.hook) {
      const touched = Object.keys(parsed_updates);
      for (const col_name in schema.columns) {
        if (schema.columns[col_name].store?.updatedAt && !(col_name in parsed_updates)) touched.push(col_name);
      }

      if (touched.length > 0 && !touched.some(key => schema.columns[key]?.store.readsCurrent)) {
        const names: Record<string, string> = { '#pk': schema.columns[schema.primary_key]?.name || schema.primary_key };
        const values: Record<string, any> = {};
        const assignments: string[] = [];

        touched.forEach((key, position) => {
          const column = schema.columns[key];
          const next = Table._apply(column, parsed_updates[key]);
          if (next === undefined) return;
          names[`#u${position}`] = column.name || key;
          values[`:u${position}`] = next;
          assignments.push(`#u${position} = :u${position}`);
        });

        if (assignments.length > 0) {
          try {
            await requireClient().send(new UpdateItemCommand({
              TableName: schema.name,
              Key: marshall(Table._key(schema, pk_value)),
              UpdateExpression: `SET ${assignments.join(', ')}`,
              ConditionExpression: 'attribute_exists(#pk)',
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
            }));
            return 1;
          } catch (e: any) {
            if (e.name === 'ConditionalCheckFailedException') return 0;
            throw e;
          }
        }
      }
    }

    let records: M[];

    if (pk_value !== null) {
      const client = requireClient();
      const result = await client.send(new GetItemCommand({
        TableName: schema.name,
        Key: marshall(Table._key(schema, pk_value)),
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

      if (options?.hook) await Table._run_hooks(record, 'beforeUpdate', parsed_updates);
      if (tx) tx.addPut(schema.name, (record as any)._toDBPayload());
    }

    // Fuera de una transacción el lote va por BatchWriteItem: 25 registros por petición
    if (!tx) {
      await Table._batchWrite(schema.name, records.map(record => ({
        PutRequest: { Item: marshall((record as any)._toDBPayload(), { removeUndefinedValues: true }) },
      })));
    }

    if (options?.hook) {
      for (const record of records) {
        if (tx) tx.onCommit(() => Table._run_hooks(record, 'afterUpdate', parsed_updates));
        else await Table._run_hooks(record, 'afterUpdate', parsed_updates);
      }
    }

    return records.length;
  }

  static async delete<M extends Table>(
    this: new (data: any) => M,
    filters: Partial<InferAttributes<M>>,
    options?: MutationOptions
  ): Promise<number> {
    const schema: Schema = (this as any)[SCHEMA];
    const tx = options?.tx;

    // Optimización: si el filtro es PK exacta, sin softDelete y sin hooks de destroy, DeleteItem directo
    const pk_value = (this as any)._extractPK(filters);
    const has_soft_delete = Object.values(schema.columns).some(c => c.store.softDelete);
    const has_destroy_hooks = !!options?.hook && (schema.hooks.beforeDestroy.length > 0 || schema.hooks.afterDestroy.length > 0);

    if (pk_value !== null && !has_soft_delete && !has_destroy_hooks) {
      if (tx) {
        tx.addDelete(schema.name, Table._key(schema, pk_value));
      } else {
        await requireClient().send(
          new DeleteItemCommand({
            TableName: schema.name,
            Key: marshall(Table._key(schema, pk_value)),
          })
        );
      }
      return 1;
    }

    // Fallback: where() y borrado por lotes
    const records = await (this as any).where(filters);
    const targets = records.filter((record: any) => record[schema.primary_key]);
    if (targets.length === 0) return 0;

    if (options?.hook) {
      for (const record of targets) await Table._run_hooks(record, 'beforeDestroy');
    }

    if (tx) {
      for (const record of targets) tx.addDelete(schema.name, Table._key(schema, (record as any)[schema.primary_key]));
    } else {
      await Table._batchWrite(schema.name, targets.map((record: any) => ({
        DeleteRequest: { Key: marshall(Table._key(schema, record[schema.primary_key])) },
      })));
    }

    if (options?.hook) {
      for (const record of targets) {
        if (tx) tx.onCommit(() => Table._run_hooks(record, 'afterDestroy'));
        else await Table._run_hooks(record, 'afterDestroy');
      }
    }

    return targets.length;
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
      const key = Table._key(schema, pk_value);
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
        tx.addUpdate(schema.name, Table._key(schema, (record as any)[schema.primary_key]), expr, names, values);
      }
    } else {
      const client = requireClient();
      await Promise.all(records.map((record: any) =>
        client.send(new UpdateItemCommand({
          TableName: schema.name,
          Key: marshall(Table._key(schema, record[schema.primary_key])),
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
    options?: MutationOptions
  ): Promise<number> {
    return Table._atomicAdd(this, field as string, amount, filters as any, options?.tx);
  }

  static async decrement<M extends Table>(
    this: new (data: any) => M,
    field: keyof PickByType<InferAttributes<M>, number>,
    amount: number,
    filters: WhereFilters<M>,
    options?: MutationOptions
  ): Promise<number> {
    return Table._atomicAdd(this, field as string, -amount, filters as any, options?.tx);
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

  static where<M extends Table>(this: new (props?: any) => M, key: keyof InferAttributes<M>, value: InferAttributes<M>[typeof key], options?: WhereOptions<M>): Promise<QueryResult<M>>;
  static where<M extends Table>(this: new (props?: any) => M, key: keyof InferAttributes<M>, operator: QueryOperator, value: any, options?: WhereOptions<M>): Promise<QueryResult<M>>;
  static where<M extends Table>(this: new (props?: any) => M, filters: WhereFilters<M>, options?: WhereOptions<M>): Promise<QueryResult<M>>;
  static async where<M extends Table>(this: new (props?: any) => M, field_or_filters: any, operator_or_value?: any, value?: any, options?: WhereOptions<M>): Promise<QueryResult<M>> {
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
    for (const [field, val] of Object.entries({ ...raw_filters, ...(opts.where as Record<string, any> | undefined) })) {
      if (val === undefined) continue;
      if (!schema.columns[field]) throw new Error(`Unknown column '${field}' in ${schema.name}`);
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).some(k => OPERATORS.has(k))) {
        filters[field] = val;
      } else {
        filters[field] = { $eq: val };
      }
    }

    if (opts.limit === 0) return [] as unknown as QueryResult<M>;

    // Soft delete: excluir registros eliminados salvo que se pida lo contrario
    if (!(opts.deleted ?? opts._includeTrashed)) {
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

    // Sin $eq sobre PK ni GSI: un $in sobre alguno de ellos se resuelve con una Query por valor
    let query_values: any[] | null = null;
    let in_placeholder: string | null = null;
    let in_name: string | null = null;
    if (!query_field) {
      for (const [field, ops] of Object.entries(filters)) {
        const in_key = Object.keys(ops).find(k => (OP_MAP[k] || k) === 'in');
        const db_name = schema.columns[field]?.name || field;
        const indexed = field === schema.primary_key || schema.gsis?.has(db_name);
        if (in_key && indexed && Array.isArray(ops[in_key]) && ops[in_key].length > 0) {
          query_field = field;
          query_values = [...new Set(ops[in_key])];
          query_index = field === schema.primary_key ? undefined : `${db_name}_index`;
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
          if (query_field === field && query_values) {
            in_placeholder = vk;
            in_name = nk;
            key_expressions.push(`${nk} = ${vk}`);
          } else {
            const conds = op_val.map((v, i) => { const k = `${vk}_${i}`; attr_values[k] = v; return `${nk} = ${k}`; });
            filter_expressions.push(`(${conds.join(' OR ')})`);
          }
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

    // -- Ejecución --
    const client = requireClient();
    let items: any[] = [];
    let use_query = query_field !== null && key_expressions.length > 0;

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
    if (opts.cursor) base_params.ExclusiveStartKey = marshall(opts.cursor, { removeUndefinedValues: true });

    // Campo y dirección de orden, resueltos antes de leer para saber si el índice ya los da
    let sort_field: string | null = null;
    let sort_dir: 'ASC' | 'DESC' = 'ASC';
    if (opts.order) {
      if (typeof opts.order === 'string') {
        sort_dir = opts.order;
        sort_field = schema.primary_key;
        for (const cn in schema.columns) {
          if (schema.columns[cn].store?.createdAt) { sort_field = cn; break; }
        }
      } else {
        const [field] = Object.keys(opts.order);
        sort_field = field;
        sort_dir = (opts.order as Record<string, 'ASC' | 'DESC'>)[field];
      }
    }

    // Una Query sobre la tabla base ordenada por su sort key ya viene ordenada de DynamoDB:
    // ScanIndexForward evita traer todo a memoria solo para ordenarlo
    const sort_key = Object.values(schema.columns).find(c => c.store.indexSort && !c.store.primaryKey);
    let scan_forward: boolean | undefined = undefined;
    if (sort_field && sort_key && use_query && !query_index && schema.columns[sort_field]?.name === sort_key.name) {
      scan_forward = sort_dir === 'ASC';
      base_params.ScanIndexForward = scan_forward;
    }

    const skip = opts.cursor ? 0 : (opts.skip ?? opts.offset ?? 0);
    const needed = opts.limit === undefined ? Infinity : skip + opts.limit;
    const early_stop = needed !== Infinity && (!sort_field || scan_forward !== undefined);

    const page_of = (raw_items: any[] = []) => raw_items.map(raw_item => {
      const raw = unmarshall(raw_item);
      const mapped: Record<string, any> = {};
      for (const k in raw) {
        if (raw[k] != null) mapped[db_to_prop[k] || k] = raw[k];
      }
      return mapped;
    });

    let cursor: Record<string, any> | undefined = undefined;

    // Recorre las páginas de un comando. Con `stop` corta en cuanto junta los ítems
    // pedidos y devuelve la clave donde quedó, que es el cursor de la página siguiente.
    const drain = async (Command: new (input: any) => any, params: any, into: any[], stop: boolean): Promise<Record<string, any> | undefined> => {
      let last_key: any = params.ExclusiveStartKey;
      for (;;) {
        const page: any = { ...params };
        if (last_key) page.ExclusiveStartKey = last_key;
        else delete page.ExclusiveStartKey;
        if (stop && !page.FilterExpression) page.Limit = Math.max(1, needed - into.length);
        const result: any = await client.send(new Command(page));
        into.push(...page_of(result.Items));
        last_key = result.LastEvaluatedKey;
        if (!last_key) return undefined;
        if (stop && into.length >= needed) return unmarshall(last_key);
      }
    };

    // Lectura directa por clave primaria: GetItem para un valor y BatchGetItem para varios.
    // Cuesta las mismas unidades de lectura que la Query equivalente y ahorra viajes;
    // el resto de los filtros se evalúa sobre el ítem ya leído.
    const key_route = !sort_key && !query_index && query_field === schema.primary_key;

    if (key_route) {
      const pk_db_name = schema.columns[schema.primary_key]?.name || schema.primary_key;
      const keys = (query_values ?? [query_value]).map(value => marshall({ [pk_db_name]: value }));
      const projection = opts.attributes?.length && Object.keys(filters).length === 1
        ? { ProjectionExpression: base_params.ProjectionExpression, ExpressionAttributeNames: attr_names }
        : {};

      if (keys.length === 1) {
        const result = await client.send(new GetItemCommand({ TableName: schema.name, Key: keys[0], ...projection }));
        items = page_of(result.Item ? [result.Item] : []);
      } else {
        const chunks: any[][] = [];
        for (const chunk of chunked(keys, BATCH_GET_SIZE)) chunks.push(chunk);
        const pages = await Promise.all(chunks.map(async (chunk) => {
          const found: any[] = [];
          let pending = chunk;
          while (pending.length > 0) {
            const result = await client.send(new BatchGetItemCommand({
              RequestItems: { [schema.name]: { Keys: pending, ...projection } },
            }));
            found.push(...(result.Responses?.[schema.name] ?? []));
            pending = result.UnprocessedKeys?.[schema.name]?.Keys ?? [];
          }
          return page_of(found);
        }));
        for (const page of pages) items.push(...page);
      }

      items = items.filter(item => matches(item, filters));
    } else {
      // Un Scan que igual va a leer la tabla entera se parte en segmentos paralelos:
      // las mismas unidades de lectura, la latencia dividida entre SCAN_SEGMENTS
      const run_scan = async () => {
        if (needed === Infinity && !opts.cursor) {
          const parts = await Promise.all(
            Array.from({ length: SCAN_SEGMENTS }, async (_unused, segment) => {
              const into: any[] = [];
              await drain(ScanCommand, { ...base_params, Segment: segment, TotalSegments: SCAN_SEGMENTS }, into, false);
              return into;
            })
          );
          for (const part of parts) items.push(...part);
          return;
        }
        cursor = await drain(ScanCommand, base_params, items, early_stop);
      };

      // Una Query por valor cuando la clave viene de un $in; una sola cuando viene de $eq
      const run_query = async () => {
        const values = query_values ?? [query_value];
        for (const value of values) {
          if (in_placeholder) base_params.ExpressionAttributeValues = marshall({ ...attr_values, [in_placeholder]: value }, { removeUndefinedValues: true });
          const last_key = await drain(QueryCommand, base_params, items, early_stop);
          cursor = values.length === 1 ? last_key : undefined;
          if (early_stop && items.length >= needed) break;
        }
      };

      // Intentar Query. Si el GSI no existe, fall back a Scan y desregistrar GSI.
      if (use_query && query_index) {
        try {
          await run_query();
        } catch (e: any) {
          if (e.name === 'ResourceNotFoundException' || e.message?.includes('index')) {
            // GSI no existe: remover del cache, mover KeyCondition a Filter, reintentar como Scan
            schema.gsis.delete(schema.columns[query_field!]?.name || query_field!);
            delete base_params.KeyConditionExpression;
            delete base_params.IndexName;
            delete base_params.ExclusiveStartKey;
            delete base_params.ScanIndexForward;
            const key_as_filter = query_values
              ? `(${query_values.map((v, i) => { attr_values[`${in_placeholder}_${i}`] = v; return `${in_name} = ${in_placeholder}_${i}`; }).join(' OR ')})`
              : key_expressions.join(' AND ');
            base_params.ExpressionAttributeValues = marshall(attr_values, { removeUndefinedValues: true });
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

      if (!use_query) await run_scan();
      else if (!query_index) await run_query();
    }

    // Ordenar antes de paginar, salvo que el índice ya haya devuelto el orden pedido
    if (sort_field && scan_forward === undefined) {
      const field = sort_field;
      items.sort((a, b) => {
        if (a[field] < b[field]) return sort_dir === 'ASC' ? -1 : 1;
        if (a[field] > b[field]) return sort_dir === 'ASC' ? 1 : -1;
        return 0;
      });
    }

    // Paginar
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
    }) as QueryResult<M>;

    if (opts.include) {
      await processIncludes(instances, opts.include as any, this);
    }

    Object.defineProperty(instances, 'cursor', { value: cursor, enumerable: false, configurable: true });

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
