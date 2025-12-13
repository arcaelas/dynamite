# Table API Reference

## Descripción General

La clase `Table` es la clase base para todos los modelos en Dynamite ORM. Proporciona una API completa y tipada para realizar operaciones CRUD, consultas avanzadas, gestión de relaciones y manipulación de datos en DynamoDB.

**Características Principales:**
- Tipado estricto con TypeScript
- Operaciones CRUD completas
- Sistema de consultas flexible con múltiples operadores
- Soporte para relaciones HasMany y BelongsTo
- Gestión automática de timestamps (createdAt/updatedAt)
- Validaciones y mutaciones integradas
- Paginación y ordenamiento
- Selección de atributos específicos
- Inclusión de relaciones anidadas

## Importación

```typescript
import { Table } from '@arcaelas/dynamite';
```

## Definición de Modelo

```typescript
import { Table, Name, PrimaryKey, NotNull, Default, CreatedAt, UpdatedAt } from '@arcaelas/dynamite';

@Name("users")
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  @Default(() => 25)
  declare age: number;

  @CreatedAt()
  declare createdAt: string;

  @UpdatedAt()
  declare updatedAt: string;
}
```

---

## Constructor

### `constructor(data: InferAttributes<T>)`

Crea una nueva instancia del modelo con los datos proporcionados.

**Parámetros:**
- `data` - Objeto con los atributos del modelo (excluye relaciones y métodos)

**Características:**
- Aplica valores por defecto definidos con `@Default()`
- Inicializa propiedades declaradas en el modelo
- No persiste automáticamente en la base de datos (usar `save()` para persistir)

**Ejemplo:**

```typescript
const user = new User({
  id: "user-123",
  email: "john@example.com",
  name: "John Doe",
  age: 30
});

// Para persistir en la base de datos
await user.save();
```

---

## Métodos de Instancia

### `save(): Promise<this>`

Guarda o actualiza el registro actual en la base de datos.

**Comportamiento:**
- Si el registro no tiene `id` (o es `null`/`undefined`), crea un nuevo registro
- Si el registro tiene `id`, actualiza el registro existente
- Actualiza automáticamente el campo `updatedAt` si está definido
- Establece `createdAt` solo en registros nuevos

**Retorna:** La instancia actual actualizada

**Ejemplo:**

```typescript
// Crear nuevo registro
const user = new User({
  email: "jane@example.com",
  name: "Jane Smith"
});
await user.save(); // createdAt y updatedAt se establecen automáticamente

// Actualizar registro existente
user.name = "Jane Doe";
await user.save(); // Solo updatedAt se actualiza
```

---

### `update(patch: Partial<InferAttributes<T>>): Promise<this>`

Actualiza parcialmente el registro con los campos proporcionados.

**Parámetros:**
- `patch` - Objeto con los campos a actualizar

**Retorna:** La instancia actual actualizada

**Ejemplo:**

```typescript
const user = await User.first({ id: "user-123" });
await user.update({
  name: "John Updated",
  age: 31
});

console.log(user.name); // "John Updated"
console.log(user.age);  // 31
```

---

### `destroy(): Promise<null>`

Elimina el registro actual de la base de datos.

**Requisitos:**
- La instancia debe tener un `id` válido

**Retorna:** `null`

**Errores:**
- Lanza error si la instancia no tiene `id`

**Ejemplo:**

```typescript
const user = await User.first({ id: "user-123" });
await user.destroy(); // Elimina el registro de la base de datos
```

---

### `toJSON(): Record<string, any>`

Serializa la instancia a un objeto JSON plano.

**Características:**
- Incluye todas las columnas definidas con decoradores
- Excluye relaciones (HasMany, BelongsTo)
- Activa getters virtuales definidos en el modelo
- Incluye propiedades enumerables ad-hoc

**Retorna:** Objeto plano con los datos del modelo

**Ejemplo:**

```typescript
const user = await User.first({ id: "user-123" });
const json = user.toJSON();

console.log(json);
// {
//   id: "user-123",
//   email: "john@example.com",
//   name: "John Doe",
//   age: 30,
//   createdAt: "2025-01-15T10:30:00.000Z",
//   updatedAt: "2025-01-15T10:30:00.000Z"
// }
```

---

## Métodos Estáticos

### `create<M>(data: InferAttributes<M>): Promise<M>`

Crea y persiste un nuevo registro en la base de datos.

**Parámetros:**
- `data` - Objeto con los atributos del nuevo registro

**Características:**
- Crea una nueva instancia
- Establece automáticamente `createdAt` y `updatedAt`
- Aplica valores por defecto, validaciones y mutaciones
- Persiste inmediatamente en DynamoDB

**Retorna:** Nueva instancia del modelo persistida

**Ejemplo:**

```typescript
const user = await User.create({
  id: "user-456",
  email: "alice@example.com",
  name: "Alice Wonder",
  age: 28
});

console.log(user.id); // "user-456"
console.log(user.createdAt); // "2025-01-15T10:30:00.000Z"
```

**Con validaciones y mutaciones:**

```typescript
@Name("users")
class User extends Table<User> {
  @Mutate(v => v.toLowerCase().trim())
  @Validate(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? true : "Email inválido")
  declare email: string;
}

// El email se convertirá a minúsculas y validará el formato
const user = await User.create({
  id: "user-789",
  email: "  BOB@EXAMPLE.COM  ", // Se convierte a "bob@example.com"
  name: "Bob"
});
```

---

### `update<M>(updates: Partial<InferAttributes<M>>, filters: Partial<InferAttributes<M>>): Promise<number>`

Actualiza múltiples registros que coincidan con los filtros.

**Parámetros:**
- `updates` - Objeto con los campos a actualizar (campos `undefined` se ignoran)
- `filters` - Objeto con los criterios de selección

**Características:**
- Actualiza todos los registros que coincidan con los filtros
- Actualiza automáticamente el campo `updatedAt`
- Los campos con valor `undefined` se ignoran
- Operación atómica por cada registro

**Retorna:** Número de registros actualizados

**Ejemplo:**

```typescript
// Actualizar múltiples usuarios
const count = await User.update(
  { active: false, role: "suspended" },
  { status: "banned" }
);

console.log(`${count} usuarios suspendidos`);

// Actualizar un usuario específico
await User.update(
  { balance: 100.0 },
  { id: "user-123" }
);
```

**Actualización condicional:**

```typescript
// Desactivar usuarios inactivos
const inactiveCount = await User.update(
  { active: false },
  { lastLoginDate: "2024-01-01" } // Filtro personalizado
);
```

---

### `delete<M>(filters: Partial<InferAttributes<M>>): Promise<number>`

Elimina registros que coincidan con los filtros.

**Parámetros:**
- `filters` - Objeto con los criterios de selección

**Características:**
- Elimina todos los registros que coincidan con los filtros
- Operación permanente (no hay soft delete por defecto)
- Retorna el número de registros eliminados

**Retorna:** Número de registros eliminados

**Ejemplo:**

```typescript
// Eliminar un usuario específico
const count = await User.delete({ id: "user-123" });
console.log(`${count} usuario(s) eliminado(s)`);

// Eliminar múltiples usuarios
await User.delete({ status: "inactive", verified: false });

// Eliminar todos los registros (usar con precaución)
await User.delete({});
```

---

## Método where() - Consultas Avanzadas

El método `where()` es el método más versátil para consultar datos, con múltiples sobrecargas y opciones avanzadas.

### Sobrecarga 1: `where(field, value): Promise<M[]>`

Busca registros donde un campo es igual a un valor (o múltiples valores).

**Parámetros:**
- `field` - Nombre del campo
- `value` - Valor o array de valores (array se convierte en operador `IN`)

**Ejemplo:**

```typescript
// Igualdad simple
const admins = await User.where("role", "admin");

// IN implícito con array
const users = await User.where("role", ["admin", "employee"]);
// Equivalente a: role IN ("admin", "employee")
```

---

### Sobrecarga 2: `where(field, operator, value): Promise<M[]>`

Busca registros usando un operador específico.

**Parámetros:**
- `field` - Nombre del campo
- `operator` - Operador de comparación (ver tabla de operadores)
- `value` - Valor o array de valores (según el operador)

**Operadores Soportados:**

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `"="` | Igual a | `where("age", "=", 25)` |
| `"!="` | Diferente de | `where("status", "!=", "banned")` |
| `"<"` | Menor que | `where("age", "<", 30)` |
| `"<="` | Menor o igual que | `where("price", "<=", 100)` |
| `">"` | Mayor que | `where("balance", ">", 1000)` |
| `">="` | Mayor o igual que | `where("rating", ">=", 4)` |
| `"in"` | Incluido en array | `where("status", "in", ["active", "pending"])` |
| `"not-in"` | No incluido en array | `where("role", "not-in", ["banned"])` |
| `"contains"` | Contiene substring | `where("name", "contains", "John")` |
| `"begins-with"` | Comienza con | `where("email", "begins-with", "admin@")` |

**Ejemplos:**

```typescript
// Comparación numérica
const youngUsers = await User.where("age", "<", 30);
const richUsers = await User.where("balance", ">", 1000);

// Comparación de strings
const notBanned = await User.where("status", "!=", "banned");

// Operadores de array
const staff = await User.where("role", "in", ["admin", "employee"]);
const customers = await User.where("role", "not-in", ["admin", "employee"]);

// Operadores de texto
const johns = await User.where("name", "contains", "John");
const admins = await User.where("email", "begins-with", "admin@");
```

---

### Sobrecarga 3: `where(filters): Promise<M[]>`

Busca registros que coincidan con múltiples campos (operador AND implícito).

**Parámetros:**
- `filters` - Objeto con pares campo-valor

**Ejemplo:**

```typescript
// Múltiples condiciones (AND)
const activeAdmins = await User.where({
  role: "admin",
  active: true,
  verified: true
});

// Equivalente a: WHERE role = "admin" AND active = true AND verified = true
```

---

### Sobrecarga 4: `where(filters, options): Promise<M[]>`

Busca registros con opciones avanzadas de paginación, ordenamiento, selección de atributos e inclusión de relaciones.

**Parámetros:**
- `filters` - Objeto con pares campo-valor
- `options` - Objeto con opciones avanzadas

**Opciones Disponibles:**

```typescript
interface WhereQueryOptions<T> {
  order?: "ASC" | "DESC";        // Ordenamiento
  skip?: number;                  // Número de registros a saltar (offset)
  limit?: number;                 // Número máximo de registros a retornar
  attributes?: string[];          // Campos específicos a seleccionar
  include?: {                     // Relaciones a incluir
    [relation: string]: IncludeRelationOptions | true;
  };
}

interface IncludeRelationOptions {
  where?: Record<string, any>;   // Filtros para la relación
  attributes?: string[];          // Campos específicos de la relación
  order?: "ASC" | "DESC";        // Ordenamiento de la relación
  skip?: number;                  // Offset de la relación
  limit?: number;                 // Límite de la relación
  include?: Record<string, IncludeRelationOptions | true>; // Relaciones anidadas
}
```

**Ejemplos Completos:**

```typescript
// Paginación y ordenamiento
const users = await User.where({}, {
  limit: 10,
  skip: 20,        // Página 3 (20 registros saltados)
  order: "DESC"
});

// Selección de atributos específicos
const usernames = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Solo retorna los campos solicitados
console.log(usernames[0].id);    // "user-123"
console.log(usernames[0].name);  // "John Doe"
console.log(usernames[0].age);   // undefined (no solicitado)

// Inclusión de relaciones simples
const usersWithOrders = await User.where({}, {
  include: {
    orders: true  // Incluir todas las órdenes
  }
});

console.log(usersWithOrders[0].orders); // Array de órdenes

// Inclusión de relaciones con filtros
const usersWithCompletedOrders = await User.where({}, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 5,
      order: "DESC"
    }
  }
});

// Relaciones anidadas
const ordersWithDetails = await Order.where({}, {
  include: {
    user: true,              // Incluir usuario
    items: {                 // Incluir items de orden
      include: {
        product: {           // Incluir producto de cada item
          include: {
            category: true   // Incluir categoría de cada producto
          }
        }
      }
    }
  }
});

// Combinación completa
const result = await User.where(
  { active: true },
  {
    attributes: ["id", "name", "email"],
    limit: 20,
    skip: 0,
    order: "ASC",
    include: {
      orders: {
        where: { status: "delivered" },
        attributes: ["id", "total", "status"],
        limit: 10,
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      },
      reviews: {
        where: { rating: 5 },
        limit: 5
      }
    }
  }
);
```

---

### `first<M>(...args): Promise<M | undefined>`

Obtiene el primer registro que coincida con los criterios.

**Sobrecargas:**
- `first(field, value): Promise<M | undefined>`
- `first(field, operator, value): Promise<M | undefined>`
- `first(filters): Promise<M | undefined>`

**Características:**
- Internamente llama a `where()` con los mismos argumentos
- Retorna solo el primer resultado
- Retorna `undefined` si no se encuentra ningún registro

**Ejemplo:**

```typescript
// Buscar por campo único
const user = await User.first("id", "user-123");
if (user) {
  console.log(user.name);
}

// Buscar con operador
const admin = await User.first("role", "=", "admin");

// Buscar con múltiples condiciones
const activeAdmin = await User.first({
  role: "admin",
  active: true
});

// Verificación de existencia
const exists = (await User.first({ email: "test@example.com" })) !== undefined;
```

---

### `last<M>(...args): Promise<M | undefined>`

Obtiene el último registro que coincida con los criterios.

**Sobrecargas:**
- `last(field, value): Promise<M | undefined>`
- `last(field, operator, value): Promise<M | undefined>`
- `last(filters): Promise<M | undefined>`

**Características:**
- Similar a `first()` pero retorna el último resultado
- Útil para obtener el registro más reciente
- Internamente usa ordenamiento descendente

**Ejemplo:**

```typescript
// Obtener el último usuario creado
const latestUser = await User.last({});

// Obtener la última orden de un usuario
const lastOrder = await Order.last({ user_id: "user-123" });

// Con operador
const lastHighRating = await Review.last("rating", ">=", 4);

if (lastOrder) {
  console.log(`Última orden: ${lastOrder.id}`);
  console.log(`Total: $${lastOrder.total}`);
}
```

---

## Ejemplos de Uso Avanzado

### Consultas Complejas con Múltiples Condiciones

```typescript
// Buscar usuarios activos con balance alto
const premiumUsers = await User.where("balance", ">", 1000);
const activePremium = premiumUsers.filter(u => u.active === true);

// Alternativa: usar where anidado
const activeUsers = await User.where({ active: true });
const activePremiumAlt = activeUsers.filter(u => (u.balance as number) > 1000);
```

### Paginación Eficiente

```typescript
async function getPaginatedUsers(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;

  const users = await User.where({}, {
    limit: pageSize,
    skip: skip,
    order: "ASC"
  });

  return {
    page,
    pageSize,
    data: users,
    hasMore: users.length === pageSize
  };
}

// Uso
const page1 = await getPaginatedUsers(1, 10);
const page2 = await getPaginatedUsers(2, 10);
```

### Búsqueda de Texto

```typescript
// Buscar por nombre que contenga un texto
const johns = await User.where("name", "contains", "John");

// Buscar por email que comience con un prefijo
const adminEmails = await User.where("email", "begins-with", "admin@");

// Combinar con otros filtros
const activeJohns = johns.filter(u => u.active === true);
```

### Trabajar con Relaciones

```typescript
// HasMany: Un usuario tiene muchas órdenes
@Name("users")
class User extends Table<User> {
  @HasMany(() => Order, "user_id")
  declare orders: HasMany<Order>;
}

@Name("orders")
class Order extends Table<Order> {
  @BelongsTo(() => User, "user_id")
  declare user: BelongsTo<User>;
}

// Obtener usuario con sus órdenes
const user = await User.first({ id: "user-123" });
const userWithOrders = await User.where(
  { id: "user-123" },
  { include: { orders: true } }
);

console.log(userWithOrders[0].orders); // Array de Order

// Obtener orden con su usuario
const orderWithUser = await Order.where(
  { id: "order-456" },
  { include: { user: true } }
);

console.log(orderWithUser[0].user.name); // Nombre del usuario
```

### Relaciones Anidadas Profundas

```typescript
// Estructura: User -> Orders -> OrderItems -> Products -> Categories
const completeUserData = await User.where(
  { id: "user-123" },
  {
    include: {
      orders: {
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true
                }
              }
            }
          }
        }
      }
    }
  }
);

// Acceder a datos anidados
const user = completeUserData[0];
const firstOrder = user.orders[0];
const firstItem = firstOrder.items[0];
const product = firstItem.product;
const category = product.category;

console.log(`Categoría: ${category.name}`);
```

### Operaciones en Batch

```typescript
// Crear múltiples registros
const users = await Promise.all([
  User.create({ email: "user1@example.com", name: "User 1" }),
  User.create({ email: "user2@example.com", name: "User 2" }),
  User.create({ email: "user3@example.com", name: "User 3" })
]);

// Actualizar múltiples registros
await User.update(
  { verified: true },
  { registrationDate: "2025-01-01" }
);

// Eliminar múltiples registros
await User.delete({ status: "inactive" });
```

### Validación y Manejo de Errores

```typescript
try {
  const user = await User.create({
    email: "invalid-email",  // Email inválido
    name: "Test User"
  });
} catch (error) {
  console.error(`Validación fallida: ${error.message}`);
  // "Validación fallida: Email inválido"
}

// Verificar existencia antes de actualizar
const user = await User.first({ id: "user-123" });
if (user) {
  await user.update({ name: "New Name" });
} else {
  console.log("Usuario no encontrado");
}
```

### Selección Parcial de Campos

```typescript
// Solo obtener campos específicos (reduce transferencia de datos)
const lightUsers = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Los campos no solicitados serán undefined
console.log(lightUsers[0].id);      // "user-123"
console.log(lightUsers[0].name);    // "John Doe"
console.log(lightUsers[0].age);     // undefined
console.log(lightUsers[0].balance); // undefined
```

---

## Inferencia de Tipos

Dynamite ORM proporciona inferencia de tipos completa con TypeScript.

### InferAttributes<T>

Extrae solo los atributos (excluye métodos y relaciones).

```typescript
import type { InferAttributes } from '@arcaelas/dynamite';

type UserAttributes = InferAttributes<User>;
// {
//   id: string;
//   email: string;
//   name: string;
//   age: number;
//   createdAt: string;
//   updatedAt: string;
// }

// Uso en funciones
function createUser(data: InferAttributes<User>) {
  return User.create(data);
}
```

### CreationOptional<T>

Marca campos que son opcionales durante la creación (tienen valores por defecto).

```typescript
import { CreationOptional } from '@arcaelas/dynamite';

@Name("products")
class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @Default(() => 0)
  declare stock: CreationOptional<number>; // Opcional en create()

  @Default(() => true)
  declare active: CreationOptional<boolean>;
}

// TypeScript permite omitir campos CreationOptional
await Product.create({
  id: "prod-123",
  name: "Product Name"
  // stock y active son opcionales
});
```

### Tipos de Relaciones

```typescript
import { HasMany, BelongsTo } from '@arcaelas/dynamite';

@Name("users")
class User extends Table<User> {
  @HasMany(() => Order, "user_id")
  declare orders: HasMany<Order>; // Array de Order

  @HasMany(() => Review, "user_id")
  declare reviews: HasMany<Review>;
}

@Name("orders")
class Order extends Table<Order> {
  @BelongsTo(() => User, "user_id")
  declare user: BelongsTo<User>; // User o null
}
```

---

## Manejo de Errores

### Errores Comunes

```typescript
// 1. Validación fallida
try {
  await User.create({
    email: "invalid",
    name: "Test"
  });
} catch (error) {
  // ValidationError: Email inválido
}

// 2. Campo requerido faltante
try {
  await User.create({
    name: "Test"
    // email es @NotNull y falta
  });
} catch (error) {
  // ValidationError: email es requerido
}

// 3. Intentar destruir sin id
const user = new User({ email: "test@example.com", name: "Test" });
try {
  await user.destroy();
} catch (error) {
  // Error: destroy() requiere que la instancia tenga un id
}

// 4. Operador inválido
try {
  await User.where("age", "===", 25); // Operador inválido
} catch (error) {
  // Error: Operador inválido: ===
}
```

### Buenas Prácticas de Manejo de Errores

```typescript
async function safeCreateUser(data: InferAttributes<User>) {
  try {
    const user = await User.create(data);
    return { success: true, data: user };
  } catch (error) {
    console.error("Error creating user:", error);
    return { success: false, error: error.message };
  }
}

// Uso
const result = await safeCreateUser({
  email: "test@example.com",
  name: "Test User"
});

if (result.success) {
  console.log(`Usuario creado: ${result.data.id}`);
} else {
  console.log(`Error: ${result.error}`);
}
```

---

## Rendimiento y Optimización

### 1. Selección de Atributos Específicos

Reduce la transferencia de datos seleccionando solo los campos necesarios:

```typescript
// ❌ Mal: Obtiene todos los campos (incluye campos grandes innecesarios)
const users = await User.where({});

// ✅ Bien: Solo campos necesarios
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});
```

### 2. Paginación Efectiva

```typescript
// ✅ Usar limit para evitar cargar demasiados registros
const users = await User.where({}, {
  limit: 20,
  skip: (page - 1) * 20
});
```

### 3. Inclusión Selectiva de Relaciones

```typescript
// ❌ Mal: Incluir todas las relaciones siempre
const users = await User.where({}, {
  include: {
    orders: true,
    reviews: true,
    notifications: true
  }
});

// ✅ Bien: Solo incluir relaciones necesarias con límites
const users = await User.where({}, {
  include: {
    orders: {
      limit: 5,
      order: "DESC"
    }
  }
});
```

### 4. Operaciones en Batch

```typescript
// ✅ Crear múltiples registros en paralelo
await Promise.all([
  User.create({ email: "user1@example.com", name: "User 1" }),
  User.create({ email: "user2@example.com", name: "User 2" }),
  User.create({ email: "user3@example.com", name: "User 3" })
]);
```

---

## Restricciones y Limitaciones

### 1. Consultas AND vs OR

- `where()` con múltiples campos usa operador `AND` implícito
- No hay soporte nativo para operador `OR` en un solo `where()`
- Solución: Realizar múltiples consultas y combinar resultados

```typescript
// Solo soporta AND
const result = await User.where({
  role: "admin",
  active: true  // AND active = true
});

// Para OR, hacer múltiples consultas
const admins = await User.where({ role: "admin" });
const employees = await User.where({ role: "employee" });
const staff = [...admins, ...employees];
```

### 2. Profundidad de Relaciones

- Las relaciones anidadas pueden aumentar el tiempo de consulta exponencialmente
- Recomendación: Limitar a 3-4 niveles de profundidad
- Usar `limit` en relaciones anidadas

### 3. Scan vs Query

- `where()` internamente usa `ScanCommand` de DynamoDB
- Los scans son más lentos que queries pero más flexibles
- Para mejor rendimiento, considerar índices en DynamoDB

---

## Migración y Compatibilidad

### Desde otros ORMs

**Sequelize:**

```typescript
// Sequelize
const users = await User.findAll({ where: { role: "admin" } });

// Dynamite
const users = await User.where({ role: "admin" });
```

**TypeORM:**

```typescript
// TypeORM
const users = await userRepository.find({ where: { role: "admin" } });

// Dynamite
const users = await User.where({ role: "admin" });
```

---

## Changelog de Versiones

### v1.0.0
- ✅ Implementación completa de métodos CRUD
- ✅ Soporte para relaciones HasMany y BelongsTo
- ✅ Sistema de validaciones y mutaciones
- ✅ Paginación y ordenamiento
- ✅ Selección de atributos específicos
- ✅ Inclusión de relaciones anidadas
- ✅ Timestamps automáticos (createdAt/updatedAt)

---

## Archivo Fuente

**Ubicación:** `/tmp/dynamite/src/core/table.ts`
**Líneas de código:** 636 líneas
**Última actualización:** 2025-07-30

---

## Soporte y Contribución

- **Documentación completa:** [https://github.com/arcaelas/dynamite](https://github.com/arcaelas/dynamite)
- **Reportar bugs:** [https://github.com/arcaelas/dynamite/issues](https://github.com/arcaelas/dynamite/issues)
- **Discusiones:** [https://github.com/arcaelas/dynamite/discussions](https://github.com/arcaelas/dynamite/discussions)

---

**Nota:** Este documento fue generado a partir del código fuente real en `/tmp/dynamite/src/core/table.ts`. Para cualquier discrepancia, consulta el código fuente como fuente de verdad.
