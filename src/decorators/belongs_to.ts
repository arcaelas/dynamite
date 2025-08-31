import { ensureConfig } from "../core/wrapper";

export default function BelongsTo(
  targetModel: () => any,
  localKey: string,
  foreignKey?: string
): PropertyDecorator {
  return (target: any, prop: string | symbol) => {
    const entry = ensureConfig(target.constructor, target.constructor.name);
    entry.relations.set(prop, {
      type: "belongsTo",
      targetModel,
      foreignKey: foreignKey || "id",
      localKey,
    });

    // Crear getter dinámico para la relación
    Object.defineProperty(target, prop, {
      get() {
        return this[`_${prop.toString()}`] || null;
      },
      enumerable: true,
      configurable: true,
    });
  };
}
