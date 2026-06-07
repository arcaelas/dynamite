/**
 * @file hooks.ts
 * @description Lifecycle hook decorators: @BeforeCreate, @AfterCreate, @BeforeUpdate, @AfterUpdate, @BeforeDestroy, @AfterDestroy
 * @description Decoradores de hooks de ciclo de vida: @BeforeCreate, @AfterCreate, @BeforeUpdate, @AfterUpdate, @BeforeDestroy, @AfterDestroy
 */

import { getSchema } from "../core/decorator";
import type { HookType } from "../core/decorator";

/**
 * @description Builds a method decorator that registers the method as a lifecycle hook of the given type.
 * @description Construye un decorador de método que registra el método como hook de ciclo de vida del tipo dado.
 * @param type Lifecycle hook type / Tipo de hook de ciclo de vida
 */
function hook(type: HookType) {
  return () => (target: any, property_key: string | symbol): void => {
    getSchema(target.constructor).hooks[type].push(String(property_key));
  };
}

/**
 * @description Runs before the record is created (opt-in via { hook: true }). `this` is the instance and may be mutated.
 * @description Se ejecuta antes de crear el registro (opt-in con { hook: true }). `this` es la instancia y puede mutarse.
 */
export const BeforeCreate = hook('beforeCreate');

/**
 * @description Runs after the record is created (opt-in via { hook: true }). `this` is the persisted instance.
 * @description Se ejecuta después de crear el registro (opt-in con { hook: true }). `this` es la instancia persistida.
 */
export const AfterCreate = hook('afterCreate');

/**
 * @description Runs before the record is updated (opt-in via { hook: true }). Receives the changes delta as argument.
 * @description Se ejecuta antes de actualizar el registro (opt-in con { hook: true }). Recibe el delta de cambios como argumento.
 */
export const BeforeUpdate = hook('beforeUpdate');

/**
 * @description Runs after the record is updated (opt-in via { hook: true }). Receives the changes delta as argument.
 * @description Se ejecuta después de actualizar el registro (opt-in con { hook: true }). Recibe el delta de cambios como argumento.
 */
export const AfterUpdate = hook('afterUpdate');

/**
 * @description Runs before the record is destroyed (opt-in via { hook: true }). `this` is the instance to remove.
 * @description Se ejecuta antes de eliminar el registro (opt-in con { hook: true }). `this` es la instancia a eliminar.
 */
export const BeforeDestroy = hook('beforeDestroy');

/**
 * @description Runs after the record is destroyed (opt-in via { hook: true }). `this` is the removed instance.
 * @description Se ejecuta después de eliminar el registro (opt-in con { hook: true }). `this` es la instancia eliminada.
 */
export const AfterDestroy = hook('afterDestroy');
