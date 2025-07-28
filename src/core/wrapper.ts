declare const NonAttributeBrand: unique symbol;
export type NonAttribute<T> = T & { [NonAttributeBrand]?: true };
declare const CreationOptionalBrand: unique symbol;
export type CreationOptional<T> = T & { [CreationOptionalBrand]?: true };

type IsBranded<
  T,
  Brand extends symbol
> = keyof NonNullable<T> extends keyof Omit<NonNullable<T>, Brand>
  ? false
  : true;
type RemoveNullish<T> = Omit<T, keyof KeepNullish<T>>;
type RemoveFunction<T> = Omit<T, keyof KeepFunction<T>>;
type RemoveBranded<T, Brand extends symbol> = Omit<
  T,
  keyof KeepBranded<T, Brand>
>;
type KeepNullish<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]: T[K];
};
type KeepFunction<T> = {
  [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K];
};
type KeepBranded<T, Brand extends symbol> = {
  [K in keyof T as IsBranded<T[K], Brand> extends true ? K : never]: T[K];
};

/** Type utility for inferring model attributes, excluding non-attributes and functions */
export type InferAttributes<T> = RemoveFunction<
  RemoveNullish<
    RemoveBranded<
      RemoveBranded<T, typeof CreationOptionalBrand>,
      typeof NonAttributeBrand
    >
  >
> &
  Partial<KeepBranded<T, typeof CreationOptionalBrand>>;

export type Mutate = (value: any) => Inmutable;
export type Default = Inmutable | (() => Inmutable);
export type Validate = (value: any) => true | string;
export type Inmutable = string | number | boolean | null | object;

export interface Column {
  name: string;
  default?: Default;
  mutate?: Mutate[];
  validate?: Validate[];
  index?: true;
  indexSort?: true;
  unique?: true;
}

export interface RelationMetadata {
  type: "hasMany" | "belongsTo";
  targetModel: () => any;
  foreignKey: string;
  localKey?: string;
}

export interface WrapperEntry {
  name: string;
  columns: Map<string | symbol, Column>;
  relations: Map<string | symbol, RelationMetadata>;
}

const wrapper = new Map<Function, WrapperEntry>();
export const STORE: unique symbol = Symbol("dynamite:values");
export default wrapper;

/** Get or create wrapper entry for a constructor */
export const ensureConfig = (
  ctor: Function,
  tableName: string
): WrapperEntry => {
  const existing = wrapper.get(ctor);
  if (existing) return existing;
  const entry = { name: tableName, columns: new Map(), relations: new Map() };
  wrapper.set(ctor, entry);
  return entry;
};

/** Get or create column configuration for a property */
export const ensureColumn = (
  entry: WrapperEntry,
  prop: string | symbol,
  columnName: string
): Column => {
  const existing = entry.columns.get(prop);
  if (existing) return existing;
  const col = { name: columnName, mutate: [], validate: [] };
  entry.columns.set(prop, col);
  return col;
};
