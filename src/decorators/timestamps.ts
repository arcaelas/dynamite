/**
 * @file timestamps.ts
 * @description Decoradores de timestamps: @CreatedAt, @UpdatedAt, @DeleteAt
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { decorator } from "../core/decorator";

/**
 * @description Decorador que establece automáticamente la fecha/hora de creación usando pipelines.
 * El valor se genera en el getter si no existe, y se preserva en el setter.
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *   @CreatedAt() created_at: string;
 * }
 * ```
 */
export const CreatedAt = decorator((_schema, col) => {
  // Getter: asignar timestamp si no existe (solo primera vez)
  col.get.push((value: any) => value ?? new Date().toISOString());

  // Setter: preservar valor si ya existe, ignorar intentos de cambio
  col.set.push((current: any, next: any) => current ?? next ?? new Date().toISOString());
});

/**
 * @description Decorador que actualiza automáticamente la fecha/hora en cada asignación usando pipelines.
 * El timestamp se actualiza cada vez que se escribe en la propiedad.
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
  // Getter: retornar valor actual o timestamp si no existe
  col.get.push((value: any) => value ?? new Date().toISOString());

  // Setter: siempre actualizar con nuevo timestamp (ignora el valor pasado)
  col.set.push((_current: any, _next: any) => new Date().toISOString());
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
