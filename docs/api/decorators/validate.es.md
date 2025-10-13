# @Validate Decorator

## Descripción General

The `@Validate` decorator provides runtime validation for model properties, ensuring data integrity before persistence. It supports custom validation functions, built-in validators, and asynchronous validation logic.

## Sintaxis

```typescript
@Validate(validator: ValidatorFunction | ValidatorFunction[], options?: ValidateOptions)
```

## Parámetros

### ValidatorFunction

```typescript
type ValidatorFunction = (value: any, context?: ValidationContext) => boolean | string | Promise<boolean | string>;
```

- **Returns**: `true` if valid, `false` or error message string if invalid
- **Async**: Can return a Promise for asynchronous validation

### ValidationContext

```typescript
interface ValidationContext {
  /** Current model instance */
  instance: Model;

  /** Property name being validated */
  property: string;

  /** All property values */
  values: Record<string, any>;
}
```

### ValidateOptions

```typescript
interface ValidateOptions {
  /** Custom error message */
  message?: string;

  /** Skip validation when value is undefined */
  allow_undefined?: boolean;

  /** Skip validation when value is null */
  allow_null?: boolean;
}
```

## Uso Básico

### Simple Validation

```typescript
import { Model, PrimaryKey, Validate } from 'dynamite-orm';

class User extends Model {
  @PrimaryKey()
  id!: string;

  @Validate((value) => value.length >= 3)
  username!: string;

  @Validate((value) => value.includes('@'))
  email!: string;

  @Validate((value) => value >= 18)
  age!: number;
}

const user = new User();
user.username = 'ab';  // Will fail validation
await user.save();  // Throws validation error
```

### Custom Error Messages

```typescript
class Product extends Model {
  @PrimaryKey()
  id!: string;

  @Validate(
    (value) => value > 0 || 'Price must be positive',
    { message: 'Invalid price value' }
  )
  price!: number;

  @Validate(
    (value) => value >= 0 || 'Stock cannot be negative'
  )
  stock_count!: number;
}
```

## Ejemplos Avanzados

### Multiple Validators

```typescript
class Account extends Model {
  @PrimaryKey()
  id!: string;

  @Validate([
    (value) => value.length >= 8 || 'Password must be at least 8 characters',
    (value) => /[A-Z]/.test(value) || 'Password must contain uppercase letter',
    (value) => /[a-z]/.test(value) || 'Password must contain lowercase letter',
    (value) => /[0-9]/.test(value) || 'Password must contain number',
    (value) => /[^A-Za-z0-9]/.test(value) || 'Password must contain special character'
  ])
  password!: string;

  username!: string;
}
```

### Regular Expression Validation

```typescript
class Contact extends Model {
  @PrimaryKey()
  id!: string;

  @Validate((value) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(value) || 'Invalid name format')
  full_name!: string;

  @Validate((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email')
  email!: string;

  @Validate((value) => /^\+?[1-9]\d{1,14}$/.test(value) || 'Invalid phone number')
  phone!: string;

  @Validate((value) => /^https?:\/\/.+/.test(value) || 'Invalid URL')
  website!: string;
}
```

### Range Validation

```typescript
class Rating extends Model {
  @PrimaryKey()
  id!: string;

  @Validate((value) => value >= 1 && value <= 5 || 'Rating must be between 1 and 5')
  stars!: number;

  @Validate((value) => value.length <= 500 || 'Review must be 500 characters or less')
  review!: string;
}
```

### Enum Validation

```typescript
class Order extends Model {
  @PrimaryKey()
  order_id!: string;

  @Validate((value) => ['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(value))
  status!: string;

  @Validate((value) => ['standard', 'express', 'overnight'].includes(value))
  shipping_method!: string;
}
```

### Async Validation

```typescript
class UniqueUser extends Model {
  @PrimaryKey()
  id!: string;

  @Validate(async (value, context) => {
    const existing = await UniqueUser.query()
      .where('email', '=', value)
      .first();

    if (existing && existing.id !== context?.instance.id) {
      return 'Email already exists';
    }
    return true;
  })
  email!: string;

  username!: string;
}
```

### Contextual Validation

```typescript
class Employee extends Model {
  @PrimaryKey()
  employee_id!: string;

  role!: 'staff' | 'manager' | 'admin';

  @Validate((value, context) => {
    const role = context?.instance.role;
    if (role === 'admin') {
      return value >= 100000 || 'Admin salary must be at least $100,000';
    } else if (role === 'manager') {
      return value >= 70000 || 'Manager salary must be at least $70,000';
    }
    return value >= 40000 || 'Staff salary must be at least $40,000';
  })
  salary!: number;
}
```

### Array Validation

```typescript
class Task extends Model {
  @PrimaryKey()
  task_id!: string;

  @Validate([
    (value) => Array.isArray(value) || 'Tags must be an array',
    (value) => value.length <= 10 || 'Maximum 10 tags allowed',
    (value) => value.every((tag: string) => typeof tag === 'string') || 'Tags must be strings',
    (value) => value.every((tag: string) => tag.length <= 20) || 'Tags must be 20 chars or less'
  ])
  tags!: string[];
}
```

### Object Validation

```typescript
class Profile extends Model {
  @PrimaryKey()
  user_id!: string;

  @Validate([
    (value) => typeof value === 'object' || 'Address must be an object',
    (value) => value.street && value.city && value.zip || 'Address incomplete',
    (value) => /^\d{5}(-\d{4})?$/.test(value.zip) || 'Invalid zip code'
  ])
  address!: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}
```

## Patrones Comunes

### Credit Card Validation

```typescript
class Payment extends Model {
  @PrimaryKey()
  payment_id!: string;

  @Validate((value) => {
    // Luhn algorithm
    const digits = value.replace(/\D/g, '');
    let sum = 0;
    let is_alternate = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (is_alternate) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      is_alternate = !is_alternate;
    }

    return sum % 10 === 0 || 'Invalid credit card number';
  })
  card_number!: string;

  @Validate((value) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(value) || 'Invalid expiry format (MM/YY)')
  expiry!: string;

  @Validate((value) => /^\d{3,4}$/.test(value) || 'Invalid CVV')
  cvv!: string;
}
```

### Date Range Validation

```typescript
class Event extends Model {
  @PrimaryKey()
  event_id!: string;

  @Validate((value) => value > Date.now() || 'Start date must be in the future')
  start_date!: number;

  @Validate((value, context) => {
    const start = context?.instance.start_date;
    return value > start || 'End date must be after start date';
  })
  end_date!: number;
}
```

### File Upload Validation

```typescript
class Document extends Model {
  @PrimaryKey()
  document_id!: string;

  @Validate([
    (value) => ['pdf', 'doc', 'docx', 'txt'].includes(value) || 'Invalid file type',
  ])
  file_type!: string;

  @Validate((value) => value <= 10 * 1024 * 1024 || 'File size must be under 10MB')
  file_size!: number;

  @Validate((value) => value.length <= 255 || 'Filename too long')
  filename!: string;
}
```

### Business Logic Validation

```typescript
class BankAccount extends Model {
  @PrimaryKey()
  account_id!: string;

  balance!: number;

  @Validate((value, context) => {
    const balance = context?.instance.balance;
    const new_balance = balance - value;

    if (new_balance < 0) {
      return 'Insufficient funds';
    }
    if (value > 10000) {
      return 'Withdrawal limit exceeded';
    }
    return true;
  })
  withdrawal_amount!: number;
}
```

### Conditional Validation

```typescript
class ShippingInfo extends Model {
  @PrimaryKey()
  order_id!: string;

  requires_shipping!: boolean;

  @Validate((value, context) => {
    const requires = context?.instance.requires_shipping;
    if (!requires) return true;  // Skip validation if shipping not required

    return value && value.street && value.city || 'Shipping address required';
  }, { allow_undefined: true })
  shipping_address?: {
    street: string;
    city: string;
    zip: string;
  };
}
```

## Integración con Otros Decoradores

### With @Default

```typescript
class Settings extends Model {
  @PrimaryKey()
  id!: string;

  @Default(50)
  @Validate((value) => value >= 0 && value <= 100 || 'Volume must be 0-100')
  volume!: number;

  @Default('en')
  @Validate((value) => ['en', 'es', 'fr', 'de'].includes(value))
  language!: string;
}
```

### With @Mutate

```typescript
class Article extends Model {
  @PrimaryKey()
  id!: string;

  @Mutate((value) => value.trim().toLowerCase())
  @Validate((value) => value.length >= 3 || 'Slug must be at least 3 characters')
  slug!: string;

  title!: string;
}
```

### With @IndexSort

```typescript
class Product extends Model {
  @PrimaryKey()
  id!: string;

  @IndexSort()
  @Validate((value) => ['electronics', 'clothing', 'food'].includes(value))
  category!: string;

  @IndexSort()
  @Validate((value) => value > 0)
  price!: number;
}
```

### With Timestamps

```typescript
class Booking extends Model {
  @PrimaryKey()
  booking_id!: string;

  @CreatedAt()
  @Validate((value) => value <= Date.now())
  created_at!: number;

  @Validate((value, context) => {
    const created = context?.instance.created_at;
    return value > created || 'Check-out must be after check-in';
  })
  checkout_date!: number;
}
```

## Mejores Prácticas

### 1. Provide Clear Error Messages

```typescript
// Good - Specific error messages
class GoodModel extends Model {
  @Validate((value) => value.length >= 8 || 'Password must be at least 8 characters')
  password!: string;
}

// Avoid - Generic errors
class BadModel extends Model {
  @Validate((value) => value.length >= 8)  // ❌ No error message
  password!: string;
}
```

### 2. Validate Early

```typescript
class ValidateEarly extends Model {
  @PrimaryKey()
  id!: string;

  @Validate((value) => {
    // Check cheapest validations first
    if (typeof value !== 'string') return 'Must be string';
    if (value.length < 3) return 'Too short';
    if (value.length > 50) return 'Too long';

    // Expensive regex last
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Invalid characters';

    return true;
  })
  username!: string;
}
```

### 3. Avoid Side Effects

```typescript
// Good - Pure validation
class GoodValidator extends Model {
  @Validate((value) => value > 0)
  count!: number;
}

// Avoid - Side effects
class BadValidator extends Model {
  @Validate((value) => {
    console.log('Validating:', value);  // ❌ Side effect
    return value > 0;
  })
  count!: number;
}
```

### 4. Use Type Guards

```typescript
class TypeSafe extends Model {
  @PrimaryKey()
  id!: string;

  @Validate((value) => {
    if (typeof value !== 'number') return 'Must be number';
    if (!Number.isFinite(value)) return 'Must be finite';
    if (value < 0) return 'Must be positive';
    return true;
  })
  amount!: number;
}
```

### 5. Handle Async Validation Carefully

```typescript
class AsyncValidation extends Model {
  @PrimaryKey()
  id!: string;

  @Validate(async (value) => {
    try {
      const result = await external_api.validate(value);
      return result.valid || result.error;
    } catch (error) {
      return 'Validation service unavailable';
    }
  })
  external_id!: string;
}
```

## Manejo de Errores

### Validation Errors

```typescript
try {
  const user = new User();
  user.email = 'invalid-email';
  await user.save();
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.field, error.message);
    // error.field = 'email'
    // error.message = 'Invalid email'
  }
}
```

### Multiple Validation Errors

```typescript
class MultiValidation extends Model {
  @PrimaryKey()
  id!: string;

  @Validate((value) => value.length >= 3 || 'Too short')
  username!: string;

  @Validate((value) => value.includes('@') || 'Invalid email')
  email!: string;

  async validateAll(): Promise<ValidationResult> {
    const errors: Record<string, string> = {};

    try {
      await this.save();
    } catch (error) {
      if (error instanceof ValidationError) {
        errors[error.field] = error.message;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }
}
```

## Custom Validators

### Reusable Validator Functions

```typescript
// validators.ts
export const IsEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email';

export const IsURL = (value: string) =>
  /^https?:\/\/.+/.test(value) || 'Invalid URL';

export const MinLength = (min: number) => (value: string) =>
  value.length >= min || `Must be at least ${min} characters`;

export const MaxLength = (max: number) => (value: string) =>
  value.length <= max || `Must be at most ${max} characters`;

export const InRange = (min: number, max: number) => (value: number) =>
  (value >= min && value <= max) || `Must be between ${min} and ${max}`;

// Usage
class User extends Model {
  @Validate(IsEmail)
  email!: string;

  @Validate(MinLength(3))
  username!: string;

  @Validate(InRange(18, 120))
  age!: number;
}
```

### Validator Composition

```typescript
const Compose = (...validators: ValidatorFunction[]) => (value: any, context?: ValidationContext) => {
  for (const validator of validators) {
    const result = validator(value, context);
    if (result !== true) return result;
  }
  return true;
};

class ComposedValidation extends Model {
  @Validate(Compose(
    MinLength(8),
    (value) => /[A-Z]/.test(value) || 'Needs uppercase',
    (value) => /[0-9]/.test(value) || 'Needs number'
  ))
  password!: string;
}
```

## Pruebas Validators

```typescript
import { describe, it, expect } from 'vitest';

describe('Validation', () => {
  it('should validate email format', async () => {
    const user = new User();
    user.email = 'invalid';

    await expect(user.save()).rejects.toThrow('Invalid email');
  });

  it('should accept valid email', async () => {
    const user = new User();
    user.id = 'user123';
    user.email = 'user@example.com';

    await expect(user.save()).resolves.not.toThrow();
  });
});
```

## Ver También

- [@Mutate](./mutate.md) - Transform values before validation
- [@Default](./default.md) - Set default values
- [Error Handling](../../guides/error-handling.md) - Handle validation errors
