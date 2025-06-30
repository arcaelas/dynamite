/* src/core/wrapper.ts
 * -------------------------------------------------
 * Registro central (in-memory) de la configuración
 * declarativa de cada modelo.  Agnóstico: no depende
 * de DynamoDB ni de otros módulos de la librería.
 *
 * © 2025 Miguel Alejandro
 */

/* ------------------------------------------------------------------ */
/* 1.  Tipos utilitarios                                              */
/* ------------------------------------------------------------------ */
export type Inmutable = string | number | boolean | null | object;

export type Mutate = (value: any) => Inmutable;
export type Default = Inmutable | (() => Inmutable);
export type Validate = (value: any) => true | string;

/* ------------------------------------------------------------------ */
/* 2.  Descripción de columna y tabla                                 */
/* ------------------------------------------------------------------ */
export interface Column {
  /** nombre físico en la tabla (DynamoDB) */
  name: string;

  /* Decoradores básicos */
  default?: Default;
  mutate?: Mutate[];
  validate?: Validate[];

  /* Metadatos de índice / unicidad */
  index?: true; // Partition Key
  indexSort?: true; // Sort Key
  unique?: true; // constraint lógico (no se valida en Dynamo)
}

/**
 * Configuración completa por tabla
 */
export interface WrapperEntry {
  /** Nombre físico de la tabla (snake_plural o @Name) */
  name: string;

  /** Columnas asociadas a la clase. key = propiedad (string|symbol) */
  columns: Map<string | symbol, Column>;
}

/* ------------------------------------------------------------------ */
/* 3.  Contenedor global                                              */
/* ------------------------------------------------------------------ */
export type Wrapper = Map<Function, WrapperEntry>;

/**
 * Mapa singleton (clase → configuración)
 * Exportado como default para uso interno de la librería.
 */
const wrapper: Wrapper = new Map();
export default wrapper;

/* ------------------------------------------------------------------ */
/* 4.  Símbolo de almacenamiento de valores reales                    */
/* ------------------------------------------------------------------ */
/**
 * Buffer privado en cada instancia de Table donde se guardan
 * los valores procesados por los setters virtuales.
 *
 * Se exporta para que los decoradores puedan leer/escribir,
 * pero **NO** se vuelve a exportar desde la raíz del paquete.
 */
export const STORE: unique symbol = Symbol("dynamite:values");

/* ------------------------------------------------------------------ */
/* 5.  Pequeños helpers opcionales                                    */
/* ------------------------------------------------------------------ */

/**
 * Asegura que exista la entrada en el wrapper para la clase dada.
 * Devuelve la entrada (recién creada o existente).
 */
export function ensureConfig(ctor: Function, tableName: string): WrapperEntry {
  let entry = wrapper.get(ctor);
  if (!entry) {
    entry = { name: tableName, columns: new Map() };
    wrapper.set(ctor, entry);
  }
  return entry;
}

/**
 * Obtiene (o crea) el objeto Column para una propiedad concreta.
 */
export function ensureColumn(
  entry: WrapperEntry,
  prop: string | symbol,
  columnName: string
): Column {
  let col = entry.columns.get(prop);
  if (!col) {
    col = { name: columnName, mutate: [], validate: [] };
    entry.columns.set(prop, col);
  }
  return col;
}
