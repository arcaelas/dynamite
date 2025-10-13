# @PrimaryKey Decorator

## Overview

The `@PrimaryKey` decorator marks a property as the primary key for a DynamoDB table. This decorator is essential for defining the partition key and optional sort key that uniquely identify items in your table.

## Syntax

```typescript
@PrimaryKey(type?: 'HASH' | 'RANGE')
```

## Parameters

### type
- **Type**: `'HASH' | 'RANGE'`
- **Default**: `'HASH'`
- **Required**: No
- **Description**: Specifies whether this is a partition key (HASH) or sort key (RANGE)

## Basic Usage

### Simple Partition Key

```typescript
import { Model, PrimaryKey } from 'dynamite-orm';

class User extends Model {
  @PrimaryKey()
  id!: string;

  name!: string;
  email!: string;
}
```

### Composite Primary Key

```typescript
class OrderItem extends Model {
  @PrimaryKey('HASH')
  order_id!: string;

  @PrimaryKey('RANGE')
  item_id!: string;

  quantity!: number;
  price!: number;
}
```

## Advanced Examples

### UUID Primary Key

```typescript
import { v4 as uuidv4 } from 'uuid';

class Product extends Model {
  @PrimaryKey()
  @Default(() => uuidv4())
  id!: string;

  name!: string;
  category!: string;
}

// Usage
const product = new Product();
product.name = 'Laptop';
product.category = 'Electronics';
await product.save();
// id is automatically generated
```

### Timestamp-Based Sort Key

```typescript
class Event extends Model {
  @PrimaryKey('HASH')
  user_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => Date.now())
  timestamp!: number;

  event_type!: string;
  data!: Record<string, any>;
}

// Query events for a user
const events = await Event.query()
  .where('user_id', '=', 'user123')
  .sortBy('timestamp', 'DESC')
  .limit(10)
  .execute();
```

### Compound Sort Key Pattern

```typescript
class Message extends Model {
  @PrimaryKey('HASH')
  chat_room_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => `${Date.now()}#${Math.random().toString(36).substr(2, 9)}`)
  timestamp_id!: string;

  sender_id!: string;
  content!: string;
}

// Ensures unique messages even if sent at the same millisecond
```

### Hierarchical Data with Sort Key

```typescript
class FileSystem extends Model {
  @PrimaryKey('HASH')
  root_path!: string;

  @PrimaryKey('RANGE')
  full_path!: string;

  file_type!: 'file' | 'directory';
  size!: number;
  created_at!: number;
}

// Query all files in a directory
const files = await FileSystem.query()
  .where('root_path', '=', '/home/user')
  .where('full_path', 'beginsWith', '/home/user/documents')
  .execute();
```

## Common Patterns

### Multi-Tenant Application

```typescript
class TenantData extends Model {
  @PrimaryKey('HASH')
  tenant_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => `DATA#${Date.now()}`)
  data_key!: string;

  content!: any;
  metadata!: Record<string, any>;
}

// Isolate data by tenant
const tenant_data = await TenantData.query()
  .where('tenant_id', '=', 'tenant-abc')
  .execute();
```

### Time-Series Data

```typescript
class Metric extends Model {
  @PrimaryKey('HASH')
  metric_name!: string;

  @PrimaryKey('RANGE')
  @IndexSort()
  timestamp!: number;

  value!: number;
  unit!: string;
}

// Query metrics for a time range
const metrics = await Metric.query()
  .where('metric_name', '=', 'cpu_usage')
  .where('timestamp', 'between', [start_time, end_time])
  .execute();
```

### Version-Controlled Records

```typescript
class Document extends Model {
  @PrimaryKey('HASH')
  document_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => `v${Date.now()}`)
  version!: string;

  content!: string;
  author!: string;
  changes!: string;
}

// Get latest version
const latest = await Document.query()
  .where('document_id', '=', 'doc123')
  .sortBy('version', 'DESC')
  .limit(1)
  .first();
```

## Integration with Other Decorators

### With @Default

```typescript
class Session extends Model {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  session_id!: string;

  user_id!: string;
  expires_at!: number;
}
```

### With @Validate

```typescript
class Account extends Model {
  @PrimaryKey()
  @Validate((value) => /^ACC[0-9]{10}$/.test(value))
  account_number!: string;

  balance!: number;
  status!: string;
}
```

### With @Mutate

```typescript
class Identifier extends Model {
  @PrimaryKey()
  @Mutate((value) => value.toLowerCase().trim())
  username!: string;

  display_name!: string;
  email!: string;
}
```

### With @CreatedAt

```typescript
class AuditLog extends Model {
  @PrimaryKey('HASH')
  entity_id!: string;

  @PrimaryKey('RANGE')
  @CreatedAt()
  created_at!: number;

  action!: string;
  user_id!: string;
}
```

## Best Practices

### 1. Choose Appropriate Key Types

```typescript
// Good - Use string for partition keys to avoid hot partitions
class Item extends Model {
  @PrimaryKey()
  id!: string;  // UUID or prefixed ID
}

// Avoid - Sequential numbers can create hot partitions
class BadItem extends Model {
  @PrimaryKey()
  id!: number;  // Sequential auto-increment
}
```

### 2. Design for Query Patterns

```typescript
// Good - Sort key enables range queries
class LogEntry extends Model {
  @PrimaryKey('HASH')
  service_name!: string;

  @PrimaryKey('RANGE')
  timestamp!: number;

  level!: string;
  message!: string;
}

// Query logs for a service in a time range
const logs = await LogEntry.query()
  .where('service_name', '=', 'api')
  .where('timestamp', '>', yesterday)
  .execute();
```

### 3. Use Prefixes for Clarity

```typescript
class Resource extends Model {
  @PrimaryKey()
  @Default(() => `USER#${uuidv4()}`)
  id!: string;

  type!: 'user' | 'admin';
}

// Makes the entity type immediately clear
```

### 4. Compound Sort Keys for Flexibility

```typescript
class Activity extends Model {
  @PrimaryKey('HASH')
  user_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => `${Date.now()}#${activity_type}`)
  timestamp_type!: string;

  activity_type!: string;
  details!: any;
}

// Enables queries by both time and type
```

### 5. Immutable Primary Keys

```typescript
class Record extends Model {
  @PrimaryKey()
  private readonly id!: string;

  // Prevent accidental modification
  get record_id(): string {
    return this.id;
  }
}
```

## Validation Rules

The `@PrimaryKey` decorator enforces several rules:

1. **Required Field**: Primary key fields cannot be undefined or null
2. **Unique Values**: DynamoDB enforces uniqueness for partition key or composite key
3. **Supported Types**: String, number, or binary data
4. **Immutability**: Primary key values cannot be changed after creation

## Error Handling

```typescript
try {
  const user = new User();
  // Missing primary key
  await user.save();
} catch (error) {
  // Error: Primary key 'id' is required
}

try {
  const order = new OrderItem();
  order.order_id = 'ORD123';
  // Missing sort key
  await order.save();
} catch (error) {
  // Error: Sort key 'item_id' is required
}

// Update with new primary key (not allowed)
const existing = await User.find('user123');
existing.id = 'user456';  // This will fail
await existing.save();
```

## Performance Considerations

### 1. Partition Key Distribution

```typescript
// Good - Distributes load evenly
class Event extends Model {
  @PrimaryKey()
  @Default(() => `${Math.floor(Math.random() * 100)}#${Date.now()}`)
  event_id!: string;
}

// Avoid - Creates hot partition
class BadEvent extends Model {
  @PrimaryKey()
  @Default(() => 'ALL_EVENTS')
  partition!: string;
}
```

### 2. Sort Key for Efficient Queries

```typescript
// Efficient - Query specific time range
class Transaction extends Model {
  @PrimaryKey('HASH')
  account_id!: string;

  @PrimaryKey('RANGE')
  timestamp!: number;
}

const recent = await Transaction.query()
  .where('account_id', '=', 'ACC123')
  .where('timestamp', '>', Date.now() - 86400000)
  .execute();
```

## Migration Considerations

When changing primary key structure:

```typescript
// Old structure
class OldUser extends Model {
  @PrimaryKey()
  email!: string;
}

// New structure with UUID
class NewUser extends Model {
  @PrimaryKey()
  id!: string;

  email!: string;
}

// Migration script
async function migrate() {
  const old_users = await OldUser.scan().execute();

  for (const old_user of old_users) {
    const new_user = new NewUser();
    new_user.id = uuidv4();
    new_user.email = old_user.email;
    // Copy other fields
    await new_user.save();
  }
}
```

## See Also

- [@IndexSort](./index-sort.md) - Create secondary indexes
- [@Default](./default.md) - Set default values for keys
- [@Validate](./validate.md) - Validate key values
- [Query API](../query.md) - Query using primary keys
