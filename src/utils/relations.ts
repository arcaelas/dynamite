/**
 * @file relations.ts
 * @description Sistema de carga de relaciones con batch loading
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { SCHEMA } from "../core/decorator";

/**
 * @description Opciones para include de relaciones
 */
interface IncludeOptions {
  where?: Record<string, any>;
  limit?: number;
  offset?: number;
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

  // Query básico
  let related = await RelatedModel.where(relation.foreignKey, 'in', parent_ids);

  // Aplicar filtros adicionales
  if (options.where) {
    related = related.filter((item: any) =>
      Object.entries(options.where!).every(([k, v]) => item[k] === v)
    );
  }

  // Ordenar
  if (options.order) {
    related.sort((a: any, b: any) => {
      const aId = String(a.id ?? '');
      const bId = String(b.id ?? '');
      return options.order === 'asc' ? aId.localeCompare(bId) : bId.localeCompare(aId);
    });
  }

  // Agrupar por foreignKey
  const grouped = new Map<string, any[]>();
  for (const item of related) {
    const key = String(item[relation.foreignKey]);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  // Aplicar limit por grupo
  if (options.limit) {
    for (const [key, groupItems] of grouped) {
      grouped.set(key, groupItems.slice(options.offset ?? 0, (options.offset ?? 0) + options.limit));
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
  _options: IncludeOptions = {}
): Promise<Map<string, any>> => {
  const local_keys = items.map(i => i[relation.localKey]).filter(Boolean);
  if (!local_keys.length) return new Map();

  const RelatedModel = relation.model();
  const related = await RelatedModel.where(relation.foreignKey, 'in', local_keys);

  const result = new Map<string, any>();
  for (const item of related) {
    result.set(String(item[relation.foreignKey]), item);
  }

  return result;
};

/**
 * @description Procesa includes recursivamente para cargar relaciones
 * @param items Array de instancias a poblar
 * @param include Objeto con relaciones a incluir
 * @param TableClass Clase de la tabla actual
 * @param depth Profundidad actual (máximo 10)
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
  depth = 0
): Promise<any[]> => {
  if (!include || depth > 10 || !items.length) return items;

  const schema = TableClass[SCHEMA];
  if (!schema) return items;

  const promises = Object.entries(include).map(async ([relation_key, options]) => {
    const column = schema.columns[relation_key];
    if (!column?.store?.relation) return;

    const relation = column.store.relation;
    const opts: IncludeOptions = typeof options === 'boolean' ? {} : options;

    // Batch load según tipo
    let data: Map<string, any>;

    if (relation.type === 'HasMany') {
      data = await batchLoadHasMany(items, relation, opts);
    } else if (relation.type === 'HasOne') {
      const hasMany = await batchLoadHasMany(items, relation, { ...opts, limit: 1 });
      data = new Map();
      for (const [k, v] of hasMany) {
        data.set(k, v[0] ?? null);
      }
    } else {
      // BelongsTo
      data = await batchLoadBelongsTo(items, relation, opts);
    }

    // Asignar datos relacionados a cada item
    for (const item of items) {
      const key = String(item[relation.localKey]);
      const value = relation.type === 'HasMany'
        ? data.get(key) ?? []
        : data.get(key) ?? null;

      Object.defineProperty(item, relation_key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }

    // Recursión para includes anidados
    if (opts.include && data.size) {
      const all_related = Array.from(data.values()).flat().filter(Boolean);
      if (all_related.length) {
        await processIncludes(all_related, opts.include, relation.model(), depth + 1);
      }
    }
  });

  await Promise.all(promises);
  return items;
};
