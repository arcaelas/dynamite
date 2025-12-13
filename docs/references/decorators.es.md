# Guía Completa de Decoradores en Dynamite

Esta guía proporciona documentación exhaustiva sobre todos los decoradores disponibles en Dynamite ORM, incluyendo ejemplos prácticos, patrones comunes y mejores prácticas.

## Tabla de Contenidos

1. [Introduccion a los Decoradores](#introduccion-a-los-decoradores)
2. [@PrimaryKey - Claves Primarias](#primarykey-claves-primarias)
3. [@Index - Configuracion de GSI](#index-configuracion-de-gsi)
4. [@IndexSort - Configuracion de LSI](#indexsort-configuracion-de-lsi)
5. [@Default - Valores por Defecto](#default-valores-por-defecto)
6. [@Validate - Funciones de Validacion](#validate-funciones-de-validacion)
7. [@Mutate - Transformacion de Datos](#mutate-transformacion-de-datos)
8. [@Serialize - Transformacion Bidireccional](#serialize-transformacion-bidireccional)
9. [@NotNull - Campos Requeridos](#notnull-campos-requeridos)
10. [@CreatedAt - Timestamp de Creacion](#createdat-timestamp-de-creacion)
11. [@UpdatedAt - Timestamp de Actualizacion](#updatedat-timestamp-de-actualizacion)
12. [@DeleteAt - Soft Delete](#deleteat-soft-delete)
13. [@Name - Nombres Personalizados](#name-nombres-personalizados)
14. [@HasMany - Relaciones Uno a Muchos](#hasmany-relaciones-uno-a-muchos)
15. [@BelongsTo - Relaciones Muchos a Uno](#belongsto-relaciones-muchos-a-uno)
16. [Combinando Multiples Decoradores](#combinando-multiples-decoradores)
17. [Patrones de Decoradores Personalizados](#patrones-de-decoradores-personalizados)
18. [Mejores Practicas](#mejores-practicas)

---

## Introducción a los Decoradores

Los decoradores en Dynamite son funciones especiales que añaden metadatos y comportamiento a las clases y propiedades. Permiten definir esquemas de base de datos de manera declarativa y type-safe.

### Conceptos Básicos

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Decorador de clave primaria
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Campo simple sin decoradores
  declare name: string;

  // Campo con valor por defecto
  @Default(() => "customer")
  declare role: CreationOptional<string>;
}
```

### Tipos de Decoradores

**Decoradores de Clave:**
- `@PrimaryKey()` - Define la clave primaria
- `@Index()` - Define partition key (GSI)
- `@IndexSort()` - Define sort key (LSI)

**Decoradores de Datos:**
- `@Default()` - Establece valores por defecto
- `@Mutate()` - Transforma valores antes de guardar
- `@Serialize()` - Transforma valores bidireccionalmente (DB ↔ App)
- `@Validate()` - Valida valores antes de guardar
- `@NotNull()` - Marca campos como requeridos

**Decoradores de Timestamp:**
- `@CreatedAt()` - Auto-timestamp en creación
- `@UpdatedAt()` - Auto-timestamp en actualización
- `@DeleteAt()` - Soft delete con timestamp

**Decoradores de Relaciones:**
- `@HasMany()` - Relación uno a muchos
- `@BelongsTo()` - Relación muchos a uno

**Decoradores de Configuración:**
- `@Name()` - Nombres personalizados para tablas/columnas

---

## @PrimaryKey - Claves Primarias

El decorador `@PrimaryKey` define la clave primaria de la tabla. Internamente aplica `@Index` y `@IndexSort` automáticamente.

### Sintaxis

```typescript
@PrimaryKey(name?: string): PropertyDecorator
```

### Clave Primaria Simple

```typescript
import { Table, PrimaryKey, CreationOptional, Default } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;
}

// Uso
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
  // id es opcional (CreationOptional) y se genera automáticamente
});

console.log(user.id); // "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### Clave Primaria con Valor Estático

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare sku: string;

  declare name: string;
  declare price: number;
}

// Uso
const product = await Product.create({
  sku: "PROD-001",
  name: "Widget",
  price: 29.99
});
```

### Clave Primaria Compuesta (Partition + Sort)

Aunque `@PrimaryKey` aplica ambos decoradores, puedes definir claves compuestas manualmente:

```typescript
class Order extends Table<Order> {
  @Index()
  declare user_id: string;

  @IndexSort()
  declare order_date: string;

  declare total: number;
  declare status: string;
}

// Uso
const order = await Order.create({
  user_id: "user-123",
  order_date: new Date().toISOString(),
  total: 99.99,
  status: "pending"
});

// Consultas por partition key
const user_orders = await Order.where({ user_id: "user-123" });

// Consultas con sort key
const recent_orders = await Order.where({ user_id: "user-123" }, {
  order: "DESC",
  limit: 10
});
```

### Características Importantes

```typescript
class Account extends Table<Account> {
  @PrimaryKey()
  declare account_id: string;
  // Automáticamente:
  // - Marcado como @Index (partition key)
  // - Marcado como @IndexSort (sort key)
  // - nullable = false (no puede ser nulo)
  // - primaryKey = true en metadatos
}
```

---

## @Index - Configuración de GSI

El decorador `@Index` marca una propiedad como **Partition Key** (clave de partición). Es fundamental para consultas eficientes en DynamoDB.

### Sintaxis

```typescript
@Index(): PropertyDecorator
```

### Índice Simple

```typescript
class Customer extends Table<Customer> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Index()
  declare email: string;

  declare name: string;
  declare phone: string;
}

// Consultas por email (partition key)
const customers = await Customer.where({ email: "john@example.com" });
```

### Global Secondary Index (GSI)

```typescript
class Article extends Table<Article> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Index()
  declare category: string;

  @Index()
  declare author_id: string;

  declare title: string;
  declare content: string;
  declare published_at: string;
}

// Consultas por categoría
const tech_articles = await Article.where({ category: "technology" });

// Consultas por autor
const author_articles = await Article.where({ author_id: "author-123" });
```

### Validaciones del Decorador

```typescript
class InvalidModel extends Table<InvalidModel> {
  @Index()
  declare field1: string;

  @Index() // Error: Solo puede haber un @Index por tabla
  declare field2: string;
  // Lanza: "La tabla invalid_models ya tiene definida una PartitionKey"
}
```

---

## @IndexSort - Configuración de LSI

El decorador `@IndexSort` marca una propiedad como **Sort Key** (clave de ordenación). Requiere que exista una Partition Key definida.

### Sintaxis

```typescript
@IndexSort(): PropertyDecorator
```

### Sort Key Básico

```typescript
class Message extends Table<Message> {
  @Index()
  declare conversation_id: string;

  @IndexSort()
  declare timestamp: string;

  declare sender_id: string;
  declare content: string;
}

// Crear mensajes
await Message.create({
  conversation_id: "conv-123",
  timestamp: "2025-01-15T10:30:00Z",
  sender_id: "user-1",
  content: "Hello!"
});

// Consultas ordenadas por timestamp
const messages = await Message.where({ conversation_id: "conv-123" }, {
  order: "ASC" // Orden ascendente por timestamp
});

// Mensajes más recientes
const recent = await Message.where({ conversation_id: "conv-123" }, {
  order: "DESC",
  limit: 20
});
```

### Rango de Consultas con Sort Key

```typescript
class Event extends Table<Event> {
  @Index()
  declare venue_id: string;

  @IndexSort()
  declare event_date: string;

  declare name: string;
  declare capacity: number;
}

// Eventos en un rango de fechas
const upcoming = await Event.where("event_date", ">=", "2025-01-01");
const past = await Event.where("event_date", "<", "2025-01-01");
```

### Local Secondary Index (LSI)

```typescript
class Transaction extends Table<Transaction> {
  @Index()
  declare account_id: string;

  @IndexSort()
  declare transaction_date: string;

  declare amount: number;
  declare type: string;
  declare description: string;
}

// Transacciones de una cuenta ordenadas por fecha
const transactions = await Transaction.where({ account_id: "acc-123" }, {
  order: "DESC",
  limit: 50
});

// Últimas transacciones
const last_transaction = await Transaction.last({ account_id: "acc-123" });
```

### Validaciones

```typescript
class InvalidSort extends Table<InvalidSort> {
  @IndexSort() // Error: Se requiere @Index primero
  declare date: string;
  // Lanza: "No se puede definir una SortKey sin una PartitionKey"
}

class DuplicateSort extends Table<DuplicateSort> {
  @Index()
  declare id: string;

  @IndexSort()
  declare date1: string;

  @IndexSort() // Error: Solo un @IndexSort permitido
  declare date2: string;
  // Lanza: "La tabla ya tiene una SortKey definida"
}
```

---

## @Default - Valores por Defecto

El decorador `@Default` establece valores por defecto estáticos o dinámicos para propiedades.

### Sintaxis

```typescript
@Default(value: any | (() => any)): PropertyDecorator
```

### Valores Estáticos

```typescript
class Settings extends Table<Settings> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Default("dark")
  declare theme: CreationOptional<string>;

  @Default(true)
  declare notifications: CreationOptional<boolean>;

  @Default(100)
  declare volume: CreationOptional<number>;

  @Default([])
  declare tags: CreationOptional<string[]>;
}

// Uso
const settings = await Settings.create({}); // Todos los campos opcionales
console.log(settings.theme); // "dark"
console.log(settings.notifications); // true
console.log(settings.volume); // 100
console.log(settings.tags); // []
```

### Valores Dinámicos (Funciones)

```typescript
class Document extends Table<Document> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Default(() => new Date().toISOString())
  declare created: CreationOptional<string>;

  @Default(() => `DOC-${Date.now()}`)
  declare code: CreationOptional<string>;

  @Default(() => Math.floor(Math.random() * 1000000))
  declare reference_number: CreationOptional<number>;
}

// Cada instancia obtiene valores únicos
const doc1 = await Document.create({});
const doc2 = await Document.create({});

console.log(doc1.id !== doc2.id); // true
console.log(doc1.code !== doc2.code); // true
```

### Valores por Defecto Complejos

```typescript
class UserProfile extends Table<UserProfile> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @Default(() => ({
    theme: "light",
    language: "en",
    timezone: "UTC"
  }))
  declare preferences: CreationOptional<Record<string, string>>;

  @Default(() => ({
    email: true,
    sms: false,
    push: true
  }))
  declare notifications: CreationOptional<Record<string, boolean>>;

  @Default(() => [])
  declare recent_searches: CreationOptional<string[]>;
}

// Uso
const profile = await UserProfile.create({});
console.log(profile.preferences); // { theme: "light", language: "en", ... }
console.log(profile.notifications); // { email: true, sms: false, push: true }
```

### Combinando con CreationOptional

```typescript
import { CreationOptional } from "@arcaelas/dynamite";

class Task extends Table<Task> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string; // Requerido

  @Default(() => "pending")
  declare status: CreationOptional<string>; // Opcional

  @Default(() => false)
  declare completed: CreationOptional<boolean>; // Opcional

  @Default(() => new Date().toISOString())
  declare due_date: CreationOptional<string>; // Opcional
}

// Solo title es requerido
const task = await Task.create({ title: "Complete project" });
console.log(task.status); // "pending"
console.log(task.completed); // false
```

---

## @Validate - Funciones de Validación

El decorador `@Validate` permite definir funciones de validación personalizadas que se ejecutan antes de guardar datos.

### Sintaxis

```typescript
@Validate(validator: (value: unknown) => true | string): PropertyDecorator
@Validate(validators: Array<(value: unknown) => true | string>): PropertyDecorator
```

### Validación Simple

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Validate((value) => {
    const email = value as string;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || "Email inválido";
  })
  declare email: string;

  @Validate((value) => {
    const age = value as number;
    return age >= 18 || "Debe ser mayor de edad";
  })
  declare age: number;
}

// Válido
const user1 = await User.create({
  id: "user-1",
  email: "john@example.com",
  age: 25
});

// Inválido - lanza error
try {
  await User.create({
    id: "user-2",
    email: "invalid-email",
    age: 25
  });
} catch (error) {
  console.error(error.message); // "Email inválido"
}
```

### Múltiples Validadores

```typescript
class Password extends Table<Password> {
  @PrimaryKey()
  declare user_id: string;

  @Validate([
    (v) => (v as string).length >= 8 || "Mínimo 8 caracteres",
    (v) => /[A-Z]/.test(v as string) || "Debe contener mayúscula",
    (v) => /[a-z]/.test(v as string) || "Debe contener minúscula",
    (v) => /[0-9]/.test(v as string) || "Debe contener número",
    (v) => /[^A-Za-z0-9]/.test(v as string) || "Debe contener símbolo"
  ])
  declare password: string;
}

// Todas las validaciones deben pasar
try {
  await Password.create({
    user_id: "user-1",
    password: "weak"
  });
} catch (error) {
  console.error(error.message); // "Mínimo 8 caracteres"
}

// Válido
await Password.create({
  user_id: "user-1",
  password: "Str0ng!Pass"
});
```

### Validaciones Complejas

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare sku: string;

  @Validate((value) => {
    const price = value as number;
    if (price < 0) return "El precio no puede ser negativo";
    if (price > 999999.99) return "El precio es demasiado alto";
    if (!/^\d+(\.\d{1,2})?$/.test(price.toString())) {
      return "El precio debe tener máximo 2 decimales";
    }
    return true;
  })
  declare price: number;

  @Validate((value) => {
    const stock = value as number;
    return Number.isInteger(stock) && stock >= 0 || "Stock debe ser entero positivo";
  })
  declare stock: number;

  @Validate((value) => {
    const url = value as string;
    try {
      new URL(url);
      return true;
    } catch {
      return "URL inválida";
    }
  })
  declare image_url: string;
}
```

### Validaciones con Contexto

```typescript
class DateRange extends Table<DateRange> {
  @PrimaryKey()
  declare id: string;

  declare start_date: string;

  @Validate(function(value) {
    const end = new Date(value as string);
    const start = new Date(this.start_date);
    return end > start || "La fecha final debe ser posterior a la inicial";
  })
  declare end_date: string;
}
```

---

## @Mutate - Transformación de Datos

El decorador `@Mutate` transforma valores antes de guardarlos en la base de datos.

### Sintaxis

```typescript
@Mutate(transformer: (value: any) => any): PropertyDecorator
```

### Transformaciones Básicas

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((v) => (v as string).toLowerCase().trim())
  declare email: string;

  @Mutate((v) => (v as string).trim())
  @Mutate((v) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase())
  declare name: string;

  @Mutate((v) => (v as string).replace(/\D/g, ""))
  declare phone: string;
}

// Uso
const user = await User.create({
  id: "user-1",
  email: "  JOHN@EXAMPLE.COM  ",
  name: "  jOhN dOe  ",
  phone: "+1 (555) 123-4567"
});

console.log(user.email); // "john@example.com"
console.log(user.name); // "John doe"
console.log(user.phone); // "15551234567"
```

### Transformaciones Múltiples

Las mutaciones se ejecutan en orden de declaración:

```typescript
class Article extends Table<Article> {
  @PrimaryKey()
  declare id: string;

  @Mutate((v) => (v as string).trim())
  @Mutate((v) => (v as string).replace(/\s+/g, " "))
  @Mutate((v) => (v as string).substring(0, 200))
  declare title: string;

  @Mutate((v) => (v as string).trim())
  @Mutate((v) => (v as string).replace(/<[^>]*>/g, ""))
  @Mutate((v) => (v as string).substring(0, 5000))
  declare content: string;
}
```

### Transformaciones Numéricas

```typescript
class Financial extends Table<Financial> {
  @PrimaryKey()
  declare transaction_id: string;

  @Mutate((v) => Math.round((v as number) * 100) / 100)
  declare amount: number;

  @Mutate((v) => Math.max(0, Math.min(100, v as number)))
  declare percentage: number;

  @Mutate((v) => Math.abs(v as number))
  declare quantity: number;
}

// Uso
const transaction = await Financial.create({
  transaction_id: "txn-1",
  amount: 123.456789,
  percentage: 150,
  quantity: -10
});

console.log(transaction.amount); // 123.46
console.log(transaction.percentage); // 100
console.log(transaction.quantity); // 10
```

### Transformaciones de Objetos

```typescript
class Settings extends Table<Settings> {
  @PrimaryKey()
  declare user_id: string;

  @Mutate((v) => {
    const config = v as Record<string, any>;
    return Object.keys(config).reduce((acc, key) => {
      acc[key.toLowerCase()] = config[key];
      return acc;
    }, {} as Record<string, any>);
  })
  declare preferences: Record<string, any>;

  @Mutate((v) => Array.from(new Set(v as string[])))
  declare tags: string[];
}
```

---

## @Serialize - Transformación Bidireccional

El decorador `@Serialize` permite transformar valores en ambas direcciones: al leer de la base de datos y al guardar. A diferencia de `@Mutate` (solo escritura), `@Serialize` maneja la conversión completa del ciclo de datos.

### Sintaxis

```typescript
@Serialize(fromDB: ((value: any) => any) | null, toDB?: ((value: any) => any) | null): PropertyDecorator
```

### Parámetros

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `fromDB` | `Function \| null` | Transforma el valor al leer de la base de datos. Usa `null` para omitir. |
| `toDB` | `Function \| null` | Transforma el valor al guardar en la base de datos. Usa `null` para omitir. |

### Transformación Bidireccional

```typescript
import { Serialize } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // Boolean almacenado como número en DynamoDB
  @Serialize(
    (from) => from === 1,     // DB: 1 → App: true
    (to) => to ? 1 : 0        // App: true → DB: 1
  )
  declare active: boolean;

  // JSON almacenado como string
  @Serialize(
    (from) => JSON.parse(from),           // DB: '{"a":1}' → App: {a:1}
    (to) => JSON.stringify(to)            // App: {a:1} → DB: '{"a":1}'
  )
  declare metadata: Record<string, any>;
}

// Uso
const user = await User.create({
  id: "user-1",
  active: true,        // Se guarda como 1 en DynamoDB
  metadata: { role: "admin" }  // Se guarda como '{"role":"admin"}'
});

// Al leer
const fetched = await User.first({ id: "user-1" });
console.log(fetched.active);   // true (no 1)
console.log(fetched.metadata); // { role: "admin" } (no string)
```

### Solo Transformar al Guardar

Usa `null` como primer parámetro para omitir la transformación al leer:

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare sku: string;

  // Solo normalizar al guardar, no transformar al leer
  @Serialize(null, (to) => (to as string).toUpperCase().trim())
  declare code: string;
}

// El código se guarda en mayúsculas
await Product.create({ sku: "prod-1", code: "  abc123  " });
// En DB: code = "ABC123"
```

### Solo Transformar al Leer

Omite el segundo parámetro o usa `null` para solo transformar al leer:

```typescript
class Settings extends Table<Settings> {
  @PrimaryKey()
  declare user_id: string;

  // Parse JSON solo al leer (se guarda como string directamente)
  @Serialize((from) => JSON.parse(from))
  declare preferences: Record<string, any>;

  // Convertir timestamp a Date solo al leer
  @Serialize((from) => new Date(from), null)
  declare last_login: Date;
}
```

### Casos de Uso Comunes

#### Encriptación de Datos Sensibles

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString();
}

class UserSecret extends Table<UserSecret> {
  @PrimaryKey()
  declare user_id: string;

  @Serialize(decrypt, encrypt)
  declare api_key: string;

  @Serialize(decrypt, encrypt)
  declare secret_token: string;
}
```

#### Compresión de Datos

```typescript
import { gzipSync, gunzipSync } from "zlib";

class Document extends Table<Document> {
  @PrimaryKey()
  declare id: string;

  @Serialize(
    (from) => gunzipSync(Buffer.from(from, "base64")).toString(),
    (to) => gzipSync(to).toString("base64")
  )
  declare content: string;
}
```

#### Conversión de Tipos DynamoDB

```typescript
class Analytics extends Table<Analytics> {
  @PrimaryKey()
  declare event_id: string;

  // Set de DynamoDB a Array de JavaScript
  @Serialize(
    (from) => Array.from(from),           // Set → Array
    (to) => new Set(to)                   // Array → Set
  )
  declare tags: string[];

  // BigInt para números grandes
  @Serialize(
    (from) => BigInt(from),
    (to) => to.toString()
  )
  declare large_number: bigint;
}
```

### Diferencias con @Mutate

| Característica | @Mutate | @Serialize |
|----------------|---------|------------|
| Dirección | Solo al guardar | Bidireccional |
| Parámetros | Una función | Dos funciones (fromDB, toDB) |
| Caso de uso | Normalización | Conversión de tipos |

```typescript
class Example extends Table<Example> {
  @PrimaryKey()
  declare id: string;

  // @Mutate: Solo normaliza al guardar
  @Mutate((v) => (v as string).toLowerCase())
  declare email: string;  // "JOHN@EXAMPLE.COM" → "john@example.com" (solo escritura)

  // @Serialize: Transforma en ambas direcciones
  @Serialize(
    (from) => from === 1,
    (to) => to ? 1 : 0
  )
  declare active: boolean;  // true ↔ 1 (lectura y escritura)
}
```

---

## @NotNull - Campos Requeridos

El decorador `@NotNull` marca campos como requeridos, validando que no sean nulos, undefined o strings vacíos.

### Sintaxis

```typescript
@NotNull(): PropertyDecorator
```

### Campos Obligatorios

```typescript
class Customer extends Table<Customer> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare phone: string;

  declare address: string; // Opcional
}

// Válido
const customer1 = await Customer.create({
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234"
});

// Inválido - lanza error
try {
  await Customer.create({
    name: "",
    email: "john@example.com",
    phone: "555-1234"
  });
} catch (error) {
  console.error("Validación fallida"); // name está vacío
}
```

### Combinando con @Validate

```typescript
class Registration extends Table<Registration> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  @Mutate((v) => (v as string).toLowerCase().trim())
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Email inválido")
  declare email: string;

  @NotNull()
  @Validate((v) => (v as string).length >= 8 || "Mínimo 8 caracteres")
  declare password: string;
}
```

### Validación en Arrays y Objetos

```typescript
class Project extends Table<Project> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare title: string;

  @NotNull()
  @Validate((v) => Array.isArray(v) && v.length > 0 || "Debe tener al menos un miembro")
  declare team_members: string[];

  @NotNull()
  @Validate((v) => {
    const config = v as Record<string, any>;
    return Object.keys(config).length > 0 || "Configuración no puede estar vacía";
  })
  declare config: Record<string, any>;
}
```

---

## @CreatedAt - Timestamp de Creación

El decorador `@CreatedAt` establece automáticamente la fecha y hora de creación en formato ISO 8601.

### Sintaxis

```typescript
@CreatedAt(): PropertyDecorator
```

### Uso Básico

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// La fecha se establece automáticamente
const post = await Post.create({
  title: "Mi primer post",
  content: "Contenido del post"
});

console.log(post.created_at); // "2025-01-15T10:30:00.123Z"
```

### Auditoría Completa

```typescript
class AuditLog extends Table<AuditLog> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare action: string;
  declare resource: string;

  @CreatedAt()
  declare timestamp: CreationOptional<string>;

  declare ip_address: string;
  declare user_agent: string;
}

// Registro de auditoría con timestamp automático
const log = await AuditLog.create({
  user_id: "user-123",
  action: "DELETE",
  resource: "document-456",
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0..."
});
```

### Consultas por Fecha

```typescript
class Event extends Table<Event> {
  @Index()
  declare category: string;

  @IndexSort()
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  declare name: string;
  declare description: string;
}

// Eventos recientes por categoría
const recent_events = await Event.where({ category: "news" }, {
  order: "DESC",
  limit: 20
});

// Eventos en un rango de fechas
const events = await Event.where("created_at", ">=", "2025-01-01T00:00:00Z");
```

---

## @UpdatedAt - Timestamp de Actualización

El decorador `@UpdatedAt` actualiza automáticamente la fecha y hora cada vez que se guarda el registro.

### Sintaxis

```typescript
@UpdatedAt(): PropertyDecorator
```

### Uso Básico

```typescript
class Document extends Table<Document> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Creación
const doc = await Document.create({
  title: "Documento",
  content: "Contenido inicial"
});

console.log(doc.created_at); // "2025-01-15T10:00:00Z"
console.log(doc.updated_at); // "2025-01-15T10:00:00Z"

// Actualización
doc.content = "Contenido actualizado";
await doc.save();

console.log(doc.created_at); // "2025-01-15T10:00:00Z" (sin cambios)
console.log(doc.updated_at); // "2025-01-15T10:15:00Z" (actualizado)
```

### Sistema de Versiones

```typescript
class Article extends Table<Article> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;
  declare author_id: string;

  @Default(() => 1)
  declare version: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  declare last_edited_by: string;
}

// Actualización con versión
const article = await Article.first({ id: "article-123" });
if (article) {
  article.content = "Nuevo contenido";
  article.version = article.version + 1;
  article.last_edited_by = "user-456";
  await article.save();
  // updated_at se actualiza automáticamente
}
```

### Tracking de Cambios

```typescript
class UserProfile extends Table<UserProfile> {
  @PrimaryKey()
  declare user_id: string;

  declare name: string;
  declare email: string;
  declare phone: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare last_modified: CreationOptional<string>;

  declare modification_count: number;
}

// Incrementar contador en cada modificación
const profile = await UserProfile.first({ user_id: "user-123" });
if (profile) {
  profile.name = "Nuevo Nombre";
  profile.modification_count = (profile.modification_count || 0) + 1;
  await profile.save();
  // last_modified se actualiza automáticamente
}
```

---

## @DeleteAt - Soft Delete

El decorador `@DeleteAt` marca una propiedad como columna de soft delete. Cuando se llama `destroy()`, en lugar de eliminar físicamente el registro, se establece esta columna con un timestamp ISO 8601.

### Sintaxis

```typescript
@DeleteAt(): PropertyDecorator
```

### Uso Básico

```typescript
import { DeleteAt } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @DeleteAt()
  declare deleted_at?: string;
}

// Crear usuario
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
});

// Soft delete - NO elimina el registro, marca deleted_at
await user.destroy();

console.log(user.deleted_at); // "2025-01-15T10:30:00.123Z"
// El registro sigue en la base de datos con deleted_at establecido
```

### Comportamiento de Queries

Con `@DeleteAt`, las consultas normales excluyen automáticamente los registros soft-deleted:

```typescript
class Article extends Table<Article> {
  @PrimaryKey()
  declare id: string;

  declare title: string;
  declare content: string;

  @DeleteAt()
  declare deleted_at?: string;
}

// Crear artículos
await Article.create({ id: "1", title: "Artículo 1", content: "..." });
await Article.create({ id: "2", title: "Artículo 2", content: "..." });
await Article.create({ id: "3", title: "Artículo 3", content: "..." });

// Soft delete uno
const article = await Article.first({ id: "2" });
await article.destroy();

// Query normal - excluye soft-deleted automáticamente
const active = await Article.where({});
console.log(active.length); // 2 (artículos 1 y 3)

// Incluir registros soft-deleted
const all = await Article.withTrashed({});
console.log(all.length); // 3 (todos)

// Solo registros soft-deleted
const deleted = await Article.onlyTrashed();
console.log(deleted.length); // 1 (artículo 2)
```

### Restaurar Registros

```typescript
class Document extends Table<Document> {
  @PrimaryKey()
  declare id: string;

  declare title: string;

  @DeleteAt()
  declare deleted_at?: string;
}

// Soft delete
const doc = await Document.first({ id: "doc-1" });
await doc.destroy();

// Restaurar
const deleted_doc = await Document.withTrashed({ id: "doc-1" });
if (deleted_doc[0]) {
  deleted_doc[0].deleted_at = undefined;
  await deleted_doc[0].save();
  // El documento vuelve a aparecer en queries normales
}
```

### Sistema de Papelera

```typescript
class File extends Table<File> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare path: string;
  declare owner_id: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at?: string;
}

// Mover a papelera
async function moveToTrash(file_id: string): Promise<void> {
  const file = await File.first({ id: file_id });
  if (file) await file.destroy();
}

// Vaciar papelera (eliminar permanentemente)
async function emptyTrash(owner_id: string): Promise<void> {
  const trashed = await File.onlyTrashed();
  const user_trashed = trashed.filter(f => f.owner_id === owner_id);

  for (const file of user_trashed) {
    // Forzar eliminación permanente
    await File.delete({ id: file.id });
  }
}

// Restaurar de papelera
async function restoreFromTrash(file_id: string): Promise<void> {
  const files = await File.withTrashed({ id: file_id });
  if (files[0]?.deleted_at) {
    files[0].deleted_at = undefined;
    await files[0].save();
  }
}

// Listar papelera
async function listTrash(owner_id: string): Promise<File[]> {
  const trashed = await File.onlyTrashed();
  return trashed.filter(f => f.owner_id === owner_id);
}
```

### Combinando con Timestamps

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at?: string;
}

// Ciclo de vida completo
const post = await Post.create({
  title: "Mi Post",
  content: "Contenido"
});
// created_at = "2025-01-15T10:00:00Z"
// updated_at = "2025-01-15T10:00:00Z"
// deleted_at = undefined

post.title = "Título Actualizado";
await post.save();
// updated_at = "2025-01-15T11:00:00Z"

await post.destroy();
// deleted_at = "2025-01-15T12:00:00Z"
```

### Soft Delete en Transacciones

```typescript
const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User, Order]
});

dynamite.connect();

// Soft delete atómico de usuario y sus órdenes
await dynamite.tx(async (tx) => {
  const user = await User.first({ id: "user-123" });
  const orders = await Order.where({ user_id: "user-123" });

  // Soft delete de todas las órdenes
  for (const order of orders) {
    await order.destroy(tx);
  }

  // Soft delete del usuario
  await user.destroy(tx);
});
```

### Características Automáticas

Al aplicar `@DeleteAt`:

1. **nullable = true**: La columna se marca automáticamente como nullable
2. **softDelete = true**: Activa el comportamiento de soft delete en `destroy()`
3. **Filtrado automático**: `where()` excluye registros con `deleted_at` establecido
4. **Métodos adicionales**: Habilita `withTrashed()` y `onlyTrashed()`

---

## @Name - Nombres Personalizados

El decorador `@Name` permite personalizar los nombres de tablas y columnas en la base de datos.

### Sintaxis

```typescript
@Name(name: string): ClassDecorator & PropertyDecorator
```

### Nombre de Tabla Personalizado

```typescript
@Name("custom_users_table")
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;
}

// La tabla se crea con el nombre "custom_users_table"
```

### Nombres de Columnas Personalizados

```typescript
class Customer extends Table<Customer> {
  @PrimaryKey()
  @Name("customer_id")
  declare id: string;

  @Name("full_name")
  declare name: string;

  @Name("email_address")
  declare email: string;

  @Name("phone_number")
  declare phone: string;
}

// En DynamoDB: { customer_id, full_name, email_address, phone_number }
```

### Compatibilidad con Sistemas Legados

```typescript
@Name("legacy_orders")
class Order extends Table<Order> {
  @PrimaryKey()
  @Name("ORDER_ID")
  declare id: string;

  @Name("CUSTOMER_ID")
  declare customer_id: string;

  @Name("ORDER_DATE")
  declare order_date: string;

  @Name("TOTAL_AMOUNT")
  declare total: number;

  @Name("ORDER_STATUS")
  declare status: string;
}
```

---

## @HasMany - Relaciones Uno a Muchos

El decorador `@HasMany` define relaciones donde un modelo tiene múltiples instancias de otro modelo.

### Sintaxis

```typescript
@HasMany(targetModel: () => Model, foreignKey: string, localKey?: string): PropertyDecorator
```

### Relación Básica

```typescript
import { HasMany, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  declare total: number;
  declare status: string;
}

// Cargar usuario con órdenes
const users = await User.where({ id: "user-123" }, {
  include: {
    orders: {}
  }
});

console.log(users[0].orders); // Order[]
```

### Relaciones Filtradas

```typescript
// Obtener usuario con órdenes completadas
const users = await User.where({ id: "user-123" }, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 10,
      order: "DESC"
    }
  }
});
```

### Relaciones Anidadas

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;
  declare total: number;

  @HasMany(() => OrderItem, "order_id")
  declare items: NonAttribute<HasMany<OrderItem>>;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  declare order_id: string;
  declare product_id: string;
  declare quantity: number;
  declare price: number;
}

// Cargar usuarios con órdenes e items
const users = await User.where({}, {
  include: {
    orders: {
      include: {
        items: {}
      }
    }
  }
});
```

---

## @BelongsTo - Relaciones Muchos a Uno

El decorador `@BelongsTo` define relaciones donde un modelo pertenece a otro modelo.

### Sintaxis

```typescript
@BelongsTo(targetModel: () => Model, localKey: string, foreignKey?: string): PropertyDecorator
```

### Relación Básica

```typescript
import { BelongsTo, NonAttribute } from "@arcaelas/dynamite";

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  declare total: number;
  declare status: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare email: string;
}

// Cargar orden con usuario
const orders = await Order.where({ id: "order-123" }, {
  include: {
    user: {}
  }
});

console.log(orders[0].user?.name); // "John Doe"
```

### Múltiples Relaciones

```typescript
class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  declare order_id: string;
  declare product_id: string;
  declare quantity: number;

  @BelongsTo(() => Order, "order_id")
  declare order: NonAttribute<BelongsTo<Order>>;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

// Cargar item con orden y producto
const items = await OrderItem.where({ id: "item-123" }, {
  include: {
    order: {},
    product: {}
  }
});
```

---

## Combinando Múltiples Decoradores

### Modelo Completo con Todos los Decoradores

```typescript
import {
  Table,
  PrimaryKey,
  Index,
  IndexSort,
  Default,
  Validate,
  Mutate,
  Serialize,
  NotNull,
  CreatedAt,
  UpdatedAt,
  DeleteAt,
  Name,
  HasMany,
  BelongsTo,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

@Name("users")
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Mutate((v) => (v as string).toLowerCase().trim())
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Email inválido")
  @Name("email_address")
  declare email: string;

  @NotNull()
  @Mutate((v) => (v as string).trim())
  @Validate([
    (v) => (v as string).length >= 2 || "Nombre muy corto",
    (v) => (v as string).length <= 50 || "Nombre muy largo"
  ])
  declare name: string;

  @Default(() => 18)
  @Validate((v) => (v as number) >= 0 && (v as number) <= 150 || "Edad inválida")
  declare age: CreationOptional<number>;

  @Default(() => "customer")
  @Validate((v) => ["customer", "admin", "moderator"].includes(v as string) || "Rol inválido")
  declare role: CreationOptional<string>;

  @Default(() => true)
  @Serialize(
    (from) => from === 1,
    (to) => to ? 1 : 0
  )
  declare active: CreationOptional<boolean>;

  @Serialize(
    (from) => JSON.parse(from),
    (to) => JSON.stringify(to)
  )
  declare preferences: CreationOptional<Record<string, any>>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at?: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;

  @HasMany(() => Review, "user_id")
  declare reviews: NonAttribute<HasMany<Review>>;

  // Propiedad computada
  declare display_name: NonAttribute<string>;

  constructor(data?: any) {
    super(data);
    Object.defineProperty(this, 'display_name', {
      get: () => `${this.name} (${this.role})`,
      enumerable: true
    });
  }
}
```

---

## Patrones de Decoradores Personalizados

Dynamite exporta dos funciones factory que permiten crear decoradores personalizados con acceso completo al sistema de metadatos: `decorator()` para propiedades y `relationDecorator()` para relaciones.

### API de `decorator()`

```typescript
import { decorator, ColumnBuilder, WrapperEntry } from "@arcaelas/dynamite";

/**
 * @description Factory para crear decoradores de propiedad
 * @param handler Función que recibe (col: ColumnBuilder, args: Args, entry: WrapperEntry)
 * @returns Función decoradora parametrizada
 */
function decorator<Args extends any[] = []>(
  handler: (col: ColumnBuilder, args: Args, entry: WrapperEntry) => void
): (...args: Args) => PropertyDecorator;
```

### Clase `ColumnBuilder`

El `ColumnBuilder` proporciona acceso fluido a los metadatos de la columna:

```typescript
interface ColumnBuilder {
  // Metadatos de columna
  name: string;           // Nombre de la columna
  default: any;           // Valor por defecto
  index: boolean;         // Es partition key
  indexSort: boolean;     // Es sort key
  primaryKey: boolean;    // Es primary key
  nullable: boolean;      // Permite null
  unique: boolean;        // Valores únicos
  createdAt: boolean;     // Timestamp de creación
  updatedAt: boolean;     // Timestamp de actualización
  softDelete: boolean;    // Soft delete habilitado
  serialize: { fromDB?: Function, toDB?: Function };

  // Pipeline de transformación
  set(fn: (current: any, next: any) => any): this;  // Agregar setter
  get(fn: (current: any) => any): this;              // Agregar getter

  // Validadores lazy
  lazy_validators: Array<(value: any) => boolean | string>;
}
```

### Crear Decorador Simple

```typescript
import { decorator } from "@arcaelas/dynamite";

// Decorador sin parámetros
export const Uppercase = decorator((col) => {
  col.set((current, next) => {
    return typeof next === "string" ? next.toUpperCase() : next;
  });
});

// Uso
class User extends Table<User> {
  @Uppercase()
  declare country_code: string;
}

await User.create({ country_code: "us" });
// Se guarda como "US"
```

### Crear Decorador con Parámetros

```typescript
import { decorator } from "@arcaelas/dynamite";

// Decorador con parámetros tipados
export const MaxLength = decorator<[max: number]>((col, [max]) => {
  col.set((current, next) => {
    if (typeof next === "string" && next.length > max) {
      return next.substring(0, max);
    }
    return next;
  });
});

// Uso
class Comment extends Table<Comment> {
  @MaxLength(500)
  declare content: string;
}
```

### Crear Decorador con Múltiples Parámetros

```typescript
import { decorator } from "@arcaelas/dynamite";

// Decorador con múltiples parámetros opcionales
export const Range = decorator<[min: number, max: number, clamp?: boolean]>(
  (col, [min, max, clamp = true]) => {
    col.set((current, next) => {
      if (typeof next !== "number") return next;
      if (clamp) {
        return Math.max(min, Math.min(max, next));
      }
      if (next < min || next > max) {
        throw new Error(`Valor debe estar entre ${min} y ${max}`);
      }
      return next;
    });
  }
);

// Uso
class Product extends Table<Product> {
  @Range(0, 100, true)    // Clamp valores a [0, 100]
  declare discount: number;

  @Range(1, 1000, false)  // Lanza error si está fuera de rango
  declare quantity: number;
}
```

### Decorador con Getter y Setter

```typescript
import { decorator } from "@arcaelas/dynamite";

// Transformación bidireccional (similar a @Serialize pero personalizado)
export const JsonColumn = decorator((col) => {
  // Al guardar: objeto → JSON string
  col.set((current, next) => {
    if (next !== null && typeof next === "object") {
      return JSON.stringify(next);
    }
    return next;
  });

  // Al leer: JSON string → objeto
  col.get((current) => {
    if (typeof current === "string") {
      try {
        return JSON.parse(current);
      } catch {
        return current;
      }
    }
    return current;
  });
});

// Uso
class Settings extends Table<Settings> {
  @JsonColumn()
  declare preferences: Record<string, any>;
}
```

### Decorador con Validación Lazy

Los validadores lazy se ejecutan en `save()`, no en el setter:

```typescript
import { decorator } from "@arcaelas/dynamite";

export const UniqueEmail = decorator((col) => {
  // Normalizar al guardar
  col.set((current, next) => {
    return typeof next === "string" ? next.toLowerCase().trim() : next;
  });

  // Validación lazy (ejecutada en save())
  col.lazy_validators.push(async (value) => {
    // Aquí podrías verificar unicidad en la base de datos
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) || "Email inválido";
  });
});
```

### Decorador que Modifica Metadatos

```typescript
import { decorator } from "@arcaelas/dynamite";

// Marcar columna como índice único
export const UniqueIndex = decorator((col) => {
  col.index = true;
  col.unique = true;
  col.nullable = false;
});

// Marcar como timestamp automático personalizado
export const AutoTimestamp = decorator<[format?: string]>((col, [format]) => {
  col.set((current, next) => {
    // Siempre establecer timestamp actual al guardar
    const now = new Date();
    if (format === "epoch") {
      return now.getTime();
    }
    return now.toISOString();
  });
});

// Uso
class AuditLog extends Table<AuditLog> {
  @UniqueIndex()
  declare event_id: string;

  @AutoTimestamp("epoch")
  declare timestamp: number;
}
```

### Decorador con Acceso a WrapperEntry

El tercer parámetro `entry` proporciona acceso a todos los metadatos de la tabla:

```typescript
import { decorator } from "@arcaelas/dynamite";

// Verificar que existe una clave primaria antes de crear índice
export const SecondaryIndex = decorator((col, args, entry) => {
  // Verificar que hay al menos una columna con @Index
  const hasPartitionKey = Array.from(entry.columns.values()).some(c => c.index);

  if (!hasPartitionKey) {
    throw new Error(
      `No se puede crear índice secundario en "${entry.name}" sin @Index definido`
    );
  }

  col.indexSort = true;
});
```

### API de `relationDecorator()`

Para crear decoradores de relación personalizados:

```typescript
import { relationDecorator } from "@arcaelas/dynamite";

/**
 * @description Factory para crear decoradores de relación
 * @param type "hasMany" | "belongsTo"
 */
function relationDecorator(
  type: "hasMany" | "belongsTo"
): (targetModel: () => any, keyArg: string, secondaryKey?: string) => PropertyDecorator;
```

### Crear Decoradores de Relación Personalizados

```typescript
import { relationDecorator } from "@arcaelas/dynamite";

// Alias tipados para relaciones
export const HasMany = relationDecorator("hasMany");
export const BelongsTo = relationDecorator("belongsTo");

// Uso
class Author extends Table<Author> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Book, "author_id", "id")
  declare books: NonAttribute<HasMany<Book>>;
}

class Book extends Table<Book> {
  @PrimaryKey()
  declare id: string;

  declare author_id: string;

  @BelongsTo(() => Author, "author_id", "id")
  declare author: NonAttribute<BelongsTo<Author>>;
}
```

### Crear Decoradores Compuestos

Combina múltiples decoradores existentes en uno:

```typescript
function EmailField(): PropertyDecorator {
  return (target: any, prop: string | symbol) => {
    NotNull()(target, prop);
    Mutate((v) => (v as string).toLowerCase().trim())(target, prop);
    Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Email inválido")(target, prop);
  };
}

function SlugField(): PropertyDecorator {
  return (target: any, prop: string | symbol) => {
    Mutate((v) => (v as string).toLowerCase())(target, prop);
    Mutate((v) => (v as string).replace(/[^a-z0-9]+/g, "-"))(target, prop);
    Mutate((v) => (v as string).replace(/^-+|-+$/g, ""))(target, prop);
    Validate((v) => (v as string).length > 0 || "Slug no puede estar vacío")(target, prop);
  };
}

class Article extends Table<Article> {
  @PrimaryKey()
  declare id: string;

  @EmailField()
  declare author_email: string;

  @SlugField()
  declare slug: string;
}
```

### Ejemplo Completo: Decorador de Encriptación

```typescript
import { decorator } from "@arcaelas/dynamite";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const IV_LENGTH = 16;

export const Encrypted = decorator((col) => {
  // Al guardar: encriptar
  col.set((current, next) => {
    if (typeof next !== "string" || !next) return next;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
    const encrypted = Buffer.concat([cipher.update(next, "utf8"), cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  });

  // Al leer: desencriptar
  col.get((current) => {
    if (typeof current !== "string" || !current.includes(":")) return current;

    try {
      const [ivHex, encryptedHex] = current.split(":");
      const iv = Buffer.from(ivHex, "hex");
      const encrypted = Buffer.from(encryptedHex, "hex");
      const decipher = createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    } catch {
      return current;
    }
  });

  // Marcar como sensible en metadatos
  col.serialize = { fromDB: null, toDB: null }; // Evitar doble transformación
});

// Uso
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Encrypted()
  declare ssn: string;  // Número de seguro social encriptado
}
```

---

## Mejores Prácticas

### 1. Usar CreationOptional Apropiadamente

```typescript
class User extends Table<User> {
  // Siempre CreationOptional con @Default
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Siempre CreationOptional con @CreatedAt/@UpdatedAt
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Campos requeridos sin CreationOptional
  @NotNull()
  declare email: string;
}
```

### 2. Orden de Decoradores

```typescript
class User extends Table<User> {
  // Orden recomendado: Clave → Validación → Transformación → Defaults → Timestamps
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Validate((v) => /^[^\s@]+@/.test(v as string) || "Inválido")
  @Mutate((v) => (v as string).toLowerCase())
  @Name("email_address")
  declare email: string;
}
```

### 3. Validaciones Descriptivas

```typescript
// Mal
@Validate((v) => (v as number) > 0)
declare price: number;

// Bien
@Validate((v) => (v as number) > 0 || "El precio debe ser mayor a 0")
declare price: number;
```

### 4. Relaciones con NonAttribute

```typescript
class User extends Table<User> {
  // Siempre marcar relaciones como NonAttribute
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;
}
```

---

Esta guía cubre todos los decoradores disponibles en Dynamite con ejemplos prácticos y patrones recomendados para construir modelos robustos y type-safe.
