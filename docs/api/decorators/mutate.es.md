# @Mutate Decorator

## Descripción General

The `@Mutate` decorator transforms property values automatically before persistence. It enables data normalization, sanitization, and formatting, ensuring consistent data representation in your DynamoDB tables.

## Sintaxis

```typescript
@Mutate(transformer: TransformerFunction | TransformerFunction[])
```

## Parámetros

### TransformerFunction

```typescript
type TransformerFunction = (value: any, context?: MutationContext) => any | Promise<any>;
```

- **Returns**: Transformed value
- **Async**: Can return a Promise for asynchronous transformations

### MutationContext

```typescript
interface MutationContext {
  /** Current model instance */
  instance: Model;

  /** Property name being mutated */
  property: string;

  /** All property values */
  values: Record<string, any>;
}
```

## Uso Básico

### Simple Transformations

```typescript
import { Model, PrimaryKey, Mutate } from 'dynamite-orm';

class User extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => value.toLowerCase())
  email!: string;

  @Mutate((value) => value.trim())
  username!: string;

  @Mutate((value) => Math.round(value))
  age!: number;
}

const user = new User();
user.email = 'USER@EXAMPLE.COM';
user.username = '  john_doe  ';
user.age = 25.7;
await user.save();
// email = 'user@example.com'
// username = 'john_doe'
// age = 26
```

### String Mutations

```typescript
class Article extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => value.trim())
  title!: string;

  @Mutate((value) => value.toLowerCase().replace(/\s+/g, '-'))
  slug!: string;

  @Mutate((value) => value.replace(/<[^>]*>/g, ''))
  content!: string;  // Strip HTML tags
}
```

## Ejemplos Avanzados

### Multiple Transformers

```typescript
class Product extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate([
    (value) => value.trim(),
    (value) => value.toLowerCase(),
    (value) => value.replace(/[^a-z0-9-]/g, '-'),
    (value) => value.replace(/-+/g, '-'),
    (value) => value.replace(/^-|-$/g, '')
  ])
  sku!: string;

  name!: string;
}

const product = new Product();
product.sku = '  Product @@ 123  ';
await product.save();
// sku = 'product-123'
```

### Number Transformations

```typescript
class FinancialRecord extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => Math.round(value * 100) / 100)  // 2 decimal places
  amount!: number;

  @Mutate((value) => Math.max(0, value))  // Ensure non-negative
  balance!: number;

  @Mutate((value) => parseInt(value))
  quantity!: number;

  @Mutate((value) => parseFloat(value.toFixed(4)))
  percentage!: number;
}
```

### Array Transformations

```typescript
class Post extends Model {
  @PrimaryKey()
  post_id!: string;

  title!: string;

  @Mutate((value) => value.map((tag: string) => tag.toLowerCase().trim()))
  tags!: string[];

  @Mutate((value) => [...new Set(value)])  // Remove duplicates
  categories!: string[];

  @Mutate((value) => value.sort())
  keywords!: string[];
}
```

### Object Transformations

```typescript
class Profile extends Model {
  @PrimaryKey()
  user_id!: string;

  @Mutate((value) => ({
    street: value.street?.trim(),
    city: value.city?.trim(),
    state: value.state?.toUpperCase(),
    zip: value.zip?.replace(/\D/g, '')
  }))
  address!: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };

  @Mutate((value) => {
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val !== null && val !== undefined) {
        cleaned[key] = val;
      }
    }
    return cleaned;
  })
  metadata!: Record<string, any>;
}
```

### Date Transformations

```typescript
class Event extends Model {
  @PrimaryKey()
  event_id!: string;

  @Mutate((value) => {
    if (typeof value === 'string') {
      return new Date(value).getTime();
    }
    if (value instanceof Date) {
      return value.getTime();
    }
    return value;
  })
  start_time!: number;

  @Mutate((value) => Math.floor(value / 1000))  // Convert ms to seconds
  unix_timestamp!: number;
}
```

### Contextual Transformations

```typescript
class Document extends Model {
  @PrimaryKey()
  document_id!: string;

  title!: string;

  @Mutate((value, context) => {
    const title = context?.instance.title || 'untitled';
    return `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  })
  filename!: string;

  content!: string;
}
```

## Patrones Comunes

### Email Normalization

```typescript
class Contact extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate([
    (value) => value.trim(),
    (value) => value.toLowerCase(),
    (value) => value.replace(/\s+/g, '')
  ])
  email!: string;

  name!: string;
}
```

### Phone Number Formatting

```typescript
class Customer extends Model {
  @PrimaryKey()
  customer_id!: string;

  @Mutate((value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  })
  phone!: string;

  name!: string;
}
```

### URL Normalization

```typescript
class Link extends Model {
  @PrimaryKey()
  link_id!: string;

  @Mutate([
    (value) => value.trim(),
    (value) => value.toLowerCase(),
    (value) => value.replace(/^https?:\/\//, ''),
    (value) => value.replace(/\/$/, ''),
    (value) => `https://${value}`
  ])
  url!: string;

  title!: string;
}
```

### Slug Generation

```typescript
class BlogPost extends Model {
  @PrimaryKey()
  post_id!: string;

  title!: string;

  @Mutate((value, context) => {
    const title = context?.instance.title || value;
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
  })
  slug!: string;

  content!: string;
}
```

### JSON Serialization

```typescript
class Configuration extends Model {
  @PrimaryKey()
  config_id!: string;

  @Mutate((value) => typeof value === 'string' ? value : JSON.stringify(value))
  json_data!: string;

  @Mutate((value) => typeof value === 'string' ? JSON.parse(value) : value)
  parsed_data!: any;
}
```

### Sanitization

```typescript
class Comment extends Model {
  @PrimaryKey()
  comment_id!: string;

  @Mutate([
    (value) => value.trim(),
    (value) => value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ''),
    (value) => value.replace(/javascript:/gi, ''),
    (value) => value.replace(/on\w+\s*=/gi, '')
  ])
  content!: string;

  author_id!: string;
}
```

### Case Normalization

```typescript
class Identifier extends Model {
  @PrimaryKey()
  @Mutate((value) => value.toUpperCase())
  id!: string;

  @Mutate((value) => value.toLowerCase())
  username!: string;

  @Mutate((value) => {
    return value
      .toLowerCase()
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  })
  full_name!: string;
}
```

### Whitespace Handling

```typescript
class TextContent extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => value.trim())
  title!: string;

  @Mutate((value) => value.replace(/\s+/g, ' ').trim())
  description!: string;

  @Mutate((value) => value.replace(/^\s+|\s+$/gm, ''))
  multiline_text!: string;
}
```

## Integración con Otros Decoradores

### With @Validate

```typescript
class ValidatedMutation extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => value.toLowerCase().trim())
  @Validate((value) => value.length >= 3)
  username!: string;

  @Mutate((value) => value.replace(/\s+/g, ''))
  @Validate((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
  email!: string;
}
```

### With @Default

```typescript
class DefaultMutation extends Model {
  @PrimaryKey()
  id!: string;

  @Default(() => Date.now())
  @Mutate((value) => Math.floor(value / 1000))
  created_timestamp!: number;

  @Default(() => [])
  @Mutate((value) => [...new Set(value)])
  unique_items!: string[];
}
```

### With @IndexSort

```typescript
class IndexedMutation extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => value.toLowerCase())
  @IndexSort()
  category!: string;

  @Mutate((value) => Math.round(value * 100) / 100)
  @IndexSort()
  price!: number;
}
```

### With @PrimaryKey

```typescript
class MutatedKey extends Model {
  @PrimaryKey()
  @Mutate((value) => value.toLowerCase().replace(/\s+/g, '-'))
  id!: string;

  @PrimaryKey('RANGE')
  @Mutate((value) => Math.floor(value))
  timestamp!: number;

  data!: any;
}
```

## Mejores Prácticas

### 1. Keep Transformations Pure

```typescript
// Good - Pure transformation
class GoodMutation extends Model {
  @Mutate((value) => value.toLowerCase())
  field!: string;
}

// Avoid - Side effects
class BadMutation extends Model {
  @Mutate((value) => {
    console.log('Mutating:', value);  // ❌ Side effect
    return value.toLowerCase();
  })
  field!: string;
}
```

### 2. Order Matters

```typescript
// Good - Logical order
class OrderedMutation extends Model {
  @Mutate([
    (value) => value.trim(),           // 1. Remove whitespace
    (value) => value.toLowerCase(),    // 2. Normalize case
    (value) => value.replace(/\s+/g, '-'),  // 3. Replace spaces
    (value) => value.replace(/-+/g, '-')    // 4. Collapse dashes
  ])
  slug!: string;
}
```

### 3. Handle Edge Cases

```typescript
class SafeMutation extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return String(value);
    return value.trim().toLowerCase();
  })
  safe_field!: string;
}
```

### 4. Avoid Data Loss

```typescript
// Good - Preserves information
class PreserveData extends Model {
  @Mutate((value) => value.trim())
  name!: string;
}

// Avoid - Loses data
class LoseData extends Model {
  @Mutate((value) => value.substring(0, 10))  // ❌ Truncates without warning
  name!: string;
}
```

### 5. Document Complex Transformations

```typescript
class DocumentedMutation extends Model {
  @PrimaryKey()
  id!: string;

  /**
   * Normalizes SKU format:
   * - Converts to uppercase
   * - Removes special characters
   * - Ensures 10 character length with leading zeros
   * Example: "abc-123" -> "ABC0000123"
   */
  @Mutate((value) => {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned.padStart(10, '0');
  })
  sku!: string;
}
```

## Async Transformations

### API-Based Mutations

```typescript
class EnrichedData extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate(async (value) => {
    const response = await fetch(`https://api.geocode.com?address=${value}`);
    const data = await response.json();
    return {
      original: value,
      latitude: data.lat,
      longitude: data.lng
    };
  })
  address!: any;
}
```

### Async Sanitization

```typescript
class SecureContent extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate(async (value) => {
    const sanitized = await security_service.sanitize(value);
    return sanitized;
  })
  user_content!: string;
}
```

## Manejo de Errores

### Graceful Degradation

```typescript
class ErrorHandling extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      return value;  // Return original on error
    }
  })
  json_field!: any;
}
```

### Validation After Mutation

```typescript
class ValidatedTransform extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => {
    const transformed = value.toLowerCase().trim();
    if (!transformed) {
      throw new Error('Transformation resulted in empty value');
    }
    return transformed;
  })
  required_field!: string;
}
```

## Custom Transformers

### Reusable Transformer Functions

```typescript
// transformers.ts
export const ToLowerCase = (value: string) => value.toLowerCase();

export const Trim = (value: string) => value.trim();

export const RemoveSpaces = (value: string) => value.replace(/\s+/g, '');

export const Slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');

export const Round = (decimals: number) => (value: number) =>
  Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);

export const Clamp = (min: number, max: number) => (value: number) =>
  Math.min(Math.max(value, min), max);

// Usage
class Product extends Model {
  @Mutate(Slugify)
  slug!: string;

  @Mutate(Round(2))
  price!: number;

  @Mutate(Clamp(0, 100))
  discount_percentage!: number;
}
```

### Transformer Composition

```typescript
const Compose = (...transformers: TransformerFunction[]) =>
  (value: any, context?: MutationContext) =>
    transformers.reduce((acc, transformer) => transformer(acc, context), value);

class ComposedMutation extends Model {
  @Mutate(Compose(
    Trim,
    ToLowerCase,
    RemoveSpaces
  ))
  normalized_field!: string;
}
```

## Consideraciones de Rendimiento

### Avoid Expensive Operations

```typescript
// Good - Simple, fast transformation
class Efficient extends Model {
  @Mutate((value) => value.toLowerCase())
  field!: string;
}

// Avoid - Expensive operation
class Inefficient extends Model {
  @Mutate((value) => {
    // ❌ Expensive regex on large strings
    return value.replace(/(.{1})/g, '$1-');
  })
  field!: string;
}
```

### Cache Results When Possible

```typescript
const transformation_cache = new Map<string, string>();

class CachedMutation extends Model {
  @Mutate((value) => {
    if (transformation_cache.has(value)) {
      return transformation_cache.get(value);
    }

    const result = expensive_transformation(value);
    transformation_cache.set(value, result);
    return result;
  })
  computed_field!: string;
}
```

## Pruebas Transformers

```typescript
import { describe, it, expect } from 'vitest';

describe('Mutate Decorator', () => {
  it('should transform to lowercase', () => {
    const model = new TestModel();
    model.field = 'UPPERCASE';
    expect(model.field).toBe('uppercase');
  });

  it('should chain transformations', () => {
    const model = new TestModel();
    model.slug = '  My Title  ';
    expect(model.slug).toBe('my-title');
  });
});
```

## Ver También

- [@Validate](./validate.md) - Validate transformed values
- [@Default](./default.md) - Set default values before mutation
- [Data Modeling](../../guides/data-modeling.md) - Best practices for data transformation
