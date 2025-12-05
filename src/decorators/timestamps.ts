/**
 * @file timestamps.ts
 * @description Decoradores de timestamps: @CreatedAt, @UpdatedAt, @DeleteAt
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { decorator } from "../core/decorator";

/**
 * @description Decorador que establece automáticamente la fecha/hora de creación.
 * El valor se genera solo si no existe uno previo.
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *   @CreatedAt() created_at: string;
 * }
 * ```
 */
export const CreatedAt = decorator((_schema, col) => {
  col.store.createdAt = true;
  col.get.push((value: any) => value ?? new Date().toISOString());
});

/**
 * @description Decorador que marca una propiedad para que se actualice automáticamente
 * con la fecha/hora actual cada vez que se guarde el modelo.
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *   name: string;
 *   @UpdatedAt() updated_at: string;
 * }
 * ```
 */
export const UpdatedAt = decorator((_schema, col) => {
  col.store.updatedAt = true;
});

/**
 * @description Decorador que marca una propiedad como columna de soft delete.
 * Cuando se llama destroy(), en lugar de eliminar el registro,
 * se establece esta columna con la fecha/hora actual.
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *   name: string;
 *   @DeleteAt() deleted_at?: string;
 * }
 *
 * // Soft delete (marca deleted_at con timestamp)
 * await user.destroy();
 *
 * // Queries normales excluyen soft deleted
 * await User.where({ status: "active" });
 *
 * // Incluir soft deleted
 * await User.withTrashed({ status: "active" });
 * ```
 */
export const DeleteAt = decorator((_schema, col) => {
  col.store.softDelete = true;
  col.store.nullable = true;
});
