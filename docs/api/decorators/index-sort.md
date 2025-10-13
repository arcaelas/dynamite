# @IndexSort Decorator

## Overview

The `@IndexSort` decorator creates Global Secondary Indexes (GSI) or Local Secondary Indexes (LSI) on DynamoDB tables, enabling efficient queries on non-primary key attributes. This decorator is crucial for supporting multiple access patterns in your application.

## Syntax

```typescript
@IndexSort(options?: IndexSortOptions)
```

## Parameters

### IndexSortOptions

```typescript
interface IndexSortOptions {
  /** Index name (defaults to property name) */
  name?: string;

  /** Index type: 'global' or 'local' */
  type?: 'global' | 'local';

  /** Projection type: 'ALL', 'KEYS_ONLY', or 'INCLUDE' */
  projection?: 'ALL' | 'KEYS_ONLY' | 'INCLUDE';

  /** Attributes to include when projection is 'INCLUDE' */
  include_attributes?: string[];

  /** Read capacity units for GSI (defaults to table RCU) */
  read_capacity?: number;

  /** Write capacity units for GSI (defaults to table WCU) */
  write_capacity?: number;
}
```

## Basic Usage

### Global Secondary Index

```typescript
import { Model, PrimaryKey, IndexSort } from 'dynamite-orm';

class User extends Model {
  @PrimaryKey()
  id!: string;

  @IndexSort()
  email!: string;

  name!: string;
  created_at!: number;
}

// Query by email
const user = await User.query()
  .usingIndex('email')
  .where('email', '=', 'user@example.com')
  .first();
```

### Local Secondary Index

```typescript
class OrderItem extends Model {
  @PrimaryKey('HASH')
  order_id!: string;

  @PrimaryKey('RANGE')
  item_id!: string;

  @IndexSort({ type: 'local' })
  created_at!: number;

  quantity!: number;
}

// Query order items sorted by creation time
const items = await OrderItem.query()
  .where('order_id', '=', 'ORD123')
  .usingIndex('created_at')
  .sortBy('created_at', 'DESC')
  .execute();
```

## Advanced Examples

### Multiple Indexes

```typescript
class Product extends Model {
  @PrimaryKey()
  id!: string;

  name!: string;

  @IndexSort({ name: 'category_index' })
  category!: string;

  @IndexSort({ name: 'price_index' })
  price!: number;

  @IndexSort({ name: 'created_index' })
  created_at!: number;

  stock_count!: number;
}

// Query by category
const electronics = await Product.query()
  .usingIndex('category_index')
  .where('category', '=', 'Electronics')
  .execute();

// Query by price range
const affordable = await Product.query()
  .usingIndex('price_index')
  .where('price', '<', 100)
  .execute();
```

### Composite GSI Keys

```typescript
class Event extends Model {
  @PrimaryKey()
  event_id!: string;

  @IndexSort({
    name: 'user_timestamp_index',
    type: 'global'
  })
  user_id!: string;

  @IndexSort({
    name: 'user_timestamp_index',
    type: 'global'
  })
  timestamp!: number;

  event_type!: string;
  data!: any;
}

// Query user events in time range
const user_events = await Event.query()
  .usingIndex('user_timestamp_index')
  .where('user_id', '=', 'user123')
  .where('timestamp', 'between', [start, end])
  .execute();
```

### Sparse Indexes

```typescript
class Task extends Model {
  @PrimaryKey()
  task_id!: string;

  title!: string;
  status!: 'pending' | 'completed';

  @IndexSort({ name: 'assigned_index' })
  assigned_to?: string;  // Only indexed when assigned

  created_at!: number;
}

// Query tasks assigned to a user
const assigned_tasks = await Task.query()
  .usingIndex('assigned_index')
  .where('assigned_to', '=', 'user456')
  .execute();
```

### Projection Optimization

```typescript
class Article extends Model {
  @PrimaryKey()
  article_id!: string;

  title!: string;

  @IndexSort({
    name: 'author_index',
    projection: 'INCLUDE',
    include_attributes: ['title', 'published_at', 'summary']
  })
  author_id!: string;

  content!: string;  // Large field, not in index
  summary!: string;
  published_at!: number;
}

// Efficient query - no additional table reads needed
const articles = await Article.query()
  .usingIndex('author_index')
  .where('author_id', '=', 'author789')
  .execute();
```

## Common Patterns

### Status-Based Queries

```typescript
class Order extends Model {
  @PrimaryKey()
  order_id!: string;

  @IndexSort({ name: 'status_created_index' })
  status!: 'pending' | 'processing' | 'shipped' | 'delivered';

  @IndexSort({ name: 'status_created_index' })
  created_at!: number;

  customer_id!: string;
  total_amount!: number;
}

// Query pending orders sorted by creation time
const pending_orders = await Order.query()
  .usingIndex('status_created_index')
  .where('status', '=', 'pending')
  .sortBy('created_at', 'ASC')
  .execute();
```

### User Activity Tracking

```typescript
class Activity extends Model {
  @PrimaryKey()
  activity_id!: string;

  @IndexSort({
    name: 'user_activity_index',
    projection: 'KEYS_ONLY'
  })
  user_id!: string;

  @IndexSort({ name: 'user_activity_index' })
  timestamp!: number;

  activity_type!: string;
  details!: Record<string, any>;
}

// Get recent user activity
const recent_activity = await Activity.query()
  .usingIndex('user_activity_index')
  .where('user_id', '=', 'user123')
  .where('timestamp', '>', Date.now() - 604800000)
  .sortBy('timestamp', 'DESC')
  .limit(20)
  .execute();
```

### Tag-Based Search

```typescript
class Resource extends Model {
  @PrimaryKey()
  resource_id!: string;

  name!: string;

  @IndexSort({ name: 'tag_index' })
  tag!: string;

  @IndexSort({ name: 'tag_index' })
  updated_at!: number;

  content!: any;
}

// Find resources by tag
const tagged_resources = await Resource.query()
  .usingIndex('tag_index')
  .where('tag', '=', 'important')
  .sortBy('updated_at', 'DESC')
  .execute();
```

### Geospatial Queries

```typescript
class Location extends Model {
  @PrimaryKey()
  location_id!: string;

  name!: string;

  @IndexSort({ name: 'geohash_index' })
  geohash!: string;  // First 6 chars of geohash

  @IndexSort({ name: 'geohash_index' })
  timestamp!: number;

  latitude!: number;
  longitude!: number;
}

// Query locations in area
const nearby = await Location.query()
  .usingIndex('geohash_index')
  .where('geohash', 'beginsWith', 'u4pruydqqvj')
  .execute();
```

## Integration with Other Decorators

### With @Default

```typescript
class Document extends Model {
  @PrimaryKey()
  document_id!: string;

  title!: string;

  @IndexSort()
  @Default(() => Date.now())
  created_at!: number;

  content!: string;
}
```

### With @Validate

```typescript
class Membership extends Model {
  @PrimaryKey()
  membership_id!: string;

  @IndexSort()
  @Validate((value) => ['free', 'premium', 'enterprise'].includes(value))
  tier!: string;

  user_id!: string;
}
```

### With @CreatedAt and @UpdatedAt

```typescript
class Post extends Model {
  @PrimaryKey()
  post_id!: string;

  title!: string;
  content!: string;

  @IndexSort({ name: 'created_index' })
  @CreatedAt()
  created_at!: number;

  @IndexSort({ name: 'updated_index' })
  @UpdatedAt()
  updated_at!: number;
}

// Query recently created posts
const recent = await Post.query()
  .usingIndex('created_index')
  .where('created_at', '>', Date.now() - 86400000)
  .execute();

// Query recently updated posts
const updated = await Post.query()
  .usingIndex('updated_index')
  .where('updated_at', '>', Date.now() - 3600000)
  .execute();
```

### With Relationships

```typescript
class Comment extends Model {
  @PrimaryKey()
  comment_id!: string;

  content!: string;

  @IndexSort()
  @BelongsTo(() => Post)
  post_id!: string;

  @IndexSort()
  @BelongsTo(() => User)
  user_id!: string;

  created_at!: number;
}

// Query comments for a post
const post_comments = await Comment.query()
  .usingIndex('post_id')
  .where('post_id', '=', 'post123')
  .execute();
```

## Best Practices

### 1. Design Indexes for Query Patterns

```typescript
// Good - Index supports specific query patterns
class BlogPost extends Model {
  @PrimaryKey()
  id!: string;

  @IndexSort({ name: 'author_published_index' })
  author_id!: string;

  @IndexSort({ name: 'author_published_index' })
  published_at!: number;

  title!: string;
}

// Query: "Get all posts by author sorted by publication date"
```

### 2. Use Projection to Reduce Costs

```typescript
// Good - Only include necessary attributes
class Message extends Model {
  @PrimaryKey()
  message_id!: string;

  @IndexSort({
    name: 'recipient_index',
    projection: 'INCLUDE',
    include_attributes: ['sender_id', 'subject', 'sent_at']
  })
  recipient_id!: string;

  sender_id!: string;
  subject!: string;
  body!: string;  // Large field excluded from index
  sent_at!: number;
}
```

### 3. Limit Number of Indexes

```typescript
// Avoid - Too many indexes increase storage and write costs
class OverIndexed extends Model {
  @PrimaryKey()
  id!: string;

  @IndexSort()  // ❌
  field1!: string;

  @IndexSort()  // ❌
  field2!: string;

  @IndexSort()  // ❌
  field3!: string;

  @IndexSort()  // ❌
  field4!: string;
}

// Good - Strategic indexes
class WellIndexed extends Model {
  @PrimaryKey()
  id!: string;

  @IndexSort()  // ✓ Common query pattern
  status!: string;

  @IndexSort()  // ✓ Time-based queries
  created_at!: number;

  field3!: string;  // No index needed
  field4!: string;  // No index needed
}
```

### 4. Use Local Indexes for Same Partition

```typescript
// Good - Local index for queries within partition
class CustomerOrder extends Model {
  @PrimaryKey('HASH')
  customer_id!: string;

  @PrimaryKey('RANGE')
  order_id!: string;

  @IndexSort({ type: 'local' })
  status!: string;

  @IndexSort({ type: 'local' })
  total_amount!: number;
}

// Efficient query within customer partition
```

### 5. Consider Write Amplification

```typescript
// Be aware - Each index adds write cost
class HighThroughput extends Model {
  @PrimaryKey()
  id!: string;

  @IndexSort()  // +1 write per update
  status!: string;

  @IndexSort()  // +1 write per update
  updated_at!: number;

  // Each write to this model = 3 writes (1 table + 2 indexes)
}
```

## Performance Considerations

### 1. Index Capacity Planning

```typescript
class AnalyticsEvent extends Model {
  @PrimaryKey()
  event_id!: string;

  @IndexSort({
    name: 'high_traffic_index',
    read_capacity: 100,
    write_capacity: 50
  })
  event_type!: string;

  timestamp!: number;
  data!: any;
}
```

### 2. Eventual Consistency

```typescript
// GSI queries are eventually consistent
const recent_items = await Item.query()
  .usingIndex('created_index')
  .where('created_at', '>', Date.now() - 1000)
  .execute();

// May not include items created in the last few milliseconds
```

### 3. Query Optimization

```typescript
// Efficient - Uses index with sort key
const filtered = await Order.query()
  .usingIndex('status_created_index')
  .where('status', '=', 'pending')
  .where('created_at', '>', yesterday)
  .execute();

// Less efficient - Full index scan
const all_pending = await Order.query()
  .usingIndex('status_created_index')
  .where('status', '=', 'pending')
  .execute();
```

## Migration and Maintenance

### Adding New Index

```typescript
// Step 1: Add decorator
class User extends Model {
  @PrimaryKey()
  id!: string;

  email!: string;

  // New index
  @IndexSort()
  last_login!: number;
}

// Step 2: Update table schema
await dynamodb.updateTable({
  TableName: 'Users',
  AttributeDefinitions: [
    { AttributeName: 'last_login', AttributeType: 'N' }
  ],
  GlobalSecondaryIndexUpdates: [{
    Create: {
      IndexName: 'last_login',
      KeySchema: [
        { AttributeName: 'last_login', KeyType: 'HASH' }
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  }]
});
```

### Monitoring Index Usage

```typescript
// Track query performance
class MonitoredModel extends Model {
  static async queryWithMetrics(index_name: string) {
    const start = Date.now();
    const results = await this.query()
      .usingIndex(index_name)
      .execute();
    const duration = Date.now() - start;

    console.log(`Index ${index_name} query took ${duration}ms`);
    return results;
  }
}
```

## See Also

- [@PrimaryKey](./primary-key.md) - Define primary keys
- [Query API](../query.md) - Using indexes in queries
- [Performance Guide](../../guides/performance.md) - Index optimization
