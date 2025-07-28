/**
 * @file name.ts
 * @descripcion Decorador @Name para tablas y columnas
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

/** Decorador para establecer nombres personalizados de tablas y columnas */
export default function Name(
  label: string
): ClassDecorator & PropertyDecorator {
  (!label || typeof label !== "string") &&
    (() => {
      throw new TypeError("@Name requiere una cadena no vacía");
    })();
  return (target: any, prop?: string | symbol): void => {
    const ctor = prop === undefined ? target : target.constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));
    if (prop === undefined) {
      const auto = toSnakePlural(ctor.name);
      entry.name !== auto &&
        entry.name !== label &&
        entry.name &&
        (() => {
          throw new Error(
            `La clase ${ctor.name} ya tiene un @Name distinto (${entry.name})`
          );
        })();
      entry.name = label;
    } else {
      const col = ensureColumn(entry, prop, label);
      col.name &&
        col.name !== label &&
        (() => {
          throw new Error(
            `La columna '${String(prop)}' ya tiene @Name distinto (${col.name})`
          );
        })();
      col.name = label;
    }
  };
}
