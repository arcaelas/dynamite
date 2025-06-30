/*
 * Dinamite ORM — @Name
 * --------------------
 * • @Name("tabla")    → nombre físico de la tabla
 * • @Name("columna")  → alias de columna
 *
 * Permite sobrescribir el nombre AUTO-generado (snake_plural)
 * sin lanzar conflicto.
 */

import { ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

export default function Name(
  label: string
): ClassDecorator & PropertyDecorator {
  if (!label || typeof label !== "string") {
    throw new TypeError("@Name requiere una cadena no vacía");
  }

  return (target: any, prop?: string | symbol): void => {
    const ctor = prop === undefined ? target : target.constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));

    if (prop === undefined) {
      /* ---------- Nombre de la tabla ---------- */

      const auto = toSnakePlural(ctor.name);

      // Solo error si ya se modificó conscientemente antes.
      if (entry.name !== auto && entry.name !== label && entry.name) {
        throw new Error(
          `La clase ${ctor.name} ya tiene un @Name distinto (${entry.name})`
        );
      }
      entry.name = label;
    } else {
      /* ---------- Alias de columna ---------- */

      const col = ensureColumn(entry, prop, label);

      if (col.name && col.name !== label) {
        throw new Error(
          `La columna '${String(prop)}' ya tiene @Name distinto (${col.name})`
        );
      }
      col.name = label;
    }
  };
}
