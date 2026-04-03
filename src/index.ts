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
export { decorator, SCHEMA } from "./core/decorator";

// Tipo del schema de decoradores
export type { Schema } from "./core/decorator";

// Decoradores - Índices
export { Index, IndexSort, PrimaryKey } from "./decorators/indexes";

// Decoradores - Timestamps
export { CreatedAt, UpdatedAt, DeleteAt } from "./decorators/timestamps";

// Decoradores - Transformación
export { Get, Set, Validate, Default, NotNull, Name } from "./decorators/transforms";

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
  PickByType,
} from "./@types/index";

// Utilidades
export { ulid } from "./utils/ulid";

// Re-exportar TransactionContext para compatibilidad
export { TransactionContext } from "./core/client";