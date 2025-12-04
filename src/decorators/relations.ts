/**
 * @file relations.ts
 * @description Decoradores de relaciones: @HasMany, @BelongsTo
 */

import { relationDecorator } from "../core/decorator";

/**
 * @description Decorador para definir relación One-to-Many (tiene muchos).
 * @param targetModel Función que retorna el modelo relacionado (lazy para evitar deps circulares)
 * @param foreignKey Clave foránea en el modelo hijo
 * @param localKey Clave local referenciada (default: "id")
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *   name: string;
 *
 *   @HasMany(() => Post, "user_id", "id")
 *   posts: HasMany<Post>;
 * }
 * ```
 */
export const HasMany = relationDecorator("hasMany");

/**
 * @description Decorador para definir relación Many-to-One (pertenece a).
 * @param targetModel Función que retorna el modelo relacionado (lazy para evitar deps circulares)
 * @param localKey Clave local que referencia al modelo padre
 * @param foreignKey Clave foránea en el modelo padre (default: "id")
 * @example
 * ```typescript
 * class Post extends Table<Post> {
 *   @PrimaryKey() id: string;
 *   user_id: string;
 *
 *   @BelongsTo(() => User, "user_id", "id")
 *   author: BelongsTo<User>;
 * }
 * ```
 */
export const BelongsTo = relationDecorator("belongsTo");
