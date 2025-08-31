/**
 * @file wrapper.ts
 * @descripcion Sistema de tipos y wrapper optimizado
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import type { Column, WrapperEntry } from "@type/index";
export type {
  Column,
  WrapperEntry,
  HasMany,
  BelongsTo,
  NonAttribute,
  CreationOptional,
  InferAttributes,
  FilterableAttributes,
  QueryResult,
  WhereOptions,
  WhereOptionsWithoutWhere,
  QueryOperator,
  IncludeOptions,
  IncludeRelationOptions,
  WhereQueryOptions,
  Mutate,
  Validate,
} from "@type/index";
export const STORE: unique symbol = Symbol("dynamite:values");
const wrapper = new Map<Function, WrapperEntry>();

/** Obtener o crear entrada wrapper para constructor */
export const ensureConfig = (
  ctor: Function,
  table_name: string
): WrapperEntry => {
  const existing = wrapper.get(ctor);
  if (existing) return existing;

  const entry: WrapperEntry = {
    name: table_name,
    columns: new Map(),
    relations: new Map(),
  };
  wrapper.set(ctor, entry);
  return entry;
};

/** Obtener o crear configuración de columna para propiedad */
export const ensureColumn = (
  entry: WrapperEntry,
  prop: string | symbol,
  column_name: string
): Column => {
  const existing = entry.columns.get(prop);
  if (existing) return existing;

  const column: Column = { name: column_name, mutate: [], validate: [] };
  entry.columns.set(prop, column);
  return column;
};

/** Obtener metadatos requeridos (throws si no existen) */
export const mustMeta = (ctor: Function): WrapperEntry => {
  const meta = wrapper.get(ctor);
  if (!meta) {
    throw new Error(
      `Metadatos no encontrados para ${ctor.name}. ¿Usaste decoradores @Index, @PrimaryKey, etc.?`
    );
  }
  return meta;
};
export default wrapper;
