/*
 * Dinamite ORM — @UpdatedAt Decorator (wrapper)
 * --------------------------------------------
 * Actualiza la fecha/hora cada vez que la propiedad recibe un nuevo valor
 * (incluyendo actualizaciones mediante Model.save()).
 * Internamente aplica @Mutate con una factory de timestamp ISO.
 *
 * © 2025 Miguel Alejandro
 */

import Mutate from "./mutate";

/**
 * Actualiza automáticamente la marca temporal en cada asignación.
 */
export default function UpdatedAt(): PropertyDecorator {
  return Mutate(() => new Date().toISOString());
}
