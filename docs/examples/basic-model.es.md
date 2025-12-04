# Ejemplo de Modelo Básico

Este ejemplo demuestra una aplicación CRUD (Crear, Leer, Actualizar, Eliminar) simple usando Dynamite ORM. Construiremos un sistema completo de gestión de usuarios desde cero, cubriendo todas las operaciones esenciales.

## Tabla de Contenidos

- [Definición del Modelo](#definición-del-modelo)
- [Configuración e Inicialización](#configuración-e-inicialización)
- [Creación de Registros](#creación-de-registros)
- [Lectura de Registros](#lectura-de-registros)
- [Actualización de Registros](#actualización-de-registros)
- [Eliminación de Registros](#eliminación-de-registros)
- [Ejemplo Completo Funcional](#ejemplo-completo-funcional)
- [Salida Esperada](#salida-esperada)
- [Conceptos Clave](#conceptos-clave)
- [Próximos Pasos](#próximos-pasos)

## Definición del Modelo

Comencemos definiendo un modelo User con campos esenciales y decoradores:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

class User extends Table<User> {
  // Clave primaria auto-generada
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Campo requerido durante la creación
  declare name: string;

  // Campo de email requerido
  declare email: string;

  // Campo opcional con valor por defecto
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Estado activo opcional con valor por defecto
  @Default(() => true)
  declare active: CreationOptional<boolean>;

  // Marcas de tiempo auto-gestionadas
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}
```

**Desglose de Decoradores:**
- `@PrimaryKey()` - Marca `id` como la clave de partición en DynamoDB
- `@Default()` - Proporciona valores predeterminados automáticos cuando se omite el campo
- `@CreatedAt()` - Establece automáticamente marca de tiempo ISO en la creación del registro
- `@UpdatedAt()` - Actualiza automáticamente marca de tiempo ISO en cada guardado
- `CreationOptional<T>` - Hace el campo opcional durante la creación pero requerido en instancias

## Configuración e Inicialización

Antes de usar tus modelos, configura la conexión a DynamoDB:

```typescript
// Para desarrollo local con DynamoDB Local
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User], // Tus clases de modelo
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});
dynamite.connect();
await dynamite.sync();

// Para producción en AWS
const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User],
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});
dynamite.connect();
await dynamite.sync();
```

**Opciones de Configuración:**
- `region` - Región de AWS (ej., "us-east-1", "eu-west-1")
- `endpoint` - Endpoint de DynamoDB (usa localhost:8000 para desarrollo local)
- `tables` - Array de clases de modelo a registrar
- `credentials` - Objeto de credenciales AWS con accessKeyId y secretAccessKey

## Creación de Registros

### Creación Básica

La forma más simple de crear un registro es usando el método estático `create()`:

```typescript
// Crear solo con campos requeridos
const user1 = await User.create({
  name: "John Doe",
  email: "john@example.com"
  // id, role, active, timestamps son auto-generados
});

console.log(user1.id);         // "550e8400-e29b-41d4-a716-446655440000"
console.log(user1.name);       // "John Doe"
console.log(user1.email);      // "john@example.com"
console.log(user1.role);       // "customer" (predeterminado)
console.log(user1.active);     // true (predeterminado)
console.log(user1.created_at); // "2024-01-15T10:30:00.000Z"
console.log(user1.updated_at); // "2024-01-15T10:30:00.000Z"
```

### Creación con Todos los Campos

Puedes sobrescribir valores predeterminados durante la creación:

```typescript
const user2 = await User.create({
  id: "custom-user-id",
  name: "Jane Smith",
  email: "jane@example.com",
  role: "admin",
  active: true
});

console.log(user2.id);   // "custom-user-id" (personalizado)
console.log(user2.role); // "admin" (valor predeterminado sobrescrito)
```

### Creación Masiva

Crea múltiples registros eficientemente usando `Promise.all()`:

```typescript
const users = await Promise.all([
  User.create({
    name: "Alice Johnson",
    email: "alice@example.com"
  }),
  User.create({
    name: "Bob Williams",
    email: "bob@example.com",
    role: "moderator"
  }),
  User.create({
    name: "Charlie Brown",
    email: "charlie@example.com"
  })
]);

console.log(`Created ${users.length} users`);
// Salida: Created 3 users
```

## Lectura de Registros

### Obtener Todos los Registros

Recuperar todos los registros de la tabla:

```typescript
const all_users = await User.where({});
console.log(`Total users: ${all_users.length}`);

// Iterar a través de resultados
all_users.forEach(user => {
  console.log(`${user.name} (${user.email})`);
});
```

### Filtrar por Coincidencia Exacta

Consultar registros que coincidan con valores de campo específicos:

```typescript
// Filtro de un solo campo
const admins = await User.where({ role: "admin" });
console.log(`Found ${admins.length} admin users`);

// Filtros de múltiples campos (condición AND)
const active_admins = await User.where({
  role: "admin",
  active: true
});
console.log(`Found ${active_admins.length} active admin users`);
```

### Obtener Primer o Último Registro

Recuperar el primer o último registro que coincida con los criterios:

```typescript
// Obtener primer usuario
const first_user = await User.first({});
console.log(`First user: ${first_user?.name}`);

// Obtener primer admin
const first_admin = await User.first({ role: "admin" });
console.log(`First admin: ${first_admin?.name}`);

// Obtener último usuario
const last_user = await User.last({});
console.log(`Last user: ${last_user?.name}`);

// Obtener último cliente
const last_customer = await User.last({ role: "customer" });
console.log(`Last customer: ${last_customer?.name}`);
```

### Consultar por Campo y Valor

Usar firma de método con nombre de campo y valor:

```typescript
// Consulta por un solo campo
const johns = await User.where("name", "John Doe");
console.log(`Found ${johns.length} users named John Doe`);

// Consulta con valor array (operador IN)
const specific_users = await User.where("id", [
  "user-1",
  "user-2",
  "user-3"
]);
console.log(`Found ${specific_users.length} specific users`);
```

### Consultar con Opciones

Usar opciones de consulta para paginación, ordenamiento y selección de atributos:

```typescript
// Limitar resultados
const first_10 = await User.where({}, { limit: 10 });
console.log(`Retrieved ${first_10.length} users`);

// Paginación (skip y limit)
const page_2 = await User.where({}, {
  skip: 10,
  limit: 10
});
console.log(`Page 2: ${page_2.length} users`);

// Orden de clasificación (ASC o DESC)
const sorted_users = await User.where({}, {
  order: "DESC"
});

// Seleccionar solo atributos específicos
const user_summaries = await User.where({}, {
  attributes: ["id", "name", "email"]
});

user_summaries.forEach(user => {
  console.log(`${user.name}: ${user.email}`);
  // role, active, timestamps no están cargados
});
```

## Actualización de Registros

### Usando el Método de Instancia `save()`

Modificar propiedades de instancia y llamar a `save()`:

```typescript
// Obtener un usuario
const user = await User.first({ email: "john@example.com" });

if (user) {
  // Modificar propiedades
  user.name = "John Smith";
  user.role = "premium";

  // Guardar cambios
  await user.save();

  console.log(`Updated user: ${user.name}`);
  console.log(`Updated at: ${user.updated_at}`);
  // marca de tiempo updated_at se actualiza automáticamente
}
```

### Usando el Método de Instancia `update()`

Actualizar múltiples campos a la vez:

```typescript
const user = await User.first({ email: "john@example.com" });

if (user) {
  await user.update({
    name: "John Smith",
    role: "premium",
    active: true
  });

  console.log(`User updated: ${user.name}`);
}
```

### Usando el Método Estático `update()`

Actualizar registros por criterios de filtro:

```typescript
// Actualizar todos los usuarios que coincidan con el filtro
const updated_count = await User.update(
  { name: "John A. Smith", role: "premium" },
  { email: "john@example.com" }
);

console.log(`Updated ${updated_count} user(s)`);
```

### Actualizaciones en Lote

Actualizar múltiples registros eficientemente:

```typescript
// Obtener todos los clientes
const customers = await User.where({ role: "customer" });

// Actualizar todos a premium
await Promise.all(customers.map(user => {
  user.role = "premium";
  return user.save();
}));

console.log(`Upgraded ${customers.length} customers to premium`);
```

### Actualizaciones Condicionales

Actualizar solo registros que coincidan con condiciones específicas:

```typescript
// Obtener usuarios inactivos
const inactive_users = await User.where({ active: false });

// Reactivar usuarios creados en el último mes
const one_month_ago = new Date();
one_month_ago.setMonth(one_month_ago.getMonth() - 1);

const reactivated = await Promise.all(
  inactive_users
    .filter(user => new Date(user.created_at) > one_month_ago)
    .map(user => {
      user.active = true;
      return user.save();
    })
);

console.log(`Reactivated ${reactivated.length} users`);
```

## Eliminación de Registros

### Usando el Método de Instancia `destroy()`

Eliminar una instancia específica:

```typescript
const user = await User.first({ email: "john@example.com" });

if (user) {
  await user.destroy();
  console.log(`Deleted user: ${user.name}`);
}
```

### Usando el Método Estático `delete()`

Eliminar registros que coincidan con criterios de filtro:

```typescript
// Eliminar por filtro
const deleted_count = await User.delete({ email: "john@example.com" });
console.log(`Deleted ${deleted_count} user(s)`);

// Eliminar múltiples usuarios
const deleted_inactive = await User.delete({ active: false });
console.log(`Deleted ${deleted_inactive} inactive user(s)`);
```

### Eliminación en Lote

Eliminar múltiples registros eficientemente:

```typescript
// Obtener todos los usuarios inactivos
const inactive_users = await User.where({ active: false });

// Eliminar todos los usuarios inactivos
await Promise.all(inactive_users.map(user => user.destroy()));

console.log(`Deleted ${inactive_users.length} inactive users`);
```

### Eliminación Condicional

Eliminar solo registros que coincidan con criterios complejos:

```typescript
// Obtener todos los usuarios
const all_users = await User.where({});

// Eliminar usuarios inactivos antiguos (inactivos por más de 6 meses)
const six_months_ago = new Date();
six_months_ago.setMonth(six_months_ago.getMonth() - 6);

const to_delete = all_users.filter(user =>
  !user.active && new Date(user.updated_at) < six_months_ago
);

await Promise.all(to_delete.map(user => user.destroy()));

console.log(`Deleted ${to_delete.length} old inactive users`);
```

## Ejemplo Completo Funcional

Aquí hay un ejemplo completo y ejecutable que demuestra todas las operaciones CRUD:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

// Definir modelo User
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Configurar conexión DynamoDB y registrar tabla User
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User],
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
  console.log("=== User Management System ===\n");

  // 1. CREATE - Agregar nuevos usuarios
  console.log("1. Creating users...");
  const user1 = await User.create({
    name: "John Doe",
    email: "john@example.com"
  });
  console.log(`Created: ${user1.name} (${user1.id})`);

  const user2 = await User.create({
    name: "Jane Smith",
    email: "jane@example.com",
    role: "admin"
  });
  console.log(`Created: ${user2.name} (${user2.id})`);

  const user3 = await User.create({
    name: "Bob Johnson",
    email: "bob@example.com"
  });
  console.log(`Created: ${user3.name} (${user3.id})\n`);

  // 2. READ - Obtener todos los usuarios
  console.log("2. Listing all users...");
  const all_users = await User.where({});
  console.log(`Total users: ${all_users.length}`);
  all_users.forEach(user => {
    console.log(`  - ${user.name} (${user.role})`);
  });
  console.log();

  // 3. READ - Filtrar por rol
  console.log("3. Filtering users by role...");
  const customers = await User.where({ role: "customer" });
  console.log(`Customers: ${customers.length}`);
  customers.forEach(user => {
    console.log(`  - ${user.name}`);
  });
  console.log();

  // 4. READ - Obtener primero y último
  console.log("4. Getting first and last users...");
  const first_user = await User.first({});
  const last_user = await User.last({});
  console.log(`First user: ${first_user?.name}`);
  console.log(`Last user: ${last_user?.name}\n`);

  // 5. READ - Consultar con opciones
  console.log("5. Getting users with specific attributes...");
  const user_summaries = await User.where({}, {
    attributes: ["id", "name", "email"]
  });
  user_summaries.forEach(user => {
    console.log(`  - ${user.name}: ${user.email}`);
  });
  console.log();

  // 6. UPDATE - Modificar un usuario
  console.log("6. Updating user...");
  const user_to_update = await User.first({ name: "John Doe" });
  if (user_to_update) {
    user_to_update.name = "John A. Doe";
    user_to_update.role = "premium";
    await user_to_update.save();
    console.log(`Updated: ${user_to_update.name} (${user_to_update.role})\n`);
  }

  // 7. UPDATE - Actualización en lote
  console.log("7. Batch updating customers to premium...");
  const customers_to_upgrade = await User.where({ role: "customer" });
  await Promise.all(customers_to_upgrade.map(user => {
    user.role = "premium";
    return user.save();
  }));
  console.log(`Upgraded ${customers_to_upgrade.length} customers\n`);

  // 8. READ - Verificar actualizaciones
  console.log("8. Verifying updates...");
  const premium_users = await User.where({ role: "premium" });
  console.log(`Premium users: ${premium_users.length}`);
  premium_users.forEach(user => {
    console.log(`  - ${user.name}`);
  });
  console.log();

  // 9. DELETE - Eliminar un usuario
  console.log("9. Deleting a user...");
  const user_to_delete = await User.first({ name: "Bob Johnson" });
  if (user_to_delete) {
    await user_to_delete.destroy();
    console.log(`Deleted: ${user_to_delete.name}\n`);
  }

  // 10. READ - Conteo final
  console.log("10. Final user count...");
  const final_users = await User.where({});
  console.log(`Total users: ${final_users.length}`);
  final_users.forEach(user => {
    console.log(`  - ${user.name} (${user.role})`);
  });
  console.log();

  console.log("=== All operations completed successfully ===");
}

// Ejecutar la aplicación
main().catch(console.error);
```

## Salida Esperada

Cuando ejecutes el ejemplo completo, deberías ver una salida similar a esta:

```
=== User Management System ===

1. Creating users...
Created: John Doe (550e8400-e29b-41d4-a716-446655440000)
Created: Jane Smith (6ba7b810-9dad-11d1-80b4-00c04fd430c8)
Created: Bob Johnson (6ba7b811-9dad-11d1-80b4-00c04fd430c9)

2. Listing all users...
Total users: 3
  - John Doe (customer)
  - Jane Smith (admin)
  - Bob Johnson (customer)

3. Filtering users by role...
Customers: 2
  - John Doe
  - Bob Johnson

4. Getting first and last users...
First user: John Doe
Last user: Bob Johnson

5. Getting users with specific attributes...
  - John Doe: john@example.com
  - Jane Smith: jane@example.com
  - Bob Johnson: bob@example.com

6. Updating user...
Updated: John A. Doe (premium)

7. Batch updating customers to premium...
Upgraded 1 customers

8. Verifying updates...
Premium users: 2
  - John A. Doe
  - Bob Johnson

9. Deleting a user...
Deleted: Bob Johnson

10. Final user count...
Total users: 2
  - John A. Doe (premium)
  - Jane Smith (admin)

=== All operations completed successfully ===
```

## Conceptos Clave

### 1. Definición de Modelo

Los modelos son clases TypeScript que extienden `Table<T>`:

```typescript
class User extends Table<User> {
  // Definiciones de campos con decoradores
}
```

El parámetro genérico `<User>` proporciona seguridad de tipos en todo el ORM.

### 2. Decoradores

Los decoradores definen el comportamiento del campo:

- **@PrimaryKey()** - Marca la clave de partición (requerido para cada modelo)
- **@Default()** - Proporciona valores predeterminados automáticos
- **@CreatedAt()** - Establece automáticamente marca de tiempo en la creación
- **@UpdatedAt()** - Actualiza automáticamente marca de tiempo al guardar

### 3. Seguridad de Tipos

El tipo `CreationOptional<T>` hace que los campos sean opcionales durante la creación pero requeridos en instancias:

```typescript
@Default(() => "customer")
declare role: CreationOptional<string>;

// Durante la creación:
await User.create({ name: "John" }); // role es opcional

// En instancia:
const user = await User.first({});
console.log(user.role); // role está garantizado que existe (string)
```

### 4. Métodos de Consulta

Dynamite proporciona métodos de consulta flexibles:

- `where()` - Filtrar registros con varias firmas
- `first()` - Obtener primer registro que coincida
- `last()` - Obtener último registro que coincida
- `create()` - Crear nuevo registro
- `update()` - Actualizar registros
- `delete()` - Eliminar registros

### 5. Métodos de Instancia vs Estáticos

**Métodos de instancia** operan en un registro específico:
```typescript
const user = await User.first({ id: "123" });
user.name = "New Name";
await user.save();
await user.destroy();
```

**Métodos estáticos** operan en la clase del modelo:
```typescript
await User.create({ name: "John" });
await User.where({ role: "admin" });
await User.update({ name: "New" }, { id: "123" });
await User.delete({ id: "123" });
```

### 6. Marcas de Tiempo

Los campos de marca de tiempo se gestionan automáticamente:

```typescript
@CreatedAt()
declare created_at: CreationOptional<string>;

@UpdatedAt()
declare updated_at: CreationOptional<string>;
```

- `created_at` se establece una vez en la creación
- `updated_at` se actualiza en cada llamada a `save()`

### 7. Valores Predeterminados

Los valores predeterminados pueden ser estáticos o dinámicos:

```typescript
// Predeterminado estático
@Default("customer")
declare role: CreationOptional<string>;

// Predeterminado dinámico (función)
@Default(() => crypto.randomUUID())
declare id: CreationOptional<string>;

@Default(() => new Date().toISOString())
declare joined_date: CreationOptional<string>;
```

## Próximos Pasos

Ahora que entiendes las operaciones CRUD básicas, explora estos temas avanzados:

### Documentación Relacionada

- [Ejemplo de Validación](./validation.es.md) - Patrones de validación y transformación de datos
- [Ejemplo de Relaciones](./relationships.es.md) - Relaciones uno-a-muchos y muchos-a-uno
- [Ejemplo de Consultas Avanzadas](./advanced-queries.es.md) - Consultas complejas, paginación y filtrado

### Referencias de API

- [Referencia de API de Table](../api/table.md) - Documentación completa de la clase Table
- [Guía de Decoradores](../guides/decorators.md) - Todos los decoradores disponibles
- [Conceptos Básicos](../guides/core-concepts.md) - Inmersión profunda en la arquitectura de Dynamite

### Mejores Prácticas

1. **Siempre define una clave primaria** con el decorador `@PrimaryKey()`
2. **Usa CreationOptional** para campos con `@Default`, `@CreatedAt`, `@UpdatedAt`
3. **Selecciona atributos específicos** cuando no necesites todos los campos (reduce la transferencia de datos)
4. **Usa operaciones en lote** para mejor rendimiento con múltiples registros
5. **Maneja errores** con bloques try-catch en código de producción
6. **Valida marcas de tiempo** antes de usarlas en cálculos de fechas

### Patrones Comunes

**Patrón de Eliminación Suave:**
```typescript
class User extends Table<User> {
  @Default(() => false)
  declare deleted: CreationOptional<boolean>;

  @Default(() => null)
  declare deleted_at: CreationOptional<string | null>;
}

// Eliminación suave
user.deleted = true;
user.deleted_at = new Date().toISOString();
await user.save();

// Consultar solo usuarios activos
const active_users = await User.where({ deleted: false });
```

**Patrón de Paginación:**
```typescript
async function get_paginated_users(page: number, page_size: number) {
  return await User.where({}, {
    skip: page * page_size,
    limit: page_size
  });
}

const page_1 = await get_paginated_users(0, 10); // Primeros 10 usuarios
const page_2 = await get_paginated_users(1, 10); // Siguientes 10 usuarios
```

**Patrón de Búsqueda:**
```typescript
async function search_users(query: string) {
  const all_users = await User.where({});
  return all_users.filter(user =>
    user.name.toLowerCase().includes(query.toLowerCase()) ||
    user.email.toLowerCase().includes(query.toLowerCase())
  );
}

const results = await search_users("john");
```

### Solución de Problemas

**Problema: "Metadata not found"**
- Asegúrate de llamar `dynamite.connect()` y `await dynamite.sync()` antes de usar modelos
- Verifica importaciones circulares

**Problema: "Primary key missing"**
- Agrega el decorador `@PrimaryKey()` a al menos un campo
- O usa el decorador `@Index()` (alias para PrimaryKey)

**Problema: "Record not updating"**
- Llama a `save()` después de modificar propiedades de instancia
- Verifica que las marcas de tiempo usen `CreationOptional`

**Problema: "Query returns empty array"**
- Verifica que los criterios de filtro coincidan con los datos reales
- Verifica que el nombre de la tabla coincida con la tabla de DynamoDB (usa `@Name()` si es personalizado)

## Recursos Adicionales

- [Repositorio de GitHub](https://github.com/arcaelas/dynamite)
- [Guía de Inicio](../guides/getting-started.md)
- [Conceptos Básicos](../guides/core-concepts.md)

¡Feliz codificación con Dynamite!
