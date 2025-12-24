/**
 * @file relations.ts
 * @description Sistema de carga de relaciones con batch loading
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { requireClient } from "../core/client";
import { SCHEMA } from "../core/decorator";

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
  const parent_ids = items.map(i => i[relation.localKey]).filter(Boolean);
  if (!parent_ids.length) return new Map();

  // Obtener clase del modelo relacionado
  const RelatedModel = relation.model();

  // Construir filtros combinados
  const filters: Record<string, any> = {
    [relation.foreignKey]: { $in: parent_ids },
    ...options.where
  };

  // Query con todas las opciones aplicadas
  const related = await RelatedModel.where(filters, {
    attributes: options.attributes as any,
    order: options.order?.toUpperCase() as 'ASC' | 'DESC',
    limit: undefined, // Se aplica después de agrupar
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
  const local_keys = items.map(i => i[relation.localKey]).filter(Boolean);
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
  const parent_ids = items.map(i => i[relation.localKey]).filter(Boolean);
  if (!parent_ids.length) return new Map();

  const client = requireClient();

  // [1] Query pivot table usando OR chain (DynamoDB no soporta IN nativo)
  const or_conditions = parent_ids.map((_, i) => `#fk = :id${i}`).join(' OR ');
  const pivot_result = await client.send(new ScanCommand({
    TableName: relation.pivotTable,
    FilterExpression: parent_ids.length > 0 ? `(${or_conditions})` : undefined,
    ExpressionAttributeNames: { '#fk': relation.foreignKey },
    ExpressionAttributeValues: marshall(
      parent_ids.reduce((acc, id, i) => ({ ...acc, [`:id${i}`]: id }), {})
    )
  }));

  const pivot_rows = (pivot_result.Items ?? []).map(item => unmarshall(item));

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

    // Asignar datos relacionados a cada item
    for (const item of items) {
      const key = String(item[relation.localKey]);
      const value = (relation.type === 'HasMany' || relation.type === 'ManyToMany')
        ? data.get(key) ?? []
        : data.get(key) ?? null;

      Object.defineProperty(item, relation_key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
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
