/**
 * @file relations.ts
 * @descripcion Sistema de relaciones completo ultra-conciso
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "./naming";

const relCache = new Map<string, Map<string, { data: any; expires: number }>>();

/** Decorador @hasMany para relaciones 1:N */
export const hasMany =
  (targetModel: () => any, foreignKey: string, localKey = "id") =>
  (target: any, propertyKey: string) => {
    // Registrar metadatos de relación
    ensureConfig(
      target.constructor,
      toSnakePlural(target.constructor.name)
    ).relations.set(propertyKey, {
      type: "hasMany",
      targetModel,
      foreignKey,
      localKey,
    });

    // Definir getter dinámico para la propiedad de relación
    Object.defineProperty(target, propertyKey, {
      get: function () {
        // Intentar obtener datos cargados previamente
        const cached = this[`_${propertyKey}`];
        if (cached !== undefined) return cached;

        // Si no hay datos cargados, retornar array vacío (lazy loading no implementado aquí)
        console.warn(
          `Relación ${propertyKey} no cargada. Use includes en la consulta.`
        );
        return [];
      },
      configurable: true,
      enumerable: false,
    });
  };

/** Decorador @belongsTo para relaciones N:1 */
export const belongsTo =
  (targetModel: () => any, localKey: string, foreignKey = "id") =>
  (target: any, propertyKey: string) => {
    // Registrar metadatos de relación
    ensureConfig(
      target.constructor,
      toSnakePlural(target.constructor.name)
    ).relations.set(propertyKey, {
      type: "belongsTo",
      targetModel,
      localKey,
      foreignKey,
    });

    // Definir getter dinámico para la propiedad de relación
    Object.defineProperty(target, propertyKey, {
      get: function () {
        // Intentar obtener datos cargados previamente
        const cached = this[`_${propertyKey}`];
        if (cached !== undefined) return cached;

        // Si no hay datos cargados, retornar null (lazy loading no implementado aquí)
        console.warn(
          `Relación ${propertyKey} no cargada. Use includes en la consulta.`
        );
        return null;
      },
      configurable: true,
      enumerable: false,
    });
  };

/** Automatic batch loading for hasMany relations */
const batchLoadHasMany = async (Model: any, items: any[], relation: any) => {
  const { targetModel, foreignKey, localKey } = relation;
  const TargetModel = targetModel();
  const parentKeys = items.map((item) => item[localKey]).filter(Boolean);
  if (!parentKeys.length) return new Map();

  const relatedItems = await TargetModel.where({
    [foreignKey]: { in: parentKeys },
  });
  const grouped = new Map();
  relatedItems.forEach((item) => {
    const key = item[foreignKey];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });
  return grouped;
};

/** Automatic batch loading for belongsTo relations with TTL cache */
const batchLoadBelongsTo = async (Model: any, items: any[], relation: any) => {
  const { targetModel, localKey, foreignKey } = relation;
  const TargetModel = targetModel();
  const cacheKey = `${TargetModel.name}_belongsTo`;
  const cache = relCache.get(cacheKey) || new Map();
  relCache.set(cacheKey, cache);
  const now = Date.now();

  const keysToFetch: any[] = [];
  const cachedResults = new Map();

  items.forEach((item) => {
    const key = item[localKey];
    if (!key) return;
    const cached = cache.get(key);
    if (cached && cached.expires > now) {
      cachedResults.set(key, cached.data);
    } else {
      keysToFetch.push(key);
    }
  });

  if (keysToFetch.length) {
    console.log(
      "DEBUG: batchLoadBelongsTo fetching keys:",
      keysToFetch,
      "for foreignKey:",
      foreignKey
    );
    console.log("DEBUG: TargetModel:", TargetModel.name);
    try {
      const fetchedItems = await TargetModel.where({
        [foreignKey]: { in: keysToFetch },
      });
      console.log(
        "DEBUG: batchLoadBelongsTo fetched items:",
        fetchedItems.length
      );
      const expires = now + 300000;
      fetchedItems.forEach((item) => {
        const key = item[foreignKey];
        cache.set(key, { data: item, expires });
        cachedResults.set(key, item);
      });
    } catch (error) {
      console.error("DEBUG: batchLoadBelongsTo error:", error);
      throw error;
    }
  }

  return cachedResults;
};

/** Automatic optimized includes processing with transparent batch loading */
export const processIncludes = async (
  Model: any,
  items: any[],
  include: any,
  depth = 0
): Promise<any[]> => {
  if (!include || depth > 10 || !items.length) return items;

  const meta = Model.getMeta();

  // Process all relations in parallel with automatic batching
  const relationPromises = Object.entries(include).map(
    async ([relationKey, relationOptions]: [string, any]) => {
      const relation = meta.relations.get(relationKey);
      if (!relation) return;

      let relatedData: Map<any, any>;

      // Automatic batch loading based on relation type
      if (relation.type === "hasMany") {
        relatedData = await batchLoadHasMany(Model, items, relation);
      } else {
        relatedData = await batchLoadBelongsTo(Model, items, relation);
      }

      // Assign relations to items using private properties for getters
      items.forEach((item) => {
        const key = item[relation.localKey];
        const related = relatedData.get(key);
        // Almacenar en propiedad privada que el getter dinámico busca
        item[`_${relationKey}`] =
          relation.type === "hasMany" ? related || [] : related || null;
      });

      // Recursive processing for nested includes
      if (relationOptions?.include && relatedData.size) {
        const allRelated = Array.from(relatedData.values())
          .flat()
          .filter(Boolean);
        const TargetModel = relation.targetModel();
        await processIncludes(
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

/** Auto cleanup expired cache entries */
const cleanupExpiredCache = () => {
  const now = Date.now();
  relCache.forEach((cache, modelKey) => {
    cache.forEach((entry, key) => {
      if (entry.expires <= now) cache.delete(key);
    });
    if (cache.size === 0) relCache.delete(modelKey);
  });
};

/** Clear relation cache for specific model */
export const clearRelationCache = (Model: any) =>
  relCache.delete(`${Model.name}_belongsTo`);

// Auto cleanup every 5 minutes
let cleanupInterval: NodeJS.Timeout | null = null;

/** Start the cleanup interval */
export const startCleanupInterval = () => {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupExpiredCache, 300000);
  }
};

/** Stop the cleanup interval */
export const stopCleanupInterval = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
};

// Auto-start cleanup interval
startCleanupInterval();

/** Separar opciones de query e include */
export const separateQueryOptions = (options: any) => {
  const { include, ...queryOptions } = options;
  return { queryOptions, includeOptions: include };
};
