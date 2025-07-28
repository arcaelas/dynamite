/**
 * @file not_null.ts
 * @descripcion Decorador @NotNull para validación no-null
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import Validate from "./validate";

/** Decorador para validar que el valor no sea nulo, indefinido o string vacío */
export default function NotNull(): PropertyDecorator {
  return (Validate as any)(
    (value: any) =>
      value !== null &&
      value !== undefined &&
      (typeof value !== "string" || value.trim() !== "")
  );
}
