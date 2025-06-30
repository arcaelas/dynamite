/*
 * Dinamite ORM — @IndexSort (Sort Key)
 * ------------------------------------
 * Marca la propiedad como clave de ordenamiento.
 */

import { ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

export default function IndexSort(): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));

    const pkExists = [...entry.columns.values()].some((c) => c.index);
    if (!pkExists) {
      throw new Error(
        `PartitionKey no definido en ${ctor.name}; declara @Index primero`
      );
    }

    const already = [...entry.columns.values()].find((c) => c.indexSort);
    if (already && already !== entry.columns.get(prop)) {
      throw new Error(
        `La tabla ${ctor.name} ya tiene SortKey (${already.name})`
      );
    }

    const col = ensureColumn(entry, prop, String(prop));
    col.indexSort = true;
  };
}
