# Decorador @PrimaryKey

## Descripción General

El decorador `@PrimaryKey` marca una propiedad como la clave primaria de una tabla DynamoDB. Este decorador es esencial para definir la clave de partición y la clave de ordenación opcional que identifican de forma única los elementos en su tabla.

## Sintaxis

```typescript
@PrimaryKey(type?: 'HASH' | 'RANGE')
```

## Parámetros

### type
- **Tipo**: `'HASH' | 'RANGE'`
- **Por defecto**: `'HASH'`
- **Requerido**: No
- **Descripción**: Especifica si es una clave de partición (HASH) o clave de ordenación (RANGE)

## Uso Básico

### Clave de Partición Simple

```typescript
import { Model, PrimaryKey } from 'dynamite-orm';

class User extends Model {
  @PrimaryKey()
  id!: string;

  name!: string;
  email!: string;
}
```

### Clave Primaria Compuesta

```typescript
class OrderItem extends Model {
  @PrimaryKey('HASH')
  order_id!: string;

  @PrimaryKey('RANGE')
  item_id!: string;

  quantity!: number;
  price!: number;
}
```

## Ejemplos Avanzados

### Clave Primaria UUID

```typescript
import { v4 as uuidv4 } from 'uuid';

class Product extends Model {
  @PrimaryKey()
  @Default(() => uuidv4())
  id!: string;

  name!: string;
  category!: string;
}

// Usage
const product = new Product();
product.name = 'Laptop';
product.category = 'Electronics';
await product.save();
// id is automatically generated
```

### Clave de Ordenación Basada en Timestamp

```typescript
class Event extends Model {
  @PrimaryKey('HASH')
  user_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => Date.now())
  timestamp!: number;

  event_type!: string;
  data!: Record<string, any>;
}

// Query events for a user
const events = await Event.query()
  .where('user_id', '=', 'user123')
  .sortBy('timestamp', 'DESC')
  .limit(10)
  .execute();
```

### Patrón de Clave de Ordenación Compuesta

```typescript
class Message extends Model {
  @PrimaryKey('HASH')
  chat_room_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => `${Date.now()}#${Math.random().toString(36).substr(2, 9)}`)
  timestamp_id!: string;

  sender_id!: string;
  content!: string;
}

// Ensures unique messages even if sent at the same millisecond
```

### Datos Jerárquicos con Clave de Ordenación

```typescript
class FileSystem extends Model {
  @PrimaryKey('HASH')
  root_path!: string;

  @PrimaryKey('RANGE')
  full_path!: string;

  file_type!: 'file' | 'directory';
  size!: number;
  created_at!: number;
}

// Query all files in a directory
const files = await FileSystem.query()
  .where('root_path', '=', '/home/user')
  .where('full_path', 'beginsWith', '/home/user/documents')
  .execute();
```

## Patrones Comunes

### Aplicación Multi-Tenant

```typescript
class TenantData extends Model {
  @PrimaryKey('HASH')
  tenant_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => `DATA#${Date.now()}`)
  data_key!: string;

  content!: any;
  metadata!: Record<string, any>;
}

// Isolate data by tenant
const tenant_data = await TenantData.query()
  .where('tenant_id', '=', 'tenant-abc')
  .execute();
```

### Datos de Series Temporales

```typescript
class Metric extends Model {
  @PrimaryKey('HASH')
  metric_name!: string;

  @PrimaryKey('RANGE')
  @IndexSort()
  timestamp!: number;

  value!: number;
  unit!: string;
}

// Query metrics for a time range
const metrics = await Metric.query()
  .where('metric_name', '=', 'cpu_usage')
  .where('timestamp', 'between', [start_time, end_time])
  .execute();
```

### Registros con Control de Versiones

```typescript
class Document extends Model {
  @PrimaryKey('HASH')
  document_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => `v${Date.now()}`)
  version!: string;

  content!: string;
  author!: string;
  changes!: string;
}

// Get latest version
const latest = await Document.query()
  .where('document_id', '=', 'doc123')
  .sortBy('version', 'DESC')
  .limit(1)
  .first();
```

## Integración con Otros Decoradores

### Con @Default

```typescript
class Session extends Model {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  session_id!: string;

  user_id!: string;
  expires_at!: number;
}
```

### Con @Validate

```typescript
class Account extends Model {
  @PrimaryKey()
  @Validate((value) => /^ACC[0-9]{10}$/.test(value))
  account_number!: string;

  balance!: number;
  status!: string;
}
```

### Con @Mutate

```typescript
class Identifier extends Model {
  @PrimaryKey()
  @Mutate((value) => value.toLowerCase().trim())
  username!: string;

  display_name!: string;
  email!: string;
}
```

### Con @CreatedAt

```typescript
class AuditLog extends Model {
  @PrimaryKey('HASH')
  entity_id!: string;

  @PrimaryKey('RANGE')
  @CreatedAt()
  created_at!: number;

  action!: string;
  user_id!: string;
}
```

## Mejores Prácticas

### 1. Elegir Tipos de Clave Apropiados

```typescript
// Good - Use string for partition keys to avoid hot partitions
class Item extends Model {
  @PrimaryKey()
  id!: string;  // UUID or prefixed ID
}

// Avoid - Sequential numbers can create hot partitions
class BadItem extends Model {
  @PrimaryKey()
  id!: number;  // Sequential auto-increment
}
```

### 2. Diseñar para Patrones de Consulta

```typescript
// Good - Sort key enables range queries
class LogEntry extends Model {
  @PrimaryKey('HASH')
  service_name!: string;

  @PrimaryKey('RANGE')
  timestamp!: number;

  level!: string;
  message!: string;
}

// Query logs for a service in a time range
const logs = await LogEntry.query()
  .where('service_name', '=', 'api')
  .where('timestamp', '>', yesterday)
  .execute();
```

### 3. Usar Prefijos para Claridad

```typescript
class Resource extends Model {
  @PrimaryKey()
  @Default(() => `USER#${uuidv4()}`)
  id!: string;

  type!: 'user' | 'admin';
}

// Makes the entity type immediately clear
```

### 4. Claves de Ordenación Compuestas para Flexibilidad

```typescript
class Activity extends Model {
  @PrimaryKey('HASH')
  user_id!: string;

  @PrimaryKey('RANGE')
  @Default(() => `${Date.now()}#${activity_type}`)
  timestamp_type!: string;

  activity_type!: string;
  details!: any;
}

// Enables queries by both time and type
```

### 5. Claves Primarias Inmutables

```typescript
class Record extends Model {
  @PrimaryKey()
  private readonly id!: string;

  // Prevent accidental modification
  get record_id(): string {
    return this.id;
  }
}
```

## Reglas de Validación

El decorador `@PrimaryKey` aplica varias reglas:

1. **Campo Requerido**: Los campos de clave primaria no pueden ser undefined o null
2. **Valores Únicos**: DynamoDB garantiza la unicidad para la clave de partición o clave compuesta
3. **Tipos Soportados**: String, number o datos binarios
4. **Inmutabilidad**: Los valores de clave primaria no se pueden cambiar después de la creación

## Manejo de Errores

```typescript
try {
  const user = new User();
  // Missing primary key
  await user.save();
} catch (error) {
  // Error: Primary key 'id' is required
}

try {
  const order = new OrderItem();
  order.order_id = 'ORD123';
  // Missing sort key
  await order.save();
} catch (error) {
  // Error: Sort key 'item_id' is required
}

// Update with new primary key (not allowed)
const existing = await User.find('user123');
existing.id = 'user456';  // This will fail
await existing.save();
```

## Consideraciones de Rendimiento

### 1. Distribución de Clave de Partición

```typescript
// Good - Distributes load evenly
class Event extends Model {
  @PrimaryKey()
  @Default(() => `${Math.floor(Math.random() * 100)}#${Date.now()}`)
  event_id!: string;
}

// Avoid - Creates hot partition
class BadEvent extends Model {
  @PrimaryKey()
  @Default(() => 'ALL_EVENTS')
  partition!: string;
}
```

### 2. Clave de Ordenación para Consultas Eficientes

```typescript
// Efficient - Query specific time range
class Transaction extends Model {
  @PrimaryKey('HASH')
  account_id!: string;

  @PrimaryKey('RANGE')
  timestamp!: number;
}

const recent = await Transaction.query()
  .where('account_id', '=', 'ACC123')
  .where('timestamp', '>', Date.now() - 86400000)
  .execute();
```

## Consideraciones de Migración

Cuando se cambia la estructura de la clave primaria:

```typescript
// Old structure
class OldUser extends Model {
  @PrimaryKey()
  email!: string;
}

// New structure with UUID
class NewUser extends Model {
  @PrimaryKey()
  id!: string;

  email!: string;
}

// Migration script
async function migrate() {
  const old_users = await OldUser.scan().execute();

  for (const old_user of old_users) {
    const new_user = new NewUser();
    new_user.id = uuidv4();
    new_user.email = old_user.email;
    // Copy other fields
    await new_user.save();
  }
}
```

## Ver También

- [@IndexSort](./index-sort.md) - Crear índices secundarios
- [@Default](./default.md) - Establecer valores por defecto para claves
- [@Validate](./validate.md) - Validar valores de clave
- [Query API](../query.md) - Consultar usando claves primarias
