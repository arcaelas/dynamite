# Ejemplo de Validación de Datos

Este ejemplo completo demuestra patrones de validación y transformación de datos en Dynamite ORM. Aprende cómo validar entrada de usuario, transformar datos, crear validadores personalizados y construir modelos robustos con integridad de datos.

## Tabla de Contenidos

- [Validación Básica](#validación-básica)
- [Transformación de Datos con Mutate](#transformación-de-datos-con-mutate)
- [Validadores Personalizados](#validadores-personalizados)
- [Encadenamiento de Validadores](#encadenamiento-de-validadores)
- [Validación NotNull](#validación-notnull)
- [Patrones de Validación Complejos](#patrones-de-validación-complejos)
- [Ejemplo Completo Funcional](#ejemplo-completo-funcional)
- [Salida Esperada](#salida-esperada)
- [Mejores Prácticas](#mejores-prácticas)
- [Patrones de Validación Comunes](#patrones-de-validación-comunes)

## Validación Básica

El decorador `@Validate()` te permite definir reglas de validación para campos del modelo. Los validadores devuelven `true` para datos válidos o un mensaje de error string para datos inválidos.

### Validación Simple

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

  // Validar longitud del nombre
  @Validate((value) => {
    const name = value as string;
    return name.length >= 2 || "Name must be at least 2 characters";
  })
  declare name: string;

  // Validar formato de email
  @Validate((value) => {
    const email = value as string;
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email_regex.test(email) || "Invalid email format";
  })
  declare email: string;

  // Validar rango de edad
  @Validate((value) => {
    const age = value as number;
    if (age < 0) return "Age cannot be negative";
    if (age > 150) return "Age must be realistic";
    return true;
  })
  declare age: number;
}
```

### Uso

```typescript
// Datos válidos
const user1 = await User.create({
  name: "John Doe",
  email: "john@example.com",
  age: 25
});
console.log("User created successfully");

// Nombre inválido (muy corto)
try {
  await User.create({
    name: "J",
    email: "john@example.com",
    age: 25
  });
} catch (error) {
  console.error(error.message); // "Name must be at least 2 characters"
}

// Formato de email inválido
try {
  await User.create({
    name: "John Doe",
    email: "invalid-email",
    age: 25
  });
} catch (error) {
  console.error(error.message); // "Invalid email format"
}

// Edad inválida (negativa)
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

## Transformación de Datos con Mutate

El decorador `@Mutate()` transforma datos antes de que se validen o almacenen. **Importante: Mutate siempre se ejecuta antes que Validate.**

### Transformación Básica

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Transformar email a minúsculas y eliminar espacios en blanco
  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate((value) => {
    const email = value as string;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || "Invalid email";
  })
  declare email: string;

  // Recortar y capitalizar nombre
  @Mutate((value) => {
    const name = value as string;
    return name.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  })
  declare name: string;

  // Redondear edad a entero
  @Mutate((value) => Math.round(value as number))
  @Validate((value) => (value as number) >= 0 || "Age must be positive")
  declare age: number;
}
```

### Uso

```typescript
const user = await User.create({
  name: "  john DOE  ",
  email: "  JOHN@EXAMPLE.COM  ",
  age: 25.7
});

console.log(user.name);  // "John Doe" (transformado)
console.log(user.email); // "john@example.com" (transformado)
console.log(user.age);   // 26 (redondeado)
```

## Validadores Personalizados

Crea funciones de validación reutilizables para patrones comunes:

### Validador de Email

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

### Validador de Fuerza de Contraseña

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

### Validador de URL

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

### Validador de Número de Teléfono

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

## Encadenamiento de Validadores

Puedes aplicar múltiples validadores a un solo campo. **Los validadores se ejecutan en orden de arriba a abajo.**

### Múltiples Reglas de Validación

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Múltiples validadores para nombre
  @Validate((value) => (value as string).length >= 2 || "Name too short (min 2)")
  @Validate((value) => (value as string).length <= 50 || "Name too long (max 50)")
  @Validate((value) => /^[a-zA-Z\s]+$/.test(value as string) || "Name can only contain letters and spaces")
  declare name: string;

  // Múltiples validadores para nombre de usuario
  @Validate((value) => (value as string).length >= 3 || "Username too short (min 3)")
  @Validate((value) => (value as string).length <= 20 || "Username too long (max 20)")
  @Validate((value) => /^[a-z0-9_]+$/.test(value as string) || "Username can only contain lowercase letters, numbers, and underscores")
  @Validate((value) => !/^\d/.test(value as string) || "Username cannot start with a number")
  declare username: string;
}
```

### Encadenamiento de Mutate y Validate

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Transformar luego validar
  @Mutate((value) => (value as string).trim())
  @Mutate((value) => (value as string).toLowerCase())
  @Validate((value) => (value as string).length >= 3 || "Product name too short")
  @Validate((value) => (value as string).length <= 100 || "Product name too long")
  declare name: string;

  // Redondear luego validar precio
  @Mutate((value) => Math.round((value as number) * 100) / 100)
  @Validate((value) => (value as number) > 0 || "Price must be positive")
  @Validate((value) => (value as number) < 1000000 || "Price too high")
  declare price: number;

  // Transformar cantidad a entero luego validar
  @Mutate((value) => Math.floor(value as number))
  @Validate((value) => (value as number) >= 0 || "Quantity cannot be negative")
  @Validate((value) => (value as number) <= 10000 || "Quantity exceeds maximum")
  declare quantity: number;
}
```

## Validación NotNull

El decorador `@NotNull()` asegura que un campo no pueda ser `null` o `undefined`:

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

  // Campo opcional (sin @NotNull)
  declare bio: string;
}

// Válido - todos los campos requeridos proporcionados
const user1 = await User.create({
  id: "user-1",
  email: "john@example.com",
  name: "John Doe"
  // bio es opcional
});

// Inválido - falta campo requerido
try {
  await User.create({
    id: "user-2",
    name: "Jane Doe"
    // email es requerido (@NotNull)
  });
} catch (error) {
  console.error(error.message); // "Field 'email' cannot be null"
}
```

## Patrones de Validación Complejos

### Validación de Campos Cruzados

Validar un campo basado en el valor de otro campo:

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

  // Validar en el constructor que end_date es posterior a start_date
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

// Evento válido
const event1 = await Event.create({
  name: "Conference",
  start_date: "2024-06-01",
  end_date: "2024-06-03"
});

// Inválido - fin antes del inicio
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

### Validación Condicional

Validar basado en valores de campo o estado de aplicación:

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

  // Validar tracking number solo cuando el estado es 'shipped'
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

### Validación de Enumeración

Validar que un valor es una de las opciones permitidas:

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

// Válido
const user1 = await User.create({
  id: "user-1",
  role: "customer",
  status: "active"
});

// Rol inválido
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

### Validación de Rango

Crear validadores de rango reutilizables:

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

## Ejemplo Completo Funcional

Aquí hay un ejemplo completo que demuestra todos los patrones de validación:

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

// Configurar DynamoDB
Dynamite.config({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Validadores personalizados
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

// Modelo User con validación completa
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Validación y transformación de nombre
  @NotNull()
  @Mutate((value) => (value as string).trim())
  @Validate((value) => (value as string).length >= 2 || "Name too short (min 2)")
  @Validate((value) => (value as string).length <= 50 || "Name too long (max 50)")
  @Validate((value) => /^[a-zA-Z\s]+$/.test(value as string) || "Name: letters and spaces only")
  declare name: string;

  // Validación y transformación de email
  @NotNull()
  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate(validate_email)
  declare email: string;

  // Validación de contraseña
  @NotNull()
  @Validate(validate_password)
  declare password: string;

  // Validación y transformación de teléfono
  @Mutate((value) => (value as string).replace(/[\s\-\(\)]/g, ''))
  @Validate(validate_phone)
  declare phone: string;

  // Validación de edad
  @Validate(validate_range(13, 120, "Age"))
  declare age: number;

  // Validación de rol con enumeración
  @Default(() => "customer")
  @Validate(validate_enum(["customer", "premium", "admin"]))
  declare role: CreationOptional<string>;

  // Validación de estado con enumeración
  @Default(() => "active")
  @Validate(validate_enum(["active", "inactive", "suspended"]))
  declare status: CreationOptional<string>;

  // Bio con validación de longitud
  @Default(() => "")
  @Validate((value) => (value as string).length <= 500 || "Bio too long (max 500)")
  declare bio: CreationOptional<string>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Aplicación principal
async function main() {
  console.log("=== Data Validation Example ===\n");

  // 1. Creación de usuario válido
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

  // 2. Nombre inválido (muy corto)
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

  // 3. Formato de email inválido
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

  console.log("=== Validation tests completed ===");
}

// Ejecutar la aplicación
main().catch(console.error);
```

## Salida Esperada

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

=== Validation tests completed ===
```

## Mejores Prácticas

### 1. Validar Temprano y Fallar Rápido

```typescript
// Bueno - validar inmediatamente en la creación
@Validate((value) => (value as string).length > 0 || "Name required")
declare name: string;

// Malo - validar en la lógica de negocio más tarde
async function create_user(name: string) {
  if (name.length === 0) throw new Error("Name required");
  // ...
}
```

### 2. Usar Mutate Antes de Validate

```typescript
// Bueno - transformar luego validar
@Mutate((value) => (value as string).trim().toLowerCase())
@Validate((value) => /^[a-z0-9]+$/.test(value as string) || "Invalid format")
declare username: string;

// Malo - validar antes de la transformación
@Validate((value) => /^[a-z0-9]+$/.test(value as string) || "Invalid format")
@Mutate((value) => (value as string).trim().toLowerCase())
declare username: string;
```

### 3. Crear Validadores Reutilizables

```typescript
// Bueno - validador reutilizable
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

// Malo - duplicar lógica de validación
class User extends Table<User> {
  @Validate((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string) || "Invalid email")
  declare email: string;
}
```

### 4. Proporcionar Mensajes de Error Claros

```typescript
// Bueno - mensajes de error específicos
@Validate((value) => (value as string).length >= 8 || "Password must be at least 8 characters")
@Validate((value) => /[A-Z]/.test(value as string) || "Password must contain uppercase letter")
@Validate((value) => /[0-9]/.test(value as string) || "Password must contain number")
declare password: string;

// Malo - mensajes de error vagos
@Validate((value) => (value as string).length >= 8 || "Invalid password")
@Validate((value) => /[A-Z]/.test(value as string) || "Invalid password")
declare password: string;
```

### 5. Usar NotNull para Campos Requeridos

```typescript
// Bueno - marcar explícitamente campos requeridos
@NotNull()
@Validate(validate_email)
declare email: string;

// Malo - requisito implícito solo a través de validación
@Validate((value) => value ? validate_email(value) : "Email required")
declare email: string;
```

## Patrones de Validación Comunes

### Validación de Tarjeta de Crédito

```typescript
function validate_credit_card(value: any): boolean | string {
  const card = (value as string).replace(/\s/g, '');

  if (!/^\d{13,19}$/.test(card)) {
    return "Credit card must be 13-19 digits";
  }

  // Algoritmo Luhn
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

### Validación de Nombre de Usuario

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

### Validación de Fecha

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

## Próximos Pasos

### Documentación Relacionada

- [Ejemplo de Modelo Básico](./basic-model.es.md) - Operaciones CRUD simples
- [Ejemplo de Relaciones](./relationships.es.md) - Relaciones uno-a-muchos y muchos-a-uno
- [Ejemplo de Consultas Avanzadas](./advanced-queries.es.md) - Consultas complejas y filtrado

### Referencias de API

- [Guía de Decoradores](../guides/decorators.md) - Todos los decoradores disponibles
- [API de Table](../api/table.md) - Documentación completa de la clase Table
- [Conceptos Básicos](../guides/core-concepts.md) - Conceptos y patrones básicos

¡Feliz validación con Dynamite!
