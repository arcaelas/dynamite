/**
 * @file index.ts
 * @descripcion Punto de entrada público de la librería
 * @autor Miguel Alejandro
 * @fecha 2025-08-07
 */

// Clases núcleo
export { Dynamite } from "./core/client";
export { default as Table } from "./core/table";

// Factory para crear decoradores personalizados
export { decorator, relationDecorator } from "./core/decorator";

// Sistema de métodos extensibles
export {
  registerStaticMethod,
  registerInstanceMethod,
  type StaticMethodHandler,
  type InstanceMethodHandler,
} from "./core/method";

// Decoradores - Índices
export { Index, IndexSort, PrimaryKey } from "./decorators/indexes";

// Decoradores - Timestamps
export { CreatedAt, UpdatedAt, DeleteAt } from "./decorators/timestamps";

// Decoradores - Transformación
export { Default, Mutate, Validate, Serialize, NotNull, Name } from "./decorators/transforms";

// Decoradores - Relaciones
export { HasMany, BelongsTo } from "./decorators/relations";

// Utils - Procesamiento de relaciones
export { belongsTo, hasMany } from "./utils/relations";

// Tipos avanzados (reexportados desde @types)
export type {
  // Relaciones branded
  BelongsTo as BelongsToType,
  HasMany as HasManyType,
  // Atributos
  CreationOptional,
  FilterableAttributes,
  InferAttributes,
  NonAttribute,
  // Queries
  QueryOperator,
  QueryOptions,
  QueryFilters,
  WhereOptions,
  IncludeRelationOptions,
  // Metadatos (para decoradores custom)
  Column,
  RelationMetadata,
  ValidatorEntry,
  SerializeConfig,
  // Deprecated (mantener para compatibilidad)
  WhereOptionsWithoutWhere,
} from "@type/index";
