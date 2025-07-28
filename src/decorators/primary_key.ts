/**
 * @file primary_key.ts
 * @descripcion Decorador @PrimaryKey para clave primaria compuesta
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import Index from "./index";
import IndexSort from "./index_sort";

/** Decorador para marcar propiedad como clave primaria compuesta (Index + IndexSort) */
export default function PrimaryKey(name = "primary"): PropertyDecorator {
  (typeof name !== "string" || !name.trim()) &&
    (() => {
      throw new TypeError("@PrimaryKey requiere un nombre de índice válido");
    })();
  return (target: object, prop: string | symbol): void => {
    Index()(target, prop);
    IndexSort()(target, prop);
  };
}
