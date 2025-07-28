/**
 * @file validate.ts
 * @descripcion Decorador @Validate para validaciones
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { Column, STORE, ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

/** Decorador para aplicar validaciones a propiedades */
export default function Validate(
  validators:
    | ((v: unknown) => true | string)
    | ((v: unknown) => true | string)[]
): PropertyDecorator {
  const list = Array.isArray(validators) ? validators : [validators];
  if (!list.length || list.some((v) => typeof v !== "function")) {
    throw new TypeError("@Validate requiere funciones");
  }
  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));
    const col = ensureColumn(entry, prop, String(prop));
    col.validate ??= [];
    col.validate.push(...list);
    !Object.getOwnPropertyDescriptor(ctor.prototype, prop)?.set &&
      defineVirtual(ctor.prototype, col, prop);
  };
}

/** Define propiedad virtual con getter/setter para manejo de validaciones */
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
