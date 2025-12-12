# Core Concepts

This guide explains the fundamental concepts of Dynamite ORM and how they work together to provide a powerful, type-safe interface for DynamoDB.

## Table of Contents

1. [Table Class](#table-class)
2. [Decorators Overview](#decorators-overview)
3. [Primary Keys](#primary-keys)
4. [Indexes](#indexes)
5. [Query Builder](#query-builder)
6. [Query Operators](#query-operators)
7. [Type System](#type-system)
8. [Data Flow](#data-flow)

---

## Table Class

The `Table` class is the base class for all your DynamoDB models. It provides both static methods for database operations and instance methods for working with individual records.

### Static vs Instance Methods

**Static methods** operate on the database directly:

```typescript
// Static methods - work with the database
const user = await User.create({ name: "John" });
const users = await User.where({ active: true });
const count = await User.update({ status: "active" }, { role: "admin" });
await User.delete({ id: "user-123" });
```

**Instance methods** work with individual model instances:

```typescript
// Instance methods - work with the model instance
const user = new User({ name: "John" });
await user.save();           // Save to database

user.name = "Jane";
await user.update({ name: "Jane" }); // Update fields

await user.destroy();        // Delete from database
```

### Basic Usage

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => true)
  declare active: CreationOptional<boolean>;
}

// Create
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
  // id and active are optional (CreationOptional)
});

// Read
const allUsers = await User.where({});
const activeUsers = await User.where({ active: true });

// Update
user.name = "Jane Doe";
await user.save();

// Delete
await user.destroy();
```

---

## Decorators Overview

Decorators are special functions that annotate class properties with metadata. Dynamite uses decorators to define table structure, validation rules, and relationships.

### Core Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@PrimaryKey()` | Defines the partition key | `@PrimaryKey() declare id: string;` |
| `@Index()` | Alias for PrimaryKey | `@Index() declare userId: string;` |
| `@IndexSort()` | Defines the sort key | `@IndexSort() declare timestamp: string;` |
| `@Name("custom")` | Custom column/table name | `@Name("user_email") declare email: string;` |

### Data Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@Default(value)` | Default value | `@Default(() => Date.now()) declare createdAt: number;` |
| `@Mutate(fn)` | Transform before save | `@Mutate(v => v.toLowerCase()) declare email: string;` |
| `@Validate(fn)` | Validate before save | `@Validate(v => v.length > 0) declare name: string;` |
| `@NotNull()` | Require non-null value | `@NotNull() declare email: string;` |

### Timestamp Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@CreatedAt()` | Auto-set on creation | `@CreatedAt() declare createdAt: string;` |
| `@UpdatedAt()` | Auto-set on update | `@UpdatedAt() declare updatedAt: string;` |

### Relationship Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@HasMany(Model, fk)` | One-to-many | `@HasMany(() => Order, "userId") declare orders: any;` |
| `@BelongsTo(Model, lk)` | Many-to-one | `@BelongsTo(() => User, "userId") declare user: any;` |

### Complete Example

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  Mutate,
  Validate,
  NotNull,
  CreatedAt,
  UpdatedAt,
  HasMany,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Mutate(v => v.trim())
  @Mutate(v => v.toLowerCase())
  @Validate(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Invalid email")
  declare email: string;

  @Validate(v => v.length >= 2 || "Name too short")
  @Validate(v => v.length <= 50 || "Name too long")
  declare name: string;

  @Default(() => 18)
  @Validate(v => v >= 0 || "Age must be positive")
  declare age: CreationOptional<number>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  @HasMany(() => Order, "userId")
  declare orders: NonAttribute<Order[]>;
}
```

---

## Primary Keys

Primary keys in DynamoDB consist of a **partition key** (required) and optionally a **sort key**. Dynamite uses the `@PrimaryKey` decorator to define the partition key.

### Simple Primary Key

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
}

// Query by primary key
const user = await User.first({ id: "user-123" });
```

### Composite Primary Key (Partition + Sort Key)

```typescript
class Order extends Table<Order> {
  @PrimaryKey()        // Partition key
  declare userId: string;

  @IndexSort()         // Sort key
  declare timestamp: string;

  declare total: number;
  declare status: string;
}

// Query by partition key
const userOrders = await Order.where({ userId: "user-123" });

// Query by partition + sort key
const recentOrders = await Order.where({
  userId: "user-123",
  timestamp: "2023-12-01"
});
```

### Auto-Generated Primary Keys

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare price: number;
}

// id is automatically generated
const product = await Product.create({
  name: "Widget",
  price: 9.99
});

console.log(product.id); // "550e8400-e29b-41d4-a716-446655440000"
```

---

## Indexes

DynamoDB supports Global Secondary Indexes (GSI) and Local Secondary Indexes (LSI) for efficient querying. Dynamite provides `@Index` and `@IndexSort` decorators.

### Global Secondary Index (GSI)

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Index()             // GSI partition key
  declare email: string;

  declare name: string;
  declare role: string;
}

// Query by email (GSI)
const user = await User.first({ email: "john@example.com" });
```

### Local Secondary Index (LSI)

```typescript
class Message extends Table<Message> {
  @PrimaryKey()        // Partition key
  declare chatId: string;

  @IndexSort()         // Sort key (LSI)
  declare timestamp: string;

  declare userId: string;
  declare content: string;
}

// Query chat messages sorted by timestamp
const messages = await Message.where(
  { chatId: "chat-123" },
  { order: "DESC", limit: 50 }
);
```

### Multiple Indexes

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @Index()             // GSI on category
  declare category: string;

  @IndexSort()         // Sort by price
  declare price: number;

  declare name: string;
  declare stock: number;
}

// Query products by category, sorted by price
const electronics = await Product.where(
  { category: "electronics" },
  { order: "ASC", limit: 10 }
);
```

---

## Query Builder

The query builder provides a fluent interface for constructing database queries. The main method is `where()`, which has multiple overloads for different use cases.

### Basic Queries

```typescript
// Get all records
const allUsers = await User.where({});

// Filter by field (equality)
const activeUsers = await User.where({ active: true });

// Multiple filters (AND condition)
const premiumUsers = await User.where({
  active: true,
  role: "premium"
});
```

### Field-Value Queries

```typescript
// Single field query
const adults = await User.where("age", 18);

// Array of values (IN operator)
const specificAges = await User.where("age", [25, 30, 35]);
```

### Query Options

```typescript
// Pagination
const users = await User.where({}, {
  limit: 10,
  skip: 20
});

// Sorting
const users = await User.where({}, {
  order: "DESC"
});

// Select specific fields
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Combined options
const users = await User.where(
  { active: true },
  {
    attributes: ["id", "name"],
    limit: 50,
    order: "ASC"
  }
);
```

### First and Last

```typescript
// Get first matching record
const firstUser = await User.first({ active: true });

// Get last matching record
const lastUser = await User.last({ active: true });

// First with options
const newestUser = await User.first({}, { order: "DESC" });

// Last with options
const oldestUser = await User.last({}, { order: "ASC" });
```

### Including Relationships

```typescript
// Load with related data
const usersWithOrders = await User.where({}, {
  include: {
    orders: {}
  }
});

// Nested relationships
const usersWithOrderItems = await User.where({}, {
  include: {
    orders: {
      include: {
        items: {}
      }
    }
  }
});

// Filtered relationships
const usersWithActiveOrders = await User.where({}, {
  include: {
    orders: {
      where: { status: "active" },
      limit: 5
    }
  }
});
```

---

## Query Operators

Query operators allow you to perform advanced filtering beyond simple equality checks.

### Comparison Operators

```typescript
// Equal (default)
const users = await User.where("age", "=", 25);
const users = await User.where("age", 25); // Same as above

// Not equal
const nonAdmins = await User.where("role", "!=", "admin");

// Less than
const minors = await User.where("age", "<", 18);

// Less than or equal
const seniors = await User.where("age", "<=", 65);

// Greater than
const highScores = await User.where("score", ">", 100);

// Greater than or equal
const adults = await User.where("age", ">=", 18);
```

### Array Operators

```typescript
// IN - value in array
const specificRoles = await User.where("role", "in", ["admin", "premium", "vip"]);

// NOT IN - value not in array
const regularUsers = await User.where("role", "not-in", ["admin", "moderator"]);
```

### String Operators

```typescript
// CONTAINS - string contains substring
const gmailUsers = await User.where("email", "contains", "gmail");

// BEGINS WITH - string starts with prefix
const johnUsers = await User.where("name", "begins-with", "John");
```

### Complete Examples

```typescript
// Complex query with operators
const premiumActiveUsers = await User.where(
  { role: "premium", active: true },
  { limit: 100, order: "DESC" }
);

// Range query
const youngAdults = await User.where("age", ">=", 18)
  .then(users => users.filter(u => u.age < 30));

// Pattern matching
const testEmails = await User.where("email", "contains", "@test.com");

// Multiple conditions
const results = await User.where({
  active: true,
  role: "customer"
});

const filteredResults = results.filter(user =>
  user.age >= 18 && user.age <= 65
);
```

---

## Type System

Dynamite's type system ensures type safety throughout your application. It provides special types for optional fields, computed properties, and relationships.

### CreationOptional

Marks fields as optional during creation but required in instances. **Always use for auto-generated fields**.

```typescript
import { Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Auto-generated ID - always CreationOptional
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Required fields
  declare name: string;
  declare email: string;

  // Default value - always CreationOptional
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Auto-set timestamps - always CreationOptional
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;
}

// TypeScript knows what's required
const user = await User.create({
  name: "John",
  email: "john@test.com"
  // id, role, createdAt, updatedAt are optional
});

// But all fields exist after creation
console.log(user.id);        // string (not undefined)
console.log(user.role);      // "customer"
console.log(user.createdAt); // "2023-12-01T10:30:00.000Z"
```

### NonAttribute

Excludes fields from database operations. Used for computed properties and virtual fields.

```typescript
import { Table, PrimaryKey, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare firstName: string;
  declare lastName: string;
  declare birthDate: string;

  // Computed properties (not stored in database)
  declare fullName: NonAttribute<string>;
  declare age: NonAttribute<number>;

  constructor(data?: any) {
    super(data);

    // Define computed properties
    Object.defineProperty(this, 'fullName', {
      get: () => `${this.firstName} ${this.lastName}`,
      enumerable: true
    });

    Object.defineProperty(this, 'age', {
      get: () => {
        const today = new Date();
        const birth = new Date(this.birthDate);
        return today.getFullYear() - birth.getFullYear();
      },
      enumerable: true
    });
  }
}

const user = await User.create({
  id: "user-1",
  firstName: "John",
  lastName: "Doe",
  birthDate: "1990-01-01"
});

console.log(user.fullName); // "John Doe" (computed, not stored)
console.log(user.age);      // 34 (computed, not stored)
```

### InferAttributes

Utility type that extracts all database-persisted attributes, excluding functions, relationships, and non-attributes.

```typescript
import { Table, InferAttributes } from "@arcaelas/dynamite";

class User extends Table<User> {
  declare id: string;
  declare name: string;
  declare email: string;
}

// Extract actual attributes
type UserAttrs = InferAttributes<User>;
// Result: { id: string; name: string; email: string; }

// Use in function parameters
async function updateUser(
  id: string,
  updates: Partial<InferAttributes<User>>
): Promise<User> {
  return await User.update(updates, { id });
}
```

### Relationship Types

```typescript
import {
  Table,
  PrimaryKey,
  HasMany,
  BelongsTo,
  NonAttribute
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  // One-to-many relationship
  @HasMany(() => Order, "userId")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare userId: string;
  declare total: number;

  // Many-to-one relationship
  @BelongsTo(() => User, "userId")
  declare user: NonAttribute<User | null>;
}

// Load with relationships
const users = await User.where({}, {
  include: { orders: {} }
});

// TypeScript knows the types
users[0].orders.forEach(order => {
  console.log(order.total); // number
});
```

### Complete Type Example

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  CreationOptional,
  NonAttribute,
  InferAttributes
} from "@arcaelas/dynamite";

class User extends Table<User> {
  // Auto-generated (CreationOptional)
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Required
  declare firstName: string;
  declare lastName: string;
  declare email: string;

  // Default value (CreationOptional)
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Auto-set timestamps (CreationOptional)
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Computed (NonAttribute)
  declare fullName: NonAttribute<string>;

  // Relationship (NonAttribute)
  @HasMany(() => Order, "userId")
  declare orders: NonAttribute<Order[]>;

  constructor(data?: any) {
    super(data);

    Object.defineProperty(this, 'fullName', {
      get: () => `${this.firstName} ${this.lastName}`,
      enumerable: true
    });
  }
}

// Type inference in action
type Creation = {
  firstName: string;    // Required
  lastName: string;     // Required
  email: string;        // Required
  id?: string;          // Optional (CreationOptional)
  role?: string;        // Optional (CreationOptional)
  createdAt?: string;   // Optional (CreationOptional)
  updatedAt?: string;   // Optional (CreationOptional)
  // fullName not included (NonAttribute)
  // orders not included (NonAttribute)
};

type Instance = {
  id: string;           // Required after creation
  firstName: string;
  lastName: string;
  email: string;
  role: string;         // Required after creation
  createdAt: string;    // Required after creation
  updatedAt: string;    // Required after creation
  fullName: string;     // Available but not stored
  orders: Order[];      // Available when included
};
```

---

## Data Flow

Understanding how data flows through Dynamite helps you use it effectively. Here's a comprehensive diagram:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW DIAGRAM                          │
└─────────────────────────────────────────────────────────────────────┘

1. MODEL DEFINITION
   ┌────────────────────────────────────────────────────────┐
   │ class User extends Table<User> {                       │
   │   @PrimaryKey() @Default(() => uuid())                 │
   │   declare id: CreationOptional<string>;                │
   │                                                         │
   │   @Mutate(v => v.toLowerCase())                        │
   │   @Validate(v => isEmail(v))                           │
   │   declare email: string;                               │
   │ }                                                       │
   └────────────────────────────────────────────────────────┘
                            ↓
2. DECORATOR REGISTRATION (at class definition time)
   ┌────────────────────────────────────────────────────────┐
   │ Metadata Store (WRAPPER)                               │
   │ ┌──────────────────────────────────────────────────┐   │
   │ │ User: {                                          │   │
   │ │   name: "User",                                  │   │
   │ │   columns: Map {                                 │   │
   │ │     "id" => {                                    │   │
   │ │       primaryKey: true,                          │   │
   │ │       default: () => uuid()                      │   │
   │ │     },                                           │   │
   │ │     "email" => {                                 │   │
   │ │       mutate: [v => v.toLowerCase()],            │   │
   │ │       validate: [v => isEmail(v)]                │   │
   │ │     }                                            │   │
   │ │   }                                              │   │
   │ │ }                                                │   │
   │ └──────────────────────────────────────────────────┘   │
   └────────────────────────────────────────────────────────┘
                            ↓
3. CREATE OPERATION
   ┌────────────────────────────────────────────────────────┐
   │ await User.create({                                    │
   │   email: "JOHN@EXAMPLE.COM"                            │
   │ })                                                     │
   └────────────────────────────────────────────────────────┘
                            ↓
4. CONSTRUCTOR PROCESSING
   ┌────────────────────────────────────────────────────────┐
   │ new User(data)                                         │
   │   ↓                                                    │
   │ Apply @Default decorators                              │
   │   id = uuid() → "550e8400-..."                         │
   │   ↓                                                    │
   │ Apply @Mutate decorators                               │
   │   email = "john@example.com" (lowercased)              │
   │   ↓                                                    │
   │ Apply @Validate decorators                             │
   │   email passes isEmail() check ✓                       │
   │   ↓                                                    │
   │ Apply @CreatedAt / @UpdatedAt                          │
   │   createdAt = "2023-12-01T10:30:00.000Z"               │
   │   updatedAt = "2023-12-01T10:30:00.000Z"               │
   └────────────────────────────────────────────────────────┘
                            ↓
5. SERIALIZATION
   ┌────────────────────────────────────────────────────────┐
   │ instance.toJSON()                                      │
   │   ↓                                                    │
   │ Extract attributes (exclude NonAttribute fields)       │
   │   {                                                    │
   │     id: "550e8400-...",                                │
   │     email: "john@example.com",                         │
   │     createdAt: "2023-12-01T10:30:00.000Z",             │
   │     updatedAt: "2023-12-01T10:30:00.000Z"              │
   │   }                                                    │
   └────────────────────────────────────────────────────────┘
                            ↓
6. PERSISTENCE
   ┌────────────────────────────────────────────────────────┐
   │ DynamoDB PutItem                                       │
   │   ↓                                                    │
   │ marshall(data) → DynamoDB format                       │
   │   {                                                    │
   │     id: { S: "550e8400-..." },                         │
   │     email: { S: "john@example.com" },                  │
   │     createdAt: { S: "2023-12-01T10:30:00.000Z" },      │
   │     updatedAt: { S: "2023-12-01T10:30:00.000Z" }       │
   │   }                                                    │
   └────────────────────────────────────────────────────────┘

QUERY FLOW
   ┌────────────────────────────────────────────────────────┐
   │ await User.where({ email: "john@example.com" })        │
   └────────────────────────────────────────────────────────┘
                            ↓
   ┌────────────────────────────────────────────────────────┐
   │ Build DynamoDB Query                                   │
   │   FilterExpression: "#email = :email"                  │
   │   ExpressionAttributeNames: { "#email": "email" }      │
   │   ExpressionAttributeValues: { ":email": "john..." }   │
   └────────────────────────────────────────────────────────┘
                            ↓
   ┌────────────────────────────────────────────────────────┐
   │ DynamoDB Scan/Query                                    │
   │   ↓                                                    │
   │ Retrieve items from database                           │
   └────────────────────────────────────────────────────────┘
                            ↓
   ┌────────────────────────────────────────────────────────┐
   │ Deserialization                                        │
   │   ↓                                                    │
   │ unmarshall(items) → Plain objects                      │
   │   ↓                                                    │
   │ new User(data) for each item                           │
   │   ↓                                                    │
   │ Apply computed properties (NonAttribute)               │
   └────────────────────────────────────────────────────────┘
                            ↓
   ┌────────────────────────────────────────────────────────┐
   │ Return User[] with full type safety                    │
   └────────────────────────────────────────────────────────┘

RELATIONSHIP LOADING
   ┌────────────────────────────────────────────────────────┐
   │ await User.where({}, { include: { orders: {} } })      │
   └────────────────────────────────────────────────────────┘
                            ↓
   ┌────────────────────────────────────────────────────────┐
   │ 1. Load users from User table                          │
   │ 2. For each user:                                      │
   │    - Extract userId                                    │
   │    - Query Order.where({ userId })                     │
   │    - Attach orders to user.orders                      │
   │ 3. Return users with orders populated                  │
   └────────────────────────────────────────────────────────┘
```

### Key Points

1. **Decorator Registration**: Happens once at class definition time
2. **Default Values**: Applied in constructor before validation
3. **Mutations**: Applied before validation, transforms data
4. **Validation**: Runs after mutations, can throw errors
5. **Timestamps**: Auto-set on create/update operations
6. **Serialization**: Excludes NonAttribute fields before persistence
7. **Relationships**: Loaded lazily through separate queries
8. **Type Safety**: Maintained throughout entire flow

---

## Summary

This guide covered the core concepts of Dynamite:

- **Table Class**: Base class with static and instance methods
- **Decorators**: Metadata annotations for structure and behavior
- **Primary Keys**: Partition and sort keys using @PrimaryKey and @IndexSort
- **Indexes**: GSI and LSI for efficient querying
- **Query Builder**: Fluent interface with where(), first(), last()
- **Query Operators**: =, !=, <, >, <=, >=, in, not-in, contains, begins-with
- **Type System**: CreationOptional, NonAttribute, InferAttributes for type safety
- **Data Flow**: How data moves through decorators to the database

For more advanced topics, see:
- [Advanced Queries](../examples/advanced.md)
- [API Reference](./table.md)
