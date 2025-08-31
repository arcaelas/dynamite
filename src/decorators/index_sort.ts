/**
 * @file index_sort.ts
 * @descripcion Decorador @IndexSort para Sort Key
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

/**
 * Decorador para marcar propiedad como Sort Key.
 * Configura la propiedad como clave de ordenación para consultas.
 * Requiere que exista una PartitionKey (@Index) definida previamente.
 */
export default function IndexSort(): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const tableName = toSnakePlural(ctor.name);
    const entry = ensureConfig(ctor, tableName);

    // Verificar que exista una PartitionKey definida
    const hasPartitionKey = [...entry.columns.values()].some(
      (col) => col.index === true
    );
    if (!hasPartitionKey) {
      throw new Error(
        `No se puede definir una SortKey en '${String(
          prop
        )}' sin una PartitionKey. ` +
          `Asegúrate de marcar una propiedad con @Index primero.`
      );
    }

    // Verificar si ya existe una SortKey
    const existingSortKey = [...entry.columns.values()].find(
      (col) => col.indexSort === true
    );
    if (existingSortKey && existingSortKey.name !== String(prop)) {
      throw new Error(
        `La tabla ${tableName} ya tiene una SortKey definida (${existingSortKey.name}). ` +
          `No se puede definir otra SortKey en '${String(prop)}'`
      );
    }

    // Obtener o crear la columna y marcar como índice de ordenación
    const column = ensureColumn(entry, prop, String(prop));
    column.indexSort = true;

    // Asegurar que la columna no sea nula por defecto
    if (column.nullable === undefined) {
      column.nullable = false;
    }
  };
}
