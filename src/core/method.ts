/**
 * @file method.ts
 * @descripcion Sistema de métodos extensibles para Table
 * @autor Miguel Alejandro
 */

/** Handler para métodos estáticos: (TableClass, args) => result */
export type StaticMethodHandler<R = any> = (
  table: any,
  args: any[]
) => R | Promise<R>;

/** Handler para métodos de instancia: (TableClass, instance, args) => result */
export type InstanceMethodHandler<R = any> = (
  table: any,
  instance: any,
  args: any[]
) => R | Promise<R>;

/** Registro de métodos estáticos */
const static_methods = new Map<string, StaticMethodHandler>();

/** Registro de métodos de instancia */
const instance_methods = new Map<string, InstanceMethodHandler>();

/** Referencia a la clase Table para definir propiedades */
let table_class: any = null;

/**
 * @description Configura la clase Table para el sistema de métodos
 * @param TableClass Clase Table
 */
export function setTableClass(TableClass: any): void {
  table_class = TableClass;
}

/**
 * @description Registra un método estático en Table y lo define en la clase
 * @param name Nombre del método
 * @param handler Función que implementa el método
 * @example
 * ```typescript
 * registerStaticMethod('customFind', function(t, args) {
 *   const meta = mustMeta(t);
 *   return instances;
 * });
 * // Uso: User.customFind(...)
 * ```
 */
export function registerStaticMethod<R = any>(
  name: string,
  handler: StaticMethodHandler<R>
): void {
  static_methods.set(name, handler);

  // Definir método en la clase Table si está configurada
  if (table_class && !Object.prototype.hasOwnProperty.call(table_class, name)) {
    Object.defineProperty(table_class, name, {
      value: function (this: any, ...args: any[]) {
        return callStaticMethod(name, this, args);
      },
      writable: true,
      configurable: true,
    });
  }
}

/**
 * @description Registra un método de instancia en Table y lo define en el prototype
 * @param name Nombre del método
 * @param handler Función que implementa el método
 * @example
 * ```typescript
 * registerInstanceMethod('duplicate', function(t, m, args) {
 *   return t.create({ ...m.toJSON(), id: undefined });
 * });
 * // Uso: user.duplicate()
 * ```
 */
export function registerInstanceMethod<R = any>(
  name: string,
  handler: InstanceMethodHandler<R>
): void {
  instance_methods.set(name, handler);

  // Definir método en el prototype de Table si está configurado
  if (
    table_class &&
    !Object.prototype.hasOwnProperty.call(table_class.prototype, name)
  ) {
    Object.defineProperty(table_class.prototype, name, {
      value: function (this: any, ...args: any[]) {
        return callInstanceMethod(name, this.constructor, this, args);
      },
      writable: true,
      configurable: true,
    });
  }
}

/**
 * @description Obtiene un método estático registrado
 */
export function getStaticMethod(name: string): StaticMethodHandler | undefined {
  return static_methods.get(name);
}

/**
 * @description Obtiene un método de instancia registrado
 */
export function getInstanceMethod(
  name: string
): InstanceMethodHandler | undefined {
  return instance_methods.get(name);
}

/**
 * @description Ejecuta un método estático registrado
 */
export function callStaticMethod<R = any>(
  name: string,
  table: any,
  args: any[]
): R | Promise<R> {
  const handler = static_methods.get(name);
  if (!handler) {
    throw new Error(`Método estático '${name}' no registrado`);
  }
  return handler(table, args);
}

/**
 * @description Ejecuta un método de instancia registrado
 */
export function callInstanceMethod<R = any>(
  name: string,
  table: any,
  instance: any,
  args: any[]
): R | Promise<R> {
  const handler = instance_methods.get(name);
  if (!handler) {
    throw new Error(`Método de instancia '${name}' no registrado`);
  }
  return handler(table, instance, args);
}

/**
 * @description Verifica si un método estático está registrado
 */
export function hasStaticMethod(name: string): boolean {
  return static_methods.has(name);
}

/**
 * @description Verifica si un método de instancia está registrado
 */
export function hasInstanceMethod(name: string): boolean {
  return instance_methods.has(name);
}

/**
 * @description Lista todos los métodos estáticos registrados
 */
export function listStaticMethods(): string[] {
  return Array.from(static_methods.keys());
}

/**
 * @description Lista todos los métodos de instancia registrados
 */
export function listInstanceMethods(): string[] {
  return Array.from(instance_methods.keys());
}
