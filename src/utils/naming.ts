/* src/utils/naming.ts
 * -------------------------------------------------
 * Convierte Camel/Pascal → snake_case y pluraliza.
 * Se importa allí donde se necesite.
 */
import pluralize from "pluralize";

export function toSnakePlural(input: string): string {
  // camelCase / PascalCase  →  snake_case
  const snake = input.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  return pluralize(snake); // “user” → “users”, “status” → “statuses”…
}
