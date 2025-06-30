/*
 * Dinamite ORM — @Index (Partition Key)
 * -------------------------------------
 * Marca la propiedad como clave de partición.
 */

import { ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

export default function Index(): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));

    /* Evitar duplicados */
    const already = [...entry.columns.values()].find((c) => c.index);
    if (already && already !== entry.columns.get(prop)) {
      throw new Error(
        `La tabla ${ctor.name} ya tiene PartitionKey (${already.name})`
      );
    }

    const col = ensureColumn(entry, prop, String(prop));
    col.index = true;
  };
}
