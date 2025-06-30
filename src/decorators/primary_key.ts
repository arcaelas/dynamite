/*
 * Dinamite ORM — @PrimaryKey
 * --------------------------
 * Declara simultáneamente Partition Key y Sort Key
 * sobre la misma propiedad.
 */

import Index from "./index";
import IndexSort from "./index_sort";

/**
 * Atajo para definir clave primaria compuesta (PK + SK).
 * El parámetro `name` queda reservado por si en el futuro
 * se almacena un identificador lógico de índice, pero hoy
 * NO se pasa a ningún decorador interno.
 */
export default function PrimaryKey(name = "primary"): PropertyDecorator {
  if (typeof name !== "string" || !name.trim()) {
    throw new TypeError("@PrimaryKey requiere un nombre de índice válido");
  }

  return (target: object, prop: string | symbol): void => {
    Index()(target, prop); // Partition Key
    IndexSort()(target, prop); // Sort Key
  };
}
