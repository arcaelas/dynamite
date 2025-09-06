![Arcaelas Insiders](https://raw.githubusercontent.com/arcaelas/dist/main/banner/svg/dark.svg#gh-dark-mode-only)
![Arcaelas Insiders](https://raw.githubusercontent.com/arcaelas/dist/main/banner/svg/light.svg#gh-light-mode-only)

# @arcaelas/dynamite

> **A modern, decorator-first ORM for DynamoDB with TypeScript support**  
> Full-featured • Type-safe • Relationship support • Auto table creation • Zero boilerplate

<p align="center">
  <a href="https://www.npmjs.com/package/@arcaelas/dynamite"><img src="https://img.shields.io/npm/v/@arcaelas/dynamite?color=cb3837" alt="npm"></a>
  <img src="https://img.shields.io/bundlephobia/minzip/@arcaelas/dynamite?label=gzip" alt="size">
  <img src="https://img.shields.io/github/license/arcaelas/dynamite" alt="MIT">
  <img src="https://img.shields.io/badge/AWS%20SDK-v3-orange" alt="AWS SDK v3">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue" alt="TypeScript">
</p>

---

## 📚 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [📦 Installation](#-installation)
- [⚡ Basic Usage](#-basic-usage)
- [🎯 Decorators Reference](#-decorators-reference)
- [🔍 Query Operations](#-query-operations)
- [🔗 Relationships](#-relationships)
- [📝 TypeScript Types](#-typescript-types)
- [🛠️ Advanced Features](#-advanced-features)
- [⚙️ Configuration](#-configuration)
- [📖 API Reference](#-api-reference)
- [🔧 Development Setup](#-development-setup)
- [❓ Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

```typescript
import { 
  Table, 
  PrimaryKey, 
  Default, 
  CreatedAt, 
  UpdatedAt,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";
import { Dynamite } from "@arcaelas/dynamite";

// Configure connection
Dynamite.config({
  region: "us-east-1",
  // For local development
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
});

// Define your model
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Default(() => "")
  declare name: CreationOptional<string>;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt() 
  declare updatedAt: CreationOptional<string>;

  // Computed property (not stored in database)
  declare displayName: NonAttribute<string>;

  constructor(data?: any) {
    super(data);
    
    // Define computed property
    Object.defineProperty(this, 'displayName', {
      get: () => `${this.name} (${this.role})`,
      enumerable: true
    });
  }
}

// Use it!
const user = await User.create({
  name: "John Doe"
  // id, role, createdAt, updatedAt are optional (CreationOptional)
});

console.log(user.name); // "John Doe"
console.log(user.role); // "customer"
console.log(user.displayName); // "John Doe (customer)" 
console.log(user.createdAt); // "2023-12-01T10:30:00.000Z"
```

---

## 📦 Installation

```bash
npm install @arcaelas/dynamite

# Peer dependencies (if not already installed)
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

---

## ⚡ Basic Usage

### Table Definition

```typescript
import { 
  Table, 
  PrimaryKey, 
  Default, 
  Validate, 
  Mutate, 
  NotNull,
  Name 
} from "@arcaelas/dynamite";

@Name("custom_users") // Override table name
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string) || "Invalid email")
  declare email: string;

  @Default(() => "")
  declare name: string;

  @Default(() => 18)
  @Validate((value) => (value as number) >= 0 || "Age must be positive")
  declare age: number;

  @Default(() => true)
  declare active: boolean;

  @CreatedAt()
  declare createdAt: string;

  @UpdatedAt()
  declare updatedAt: string;
}
```

### CRUD Operations

```typescript
// CREATE
const user = await User.create({
  id: "user-123",
  email: "john@example.com",
  name: "John Doe",
  age: 25
});

// READ
const allUsers = await User.where({});
const activeUsers = await User.where({ active: true });
const userById = await User.first({ id: "user-123" });

// UPDATE
await User.update("user-123", { name: "John Smith" });
// or
user.name = "John Smith";
await user.save();

// DELETE
await User.delete("user-123");
// or
await user.destroy();
```

---

## 🎯 Decorators Reference

### Core Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@PrimaryKey()` | Primary key (partition key) | `@PrimaryKey() declare id: string;` |
| `@Index()` | Partition key (alias for PrimaryKey) | `@Index() declare userId: string;` |
| `@IndexSort()` | Sort key | `@IndexSort() declare timestamp: string;` |
| `@Name("custom")` | Custom column/table name | `@Name("user_email") declare email: string;` |

### Data Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@Default(value\|fn)` | Default value | `@Default(() => uuid()) declare id: string;` |
| `@Mutate(fn)` | Transform value | `@Mutate((v) => v.toLowerCase()) declare email: string;` |
| `@Validate(fn)` | Validation function | `@Validate((v) => v.length > 0 \|\| "Required") declare name: string;` |
| `@NotNull()` | Not null validation | `@NotNull() declare email: string;` |

### Timestamp Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@CreatedAt()` | Set on creation | `@CreatedAt() declare createdAt: string;` |
| `@UpdatedAt()` | Set on every update | `@UpdatedAt() declare updatedAt: string;` |

### Relationship Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@HasMany(Model, foreignKey)` | One-to-many | `@HasMany(() => Order, "user_id") declare orders: any;` |
| `@BelongsTo(Model, localKey)` | Many-to-one | `@BelongsTo(() => User, "user_id") declare user: any;` |

---

## 🔍 Query Operations

### Basic Queries

```typescript
// Get all records
const users = await User.where({});

// Filter by field
const activeUsers = await User.where({ active: true });
const johnUsers = await User.where({ name: "John" });

// Get first/last record
const firstUser = await User.first({ active: true });
const lastUser = await User.last({ active: true });
```

### Advanced Queries with Operators

```typescript
// Comparison operators
const adults = await User.where("age", ">=", 18);
const youngAdults = await User.where("age", "<", 30);
const specificAges = await User.where("age", "in", [25, 30, 35]);
const excludeAges = await User.where("age", "not-in", [16, 17]);

// String operators
const gmailUsers = await User.where("email", "contains", "gmail");
const usersByPrefix = await User.where("name", "begins-with", "John");

// Not equal
const nonAdmins = await User.where("role", "!=", "admin");
```

### Query Options

```typescript
// Pagination and limiting
const users = await User.where({}, {
  limit: 10,
  skip: 20
});

// Sorting
const users = await User.where({}, {
  order: "ASC"  // or "DESC"
});

// Select specific attributes
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});
```

### Method Chaining Alternative

```typescript
// Using query builder style
const users = await User
  .where("age", ">=", 18)
  .where("active", true);

// Complex conditions
const users = await User.where({
  age: 25,
  active: true,
  role: "customer"
});
```

---

## 🔗 Relationships

### Defining Relationships

```typescript
// User model
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Order, "user_id")
  declare orders: any;

  @HasMany(() => Review, "user_id") 
  declare reviews: any;
}

// Order model
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @BelongsTo(() => User, "user_id")
  declare user: any;

  @HasMany(() => OrderItem, "order_id")
  declare items: any;
}

// OrderItem model
class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare order_id: string;

  @NotNull()
  declare product_id: string;

  @BelongsTo(() => Order, "order_id")
  declare order: any;

  @BelongsTo(() => Product, "product_id")
  declare product: any;
}
```

### Loading Relationships

```typescript
// Load with relationships
const usersWithOrders = await User.where({}, {
  include: {
    orders: {}
  }
});

// Nested relationships
const usersWithCompleteData = await User.where({}, {
  include: {
    orders: {
      include: {
        items: {
          include: {
            product: {}
          }
        }
      }
    }
  }
});

// Filtered relationships
const usersWithRecentOrders = await User.where({}, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 5,
      order: "DESC"
    }
  }
});

// Relationship with specific attributes
const usersWithOrderSummary = await User.where({}, {
  include: {
    orders: {
      attributes: ["id", "total", "status"],
      where: { status: "completed" }
    }
  }
});
```

---

## 📝 TypeScript Types

Dynamite provides essential TypeScript types that are fundamental for proper model definition and type safety. These types help you define optional fields, exclude computed properties, and establish relationships.

### Core Types

#### `CreationOptional<T>`

Marks a field as optional during creation but required in the actual model instance. **Always use for auto-generated fields**: `id` (with @PrimaryKey), `createdAt` (@CreatedAt), `updatedAt` (@UpdatedAt), and any field with @Default decorator.

```typescript
import { Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Always CreationOptional - auto-generated ID
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Required fields during creation
  declare name: string;
  declare email: string;

  // Always CreationOptional - has default value
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Always CreationOptional - auto-set timestamps
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;
}

// Usage - TypeScript knows exactly what's required
const user = await User.create({
  name: "John Doe",      // Required
  email: "john@test.com" // Required
  // id, role, createdAt, updatedAt are automatically optional
});
```

**Rule of thumb**: Use `CreationOptional<T>` for:
- `@PrimaryKey()` with `@Default()` → Always optional
- `@CreatedAt()` → Always optional  
- `@UpdatedAt()` → Always optional
- Any field with `@Default()` → Always optional

#### `NonAttribute<T>`

Excludes a field from database operations while keeping it in the TypeScript interface. Used for computed properties, getters, or virtual fields.

```typescript
import { Table, PrimaryKey, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare firstName: string;
  declare lastName: string;
  declare birthDate: string;

  // Computed property - not stored in database
  declare fullName: NonAttribute<string>;
  declare age: NonAttribute<number>;

  // Getter methods as non-attributes
  declare getDisplayName: NonAttribute<() => string>;

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

    Object.defineProperty(this, 'getDisplayName', {
      value: () => this.fullName.toUpperCase(),
      enumerable: false
    });
  }
}

// Usage
const user = await User.create({
  id: "user-1",
  firstName: "John",
  lastName: "Doe",
  birthDate: "1990-01-01"
});

console.log(user.fullName); // "John Doe" (not stored in DB)
console.log(user.age); // 34 (computed)
console.log(user.getDisplayName()); // "JOHN DOE"
```

### Relationship Types

#### `HasMany<T>`

Defines a one-to-many relationship where the model can have multiple related instances.

```typescript
import { Table, PrimaryKey, HasMany, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;

  // One-to-many: User has many Orders
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;

  // One-to-many: User has many Reviews
  @HasMany(() => Review, "user_id")
  declare reviews: NonAttribute<HasMany<Review>>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;
  declare total: number;
  declare status: string;
}

class Review extends Table<Review> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;
  declare rating: number;
  declare comment: string;
}

// Usage
const userWithOrders = await User.where({ id: "user-1" }, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 10
    },
    reviews: {
      where: { rating: { $gte: 4 } }
    }
  }
});

// TypeScript knows these are arrays
console.log(userWithOrders[0].orders.length); // number
console.log(userWithOrders[0].reviews[0].rating); // number
```

#### `BelongsTo<T>`

Defines a many-to-one relationship where the model belongs to a single parent instance.

```typescript
import { Table, PrimaryKey, BelongsTo, NonAttribute } from "@arcaelas/dynamite";

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  // Foreign key
  @NotNull()
  declare user_id: string;

  @NotNull()
  declare category_id: string;

  declare total: number;
  declare status: string;

  // Many-to-one: Order belongs to User
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  // Many-to-one: Order belongs to Category
  @BelongsTo(() => Category, "category_id")
  declare category: NonAttribute<BelongsTo<Category>>;
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;
}

class Category extends Table<Category> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare description: string;
}

// Usage
const orderWithRelations = await Order.where({ id: "order-1" }, {
  include: {
    user: {
      attributes: ["id", "name", "email"]
    },
    category: {}
  }
});

// TypeScript knows these can be null or the related type
if (orderWithRelations[0].user) {
  console.log(orderWithRelations[0].user.name); // string
}
if (orderWithRelations[0].category) {
  console.log(orderWithRelations[0].category.name); // string
}
```

### Advanced Type Combinations

#### Complete Model Example

```typescript
import { 
  Table, 
  PrimaryKey, 
  Default, 
  CreatedAt, 
  UpdatedAt,
  HasMany,
  BelongsTo,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

class User extends Table<User> {
  // Always CreationOptional - auto-generated primary key
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Required fields during creation
  declare firstName: string;
  declare lastName: string;
  declare email: string;

  // Always CreationOptional - has default values
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  // Always CreationOptional - auto-set timestamps
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Computed properties (not stored)
  declare fullName: NonAttribute<string>;
  declare displayRole: NonAttribute<string>;

  // Relationships (not stored directly)
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;

  @HasMany(() => Review, "user_id")
  declare reviews: NonAttribute<HasMany<Review>>;

  constructor(data?: any) {
    super(data);

    // Define computed properties
    Object.defineProperty(this, 'fullName', {
      get: () => `${this.firstName} ${this.lastName}`,
      enumerable: true
    });

    Object.defineProperty(this, 'displayRole', {
      get: () => this.role.charAt(0).toUpperCase() + this.role.slice(1),
      enumerable: true
    });
  }
}

class Order extends Table<Order> {
  // Always CreationOptional - auto-generated ID
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Required field during creation
  declare user_id: string;
  declare total: number;
  
  // Always CreationOptional - has default value
  @Default(() => "pending")
  declare status: CreationOptional<string>;

  // Always CreationOptional - auto-set timestamp
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  // Relationship
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  // Computed total with tax
  declare totalWithTax: NonAttribute<number>;

  constructor(data?: any) {
    super(data);

    Object.defineProperty(this, 'totalWithTax', {
      get: () => this.total * 1.1, // 10% tax
      enumerable: true
    });
  }
}

// Perfect TypeScript inference
const createUser = async () => {
  // TypeScript knows what's required vs optional
  const user = await User.create({
    firstName: "John",     // required
    lastName: "Doe",       // required  
    email: "john@test.com" // required
    // id, role, active, createdAt, updatedAt are optional
  });

  // Computed properties work immediately
  console.log(user.fullName); // "John Doe"
  console.log(user.displayRole); // "Customer"

  return user;
};

// Load with relationships
const getUserWithOrders = async (userId: string) => {
  const users = await User.where({ id: userId }, {
    include: {
      orders: {
        include: {
          user: {} // Recursive relationship
        }
      }
    }
  });

  const user = users[0];
  if (user?.orders?.length > 0) {
    console.log(`${user.fullName} has ${user.orders.length} orders`);
    user.orders.forEach(order => {
      console.log(`Order ${order.id}: $${order.totalWithTax}`);
    });
  }

  return user;
};
```

### Type Inference Benefits

```typescript
// TypeScript will infer all the correct types
type UserCreationAttributes = {
  firstName: string;    // Required
  lastName: string;     // Required
  email: string;        // Required
  // All these are automatically optional (CreationOptional):
  id?: string;          // @PrimaryKey + @Default
  role?: string;        // @Default
  active?: boolean;     // @Default  
  createdAt?: string;   // @CreatedAt (always optional)
  updatedAt?: string;   // @UpdatedAt (always optional)
};

type UserAttributes = {
  // All these exist in the instance (required after creation)
  id: string;           // CreationOptional but exists after creation
  firstName: string;
  lastName: string;
  email: string;
  role: string;         // CreationOptional but exists after creation
  active: boolean;      // CreationOptional but exists after creation
  createdAt: string;    // CreationOptional but exists after creation  
  updatedAt: string;    // CreationOptional but exists after creation
  fullName: string;     // NonAttribute computed property
  displayRole: string;  // NonAttribute computed property
  orders: Order[];      // HasMany relationship (NonAttribute)
  reviews: Review[];    // HasMany relationship (NonAttribute)
};

// Perfect type safety
const user: UserAttributes = await User.create({
  firstName: "John",
  lastName: "Doe", 
  email: "john@example.com"
} satisfies UserCreationAttributes);
```

---

## 🛠️ Advanced Features

### Data Validation and Transformation

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // Multiple transformations (executed in order)
  @Mutate((value) => (value as string).trim())
  @Mutate((value) => (value as string).toLowerCase())
  @Validate((value) => /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(value as string) || "Invalid email format")
  declare email: string;

  // Complex validation
  @Validate((value) => {
    const age = value as number;
    if (age < 0) return "Age cannot be negative";
    if (age > 150) return "Age seems unrealistic";
    return true;
  })
  declare age: number;

  // Multiple validators
  @Validate((value) => (value as string).length >= 2 || "Name too short")
  @Validate((value) => (value as string).length <= 50 || "Name too long")
  @Validate((value) => /^[a-zA-Z\s]+$/.test(value as string) || "Name can only contain letters and spaces")
  declare name: string;
}
```

### Custom Table Names

```typescript
// Table name override
@Name("custom_table_name")
class MyModel extends Table<MyModel> {
  @PrimaryKey()
  declare id: string;

  // Column name override
  @Name("custom_column")
  declare myField: string;
}
```

### Complex Queries

```typescript
// Multiple conditions
const users = await User.where({
  age: 25,
  active: true,
  role: "premium"
});

// Range queries
const users = await User.where("createdAt", ">=", "2023-01-01");

// Array filtering
const premiumUsers = await User.where("role", "in", ["admin", "premium", "vip"]);

// Pattern matching
const testUsers = await User.where("email", "contains", "@test.com");
```

### Batch Operations

```typescript
// Batch create
const users = await Promise.all([
  User.create({ id: "1", name: "User 1" }),
  User.create({ id: "2", name: "User 2" }),
  User.create({ id: "3", name: "User 3" })
]);

// Batch update
await Promise.all(users.map(user => {
  user.active = false;
  return user.save();
}));
```

---

## ⚙️ Configuration

### Connection Setup

```typescript
import { Dynamite } from "@arcaelas/dynamite";

// AWS DynamoDB
Dynamite.config({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

// DynamoDB Local
Dynamite.config({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// With custom configuration
Dynamite.config({
  region: "us-east-1",
  endpoint: "https://dynamodb.us-east-1.amazonaws.com",
  credentials: {
    accessKeyId: "your-key",
    secretAccessKey: "your-secret"
  },
  maxAttempts: 3,
  requestTimeout: 3000
});
```

### Environment Variables

```bash
# .env file
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
DYNAMODB_ENDPOINT=http://localhost:8000  # for local development
```

```typescript
// Load from environment
Dynamite.config({
  region: process.env.AWS_REGION!,
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});
```

### Docker Setup for Development

```bash
# Start DynamoDB Local
docker run -d -p 8000:8000 amazon/dynamodb-local

# Or with Docker Compose
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  dynamodb-local:
    image: amazon/dynamodb-local
    ports:
      - "8000:8000"
    command: ["-jar", "DynamoDBLocal.jar", "-sharedDb", "-dbPath", "/home/dynamodblocal/data/"]
    volumes:
      - dynamodb_data:/home/dynamodblocal/data
    working_dir: /home/dynamodblocal

volumes:
  dynamodb_data:
```

---

## 📖 API Reference

### Table Class Methods

#### Static Methods

```typescript
// CRUD Operations
static async create<T>(data: Partial<InferAttributes<T>>): Promise<T>
static async update<T>(id: string, data: Partial<InferAttributes<T>>): Promise<T>
static async delete<T>(id: string): Promise<void>

// Query Methods  
static async where<T>(filters?: Partial<InferAttributes<T>>, options?: WhereOptions<T>): Promise<T[]>
static async where<T>(field: keyof InferAttributes<T>, value: any): Promise<T[]>
static async where<T>(field: keyof InferAttributes<T>, operator: QueryOperator, value: any): Promise<T[]>

static async first<T>(filters?: Partial<InferAttributes<T>>): Promise<T | undefined>
static async last<T>(filters?: Partial<InferAttributes<T>>): Promise<T | undefined>

// Utility Methods
static async count<T>(filters?: Partial<InferAttributes<T>>): Promise<number>
static async exists<T>(id: string): Promise<boolean>
```

#### Instance Methods

```typescript
// CRUD Operations
async save(): Promise<this>
async update(data: Partial<InferAttributes<T>>): Promise<this>
async destroy(): Promise<void>
async reload(): Promise<this>

// Serialization
toJSON(): Record<string, any>
```

### Query Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equal to (default) | `User.where("age", 25)` |
| `!=` | Not equal to | `User.where("status", "!=", "deleted")` |
| `<` | Less than | `User.where("age", "<", 18)` |
| `<=` | Less than or equal | `User.where("age", "<=", 65)` |
| `>` | Greater than | `User.where("score", ">", 100)` |
| `>=` | Greater than or equal | `User.where("age", ">=", 18)` |
| `in` | In array | `User.where("role", "in", ["admin", "user"])` |
| `not-in` | Not in array | `User.where("status", "not-in", ["banned", "deleted"])` |
| `contains` | String contains | `User.where("email", "contains", "gmail")` |
| `begins-with` | String starts with | `User.where("name", "begins-with", "John")` |

### Type Definitions

```typescript
// Core Types - Essential for model definition
type InferAttributes<T> = {
  [K in keyof T]: T[K] extends NonAttribute<any> ? never : T[K]
}

type CreationOptional<T> = T
// Marks fields as optional during creation but required in instances
// ALWAYS use for: @PrimaryKey + @Default, @CreatedAt, @UpdatedAt, any @Default
// Example: @CreatedAt() declare createdAt: CreationOptional<string>

type NonAttribute<T> = T  
// Excludes fields from database operations
// Example: declare fullName: NonAttribute<string>

// Relationship Types - Define model associations
type HasMany<T> = T[]
// One-to-many relationship: Parent has multiple children
// Example: @HasMany(() => Order, "user_id") declare orders: NonAttribute<HasMany<Order>>

type BelongsTo<T> = T | null
// Many-to-one relationship: Child belongs to parent
// Example: @BelongsTo(() => User, "user_id") declare user: NonAttribute<BelongsTo<User>>

// Query Types
type QueryOperator = "=" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "not-in" | "contains" | "begins-with"

type WhereOptions<T> = {
  limit?: number;
  skip?: number;
  order?: "ASC" | "DESC";
  attributes?: (keyof InferAttributes<T>)[];
  include?: {
    [K in keyof T]?: T[K] extends NonAttribute<HasMany<any> | BelongsTo<any>>
      ? IncludeOptions | {} 
      : never;
  };
}

type IncludeOptions = {
  where?: Record<string, any>;
  limit?: number;
  order?: "ASC" | "DESC";
  attributes?: string[];
  include?: Record<string, IncludeOptions | {}>;
}

// Creation and Update Types
type CreationAttributes<T> = {
  [K in keyof InferAttributes<T>]: InferAttributes<T>[K] extends CreationOptional<infer U> 
    ? U | undefined 
    : InferAttributes<T>[K]
}

type UpdateAttributes<T> = Partial<InferAttributes<T>>
```

---

## 🔧 Development Setup

### Project Structure

```
src/
├── core/
│   ├── client.ts      # Dynamite client configuration
│   ├── table.ts       # Base Table class
│   └── wrapper.ts     # Metadata management
├── decorators/
│   ├── index.ts       # @Index decorator
│   ├── primary_key.ts # @PrimaryKey decorator
│   ├── default.ts     # @Default decorator
│   ├── validate.ts    # @Validate decorator
│   ├── mutate.ts      # @Mutate decorator
│   ├── created_at.ts  # @CreatedAt decorator
│   ├── updated_at.ts  # @UpdatedAt decorator
│   ├── not_null.ts    # @NotNull decorator
│   ├── name.ts        # @Name decorator
│   ├── has_many.ts    # @HasMany decorator
│   └── belongs_to.ts  # @BelongsTo decorator
├── utils/
│   ├── relations.ts   # Relationship handling
│   ├── naming.ts      # Table/column naming
│   └── projection.ts  # Field projection
├── @types/
│   └── index.ts       # TypeScript definitions
└── index.ts           # Public API exports
```

### Running Tests

```bash
# Start DynamoDB Local
docker run -d -p 8000:8000 amazon/dynamodb-local

# Run tests
npm test

# Run specific test
npm test -- --testNamePattern="should handle relationships"

# Run with coverage
npm test -- --coverage
```

### Example Test

```typescript
describe("User Model", () => {
  beforeEach(async () => {
    // Setup test data
    await User.create({
      id: "test-user",
      email: "test@example.com",
      name: "Test User"
    });
  });

  it("should create user with defaults", async () => {
    const user = await User.create({
      id: "user-2",
      email: "user2@example.com"
    });

    expect(user.name).toBe("");
    expect(user.active).toBe(true);
    expect(user.createdAt).toBeDefined();
  });

  it("should validate email format", async () => {
    await expect(User.create({
      id: "user-3",
      email: "invalid-email"
    })).rejects.toThrow("Invalid email");
  });
});
```

---

## ❓ Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Metadata no encontrada` | Model imported before decorators executed | Ensure `connect()` runs first, avoid circular imports |
| `PartitionKey faltante` | No `@PrimaryKey()` or `@Index()` in model | Add primary key decorator |
| `Two keys can not have the same name` | PK & SK attribute name clash | Use different column names |
| `UnrecognizedClientException` | Wrong credentials or DynamoDB Local not running | Check credentials, start DynamoDB Local |
| `ValidationException` | Invalid attribute names or values | Check for reserved keywords, validate data |

### Performance Tips

```typescript
// Use attributes to limit returned data
const users = await User.where({}, {
  attributes: ["id", "name"] // Only return these fields
});

// Use pagination for large datasets
const users = await User.where({}, {
  limit: 100,
  skip: 0
});

// Prefer specific queries over scanning all records
const activeUsers = await User.where({ active: true }); // Good
const allUsers = (await User.where({})).filter(u => u.active); // Bad
```

### Debugging

```typescript
// Enable debug logging (if available)
Dynamite.config({
  region: "us-east-1",
  logger: console // Log all DynamoDB operations
});

// Log query parameters
const users = await User.where({ active: true });
console.log("Found users:", users.length);
```

### Best Practices

1. **Always define a primary key** with `@PrimaryKey()` or `@Index()`
2. **Use TypeScript strict mode** for better type safety
3. **Validate user input** with `@Validate()` decorators
4. **Use attributes selection** to limit data transfer
5. **Handle relationships carefully** to avoid N+1 queries
6. **Use transactions** for complex operations (if needed)
7. **Monitor DynamoDB costs** in production

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure tests pass: `npm test`
5. Commit changes: `git commit -m 'feat: add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Add tests for new features
- Update documentation
- Use conventional commits
- Ensure backward compatibility

---

**Made with ❤️ by [Miguel Alejandro](https://github.com/arcaelas) - [Arcaelas Insiders](https://github.com/arcaelas)**