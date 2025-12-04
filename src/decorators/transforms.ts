/**
 * @file transforms.ts
 * @description Decoradores de transformación: @Default, @Mutate, @Validate, @Serialize, @NotNull, @Name
 */

import { decorator, ensureConfig, toSnakePlural } from "../core/decorator";
import type { Column, Mutate as MutateFn, Validate as ValidateFn } from "@type/index";

type SerializeFn = ((value: any) => any) | null;

/** Opciones para el decorador @Validate */
interface ValidateOptions {
  /** Si true, la validación se ejecuta en save() en vez del setter */
  lazy?: boolean;
}

/**
 * @description Decorador para establecer valor por defecto en una propiedad.
 * Si el valor es una función, se ejecuta para obtener el valor.
 * @param factory Valor por defecto o función que lo genera
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @Default("guest") role: string;
 *   @Default(() => []) tags: string[];
 *   @Default(() => crypto.randomUUID()) id: string;
 * }
 * ```
 */
export const Default = decorator<[factory: any]>((col, [factory]) => {
  if (col.default !== undefined) {
    throw new Error(`@Default duplicado en '${col.name}'`);
  }

  const get_default = typeof factory === "function" ? factory : () => factory;
  col.default = get_default;

  col.set((_, next) => (next === undefined ? get_default() : next));
});

/**
 * @description Decorador para transformar valores en cada asignación.
 * Se puede aplicar múltiples veces para encadenar transformaciones.
 * @param fn Función de transformación
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @Mutate((v) => v.trim())
 *   @Mutate((v) => v.toLowerCase())
 *   email: string;
 * }
 * ```
 */
export const Mutate = decorator<[fn: MutateFn]>((col, [fn]) => {
  if (typeof fn !== "function") {
    throw new TypeError("@Mutate requiere función");
  }

  col.set((_, next) => fn(next));
});

/**
 * @description Decorador para validar valores de propiedades.
 * @param validators Función o array de funciones validadoras
 * @param options Opciones de validación
 * @example
 * ```typescript
 * // Validación inmediata (en setter)
 * @Validate((v) => v.length > 3 || "Mínimo 4 caracteres")
 * name: string;
 *
 * // Validación lazy (en save())
 * @Validate((v) => v > 0 || "Debe ser positivo", { lazy: true })
 * price: number;
 *
 * // Múltiples validadores
 * @Validate([
 *   (v) => typeof v === "string",
 *   (v) => v.length > 0 || "No puede estar vacío"
 * ])
 * code: string;
 * ```
 */
export const Validate = decorator<[validators: ValidateFn | ValidateFn[], options?: ValidateOptions]>(
  (col, [validators, options]) => {
    const list = Array.isArray(validators) ? validators : [validators];

    if (!list.length || list.some((v) => typeof v !== "function")) {
      throw new TypeError("@Validate requiere funciones");
    }

    const is_lazy = options?.lazy ?? false;

    if (is_lazy) {
      for (const fn of list) {
        col.lazy_validators.push(fn);
      }
    } else {
      col.set((_, next) => {
        for (const fn of list) {
          const result = fn(next);
          if (result !== true) {
            throw new Error(typeof result === "string" ? result : "Validación fallida");
          }
        }
        return next;
      });
    }
  }
);

/**
 * @description Decorador para transformar valores entre la base de datos y la aplicación.
 * Usa `null` para omitir una transformación.
 * @param fromDB Función que transforma al leer de DB, o null para no transformar
 * @param toDB Función que transforma al guardar en DB, o null para no transformar
 * @example
 * ```typescript
 * // Ambas transformaciones
 * @Serialize(
 *   (from) => from === 1,     // DB: 1 → App: true
 *   (to) => to ? 1 : 0        // App: true → DB: 1
 * )
 * declare active: boolean;
 *
 * // Solo transformar al guardar
 * @Serialize(null, (to) => to.toUpperCase())
 * declare code: string;
 *
 * // Solo transformar al leer
 * @Serialize((from) => JSON.parse(from))
 * declare config: Record<string, any>;
 * ```
 */
export const Serialize = decorator<[fromDB: SerializeFn, toDB?: SerializeFn]>(
  (col, [fromDB, toDB]) => {
    if (fromDB !== null && typeof fromDB !== "function") {
      throw new TypeError("@Serialize: fromDB debe ser función o null");
    }
    if (toDB !== undefined && toDB !== null && typeof toDB !== "function") {
      throw new TypeError("@Serialize: toDB debe ser función o null");
    }

    col.serialize = {
      fromDB: fromDB ?? undefined,
      toDB: toDB ?? undefined,
    };

    if (fromDB) {
      col.set((_, next) => fromDB(next));
    }

    if (toDB) {
      col.get((current) => toDB(current));
    }
  }
);

/**
 * @description Decorador que valida que el valor no sea null, undefined o string vacío.
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *   @NotNull() name: string;  // No puede ser null, undefined o ""
 * }
 * ```
 */
export const NotNull = decorator((col) => {
  col.nullable = false;

  col.set((_, next) => {
    const is_empty =
      next === null ||
      next === undefined ||
      (typeof next === "string" && next.trim() === "");

    if (is_empty) {
      throw new Error(`El campo '${col.name}' no puede estar vacío`);
    }

    return next;
  });
});

/**
 * @description Decorador dual para renombrar tabla (si se aplica a clase) o columna (si se aplica a propiedad).
 * @param label Nombre personalizado para la tabla o columna
 * @example
 * ```typescript
 * // Renombrar tabla
 * @Name("usuarios")
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *
 *   // Renombrar columna
 *   @Name("nombre_completo")
 *   name: string;
 * }
 * ```
 */
export function Name(label: string): ClassDecorator & PropertyDecorator {
  if (!label || typeof label !== "string") {
    throw new TypeError("@Name requiere una cadena no vacía");
  }

  return (target: any, prop?: string | symbol): void => {
    const ctor = prop === undefined ? target : target.constructor;
    const auto_name = toSnakePlural(ctor.name);
    const entry = ensureConfig(ctor, auto_name);

    if (prop === undefined) {
      if (entry.name !== auto_name && entry.name !== label && entry.name) {
        throw new Error(
          `La clase ${ctor.name} ya tiene un @Name distinto (${entry.name})`
        );
      }
      entry.name = label;
    } else {
      let col = entry.columns.get(prop);
      if (!col) {
        col = { name: label, mutate: [], validate: [] } as Column;
        entry.columns.set(prop, col);
      }

      if (col.name && col.name !== label && col.name !== String(prop)) {
        throw new Error(
          `La columna '${String(prop)}' ya tiene @Name distinto (${col.name})`
        );
      }
      col.name = label;
    }
  };
}
