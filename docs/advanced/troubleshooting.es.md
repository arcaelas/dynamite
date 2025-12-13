# Guía de Solución de Problemas

Esta guía le ayuda a diagnosticar y resolver problemas comunes al usar Dynamite con DynamoDB.

## Tabla de Contenidos

- [Errores de Conexión](#errores-de-conexión)
- [Errores de Consulta](#errores-de-consulta)
- [Errores de Validación](#errores-de-validación)
- [Errores de Relaciones](#errores-de-relaciones)
- [Problemas de Rendimiento](#problemas-de-rendimiento)
- [Errores de Tipo](#errores-de-tipo)
- [Consejos de Depuración](#consejos-de-depuración)
- [Mensajes de Error Comunes](#mensajes-de-error-comunes)

## Errores de Conexión

### Credenciales Inválidas

**Error:**
```
UnrecognizedClientException: The security token included in the request is invalid
```

**Causas:**
- Credenciales AWS inválidas
- Credenciales expiradas
- Permisos IAM incorrectos

**Soluciones:**

```typescript
// Check credentials are properly configured
import { fromEnv } from '@aws-sdk/credential-providers';

const client = new DynamoDBClient({
  region: 'us-east-1',
  credentials: fromEnv()
});

// Verify environment variables
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Set' : 'Not set');

// Test connection
try {
  await client.send(new ListTablesCommand({}));
  console.log('Connection successful');
} catch (error) {
  console.error('Connection failed:', error.message);
}
```

**Política IAM Requerida:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/*"
    }
  ]
}
```

### Región Incorrecta

**Error:**
```
ResourceNotFoundException: Requested resource not found
```

**Causas:**
- La tabla existe en una región diferente
- Configuración de región incorrecta

**Soluciones:**

```typescript
// List all regions where table exists
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

const regions = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'ap-southeast-1'
];

for (const region of regions) {
  try {
    const client = new DynamoDBClient({ region });
    const { TableNames } = await client.send(new ListTablesCommand({}));

    if (TableNames?.includes('Users')) {
      console.log(`Table found in region: ${region}`);
    }
  } catch (error) {
    console.log(`Region ${region}: ${error.message}`);
  }
}
```

### Timeout de Conexión

**Error:**
```
TimeoutError: Connection timeout after 5000ms
```

**Causas:**
- Problemas de red
- Problemas de configuración VPC
- Endpoint de DynamoDB no accesible

**Soluciones:**

```typescript
// Increase timeout for slow connections
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';

const client = new DynamoDBClient({
  region: 'us-east-1',
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 10000, // 10 seconds
    requestTimeout: 30000 // 30 seconds
  })
});

// Use VPC endpoint if within VPC
const client_vpc = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'https://vpce-abc123.dynamodb.us-east-1.vpce.amazonaws.com'
});

// Test with retries
const client_with_retries = new DynamoDBClient({
  region: 'us-east-1',
  maxAttempts: 5,
  retryMode: 'adaptive'
});
```

### Conexión a DynamoDB Local

**Error:**
```
NetworkingError: connect ECONNREFUSED 127.0.0.1:8000
```

**Causas:**
- DynamoDB Local no está ejecutándose
- Configuración de puerto incorrecta

**Soluciones:**

```bash
# Start DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Or using Java
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
```

```typescript
// Configure client for local DynamoDB
const local_client = new DynamoDBClient({
  region: 'local',
  endpoint: 'http://localhost:8000',
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy'
  }
});

Dynamite.Configure({ client: local_client });

// Verify connection
try {
  await local_client.send(new ListTablesCommand({}));
  console.log('Local DynamoDB connected');
} catch (error) {
  console.error('Cannot connect to local DynamoDB:', error.message);
}
```

## Errores de Consulta

### Operador de Consulta Inválido

**Error:**
```
ValidationException: Query key condition not supported
```

**Causas:**
- Usar operador incorrecto para condición de clave
- Filtro en clave de partición con operador no soportado

**Soluciones:**

```typescript
// Wrong - 'contains' not supported for partition key
const users = await User.find({
  where: {
    email: { contains: '@example.com' } // Error!
  }
});

// Correct - Use 'eq' or direct value for partition key
const user = await User.findOne({
  where: {
    email: 'user@example.com'
  }
});

// Wrong - Multiple conditions on partition key
const users = await User.find({
  where: {
    id: { gt: 'user-100', lt: 'user-200' } // Error!
  }
});

// Correct - Range conditions only for sort key
const orders = await Order.find({
  where: {
    customer_id: 'CUST-123', // Partition key - exact match
    order_date: { between: ['2024-01-01', '2024-12-31'] } // Sort key - range
  }
});
```

**Operadores Soportados por Tipo de Clave:**

| Tipo de Clave | Operadores Soportados |
|---------------|----------------------|
| Clave de Partición | `=` (coincidencia exacta únicamente) |
| Clave de Ordenamiento | `=`, `<`, `<=`, `>`, `>=`, `between`, `beginsWith` |
| Atributos No-Clave | Todos los operadores (vía expresión de filtro) |

### Índice Faltante

**Error:**
```
ValidationException: Query condition missed key schema element
```

**Causas:**
- Consultar atributo no-clave sin índice
- Nombre de índice incorrecto especificado

**Soluciones:**

```typescript
// Wrong - Querying non-key attribute
const users = await User.find({
  where: {
    status: 'active' // No index on status
  }
});

// Correct - Add GSI
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute()
  @Index('StatusIndex', { type: 'PARTITION' })
  status!: string;
}

// Now query with index
const users = await User.find({
  where: { status: 'active' },
  index: 'StatusIndex'
});

// Check available indexes
const table_info = await User.describeTable();
console.log('Available indexes:', table_info.GlobalSecondaryIndexes?.map(i => i.IndexName));
```

### Conjunto de Resultados Vacío

**Error:**
Sin error, pero los resultados están vacíos cuando existen datos.

**Causas:**
- Valores de clave incorrectos
- Problemas de sensibilidad a mayúsculas
- Desajuste de tipo de datos

**Soluciones:**

```typescript
// Debug query
const result = await User.find({
  where: { status: 'Active' } // Check case
});

console.log('Query returned:', result.items.length, 'items');

// Check actual data
const all_users = await User.scan();
console.log('Statuses in DB:', [...new Set(all_users.map(u => u.status))]);

// Use scan to verify data exists
const scan_result = await User.scan({
  filter: { status: 'active' }
});

if (scan_result.length > 0) {
  console.log('Data exists, query might be wrong');
  console.log('Sample item:', scan_result[0]);
}
```

### Lecturas Inconsistentes

**Error:**
Los datos recién escritos no son devueltos por la consulta.

**Causas:**
- Lecturas eventualmente consistentes (predeterminado)
- Lectura desde GSI (siempre eventualmente consistente)

**Soluciones:**

```typescript
// Force strongly consistent read
const user = await User.findOne({
  where: { id: 'user-123' },
  consistent: true
});

// Wait for GSI to update
await User.create({ id: 'user-123', status: 'active' });

// GSI might not be updated immediately
await new Promise(resolve => setTimeout(resolve, 1000));

const users = await User.find({
  where: { status: 'active' },
  index: 'StatusIndex'
});
```

## Errores de Validación

### Validación de Decorador Falló

**Error:**
```
ValidationError: Attribute 'email' does not match pattern
```

**Causas:**
- La entrada no coincide con las reglas de validación del decorador
- Faltan atributos requeridos

**Soluciones:**

```typescript
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute({
    validate: {
      pattern: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,
      message: 'Invalid email format'
    }
  })
  email!: string;

  @Attribute({
    validate: {
      min: 18,
      max: 100,
      message: 'Age must be between 18 and 100'
    }
  })
  age!: number;
}

// Validate before saving
try {
  const user = await User.create({
    id: 'user-123',
    email: 'invalid-email', // Will fail
    age: 15 // Will fail
  });
} catch (error) {
  console.error('Validation errors:', error.message);
}

// Manual validation
function ValidateEmail(email: string): boolean {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email);
}

if (!ValidateEmail('test@example.com')) {
  throw new Error('Invalid email');
}
```

### Desajuste de Tipo

**Error:**
```
TypeError: Cannot convert 'name' to string
```

**Causas:**
- Tipo de dato incorrecto para atributo
- Falta conversión de tipo

**Soluciones:**

```typescript
@Entity()
class Product {
  @PartitionKey()
  id!: string;

  @Attribute()
  price!: number; // Expects number

  @Attribute()
  tags!: string[]; // Expects string array

  @Attribute()
  metadata!: Record<string, any>; // Expects object
}

// Wrong types
await Product.create({
  id: 'prod-123',
  price: '29.99', // Wrong: string instead of number
  tags: 'electronics,gadgets', // Wrong: string instead of array
  metadata: '[{"key": "value"}]' // Wrong: JSON string instead of object
});

// Correct types
await Product.create({
  id: 'prod-123',
  price: 29.99,
  tags: ['electronics', 'gadgets'],
  metadata: { key: 'value' }
});

// With type conversion
await Product.create({
  id: 'prod-123',
  price: parseFloat('29.99'),
  tags: 'electronics,gadgets'.split(','),
  metadata: JSON.parse('[{"key": "value"}]')
});
```

### Falta Atributo Requerido

**Error:**
```
ValidationError: Missing required attribute 'name'
```

**Causas:**
- Atributo requerido no proporcionado
- Valor undefined o null para campo requerido

**Soluciones:**

```typescript
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute({ required: true })
  name!: string;

  @Attribute({ required: false })
  nickname?: string;
}

// Wrong - missing required attribute
await User.create({
  id: 'user-123'
  // Missing 'name'
});

// Correct - all required attributes provided
await User.create({
  id: 'user-123',
  name: 'John Doe'
});

// Provide defaults for required fields
interface CreateUserInput {
  id: string;
  name?: string;
}

async function CreateUserWithDefaults(input: CreateUserInput): Promise<User> {
  return User.create({
    id: input.id,
    name: input.name ?? 'Anonymous'
  });
}
```

## Errores de Relaciones

### Dependencia Circular

**Error:**
```
ReferenceError: Cannot access 'Order' before initialization
```

**Causas:**
- Importaciones circulares entre archivos de entidad
- Relaciones bidireccionales

**Soluciones:**

```typescript
// Wrong - circular dependency
// user.entity.ts
import { Order } from './order.entity';

@Entity()
class User {
  @HasMany(() => Order, 'user_id')
  orders!: Order[];
}

// order.entity.ts
import { User } from './user.entity';

@Entity()
class Order {
  @BelongsTo(() => User, 'user_id')
  user!: User;
}

// Correct - use function for lazy evaluation
// user.entity.ts
@Entity()
export class User {
  @HasMany(() => require('./order.entity').Order, 'user_id')
  orders!: any[];
}

// order.entity.ts
@Entity()
export class Order {
  @BelongsTo(() => require('./user.entity').User, 'user_id')
  user!: any;
}

// Best - separate relationship definitions
// relationships.ts
import { User } from './user.entity';
import { Order } from './order.entity';

User.hasMany(Order, 'user_id');
Order.belongsTo(User, 'user_id');
```

### Falta Clave Foránea

**Error:**
```
ValidationError: Foreign key 'user_id' is required
```

**Causas:**
- Clave foránea no establecida al crear entidad relacionada
- Valor de clave foránea nulo

**Soluciones:**

```typescript
@Entity()
class Order {
  @PartitionKey()
  id!: string;

  @ForeignKey(() => User)
  @Attribute({ required: true })
  user_id!: string;

  @BelongsTo(() => User, 'user_id')
  user!: User;
}

// Wrong - missing foreign key
await Order.create({
  id: 'order-123',
  total: 100
  // Missing user_id
});

// Correct - include foreign key
await Order.create({
  id: 'order-123',
  user_id: 'user-456',
  total: 100
});

// Validate foreign key exists
async function CreateOrderForUser(user_id: string, order_data: any): Promise<Order> {
  const user = await User.findOne({ where: { id: user_id } });

  if (!user) {
    throw new Error(`User ${user_id} not found`);
  }

  return Order.create({
    ...order_data,
    user_id
  });
}
```

### Falla Carga Eager

**Error:**
```
Error: Cannot load relationship 'user' - relation not defined
```

**Causas:**
- Relación no configurada correctamente
- Clave foránea incorrecta especificada

**Soluciones:**

```typescript
// Check relationship configuration
@Entity()
class Order {
  @PartitionKey()
  id!: string;

  @Attribute()
  user_id!: string;

  // Make sure relationship is properly configured
  @BelongsTo(() => User, 'user_id') // Second param must match attribute name
  user!: User;
}

// Test relationship loading
const order = await Order.findOne({
  where: { id: 'order-123' },
  include: ['user']
});

if (!order.user) {
  console.error('User not loaded, checking configuration...');

  // Manually load to debug
  const user = await User.findOne({ where: { id: order.user_id } });
  console.log('User exists:', !!user);
}

// Alternative: Load relationships manually
const order = await Order.findOne({ where: { id: 'order-123' } });
order.user = await User.findOne({ where: { id: order.user_id } });
```

## Problemas de Rendimiento

### Consultas Lentas

**Síntomas:**
- Consultas tomando > 1 segundo
- Alta latencia en producción

**Diagnóstico:**

```typescript
// Measure query performance
async function MeasureQuery<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;

  console.log(`${name}: ${duration.toFixed(2)}ms`);

  if (duration > 1000) {
    console.warn('Slow query detected!');
  }

  return result;
}

// Test queries
await MeasureQuery('Find users', () =>
  User.find({ where: { status: 'active' } })
);

// Enable DynamoDB client logging
import { Logger } from '@aws-sdk/types';

const logger: Logger = {
  debug: (...args) => console.log('[DEBUG]', ...args),
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

const client = new DynamoDBClient({
  region: 'us-east-1',
  logger
});
```

**Soluciones:**

```typescript
// Add indexes for common queries
@Entity()
class User {
  @Attribute()
  @Index('StatusIndex', { type: 'PARTITION' })
  status!: string;

  @Attribute()
  @Index('StatusIndex', { type: 'SORT' })
  created_at!: number;
}

// Use projection to reduce response size
const users = await User.find({
  where: { status: 'active' },
  select: ['id', 'name', 'email']
});

// Use pagination for large result sets
const users = await User.find({
  where: { status: 'active' },
  limit: 100
});

// Use batch operations
const users = await User.batchGet(
  user_ids.map(id => ({ id }))
);
```

### Problemas de Memoria

**Error:**
```
JavaScript heap out of memory
```

**Causas:**
- Cargar demasiados elementos a la vez
- Fugas de memoria en paginación
- Valores de atributos grandes

**Soluciones:**

```typescript
// Wrong - loads entire table into memory
const all_users = await User.scan();

// Correct - stream results
async function ProcessAllUsers(
  callback: (user: User) => Promise<void>
): Promise<void> {
  let cursor: any;

  do {
    const page = await User.scan({
      limit: 100,
      cursor
    });

    for (const user of page.items) {
      await callback(user);
    }

    cursor = page.cursor;

    // Force garbage collection between pages
    if (global.gc) {
      global.gc();
    }
  } while (cursor);
}

// Usage
await ProcessAllUsers(async (user) => {
  console.log('Processing:', user.id);
  // Process one user at a time
});

// Monitor memory usage
function LogMemoryUsage(): void {
  const used = process.memoryUsage();
  console.log('Memory usage:', {
    rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`
  });
}

setInterval(LogMemoryUsage, 10000);
```

### Costos Altos

**Síntomas:**
- Factura de DynamoDB más alta de lo esperado
- Muchas unidades de capacidad de lectura/escritura consumidas

**Diagnóstico:**

```typescript
// Track consumed capacity
class CapacityTracker {
  private total_rcu = 0;
  private total_wcu = 0;

  async TrackQuery<T>(fn: () => Promise<T>): Promise<T> {
    const result = await fn();

    // Get consumed capacity from response metadata
    if ((result as any).ConsumedCapacity) {
      const capacity = (result as any).ConsumedCapacity;
      this.total_rcu += capacity.ReadCapacityUnits || 0;
      this.total_wcu += capacity.WriteCapacityUnits || 0;
    }

    return result;
  }

  GetReport() {
    return {
      total_rcu: this.total_rcu,
      total_wcu: this.total_wcu,
      estimated_cost: this.total_rcu * 0.00025 + this.total_wcu * 0.00125
    };
  }
}

// Use strongly consistent reads only when necessary
const user = await User.findOne({
  where: { id: 'user-123' },
  consistent: false // Eventually consistent - uses 0.5x RCUs
});
```

## Errores de Tipo

### Errores de Compilación TypeScript

**Error:**
```
TS2322: Type 'string' is not assignable to type 'number'
```

**Soluciones:**

```typescript
// Use proper types
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute()
  age!: number;
}

// Wrong
const user = await User.create({
  id: 'user-123',
  age: '25' // Type error
});

// Correct
const user = await User.create({
  id: 'user-123',
  age: 25
});

// Use type assertions carefully
const user_data: any = { id: 'user-123', age: '25' };

const user = await User.create({
  id: user_data.id,
  age: parseInt(user_data.age)
});

// Define interfaces for input data
interface CreateUserInput {
  id: string;
  name: string;
  age: number;
}

async function CreateUser(input: CreateUserInput): Promise<User> {
  return User.create(input);
}
```

### Problemas de Tipo Genérico

**Error:**
```
TS2345: Argument of type 'unknown' is not assignable to parameter
```

**Soluciones:**

```typescript
// Use explicit generic types
async function FindByIds<T extends Entity>(
  model: typeof Entity,
  ids: string[]
): Promise<T[]> {
  return model.batchGet(ids.map(id => ({ id }))) as Promise<T[]>;
}

// Usage with type safety
const users = await FindByIds<User>(User, ['user-1', 'user-2']);

// Define type guards
function IsUser(obj: any): obj is User {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
}

const data: unknown = await User.findOne({ where: { id: 'user-123' } });

if (IsUser(data)) {
  console.log(data.name); // Type-safe
}
```

## Consejos de Depuración

### Habilitar Logging de Depuración

```typescript
// Set log level
process.env.DEBUG = 'dynamite:*';

// Custom logger
class CustomLogger {
  static Log(level: string, message: string, data?: any): void {
    console.log(`[${new Date().toISOString()}] [${level}] ${message}`, data || '');
  }
}

// Log all queries
const original_find = User.find;
User.find = async function(...args: any[]) {
  CustomLogger.Log('INFO', 'Query started', args);
  const result = await original_find.apply(this, args);
  CustomLogger.Log('INFO', 'Query completed', { count: result.items.length });
  return result;
};
```

### Inspeccionar Solicitudes de DynamoDB

```typescript
// Log raw DynamoDB requests
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

class LoggingClient extends DynamoDBClient {
  async send(command: any): Promise<any> {
    console.log('DynamoDB Request:', {
      command: command.constructor.name,
      input: command.input
    });

    const result = await super.send(command);

    console.log('DynamoDB Response:', {
      statusCode: result.$metadata?.httpStatusCode,
      requestId: result.$metadata?.requestId
    });

    return result;
  }
}

const client = new LoggingClient({ region: 'us-east-1' });
Dynamite.Configure({ client });
```

### Usar Consola de DynamoDB

Acceda a la Consola AWS para inspeccionar datos directamente:

1. Ir a la Consola DynamoDB
2. Seleccionar su tabla
3. Clic en "Explore table items"
4. Ejecutar consultas para verificar estructura de datos
5. Verificar índices y configuración de capacidad

### Pruebas Locales

```typescript
// Use DynamoDB Local for testing
const is_test = process.env.NODE_ENV === 'test';

const client = new DynamoDBClient(
  is_test
    ? {
        region: 'local',
        endpoint: 'http://localhost:8000',
        credentials: {
          accessKeyId: 'dummy',
          secretAccessKey: 'dummy'
        }
      }
    : {
        region: 'us-east-1'
      }
);

Dynamite.Configure({ client });

// Create tables automatically in tests
if (is_test) {
  await User.createTable();
  await Order.createTable();
}
```

## Mensajes de Error Comunes

### ResourceNotFoundException

```
ResourceNotFoundException: Requested resource not found
```

**Significado:** La tabla o índice no existe.

**Soluciones:**
- Verificar que el nombre de tabla es correcto
- Verificar que la tabla existe en la región especificada
- Asegurarse que la tabla está completamente creada (no en estado CREATING)
- Para índices, verificar nombre GSI

### ConditionalCheckFailedException

```
ConditionalCheckFailedException: The conditional request failed
```

**Significado:** La expresión de condición evaluó a falso.

**Soluciones:**
- Verificar sus expresiones de condición
- Verificar que los valores de atributos son correctos
- Usar lecturas consistentes para condiciones

### ProvisionedThroughputExceededException

```
ProvisionedThroughputExceededException: Rate exceeded
```

**Significado:** Demasiadas solicitudes para la capacidad provisionada.

**Soluciones:**
- Habilitar auto-scaling
- Aumentar capacidad provisionada
- Implementar exponential backoff
- Usar modo de facturación on-demand

### ValidationException

```
ValidationException: One or more parameter values were invalid
```

**Significado:** Parámetros de solicitud inválidos.

**Soluciones:**
- Verificar que los nombres de atributos son correctos
- Verificar que el esquema de claves coincide
- Asegurarse que los operadores son soportados
- Revisar tipos de datos

---

Para más ayuda:
- [Guía de Rendimiento](./performance.md)
- [Guía de Migración](./migration.md)
- [AWS Support](https://aws.amazon.com/support/)
