# Relationships Example

This comprehensive example demonstrates how to define and use relationships in Dynamite ORM. Learn how to create one-to-many (HasMany) and many-to-one (BelongsTo) relationships, perform nested includes, filter related data, and build complex data structures.

## Table of Contents

- [Relationship Basics](#relationship-basics)
- [One-to-Many (HasMany)](#one-to-many-hasmany)
- [Many-to-One (BelongsTo)](#many-to-one-belongsto)
- [Nested Relationships](#nested-relationships)
- [Filtered Relationships](#filtered-relationships)
- [Complete E-Commerce Example](#complete-e-commerce-example)
- [Expected Output](#expected-output)
- [Advanced Patterns](#advanced-patterns)
- [Best Practices](#best-practices)

## Relationship Basics

Dynamite supports two types of relationships:

- **HasMany** - One-to-many relationship (parent has multiple children)
- **BelongsTo** - Many-to-one relationship (child belongs to parent)

### Key Concepts

```typescript
import { HasMany, BelongsTo, NonAttribute } from "@arcaelas/dynamite";

// Parent model (User has many Orders)
class User extends Table<User> {
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;
}

// Child model (Order belongs to User)
class Order extends Table<Order> {
  declare user_id: string; // Foreign key

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}
```

**Important:**
- Use `NonAttribute<>` wrapper for relationship fields (they're not stored in DB)
- `HasMany<T>` resolves to `T[]` (array of related records)
- `BelongsTo<T>` resolves to `T | null` (single related record or null)
- Foreign key field must exist on the child model

## One-to-Many (HasMany)

Define a one-to-many relationship where a parent model has multiple related children.

### Basic HasMany Example

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  HasMany,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

// User model (parent)
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  // One-to-many: User has many Posts
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;
}

// Post model (child)
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string; // Foreign key
  declare title: string;
  declare content: string;
}
```

### Loading HasMany Relationships

```typescript
// Load users with their posts
const users_with_posts = await User.where({}, {
  include: {
    posts: {}
  }
});

users_with_posts.forEach(user => {
  console.log(`${user.name} has ${user.posts.length} posts`);
  user.posts.forEach(post => {
    console.log(`  - ${post.title}`);
  });
});

// Load specific user with posts
const user = await User.first({ id: "user-123" });
if (user) {
  const user_with_posts = await User.where({ id: user.id }, {
    include: { posts: {} }
  });
  console.log(`Posts: ${user_with_posts[0].posts.length}`);
}
```

### Multiple HasMany Relationships

A model can have multiple one-to-many relationships:

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  // User has many Posts
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;

  // User has many Comments
  @HasMany(() => Comment, "user_id")
  declare comments: NonAttribute<HasMany<Comment>>;

  // User has many Orders
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;
}

// Load user with all relationships
const users = await User.where({ id: "user-123" }, {
  include: {
    posts: {},
    comments: {},
    orders: {}
  }
});

const user = users[0];
console.log(`Posts: ${user.posts.length}`);
console.log(`Comments: ${user.comments.length}`);
console.log(`Orders: ${user.orders.length}`);
```

## Many-to-One (BelongsTo)

Define a many-to-one relationship where a child model belongs to a single parent.

### Basic BelongsTo Example

```typescript
// Post model (child)
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string; // Foreign key
  declare title: string;
  declare content: string;

  // Many-to-one: Post belongs to User
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}

// User model (parent)
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;
}
```

### Loading BelongsTo Relationships

```typescript
// Load posts with their author
const posts_with_author = await Post.where({}, {
  include: {
    user: {}
  }
});

posts_with_author.forEach(post => {
  console.log(`${post.title} by ${post.user?.name || 'Unknown'}`);
});

// Load specific post with author
const post = await Post.first({ id: "post-123" });
if (post) {
  const post_with_author = await Post.where({ id: post.id }, {
    include: { user: {} }
  });
  console.log(`Author: ${post_with_author[0].user?.name}`);
}
```

### Multiple BelongsTo Relationships

A child model can belong to multiple parents:

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare product_id: string;
  declare quantity: number;

  // Order belongs to User
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  // Order belongs to Product
  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

// Load order with both relationships
const orders = await Order.where({ id: "order-123" }, {
  include: {
    user: {},
    product: {}
  }
});

const order = orders[0];
console.log(`Customer: ${order.user?.name}`);
console.log(`Product: ${order.product?.name}`);
console.log(`Quantity: ${order.quantity}`);
```

## Nested Relationships

Load relationships that have their own relationships (nested includes).

### Two-Level Nesting

```typescript
// User has many Posts, Post has many Comments
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;
  declare name: string;

  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;
}

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;
  declare user_id: string;
  declare title: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @HasMany(() => Comment, "post_id")
  declare comments: NonAttribute<HasMany<Comment>>;
}

class Comment extends Table<Comment> {
  @PrimaryKey()
  declare id: string;
  declare post_id: string;
  declare content: string;
}

// Load users with posts and comments
const users = await User.where({}, {
  include: {
    posts: {
      include: {
        comments: {}
      }
    }
  }
});

users.forEach(user => {
  console.log(`${user.name}:`);
  user.posts.forEach(post => {
    console.log(`  ${post.title} (${post.comments.length} comments)`);
    post.comments.forEach(comment => {
      console.log(`    - ${comment.content}`);
    });
  });
});
```

### Multi-Level Nesting

```typescript
// Order -> OrderItem -> Product
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;
  declare user_id: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @HasMany(() => OrderItem, "order_id")
  declare items: NonAttribute<HasMany<OrderItem>>;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;
  declare order_id: string;
  declare product_id: string;
  declare quantity: number;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;
  declare name: string;
  declare price: number;
}

// Load orders with items and products
const orders = await Order.where({}, {
  include: {
    user: {},
    items: {
      include: {
        product: {}
      }
    }
  }
});

orders.forEach(order => {
  console.log(`Order ${order.id} by ${order.user?.name}`);
  order.items.forEach(item => {
    console.log(`  ${item.quantity}x ${item.product?.name} @ $${item.product?.price}`);
  });
});
```

## Filtered Relationships

Apply filters, limits, and ordering to related data.

### Filter Related Records

```typescript
// Load user with only published posts
const users = await User.where({ id: "user-123" }, {
  include: {
    posts: {
      where: { status: "published" }
    }
  }
});

console.log(`Published posts: ${users[0].posts.length}`);
```

### Limit Related Records

```typescript
// Load user with 5 most recent posts
const users = await User.where({ id: "user-123" }, {
  include: {
    posts: {
      limit: 5,
      order: "DESC"
    }
  }
});

console.log(`Recent posts: ${users[0].posts.length}`);
```

### Select Specific Attributes

```typescript
// Load posts with only user name and email
const posts = await Post.where({}, {
  include: {
    user: {
      attributes: ["id", "name", "email"]
    }
  }
});

posts.forEach(post => {
  console.log(`${post.title} by ${post.user?.name} (${post.user?.email})`);
});
```

### Combined Filters

```typescript
// Complex relationship query
const users = await User.where({ role: "premium" }, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 10,
      order: "DESC",
      attributes: ["id", "total", "created_at"]
    },
    posts: {
      where: { published: true },
      limit: 5
    }
  }
});

users.forEach(user => {
  console.log(`${user.name}:`);
  console.log(`  Recent orders: ${user.orders.length}`);
  console.log(`  Published posts: ${user.posts.length}`);
});
```

## Complete E-Commerce Example

Here's a complete e-commerce system demonstrating all relationship patterns:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  HasMany,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  NonAttribute,
  Dynamite
} from "@arcaelas/dynamite";

// User model
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  // Relationships
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;

  @HasMany(() => Review, "user_id")
  declare reviews: NonAttribute<HasMany<Review>>;
}

// Product model
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare description: string;
  declare price: number;

  @Default(() => 0)
  declare stock: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Relationships
  @HasMany(() => OrderItem, "product_id")
  declare order_items: NonAttribute<HasMany<OrderItem>>;

  @HasMany(() => Review, "product_id")
  declare reviews: NonAttribute<HasMany<Review>>;
}

// Order model
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;

  @Default(() => "pending")
  declare status: CreationOptional<string>;

  declare total: number;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  // Relationships
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @HasMany(() => OrderItem, "order_id")
  declare items: NonAttribute<HasMany<OrderItem>>;
}

// OrderItem model
class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare order_id: string;
  declare product_id: string;
  declare quantity: number;
  declare price: number;

  // Relationships
  @BelongsTo(() => Order, "order_id")
  declare order: NonAttribute<BelongsTo<Order>>;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

// Review model
class Review extends Table<Review> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare product_id: string;
  declare rating: number;
  declare comment: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Relationships
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

// Configure DynamoDB and register all tables
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User, Product, Order, OrderItem, Review],
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Main application
async function main() {
  // Connect and sync tables
  dynamite.connect();
  await dynamite.sync();
  console.log("=== E-Commerce Relationships Example ===\n");

  // 1. Create users
  console.log("1. Creating users...");
  const user1 = await User.create({
    name: "John Doe",
    email: "john@example.com"
  });
  const user2 = await User.create({
    name: "Jane Smith",
    email: "jane@example.com"
  });
  console.log(`Created: ${user1.name}, ${user2.name}\n`);

  // 2. Create products
  console.log("2. Creating products...");
  const product1 = await Product.create({
    name: "Laptop",
    description: "High-performance laptop",
    price: 999.99,
    stock: 10
  });
  const product2 = await Product.create({
    name: "Mouse",
    description: "Wireless mouse",
    price: 29.99,
    stock: 50
  });
  const product3 = await Product.create({
    name: "Keyboard",
    description: "Mechanical keyboard",
    price: 79.99,
    stock: 30
  });
  console.log(`Created: ${product1.name}, ${product2.name}, ${product3.name}\n`);

  // 3. Create orders
  console.log("3. Creating orders...");
  const order1 = await Order.create({
    user_id: user1.id,
    total: 1109.97,
    status: "pending"
  });
  const order2 = await Order.create({
    user_id: user2.id,
    total: 79.99,
    status: "completed"
  });
  console.log(`Created: Order ${order1.id}, Order ${order2.id}\n`);

  // 4. Create order items
  console.log("4. Creating order items...");
  await OrderItem.create({
    order_id: order1.id,
    product_id: product1.id,
    quantity: 1,
    price: 999.99
  });
  await OrderItem.create({
    order_id: order1.id,
    product_id: product2.id,
    quantity: 2,
    price: 29.99
  });
  await OrderItem.create({
    order_id: order1.id,
    product_id: product3.id,
    quantity: 1,
    price: 79.99
  });
  await OrderItem.create({
    order_id: order2.id,
    product_id: product3.id,
    quantity: 1,
    price: 79.99
  });
  console.log("Order items created\n");

  // 5. Create reviews
  console.log("5. Creating reviews...");
  await Review.create({
    user_id: user1.id,
    product_id: product1.id,
    rating: 5,
    comment: "Excellent laptop! Very fast and reliable."
  });
  await Review.create({
    user_id: user2.id,
    product_id: product3.id,
    rating: 4,
    comment: "Great keyboard, but a bit loud."
  });
  console.log("Reviews created\n");

  // 6. Load user with orders
  console.log("6. Loading user with orders...");
  const users_with_orders = await User.where({ id: user1.id }, {
    include: {
      orders: {}
    }
  });
  const user_with_orders = users_with_orders[0];
  console.log(`${user_with_orders.name} has ${user_with_orders.orders.length} order(s)`);
  user_with_orders.orders.forEach(order => {
    console.log(`  Order ${order.id}: $${order.total} (${order.status})`);
  });
  console.log();

  // 7. Load order with items and products
  console.log("7. Loading order with items and products...");
  const orders_with_items = await Order.where({ id: order1.id }, {
    include: {
      user: {},
      items: {
        include: {
          product: {}
        }
      }
    }
  });
  const order_with_items = orders_with_items[0];
  console.log(`Order ${order_with_items.id} by ${order_with_items.user?.name}`);
  console.log(`Total: $${order_with_items.total}`);
  console.log("Items:");
  order_with_items.items.forEach(item => {
    console.log(`  ${item.quantity}x ${item.product?.name} @ $${item.price}`);
  });
  console.log();

  // 8. Load product with reviews and reviewers
  console.log("8. Loading product with reviews...");
  const products_with_reviews = await Product.where({ id: product1.id }, {
    include: {
      reviews: {
        include: {
          user: {}
        }
      }
    }
  });
  const product_with_reviews = products_with_reviews[0];
  console.log(`${product_with_reviews.name} - Reviews:`);
  product_with_reviews.reviews.forEach(review => {
    console.log(`  ${review.rating}/5 by ${review.user?.name}`);
    console.log(`  "${review.comment}"`);
  });
  console.log();

  // 9. Load user with orders, reviews, and related data
  console.log("9. Loading user with all relationships...");
  const users_complete = await User.where({ id: user1.id }, {
    include: {
      orders: {
        include: {
          items: {
            include: {
              product: {}
            }
          }
        }
      },
      reviews: {
        include: {
          product: {}
        }
      }
    }
  });
  const user_complete = users_complete[0];
  console.log(`${user_complete.name}:`);
  console.log(`  Orders: ${user_complete.orders.length}`);
  user_complete.orders.forEach(order => {
    console.log(`    - Order ${order.id}: ${order.items.length} items, $${order.total}`);
  });
  console.log(`  Reviews: ${user_complete.reviews.length}`);
  user_complete.reviews.forEach(review => {
    console.log(`    - ${review.rating}/5 for ${review.product?.name}`);
  });
  console.log();

  // 10. Load orders with filters
  console.log("10. Loading completed orders only...");
  const all_users_with_completed = await User.where({}, {
    include: {
      orders: {
        where: { status: "completed" }
      }
    }
  });
  all_users_with_completed.forEach(user => {
    if (user.orders.length > 0) {
      console.log(`${user.name}: ${user.orders.length} completed order(s)`);
    }
  });
  console.log();

  console.log("=== All relationship operations completed ===");
}

// Run the application
main().catch(console.error);
```

## Expected Output

```
=== E-Commerce Relationships Example ===

1. Creating users...
Created: John Doe, Jane Smith

2. Creating products...
Created: Laptop, Mouse, Keyboard

3. Creating orders...
Created: Order 550e8400-..., Order 6ba7b810-...

4. Creating order items...
Order items created

5. Creating reviews...
Reviews created

6. Loading user with orders...
John Doe has 1 order(s)
  Order 550e8400-...: $1109.97 (pending)

7. Loading order with items and products...
Order 550e8400-... by John Doe
Total: $1109.97
Items:
  1x Laptop @ $999.99
  2x Mouse @ $29.99
  1x Keyboard @ $79.99

8. Loading product with reviews...
Laptop - Reviews:
  5/5 by John Doe
  "Excellent laptop! Very fast and reliable."

9. Loading user with all relationships...
John Doe:
  Orders: 1
    - Order 550e8400-...: 3 items, $1109.97
  Reviews: 1
    - 5/5 for Laptop

10. Loading completed orders only...
Jane Smith: 1 completed order(s)

=== All relationship operations completed ===
```

## Advanced Patterns

### Self-Referential Relationships

Models can have relationships with themselves:

```typescript
class Category extends Table<Category> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare parent_id: string | null;

  // Category has many child categories
  @HasMany(() => Category, "parent_id")
  declare children: NonAttribute<HasMany<Category>>;

  // Category belongs to parent category
  @BelongsTo(() => Category, "parent_id")
  declare parent: NonAttribute<BelongsTo<Category>>;
}

// Load category tree
const categories = await Category.where({ parent_id: null }, {
  include: {
    children: {
      include: {
        children: {}
      }
    }
  }
});
```

### Many-to-Many Relationships (via Junction Table)

Implement many-to-many using a junction table:

```typescript
// Student model
class Student extends Table<Student> {
  @PrimaryKey()
  declare id: string;
  declare name: string;

  @HasMany(() => Enrollment, "student_id")
  declare enrollments: NonAttribute<HasMany<Enrollment>>;
}

// Course model
class Course extends Table<Course> {
  @PrimaryKey()
  declare id: string;
  declare name: string;

  @HasMany(() => Enrollment, "course_id")
  declare enrollments: NonAttribute<HasMany<Enrollment>>;
}

// Junction table
class Enrollment extends Table<Enrollment> {
  @PrimaryKey()
  declare id: string;

  declare student_id: string;
  declare course_id: string;
  declare grade: string;

  @BelongsTo(() => Student, "student_id")
  declare student: NonAttribute<BelongsTo<Student>>;

  @BelongsTo(() => Course, "course_id")
  declare course: NonAttribute<BelongsTo<Course>>;
}

// Load student with courses
const students = await Student.where({ id: "student-123" }, {
  include: {
    enrollments: {
      include: {
        course: {}
      }
    }
  }
});

const student = students[0];
console.log(`${student.name}'s courses:`);
student.enrollments.forEach(enrollment => {
  console.log(`  ${enrollment.course?.name} - Grade: ${enrollment.grade}`);
});
```

### Polymorphic Relationships

Implement polymorphic relationships using type fields:

```typescript
class Comment extends Table<Comment> {
  @PrimaryKey()
  declare id: string;

  declare commentable_type: string; // "Post" or "Video"
  declare commentable_id: string;
  declare content: string;

  // Load polymorphic relationship manually
  async get_commentable() {
    if (this.commentable_type === "Post") {
      return await Post.first({ id: this.commentable_id });
    } else if (this.commentable_type === "Video") {
      return await Video.first({ id: this.commentable_id });
    }
    return null;
  }
}
```

## Best Practices

### 1. Use NonAttribute for Relationships

```typescript
// Good - marked as NonAttribute
@HasMany(() => Order, "user_id")
declare orders: NonAttribute<HasMany<Order>>;

// Bad - will try to save to database
@HasMany(() => Order, "user_id")
declare orders: Order[];
```

### 2. Define Foreign Keys Explicitly

```typescript
// Good - explicit foreign key
class Order extends Table<Order> {
  declare user_id: string; // Foreign key field

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}

// Bad - missing foreign key field
class Order extends Table<Order> {
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}
```

### 3. Use Arrow Functions in Decorators

```typescript
// Good - arrow function (avoids circular dependency)
@HasMany(() => Order, "user_id")
declare orders: NonAttribute<HasMany<Order>>;

// Bad - direct reference (can cause circular dependency issues)
@HasMany(Order, "user_id")
declare orders: NonAttribute<HasMany<Order>>;
```

### 4. Filter Relationships for Performance

```typescript
// Good - load only what you need
const users = await User.where({}, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 10,
      attributes: ["id", "total"]
    }
  }
});

// Bad - loading all orders with all fields
const users = await User.where({}, {
  include: {
    orders: {}
  }
});
```

### 5. Avoid N+1 Queries

```typescript
// Good - load relationships in one query
const posts = await Post.where({}, {
  include: {
    user: {},
    comments: {}
  }
});

// Bad - N+1 queries
const posts = await Post.where({});
for (const post of posts) {
  const user = await User.first({ id: post.user_id });
  const comments = await Comment.where({ post_id: post.id });
}
```

## Next Steps

### Related Documentation

- [Basic Model Example](./basic.md) - Simple CRUD operations
- [Advanced Queries Example](./advanced.md) - Complex queries and pagination

### API References

- [HasMany Decorator](../references/decorators.md#hasmany) - Complete HasMany documentation
- [BelongsTo Decorator](../references/decorators.md#belongsto) - Complete BelongsTo documentation
- [Advanced Queries](./advanced.md) - Complex queries with relationships

### Additional Topics

- **Eager Loading** - Load all related data upfront
- **Lazy Loading** - Load relationships on-demand
- **Relationship Caching** - Cache frequently accessed relationships
- **Circular Dependencies** - Handle circular model references

Happy coding with Dynamite relationships!
