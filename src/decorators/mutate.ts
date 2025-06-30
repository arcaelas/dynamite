/*
 * Dinamite ORM — @Mutate
 * ----------------------
 * Registra funciones transformadoras para un campo y virtualiza
 * la propiedad si aún no existe.
 */

import type { Column, Mutate } from "../core/wrapper";
import { STORE, ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

export default function Mutate(fn: Mutate): PropertyDecorator {
  if (typeof fn !== "function") throw new TypeError("@Mutate requiere función");

  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));
    const col = ensureColumn(entry, prop, String(prop));

    col.mutate ??= [];
    col.mutate.push(fn);

    if (!Object.getOwnPropertyDescriptor(ctor.prototype, prop)?.set) {
      defineVirtual(ctor.prototype, col, prop);
    }
  };
}

/* ------------------------------------------------------------------ */
function defineVirtual(proto: any, col: Column, prop: string | symbol): void {
  Object.defineProperty(proto, prop, {
    get() {
      return (this[STORE] ?? {})[prop];
    },
    set(val: unknown) {
      const buf = (this[STORE] ??= {});

      if (val === undefined && col.default !== undefined) {
        val = typeof col.default === "function" ? col.default() : col.default;
      }
      if (col.mutate) for (const m of col.mutate) val = m(val);
      if (col.validate) {
        for (const v of col.validate) {
          const r = v(val);
          if (r !== true)
            throw new Error(typeof r === "string" ? r : "Validación fallida");
        }
      }
      buf[prop] = val;
    },
    enumerable: true,
    configurable: true,
  });
}
