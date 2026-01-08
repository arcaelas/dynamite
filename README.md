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
> Full-featured | Type-safe | Relationships | Auto table creation | Transactions

---

## Quick Start

```typescript
import { Dynamite, Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from "@arcaelas/dynamite";

// Define your model
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
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

// Use it!
const user = await User.create({ name: "John Doe", email: "john@example.com" });
console.log(user.id);         // "a1b2c3d4-..."
console.log(user.role);       // "customer"
console.log(user.created_at); // "2025-01-15T10:30:00.000Z"
```

---

## Installation

```bash
npm install @arcaelas/dynamite
```

---

## Decorators

### Index Decorators

| Decorator | Description |
|-----------|-------------|
| `@PrimaryKey()` | Primary key (partition key) - sets `schema.primary_key` |
| `@Index()` | Partition key marker (use `@PrimaryKey` for main key) |
| `@IndexSort()` | Sort key (range key) |

### Data Decorators

| Decorator | Description |
|-----------|-------------|
| `@Default(value \| fn)` | Default value (static or dynamic) |
| `@Mutate(fn)` | Transform value before save |
| `@Validate(fn)` | Validate value before save |
| `@Serialize(fromDB, toDB)` | Bidirectional transformation |
| `@NotNull()` | Required field validation |
| `@Name("custom")` | Custom column/table name |
| `@Column()` | Column configuration |

### Timestamp Decorators

| Decorator | Description |
|-----------|-------------|
| `@CreatedAt()` | Auto-set on creation |
| `@UpdatedAt()` | Auto-set on every update |
| `@DeleteAt()` | Soft delete timestamp |

### Relationship Decorators

| Decorator | Description |
|-----------|-------------|
| `@HasMany(() => Model, foreignKey, localKey?)` | One-to-many (localKey defaults to 'id') |
| `@HasOne(() => Model, foreignKey, localKey?)` | One-to-one (localKey defaults to 'id') |
| `@BelongsTo(() => Model, localKey, foreignKey?)` | Many-to-one (foreignKey defaults to 'id') |
| `@ManyToMany(() => Model, pivot, fk, rk, lk?, rpk?)` | Many-to-many with pivot table |

---

## TypeScript Types

```typescript
import {
  CreationOptional,  // Optional during create(), required after
  NonAttribute,      // Excluded from database (computed/relations)
  InferAttributes,   // Extract DB attributes from model
  InferRelations,    // Extract relations from model
  CreateInput,       // Input type for create()
  UpdateInput,       // Input type for update()
  WhereOptions,      // Query options type
  QueryOperator      // Available operators
} from "@arcaelas/dynamite";
```

### CreationOptional

Use for fields that are optional during creation but exist after:

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;  // Optional in create()

  declare name: string;  // Required in create()

  @CreatedAt()
  declare created_at: CreationOptional<string>;  // Auto-generated
}
```

### NonAttribute

Use for computed properties and relations (not stored in DB):

```typescript
class User extends Table<User> {
  declare first_name: string;
  declare last_name: string;

  // Computed property - not stored
  declare full_name: NonAttribute<string>;

  // Relations - loaded via include
  @HasMany(() => Order, "user_id", "id")
  declare orders: NonAttribute<Order[]>;
}
```

---

## Query Operations

### Basic Queries

```typescript
// Get all
const users = await User.where({});

// Filter by field
const admins = await User.where({ role: "admin" });
const user = await User.where("email", "john@example.com");

// First/Last
const first = await User.first({ active: true });
const last = await User.last({});
```

### Query Operators

```typescript
// Comparison
await User.where("age", ">=", 18);
await User.where("age", "<", 65);
await User.where("status", "!=", "banned");

// Array membership
await User.where("role", "in", ["admin", "moderator"]);

// String contains
await User.where("email", "$include", "gmail");
```

**Available operators:** `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`, `in`, `$include`

### Query Options

```typescript
const users = await User.where({}, {
  limit: 10,
  skip: 20,
  order: "DESC",
  attributes: ["id", "name", "email"],
  include: {
    orders: {
      where: { status: "completed" },
      limit: 5
    }
  }
});
```

---

## Relationships

### Defining Relations

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // HasMany(model, foreignKey, localKey = 'id')
  @HasMany(() => Order, "user_id", "id")
  declare orders: NonAttribute<Order[]>;

  // HasOne(model, foreignKey, localKey = 'id')
  @HasOne(() => Profile, "user_id", "id")
  declare profile: NonAttribute<Profile | null>;

  // ManyToMany(model, pivotTable, foreignKey, relatedKey, localKey = 'id', relatedPK = 'id')
  @ManyToMany(() => Role, "user_roles", "user_id", "role_id", "id", "id")
  declare roles: NonAttribute<Role[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;

  // BelongsTo(model, localKey, foreignKey = 'id')
  @BelongsTo(() => User, "user_id", "id")
  declare user: NonAttribute<User | null>;
}
```

### Loading Relations

```typescript
const users = await User.where({}, {
  include: {
    orders: { where: { status: "completed" }, limit: 5 },
    profile: true,  // or { attributes: ["bio", "avatar"] }
    roles: true
  }
});
```

### ManyToMany Operations

```typescript
const user = await User.first({ id: "user-1" });

// Attach relation
await user.attach(Role, "role-123");

// Detach relation
await user.detach(Role, "role-123");

// Sync relations (replace all)
await user.sync(Role, ["role-1", "role-2", "role-3"]);
```

---

## CRUD Operations

### Create

```typescript
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
});
```

### Read

```typescript
const users = await User.where({ active: true });
const user = await User.first({ id: "user-123" });
```

### Update

```typescript
// Static update (bulk)
await User.update({ role: "premium" }, { id: "user-123" });

// Instance update
user.name = "Jane Doe";
await user.save();

// Or
await user.update({ name: "Jane Doe" });
```

### Delete

```typescript
// Static delete (bulk)
await User.delete({ status: "inactive" });

// Instance delete (soft delete if @DeleteAt present)
await user.destroy();

// Force hard delete
await user.forceDestroy();
```

---

## Soft Deletes

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  declare title: string;

  @DeleteAt()
  declare deleted_at: CreationOptional<string | null>;
}

// Soft delete
await post.destroy(); // Sets deleted_at timestamp

// Query including soft-deleted
const all = await Post.withTrashed({});

// Query only soft-deleted
const trashed = await Post.onlyTrashed({});

// Force hard delete
await post.forceDestroy();
```

---

## Transactions

```typescript
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, tx);
  await Order.create({ user_id: user.id, total: 100 }, tx);
  // If any operation fails, all are rolled back
});
```

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
```

### AWS DynamoDB

```typescript
const dynamite = new Dynamite({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product]
});

await dynamite.connect();
```

### Docker Setup

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

---

## API Reference

### Static Methods

```typescript
// CRUD
static create(data, tx?): Promise<T>
static update(data, filters, tx?): Promise<number>
static delete(filters, tx?): Promise<number>

// Query
static where(filters, options?): Promise<T[]>
static where(field, value): Promise<T[]>
static where(field, operator, value): Promise<T[]>
static first(filters?, options?): Promise<T | undefined>
static last(filters?, options?): Promise<T | undefined>

// Soft deletes
static withTrashed(filters?, options?): Promise<T[]>
static onlyTrashed(filters?, options?): Promise<T[]>
```

### Instance Methods

```typescript
// CRUD
save(): Promise<boolean>
update(data): Promise<boolean>
destroy(): Promise<null>
forceDestroy(): Promise<null>

// ManyToMany
attach(Model, id, pivotData?): Promise<void>
detach(Model, id): Promise<void>
sync(Model, ids): Promise<void>

// Serialization
toJSON(): Record<string, unknown>
```

---

## Documentation

For complete documentation, examples, and guides:

**[arcaelas.github.io/dynamite](https://arcaelas.github.io/dynamite)**

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with care by [Miguel Alejandro](https://github.com/arcaelas) - [Arcaelas Insiders](https://github.com/arcaelas)**
