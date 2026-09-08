# Guía Completa de Decoradores en Dynamite

Esta guía proporciona documentación exhaustiva sobre todos los decoradores disponibles en Dynamite ORM, incluyendo ejemplos prácticos, patrones comunes y mejores prácticas.

## Tabla de Contenidos

1. [Introduccion a los Decoradores](#introduccion-a-los-decoradores)
2. [@PrimaryKey - Claves Primarias](#primarykey-claves-primarias)
3. [@Index - Configuracion de GSI](#index-configuracion-de-gsi)
4. [@IndexSort - Sort key de la tabla](#indexsort-sort-key-de-la-tabla)
5. [@Default - Valores por Defecto](#default-valores-por-defecto)
6. [@Validate - Funciones de Validacion](#validate-funciones-de-validacion)
7. [@Set - Transformacion al Escribir](#set-transformacion-al-escribir)
8. [@Get y @Set - Transformacion Bidireccional](#get-y-set-transformacion-bidireccional)
9. [@NotNull - Campos Requeridos](#notnull-campos-requeridos)
10. [@CreatedAt - Timestamp de Creacion](#createdat-timestamp-de-creacion)
11. [@UpdatedAt - Timestamp de Actualizacion](#updatedat-timestamp-de-actualizacion)
12. [@DeleteAt - Soft Delete](#deleteat-soft-delete)
13. [Decoradores de Hooks de ciclo de vida](#decoradores-de-hooks-de-ciclo-de-vida)
14. [@Name - Nombres Personalizados](#name-nombres-personalizados)
15. [@HasMany - Relaciones Uno a Muchos](#hasmany-relaciones-uno-a-muchos)
16. [@BelongsTo - Relaciones Muchos a Uno](#belongsto-relaciones-muchos-a-uno)
17. [Combinando Multiples Decoradores](#combinando-multiples-decoradores)
18. [Patrones de Decoradores Personalizados](#patrones-de-decoradores-personalizados)
19. [Mejores Practicas](#mejores-practicas)

---

## Introducción a los Decoradores

Los decoradores en Dynamite son funciones especiales que añaden metadatos y comportamiento a las clases y propiedades. Permiten definir esquemas de base de datos de manera declarativa y type-safe.

### Conceptos Básicos

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Decorador de clave primaria
  @PrimaryKey()
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
- `@IndexSort()` - Define la sort key de la tabla

**Decoradores de Datos:**
- `@Default()` - Establece valores por defecto
- `@Set()` - Transforma valores al escribir (App → DB)
- `@Get()` - Transforma valores al leer (DB → App)
- `@Validate()` - Valida valores antes de guardar
- `@NotNull()` - Marca campos como requeridos

**Decoradores de Timestamp:**
- `@CreatedAt()` - Auto-timestamp en creación
- `@UpdatedAt()` - Auto-timestamp en actualización
- `@DeleteAt()` - Soft delete con timestamp

**Decoradores de Hooks:**
- `@BeforeCreate()` / `@AfterCreate()` - Antes/después de insertar
- `@BeforeUpdate()` / `@AfterUpdate()` - Antes/después de actualizar
- `@BeforeDestroy()` / `@AfterDestroy()` - Antes/después de eliminar

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
  declare sku: CreationOptional<string>;

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
  declare account_id: CreationOptional<string>;
  // Automáticamente:
  // - Marcado como @Index: es la partition key de la tabla
  // - Registrado como la clave primaria del schema
  // - Resuelto con un ULID si no se pasa id, e inmutable después
  // - Rechaza cualquier cosa que no sea un string no vacío
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

## @IndexSort - Sort key de la tabla

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

### Sort key de la tabla

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
  declare id: CreationOptional<string>;

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
  declare user_id: CreationOptional<string>;

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
  declare sku: CreationOptional<string>;

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
  declare id: CreationOptional<string>;

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

## @Set - Transformación al Escribir

El decorador `@Set` transforma valores antes de guardarlos en la base de datos.

### Sintaxis

```typescript
@Set(transformer: (next: any, current: any) => any): PropertyDecorator
```

El transformador recibe el nuevo valor (`next`) y, opcionalmente, el valor actual (`current`). Los ejemplos que solo necesitan el nuevo valor pueden declarar un único parámetro.

### Transformaciones Básicas

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Set((v) => (v as string).toLowerCase().trim())
  declare email: string;

  @Set((v) => (v as string).trim())
  @Set((v) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase())
  declare name: string;

  @Set((v) => (v as string).replace(/\D/g, ""))
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
  declare id: CreationOptional<string>;

  @Set((v) => (v as string).trim())
  @Set((v) => (v as string).replace(/\s+/g, " "))
  @Set((v) => (v as string).substring(0, 200))
  declare title: string;

  @Set((v) => (v as string).trim())
  @Set((v) => (v as string).replace(/<[^>]*>/g, ""))
  @Set((v) => (v as string).substring(0, 5000))
  declare content: string;
}
```

### Transformaciones Numéricas

```typescript
class Financial extends Table<Financial> {
  @PrimaryKey()
  declare transaction_id: CreationOptional<string>;

  @Set((v) => Math.round((v as number) * 100) / 100)
  declare amount: number;

  @Set((v) => Math.max(0, Math.min(100, v as number)))
  declare percentage: number;

  @Set((v) => Math.abs(v as number))
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
  declare user_id: CreationOptional<string>;

  @Set((v) => {
    const config = v as Record<string, any>;
    return Object.keys(config).reduce((acc, key) => {
      acc[key.toLowerCase()] = config[key];
      return acc;
    }, {} as Record<string, any>);
  })
  declare preferences: Record<string, any>;

  @Set((v) => Array.from(new Set(v as string[])))
  declare tags: string[];
}
```

---

## @Get y @Set - Transformación Bidireccional

Para transformar un valor en ambas direcciones se combinan `@Get` (al leer de la base de datos) y `@Set` (al guardar en la base de datos) sobre la misma propiedad, en líneas separadas. Juntos cubren la conversión completa del ciclo de datos.

### Sintaxis

```typescript
@Get(transformer: (value: any) => any): PropertyDecorator      // DB → App (lectura)
@Set(transformer: (next: any, current: any) => any): PropertyDecorator  // App → DB (escritura)
```

### Parámetros

| Decorador | Dirección | Descripción |
|-----------|-----------|-------------|
| `@Get(fn)` | DB → App | Transforma el valor al leer de la base de datos. |
| `@Set(fn)` | App → DB | Transforma el valor al guardar en la base de datos. |

### Transformación Bidireccional

```typescript
import { Get, Set, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  // Boolean almacenado como número en DynamoDB
  @Get((value) => value === 1)        // DB: 1 → App: true
  @Set((value) => value ? 1 : 0)      // App: true → DB: 1
  declare active: boolean;

  // JSON almacenado como string
  @Get((value) => JSON.parse(value))        // DB: '{"a":1}' → App: {a:1}
  @Set((value) => JSON.stringify(value))    // App: {a:1} → DB: '{"a":1}'
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

Usa únicamente `@Set` para transformar solo al escribir, sin transformar al leer:

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare sku: CreationOptional<string>;

  // Solo normalizar al guardar, no transformar al leer
  @Set((value) => (value as string).toUpperCase().trim())
  declare code: string;
}

// El código se guarda en mayúsculas
await Product.create({ sku: "prod-1", code: "  abc123  " });
// En DB: code = "ABC123"
```

### Solo Transformar al Leer

Usa únicamente `@Get` para transformar solo al leer:

```typescript
class Settings extends Table<Settings> {
  @PrimaryKey()
  declare user_id: CreationOptional<string>;

  // Parse JSON solo al leer (se guarda como string directamente)
  @Get((value) => JSON.parse(value))
  declare preferences: Record<string, any>;

  // Convertir timestamp a Date solo al leer
  @Get((value) => new Date(value))
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
  declare user_id: CreationOptional<string>;

  @Get(decrypt)
  @Set(encrypt)
  declare api_key: string;

  @Get(decrypt)
  @Set(encrypt)
  declare secret_token: string;
}
```

#### Compresión de Datos

```typescript
import { gzipSync, gunzipSync } from "zlib";

class Document extends Table<Document> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Get((value) => gunzipSync(Buffer.from(value, "base64")).toString())
  @Set((value) => gzipSync(value).toString("base64"))
  declare content: string;
}
```

#### Conversión de Tipos DynamoDB

```typescript
class Analytics extends Table<Analytics> {
  @PrimaryKey()
  declare event_id: CreationOptional<string>;

  // Set de DynamoDB a Array de JavaScript
  @Get((value) => Array.from(value))    // Set → Array
  @Set((value) => new Set(value))       // Array → Set
  declare tags: string[];

  // BigInt para números grandes
  @Get((value) => BigInt(value))
  @Set((value) => value.toString())
  declare large_number: bigint;
}
```

### @Set frente a @Get + @Set

| Característica | Solo `@Set` | `@Get` + `@Set` |
|----------------|-------------|-----------------|
| Dirección | Solo al guardar | Bidireccional |
| Decoradores | Uno (`@Set`) | Dos (`@Get` y `@Set`) |
| Caso de uso | Normalización | Conversión de tipos |

```typescript
class Example extends Table<Example> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  // Solo @Set: normaliza al guardar
  @Set((v) => (v as string).toLowerCase())
  declare email: string;  // "JOHN@EXAMPLE.COM" → "john@example.com" (solo escritura)

  // @Get + @Set: transforma en ambas direcciones
  @Get((value) => value === 1)
  @Set((value) => value ? 1 : 0)
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
  declare id: CreationOptional<string>;

  @NotNull()
  @Set((v) => (v as string).toLowerCase().trim())
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
  declare id: CreationOptional<string>;

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
  declare user_id: CreationOptional<string>;

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
import { DeleteAt, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
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
  declare id: CreationOptional<string>;

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
const all = await Article.where({}, { deleted: true });
console.log(all.length); // 3 (todos)

// Solo registros soft-deleted
const deleted = await Article.where({ deleted_at: { $ne: null } }, { deleted: true });
console.log(deleted.length); // 1 (artículo 2)
```

### Restaurar Registros

```typescript
class Document extends Table<Document> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare title: string;

  @DeleteAt()
  declare deleted_at?: string;
}

// Soft delete
const doc = await Document.first({ id: "doc-1" });
await doc.destroy();

// Restaurar
const deleted_doc = await Document.where({ id: "doc-1" }, { deleted: true });
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
  const trashed = await File.where({ deleted_at: { $ne: null } }, { deleted: true });
  const user_trashed = trashed.filter(f => f.owner_id === owner_id);

  for (const file of user_trashed) {
    // Forzar eliminación permanente
    await File.delete({ id: file.id });
  }
}

// Restaurar de papelera
async function restoreFromTrash(file_id: string): Promise<void> {
  const files = await File.where({ id: file_id }, { deleted: true });
  if (files[0]?.deleted_at) {
    files[0].deleted_at = undefined;
    await files[0].save();
  }
}

// Listar papelera
async function listTrash(owner_id: string): Promise<File[]> {
  const trashed = await File.where({ deleted_at: { $ne: null } }, { deleted: true });
  return trashed.filter(f => f.owner_id === owner_id);
}
```

### Combinando con Timestamps

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
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

await dynamite.connect();

// Soft delete atómico de usuario y sus órdenes
await dynamite.tx(async (tx) => {
  const user = await User.first({ id: "user-123" });
  const orders = await Order.where({ user_id: "user-123" });

  // Soft delete de todas las órdenes
  for (const order of orders) {
    await order.destroy({ tx });
  }

  // Soft delete del usuario
  await user.destroy({ tx });
});
```

### Características Automáticas

Al aplicar `@DeleteAt`:

1. **softDelete = true**: `destroy()` escribe el timestamp en vez de eliminar el registro
2. **Filtrado automático**: `where()` y `first()` excluyen los registros que lo llevan
3. **Opt-in**: `{ deleted: true }` en las opciones de consulta los vuelve a traer
4. **`delete()` estático no cambia**: siempre elimina el registro, el soft delete vive en la instancia

---

## Decoradores de Hooks de ciclo de vida

Decoradores de método que se ejecutan automáticamente alrededor de las operaciones de persistencia. Son opt-in: solo corren cuando la operación recibe `{ hook: true }`. Dentro del hook, `this` es la entidad.

| Decorador | Cuándo se ejecuta | Argumento |
|-----------|-------------------|-----------|
| `@BeforeCreate()` | Antes de insertar. Puede mutar `this`. | — |
| `@AfterCreate()` | Después de insertar (`this` ya persistido). | — |
| `@BeforeUpdate()` | Antes de actualizar. | `changes` (delta) |
| `@AfterUpdate()` | Después de actualizar. | `changes` (delta) |
| `@BeforeDestroy()` | Antes de eliminar. | — |
| `@AfterDestroy()` | Después de eliminar. | — |

### Uso Básico

```typescript
import { Table, PrimaryKey, BeforeCreate, AfterCreate, BeforeUpdate, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;
  declare slug: string;

  @BeforeCreate()
  normalizeOnCreate() {
    // `this` es la entidad; puede mutarse antes de persistir
    this.email = this.email.toLowerCase().trim();
    this.slug = this.name.toLowerCase().replace(/\s+/g, "-");
  }

  @AfterCreate()
  async notifyCreated() {
    // Los hooks async se esperan con await
    await fetch("/internal/welcome", {
      method: "POST",
      body: JSON.stringify({ email: this.email })
    });
  }

  @BeforeUpdate()
  trackChanges(changes: Partial<User>) {
    // `changes` es el delta de campos modificados
    console.log("Campos a actualizar:", Object.keys(changes));
  }
}
```

### Comportamiento

- Se pueden declarar varios hooks del mismo tipo; corren en orden de declaración y los async se esperan con await.
- Activación por operación: `User.create(data, { hook: true })`, `user.update(data, { hook: true })`, `user.destroy({ hook: true })`.
- En `update`/`delete` masivos, los hooks corren una vez por entidad afectada.
- Dentro de una transacción (`{ hook: true, tx }`), los `before*` corren al encolar y los `after*` tras el commit.
- `increment()`/`decrement()` aceptan `{ tx }` pero no disparan hooks.

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
  declare id: CreationOptional<string>;

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
import { HasMany, NonAttribute, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
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
  declare id: CreationOptional<string>;

  declare name: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare total: number;

  @HasMany(() => OrderItem, "order_id")
  declare items: NonAttribute<OrderItem[]>;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

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
@BelongsTo(model: () => Model, related_key: string, local_key: string): PropertyDecorator
```

### Relación Básica

```typescript
import { BelongsTo, NonAttribute, CreationOptional } from "@arcaelas/dynamite";

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  declare total: number;
  declare status: string;

  @BelongsTo(() => User, "id", "user_id")
  declare user: NonAttribute<User | null>;
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

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
  declare id: CreationOptional<string>;

  declare order_id: string;
  declare product_id: string;
  declare quantity: number;

  @BelongsTo(() => Order, "id", "order_id")
  declare order: NonAttribute<Order | null>;

  @BelongsTo(() => Product, "id", "product_id")
  declare product: NonAttribute<Product | null>;
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
import { Table, PrimaryKey, Index, IndexSort, Default, Validate, Get, Set, NotNull, CreatedAt, UpdatedAt, DeleteAt, Name, HasMany, BelongsTo, CreationOptional, NonAttribute } from "@arcaelas/dynamite";

@Name("users")
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @NotNull()
  @Set((v) => (v as string).toLowerCase().trim())
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Email inválido")
  @Name("email_address")
  declare email: string;

  @NotNull()
  @Set((v) => (v as string).trim())
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
  @Get((value) => value === 1)
  @Set((value) => value ? 1 : 0)
  declare active: CreationOptional<boolean>;

  @Get((value) => JSON.parse(value))
  @Set((value) => JSON.stringify(value))
  declare preferences: CreationOptional<Record<string, any>>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at?: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;

  @HasMany(() => Review, "user_id")
  declare reviews: NonAttribute<Review[]>;

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

Todo decorador de Dynamite se construye con la misma factory que la librería exporta, `decorator()`. No hay una API privilegiada: `@PrimaryKey`, `@CreatedAt` y `@HasMany` están escritos igual que los que escribas tú.

### API de `decorator()`

```typescript
import { decorator } from "@arcaelas/dynamite";

function decorator(
  callback: (table_class: any, col: Column, params: any[]) => void
): (...params: any[]) => PropertyDecorator;
```

- `table_class` es el constructor del modelo al que pertenece la propiedad
- `col` es la columna decorada
- `params` son los argumentos con los que se llamó al decorador

### El objeto `Column`

```typescript
interface Column {
  name: string;                                  // nombre de la columna en DynamoDB
  get: Array<(current: any) => any>;             // pipeline de lectura
  set: Array<(next: any, current: any) => any>;  // pipeline de escritura
  store: {
    index?: boolean;         // partition key del GSI <campo>_index
    indexSort?: boolean;     // sort key de la tabla
    primaryKey?: boolean;    // clave primaria
    softDelete?: boolean;    // marca de soft delete
    createdAt?: boolean;     // timestamp de creación
    updatedAt?: boolean;     // timestamp de actualización
    readsCurrent?: boolean;  // el pipeline necesita el valor almacenado
    relation?: {             // metadata de relación
      type: 'HasMany' | 'HasOne' | 'BelongsTo' | 'ManyToMany';
      model: () => any;
      foreignKey: string;
      localKey: string;
      relatedKey?: string;
      pivotTable?: string;
      relatedPK?: string;
    };
  };
}
```

Los pipelines se extienden empujando sobre los arreglos: `col.get.push(fn)` y `col.set.push(fn)`. Lo que dejes en `col.store` viaja con el schema y se lee a través del símbolo `SCHEMA`.

### Decorador sin parámetros

```typescript
import { decorator } from "@arcaelas/dynamite";

export const Uppercase = decorator((_modelo, col) => {
  col.set.push((next) => typeof next === "string" ? next.toUpperCase() : next);
});

class User extends Table<User> {
  @Uppercase()
  declare country_code: string;
}

await User.create({ country_code: "us" }); // se guarda "US"
```

### Decorador con parámetros

```typescript
export const Length = decorator((_modelo, col, params) => {
  const [min, max] = params;

  col.set.push((next) => {
    if (typeof next !== "string") throw new TypeError(`${col.name} debe ser un string`);
    if (next.length < min) throw new Error(`${col.name} necesita al menos ${min} caracteres`);
    if (next.length > max) throw new Error(`${col.name} no puede exceder ${max} caracteres`);
    return next;
  });
});

class User extends Table<User> {
  @Length(3, 50)
  declare username: string;
}
```

### Decorador con los dos pipelines

```typescript
export const Json = decorator((_modelo, col) => {
  col.set.push((next) => typeof next === "object" && next !== null ? JSON.stringify(next) : next);
  col.get.push((current) => {
    if (typeof current !== "string") return current;
    try { return JSON.parse(current); } catch { return current; }
  });
});

class Settings extends Table<Settings> {
  @Json()
  declare preferences: Record<string, unknown>;
}
```

El pipeline de escritura corre al asignar y el de lectura en cada acceso, que es lo que hace de `@Get` una transformación del valor que lees y no del que guardas.

### Leer el valor almacenado

Una función de `col.set` recibe `(next, current)`: el valor entrante y el que ya tenía la instancia. Así es como `@CreatedAt` se mantiene inmutable:

```typescript
export const Immutable = decorator((_modelo, col) => {
  col.store.readsCurrent = true;
  col.set.push((next, current) => current ?? next);
});
```

Declarar el segundo argumento tiene un costo. El `update()` por clave primaria se resuelve en una sola escritura precisamente porque no necesita leer el registro antes; una columna cuyo pipeline pide `current` obliga a esa lectura. Marca `col.store.readsCurrent = true` para que la librería lo sepa, y declara `current` solo cuando lo uses de verdad.

`@Set` y `@Validate` levantan esa marca solos, inspeccionando la función que les pasas.

### Decorador que escribe metadata

```typescript
import { decorator, SCHEMA } from "@arcaelas/dynamite";

export const Searchable = decorator((modelo, col) => {
  col.store.index = true;                 // GSI <campo>_index
  (modelo as any)[SCHEMA].gsis.add(col.name);
});
```

El schema detrás de `SCHEMA` guarda el nombre de la tabla, la clave primaria, los GSI esperados, los hooks y todas las columnas. `@Name` escribe ahí para renombrar una tabla, y `@PrimaryKey` para registrar cuál columna es la clave.

### Componer decoradores

Un decorador que es otro con un argumento fijo se escribe como una función normal, igual que `@Default` y `@NotNull`:

```typescript
import { Set, Validate } from "@arcaelas/dynamite";

export const Slug = () => Set((next: any) =>
  typeof next === "string" ? next.toLowerCase().replace(/\W+/g, "-") : next
);

export const Email = (mensaje = "Correo inválido") => Validate((next: any) =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(next)) || mensaje
);

class User extends Table<User> {
  @Slug() declare handle: string;
  @Email() declare email: string;
}
```

### Orden de ejecución

TypeScript aplica los decoradores de abajo hacia arriba, así que el más cercano a la propiedad entra primero al pipeline y por lo tanto corre primero al escribir:

```typescript
class Example extends Table<Example> {
  @Validate((v) => v <= 100 || "Max 100")  // corre tercero
  @Set((v) => Math.abs(v))                 // corre segundo
  @NotNull("Requerido")                    // corre primero
  declare value: number;
}

// -50 -> NotNull pasa -> Set lo vuelve 50 -> Validate pasa
```

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
  declare id: CreationOptional<string>;

  @NotNull()
  @Validate((v) => /^[^\s@]+@/.test(v as string) || "Inválido")
  @Set((v) => (v as string).toLowerCase())
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
  declare orders: NonAttribute<Order[]>;
}
```

---

Esta guía cubre todos los decoradores disponibles en Dynamite con ejemplos prácticos y patrones recomendados para construir modelos robustos y type-safe.
