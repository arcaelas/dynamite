/**
 * @file indexes.ts
 * @description Index decorators: @Index, @IndexSort, @PrimaryKey
 * @description Decoradores de índices: @Index, @IndexSort, @PrimaryKey
 */

import { decorator, SCHEMA } from "../core/decorator";
import { ulid } from "../utils/ulid";

/**
 * @description Marks a property as Partition Key for a GSI
 * @description Marca una propiedad como Partition Key de un GSI
 */
export const Index = decorator((_schema, col) => {
  col.store.index = true;
});

/**
 * @description Marks a property as Sort Key
 * @description Marca una propiedad como Sort Key
 */
export const IndexSort = decorator((_schema, col) => {
  col.store.indexSort = true;
});

/**
 * @description Primary key: Default(ulid) + NotNull + Index + IndexSort. Any non-empty string is a valid id (ULID by default; UUID or custom keys already stored are accepted)
 * @description Clave primaria: Default(ulid) + NotNull + Index + IndexSort. Cualquier string no vacío es un id válido (ULID por defecto; se aceptan UUID u otras claves ya almacenadas)
 */
export const PrimaryKey = decorator((table_class, col) => {
  const schema = (table_class as any)[SCHEMA];

  // Metadata: Index + primaryKey (IndexSort only when separate SK exists)
  col.store.index = true;
  col.store.primaryKey = true;
  col.store.readsCurrent = true;
  schema.primary_key = col.name;

  // Set pipeline: immutable after first assignment, Default(ulid), any non-empty string id
  col.set.push((next: any, current: any) => {
    const value = current ?? next ?? ulid();
    if (typeof value !== 'string' || !value) {
      throw new Error(`Invalid primary key for ${col.name}: '${value}'`);
    }
    return value;
  });
});
