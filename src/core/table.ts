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
import { requireClient, TransactionContext } from "./client";
import { SCHEMA, VALUES } from "./decorator";
import { processIncludes } from "../utils/relations";

// Tipos simples inline (sin @types complejos)
interface QueryOptions<T> {
  order?: 'ASC' | 'DESC';
  skip?: number;
  limit?: number;
  attributes?: (keyof T)[];
  include?: IncludeRelationOptions;
  _includeTrashed?: boolean;
}

interface IncludeRelationOptions {
  [relationName: string]: boolean | {
    where?: any;
    limit?: number;
  };
}

type QueryOperator = "=" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not-in" | "contains" | "begins-with";

// Alias de operadores para sintaxis objeto
const OPERATOR_ALIASES: Record<string, QueryOperator> = {
  '$eq': '=',
  '$ne': '!=',
  '$lt': '<',
  '$lte': '<=',
  '$gt': '>',
  '$gte': '>=',
  '$in': 'in',
  '$nin': 'not-in',
  'contains': 'contains',
  'begins-with': 'begins-with',
  'beginsWith': 'begins-with',
  // Operadores directos también soportados
  '=': '=',
  '!=': '!=',
  '<': '<',
  '<=': '<=',
  '>': '>',
  '>=': '>=',
  'in': 'in',
  'not-in': 'not-in',
};

// =============================================================================
// FUNCIONES UTILITARIAS SIMPLIFICADAS
// =============================================================================

function validateOperator(operator: string): QueryOperator {
  const validOps: QueryOperator[] = ["=", "!=", "<", "<=", ">", ">=", "in", "not-in", "contains", "begins-with"];
  if (!validOps.includes(operator as QueryOperator)) {
    throw new Error(`Operador inválido: ${operator}. Válidos: ${validOps.join(", ")}`);
  }
  return operator as QueryOperator;
}

/**
 * @description Detecta si un valor es un objeto con operadores
 */
function isOperatorObject(value: any): boolean {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  // Es objeto con operadores si alguna key es un operador conocido
  return Object.keys(value).some(key => key in OPERATOR_ALIASES);
}

/**
 * @description Genera expresión para un operador y valor específico
 */
function buildSingleExpression(
  nameKey: string,
  valueKeyPrefix: string,
  op: QueryOperator,
  val: any,
  names: Record<string, string>,
  values: Record<string, any>,
  fieldName: string
): string | null {
  // Manejar arrays vacíos
  if (op === "in" && Array.isArray(val) && val.length === 0) {
    return "1 = 0"; // Ningún resultado coincide
  }
  if (op === "not-in" && Array.isArray(val) && val.length === 0) {
    return null; // Excluir nada = todo pasa
  }

  names[nameKey] = fieldName;

  if (op === "in" && Array.isArray(val)) {
    const inValues = val.map((v, i) => {
      const inValueKey = `${valueKeyPrefix}_${i}`;
      values[inValueKey] = v;
      return inValueKey;
    });
    return `${nameKey} IN (${inValues.join(", ")})`;
  } else if (op === "not-in" && Array.isArray(val)) {
    const notInValues = val.map((v, i) => {
      const notInValueKey = `${valueKeyPrefix}_${i}`;
      values[notInValueKey] = v;
      return notInValueKey;
    });
    return `NOT ${nameKey} IN (${notInValues.join(", ")})`;
  } else if (op === "contains") {
    values[valueKeyPrefix] = val;
    return `contains(${nameKey}, ${valueKeyPrefix})`;
  } else if (op === "begins-with") {
    values[valueKeyPrefix] = val;
    return `begins_with(${nameKey}, ${valueKeyPrefix})`;
  } else if (op === "!=") {
    values[valueKeyPrefix] = val;
    return `${nameKey} <> ${valueKeyPrefix}`;
  } else {
    values[valueKeyPrefix] = val;
    return `${nameKey} ${op} ${valueKeyPrefix}`;
  }
}

function buildConditionExpression(
  filters: Record<string, any>,
  defaultOperator: QueryOperator = "="
): {
  expression: string;
  names: Record<string, string>;
  values: Record<string, any>;
} {
  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, any> = {};

  let index = 0;

  for (const [fieldName, filterValue] of Object.entries(filters)) {
    // Ignorar valores undefined
    if (filterValue === undefined) continue;

    // Detectar sintaxis objeto con operadores: { campo: { operador: valor } }
    if (isOperatorObject(filterValue)) {
      // Procesar cada operador en el objeto
      for (const [opKey, opValue] of Object.entries(filterValue)) {
        // Ignorar valores undefined dentro del objeto
        if (opValue === undefined) continue;

        const resolvedOp = OPERATOR_ALIASES[opKey];
        if (!resolvedOp) continue; // Ignorar keys desconocidas

        const nameKey = `#attr${index}`;
        const valueKey = `:val${index}`;

        const expr = buildSingleExpression(
          nameKey, valueKey, resolvedOp, opValue, names, values, fieldName
        );

        if (expr) expressions.push(expr);
        index++;
      }
    } else {
      // Valor simple: usar operador default
      // Ignorar null solo si no hay operador explícito
      if (filterValue === null) continue;

      const nameKey = `#attr${index}`;
      const valueKey = `:val${index}`;

      const expr = buildSingleExpression(
        nameKey, valueKey, defaultOperator, filterValue, names, values, fieldName
      );

      if (expr) expressions.push(expr);
      index++;
    }
  }

  return {
    expression: expressions.join(" AND "),
    names,
    values,
  };
}

// =============================================================================
// CLASE TABLE AUTOCONTENIDA
// =============================================================================

export default class Table<T = any> {
  // Valores de instancia
  private readonly [VALUES]!: Partial<T>;

  constructor(props: Partial<T> = {} as Partial<T>) {
    requireClient();
    const schema = (this.constructor as any)[SCHEMA];

    // Inicializar VALUES
    (this as any)[VALUES] = {};

    // Procesar cada columna del schema
    for (const column_name in schema.columns) {
      const column = schema.columns[column_name];

      if (column.store?.relation) {
        // ═══════════════════════════════════════════════════════════════
        // RELACIONES: getter lazy que convierte a instancias, setter bloqueado
        // ═══════════════════════════════════════════════════════════════
        let relation_data = (props as any)[column_name] ?? undefined;

        Object.defineProperty(this, column_name, {
          enumerable: true,
          configurable: true, // Permite reconfigurar cuando processIncludes carga datos
          set: () => undefined, // Relaciones son read-only
          get: () => {
            if (relation_data === undefined) return undefined;

            const RelatedModel = column.store.relation.model();
            const type = column.store.relation.type;

            if (type === 'HasMany') {
              // HasMany: Array de instancias
              return [].concat(relation_data ?? [])
                .filter(Boolean)
                .map((item: any) => item instanceof RelatedModel ? item : new RelatedModel(item));
            } else {
              // HasOne / BelongsTo: Instancia única o null
              if (relation_data === null) return null;
              return relation_data instanceof RelatedModel
                ? relation_data
                : new RelatedModel(relation_data);
            }
          },
        });
      } else {
        // ═══════════════════════════════════════════════════════════════
        // COLUMNAS REGULARES: getter/setter con pipelines via reduce
        // ═══════════════════════════════════════════════════════════════
        const has_initial_value = column_name in props;
        let value = has_initial_value ? (props as any)[column_name] : null;

        // Aplicar set pipeline en inicialización (solo si usuario proporciona valor)
        if (has_initial_value) {
          value = column.set.reduce((v: any, fn: any) => fn(v), value);
        }

        // Almacenar en VALUES para compatibilidad con métodos existentes
        (this[VALUES] as any)[column_name] = value;

        Object.defineProperty(this, column_name, {
          enumerable: true,
          configurable: true,
          get: () => {
            // Aplicar get pipeline
            let v = column.get.reduce((val: any, fn: any) => fn(val), value);
            // Almacenar si se generó default (para consistencia)
            if (value === null && v !== null) {
              value = v;
              (this[VALUES] as any)[column_name] = v;
            }
            return v;
          },
          set: (new_value: any) => {
            // Aplicar set pipeline
            value = column.set.reduce((v: any, fn: any) => fn(v), new_value ?? null);
            (this[VALUES] as any)[column_name] = value;
          },
        });
      }
    }
  }

  // **Métodos de instancia con API preservada**

  /**
   * @description Serializa la instancia a JSON incluyendo relaciones recursivamente
   * @returns Objeto JSON con todas las propiedades y relaciones
   */
  public toJSON(): Record<string, unknown> {
    const schema = (this.constructor as any)[SCHEMA];
    const result: Record<string, unknown> = {};

    for(const column_name in schema.columns) {
      const column = schema.columns[column_name];
      const value = (this as any)[column_name];

      if (value === null || value === undefined) continue;

      if (column.store?.relation) {
        // Serializar relaciones recursivamente
        if (Array.isArray(value)) {
          result[column_name] = value.map(item => item?.toJSON ? item.toJSON() : item);
        } else {
          result[column_name] = value?.toJSON ? value.toJSON() : value;
        }
      } else {
        result[column_name] = value;
      }
    }

    return result;
  }

  /**
   * @description Serializa la instancia a string JSON
   * @returns String JSON con todas las propiedades y relaciones
   */
  public toString(): string {
    return JSON.stringify(this);
  }

  /**
   * @description Genera payload para operaciones de DB (excluye relaciones)
   */
  private _toDBPayload(): Record<string, unknown> {
    const schema = (this.constructor as any)[SCHEMA];
    const result: Record<string, unknown> = {};

    for(const column_name in schema.columns) {
      const column = schema.columns[column_name];
      if (column.store?.relation) continue;

      const value = (this as any)[column_name];
      if (value !== null && value !== undefined) {
        result[column_name] = value;
      }
    }

    return result;
  }

  public async save(): Promise<this> {
    const schema = (this.constructor as any)[SCHEMA];
    const id = (this[VALUES] as any)[schema.primary_key];
    const is_new = id === undefined || id === null;

    // Validación lazy
    for(const column_name in schema.columns) {
      const column = schema.columns[column_name];

      if (column.store?.lazy_validators && !column.store?.relation) {
        const value = (this[VALUES] as any)[column_name];
        for(const validator of column.store.lazy_validators) {
          const result = validator(value);
          if (result !== true) {
            throw new Error(typeof result === "string" ? result : "Validación fallida");
          }
        }
      }
    }

    // Timestamps automáticos (updatedAt solamente, createdAt se genera via pipeline)
    const now = new Date().toISOString();
    for(const column_name in schema.columns) {
      const column = schema.columns[column_name];

      if (column.store?.updatedAt) {
        // Usar setter para sincronizar closure y VALUES
        (this as any)[column_name] = now;
      }
    }

    // Preparar datos para DB (omitir relaciones)
    const db_data = this._toDBPayload();

    if (is_new) {
      // Insertar nuevo registro
      await this.insertIntoDynamoDB(db_data);
    } else {
      // Actualizar registro existente
      await this.updateInDynamoDB(db_data);
    }

    return this;
  }

  public async destroy(): Promise<null> {
    const schema = (this.constructor as any)[SCHEMA];
    const id = (this[VALUES] as any)[schema.primary_key];

    if (!id) {
      throw new Error('Cannot destroy record without ID');
    }

    // Buscar si hay soft delete configurado
    let softDeleteColumn: string | null = null;
    for(const column_name in schema.columns) {
      const column = schema.columns[column_name];
      if (column.store?.softDelete) {
        softDeleteColumn = column_name;
        break;
      }
    }

    if (softDeleteColumn) {
      // Soft delete
      (this[VALUES] as any)[softDeleteColumn] = new Date().toISOString();
      await this.save();
    } else {
      // Hard delete
      await this.deleteFromDynamoDB(id);
    }

    return null;
  }

  public async forceDestroy(): Promise<null> {
    const schema = (this.constructor as any)[SCHEMA];
    const id = (this[VALUES] as any)[schema.primary_key];

    if (!id) {
      throw new Error('Cannot destroy record without ID');
    }

    await this.deleteFromDynamoDB(id);
    return null;
  }

  // **Métodos estáticos con API preservada**

  static async create<T extends Table>(
    this: new (data: any) => T,
    data: any,
    tx?: TransactionContext
  ): Promise<T> {
    const instance = new this(data);

    // Establecer timestamps si corresponde
    const schema = (this as any)[SCHEMA];
    const now = new Date().toISOString();

    // Solo updatedAt, createdAt se genera via pipeline
    for(const column_name in schema.columns) {
      const column = schema.columns[column_name];

      if (column.store?.updatedAt) {
        // Usar setter para sincronizar closure y VALUES
        (instance as any)[column_name] = now;
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

    return instance;
  }

  static async update<T extends Table>(
    this: new (data: any) => T,
    updates: any,
    filters: any,
    tx?: TransactionContext
  ): Promise<number> {
    const records = await (this as any).where(filters);

    if (records.length === 0) {
      return 0;
    }

    let updatedCount = 0;
    const schema = (this as any)[SCHEMA];
    const client = tx ? null : requireClient();

    for(const record of records) {
      // Aplicar actualizaciones
      for(const [key, value] of Object.entries(updates)) {
        (record as any)[key] = value;
      }

      // Actualizar timestamp
      const now = new Date().toISOString();
      for(const column_name in schema.columns) {
        const column = schema.columns[column_name];
        if (column.store?.updatedAt) {
          // Usar setter para sincronizar closure y VALUES
          (record as any)[column_name] = now;
          break;
        }
      }

      const updated_data = (record as any)._toDBPayload();

      if (tx) {
        tx.addPut(schema.name, updated_data);
      } else {
        await client!.send(
          new PutItemCommand({
            TableName: schema.name,
            Item: marshall(updated_data, { removeUndefinedValues: true }),
          })
        );
      }

      updatedCount++;
    }

    return updatedCount;
  }

  static async delete<T extends Table>(
    this: new (data: any) => T,
    filters: any,
    tx?: TransactionContext
  ): Promise<number> {
    const records = await (this as any).where(filters);

    if (records.length === 0) {
      return 0;
    }

    const schema = (this as any)[SCHEMA];
    const client = tx ? null : requireClient();
    let deletedCount = 0;

    for(const record of records) {
      const id = (record as any)[VALUES][schema.primary_key];

      if (id) {
        if (tx) {
          tx.addDelete(schema.name, { [schema.primary_key]: id });
        } else {
          await client!.send(
            new DeleteItemCommand({
              TableName: schema.name,
              Key: marshall({ [schema.primary_key]: id }),
            })
          );
        }
        deletedCount++;
      }
    }

    return deletedCount;
  }

  static async where<T extends Table>(
    this: new (props?: any) => T,
    field_or_filters: any,
    operator_or_value?: any,
    value?: any,
    options?: QueryOptions<T>
  ): Promise<T[]> {
    const client = requireClient();
    const schema = (this as any)[SCHEMA];

    // Parsear argumentos dinámicamente (como el original)
    let filters: any;
    let queryOptions: QueryOptions<T>;
    let operator: QueryOperator = "=";

    if (typeof operator_or_value === 'string') {
      // where(field, operator, value, options?)
      operator = validateOperator(operator_or_value);
      filters = { [field_or_filters]: value };
      queryOptions = options || {};
    } else if (value !== undefined) {
      // where(field, value, options?)
      filters = { [field_or_filters]: Array.isArray(operator_or_value) ? { in: operator_or_value } : operator_or_value };
      queryOptions = value || {};
    } else if (operator_or_value !== undefined && typeof operator_or_value === 'object') {
      // where(filters, options?)
      filters = field_or_filters;
      queryOptions = operator_or_value;
    } else {
      // where(filters?)
      filters = field_or_filters;
      queryOptions = {};
    }

    // Validar opciones
    if (queryOptions.limit === 0) return [];
    if (queryOptions.limit && queryOptions.limit < 0) {
      throw new Error("limit debe ser mayor o igual a 0");
    }
    if (queryOptions.skip && queryOptions.skip < 0) {
      throw new Error("skip debe ser mayor o igual a 0");
    }
    if (queryOptions.order && !["ASC", "DESC"].includes(queryOptions.order)) {
      throw new Error('order debe ser "ASC" o "DESC"');
    }

    // Auto-excluir soft deleted
    if (!queryOptions._includeTrashed) {
      for(const column_name in schema.columns) {
        const column = schema.columns[column_name];
        if (column.store?.softDelete && !(column_name in filters)) {
          filters[column_name] = null;
          break;
        }
      }
    }

    // Construir consulta DynamoDB
    const { expression, names, values } = buildConditionExpression(filters, operator);

    const scanParams: any = {
      TableName: schema.name,
      ExpressionAttributeNames: names || {},
    };

    if (expression) {
      scanParams.FilterExpression = expression;
      scanParams.ExpressionAttributeValues = marshall(values || {}, { removeUndefinedValues: true });
    }

    // Proyección solo si hay atributos específicos (ignorar array vacío)
    if (queryOptions.attributes && queryOptions.attributes.length > 0) {
      const projectionExpressions = queryOptions.attributes.map((attr, index) => {
        const aliasKey = `#proj${index}`;
        scanParams.ExpressionAttributeNames[aliasKey] = String(attr);
        return aliasKey;
      });
      scanParams.ProjectionExpression = projectionExpressions.join(", ");
    }

    // Limpiar ExpressionAttributeNames si está vacío (DynamoDB lo rechaza)
    if (Object.keys(scanParams.ExpressionAttributeNames).length === 0) {
      delete scanParams.ExpressionAttributeNames;
    }

    // Ejecutar consulta con paginación
    let allItems: any[] = [];
    let lastEvaluatedKey: any = undefined;
    let scannedCount = 0;
    const targetSkip = queryOptions.skip || 0;
    const targetLimit = queryOptions.limit ?? 100;

    do {
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await client.send(new ScanCommand(scanParams));

      if (result.Items) {
        const items = result.Items.map((item) => {
          const raw = unmarshall(item);
          // Limpiar null/undefined
          for (const k of Object.keys(raw)) {
            if (raw[k] === null || raw[k] === undefined) {
              delete raw[k];
            }
          }
          return raw;
        });

        for (const item of items) {
          if (scannedCount < targetSkip) {
            scannedCount++;
            continue;
          }
          if (allItems.length >= targetLimit) break;

          allItems.push(item);
          scannedCount++;
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey && allItems.length < targetLimit);

    // Aplicar ordenamiento
    if (queryOptions.order) {
      allItems.sort((a, b) => {
        const sortField = Object.keys(filters)[0] || schema.primary_key;
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (aVal < bVal) return queryOptions.order === "ASC" ? -1 : 1;
        if (aVal > bVal) return queryOptions.order === "ASC" ? 1 : -1;
        return 0;
      });
    }

    // Convertir a instancias (schema ya definido arriba)
    const instances = allItems.map((item) => {
      if (queryOptions.attributes) {
        // Proyección parcial: crear instancia con solo los atributos solicitados
        const instance = Object.create(this.prototype);
        (instance as any)[VALUES] = item;

        // Definir getters para los atributos proyectados
        for (const attr of queryOptions.attributes) {
          const column = schema.columns[attr];
          if (column) {
            Object.defineProperty(instance, attr, {
              enumerable: true,
              configurable: true,
              get: () => {
                let value = (instance[VALUES] as any)[attr] ?? null;
                // Aplicar get pipeline
                for (const fn of column.get) {
                  value = fn(value);
                }
                return value;
              }
            });
          }
        }
        return instance;
      } else {
        return new this(item);
      }
    });

    // Procesar includes para cargar relaciones
    if (queryOptions.include) {
      await processIncludes(instances, queryOptions.include, this);
    }

    return instances;
  }

  static async first<T extends Table>(
    this: new (props?: any) => T,
    field_or_filters: any,
    operator_or_value?: any,
    value_or_options?: any
  ): Promise<T | undefined> {
    const results = await (this as any).where(field_or_filters, operator_or_value, value_or_options, { limit: 1 });
    return results[0];
  }

  static async last<T extends Table>(
    this: new (props?: any) => T,
    field_or_filters?: any,
    operator_or_value?: any
  ): Promise<T | undefined> {
    if (field_or_filters === undefined) {
      const results = await (this as any).where({}, { order: 'DESC', limit: 1 });
      return results[0];
    } else {
      const results = await (this as any).where(field_or_filters, operator_or_value, undefined, { order: 'DESC', limit: 1 });
      return results[0];
    }
  }

  static async withTrashed<T extends Table>(
    this: new (props?: any) => T,
    filters?: any,
    options?: QueryOptions<T>
  ): Promise<T[]> {
    return await (this as any).where(filters ?? {}, { ...options, _includeTrashed: true });
  }

  static async onlyTrashed<T extends Table>(
    this: new (props?: any) => T,
    filters?: any,
    options?: QueryOptions<T>
  ): Promise<T[]> {
    const schema = (this as any)[SCHEMA];
    let softDeleteColumn: string | null = null;

    for(const column_name in schema.columns) {
      const column = schema.columns[column_name];
      if (column.store?.softDelete) {
        softDeleteColumn = column_name;
        break;
      }
    }

    if (!softDeleteColumn) {
      throw new Error("onlyTrashed() requiere un campo @SoftDelete configurado");
    }

    const merged_filters = {
      ...filters,
      [softDeleteColumn]: { "!=": null },
    };

    return await (this as any).where(merged_filters, { ...options, _includeTrashed: true });
  }

  // **Métodos privados para DynamoDB**

  private async insertIntoDynamoDB(data: any): Promise<void> {
    const client = requireClient();
    const schema = (this.constructor as any)[SCHEMA];

    await client.send(
      new PutItemCommand({
        TableName: schema.name,
        Item: marshall(data, { removeUndefinedValues: true }),
      })
    );
  }

  private async updateInDynamoDB(data: any): Promise<void> {
    const client = requireClient();
    const schema = (this.constructor as any)[SCHEMA];

    await client.send(
      new PutItemCommand({
        TableName: schema.name,
        Item: marshall(data, { removeUndefinedValues: true }),
      })
    );
  }

  private async deleteFromDynamoDB(id: any): Promise<void> {
    const client = requireClient();
    const schema = (this.constructor as any)[SCHEMA];

    await client.send(
      new DeleteItemCommand({
        TableName: schema.name,
        Key: marshall({ [schema.primary_key]: id }),
      })
    );
  }
}

// Exportar tipos para uso público
export type { QueryOptions, IncludeRelationOptions, QueryOperator };