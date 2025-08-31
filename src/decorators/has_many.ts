import { ensureConfig } from "../core/wrapper";

export default function HasMany(
  targetModel: () => any,
  foreignKey: string,
  localKey?: string
): PropertyDecorator {
  return (target: any, prop: string | symbol) => {
    const entry = ensureConfig(target.constructor, target.constructor.name);
    entry.relations.set(prop, {
      type: "hasMany",
      targetModel,
      foreignKey,
      localKey: localKey || "id",
    });

    // Crear getter dinámico para la relación
    Object.defineProperty(target, prop, {
      get() {
        return this[`_${prop.toString()}`] || [];
      },
      enumerable: true,
      configurable: true,
    });
  };
}
