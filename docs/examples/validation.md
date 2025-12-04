# Data Validation Example

This comprehensive example demonstrates data validation and transformation patterns in Dynamite ORM. Learn how to validate user input, transform data, create custom validators, and build robust models with data integrity.

## Table of Contents

- [Basic Validation](#basic-validation)
- [Data Transformation with Mutate](#data-transformation-with-mutate)
- [Custom Validators](#custom-validators)
- [Chaining Validators](#chaining-validators)
- [NotNull Validation](#notnull-validation)
- [Complex Validation Patterns](#complex-validation-patterns)
- [Complete Working Example](#complete-working-example)
- [Expected Output](#expected-output)
- [Best Practices](#best-practices)
- [Common Validation Patterns](#common-validation-patterns)

## Basic Validation

The `@Validate()` decorator allows you to define validation rules for model fields. Validators return `true` for valid data or an error message string for invalid data.

### Simple Validation

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  Validate,
  CreationOptional
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Validate name length
  @Validate((value) => {
    const name = value as string;
    return name.length >= 2 || "Name must be at least 2 characters";
  })
  declare name: string;

  // Validate email format
  @Validate((value) => {
    const email = value as string;
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email_regex.test(email) || "Invalid email format";
  })
  declare email: string;

  // Validate age range
  @Validate((value) => {
    const age = value as number;
    if (age < 0) return "Age cannot be negative";
    if (age > 150) return "Age must be realistic";
    return true;
  })
  declare age: number;
}
```

### Usage

```typescript
// Valid data
const user1 = await User.create({
  name: "John Doe",
  email: "john@example.com",
  age: 25
});
console.log("User created successfully");

// Invalid name (too short)
try {
  await User.create({
    name: "J",
    email: "john@example.com",
    age: 25
  });
} catch (error) {
  console.error(error.message); // "Name must be at least 2 characters"
}

// Invalid email format
try {
  await User.create({
    name: "John Doe",
    email: "invalid-email",
    age: 25
  });
} catch (error) {
  console.error(error.message); // "Invalid email format"
}

// Invalid age (negative)
try {
  await User.create({
    name: "John Doe",
    email: "john@example.com",
    age: -5
  });
} catch (error) {
  console.error(error.message); // "Age cannot be negative"
}
```

## Data Transformation with Mutate

The `@Mutate()` decorator transforms data before it's validated or stored. **Important: Mutate always runs before Validate.**

### Basic Transformation

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Transform email to lowercase and trim whitespace
  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate((value) => {
    const email = value as string;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || "Invalid email";
  })
  declare email: string;

  // Trim and capitalize name
  @Mutate((value) => {
    const name = value as string;
    return name.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  })
  declare name: string;

  // Round age to integer
  @Mutate((value) => Math.round(value as number))
  @Validate((value) => (value as number) >= 0 || "Age must be positive")
  declare age: number;
}
```

### Usage

```typescript
const user = await User.create({
  name: "  john DOE  ",
  email: "  JOHN@EXAMPLE.COM  ",
  age: 25.7
});

console.log(user.name);  // "John Doe" (transformed)
console.log(user.email); // "john@example.com" (transformed)
console.log(user.age);   // 26 (rounded)
```

## Custom Validators

Create reusable validation functions for common patterns:

### Email Validator

```typescript
function validate_email(value: any): boolean | string {
  const email = value as string;
  const email_regex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  return email_regex.test(email) || "Invalid email format";
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate(validate_email)
  declare email: string;
}
```

### Password Strength Validator

```typescript
function validate_password_strength(value: any): boolean | string {
  const password = value as string;

  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }

  if (!/[!@#$%^&*]/.test(password)) {
    return "Password must contain at least one special character (!@#$%^&*)";
  }

  return true;
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_password_strength)
  declare password: string;
}
```

### URL Validator

```typescript
function validate_url(value: any): boolean | string {
  const url = value as string;
  try {
    new URL(url);
    return true;
  } catch {
    return "Invalid URL format";
  }
}

class Profile extends Table<Profile> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_url)
  declare website: string;
}
```

### Phone Number Validator

```typescript
function validate_phone_number(value: any): boolean | string {
  const phone = value as string;
  const phone_regex = /^\+?[1-9]\d{1,14}$/;
  return phone_regex.test(phone) || "Invalid phone number format";
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((value) => (value as string).replace(/[\s\-\(\)]/g, ''))
  @Validate(validate_phone_number)
  declare phone: string;
}
```

## Chaining Validators

You can apply multiple validators to a single field. **Validators execute in order from top to bottom.**

### Multiple Validation Rules

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Multiple validators for name
  @Validate((value) => (value as string).length >= 2 || "Name too short (min 2)")
  @Validate((value) => (value as string).length <= 50 || "Name too long (max 50)")
  @Validate((value) => /^[a-zA-Z\s]+$/.test(value as string) || "Name can only contain letters and spaces")
  declare name: string;

  // Multiple validators for username
  @Validate((value) => (value as string).length >= 3 || "Username too short (min 3)")
  @Validate((value) => (value as string).length <= 20 || "Username too long (max 20)")
  @Validate((value) => /^[a-z0-9_]+$/.test(value as string) || "Username can only contain lowercase letters, numbers, and underscores")
  @Validate((value) => !/^\d/.test(value as string) || "Username cannot start with a number")
  declare username: string;
}
```

### Chaining Mutate and Validate

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Transform then validate
  @Mutate((value) => (value as string).trim())
  @Mutate((value) => (value as string).toLowerCase())
  @Validate((value) => (value as string).length >= 3 || "Product name too short")
  @Validate((value) => (value as string).length <= 100 || "Product name too long")
  declare name: string;

  // Round then validate price
  @Mutate((value) => Math.round((value as number) * 100) / 100)
  @Validate((value) => (value as number) > 0 || "Price must be positive")
  @Validate((value) => (value as number) < 1000000 || "Price too high")
  declare price: number;

  // Transform quantity to integer then validate
  @Mutate((value) => Math.floor(value as number))
  @Validate((value) => (value as number) >= 0 || "Quantity cannot be negative")
  @Validate((value) => (value as number) <= 10000 || "Quantity exceeds maximum")
  declare quantity: number;
}
```

## NotNull Validation

The `@NotNull()` decorator ensures a field cannot be `null` or `undefined`:

```typescript
import { NotNull } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare email: string;

  @NotNull()
  @Validate((value) => (value as string).length >= 2 || "Name required")
  declare name: string;

  // Optional field (no @NotNull)
  declare bio: string;
}

// Valid - all required fields provided
const user1 = await User.create({
  id: "user-1",
  email: "john@example.com",
  name: "John Doe"
  // bio is optional
});

// Invalid - missing required field
try {
  await User.create({
    id: "user-2",
    name: "Jane Doe"
    // email is required (@NotNull)
  });
} catch (error) {
  console.error(error.message); // "Field 'email' cannot be null"
}
```

## Complex Validation Patterns

### Cross-Field Validation

Validate one field based on another field's value:

```typescript
class Event extends Table<Event> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  @Validate((value) => {
    const date = new Date(value as string);
    return !isNaN(date.getTime()) || "Invalid date format";
  })
  declare start_date: string;

  @Validate((value) => {
    const date = new Date(value as string);
    return !isNaN(date.getTime()) || "Invalid date format";
  })
  declare end_date: string;

  // Validate in constructor that end_date is after start_date
  constructor(data?: any) {
    super(data);

    if (data && data.start_date && data.end_date) {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);

      if (end <= start) {
        throw new Error("End date must be after start date");
      }
    }
  }
}

// Valid event
const event1 = await Event.create({
  name: "Conference",
  start_date: "2024-06-01",
  end_date: "2024-06-03"
});

// Invalid - end before start
try {
  await Event.create({
    name: "Conference",
    start_date: "2024-06-03",
    end_date: "2024-06-01"
  });
} catch (error) {
  console.error(error.message); // "End date must be after start date"
}
```

### Conditional Validation

Validate based on field values or application state:

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;

  @Validate((value) => (value as number) > 0 || "Total must be positive")
  declare total: number;

  @Default(() => "pending")
  declare status: CreationOptional<string>;

  // Validate tracking number only when status is 'shipped'
  @Validate(function(value) {
    const status = (this as any).status;
    if (status === "shipped" && !value) {
      return "Tracking number required when status is shipped";
    }
    return true;
  })
  declare tracking_number: string | null;
}
```

### Enum Validation

Validate that a value is one of allowed options:

```typescript
function validate_enum<T>(allowed_values: T[]) {
  return (value: any): boolean | string => {
    if (!allowed_values.includes(value as T)) {
      return `Value must be one of: ${allowed_values.join(', ')}`;
    }
    return true;
  };
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_enum(["customer", "premium", "admin"]))
  declare role: string;

  @Validate(validate_enum(["active", "inactive", "suspended"]))
  declare status: string;
}

// Valid
const user1 = await User.create({
  id: "user-1",
  role: "customer",
  status: "active"
});

// Invalid role
try {
  await User.create({
    id: "user-2",
    role: "superadmin",
    status: "active"
  });
} catch (error) {
  console.error(error.message);
  // "Value must be one of: customer, premium, admin"
}
```

### Range Validation

Create reusable range validators:

```typescript
function validate_range(min: number, max: number, field_name: string = "Value") {
  return (value: any): boolean | string => {
    const num = value as number;
    if (num < min) return `${field_name} must be at least ${min}`;
    if (num > max) return `${field_name} must be at most ${max}`;
    return true;
  };
}

class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_range(0.01, 999999.99, "Price"))
  declare price: number;

  @Validate(validate_range(0, 10000, "Quantity"))
  declare quantity: number;

  @Validate(validate_range(1, 5, "Rating"))
  declare rating: number;
}
```

## Complete Working Example

Here's a complete example demonstrating all validation patterns:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  Validate,
  Mutate,
  NotNull,
  CreatedAt,
  UpdatedAt,
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

// Custom validators
function validate_email(value: any): boolean | string {
  const email = value as string;
  const email_regex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  return email_regex.test(email) || "Invalid email format";
}

function validate_phone(value: any): boolean | string {
  const phone = value as string;
  const phone_regex = /^\+?[1-9]\d{1,14}$/;
  return phone_regex.test(phone) || "Invalid phone number (use E.164 format)";
}

function validate_password(value: any): boolean | string {
  const password = value as string;

  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain number";
  if (!/[!@#$%^&*]/.test(password)) return "Password must contain special character";

  return true;
}

function validate_range(min: number, max: number, name: string = "Value") {
  return (value: any): boolean | string => {
    const num = value as number;
    if (num < min) return `${name} must be at least ${min}`;
    if (num > max) return `${name} must be at most ${max}`;
    return true;
  };
}

function validate_enum<T>(values: T[]) {
  return (value: any): boolean | string => {
    if (!values.includes(value as T)) {
      return `Must be one of: ${values.join(', ')}`;
    }
    return true;
  };
}

// User model with comprehensive validation
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Name validation and transformation
  @NotNull()
  @Mutate((value) => (value as string).trim())
  @Validate((value) => (value as string).length >= 2 || "Name too short (min 2)")
  @Validate((value) => (value as string).length <= 50 || "Name too long (max 50)")
  @Validate((value) => /^[a-zA-Z\s]+$/.test(value as string) || "Name: letters and spaces only")
  declare name: string;

  // Email validation and transformation
  @NotNull()
  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate(validate_email)
  declare email: string;

  // Password validation
  @NotNull()
  @Validate(validate_password)
  declare password: string;

  // Phone validation and transformation
  @Mutate((value) => (value as string).replace(/[\s\-\(\)]/g, ''))
  @Validate(validate_phone)
  declare phone: string;

  // Age validation
  @Validate(validate_range(13, 120, "Age"))
  declare age: number;

  // Role validation with enum
  @Default(() => "customer")
  @Validate(validate_enum(["customer", "premium", "admin"]))
  declare role: CreationOptional<string>;

  // Status validation with enum
  @Default(() => "active")
  @Validate(validate_enum(["active", "inactive", "suspended"]))
  declare status: CreationOptional<string>;

  // Bio with length validation
  @Default(() => "")
  @Validate((value) => (value as string).length <= 500 || "Bio too long (max 500)")
  declare bio: CreationOptional<string>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Main application
async function main() {
  console.log("=== Data Validation Example ===\n");

  // 1. Valid user creation
  console.log("1. Creating valid user...");
  try {
    const user1 = await User.create({
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass123!",
      phone: "+14155552671",
      age: 25
    });
    console.log(`✓ Created: ${user1.name} (${user1.email})`);
    console.log(`  Phone: ${user1.phone}`);
    console.log(`  Role: ${user1.role}\n`);
  } catch (error: any) {
    console.error(`✗ Error: ${error.message}\n`);
  }

  // 2. Invalid name (too short)
  console.log("2. Testing invalid name (too short)...");
  try {
    await User.create({
      name: "J",
      email: "john@example.com",
      password: "SecurePass123!",
      phone: "+14155552671",
      age: 25
    });
    console.log("✓ User created\n");
  } catch (error: any) {
    console.error(`✗ Validation failed: ${error.message}\n`);
  }

  // 3. Invalid email format
  console.log("3. Testing invalid email format...");
  try {
    await User.create({
      name: "Jane Smith",
      email: "invalid-email",
      password: "SecurePass123!",
      phone: "+14155552671",
      age: 30
    });
    console.log("✓ User created\n");
  } catch (error: any) {
    console.error(`✗ Validation failed: ${error.message}\n`);
  }

  // 4. Invalid password (no special character)
  console.log("4. Testing weak password...");
  try {
    await User.create({
      name: "Bob Johnson",
      email: "bob@example.com",
      password: "weakpass123",
      phone: "+14155552671",
      age: 28
    });
    console.log("✓ User created\n");
  } catch (error: any) {
    console.error(`✗ Validation failed: ${error.message}\n`);
  }

  // 5. Invalid phone number
  console.log("5. Testing invalid phone number...");
  try {
    await User.create({
      name: "Alice Williams",
      email: "alice@example.com",
      password: "SecurePass123!",
      phone: "123",
      age: 22
    });
    console.log("✓ User created\n");
  } catch (error: any) {
    console.error(`✗ Validation failed: ${error.message}\n`);
  }

  // 6. Invalid age (too young)
  console.log("6. Testing invalid age (too young)...");
  try {
    await User.create({
      name: "Charlie Brown",
      email: "charlie@example.com",
      password: "SecurePass123!",
      phone: "+14155552671",
      age: 10
    });
    console.log("✓ User created\n");
  } catch (error: any) {
    console.error(`✗ Validation failed: ${error.message}\n`);
  }

  // 7. Invalid role
  console.log("7. Testing invalid role...");
  try {
    await User.create({
      name: "David Lee",
      email: "david@example.com",
      password: "SecurePass123!",
      phone: "+14155552671",
      age: 35,
      role: "superadmin" as any
    });
    console.log("✓ User created\n");
  } catch (error: any) {
    console.error(`✗ Validation failed: ${error.message}\n`);
  }

  // 8. Data transformation
  console.log("8. Testing data transformation...");
  try {
    const user2 = await User.create({
      name: "  emma WATSON  ",
      email: "  EMMA@EXAMPLE.COM  ",
      password: "SecurePass123!",
      phone: "(415) 555-2671",
      age: 27
    });
    console.log(`✓ Created: ${user2.name}`);
    console.log(`  Email (transformed): ${user2.email}`);
    console.log(`  Phone (transformed): ${user2.phone}\n`);
  } catch (error: any) {
    console.error(`✗ Error: ${error.message}\n`);
  }

  // 9. Multiple validation errors
  console.log("9. Testing multiple validation issues...");
  try {
    await User.create({
      name: "A",
      email: "bad-email",
      password: "weak",
      phone: "abc",
      age: 200
    });
    console.log("✓ User created\n");
  } catch (error: any) {
    console.error(`✗ First validation error: ${error.message}\n`);
  }

  // 10. Valid user with all optional fields
  console.log("10. Creating user with all optional fields...");
  try {
    const user3 = await User.create({
      name: "Frank Miller",
      email: "frank@example.com",
      password: "SecurePass123!",
      phone: "+14155552671",
      age: 40,
      role: "admin",
      status: "active",
      bio: "Experienced administrator with 10+ years in tech."
    });
    console.log(`✓ Created: ${user3.name}`);
    console.log(`  Role: ${user3.role}`);
    console.log(`  Status: ${user3.status}`);
    console.log(`  Bio: ${user3.bio}\n`);
  } catch (error: any) {
    console.error(`✗ Error: ${error.message}\n`);
  }

  console.log("=== Validation tests completed ===");
}

// Run the application
main().catch(console.error);
```

## Expected Output

```
=== Data Validation Example ===

1. Creating valid user...
✓ Created: John Doe (john@example.com)
  Phone: +14155552671
  Role: customer

2. Testing invalid name (too short)...
✗ Validation failed: Name too short (min 2)

3. Testing invalid email format...
✗ Validation failed: Invalid email format

4. Testing weak password...
✗ Validation failed: Password must contain special character

5. Testing invalid phone number...
✗ Validation failed: Invalid phone number (use E.164 format)

6. Testing invalid age (too young)...
✗ Validation failed: Age must be at least 13

7. Testing invalid role...
✗ Validation failed: Must be one of: customer, premium, admin

8. Testing data transformation...
✓ Created: Emma Watson
  Email (transformed): emma@example.com
  Phone (transformed): +14155552671

9. Testing multiple validation issues...
✗ First validation error: Name too short (min 2)

10. Creating user with all optional fields...
✓ Created: Frank Miller
  Role: admin
  Status: active
  Bio: Experienced administrator with 10+ years in tech.

=== Validation tests completed ===
```

## Best Practices

### 1. Validate Early and Fail Fast

```typescript
// Good - validate immediately on creation
@Validate((value) => (value as string).length > 0 || "Name required")
declare name: string;

// Bad - validating in business logic later
async function create_user(name: string) {
  if (name.length === 0) throw new Error("Name required");
  // ...
}
```

### 2. Use Mutate Before Validate

```typescript
// Good - transform then validate
@Mutate((value) => (value as string).trim().toLowerCase())
@Validate((value) => /^[a-z0-9]+$/.test(value as string) || "Invalid format")
declare username: string;

// Bad - validating before transformation
@Validate((value) => /^[a-z0-9]+$/.test(value as string) || "Invalid format")
@Mutate((value) => (value as string).trim().toLowerCase())
declare username: string;
```

### 3. Create Reusable Validators

```typescript
// Good - reusable validator
const validate_email = (value: any) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string) || "Invalid email";

class User extends Table<User> {
  @Validate(validate_email)
  declare email: string;
}

class Contact extends Table<Contact> {
  @Validate(validate_email)
  declare email: string;
}

// Bad - duplicating validation logic
class User extends Table<User> {
  @Validate((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string) || "Invalid email")
  declare email: string;
}
```

### 4. Provide Clear Error Messages

```typescript
// Good - specific error messages
@Validate((value) => (value as string).length >= 8 || "Password must be at least 8 characters")
@Validate((value) => /[A-Z]/.test(value as string) || "Password must contain uppercase letter")
@Validate((value) => /[0-9]/.test(value as string) || "Password must contain number")
declare password: string;

// Bad - vague error messages
@Validate((value) => (value as string).length >= 8 || "Invalid password")
@Validate((value) => /[A-Z]/.test(value as string) || "Invalid password")
declare password: string;
```

### 5. Use NotNull for Required Fields

```typescript
// Good - explicitly mark required fields
@NotNull()
@Validate(validate_email)
declare email: string;

// Bad - implicit requirement through validation only
@Validate((value) => value ? validate_email(value) : "Email required")
declare email: string;
```

## Common Validation Patterns

### Credit Card Validation

```typescript
function validate_credit_card(value: any): boolean | string {
  const card = (value as string).replace(/\s/g, '');

  if (!/^\d{13,19}$/.test(card)) {
    return "Credit card must be 13-19 digits";
  }

  // Luhn algorithm
  let sum = 0;
  let double = false;
  for (let i = card.length - 1; i >= 0; i--) {
    let digit = parseInt(card[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  return sum % 10 === 0 || "Invalid credit card number";
}

class Payment extends Table<Payment> {
  @PrimaryKey()
  declare id: string;

  @Mutate((value) => (value as string).replace(/\s/g, ''))
  @Validate(validate_credit_card)
  declare card_number: string;
}
```

### Username Validation

```typescript
function validate_username(value: any): boolean | string {
  const username = value as string;

  if (username.length < 3) return "Username too short (min 3)";
  if (username.length > 20) return "Username too long (max 20)";
  if (!/^[a-z0-9_]+$/.test(username)) {
    return "Username: lowercase, numbers, underscore only";
  }
  if (/^\d/.test(username)) {
    return "Username cannot start with number";
  }
  if (username.startsWith('_') || username.endsWith('_')) {
    return "Username cannot start/end with underscore";
  }

  return true;
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate(validate_username)
  declare username: string;
}
```

### Date Validation

```typescript
function validate_future_date(value: any): boolean | string {
  const date = new Date(value as string);
  if (isNaN(date.getTime())) return "Invalid date format";
  if (date <= new Date()) return "Date must be in the future";
  return true;
}

function validate_past_date(value: any): boolean | string {
  const date = new Date(value as string);
  if (isNaN(date.getTime())) return "Invalid date format";
  if (date >= new Date()) return "Date must be in the past";
  return true;
}

class Event extends Table<Event> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_future_date)
  declare event_date: string;
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_past_date)
  declare birth_date: string;
}
```

## Next Steps

### Related Documentation

- [Basic Model Example](./basic-model.md) - Simple CRUD operations
- [Relationships Example](./relationships.md) - One-to-many and many-to-one relationships
- [Advanced Queries Example](./advanced-queries.md) - Complex queries and filtering

### API References

- [Decorators Guide](../guides/decorators.md) - All available decorators
- [Table API](../api/table.md) - Complete Table class documentation
- [Core Concepts](../guides/core-concepts.md) - Core concepts and patterns

### Additional Topics

- **Custom Error Handling** - Build custom validation error classes
- **Async Validators** - Validate against external APIs or databases
- **Field Dependencies** - Validate based on multiple field values
- **Dynamic Validation** - Change validation rules at runtime

Happy validating with Dynamite!
