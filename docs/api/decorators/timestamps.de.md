# Timestamp Decorators

## Übersicht

The `@CreatedAt` and `@UpdatedAt` decorators automatically manage creation and modification timestamps for your models. These decorators are essential for audit trails, temporal queries, and tracking data lifecycle.

## Decorators

### @CreatedAt

Automatically sets the timestamp when a model instance is first created. The value is set once and never updated.

```typescript
@CreatedAt(options?: TimestampOptions)
```

### @UpdatedAt

Automatically updates the timestamp whenever a model instance is modified and saved.

```typescript
@UpdatedAt(options?: TimestampOptions)
```

## Parameter

### TimestampOptions

```typescript
interface TimestampOptions {
  /** Format: 'timestamp' (default) or 'iso' */
  format?: 'timestamp' | 'iso';

  /** Precision: 'milliseconds' (default) or 'seconds' */
  precision?: 'milliseconds' | 'seconds';

  /** Custom timestamp generator function */
  generator?: () => number | string;
}
```

## Grundlegende Verwendung

### Default Timestamps

```typescript
import { Model, PrimaryKey, CreatedAt, UpdatedAt } from 'dynamite-orm';

class User extends Model {
  @PrimaryKey()
  id!: string;

  name!: string;
  email!: string;

  @CreatedAt()
  created_at!: number;

  @UpdatedAt()
  updated_at!: number;
}

const user = new User();
user.id = 'user123';
user.name = 'John Doe';
await user.save();
// created_at = 1704067200000
// updated_at = 1704067200000

user.name = 'Jane Doe';
await user.save();
// created_at = 1704067200000 (unchanged)
// updated_at = 1704067210000 (updated)
```

### ISO Format

```typescript
class Article extends Model {
  @PrimaryKey()
  article_id!: string;

  title!: string;
  content!: string;

  @CreatedAt({ format: 'iso' })
  created_at!: string;

  @UpdatedAt({ format: 'iso' })
  updated_at!: string;
}

const article = new Article();
article.article_id = 'art123';
article.title = 'My Article';
await article.save();
// created_at = '2024-01-01T00:00:00.000Z'
// updated_at = '2024-01-01T00:00:00.000Z'
```

### Unix Seconds

```typescript
class Event extends Model {
  @PrimaryKey()
  event_id!: string;

  name!: string;

  @CreatedAt({ precision: 'seconds' })
  created_at!: number;

  @UpdatedAt({ precision: 'seconds' })
  updated_at!: number;
}

const event = new Event();
event.event_id = 'evt123';
await event.save();
// created_at = 1704067200
// updated_at = 1704067200
```

## Erweiterte Beispiele

### Custom Timestamp Generator

```typescript
class CustomTimestamp extends Model {
  @PrimaryKey()
  id!: string;

  @CreatedAt({
    generator: () => {
      const now = new Date();
      return now.getTime() + now.getTimezoneOffset() * 60000;  // UTC
    }
  })
  created_at!: number;
}
```

### Multiple Timestamp Formats

```typescript
class AuditLog extends Model {
  @PrimaryKey()
  log_id!: string;

  action!: string;

  @CreatedAt({ precision: 'milliseconds' })
  created_at_ms!: number;

  @CreatedAt({ precision: 'seconds' })
  created_at_sec!: number;

  @CreatedAt({ format: 'iso' })
  created_at_iso!: string;
}
```

### Compound Keys with Timestamps

```typescript
class Message extends Model {
  @PrimaryKey('HASH')
  chat_room_id!: string;

  @PrimaryKey('RANGE')
  @CreatedAt()
  timestamp!: number;

  sender_id!: string;
  content!: string;

  @UpdatedAt()
  edited_at!: number;
}

// Query messages in chronological order
const messages = await Message.query()
  .where('chat_room_id', '=', 'room123')
  .sortBy('timestamp', 'ASC')
  .execute();
```

### Soft Delete with Timestamps

```typescript
class SoftDeletable extends Model {
  @PrimaryKey()
  id!: string;

  name!: string;

  @CreatedAt()
  created_at!: number;

  @UpdatedAt()
  updated_at!: number;

  deleted_at?: number;

  async soft_delete(): Promise<void> {
    this.deleted_at = Date.now();
    await this.save();
  }

  is_deleted(): boolean {
    return this.deleted_at !== undefined;
  }
}
```

## Häufige Muster

### Audit Trail

```typescript
class AuditedModel extends Model {
  @PrimaryKey()
  id!: string;

  data!: any;

  @CreatedAt()
  created_at!: number;

  created_by!: string;

  @UpdatedAt()
  updated_at!: number;

  updated_by!: string;

  version!: number;

  async save_with_audit(user_id: string): Promise<void> {
    if (!this.created_at) {
      this.created_by = user_id;
      this.version = 1;
    } else {
      this.updated_by = user_id;
      this.version += 1;
    }

    await this.save();
  }
}
```

### Time-Based Indexing

```typescript
class IndexedTimestamp extends Model {
  @PrimaryKey()
  id!: string;

  title!: string;

  @CreatedAt()
  @IndexSort()
  created_at!: number;

  @UpdatedAt()
  @IndexSort()
  updated_at!: number;
}

// Query recently created items
const recent = await IndexedTimestamp.query()
  .usingIndex('created_at')
  .where('created_at', '>', Date.now() - 86400000)
  .execute();

// Query recently updated items
const updated = await IndexedTimestamp.query()
  .usingIndex('updated_at')
  .where('updated_at', '>', Date.now() - 3600000)
  .execute();
```

### Expiration Tracking

```typescript
class ExpiringItem extends Model {
  @PrimaryKey()
  item_id!: string;

  content!: string;

  @CreatedAt()
  created_at!: number;

  @UpdatedAt()
  updated_at!: number;

  ttl_seconds!: number;

  get expires_at(): number {
    return this.created_at + this.ttl_seconds * 1000;
  }

  is_expired(): boolean {
    return Date.now() > this.expires_at;
  }
}
```

### Version History

```typescript
class VersionedDocument extends Model {
  @PrimaryKey('HASH')
  document_id!: string;

  @PrimaryKey('RANGE')
  @CreatedAt()
  version_timestamp!: number;

  content!: string;
  author!: string;
  changes!: string;

  @UpdatedAt()
  modified_at!: number;
}

// Create new version
async function create_version(doc_id: string, content: string, author: string) {
  const version = new VersionedDocument();
  version.document_id = doc_id;
  version.content = content;
  version.author = author;
  await version.save();
  return version;
}

// Get version history
async function get_history(doc_id: string) {
  return await VersionedDocument.query()
    .where('document_id', '=', doc_id)
    .sortBy('version_timestamp', 'DESC')
    .execute();
}
```

### Activity Timeline

```typescript
class Activity extends Model {
  @PrimaryKey('HASH')
  user_id!: string;

  @PrimaryKey('RANGE')
  @CreatedAt()
  timestamp!: number;

  activity_type!: 'login' | 'logout' | 'action' | 'error';
  details!: Record<string, any>;

  @UpdatedAt()
  updated_at!: number;
}

// Get user activity timeline
async function get_user_timeline(user_id: string, days: number = 7) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  return await Activity.query()
    .where('user_id', '=', user_id)
    .where('timestamp', '>', since)
    .sortBy('timestamp', 'DESC')
    .execute();
}
```

### Time-Based Partitioning

```typescript
class TimeSeriesData extends Model {
  @PrimaryKey('HASH')
  get partition_key(): string {
    const date = new Date(this.timestamp);
    return `${this.metric_name}#${date.getFullYear()}-${date.getMonth() + 1}`;
  }

  @PrimaryKey('RANGE')
  @CreatedAt()
  timestamp!: number;

  metric_name!: string;
  value!: number;

  @UpdatedAt()
  updated_at!: number;
}
```

## Integration mit anderen Dekoratoren

### With @IndexSort

```typescript
class SearchableContent extends Model {
  @PrimaryKey()
  id!: string;

  title!: string;
  content!: string;

  @CreatedAt()
  @IndexSort({ name: 'created_index' })
  created_at!: number;

  @UpdatedAt()
  @IndexSort({ name: 'updated_index' })
  updated_at!: number;

  @IndexSort({ name: 'status_updated_index' })
  status!: string;
}

// Query by status and recent updates
const recent_published = await SearchableContent.query()
  .usingIndex('status_updated_index')
  .where('status', '=', 'published')
  .where('updated_at', '>', Date.now() - 86400000)
  .execute();
```

### With @Default

```typescript
class DefaultTimestamps extends Model {
  @PrimaryKey()
  id!: string;

  @Default(() => Date.now())
  @CreatedAt()
  created_at!: number;

  @Default(() => Date.now())
  @UpdatedAt()
  updated_at!: number;

  // @Default is redundant with timestamp decorators
  // but can be used for manual control
}
```

### With @Validate

```typescript
class ValidatedTimestamps extends Model {
  @PrimaryKey()
  id!: string;

  @CreatedAt()
  @Validate((value) => value <= Date.now())
  created_at!: number;

  @UpdatedAt()
  @Validate((value, context) => {
    const created = context?.instance.created_at;
    return value >= created || 'Updated time must be after creation';
  })
  updated_at!: number;
}
```

### With Relationships

```typescript
class Post extends Model {
  @PrimaryKey()
  post_id!: string;

  title!: string;
  content!: string;

  @BelongsTo(() => User)
  author_id!: string;

  @CreatedAt()
  created_at!: number;

  @UpdatedAt()
  updated_at!: number;

  @HasMany(() => Comment)
  comments!: Comment[];
}

class Comment extends Model {
  @PrimaryKey()
  comment_id!: string;

  content!: string;

  @BelongsTo(() => Post)
  post_id!: string;

  @CreatedAt()
  created_at!: number;

  @UpdatedAt()
  updated_at!: number;
}
```

## Best Practices

### 1. Always Include Both Timestamps

```typescript
// Good - Track both creation and updates
class GoodModel extends Model {
  @PrimaryKey()
  id!: string;

  @CreatedAt()
  created_at!: number;

  @UpdatedAt()
  updated_at!: number;
}

// Avoid - Missing update tracking
class IncompleteModel extends Model {
  @PrimaryKey()
  id!: string;

  @CreatedAt()
  created_at!: number;
  // ❌ No updated_at
}
```

### 2. Use Milliseconds for Precision

```typescript
// Good - Millisecond precision
class Precise extends Model {
  @CreatedAt({ precision: 'milliseconds' })
  created_at!: number;
}

// Use seconds only when appropriate
class Approximate extends Model {
  @CreatedAt({ precision: 'seconds' })
  created_at!: number;  // For TTL or less precise needs
}
```

### 3. Index Timestamps for Queries

```typescript
// Good - Indexed for efficient queries
class QueryableTimestamps extends Model {
  @PrimaryKey()
  id!: string;

  @CreatedAt()
  @IndexSort()
  created_at!: number;

  @UpdatedAt()
  @IndexSort()
  updated_at!: number;
}
```

### 4. Document Timestamp Usage

```typescript
class WellDocumented extends Model {
  @PrimaryKey()
  id!: string;

  /**
   * Unix timestamp in milliseconds when record was created.
   * Set automatically on first save, never updated.
   */
  @CreatedAt()
  created_at!: number;

  /**
   * Unix timestamp in milliseconds when record was last modified.
   * Updated automatically on every save operation.
   */
  @UpdatedAt()
  updated_at!: number;
}
```

### 5. Consider Time Zones

```typescript
class TimeZoneAware extends Model {
  @PrimaryKey()
  id!: string;

  @CreatedAt()
  created_at!: number;  // Store as UTC timestamp

  timezone!: string;  // Store user's timezone separately

  get local_created_at(): string {
    return new Date(this.created_at)
      .toLocaleString('en-US', { timeZone: this.timezone });
  }
}
```

## Query Patterns

### Time Range Queries

```typescript
// Last 24 hours
const recent = await Model.query()
  .where('created_at', '>', Date.now() - 86400000)
  .execute();

// Between dates
const range = await Model.query()
  .where('created_at', 'between', [start_date, end_date])
  .execute();

// Before date
const older = await Model.query()
  .where('created_at', '<', cutoff_date)
  .execute();
```

### Sorting by Timestamps

```typescript
// Newest first
const newest = await Model.scan()
  .sortBy('created_at', 'DESC')
  .limit(10)
  .execute();

// Oldest first
const oldest = await Model.scan()
  .sortBy('created_at', 'ASC')
  .limit(10)
  .execute();
```

### Recently Modified

```typescript
async function get_recently_modified(hours: number = 1) {
  const since = Date.now() - hours * 60 * 60 * 1000;

  return await Model.query()
    .usingIndex('updated_at')
    .where('updated_at', '>', since)
    .sortBy('updated_at', 'DESC')
    .execute();
}
```

## Leistungsüberlegungen

### 1. Index Strategy

```typescript
// Index both timestamps if querying frequently
class OptimizedTimestamps extends Model {
  @PrimaryKey()
  id!: string;

  @CreatedAt()
  @IndexSort({ name: 'created_index' })
  created_at!: number;

  @UpdatedAt()
  @IndexSort({ name: 'updated_index' })
  updated_at!: number;
}
```

### 2. Composite Indexes

```typescript
// Combine status with timestamp for efficient queries
class CompositeIndex extends Model {
  @PrimaryKey()
  id!: string;

  @IndexSort({ name: 'status_time_index' })
  status!: string;

  @IndexSort({ name: 'status_time_index' })
  @CreatedAt()
  created_at!: number;
}
```

### 3. Sparse Indexes

```typescript
// Index only when certain conditions met
class SparseTimestamp extends Model {
  @PrimaryKey()
  id!: string;

  @CreatedAt()
  created_at!: number;

  @UpdatedAt()
  updated_at!: number;

  @IndexSort()
  published_at?: number;  // Only indexed when published
}
```

## Migration Patterns

### Adding Timestamps to Existing Models

```typescript
// Step 1: Add decorators
class ExistingModel extends Model {
  @PrimaryKey()
  id!: string;

  data!: any;

  // New fields
  @CreatedAt()
  created_at!: number;

  @UpdatedAt()
  updated_at!: number;
}

// Step 2: Backfill existing records
async function backfill_timestamps() {
  const items = await ExistingModel.scan().execute();

  for (const item of items) {
    if (!item.created_at) {
      item.created_at = Date.now();
      item.updated_at = Date.now();
      await item.save();
    }
  }
}
```

### Changing Timestamp Format

```typescript
// Convert from seconds to milliseconds
async function convert_timestamps() {
  const items = await Model.scan().execute();

  for (const item of items) {
    if (item.created_at < 10000000000) {  // Seconds
      item.created_at *= 1000;  // Convert to milliseconds
      item.updated_at *= 1000;
      await item.save();
    }
  }
}
```

## Testen Timestamps

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Timestamp Decorators', () => {
  it('should set created_at on first save', async () => {
    const model = new TestModel();
    expect(model.created_at).toBeUndefined();

    await model.save();
    expect(model.created_at).toBeDefined();
    expect(model.created_at).toBeCloseTo(Date.now(), -2);
  });

  it('should update updated_at on save', async () => {
    const model = new TestModel();
    await model.save();

    const initial_updated = model.updated_at;

    vi.advanceTimersByTime(1000);
    model.data = 'changed';
    await model.save();

    expect(model.updated_at).toBeGreaterThan(initial_updated);
  });

  it('should not change created_at on update', async () => {
    const model = new TestModel();
    await model.save();

    const initial_created = model.created_at;

    model.data = 'changed';
    await model.save();

    expect(model.created_at).toBe(initial_created);
  });
});
```

## Siehe auch

- [@IndexSort](./index-sort.md) - Index timestamps for queries
- [@Default](./default.md) - Alternative default value approach
- [Query API](../query.md) - Time-based queries
- [Performance Guide](../../guides/performance.md) - Timestamp indexing strategies
