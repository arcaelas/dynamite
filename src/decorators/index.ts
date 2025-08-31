/**
 * @file index.ts
 * @descripcion Decorador @Index para Partition Key
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

/**
 * Decorador para marcar propiedad como Partition Key.
 * Configura la propiedad como índice principal para consultas.
 */
export default function Index(): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const tableName = toSnakePlural(ctor.name);
    const entry = ensureConfig(ctor, tableName);

    // Verificar si ya existe un índice primario
    const existingIndex = [...entry.columns.values()].find(
      (col) => col.index === true
    );

    if (existingIndex && existingIndex.name !== String(prop)) {
      throw new Error(
        `La tabla ${tableName} ya tiene definida una PartitionKey (${existingIndex.name}). ` +
          `No se puede definir otra PartitionKey en '${String(prop)}'`
      );
    }

    // Obtener o crear la columna y marcar como índice
    const column = ensureColumn(entry, prop, String(prop));
    column.index = true;

    // Asegurar que la columna no sea nula por defecto
    if (column.nullable === undefined) {
      column.nullable = false;
    }
  };
}
