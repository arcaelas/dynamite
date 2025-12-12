/**
 * @file index.ts
 * @description Punto de entrada público de la librería - Arquitectura Minimalista
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

// Clases núcleo
export { Dynamite } from "./core/client";
export { default as Table } from "./core/table";

// Factory para crear decoradores personalizados
export { decorator, relationDecorator, SCHEMA } from "./core/decorator";

// Decoradores - Índices
export { Index, IndexSort, PrimaryKey } from "./decorators/indexes";

// Decoradores - Timestamps
export { CreatedAt, UpdatedAt, DeleteAt } from "./decorators/timestamps";

// Decoradores - Transformación
export { Default, Mutate, Validate, Serialize, NotNull, Name, Column } from "./decorators/transforms";

// Decoradores - Relaciones
export { HasMany, BelongsTo, HasOne, ManyToMany } from "./decorators/relations";

// Sistema de tipos simplificado
export type {
  // Brands
  NonAttribute,
  CreationOptional,

  // Core
  InferAttributes,
  InferRelations,
  WhereOptions,
  QueryOperator,

  // Input
  CreateInput,
  UpdateInput,

  // Auxiliares
  PickRelations,
} from "./@types/index";

// Re-exportar TransactionContext para compatibilidad
export { TransactionContext } from "./core/client";