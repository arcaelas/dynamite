/**
 * @file relations.ts
 * @description Decoradores de relaciones: @HasMany, @HasOne, @BelongsTo
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { decorator } from "../core/decorator";

/**
 * @description Decorador para relaciones uno a muchos (1:N)
 * @param model Función que retorna la clase del modelo relacionado
 * @param foreignKey Clave foránea en el modelo relacionado
 * @param localKey Clave local (por defecto 'id')
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *
 *   @HasMany(() => Post, 'id_user', 'id')
 *   declare posts: HasMany<Post>;
 * }
 * ```
 */
export const HasMany = decorator((_schema, col, params) => {
  const [model, foreignKey, localKey = 'id'] = params;
  col.store.relation = {
    type: 'HasMany',
    model,
    foreignKey,
    localKey
  };
});

/**
 * @description Decorador para relaciones uno a uno (1:1)
 * @param model Función que retorna la clase del modelo relacionado
 * @param foreignKey Clave foránea en el modelo relacionado
 * @param localKey Clave local (por defecto 'id')
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *
 *   @HasOne(() => Profile, 'id_user', 'id')
 *   declare profile: HasOne<Profile>;
 * }
 * ```
 */
export const HasOne = decorator((_schema, col, params) => {
  const [model, foreignKey, localKey = 'id'] = params;
  col.store.relation = {
    type: 'HasOne',
    model,
    foreignKey,
    localKey
  };
});

/**
 * @description Decorador para relaciones muchos a uno (N:1)
 * @param model Función que retorna la clase del modelo relacionado
 * @param localKey Clave local que referencia al modelo padre
 * @param foreignKey Clave en el modelo padre (por defecto 'id')
 * @example
 * ```typescript
 * class Post extends Table<Post> {
 *   @PrimaryKey() id: string;
 *   id_user: string;
 *
 *   @BelongsTo(() => User, 'id_user', 'id')
 *   declare author: BelongsTo<User>;
 * }
 * ```
 */
export const BelongsTo = decorator((_schema, col, params) => {
  const [model, localKey, foreignKey = 'id'] = params;
  col.store.relation = {
    type: 'BelongsTo',
    model,
    foreignKey,
    localKey
  };
});
