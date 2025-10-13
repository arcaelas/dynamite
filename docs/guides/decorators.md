# Guía Completa de Decoradores en Dynamite

Esta guía proporciona documentación exhaustiva sobre todos los decoradores disponibles en Dynamite ORM, incluyendo ejemplos prácticos, patrones comunes y mejores prácticas.

## Tabla de Contenidos

1. [Introducción a los Decoradores](#introducción-a-los-decoradores)
2. [@PrimaryKey - Claves Primarias](#primarykey---claves-primarias)
3. [@Index - Configuración de GSI](#index---configuración-de-gsi)
4. [@IndexSort - Configuración de LSI](#indexsort---configuración-de-lsi)
5. [@Default - Valores por Defecto](#default---valores-por-defecto)
6. [@Validate - Funciones de Validación](#validate---funciones-de-validación)
7. [@Mutate - Transformación de Datos](#mutate---transformación-de-datos)
8. [@NotNull - Campos Requeridos](#notnull---campos-requeridos)
9. [@CreatedAt - Timestamp de Creación](#createdat---timestamp-de-creación)
10. [@UpdatedAt - Timestamp de Actualización](#updatedat---timestamp-de-actualización)
11. [@Name - Nombres Personalizados](#name---nombres-personalizados)
12. [@HasMany - Relaciones Uno a Muchos](#hasmany---relaciones-uno-a-muchos)
13. [@BelongsTo - Relaciones Muchos a Uno](#belongsto---relaciones-muchos-a-uno)
14. [Combinando Múltiples Decoradores](#combinando-múltiples-decoradores)
15. [Patrones de Decoradores Personalizados](#patrones-de-decoradores-personalizados)
16. [Mejores Prácticas](#mejores-prácticas)

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
- `@Validate()` - Valida valores antes de guardar
- `@NotNull()` - Marca campos como requeridos

**Decoradores de Timestamp:**
- `@CreatedAt()` - Auto-timestamp en creación
- `@UpdatedAt()` - Auto-timestamp en actualización

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
  NotNull,
  CreatedAt,
  UpdatedAt,
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
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

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

### Crear Decoradores Compuestos

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
