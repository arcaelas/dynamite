/*
@file index.ts
@descripcion Tipos públicos de Dynamite ORM
@autor Miguel Alejandro
@fecha 2025-08-07
*/

// Brands para tipos especiales
export declare const HasManyBrand: unique symbol;
export declare const BelongsToBrand: unique symbol;
export declare const HasOneBrand: unique symbol;
export declare const NonAttributeBrand: unique symbol;
export declare const CreationOptionalBrand: unique symbol;

// Relaciones y atributos especiales
export type HasMany<T> = T[] & { [HasManyBrand]?: true };
export type BelongsTo<T> = (T | null) & { [BelongsToBrand]?: true };
export type HasOne<T> = (T | null) & { [HasOneBrand]?: true };
export type NonAttribute<T> = T & { [NonAttributeBrand]?: true };
export type CreationOptional<T> = T & { [CreationOptionalBrand]?: true };

// Atributos inferidos (excluye relaciones, non-attributes y funciones)
export type InferAttributes<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any
    ? never
    : T[K] extends { [HasManyBrand]?: true }
    ? never
    : T[K] extends { [BelongsToBrand]?: true }
    ? never
    : T[K] extends { [HasOneBrand]?: true }
    ? never
    : T[K] extends { [NonAttributeBrand]?: true }
    ? never
    : K]: T[K];
};

export type FilterableAttributes<T> = {
  [K in keyof InferAttributes<T>]: InferAttributes<T>[K];
};

export type WhereOptions<T> = {
  where?: Partial<FilterableAttributes<T>>;
  skip?: number;
  limit?: number;
  order?: "ASC" | "DESC";
  attributes?: (keyof FilterableAttributes<T>)[];
  include?: {
    [K in keyof T]?: T[K] extends HasMany<any> | BelongsTo<any> | HasOne<any>
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

// Tipos para core/wrapper
export interface Column {
  name: string;
  index?: true;
  indexSort?: true;
  primaryKey?: boolean;
  nullable?: boolean;
  unique?: true;
  createdAt?: boolean;
  updatedAt?: boolean;
  softDelete?: boolean;
  lazy_validators?: ((value: any) => boolean | string)[];
  relation?: RelationMetadata;
}

export interface RelationMetadata {
  type: "hasMany" | "belongsTo" | "hasOne";
  targetModel: () => any;
  foreignKey: string;
  localKey?: string;
}

export interface WrapperEntry {
  name: string;
  columns: Map<string | symbol, Column>;
  relations: Map<string | symbol, RelationMetadata>;
}

/** Alias para WrapperEntry (usado internamente con SCHEMA symbol) */
export type SchemaEntry = WrapperEntry;

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
    [K in keyof T]?: T[K] extends HasMany<any> | BelongsTo<any> | HasOne<any>
      ? IncludeRelationOptions | true
      : never;
  };
};

/** @deprecated Usa QueryOptions */
export type WhereQueryOptions<T> = QueryOptions<T>;

// Tipos utilitarios para decoradores
export type Mutate = (value: any) => any;
export type Validate = (value: any) => boolean | string;
