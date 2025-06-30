/*
 * Dinamite ORM — @Default
 * -----------------------
 * Registra un valor por defecto y crea (si falta) el
 * getter/setter virtual de la propiedad.
 */

import { Column, STORE, ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";

export default function Default(factory: () => unknown): PropertyDecorator {
  if (typeof factory !== "function") {
    throw new TypeError("@Default requiere una función factory");
  }

  return (target: object, prop: string | symbol): void => {
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));
    const column = ensureColumn(entry, prop, String(prop));

    if (column.default)
      throw new Error(`@Default duplicado en '${String(prop)}'`);
    column.default = factory;

    if (!Object.getOwnPropertyDescriptor(ctor.prototype, prop)?.set) {
      defineVirtual(ctor.prototype, column, prop);
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
