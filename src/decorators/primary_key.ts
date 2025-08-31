import { ensureColumn, ensureConfig } from "../core/wrapper";
import { toSnakePlural } from "../utils/naming";
import Index from "./index";
import IndexSort from "./index_sort";

/**
 * Decorador para marcar una propiedad como clave primaria.
 * Aplica automáticamente @Index y @IndexSort y marca el campo como primaryKey en los metadatos.
 * @param name - Nombre opcional para el índice (no utilizado actualmente, mantenido por compatibilidad)
 */
export default function PrimaryKey(name = "primary"): PropertyDecorator {
  return (target: object, prop: string | symbol): void => {
    // Aplicar decoradores de índice
    Index()(target, prop);
    IndexSort()(target, prop);

    // Marcar explícitamente como clave primaria en los metadatos
    const ctor = (target as any).constructor;
    const entry = ensureConfig(ctor, toSnakePlural(ctor.name));
    const column = ensureColumn(entry, prop, String(prop));

    // Establecer metadatos adicionales para clave primaria
    column.primaryKey = true;
    column.nullable = false; // Las claves primarias no pueden ser nulas
  };
}
