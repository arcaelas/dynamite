/**
 * @file created_at.ts
 * @descripcion Decorador @CreatedAt para timestamp de creación
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import Default from "./default";

/** Decorador para establecer timestamp automático de creación */
export default function CreatedAt(): PropertyDecorator {
  return Default(() => new Date().toISOString());
}
