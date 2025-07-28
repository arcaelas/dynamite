/**
 * @file naming.ts
 * @descripcion Utilidades de conversión de nombres
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import pluralize from "pluralize";

/** Convierte nombre de clase a formato snake_case plural para tablas */
export function toSnakePlural(input: string): string {
  return pluralize(input.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase());
}
