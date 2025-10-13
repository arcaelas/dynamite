# @Default Decorator

## Overview

The `@Default` decorator automatically sets default values for model properties when instances are created. It supports both static values and dynamic functions, making it essential for generating timestamps, UUIDs, and computed defaults.

## Syntax

```typescript
@Default(value: any | (() => any))
```

## Parameters

### value
- **Type**: `any | (() => any)`
- **Required**: Yes
- **Description**: Static value or function that returns the default value

## Basic Usage

### Static Defaults

```typescript
import { Model, PrimaryKey, Default } from 'dynamite-orm';

class User extends Model {
  @PrimaryKey()
  id!: string;

  @Default('active')
  status!: string;

  @Default(0)
  login_count!: number;

  @Default(true)
  email_verified!: boolean;
}

const user = new User();
user.id = 'user123';
// status = 'active', login_count = 0, email_verified = true
await user.save();
```

### Dynamic Defaults

```typescript
class Document extends Model {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  id!: string;

  @Default(() => Date.now())
  created_at!: number;

  @Default(() => ({ views: 0, likes: 0 }))
  stats!: { views: number; likes: number };

  title!: string;
}

const doc = new Document();
doc.title = 'My Document';
await doc.save();
// id = auto-generated UUID
// created_at = current timestamp
// stats = { views: 0, likes: 0 }
```

## Advanced Examples

### UUID Generation

```typescript
import { v4 as uuidv4, v1 as uuidv1 } from 'uuid';

class Resource extends Model {
  @PrimaryKey()
  @Default(() => uuidv4())
  id!: string;

  @Default(() => uuidv1())
  time_based_id!: string;

  name!: string;
}
```

### Timestamp Defaults

```typescript
class Post extends Model {
  @PrimaryKey()
  id!: string;

  title!: string;

  @Default(() => Date.now())
  created_at!: number;

  @Default(() => new Date().toISOString())
  iso_timestamp!: string;

  @Default(() => Math.floor(Date.now() / 1000))
  unix_timestamp!: number;
}
```

### Computed Defaults

```typescript
class Order extends Model {
  @PrimaryKey()
  @Default(() => `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  order_number!: string;

  @Default(() => {
    const now = new Date();
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).getTime();
  })
  estimated_delivery!: number;

  customer_id!: string;
  total_amount!: number;
}
```

### Complex Object Defaults

```typescript
class UserProfile extends Model {
  @PrimaryKey()
  user_id!: string;

  @Default(() => ({
    theme: 'light',
    language: 'en',
    notifications: {
      email: true,
      push: true,
      sms: false
    }
  }))
  preferences!: {
    theme: string;
    language: string;
    notifications: Record<string, boolean>;
  };

  @Default(() => [])
  tags!: string[];

  @Default(() => new Map())
  metadata!: Map<string, any>;
}
```

### Environment-Based Defaults

```typescript
class Configuration extends Model {
  @PrimaryKey()
  config_id!: string;

  @Default(() => process.env.NODE_ENV || 'development')
  environment!: string;

  @Default(() => process.env.API_URL || 'http://localhost:3000')
  api_url!: string;

  @Default(() => parseInt(process.env.MAX_RETRIES || '3'))
  max_retries!: number;
}
```

## Common Patterns

### Counters and Accumulators

```typescript
class Account extends Model {
  @PrimaryKey()
  account_id!: string;

  @Default(0)
  balance!: number;

  @Default(0)
  transaction_count!: number;

  @Default(() => [])
  transaction_history!: string[];

  created_at!: number;
}
```

### Status Workflows

```typescript
class Task extends Model {
  @PrimaryKey()
  task_id!: string;

  title!: string;

  @Default('pending')
  status!: 'pending' | 'in_progress' | 'completed' | 'cancelled';

  @Default(0)
  priority!: number;

  @Default(() => Date.now() + 86400000)  // 24 hours from now
  due_date!: number;

  assigned_to?: string;
}
```

### Audit Fields

```typescript
class AuditedModel extends Model {
  @PrimaryKey()
  id!: string;

  @Default(() => Date.now())
  created_at!: number;

  @Default(() => Date.now())
  updated_at!: number;

  @Default(() => 'system')
  created_by!: string;

  @Default(() => 'system')
  updated_by!: string;

  @Default(1)
  version!: number;
}
```

### Array and Collection Defaults

```typescript
class Collection extends Model {
  @PrimaryKey()
  collection_id!: string;

  name!: string;

  @Default(() => [])
  items!: string[];

  @Default(() => new Set())
  unique_tags!: Set<string>;

  @Default(() => ({ total: 0, active: 0 }))
  counts!: { total: number; active: number };
}
```

### Random Defaults

```typescript
class Session extends Model {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  session_id!: string;

  @Default(() => Math.random().toString(36).substring(2, 15))
  csrf_token!: string;

  @Default(() => crypto.getRandomValues(new Uint8Array(32)))
  encryption_key!: Uint8Array;

  @Default(() => Date.now() + 3600000)  // 1 hour
  expires_at!: number;
}
```

## Integration with Other Decorators

### With @PrimaryKey

```typescript
class Entity extends Model {
  @PrimaryKey()
  @Default(() => `ENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  id!: string;

  name!: string;
}
```

### With @Validate

```typescript
class ValidatedModel extends Model {
  @PrimaryKey()
  id!: string;

  @Default(() => Date.now())
  @Validate((value) => value > 0)
  timestamp!: number;

  @Default('active')
  @Validate((value) => ['active', 'inactive', 'suspended'].includes(value))
  status!: string;
}
```

### With @Mutate

```typescript
class NormalizedModel extends Model {
  @PrimaryKey()
  id!: string;

  @Default('untitled')
  @Mutate((value) => value.trim().toLowerCase())
  slug!: string;

  @Default(() => [])
  @Mutate((value) => value.map((tag: string) => tag.toLowerCase()))
  tags!: string[];
}
```

### With @IndexSort

```typescript
class SearchableModel extends Model {
  @PrimaryKey()
  id!: string;

  title!: string;

  @Default(() => Date.now())
  @IndexSort()
  created_at!: number;

  @Default('draft')
  @IndexSort()
  status!: string;
}
```

### With Timestamps

```typescript
class TimestampedModel extends Model {
  @PrimaryKey()
  id!: string;

  @Default(() => Date.now())
  @CreatedAt()
  created_at!: number;

  @Default(() => Date.now())
  @UpdatedAt()
  updated_at!: number;

  content!: string;
}
```

## Best Practices

### 1. Use Functions for Dynamic Values

```typescript
// Good - Function generates new value each time
class GoodModel extends Model {
  @PrimaryKey()
  id!: string;

  @Default(() => Date.now())
  timestamp!: number;
}

// Bad - Static value is the same for all instances
class BadModel extends Model {
  @PrimaryKey()
  id!: string;

  @Default(Date.now())  // ❌ Evaluated once at class definition
  timestamp!: number;
}
```

### 2. Avoid Side Effects in Default Functions

```typescript
// Good - Pure function
class GoodModel extends Model {
  @Default(() => Date.now())
  created_at!: number;
}

// Avoid - Side effects
class AvoidModel extends Model {
  @Default(() => {
    console.log('Creating instance');  // ❌ Side effect
    return Date.now();
  })
  created_at!: number;
}
```

### 3. Use Appropriate Types

```typescript
// Good - Type-safe defaults
class TypeSafeModel extends Model {
  @PrimaryKey()
  id!: string;

  @Default(0)
  count!: number;

  @Default(() => [])
  items!: string[];

  @Default(() => ({ key: 'value' }))
  metadata!: Record<string, string>;
}
```

### 4. Document Complex Defaults

```typescript
class WellDocumented extends Model {
  @PrimaryKey()
  id!: string;

  /**
   * Auto-generated order number format: ORD-{timestamp}-{random}
   * Example: ORD-1234567890-abc123def
   */
  @Default(() => `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  order_number!: string;

  /**
   * Estimated delivery date: 7 days from creation
   */
  @Default(() => Date.now() + 7 * 24 * 60 * 60 * 1000)
  estimated_delivery!: number;
}
```

### 5. Consider Performance

```typescript
// Good - Simple, fast defaults
class Efficient extends Model {
  @Default(0)
  counter!: number;

  @Default(() => Date.now())
  timestamp!: number;
}

// Avoid - Expensive defaults
class Inefficient extends Model {
  @Default(() => {
    // ❌ Expensive computation
    const result = Array.from({ length: 10000 }, (_, i) => i)
      .reduce((sum, n) => sum + n, 0);
    return result;
  })
  computed_value!: number;
}
```

## Default Value Resolution

The `@Default` decorator follows this resolution order:

1. If property is explicitly set, use that value
2. If `@Default` is present and property is undefined, apply default
3. Otherwise, property remains undefined

```typescript
class Model1 extends Model {
  @PrimaryKey()
  id!: string;

  @Default('default_value')
  field!: string;
}

// Scenario 1: Explicit value
const m1 = new Model1();
m1.field = 'custom_value';
await m1.save();
// field = 'custom_value'

// Scenario 2: Use default
const m2 = new Model1();
await m2.save();
// field = 'default_value'

// Scenario 3: Set to null explicitly
const m3 = new Model1();
m3.field = null as any;
await m3.save();
// field = null (default not applied)
```

## Default Functions Context

```typescript
class ContextAware extends Model {
  @PrimaryKey()
  id!: string;

  name!: string;

  // Default function has access to 'this' context
  @Default(function(this: ContextAware) {
    return `${this.name}_${Date.now()}`;
  })
  slug!: string;
}

const model = new ContextAware();
model.id = 'test';
model.name = 'Example';
await model.save();
// slug = 'Example_1234567890'
```

## Overriding Defaults

```typescript
class Configurable extends Model {
  @PrimaryKey()
  id!: string;

  @Default('default_value')
  field!: string;

  // Override default in constructor or method
  constructor(override_field?: string) {
    super();
    if (override_field) {
      this.field = override_field;
    }
  }
}

const with_default = new Configurable();
// field = 'default_value'

const with_override = new Configurable('custom_value');
// field = 'custom_value'
```

## Testing Defaults

```typescript
import { describe, it, expect } from 'vitest';

describe('Default Decorator', () => {
  it('should apply static defaults', () => {
    const model = new TestModel();
    expect(model.status).toBe('active');
    expect(model.count).toBe(0);
  });

  it('should apply dynamic defaults', () => {
    const before = Date.now();
    const model = new TestModel();
    const after = Date.now();

    expect(model.created_at).toBeGreaterThanOrEqual(before);
    expect(model.created_at).toBeLessThanOrEqual(after);
  });

  it('should not override explicit values', () => {
    const model = new TestModel();
    model.status = 'inactive';
    expect(model.status).toBe('inactive');
  });
});
```

## See Also

- [@Validate](./validate.md) - Validate default values
- [@Mutate](./mutate.md) - Transform default values
- [@CreatedAt](./timestamps.md) - Specialized timestamp defaults
- [@UpdatedAt](./timestamps.md) - Auto-updating timestamps
