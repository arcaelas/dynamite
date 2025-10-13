# Best Practices Guide

This guide provides production-ready guidance for building scalable, maintainable applications with Dynamite ORM.

## 1. Model Design

### Naming Conventions

Use clear, descriptive names that reflect your domain:

```typescript
// ✅ Good - Clear entity names
@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  @Attribute()
  email!: string;
}

@Table({ name: 'order_items' })
class OrderItem extends Model {
  @PrimaryKey()
  item_id!: string;
}

// ❌ Avoid - Generic or unclear names
@Table({ name: 'data' })
class Data extends Model { }

@Table({ name: 'temp' })
class Temp extends Model { }
```

### File Structure

Organize models by domain context:

```
src/
├── models/
│   ├── user/
│   │   ├── user.model.ts
│   │   ├── user_profile.model.ts
│   │   └── user_preferences.model.ts
│   ├── order/
│   │   ├── order.model.ts
│   │   ├── order_item.model.ts
│   │   └── order_history.model.ts
│   └── index.ts
```

### Model Organization

Keep models focused and cohesive:

```typescript
// ✅ Good - Focused model with related attributes
@Table({ name: 'products' })
class Product extends Model {
  @PrimaryKey()
  product_id!: string;

  @Attribute()
  name!: string;

  @Attribute()
  price!: number;

  @Attribute()
  category!: string;

  @Attribute()
  inventory_count!: number;

  @Attribute()
  created_at!: number;

  @Attribute()
  updated_at!: number;
}

// ❌ Avoid - Mixing unrelated concerns
@Table({ name: 'products' })
class Product extends Model {
  @PrimaryKey()
  product_id!: string;

  @Attribute()
  name!: string;

  // Don't embed full user data in product
  @Attribute()
  created_by_user!: {
    user_id: string;
    email: string;
    full_name: string;
    profile_image: string;
  };
}
```

## 2. Primary Key Strategy

### UUID vs Sequential IDs

**Use UUIDs for distributed systems:**

```typescript
import { v4 as uuid } from 'uuid';

@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  static async Create(data: CreateUserData): Promise<User> {
    const user = new User();
    user.user_id = uuid(); // Globally unique
    user.email = data.email;
    user.created_at = Date.now();
    await user.Save();
    return user;
  }
}

// ✅ Benefits: No coordination needed, globally unique
// ❌ Drawback: Cannot sort by creation time
```

**Use ULID for sortable IDs:**

```typescript
import { ulid } from 'ulid';

@Table({ name: 'events' })
class Event extends Model {
  @PrimaryKey()
  event_id!: string; // ULID is lexicographically sortable

  static async Create(data: CreateEventData): Promise<Event> {
    const event = new Event();
    event.event_id = ulid(); // Timestamp-based, sortable
    event.type = data.type;
    await event.Save();
    return event;
  }
}

// ✅ Benefits: Sortable by time, globally unique
// ✅ Better for range queries
```

### Composite Keys

Use composite keys for hierarchical data:

```typescript
@Table({ name: 'comments' })
class Comment extends Model {
  @PrimaryKey()
  post_id!: string; // Partition key

  @SortKey()
  comment_id!: string; // Sort key

  @Attribute()
  user_id!: string;

  @Attribute()
  content!: string;

  @Attribute()
  created_at!: number;

  // ✅ Efficient: Get all comments for a post
  static async GetByPost(post_id: string): Promise<Comment[]> {
    return Comment.Query({ post_id });
  }
}

// ❌ Avoid - Simple key when composite is better
@Table({ name: 'comments' })
class Comment extends Model {
  @PrimaryKey()
  comment_id!: string; // Cannot efficiently query by post

  @Attribute()
  post_id!: string; // Would need a scan or GSI
}
```

## 3. Index Strategy

### Global Secondary Indexes (GSI)

Create GSIs for alternative query patterns:

```typescript
@Table({ name: 'orders' })
class Order extends Model {
  @PrimaryKey()
  order_id!: string;

  @Attribute()
  @Index({ name: 'user_orders_index', type: 'gsi' })
  user_id!: string;

  @Attribute()
  @Index({ name: 'user_orders_index', type: 'gsi', sort_key: true })
  created_at!: number;

  @Attribute()
  status!: 'pending' | 'completed' | 'cancelled';

  // ✅ Efficient query using GSI
  static async GetUserOrders(user_id: string, limit = 20): Promise<Order[]> {
    return Order.Query({
      user_id,
      index: 'user_orders_index',
      limit,
      scan_forward: false // Most recent first
    });
  }
}
```

### Local Secondary Indexes (LSI)

Use LSI for alternative sort keys with same partition key:

```typescript
@Table({ name: 'products' })
class Product extends Model {
  @PrimaryKey()
  category!: string; // Partition key

  @SortKey()
  product_id!: string; // Default sort key

  @Attribute()
  @Index({ name: 'category_price_index', type: 'lsi', sort_key: true })
  price!: number;

  @Attribute()
  name!: string;

  // Query by category and sort by price
  static async GetByPriceRange(
    category: string,
    min_price: number,
    max_price: number
  ): Promise<Product[]> {
    return Product.Query({
      category,
      price: { between: [min_price, max_price] },
      index: 'category_price_index'
    });
  }
}
```

### Avoiding Hot Partitions

Distribute writes across partitions:

```typescript
// ❌ Avoid - Single hot partition
@Table({ name: 'metrics' })
class Metric extends Model {
  @PrimaryKey()
  metric_type!: string; // Only a few values = hot partition

  @SortKey()
  timestamp!: number;
}

// ✅ Good - Distributed writes
@Table({ name: 'metrics' })
class Metric extends Model {
  @PrimaryKey()
  partition_key!: string; // metric_type#shard_0-99

  @SortKey()
  timestamp!: number;

  static async Create(metric_type: string, data: MetricData): Promise<Metric> {
    const metric = new Metric();
    const shard = Math.floor(Math.random() * 100);
    metric.partition_key = `${metric_type}#${shard}`;
    metric.timestamp = Date.now();
    metric.value = data.value;
    await metric.Save();
    return metric;
  }

  static async GetRecent(metric_type: string, minutes = 5): Promise<Metric[]> {
    const since = Date.now() - (minutes * 60 * 1000);
    const shards = Array.from({ length: 100 }, (_, i) => i);

    // Query all shards in parallel
    const results = await Promise.all(
      shards.map(shard =>
        Metric.Query({
          partition_key: `${metric_type}#${shard}`,
          timestamp: { gte: since }
        })
      )
    );

    return results.flat().sort((a, b) => b.timestamp - a.timestamp);
  }
}
```

## 4. Query Optimization

### Efficient Queries

Use Query instead of Scan whenever possible:

```typescript
// ✅ Efficient - Query with partition key
const user_orders = await Order.Query({ user_id: 'user_123' });

// ✅ Efficient - Query with range condition
const recent_orders = await Order.Query({
  user_id: 'user_123',
  created_at: { gte: Date.now() - 86400000 } // Last 24 hours
});

// ❌ Slow - Scan entire table
const pending_orders = await Order.Scan({ status: 'pending' });

// ✅ Better - GSI for status queries
@Table({ name: 'orders' })
class Order extends Model {
  @Attribute()
  @Index({ name: 'status_index', type: 'gsi' })
  status!: string;
}

const pending_orders = await Order.Query({
  status: 'pending',
  index: 'status_index'
});
```

### Pagination

Implement efficient pagination:

```typescript
interface PaginatedResponse<T> {
  items: T[];
  next_token?: string;
  has_more: boolean;
}

class Order extends Model {
  static async GetUserOrdersPaginated(
    user_id: string,
    limit = 20,
    next_token?: string
  ): Promise<PaginatedResponse<Order>> {
    const result = await Order.Query({
      user_id,
      limit,
      exclusive_start_key: next_token ? JSON.parse(
        Buffer.from(next_token, 'base64').toString()
      ) : undefined
    });

    return {
      items: result,
      next_token: result.last_evaluated_key ? Buffer.from(
        JSON.stringify(result.last_evaluated_key)
      ).toString('base64') : undefined,
      has_more: !!result.last_evaluated_key
    };
  }
}
```

### Projection

Fetch only needed attributes:

```typescript
// ✅ Efficient - Fetch only needed fields
const users = await User.Query({
  status: 'active',
  index: 'status_index',
  projection: ['user_id', 'email', 'name']
});

// ❌ Wasteful - Fetching unnecessary data
const users = await User.Query({
  status: 'active',
  index: 'status_index'
  // Fetches all attributes including large profile_data
});
```

## 5. Data Modeling

### Single-Table Design

Model related entities in one table:

```typescript
// Single table for related entities
@Table({ name: 'app_data' })
class Entity extends Model {
  @PrimaryKey()
  pk!: string;

  @SortKey()
  sk!: string;

  @Attribute()
  entity_type!: string;

  @Attribute()
  @Index({ name: 'gsi1', type: 'gsi' })
  gsi1_pk?: string;

  @Attribute()
  @Index({ name: 'gsi1', type: 'gsi', sort_key: true })
  gsi1_sk?: string;
}

// User entity
class User extends Entity {
  static async Create(user_id: string, data: UserData): Promise<User> {
    const user = new User();
    user.pk = `USER#${user_id}`;
    user.sk = `METADATA`;
    user.entity_type = 'user';
    user.email = data.email;
    user.gsi1_pk = `EMAIL#${data.email}`;
    user.gsi1_sk = `USER#${user_id}`;
    await user.Save();
    return user;
  }

  static async FindByEmail(email: string): Promise<User | null> {
    const results = await Entity.Query({
      gsi1_pk: `EMAIL#${email}`,
      index: 'gsi1',
      limit: 1
    });
    return results[0] as User || null;
  }
}

// Order entity
class Order extends Entity {
  static async Create(user_id: string, order_data: OrderData): Promise<Order> {
    const order_id = ulid();
    const order = new Order();
    order.pk = `USER#${user_id}`;
    order.sk = `ORDER#${order_id}`;
    order.entity_type = 'order';
    order.gsi1_pk = `ORDER#${order_id}`;
    order.gsi1_sk = `METADATA`;
    Object.assign(order, order_data);
    await order.Save();
    return order;
  }

  static async GetUserOrders(user_id: string): Promise<Order[]> {
    return Entity.Query({
      pk: `USER#${user_id}`,
      sk: { begins_with: 'ORDER#' }
    }) as Promise<Order[]>;
  }
}
```

### Denormalization

Duplicate data for read performance:

```typescript
// ✅ Good - Denormalize for read efficiency
@Table({ name: 'orders' })
class Order extends Model {
  @PrimaryKey()
  order_id!: string;

  @Attribute()
  user_id!: string;

  // Denormalized user data
  @Attribute()
  user_email!: string;

  @Attribute()
  user_name!: string;

  @Attribute()
  items!: Array<{
    product_id: string;
    product_name: string; // Denormalized
    price: number; // Snapshot at order time
    quantity: number;
  }>;

  // ✅ Single read to get all order display data
  static async GetOrderSummary(order_id: string): Promise<Order> {
    return Order.FindByPk(order_id);
  }
}

// ❌ Avoid - Normalized requiring multiple queries
@Table({ name: 'orders' })
class Order extends Model {
  @PrimaryKey()
  order_id!: string;

  @Attribute()
  user_id!: string; // Need separate query for user data

  @Attribute()
  item_ids!: string[]; // Need separate queries for each item
}
```

## 6. Validation Strategy

### Model-Level Validation

Implement validation in model methods:

```typescript
@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  @Attribute()
  email!: string;

  @Attribute()
  age?: number;

  private static ValidateEmail(email: string): void {
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email_regex.test(email)) {
      throw new Error('Invalid email format');
    }
  }

  private static ValidateAge(age?: number): void {
    if (age !== undefined && (age < 0 || age > 150)) {
      throw new Error('Age must be between 0 and 150');
    }
  }

  static async Create(data: CreateUserData): Promise<User> {
    // Validate before saving
    this.ValidateEmail(data.email);
    this.ValidateAge(data.age);

    const user = new User();
    user.user_id = uuid();
    user.email = data.email;
    user.age = data.age;
    user.created_at = Date.now();

    await user.Save();
    return user;
  }

  async Update(updates: Partial<CreateUserData>): Promise<void> {
    if (updates.email) {
      User.ValidateEmail(updates.email);
      this.email = updates.email;
    }

    if (updates.age !== undefined) {
      User.ValidateAge(updates.age);
      this.age = updates.age;
    }

    this.updated_at = Date.now();
    await this.Save();
  }
}
```

### Custom Validators

Create reusable validation functions:

```typescript
// validators.ts
export class Validators {
  static Email(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  static PhoneNumber(value: string): boolean {
    return /^\+?[1-9]\d{1,14}$/.test(value);
  }

  static URL(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  static Range(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
  }

  static StringLength(value: string, min: number, max: number): boolean {
    return value.length >= min && value.length <= max;
  }
}

// Usage
@Table({ name: 'profiles' })
class Profile extends Model {
  @PrimaryKey()
  profile_id!: string;

  @Attribute()
  website?: string;

  @Attribute()
  bio?: string;

  static async Create(data: CreateProfileData): Promise<Profile> {
    if (data.website && !Validators.URL(data.website)) {
      throw new Error('Invalid website URL');
    }

    if (data.bio && !Validators.StringLength(data.bio, 0, 500)) {
      throw new Error('Bio must be 500 characters or less');
    }

    const profile = new Profile();
    profile.profile_id = uuid();
    Object.assign(profile, data);
    await profile.Save();
    return profile;
  }
}
```

## 7. Error Handling

### Try-Catch Patterns

Handle errors gracefully:

```typescript
class User extends Model {
  // ✅ Good - Specific error handling
  static async FindByEmail(email: string): Promise<User | null> {
    try {
      const results = await User.Query({
        email,
        index: 'email_index',
        limit: 1
      });
      return results[0] || null;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        // Expected condition failure
        return null;
      }

      if (error instanceof ProvisionedThroughputExceededException) {
        // Retry with exponential backoff
        await this.Delay(1000);
        return this.FindByEmail(email);
      }

      // Log unexpected errors
      console.error('Error finding user by email:', error);
      throw new Error('Failed to find user');
    }
  }

  // ✅ Good - Graceful degradation
  static async GetUserWithOrders(user_id: string): Promise<UserWithOrders> {
    try {
      const [user, orders] = await Promise.all([
        User.FindByPk(user_id),
        Order.Query({ user_id })
      ]);

      if (!user) {
        throw new Error('User not found');
      }

      return {
        ...user,
        orders: orders || [] // Fallback to empty array if orders fail
      };
    } catch (error) {
      // Log but don't expose internal details
      console.error('Error fetching user with orders:', error);
      throw new Error('Unable to retrieve user data');
    }
  }

  private static async Delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Transaction Error Handling

Handle transaction failures:

```typescript
class TransferService {
  static async TransferBalance(
    from_user_id: string,
    to_user_id: string,
    amount: number
  ): Promise<void> {
    const max_retries = 3;
    let attempt = 0;

    while (attempt < max_retries) {
      try {
        const from_user = await User.FindByPk(from_user_id);
        const to_user = await User.FindByPk(to_user_id);

        if (!from_user || !to_user) {
          throw new Error('User not found');
        }

        if (from_user.balance < amount) {
          throw new Error('Insufficient balance');
        }

        // Update balances
        from_user.balance -= amount;
        to_user.balance += amount;

        // Save both (implement transaction in your ORM)
        await Promise.all([
          from_user.Save(),
          to_user.Save()
        ]);

        return; // Success
      } catch (error) {
        attempt++;

        if (error instanceof ConditionalCheckFailedException && attempt < max_retries) {
          // Optimistic locking failure - retry
          await this.Delay(100 * Math.pow(2, attempt));
          continue;
        }

        // Other errors or max retries exceeded
        throw error;
      }
    }

    throw new Error('Transaction failed after maximum retries');
  }

  private static async Delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## 8. Testing

### Unit Tests

Test model logic in isolation:

```typescript
// user.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { User } from './user.model';

describe('User Model', () => {
  beforeEach(async () => {
    // Setup test data
  });

  afterEach(async () => {
    // Cleanup
  });

  describe('Create', () => {
    it('should create user with valid data', async () => {
      const user = await User.Create({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(user.user_id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.created_at).toBeGreaterThan(0);
    });

    it('should throw error with invalid email', async () => {
      await expect(
        User.Create({
          email: 'invalid-email',
          name: 'Test User'
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw error with duplicate email', async () => {
      await User.Create({
        email: 'test@example.com',
        name: 'User 1'
      });

      await expect(
        User.Create({
          email: 'test@example.com',
          name: 'User 2'
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('FindByEmail', () => {
    it('should find user by email', async () => {
      const created_user = await User.Create({
        email: 'find@example.com',
        name: 'Find Me'
      });

      const found_user = await User.FindByEmail('find@example.com');

      expect(found_user).toBeDefined();
      expect(found_user?.user_id).toBe(created_user.user_id);
      expect(found_user?.email).toBe('find@example.com');
    });

    it('should return null for non-existent email', async () => {
      const user = await User.FindByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('Update', () => {
    it('should update user attributes', async () => {
      const user = await User.Create({
        email: 'update@example.com',
        name: 'Original Name'
      });

      await user.Update({ name: 'Updated Name' });

      const updated_user = await User.FindByPk(user.user_id);
      expect(updated_user?.name).toBe('Updated Name');
      expect(updated_user?.email).toBe('update@example.com');
    });
  });
});
```

### Integration Tests with DynamoDB Local

Test against local DynamoDB:

```typescript
// test-setup.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { spawn, ChildProcess } from 'child_process';

export class DynamoDBLocal {
  private process?: ChildProcess;

  async Start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn('java', [
        '-Djava.library.path=./DynamoDBLocal_lib',
        '-jar',
        'DynamoDBLocal.jar',
        '-inMemory',
        '-port',
        '8000'
      ]);

      this.process.stdout?.on('data', (data) => {
        if (data.toString().includes('Started')) {
          resolve();
        }
      });

      this.process.on('error', reject);

      setTimeout(() => resolve(), 2000);
    });
  }

  async Stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
    }
  }
}

// integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DynamoDBLocal } from './test-setup';
import { Dynamite } from 'dynamite-orm';

const dynamodb_local = new DynamoDBLocal();

beforeAll(async () => {
  await dynamodb_local.Start();

  // Configure Dynamite to use local endpoint
  Dynamite.Configure({
    region: 'local',
    endpoint: 'http://localhost:8000',
    credentials: {
      accessKeyId: 'fake',
      secretAccessKey: 'fake'
    }
  });

  // Create tables
  await User.CreateTable();
  await Order.CreateTable();
}, 30000);

afterAll(async () => {
  await dynamodb_local.Stop();
});

describe('Integration Tests', () => {
  it('should perform complex query operations', async () => {
    const user = await User.Create({
      email: 'integration@example.com',
      name: 'Integration Test'
    });

    const orders = await Promise.all([
      Order.Create({ user_id: user.user_id, total: 100 }),
      Order.Create({ user_id: user.user_id, total: 200 }),
      Order.Create({ user_id: user.user_id, total: 300 })
    ]);

    const user_orders = await Order.Query({ user_id: user.user_id });

    expect(user_orders).toHaveLength(3);
    expect(user_orders.map(o => o.total).sort()).toEqual([100, 200, 300]);
  });
});
```

## 9. Type Safety

### Leveraging TypeScript

Use TypeScript features for type safety:

```typescript
// Define strict types
interface CreateUserData {
  email: string;
  name: string;
  age?: number;
}

interface UpdateUserData {
  name?: string;
  age?: number;
}

// Use branded types for IDs
type UserId = string & { readonly brand: unique symbol };
type OrderId = string & { readonly brand: unique symbol };

@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: UserId;

  @Attribute()
  email!: string;

  @Attribute()
  name!: string;

  @Attribute()
  age?: number;

  // Type-safe creation
  static async Create(data: CreateUserData): Promise<User> {
    const user = new User();
    user.user_id = uuid() as UserId;
    user.email = data.email;
    user.name = data.name;
    user.age = data.age;
    await user.Save();
    return user;
  }

  // Type-safe updates
  async Update(data: UpdateUserData): Promise<void> {
    if (data.name !== undefined) this.name = data.name;
    if (data.age !== undefined) this.age = data.age;
    await this.Save();
  }
}

// Use discriminated unions for polymorphic data
type Event =
  | { type: 'user_created'; user_id: UserId; email: string }
  | { type: 'order_placed'; order_id: OrderId; total: number }
  | { type: 'payment_completed'; order_id: OrderId; amount: number };

@Table({ name: 'events' })
class EventLog extends Model {
  @PrimaryKey()
  event_id!: string;

  @Attribute()
  event_data!: Event;

  @Attribute()
  created_at!: number;

  static async Log(event: Event): Promise<EventLog> {
    const log = new EventLog();
    log.event_id = ulid();
    log.event_data = event;
    log.created_at = Date.now();
    await log.Save();
    return log;
  }

  // Type-safe event processing
  static ProcessEvent(event: Event): void {
    switch (event.type) {
      case 'user_created':
        console.log(`User created: ${event.email}`);
        break;
      case 'order_placed':
        console.log(`Order placed: ${event.total}`);
        break;
      case 'payment_completed':
        console.log(`Payment completed: ${event.amount}`);
        break;
    }
  }
}
```

## 10. Security

### IAM Policies

Implement least privilege access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:region:account:table/users",
        "arn:aws:dynamodb:region:account:table/users/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:region:account:table/orders",
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": ["${aws:userid}"]
        }
      }
    }
  ]
}
```

### Data Encryption

Encrypt sensitive data:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(encryption_key: string) {
    this.key = Buffer.from(encryption_key, 'hex');
  }

  Encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const auth_tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${auth_tag.toString('hex')}:${encrypted}`;
  }

  Decrypt(ciphertext: string): string {
    const [iv_hex, auth_tag_hex, encrypted] = ciphertext.split(':');
    const iv = Buffer.from(iv_hex, 'hex');
    const auth_tag = Buffer.from(auth_tag_hex, 'hex');

    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(auth_tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

// Usage
@Table({ name: 'users' })
class User extends Model {
  private static encryption = new EncryptionService(process.env.ENCRYPTION_KEY!);

  @PrimaryKey()
  user_id!: string;

  @Attribute()
  email!: string;

  @Attribute()
  encrypted_ssn?: string;

  SetSSN(ssn: string): void {
    this.encrypted_ssn = User.encryption.Encrypt(ssn);
  }

  GetSSN(): string | undefined {
    return this.encrypted_ssn
      ? User.encryption.Decrypt(this.encrypted_ssn)
      : undefined;
  }
}
```

### Input Sanitization

Sanitize user input:

```typescript
class Sanitizer {
  static String(value: string, max_length = 1000): string {
    return value
      .trim()
      .slice(0, max_length)
      .replace(/[<>]/g, ''); // Remove potential HTML tags
  }

  static Number(value: unknown): number {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) {
      throw new Error('Invalid number');
    }
    return num;
  }

  static Boolean(value: unknown): boolean {
    return value === true || value === 'true' || value === 1;
  }
}
```

## 11. Performance

### Batch Operations

Use batch operations for multiple items:

```typescript
class User extends Model {
  // ✅ Good - Batch get
  static async GetMultiple(user_ids: string[]): Promise<User[]> {
    return User.BatchGet(user_ids.map(id => ({ user_id: id })));
  }

  // ✅ Good - Batch write
  static async CreateMultiple(users_data: CreateUserData[]): Promise<User[]> {
    const users = users_data.map(data => {
      const user = new User();
      user.user_id = uuid();
      Object.assign(user, data);
      return user;
    });

    await User.BatchWrite(users);
    return users;
  }

  // ❌ Avoid - Multiple individual requests
  static async GetMultipleSlow(user_ids: string[]): Promise<User[]> {
    return Promise.all(user_ids.map(id => User.FindByPk(id)));
  }
}
```

### Connection Pooling

Reuse DynamoDB client instances:

```typescript
// ✅ Good - Single client instance
class DatabaseConfig {
  private static client?: DynamoDBClient;

  static GetClient(): DynamoDBClient {
    if (!this.client) {
      this.client = new DynamoDBClient({
        region: process.env.AWS_REGION,
        maxAttempts: 3,
        requestHandler: {
          connectionTimeout: 3000,
          socketTimeout: 3000
        }
      });
    }
    return this.client;
  }
}

// ❌ Avoid - Creating new client each time
async function QueryUsers(): Promise<User[]> {
  const client = new DynamoDBClient({ region: 'us-east-1' });
  // ... use client
}
```

## 12. Migrations

### Schema Changes

Handle backward-compatible changes:

```typescript
// Version 1: Original schema
@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  @Attribute()
  name!: string;
}

// Version 2: Add optional field (backward compatible)
@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  @Attribute()
  name!: string;

  @Attribute()
  email?: string; // Optional - existing records work
}

// Version 3: Split name field (requires migration)
@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  @Attribute()
  first_name!: string;

  @Attribute()
  last_name!: string;

  @Attribute()
  email?: string;

  // Support old format during migration
  @Attribute()
  name?: string; // Deprecated

  get full_name(): string {
    if (this.first_name && this.last_name) {
      return `${this.first_name} ${this.last_name}`;
    }
    return this.name || '';
  }
}

// Migration script
async function MigrateUserNames(): Promise<void> {
  let last_key: any = undefined;

  do {
    const result = await User.Scan({
      filter: { name: { exists: true } },
      limit: 25,
      exclusive_start_key: last_key
    });

    for (const user of result) {
      if (user.name && !user.first_name) {
        const [first_name, ...rest] = user.name.split(' ');
        user.first_name = first_name;
        user.last_name = rest.join(' ');
        delete user.name;
        await user.Save();
      }
    }

    last_key = result.last_evaluated_key;
  } while (last_key);
}
```

## 13. Monitoring

### CloudWatch Metrics

Monitor key metrics:

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

class MetricsService {
  private cloudwatch: CloudWatchClient;

  constructor() {
    this.cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION });
  }

  async RecordQueryDuration(table_name: string, duration_ms: number): Promise<void> {
    await this.cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'DynamiteORM',
      MetricData: [{
        MetricName: 'QueryDuration',
        Value: duration_ms,
        Unit: 'Milliseconds',
        Dimensions: [{
          Name: 'TableName',
          Value: table_name
        }],
        Timestamp: new Date()
      }]
    }));
  }

  async RecordError(table_name: string, error_type: string): Promise<void> {
    await this.cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'DynamiteORM',
      MetricData: [{
        MetricName: 'Errors',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'TableName', Value: table_name },
          { Name: 'ErrorType', Value: error_type }
        ],
        Timestamp: new Date()
      }]
    }));
  }
}
```

### Logging

Implement structured logging:

```typescript
class Logger {
  static Info(message: string, metadata?: Record<string, any>): void {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...metadata
    }));
  }

  static Error(message: string, error: Error, metadata?: Record<string, any>): void {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      timestamp: new Date().toISOString(),
      ...metadata
    }));
  }

  static Query(table: string, operation: string, duration_ms: number): void {
    this.Info('DynamoDB Query', {
      table,
      operation,
      duration_ms
    });
  }
}

// Usage
class User extends Model {
  static async FindByPk(user_id: string): Promise<User | null> {
    const start = Date.now();

    try {
      const user = await super.FindByPk(user_id);
      const duration = Date.now() - start;

      Logger.Query('users', 'GetItem', duration);

      return user;
    } catch (error) {
      Logger.Error('Failed to find user', error as Error, { user_id });
      throw error;
    }
  }
}
```

## 14. Code Organization

### Repository Pattern

Separate data access logic:

```typescript
// repositories/user.repository.ts
export class UserRepository {
  async FindById(user_id: string): Promise<User | null> {
    return User.FindByPk(user_id);
  }

  async FindByEmail(email: string): Promise<User | null> {
    const results = await User.Query({
      email,
      index: 'email_index',
      limit: 1
    });
    return results[0] || null;
  }

  async Create(data: CreateUserData): Promise<User> {
    const user = new User();
    user.user_id = uuid();
    Object.assign(user, data);
    user.created_at = Date.now();
    await user.Save();
    return user;
  }

  async Update(user_id: string, updates: UpdateUserData): Promise<User> {
    const user = await this.FindById(user_id);
    if (!user) throw new Error('User not found');

    Object.assign(user, updates);
    user.updated_at = Date.now();
    await user.Save();
    return user;
  }

  async Delete(user_id: string): Promise<void> {
    const user = await this.FindById(user_id);
    if (user) await user.Delete();
  }
}

// services/user.service.ts
export class UserService {
  constructor(private user_repo: UserRepository) {}

  async RegisterUser(data: CreateUserData): Promise<User> {
    const existing = await this.user_repo.FindByEmail(data.email);
    if (existing) throw new Error('Email already exists');

    return this.user_repo.Create(data);
  }

  async GetUserProfile(user_id: string): Promise<UserProfile> {
    const user = await this.user_repo.FindById(user_id);
    if (!user) throw new Error('User not found');

    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      created_at: user.created_at
    };
  }
}

// controllers/user.controller.ts
export class UserController {
  constructor(private user_service: UserService) {}

  async Register(req: Request, res: Response): Promise<void> {
    try {
      const user = await this.user_service.RegisterUser(req.body);
      res.status(201).json({ user_id: user.user_id });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }
}
```

### Separating Concerns

Organize by feature:

```
src/
├── models/
│   └── user.model.ts
├── repositories/
│   └── user.repository.ts
├── services/
│   └── user.service.ts
├── controllers/
│   └── user.controller.ts
├── validators/
│   └── user.validators.ts
└── types/
    └── user.types.ts
```

## Summary

Following these best practices will help you build scalable, maintainable applications with Dynamite ORM:

1. **Model Design**: Use clear naming, organize by domain, keep models focused
2. **Primary Keys**: Choose appropriate ID strategy (UUID, ULID, composite)
3. **Indexes**: Create GSI/LSI for query patterns, avoid hot partitions
4. **Queries**: Prefer Query over Scan, implement pagination, use projections
5. **Data Modeling**: Apply single-table design, denormalize for reads
6. **Validation**: Validate at model level, create reusable validators
7. **Error Handling**: Handle errors gracefully, implement retries
8. **Testing**: Write unit and integration tests
9. **Type Safety**: Leverage TypeScript features
10. **Security**: Apply least privilege, encrypt sensitive data
11. **Performance**: Use batch operations, reuse connections
12. **Migrations**: Handle schema changes carefully
13. **Monitoring**: Track metrics and logs
14. **Organization**: Separate concerns with repository pattern
