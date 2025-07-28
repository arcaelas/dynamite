/**
 * @file index_sort.ts
 * @descripcion Decorador @IndexSort para Sort Key
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

/** Decorador para marcar propiedad como Sort Key */
export default function IndexSort(): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));
    ![...entry.columns.values()].some((c) => c.index) &&
      (() => {
        throw new Error(
          `PartitionKey no definido en ${ctor.name}; declara @Index primero`
        );
      })();
    const already = [...entry.columns.values()].find((c) => c.indexSort);
    already &&
      already !== entry.columns.get(prop) &&
      (() => {
        throw new Error(
          `La tabla ${ctor.name} ya tiene SortKey (${already.name})`
        );
      })();
    ensureColumn(entry, prop, String(prop)).indexSort = true;
  };
}
