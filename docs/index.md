# @arcaelas/dynamite

![Banner](assets/cover.png)

> **Modern decorator-first ORM for AWS DynamoDB**
> TypeScript decorators | Type-safe relationships | Query-first reads | Minimal boilerplate

---

## Features

- **Decorator-first design** - Define models with TypeScript decorators
- **Type-safe relationships** - HasMany, BelongsTo, ManyToMany with full typing
- **Table sync on demand** - `sync()` creates the missing tables, pivot tables and GSIs
- **Validation & transformation** - Built-in decorators for data processing
- **Soft deletes** - @DeleteAt decorator for recoverable records
- **Transactions** - Full transaction support with rollback
- **Lifecycle hooks** - Opt-in @Before/@After hooks for create, update and destroy
- **Query-first reads** - `GetItem`, `BatchGetItem` or `Query` whenever the filter allows it, `Scan` only as a last resort
- **Batched writes** - `createMany()`, `deleteMany()` and mass updates write 25 items per request

---

## Quick Start

```typescript
import { Dynamite, Table, PrimaryKey, CreatedAt, CreationOptional } from '@arcaelas/dynamite';

// Define your model
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// Configure and connect
const dynamite = new Dynamite({
  region: 'us-east-1',
  tables: [User]
});
await dynamite.connect();
await dynamite.sync(); // development only

// Create
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Query
const users = await User.where('name', 'John Doe');

// Update
user.email = 'newemail@example.com';
await user.save();

// Delete
await user.destroy();
```

---

## Decorators

| Decorator | Description |
|-----------|-------------|
| `@PrimaryKey()` | Partition key |
| `@Index()` | Global Secondary Index |
| `@Default(value)` | Default value (static or function) |
| `@Validate(fn)` | Validation on set |
| `@Get(fn)` | Transform on read |
| `@Set(fn)` | Transform on write |
| `@CreatedAt()` | Auto-set on create |
| `@UpdatedAt()` | Auto-set on update |
| `@DeleteAt()` | Soft delete timestamp |
| `@HasMany()` | One-to-many relationship |
| `@HasOne()` | One-to-one relationship |
| `@BelongsTo()` | Many-to-one relationship |
| `@ManyToMany()` | Many-to-many with pivot table |

---

## Relationships

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @HasMany(() => Post, 'user_id')
  declare posts: NonAttribute<Post[]>;
}

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Index()
  declare user_id: string;

  @BelongsTo(() => User, 'id', 'user_id')
  declare user: NonAttribute<User | null>;
}

// Load with relations
const user = await User.first({ id: '123' }, { include: { posts: true } });
console.log(user.posts); // Post[]
```

---

## Next Steps

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } **Installation**

    ---

    Set up Dynamite in your project

    [:octicons-arrow-right-24: Install](installation.md)

-   :material-rocket-launch:{ .lg .middle } **Getting Started**

    ---

    Create your first model step by step

    [:octicons-arrow-right-24: Start](getting-started.md)

-   :material-api:{ .lg .middle } **API Reference**

    ---

    Complete documentation of all classes

    [:octicons-arrow-right-24: Reference](references/table.md)

-   :material-code-tags:{ .lg .middle } **Examples**

    ---

    Practical examples ready to use

    [:octicons-arrow-right-24: Examples](examples/basic.md)

</div>

---

**Developed by [Arcaelas Insiders](https://github.com/arcaelas)**
