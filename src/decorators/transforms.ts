/**
 * @file transforms.ts
 * @description Decoradores de transformación con pipelines directas
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { decorator, ensureSchema } from "../core/decorator";

/**
 * @description Decorador para establecer valor por defecto
 * @param factory Valor por defecto o función que lo genera
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @Default(uuid)
 *   declare id: string;
 *
 *   @Default(() => 0)
 *   declare score: number;
 * }
 * ```
 */
export const Default = decorator((_schema, col, params) => {
  const fallback = params[0];
  col.get.push((value: any) => value ?? (typeof fallback === 'function' ? fallback() : fallback));
});

/**
 * @description Decorador para transformar valores en cada asignación
 * @param fn Función de transformación
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @Mutate((v) => v.toLowerCase())
 *   declare email: string;
 * }
 * ```
 */
export const Mutate = decorator((_schema, col, params) => {
  const fn = params[0];
  col.set.push((value: any) => fn(value));
});

/**
 * @description Decorador para validar valores
 * @param validators Función o array de funciones validadoras
 * @param options Opciones de validación (lazy: true para validar en save())
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @Validate((v) => v.length > 0 || 'Email requerido')
 *   declare email: string;
 *
 *   @Validate([isEmail, isNotEmpty], { lazy: true })
 *   declare email2: string;
 * }
 * ```
 */
export const Validate = decorator((_schema, col, params) => {
  const [validators, options] = params;
  const list = Array.isArray(validators) ? validators : [validators];
  const is_lazy = options?.lazy ?? false;

  if (!list.length || list.some((v: any) => typeof v !== 'function')) {
    throw new TypeError('@Validate requiere funciones');
  }

  if (is_lazy) {
    col.store.lazy_validators = list;
  } else {
    col.set.push((value: any) => {
      for (const fn of list) {
        const result = fn(value);
        if (result !== true) {
          throw new Error(typeof result === 'string' ? result : 'Validación fallida');
        }
      }
      return value;
    });
  }
});

/**
 * @description Decorador para transformar valores entre DB y aplicación
 * @param fromDB Función que transforma al leer de DB
 * @param toDB Función que transforma al guardar en DB
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @Serialize(JSON.parse, JSON.stringify)
 *   declare metadata: Record<string, any>;
 * }
 * ```
 */
export const Serialize = decorator((_schema, col, params) => {
  const [fromDB, toDB] = params;
  if (fromDB) col.get.push((v: any) => v !== null && v !== undefined ? fromDB(v) : v);
  if (toDB) col.set.push((v: any) => v !== null && v !== undefined ? toDB(v) : v);
});

/**
 * @description Decorador que valida que el valor no sea null, undefined o string vacío
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @NotNull()
 *   declare name: string;
 * }
 * ```
 */
export const NotNull = decorator((_schema, col) => {
  col.store.nullable = false;
  col.set.push((value: any) => {
    const is_empty = value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
    if (is_empty) {
      throw new Error(`El campo ${col.name} no puede estar vacío`);
    }
    return value;
  });
});

/**
 * @description Decorador dual para renombrar tabla o columna
 * @param label Nombre personalizado
 * @example
 * ```typescript
 * @Name('usuarios')
 * class User extends Table<User> {
 *   @Name('user_email')
 *   declare email: string;
 * }
 * ```
 */
export function Name(label: string): ClassDecorator & PropertyDecorator {
  if (!label || typeof label !== 'string') {
    throw new TypeError('@Name requiere una cadena no vacía');
  }

  return (target: any, prop?: string | symbol): void => {
    const ctor = prop === undefined ? target : target.constructor;
    const schema = ensureSchema(ctor);

    if (prop === undefined) {
      // @Name en clase - renombrar tabla
      schema.name = label;
    } else {
      // @Name en propiedad - renombrar columna
      const column_name = String(prop);

      if (!schema.columns[column_name]) {
        schema.columns[column_name] = { name: column_name, get: [], set: [], store: {} };
      }

      schema.columns[column_name].name = label;
    }
  };
}
