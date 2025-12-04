# Advanced Queries Example

This comprehensive example demonstrates advanced query patterns, pagination, filtering, sorting, and complex data operations in Dynamite ORM. Learn how to build efficient, scalable queries for real-world applications.

## Table of Contents

- [Query Operators](#query-operators)
- [Comparison Queries](#comparison-queries)
- [Array Queries](#array-queries)
- [String Queries](#string-queries)
- [Pagination](#pagination)
- [Sorting and Ordering](#sorting-and-ordering)
- [Attribute Selection](#attribute-selection)
- [Complex Filtering](#complex-filtering)
- [Complete Working Example](#complete-working-example)
- [Expected Output](#expected-output)
- [Performance Optimization](#performance-optimization)
- [Best Practices](#best-practices)

## Query Operators

Dynamite supports a rich set of query operators for flexible data filtering:

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equal to (default) | `where("age", 25)` |
| `!=` | Not equal to | `where("status", "!=", "deleted")` |
| `<` | Less than | `where("age", "<", 18)` |
| `<=` | Less than or equal | `where("age", "<=", 65)` |
| `>` | Greater than | `where("score", ">", 100)` |
| `>=` | Greater than or equal | `where("age", ">=", 18)` |
| `in` | In array | `where("role", "in", ["admin", "user"])` |
| `not-in` | Not in array | `where("status", "not-in", ["banned"])` |
| `contains` | String contains | `where("email", "contains", "gmail")` |
| `begins-with` | String starts with | `where("name", "begins-with", "John")` |

## Comparison Queries

Use comparison operators for numeric and date comparisons:

### Equal To (Default)

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreationOptional
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare age: number;
  declare role: string;
}

// Explicit equal
const users1 = await User.where("age", "=", 25);

// Implicit equal (default operator)
const users2 = await User.where("age", 25);

// Object syntax (implicit equal)
const users3 = await User.where({ age: 25 });

console.log(`Found ${users1.length} users aged 25`);
```

### Not Equal To

```typescript
// Find all non-admin users
const non_admins = await User.where("role", "!=", "admin");
console.log(`Found ${non_admins.length} non-admin users`);

// Find active users (not deleted)
const active_users = await User.where("status", "!=", "deleted");
```

### Greater Than / Less Than

```typescript
// Find adults (age >= 18)
const adults = await User.where("age", ">=", 18);
console.log(`Adults: ${adults.length}`);

// Find minors (age < 18)
const minors = await User.where("age", "<", 18);
console.log(`Minors: ${minors.length}`);

// Find users in age range (18-65)
const working_age = await User.where("age", ">=", 18);
const filtered = working_age.filter(u => u.age <= 65);
console.log(`Working age: ${filtered.length}`);
```

### Date Comparisons

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;
  declare total: number;
  declare created_at: string;
}

// Orders after specific date
const recent_orders = await Order.where(
  "created_at",
  ">=",
  "2024-01-01T00:00:00.000Z"
);

// Orders before specific date
const old_orders = await Order.where(
  "created_at",
  "<",
  "2023-01-01T00:00:00.000Z"
);

// Orders in date range
const orders_2024 = await Order.where(
  "created_at",
  ">=",
  "2024-01-01T00:00:00.000Z"
);
const q1_orders = orders_2024.filter(
  o => o.created_at < "2024-04-01T00:00:00.000Z"
);
```

## Array Queries

Query records where field values match elements in an array:

### In Operator

```typescript
// Find users with specific roles
const privileged_users = await User.where(
  "role",
  "in",
  ["admin", "moderator", "premium"]
);

console.log(`Privileged users: ${privileged_users.length}`);

// Find users by multiple IDs
const specific_users = await User.where(
  "id",
  "in",
  ["user-1", "user-2", "user-3"]
);

// Shorthand: array value implies "in" operator
const users = await User.where("id", ["user-1", "user-2", "user-3"]);
```

### Not In Operator

```typescript
// Exclude banned and deleted users
const active_users = await User.where(
  "status",
  "not-in",
  ["banned", "deleted", "suspended"]
);

console.log(`Active users: ${active_users.length}`);

// Exclude test users
const real_users = await User.where(
  "email",
  "not-in",
  ["test@example.com", "demo@example.com"]
);
```

## String Queries

Perform pattern matching on string fields:

### Contains Operator

```typescript
// Find Gmail users
const gmail_users = await User.where("email", "contains", "gmail");
console.log(`Gmail users: ${gmail_users.length}`);

// Find users with "john" in name
const johns = await User.where("name", "contains", "john");

// Find users with specific domain
const company_users = await User.where("email", "contains", "@company.com");
```

### Begins With Operator

```typescript
// Find users with name starting with "J"
const j_users = await User.where("name", "begins-with", "J");
console.log(`Names starting with J: ${j_users.length}`);

// Find users with specific prefix
const admin_users = await User.where("username", "begins-with", "admin_");

// Find orders with specific ID prefix
const orders_2024 = await Order.where("id", "begins-with", "2024-");
```

### Case-Insensitive Search

```typescript
// Transform to lowercase before searching
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((value) => (value as string).toLowerCase())
  declare email: string;
}

// Now all emails are stored lowercase
const users = await User.where("email", "contains", "gmail");

// For case-insensitive search on non-mutated fields
const all_users = await User.where({});
const filtered = all_users.filter(u =>
  u.name.toLowerCase().includes("john")
);
```

## Pagination

Implement efficient pagination for large datasets:

### Basic Pagination

```typescript
// Page 1: First 10 users
const page_1 = await User.where({}, {
  limit: 10,
  skip: 0
});

// Page 2: Next 10 users
const page_2 = await User.where({}, {
  limit: 10,
  skip: 10
});

// Page 3: Next 10 users
const page_3 = await User.where({}, {
  limit: 10,
  skip: 20
});

console.log(`Page 1: ${page_1.length} users`);
console.log(`Page 2: ${page_2.length} users`);
console.log(`Page 3: ${page_3.length} users`);
```

### Pagination Helper Function

```typescript
async function paginate_users(
  page: number,
  page_size: number,
  filters: Partial<InferAttributes<User>> = {}
) {
  const skip = page * page_size;
  const users = await User.where(filters, {
    skip,
    limit: page_size
  });

  return {
    data: users,
    page,
    page_size,
    has_more: users.length === page_size
  };
}

// Usage
const result = await paginate_users(0, 10, { role: "customer" });
console.log(`Page ${result.page}: ${result.data.length} users`);
console.log(`Has more: ${result.has_more}`);
```

### Cursor-Based Pagination

```typescript
async function paginate_by_cursor(
  last_id: string | null,
  page_size: number
) {
  let users: User[];

  if (last_id) {
    // Get users after cursor
    const all_users = await User.where({});
    const cursor_index = all_users.findIndex(u => u.id === last_id);
    users = all_users.slice(cursor_index + 1, cursor_index + 1 + page_size);
  } else {
    // First page
    users = await User.where({}, { limit: page_size });
  }

  return {
    data: users,
    next_cursor: users.length === page_size ? users[users.length - 1].id : null
  };
}

// Usage
const page_1 = await paginate_by_cursor(null, 10);
console.log(`Page 1: ${page_1.data.length} users`);

const page_2 = await paginate_by_cursor(page_1.next_cursor, 10);
console.log(`Page 2: ${page_2.data.length} users`);
```

## Sorting and Ordering

Control the order of query results:

### Ascending Order

```typescript
// Sort by age ascending (youngest first)
const users_asc = await User.where({}, {
  order: "ASC"
});

users_asc.forEach(user => {
  console.log(`${user.name}: ${user.age} years old`);
});
```

### Descending Order

```typescript
// Sort by age descending (oldest first)
const users_desc = await User.where({}, {
  order: "DESC"
});

users_desc.forEach(user => {
  console.log(`${user.name}: ${user.age} years old`);
});
```

### Sort by Specific Field

```typescript
// Get all users and sort by name
const all_users = await User.where({});
const sorted_by_name = all_users.sort((a, b) =>
  a.name.localeCompare(b.name)
);

// Get all users and sort by multiple criteria
const sorted = all_users.sort((a, b) => {
  // First by role
  if (a.role !== b.role) {
    return a.role.localeCompare(b.role);
  }
  // Then by name
  return a.name.localeCompare(b.name);
});
```

### Recent Records

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  declare title: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// Get 10 most recent posts
const recent_posts = await Post.where({}, {
  order: "DESC",
  limit: 10
});

recent_posts.forEach(post => {
  const date = new Date(post.created_at);
  console.log(`${post.title} - ${date.toLocaleDateString()}`);
});
```

## Attribute Selection

Load only specific fields to optimize performance:

### Select Specific Attributes

```typescript
// Load only id and name
const users = await User.where({}, {
  attributes: ["id", "name"]
});

users.forEach(user => {
  console.log(`${user.id}: ${user.name}`);
  // email, age, role are not loaded
});
```

### Select for Display

```typescript
// Load minimal data for user list
const user_list = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Display user list
user_list.forEach(user => {
  console.log(`${user.name} (${user.email})`);
});
```

### Select for Performance

```typescript
// Load only necessary fields for computation
const users = await User.where({ role: "premium" }, {
  attributes: ["id", "total_spent"]
});

const total_revenue = users.reduce((sum, user) => sum + user.total_spent, 0);
console.log(`Total premium revenue: $${total_revenue}`);
```

### Combined with Pagination

```typescript
// Paginated user list with minimal data
const users = await User.where({}, {
  attributes: ["id", "name", "email", "role"],
  limit: 20,
  skip: 0,
  order: "ASC"
});

console.log(`Loaded ${users.length} users with minimal data`);
```

## Complex Filtering

Combine multiple query techniques for advanced filtering:

### Multiple Conditions

```typescript
// Find premium adults
const premium_adults = await User.where({
  role: "premium",
  age: 25
});

// Find active users with specific role
const active_admins = await User.where({
  role: "admin",
  status: "active"
});
```

### Filter and Paginate

```typescript
// Get page 2 of active premium users
const users = await User.where(
  { role: "premium", active: true },
  {
    skip: 10,
    limit: 10,
    order: "DESC"
  }
);
```

### Filter with Attribute Selection

```typescript
// Get names of all admin users
const admins = await User.where(
  { role: "admin" },
  {
    attributes: ["id", "name", "email"]
  }
);

console.log("Admin users:");
admins.forEach(admin => {
  console.log(`  - ${admin.name} (${admin.email})`);
});
```

### Complex Business Logic

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare price: number;
  declare stock: number;
  declare category: string;
}

// Find affordable electronics in stock
const affordable_electronics = await Product.where({
  category: "electronics"
});

const in_stock = affordable_electronics.filter(p =>
  p.stock > 0 && p.price < 500
);

console.log(`Found ${in_stock.length} affordable electronics in stock`);
```

### Date Range Queries

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;
  declare total: number;
  declare status: string;
  declare created_at: string;
}

// Get orders from last 30 days
const thirty_days_ago = new Date();
thirty_days_ago.setDate(thirty_days_ago.getDate() - 30);

const all_orders = await Order.where({});
const recent_orders = all_orders.filter(order =>
  new Date(order.created_at) >= thirty_days_ago
);

console.log(`Orders in last 30 days: ${recent_orders.length}`);

// Calculate total revenue for period
const total = recent_orders.reduce((sum, order) => sum + order.total, 0);
console.log(`Total revenue: $${total.toFixed(2)}`);
```

## Complete Working Example

Here's a complete example demonstrating all advanced query patterns:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  Validate,
  Mutate,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

// Configure DynamoDB
Dynamite.config({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// User model
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  @Mutate((value) => (value as string).toLowerCase())
  declare email: string;

  declare age: number;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @Default(() => 0)
  declare total_spent: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Product model
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare category: string;
  declare price: number;
  declare stock: number;

  @Default(() => true)
  declare available: CreationOptional<boolean>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// Main application
async function main() {
  console.log("=== Advanced Queries Example ===\n");

  // 1. Create sample users
  console.log("1. Creating sample users...");
  await Promise.all([
    User.create({ name: "John Doe", email: "john@gmail.com", age: 25, role: "customer", total_spent: 150 }),
    User.create({ name: "Jane Smith", email: "jane@yahoo.com", age: 32, role: "premium", total_spent: 500 }),
    User.create({ name: "Bob Johnson", email: "bob@gmail.com", age: 45, role: "admin", total_spent: 0 }),
    User.create({ name: "Alice Williams", email: "alice@gmail.com", age: 28, role: "premium", total_spent: 750 }),
    User.create({ name: "Charlie Brown", email: "charlie@hotmail.com", age: 19, role: "customer", total_spent: 80 }),
    User.create({ name: "David Lee", email: "david@gmail.com", age: 55, role: "customer", total_spent: 200 }),
    User.create({ name: "Emma Wilson", email: "emma@yahoo.com", age: 23, role: "premium", total_spent: 1200 }),
    User.create({ name: "Frank Miller", email: "frank@gmail.com", age: 38, role: "moderator", total_spent: 350 })
  ]);
  console.log("Created 8 users\n");

  // 2. Create sample products
  console.log("2. Creating sample products...");
  await Promise.all([
    Product.create({ name: "Laptop", category: "electronics", price: 999.99, stock: 15 }),
    Product.create({ name: "Mouse", category: "electronics", price: 29.99, stock: 50 }),
    Product.create({ name: "Keyboard", category: "electronics", price: 79.99, stock: 30 }),
    Product.create({ name: "Monitor", category: "electronics", price: 299.99, stock: 0 }),
    Product.create({ name: "Desk", category: "furniture", price: 199.99, stock: 10 }),
    Product.create({ name: "Chair", category: "furniture", price: 149.99, stock: 20 })
  ]);
  console.log("Created 6 products\n");

  // 3. Comparison queries
  console.log("3. Comparison queries...");
  const adults = await User.where("age", ">=", 18);
  console.log(`Adults (age >= 18): ${adults.length}`);

  const seniors = await User.where("age", ">=", 55);
  console.log(`Seniors (age >= 55): ${seniors.length}`);

  const young_adults = await User.where("age", "<", 30);
  console.log(`Young adults (age < 30): ${young_adults.length}\n`);

  // 4. Array queries
  console.log("4. Array queries...");
  const privileged = await User.where("role", "in", ["admin", "moderator", "premium"]);
  console.log(`Privileged users: ${privileged.length}`);

  const gmail_users = await User.where("email", "contains", "gmail");
  console.log(`Gmail users: ${gmail_users.length}`);

  const j_names = await User.where("name", "begins-with", "J");
  console.log(`Names starting with J: ${j_names.length}\n`);

  // 5. Pagination
  console.log("5. Pagination...");
  const page_1 = await User.where({}, { limit: 3, skip: 0 });
  console.log(`Page 1: ${page_1.length} users`);
  page_1.forEach(u => console.log(`  - ${u.name}`));

  const page_2 = await User.where({}, { limit: 3, skip: 3 });
  console.log(`Page 2: ${page_2.length} users`);
  page_2.forEach(u => console.log(`  - ${u.name}`));
  console.log();

  // 6. Sorting
  console.log("6. Sorting...");
  const sorted_users = await User.where({}, { order: "DESC" });
  console.log("Users (descending order):");
  sorted_users.slice(0, 5).forEach(u => {
    console.log(`  - ${u.name} (age: ${u.age})`);
  });
  console.log();

  // 7. Attribute selection
  console.log("7. Attribute selection...");
  const user_list = await User.where({}, {
    attributes: ["id", "name", "email"],
    limit: 3
  });
  console.log("User summary (minimal data):");
  user_list.forEach(u => {
    console.log(`  - ${u.name}: ${u.email}`);
  });
  console.log();

  // 8. Complex filtering
  console.log("8. Complex filtering...");
  const premium_spenders = await User.where({ role: "premium" });
  const high_value = premium_spenders.filter(u => u.total_spent > 500);
  console.log(`Premium users with >$500 spent: ${high_value.length}`);
  high_value.forEach(u => {
    console.log(`  - ${u.name}: $${u.total_spent}`);
  });
  console.log();

  // 9. Product queries
  console.log("9. Product queries...");
  const electronics = await Product.where({ category: "electronics" });
  console.log(`Electronics: ${electronics.length}`);

  const in_stock = electronics.filter(p => p.stock > 0);
  console.log(`Electronics in stock: ${in_stock.length}`);

  const affordable = in_stock.filter(p => p.price < 100);
  console.log(`Affordable electronics in stock: ${affordable.length}`);
  affordable.forEach(p => {
    console.log(`  - ${p.name}: $${p.price} (${p.stock} in stock)`);
  });
  console.log();

  // 10. Aggregations
  console.log("10. Aggregations...");
  const all_users = await User.where({});

  // Total spending by role
  const by_role = all_users.reduce((acc, user) => {
    if (!acc[user.role]) acc[user.role] = 0;
    acc[user.role] += user.total_spent;
    return acc;
  }, {} as Record<string, number>);

  console.log("Total spending by role:");
  Object.entries(by_role).forEach(([role, total]) => {
    console.log(`  ${role}: $${total.toFixed(2)}`);
  });

  // Average age by role
  const age_by_role = all_users.reduce((acc, user) => {
    if (!acc[user.role]) acc[user.role] = { sum: 0, count: 0 };
    acc[user.role].sum += user.age;
    acc[user.role].count += 1;
    return acc;
  }, {} as Record<string, { sum: number; count: number }>);

  console.log("\nAverage age by role:");
  Object.entries(age_by_role).forEach(([role, data]) => {
    const avg = data.sum / data.count;
    console.log(`  ${role}: ${avg.toFixed(1)} years`);
  });
  console.log();

  // 11. Search functionality
  console.log("11. Search functionality...");
  const search_term = "john";
  const search_results = all_users.filter(user =>
    user.name.toLowerCase().includes(search_term) ||
    user.email.toLowerCase().includes(search_term)
  );
  console.log(`Search results for "${search_term}": ${search_results.length}`);
  search_results.forEach(u => {
    console.log(`  - ${u.name} (${u.email})`);
  });
  console.log();

  // 12. Date-based queries
  console.log("12. Date-based queries...");
  const one_hour_ago = new Date();
  one_hour_ago.setHours(one_hour_ago.getHours() - 1);

  const recent_users = all_users.filter(user =>
    new Date(user.created_at) >= one_hour_ago
  );
  console.log(`Users created in last hour: ${recent_users.length}\n`);

  console.log("=== All advanced queries completed ===");
}

// Run the application
main().catch(console.error);
```

## Expected Output

```
=== Advanced Queries Example ===

1. Creating sample users...
Created 8 users

2. Creating sample products...
Created 6 products

3. Comparison queries...
Adults (age >= 18): 8
Seniors (age >= 55): 1
Young adults (age < 30): 4

4. Array queries...
Privileged users: 5
Gmail users: 5
Names starting with J: 2

5. Pagination...
Page 1: 3 users
  - John Doe
  - Jane Smith
  - Bob Johnson
Page 2: 3 users
  - Alice Williams
  - Charlie Brown
  - David Lee

6. Sorting...
Users (descending order):
  - David Lee (age: 55)
  - Bob Johnson (age: 45)
  - Frank Miller (age: 38)
  - Jane Smith (age: 32)
  - Alice Williams (age: 28)

7. Attribute selection...
User summary (minimal data):
  - John Doe: john@gmail.com
  - Jane Smith: jane@yahoo.com
  - Bob Johnson: bob@gmail.com

8. Complex filtering...
Premium users with >$500 spent: 2
  - Alice Williams: $750
  - Emma Wilson: $1200

9. Product queries...
Electronics: 4
Electronics in stock: 3
Affordable electronics in stock: 2
  - Mouse: $29.99 (50 in stock)
  - Keyboard: $79.99 (30 in stock)

10. Aggregations...
Total spending by role:
  customer: $430.00
  premium: $2450.00
  admin: $0.00
  moderator: $350.00

Average age by role:
  customer: 33.0 years
  premium: 27.7 years
  admin: 45.0 years
  moderator: 38.0 years

11. Search functionality...
Search results for "john": 2
  - John Doe (john@gmail.com)
  - Bob Johnson (bob@gmail.com)

12. Date-based queries...
Users created in last hour: 8

=== All advanced queries completed ===
```

## Performance Optimization

### 1. Use Attribute Selection

```typescript
// Good - load only needed fields
const users = await User.where({}, {
  attributes: ["id", "name"]
});

// Bad - loading all fields when only need a few
const users = await User.where({});
```

### 2. Implement Pagination

```typescript
// Good - paginated queries
const users = await User.where({}, {
  limit: 20,
  skip: 0
});

// Bad - loading all records at once
const users = await User.where({});
```

### 3. Filter Early

```typescript
// Good - filter in DynamoDB
const admins = await User.where({ role: "admin" });

// Bad - filter in application
const all_users = await User.where({});
const admins = all_users.filter(u => u.role === "admin");
```

### 4. Use Indexes

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // Index frequently queried fields
  @Index()
  declare email: string;

  @IndexSort()
  declare created_at: string;
}
```

### 5. Cache Frequently Accessed Data

```typescript
// Simple in-memory cache
const cache = new Map<string, any>();

async function get_user_by_id(id: string) {
  if (cache.has(id)) {
    return cache.get(id);
  }

  const user = await User.first({ id });
  if (user) {
    cache.set(id, user);
  }
  return user;
}
```

## Best Practices

### 1. Use Specific Operators

```typescript
// Good - specific operator
const users = await User.where("age", ">=", 18);

// Bad - loading all and filtering
const all_users = await User.where({});
const adults = all_users.filter(u => u.age >= 18);
```

### 2. Combine Filters

```typescript
// Good - multiple conditions in one query
const users = await User.where({
  role: "premium",
  active: true
});

// Bad - multiple separate queries
const premium = await User.where({ role: "premium" });
const active_premium = premium.filter(u => u.active);
```

### 3. Paginate Large Results

```typescript
// Good - paginated results
async function* iterate_users(page_size: number) {
  let page = 0;
  while (true) {
    const users = await User.where({}, {
      skip: page * page_size,
      limit: page_size
    });

    if (users.length === 0) break;

    yield users;
    page++;
  }
}

for await (const users of iterate_users(100)) {
  // Process batch
}

// Bad - loading everything
const all_users = await User.where({});
```

### 4. Select Only Needed Attributes

```typescript
// Good - minimal data for display
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Bad - loading all fields
const users = await User.where({});
```

### 5. Use Clear Query Names

```typescript
// Good - descriptive query
async function get_active_premium_users() {
  return await User.where({
    role: "premium",
    active: true
  });
}

// Bad - unclear query
async function get_users_1() {
  return await User.where({ role: "premium", active: true });
}
```

## Next Steps

### Related Documentation

- [Basic Model Example](./basic-model.md) - Simple CRUD operations
- [Validation Example](./validation.md) - Data validation patterns
- [Relationships Example](./relationships.md) - Relationships and nested includes

### API References

- [Table API](../api/table.md) - Complete Table class documentation
- [Query Operators](../guides/core-concepts.md#query-operators) - All available operators
- [Decorators Guide](../guides/decorators.md) - All available decorators

### Advanced Topics

- **Query Optimization** - Optimize query performance
- **Caching Strategies** - Implement effective caching
- **Batch Operations** - Process large datasets efficiently
- **Real-time Queries** - Build reactive queries

Happy querying with Dynamite!
