# Conceptos Básicos

Esta guía explica los conceptos fundamentales del ORM Dynamite y cómo trabajan juntos para proporcionar una interfaz potente y type-safe para DynamoDB.

## Tabla de Contenidos

1. [Clase Table](#clase-table)
2. [Descripción General de Decoradores](#descripción-general-de-decoradores)
3. [Claves Primarias](#claves-primarias)
4. [Índices](#índices)
5. [Constructor de Consultas](#constructor-de-consultas)
6. [Operadores de Consulta](#operadores-de-consulta)
7. [Sistema de Tipos](#sistema-de-tipos)
8. [Flujo de Datos](#flujo-de-datos)

---

## Clase Table

La clase `Table` es la clase base para todos tus modelos de DynamoDB. Proporciona tanto métodos estáticos para operaciones de base de datos como métodos de instancia para trabajar con registros individuales.

### Métodos Estáticos vs Métodos de Instancia

**Métodos estáticos** operan directamente en la base de datos:

```typescript
// Métodos estáticos - trabajan con la base de datos
const user = await User.create({ name: "John" });
const users = await User.where({ active: true });
const count = await User.update({ status: "active" }, { role: "admin" });
await User.delete({ id: "user-123" });
```

**Métodos de instancia** trabajan con instancias individuales del modelo:

```typescript
// Métodos de instancia - trabajan con la instancia del modelo
const user = new User({ name: "John" });
await user.save();           // Guardar en la base de datos

user.name = "Jane";
await user.update({ name: "Jane" }); // Actualizar campos

await user.destroy();        // Eliminar de la base de datos
```

### Uso Básico

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => true)
  declare active: CreationOptional<boolean>;
}

// Crear
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
  // id y active son opcionales (CreationOptional)
});

// Leer
const allUsers = await User.where({});
const activeUsers = await User.where({ active: true });

// Actualizar
user.name = "Jane Doe";
await user.save();

// Eliminar
await user.destroy();
```

---

## Descripción General de Decoradores

Los decoradores son funciones especiales que anotan propiedades de clase con metadatos. Dynamite usa decoradores para definir la estructura de tabla, reglas de validación y relaciones.

### Decoradores Básicos

| Decorador | Propósito | Ejemplo |
|-----------|---------|---------|
| `@PrimaryKey()` | Define la partition key | `@PrimaryKey() declare id: string;` |
| `@Index()` | Alias para PrimaryKey | `@Index() declare userId: string;` |
| `@IndexSort()` | Define la sort key | `@IndexSort() declare timestamp: string;` |
| `@Name("custom")` | Nombre de columna/tabla personalizado | `@Name("user_email") declare email: string;` |

### Decoradores de Datos

| Decorador | Propósito | Ejemplo |
|-----------|---------|---------|
| `@Default(value)` | Valor por defecto | `@Default(() => Date.now()) declare createdAt: number;` |
| `@Mutate(fn)` | Transformar antes de guardar | `@Mutate(v => v.toLowerCase()) declare email: string;` |
| `@Validate(fn)` | Validar antes de guardar | `@Validate(v => v.length > 0) declare name: string;` |
| `@NotNull()` | Requerir valor no nulo | `@NotNull() declare email: string;` |

### Decoradores de Timestamp

| Decorador | Propósito | Ejemplo |
|-----------|---------|---------|
| `@CreatedAt()` | Auto-establecer en creación | `@CreatedAt() declare createdAt: string;` |
| `@UpdatedAt()` | Auto-establecer en actualización | `@UpdatedAt() declare updatedAt: string;` |

### Decoradores de Relación

| Decorador | Propósito | Ejemplo |
|-----------|---------|---------|
| `@HasMany(Model, fk)` | Uno a muchos | `@HasMany(() => Order, "userId") declare orders: any;` |
| `@BelongsTo(Model, lk)` | Muchos a uno | `@BelongsTo(() => User, "userId") declare user: any;` |

### Ejemplo Completo

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  Mutate,
  Validate,
  NotNull,
  CreatedAt,
  UpdatedAt,
  HasMany,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Mutate(v => v.trim())
  @Mutate(v => v.toLowerCase())
  @Validate(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Email inválido")
  declare email: string;

  @Validate(v => v.length >= 2 || "Nombre muy corto")
  @Validate(v => v.length <= 50 || "Nombre muy largo")
  declare name: string;

  @Default(() => 18)
  @Validate(v => v >= 0 || "La edad debe ser positiva")
  declare age: CreationOptional<number>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  @HasMany(() => Order, "userId")
  declare orders: NonAttribute<Order[]>;
}
```

---

## Claves Primarias

Las claves primarias en DynamoDB consisten en una **partition key** (requerida) y opcionalmente una **sort key**. Dynamite usa el decorador `@PrimaryKey` para definir la partition key.

### Clave Primaria Simple

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
}

// Consultar por clave primaria
const user = await User.first({ id: "user-123" });
```

### Clave Primaria Compuesta (Partition + Sort Key)

```typescript
class Order extends Table<Order> {
  @PrimaryKey()        // Partition key
  declare userId: string;

  @IndexSort()         // Sort key
  declare timestamp: string;

  declare total: number;
  declare status: string;
}

// Consultar por partition key
const userOrders = await Order.where({ userId: "user-123" });

// Consultar por partition + sort key
const recentOrders = await Order.where({
  userId: "user-123",
  timestamp: "2023-12-01"
});
```

### Claves Primarias Autogeneradas

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare price: number;
}

// id se genera automáticamente
const product = await Product.create({
  name: "Widget",
  price: 9.99
});

console.log(product.id); // "550e8400-e29b-41d4-a716-446655440000"
```

---

## Índices

DynamoDB soporta Global Secondary Indexes (GSI) y Local Secondary Indexes (LSI) para consultas eficientes. Dynamite proporciona los decoradores `@Index` y `@IndexSort`.

### Global Secondary Index (GSI)

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Index()             // GSI partition key
  declare email: string;

  declare name: string;
  declare role: string;
}

// Consultar por email (GSI)
const user = await User.first({ email: "john@example.com" });
```

### Local Secondary Index (LSI)

```typescript
class Message extends Table<Message> {
  @PrimaryKey()        // Partition key
  declare chatId: string;

  @IndexSort()         // Sort key (LSI)
  declare timestamp: string;

  declare userId: string;
  declare content: string;
}

// Consultar mensajes de chat ordenados por timestamp
const messages = await Message.where(
  { chatId: "chat-123" },
  { order: "DESC", limit: 50 }
);
```

---

## Constructor de Consultas

El constructor de consultas proporciona una interfaz fluida para construir consultas de base de datos. El método principal es `where()`, que tiene múltiples sobrecargas para diferentes casos de uso.

### Consultas Básicas

```typescript
// Obtener todos los registros
const allUsers = await User.where({});

// Filtrar por campo (igualdad)
const activeUsers = await User.where({ active: true });

// Múltiples filtros (condición AND)
const premiumUsers = await User.where({
  active: true,
  role: "premium"
});
```

### Consultas Campo-Valor

```typescript
// Consulta de campo único
const adults = await User.where("age", 18);

// Array de valores (operador IN)
const specificAges = await User.where("age", [25, 30, 35]);
```

### Opciones de Consulta

```typescript
// Paginación
const users = await User.where({}, {
  limit: 10,
  skip: 20
});

// Ordenación
const users = await User.where({}, {
  order: "DESC"
});

// Seleccionar campos específicos
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Opciones combinadas
const users = await User.where(
  { active: true },
  {
    attributes: ["id", "name"],
    limit: 50,
    order: "ASC"
  }
);
```

---

## Operadores de Consulta

Los operadores de consulta permiten realizar filtrado avanzado más allá de las verificaciones de igualdad simples.

### Operadores de Comparación

```typescript
// Igual (por defecto)
const users = await User.where("age", "=", 25);
const users = await User.where("age", 25); // Igual al anterior

// No igual
const nonAdmins = await User.where("role", "!=", "admin");

// Menor que
const minors = await User.where("age", "<", 18);

// Menor o igual
const seniors = await User.where("age", "<=", 65);

// Mayor que
const highScores = await User.where("score", ">", 100);

// Mayor o igual
const adults = await User.where("age", ">=", 18);
```

### Operadores de Array

```typescript
// IN - valor en array
const specificRoles = await User.where("role", "in", ["admin", "premium", "vip"]);

// NOT IN - valor no en array
const regularUsers = await User.where("role", "not-in", ["admin", "moderator"]);
```

### Operadores de String

```typescript
// CONTAINS - string contiene substring
const gmailUsers = await User.where("email", "contains", "gmail");

// BEGINS WITH - string comienza con prefijo
const johnUsers = await User.where("name", "begins-with", "John");
```

---

## Sistema de Tipos

El sistema de tipos de Dynamite asegura la seguridad de tipos en toda tu aplicación. Proporciona tipos especiales para campos opcionales, propiedades computadas y relaciones.

### CreationOptional

Marca campos como opcionales durante la creación pero requeridos en instancias. **Siempre usa para campos autogenerados**.

```typescript
import { Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // ID autogenerado - siempre CreationOptional
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Campos requeridos
  declare name: string;
  declare email: string;

  // Valor por defecto - siempre CreationOptional
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Timestamps auto-establecidos - siempre CreationOptional
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;
}

// TypeScript sabe qué es requerido
const user = await User.create({
  name: "John",
  email: "john@test.com"
  // id, role, createdAt, updatedAt son opcionales
});

// Pero todos los campos existen después de la creación
console.log(user.id);        // string (no undefined)
console.log(user.role);      // "customer"
console.log(user.createdAt); // "2023-12-01T10:30:00.000Z"
```

### NonAttribute

Excluye campos de operaciones de base de datos. Usado para propiedades computadas y campos virtuales.

```typescript
import { Table, PrimaryKey, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare firstName: string;
  declare lastName: string;
  declare birthDate: string;

  // Propiedades computadas (no almacenadas en base de datos)
  declare fullName: NonAttribute<string>;
  declare age: NonAttribute<number>;

  constructor(data?: any) {
    super(data);

    // Definir propiedades computadas
    Object.defineProperty(this, 'fullName', {
      get: () => `${this.firstName} ${this.lastName}`,
      enumerable: true
    });

    Object.defineProperty(this, 'age', {
      get: () => {
        const today = new Date();
        const birth = new Date(this.birthDate);
        return today.getFullYear() - birth.getFullYear();
      },
      enumerable: true
    });
  }
}

const user = await User.create({
  id: "user-1",
  firstName: "John",
  lastName: "Doe",
  birthDate: "1990-01-01"
});

console.log(user.fullName); // "John Doe" (computado, no almacenado)
console.log(user.age);      // 34 (computado, no almacenado)
```

---

## Flujo de Datos

Comprender cómo fluyen los datos a través de Dynamite te ayuda a usarlo de manera efectiva.

**Puntos Clave:**

1. **Registro de Decoradores**: Ocurre una vez en el momento de definición de clase
2. **Valores Por Defecto**: Aplicados en el constructor antes de la validación
3. **Mutaciones**: Aplicadas antes de la validación, transforma datos
4. **Validación**: Se ejecuta después de las mutaciones, puede lanzar errores
5. **Timestamps**: Auto-establecidos en operaciones de crear/actualizar
6. **Serialización**: Excluye campos NonAttribute antes de la persistencia
7. **Relaciones**: Cargadas de manera lazy a través de consultas separadas
8. **Seguridad de Tipos**: Mantenida durante todo el flujo

---

## Resumen

Esta guía cubrió los conceptos básicos de Dynamite:

- **Clase Table**: Clase base con métodos estáticos y de instancia
- **Decoradores**: Anotaciones de metadatos para estructura y comportamiento
- **Claves Primarias**: Claves de partición y ordenación usando @PrimaryKey y @IndexSort
- **Índices**: GSI y LSI para consultas eficientes
- **Constructor de Consultas**: Interfaz fluida con where(), first(), last()
- **Operadores de Consulta**: =, !=, <, >, <=, >=, in, not-in, contains, begins-with
- **Sistema de Tipos**: CreationOptional, NonAttribute, InferAttributes para seguridad de tipos
- **Flujo de Datos**: Cómo se mueven los datos a través de los decoradores a la base de datos

Para temas más avanzados, consulta:
- [Consultas Avanzadas](../examples/advanced.es.md)
- [Referencia de API](./table.md)
