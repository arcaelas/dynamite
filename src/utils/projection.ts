/**
 * @file projection.ts
 * @description Selective field loading and projection optimization
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

/** Build DynamoDB ProjectionExpression */
export const buildProjection = (
  attributes?: string[],
  meta?: any
): string | undefined => {
  if (!attributes?.length || !meta) return undefined;

  // Validate attributes exist in model
  const validAttributes = attributes.filter(
    (attr) => meta.columns.has(attr) || meta.relations.has(attr)
  );

  return validAttributes.length ? validAttributes.join(", ") : undefined;
};

/** Optimize attributes loading for relations */
export const optimizeRelationAttributes = (
  include: any,
  baseAttributes?: string[]
): string[] => {
  const attributes = new Set(baseAttributes || []);

  // Add foreign keys needed for relations
  Object.entries(include || {}).forEach(
    ([relationKey, options]: [string, any]) => {
      attributes.add(relationKey);

      // Add foreign key fields
      if (options?.foreignKey) attributes.add(options.foreignKey);
      if (options?.localKey) attributes.add(options.localKey);
    }
  );

  return Array.from(attributes);
};

/** Smart attribute selection for common patterns */
export const getSmartAttributes = (
  Model: any,
  scenario: "list" | "detail" | "minimal"
): string[] => {
  const meta = Model.getMeta();
  const columns = Array.from(meta.columns.keys()) as string[];

  switch (scenario) {
    case "minimal":
      return columns.filter(
        (col: string) =>
          meta.columns.get(col)?.isKey ||
          ["id", "name", "title", "email"].includes(col)
      );

    case "list":
      return columns.filter(
        (col: string) =>
          !["description", "content", "body", "metadata"].includes(col)
      );

    case "detail":
    default:
      return columns;
  }
};
