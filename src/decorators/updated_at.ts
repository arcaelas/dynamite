/**
 * @file updated_at.ts
 * @descripcion Decorador @UpdatedAt para timestamp de actualización
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import Mutate from "./mutate";

/** Decorador para establecer timestamp automático de actualización */
export default function UpdatedAt(): PropertyDecorator {
  return Mutate(() => new Date().toISOString());
}
