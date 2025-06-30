/*
 * Dinamite ORM — @CreatedAt Decorator (wrapper)
 * -------------------------------------------
 * Establece un valor por defecto con la fecha/hora actual (ISO‑string)
 * usando @Default.
 *
 * © 2025 Miguel Alejandro
 */

import Default from "./default";

/**
 * Asigna automáticamente la fecha de creación en nuevas instancias.
 */
export default function CreatedAt(): PropertyDecorator {
  return Default(() => new Date().toISOString());
}
