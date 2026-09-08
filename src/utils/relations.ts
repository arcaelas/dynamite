/**
 * @file relations.ts
 * @description Sistema de carga de relaciones con batch loading
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { requireClient } from "../core/client";
import { SCHEMA } from "../core/decorator";

/**
 * @description Reads the rows of a pivot table by its foreign key through the `<field>_index` GSI,
 * falling back to a Scan only when that index does not exist.
 * @description Lee las filas de una tabla pivote por su clave foránea usando el GSI `<campo>_index`,
 * y solo cae a un Scan cuando ese índice no existe.
 * @param pivot_table Nombre de la tabla pivote
 * @param key_field Campo por el que se busca
 * @param key_value Valor buscado
 * @param extra Segunda condición opcional, evaluada como filtro
 * @example
 * const rows = await pivotRows("users_roles", "user_id", "u1", { field: "role_id", value: "r1" });
 */
export const pivotRows = async (
  pivot_table: string,
  key_field: string,
  key_value: any,
  extra?: { field: string; value: any }
): Promise<Record<string, any>[]> => {
  const client = requireClient();
  const names: Record<string, string> = { "#fk": key_field };
  const values: Record<string, any> = { ":fk": key_value };
  if (extra) {
    names["#rk"] = extra.field;
    values[":rk"] = extra.value;
  }

  const drain = async (params: any): Promise<Record<string, any>[]> => {
    const rows: Record<string, any>[] = [];
    let last_key: any;
    do {
      const command = params.IndexName
        ? new QueryCommand({ ...params, ...(last_key && { ExclusiveStartKey: last_key }) })
        : new ScanCommand({ ...params, ...(last_key && { ExclusiveStartKey: last_key }) });
      const result: any = await client.send(command as any);
      for (const item of result.Items ?? []) rows.push(unmarshall(item));
      last_key = result.LastEvaluatedKey;
    } while (last_key);
    return rows;
  };

  const base = {
    TableName: pivot_table,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: marshall(values),
  };

  return drain({
    ...base,
    IndexName: `${key_field}_index`,
    KeyConditionExpression: "#fk = :fk",
    ...(extra && { FilterExpression: "#rk = :rk" }),
  }).catch((error: any) => {
    if (error.name !== "ResourceNotFoundException" && !error.message?.includes("index")) throw error;
    return drain({ ...base, FilterExpression: extra ? "#fk = :fk AND #rk = :rk" : "#fk = :fk" });
  });
};

/**
 * @description Opciones para include de relaciones
 */
interface IncludeOptions {
  where?: Record<string, any>;
  attributes?: string[];
  limit?: number;
  offset?: number;
  skip?: number;
  order?: 'asc' | 'desc';
  include?: Record<string, IncludeOptions | boolean>;
}

/**
 * @description Batch load para HasMany/HasOne
 * Obtiene items relacionados donde foreignKey IN parent_ids
 */
const batchLoadHasMany = async (
  items: any[],
  relation: { model: () => any; foreignKey: string; localKey: string },
  options: IncludeOptions = {}
): Promise<Map<string, any[]>> => {
  const parent_ids = [...new Set(items.map(i => i[relation.localKey]).filter(Boolean))];
  if (!parent_ids.length) return new Map();

  // Obtener clase del modelo relacionado
  const RelatedModel = relation.model();

  // Construir filtros combinados
  const filters: Record<string, any> = {
    [relation.foreignKey]: { $in: parent_ids },
    ...options.where
  };

  // Un limit por grupo sin filtros extra ni orden se puede pedir al servidor:
  // cada consulta lee solo lo que va a devolver en vez de la relación entera
  const per_group = options.limit && parent_ids.length === 1 && !options.where && !options.order && !options.skip && !options.offset
    ? options.limit
    : undefined;

  const related = await RelatedModel.where(filters, {
    attributes: options.attributes as any,
    order: options.order?.toUpperCase() as 'ASC' | 'DESC',
    limit: per_group,
    offset: undefined,
  });
  // Agrupar por foreignKey
  const grouped = new Map<string, any[]>();
  for (const item of related) {
    const key = String(item[relation.foreignKey]);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  // Aplicar limit por grupo
  if (options.limit) {
    const offset = options.skip ?? options.offset ?? 0;
    for (const [key, groupItems] of grouped) {
      grouped.set(key, groupItems.slice(offset, offset + options.limit));
    }
  }

  return grouped;
};

/**
 * @description Batch load para BelongsTo
 * Obtiene items donde id IN local_keys
 */
const batchLoadBelongsTo = async (
  items: any[],
  relation: { model: () => any; foreignKey: string; localKey: string },
  options: IncludeOptions = {}
): Promise<Map<string, any>> => {
  const local_keys = [...new Set(items.map(i => i[relation.localKey]).filter(Boolean))];
  if (!local_keys.length) return new Map();

  const RelatedModel = relation.model();

  // Query con opciones aplicadas
  const related = await RelatedModel.where(
    { [relation.foreignKey]: { $in: local_keys } },
    { attributes: options.attributes as any }
  );

  const result = new Map<string, any>();
  for (const item of related) {
    result.set(String(item[relation.foreignKey]), item);
  }

  return result;
};

/**
 * @description Batch load para ManyToMany
 * Obtiene items relacionados usando tabla pivot
 */
const batchLoadManyToMany = async (
  items: any[],
  relation: {
    model: () => any;
    pivotTable: string;
    foreignKey: string;
    relatedKey: string;
    localKey: string;
    relatedPK: string;
  },
  options: IncludeOptions = {}
): Promise<Map<string, any[]>> => {
  const parent_ids = [...new Set(items.map(i => i[relation.localKey]).filter(Boolean))];
  if (!parent_ids.length) return new Map();

  // [1] Una Query indexada por padre en vez de un Scan de toda la tabla pivote
  const pivot_pages = await Promise.all(
    parent_ids.map(id => pivotRows(relation.pivotTable, relation.foreignKey, id))
  );
  const pivot_rows = pivot_pages.flat();

  if (pivot_rows.length === 0) return new Map();

  // [2] Extract unique related IDs
  const related_ids = [...new Set(pivot_rows.map(row => row[relation.relatedKey]))];

  // [3] Batch load related models con opciones aplicadas
  const RelatedModel = relation.model();

  // Construir filtros combinados
  const filters: Record<string, any> = {
    [relation.relatedPK]: { $in: related_ids },
    ...options.where
  };

  const related_items = await RelatedModel.where(filters, {
    attributes: options.attributes as any,
    order: options.order?.toUpperCase() as 'ASC' | 'DESC',
  });

  // [5] Map related items by ID
  const related_map = new Map(
    related_items.map((item: any) => [String(item[relation.relatedPK]), item])
  );

  // [6] Group by parent ID using pivot as bridge
  const grouped = new Map<string, any[]>();

  for (const pivot of pivot_rows) {
    const parent_id = String(pivot[relation.foreignKey]);
    const related_id = String(pivot[relation.relatedKey]);
    const related_item = related_map.get(related_id);

    if (related_item) {
      if (!grouped.has(parent_id)) grouped.set(parent_id, []);
      grouped.get(parent_id)!.push(related_item);
    }
  }

  // [7] Apply limit per group
  if (options.limit) {
    const offset = options.skip ?? options.offset ?? 0;
    for (const [key, items_arr] of grouped) {
      grouped.set(key, items_arr.slice(offset, offset + options.limit));
    }
  }

  return grouped;
};

/**
 * @description Procesa includes recursivamente para cargar relaciones con caché
 * @param items Array de instancias a poblar
 * @param include Objeto con relaciones a incluir
 * @param TableClass Clase de la tabla actual
 * @param depth Profundidad actual (máximo 5 para prevenir deep nesting)
 * @param queryCache Caché de queries para evitar duplicados (opcional)
 * @returns Items con relaciones pobladas
 * @example
 * ```typescript
 * // Uso interno en Table.where()
 * await processIncludes(users, {
 *   posts: {
 *     where: { published: true },
 *     limit: 5,
 *     include: {
 *       comments: true
 *     }
 *   }
 * }, User);
 * ```
 */
export const processIncludes = async (
  items: any[],
  include: Record<string, IncludeOptions | boolean>,
  TableClass: any,
  depth = 0,
  queryCache: Map<string, Map<string, any>> = new Map()
): Promise<any[]> => {
  // Límite reducido de 10 a 5 para mejor performance
  if (!include || depth > 5 || !items.length) return items;

  const schema = TableClass[SCHEMA];
  if (!schema) return items;

  const promises = Object.entries(include)
    .filter(([key]) => Object.prototype.hasOwnProperty.call(schema.columns, key))
    .map(async ([relation_key, options]) => {
      const column = schema.columns[relation_key];
      if (!column?.store?.relation) return;

    const relation = column.store.relation;
    const opts: IncludeOptions = typeof options === 'boolean' ? {} : options;

    // Generar clave de caché basada en tipo de relación y IDs de padres
    const parent_ids = items.map(i => i[relation.localKey]).filter(Boolean);
    const cache_key = `${relation.type}:${relation.model().name}:${JSON.stringify(parent_ids.sort())}:${JSON.stringify(opts.where || {})}`;

    // Batch load según tipo con caché
    let data: Map<string, any>;

    // Verificar caché primero
    if (queryCache.has(cache_key)) {
      data = queryCache.get(cache_key)!;
    } else {
      if (relation.type === 'HasMany') {
        data = await batchLoadHasMany(items, relation, opts);
      } else if (relation.type === 'HasOne') {
        const hasMany = await batchLoadHasMany(items, relation, { ...opts, limit: 1 });
        data = new Map();
        for (const [k, v] of hasMany) {
          data.set(k, v[0] ?? null);
        }
      } else if (relation.type === 'ManyToMany') {
        data = await batchLoadManyToMany(items, relation, opts);
      } else {
        // BelongsTo
        data = await batchLoadBelongsTo(items, relation, opts);
      }

      // Guardar en caché
      queryCache.set(cache_key, data);
    }

    for (const item of items) {
      const key = String(item[relation.localKey]);
      item[relation_key] = (relation.type === 'HasMany' || relation.type === 'ManyToMany')
        ? data.get(key) ?? []
        : data.get(key) ?? null;
    }

    // Recursión para includes anidados con caché propagado
    if (opts.include && data.size) {
      const all_related = Array.from(data.values()).flat().filter(Boolean);
      if (all_related.length) {
        await processIncludes(all_related, opts.include, relation.model(), depth + 1, queryCache);
      }
    }
  });

  await Promise.all(promises);
  return items;
};
