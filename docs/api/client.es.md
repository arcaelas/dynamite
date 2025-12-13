# Referencia de API: Client

## Descripción General

El cliente Dynamite es el administrador central de configuración para las conexiones DynamoDB. Maneja la inicialización del cliente, la sincronización de tablas y la gestión del ciclo de vida de la conexión. La clase `Dynamite` proporciona una API limpia para configurar clientes DynamoDB del SDK de AWS y crear automáticamente tablas con sus Índices Secundarios Globales (GSI).

## Clase: Dynamite

La clase de cliente principal que administra las conexiones DynamoDB y las operaciones de tabla.

### Constructor

```typescript
constructor(config: DynamiteConfig)
```

Crea una nueva instancia de cliente Dynamite con la configuración proporcionada.

**Parámetros:**
- `config` (DynamiteConfig): Objeto de configuración que contiene ajustes del cliente DynamoDB y definiciones de tablas

**Ejemplo:**
```typescript
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order, Product } from "./models";

const client = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  tables: [User, Order, Product]
});
```

## Configuración

### Interfaz DynamiteConfig

```typescript
interface DynamiteConfig extends DynamoDBClientConfig {
  tables: Array<new (...args: any[]) => any>;
}
```

La interfaz de configuración extiende `DynamoDBClientConfig` del SDK de AWS y añade definiciones de tablas.

**Propiedades:**

| Propiedad | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `tables` | `Array<Class>` | Sí | Array de constructores de clase Table a registrar |
| `region` | `string` | Sí | Región de AWS (ej. "us-east-1") |
| `endpoint` | `string` | No | URL de endpoint personalizado (para DynamoDB Local) |
| `credentials` | `AwsCredentials` | No | Objeto de credenciales de AWS |
| `maxAttempts` | `number` | No | Máximo número de intentos de reintento |
| `requestTimeout` | `number` | No | Tiempo de espera de solicitud en milisegundos |

### Credenciales de AWS

```typescript
interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}
```

## Métodos de Instancia

### connect()

```typescript
connect(): void
```

Conecta el cliente y lo establece como el cliente DynamoDB global para las operaciones de Table. Este método debe ser llamado antes de realizar cualquier operación de Table.

**Ejemplo:**
```typescript
const client = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  tables: [User, Order]
});

client.connect();

// Ahora las operaciones de Table están disponibles
const user = await User.create({ name: "John" });
```

**Notas:**
- Operación idempotente - llamar múltiples veces no tiene efecto
- Establece el cliente interno como el cliente global para todas las instancias de Table
- Debe ser llamado antes de cualquier Table.create(), Table.where(), etc.

### sync()

```typescript
async sync(): Promise<void>
```

Sincroniza todas las tablas declaradas con DynamoDB. Este método crea tablas si no existen, incluyendo sus Índices Secundarios Globales (GSI) para relaciones `@HasMany`.

**Retorna:**
- `Promise<void>`: Se resuelve cuando todas las tablas están sincronizadas

**Ejemplo:**
```typescript
await client.sync();

// Todas las tablas definidas en config.tables ahora están creadas en DynamoDB
// con sus claves primarias, claves de ordenamiento e índices GSI
```

**Comportamiento:**
- Crea tablas con modo de facturación `PAY_PER_REQUEST`
- Detecta y crea automáticamente GSI para relaciones `@HasMany`
- Idempotente - seguro de llamar múltiples veces
- Ignora `ResourceInUseException` (la tabla ya existe)
- Lanza errores para otros fallos

**Detalles de Creación de Tabla:**
- **Partition Key**: Detectada desde el decorador `@PrimaryKey()` o `@Index()`
- **Sort Key**: Detectada desde el decorador `@IndexSort()` (opcional)
- **GSI**: Creado automáticamente para cada relación `@HasMany` con patrón de nomenclatura `GSI{N}_{foreignKey}`
- **Modo de Facturación**: `PAY_PER_REQUEST` (bajo demanda)
- **Definiciones de Atributos**: Inferidas automáticamente (todas las claves por defecto son tipo String)

### getClient()

```typescript
getClient(): DynamoDBClient
```

Retorna la instancia de cliente DynamoDB del SDK de AWS subyacente.

**Retorna:**
- `DynamoDBClient`: El cliente DynamoDB del SDK de AWS

**Ejemplo:**
```typescript
const awsClient = client.getClient();

// Usar para operaciones directas del SDK de AWS
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
const result = await awsClient.send(
  new DescribeTableCommand({ TableName: "users" })
);
```

**Casos de Uso:**
- Acceso directo a operaciones del SDK de AWS
- Comandos personalizados no soportados por Dynamite
- Características avanzadas de DynamoDB
- Pruebas y depuración

### isReady()

```typescript
isReady(): boolean
```

Verifica si el cliente está conectado y todas las tablas están sincronizadas.

**Retorna:**
- `boolean`: `true` si tanto `connect()` como `sync()` se han completado exitosamente

**Ejemplo:**
```typescript
console.log(client.isReady()); // false

client.connect();
await client.sync();

console.log(client.isReady()); // true
```

### disconnect()

```typescript
disconnect(): void
```

Desconecta y limpia el cliente DynamoDB. Destruye el cliente del SDK de AWS subyacente y reinicia el estado interno.

**Ejemplo:**
```typescript
client.disconnect();

// El cliente ya no es utilizable
// Las operaciones de Table lanzarán errores
```

**Comportamiento:**
- Llama `client.destroy()` en el cliente del SDK de AWS subyacente
- Reinicia las banderas `connected` y `synced`
- Limpia la referencia del cliente global si coincide con esta instancia
- Seguro de llamar múltiples veces
- Registra advertencias si la destrucción falla

## Ejemplos de Configuración

### Desarrollo Local (DynamoDB Local)

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order, Product } from "./models";

const client = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  tables: [User, Order, Product]
});

client.connect();
await client.sync();
```

**Configuración Docker:**
```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  dynamodb-local:
    image: amazon/dynamodb-local
    ports:
      - "8000:8000"
    command: ["-jar", "DynamoDBLocal.jar", "-sharedDb"]
```

### Configuración de Producción AWS

```typescript
const client = new Dynamite({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product],
  maxAttempts: 3,
  requestTimeout: 3000
});

client.connect();
await client.sync();
```

### Variables de Entorno

```bash
# .env file
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Para desarrollo local
DYNAMODB_ENDPOINT=http://localhost:8000
```

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import * as dotenv from "dotenv";

dotenv.config();

const config: any = {
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product]
};

// Añadir endpoint solo para desarrollo local
if (process.env.DYNAMODB_ENDPOINT) {
  config.endpoint = process.env.DYNAMODB_ENDPOINT;
}

const client = new Dynamite(config);
client.connect();
await client.sync();
```

### Múltiples Instancias de Cliente

Puedes crear múltiples clientes Dynamite para diferentes configuraciones o regiones.

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order } from "./models";
import { Log, Metric } from "./monitoring";

// Cliente de base de datos de producción
const production_client = new Dynamite({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.PROD_AWS_KEY!,
    secretAccessKey: process.env.PROD_AWS_SECRET!
  },
  tables: [User, Order]
});

// Cliente de base de datos de analítica (región diferente)
const analytics_client = new Dynamite({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.ANALYTICS_AWS_KEY!,
    secretAccessKey: process.env.ANALYTICS_AWS_SECRET!
  },
  tables: [Log, Metric]
});

// Conectar cliente de producción (se convierte en global)
production_client.connect();
await production_client.sync();

// Las operaciones de User y Order usan production_client
const user = await User.create({ name: "John" });

// Cambiar a cliente de analítica
analytics_client.connect();
await analytics_client.sync();

// Las operaciones de Log y Metric ahora usan analytics_client
const log = await Log.create({ message: "User created" });
```

**Notas Importantes:**
- Solo un cliente puede ser el cliente "global" a la vez
- Llamar `connect()` en un nuevo cliente reemplaza el cliente global
- Las operaciones de Table siempre usan el cliente global actual
- Considera usar paso explícito de cliente para escenarios multi-cliente

### Opciones de Configuración Personalizadas

```typescript
const client = new Dynamite({
  region: "us-east-1",
  endpoint: "https://dynamodb.us-east-1.amazonaws.com",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product],

  // Opciones avanzadas del SDK de AWS
  maxAttempts: 5,
  requestTimeout: 5000,

  // Estrategia de reintento personalizada
  retryMode: "adaptive",

  // Habilitar registro
  logger: console
});
```

## Funciones de Utilidad

### setGlobalClient()

```typescript
export const setGlobalClient = (client: DynamoDBClient): void
```

Establece el cliente DynamoDB global para operaciones de Table. Típicamente llamado internamente por `Dynamite.connect()`.

**Parámetros:**
- `client` (DynamoDBClient): Instancia de cliente DynamoDB del SDK de AWS

**Ejemplo:**
```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { setGlobalClient } from "@arcaelas/dynamite";

const custom_client = new DynamoDBClient({
  region: "us-east-1"
});

setGlobalClient(custom_client);
```

### getGlobalClient()

```typescript
export const getGlobalClient = (): DynamoDBClient
```

Obtiene el cliente DynamoDB global actual. Lanza un error si no hay cliente establecido.

**Retorna:**
- `DynamoDBClient`: El cliente DynamoDB global

**Lanza:**
- `Error`: Si no se ha establecido un cliente global

**Ejemplo:**
```typescript
import { getGlobalClient } from "@arcaelas/dynamite";

try {
  const client = getGlobalClient();
  console.log("Client is configured");
} catch (error) {
  console.error("No client configured");
}
```

### hasGlobalClient()

```typescript
export const hasGlobalClient = (): boolean
```

Verifica si un cliente DynamoDB global está disponible.

**Retorna:**
- `boolean`: `true` si existe un cliente global

**Ejemplo:**
```typescript
import { hasGlobalClient } from "@arcaelas/dynamite";

if (hasGlobalClient()) {
  console.log("Client is available");
} else {
  console.log("No client configured");
}
```

### requireClient()

```typescript
export const requireClient = (): DynamoDBClient
```

Requiere que un cliente global esté disponible. Lanza un error con un mensaje localizado si no está establecido.

**Retorna:**
- `DynamoDBClient`: El cliente DynamoDB global

**Lanza:**
- `Error`: Si no hay cliente global configurado (mensaje de error en español)

**Ejemplo:**
```typescript
import { requireClient } from "@arcaelas/dynamite";

try {
  const client = requireClient();
  // Usar cliente para operaciones
} catch (error) {
  console.error(error.message); // "DynamoDB client no configurado. Use Dynamite.connect() primero."
}
```

## Manejo de Errores

### Errores Comunes

#### ResourceInUseException

Lanzado al intentar crear una tabla que ya existe.

```typescript
try {
  await client.sync();
} catch (error) {
  if (error.name === "ResourceInUseException") {
    console.log("Table already exists");
  }
}
```

**Nota:** Dynamite maneja automáticamente este error durante `sync()`.

#### ValidationException

Lanzado cuando el esquema de tabla o atributos son inválidos.

```typescript
try {
  await client.sync();
} catch (error) {
  if (error.name === "ValidationException") {
    console.error("Invalid table schema:", error.message);
  }
}
```

**Causas Comunes:**
- Falta decorador `@PrimaryKey()` o `@Index()`
- Palabra clave reservada usada como nombre de atributo
- Tipo de atributo inválido
- PK y SK con el mismo nombre de atributo

#### UnrecognizedClientException

Lanzado cuando las credenciales son inválidas o el endpoint de DynamoDB es inalcanzable.

```typescript
try {
  client.connect();
  await client.sync();
} catch (error) {
  if (error.name === "UnrecognizedClientException") {
    console.error("Invalid credentials or endpoint");
  }
}
```

**Soluciones:**
- Verificar credenciales de AWS
- Verificar que DynamoDB Local esté ejecutándose (para desarrollo local)
- Verificar que la URL del endpoint sea correcta
- Verificar conectividad de red

#### Metadata Not Found

Lanzado al intentar sincronizar una tabla sin decoradores apropiados.

```typescript
try {
  await client.sync();
} catch (error) {
  if (error.message.includes("not registered in wrapper")) {
    console.error("Table class missing decorators");
  }
}
```

**Solución:** Asegurar que todas las clases de tabla usen el decorador `@PrimaryKey()` o `@Index()`.

#### No Global Client

Lanzado al intentar operaciones de Table sin conectar primero.

```typescript
try {
  const user = await User.create({ name: "John" });
} catch (error) {
  if (error.message.includes("DynamoDB client no configurado")) {
    console.error("Call client.connect() first");
  }
}
```

### Mejores Prácticas de Manejo de Errores

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order } from "./models";

async function initialize_database() {
  const client = new Dynamite({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    },
    tables: [User, Order]
  });

  try {
    // Conectar cliente
    client.connect();
    console.log("Client connected");

    // Sincronizar tablas
    await client.sync();
    console.log("Tables synchronized");

    // Verificar estado ready
    if (client.isReady()) {
      console.log("Database ready for operations");
    }

    return client;
  } catch (error: any) {
    // Manejar errores específicos
    if (error.name === "UnrecognizedClientException") {
      console.error("Authentication failed. Check credentials.");
    } else if (error.name === "ValidationException") {
      console.error("Invalid table schema:", error.message);
    } else if (error.message?.includes("not registered in wrapper")) {
      console.error("Table class missing decorators");
    } else {
      console.error("Database initialization failed:", error);
    }

    // Limpieza en caso de fallo
    client.disconnect();
    throw error;
  }
}

// Uso
try {
  const client = await initialize_database();

  // Realizar operaciones
  const user = await User.create({ name: "John" });

  // Limpieza al apagar
  process.on("SIGINT", () => {
    client.disconnect();
    process.exit(0);
  });
} catch (error) {
  console.error("Application failed to start");
  process.exit(1);
}
```

## Ejemplo de Uso Completo

### Configuración Básica de Aplicación

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

// Definir modelos
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare total: number;

  @Default(() => "pending")
  declare status: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;
}

// Inicializar cliente
async function setup_database() {
  const client = new Dynamite({
    region: "us-east-1",
    endpoint: "http://localhost:8000",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test"
    },
    tables: [User, Order]
  });

  // Conectar y sincronizar
  client.connect();
  await client.sync();

  console.log("Database ready:", client.isReady());
  return client;
}

// Punto de entrada de la aplicación
async function main() {
  const client = await setup_database();

  try {
    // Crear usuario
    const user = await User.create({
      name: "John Doe",
      email: "john@example.com"
    });

    console.log("User created:", user.id);

    // Crear órdenes
    const order1 = await Order.create({
      user_id: user.id,
      total: 99.99
    });

    const order2 = await Order.create({
      user_id: user.id,
      total: 149.99
    });

    // Consultar con relaciones
    const users_with_orders = await User.where({ id: user.id }, {
      include: {
        orders: {
          where: { status: "pending" }
        }
      }
    });

    console.log("User orders:", users_with_orders[0].orders.length);
  } finally {
    // Limpieza al salir
    client.disconnect();
  }
}

main().catch(console.error);
```

### Integración con Express.js

```typescript
import express from "express";
import { Dynamite } from "@arcaelas/dynamite";
import { User } from "./models";

const app = express();
app.use(express.json());

// Inicializar base de datos
let client: Dynamite;

async function initialize() {
  client = new Dynamite({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    },
    tables: [User]
  });

  client.connect();
  await client.sync();
  console.log("Database initialized");
}

// Rutas API
app.get("/users", async (req, res) => {
  try {
    const users = await User.where({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/users", async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Iniciar servidor
initialize()
  .then(() => {
    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });
  })
  .catch((error) => {
    console.error("Failed to start:", error);
    process.exit(1);
  });

// Apagado graceful
process.on("SIGINT", () => {
  console.log("Shutting down...");
  client.disconnect();
  process.exit(0);
});
```

## Mejores Prácticas

### 1. Instancia Única de Cliente

Crear una instancia de cliente por aplicación y reutilizarla.

```typescript
// Bien
const client = new Dynamite({ /* config */ });
client.connect();
await client.sync();

// Mal - crea múltiples clientes innecesariamente
function get_client() {
  return new Dynamite({ /* config */ });
}
```

### 2. Llamar sync() Una Vez

Llamar `sync()` solo durante la inicialización de la aplicación, no antes de cada operación.

```typescript
// Bien - sincronizar una vez al inicio
await client.sync();
const user = await User.create({ name: "John" });
const order = await Order.create({ user_id: user.id });

// Mal - sincronizar repetidamente
await client.sync();
const user = await User.create({ name: "John" });
await client.sync();
const order = await Order.create({ user_id: user.id });
```

### 3. Apagado Graceful

Siempre desconectar el cliente al apagar la aplicación.

```typescript
process.on("SIGINT", () => {
  console.log("Shutting down gracefully");
  client.disconnect();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down gracefully");
  client.disconnect();
  process.exit(0);
});
```

### 4. Configuración Basada en Entorno

Usar variables de entorno para la configuración para separar dev/staging/producción.

```typescript
const client = new Dynamite({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : undefined,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product]
});
```

### 5. Manejo de Errores

Siempre manejar errores durante la inicialización y proporcionar retroalimentación significativa.

```typescript
try {
  client.connect();
  await client.sync();
} catch (error: any) {
  if (error.name === "UnrecognizedClientException") {
    console.error("Check DynamoDB Local is running: docker run -p 8000:8000 amazon/dynamodb-local");
  } else {
    console.error("Database initialization failed:", error.message);
  }
  process.exit(1);
}
```

### 6. Configuración de Pruebas

Usar clientes separados para pruebas con configuración aislada.

```typescript
// test/setup.ts
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order } from "../models";

export async function setup_test_database() {
  const client = new Dynamite({
    region: "us-east-1",
    endpoint: "http://localhost:8000",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test"
    },
    tables: [User, Order]
  });

  client.connect();
  await client.sync();
  return client;
}

export async function teardown_test_database(client: Dynamite) {
  client.disconnect();
}
```

## Ver También

- [Referencia de API Table](./table.md) - Documentación completa de la clase Table
- [Referencia de Decoradores](./decorators/) - Todos los decoradores disponibles
- [Cliente DynamoDB del SDK de AWS](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/) - Documentación del SDK de AWS subyacente
- [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) - Configuración de desarrollo local
