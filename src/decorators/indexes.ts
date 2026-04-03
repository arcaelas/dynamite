/**
 * @file indexes.ts
 * @description Index decorators: @Index, @IndexSort, @PrimaryKey
 * @description Decoradores de índices: @Index, @IndexSort, @PrimaryKey
 */

import { decorator, SCHEMA } from "../core/decorator";
import { ulid } from "../utils/ulid";

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

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
 * @description Primary key: Default(ulid) + NotNull + ULID validation + Index + IndexSort
 * @description Clave primaria: Default(ulid) + NotNull + validación ULID + Index + IndexSort
 */
export const PrimaryKey = decorator((table_class, col) => {
  const schema = (table_class as any)[SCHEMA];

  // Metadata: Index + primaryKey (IndexSort only when separate SK exists)
  col.store.index = true;
  col.store.primaryKey = true;
  schema.primary_key = col.name;

  // Set pipeline: immutable after first assignment, Default(ulid), validate ULID format
  col.set.push((next: any, current: any) => {
    const value = current ?? next ?? ulid();
    if (typeof value !== 'string' || !ULID_RE.test(value)) {
      throw new Error(`Invalid ULID for ${col.name}: '${value}'`);
    }
    return value;
  });
});
