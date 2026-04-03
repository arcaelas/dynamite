/**
 * @file timestamps.ts
 * @description Timestamp decorators: @CreatedAt, @UpdatedAt, @DeleteAt
 * @description Decoradores de timestamps: @CreatedAt, @UpdatedAt, @DeleteAt
 */

import { decorator } from "../core/decorator";

/**
 * @description Auto-sets creation timestamp. Default + immutable after first assignment.
 * @description Timestamp de creación automático. Default + inmutable tras primera asignación.
 */
export const CreatedAt = decorator((_schema, col) => {
  col.store.createdAt = true;
  // Default in set: assigns now() when nullish. Preserves existing value (immutable).
  col.set.push((next: any, current: any) => current ?? next ?? new Date().toISOString());
});

/**
 * @description Auto-updates timestamp on every write. Always overwrites.
 * @description Timestamp que se actualiza en cada escritura. Siempre sobreescribe.
 */
export const UpdatedAt = decorator((_schema, col) => {
  col.store.updatedAt = true;
  col.set.push((next: any) => next ?? new Date().toISOString());
});

/**
 * @description Marks column as soft delete flag. Used by destroy() and where().
 * @description Marca columna como flag de soft delete. Usado por destroy() y where().
 */
export const DeleteAt = decorator((_schema, col) => {
  col.store.softDelete = true;
});
