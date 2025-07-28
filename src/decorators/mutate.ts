/**
 * @file mutate.ts
 * @descripcion Decorador @Mutate para transformaciones
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import type { Column, Mutate } from "../core/wrapper";
import { STORE, ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

/** Decorador para aplicar transformaciones automáticas a propiedades */
export default function Mutate(fn: Mutate): PropertyDecorator {
  typeof fn !== "function" &&
    (() => {
      throw new TypeError("@Mutate requiere función");
    })();
  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));
    const col = ensureColumn(entry, prop, String(prop));
    col.mutate ??= [];
    col.mutate.push(fn);
    !Object.getOwnPropertyDescriptor(ctor.prototype, prop)?.set &&
      defineVirtual(ctor.prototype, col, prop);
  };
}

/** Define propiedad virtual con getter/setter para manejo de mutaciones */
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
