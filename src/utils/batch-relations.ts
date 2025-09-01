/**
 * @file batch-relations.ts
 * @description Optimized batch loading for relations
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { mustMeta } from "../core/wrapper";

/** Cache multi-nivel con TTL */
const relCache = new Map<string, Map<string, { data: any; expires: number }>>();

/** Batch loader para hasMany relations */
export const batchLoadHasMany = async (
  Model: any,
  parentItems: any[],
  relation: any
) => {
  const { targetModel, foreignKey, localKey } = relation;
  const TargetModel = targetModel();

  // Agrupar claves para batch query
  const parentKeys = parentItems.map((item) => item[localKey]).filter(Boolean);
  if (!parentKeys.length) return new Map();

  // Single query con 'in' operator
  const relatedItems = await TargetModel.where({
    [foreignKey]: { in: parentKeys },
  });

  // Group by foreign key
  const grouped = new Map();
  relatedItems.forEach((item) => {
    const key = item[foreignKey];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });

  return grouped;
};

/** Batch loader para belongsTo relations con cache */
export const batchLoadBelongsTo = async (
  Model: any,
  parentItems: any[],
  relation: any
) => {
  const { targetModel, localKey, foreignKey } = relation;
  const TargetModel = targetModel();
  const cacheKey = `${TargetModel.name}_belongsTo`;

  // Verificar cache existente
  const cache = relCache.get(cacheKey) || new Map();
  relCache.set(cacheKey, cache);
  const now = Date.now();

  // Separar keys en cache vs no-cache
  const keysToFetch: string[] = [];
  const cachedResults = new Map();

  parentItems.forEach((item) => {
    const key = item[localKey];
    if (!key) return;

    const cached = cache.get(key);
    if (cached && cached.expires > now) {
      cachedResults.set(key, cached.data);
    } else {
      keysToFetch.push(key);
    }
  });

  // Fetch missing items
  if (keysToFetch.length) {
    const fetchedItems = await TargetModel.where({
      [foreignKey]: { in: keysToFetch },
    });

    // Update cache (5min TTL)
    const expires = now + 300000;
    fetchedItems.forEach((item) => {
      const key = item[foreignKey];
      cache.set(key, { data: item, expires });
      cachedResults.set(key, item);
    });
  }

  return cachedResults;
};

/** Optimized processIncludes con batch loading */
export const processIncludesBatch = async (
  Model: any,
  items: any[],
  include: any,
  depth = 0
): Promise<any[]> => {
  if (!include || depth > 10 || !items.length) return items;

  const meta = mustMeta(Model);

  // Process all relations in parallel
  const relationPromises = Object.entries(include).map(
    async ([relationKey, relationOptions]: [string, any]) => {
      const relation = meta.relations.get(relationKey);
      if (!relation) return;

      let relatedData: Map<any, any>;

      // Use batch loading based on relation type
      if (relation.type === "hasMany") {
        relatedData = await batchLoadHasMany(Model, items, relation);
      } else {
        relatedData = await batchLoadBelongsTo(Model, items, relation);
      }

      // Assign relations to items
      items.forEach((item) => {
        const key = item[relation.localKey!];
        const related = relatedData.get(key);

        if (relation.type === "hasMany") {
          item[relationKey] = related || [];
        } else {
          item[relationKey] = related || null;
        }
      });

      // Recursive processing for nested includes
      if (relationOptions?.include && relatedData.size) {
        const allRelated = Array.from(relatedData.values()).flat();
        const TargetModel = relation.targetModel();
        await processIncludesBatch(
          TargetModel,
          allRelated,
          relationOptions.include,
          depth + 1
        );
      }
    }
  );

  await Promise.all(relationPromises);
  return items;
};

/** Clear expired cache entries */
export const cleanupRelationCache = () => {
  const now = Date.now();
  relCache.forEach((cache, modelKey) => {
    cache.forEach((entry, key) => {
      if (entry.expires <= now) cache.delete(key);
    });
    if (cache.size === 0) relCache.delete(modelKey);
  });
};

// Auto cleanup every 5 minutes
setInterval(cleanupRelationCache, 300000);
