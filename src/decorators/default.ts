/**
 * @file default.ts
 * @descripcion Decorador @Default para valores por defecto
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { Column, STORE, ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

/** Decorador para establecer valores por defecto en propiedades */
export default function Default(factory: any): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));
    const column = ensureColumn(entry, prop, String(prop));
    if (column.default)
      throw new Error(`@Default duplicado en '${String(prop)}'`);
    column.default = typeof factory === "function" ? factory : () => factory;
    !Object.getOwnPropertyDescriptor(ctor.prototype, prop)?.set &&
      defineVirtual(ctor.prototype, column, prop);
  };
}

/** Define propiedad virtual con getter/setter para manejo de defaults */
function defineVirtual(proto: any, col: Column, prop: string | symbol): void {
  Object.defineProperty(proto, prop, {
    get() {
      return (this[STORE] ?? {})[prop];
    },
    set(val: unknown) {
      const buf = (this[STORE] ??= {});
      val =
        val === undefined && col.default !== undefined
          ? typeof col.default === "function"
            ? col.default()
            : col.default
          : val;
      if (col.mutate) for (const m of col.mutate) val = m(val);
      if (col.validate) {
        for (const v of col.validate) {
          const r = v(val);
          r !== true &&
            (() => {
              throw new Error(typeof r === "string" ? r : "Validación fallida");
            })();
        }
      }
      buf[prop] = val;
    },
    enumerable: true,
    configurable: true,
  });
}
