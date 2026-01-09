# Complete Guide to Decorators in Dynamite

This guide provides comprehensive documentation for all decorators available in Dynamite ORM, including practical examples, common patterns, and best practices.

## Table of Contents

1. [Introduction to Decorators](#introduction-to-decorators)
2. [@PrimaryKey - Primary Keys](#primarykey-primary-keys)
3. [@Index - GSI Configuration](#index-gsi-configuration)
4. [@IndexSort - LSI Configuration](#indexsort-lsi-configuration)
5. [@Default - Default Values](#default-default-values)
6. [@Validate - Validation Functions](#validate-validation-functions)
7. [@Mutate - Data Transformation](#mutate-data-transformation)
8. [@Serialize - Bidirectional Transformation](#serialize-bidirectional-transformation)
9. [@NotNull - Required Fields](#notnull-required-fields)
10. [@CreatedAt - Creation Timestamp](#createdat-creation-timestamp)
11. [@UpdatedAt - Update Timestamp](#updatedat-update-timestamp)
12. [@DeleteAt - Soft Delete](#deleteat-soft-delete)
13. [@Name - Custom Names](#name-custom-names)
14. [@HasMany - One to Many Relationships](#hasmany-one-to-many-relationships)
15. [@HasOne - One to One Relationships](#hasone-one-to-one-relationships)
16. [@BelongsTo - Many to One Relationships](#belongsto-many-to-one-relationships)
17. [@ManyToMany - Many to Many Relationships](#manytomany-many-to-many-relationships)
18. [Combining Multiple Decorators](#combining-multiple-decorators)
19. [Custom Decorator Patterns](#custom-decorator-patterns)
20. [Best Practices](#best-practices)

---

## Introduction to Decorators

Decorators in Dynamite are special functions that add metadata and behavior to classes and properties. They allow you to define database schemas in a declarative and type-safe manner.

### Basic Concepts

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Primary key decorator
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Simple field without decorators
  declare name: string;

  // Field with default value
  @Default(() => "customer")
  declare role: CreationOptional<string>;
}
```

### Types of Decorators

**Key Decorators:**
- `@PrimaryKey()` - Defines the primary key
- `@Index()` - Defines partition key (GSI)
- `@IndexSort()` - Defines sort key (LSI)

**Data Decorators:**
- `@Default()` - Sets default values
- `@Mutate()` - Transforms values before saving
- `@Serialize()` - Transforms values bidirectionally (DB <-> App)
- `@Validate()` - Validates values before saving
- `@NotNull()` - Marks fields as required

**Timestamp Decorators:**
- `@CreatedAt()` - Auto-timestamp on creation
- `@UpdatedAt()` - Auto-timestamp on update
- `@DeleteAt()` - Soft delete with timestamp

**Relationship Decorators:**
- `@HasMany()` - One to many relationship
- `@HasOne()` - One to one relationship
- `@BelongsTo()` - Many to one relationship
- `@ManyToMany()` - Many to many relationship

**Configuration Decorators:**
- `@Name()` - Custom names for tables/columns

---

## @PrimaryKey - Primary Keys

The `@PrimaryKey` decorator defines the table's primary key. It internally applies `@Index` and `@IndexSort` automatically.

### Syntax

```typescript
@PrimaryKey(): PropertyDecorator
```

### Simple Primary Key

```typescript
import { Table, PrimaryKey, CreationOptional, Default } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;
}

// Usage
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
  // id is optional (CreationOptional) and auto-generated
});

console.log(user.id); // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### Primary Key with Static Value

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare sku: string;

  declare name: string;
  declare price: number;
}

// Usage
const product = await Product.create({
  sku: "PROD-001",
  name: "Widget",
  price: 29.99
});
```

### Composite Primary Key (Partition + Sort)

Although `@PrimaryKey` applies both decorators, you can define composite keys manually:

```typescript
class Order extends Table<Order> {
  @Index()
  declare user_id: string;

  @IndexSort()
  declare order_date: string;

  declare total: number;
  declare status: string;
}

// Usage
const order = await Order.create({
  user_id: "user-123",
  order_date: new Date().toISOString(),
  total: 99.99,
  status: "pending"
});

// Queries by partition key
const user_orders = await Order.where({ user_id: "user-123" });

// Queries with sort key
const recent_orders = await Order.where({ user_id: "user-123" }, {
  order: "DESC",
  limit: 10
});
```

### Important Characteristics

```typescript
class Account extends Table<Account> {
  @PrimaryKey()
  declare account_id: string;
  // Automatically:
  // - Marked as @Index (partition key)
  // - Marked as @IndexSort (sort key)
  // - nullable = false (cannot be null)
  // - primaryKey = true in metadata
}
```

---

## @Index - GSI Configuration

The `@Index` decorator marks a property as **Partition Key**. It is fundamental for efficient queries in DynamoDB.

### Syntax

```typescript
@Index(): PropertyDecorator
```

### Simple Index

```typescript
class Customer extends Table<Customer> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Index()
  declare email: string;

  declare name: string;
  declare phone: string;
}

// Queries by email (partition key)
const customers = await Customer.where({ email: "john@example.com" });
```

### Global Secondary Index (GSI)

```typescript
class Article extends Table<Article> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Index()
  declare category: string;

  @Index()
  declare author_id: string;

  declare title: string;
  declare content: string;
  declare published_at: string;
}

// Queries by category
const tech_articles = await Article.where({ category: "technology" });

// Queries by author
const author_articles = await Article.where({ author_id: "author-123" });
```

### Decorator Validations

```typescript
class InvalidModel extends Table<InvalidModel> {
  @Index()
  declare field1: string;

  @Index() // Error: Only one @Index per table allowed
  declare field2: string;
  // Throws: "Table invalid_models already has a PartitionKey defined"
}
```

---

## @IndexSort - LSI Configuration

The `@IndexSort` decorator marks a property as **Sort Key**. It requires a Partition Key to be defined.

### Syntax

```typescript
@IndexSort(): PropertyDecorator
```

### Basic Sort Key

```typescript
class Message extends Table<Message> {
  @Index()
  declare conversation_id: string;

  @IndexSort()
  declare timestamp: string;

  declare sender_id: string;
  declare content: string;
}

// Create messages
await Message.create({
  conversation_id: "conv-123",
  timestamp: "2025-01-15T10:30:00Z",
  sender_id: "user-1",
  content: "Hello!"
});

// Queries ordered by timestamp
const messages = await Message.where({ conversation_id: "conv-123" }, {
  order: "ASC" // Ascending order by timestamp
});

// Most recent messages
const recent = await Message.where({ conversation_id: "conv-123" }, {
  order: "DESC",
  limit: 20
});
```

### Range Queries with Sort Key

```typescript
class Event extends Table<Event> {
  @Index()
  declare venue_id: string;

  @IndexSort()
  declare event_date: string;

  declare name: string;
  declare capacity: number;
}

// Events in a date range
const upcoming = await Event.where("event_date", ">=", "2025-01-01");
const past = await Event.where("event_date", "<", "2025-01-01");
```

### Local Secondary Index (LSI)

```typescript
class Transaction extends Table<Transaction> {
  @Index()
  declare account_id: string;

  @IndexSort()
  declare transaction_date: string;

  declare amount: number;
  declare type: string;
  declare description: string;
}

// Account transactions ordered by date
const transactions = await Transaction.where({ account_id: "acc-123" }, {
  order: "DESC",
  limit: 50
});

// Last transaction
const last_transaction = await Transaction.last({ account_id: "acc-123" });
```

### Validations

```typescript
class InvalidSort extends Table<InvalidSort> {
  @IndexSort() // Error: @Index required first
  declare date: string;
  // Throws: "Cannot define a SortKey without a PartitionKey"
}

class DuplicateSort extends Table<DuplicateSort> {
  @Index()
  declare id: string;

  @IndexSort()
  declare date1: string;

  @IndexSort() // Error: Only one @IndexSort allowed
  declare date2: string;
  // Throws: "Table already has a SortKey defined"
}
```

---

## @Default - Default Values

The `@Default` decorator sets static or dynamic default values for properties.

### Syntax

```typescript
@Default(value: any | (() => any)): PropertyDecorator
```

### Static Values

```typescript
class Settings extends Table<Settings> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Default("dark")
  declare theme: CreationOptional<string>;

  @Default(true)
  declare notifications: CreationOptional<boolean>;

  @Default(100)
  declare volume: CreationOptional<number>;

  @Default([])
  declare tags: CreationOptional<string[]>;
}

// Usage
const settings = await Settings.create({}); // All fields optional
console.log(settings.theme); // "dark"
console.log(settings.notifications); // true
console.log(settings.volume); // 100
console.log(settings.tags); // []
```

### Dynamic Values (Functions)

```typescript
class Document extends Table<Document> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Default(() => new Date().toISOString())
  declare created: CreationOptional<string>;

  @Default(() => `DOC-${Date.now()}`)
  declare code: CreationOptional<string>;

  @Default(() => Math.floor(Math.random() * 1000000))
  declare reference_number: CreationOptional<number>;
}

// Each instance gets unique values
const doc1 = await Document.create({});
const doc2 = await Document.create({});

console.log(doc1.id !== doc2.id); // true
console.log(doc1.code !== doc2.code); // true
```

### Complex Default Values

```typescript
class UserProfile extends Table<UserProfile> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Default(() => ({
    theme: "light",
    language: "en",
    timezone: "UTC"
  }))
  declare preferences: CreationOptional<Record<string, string>>;

  @Default(() => ({
    email: true,
    sms: false,
    push: true
  }))
  declare notifications: CreationOptional<Record<string, boolean>>;

  @Default(() => [])
  declare recent_searches: CreationOptional<string[]>;
}

// Usage
const profile = await UserProfile.create({});
console.log(profile.preferences); // { theme: "light", language: "en", ... }
console.log(profile.notifications); // { email: true, sms: false, push: true }
```

### Combining with CreationOptional

```typescript
import { CreationOptional } from "@arcaelas/dynamite";

class Task extends Table<Task> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string; // Required

  @Default(() => "pending")
  declare status: CreationOptional<string>; // Optional

  @Default(() => false)
  declare completed: CreationOptional<boolean>; // Optional

  @Default(() => new Date().toISOString())
  declare due_date: CreationOptional<string>; // Optional
}

// Only title is required
const task = await Task.create({ title: "Complete project" });
console.log(task.status); // "pending"
console.log(task.completed); // false
```

---

## @Validate - Validation Functions

The `@Validate` decorator allows defining custom validation functions that run before saving data.

### Syntax

```typescript
@Validate(validator: (value: unknown) => true | string): PropertyDecorator
@Validate(validators: Array<(value: unknown) => true | string>): PropertyDecorator
```

### Simple Validation

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Validate((value) => {
    const email = value as string;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || "Invalid email";
  })
  declare email: string;

  @Validate((value) => {
    const age = value as number;
    return age >= 18 || "Must be 18 or older";
  })
  declare age: number;
}

// Valid
const user1 = await User.create({
  id: "user-1",
  email: "john@example.com",
  age: 25
});

// Invalid - throws error
try {
  await User.create({
    id: "user-2",
    email: "invalid-email",
    age: 25
  });
} catch (error) {
  console.error(error.message); // "Invalid email"
}
```

### Multiple Validators

```typescript
class Password extends Table<Password> {
  @PrimaryKey()
  declare user_id: string;

  @Validate([
    (v) => (v as string).length >= 8 || "Minimum 8 characters",
    (v) => /[A-Z]/.test(v as string) || "Must contain uppercase",
    (v) => /[a-z]/.test(v as string) || "Must contain lowercase",
    (v) => /[0-9]/.test(v as string) || "Must contain number",
    (v) => /[^A-Za-z0-9]/.test(v as string) || "Must contain symbol"
  ])
  declare password: string;
}

// All validations must pass
try {
  await Password.create({
    user_id: "user-1",
    password: "weak"
  });
} catch (error) {
  console.error(error.message); // "Minimum 8 characters"
}

// Valid
await Password.create({
  user_id: "user-1",
  password: "Str0ng!Pass"
});
```

### Complex Validations

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare sku: string;

  @Validate((value) => {
    const price = value as number;
    if (price < 0) return "Price cannot be negative";
    if (price > 999999.99) return "Price is too high";
    if (!/^\d+(\.\d{1,2})?$/.test(price.toString())) {
      return "Price must have at most 2 decimal places";
    }
    return true;
  })
  declare price: number;

  @Validate((value) => {
    const stock = value as number;
    return Number.isInteger(stock) && stock >= 0 || "Stock must be a positive integer";
  })
  declare stock: number;

  @Validate((value) => {
    const url = value as string;
    try {
      new URL(url);
      return true;
    } catch {
      return "Invalid URL";
    }
  })
  declare image_url: string;
}
```

### Validations with Context

```typescript
class DateRange extends Table<DateRange> {
  @PrimaryKey()
  declare id: string;

  declare start_date: string;

  @Validate(function(value) {
    const end = new Date(value as string);
    const start = new Date(this.start_date);
    return end > start || "End date must be after start date";
  })
  declare end_date: string;
}
```

---

## @Mutate - Data Transformation

The `@Mutate` decorator transforms values before saving them to the database.

### Syntax

```typescript
@Mutate(transformer: (value: any) => any): PropertyDecorator
```

### Basic Transformations

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((v) => (v as string).toLowerCase().trim())
  declare email: string;

  @Mutate((v) => (v as string).trim())
  @Mutate((v) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase())
  declare name: string;

  @Mutate((v) => (v as string).replace(/\D/g, ""))
  declare phone: string;
}

// Usage
const user = await User.create({
  id: "user-1",
  email: "  JOHN@EXAMPLE.COM  ",
  name: "  jOhN dOe  ",
  phone: "+1 (555) 123-4567"
});

console.log(user.email); // "john@example.com"
console.log(user.name); // "John doe"
console.log(user.phone); // "15551234567"
```

### Multiple Transformations

Mutations are executed in declaration order:

```typescript
class Article extends Table<Article> {
  @PrimaryKey()
  declare id: string;

  @Mutate((v) => (v as string).trim())
  @Mutate((v) => (v as string).replace(/\s+/g, " "))
  @Mutate((v) => (v as string).substring(0, 200))
  declare title: string;

  @Mutate((v) => (v as string).trim())
  @Mutate((v) => (v as string).replace(/<[^>]*>/g, ""))
  @Mutate((v) => (v as string).substring(0, 5000))
  declare content: string;
}
```

### Numeric Transformations

```typescript
class Financial extends Table<Financial> {
  @PrimaryKey()
  declare transaction_id: string;

  @Mutate((v) => Math.round((v as number) * 100) / 100)
  declare amount: number;

  @Mutate((v) => Math.max(0, Math.min(100, v as number)))
  declare percentage: number;

  @Mutate((v) => Math.abs(v as number))
  declare quantity: number;
}

// Usage
const transaction = await Financial.create({
  transaction_id: "txn-1",
  amount: 123.456789,
  percentage: 150,
  quantity: -10
});

console.log(transaction.amount); // 123.46
console.log(transaction.percentage); // 100
console.log(transaction.quantity); // 10
```

### Object Transformations

```typescript
class Settings extends Table<Settings> {
  @PrimaryKey()
  declare user_id: string;

  @Mutate((v) => {
    const config = v as Record<string, any>;
    return Object.keys(config).reduce((acc, key) => {
      acc[key.toLowerCase()] = config[key];
      return acc;
    }, {} as Record<string, any>);
  })
  declare preferences: Record<string, any>;

  @Mutate((v) => Array.from(new Set(v as string[])))
  declare tags: string[];
}
```

---

## @Serialize - Bidirectional Transformation

The `@Serialize` decorator allows transforming values in both directions: when reading from the database and when saving. Unlike `@Mutate` (write-only), `@Serialize` handles the complete data cycle conversion.

### Syntax

```typescript
@Serialize(fromDB: ((value: any) => any) | null, toDB?: ((value: any) => any) | null): PropertyDecorator
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `fromDB` | `Function \| null` | Transforms the value when reading from database. Use `null` to skip. |
| `toDB` | `Function \| null` | Transforms the value when saving to database. Use `null` to skip. |

### Bidirectional Transformation

```typescript
import { Serialize } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // Boolean stored as number in DynamoDB
  @Serialize(
    (from) => from === 1,     // DB: 1 -> App: true
    (to) => to ? 1 : 0        // App: true -> DB: 1
  )
  declare active: boolean;

  // JSON stored as string
  @Serialize(
    (from) => JSON.parse(from),           // DB: '{"a":1}' -> App: {a:1}
    (to) => JSON.stringify(to)            // App: {a:1} -> DB: '{"a":1}'
  )
  declare metadata: Record<string, any>;
}

// Usage
const user = await User.create({
  id: "user-1",
  active: true,        // Saved as 1 in DynamoDB
  metadata: { role: "admin" }  // Saved as '{"role":"admin"}'
});

// When reading
const fetched = await User.first({ id: "user-1" });
console.log(fetched.active);   // true (not 1)
console.log(fetched.metadata); // { role: "admin" } (not string)
```

### Transform Only on Save

Use `null` as the first parameter to skip transformation when reading:

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare sku: string;

  // Only normalize when saving, no transformation when reading
  @Serialize(null, (to) => (to as string).toUpperCase().trim())
  declare code: string;
}

// Code is saved in uppercase
await Product.create({ sku: "prod-1", code: "  abc123  " });
// In DB: code = "ABC123"
```

### Transform Only on Read

Omit the second parameter or use `null` to only transform when reading:

```typescript
class Settings extends Table<Settings> {
  @PrimaryKey()
  declare user_id: string;

  // Parse JSON only when reading (saved as string directly)
  @Serialize((from) => JSON.parse(from))
  declare preferences: Record<string, any>;

  // Convert timestamp to Date only when reading
  @Serialize((from) => new Date(from), null)
  declare last_login: Date;
}
```

### Common Use Cases

#### Encrypting Sensitive Data

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
}

class UserSecret extends Table<UserSecret> {
  @PrimaryKey()
  declare user_id: string;

  @Serialize(decrypt, encrypt)
  declare api_key: string;

  @Serialize(decrypt, encrypt)
  declare secret_token: string;
}
```

#### Data Compression

```typescript
import { gzipSync, gunzipSync } from "zlib";

class Document extends Table<Document> {
  @PrimaryKey()
  declare id: string;

  @Serialize(
    (from) => gunzipSync(Buffer.from(from, "base64")).toString(),
    (to) => gzipSync(to).toString("base64")
  )
  declare content: string;
}
```

#### DynamoDB Type Conversion

```typescript
class Analytics extends Table<Analytics> {
  @PrimaryKey()
  declare event_id: string;

  // DynamoDB Set to JavaScript Array
  @Serialize(
    (from) => Array.from(from),           // Set -> Array
    (to) => new Set(to)                   // Array -> Set
  )
  declare tags: string[];

  // BigInt for large numbers
  @Serialize(
    (from) => BigInt(from),
    (to) => to.toString()
  )
  declare large_number: bigint;
}
```

### Differences from @Mutate

| Feature | @Mutate | @Serialize |
|---------|---------|------------|
| Direction | Save only | Bidirectional |
| Parameters | One function | Two functions (fromDB, toDB) |
| Use case | Normalization | Type conversion |

```typescript
class Example extends Table<Example> {
  @PrimaryKey()
  declare id: string;

  // @Mutate: Only normalizes when saving
  @Mutate((v) => (v as string).toLowerCase())
  declare email: string;  // "JOHN@EXAMPLE.COM" -> "john@example.com" (write only)

  // @Serialize: Transforms in both directions
  @Serialize(
    (from) => from === 1,
    (to) => to ? 1 : 0
  )
  declare active: boolean;  // true <-> 1 (read and write)
}
```

---

## @NotNull - Required Fields

The `@NotNull` decorator marks fields as required, validating that they are not null, undefined, or empty strings.

### Syntax

```typescript
@NotNull(message?: string): PropertyDecorator
```

### Required Fields

```typescript
class Customer extends Table<Customer> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare phone: string;

  declare address: string; // Optional
}

// Valid
const customer1 = await Customer.create({
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234"
});

// Invalid - throws error
try {
  await Customer.create({
    name: "",
    email: "john@example.com",
    phone: "555-1234"
  });
} catch (error) {
  console.error("Validation failed"); // name is empty
}
```

### Combining with @Validate

```typescript
class Registration extends Table<Registration> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  @Mutate((v) => (v as string).toLowerCase().trim())
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Invalid email")
  declare email: string;

  @NotNull()
  @Validate((v) => (v as string).length >= 8 || "Minimum 8 characters")
  declare password: string;
}
```

### Validation on Arrays and Objects

```typescript
class Project extends Table<Project> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare title: string;

  @NotNull()
  @Validate((v) => Array.isArray(v) && v.length > 0 || "Must have at least one member")
  declare team_members: string[];

  @NotNull()
  @Validate((v) => {
    const config = v as Record<string, any>;
    return Object.keys(config).length > 0 || "Configuration cannot be empty";
  })
  declare config: Record<string, any>;
}
```

---

## @CreatedAt - Creation Timestamp

The `@CreatedAt` decorator automatically sets the creation date and time in ISO 8601 format.

### Syntax

```typescript
@CreatedAt(): PropertyDecorator
```

### Basic Usage

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// Date is set automatically
const post = await Post.create({
  title: "My first post",
  content: "Post content"
});

console.log(post.created_at); // "2025-01-15T10:30:00.123Z"
```

### Complete Auditing

```typescript
class AuditLog extends Table<AuditLog> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare action: string;
  declare resource: string;

  @CreatedAt()
  declare timestamp: CreationOptional<string>;

  declare ip_address: string;
  declare user_agent: string;
}

// Audit log with automatic timestamp
const log = await AuditLog.create({
  user_id: "user-123",
  action: "DELETE",
  resource: "document-456",
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0..."
});
```

### Queries by Date

```typescript
class Event extends Table<Event> {
  @Index()
  declare category: string;

  @IndexSort()
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  declare name: string;
  declare description: string;
}

// Recent events by category
const recent_events = await Event.where({ category: "news" }, {
  order: "DESC",
  limit: 20
});

// Events in a date range
const events = await Event.where("created_at", ">=", "2025-01-01T00:00:00Z");
```

---

## @UpdatedAt - Update Timestamp

The `@UpdatedAt` decorator automatically updates the date and time each time the record is saved.

### Syntax

```typescript
@UpdatedAt(): PropertyDecorator
```

### Basic Usage

```typescript
class Document extends Table<Document> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Creation
const doc = await Document.create({
  title: "Document",
  content: "Initial content"
});

console.log(doc.created_at); // "2025-01-15T10:00:00Z"
console.log(doc.updated_at); // "2025-01-15T10:00:00Z"

// Update
doc.content = "Updated content";
await doc.save();

console.log(doc.created_at); // "2025-01-15T10:00:00Z" (unchanged)
console.log(doc.updated_at); // "2025-01-15T10:15:00Z" (updated)
```

### Version System

```typescript
class Article extends Table<Article> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;
  declare author_id: string;

  @Default(() => 1)
  declare version: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  declare last_edited_by: string;
}

// Update with version
const article = await Article.first({ id: "article-123" });
if (article) {
  article.content = "New content";
  article.version = article.version + 1;
  article.last_edited_by = "user-456";
  await article.save();
  // updated_at is automatically updated
}
```

### Change Tracking

```typescript
class UserProfile extends Table<UserProfile> {
  @PrimaryKey()
  declare user_id: string;

  declare name: string;
  declare email: string;
  declare phone: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare last_modified: CreationOptional<string>;

  declare modification_count: number;
}

// Increment counter on each modification
const profile = await UserProfile.first({ user_id: "user-123" });
if (profile) {
  profile.name = "New Name";
  profile.modification_count = (profile.modification_count || 0) + 1;
  await profile.save();
  // last_modified is automatically updated
}
```

---

## @DeleteAt - Soft Delete

The `@DeleteAt` decorator marks a property as a soft delete column. When `destroy()` is called, instead of physically deleting the record, this column is set with an ISO 8601 timestamp.

### Syntax

```typescript
@DeleteAt(): PropertyDecorator
```

### Basic Usage

```typescript
import { DeleteAt } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @DeleteAt()
  declare deleted_at?: string;
}

// Create user
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
});

// Soft delete - does NOT delete the record, marks deleted_at
await user.destroy();

console.log(user.deleted_at); // "2025-01-15T10:30:00.123Z"
// The record remains in the database with deleted_at set
```

### Query Behavior

With `@DeleteAt`, normal queries automatically exclude soft-deleted records:

```typescript
class Article extends Table<Article> {
  @PrimaryKey()
  declare id: string;

  declare title: string;
  declare content: string;

  @DeleteAt()
  declare deleted_at?: string;
}

// Create articles
await Article.create({ id: "1", title: "Article 1", content: "..." });
await Article.create({ id: "2", title: "Article 2", content: "..." });
await Article.create({ id: "3", title: "Article 3", content: "..." });

// Soft delete one
const article = await Article.first({ id: "2" });
await article.destroy();

// Normal query - excludes soft-deleted automatically
const active = await Article.where({});
console.log(active.length); // 2 (articles 1 and 3)

// Include soft-deleted records
const all = await Article.withTrashed({});
console.log(all.length); // 3 (all)

// Only soft-deleted records
const deleted = await Article.onlyTrashed();
console.log(deleted.length); // 1 (article 2)
```

### Restore Records

```typescript
class Document extends Table<Document> {
  @PrimaryKey()
  declare id: string;

  declare title: string;

  @DeleteAt()
  declare deleted_at?: string;
}

// Soft delete
const doc = await Document.first({ id: "doc-1" });
await doc.destroy();

// Restore
const deleted_doc = await Document.withTrashed({ id: "doc-1" });
if (deleted_doc[0]) {
  deleted_doc[0].deleted_at = undefined;
  await deleted_doc[0].save();
  // Document appears again in normal queries
}
```

### Trash System

```typescript
class File extends Table<File> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare path: string;
  declare owner_id: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at?: string;
}

// Move to trash
async function move_to_trash(file_id: string): Promise<void> {
  const file = await File.first({ id: file_id });
  if (file) await file.destroy();
}

// Empty trash (permanently delete)
async function empty_trash(owner_id: string): Promise<void> {
  const trashed = await File.onlyTrashed();
  const user_trashed = trashed.filter(f => f.owner_id === owner_id);

  for (const file of user_trashed) {
    // Force permanent deletion
    await File.delete({ id: file.id });
  }
}

// Restore from trash
async function restore_from_trash(file_id: string): Promise<void> {
  const files = await File.withTrashed({ id: file_id });
  if (files[0]?.deleted_at) {
    files[0].deleted_at = undefined;
    await files[0].save();
  }
}

// List trash
async function list_trash(owner_id: string): Promise<File[]> {
  const trashed = await File.onlyTrashed();
  return trashed.filter(f => f.owner_id === owner_id);
}
```

### Combining with Timestamps

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at?: string;
}

// Complete lifecycle
const post = await Post.create({
  title: "My Post",
  content: "Content"
});
// created_at = "2025-01-15T10:00:00Z"
// updated_at = "2025-01-15T10:00:00Z"
// deleted_at = undefined

post.title = "Updated Title";
await post.save();
// updated_at = "2025-01-15T11:00:00Z"

await post.destroy();
// deleted_at = "2025-01-15T12:00:00Z"
```

### Soft Delete in Transactions

```typescript
const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User, Order]
});

await dynamite.connect();

// Atomic soft delete of user and their orders
await dynamite.tx(async (tx) => {
  const user = await User.first({ id: "user-123" });
  const orders = await Order.where({ user_id: "user-123" });

  // Soft delete all orders
  for (const order of orders) {
    await order.destroy(tx);
  }

  // Soft delete user
  await user.destroy(tx);
});
```

### Automatic Characteristics

When applying `@DeleteAt`:

1. **nullable = true**: The column is automatically marked as nullable
2. **softDelete = true**: Activates soft delete behavior in `destroy()`
3. **Automatic filtering**: `where()` excludes records with `deleted_at` set
4. **Additional methods**: Enables `withTrashed()` and `onlyTrashed()`

---

## @Name - Custom Names

The `@Name` decorator allows customizing table and column names in the database.

### Syntax

```typescript
@Name(name: string): ClassDecorator & PropertyDecorator
```

### Custom Table Name

```typescript
@Name("custom_users_table")
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;
}

// Table is created with the name "custom_users_table"
```

### Custom Column Names

```typescript
class Customer extends Table<Customer> {
  @PrimaryKey()
  @Name("customer_id")
  declare id: string;

  @Name("full_name")
  declare name: string;

  @Name("email_address")
  declare email: string;

  @Name("phone_number")
  declare phone: string;
}

// In DynamoDB: { customer_id, full_name, email_address, phone_number }
```

### Legacy System Compatibility

```typescript
@Name("legacy_orders")
class Order extends Table<Order> {
  @PrimaryKey()
  @Name("ORDER_ID")
  declare id: string;

  @Name("CUSTOMER_ID")
  declare customer_id: string;

  @Name("ORDER_DATE")
  declare order_date: string;

  @Name("TOTAL_AMOUNT")
  declare total: number;

  @Name("ORDER_STATUS")
  declare status: string;
}
```

---

## @HasMany - One to Many Relationships

The `@HasMany` decorator defines relationships where one model has multiple instances of another model.

### Syntax

```typescript
@HasMany(model: () => Model, foreignKey: string, localKey?: string): PropertyDecorator
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `() => Model` | Function that returns the related model class |
| `foreignKey` | `string` | Foreign key in the related model |
| `localKey` | `string` | Local key (default: `'id'`) |

### Basic Relationship

```typescript
import { HasMany, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;

  @HasMany(() => Order, "user_id", "id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  declare total: number;
  declare status: string;
}

// Load user with orders
const users = await User.where({ id: "user-123" }, {
  include: {
    orders: {}
  }
});

console.log(users[0].orders); // Order[]
```

### Filtered Relationships

```typescript
// Get user with completed orders
const users = await User.where({ id: "user-123" }, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 10,
      order: "DESC"
    }
  }
});
```

### Nested Relationships

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  @HasMany(() => Order, "user_id", "id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;
  declare total: number;

  @HasMany(() => OrderItem, "order_id", "id")
  declare items: NonAttribute<OrderItem[]>;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  declare order_id: string;
  declare product_id: string;
  declare quantity: number;
  declare price: number;
}

// Load users with orders and items
const users = await User.where({}, {
  include: {
    orders: {
      include: {
        items: {}
      }
    }
  }
});
```

---

## @HasOne - One to One Relationships

The `@HasOne` decorator defines relationships where one model has exactly one instance of another model.

### Syntax

```typescript
@HasOne(model: () => Model, foreignKey: string, localKey?: string): PropertyDecorator
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `() => Model` | Function that returns the related model class |
| `foreignKey` | `string` | Foreign key in the related model |
| `localKey` | `string` | Local key (default: `'id'`) |

### Basic Relationship

```typescript
import { HasOne, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;

  @HasOne(() => Profile, "user_id", "id")
  declare profile: NonAttribute<Profile | null>;
}

class Profile extends Table<Profile> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  declare bio: string;
  declare avatar_url: string;
  declare website: string;
}

// Load user with profile
const users = await User.where({ id: "user-123" }, {
  include: {
    profile: {}
  }
});

console.log(users[0].profile?.bio); // "Software developer..."
```

### User with Settings

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  @HasOne(() => UserSettings, "user_id", "id")
  declare settings: NonAttribute<UserSettings | null>;
}

class UserSettings extends Table<UserSettings> {
  @PrimaryKey()
  declare user_id: string;

  declare theme: string;
  declare language: string;
  declare notifications_enabled: boolean;
}

// Load user with settings
const user = await User.first({ id: "user-123" }, {
  include: {
    settings: {}
  }
});

if (user?.settings) {
  console.log(user.settings.theme); // "dark"
}
```

---

## @BelongsTo - Many to One Relationships

The `@BelongsTo` decorator defines relationships where a model belongs to another model.

### Syntax

```typescript
@BelongsTo(model: () => Model, localKey: string, foreignKey?: string): PropertyDecorator
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `() => Model` | Function that returns the related model class |
| `localKey` | `string` | Local key that references the parent model |
| `foreignKey` | `string` | Key in the parent model (default: `'id'`) |

### Basic Relationship

```typescript
import { BelongsTo, NonAttribute } from "@arcaelas/dynamite";

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  declare total: number;
  declare status: string;

  @BelongsTo(() => User, "user_id", "id")
  declare user: NonAttribute<User | null>;
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;
}

// Load order with user
const orders = await Order.where({ id: "order-123" }, {
  include: {
    user: {}
  }
});

console.log(orders[0].user?.name); // "John Doe"
```

### Multiple Relationships

```typescript
class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  declare order_id: string;
  declare product_id: string;
  declare quantity: number;

  @BelongsTo(() => Order, "order_id", "id")
  declare order: NonAttribute<Order | null>;

  @BelongsTo(() => Product, "product_id", "id")
  declare product: NonAttribute<Product | null>;
}

// Load item with order and product
const items = await OrderItem.where({ id: "item-123" }, {
  include: {
    order: {},
    product: {}
  }
});
```

---

## @ManyToMany - Many to Many Relationships

The `@ManyToMany` decorator defines relationships where multiple instances of one model can be associated with multiple instances of another model through a pivot table.

### Syntax

```typescript
@ManyToMany(
  model: () => Model,
  pivotTable: string,
  foreignKey: string,
  relatedKey: string,
  localKey?: string,
  relatedPK?: string
): PropertyDecorator
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `() => Model` | Function that returns the related model class |
| `pivotTable` | `string` | Name of the pivot table |
| `foreignKey` | `string` | Foreign key in pivot table pointing to current model |
| `relatedKey` | `string` | Foreign key in pivot table pointing to related model |
| `localKey` | `string` | Local key (default: `'id'`) |
| `relatedPK` | `string` | Related model's primary key (default: `'id'`) |

### Basic Relationship

```typescript
import { ManyToMany, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;

  @ManyToMany(() => Role, "users_roles", "user_id", "role_id", "id", "id")
  declare roles: NonAttribute<Role[]>;
}

class Role extends Table<Role> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare permissions: string[];

  @ManyToMany(() => User, "users_roles", "role_id", "user_id", "id", "id")
  declare users: NonAttribute<User[]>;
}

// Load user with roles
const users = await User.where({ id: "user-123" }, {
  include: {
    roles: {}
  }
});

console.log(users[0].roles); // Role[]
```

### Tags System

```typescript
class Article extends Table<Article> {
  @PrimaryKey()
  declare id: string;

  declare title: string;
  declare content: string;

  @ManyToMany(() => Tag, "articles_tags", "article_id", "tag_id", "id", "id")
  declare tags: NonAttribute<Tag[]>;
}

class Tag extends Table<Tag> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare slug: string;

  @ManyToMany(() => Article, "articles_tags", "tag_id", "article_id", "id", "id")
  declare articles: NonAttribute<Article[]>;
}

// Load articles with tags
const articles = await Article.where({}, {
  include: {
    tags: {}
  }
});

// Load tag with articles
const tags = await Tag.where({ slug: "javascript" }, {
  include: {
    articles: {
      limit: 10,
      order: "DESC"
    }
  }
});
```

### Course Enrollment System

```typescript
class Student extends Table<Student> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;

  @ManyToMany(() => Course, "enrollments", "student_id", "course_id", "id", "id")
  declare courses: NonAttribute<Course[]>;
}

class Course extends Table<Course> {
  @PrimaryKey()
  declare id: string;

  declare title: string;
  declare instructor_id: string;

  @ManyToMany(() => Student, "enrollments", "course_id", "student_id", "id", "id")
  declare students: NonAttribute<Student[]>;
}

// Load student with enrolled courses
const student = await Student.first({ id: "student-123" }, {
  include: {
    courses: {}
  }
});

console.log(student?.courses); // Course[]
```

---

## Combining Multiple Decorators

### Complete Model with All Decorators

```typescript
import {
  Table,
  PrimaryKey,
  Index,
  IndexSort,
  Default,
  Validate,
  Mutate,
  Serialize,
  NotNull,
  CreatedAt,
  UpdatedAt,
  DeleteAt,
  Name,
  HasMany,
  HasOne,
  BelongsTo,
  ManyToMany,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

@Name("users")
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Mutate((v) => (v as string).toLowerCase().trim())
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Invalid email")
  @Name("email_address")
  declare email: string;

  @NotNull()
  @Mutate((v) => (v as string).trim())
  @Validate([
    (v) => (v as string).length >= 2 || "Name too short",
    (v) => (v as string).length <= 50 || "Name too long"
  ])
  declare name: string;

  @Default(() => 18)
  @Validate((v) => (v as number) >= 0 && (v as number) <= 150 || "Invalid age")
  declare age: CreationOptional<number>;

  @Default(() => "customer")
  @Validate((v) => ["customer", "admin", "moderator"].includes(v as string) || "Invalid role")
  declare role: CreationOptional<string>;

  @Default(() => true)
  @Serialize(
    (from) => from === 1,
    (to) => to ? 1 : 0
  )
  declare active: CreationOptional<boolean>;

  @Serialize(
    (from) => JSON.parse(from),
    (to) => JSON.stringify(to)
  )
  declare preferences: CreationOptional<Record<string, any>>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at?: string;

  @HasOne(() => Profile, "user_id", "id")
  declare profile: NonAttribute<Profile | null>;

  @HasMany(() => Order, "user_id", "id")
  declare orders: NonAttribute<Order[]>;

  @HasMany(() => Review, "user_id", "id")
  declare reviews: NonAttribute<Review[]>;

  @ManyToMany(() => Role, "users_roles", "user_id", "role_id", "id", "id")
  declare roles: NonAttribute<Role[]>;

  // Computed property
  declare display_name: NonAttribute<string>;

  constructor(data?: any) {
    super(data);
    Object.defineProperty(this, 'display_name', {
      get: () => `${this.name} (${this.role})`,
      enumerable: true
    });
  }
}
```

---

## Custom Decorator Patterns

Dynamite exports two factory functions that allow creating custom decorators with full access to the metadata system: `decorator()` for properties and `relationDecorator()` for relationships.

### API of `decorator()`

```typescript
import { decorator, ColumnBuilder, WrapperEntry } from "@arcaelas/dynamite";

/**
 * @description Factory for creating property decorators
 * @param handler Function that receives (col: ColumnBuilder, args: Args, entry: WrapperEntry)
 * @returns Parameterized decorator function
 */
function decorator<Args extends any[] = []>(
  handler: (col: ColumnBuilder, args: Args, entry: WrapperEntry) => void
): (...args: Args) => PropertyDecorator;
```

### `ColumnBuilder` Class

The `ColumnBuilder` provides fluent access to column metadata:

```typescript
interface ColumnBuilder {
  // Column metadata
  name: string;           // Column name
  default: any;           // Default value
  index: boolean;         // Is partition key
  indexSort: boolean;     // Is sort key
  primaryKey: boolean;    // Is primary key
  nullable: boolean;      // Allows null
  unique: boolean;        // Unique values
  createdAt: boolean;     // Creation timestamp
  updatedAt: boolean;     // Update timestamp
  softDelete: boolean;    // Soft delete enabled
  serialize: { fromDB?: Function, toDB?: Function };

  // Transformation pipeline
  set(fn: (current: any, next: any) => any): this;  // Add setter
  get(fn: (current: any) => any): this;              // Add getter

  // Lazy validators
  lazy_validators: Array<(value: any) => boolean | string>;
}
```

### Create Simple Decorator

```typescript
import { decorator } from "@arcaelas/dynamite";

// Decorator without parameters
export const Uppercase = decorator((col) => {
  col.set((current, next) => {
    return typeof next === "string" ? next.toUpperCase() : next;
  });
});

// Usage
class User extends Table<User> {
  @Uppercase()
  declare country_code: string;
}

await User.create({ country_code: "us" });
// Saved as "US"
```

### Create Decorator with Parameters

```typescript
import { decorator } from "@arcaelas/dynamite";

// Decorator with typed parameters
export const MaxLength = decorator<[max: number]>((col, [max]) => {
  col.set((current, next) => {
    if (typeof next === "string" && next.length > max) {
      return next.substring(0, max);
    }
    return next;
  });
});

// Usage
class Comment extends Table<Comment> {
  @MaxLength(500)
  declare content: string;
}
```

### Create Decorator with Multiple Parameters

```typescript
import { decorator } from "@arcaelas/dynamite";

// Decorator with multiple optional parameters
export const Range = decorator<[min: number, max: number, clamp?: boolean]>(
  (col, [min, max, clamp = true]) => {
    col.set((current, next) => {
      if (typeof next !== "number") return next;
      if (clamp) {
        return Math.max(min, Math.min(max, next));
      }
      if (next < min || next > max) {
        throw new Error(`Value must be between ${min} and ${max}`);
      }
      return next;
    });
  }
);

// Usage
class Product extends Table<Product> {
  @Range(0, 100, true)    // Clamp values to [0, 100]
  declare discount: number;

  @Range(1, 1000, false)  // Throw error if out of range
  declare quantity: number;
}
```

### Decorator with Getter and Setter

```typescript
import { decorator } from "@arcaelas/dynamite";

// Bidirectional transformation (similar to @Serialize but customized)
export const JsonColumn = decorator((col) => {
  // On save: object -> JSON string
  col.set((current, next) => {
    if (next !== null && typeof next === "object") {
      return JSON.stringify(next);
    }
    return next;
  });

  // On read: JSON string -> object
  col.get((current) => {
    if (typeof current === "string") {
      try {
        return JSON.parse(current);
      } catch {
        return current;
      }
    }
    return current;
  });
});

// Usage
class Settings extends Table<Settings> {
  @JsonColumn()
  declare preferences: Record<string, any>;
}
```

### Decorator with Lazy Validation

Lazy validators are executed in `save()`, not in the setter:

```typescript
import { decorator } from "@arcaelas/dynamite";

export const UniqueEmail = decorator((col) => {
  // Normalize on save
  col.set((current, next) => {
    return typeof next === "string" ? next.toLowerCase().trim() : next;
  });

  // Lazy validation (executed in save())
  col.lazy_validators.push(async (value) => {
    // Here you could verify uniqueness in the database
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email_regex.test(value) || "Invalid email";
  });
});
```

### Decorator that Modifies Metadata

```typescript
import { decorator } from "@arcaelas/dynamite";

// Mark column as unique index
export const UniqueIndex = decorator((col) => {
  col.index = true;
  col.unique = true;
  col.nullable = false;
});

// Mark as custom auto-timestamp
export const AutoTimestamp = decorator<[format?: string]>((col, [format]) => {
  col.set((current, next) => {
    // Always set current timestamp on save
    const now = new Date();
    if (format === "epoch") {
      return now.getTime();
    }
    return now.toISOString();
  });
});

// Usage
class AuditLog extends Table<AuditLog> {
  @UniqueIndex()
  declare event_id: string;

  @AutoTimestamp("epoch")
  declare timestamp: number;
}
```

### Decorator with Access to WrapperEntry

The third parameter `entry` provides access to all table metadata:

```typescript
import { decorator } from "@arcaelas/dynamite";

// Verify that a primary key exists before creating an index
export const SecondaryIndex = decorator((col, args, entry) => {
  // Check that there is at least one column with @Index
  const has_partition_key = Array.from(entry.columns.values()).some(c => c.index);

  if (!has_partition_key) {
    throw new Error(
      `Cannot create secondary index on "${entry.name}" without @Index defined`
    );
  }

  col.indexSort = true;
});
```

### API of `relationDecorator()`

For creating custom relationship decorators:

```typescript
import { relationDecorator } from "@arcaelas/dynamite";

/**
 * @description Factory for creating relationship decorators
 * @param type "hasMany" | "belongsTo"
 */
function relationDecorator(
  type: "hasMany" | "belongsTo"
): (targetModel: () => any, keyArg: string, secondaryKey?: string) => PropertyDecorator;
```

### Create Custom Relationship Decorators

```typescript
import { relationDecorator } from "@arcaelas/dynamite";

// Typed aliases for relationships
export const HasMany = relationDecorator("hasMany");
export const BelongsTo = relationDecorator("belongsTo");

// Usage
class Author extends Table<Author> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Book, "author_id", "id")
  declare books: NonAttribute<Book[]>;
}

class Book extends Table<Book> {
  @PrimaryKey()
  declare id: string;

  declare author_id: string;

  @BelongsTo(() => Author, "author_id", "id")
  declare author: NonAttribute<Author | null>;
}
```

### Create Composite Decorators

Combine multiple existing decorators into one:

```typescript
function EmailField(): PropertyDecorator {
  return (target: any, prop: string | symbol) => {
    NotNull()(target, prop);
    Mutate((v) => (v as string).toLowerCase().trim())(target, prop);
    Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Invalid email")(target, prop);
  };
}

function SlugField(): PropertyDecorator {
  return (target: any, prop: string | symbol) => {
    Mutate((v) => (v as string).toLowerCase())(target, prop);
    Mutate((v) => (v as string).replace(/[^a-z0-9]+/g, "-"))(target, prop);
    Mutate((v) => (v as string).replace(/^-+|-+$/g, ""))(target, prop);
    Validate((v) => (v as string).length > 0 || "Slug cannot be empty")(target, prop);
  };
}

class Article extends Table<Article> {
  @PrimaryKey()
  declare id: string;

  @EmailField()
  declare author_email: string;

  @SlugField()
  declare slug: string;
}
```

### Complete Example: Encryption Decorator

```typescript
import { decorator } from "@arcaelas/dynamite";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const IV_LENGTH = 16;

export const Encrypted = decorator((col) => {
  // On save: encrypt
  col.set((current, next) => {
    if (typeof next !== "string" || !next) return next;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
    const encrypted = Buffer.concat([cipher.update(next, "utf8"), cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  });

  // On read: decrypt
  col.get((current) => {
    if (typeof current !== "string" || !current.includes(":")) return current;

    try {
      const [iv_hex, encrypted_hex] = current.split(":");
      const iv = Buffer.from(iv_hex, "hex");
      const encrypted = Buffer.from(encrypted_hex, "hex");
      const decipher = createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch {
      return current;
    }
  });

  // Mark as sensitive in metadata
  col.serialize = { fromDB: null, toDB: null }; // Avoid double transformation
});

// Usage
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Encrypted()
  declare ssn: string;  // Social security number encrypted
}
```

---

## Best Practices

### 1. Use CreationOptional Appropriately

```typescript
class User extends Table<User> {
  // Always CreationOptional with @Default
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Always CreationOptional with @CreatedAt/@UpdatedAt
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Required fields without CreationOptional
  @NotNull()
  declare email: string;
}
```

### 2. Decorator Order

```typescript
class User extends Table<User> {
  // Recommended order: Key -> Validation -> Transformation -> Defaults -> Timestamps
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Validate((v) => /^[^\s@]+@/.test(v as string) || "Invalid")
  @Mutate((v) => (v as string).toLowerCase())
  @Name("email_address")
  declare email: string;
}
```

### 3. Descriptive Validations

```typescript
// Bad
@Validate((v) => (v as number) > 0)
declare price: number;

// Good
@Validate((v) => (v as number) > 0 || "Price must be greater than 0")
declare price: number;
```

### 4. Relationships with NonAttribute

```typescript
class User extends Table<User> {
  // Always mark relationships as NonAttribute
  @HasMany(() => Order, "user_id", "id")
  declare orders: NonAttribute<Order[]>;

  @HasOne(() => Profile, "user_id", "id")
  declare profile: NonAttribute<Profile | null>;

  @BelongsTo(() => Company, "company_id", "id")
  declare company: NonAttribute<Company | null>;

  @ManyToMany(() => Role, "users_roles", "user_id", "role_id", "id", "id")
  declare roles: NonAttribute<Role[]>;
}
```

### 5. Use snake_case for Field Names

```typescript
class User extends Table<User> {
  // Good: snake_case
  declare user_id: string;
  declare created_at: string;
  declare first_name: string;

  // Bad: camelCase
  // declare userId: string;
  // declare createdAt: string;
  // declare firstName: string;
}
```

---

This guide covers all decorators available in Dynamite with practical examples and recommended patterns for building robust and type-safe models.
