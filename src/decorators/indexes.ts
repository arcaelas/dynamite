/**
 * @file indexes.ts
 * @description Decoradores de índices: @Index, @IndexSort, @PrimaryKey
 */

import { decorator } from "../core/decorator";

/**
 * @description Decorador para marcar propiedad como Partition Key.
 * Configura la propiedad como índice principal para consultas.
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @Index() id: string;
 * }
 * ```
 */
export const Index = decorator((col, _, entry) => {
  const table_name = entry.name;

  for (const [, c] of entry.columns) {
    if (c.index === true && c.name !== col.name) {
      throw new Error(
        `La tabla ${table_name} ya tiene definida una PartitionKey (${c.name}). ` +
          `No se puede definir otra PartitionKey en '${col.name}'`
      );
    }
  }

  col.index = true;
  if (col.nullable === undefined) col.nullable = false;
});

/**
 * @description Decorador para marcar propiedad como Sort Key.
 * Configura la propiedad como clave de ordenación para consultas.
 * Requiere que exista una PartitionKey (@Index) definida previamente.
 * @example
 * ```typescript
 * class Post extends Table<Post> {
 *   @Index() user_id: string;
 *   @IndexSort() created_at: string;
 * }
 * ```
 */
export const IndexSort = decorator((col, _, entry) => {
  const table_name = entry.name;

  let has_partition_key = false;
  for (const [, c] of entry.columns) {
    if (c.index === true) {
      has_partition_key = true;
      break;
    }
  }

  if (!has_partition_key) {
    throw new Error(
      `No se puede definir una SortKey en '${col.name}' sin una PartitionKey. ` +
        `Asegúrate de marcar una propiedad con @Index primero.`
    );
  }

  for (const [, c] of entry.columns) {
    if (c.indexSort === true && c.name !== col.name) {
      throw new Error(
        `La tabla ${table_name} ya tiene una SortKey definida (${c.name}). ` +
          `No se puede definir otra SortKey en '${col.name}'`
      );
    }
  }

  col.indexSort = true;
  if (col.nullable === undefined) col.nullable = false;
});

/**
 * @description Decorador para marcar una propiedad como clave primaria.
 * Aplica automáticamente @Index y @IndexSort y marca el campo como primaryKey.
 * @param name Nombre opcional (legacy, no utilizado)
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *   name: string;
 * }
 * ```
 */
export function PrimaryKey(name = "primary"): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    Index()(target, prop);
    IndexSort()(target, prop);

    decorator((col) => {
      col.primaryKey = true;
      col.nullable = false;
    })()(target, prop);
  };
}
