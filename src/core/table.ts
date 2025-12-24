/**
 * @file table.ts
 * @description Tabla autocontenida con arquitectura minimalista y Symbol storage
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */
import {
  DeleteItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import type {
  InferAttributes,
  QueryOperator,
  WhereOptions,
} from "../@types/index";
import { processIncludes } from "../utils/relations";
import { requireClient, TransactionContext } from "./client";
import { SCHEMA } from "./decorator";

type SimpleWhereOptions<M> = {
  order?: "ASC" | "DESC" | { [key: string]: "ASC" | "DESC" };
  offset?: number;
  skip?: number;
  limit?: number;
  attributes?: (keyof InferAttributes<M>)[];
  include?: NonNullable<WhereOptions<M>["include"]>;
  _includeTrashed?: boolean;
};

type Noop = (...args: any) => any;
interface Schema {
  name: string;
  primary_key: string;
  columns: {
    [K: string]: {
      get: Noop;
      set: Noop;
      store: {
        [K: string]: any;
        relation: {
          type: "HasMany" | "HasOne" | "BelognsTo" | "ManyToMany";
          local: string;
          foreign: string;
          pivot?: string;
        };
      };
    };
  };
}

export default class Table<T = any> {
  static [SCHEMA]: Schema; // Declaración sin inicialización

  // Cache para instancias de relaciones (único Map necesario)
  private readonly _relationCache: Map<string, any> = new Map();

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
        // Relación con closure
        let relation_value = (props as any)[column_name] ?? undefined;

        Object.defineProperty(this, column_name, {
          enumerable: true,
          configurable: true,
          set: (v: any) => {
            relation_value = v;
          },
          get: () => {
            if (relation_value === undefined) return undefined;

            // Cachear instancias para evitar recreación
            const cache_key = `${column_name}:${JSON.stringify(
              relation_value
            )}`;
            if (this._relationCache.has(cache_key)) {
              return this._relationCache.get(cache_key);
            }

            const RelatedModel = column.store.relation.model();
            const type = column.store.relation.type;

            let result: any;
            if (type === "HasMany" || type === "ManyToMany") {
              result = []
                .concat(relation_value ?? [])
                .filter(Boolean)
                .map((item: any) =>
                  item instanceof RelatedModel ? item : new RelatedModel(item)
                );
            } else {
              if (relation_value === null) return null;
              result =
                relation_value instanceof RelatedModel
                  ? relation_value
                  : new RelatedModel(relation_value);
            }

            // Guardar en caché
            this._relationCache.set(cache_key, result);
            return result;
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
            // Pipeline de setters recibe (current, accumulated)
            value = column.set.reduce(
              (accumulated: any, fn: any) => fn(value, accumulated),
              next
            );
          },
        });

        // Asignar valor inicial a través del setter para que se procese
        if (column_name in props) {
          (this as any)[column_name] = (props as any)[column_name];
        }
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
   * @description Mapea nombres de propiedades TypeScript a nombres de columnas de DB
   * @param data Objeto con propiedades TypeScript
   * @returns Objeto con nombres de columnas de DB
   */
  private _mapPropertiesToDB(data: Record<string, any>): Record<string, any> {
    const schema = (this.constructor as any)[SCHEMA];
    const mapped: Record<string, any> = {};

    for (const prop_name in data) {
      const column = schema.columns[prop_name];
      if (!column) {
        mapped[prop_name] = data[prop_name];
        continue;
      }
      const db_name = column.name || prop_name;
      mapped[db_name] = data[prop_name];
    }

    return mapped;
  }

  /**
   * @description Mapea nombres de columnas de DB a nombres de propiedades TypeScript
   * @param data Objeto con nombres de columnas de DB
   * @returns Objeto con propiedades TypeScript
   */
  private static _mapDBToProperties(data: Record<string, any>): Record<string, any> {
    const schema = (this as any)[SCHEMA];
    const mapped: Record<string, any> = {};

    // Crear índice inverso: db_name → prop_name
    const db_to_prop: Record<string, string> = {};
    for (const prop_name in schema.columns) {
      const db_name = schema.columns[prop_name].name;
      db_to_prop[db_name] = prop_name;
    }

    // Mapear datos de DB a propiedades
    for (const db_name in data) {
      const prop_name = db_to_prop[db_name] || db_name;
      mapped[prop_name] = data[db_name];
    }

    return mapped;
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
    const schema = (this.constructor as any)[SCHEMA];
    const primary_key_name = schema.primary_key || "id";
    const primary_key_value = (this as any)[primary_key_name];

    const data: any = {};
    for (const column_name in schema.columns) {
      const column = schema.columns[column_name];
      if (!column.store?.relation) {
        data[column_name] = (this as any)[column_name];
      }
    }

    // Intentar UPDATE primero
    const updated = await this.update(data);

    // Si no actualizó nada (registro no existe), hacer INSERT
    if (!updated && primary_key_value) {
      // Verificar si el registro existe
      const existing = await (this.constructor as any).where({
        [primary_key_name]: primary_key_value,
      });

      if (existing.length === 0) {
        // No existe, crear nuevo registro
        const created = await (this.constructor as any).create(data);
        // Sincronizar propiedades desde el registro creado
        for (const key in created) {
          if (Object.prototype.hasOwnProperty.call(created, key)) {
            (this as any)[key] = created[key];
          }
        }
        (this as any).__isPersisted = true;
        return true;
      }
    }

    if (updated) {
      (this as any).__isPersisted = true;
    }

    return updated;
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

    // Validar campos @NotNull antes de guardar
    for (const column_name in schema.columns) {
      const column = schema.columns[column_name];
      if (column.store?.nullable === false) {
        const value = (instance as any)[column_name];
        const is_empty =
          value === null ||
          value === undefined ||
          (typeof value === "string" && value.trim() === "");
        if (is_empty) {
          const message =
            column.store.notNullMessage ||
            `El campo ${column_name} no puede estar vacío`;
          throw new Error(message);
        }
      }
    }

    const payload = (instance as any)._toDBPayload();

    if (tx) {
      tx.addPut(schema.name, payload);
    } else {
      const client = requireClient();
      await client.send(
        new PutItemCommand({
          TableName: schema.name,
          Item: marshall(payload, { removeUndefinedValues: true }),
        })
      );
    }

    // Marcar instancia como persistida
    (instance as any).__isPersisted = true;

    return instance;
  }

  static async update<M extends Table>(
    this: new (data: any) => M,
    updates: Partial<InferAttributes<M>>,
    filters: Partial<InferAttributes<M>>,
    tx?: TransactionContext
  ): Promise<number> {
    const schema = (this as any)[SCHEMA];

    // Filtrar solo campos que no son relaciones
    const parsed_updates: any = {};
    for (const key in updates) {
      const column = schema.columns[key];
      if (!column?.store?.relation) {
        parsed_updates[key] = updates[key];
      }
    }

    const records = await (this as any).where(filters);
    if (records.length === 0) return 0;

    for (const record of records) {
      // Asignar valores - los setters de la instancia procesarán automáticamente
      for (const [key, value] of Object.entries(parsed_updates)) {
        (record as any)[key] = value;
      }

      if (tx) {
        tx.addPut(schema.name, (record as any)._toDBPayload());
      } else {
        await requireClient().send(
          new PutItemCommand({
            TableName: schema.name,
            Item: marshall((record as any)._toDBPayload(), {
              removeUndefinedValues: true,
            }),
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
    const records = await (this as any).where(filters);
    if (records.length === 0) return 0;

    const schema = (this as any)[SCHEMA];

    for (const record of records) {
      const id = (record as any)[schema.primary_key];

      if (id) {
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
    }

    return records.length;
  }

  static where<M extends Table>(
    this: new (props?: any) => M,
    key: keyof InferAttributes<M>,
    value: any,
    options?: SimpleWhereOptions<M>
  ): Promise<M[]>;
  static where<M extends Table>(
    this: new (props?: any) => M,
    key: keyof InferAttributes<M>,
    operator: QueryOperator,
    value: any,
    options?: SimpleWhereOptions<M>
  ): Promise<M[]>;
  static where<M extends Table>(
    this: new (props?: any) => M,
    query: object,
    options?: SimpleWhereOptions<M>
  ): Promise<M[]>;
  static async where<M extends Table>(
    this: new (props?: any) => M,
    field_or_filters: any,
    operator_or_value?: any,
    value?: any,
    options?: WhereOptions<M>
  ): Promise<M[]> {
    const schema = (this as any)[SCHEMA];

    // ========================================================================
    // FASE 1: NORMALIZACIÓN DE ARGUMENTOS
    // Transforma las 3 sobrecargas en un formato unificado (filters + options)
    // ========================================================================
    let filters: any;
    let queryOptions: WhereOptions<M>;
    let operator: QueryOperator = "=";

    if (
      typeof operator_or_value === "string" &&
      [
        "=",
        "<>",
        "!=",
        "<",
        "<=",
        ">",
        ">=",
        "in",
        "$eq",
        "$ne",
        "$lt",
        "$lte",
        "$gt",
        "$gte",
        "$in",
        "$include",
        "include",
      ].includes(operator_or_value)
    ) {
      operator = operator_or_value as QueryOperator;
      // Normalizar operadores para DynamoDB
      if (operator === "!=" || operator === "$ne") {
        operator = "<>";
      }
      // Wrap value in operator object for proper processing
      if (operator !== "=") {
        filters = { [field_or_filters]: { [operator]: value } };
      } else {
        filters = { [field_or_filters]: value };
      }
      queryOptions = options || {};
    } else if (value !== undefined) {
      filters = {
        [field_or_filters]: Array.isArray(operator_or_value)
          ? { in: operator_or_value }
          : operator_or_value,
      };
      queryOptions = value || {};
    } else if (
      operator_or_value !== undefined &&
      typeof operator_or_value === "object"
    ) {
      filters = field_or_filters;
      queryOptions = operator_or_value;
    } else {
      filters = field_or_filters;
      queryOptions = {};
    }

    // Validaciones de paginación
    if (queryOptions.limit !== undefined) {
      if (queryOptions.limit < 0)
        throw new Error("limit debe ser mayor o igual a 0");
      if (queryOptions.limit === 0) return []; // Retorno temprano optimizado
    }
    if (queryOptions.offset !== undefined && queryOptions.offset < 0)
      throw new Error("offset debe ser mayor o igual a 0");

    // Validar order: puede ser string "ASC"|"DESC" o objeto { field: "ASC"|"DESC" }
    if (queryOptions.order) {
      if (typeof queryOptions.order === "string") {
        if (!["ASC", "DESC"].includes(queryOptions.order)) {
          throw new Error('order debe ser "ASC" o "DESC"');
        }
      } else if (typeof queryOptions.order === "object") {
        const keys = Object.keys(queryOptions.order);
        if (keys.length !== 1) {
          throw new Error("order object debe tener exactamente un campo");
        }
        const direction = queryOptions.order[keys[0]];
        if (!["ASC", "DESC"].includes(direction)) {
          throw new Error('order direction debe ser "ASC" o "DESC"');
        }
      }
    }

    if (!queryOptions._includeTrashed) {
      for (const column_name in schema.columns) {
        if (
          schema.columns[column_name].store?.softDelete &&
          !(column_name in filters)
        ) {
          // Filtrar registros soft-deleted: donde el campo NO existe (registros activos)
          filters[column_name] = { $notExists: true };
          break;
        }
      }
    }

    // ========================================================================
    // FASE 2: CONSTRUCCIÓN DE COMANDO DYNAMODB
    // Construye FilterExpression, ProjectionExpression y parámetros del comando
    // ========================================================================
    const expressions: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, any> = {};
    const aliases: Record<string, string> = {
      // Literal operators (identity mapping)
      "=": "=",
      "<>": "<>",
      "!=": "<>",
      "<": "<",
      "<=": "<=",
      ">": ">",
      ">=": ">=",
      in: "in",
      include: "include",
      contains: "include",
      // Sugar syntax
      $eq: "=",
      $ne: "<>",
      $lt: "<",
      $lte: "<=",
      $gt: ">",
      $gte: ">=",
      $in: "in",
      $include: "include",
      $contains: "include",
      "attribute-not-exists": "attribute_not_exists",
      "attribute-exists": "attribute_exists",
      $exists: "attribute_exists",
      $notExists: "attribute_not_exists",
    };
    let idx = 0;

    for (const [field, filter_val] of Object.entries(filters)) {
      if (filter_val === undefined) continue;

      // Mapear nombre de propiedad TS → nombre de columna DB
      const column = schema.columns[field];
      const db_field_name = column?.name || field;

      const is_obj =
        filter_val !== null &&
        typeof filter_val === "object" &&
        !Array.isArray(filter_val) &&
        Object.keys(filter_val).some((k) => k in aliases);

      if (is_obj) {
        for (const [op_key, op_val] of Object.entries(filter_val)) {
          if (op_val === undefined) continue;
          const op = aliases[op_key] || op_key;
          if (
            ![
              "=",
              "<>",
              "!=",
              "<",
              "<=",
              ">",
              ">=",
              "in",
              "include",
              "attribute_not_exists",
              "attribute_exists",
            ].includes(op)
          )
            continue;

          const name_key = `#attr${idx}`;
          const val_key = `:val${idx}`;
          names[name_key] = db_field_name;

          if (op === "in" && Array.isArray(op_val)) {
            if (op_val.length === 0) {
              throw new Error(
                `Operador 'in' requiere un array no vacío. Para buscar sin filtro, omite el operador.`
              );
            }
            // DynamoDB no soporta IN nativo, usar OR chain
            const or_conditions = op_val.map((v, i) => {
              const k = `${val_key}_${i}`;
              values[k] = v;
              return `${name_key} = ${k}`;
            });
            expressions.push(`(${or_conditions.join(" OR ")})`);
          } else if (op === "include") {
            values[val_key] = op_val;
            // $include: if field is array, checks includes; if string, checks contains (LIKE)
            expressions.push(`contains(${name_key}, ${val_key})`);
          } else if (op === "attribute_not_exists") {
            expressions.push(`attribute_not_exists(${name_key})`);
          } else if (op === "attribute_exists") {
            expressions.push(`attribute_exists(${name_key})`);
          } else if (op === "!=" || op === "<>") {
            if (op_val === null) {
              expressions.push(`attribute_exists(${name_key})`);
            } else {
              values[val_key] = op_val;
              expressions.push(`${name_key} <> ${val_key}`);
            }
          } else {
            values[val_key] = op_val;
            expressions.push(`${name_key} ${op} ${val_key}`);
          }
          idx++;
        }
      } else if (filter_val === null) {
        const name_key = `#attr${idx}`;
        names[name_key] = db_field_name;
        expressions.push(`attribute_not_exists(${name_key})`);
        idx++;
      } else if (filter_val !== null) {
        const name_key = `#attr${idx}`;
        const val_key = `:val${idx}`;
        names[name_key] = db_field_name;
        values[val_key] = filter_val;
        expressions.push(`${name_key} ${operator} ${val_key}`);
        idx++;
      }
    }

    const scanParams: any = {
      TableName: schema.name,
      ExpressionAttributeNames: names,
    };

    if (expressions.length > 0) {
      scanParams.FilterExpression = expressions.join(" AND ");
      // Only add ExpressionAttributeValues if there are actual values
      if (Object.keys(values).length > 0) {
        scanParams.ExpressionAttributeValues = marshall(values, {
          removeUndefinedValues: true,
        });
      }
    }

    if (queryOptions.attributes && queryOptions.attributes.length > 0) {
      const projectionExpressions = queryOptions.attributes.map(
        (attr, index) => {
          const aliasKey = `#proj${index}`;
          // Mapear nombre de propiedad TS → nombre de columna DB
          const column = schema.columns[String(attr)];
          const db_attr_name = column?.name || String(attr);
          scanParams.ExpressionAttributeNames[aliasKey] = db_attr_name;
          return aliasKey;
        }
      );
      scanParams.ProjectionExpression = projectionExpressions.join(", ");
    }

    if (Object.keys(scanParams.ExpressionAttributeNames).length === 0) {
      delete scanParams.ExpressionAttributeNames;
    }

    // ========================================================================
    // FASE 3: EJECUCIÓN Y MAPEO
    // Ejecuta comando(s), ordena resultados completos y aplica paginación
    // ========================================================================
    let allItems: any[] = [];
    let lastEvaluatedKey: any = undefined;

    // 1. Escanear TODOS los items que coinciden con el filtro
    do {
      if (lastEvaluatedKey) scanParams.ExclusiveStartKey = lastEvaluatedKey;

      const result = await requireClient().send(new ScanCommand(scanParams));

      if (result.Items) {
        const items = result.Items.map((item) => {
          const raw = unmarshall(item);
          for (const k of Object.keys(raw)) {
            if (raw[k] === null || raw[k] === undefined) delete raw[k];
          }
          return raw;
        });
        allItems.push(...items);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // 2. Ordenar ANTES de aplicar paginación (para resultados determinísticos)
    if (queryOptions.order) {
      let sortField = schema.primary_key;
      let sortDirection: "ASC" | "DESC" = "ASC";

      // Determinar campo y dirección de ordenamiento
      if (typeof queryOptions.order === "string") {
        // Sintaxis string: usar created_at o primary_key
        sortDirection = queryOptions.order;
        for (const column_name in schema.columns) {
          if (schema.columns[column_name].store?.createdAt) {
            sortField = column_name;
            break;
          }
        }
      } else {
        // Sintaxis objeto: { fieldName: "ASC"|"DESC" }
        const fieldName = Object.keys(queryOptions.order)[0];
        sortField = fieldName;
        sortDirection = queryOptions.order[fieldName];
      }

      allItems.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal < bVal) return sortDirection === "ASC" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "ASC" ? 1 : -1;
        return 0;
      });
    }

    // 3. Aplicar paginación DESPUÉS de ordenar (skip es alias de offset)
    const offset = queryOptions.skip ?? queryOptions.offset ?? 0;
    const limit = queryOptions.limit ?? allItems.length;
    allItems = allItems.slice(offset, offset + limit);

    const instances = allItems.map((item) => {
      // Mapear nombres de DB → propiedades TS
      const mapped_item = (this as any)._mapDBToProperties(item);

      if (queryOptions.attributes) {
        const instance = Object.create(this.prototype);
        for (const attr of queryOptions.attributes) {
          const column = schema.columns[attr];
          if (column) {
            const value = mapped_item[attr] ?? null;
            Object.defineProperty(instance, attr, {
              enumerable: true,
              configurable: true,
              get: () => column.get.reduce((v: any, fn: any) => fn(v), value),
            });
          }
        }
        return instance;
      }
      const instance = new this(mapped_item);
      (instance as any).__isPersisted = true;
      return instance;
    });

    if (queryOptions.include) {
      await processIncludes(instances, queryOptions.include as any, this);
    }

    return instances;
  }

  static async first<M extends Table>(
    this: new (props?: any) => M,
    field_or_filters: any,
    operator_or_value?: any,
    value_or_options?: any
  ): Promise<M | undefined> {
    // Detect call pattern and merge options appropriately
    let results: M[];

    if (
      arguments.length === 2 &&
      typeof operator_or_value === "object" &&
      !Array.isArray(operator_or_value) &&
      operator_or_value !== null
    ) {
      // Called as first(query, options) - 2 args
      const options = { ...operator_or_value, limit: 1 };
      results = await (this as any).where(field_or_filters, options);
    } else {
      // Called as first(field, operator, value, options) - 3-4 args
      const options =
        typeof value_or_options === "object" && !Array.isArray(value_or_options)
          ? { ...value_or_options, limit: 1 }
          : { limit: 1 };
      results = await (this as any).where(
        field_or_filters,
        operator_or_value,
        value_or_options,
        options
      );
    }

    return results[0];
  }

  static async last<M extends Table>(
    this: new (props?: any) => M,
    field_or_filters?: any,
    operator_or_value?: any
  ): Promise<M | undefined> {
    if (field_or_filters === undefined) {
      // Called as last() or last(options)
      const options =
        typeof operator_or_value === "object" &&
        !Array.isArray(operator_or_value)
          ? { ...operator_or_value, order: "DESC", limit: 1 }
          : { order: "DESC", limit: 1 };
      const results = await (this as any).where({}, options);
      return results[0];
    }

    // Called as last(query) or last(query, options) - 1-2 args
    if (
      typeof operator_or_value === "object" &&
      !Array.isArray(operator_or_value) &&
      operator_or_value !== null
    ) {
      // 2 args: last(query, options)
      const options = { ...operator_or_value, order: "DESC", limit: 1 };
      const results = await (this as any).where(field_or_filters, options);
      return results[0];
    } else {
      // 1 arg: last(query) - no options provided
      const results = await (this as any).where(field_or_filters, {
        order: "DESC",
        limit: 1,
      });
      return results[0];
    }
  }

  static async withTrashed<M extends Table>(
    this: new (props?: any) => M,
    filters?: any,
    options?: WhereOptions<M>
  ): Promise<M[]> {
    return await (this as any).where(filters ?? {}, {
      ...options,
      _includeTrashed: true,
    });
  }

  static async onlyTrashed<M extends Table>(
    this: new (props?: any) => M,
    filters?: any,
    options?: WhereOptions<M>
  ): Promise<M[]> {
    const schema = (this as any)[SCHEMA];

    for (const column_name in schema.columns) {
      if (schema.columns[column_name].store?.softDelete) {
        return await (this as any).where(
          {
            ...filters,
            [column_name]: { "!=": null },
          },
          { ...options, _includeTrashed: true }
        );
      }
    }

    throw new Error("onlyTrashed() requiere un campo @SoftDelete configurado");
  }
}
