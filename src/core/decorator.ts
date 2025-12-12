/**
 * @file decorator.ts
 * @description Sistema de decoradores minimalista con Symbol storage
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

// Symbols para autocontención (exportados desde table.ts pero también aquí compatibilidad)
export const SCHEMA = Symbol('dynamite:schema');

// Helper simple para snake_case plural
function toSnakePlural(str: string): string {
  const snake = str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
  return snake.endsWith("s") ? snake : snake + "s";
}

/**
 * @description Factory para crear decoradores con soporte de argumentos y composición
 * @param callback Función que recibe (schema, col, params) para configurar la columna
 * @returns Función que acepta argumentos y retorna PropertyDecorator
 * @example
 * ```typescript
 * const Default = decorator((schema, col, params) => {
 *   const fallback = params[0];
 *   col.get.push((value) => value ?? fallback());
 * });
 * // Uso: @Default(uuid)
 * ```
 */
export function decorator(
  callback: (schema: any, col: any, params: any[]) => void
) {
  return (...params: any[]) => {
    return function (target: any, propertyKey: string | symbol) {
      const table_class = target.constructor;
      const column_name = String(propertyKey);

      // Inicializar SCHEMA SI NO TIENE UNO PROPIO (no heredado)
      if (!Object.prototype.hasOwnProperty.call(table_class, SCHEMA)) {
        table_class[SCHEMA] = {
          name: toSnakePlural(table_class.name),
          primary_key: 'id',
          columns: {}
        };
      }

      // Crear columna si no existe
      if (!table_class[SCHEMA].columns[column_name]) {
        table_class[SCHEMA].columns[column_name] = {
          name: column_name,
          get: [],
          set: [],
          store: {}
        };
      }

      const col = table_class[SCHEMA].columns[column_name];

      // Ejecutar callback con (schema, col, params)
      callback(table_class, col, params);
    };
  };
}

/**
 * @description Factory para decoradores de relación
 * @param relation_type Tipo de relación ("hasMany", "hasOne", "belongsTo")
 * @param RelatedTable Clase de la tabla relacionada
 * @param options Opciones de relación (foreignKey, localKey)
 * @returns PropertyDecorator
 */
export function relationDecorator(
  relation_type: string,
  RelatedTable: any,
  options: any = {}
) {
  return function (target: any, propertyKey: string | symbol) {
    const table_class = target.constructor;
    const column_name = String(propertyKey);

    // Inicializar SCHEMA SI NO TIENE UNO PROPIO (no heredado)
    if (!Object.prototype.hasOwnProperty.call(table_class, SCHEMA)) {
      table_class[SCHEMA] = {
        name: toSnakePlural(table_class.name),
        primary_key: 'id',
        columns: {}
      };
    }

    // **Validación: No sobreescribir columnas existentes**
    if (table_class[SCHEMA].columns[column_name]) {
      throw new Error(`Column '${column_name}' already exists. Cannot apply relation decorator.`);
    }

    // Crear columna virtual para relación
    table_class[SCHEMA].columns[column_name] = {
      name: column_name,
      get: [],
      set: [],
      store: {
        relation: {
          type: relation_type,
          target: RelatedTable,
          foreignKey: options.foreignKey,
          localKey: options.localKey,
          nullable: options.nullable
        }
      }
    };
  };
}

