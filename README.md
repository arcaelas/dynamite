<p align="center">
  <img src="docs/assets/cover.png" alt="Dynamite ORM - Arcaelas Insiders for DynamoDB" width="100%">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@arcaelas/dynamite"><img src="https://img.shields.io/npm/v/@arcaelas/dynamite?color=cb3837" alt="npm"></a>
  <img src="https://img.shields.io/bundlephobia/minzip/@arcaelas/dynamite?label=gzip" alt="size">
  <img src="https://img.shields.io/github/license/arcaelas/dynamite" alt="MIT">
  <img src="https://img.shields.io/badge/AWS%20SDK-v3-orange" alt="AWS SDK v3">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue" alt="TypeScript">
</p>

# @arcaelas/dynamite

> **A modern, decorator-first ORM for DynamoDB with TypeScript support**
> Type-safe models | Relationships | Lifecycle hooks | Transactions | Query-first reads

---

## Quick Start

```typescript
import { Dynamite, Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from "@arcaelas/dynamite";

// Define your model
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Connect to DynamoDB
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000", // DynamoDB Local
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  tables: [User]
});

await dynamite.connect();
await dynamite.sync();       // development only: creates missing tables and GSIs

// Use it!
const user = await User.create({ name: "John Doe", email: "john@example.com" });
console.log(user.id);         // "01JBQ8..."  (ULID by default)
console.log(user.role);       // "customer"
console.log(user.created_at); // "2025-01-15T10:30:00.000Z"
```

`connect()` only configures the client and works out which GSIs the models expect; it never
calls the AWS API. `sync()` is the one that creates tables, pivot tables and missing indexes,
and it is meant for development. In production the infrastructure declares them with the same
names — `<field>_index`, partition key on `<field>`, projection `ALL` — and `sync()` is not called.

---

## Installation

```bash
npm install @arcaelas/dynamite
```

Decorators need `experimentalDecorators` in your `tsconfig.json`. Under Serverless Framework,
esbuild does not honour decorators on its own: register the decorator plugin.

---

## Decorators

### Index Decorators

| Decorator | Description |
|-----------|-------------|
| `@PrimaryKey()` | Partition key. Fills in a ULID when no id is given; any non-empty string is accepted, so existing UUID keys keep working. Immutable once assigned |
| `@Index()` | Partition key of the `<field>_index` GSI: `=` and `in` on that field run a Query instead of a Scan |
| `@IndexSort()` | Sort key of the table |

### Data Decorators

| Decorator | Description |
|-----------|-------------|
| `@Default(value \| fn)` | Value applied on write when the field is nullish |
| `@Set(fn)` | Write pipeline: `(next, current) => value` |
| `@Get(fn)` | Read pipeline: `(current) => value` |
| `@Validate(fn \| fn[])` | Rejects on write. Each validator returns `true` or the error message |
| `@NotNull(message?)` | Rejects `null`, `undefined` and the empty string. Composed from `@Validate` |
| `@Name("custom")` | Renames the column, or the table when applied to the class |

### Timestamp Decorators

| Decorator | Description |
|-----------|-------------|
| `@CreatedAt()` | ISO timestamp written once and never overwritten |
| `@UpdatedAt()` | ISO timestamp refreshed on every write, unless an explicit value is given |
| `@DeleteAt()` | Marks the column as the soft delete flag used by `destroy()` and `where()` |

### Relationship Decorators

| Decorator | Description |
|-----------|-------------|
| `@HasMany(() => Model, foreign_key, local_key?)` | One-to-many. `foreign_key` lives in the related model, `local_key` defaults to `"id"` |
| `@HasOne(() => Model, foreign_key, local_key?)` | One-to-one, same argument order |
| `@BelongsTo(() => Model, related_key, local_key)` | Many-to-one. `related_key` is the key of the parent, `local_key` is the field of this model that points at it |
| `@ManyToMany(() => Model, pivot_table, foreign_key, related_key, local_key?, related_pk?)` | Many-to-many through a pivot table |

### Lifecycle Hook Decorators

| Decorator | Runs |
|-----------|------|
| `@BeforeCreate()` / `@AfterCreate()` | Around `create()` and the first `save()` |
| `@BeforeUpdate()` / `@AfterUpdate()` | Around `update()`. Receives the changes delta as its argument |
| `@BeforeDestroy()` / `@AfterDestroy()` | Around `destroy()`, `forceDestroy()` and static `delete()` |

Hooks are opt-in per operation with `{ hook: true }`. Inside a hook `this` is the instance and
may be mutated; several hooks of the same type run in declaration order and async hooks are
awaited. In a transaction the `after*` hooks run after the commit.

```typescript
class Article extends Table<Article> {
  @PrimaryKey() declare id: CreationOptional<string>;
  declare title: string;
  @Default("") declare slug: string;

  @BeforeCreate()
  fill_slug() { this.slug = this.title.toLowerCase().replace(/\W+/g, "-"); }
}

await Article.create({ title: "Hello World" }, { hook: true }); // slug: "hello-world"
await Article.create({ title: "Hello World" });                 // slug: ""
```

---

## TypeScript Types

```typescript
import type {
  CreationOptional,  // Optional during create(), present afterwards
  NonAttribute,      // Excluded from the database (relations, computed fields)
  InferAttributes,   // Database attributes of a model
  InferRelations,    // Relations of a model
  CreateInput,       // Input type of create()
  UpdateInput,       // Input type of update()
  WhereOptions,      // Query options
  QueryResult,       // The array returned by where(), with its cursor
  QueryOperator,     // Available operators
  MutationOptions,   // { hook?: boolean; tx?: TransactionContext }
  DynamiteConfig     // Client configuration
} from "@arcaelas/dynamite";
```

### CreationOptional

For fields that are optional on creation but always present afterwards:

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;  // optional in create()

  declare name: string;                  // required in create()

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}
```

### NonAttribute

For relations and computed fields that are never stored:

```typescript
class User extends Table<User> {
  declare first_name: string;
  declare last_name: string;

  declare full_name: NonAttribute<string>;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}
```

---

## Query Operations

### Basic Queries

```typescript
const users = await User.where({});                        // every record
const admins = await User.where({ role: "admin" });
const one = await User.where("email", "john@example.com");

const first = await User.first({ id: "01JBQ8..." });
const last = await User.last({});
```

### Query Operators

```typescript
await User.where("age", ">=", 18);
await User.where("status", "!=", "banned");
await User.where("role", "in", ["admin", "moderator"]);
await User.where("email", "$include", "gmail");
await User.where({ age: { $gte: 18, $lte: 65 } });
```

**Available operators:** `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`, `in`, `include`, with the aliases
`$eq`, `$ne`, `$lt`, `$lte`, `$gt`, `$gte`, `$in`, `$include`. `null` on `=` reads as
"the attribute does not exist" and on `!=` as "it does exist".

### Query Options

```typescript
const users = await User.where({}, {
  limit: 10,
  skip: 20,             // alias: offset
  cursor: previous.cursor,
  order: { created_at: "DESC" },
  attributes: ["id", "name", "email"],
  deleted: false,       // true also returns the soft-deleted ones
  include: {
    orders: { where: { status: "completed" }, limit: 5 }
  }
});
```

`order` without a field sorts by the `@CreatedAt` column, and never by the field you meant unless
you name it: ask for `{ created_at: "DESC" }`, not `"DESC"`.

### Pagination

`where()` returns the array of instances with a `cursor` property attached whenever a `limit`
is given. Feeding that cursor back reads only the next page; `skip` instead reads and discards
everything before it, so cursors are the cheap way to walk a large table.

```typescript
let page = await User.where({}, { limit: 50 });
while (page.cursor) {
  page = await User.where({}, { limit: 50, cursor: page.cursor });
}
```

---

## Relationships

### Defining Relations

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  // HasMany(model, foreign_key, local_key = "id")
  @HasMany(() => Order, "user_id", "id")
  declare orders: NonAttribute<Order[]>;

  // HasOne(model, foreign_key, local_key = "id")
  @HasOne(() => Profile, "user_id", "id")
  declare profile: NonAttribute<Profile | null>;

  // ManyToMany(model, pivot_table, foreign_key, related_key, local_key = "id", related_pk = "id")
  @ManyToMany(() => Role, "user_roles", "user_id", "role_id")
  declare roles: NonAttribute<Role[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Index()
  declare user_id: string;

  // BelongsTo(model, related_key, local_key)
  @BelongsTo(() => User, "id", "user_id")
  declare user: NonAttribute<User | null>;
}
```

The foreign key of every `@HasMany` and `@HasOne` is registered as a GSI, so loading a relation
is a Query. Mark the same column with `@Index()` when you also filter by it directly.

### Loading Relations

```typescript
const users = await User.where({}, {
  include: {
    orders: { where: { status: "completed" } },
    profile: true,
    roles: true
  }
});
```

Relations are batch loaded: one round of queries per relation and per depth level, never one
query per parent record. Nesting is allowed up to five levels.

### ManyToMany Operations

```typescript
const user = await User.first({ id: "user-1" });

await user.attach(Role, "role-123");            // adds the pivot row if it is not there
await user.detach(Role, "role-123");            // removes it
await user.sync(Role, ["role-1", "role-2"]);    // leaves exactly these
```

---

## CRUD Operations

### Create

```typescript
const user = await User.create({ name: "John Doe", email: "john@example.com" });

// Batch: 25 records per request, no duplicate-key check
const users = await User.createMany([
  { name: "Ada", email: "ada@example.com" },
  { name: "Alan", email: "alan@example.com" }
]);
```

`create()` refuses to overwrite an existing primary key and throws when it already exists.
`createMany()` cannot express that condition and overwrites instead.

### Read

```typescript
const users = await User.where({ active: true });
const user = await User.first({ id: "user-123" });
```

### Update

```typescript
// Static: updates every record matching the filter
await User.update({ role: "premium" }, { id: "user-123" });

// Instance
await user.update({ name: "Jane Doe" });

// Full rewrite of the item
user.name = "Jane Doe";
await user.save();

// Atomic counters, no read involved
await User.increment("credits", 10, { id: "user-123" });
await user.decrement("credits", 1);
```

`update()` writes only the fields you pass plus the `@UpdatedAt` columns. `save()` rewrites the
whole item, which is what you want after mutating several fields by hand.

### Delete

```typescript
// Static: hard delete of everything matching the filter
await User.delete({ status: "inactive" });

// Batch by primary key, no read and no hooks
await User.deleteMany(["user-1", "user-2"]);

// Instance: soft delete when the model has @DeleteAt, hard delete otherwise
await user.destroy();

// Always a hard delete
await user.forceDestroy();
```

---

## Soft Deletes

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare title: string;

  @DeleteAt()
  declare deleted_at: CreationOptional<string>;
}

await post.destroy();                                  // writes deleted_at

await Post.where({});                                  // excludes the soft-deleted ones
await Post.where({}, { deleted: true });               // includes them

await post.forceDestroy();                             // removes the record
```

Static `delete()` is always a hard delete: soft delete is a decision of the instance.

---

## Transactions

```typescript
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, { tx });
  await Order.create({ user_id: user.id, total: 100 }, { tx });
  await User.increment("orders_count", 1, { id: user.id }, { tx });
});
```

Every mutation takes the transaction inside its options object. Nothing is written until the
callback returns: if it throws, no operation is applied. A transaction holds up to 100
operations and is sent in batches of 25. `__isPersisted` and the `after*` hooks only fire
once the commit succeeds.

---

## Cost and Performance

DynamoDB charges for what it reads, so the shape of the query is the bill.

| Query | Command | Note |
|-------|---------|------|
| `=` on the primary key | `GetItem` | One request, one item read |
| `in` on the primary key | `BatchGetItem` | 100 keys per request |
| `=` or `in` on an `@Index` column | `Query` | Uses `<field>_index` |
| Anything else | `Scan` | Reads the table and filters server-side |

- A `limit` stops the read as soon as it has enough items, and travels to DynamoDB as `Limit`
  when there is nothing left to filter. `first()` on an indexed field is a single request.
- A read with no `limit` that ends in a Scan is split into four parallel segments: same read
  units, a fraction of the latency.
- `createMany()`, `deleteMany()`, static `delete()` and mass `update()` write in batches of 25.
- `attach()`, `detach()`, `sync()` and loading a `@ManyToMany` query the pivot table through
  its `<foreign_key>_index` GSI; none of them scans it.
- A projection with `attributes` cuts the payload, not the read units: DynamoDB charges for the
  whole item either way.
- `last()` with no sort key has to read everything to find the last one. Prefer
  `first(filters, { order: { created_at: "DESC" } })` over an unbounded table.

The rule of thumb: give every column you filter by an `@Index()`, and declare the matching GSI
in your infrastructure. Without it the query still works — it just reads the entire table.

---

## Configuration

### DynamoDB Local

```typescript
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  tables: [User, Order, Product]
});

await dynamite.connect();
await dynamite.sync();
```

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

### AWS DynamoDB

```typescript
const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User, Order, Product]
});

await dynamite.connect();
```

`DynamiteConfig` extends `DynamoDBClientConfig`, so anything the AWS SDK accepts —
credential providers, retries, custom endpoints — is accepted here too. With no explicit
credentials the SDK resolves them from the environment.

---

## API Reference

### Static Methods

```typescript
create(data, options?): Promise<T>
createMany(rows, options?): Promise<T[]>
update(changes, filters, options?): Promise<number>
delete(filters, options?): Promise<number>
deleteMany(ids, options?): Promise<number>
increment(field, amount, filters, options?): Promise<number>
decrement(field, amount, filters, options?): Promise<number>

where(filters, options?): Promise<QueryResult<T>>
where(field, value, options?): Promise<QueryResult<T>>
where(field, operator, value, options?): Promise<QueryResult<T>>
first(filters, options?): Promise<T | undefined>
last(filters?, options?): Promise<T | undefined>
```

### Instance Methods

```typescript
save(options?): Promise<boolean>
update(changes, options?): Promise<boolean>
destroy(options?): Promise<null>
forceDestroy(options?): Promise<null>
increment(field, amount?): Promise<void>
decrement(field, amount?): Promise<void>

attach(Model, related_id, pivot_data?): Promise<void>
detach(Model, related_id): Promise<void>
sync(Model, related_ids): Promise<void>

toJSON(): Record<string, unknown>
toString(): string
```

`options` is always `MutationOptions`: `{ hook?: boolean; tx?: TransactionContext }`.

---

## Documentation

For complete documentation, examples, and guides:

**[arcaelas.github.io/dynamite](https://arcaelas.github.io/dynamite)**

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with care by [Miguel Alejandro](https://github.com/arcaelas) - [Arcaelas Insiders](https://github.com/arcaelas)**
