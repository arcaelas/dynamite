# Types API Reference

This guide documents all TypeScript types exported by Dynamite ORM.

## Table of Contents

- [Attribute Marker Types](#attribute-marker-types)
  - [CreationOptional\<T\>](#creationoptionalt)
  - [NonAttribute\<T\>](#nonattributet)
- [Inference Types](#inference-types)
  - [InferAttributes\<T\>](#inferattributest)
  - [InferRelations\<T\>](#inferrelationst)
  - [PickRelations\<T\>](#pickrelationst)
- [Input Types](#input-types)
  - [CreateInput\<T\>](#createinputt)
  - [UpdateInput\<T\>](#updateinputt)
- [Query Types](#query-types)
  - [QueryOperator](#queryoperator)
  - [WhereOptions\<T\>](#whereoptionst)

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
//   id?: string;            // CreationOptional becomes optional
//   email: string;          // Required
//   name: string;           // Required
//   role?: string;          // CreationOptional becomes optional
//   created_at?: string;    // CreationOptional becomes optional
//   updated_at?: string;    // CreationOptional becomes optional
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
): Promise<boolean> {
  const user = await User.first({ id });
  if (user) {
    return user.update(data);
  }
  return false;
}

// Usage
await updateUser("user-123", { name: "New Name", role: "admin" });
```

---

### InferRelations\<T\>

Extracts only the relationship fields from a model (fields marked with `NonAttribute`).

**Usage:**
```typescript
import type { InferRelations } from '@arcaelas/dynamite';

type UserRelations = InferRelations<User>;
// Result:
// {
//   orders: Order[];        // HasMany resolves to array
//   profile: Profile;       // HasOne resolves to single
// }
```

**Example:**

```typescript
import type { InferRelations } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<Post[]>;

  @HasOne(() => Profile, "user_id")
  declare profile: NonAttribute<Profile | null>;
}

// InferRelations<User> = { posts: Post[], profile: Profile | null }
```

---

### PickRelations\<T\>

Extracts only relationship fields. Used internally for validation.

**Usage:**
```typescript
import type { PickRelations } from '@arcaelas/dynamite';

type UserRelations = PickRelations<User>;
// { posts: Post[], profile: Profile | null }
```

---

## Input Types

### CreateInput\<T\>

Type for `Model.create()` input. Alias of `InferAttributes<T>`.

**Usage:**
```typescript
import type { CreateInput } from '@arcaelas/dynamite';

type UserCreateData = CreateInput<User>;
// { email: string; name: string; id?: string; role?: string; ... }

const data: CreateInput<User> = {
  email: "john@example.com",
  name: "John"
  // id, role, timestamps are optional
};

await User.create(data);
```

---

### UpdateInput\<T\>

Type for `instance.update()` input. All fields are optional.

**Usage:**
```typescript
import type { UpdateInput } from '@arcaelas/dynamite';

type UserUpdateData = UpdateInput<User>;
// { email?: string; name?: string; role?: string; ... }

const data: UpdateInput<User> = {
  name: "New Name"
  // All fields are optional
};

await user.update(data);
```

---

## Query Types

### QueryOperator

Union type of all supported query operators.

**Definition:**
```typescript
type QueryOperator =
  | "="        // Equal
  | "$eq"      // Equal (alias)
  | "<>"       // Not equal
  | "!="       // Not equal (alias)
  | "$ne"      // Not equal (alias)
  | "<"        // Less than
  | "$lt"      // Less than (alias)
  | "<="       // Less than or equal
  | "$lte"     // Less than or equal (alias)
  | ">"        // Greater than
  | "$gt"      // Greater than (alias)
  | ">="       // Greater than or equal
  | "$gte"     // Greater than or equal (alias)
  | "in"       // In array
  | "$in"      // In array (alias)
  | "include"  // Contains substring
  | "$include" // Contains (alias)
  | "contains" // Contains (alias for include)
  | "$contains" // Contains (alias)
```

**Usage:**

```typescript
// Equality
await User.where("role", "=", "admin");
await User.where("role", "$eq", "admin");

// Comparison
await User.where("age", ">=", 18);
await User.where("age", "$gte", 18);
await User.where("balance", "<", 100);
await User.where("balance", "$lt", 100);

// Not equal
await User.where("status", "!=", "banned");
await User.where("status", "<>", "banned");
await User.where("status", "$ne", "banned");

// Array membership
await User.where("status", "in", ["active", "pending"]);
await User.where("status", "$in", ["active", "pending"]);

// Contains substring (all equivalent)
await User.where("email", "include", "@gmail.com");
await User.where("email", "contains", "@gmail.com");
await User.where("email", "$include", "@gmail.com");
await User.where("email", "$contains", "@gmail.com");
```

---

### WhereOptions\<T\>

Options for configuring query behavior.

**Definition:**
```typescript
interface WhereOptions<T> {
  where?: {
    [K in keyof InferAttributes<T>]?:
      | InferAttributes<T>[K]
      | { [op in QueryOperator]?: InferAttributes<T>[K] };
  };
  order?: "ASC" | "DESC";
  skip?: number;              // Alias of offset
  offset?: number;            // Number of records to skip
  limit?: number;             // Maximum records to return
  attributes?: (keyof InferAttributes<T>)[];  // Fields to select
  include?: {                 // Relationships to include
    [relation: string]: boolean | WhereOptions<any>;
  };
  _includeTrashed?: boolean;  // Include soft-deleted records
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `where` | `object` | Filter conditions with operator support |
| `order` | `"ASC" \| "DESC"` | Sort order |
| `skip` | `number` | Number of records to skip (alias: offset) |
| `offset` | `number` | Number of records to skip |
| `limit` | `number` | Maximum records to return |
| `attributes` | `string[]` | Specific fields to select |
| `include` | `object` | Relationships to include |
| `_includeTrashed` | `boolean` | Include soft-deleted records |

**Example:**

```typescript
const users = await User.where({ active: true }, {
  order: "DESC",
  skip: 20,
  limit: 10,
  attributes: ["id", "name", "email"],
  include: {
    orders: {
      where: { status: "completed" },
      limit: 5,
      order: "DESC",
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
declare posts: NonAttribute<Post[]>;

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
  declare author: NonAttribute<User | null>;
}

// Bad - foreign key not declared
class Post extends Table<Post> {
  @BelongsTo(() => User, "user_id")
  declare author: NonAttribute<User | null>;
}
```
