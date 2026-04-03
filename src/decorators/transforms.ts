/**
 * @file transforms.ts
 * @description Primitive decorators: @Get, @Set, @Validate. Composed: @Default, @NotNull, @Name
 * @description Decoradores primitivos: @Get, @Set, @Validate. Compuestos: @Default, @NotNull, @Name
 */

import { decorator, SCHEMA } from "../core/decorator";

/**
 * @description Output pipeline -- transforms value on read
 * @description Pipeline de salida -- transforma el valor al leer
 * @param fn (current) => any
 */
export const Get = decorator((_schema, col, params) => {
  col.get.push(params[0]);
});

/**
 * @description Input pipeline -- transforms value on write
 * @description Pipeline de entrada -- transforma el valor al escribir
 * @param fn (next, current) => any
 */
export const Set = decorator((_schema, col, params) => {
  col.set.push(params[0]);
});

/**
 * @description Validates value on write. Returns true to pass, or string as error message.
 * @description Valida valor al escribir. Retorna true para pasar, o string como mensaje de error.
 * @param validators (next, current) => true | string
 */
export const Validate = decorator((_schema, col, params) => {
  const validators = params[0];
  const list = Array.isArray(validators) ? validators : [validators];

  if (!list.length || list.some((v: any) => typeof v !== 'function')) {
    throw new TypeError('@Validate requires functions');
  }

  col.set.push((next: any, current: any) => {
    for (const fn of list) {
      const result = fn(next, current);
      if (result !== true) {
        throw new Error(typeof result === 'string' ? result : `Validation failed for '${col.name}'`);
      }
    }
    return next;
  });
});

/**
 * @description Assigns default value when nullish. Lives in set pipeline.
 * @description Asigna valor default cuando es nullish. Vive en el set pipeline.
 * @param val Static value or () => value
 */
export const Default = (val: any) => {
  const fn = typeof val === 'function'
    ? (next: any) => next ?? val()
    : (next: any) => next ?? val;
  return Set(fn);
};

/**
 * @description Rejects null, undefined, and empty string. Composed from @Validate.
 * @description Rechaza null, undefined y string vacío. Compuesto desde @Validate.
 * @param msg Optional error message
 */
export const NotNull = (msg?: string) => {
  return Validate((next: any) => {
    if (next === null || next === undefined || (typeof next === 'string' && next.trim() === '')) {
      return typeof msg === 'string' ? msg : false;
    }
    return true;
  });
};

/**
 * @description Renames table (on class) or column (on property)
 * @description Renombra tabla (en clase) o columna (en propiedad)
 * @param label Custom name
 */
export function Name(label: string): ClassDecorator & PropertyDecorator {
  if (!label || typeof label !== 'string') {
    throw new TypeError('@Name requires a non-empty string');
  }

  return (target: any, prop?: string | symbol): void => {
    const ctor = prop === undefined ? target : target.constructor;
    const schema = (ctor as any)[SCHEMA];

    if (prop === undefined) {
      schema.name = label;
    } else {
      const key = String(prop);
      if (!schema.columns[key]) {
        schema.columns[key] = { name: key, get: [], set: [], store: {} };
      }
      schema.columns[key].name = label;
    }
  };
}
