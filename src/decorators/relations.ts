/**
 * @file relations.ts
 * @description Decoradores de relaciones: @HasMany, @HasOne, @BelongsTo, @ManyToMany
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

/**
 * @description Decorador para relaciones muchos a muchos (N:M)
 * @param model Función que retorna la clase del modelo relacionado
 * @param pivotTable Nombre de la tabla pivot
 * @param foreignKey Clave foránea en la tabla pivot que apunta al modelo actual
 * @param relatedKey Clave foránea en la tabla pivot que apunta al modelo relacionado
 * @param localKey Clave local (por defecto 'id')
 * @param relatedPK Clave primaria del modelo relacionado (por defecto 'id')
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *
 *   @ManyToMany(() => Role, 'users_roles', 'user_id', 'role_id')
 *   declare roles: NonAttribute<Role[]>;
 * }
 * ```
 */
export const ManyToMany = decorator((_schema, col, params) => {
  const [model, pivotTable, foreignKey, relatedKey, localKey = 'id', relatedPK = 'id'] = params;
  col.store.relation = {
    type: 'ManyToMany',
    model,
    foreignKey,
    relatedKey,
    pivotTable,
    localKey,
    relatedPK
  };
});
