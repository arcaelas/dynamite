# Ejemplo de Consultas Avanzadas

Este ejemplo completo demuestra patrones de consulta avanzados, paginación, filtrado, ordenamiento y operaciones de datos complejas en Dynamite ORM. Aprende cómo construir consultas eficientes y escalables para aplicaciones del mundo real.

## Tabla de Contenidos

- [Operadores de Consulta](#operadores-de-consulta)
- [Consultas de Comparación](#consultas-de-comparación)
- [Consultas de Array](#consultas-de-array)
- [Consultas de String](#consultas-de-string)
- [Paginación](#paginación)
- [Ordenamiento y Clasificación](#ordenamiento-y-clasificación)
- [Selección de Atributos](#selección-de-atributos)
- [Filtrado Complejo](#filtrado-complejo)
- [Ejemplo Completo Funcional](#ejemplo-completo-funcional)
- [Salida Esperada](#salida-esperada)
- [Optimización de Rendimiento](#optimización-de-rendimiento)
- [Mejores Prácticas](#mejores-prácticas)

## Operadores de Consulta

Dynamite soporta un rico conjunto de operadores de consulta para filtrado de datos flexible:

| Operador | Descripción | Ejemplo |
|----------|-------------|---------|
| `=` | Igual a (predeterminado) | `where("age", 25)` |
| `!=` | No igual a | `where("status", "!=", "deleted")` |
| `<` | Menor que | `where("age", "<", 18)` |
| `<=` | Menor o igual que | `where("age", "<=", 65)` |
| `>` | Mayor que | `where("score", ">", 100)` |
| `>=` | Mayor o igual que | `where("age", ">=", 18)` |
| `in` | En array | `where("role", "in", ["admin", "user"])` |
| `not-in` | No en array | `where("status", "not-in", ["banned"])` |
| `contains` | String contiene | `where("email", "contains", "gmail")` |
| `begins-with` | String comienza con | `where("name", "begins-with", "John")` |

## Consultas de Comparación

Usa operadores de comparación para comparaciones numéricas y de fechas:

### Igual A (Predeterminado)

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreationOptional
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare age: number;
  declare role: string;
}

// Igual explícito
const users1 = await User.where("age", "=", 25);

// Igual implícito (operador predeterminado)
const users2 = await User.where("age", 25);

// Sintaxis de objeto (igual implícito)
const users3 = await User.where({ age: 25 });

console.log(`Found ${users1.length} users aged 25`);
```

### No Igual A

```typescript
// Encontrar todos los usuarios no administradores
const non_admins = await User.where("role", "!=", "admin");
console.log(`Found ${non_admins.length} non-admin users`);

// Encontrar usuarios activos (no eliminados)
const active_users = await User.where("status", "!=", "deleted");
```

### Mayor Que / Menor Que

```typescript
// Encontrar adultos (edad >= 18)
const adults = await User.where("age", ">=", 18);
console.log(`Adults: ${adults.length}`);

// Encontrar menores (edad < 18)
const minors = await User.where("age", "<", 18);
console.log(`Minors: ${minors.length}`);

// Encontrar usuarios en rango de edad (18-65)
const working_age = await User.where("age", ">=", 18);
const filtered = working_age.filter(u => u.age <= 65);
console.log(`Working age: ${filtered.length}`);
```

### Comparaciones de Fecha

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;
  declare total: number;
  declare created_at: string;
}

// Órdenes después de fecha específica
const recent_orders = await Order.where(
  "created_at",
  ">=",
  "2024-01-01T00:00:00.000Z"
);

// Órdenes antes de fecha específica
const old_orders = await Order.where(
  "created_at",
  "<",
  "2023-01-01T00:00:00.000Z"
);

// Órdenes en rango de fecha
const orders_2024 = await Order.where(
  "created_at",
  ">=",
  "2024-01-01T00:00:00.000Z"
);
const q1_orders = orders_2024.filter(
  o => o.created_at < "2024-04-01T00:00:00.000Z"
);
```

## Consultas de Array

Consultar registros donde valores de campo coincidan con elementos en un array:

### Operador In

```typescript
// Encontrar usuarios con roles específicos
const privileged_users = await User.where(
  "role",
  "in",
  ["admin", "moderator", "premium"]
);

console.log(`Privileged users: ${privileged_users.length}`);

// Encontrar usuarios por múltiples IDs
const specific_users = await User.where(
  "id",
  "in",
  ["user-1", "user-2", "user-3"]
);

// Atajo: valor array implica operador "in"
const users = await User.where("id", ["user-1", "user-2", "user-3"]);
```

### Operador Not In

```typescript
// Excluir usuarios baneados y eliminados
const active_users = await User.where(
  "status",
  "not-in",
  ["banned", "deleted", "suspended"]
);

console.log(`Active users: ${active_users.length}`);

// Excluir usuarios de prueba
const real_users = await User.where(
  "email",
  "not-in",
  ["test@example.com", "demo@example.com"]
);
```

## Consultas de String

Realizar coincidencia de patrones en campos de string:

### Operador Contains

```typescript
// Encontrar usuarios de Gmail
const gmail_users = await User.where("email", "contains", "gmail");
console.log(`Gmail users: ${gmail_users.length}`);

// Encontrar usuarios con "john" en el nombre
const johns = await User.where("name", "contains", "john");

// Encontrar usuarios con dominio específico
const company_users = await User.where("email", "contains", "@company.com");
```

### Operador Begins With

```typescript
// Encontrar usuarios con nombre que comienza con "J"
const j_users = await User.where("name", "begins-with", "J");
console.log(`Names starting with J: ${j_users.length}`);

// Encontrar usuarios con prefijo específico
const admin_users = await User.where("username", "begins-with", "admin_");

// Encontrar órdenes con prefijo de ID específico
const orders_2024 = await Order.where("id", "begins-with", "2024-");
```

### Búsqueda Sin Distinción de Mayúsculas

```typescript
// Transformar a minúsculas antes de buscar
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((value) => (value as string).toLowerCase())
  declare email: string;
}

// Ahora todos los emails se almacenan en minúsculas
const users = await User.where("email", "contains", "gmail");

// Para búsqueda sin distinción de mayúsculas en campos no mutados
const all_users = await User.where({});
const filtered = all_users.filter(u =>
  u.name.toLowerCase().includes("john")
);
```

## Paginación

Implementar paginación eficiente para conjuntos de datos grandes:

### Paginación Básica

```typescript
// Página 1: Primeros 10 usuarios
const page_1 = await User.where({}, {
  limit: 10,
  skip: 0
});

// Página 2: Siguientes 10 usuarios
const page_2 = await User.where({}, {
  limit: 10,
  skip: 10
});

// Página 3: Siguientes 10 usuarios
const page_3 = await User.where({}, {
  limit: 10,
  skip: 20
});

console.log(`Page 1: ${page_1.length} users`);
console.log(`Page 2: ${page_2.length} users`);
console.log(`Page 3: ${page_3.length} users`);
```

### Función Auxiliar de Paginación

```typescript
async function paginate_users(
  page: number,
  page_size: number,
  filters: Partial<InferAttributes<User>> = {}
) {
  const skip = page * page_size;
  const users = await User.where(filters, {
    skip,
    limit: page_size
  });

  return {
    data: users,
    page,
    page_size,
    has_more: users.length === page_size
  };
}

// Uso
const result = await paginate_users(0, 10, { role: "customer" });
console.log(`Page ${result.page}: ${result.data.length} users`);
console.log(`Has more: ${result.has_more}`);
```

### Paginación Basada en Cursor

```typescript
async function paginate_by_cursor(
  last_id: string | null,
  page_size: number
) {
  let users: User[];

  if (last_id) {
    // Obtener usuarios después del cursor
    const all_users = await User.where({});
    const cursor_index = all_users.findIndex(u => u.id === last_id);
    users = all_users.slice(cursor_index + 1, cursor_index + 1 + page_size);
  } else {
    // Primera página
    users = await User.where({}, { limit: page_size });
  }

  return {
    data: users,
    next_cursor: users.length === page_size ? users[users.length - 1].id : null
  };
}

// Uso
const page_1 = await paginate_by_cursor(null, 10);
console.log(`Page 1: ${page_1.data.length} users`);

const page_2 = await paginate_by_cursor(page_1.next_cursor, 10);
console.log(`Page 2: ${page_2.data.length} users`);
```

## Ordenamiento y Clasificación

Controlar el orden de los resultados de consulta:

### Orden Ascendente

```typescript
// Ordenar por edad ascendente (más joven primero)
const users_asc = await User.where({}, {
  order: "ASC"
});

users_asc.forEach(user => {
  console.log(`${user.name}: ${user.age} years old`);
});
```

### Orden Descendente

```typescript
// Ordenar por edad descendente (más viejo primero)
const users_desc = await User.where({}, {
  order: "DESC"
});

users_desc.forEach(user => {
  console.log(`${user.name}: ${user.age} years old`);
});
```

### Ordenar por Campo Específico

```typescript
// Obtener todos los usuarios y ordenar por nombre
const all_users = await User.where({});
const sorted_by_name = all_users.sort((a, b) =>
  a.name.localeCompare(b.name)
);

// Obtener todos los usuarios y ordenar por múltiples criterios
const sorted = all_users.sort((a, b) => {
  // Primero por rol
  if (a.role !== b.role) {
    return a.role.localeCompare(b.role);
  }
  // Luego por nombre
  return a.name.localeCompare(b.name);
});
```

### Registros Recientes

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  declare title: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// Obtener 10 posts más recientes
const recent_posts = await Post.where({}, {
  order: "DESC",
  limit: 10
});

recent_posts.forEach(post => {
  const date = new Date(post.created_at);
  console.log(`${post.title} - ${date.toLocaleDateString()}`);
});
```

## Selección de Atributos

Cargar solo campos específicos para optimizar el rendimiento:

### Seleccionar Atributos Específicos

```typescript
// Cargar solo id y name
const users = await User.where({}, {
  attributes: ["id", "name"]
});

users.forEach(user => {
  console.log(`${user.id}: ${user.name}`);
  // email, age, role no están cargados
});
```

### Seleccionar para Visualización

```typescript
// Cargar datos mínimos para lista de usuarios
const user_list = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Mostrar lista de usuarios
user_list.forEach(user => {
  console.log(`${user.name} (${user.email})`);
});
```

### Seleccionar para Rendimiento

```typescript
// Cargar solo campos necesarios para cálculo
const users = await User.where({ role: "premium" }, {
  attributes: ["id", "total_spent"]
});

const total_revenue = users.reduce((sum, user) => sum + user.total_spent, 0);
console.log(`Total premium revenue: $${total_revenue}`);
```

### Combinado con Paginación

```typescript
// Lista de usuarios paginada con datos mínimos
const users = await User.where({}, {
  attributes: ["id", "name", "email", "role"],
  limit: 20,
  skip: 0,
  order: "ASC"
});

console.log(`Loaded ${users.length} users with minimal data`);
```

## Filtrado Complejo

Combinar múltiples técnicas de consulta para filtrado avanzado:

### Múltiples Condiciones

```typescript
// Encontrar adultos premium
const premium_adults = await User.where({
  role: "premium",
  age: 25
});

// Encontrar usuarios activos con rol específico
const active_admins = await User.where({
  role: "admin",
  status: "active"
});
```

### Filtrar y Paginar

```typescript
// Obtener página 2 de usuarios premium activos
const users = await User.where(
  { role: "premium", active: true },
  {
    skip: 10,
    limit: 10,
    order: "DESC"
  }
);
```

### Filtrar con Selección de Atributos

```typescript
// Obtener nombres de todos los usuarios admin
const admins = await User.where(
  { role: "admin" },
  {
    attributes: ["id", "name", "email"]
  }
);

console.log("Admin users:");
admins.forEach(admin => {
  console.log(`  - ${admin.name} (${admin.email})`);
});
```

### Lógica de Negocio Compleja

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare price: number;
  declare stock: number;
  declare category: string;
}

// Encontrar electrónicos asequibles en stock
const affordable_electronics = await Product.where({
  category: "electronics"
});

const in_stock = affordable_electronics.filter(p =>
  p.stock > 0 && p.price < 500
);

console.log(`Found ${in_stock.length} affordable electronics in stock`);
```

### Consultas de Rango de Fecha

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;
  declare total: number;
  declare status: string;
  declare created_at: string;
}

// Obtener órdenes de los últimos 30 días
const thirty_days_ago = new Date();
thirty_days_ago.setDate(thirty_days_ago.getDate() - 30);

const all_orders = await Order.where({});
const recent_orders = all_orders.filter(order =>
  new Date(order.created_at) >= thirty_days_ago
);

console.log(`Orders in last 30 days: ${recent_orders.length}`);

// Calcular ingresos totales para el período
const total = recent_orders.reduce((sum, order) => sum + order.total, 0);
console.log(`Total revenue: $${total.toFixed(2)}`);
```

## Ejemplo Completo Funcional

Aquí hay un ejemplo completo que demuestra todos los patrones de consulta avanzados:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  Validate,
  Mutate,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

// Modelo User
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  @Mutate((value) => (value as string).toLowerCase())
  declare email: string;

  declare age: number;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @Default(() => 0)
  declare total_spent: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Modelo Product
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare category: string;
  declare price: number;
  declare stock: number;

  @Default(() => true)
  declare available: CreationOptional<boolean>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// Configurar DynamoDB y registrar tablas
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User, Product],
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Aplicación principal
async function main() {
  // Conectar y sincronizar tablas
  dynamite.connect();
  await dynamite.sync();
  console.log("=== Advanced Queries Example ===\n");

  // 1. Crear usuarios de muestra
  console.log("1. Creating sample users...");
  await Promise.all([
    User.create({ name: "John Doe", email: "john@gmail.com", age: 25, role: "customer", total_spent: 150 }),
    User.create({ name: "Jane Smith", email: "jane@yahoo.com", age: 32, role: "premium", total_spent: 500 }),
    User.create({ name: "Bob Johnson", email: "bob@gmail.com", age: 45, role: "admin", total_spent: 0 }),
    User.create({ name: "Alice Williams", email: "alice@gmail.com", age: 28, role: "premium", total_spent: 750 }),
    User.create({ name: "Charlie Brown", email: "charlie@hotmail.com", age: 19, role: "customer", total_spent: 80 }),
    User.create({ name: "David Lee", email: "david@gmail.com", age: 55, role: "customer", total_spent: 200 }),
    User.create({ name: "Emma Wilson", email: "emma@yahoo.com", age: 23, role: "premium", total_spent: 1200 }),
    User.create({ name: "Frank Miller", email: "frank@gmail.com", age: 38, role: "moderator", total_spent: 350 })
  ]);
  console.log("Created 8 users\n");

  // 2. Crear productos de muestra
  console.log("2. Creating sample products...");
  await Promise.all([
    Product.create({ name: "Laptop", category: "electronics", price: 999.99, stock: 15 }),
    Product.create({ name: "Mouse", category: "electronics", price: 29.99, stock: 50 }),
    Product.create({ name: "Keyboard", category: "electronics", price: 79.99, stock: 30 }),
    Product.create({ name: "Monitor", category: "electronics", price: 299.99, stock: 0 }),
    Product.create({ name: "Desk", category: "furniture", price: 199.99, stock: 10 }),
    Product.create({ name: "Chair", category: "furniture", price: 149.99, stock: 20 })
  ]);
  console.log("Created 6 products\n");

  // 3. Consultas de comparación
  console.log("3. Comparison queries...");
  const adults = await User.where("age", ">=", 18);
  console.log(`Adults (age >= 18): ${adults.length}`);

  const seniors = await User.where("age", ">=", 55);
  console.log(`Seniors (age >= 55): ${seniors.length}`);

  const young_adults = await User.where("age", "<", 30);
  console.log(`Young adults (age < 30): ${young_adults.length}\n`);

  // 4. Consultas de array
  console.log("4. Array queries...");
  const privileged = await User.where("role", "in", ["admin", "moderator", "premium"]);
  console.log(`Privileged users: ${privileged.length}`);

  const gmail_users = await User.where("email", "contains", "gmail");
  console.log(`Gmail users: ${gmail_users.length}`);

  const j_names = await User.where("name", "begins-with", "J");
  console.log(`Names starting with J: ${j_names.length}\n`);

  // 5. Paginación
  console.log("5. Pagination...");
  const page_1 = await User.where({}, { limit: 3, skip: 0 });
  console.log(`Page 1: ${page_1.length} users`);
  page_1.forEach(u => console.log(`  - ${u.name}`));

  const page_2 = await User.where({}, { limit: 3, skip: 3 });
  console.log(`Page 2: ${page_2.length} users`);
  page_2.forEach(u => console.log(`  - ${u.name}`));
  console.log();

  // 6. Ordenamiento
  console.log("6. Sorting...");
  const sorted_users = await User.where({}, { order: "DESC" });
  console.log("Users (descending order):");
  sorted_users.slice(0, 5).forEach(u => {
    console.log(`  - ${u.name} (age: ${u.age})`);
  });
  console.log();

  // 7. Selección de atributos
  console.log("7. Attribute selection...");
  const user_list = await User.where({}, {
    attributes: ["id", "name", "email"],
    limit: 3
  });
  console.log("User summary (minimal data):");
  user_list.forEach(u => {
    console.log(`  - ${u.name}: ${u.email}`);
  });
  console.log();

  // 8. Filtrado complejo
  console.log("8. Complex filtering...");
  const premium_spenders = await User.where({ role: "premium" });
  const high_value = premium_spenders.filter(u => u.total_spent > 500);
  console.log(`Premium users with >$500 spent: ${high_value.length}`);
  high_value.forEach(u => {
    console.log(`  - ${u.name}: $${u.total_spent}`);
  });
  console.log();

  // 9. Consultas de productos
  console.log("9. Product queries...");
  const electronics = await Product.where({ category: "electronics" });
  console.log(`Electronics: ${electronics.length}`);

  const in_stock = electronics.filter(p => p.stock > 0);
  console.log(`Electronics in stock: ${in_stock.length}`);

  const affordable = in_stock.filter(p => p.price < 100);
  console.log(`Affordable electronics in stock: ${affordable.length}`);
  affordable.forEach(p => {
    console.log(`  - ${p.name}: $${p.price} (${p.stock} in stock)`);
  });
  console.log();

  // 10. Agregaciones
  console.log("10. Aggregations...");
  const all_users = await User.where({});

  // Gasto total por rol
  const by_role = all_users.reduce((acc, user) => {
    if (!acc[user.role]) acc[user.role] = 0;
    acc[user.role] += user.total_spent;
    return acc;
  }, {} as Record<string, number>);

  console.log("Total spending by role:");
  Object.entries(by_role).forEach(([role, total]) => {
    console.log(`  ${role}: $${total.toFixed(2)}`);
  });

  // Edad promedio por rol
  const age_by_role = all_users.reduce((acc, user) => {
    if (!acc[user.role]) acc[user.role] = { sum: 0, count: 0 };
    acc[user.role].sum += user.age;
    acc[user.role].count += 1;
    return acc;
  }, {} as Record<string, { sum: number; count: number }>);

  console.log("\nAverage age by role:");
  Object.entries(age_by_role).forEach(([role, data]) => {
    const avg = data.sum / data.count;
    console.log(`  ${role}: ${avg.toFixed(1)} years`);
  });
  console.log();

  // 11. Funcionalidad de búsqueda
  console.log("11. Search functionality...");
  const search_term = "john";
  const search_results = all_users.filter(user =>
    user.name.toLowerCase().includes(search_term) ||
    user.email.toLowerCase().includes(search_term)
  );
  console.log(`Search results for "${search_term}": ${search_results.length}`);
  search_results.forEach(u => {
    console.log(`  - ${u.name} (${u.email})`);
  });
  console.log();

  // 12. Consultas basadas en fecha
  console.log("12. Date-based queries...");
  const one_hour_ago = new Date();
  one_hour_ago.setHours(one_hour_ago.getHours() - 1);

  const recent_users = all_users.filter(user =>
    new Date(user.created_at) >= one_hour_ago
  );
  console.log(`Users created in last hour: ${recent_users.length}\n`);

  console.log("=== All advanced queries completed ===");
}

// Ejecutar la aplicación
main().catch(console.error);
```

## Salida Esperada

```
=== Advanced Queries Example ===

1. Creating sample users...
Created 8 users

2. Creating sample products...
Created 6 products

3. Comparison queries...
Adults (age >= 18): 8
Seniors (age >= 55): 1
Young adults (age < 30): 4

4. Array queries...
Privileged users: 5
Gmail users: 5
Names starting with J: 2

5. Pagination...
Page 1: 3 users
  - John Doe
  - Jane Smith
  - Bob Johnson
Page 2: 3 users
  - Alice Williams
  - Charlie Brown
  - David Lee

6. Sorting...
Users (descending order):
  - David Lee (age: 55)
  - Bob Johnson (age: 45)
  - Frank Miller (age: 38)
  - Jane Smith (age: 32)
  - Alice Williams (age: 28)

7. Attribute selection...
User summary (minimal data):
  - John Doe: john@gmail.com
  - Jane Smith: jane@yahoo.com
  - Bob Johnson: bob@gmail.com

8. Complex filtering...
Premium users with >$500 spent: 2
  - Alice Williams: $750
  - Emma Wilson: $1200

9. Product queries...
Electronics: 4
Electronics in stock: 3
Affordable electronics in stock: 2
  - Mouse: $29.99 (50 in stock)
  - Keyboard: $79.99 (30 in stock)

10. Aggregations...
Total spending by role:
  customer: $430.00
  premium: $2450.00
  admin: $0.00
  moderator: $350.00

Average age by role:
  customer: 33.0 years
  premium: 27.7 years
  admin: 45.0 years
  moderator: 38.0 years

11. Search functionality...
Search results for "john": 2
  - John Doe (john@gmail.com)
  - Bob Johnson (bob@gmail.com)

12. Date-based queries...
Users created in last hour: 8

=== All advanced queries completed ===
```

## Optimización de Rendimiento

### 1. Usar Selección de Atributos

```typescript
// Bueno - cargar solo campos necesarios
const users = await User.where({}, {
  attributes: ["id", "name"]
});

// Malo - cargar todos los campos cuando solo se necesitan algunos
const users = await User.where({});
```

### 2. Implementar Paginación

```typescript
// Bueno - consultas paginadas
const users = await User.where({}, {
  limit: 20,
  skip: 0
});

// Malo - cargar todos los registros a la vez
const users = await User.where({});
```

### 3. Filtrar Temprano

```typescript
// Bueno - filtrar en DynamoDB
const admins = await User.where({ role: "admin" });

// Malo - filtrar en la aplicación
const all_users = await User.where({});
const admins = all_users.filter(u => u.role === "admin");
```

### 4. Usar Índices

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // Indexar campos consultados frecuentemente
  @Index()
  declare email: string;

  @IndexSort()
  declare created_at: string;
}
```

### 5. Cachear Datos Accedidos Frecuentemente

```typescript
// Caché simple en memoria
const cache = new Map<string, any>();

async function get_user_by_id(id: string) {
  if (cache.has(id)) {
    return cache.get(id);
  }

  const user = await User.first({ id });
  if (user) {
    cache.set(id, user);
  }
  return user;
}
```

## Mejores Prácticas

### 1. Usar Operadores Específicos

```typescript
// Bueno - operador específico
const users = await User.where("age", ">=", 18);

// Malo - cargar todo y filtrar
const all_users = await User.where({});
const adults = all_users.filter(u => u.age >= 18);
```

### 2. Combinar Filtros

```typescript
// Bueno - múltiples condiciones en una consulta
const users = await User.where({
  role: "premium",
  active: true
});

// Malo - múltiples consultas separadas
const premium = await User.where({ role: "premium" });
const active_premium = premium.filter(u => u.active);
```

### 3. Paginar Resultados Grandes

```typescript
// Bueno - resultados paginados
async function* iterate_users(page_size: number) {
  let page = 0;
  while (true) {
    const users = await User.where({}, {
      skip: page * page_size,
      limit: page_size
    });

    if (users.length === 0) break;

    yield users;
    page++;
  }
}

for await (const users of iterate_users(100)) {
  // Procesar lote
}

// Malo - cargar todo
const all_users = await User.where({});
```

### 4. Seleccionar Solo Atributos Necesarios

```typescript
// Bueno - datos mínimos para visualización
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Malo - cargar todos los campos
const users = await User.where({});
```

### 5. Usar Nombres de Consulta Claros

```typescript
// Bueno - consulta descriptiva
async function get_active_premium_users() {
  return await User.where({
    role: "premium",
    active: true
  });
}

// Malo - consulta poco clara
async function get_users_1() {
  return await User.where({ role: "premium", active: true });
}
```

## Próximos Pasos

### Documentación Relacionada

- [Ejemplo de Modelo Básico](./basic-model.es.md) - Operaciones CRUD simples
- [Ejemplo de Validación](./validation.es.md) - Patrones de validación de datos
- [Ejemplo de Relaciones](./relationships.es.md) - Relaciones e includes anidados

### Referencias de API

- [API de Table](../api/table.md) - Documentación completa de la clase Table
- [Operadores de Consulta](../guides/core-concepts.md#query-operators) - Todos los operadores disponibles
- [Guía de Decoradores](../guides/decorators.md) - Todos los decoradores disponibles

¡Feliz consulta con Dynamite!
