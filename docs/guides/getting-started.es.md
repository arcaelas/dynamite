# Primeros Pasos con Dynamite

¡Bienvenido a Dynamite! Esta guía te llevará a través de todo lo que necesitas saber para comenzar a construir aplicaciones con este moderno ORM basado en decoradores para DynamoDB.

## Requisitos Previos

Antes de comenzar, asegúrate de tener:
- Node.js 16+ instalado
- Conocimientos básicos de TypeScript
- Cuenta de AWS (o DynamoDB Local para desarrollo)

## Instalación

```bash
npm install @arcaelas/dynamite

# Dependencias peer (si no están ya instaladas)
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Configuración

Primero, define tus modelos (ver Paso 1), luego configura tu conexión a DynamoDB:

```typescript
import { Dynamite } from "@arcaelas/dynamite";

// Para desarrollo local
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User, Order], // Tus clases de modelo
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
  tables: [User, Order],
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});
dynamite.connect();
await dynamite.sync();
```

## Paso 1: Tu Primer Modelo

Vamos a crear un modelo simple de Usuario. En Dynamite, los modelos son clases que extienden `Table` y usan decoradores para definir su estructura.

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Clave primaria con UUID autogenerado
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Campo requerido durante la creación
  declare name: string;

  // Campo opcional con valor por defecto
  @Default(() => "customer")
  declare role: CreationOptional<string>;
}
```

**Conceptos clave:**
- `@PrimaryKey()` marca la clave primaria (partition key en DynamoDB)
- `@Default()` proporciona valores por defecto automáticos
- `CreationOptional<T>` hace que los campos sean opcionales durante la creación pero requeridos en instancias
- `declare` es sintaxis de TypeScript para propiedades de clase

## Paso 2: Crear Registros

Hay múltiples formas de crear registros en Dynamite:

### Usando el método `create()`

```typescript
// Crear con solo los campos requeridos
const user1 = await User.create({
  name: "John Doe"
  // id y role son opcionales (autogenerados/con valor por defecto)
});

console.log(user1.id);   // "550e8400-e29b-41d4-a716-446655440000"
console.log(user1.name); // "John Doe"
console.log(user1.role); // "customer"

// Crear con todos los campos
const user2 = await User.create({
  id: "custom-id",
  name: "Jane Smith",
  role: "admin"
});
```

### Crear múltiples registros

```typescript
const users = await Promise.all([
  User.create({ name: "Alice" }),
  User.create({ name: "Bob" }),
  User.create({ name: "Charlie" })
]);

console.log(`Creados ${users.length} usuarios`);
```

## Paso 3: Leer Registros

Dynamite proporciona varios métodos para consultar tus datos:

### Obtener todos los registros

```typescript
const all_users = await User.where({});
console.log(`Total de usuarios: ${all_users.length}`);
```

### Filtrar por campos

```typescript
// Filtrar por coincidencia exacta
const admins = await User.where({ role: "admin" });

// Filtrar por múltiples condiciones
const admin_johns = await User.where({
  name: "John Doe",
  role: "admin"
});
```

### Obtener el primer o último registro

```typescript
// Obtener primer usuario
const first_user = await User.first({});

// Obtener primer administrador
const first_admin = await User.first({ role: "admin" });

// Obtener último usuario
const last_user = await User.last({});
```

### Consultas avanzadas con operadores

```typescript
// Mayor o igual que
const premium_users = await User.where("id", ">=", "user-100");

// Cadena contiene
const gmail_users = await User.where("name", "contains", "gmail");

// En array
const special_roles = await User.where("role", "in", ["admin", "premium", "vip"]);

// No igual
const non_customers = await User.where("role", "!=", "customer");
```

### Consultas con opciones

```typescript
// Limitar resultados
const first_10_users = await User.where({}, { limit: 10 });

// Paginación (skip y limit)
const page_2_users = await User.where({}, {
  limit: 10,
  skip: 10
});

// Orden de clasificación
const sorted_users = await User.where({}, { order: "DESC" });

// Seleccionar atributos específicos
const user_names = await User.where({}, {
  attributes: ["id", "name"]
});
```

## Paso 4: Actualizar Registros

Puedes actualizar registros usando métodos de instancia o métodos estáticos:

### Usando el método de instancia `save()`

```typescript
// Obtener un usuario
const user = await User.first({ name: "John Doe" });

if (user) {
  // Modificar propiedades
  user.name = "John Smith";
  user.role = "premium";

  // Guardar cambios
  await user.save();

  console.log("Usuario actualizado exitosamente");
}
```

### Usando el método de instancia `update()`

```typescript
const user = await User.first({ name: "John Doe" });

if (user) {
  // Actualizar múltiples campos a la vez
  await user.update({
    name: "John Smith",
    role: "premium"
  });
}
```

### Usando el método estático `update()`

```typescript
// Actualizar por filtro - retorna número de registros actualizados
await User.update(
  { name: "John Smith", role: "premium" },  // actualizaciones
  { id: "user-123" }                        // filtros
);
```

### Actualizaciones en lote

```typescript
const users = await User.where({ role: "customer" });

// Actualizar todos los clientes a premium
await Promise.all(users.map(user => {
  user.role = "premium";
  return user.save();
}));
```

## Paso 5: Eliminar Registros

Elimina registros usando métodos de instancia o estáticos:

### Usando el método de instancia `destroy()`

```typescript
const user = await User.first({ name: "John Doe" });

if (user) {
  await user.destroy();
  console.log("Usuario eliminado");
}
```

### Usando el método estático `delete()`

```typescript
// Eliminar por ID
await User.delete("user-123");
```

### Eliminación en lote

```typescript
const inactive_users = await User.where({ active: false });

// Eliminar todos los usuarios inactivos
await Promise.all(inactive_users.map(user => user.destroy()));
```

## Paso 6: Agregar Timestamps

Los timestamps rastrean cuándo se crean y actualizan los registros. Usa los decoradores `@CreatedAt` y `@UpdatedAt`:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Auto-establecido en la creación
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Auto-actualizado al guardar
  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Uso
const user = await User.create({ name: "John Doe" });

console.log(user.created_at); // "2024-01-15T10:30:00.000Z"
console.log(user.updated_at); // "2024-01-15T10:30:00.000Z"

// Actualizar usuario
user.name = "John Smith";
await user.save();

console.log(user.updated_at); // "2024-01-15T10:35:00.000Z" (¡actualizado!)
```

## Paso 7: Ejemplo Completo Funcional

Aquí hay un ejemplo completo que une todo - un sistema simple de gestión de tareas:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  Validate,
  Mutate,
  NotNull,
  CreationOptional,
  NonAttribute,
  Dynamite
} from "@arcaelas/dynamite";

// Definir modelo Task primero
class Task extends Table<Task> {
  // ID autogenerado
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Título requerido con validación
  @NotNull()
  @Mutate((value) => (value as string).trim())
  @Validate((value) => (value as string).length >= 3 || "El título debe tener al menos 3 caracteres")
  declare title: string;

  // Descripción opcional
  @Default(() => "")
  declare description: CreationOptional<string>;

  // Estado con valor por defecto
  @Default(() => "pending")
  @Validate((value) => ["pending", "in_progress", "completed"].includes(value as string) || "Estado inválido")
  declare status: CreationOptional<string>;

  // Prioridad con validación
  @Default(() => 1)
  @Validate((value) => (value as number) >= 1 && (value as number) <= 5 || "La prioridad debe estar entre 1 y 5")
  declare priority: CreationOptional<number>;

  // Timestamps
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  // Propiedad computada (no almacenada en base de datos)
  declare display_title: NonAttribute<string>;

  constructor(data?: any) {
    super(data);

    // Definir propiedad computada
    Object.defineProperty(this, 'display_title', {
      get: () => `[${this.status.toUpperCase()}] ${this.title}`,
      enumerable: true
    });
  }
}

// Configurar y conectar a DynamoDB
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [Task],
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});
dynamite.connect();
await dynamite.sync();

// Aplicación principal
async function main() {
  console.log("=== Sistema de Gestión de Tareas ===\n");

  // 1. Crear tareas
  console.log("1. Creando tareas...");
  const task1 = await Task.create({
    title: "Escribir documentación",
    description: "Completar la guía de primeros pasos",
    priority: 3
  });
  console.log(`Creada: ${task1.display_title}`);

  const task2 = await Task.create({
    title: "Corregir error en API",
    priority: 5
  });
  console.log(`Creada: ${task2.display_title}`);

  const task3 = await Task.create({
    title: "Revisar pull request",
    priority: 2
  });
  console.log(`Creada: ${task3.display_title}\n`);

  // 2. Obtener todas las tareas
  console.log("2. Listando todas las tareas...");
  const all_tasks = await Task.where({});
  all_tasks.forEach(task => {
    console.log(`  - ${task.title} (Prioridad: ${task.priority})`);
  });
  console.log();

  // 3. Filtrar tareas por estado
  console.log("3. Filtrando tareas pendientes...");
  const pending_tasks = await Task.where({ status: "pending" });
  console.log(`Encontradas ${pending_tasks.length} tareas pendientes\n`);

  // 4. Consultar tareas de alta prioridad
  console.log("4. Buscando tareas de alta prioridad (prioridad >= 4)...");
  const high_priority = await Task.where("priority", ">=", 4);
  high_priority.forEach(task => {
    console.log(`  - ${task.display_title} (Prioridad: ${task.priority})`);
  });
  console.log();

  // 5. Actualizar una tarea
  console.log("5. Actualizando estado de tarea...");
  const task_to_update = await Task.first({ title: "Escribir documentación" });
  if (task_to_update) {
    task_to_update.status = "in_progress";
    await task_to_update.save();
    console.log(`Actualizada: ${task_to_update.display_title}\n`);
  }

  // 6. Obtener tareas con atributos específicos
  console.log("6. Obteniendo resúmenes de tareas (solo id y título)...");
  const summaries = await Task.where({}, {
    attributes: ["id", "title", "status"]
  });
  summaries.forEach(task => {
    console.log(`  - ${task.title}: ${task.status}`);
  });
  console.log();

  // 7. Obtener tareas ordenadas por prioridad
  console.log("7. Listando tareas por prioridad (descendente)...");
  const ordered_tasks = await Task.where({}, { order: "DESC" });
  ordered_tasks.forEach(task => {
    console.log(`  - [P${task.priority}] ${task.title}`);
  });
  console.log();

  // 8. Marcar tareas como completadas
  console.log("8. Marcando todas las tareas pendientes como completadas...");
  const pending = await Task.where({ status: "pending" });
  await Promise.all(pending.map(task => {
    task.status = "completed";
    return task.save();
  }));
  console.log(`Completadas ${pending.length} tareas\n`);

  // 9. Obtener tareas completadas
  console.log("9. Listando tareas completadas...");
  const completed = await Task.where({ status: "completed" });
  completed.forEach(task => {
    console.log(`  - ${task.title} (Creada: ${new Date(task.created_at).toLocaleDateString()})`);
  });
  console.log();

  // 10. Eliminar una tarea
  console.log("10. Eliminando una tarea...");
  const task_to_delete = await Task.first({ title: "Revisar pull request" });
  if (task_to_delete) {
    await task_to_delete.destroy();
    console.log(`Eliminada: ${task_to_delete.title}\n`);
  }

  // Conteo final
  const final_count = await Task.where({});
  console.log(`=== Conteo final de tareas: ${final_count.length} ===`);
}

// Ejecutar la aplicación
main().catch(console.error);
```

**Salida esperada:**
```
=== Sistema de Gestión de Tareas ===

1. Creando tareas...
Creada: [PENDING] Escribir documentación
Creada: [PENDING] Corregir error en API
Creada: [PENDING] Revisar pull request

2. Listando todas las tareas...
  - Escribir documentación (Prioridad: 3)
  - Corregir error en API (Prioridad: 5)
  - Revisar pull request (Prioridad: 2)

3. Filtrando tareas pendientes...
Encontradas 3 tareas pendientes

4. Buscando tareas de alta prioridad (prioridad >= 4)...
  - [PENDING] Corregir error en API (Prioridad: 5)

5. Actualizando estado de tarea...
Actualizada: [IN_PROGRESS] Escribir documentación

6. Obteniendo resúmenes de tareas (solo id y título)...
  - Escribir documentación: in_progress
  - Corregir error en API: pending
  - Revisar pull request: pending

7. Listando tareas por prioridad (descendente)...
  - [P5] Corregir error en API
  - [P3] Escribir documentación
  - [P2] Revisar pull request

8. Marcando todas las tareas pendientes como completadas...
Completadas 2 tareas

9. Listando tareas completadas...
  - Corregir error en API (Creada: 15/1/2024)
  - Revisar pull request (Creada: 15/1/2024)

10. Eliminando una tarea...
Eliminada: Revisar pull request

=== Conteo final de tareas: 2 ===
```

## Comprendiendo el Ejemplo

Desglosemos las partes clave:

### Definición del Modelo
```typescript
class Task extends Table<Task> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;
  // ...
}
```
- Extiende `Table<Task>` para funcionalidad ORM
- Los decoradores definen el comportamiento de los campos
- `CreationOptional` hace que los campos sean opcionales durante la creación

### Validación de Datos
```typescript
@Validate((value) => (value as string).length >= 3 || "El título debe tener al menos 3 caracteres")
declare title: string;
```
- Valida datos antes de guardar
- Devuelve `true` o cadena de mensaje de error

### Transformación de Datos
```typescript
@Mutate((value) => (value as string).trim())
declare title: string;
```
- Transforma datos antes del almacenamiento
- Útil para normalización (trim, lowercase, etc.)

### Propiedades Computadas
```typescript
declare display_title: NonAttribute<string>;

constructor(data?: any) {
  super(data);
  Object.defineProperty(this, 'display_title', {
    get: () => `[${this.status.toUpperCase()}] ${this.title}`,
    enumerable: true
  });
}
```
- `NonAttribute` excluye de la base de datos
- Computado dinámicamente desde otros campos
- No almacenado, recalculado al acceder

## Siguientes Pasos

Ahora que comprendes los conceptos básicos, explora estos temas avanzados:

### Conceptos Básicos
Aprende sobre los conceptos fundamentales y la arquitectura:
- [Conceptos Básicos](./core-concepts.es.md) - Inmersión profunda en decoradores, modelos y relaciones

### Características Avanzadas
- **Relaciones** - Define relaciones uno a muchos y muchos a uno
- **Consultas Complejas** - Filtrado avanzado y construcción de consultas
- **Validación de Datos** - Validadores y transformaciones personalizadas
- **Tipos TypeScript** - Seguridad de tipos completa con `CreationOptional` y `NonAttribute`

### Mejores Prácticas
- Siempre define un `@PrimaryKey()`
- Usa `CreationOptional` para campos con `@Default`, `@CreatedAt`, `@UpdatedAt`
- Usa `NonAttribute` para propiedades computadas
- Valida entrada del usuario con `@Validate`
- Transforma datos con `@Mutate` antes de la validación
- Usa selección de atributos específicos para reducir transferencia de datos
- Maneja errores con gracia usando bloques try-catch

### Recursos Adicionales
- [Referencia de API](../api/table.md) - Documentación completa de la API
- [Ejemplos](../../examples/) - Más ejemplos de código
- [GitHub Issues](https://github.com/arcaelas/dynamite/issues) - Problemas comunes y soluciones

## Referencia Rápida

### Decoradores Esenciales
| Decorador | Propósito | Ejemplo |
|-----------|---------|---------|
| `@PrimaryKey()` | Clave primaria | `@PrimaryKey() declare id: string` |
| `@Default(fn)` | Valor por defecto | `@Default(() => uuid()) declare id: string` |
| `@CreatedAt()` | Auto timestamp en creación | `@CreatedAt() declare created_at: string` |
| `@UpdatedAt()` | Auto timestamp en actualización | `@UpdatedAt() declare updated_at: string` |
| `@Validate(fn)` | Validación | `@Validate((v) => v.length > 0) declare name: string` |
| `@Mutate(fn)` | Transformar datos | `@Mutate((v) => v.trim()) declare email: string` |
| `@NotNull()` | Verificación no nulo | `@NotNull() declare email: string` |

### Tipos Esenciales
| Tipo | Propósito | Uso |
|------|---------|-----|
| `CreationOptional<T>` | Opcional en creación | Campos con `@Default`, `@CreatedAt`, `@UpdatedAt` |
| `NonAttribute<T>` | No almacenado en BD | Propiedades computadas, getters, métodos |

### Operaciones CRUD
```typescript
// Crear
const user = await User.create({ name: "John" });

// Leer
const users = await User.where({ active: true });
const user = await User.first({ id: "123" });

// Actualizar
user.name = "Jane";
await user.save();
// o
await User.update({ name: "Jane" }, { id: "123" });

// Eliminar
await user.destroy();
// o
await User.delete({ id: "123" });
```

## Obtener Ayuda

Si encuentras problemas:
1. Revisa la [Referencia de API](../api/table.md)
2. Busca en [GitHub Issues](https://github.com/arcaelas/dynamite/issues) existentes
3. Crea un nuevo issue con un ejemplo reproducible mínimo

¡Feliz programación con Dynamite!
