/**
 * @file indexes.ts
 * @description Decoradores de índices con Symbol storage
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { decorator, ensureSchema } from "../core/decorator";

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
export function PrimaryKey(): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    const table_class = target.constructor;
    const column_name = String(prop);
    const schema = ensureSchema(table_class);

    // Crear columna si no existe
    if (!schema.columns[column_name]) {
      schema.columns[column_name] = { name: column_name, get: [], set: [], store: {} };
    }

    // Configurar como primary key
    Object.assign(schema.columns[column_name].store, {
      index: true,
      primaryKey: true,
      nullable: false
    });

    schema.primary_key = column_name;
  };
}
