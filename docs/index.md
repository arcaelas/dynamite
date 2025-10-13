# Welcome to Arcaelas Dynamite

Modern decorator-first ORM for AWS DynamoDB with TypeScript support.

## What is Dynamite?

Arcaelas Dynamite is a powerful, decorator-based Object-Relational Mapping (ORM) library for AWS DynamoDB. It provides a clean, intuitive API that leverages TypeScript decorators to define your data models with type safety and minimal boilerplate.

## Key Features

### Decorator-First Design
Define your models using familiar TypeScript decorators:

```typescript
import { Table, PrimaryKey, CreatedAt, UpdatedAt } from '@arcaelas/dynamite';

class User extends Table {
  @PrimaryKey()
  id: string;

  @Default(() => 'active')
  status: string;

  @CreatedAt()
  created_at: Date;

  @UpdatedAt()
  updated_at: Date;
}
```

### Type-Safe Relationships
Built-in support for one-to-many and many-to-one relationships:

```typescript
import { HasMany, BelongsTo } from '@arcaelas/dynamite';

class User extends Table {
  @HasMany(() => Post, 'user_id')
  posts: HasMany<Post>;
}

class Post extends Table {
  @BelongsTo(() => User, 'user_id')
  user: BelongsTo<User>;
}
```

### Powerful Query Builder
Intuitive query interface with full TypeScript support:

```typescript
const active_users = await User.where('status', '=', 'active')
  .where('created_at', '>', new Date('2024-01-01'))
  .include('posts')
  .get();
```

### Validation & Transformation
Built-in decorators for data validation and mutation:

```typescript
class User extends Table {
  @Validate(value => value.length >= 8, 'Password must be at least 8 characters')
  password: string;

  @Mutate(value => value.toLowerCase().trim())
  email: string;
}
```

## Quick Start

### Installation

```bash
npm install @arcaelas/dynamite
# or
yarn add @arcaelas/dynamite
```

### Basic Usage

```typescript
import { Dynamite, Table, PrimaryKey } from '@arcaelas/dynamite';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Configure DynamoDB client
const client = new DynamoDBClient({ region: 'us-east-1' });
Dynamite.configure({ client });

// Define your model
class User extends Table {
  @PrimaryKey()
  id: string;

  name: string;
  email: string;
}

// Create a new user
const user = await User.create({
  id: '123',
  name: 'John Doe',
  email: 'john@example.com'
});

// Query users
const users = await User.where('name', '=', 'John Doe').get();

// Update
user.email = 'newemail@example.com';
await user.save();

// Delete
await user.destroy();
```

## Architecture Overview

Dynamite is built on three core concepts:

1. **Table** - Base class for all models with CRUD operations
2. **Decorators** - Define schema, validation, and behavior
3. **Relationships** - Connect models with type-safe associations

```
┌─────────────────────────────────────────┐
│             Your Models                  │
│  ┌─────────────────────────────────┐   │
│  │  User extends Table              │   │
│  │  - @PrimaryKey() id              │   │
│  │  - @HasMany() posts              │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          Dynamite ORM                    │
│  - Query Builder                         │
│  - Relationship Resolver                 │
│  - Decorator Processing                  │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         AWS SDK v3                       │
│  - DynamoDBClient                        │
│  - DynamoDB Document Client              │
└──────────────────────────────────────────┘
```

## Why Dynamite?

- **Type Safety** - Full TypeScript support with advanced types
- **Developer Experience** - Clean, intuitive API with minimal boilerplate
- **Modern** - Built on AWS SDK v3 with ESM support
- **Flexible** - Supports complex queries, relationships, and custom logic
- **Lightweight** - Minimal dependencies, focused on DynamoDB

## Next Steps

- **[Installation Guide](installation.md)** - Set up Dynamite in your project
- **[Getting Started](guides/getting-started.md)** - Your first Dynamite model
- **[Core Concepts](guides/core-concepts.md)** - Understanding the fundamentals
- **[API Reference](api/table.md)** - Complete API documentation

## Community

- **GitHub**: [github.com/arcaelas/dynamite](https://github.com/arcaelas/dynamite)
- **Issues**: [Report bugs or request features](https://github.com/arcaelas/dynamite/issues)
- **NPM**: [@arcaelas/dynamite](https://www.npmjs.com/package/@arcaelas/dynamite)

---

**Ready to get started?** [Install Dynamite](installation.md) and create your first model in minutes.
