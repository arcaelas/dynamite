import { ensureColumn, ensureConfig } from "../core/wrapper";

/**
 * Decorador que marca una propiedad para que se actualice automáticamente con la fecha/hora actual
 * cada vez que se guarde el modelo.
 *
 * @example
 * class User extends Table<User> {
 *   @PrimaryKey() id: string;
 *   name: string;
 *   @UpdatedAt() updated_at: string;
 * }
 */
export default function UpdatedAt() {
  return function (target: any, propertyKey: string | symbol) {
    const ctor = target.constructor;
    const entry = ensureConfig(ctor, ctor.name);
    const column = ensureColumn(entry, propertyKey, propertyKey as string);

    // Marcamos la columna como updatedAt para que se actualice automáticamente al guardar
    (column as any).updatedAt = true;

    // No establecemos un valor por defecto aquí, se establecerá en el método save()
  };
}
