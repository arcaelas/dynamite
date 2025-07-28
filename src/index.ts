// Core classes
export { Dynamite } from "./core/client";
export { default as Table } from "./core/table";

// Legacy connection removed - use Dynamite class instead

// Decorators
export { default as CreatedAt } from "./decorators/created_at";
export { default as Default } from "./decorators/default";
export { default as Index } from "./decorators/index";
export { default as IndexSort } from "./decorators/index_sort";
export { default as Mutate } from "./decorators/mutate";
export { default as Name } from "./decorators/name";
export { default as NotNull } from "./decorators/not_null";
export { default as PrimaryKey } from "./decorators/primary_key";
export { default as UpdatedAt } from "./decorators/updated_at";
export { default as Validate } from "./decorators/validate";

// Relations
export { belongsTo, hasMany } from "./utils/relations";
