# Basic Model Example

This example demonstrates a simple CRUD (Create, Read, Update, Delete) application using Dynamite ORM. We'll build a complete User management system from scratch, covering all essential operations.

## Table of Contents

- [Model Definition](#model-definition)
- [Setup and Configuration](#setup-and-configuration)
- [Creating Records](#creating-records)
- [Reading Records](#reading-records)
- [Updating Records](#updating-records)
- [Deleting Records](#deleting-records)
- [Complete Working Example](#complete-working-example)
- [Expected Output](#expected-output)
- [Key Concepts](#key-concepts)
- [Next Steps](#next-steps)

## Model Definition

Let's start by defining a User model with essential fields and decorators:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

class User extends Table<User> {
  // Auto-generated primary key
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Required field during creation
  declare name: string;

  // Required email field
  declare email: string;

  // Optional field with default value
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Optional active status with default
  @Default(() => true)
  declare active: CreationOptional<boolean>;

  // Auto-managed timestamps
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}
```

**Decorator Breakdown:**
- `@PrimaryKey()` - Marks `id` as the partition key in DynamoDB
- `@Default()` - Provides automatic default values when field is omitted
- `@CreatedAt()` - Automatically sets ISO timestamp on record creation
- `@UpdatedAt()` - Automatically updates ISO timestamp on every save
- `CreationOptional<T>` - Makes field optional during creation but required in instances

## Setup and Configuration

Before using your models, configure the DynamoDB connection:

```typescript
// For local development with DynamoDB Local
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User], // Your model classes
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});
dynamite.connect();
await dynamite.sync();

// For AWS production
const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User],
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});
dynamite.connect();
await dynamite.sync();
```

**Configuration Options:**
- `region` - AWS region (e.g., "us-east-1", "eu-west-1")
- `endpoint` - DynamoDB endpoint (use localhost:8000 for local development)
- `tables` - Array of model classes to register
- `credentials` - AWS credentials object with accessKeyId and secretAccessKey

## Creating Records

### Basic Creation

The simplest way to create a record is using the static `create()` method:

```typescript
// Create with only required fields
const user1 = await User.create({
  name: "John Doe",
  email: "john@example.com"
  // id, role, active, timestamps are auto-generated
});

console.log(user1.id);         // "550e8400-e29b-41d4-a716-446655440000"
console.log(user1.name);       // "John Doe"
console.log(user1.email);      // "john@example.com"
console.log(user1.role);       // "customer" (default)
console.log(user1.active);     // true (default)
console.log(user1.created_at); // "2024-01-15T10:30:00.000Z"
console.log(user1.updated_at); // "2024-01-15T10:30:00.000Z"
```

### Creation with All Fields

You can override default values during creation:

```typescript
const user2 = await User.create({
  id: "custom-user-id",
  name: "Jane Smith",
  email: "jane@example.com",
  role: "admin",
  active: true
});

console.log(user2.id);   // "custom-user-id" (custom)
console.log(user2.role); // "admin" (overridden default)
```

### Bulk Creation

Create multiple records efficiently using `Promise.all()`:

```typescript
const users = await Promise.all([
  User.create({
    name: "Alice Johnson",
    email: "alice@example.com"
  }),
  User.create({
    name: "Bob Williams",
    email: "bob@example.com",
    role: "moderator"
  }),
  User.create({
    name: "Charlie Brown",
    email: "charlie@example.com"
  })
]);

console.log(`Created ${users.length} users`);
// Output: Created 3 users
```

## Reading Records

### Get All Records

Retrieve all records from the table:

```typescript
const all_users = await User.where({});
console.log(`Total users: ${all_users.length}`);

// Iterate through results
all_users.forEach(user => {
  console.log(`${user.name} (${user.email})`);
});
```

### Filter by Exact Match

Query records matching specific field values:

```typescript
// Single field filter
const admins = await User.where({ role: "admin" });
console.log(`Found ${admins.length} admin users`);

// Multiple field filters (AND condition)
const active_admins = await User.where({
  role: "admin",
  active: true
});
console.log(`Found ${active_admins.length} active admin users`);
```

### Get First or Last Record

Retrieve the first or last record matching criteria:

```typescript
// Get first user
const first_user = await User.first({});
console.log(`First user: ${first_user?.name}`);

// Get first admin
const first_admin = await User.first({ role: "admin" });
console.log(`First admin: ${first_admin?.name}`);

// Get last user
const last_user = await User.last({});
console.log(`Last user: ${last_user?.name}`);

// Get last customer
const last_customer = await User.last({ role: "customer" });
console.log(`Last customer: ${last_customer?.name}`);
```

### Query by Field and Value

Use method signature with field name and value:

```typescript
// Query by single field
const johns = await User.where("name", "John Doe");
console.log(`Found ${johns.length} users named John Doe`);

// Query with array value (IN operator)
const specific_users = await User.where("id", [
  "user-1",
  "user-2",
  "user-3"
]);
console.log(`Found ${specific_users.length} specific users`);
```

### Query with Options

Use query options for pagination, sorting, and attribute selection:

```typescript
// Limit results
const first_10 = await User.where({}, { limit: 10 });
console.log(`Retrieved ${first_10.length} users`);

// Pagination (skip and limit)
const page_2 = await User.where({}, {
  skip: 10,
  limit: 10
});
console.log(`Page 2: ${page_2.length} users`);

// Sort order (ASC or DESC)
const sorted_users = await User.where({}, {
  order: "DESC"
});

// Select specific attributes only
const user_summaries = await User.where({}, {
  attributes: ["id", "name", "email"]
});

user_summaries.forEach(user => {
  console.log(`${user.name}: ${user.email}`);
  // role, active, timestamps are not loaded
});
```

## Updating Records

### Using Instance `save()` Method

Modify instance properties and call `save()`:

```typescript
// Get a user
const user = await User.first({ email: "john@example.com" });

if (user) {
  // Modify properties
  user.name = "John Smith";
  user.role = "premium";

  // Save changes
  await user.save();

  console.log(`Updated user: ${user.name}`);
  console.log(`Updated at: ${user.updated_at}`);
  // updated_at timestamp is automatically updated
}
```

### Using Instance `update()` Method

Update multiple fields at once:

```typescript
const user = await User.first({ email: "john@example.com" });

if (user) {
  await user.update({
    name: "John Smith",
    role: "premium",
    active: true
  });

  console.log(`User updated: ${user.name}`);
}
```

### Using Static `update()` Method

Update records by filter criteria:

```typescript
// Update all users matching filter
const updated_count = await User.update(
  { name: "John A. Smith", role: "premium" },
  { email: "john@example.com" }
);

console.log(`Updated ${updated_count} user(s)`);
```

### Batch Updates

Update multiple records efficiently:

```typescript
// Get all customers
const customers = await User.where({ role: "customer" });

// Upgrade all to premium
await Promise.all(customers.map(user => {
  user.role = "premium";
  return user.save();
}));

console.log(`Upgraded ${customers.length} customers to premium`);
```

### Conditional Updates

Update only records matching specific conditions:

```typescript
// Get inactive users
const inactive_users = await User.where({ active: false });

// Reactivate users created in the last month
const one_month_ago = new Date();
one_month_ago.setMonth(one_month_ago.getMonth() - 1);

const reactivated = await Promise.all(
  inactive_users
    .filter(user => new Date(user.created_at) > one_month_ago)
    .map(user => {
      user.active = true;
      return user.save();
    })
);

console.log(`Reactivated ${reactivated.length} users`);
```

## Deleting Records

### Using Instance `destroy()` Method

Delete a specific instance:

```typescript
const user = await User.first({ email: "john@example.com" });

if (user) {
  await user.destroy();
  console.log(`Deleted user: ${user.name}`);
}
```

### Using Static `delete()` Method

Delete records matching filter criteria:

```typescript
// Delete by filter
const deleted_count = await User.delete({ email: "john@example.com" });
console.log(`Deleted ${deleted_count} user(s)`);

// Delete multiple users
const deleted_inactive = await User.delete({ active: false });
console.log(`Deleted ${deleted_inactive} inactive user(s)`);
```

### Batch Delete

Delete multiple records efficiently:

```typescript
// Get all inactive users
const inactive_users = await User.where({ active: false });

// Delete all inactive users
await Promise.all(inactive_users.map(user => user.destroy()));

console.log(`Deleted ${inactive_users.length} inactive users`);
```

### Conditional Delete

Delete only records matching complex criteria:

```typescript
// Get all users
const all_users = await User.where({});

// Delete old inactive users (inactive for over 6 months)
const six_months_ago = new Date();
six_months_ago.setMonth(six_months_ago.getMonth() - 6);

const to_delete = all_users.filter(user =>
  !user.active && new Date(user.updated_at) < six_months_ago
);

await Promise.all(to_delete.map(user => user.destroy()));

console.log(`Deleted ${to_delete.length} old inactive users`);
```

## Complete Working Example

Here's a complete, runnable example that demonstrates all CRUD operations:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

// Define User model first
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Configure DynamoDB connection
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User],
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});
dynamite.connect();
await dynamite.sync();

// Main application
async function main() {
  console.log("=== User Management System ===\n");

  // 1. CREATE - Add new users
  console.log("1. Creating users...");
  const user1 = await User.create({
    name: "John Doe",
    email: "john@example.com"
  });
  console.log(`Created: ${user1.name} (${user1.id})`);

  const user2 = await User.create({
    name: "Jane Smith",
    email: "jane@example.com",
    role: "admin"
  });
  console.log(`Created: ${user2.name} (${user2.id})`);

  const user3 = await User.create({
    name: "Bob Johnson",
    email: "bob@example.com"
  });
  console.log(`Created: ${user3.name} (${user3.id})\n`);

  // 2. READ - Get all users
  console.log("2. Listing all users...");
  const all_users = await User.where({});
  console.log(`Total users: ${all_users.length}`);
  all_users.forEach(user => {
    console.log(`  - ${user.name} (${user.role})`);
  });
  console.log();

  // 3. READ - Filter by role
  console.log("3. Filtering users by role...");
  const customers = await User.where({ role: "customer" });
  console.log(`Customers: ${customers.length}`);
  customers.forEach(user => {
    console.log(`  - ${user.name}`);
  });
  console.log();

  // 4. READ - Get first and last
  console.log("4. Getting first and last users...");
  const first_user = await User.first({});
  const last_user = await User.last({});
  console.log(`First user: ${first_user?.name}`);
  console.log(`Last user: ${last_user?.name}\n`);

  // 5. READ - Query with options
  console.log("5. Getting users with specific attributes...");
  const user_summaries = await User.where({}, {
    attributes: ["id", "name", "email"]
  });
  user_summaries.forEach(user => {
    console.log(`  - ${user.name}: ${user.email}`);
  });
  console.log();

  // 6. UPDATE - Modify a user
  console.log("6. Updating user...");
  const user_to_update = await User.first({ name: "John Doe" });
  if (user_to_update) {
    user_to_update.name = "John A. Doe";
    user_to_update.role = "premium";
    await user_to_update.save();
    console.log(`Updated: ${user_to_update.name} (${user_to_update.role})\n`);
  }

  // 7. UPDATE - Batch update
  console.log("7. Batch updating customers to premium...");
  const customers_to_upgrade = await User.where({ role: "customer" });
  await Promise.all(customers_to_upgrade.map(user => {
    user.role = "premium";
    return user.save();
  }));
  console.log(`Upgraded ${customers_to_upgrade.length} customers\n`);

  // 8. READ - Verify updates
  console.log("8. Verifying updates...");
  const premium_users = await User.where({ role: "premium" });
  console.log(`Premium users: ${premium_users.length}`);
  premium_users.forEach(user => {
    console.log(`  - ${user.name}`);
  });
  console.log();

  // 9. DELETE - Remove a user
  console.log("9. Deleting a user...");
  const user_to_delete = await User.first({ name: "Bob Johnson" });
  if (user_to_delete) {
    await user_to_delete.destroy();
    console.log(`Deleted: ${user_to_delete.name}\n`);
  }

  // 10. READ - Final count
  console.log("10. Final user count...");
  const final_users = await User.where({});
  console.log(`Total users: ${final_users.length}`);
  final_users.forEach(user => {
    console.log(`  - ${user.name} (${user.role})`);
  });
  console.log();

  console.log("=== All operations completed successfully ===");
}

// Run the application
main().catch(console.error);
```

## Expected Output

When you run the complete example, you should see output similar to this:

```
=== User Management System ===

1. Creating users...
Created: John Doe (550e8400-e29b-41d4-a716-446655440000)
Created: Jane Smith (6ba7b810-9dad-11d1-80b4-00c04fd430c8)
Created: Bob Johnson (6ba7b811-9dad-11d1-80b4-00c04fd430c9)

2. Listing all users...
Total users: 3
  - John Doe (customer)
  - Jane Smith (admin)
  - Bob Johnson (customer)

3. Filtering users by role...
Customers: 2
  - John Doe
  - Bob Johnson

4. Getting first and last users...
First user: John Doe
Last user: Bob Johnson

5. Getting users with specific attributes...
  - John Doe: john@example.com
  - Jane Smith: jane@example.com
  - Bob Johnson: bob@example.com

6. Updating user...
Updated: John A. Doe (premium)

7. Batch updating customers to premium...
Upgraded 1 customers

8. Verifying updates...
Premium users: 2
  - John A. Doe
  - Bob Johnson

9. Deleting a user...
Deleted: Bob Johnson

10. Final user count...
Total users: 2
  - John A. Doe (premium)
  - Jane Smith (admin)

=== All operations completed successfully ===
```

## Key Concepts

### 1. Model Definition

Models are TypeScript classes that extend `Table<T>`:

```typescript
class User extends Table<User> {
  // Field definitions with decorators
}
```

The generic parameter `<User>` provides type safety throughout the ORM.

### 2. Decorators

Decorators define field behavior:

- **@PrimaryKey()** - Marks the partition key (required for every model)
- **@Default()** - Provides automatic default values
- **@CreatedAt()** - Auto-sets timestamp on creation
- **@UpdatedAt()** - Auto-updates timestamp on save

### 3. Type Safety

The `CreationOptional<T>` type makes fields optional during creation but required in instances:

```typescript
@Default(() => "customer")
declare role: CreationOptional<string>;

// During creation:
await User.create({ name: "John" }); // role is optional

// In instance:
const user = await User.first({});
console.log(user.role); // role is guaranteed to exist (string)
```

### 4. Query Methods

Dynamite provides flexible query methods:

- `where()` - Filter records with various signatures
- `first()` - Get first matching record
- `last()` - Get last matching record
- `create()` - Create new record
- `update()` - Update records
- `delete()` - Delete records

### 5. Instance vs Static Methods

**Instance methods** operate on a specific record:
```typescript
const user = await User.first({ id: "123" });
user.name = "New Name";
await user.save();
await user.destroy();
```

**Static methods** operate on the model class:
```typescript
await User.create({ name: "John" });
await User.where({ role: "admin" });
await User.update({ name: "New" }, { id: "123" });
await User.delete({ id: "123" });
```

### 6. Timestamps

Timestamp fields are automatically managed:

```typescript
@CreatedAt()
declare created_at: CreationOptional<string>;

@UpdatedAt()
declare updated_at: CreationOptional<string>;
```

- `created_at` is set once on creation
- `updated_at` is updated on every `save()` call

### 7. Default Values

Default values can be static or dynamic:

```typescript
// Static default
@Default("customer")
declare role: CreationOptional<string>;

// Dynamic default (function)
@Default(() => crypto.randomUUID())
declare id: CreationOptional<string>;

@Default(() => new Date().toISOString())
declare joined_date: CreationOptional<string>;
```

## Next Steps

Now that you understand basic CRUD operations, explore these advanced topics:

### Related Documentation

- [Relations Example](./relations.md) - One-to-many and many-to-one relationships
- [Advanced Queries Example](./advanced.md) - Complex queries, pagination, and filtering

### API References

- [Table API Reference](../references/table.md) - Complete Table class documentation
- [Decorators Guide](../references/decorators.md) - All available decorators
- [Core Concepts](../references/core-concepts.md) - Deep dive into Dynamite architecture

### Best Practices

1. **Always define a primary key** with `@PrimaryKey()` decorator
2. **Use CreationOptional** for fields with `@Default`, `@CreatedAt`, `@UpdatedAt`
3. **Select specific attributes** when you don't need all fields (reduces data transfer)
4. **Use batch operations** for better performance with multiple records
5. **Handle errors** with try-catch blocks in production code
6. **Validate timestamps** before using them in date calculations

### Common Patterns

**Soft Delete Pattern:**
```typescript
class User extends Table<User> {
  @Default(() => false)
  declare deleted: CreationOptional<boolean>;

  @Default(() => null)
  declare deleted_at: CreationOptional<string | null>;
}

// Soft delete
user.deleted = true;
user.deleted_at = new Date().toISOString();
await user.save();

// Query only active users
const active_users = await User.where({ deleted: false });
```

**Pagination Pattern:**
```typescript
async function get_paginated_users(page: number, page_size: number) {
  return await User.where({}, {
    skip: page * page_size,
    limit: page_size
  });
}

const page_1 = await get_paginated_users(0, 10); // First 10 users
const page_2 = await get_paginated_users(1, 10); // Next 10 users
```

**Search Pattern:**
```typescript
async function search_users(query: string) {
  const all_users = await User.where({});
  return all_users.filter(user =>
    user.name.toLowerCase().includes(query.toLowerCase()) ||
    user.email.toLowerCase().includes(query.toLowerCase())
  );
}

const results = await search_users("john");
```

### Troubleshooting

**Issue: "Metadata not found"**
- Ensure `new Dynamite({ tables: [...] })` is configured and `connect()` is called before using models
- Check for circular imports

**Issue: "Primary key missing"**
- Add `@PrimaryKey()` decorator to at least one field
- Or use `@Index()` decorator (alias for PrimaryKey)

**Issue: "Record not updating"**
- Call `save()` after modifying instance properties
- Check that timestamps are using `CreationOptional`

**Issue: "Query returns empty array"**
- Verify filter criteria match actual data
- Check table name matches DynamoDB table (use `@Name()` if custom)

## Additional Resources

- [GitHub Repository](https://github.com/arcaelas/dynamite)
- [Getting Started Guide](../getting-started.md)
- [Core Concepts](../references/core-concepts.md)

Happy coding with Dynamite!
