# Performance Optimization Guide

This guide covers strategies and best practices for optimizing performance when using Dynamite with DynamoDB.

## Table of Contents

- [Query Optimization](#query-optimization)
- [Batch Operations](#batch-operations)
- [Connection Management](#connection-management)
- [Attribute Projection](#attribute-projection)
- [Pagination Strategies](#pagination-strategies)
- [Caching Patterns](#caching-patterns)
- [Monitoring and Profiling](#monitoring-and-profiling)
- [Benchmarking](#benchmarking)

## Query Optimization

### Avoiding Table Scans

Table scans are the most expensive operations in DynamoDB. Always use key conditions when possible.

**Bad - Full table scan:**

```typescript
// This scans the entire table
const active_users = await User.find({
  where: { status: 'active' }
});
```

**Good - Use partition key:**

```typescript
// Use partition key for efficient queries
const active_users = await User.find({
  where: {
    account_id: '123',
    status: 'active'
  }
});
```

**Best - Use GSI with proper keys:**

```typescript
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute()
  @Index('StatusIndex', { type: 'PARTITION' })
  status!: string;

  @Attribute()
  @Index('StatusIndex', { type: 'SORT' })
  created_at!: number;
}

// Now this uses the index efficiently
const active_users = await User.find({
  where: { status: 'active' },
  index: 'StatusIndex'
});
```

### Using Composite Keys Efficiently

Design your keys to support your most common query patterns.

```typescript
@Entity()
class Order {
  @PartitionKey()
  customer_id!: string;

  @SortKey()
  order_date!: string; // Format: YYYY-MM-DD#ORDER_ID

  @Attribute()
  status!: string;

  @Attribute()
  total!: number;
}

// Query orders for a customer in a date range
const recent_orders = await Order.find({
  where: {
    customer_id: 'CUST-123',
    order_date: { between: ['2024-01-01', '2024-12-31'] }
  }
});

// Query orders for a specific month
const monthly_orders = await Order.find({
  where: {
    customer_id: 'CUST-123',
    order_date: { beginsWith: '2024-03' }
  }
});
```

### Filter Expressions vs Key Conditions

Filter expressions are applied after items are read, so they still consume read capacity.

```typescript
// This reads ALL orders for customer, then filters
const expensive_orders = await Order.find({
  where: {
    customer_id: 'CUST-123',
    total: { gt: 1000 }
  }
});

// Better: Use sparse index for price ranges
@Entity()
class Order {
  @PartitionKey()
  customer_id!: string;

  @SortKey()
  order_date!: string;

  @Attribute()
  @Index('HighValueOrders', { type: 'PARTITION' })
  customer_high_value?: string; // Set to customer_id if total > 1000

  @Attribute()
  @Index('HighValueOrders', { type: 'SORT' })
  total!: number;
}

// Now this uses the sparse index efficiently
const expensive_orders = await Order.find({
  where: {
    customer_high_value: 'CUST-123',
    total: { gt: 1000 }
  },
  index: 'HighValueOrders'
});
```

### Query vs Scan Decision Matrix

| Use Case | Operation | Why |
|----------|-----------|-----|
| Get by primary key | `findOne()` | Most efficient, 1 RCU |
| Get by partition key | `query()` | Efficient, uses key condition |
| Get by GSI | `query()` with index | Efficient if GSI covers query |
| Filter on non-key | Consider GSI | Avoid if possible |
| Ad-hoc queries | `scan()` | Last resort, expensive |
| Analytics | Export to S3 | Don't scan production |

## Batch Operations

### BatchGet - Reading Multiple Items

Read up to 100 items in a single request, consuming fewer RCUs.

```typescript
// Single requests - inefficient
const users = await Promise.all([
  User.findOne({ id: 'user-1' }),
  User.findOne({ id: 'user-2' }),
  User.findOne({ id: 'user-3' })
]);

// Batch request - efficient
const user_ids = ['user-1', 'user-2', 'user-3'];
const users = await User.batchGet(
  user_ids.map(id => ({ id }))
);

// With type safety
interface UserKey {
  id: string;
}

const keys: UserKey[] = [
  { id: 'user-1' },
  { id: 'user-2' },
  { id: 'user-3' }
];

const users = await User.batchGet(keys);
```

### BatchWrite - Writing Multiple Items

Write up to 25 items in a single request.

```typescript
// Create multiple items efficiently
const new_users = [
  { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
  { id: 'user-2', name: 'Bob', email: 'bob@example.com' },
  { id: 'user-3', name: 'Charlie', email: 'charlie@example.com' }
];

await User.batchWrite(
  new_users.map(data => ({
    action: 'put',
    item: data
  }))
);

// Mix put and delete operations
await User.batchWrite([
  { action: 'put', item: { id: 'user-1', name: 'Alice' } },
  { action: 'delete', key: { id: 'user-2' } },
  { action: 'put', item: { id: 'user-3', name: 'Charlie' } }
]);
```

### Handling Unprocessed Items

Batch operations may return unprocessed items due to throttling.

```typescript
async function BatchWriteWithRetry<T>(
  model: typeof Entity,
  items: Array<{ action: 'put' | 'delete'; item?: T; key?: any }>,
  max_retries = 3
): Promise<void> {
  let unprocessed = items;
  let retry_count = 0;

  while (unprocessed.length > 0 && retry_count < max_retries) {
    const response = await model.batchWrite(unprocessed);

    if (!response.unprocessed || response.unprocessed.length === 0) {
      break;
    }

    unprocessed = response.unprocessed;
    retry_count++;

    // Exponential backoff
    await new Promise(resolve =>
      setTimeout(resolve, Math.pow(2, retry_count) * 100)
    );
  }

  if (unprocessed.length > 0) {
    throw new Error(`Failed to process ${unprocessed.length} items`);
  }
}
```

### Chunking Large Batches

Split large datasets into appropriate batch sizes.

```typescript
function* ChunkArray<T>(array: T[], chunk_size: number): Generator<T[]> {
  for (let i = 0; i < array.length; i += chunk_size) {
    yield array.slice(i, i + chunk_size);
  }
}

async function BatchGetAll<T>(
  model: typeof Entity,
  keys: any[]
): Promise<T[]> {
  const results: T[] = [];

  for (const chunk of ChunkArray(keys, 100)) {
    const batch_results = await model.batchGet(chunk);
    results.push(...batch_results);
  }

  return results;
}

// Usage
const all_user_ids = Array.from({ length: 500 }, (_, i) => ({
  id: `user-${i}`
}));

const all_users = await BatchGetAll(User, all_user_ids);
```

## Connection Management

### Client Reuse

Always reuse DynamoDB client instances to avoid connection overhead.

```typescript
// Bad - Creates new client per request
class UserService {
  async GetUser(id: string): Promise<User | null> {
    const client = new DynamoDBClient({ region: 'us-east-1' });
    // ... operations
    return user;
  }
}

// Good - Reuses client
class UserService {
  private readonly client: DynamoDBClient;

  constructor() {
    this.client = new DynamoDBClient({
      region: 'us-east-1',
      maxAttempts: 3
    });
  }

  async GetUser(id: string): Promise<User | null> {
    // ... operations using this.client
    return user;
  }
}
```

### Connection Pooling

Configure connection pooling for high-throughput applications.

```typescript
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { Agent } from 'https';

const https_agent = new Agent({
  keepAlive: true,
  maxSockets: 50,
  keepAliveMsecs: 1000
});

const client = new DynamoDBClient({
  region: 'us-east-1',
  requestHandler: new NodeHttpHandler({
    httpsAgent: https_agent,
    connectionTimeout: 5000,
    requestTimeout: 10000
  })
});

Dynamite.Configure({ client });
```

### Timeout Configuration

Set appropriate timeouts based on your use case.

```typescript
// Fast queries - short timeout
const client_fast = new DynamoDBClient({
  region: 'us-east-1',
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 1000,
    requestTimeout: 3000
  })
});

// Batch operations - longer timeout
const client_batch = new DynamoDBClient({
  region: 'us-east-1',
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5000,
    requestTimeout: 30000
  })
});
```

## Attribute Projection

### Reducing Bandwidth

Only retrieve the attributes you need to reduce response size and costs.

```typescript
// Retrieves all attributes
const user = await User.findOne({
  where: { id: 'user-123' }
});

// Only retrieves specific attributes
const user = await User.findOne({
  where: { id: 'user-123' },
  select: ['id', 'name', 'email']
});

// Calculate bandwidth savings
// Full item: ~2KB (all attributes)
// Projected item: ~200 bytes (3 attributes)
// Savings: 90% bandwidth reduction
```

### Nested Attribute Projection

Use dot notation for nested attributes.

```typescript
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute()
  profile!: {
    name: string;
    email: string;
    address: {
      street: string;
      city: string;
      country: string;
    };
  };

  @Attribute()
  metadata!: Record<string, any>;
}

// Only get specific nested attributes
const user = await User.findOne({
  where: { id: 'user-123' },
  select: ['id', 'profile.name', 'profile.address.city']
});

// Result: { id: 'user-123', profile: { name: '...', address: { city: '...' } } }
```

### Index Projections

Configure GSI projections to optimize query performance.

```typescript
@Entity()
class Product {
  @PartitionKey()
  id!: string;

  @Attribute()
  @Index('CategoryIndex', {
    type: 'PARTITION',
    projection: ['id', 'name', 'price'] // Only project needed attributes
  })
  category!: string;

  @Attribute()
  name!: string;

  @Attribute()
  price!: number;

  @Attribute()
  description!: string; // Not projected to index

  @Attribute()
  specifications!: Record<string, any>; // Not projected
}

// Query uses index projection - efficient
const products = await Product.find({
  where: { category: 'electronics' },
  index: 'CategoryIndex',
  select: ['id', 'name', 'price']
});

// Query requires base table fetch - inefficient
const products = await Product.find({
  where: { category: 'electronics' },
  index: 'CategoryIndex',
  select: ['description'] // Not in projection
});
```

## Pagination Strategies

### Cursor-Based Pagination

Use LastEvaluatedKey for efficient pagination.

```typescript
interface PaginationResult<T> {
  items: T[];
  next_cursor?: string;
  has_more: boolean;
}

async function PaginatedQuery<T>(
  model: typeof Entity,
  where: any,
  cursor?: string,
  limit = 20
): Promise<PaginationResult<T>> {
  const result = await model.find({
    where,
    limit,
    cursor: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : undefined
  });

  const next_cursor = result.cursor
    ? Buffer.from(JSON.stringify(result.cursor)).toString('base64')
    : undefined;

  return {
    items: result.items,
    next_cursor,
    has_more: !!result.cursor
  };
}

// Usage
let cursor: string | undefined;
let all_items: User[] = [];

do {
  const page = await PaginatedQuery<User>(
    User,
    { status: 'active' },
    cursor,
    100
  );

  all_items.push(...page.items);
  cursor = page.next_cursor;
} while (cursor);
```

### Parallel Pagination

Paginate multiple queries in parallel for faster processing.

```typescript
async function ParallelPagination<T>(
  queries: Array<{ model: typeof Entity; where: any }>,
  page_size = 50
): Promise<T[]> {
  const results = await Promise.all(
    queries.map(async ({ model, where }) => {
      const items: T[] = [];
      let cursor: any;

      do {
        const page = await model.find({
          where,
          limit: page_size,
          cursor
        });

        items.push(...page.items);
        cursor = page.cursor;
      } while (cursor);

      return items;
    })
  );

  return results.flat();
}

// Query multiple partitions simultaneously
const all_orders = await ParallelPagination([
  { model: Order, where: { customer_id: 'CUST-1' } },
  { model: Order, where: { customer_id: 'CUST-2' } },
  { model: Order, where: { customer_id: 'CUST-3' } }
]);
```

### Infinite Scroll Implementation

Implement infinite scroll with proper state management.

```typescript
class InfiniteScroll<T> {
  private items: T[] = [];
  private cursor?: any;
  private is_loading = false;
  private has_more = true;

  constructor(
    private readonly model: typeof Entity,
    private readonly where: any,
    private readonly page_size = 20
  ) {}

  async LoadMore(): Promise<T[]> {
    if (this.is_loading || !this.has_more) {
      return [];
    }

    this.is_loading = true;

    try {
      const result = await this.model.find({
        where: this.where,
        limit: this.page_size,
        cursor: this.cursor
      });

      this.items.push(...result.items);
      this.cursor = result.cursor;
      this.has_more = !!result.cursor;

      return result.items;
    } finally {
      this.is_loading = false;
    }
  }

  GetItems(): T[] {
    return this.items;
  }

  HasMore(): boolean {
    return this.has_more;
  }

  Reset(): void {
    this.items = [];
    this.cursor = undefined;
    this.has_more = true;
  }
}

// Usage
const scroll = new InfiniteScroll(User, { status: 'active' }, 50);

// Load first page
await scroll.LoadMore();

// User scrolls down
await scroll.LoadMore();

// Check if more data available
if (scroll.HasMore()) {
  await scroll.LoadMore();
}
```

## Caching Patterns

### In-Memory Caching

Implement simple in-memory cache for frequently accessed data.

```typescript
class CachedRepository<T> {
  private cache = new Map<string, { data: T; expires_at: number }>();

  constructor(
    private readonly model: typeof Entity,
    private readonly ttl_ms = 60000 // 1 minute
  ) {}

  async FindOne(key: any): Promise<T | null> {
    const cache_key = JSON.stringify(key);
    const cached = this.cache.get(cache_key);

    if (cached && cached.expires_at > Date.now()) {
      return cached.data;
    }

    const item = await this.model.findOne({ where: key });

    if (item) {
      this.cache.set(cache_key, {
        data: item,
        expires_at: Date.now() + this.ttl_ms
      });
    }

    return item;
  }

  InvalidateCache(key: any): void {
    const cache_key = JSON.stringify(key);
    this.cache.delete(cache_key);
  }

  ClearCache(): void {
    this.cache.clear();
  }
}

// Usage
const user_cache = new CachedRepository(User, 300000); // 5 minutes

const user = await user_cache.FindOne({ id: 'user-123' });
```

### Redis Caching

Use Redis for distributed caching across multiple instances.

```typescript
import { createClient } from 'redis';

class RedisCache<T> {
  private client = createClient({ url: 'redis://localhost:6379' });

  constructor(
    private readonly model: typeof Entity,
    private readonly ttl_seconds = 300
  ) {
    this.client.connect();
  }

  async FindOne(key: any): Promise<T | null> {
    const cache_key = `${this.model.name}:${JSON.stringify(key)}`;
    const cached = await this.client.get(cache_key);

    if (cached) {
      return JSON.parse(cached);
    }

    const item = await this.model.findOne({ where: key });

    if (item) {
      await this.client.setEx(
        cache_key,
        this.ttl_seconds,
        JSON.stringify(item)
      );
    }

    return item;
  }

  async Invalidate(key: any): Promise<void> {
    const cache_key = `${this.model.name}:${JSON.stringify(key)}`;
    await this.client.del(cache_key);
  }
}
```

### Write-Through Caching

Update cache on write operations.

```typescript
class WriteThroughCache<T> {
  private cache = new Map<string, T>();

  constructor(private readonly model: typeof Entity) {}

  async FindOne(key: any): Promise<T | null> {
    const cache_key = JSON.stringify(key);
    const cached = this.cache.get(cache_key);

    if (cached) {
      return cached;
    }

    const item = await this.model.findOne({ where: key });

    if (item) {
      this.cache.set(cache_key, item);
    }

    return item;
  }

  async Create(data: Partial<T>): Promise<T> {
    const item = await this.model.create(data);
    const cache_key = JSON.stringify({ id: (item as any).id });
    this.cache.set(cache_key, item);
    return item;
  }

  async Update(key: any, data: Partial<T>): Promise<T> {
    const item = await this.model.update(key, data);
    const cache_key = JSON.stringify(key);
    this.cache.set(cache_key, item);
    return item;
  }

  async Delete(key: any): Promise<void> {
    await this.model.delete(key);
    const cache_key = JSON.stringify(key);
    this.cache.delete(cache_key);
  }
}
```

## Monitoring and Profiling

### CloudWatch Metrics

Monitor DynamoDB performance using CloudWatch.

```typescript
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

class PerformanceMonitor {
  private readonly cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

  async TrackQuery(operation: string, duration_ms: number): Promise<void> {
    await this.cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'DynamoDB/Queries',
      MetricData: [{
        MetricName: 'QueryDuration',
        Value: duration_ms,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'Operation', Value: operation }
        ]
      }]
    }));
  }

  async WithMonitoring<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();

    try {
      const result = await fn();
      await this.TrackQuery(operation, Date.now() - start);
      return result;
    } catch (error) {
      await this.TrackQuery(`${operation}_error`, Date.now() - start);
      throw error;
    }
  }
}

// Usage
const monitor = new PerformanceMonitor();

const user = await monitor.WithMonitoring(
  'User.findOne',
  () => User.findOne({ where: { id: 'user-123' } })
);
```

### Custom Profiling

Profile query performance in development.

```typescript
class QueryProfiler {
  private metrics: Array<{
    operation: string;
    duration_ms: number;
    timestamp: number;
  }> = [];

  async Profile<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration_ms = performance.now() - start;

    this.metrics.push({
      operation,
      duration_ms,
      timestamp: Date.now()
    });

    console.log(`[${operation}] ${duration_ms.toFixed(2)}ms`);

    return result;
  }

  GetMetrics() {
    return {
      total: this.metrics.length,
      avg_duration: this.metrics.reduce((sum, m) => sum + m.duration_ms, 0) / this.metrics.length,
      slowest: this.metrics.sort((a, b) => b.duration_ms - a.duration_ms)[0],
      by_operation: this.GroupByOperation()
    };
  }

  private GroupByOperation() {
    const groups = new Map<string, number[]>();

    for (const metric of this.metrics) {
      if (!groups.has(metric.operation)) {
        groups.set(metric.operation, []);
      }
      groups.get(metric.operation)!.push(metric.duration_ms);
    }

    return Object.fromEntries(
      Array.from(groups.entries()).map(([op, durations]) => [
        op,
        {
          count: durations.length,
          avg: durations.reduce((a, b) => a + b) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations)
        }
      ])
    );
  }
}

// Usage
const profiler = new QueryProfiler();

await profiler.Profile('GetUser', () =>
  User.findOne({ where: { id: 'user-123' } })
);

console.log(profiler.GetMetrics());
```

## Benchmarking

### Simple Benchmark

Compare different query strategies.

```typescript
async function Benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations = 100
): Promise<void> {
  const durations: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    durations.push(performance.now() - start);
  }

  const avg = durations.reduce((a, b) => a + b) / durations.length;
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  console.log(`\n${name}:`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
}

// Compare single vs batch operations
await Benchmark('Single Gets', async () => {
  await Promise.all([
    User.findOne({ where: { id: 'user-1' } }),
    User.findOne({ where: { id: 'user-2' } }),
    User.findOne({ where: { id: 'user-3' } })
  ]);
}, 100);

await Benchmark('Batch Get', async () => {
  await User.batchGet([
    { id: 'user-1' },
    { id: 'user-2' },
    { id: 'user-3' }
  ]);
}, 100);
```

### Load Testing

Test performance under load.

```typescript
async function LoadTest(
  name: string,
  fn: () => Promise<void>,
  concurrent_requests = 100,
  duration_seconds = 10
): Promise<void> {
  const start_time = Date.now();
  const end_time = start_time + duration_seconds * 1000;
  let completed = 0;
  let errors = 0;

  const workers = Array.from({ length: concurrent_requests }, async () => {
    while (Date.now() < end_time) {
      try {
        await fn();
        completed++;
      } catch (error) {
        errors++;
      }
    }
  });

  await Promise.all(workers);

  const duration = (Date.now() - start_time) / 1000;
  const rps = completed / duration;

  console.log(`\n${name}:`);
  console.log(`  Duration: ${duration.toFixed(2)}s`);
  console.log(`  Completed: ${completed}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  RPS: ${rps.toFixed(2)}`);
}

// Test read throughput
await LoadTest('Read Load Test', async () => {
  await User.findOne({ where: { id: 'user-123' } });
}, 50, 10);
```

---

For more information, see:
- [AWS DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Troubleshooting Guide](./troubleshooting.md)
- [Migration Guide](./migration.md)
