# Getting Started with Dynamite

Welcome to Dynamite! This guide will walk you through everything you need to know to start building applications with this modern, decorator-first ORM for DynamoDB.

## Prerequisites

Before starting, make sure you have:
- Node.js 16+ installed
- Basic TypeScript knowledge
- AWS account (or DynamoDB Local for development)

## Installation

```bash
npm install @arcaelas/dynamite

# Peer dependencies (if not already installed)
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Configuration

First, configure your DynamoDB connection:

```typescript
import { Dynamite } from "@arcaelas/dynamite";

// For local development
Dynamite.config({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// For AWS production
Dynamite.config({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});
```

## Step 1: Your First Model

Let's create a simple User model. In Dynamite, models are classes that extend `Table` and use decorators to define their structure.

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Primary key with auto-generated UUID
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Required field during creation
  declare name: string;

  // Optional field with default value
  @Default(() => "customer")
  declare role: CreationOptional<string>;
}
```

**Key concepts:**
- `@PrimaryKey()` marks the primary key (partition key in DynamoDB)
- `@Default()` provides automatic default values
- `CreationOptional<T>` makes fields optional during creation but required in instances
- `declare` is TypeScript syntax for class properties

## Step 2: Creating Records

There are multiple ways to create records in Dynamite:

### Using `create()` method

```typescript
// Create with required fields only
const user1 = await User.create({
  name: "John Doe"
  // id and role are optional (auto-generated/defaulted)
});

console.log(user1.id);   // "550e8400-e29b-41d4-a716-446655440000"
console.log(user1.name); // "John Doe"
console.log(user1.role); // "customer"

// Create with all fields
const user2 = await User.create({
  id: "custom-id",
  name: "Jane Smith",
  role: "admin"
});
```

### Creating multiple records

```typescript
const users = await Promise.all([
  User.create({ name: "Alice" }),
  User.create({ name: "Bob" }),
  User.create({ name: "Charlie" })
]);

console.log(`Created ${users.length} users`);
```

## Step 3: Reading Records

Dynamite provides several methods to query your data:

### Get all records

```typescript
const all_users = await User.where({});
console.log(`Total users: ${all_users.length}`);
```

### Filter by fields

```typescript
// Filter by exact match
const admins = await User.where({ role: "admin" });

// Filter by multiple conditions
const admin_johns = await User.where({
  name: "John Doe",
  role: "admin"
});
```

### Get first or last record

```typescript
// Get first user
const first_user = await User.first({});

// Get first admin
const first_admin = await User.first({ role: "admin" });

// Get last user
const last_user = await User.last({});
```

### Advanced queries with operators

```typescript
// Greater than or equal
const premium_users = await User.where("id", ">=", "user-100");

// String contains
const gmail_users = await User.where("name", "contains", "gmail");

// In array
const special_roles = await User.where("role", "in", ["admin", "premium", "vip"]);

// Not equal
const non_customers = await User.where("role", "!=", "customer");
```

### Query with options

```typescript
// Limit results
const first_10_users = await User.where({}, { limit: 10 });

// Pagination (skip and limit)
const page_2_users = await User.where({}, {
  limit: 10,
  skip: 10
});

// Sort order
const sorted_users = await User.where({}, { order: "DESC" });

// Select specific attributes
const user_names = await User.where({}, {
  attributes: ["id", "name"]
});
```

## Step 4: Updating Records

You can update records using instance methods or static methods:

### Using instance `save()` method

```typescript
// Get a user
const user = await User.first({ name: "John Doe" });

if (user) {
  // Modify properties
  user.name = "John Smith";
  user.role = "premium";

  // Save changes
  await user.save();

  console.log("User updated successfully");
}
```

### Using instance `update()` method

```typescript
const user = await User.first({ name: "John Doe" });

if (user) {
  // Update multiple fields at once
  await user.update({
    name: "John Smith",
    role: "premium"
  });
}
```

### Using static `update()` method

```typescript
// Update by ID
await User.update("user-123", {
  name: "John Smith",
  role: "premium"
});
```

### Batch updates

```typescript
const users = await User.where({ role: "customer" });

// Update all customers to premium
await Promise.all(users.map(user => {
  user.role = "premium";
  return user.save();
}));
```

## Step 5: Deleting Records

Delete records using instance or static methods:

### Using instance `destroy()` method

```typescript
const user = await User.first({ name: "John Doe" });

if (user) {
  await user.destroy();
  console.log("User deleted");
}
```

### Using static `delete()` method

```typescript
// Delete by ID
await User.delete("user-123");
```

### Batch delete

```typescript
const inactive_users = await User.where({ active: false });

// Delete all inactive users
await Promise.all(inactive_users.map(user => user.destroy()));
```

## Step 6: Adding Timestamps

Timestamps track when records are created and updated. Use `@CreatedAt` and `@UpdatedAt` decorators:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Auto-set on creation
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Auto-update on save
  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Usage
const user = await User.create({ name: "John Doe" });

console.log(user.created_at); // "2024-01-15T10:30:00.000Z"
console.log(user.updated_at); // "2024-01-15T10:30:00.000Z"

// Update user
user.name = "John Smith";
await user.save();

console.log(user.updated_at); // "2024-01-15T10:35:00.000Z" (updated!)
```

## Step 7: Complete Working Example

Here's a complete example tying everything together - a simple task management system:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  Validate,
  Mutate,
  NotNull,
  CreationOptional,
  NonAttribute,
  Dynamite
} from "@arcaelas/dynamite";

// Configure DynamoDB connection
Dynamite.config({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Define Task model
class Task extends Table<Task> {
  // Auto-generated ID
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Required title with validation
  @NotNull()
  @Mutate((value) => (value as string).trim())
  @Validate((value) => (value as string).length >= 3 || "Title must be at least 3 characters")
  declare title: string;

  // Optional description
  @Default(() => "")
  declare description: CreationOptional<string>;

  // Status with default value
  @Default(() => "pending")
  @Validate((value) => ["pending", "in_progress", "completed"].includes(value as string) || "Invalid status")
  declare status: CreationOptional<string>;

  // Priority with validation
  @Default(() => 1)
  @Validate((value) => (value as number) >= 1 && (value as number) <= 5 || "Priority must be between 1 and 5")
  declare priority: CreationOptional<number>;

  // Timestamps
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  // Computed property (not stored in database)
  declare display_title: NonAttribute<string>;

  constructor(data?: any) {
    super(data);

    // Define computed property
    Object.defineProperty(this, 'display_title', {
      get: () => `[${this.status.toUpperCase()}] ${this.title}`,
      enumerable: true
    });
  }
}

// Main application
async function main() {
  console.log("=== Task Management System ===\n");

  // 1. Create tasks
  console.log("1. Creating tasks...");
  const task1 = await Task.create({
    title: "Write documentation",
    description: "Complete the getting started guide",
    priority: 3
  });
  console.log(`Created: ${task1.display_title}`);

  const task2 = await Task.create({
    title: "Fix bug in API",
    priority: 5
  });
  console.log(`Created: ${task2.display_title}`);

  const task3 = await Task.create({
    title: "Review pull request",
    priority: 2
  });
  console.log(`Created: ${task3.display_title}\n`);

  // 2. Get all tasks
  console.log("2. Listing all tasks...");
  const all_tasks = await Task.where({});
  all_tasks.forEach(task => {
    console.log(`  - ${task.title} (Priority: ${task.priority})`);
  });
  console.log();

  // 3. Filter tasks by status
  console.log("3. Filtering pending tasks...");
  const pending_tasks = await Task.where({ status: "pending" });
  console.log(`Found ${pending_tasks.length} pending tasks\n`);

  // 4. Query high priority tasks
  console.log("4. Finding high priority tasks (priority >= 4)...");
  const high_priority = await Task.where("priority", ">=", 4);
  high_priority.forEach(task => {
    console.log(`  - ${task.display_title} (Priority: ${task.priority})`);
  });
  console.log();

  // 5. Update a task
  console.log("5. Updating task status...");
  const task_to_update = await Task.first({ title: "Write documentation" });
  if (task_to_update) {
    task_to_update.status = "in_progress";
    await task_to_update.save();
    console.log(`Updated: ${task_to_update.display_title}\n`);
  }

  // 6. Get tasks with specific attributes
  console.log("6. Getting task summaries (id and title only)...");
  const summaries = await Task.where({}, {
    attributes: ["id", "title", "status"]
  });
  summaries.forEach(task => {
    console.log(`  - ${task.title}: ${task.status}`);
  });
  console.log();

  // 7. Get tasks ordered by priority
  console.log("7. Listing tasks by priority (descending)...");
  const ordered_tasks = await Task.where({}, { order: "DESC" });
  ordered_tasks.forEach(task => {
    console.log(`  - [P${task.priority}] ${task.title}`);
  });
  console.log();

  // 8. Mark tasks as completed
  console.log("8. Marking all pending tasks as completed...");
  const pending = await Task.where({ status: "pending" });
  await Promise.all(pending.map(task => {
    task.status = "completed";
    return task.save();
  }));
  console.log(`Completed ${pending.length} tasks\n`);

  // 9. Get completed tasks
  console.log("9. Listing completed tasks...");
  const completed = await Task.where({ status: "completed" });
  completed.forEach(task => {
    console.log(`  - ${task.title} (Created: ${new Date(task.created_at).toLocaleDateString()})`);
  });
  console.log();

  // 10. Delete a task
  console.log("10. Deleting a task...");
  const task_to_delete = await Task.first({ title: "Review pull request" });
  if (task_to_delete) {
    await task_to_delete.destroy();
    console.log(`Deleted: ${task_to_delete.title}\n`);
  }

  // Final count
  const final_count = await Task.where({});
  console.log(`=== Final task count: ${final_count.length} ===`);
}

// Run the application
main().catch(console.error);
```

**Expected output:**
```
=== Task Management System ===

1. Creating tasks...
Created: [PENDING] Write documentation
Created: [PENDING] Fix bug in API
Created: [PENDING] Review pull request

2. Listing all tasks...
  - Write documentation (Priority: 3)
  - Fix bug in API (Priority: 5)
  - Review pull request (Priority: 2)

3. Filtering pending tasks...
Found 3 pending tasks

4. Finding high priority tasks (priority >= 4)...
  - [PENDING] Fix bug in API (Priority: 5)

5. Updating task status...
Updated: [IN_PROGRESS] Write documentation

6. Getting task summaries (id and title only)...
  - Write documentation: in_progress
  - Fix bug in API: pending
  - Review pull request: pending

7. Listing tasks by priority (descending)...
  - [P5] Fix bug in API
  - [P3] Write documentation
  - [P2] Review pull request

8. Marking all pending tasks as completed...
Completed 2 tasks

9. Listing completed tasks...
  - Fix bug in API (Created: 1/15/2024)
  - Review pull request (Created: 1/15/2024)

10. Deleting a task...
Deleted: Review pull request

=== Final task count: 2 ===
```

## Understanding the Example

Let's break down the key parts:

### Model Definition
```typescript
class Task extends Table<Task> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;
  // ...
}
```
- Extends `Table<Task>` for ORM functionality
- Decorators define field behavior
- `CreationOptional` makes fields optional during creation

### Data Validation
```typescript
@Validate((value) => (value as string).length >= 3 || "Title must be at least 3 characters")
declare title: string;
```
- Validates data before saving
- Returns `true` or error message string

### Data Transformation
```typescript
@Mutate((value) => (value as string).trim())
declare title: string;
```
- Transforms data before storage
- Useful for normalization (trim, lowercase, etc.)

### Computed Properties
```typescript
declare display_title: NonAttribute<string>;

constructor(data?: any) {
  super(data);
  Object.defineProperty(this, 'display_title', {
    get: () => `[${this.status.toUpperCase()}] ${this.title}`,
    enumerable: true
  });
}
```
- `NonAttribute` excludes from database
- Computed dynamically from other fields
- Not stored, recalculated on access

## Next Steps

Now that you understand the basics, explore these advanced topics:

### Core Concepts
Learn about the fundamental concepts and architecture:
- [Core Concepts](./core-concepts.md) - Deep dive into decorators, models, and relationships

### Advanced Features
- **Relationships** - Define one-to-many and many-to-one relationships
- **Complex Queries** - Advanced filtering and query building
- **Data Validation** - Custom validators and transformations
- **TypeScript Types** - Full type safety with `CreationOptional` and `NonAttribute`

### Best Practices
- Always define a `@PrimaryKey()`
- Use `CreationOptional` for fields with `@Default`, `@CreatedAt`, `@UpdatedAt`
- Use `NonAttribute` for computed properties
- Validate user input with `@Validate`
- Transform data with `@Mutate` before validation
- Use specific attribute selection to reduce data transfer
- Handle errors gracefully with try-catch blocks

### Additional Resources
- [API Reference](../api/README.md) - Complete API documentation
- [Examples](../../examples/) - More code examples
- [Troubleshooting](../troubleshooting.md) - Common issues and solutions

## Quick Reference

### Essential Decorators
| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@PrimaryKey()` | Primary key | `@PrimaryKey() declare id: string` |
| `@Default(fn)` | Default value | `@Default(() => uuid()) declare id: string` |
| `@CreatedAt()` | Auto timestamp on create | `@CreatedAt() declare created_at: string` |
| `@UpdatedAt()` | Auto timestamp on update | `@UpdatedAt() declare updated_at: string` |
| `@Validate(fn)` | Validation | `@Validate((v) => v.length > 0) declare name: string` |
| `@Mutate(fn)` | Transform data | `@Mutate((v) => v.trim()) declare email: string` |
| `@NotNull()` | Not null check | `@NotNull() declare email: string` |

### Essential Types
| Type | Purpose | Usage |
|------|---------|-------|
| `CreationOptional<T>` | Optional on create | Fields with `@Default`, `@CreatedAt`, `@UpdatedAt` |
| `NonAttribute<T>` | Not stored in DB | Computed properties, getters, methods |

### CRUD Operations
```typescript
// Create
const user = await User.create({ name: "John" });

// Read
const users = await User.where({ active: true });
const user = await User.first({ id: "123" });

// Update
user.name = "Jane";
await user.save();
// or
await User.update("123", { name: "Jane" });

// Delete
await user.destroy();
// or
await User.delete("123");
```

## Getting Help

If you encounter issues:
1. Check the [Troubleshooting Guide](../troubleshooting.md)
2. Review the [API Reference](../api/README.md)
3. Search existing [GitHub Issues](https://github.com/arcaelas/dynamite/issues)
4. Create a new issue with a minimal reproducible example

Happy coding with Dynamite!
