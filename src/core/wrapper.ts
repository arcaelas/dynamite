declare const NonAttributeBrand: unique symbol;
// prettier-ignore
export type NonAttribute<T> = T  & { [NonAttributeBrand]?: true };
declare const CreationOptionalBrand: unique symbol;
// prettier-ignore
export type CreationOptional<T> = T & { [CreationOptionalBrand]?: true };
// prettier-ignore
type IsBranded< T, Brand extends symbol > = keyof NonNullable<T> extends keyof Omit<NonNullable<T>, Brand> ? false : true;
type RemoveNullish<T> = Omit<T, keyof KeepNullish<T>>;
type RemoveFunction<T> = Omit<T, keyof KeepFunction<T>>;
// prettier-ignore
type RemoveBranded<T, Brand extends symbol> = Omit<T, keyof KeepBranded<T, Brand>>;
// prettier-ignore
type KeepNullish<T> = { [K in keyof T as undefined extends T[K] ? K : never]: T[K]; };
// prettier-ignore
type KeepFunction<T> = { [K in keyof T as T[K] extends (...args: any[]) => any ? K : never]: T[K]; };
// prettier-ignore
type KeepBranded<T, Brand extends symbol> = { [K in keyof T as IsBranded<T[K], Brand> extends true ? K : never]: T[K]; };
// prettier-ignore
export type InferAttributes<T> = RemoveFunction<
  RemoveNullish<
    RemoveBranded<
      RemoveBranded<T,
        typeof CreationOptionalBrand
      >, typeof NonAttributeBrand
    >
  >
> & Partial<KeepBranded<T, typeof CreationOptionalBrand>>;

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
export interface WrapperEntry {
  name: string;
  columns: Map<string | symbol, Column>;
}

const wrapper = new Map<Function, WrapperEntry>();
export const STORE: unique symbol = Symbol("dynamite:values");
export default wrapper;

export function ensureConfig(ctor: Function, tableName: string): WrapperEntry {
  let entry = wrapper.get(ctor);
  if (!entry) {
    entry = { name: tableName, columns: new Map() };
    wrapper.set(ctor, entry);
  }
  return entry;
}

// prettier-ignore
export function ensureColumn(entry: WrapperEntry, prop: string | symbol, columnName: string): Column {
  let col = entry.columns.get(prop);
  if (!col) {
    col = { name: columnName, mutate: [], validate: [] };
    entry.columns.set(prop, col);
  }
  return col;
}
