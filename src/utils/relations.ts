/**
 * @file relations.ts
 * @descripcion Sistema de relaciones optimizado
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

// =============================================================================
// IMPORTS
// =============================================================================
import { ensureConfig, mustMeta } from "../core/wrapper";
import { toSnakePlural } from "./naming";
import { RelationMetadata } from "@type/index";

// =============================================================================
// TYPES
// =============================================================================

type BatchLoadResult = Map<string, any | any[]>;

// =============================================================================
// DECORATORS
// =============================================================================

/** Decorador @hasMany para relaciones 1:N */
export const hasMany =
  (targetModel: () => any, foreignKey: string, localKey = "id") =>
  (target: any, propertyKey: string): void => {
    ensureConfig(
      target.constructor,
      toSnakePlural(target.constructor.name)
    ).relations.set(propertyKey, {
      type: "hasMany",
      targetModel,
      foreignKey,
      localKey,
    });

    Object.defineProperty(target, propertyKey, {
      get(): any[] {
        const cached = this[`_${propertyKey}`];
        return cached !== undefined
          ? cached
          : (console.warn(
              `Relación ${propertyKey} no cargada. Use includes en la consulta.`
            ),
            []);
      },
      configurable: true,
      enumerable: false,
    });
  };

/** Decorador @belongsTo para relaciones N:1 */
export const belongsTo =
  (targetModel: () => any, localKey: string, foreignKey = "id") =>
  (target: any, propertyKey: string): void => {
    ensureConfig(
      target.constructor,
      toSnakePlural(target.constructor.name)
    ).relations.set(propertyKey, {
      type: "belongsTo",
      targetModel,
      localKey,
      foreignKey,
    });

    Object.defineProperty(target, propertyKey, {
      get(): any {
        const cached = this[`_${propertyKey}`];
        return cached !== undefined
          ? cached
          : (console.warn(
              `Relación ${propertyKey} no cargada. Use includes en la consulta.`
            ),
            null);
      },
      configurable: true,
      enumerable: false,
    });
  };

// =============================================================================
// FUNCTIONS
// =============================================================================

/** Batch loading para relaciones hasMany */
const batchLoadHasMany = async (
  Model: any,
  items: any[],
  relation: RelationMetadata,
  options: any = {}
): Promise<BatchLoadResult> => {
  const { targetModel, foreignKey, localKey = "id" } = relation;
  const parent_keys = items.map((item) => item[localKey]).filter(Boolean);
  
  if (!parent_keys.length) return new Map();

  // Build query with relation options
  let query = targetModel().where(foreignKey, "in", parent_keys);
  
  // Apply additional filters if specified
  if (options.where) {
    const additionalFilters = Object.entries(options.where);
    for (const [key, value] of additionalFilters) {
      const currentResults = await query;
      query = Promise.resolve(currentResults.filter((item: any) => item[key] === value));
    }
  }
  
  const related_items = await query;
  
  // TODO: Apply attributes selection 
  // For now, skip attributes filtering to ensure basic relations work
  let processedItems = related_items;
  
  // Apply other options like limit, order
  let filteredItems = processedItems;
  
  if (options.order === "DESC") {
    filteredItems.sort((a: any, b: any) => b.id.localeCompare(a.id));
  } else if (options.order === "ASC") {
    filteredItems.sort((a: any, b: any) => a.id.localeCompare(b.id));
  }
  
  if (options.limit) {
    filteredItems = filteredItems.slice(0, options.limit);
  }
  const grouped = new Map<string, any[]>();

  filteredItems.forEach((item: any) => {
    const key = item[foreignKey];
    grouped.has(key) ? grouped.get(key)!.push(item) : grouped.set(key, [item]);
  });

  return grouped;
};

/** Batch loading para relaciones belongsTo */
const batchLoadBelongsTo = async (
  Model: any,
  items: any[],
  relation: RelationMetadata,
  options: any = {}
): Promise<BatchLoadResult> => {
  const { targetModel, localKey, foreignKey = "id" } = relation;
  // Para BelongsTo: obtener valores de localKey (ej: category_id) de los items
  const keys = items.map((item) => localKey ? item[localKey] : null).filter(Boolean);

  if (!keys.length) return new Map();

  // Buscar en targetModel donde foreignKey (ej: id) esté en los keys
  const fetched_items = await targetModel().where(foreignKey, "in", keys);
  
  // TODO: Apply attributes selection
  // For now, skip attributes filtering to ensure basic relations work  
  let processedItems = fetched_items;

  const results = new Map<string, any>();
  // Mapear por foreignKey para que coincida con localKey de los items
  processedItems.forEach((item: any) => results.set(item[foreignKey], item));

  return results;
};

/** Procesamiento optimizado de includes con batch loading transparente */
export const processIncludes = async (
  Model: any,
  items: any[],
  include: Record<string, any>,
  depth = 0
): Promise<any[]> => {
  if (!include || depth > 10 || !items.length) return items;

  const meta = mustMeta(Model);
  const relation_promises = Object.entries(include).map(
    async ([relation_key, relation_options]: [string, any]) => {
      const relation = meta.relations.get(relation_key);
      if (!relation) return;

      const related_data =
        relation.type === "hasMany"
          ? await batchLoadHasMany(Model, items, relation, relation_options)
          : await batchLoadBelongsTo(Model, items, relation, relation_options);

      items.forEach((item) => {
        let key;
        if (relation.type === "hasMany") {
          // Para HasMany: usar localKey (ej: "id") del item actual
          key = item[relation.localKey || "id"];
        } else {
          // Para BelongsTo: usar localKey (ej: "category_id") del item actual
          key = relation.localKey ? item[relation.localKey] : null;
        }
        const related = related_data.get(key);
        // Usar una propiedad temporal para evitar conflictos con getters
        Object.defineProperty(item, relation_key, {
          value: relation.type === "hasMany" ? related || [] : related || null,
          writable: true,
          enumerable: true,
          configurable: true
        });
      });

      if (relation_options?.include && related_data.size) {
        const all_related = Array.from(related_data.values())
          .flat()
          .filter(Boolean);
        await processIncludes(
          relation.targetModel(),
          all_related,
          relation_options.include,
          depth + 1
        );
      }
    }
  );

  await Promise.all(relation_promises);
  return items;
};

/** Separar opciones de query e include */
export const separateQueryOptions = (
  options: Record<string, any>
): {
  queryOptions: Record<string, any>;
  includeOptions: Record<string, any> | undefined;
} => {
  const { include, ...queryOptions } = options;
  return { queryOptions, includeOptions: include };
};
