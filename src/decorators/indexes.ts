/**
 * @file indexes.ts
 * @description Decoradores de índices con Symbol storage
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { decorator, SCHEMA } from "../core/decorator";

/**
 * @description Decorador para marcar propiedad como Partition Key
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @Index() id: string;
 * }
 * ```
 */
export const Index = decorator((_schema, col) => {
  col.store.index = true;
  col.store.nullable = col.store.nullable ?? false;
});

/**
 * @description Decorador para marcar propiedad como Sort Key
 * @example
 * ```typescript
 * class Post extends Table<Post> {
 *   @Index() user_id: string;
 *   @IndexSort() created_at: string;
 * }
 * ```
 */
export const IndexSort = decorator((_schema, col) => {
  col.store.indexSort = true;
  col.store.nullable = col.store.nullable ?? false;
});

/**
 * @description Decorador para marcar una propiedad como clave primaria
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *   name: string;
 * }
 * ```
 */
export const PrimaryKey = decorator((table_class, col) => {
  const schema = (table_class as any)[SCHEMA];

  // Configurar como primary key
  Object.assign(col.store, {
    index: true,
    primaryKey: true,
    nullable: false
  });

  // Obtener nombre de columna desde col.name
  schema.primary_key = col.name;
});
