/*
 * Dinamite ORM — @NotNull Decorator (wrapper)
 * ------------------------------------------
 * Valida que el valor no sea null, undefined ni cadena vacía.
 * Internamente aplica @Validate con una función sincrónica.
 *
 * © 2025 Miguel Alejandro
 */

import Validate from "./validate";

/**
 * Decorador wrapper que asegura no-null / no-empty.
 */
export default function NotNull(): PropertyDecorator {
  return (Validate as any)((value, key) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    return true;
  });
}
