# Table API Reference

## Overview

`Table` is the base class of every model. It provides the typed CRUD API, the query system, relationship loading and the lifecycle of an instance.

**What it gives you:**

- Strict TypeScript typing derived from the class itself
- CRUD as static methods and as instance methods
- A query system that picks `GetItem`, `BatchGetItem`, `Query` or `Scan` from the shape of the filter
- `HasMany`, `HasOne`, `BelongsTo` and `ManyToMany` relations with batch loading
- Automatic timestamps and soft delete
- Pagination by cursor, ordering, projection and nested includes

## Import

```typescript
import { Table } from '@arcaelas/dynamite';
```

## Model Definition

```typescript
import {
  Table, Name, PrimaryKey, NotNull, Default, Index,
  CreatedAt, UpdatedAt, DeleteAt, CreationOptional
} from '@arcaelas/dynamite';

@Name("users")
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Index()
  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  @Default(() => 25)
  declare age: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at: CreationOptional<string>;
}
```

---

## Constructor

### `constructor(data: Partial<InferAttributes<T>>)`

Builds an instance in memory. Nothing is written to DynamoDB.

**Behaviour:**

- Runs the write pipeline of **every** column, not only the ones present in `data`. That is what fills in `@Default`, `@PrimaryKey` and `@CreatedAt` at construction time, and what makes `@NotNull` reject a missing field right there
- Requires a configured client: it throws if `connect()` has not been called
- The instance is not persisted until `save()` or `create()` runs

```typescript
const user = new User({ email: "john@example.com", name: "John Doe" });

user.id;         // "01JBQ8..." — already generated
user.created_at; // already generated

await user.save(); // now it exists in DynamoDB
```

---

## Mutation Options

Every mutation takes the same options object as its last argument:

```typescript
interface MutationOptions {
  hook?: boolean;          // run the lifecycle hooks; off by default
  tx?: TransactionContext; // run inside an atomic transaction
}
```

- Hooks are opt-in per call: without `{ hook: true }` no hook runs.
- Inside a transaction nothing is written until the callback returns. The `after*` hooks and `__isPersisted` only fire after the commit.
- `increment()` and `decrement()` accept `{ tx }` but never trigger hooks.

---

## Instance Methods

### `save(options?: MutationOptions): Promise<boolean>`

Writes the whole item.

**Behaviour:**

- On an instance that has never been persisted it delegates to `create()`, which refuses to overwrite an existing primary key
- On a persisted instance it sends a `PutItem` with every column, so any field you mutated by hand is written
- Whether an instance counts as persisted is tracked internally, not inferred from the id: a new instance already has its id filled in by `@PrimaryKey`

**Returns:** `true`

```typescript
const user = new User({ email: "jane@example.com", name: "Jane Smith" });
await user.save(); // insert

user.name = "Jane Doe";
await user.save(); // full rewrite of the item
```

---

### `update(patch: Partial<InferAttributes<T>>, options?: MutationOptions): Promise<boolean>`

Updates only the fields you pass.

**Behaviour:**

- Relationship fields in `patch` are ignored instead of throwing
- The `@UpdatedAt` columns are refreshed even when they are not part of `patch`
- Without hooks and outside a transaction it is a single `UpdateItem` that writes only the touched fields, conditioned on the record still existing. The record does not exist any more, it returns `false` and writes nothing
- With `{ hook: true }` it applies the changes, runs `beforeUpdate`, writes the item and runs `afterUpdate`. Both hooks receive the changes delta

**Returns:** `true` when the record was updated

```typescript
await user.update({ name: "Jane Doe" });
await user.update({ name: "Jane Doe" }, { hook: true });
```

---

### `destroy(options?: MutationOptions): Promise<null>`

Deletes the record, softly when the model allows it.

**Behaviour:**

- With a `@DeleteAt` column it writes the current timestamp there and saves: the record stays in the table and disappears from `where()`
- Without `@DeleteAt` it removes the record
- Throws `Cannot destroy record without ID` when the instance has no primary key

```typescript
await post.destroy();               // soft delete
await post.destroy({ hook: true }); // beforeDestroy + afterDestroy
```

---

### `forceDestroy(options?: MutationOptions): Promise<null>`

Removes the record with a `DeleteItem`, ignoring `@DeleteAt`.

```typescript
await post.forceDestroy();
```

---

### `increment(field, amount = 1): Promise<void>` / `decrement(field, amount = 1): Promise<void>`

Adds to or subtracts from a numeric column atomically on the server, without reading the previous value, and mirrors the change in memory.

- `field` is restricted by the type system to the numeric columns of the model
- Throws `Cannot increment without primary key` when the instance has no id

```typescript
await user.increment("credits", 10);
await user.decrement("credits");
```

---

### `attach<R>(Model, related_id, pivot_data?): Promise<void>`

Adds a row to the pivot table of a `@ManyToMany` relation.

- The instance has to be persisted: it throws otherwise
- It is idempotent, an existing pair is left alone
- `pivot_data` adds extra columns to the pivot row
- The lookup goes through the pivot's `<foreign_key>_index` GSI, never a Scan

```typescript
await user.attach(Role, "role-123");
await user.attach(Role, "role-123", { granted_by: "admin" });
```

---

### `detach<R>(Model, related_id): Promise<void>`

Removes the pivot row of that pair. Does nothing when the relation, the pivot row or the local key is missing.

```typescript
await user.detach(Role, "role-123");
```

---

### `sync<R>(Model, related_ids): Promise<void>`

Leaves the relation holding exactly `related_ids`: it removes what is not on the list and adds what is missing, in batches of 25.

- Throws when the related model has no schema, when there is no `@ManyToMany` relation between the two models, or when the local key is undefined

```typescript
await user.sync(Role, ["role-1", "role-2"]);
```

---

### `toJSON(): Record<string, unknown>`

Plain object with the columns of the model. Skips `null` and `undefined`, and serializes loaded relations recursively.

### `toString(): string`

`JSON.stringify` of the instance.

---

## Static Methods

### `create<M>(data, options?: MutationOptions): Promise<M>`

Creates one record.

- Writes with `attribute_not_exists` on the primary key: it never overwrites, and throws `Record with <key> '<value>' already exists in <table>` when the id is taken
- Inside a transaction the instance is only marked as persisted after the commit

```typescript
const user = await User.create({ name: "Juan", email: "juan@example.com" });
await User.create({ name: "Juan" }, { hook: true });
await dynamite.tx(async (tx) => { await User.create({ name: "Juan" }, { tx }); });
```

---

### `createMany<M>(rows, options?: MutationOptions): Promise<M[]>`

Creates several records with `BatchWriteItem`, 25 per request, retrying whatever DynamoDB leaves unprocessed.

- It cannot check for duplicate primary keys, which `BatchWriteItem` does not support: an existing record is overwritten
- Returns the instances already marked as persisted

```typescript
const logs = await Log.createMany([
  { level: "info", message: "boot" },
  { level: "warn", message: "cache miss" }
]);
```

---

### `update<M>(changes, filters, options?: MutationOptions): Promise<number>`

Updates every record matching `filters` and returns how many were affected.

- With a plain primary-key filter it is a single `UpdateItem` with the touched fields, no read involved, provided no `@Set` or `@Validate` of those fields declares the `current` argument. When one does, the record is read first so it can be passed in
- With any other filter it resolves the query, applies the changes and writes in batches of 25
- The `@UpdatedAt` columns are refreshed on every affected record
- With `{ hook: true }`, `beforeUpdate` and `afterUpdate` run once per affected record

```typescript
const affected = await User.update({ status: "suspended" }, { status: "inactive" });
await User.update({ status: "active" }, { id: "user-1" });
```

---

### `delete<M>(filters, options?: MutationOptions): Promise<number>`

Deletes every record matching `filters` and returns how many.

- Always a hard delete, with or without `@DeleteAt`: soft delete is a decision of the instance and lives in `destroy()`
- A plain primary-key filter on a model without `@DeleteAt` and without destroy hooks is a single `DeleteItem`
- Otherwise it resolves the query and deletes in batches of 25

```typescript
const deleted = await User.delete({ status: "suspended" });
await User.delete({ id: "user-1" }, { hook: true });
```

---

### `deleteMany<M>(ids, options?: MutationOptions): Promise<number>`

Deletes by primary key with `BatchWriteItem`, without reading anything first. Always a hard delete, and it runs no hooks.

```typescript
const removed = await Log.deleteMany(["01JBQ8...", "01JBQ9..."]);
```

---

### `increment<M>(field, amount, filters, options?): Promise<number>` / `decrement<M>(...)`

Atomic addition on the server.

- A primary-key filter updates that single record without reading it
- Any other filter resolves the query first and then updates every match in parallel
- Returns how many records were touched

```typescript
await User.increment("credits", 10, { id: "user-1" });
await User.decrement("stock", 1, { sku: "ABC" });
```

---

### `first<M>(filters, options?): Promise<M | undefined>`

The first record matching the filters, or `undefined`. It is `where()` with `limit: 1`, so on an indexed field it is a single request.

```typescript
const user = await User.first({ email: "juan@example.com" });
const newest = await User.first({ role: "admin" }, { order: { created_at: "DESC" } });
```

---

### `last<M>(filters?, options?): Promise<M | undefined>`

The last record, ordered descending by the `@CreatedAt` column or, when there is none, by the primary key.

Without a sort key on the table the ordering happens in memory, which means reading everything that matches the filter to keep one record. On a large table use `first(filters, { order: { created_at: "DESC" } })` narrowed by an `@Index`.

```typescript
const last_user = await User.last();
```

---

## `where()` — Queries

### Overloads

```typescript
User.where(filters, options?)
User.where(field, value, options?)
User.where(field, operator, value, options?)
```

```typescript
await User.where({ status: "active" });
await User.where("name", "Juan");
await User.where("age", ">=", 18);
await User.where({ age: { $gte: 18, $lte: 65 } });
```

### Operators

| Operator | Aliases | Meaning |
|----------|---------|---------|
| `=` | `$eq` | Equal. With `null`, "the attribute does not exist" |
| `<>`, `!=` | `$ne` | Different. With `null`, "the attribute does exist" |
| `<` | `$lt` | Less than |
| `<=` | `$lte` | Less than or equal |
| `>` | `$gt` | Greater than |
| `>=` | `$gte` | Greater than or equal |
| `in` | `$in` | Contained in the array |
| `include` | `$include`, `contains`, `$contains` | Contains the substring or element |

An unknown column throws `Unknown column '<field>' in <table>`. An empty array on `in` throws `Operator 'in' requires a non-empty array.`

### Options

```typescript
const users = await User.where({ status: "active" }, {
  order: { created_at: "DESC" },  // by field; "ASC"/"DESC" alone sorts by @CreatedAt
  limit: 10,
  skip: 20,                       // alias: offset
  cursor: previous.cursor,        // next page; ignores skip
  attributes: ["id", "name"],     // projection
  deleted: true,                  // include the soft-deleted ones
  include: {
    profile: true,
    orders: { where: { status: "completed" }, limit: 5 }
  }
});
```

- `limit: 0` returns an empty array without touching the network.
- `order` on its own sorts by the `@CreatedAt` column, or by the primary key when there is none. To sort by a date, name it: `{ created_at: "DESC" }`.
- `attributes` builds instances holding only those columns.
- `deleted` replaces the old `_includeTrashed`, which still works as an alias.

### Result and pagination

`where()` returns the array of instances with a non-enumerable `cursor` property. It carries a value while there are more pages.

```typescript
let page = await User.where({}, { limit: 50 });
while (page.cursor) {
  page = await User.where({}, { limit: 50, cursor: page.cursor });
}
```

`skip` reads and discards everything before it on every page; a cursor reads only the page you asked for.

---

## Cost and Performance

| Filter | Command | Requests |
|--------|---------|----------|
| `=` on the primary key | `GetItem` | 1 |
| `in` on the primary key | `BatchGetItem` | 1 per 100 keys |
| `=` or `in` on an `@Index` column | `Query` on `<field>_index` | 1 per distinct value |
| Anything else | `Scan` | the whole table, filtered server-side |

- Extra filters on top of a primary-key read are evaluated over the item already read: the query stays a single request.
- A `limit` stops the read as soon as it has enough items, and travels as `Limit` when nothing is left to filter server-side.
- A read with no `limit` that ends in a `Scan` is split into four parallel segments: same read units, a fraction of the latency. Without `order` the resulting order is arbitrary, as it already was.
- When the GSI of an `@Index` does not exist, the query does not fail: it falls back to `Scan`, drops the index from its internal registry and carries on. It works, and it costs the whole table — declare `<field>_index` with projection `ALL` in your infrastructure.
- `attributes` cuts the payload, not the read units: DynamoDB charges for the whole item.
- Relations are batch loaded: one round of queries per relation and per depth level, up to five levels. Pivot tables are read through their `<foreign_key>_index` GSI.

---

## Errors

| Message | Cause |
|---------|-------|
| `DynamoDB client no configurado. Use Dynamite.connect() primero.` | An instance was built or a query run before `connect()` |
| `Record with <key> '<value>' already exists in <table>` | `create()` on a taken primary key |
| `Unknown column '<field>' in <table>` | A filter on a column the model does not declare |
| `Operator 'in' requires a non-empty array.` | `in` with an empty array |
| `Cannot destroy record without ID` | `destroy()`/`forceDestroy()` on an instance with no primary key |
| `Cannot increment without primary key` | `increment()`/`decrement()` on an instance with no primary key |
| `No se puede attach sin ID: la instancia debe persistirse primero con save() o create()` | `attach()` on an instance that was never persisted |
| `Transaction exceeds 100 operations limit` | More than 100 operations inside a single `tx()` |

---

## Limits

- A transaction holds at most 100 operations and is sent in batches of 25.
- `include` nests up to five levels.
- `BatchGetItem` reads 100 keys per request and `BatchWriteItem` writes 25 per request; the library chunks and retries on its own.
- DynamoDB itself caps an item at 400 KB and a query page at 1 MB.

---

## Source

`src/core/table.ts`
