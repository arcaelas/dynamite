/**
 * @file table.ts
 * @descripcion Clase Table rediseñada con API completa y tipado estricto
 * @autor Miguel Alejandro
 * @fecha 2025-07-30
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
  WhereQueryOptions,
  WrapperEntry,
} from "@type/index";
import { processIncludes } from "../utils/relations";
import { requireClient } from "./client";
import { mustMeta, STORE } from "./wrapper";

/** Tipos importados desde @types */

// =============================================================================
// FUNCIONES UTILITARIAS
// =============================================================================

function validateOperator(operator: string): QueryOperator {
  const validOps: QueryOperator[] = [
    "=",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "in",
    "not-in",
    "contains",
    "begins-with",
  ];
  if (!validOps.includes(operator as QueryOperator)) {
    throw new Error(
      `Operador inválido: ${operator}. Válidos: ${validOps.join(", ")}`
    );
  }
  return operator as QueryOperator;
}

function buildConditionExpression(
  filters: Record<string, any>,
  operator: QueryOperator = "="
): {
  expression: string;
  names: Record<string, string>;
  values: Record<string, any>;
} {
  const expressions: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, any> = {};

  Object.entries(filters).forEach(([key, value], index) => {
    const nameKey = `#attr${index}`;
    const valueKey = `:val${index}`;

    names[nameKey] = key;

    if (operator === "in" && Array.isArray(value)) {
      const inValues = value.map((v, i) => {
        const inValueKey = `:val${index}_${i}`;
        values[inValueKey] = v;
        return inValueKey;
      });
      expressions.push(`${nameKey} IN (${inValues.join(", ")})`);
    } else if (operator === "not-in" && Array.isArray(value)) {
      const notInValues = value.map((v, i) => {
        const notInValueKey = `:val${index}_${i}`;
        values[notInValueKey] = v;
        return notInValueKey;
      });
      expressions.push(`NOT ${nameKey} IN (${notInValues.join(", ")})`);
    } else if (operator === "contains") {
      values[valueKey] = value;
      expressions.push(`contains(${nameKey}, ${valueKey})`);
    } else if (operator === "begins-with") {
      values[valueKey] = value;
      expressions.push(`begins_with(${nameKey}, ${valueKey})`);
    } else if (operator === "!=") {
      // DynamoDB uses <> for not equal
      values[valueKey] = value;
      expressions.push(`${nameKey} <> ${valueKey}`);
    } else {
      values[valueKey] = value;
      expressions.push(`${nameKey} ${operator} ${valueKey}`);
    }
  });

  return {
    expression: expressions.join(" AND "),
    names,
    values,
  };
}

// =============================================================================
// CLASE TABLE REDISEÑADA
// =============================================================================

export default class Table<T = any> {
  protected [STORE]!: { [K in keyof T]?: T[K] };

  constructor(data: InferAttributes<T>) {
    requireClient();
    const meta = mustMeta(Object.getPrototypeOf(this).constructor);

    // Inicializar propiedades con valores por defecto
    meta.columns.forEach((col, key) => {
      if (typeof key === "string" && !(key in data)) {
        // Forzar aplicación de valor por defecto mediante setter
        if (col.default !== undefined) {
          const defaultValue =
            typeof col.default === "function" ? col.default() : col.default;
          (this as any)[key] = defaultValue;
        } else {
          (this as any)[key] = undefined;
        }
      }
    });

    Object.assign(this, data);
  }

  /** Serializar instancia a JSON plano */
  toJSON(): Record<string, any> {
    const meta = mustMeta(Object.getPrototypeOf(this).constructor);
    const result: Record<string, any> = {};

    meta.columns.forEach((column, key) => {
      if (typeof key === "string") {
        // Acceder a la propiedad directamente para activar getters virtuales
        const value = (this as any)[key];
        if (value !== undefined) {
          result[key] = value;
        }
      }
    });

    // Incluir propiedades enumerables ad-hoc no registradas como relaciones
    // Esto permite persistir campos opcionales sin decoradores (p.ej. 'notes')
    for (const key of Object.keys(this as any)) {
      if (result[key] !== undefined) continue;
      if ((meta.relations as any).has && (meta.relations as any).has(key))
        continue;
      const val = (this as any)[key];
      if (val === undefined) continue;
      if (typeof val === "function") continue;
      result[key] = val;
    }

    return result;
  }

  /** Guardar instancia (crear o actualizar) */
  async save(): Promise<this> {
    const id: unknown = (this as any).id;
    const Ctor = this.constructor as typeof Table;
    const meta = mustMeta(Ctor);
    const now = new Date().toISOString();
    const isNew = id === undefined || id === null;

    // Actualizar campos de timestamp
    meta.columns.forEach((col, key) => {
      if (col.createdAt && isNew) {
        // Solo establecer createdAt si es un nuevo registro
        (this as any)[key] = now;
      } else if (col.updatedAt) {
        // Actualizar updatedAt en cada guardado
        (this as any)[key] = now;
      }
    });

    const payload = this.toJSON();
    const client = requireClient();

    if (isNew) {
      // Crear nuevo registro
      const created = await (Ctor as any).create(payload);
      Object.assign(this, created);
    } else {
      // Actualizar registro existente
      await client.send(
        new PutItemCommand({
          TableName: meta.name,
          Item: marshall(payload, { removeUndefinedValues: true }),
        })
      );
    }

    return this;
  }

  /** Actualizar instancia */
  async update(patch: Partial<InferAttributes<T>>): Promise<this> {
    Object.assign(this, patch);
    return await this.save();
  }

  /** Eliminar instancia */
  async destroy(): Promise<null> {
    const id: unknown = (this as any).id;
    if (id === undefined || id === null) {
      throw new Error("destroy() requiere que la instancia tenga un id");
    }

    const Ctor = this.constructor as typeof Table;
    return await (Ctor as any).delete({ id: String(id) });
  }

  // ===========================================================================
  // MÉTODOS ESTÁTICOS SEGÚN ESPECIFICACIONES
  // ===========================================================================

  /**
   * Crear un nuevo registro en la base de datos
   */
  static async create<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    data: InferAttributes<M>
  ): Promise<M> {
    const client = requireClient();
    const meta = mustMeta(this);
    const instance = new this(data);
    // Establecer timestamps si corresponde
    const now = new Date().toISOString();
    meta.columns.forEach((col, key) => {
      if (col.createdAt && (instance as any)[key] === undefined) {
        (instance as any)[key] = now;
      }
      if (col.updatedAt) {
        (instance as any)[key] = now;
      }
    });
    const payload = instance.toJSON();

    await client.send(
      new PutItemCommand({
        TableName: meta.name,
        Item: marshall(payload, { removeUndefinedValues: true }),
      })
    );

    return instance;
  }

  /**
   * Actualizar registros en la base de datos
   * @param updates - Campos a actualizar. Los campos con valor `undefined` se ignoran.
   * @param filters - Filtros para seleccionar los registros a actualizar
   * @returns Número de registros actualizados
   */
  static async update<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    updates: Partial<InferAttributes<M>>,
    filters: Partial<InferAttributes<M>>
  ): Promise<number> {
    // Obtener metadatos del modelo para manejar timestamps
    const meta = mustMeta(this);
    const client = requireClient();

    // Buscar registros que coincidan con los filtros
    const recordsToUpdate = await (this as any).where(filters);

    if (recordsToUpdate.length === 0) {
      return 0;
    }

    // No filtrar campos undefined aquí para permitir establecer valores nulos/explicitos
    const cleanUpdates = { ...updates };

    // Verificar si hay campos para actualizar
    if (Object.keys(cleanUpdates).length === 0) {
      return recordsToUpdate.length; // No hay cambios que hacer
    }

    // Actualizar cada registro
    const updatePromises = recordsToUpdate.map(async (record) => {
      // Obtener datos actuales
      const currentData = record.toJSON();

      // Aplicar actualizaciones, preservando valores existentes
      const updatedData = { ...currentData };

      // Aplicar solo los campos que no son undefined
      for (const [key, value] of Object.entries(cleanUpdates)) {
        if (value !== undefined) {
          updatedData[key] = value;
        }
      }

      // Actualizar timestamp updated_at si está configurado
      let updatedAtKey: string | symbol | undefined = undefined;
      for (const [k, col] of meta.columns.entries()) {
        if (col.updatedAt === true) {
          updatedAtKey = k as any;
          break;
        }
      }
      if (updatedAtKey !== undefined) {
        (updatedData as any)[String(updatedAtKey)] = new Date().toISOString();
      }

      // Actualizar en la base de datos
      await client.send(
        new PutItemCommand({
          TableName: meta.name,
          Item: marshall(updatedData, { removeUndefinedValues: true }),
        })
      );
    });

    await Promise.all(updatePromises);
    return recordsToUpdate.length;
  }

  /**
   * Eliminar registros de la base de datos
   */
  static async delete<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    filters: Partial<InferAttributes<M>>
  ): Promise<number> {
    const recordsToDelete = await (this as any).where(filters);

    if (recordsToDelete.length === 0) {
      return 0;
    }

    const client = requireClient();
    const meta = mustMeta(this);

    const deletePromises = recordsToDelete.map(async (record) => {
      const id = (record as any).id;
      if (id) {
        await client.send(
          new DeleteItemCommand({
            TableName: meta.name,
            Key: marshall({ id: String(id) }),
          })
        );
      }
    });

    await Promise.all(deletePromises);
    return recordsToDelete.length;
  }

  // ===========================================================================
  // MÉTODO WHERE CON MÚLTIPLES SOBRECARGAS
  // ===========================================================================

  /** Filtrar registros por campo igual a valor */
  static async where<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    field: K,
    value: InferAttributes<M>[K] | InferAttributes<M>[K][]
  ): Promise<M[]>;

  /** Filtrar registros por campo con operador específico */
  static async where<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    field: K,
    operator: QueryOperator,
    value: InferAttributes<M>[K] | InferAttributes<M>[K][]
  ): Promise<M[]>;

  /** Filtrar registros por múltiples campos (AND) */
  static async where<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    filters: Partial<InferAttributes<M>>
  ): Promise<M[]>;

  /** Filtrar registros con opciones avanzadas */
  static async where<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    filters: Partial<InferAttributes<M>>,
    options: WhereQueryOptions<M>
  ): Promise<M[]>;

  /** Implementación del método where */
  static async where<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    ...args: any[]
  ): Promise<M[]> {
    const client = requireClient();
    const meta = mustMeta(this);

    let filters: Partial<InferAttributes<M>>;
    let options: WhereQueryOptions<M> = {};
    let operator: QueryOperator = "=";

    // Parsear argumentos según la sobrecarga utilizada
    if (args.length === 2) {
      if (typeof args[0] === "string") {
        // where(field, value) - check if value is array for IN operation
        const value = args[1];
        if (Array.isArray(value)) {
          operator = "in";
        }
        filters = { [args[0]]: value } as Partial<InferAttributes<M>>;
      } else {
        // where(filters, options)
        filters = args[0];
        options = args[1] || {};
      }
    } else if (args.length === 3) {
      // where(field, operator, value)
      const [field, op, value] = args;
      operator = validateOperator(op);
      filters = { [field]: value } as Partial<InferAttributes<M>>;
    } else if (args.length === 1) {
      // where(filters)
      filters = args[0];
    } else {
      throw new Error("Argumentos inválidos para where()");
    }

    // Validar límites y opciones
    if (options.limit && options.limit < 0) {
      throw new Error("limit debe ser mayor o igual a 0");
    }
    if (options.skip && options.skip < 0) {
      throw new Error("skip debe ser mayor o igual a 0");
    }
    if (options.order && !["ASC", "DESC"].includes(options.order)) {
      throw new Error('order debe ser "ASC" o "DESC"');
    }

    // Construir la consulta DynamoDB
    const { expression, names, values } = buildConditionExpression(
      filters,
      operator
    );

    const scanParams: any = {
      TableName: meta.name,
    };

    // Initialize ExpressionAttributeNames to avoid conflicts
    if (!scanParams.ExpressionAttributeNames) {
      scanParams.ExpressionAttributeNames = {};
    }

    if (expression) {
      scanParams.FilterExpression = expression;
      // Merge filter attribute names
      Object.assign(scanParams.ExpressionAttributeNames, names);
      scanParams.ExpressionAttributeValues = marshall(values);
    }

    if (options.attributes) {
      // Handle projection attributes with proper aliases
      const projectionExpressions = options.attributes.map((attr, index) => {
        const aliasKey = `#proj${index}`;
        scanParams.ExpressionAttributeNames[aliasKey] = attr;
        return aliasKey;
      });

      scanParams.ProjectionExpression = projectionExpressions.join(", ");
    }

    // Ejecutar consulta con paginación
    let allItems: any[] = [];
    let lastEvaluatedKey: any = undefined;
    let scannedCount = 0;
    const targetSkip = options.skip || 0;
    const targetLimit = options.limit || 100;

    do {
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const result = await client.send(new ScanCommand(scanParams));

      if (result.Items) {
        const items = result.Items.map((item) => unmarshall(item));

        for (const item of items) {
          if (scannedCount < targetSkip) {
            scannedCount++;
            continue;
          }

          if (allItems.length >= targetLimit) {
            break;
          }

          allItems.push(item);
          scannedCount++;
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey && allItems.length < targetLimit);

    // Aplicar ordenamiento
    if (options.order) {
      allItems.sort((a, b) => {
        const sortField = Object.keys(filters)[0] || "id";
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (aVal < bVal) return options.order === "ASC" ? -1 : 1;
        if (aVal > bVal) return options.order === "ASC" ? 1 : -1;
        return 0;
      });
    }

    // Convertir a instancias del modelo
    const instances = allItems.map((item) => {
      if (options.attributes) {
        // When using attribute selection, create minimal instances
        // only with the requested fields to avoid default value population
        const instance = Object.create(this.prototype);
        Object.assign(instance, item);
        return instance;
      } else {
        // Normal instantiation with all defaults
        return new this(item);
      }
    });

    // Procesar includes si están presentes
    if (options.include) {
      return await processIncludes(this, instances, options.include as any);
    }

    return instances;
  }

  /**
   * Obtener el primer registro que coincida con los filtros
   */
  static async first<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    field: K,
    value: InferAttributes<M>[K]
  ): Promise<M | undefined>;
  static async first<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    field: K,
    operator: QueryOperator,
    value: InferAttributes<M>[K] | InferAttributes<M>[K][]
  ): Promise<M | undefined>;
  static async first<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    filters: Partial<InferAttributes<M>>
  ): Promise<M | undefined>;
  static async first<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    ...args: any[]
  ): Promise<M | undefined> {
    const results = await (this as any).where(...args);
    return results[0] || undefined;
  }

  /**
   * Obtener el último registro que coincida con los filtros
   */
  // Obtener el último registro que coincida con los filtros
  static async last<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    field: K,
    value: InferAttributes<M>[K]
  ): Promise<M | undefined>;
  static async last<M extends Table, K extends keyof InferAttributes<M>>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    field: K,
    operator: QueryOperator,
    value: InferAttributes<M>[K] | InferAttributes<M>[K][]
  ): Promise<M | undefined>;
  static async last<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    filters: Partial<InferAttributes<M>>
  ): Promise<M | undefined>;
  static async last<M extends Table>(
    this: { new (data: InferAttributes<M>): M; prototype: M },
    ...args: any[]
  ): Promise<M | undefined> {
    // Soporte de firmas sin generar una cuarta sobrecarga inválida para where()
    if (args.length === 0) {
      const results = await (this as any).where(
        {},
        { order: "DESC", limit: 1 }
      );
      return results[0] || undefined;
    }
    if (args.length === 1) {
      if (typeof args[0] === "object" && !Array.isArray(args[0])) {
        const results = await (this as any).where(args[0], {
          order: "DESC",
          limit: 1,
        });
        return results[0] || undefined;
      }
      throw new Error("Se requiere un valor para el campo de filtro");
    }
    if (args.length === 2) {
      // field, value
      const results = await (this as any).where(args[0], args[1]);
      return results[results.length - 1];
    }
    if (args.length === 3) {
      // field, operator, value
      const results = await (this as any).where(args[0], args[1], args[2]);
      return results[results.length - 1];
    }
    if (args.length === 2 && typeof args[1] === "object") {
      const results = await (this as any).where(args[0], {
        ...(args[1] || {}),
        order: "DESC",
        limit: 1,
      });
      return results[0] || undefined;
    }
    throw new Error("Argumentos no válidos para last()");
  }
}

export { STORE };
export type { WrapperEntry };
