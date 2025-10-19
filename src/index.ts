/**
 * @file index.ts
 * @descripcion Punto de entrada público de la librería
 * @autor Miguel Alejandro
 * @fecha 2025-08-07
 */

// Clases núcleo
export { Dynamite } from "./core/client";
export { default as Table } from "./core/table";

// Decoradores
export { default as BelongsTo } from "./decorators/belongs_to";
export { default as CreatedAt } from "./decorators/created_at";
export { default as Default } from "./decorators/default";
export { default as HasMany } from "./decorators/has_many";
export { default as Index } from "./decorators/index";
export { default as IndexSort } from "./decorators/index_sort";
export { default as Mutate } from "./decorators/mutate";
export { default as Name } from "./decorators/name";
export { default as NotNull } from "./decorators/not_null";
export { default as PrimaryKey } from "./decorators/primary_key";
export { default as UpdatedAt } from "./decorators/updated_at";
export { default as Validate } from "./decorators/validate";

// Relaciones
export { belongsTo, hasMany } from "./utils/relations";

// Tipos avanzados (reexportados desde @types)
export type {
  BelongsTo as BelongsToType,
  CreationOptional,
  FilterableAttributes,
  HasMany as HasManyType,
  InferAttributes,
  NonAttribute,
  QueryOperator,
  QueryResult,
  WhereOptions,
  WhereOptionsWithoutWhere,
} from "@type/index";
