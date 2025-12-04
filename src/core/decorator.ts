/**
 * @file decorator.ts
 * @descripcion Sistema de factory para decoradores y gestión de metadatos
 * @autor Miguel Alejandro
 */

import type { Column, RelationMetadata, WrapperEntry } from "@type/index";

/** Símbolo para almacenamiento interno de valores en instancias */
export const STORE: unique symbol = Symbol("dynamite:values");

/** Map global de metadatos por constructor */
const wrapper = new Map<Function, WrapperEntry>();

/** Convierte PascalCase a snake_case plural */
export const toSnakePlural = (input: string): string => {
  const snake = input
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
  return snake.endsWith("s") ? snake : snake + "s";
};

/** Obtener o crear entrada wrapper para constructor */
export const ensureConfig = (
  ctor: Function,
  table_name: string
): WrapperEntry => {
  const existing = wrapper.get(ctor);
  if (existing) return existing;

  const entry: WrapperEntry = {
    name: table_name,
    columns: new Map(),
    relations: new Map(),
  };
  wrapper.set(ctor, entry);
  return entry;
};

/** Obtener metadatos requeridos (throws si no existen) */
export const mustMeta = (ctor: Function): WrapperEntry => {
  const meta = wrapper.get(ctor);
  if (!meta) {
    throw new Error(
      `Metadatos no encontrados para ${ctor.name}. ¿Usaste decoradores @Index, @PrimaryKey, etc.?`
    );
  }
  return meta;
};

/** Tipo de función setter: recibe valor actual y nuevo, retorna valor procesado */
export type SetterFn = (current: any, next: any) => any;

/** Tipo de función getter: recibe valor actual, retorna valor procesado */
export type GetterFn = (current: any) => any;

/** Tipo de función validadora */
export type ValidateFn = (value: any) => boolean | string;

/** Map de builders por propiedad para encadenar setters entre decoradores */
const property_builders = new Map<string, ColumnBuilder>();

/** Genera key única para propiedad de una clase */
const builderKey = (ctor: Function, prop: string | symbol): string =>
  `${ctor.name}::${String(prop)}`;

/**
 * @description Builder de columna con API fluida para configurar propiedades y getter/setter.
 * Soporta encadenamiento: múltiples decoradores pueden agregar lógica al mismo setter.
 */
export class ColumnBuilder {
  private _setters: SetterFn[] = [];
  private _getters: GetterFn[] = [];

  /** Metadatos de la columna */
  readonly col: Column;

  /** Array de validadores lazy (ejecutados en save()) */
  readonly lazy_validators: ValidateFn[] = [];

  constructor(col: Column) {
    this.col = col;
  }

  /**
   * @description Agrega una función setter al pipeline. Se ejecutan en orden FIFO.
   * @param fn Función que recibe (current, next) y retorna valor procesado
   */
  set(fn: SetterFn): this {
    this._setters.push(fn);
    return this;
  }

  /**
   * @description Agrega una función getter al pipeline. Se ejecutan en orden FIFO.
   * @param fn Función que recibe (current) y retorna valor procesado
   */
  get(fn: GetterFn): this {
    this._getters.push(fn);
    return this;
  }

  /** Ejecutar todos los setters en orden */
  runSetters(current: any, next: any): any {
    // Default: filtrar null/undefined si no hay setters personalizados
    if (this._setters.length === 0) {
      return next === null || next === undefined ? undefined : next;
    }
    let val = next;
    for (const fn of this._setters) {
      val = fn(current, val);
    }
    return val;
  }

  /** Ejecutar todos los getters en orden */
  runGetters(current: any): any {
    let val = current;
    for (const fn of this._getters) {
      val = fn(val);
    }
    return val;
  }

  // Proxies directos a propiedades de Column para acceso rápido
  get name(): string {
    return this.col.name;
  }
  set name(value: string) {
    this.col.name = value;
  }

  get default(): any {
    return this.col.default;
  }
  set default(value: any) {
    this.col.default = value;
  }

  get index(): true | undefined {
    return this.col.index;
  }
  set index(value: true | undefined) {
    this.col.index = value;
  }

  get indexSort(): true | undefined {
    return this.col.indexSort;
  }
  set indexSort(value: true | undefined) {
    this.col.indexSort = value;
  }

  get primaryKey(): boolean | undefined {
    return this.col.primaryKey;
  }
  set primaryKey(value: boolean | undefined) {
    this.col.primaryKey = value;
  }

  get nullable(): boolean | undefined {
    return this.col.nullable;
  }
  set nullable(value: boolean | undefined) {
    this.col.nullable = value;
  }

  get unique(): true | undefined {
    return this.col.unique;
  }
  set unique(value: true | undefined) {
    this.col.unique = value;
  }

  get createdAt(): boolean | undefined {
    return this.col.createdAt;
  }
  set createdAt(value: boolean | undefined) {
    this.col.createdAt = value;
  }

  get updatedAt(): boolean | undefined {
    return this.col.updatedAt;
  }
  set updatedAt(value: boolean | undefined) {
    this.col.updatedAt = value;
  }

  get softDelete(): boolean | undefined {
    return this.col.softDelete;
  }
  set softDelete(value: boolean | undefined) {
    this.col.softDelete = value;
  }

  get serialize(): Column["serialize"] {
    return this.col.serialize;
  }
  set serialize(value: Column["serialize"]) {
    this.col.serialize = value;
  }
}

/** Tipo del handler del decorador */
export type DecoratorHandler<Args extends any[] = []> = (
  col: ColumnBuilder,
  args: Args,
  entry: WrapperEntry
) => void;

/**
 * @description Factory para crear decoradores de propiedad
 * @param handler Función que configura el ColumnBuilder
 * @returns Función decoradora de propiedad
 * @example
 * ```typescript
 * export const DeleteAt = decorator((col) => {
 *   col.softDelete = true;
 *   col.nullable = true;
 * });
 *
 * export const Default = decorator<[value: any]>((col, [value]) => {
 *   const factory = typeof value === 'function' ? value : () => value;
 *   col.set((current, next) => next ?? factory());
 * });
 * ```
 */
export function decorator<Args extends any[] = []>(
  handler: DecoratorHandler<Args>
): (...args: Args) => PropertyDecorator {
  return (...args: Args): PropertyDecorator => {
    return (target: object, prop: string | symbol): void => {
      const proto = target as any;
      const ctor = proto.constructor as Function;
      const table_name = toSnakePlural(ctor.name);

      // Obtener o crear metadatos
      const entry = ensureConfig(ctor, table_name);

      // Obtener o crear columna
      let col = entry.columns.get(prop);
      if (!col) {
        col = { name: String(prop), mutate: [], validate: [] };
        entry.columns.set(prop, col);
      }

      // Obtener o crear builder compartido para esta propiedad
      const key = builderKey(ctor, prop);
      let builder = property_builders.get(key);
      if (!builder) {
        builder = new ColumnBuilder(col);
        property_builders.set(key, builder);
      }

      // Ejecutar handler del decorador
      handler(builder, args, entry);

      // Almacenar lazy validators en la columna
      if (builder.lazy_validators.length > 0) {
        col.validate = col.validate || [];
        for (const fn of builder.lazy_validators) {
          if (!col.validate.some((v) => typeof v === "object" && v.fn === fn)) {
            col.validate.push({ fn, lazy: true });
          }
        }
      }

      // Definir virtual property con getter/setter (usa builder compartido)
      defineVirtualProperty(proto, prop, builder);
    };
  };
}

/**
 * @description Define getter/setter virtual en el prototipo.
 * Re-define cada vez para actualizar con nuevos setters/getters agregados por decoradores.
 */
function defineVirtualProperty(
  proto: any,
  prop: string | symbol,
  builder: ColumnBuilder
): void {
  Object.defineProperty(proto, prop, {
    get() {
      const store = this[STORE] ?? {};
      return builder.runGetters(store[prop as string]);
    },
    set(value: unknown) {
      const store = (this[STORE] ??= {});
      const current = store[prop as string];
      store[prop as string] = builder.runSetters(current, value);
    },
    enumerable: true,
    configurable: true,
  });
}

/**
 * @description Factory para crear decoradores de relación
 * @param type Tipo de relación: "hasMany" | "belongsTo"
 *
 * Para HasMany: (targetModel, foreignKey, localKey?)
 *   - foreignKey: FK en el modelo HIJO que referencia a ESTE modelo
 *   - localKey: PK en ESTE modelo (default: "id")
 *
 * Para BelongsTo: (targetModel, localKey, foreignKey?)
 *   - localKey: FK en ESTE modelo que referencia al padre
 *   - foreignKey: PK en el modelo PADRE (default: "id")
 */
export function relationDecorator(
  type: "hasMany" | "belongsTo"
): (
  targetModel: () => any,
  keyArg: string,
  secondaryKey?: string
) => PropertyDecorator {
  return (
    targetModel: () => any,
    keyArg: string,
    secondaryKey?: string
  ): PropertyDecorator => {
    return (target: object, prop: string | symbol): void => {
      const proto = target as any;
      const ctor = proto.constructor as Function;
      const table_name = toSnakePlural(ctor.name);
      const entry = ensureConfig(ctor, table_name);

      // Mapear argumentos según el tipo de relación
      const metadata: RelationMetadata =
        type === "hasMany"
          ? {
              type,
              targetModel,
              foreignKey: keyArg, // FK en el modelo hijo
              localKey: secondaryKey || "id", // PK en este modelo
            }
          : {
              type,
              targetModel,
              localKey: keyArg, // FK en este modelo
              foreignKey: secondaryKey || "id", // PK en el modelo padre
            };

      entry.relations.set(prop, metadata);

      // Definir getter que retorna valor cacheado o default
      Object.defineProperty(proto, prop, {
        get() {
          const cached = this[`_${String(prop)}`];
          return cached ?? (type === "hasMany" ? [] : null);
        },
        enumerable: true,
        configurable: true,
      });
    };
  };
}

export default wrapper;
