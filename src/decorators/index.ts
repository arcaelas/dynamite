/**
 * @file index.ts
 * @descripcion Decorador @Index para Partition Key
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

/** Decorador para marcar propiedad como Partition Key */
export default function Index(): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));
    const already = [...entry.columns.values()].find((c) => c.index);
    already &&
      already !== entry.columns.get(prop) &&
      (() => {
        throw new Error(
          `La tabla ${ctor.name} ya tiene PartitionKey (${already.name})`
        );
      })();
    ensureColumn(entry, prop, String(prop)).index = true;
  };
}
