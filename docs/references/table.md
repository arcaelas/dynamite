# Table API Reference

## Overview

The `Table` class is the base class for all models in Dynamite ORM. It provides a complete and typed API for CRUD operations, advanced queries, relationship management, and data manipulation in DynamoDB.

**Key Features:**
- Strict TypeScript typing
- Complete CRUD operations
- Flexible query system with multiple operators
- Support for HasMany, BelongsTo, HasOne, and ManyToMany relationships
- Automatic timestamp management (created_at/updated_at)
- Built-in validations and mutations
- Pagination and sorting
- Specific attribute selection
- Nested relationship includes

## Import

```typescript
import { Table } from '@arcaelas/dynamite';
```

## Model Definition

```typescript
import { Table, Name, PrimaryKey, NotNull, Default, CreatedAt, UpdatedAt } from '@arcaelas/dynamite';

@Name("users")
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  @Default(() => 25)
  declare age: number;

  @CreatedAt()
  declare created_at: string;

  @UpdatedAt()
  declare updated_at: string;
}
```

---

## Constructor

### `constructor(data: InferAttributes<T>)`

Creates a new instance of the model with the provided data.

**Parameters:**
- `data` - Object with the model's attributes (excludes relationships and methods)

**Characteristics:**
- Applies default values defined with `@Default()`
- Initializes properties declared in the model
- Does not automatically persist to the database (use `save()` to persist)

**Example:**

```typescript
const user = new User({
  id: "user-123",
  email: "john@example.com",
  name: "John Doe",
  age: 30
});

// To persist to the database
await user.save();
```

---

## Instance Methods

### `save(): Promise<boolean>`

Saves or updates the current record in the database.

**Behavior:**
- If the record has no `id` (or is `null`/`undefined`), creates a new record
- If the record has an `id`, updates the existing record
- Automatically updates the `updated_at` field if defined
- Sets `created_at` only on new records

**Returns:** `true` if the operation succeeded

**Example:**

```typescript
// Create new record
const user = new User({
  email: "jane@example.com",
  name: "Jane Smith"
});
await user.save(); // created_at and updated_at are set automatically

// Update existing record
user.name = "Jane Doe";
await user.save(); // Only updated_at is updated
```

---

### `update(patch: Partial<InferAttributes<T>>): Promise<boolean>`

Partially updates the record with the provided fields.

**Parameters:**
- `patch` - Object with the fields to update

**Returns:** `true` if the operation succeeded

**Example:**

```typescript
const user = await User.first({ id: "user-123" });
await user.update({
  name: "John Updated",
  age: 31
});

console.log(user.name); // "John Updated"
console.log(user.age);  // 31
```

---

### `destroy(): Promise<null>`

Deletes the current record from the database. If the model has `@DeleteAt()`, performs soft delete instead.

**Requirements:**
- The instance must have a valid `id`

**Returns:** `null`

**Example:**

```typescript
const user = await User.first({ id: "user-123" });
await user.destroy(); // Deletes the record from the database
```

---

### `forceDestroy(): Promise<null>`

Permanently deletes the record, ignoring soft delete.

**Example:**

```typescript
const user = await User.first({ id: "user-123" });
await user.forceDestroy(); // Permanently deletes, ignores @DeleteAt
```

---

### `attach<R>(Model, related_id, pivot_data?): Promise<void>`

Adds a ManyToMany relationship.

**Parameters:**
- `Model` - Related model class
- `related_id` - ID of the related record
- `pivot_data` - Optional additional data for the pivot table

**Example:**

```typescript
const user = await User.first({ id: "user-123" });
await user.attach(Role, "role-admin-id");

// With pivot data
await user.attach(Role, "role-editor-id", { granted_at: new Date().toISOString() });
```

---

### `detach<R>(Model, related_id): Promise<void>`

Removes a ManyToMany relationship.

**Example:**

```typescript
await user.detach(Role, "role-admin-id");
```

---

### `sync<R>(Model, related_ids): Promise<void>`

Synchronizes ManyToMany relationships. Adds new ones, removes missing ones, keeps common ones unchanged.

**Example:**

```typescript
// Set user roles to exactly: ['admin', 'editor']
await user.sync(Role, ["role-admin-id", "role-editor-id"]);
```

---

### `toJSON(): Record<string, any>`

Serializes the instance to a plain JSON object.

**Characteristics:**
- Includes all columns defined with decorators
- Excludes relationships (HasMany, BelongsTo)
- Triggers virtual getters defined in the model

**Returns:** Plain object with the model data

**Example:**

```typescript
const user = await User.first({ id: "user-123" });
const json = user.toJSON();

console.log(json);
// {
//   id: "user-123",
//   email: "john@example.com",
//   name: "John Doe",
//   age: 30,
//   created_at: "2025-01-15T10:30:00.000Z",
//   updated_at: "2025-01-15T10:30:00.000Z"
// }
```

---

## Static Methods

### `create<M>(data: InferAttributes<M>, tx?: TransactionContext): Promise<M>`

Creates and persists a new record in the database.

**Parameters:**
- `data` - Object with the attributes for the new record
- `tx` - (Optional) Transaction context for atomic operations

**Characteristics:**
- Creates a new instance
- Automatically sets `created_at` and `updated_at`
- Applies default values, validations, and mutations
- Persists immediately to DynamoDB

**Returns:** New persisted model instance

**Example:**

```typescript
const user = await User.create({
  id: "user-456",
  email: "alice@example.com",
  name: "Alice Wonder",
  age: 28
});

console.log(user.id); // "user-456"
console.log(user.created_at); // "2025-01-15T10:30:00.000Z"
```

---

### `update<M>(updates, filters, tx?: TransactionContext): Promise<number>`

Updates multiple records matching the filters.

**Parameters:**
- `updates` - Object with fields to update
- `filters` - Object with selection criteria
- `tx` - (Optional) Transaction context for atomic operations

**Returns:** Number of updated records

**Example:**

```typescript
const count = await User.update(
  { active: false, role: "suspended" },
  { status: "banned" }
);

console.log(`${count} users suspended`);
```

---

### `delete<M>(filters, tx?: TransactionContext): Promise<number>`

Deletes records matching the filters.

**Parameters:**
- `filters` - Object with selection criteria
- `tx` - (Optional) Transaction context for atomic operations

**Returns:** Number of deleted records

**Example:**

```typescript
const count = await User.delete({ id: "user-123" });
console.log(`${count} user(s) deleted`);
```

---

## where() Method - Advanced Queries

The `where()` method is the most versatile method for querying data, with multiple overloads and advanced options.

### Overload 1: `where(field, value): Promise<M[]>`

Searches records where a field equals a value.

```typescript
// Simple equality
const admins = await User.where("role", "admin");

// Implicit IN with array
const users = await User.where("role", ["admin", "employee"]);
```

---

### Overload 2: `where(field, operator, value): Promise<M[]>`

Searches records using a specific operator.

**Supported Operators:**

| Operator | Alias | Description | Example |
|----------|-------|-------------|---------|
| `"="` | `"$eq"` | Equal to | `where("age", "=", 25)` |
| `"!="` | `"$ne"`, `"<>"` | Not equal to | `where("status", "!=", "banned")` |
| `"<"` | `"$lt"` | Less than | `where("age", "<", 30)` |
| `"<="` | `"$lte"` | Less than or equal | `where("price", "<=", 100)` |
| `">"` | `"$gt"` | Greater than | `where("balance", ">", 1000)` |
| `">="` | `"$gte"` | Greater than or equal | `where("rating", ">=", 4)` |
| `"in"` | `"$in"` | Included in array | `where("status", "in", ["active", "pending"])` |
| `"include"` | `"contains"`, `"$include"`, `"$contains"` | Contains substring | `where("name", "contains", "John")` |
| `"attribute_exists"` | `"$exists"`, `"attribute-exists"` | Attribute exists | `where("email", "$exists", true)` |
| `"attribute_not_exists"` | `"$notExists"`, `"attribute-not-exists"` | Attribute not exists | `where("deleted_at", "$notExists", true)` |

**Examples:**

```typescript
// Numeric comparison
const youngUsers = await User.where("age", "<", 30);
const richUsers = await User.where("balance", ">", 1000);

// String comparison
const notBanned = await User.where("status", "!=", "banned");

// Array operators
const staff = await User.where("role", "in", ["admin", "employee"]);
```

---

### Overload 3: `where(filters): Promise<M[]>`

Searches records matching multiple fields (implicit AND operator).

```typescript
// Multiple conditions (AND)
const activeAdmins = await User.where({
  role: "admin",
  active: true,
  verified: true
});
```

---

### Overload 4: `where(filters, options): Promise<M[]>`

Searches records with advanced options for pagination, sorting, attribute selection, and relationship inclusion.

**Available Options:**

```typescript
interface WhereOptions<T> {
  order?: "ASC" | "DESC";        // Sorting
  skip?: number;                  // Number of records to skip
  offset?: number;                // Alias for skip
  limit?: number;                 // Maximum number of records to return
  attributes?: string[];          // Specific fields to select
  include?: {                     // Relationships to include
    [relation: string]: WhereOptions<any> | true;
  };
}
```

**Examples:**

```typescript
// Pagination and sorting
const users = await User.where({}, {
  limit: 10,
  skip: 20,
  order: "DESC"
});

// Specific attribute selection
const usernames = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Simple relationship inclusion
const usersWithOrders = await User.where({}, {
  include: {
    orders: true
  }
});

// Relationship inclusion with filters
const usersWithCompletedOrders = await User.where({}, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 5,
      order: "DESC"
    }
  }
});

// Nested relationships
const ordersWithDetails = await Order.where({}, {
  include: {
    user: true,
    items: {
      include: {
        product: {
          include: {
            category: true
          }
        }
      }
    }
  }
});
```

---

### `first<M>(...args): Promise<M | undefined>`

Gets the first record matching the criteria.

**Overloads:**
- `first(field, value): Promise<M | undefined>`
- `first(field, operator, value): Promise<M | undefined>`
- `first(filters): Promise<M | undefined>`

**Example:**

```typescript
const user = await User.first("id", "user-123");
if (user) {
  console.log(user.name);
}

const activeAdmin = await User.first({
  role: "admin",
  active: true
});
```

---

### `last<M>(...args): Promise<M | undefined>`

Gets the last record matching the criteria.

**Example:**

```typescript
const latestUser = await User.last({});
const lastOrder = await Order.last({ user_id: "user-123" });
```

---

### `withTrashed<M>(filters?, options?): Promise<M[]>`

Includes soft-deleted records in the query.

```typescript
const all = await User.withTrashed({});
```

---

### `onlyTrashed<M>(filters?, options?): Promise<M[]>`

Gets only soft-deleted records.

```typescript
const deleted = await User.onlyTrashed({});
```

---

## Type Inference

### InferAttributes<T>

Extracts only attributes (excludes methods and relationships).

```typescript
import type { InferAttributes } from '@arcaelas/dynamite';

type UserAttributes = InferAttributes<User>;

function createUser(data: InferAttributes<User>) {
  return User.create(data);
}
```

### CreationOptional<T>

Marks fields that are optional during creation (have default values).

```typescript
import { CreationOptional } from '@arcaelas/dynamite';

class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @Default(() => 0)
  declare stock: CreationOptional<number>;
}

// TypeScript allows omitting CreationOptional fields
await Product.create({
  id: "prod-123",
  name: "Product Name"
  // stock is optional
});
```

---

## Error Handling

### Common Errors

```typescript
// 1. Failed validation
try {
  await User.create({
    email: "invalid",
    name: "Test"
  });
} catch (error) {
  // ValidationError: Invalid email
}

// 2. Missing required field
try {
  await User.create({
    name: "Test"
    // email is @NotNull and missing
  });
} catch (error) {
  // ValidationError: email is required
}
```

---

## Performance and Optimization

### 1. Specific Attribute Selection

```typescript
// Good - Only necessary fields
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Bad - Gets all fields
const users = await User.where({});
```

### 2. Effective Pagination

```typescript
// Good - Use limit to avoid loading too many records
const users = await User.where({}, {
  limit: 20,
  skip: (page - 1) * 20
});
```

### 3. Selective Relationship Inclusion

```typescript
// Good - Only include necessary relationships with limits
const users = await User.where({}, {
  include: {
    orders: {
      limit: 5,
      order: "DESC"
    }
  }
});
```
