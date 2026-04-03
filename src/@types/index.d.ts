/**
 * @file index.ts
 * @description Sistema de tipos para Dynamite ORM - Arquitectura con type-safety completo
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */
/**
 * Marca para identificar campos que no son atributos de BD (relaciones, métodos).
 */
export declare const NonAttributeBrand: unique symbol;
/**
 * Marca para identificar campos opcionales en create() pero presentes en el modelo.
 */
export declare const CreationOptionalBrand: unique symbol;
/**
 * Wrapper para marcar relaciones y campos virtuales que no se persisten en BD.
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @HasMany(() => Post, 'user_id')
 *   declare posts: NonAttribute<Post[]>;
 * }
 * ```
 */
export type NonAttribute<T> = T & {
    [NonAttributeBrand]?: true;
};
/**
 * Wrapper para marcar campos opcionales en create() (auto-generados: id, timestamps).
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: CreationOptional<string>;
 *   @CreatedAt() created_at: CreationOptional<number>;
 *   name: string;
 * }
 * await User.create({ name: 'Juan' }); // id y created_at opcionales
 * ```
 */
export type CreationOptional<T> = T & {
    [CreationOptionalBrand]?: true;
};
/**
 * Extrae atributos de BD usando intersección:
 * - Primera parte: atributos REQUERIDOS con modificador `-?`
 * - Segunda parte: atributos OPCIONALES (solo CreationOptional)
 * - Ambos excluyen: never, undefined, null, NonAttribute, métodos
 * @example
 * ```typescript
 * class User {
 *   id: CreationOptional<string>;
 *   created_at: CreationOptional<number>;
 *   name: string;
 *   email: string;
 *   posts: NonAttribute<Post[]>;
 *   save(): void;
 * }
 * // InferAttributes<User> = { name: string, email: string } & { id?: string, created_at?: number }
 * // = { name: string, email: string, id?: string, created_at?: number }
 * ```
 */
export type InferAttributes<T> = {
    [K in keyof T as T[K] extends ((...args: any[]) => any) | {
        [NonAttributeBrand]?: true;
    } | {
        [CreationOptionalBrand]?: true;
    } ? never : K]-?: Exclude<T[K], null | undefined | never>;
} & {
    [K in keyof T as T[K] extends {
        [CreationOptionalBrand]?: true;
    } ? K : never]?: Exclude<T[K], null | undefined | never>;
};
/**
 * Extrae solo relaciones (NonAttribute) preservando tipo Model | Model[]
 * Excluye propiedades de Object.prototype para evitar conflictos
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   id: string;
 *   posts: NonAttribute<Post[]>;      // Array
 *   profile: NonAttribute<Profile>;   // Individual
 *   settings: NonAttribute<Settings | null>; // Nullable
 * }
 * // InferRelations<User> = { posts: Post[], profile: Profile, settings: Settings | null }
 * ```
 */
type ObjectBuiltinKeys = keyof Record<string, never> | 'toString' | 'valueOf' | 'hasOwnProperty' | 'isPrototypeOf' | 'propertyIsEnumerable' | 'toLocaleString' | 'constructor';
export type InferRelations<T> = {
    [K in keyof T as T[K] extends NonAttribute<any> ? K extends ObjectBuiltinKeys ? never : K : never]: T[K] extends NonAttribute<infer P> ? P : never;
};
/**
 * Extrae solo relaciones (campos NonAttribute).
 * Usado internamente para validación.
 * @example
 * ```typescript
 * class User {
 *   id: string;
 *   name: string;
 *   posts: NonAttribute<Post[]>;
 *   profile: NonAttribute<Profile>;
 * }
 * // PickRelations<User> = { posts: Post[], profile: Profile }
 * ```
 */
export type PickRelations<T> = {
    [K in keyof T as T[K] extends NonAttribute<any> ? K : never]: T[K] extends NonAttribute<infer U> ? U : never;
};
/**
 * Operadores de comparación soportados.
 * Solo 8 operadores permitidos según especificación del usuario.
 */
export type QueryOperator = "=" | "$eq" | "<>" | "!=" | "$ne" | "<" | "$lt" | "<=" | "$lte" | ">" | "$gt" | ">=" | "$gte" | "in" | "$in" | "include" | "$include";
/**
 * Opciones de query con pre-cache de atributos (A) y relaciones (R)
 * @template T - Modelo de tabla
 * @template A - Cache de InferAttributes<T>
 * @template R - Cache de InferRelations<T>
 * @example
 * ```typescript
 * await User.where({}, {
 *   where: {
 *     name: 'Juan',
 *     age: { $gte: 18, $lte: 65 }
 *   },
 *   order: 'DESC',
 *   limit: 10,
 *   attributes: ['name', 'email'],
 *   include: {
 *     posts: {
 *       where: { published: true },
 *       limit: 5,
 *       include: { comments: true }
 *     },
 *     profile: {
 *       attributes: ['bio', 'avatar']
 *     }
 *   }
 * });
 * ```
 */
export interface WhereOptions<T, A = InferAttributes<T>, R = InferRelations<T>> {
    /** Filtros de búsqueda */
    where?: {
        [K in keyof A]?: A[K] | {
            [N in QueryOperator]?: A[K];
        };
    };
    /** Orden de resultados */
    order?: "ASC" | "DESC" | {
        [K in keyof A]?: "ASC" | "DESC";
    };
    /** Número de items a saltar */
    offset?: number;
    /** Alias de offset */
    skip?: number;
    /** Número máximo de items a retornar */
    limit?: number;
    /** Campos a seleccionar */
    attributes?: Array<keyof A>;
    /** Relaciones a cargar (recursivo) */
    include?: {
        [K in keyof R]?: NonNullable<R[K]> extends Array<infer U> ? true | WhereOptions<U> : true | Pick<WhereOptions<NonNullable<R[K]>>, "attributes" | "include">;
    };
    /** Incluir registros soft-deleted */
    _includeTrashed?: boolean;
}
/**
 * Input para create() - InferAttributes ya maneja opcional/requerido con intersección
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   id: CreationOptional<string>;
 *   created_at: CreationOptional<number>;
 *   name: string;
 *   email: string;
 * }
 * // CreateInput<User> = { name: string, email: string, id?: string, created_at?: number }
 * await User.create({ name: 'Juan', email: 'juan@example.com' }); // id y created_at opcionales
 * ```
 */
export type CreateInput<T> = InferAttributes<T>;
/**
 * Tipo para update() - todos los campos parciales.
 * @example
 * ```typescript
 * await user.update({ name: 'Ana' }); // Todos los campos opcionales
 * ```
 */
export type UpdateInput<T> = Partial<InferAttributes<T>>;
/**
 * Picks only keys from T whose value extends V.
 * Selecciona solo las keys de T cuyo valor extiende V.
 * @example
 * ```typescript
 * class User { name: string; age: number; score: number; }
 * // PickByType<InferAttributes<User>, number> = { age: number, score: number }
 * ```
 */
type StripBrands<T> = T extends number & {
    [NonAttributeBrand]?: any;
} ? number : T extends string & {
    [NonAttributeBrand]?: any;
} ? string : T extends number & {
    [CreationOptionalBrand]?: any;
} ? number : T extends string & {
    [CreationOptionalBrand]?: any;
} ? string : T extends boolean & {
    [CreationOptionalBrand]?: any;
} ? boolean : T;
export type PickByType<T, V> = {
    [K in keyof T as StripBrands<NonNullable<T[K]>> extends V ? K : never]: T[K];
};
export {};
