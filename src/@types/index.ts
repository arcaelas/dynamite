/*
@file index.ts
@descripcion Tipos públicos de Dynamite ORM
@autor Miguel Alejandro
@fecha 2025-08-07
*/

// Brands para tipos especiales
export declare const HasManyBrand: unique symbol;
export declare const BelongsToBrand: unique symbol;
export declare const NonAttributeBrand: unique symbol;
export declare const CreationOptionalBrand: unique symbol;

// Relaciones y atributos especiales
export type HasMany<T> = T[] & { [HasManyBrand]?: true };
export type BelongsTo<T> = (T | null) & { [BelongsToBrand]?: true };
export type NonAttribute<T> = T & { [NonAttributeBrand]?: true };
export type CreationOptional<T> = T & { [CreationOptionalBrand]?: true };

// Utilidades internas de tipos
type IsBranded<
  T,
  Brand extends symbol
> = keyof NonNullable<T> extends keyof Omit<NonNullable<T>, Brand>
  ? false
  : true;

type KeepNullish<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]: T[K];
};

type KeepFunction<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K];
};

type KeepBranded<T, Brand extends symbol> = {
  [K in keyof T as IsBranded<T[K], Brand> extends true ? K : never]: T[K];
};

// Detectores de relaciones
type KeepHasMany<T> = {
  [K in keyof T as T[K] extends HasMany<any> ? K : never]: T[K];
};

type KeepBelongsTo<T> = {
  [K in keyof T as T[K] extends BelongsTo<any> ? K : never]: T[K];
};

type KeepRelation<T> = {
  [K in keyof T as T[K] extends HasMany<any> | BelongsTo<any>
    ? K
    : never]: T[K];
};

// Limpieza de tipos
type RemoveNullish<T> = Omit<T, keyof KeepNullish<T>>;

type RemoveFunction<T> = Omit<T, keyof KeepFunction<T>>;

type RemoveBranded<T, Brand extends symbol> = Omit<
  T,
  keyof KeepBranded<T, Brand>
>;

type RemoveHasMany<T> = Omit<T, keyof KeepHasMany<T>>;

type RemoveBelongsTo<T> = Omit<T, keyof KeepBelongsTo<T>>;

type RemoveRelation<T> = Omit<T, keyof KeepRelation<T>>;

// Atributos inferidos (excluye relaciones, non-attributes y funciones)
export type InferAttributes<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any
    ? never
    : T[K] extends { [HasManyBrand]?: true }
    ? never
    : T[K] extends { [BelongsToBrand]?: true }
    ? never
    : T[K] extends { [NonAttributeBrand]?: true }
    ? never
    : K]: T[K];
};

export type FilterableAttributes<T> = {
  [K in keyof InferAttributes<T>]: InferAttributes<T>[K];
};

// Resultados y opciones de include
type SelectResult<T, A extends keyof T> = Pick<T, A>;

type ResolveIncludeType<T, K extends keyof T> = T[K] extends HasMany<infer U>
  ? U[]
  : T[K] extends BelongsTo<infer U>
  ? U | null
  : never;

export type WhereOptions<T> = {
  where?: Partial<FilterableAttributes<T>>;
  skip?: number;
  limit?: number;
  order?: "ASC" | "DESC";
  attributes?: (keyof FilterableAttributes<T>)[];
  include?: {
    [K in keyof T]?: T[K] extends HasMany<any> | BelongsTo<any>
      ? IncludeRelationOptions | true
      : never;
  };
};

/** Filtros de query sin cláusula where */
export type QueryFilters<T> = Omit<WhereOptions<T>, "where">;

/** @deprecated Usa QueryFilters */
export type WhereOptionsWithoutWhere<T> = QueryFilters<T>;

export type QueryOperator =
  | "="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "in"
  | "not-in"
  | "contains"
  | "begins-with";

/** Entrada de validador con soporte lazy */
export interface ValidatorEntry {
  fn: (value: any) => boolean | string;
  lazy?: boolean;
}

/** Configuración de serialización para transformar valores DB ↔ App */
export interface SerializeConfig {
  fromDB?: (value: any) => any;
  toDB?: (value: any) => any;
}

// Tipos para core/wrapper
export interface Column {
  name: string;
  default?: any | (() => any);
  mutate?: ((value: any) => any)[];
  validate?: (((value: any) => boolean | string) | ValidatorEntry)[];
  index?: true;
  indexSort?: true;
  primaryKey?: boolean;
  nullable?: boolean;
  unique?: true;
  createdAt?: boolean;
  updatedAt?: boolean;
  softDelete?: boolean;
  serialize?: SerializeConfig;
}

export interface RelationMetadata {
  type: "hasMany" | "belongsTo";
  targetModel: () => any;
  foreignKey: string;
  localKey?: string;
}

export interface WrapperEntry {
  name: string;
  columns: Map<string | symbol, Column>;
  relations: Map<string | symbol, RelationMetadata>;
}

// Tipos internos del where de Table
export type IncludeRelationOptions = {
  where?: Record<string, any>;
  attributes?: string[];
  order?: "ASC" | "DESC";
  skip?: number;
  limit?: number;
  include?: Record<string, IncludeRelationOptions | true>;
};

/** Opciones de query para métodos where(), first(), last(), etc. */
export type QueryOptions<T> = {
  order?: "ASC" | "DESC";
  skip?: number;
  limit?: number;
  attributes?: (keyof InferAttributes<T>)[];
  include?: {
    [K in keyof T]?: T[K] extends HasMany<any> | BelongsTo<any>
      ? IncludeRelationOptions | true
      : never;
  };
};

/** @deprecated Usa QueryOptions */
export type WhereQueryOptions<T> = QueryOptions<T>;

// Tipos utilitarios para decoradores
export type Mutate = (value: any) => any;
export type Validate = (value: any) => boolean | string;
