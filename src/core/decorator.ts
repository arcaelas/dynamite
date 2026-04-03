/**
 * @file decorator.ts
 * @description Minimal decorator system with Symbol storage
 * @description Sistema de decoradores minimalista con Symbol storage
 */

export const SCHEMA = Symbol('dynamite:schema');

export interface Schema {
  name: string;
  primary_key: string;
  gsis: Set<string>;
  columns: Record<string, {
    name: string;
    get: ((value: any) => any)[];
    set: ((current: any, next: any) => any)[];
    store: {
      index?: boolean;
      indexSort?: boolean;
      primaryKey?: boolean;
      softDelete?: boolean;
      createdAt?: boolean;
      updatedAt?: boolean;
      relation?: {
        type: 'HasMany' | 'HasOne' | 'BelongsTo' | 'ManyToMany';
        model: () => any;
        foreignKey: string;
        localKey: string;
        relatedKey?: string;
        pivotTable?: string;
        relatedPK?: string;
      };
    };
  }>;
}

function toSnakePlural(str: string): string {
  const snake = str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
  return snake.endsWith("s") ? snake : snake + "s";
}

function resolve(target: any, propertyKey: string | symbol): [Schema, Schema['columns'][string]] {
  const ctor = target.constructor;
  if (!Object.prototype.hasOwnProperty.call(ctor, SCHEMA)) {
    ctor[SCHEMA] = { name: toSnakePlural(ctor.name), primary_key: 'id', gsis: new Set(), columns: {} };
  }
  const key = String(propertyKey);
  const schema: Schema = ctor[SCHEMA];
  schema.columns[key] ||= { name: key, get: [], set: [], store: {} };
  return [schema, schema.columns[key]];
}

/**
 * @description Factory to create decorators with argument support and composition
 * @description Factory para crear decoradores con soporte de argumentos y composición
 */
export function decorator(callback: (table_class: any, col: Schema['columns'][string], params: any[]) => void) {
  return (...params: any[]) => (target: any, propertyKey: string | symbol) => {
    const [, col] = resolve(target, propertyKey);
    callback(target.constructor, col, params);
  };
}

