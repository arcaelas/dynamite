/**
 * @file relations.ts
 * @descripcion Sistema de relaciones optimizado
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

// =============================================================================
// IMPORTS
// =============================================================================
import { ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "./naming";

// =============================================================================
// TYPES
// =============================================================================
type RelationConfig = {
  type: "hasMany" | "belongsTo";
  targetModel: () => any;
  foreignKey: string;
  localKey: string;
};

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
  relation: RelationConfig
): Promise<BatchLoadResult> => {
  const { targetModel, foreignKey, localKey } = relation;
  const parent_keys = items.map((item) => item[localKey]).filter(Boolean);
  if (!parent_keys.length) return new Map();

  const related_items = await targetModel().where({
    [foreignKey]: { in: parent_keys },
  });
  const grouped = new Map<string, any[]>();

  related_items.forEach((item: any) => {
    const key = item[foreignKey];
    grouped.has(key) ? grouped.get(key)!.push(item) : grouped.set(key, [item]);
  });

  return grouped;
};

/** Batch loading para relaciones belongsTo */
const batchLoadBelongsTo = async (
  Model: any,
  items: any[],
  relation: RelationConfig
): Promise<BatchLoadResult> => {
  const { targetModel, localKey, foreignKey } = relation;
  const keys = items.map((item) => item[localKey]).filter(Boolean);

  if (!keys.length) return new Map();

  const fetched_items = await targetModel().where({
    [foreignKey]: { in: keys },
  });
  const results = new Map<string, any>();
  fetched_items.forEach((item: any) => results.set(item[foreignKey], item));

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

  const meta = Model.getMeta();
  const relation_promises = Object.entries(include).map(
    async ([relation_key, relation_options]: [string, any]) => {
      const relation = meta.relations.get(relation_key);
      if (!relation) return;

      const related_data =
        relation.type === "hasMany"
          ? await batchLoadHasMany(Model, items, relation)
          : await batchLoadBelongsTo(Model, items, relation);

      items.forEach((item) => {
        const key = item[relation.localKey];
        const related = related_data.get(key);
        item[`_${relation_key}`] =
          relation.type === "hasMany" ? related || [] : related || null;
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
