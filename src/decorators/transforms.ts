/**
 * @file transforms.ts
 * @description Decoradores de transformación con pipelines directas
 * @autor Miguel Alejandro
 * @fecha 2025-01-28
 */

import { decorator, SCHEMA } from "../core/decorator";

/**
 * @description Decorador para establecer valor por defecto usando pipeline de getter
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
  // Usar pipeline de getter con ?? para valores nullish
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
  col.set.push((current: any, next: any) => fn(next));
});

/**
 * @description Decorador para validar valores (se ejecuta en el setter)
 * @param validators Función o array de funciones validadoras
 * @example
 * ```typescript
 * class User extends Table<User> {
 *   @Validate((v) => v.length > 0 || 'Email requerido')
 *   declare email: string;
 *
 *   @Validate([isEmail, isNotEmpty])
 *   declare email2: string;
 * }
 * ```
 */
export const Validate = decorator((_schema, col, params) => {
  const validators = params[0];
  const list = Array.isArray(validators) ? validators : [validators];

  if (!list.length || list.some((v: any) => typeof v !== 'function')) {
    throw new TypeError('@Validate requiere funciones');
  }

  col.set.push((current: any, next: any) => {
    for (const fn of list) {
      const result = fn(next);
      if (result !== true) {
        throw new Error(typeof result === 'string' ? result : 'Validación fallida');
      }
    }
    return next;
  });
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
  if (toDB) col.set.push((current: any, next: any) => next !== null && next !== undefined ? toDB(next) : next);
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
export const NotNull = decorator((_schema, col, params) => {
  const custom_message = params[0];
  col.store.nullable = false;
  col.store.notNullMessage = custom_message;
  col.set.push((current: any, next: any) => {
    const is_empty = next === null || next === undefined || (typeof next === 'string' && next.trim() === '');
    if (is_empty) {
      throw new Error(custom_message || `El campo ${col.name} no puede estar vacío`);
    }
    return next;
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
    const schema = (ctor as any)[SCHEMA];

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

/**
 * @description Decorador para marcar una propiedad como columna sin agregar comportamiento especial
 * @example
 * ```typescript
 * class Product extends Table<Product> {
 *   @Column()
 *   price!: number;
 *
 *   @Column()
 *   category_id!: string;
 * }
 * ```
 */
export const Column = decorator((_schema, _col) => {
  // No hace nada, solo marca la propiedad como columna en schema.columns
});
