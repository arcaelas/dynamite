# @arcaelas/dynamite

![Banner](assets/cover.png)

> **Modern decorator-first ORM for AWS DynamoDB**
> TypeScript decorators | Type-safe relationships | Automatic table sync | Minimal boilerplate

---

## Features

- **Decorator-first design** - Define models with TypeScript decorators
- **Type-safe relationships** - HasMany, BelongsTo, ManyToMany with full typing
- **Automatic table sync** - Tables and indexes created automatically
- **Validation & transformation** - Built-in decorators for data processing
- **Soft deletes** - @DeleteAt decorator for recoverable records
- **Transactions** - Full transaction support with rollback

---

## Quick Start

```typescript
import { Dynamite, Table, PrimaryKey, Default, CreatedAt } from '@arcaelas/dynamite';

// Define your model
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: string;

  declare name: string;
  declare email: string;

  @CreatedAt()
  declare created_at: Date;
}

// Configure and connect
const dynamite = new Dynamite({
  region: 'us-east-1',
  tables: [User]
});
dynamite.connect();
await dynamite.sync();

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
| `@Mutate(fn)` | Transform on set |
| `@CreatedAt()` | Auto-set on create |
| `@UpdatedAt()` | Auto-set on update |
| `@DeleteAt()` | Soft delete timestamp |
| `@HasMany()` | One-to-many relationship |
| `@BelongsTo()` | Many-to-one relationship |
| `@ManyToMany()` | Many-to-many with pivot table |

---

## Relationships

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Post, 'user_id')
  declare posts: HasMany<Post>;
}

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;

  @BelongsTo(() => User, 'user_id')
  declare user: BelongsTo<User>;
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
