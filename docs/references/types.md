# Types API Reference

This guide documents all TypeScript types exported by Dynamite ORM that enable creating models with complete type-safety.

## Table of Contents

- [Attribute Marker Types](#attribute-marker-types)
  - [CreationOptional\<T\>](#creationoptionalt)
  - [NonAttribute\<T\>](#nonattributet)
- [Inference Types](#inference-types)
  - [InferAttributes\<T\>](#inferattributest)
  - [FilterableAttributes\<T\>](#filterableattributest)
- [Relationship Types](#relationship-types)
  - [HasMany\<T\>](#hasmanyt)
  - [HasOne\<T\>](#hasonet)
  - [BelongsTo\<T\>](#belongstot)
- [Query Types](#query-types)
  - [QueryOperator](#queryoperator)
  - [QueryOptions\<T\>](#queryoptionst)
  - [WhereOptions\<T\>](#whereoptionst)
  - [IncludeRelationOptions](#includerelationoptions)

---

## Attribute Marker Types

### CreationOptional\<T\>

Marks a field as optional during creation but present after saving. Use for fields with default values, auto-generated values, or auto-calculated values.

**Syntax:**
```typescript
declare field_name: CreationOptional<Type>;
```

**Characteristics:**
- Field is optional when calling `Model.create()`
- Field is present in the instance after saving
- Ideal for auto-generated IDs, timestamps, and default values

**Examples:**

```typescript
import { Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from '@arcaelas/dynamite';

class User extends Table<User> {
  // Auto-generated primary key
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Required field (no CreationOptional)
  declare email: string;

  // Field with default value
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Auto-set timestamps
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Only email is required during creation
const user = await User.create({
  email: "john@example.com"
  // id, role, created_at, updated_at are optional
});

// After creation, all fields are present
console.log(user.id);         // "550e8400-e29b-..."
console.log(user.role);       // "customer"
console.log(user.created_at); // "2025-01-15T10:30:00.000Z"
```

---

### NonAttribute\<T\>

Marks a field that is NOT stored in the database. Use for computed properties, relationships, and virtual getters.

**Syntax:**
```typescript
declare field_name: NonAttribute<Type>;
```

**Characteristics:**
- Field is excluded from database operations
- Ideal for relationships and computed values
- Does not appear in `toJSON()` unless explicitly added

**Examples:**

```typescript
import { Table, HasMany, BelongsTo, NonAttribute } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  // Relationship - not stored in database
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;

  // Computed property
  declare display_name: NonAttribute<string>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;
}
```

---

## Inference Types

### InferAttributes\<T\>

Extracts only the database attributes from a model, excluding methods, relationships, and non-attribute fields.

**Usage:**
```typescript
import type { InferAttributes } from '@arcaelas/dynamite';

type UserAttributes = InferAttributes<User>;
// Result:
// {
//   id: string;
//   email: string;
//   name: string;
//   role: string;
//   created_at: string;
//   updated_at: string;
// }
```

**Use Cases:**
- Type-safe function parameters
- DTO (Data Transfer Object) definitions
- API response types

**Example:**

```typescript
import type { InferAttributes } from '@arcaelas/dynamite';

// Function with type-safe input
async function updateUser(
  id: string,
  data: Partial<InferAttributes<User>>
): Promise<User | undefined> {
  const user = await User.first({ id });
  if (user) {
    await user.update(data);
  }
  return user;
}

// Usage
await updateUser("user-123", { name: "New Name", role: "admin" });
```

---

### FilterableAttributes\<T\>

Extracts only the filterable attributes (excludes relationships and non-attributes).

**Usage:**
```typescript
import type { FilterableAttributes } from '@arcaelas/dynamite';

type UserFilters = FilterableAttributes<User>;
// Result: { id?: string; email?: string; name?: string; role?: string; ... }
```

---

## Relationship Types

### HasMany\<T\>

Type for one-to-many relationships. Resolves to an array of the related model.

**Syntax:**
```typescript
@HasMany(() => RelatedModel, "foreign_key")
declare relation_name: NonAttribute<HasMany<RelatedModel>>;
```

**Characteristics:**
- Returns `T[]` (array of related records)
- Empty array if no related records exist
- Must be wrapped in `NonAttribute<>`

**Example:**

```typescript
import { Table, HasMany, NonAttribute } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;

  @HasMany(() => Comment, "user_id")
  declare comments: NonAttribute<HasMany<Comment>>;
}

// Usage
const users = await User.where({}, {
  include: { posts: true, comments: true }
});

users.forEach(user => {
  console.log(`${user.name} has ${user.posts.length} posts`);
  console.log(`${user.name} has ${user.comments.length} comments`);
});
```

---

### HasOne\<T\>

Type for one-to-one relationships. Resolves to a single related record or null.

**Syntax:**
```typescript
@HasOne(() => RelatedModel, "foreign_key")
declare relation_name: NonAttribute<HasOne<RelatedModel>>;
```

**Characteristics:**
- Returns `T | null` (single related record or null)
- Only the first matching record is returned
- Must be wrapped in `NonAttribute<>`

**Example:**

```typescript
import { Table, HasOne, NonAttribute } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @HasOne(() => Profile, "user_id")
  declare profile: NonAttribute<HasOne<Profile>>;
}

// Usage
const user = await User.first({ id: "user-123" }, {
  include: { profile: true }
});

if (user?.profile) {
  console.log(user.profile.bio);
}
```

---

### BelongsTo\<T\>

Type for many-to-one relationships. Resolves to a single parent record or null.

**Syntax:**
```typescript
@BelongsTo(() => ParentModel, "local_foreign_key")
declare relation_name: NonAttribute<BelongsTo<ParentModel>>;
```

**Characteristics:**
- Returns `T | null` (single parent record or null)
- Requires a foreign key field in the model
- Must be wrapped in `NonAttribute<>`

**Example:**

```typescript
import { Table, BelongsTo, NonAttribute } from '@arcaelas/dynamite';

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string; // Foreign key

  @BelongsTo(() => User, "user_id")
  declare author: NonAttribute<BelongsTo<User>>;
}

// Usage
const posts = await Post.where({}, {
  include: { author: true }
});

posts.forEach(post => {
  console.log(`${post.title} by ${post.author?.name || 'Unknown'}`);
});
```

---

## Query Types

### QueryOperator

Union type of all supported query operators.

**Definition:**
```typescript
type QueryOperator =
  | "="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "in"
  | "not-in"
  | "contains"
  | "begins-with";
```

**Usage:**

```typescript
// Equality
await User.where("role", "=", "admin");

// Comparison
await User.where("age", ">=", 18);
await User.where("balance", "<", 100);

// Array membership
await User.where("status", "in", ["active", "pending"]);
await User.where("role", "not-in", ["banned"]);

// String matching
await User.where("email", "contains", "@gmail.com");
await User.where("name", "begins-with", "John");
```

---

### QueryOptions\<T\>

Options for configuring query behavior.

**Definition:**
```typescript
interface QueryOptions<T> {
  order?: "ASC" | "DESC";
  skip?: number;
  limit?: number;
  attributes?: (keyof InferAttributes<T>)[];
  include?: Record<string, IncludeRelationOptions | boolean>;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `order` | `"ASC" \| "DESC"` | Sort order |
| `skip` | `number` | Number of records to skip (offset) |
| `limit` | `number` | Maximum records to return |
| `attributes` | `string[]` | Specific fields to select |
| `include` | `object` | Relationships to include |

**Example:**

```typescript
const users = await User.where({ active: true }, {
  order: "DESC",
  skip: 20,
  limit: 10,
  attributes: ["id", "name", "email"],
  include: {
    orders: {
      limit: 5,
      order: "DESC"
    }
  }
});
```

---

### WhereOptions\<T\>

Extended options for where queries including relationship filtering.

**Definition:**
```typescript
interface WhereOptions<T> extends QueryOptions<T> {
  _includeTrashed?: boolean;
}
```

---

### IncludeRelationOptions

Options for configuring included relationships.

**Definition:**
```typescript
interface IncludeRelationOptions {
  where?: Record<string, any>;
  attributes?: string[];
  order?: "ASC" | "DESC";
  skip?: number;
  limit?: number;
  include?: Record<string, IncludeRelationOptions | boolean>;
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `where` | `object` | Filters for related records |
| `attributes` | `string[]` | Specific fields to select |
| `order` | `"ASC" \| "DESC"` | Sort order for related records |
| `skip` | `number` | Skip N related records |
| `limit` | `number` | Limit related records |
| `include` | `object` | Nested relationships |

**Example:**

```typescript
const users = await User.where({}, {
  include: {
    orders: {
      where: { status: "completed" },
      attributes: ["id", "total", "created_at"],
      order: "DESC",
      limit: 10,
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    }
  }
});
```

---

## Best Practices

### 1. Always Use CreationOptional for Fields with Defaults

```typescript
// Good
@Default(() => "active")
declare status: CreationOptional<string>;

// Bad - TypeScript will require status in create()
@Default(() => "active")
declare status: string;
```

### 2. Always Wrap Relationships in NonAttribute

```typescript
// Good
@HasMany(() => Post, "user_id")
declare posts: NonAttribute<HasMany<Post>>;

// Bad - posts would be treated as a database column
@HasMany(() => Post, "user_id")
declare posts: Post[];
```

### 3. Use InferAttributes for Type-Safe Functions

```typescript
// Good - type-safe parameter
function processUser(data: InferAttributes<User>) { ... }

// Bad - no type safety
function processUser(data: any) { ... }
```

### 4. Define Foreign Keys Explicitly

```typescript
// Good - foreign key is declared
class Post extends Table<Post> {
  declare user_id: string; // FK field

  @BelongsTo(() => User, "user_id")
  declare author: NonAttribute<BelongsTo<User>>;
}

// Bad - foreign key not declared
class Post extends Table<Post> {
  @BelongsTo(() => User, "user_id")
  declare author: NonAttribute<BelongsTo<User>>;
}
```
