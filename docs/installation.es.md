# Guía de Instalación

> Guía completa de instalación y configuración para @arcaelas/dynamite

Esta guía cubre todo lo que necesitas para instalar, configurar y verificar @arcaelas/dynamite en tu proyecto.

---

## Tabla de Contenidos

- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración de AWS](#configuración-de-aws)
- [Configuración Básica](#configuración-básica)
- [Verificación](#verificación)
- [Solución de Problemas](#solución-de-problemas)
- [Próximos Pasos](#próximos-pasos)

---

## Requisitos Previos

Antes de instalar @arcaelas/dynamite, asegúrate de que tu entorno de desarrollo cumpla con estos requisitos:

### Versión de Node.js

- **Node.js 16.x o superior** (se recomienda 18.x o 20.x)
- **npm 7.x o superior** o **yarn 1.22.x o superior**

Verifica tus versiones:

```bash
node --version  # Should be >= 16.0.0
npm --version   # Should be >= 7.0.0
```

Si necesitas actualizar Node.js, recomendamos usar [nvm](https://github.com/nvm-sh/nvm):

```bash
# Install Node.js 20 LTS
nvm install 20
nvm use 20
```

### Requisitos de Cuenta AWS

Necesitarás uno de los siguientes:

1. **Cuenta AWS** con acceso a DynamoDB
   - Credenciales AWS válidas (Access Key ID y Secret Access Key)
   - Permisos IAM para operaciones de DynamoDB
   - Selección de región AWS (ej., `us-east-1`, `eu-west-1`)

2. **DynamoDB Local** para desarrollo (recomendado para pruebas)
   - Docker instalado (método más fácil)
   - O Java Runtime Environment 8.x o superior

### Configuración de Tablas DynamoDB

@arcaelas/dynamite puede crear tablas automáticamente, pero debes entender:

- **Estructura de Clave Primaria**: Cada tabla necesita una clave de partición (y opcionalmente una clave de ordenación)
- **Modo de Facturación**: Elige entre capacidad bajo demanda o aprovisionada
- **Nomenclatura de Tablas**: Las tablas se nombran automáticamente según los nombres de tus clases modelo

> **Nota**: Para producción, es posible que desees crear tablas manualmente para un mejor control sobre la capacidad y los índices.

### TypeScript (Opcional pero Recomendado)

- **TypeScript 5.x o superior** para seguridad de tipos completa
- Configurar `tsconfig.json` con modo estricto habilitado

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## Instalación

### Instalar vía npm

```bash
# Install @arcaelas/dynamite
npm install @arcaelas/dynamite

# Install peer dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Instalar vía yarn

```bash
# Install @arcaelas/dynamite
yarn add @arcaelas/dynamite

# Install peer dependencies
yarn add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Instalar vía pnpm

```bash
# Install @arcaelas/dynamite
pnpm add @arcaelas/dynamite

# Install peer dependencies
pnpm add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Verificar la Instalación

Después de la instalación, verifica que los paquetes estén instalados correctamente:

```bash
npm list @arcaelas/dynamite @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

Deberías ver una salida similar a:

```
project@1.0.0 /path/to/project
├── @arcaelas/dynamite@x.x.x
├── @aws-sdk/client-dynamodb@x.x.x
└── @aws-sdk/lib-dynamodb@x.x.x
```

---

## Configuración de AWS

### Opción 1: DynamoDB Local (Recomendado para Desarrollo)

DynamoDB Local es perfecto para desarrollo y pruebas sin costos de AWS.

#### Usando Docker

La forma más fácil de ejecutar DynamoDB Local:

```bash
# Pull and run DynamoDB Local
docker run -d \
  -p 8000:8000 \
  --name dynamodb-local \
  amazon/dynamodb-local
```

#### Usando Docker Compose

Crea un archivo `docker-compose.yml`:

```yaml
version: '3.8'

services:
  dynamodb-local:
    image: amazon/dynamodb-local
    container_name: dynamodb-local
    ports:
      - "8000:8000"
    command: ["-jar", "DynamoDBLocal.jar", "-sharedDb", "-dbPath", "/home/dynamodblocal/data/"]
    volumes:
      - dynamodb_data:/home/dynamodblocal/data
    working_dir: /home/dynamodblocal

volumes:
  dynamodb_data:
    driver: local
```

Inicia el servicio:

```bash
docker-compose up -d
```

#### Usando Java Runtime

Si no usas Docker, descarga y ejecuta DynamoDB Local directamente:

```bash
# Download DynamoDB Local
wget https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz

# Extract
tar -xvzf dynamodb_local_latest.tar.gz

# Run
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
```

#### Verificar que DynamoDB Local esté Ejecutándose

```bash
# Test connection
curl http://localhost:8000

# Or list tables (should return empty array initially)
aws dynamodb list-tables --endpoint-url http://localhost:8000 --region us-east-1
```

### Opción 2: AWS DynamoDB (Producción)

Para implementación en producción, usa AWS DynamoDB.

#### Configurar Credenciales AWS

**Método 1: Configuración AWS CLI** (Recomendado)

```bash
# Install AWS CLI if not already installed
# https://aws.amazon.com/cli/

# Configure credentials
aws configure

# Enter your credentials when prompted:
# AWS Access Key ID: YOUR_ACCESS_KEY_ID
# AWS Secret Access Key: YOUR_SECRET_ACCESS_KEY
# Default region name: us-east-1
# Default output format: json
```

**Método 2: Variables de Entorno**

```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_REGION="us-east-1"
```

**Método 3: Roles IAM** (Para EC2, Lambda, ECS)

Si ejecutas en infraestructura AWS, usa roles IAM en lugar de credenciales:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:DescribeTable",
        "dynamodb:CreateTable"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/*"
    }
  ]
}
```

#### Selecciona tu Región AWS

Elige una región cercana a tus usuarios para menor latencia:

- `us-east-1` - US East (N. Virginia)
- `us-west-2` - US West (Oregon)
- `eu-west-1` - Europe (Ireland)
- `ap-southeast-1` - Asia Pacific (Singapore)
- [Ver todas las regiones](https://docs.aws.amazon.com/general/latest/gr/rande.html#ddb_region)

---

## Configuración Básica

### Crear Archivo de Configuración

Crea un archivo de configuración para inicializar Dynamite:

**config/database.ts** (TypeScript)

```typescript
import { Dynamite } from "@arcaelas/dynamite";

export function ConfigureDatabase() {
  // Development configuration (DynamoDB Local)
  if (process.env.NODE_ENV === "development") {
    Dynamite.config({
      region: "us-east-1",
      endpoint: "http://localhost:8000",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test"
      }
    });
  }
  // Production configuration (AWS DynamoDB)
  else {
    Dynamite.config({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }
}
```

**config/database.js** (JavaScript)

```javascript
const { Dynamite } = require("@arcaelas/dynamite");

function ConfigureDatabase() {
  // Development configuration (DynamoDB Local)
  if (process.env.NODE_ENV === "development") {
    Dynamite.config({
      region: "us-east-1",
      endpoint: "http://localhost:8000",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test"
      }
    });
  }
  // Production configuration (AWS DynamoDB)
  else {
    Dynamite.config({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }
}

module.exports = { ConfigureDatabase };
```

### Configuración de Variables de Entorno

Crea un archivo `.env` en la raíz de tu proyecto:

```bash
# Development
NODE_ENV=development
DYNAMODB_ENDPOINT=http://localhost:8000

# Production (only set these in production)
# NODE_ENV=production
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-access-key-id
# AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

Instala dotenv para cargar variables de entorno:

```bash
npm install dotenv
```

Carga las variables de entorno en tu aplicación:

```typescript
// At the top of your main file (index.ts, app.ts, server.ts)
import dotenv from "dotenv";
dotenv.config();

import { ConfigureDatabase } from "./config/database";
ConfigureDatabase();
```

### Define tu Primer Modelo

Crea un modelo simple de Usuario para probar la instalación:

**models/user.ts** (TypeScript)

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  NotNull
} from "@arcaelas/dynamite";

export class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;
}
```

**models/user.js** (JavaScript)

```javascript
const {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  NotNull
} = require("@arcaelas/dynamite");

class User extends Table {
  id;
  name;
  email;
  role;
  active;
  createdAt;
  updatedAt;
}

// Apply decorators
PrimaryKey()(User.prototype, "id");
Default(() => crypto.randomUUID())(User.prototype, "id");
NotNull()(User.prototype, "name");
NotNull()(User.prototype, "email");
Default(() => "customer")(User.prototype, "role");
Default(() => true)(User.prototype, "active");
CreatedAt()(User.prototype, "createdAt");
UpdatedAt()(User.prototype, "updatedAt");

module.exports = { User };
```

### Configuración Completa de la Aplicación

**index.ts** (TypeScript)

```typescript
import dotenv from "dotenv";
dotenv.config();

import { ConfigureDatabase } from "./config/database";
import { User } from "./models/user";

// Initialize database connection
ConfigureDatabase();

async function main() {
  try {
    // Create a new user
    const user = await User.create({
      name: "John Doe",
      email: "john@example.com"
    });

    console.log("User created:", user);
    console.log("ID:", user.id);
    console.log("Name:", user.name);
    console.log("Email:", user.email);
    console.log("Role:", user.role);
    console.log("Active:", user.active);
    console.log("Created At:", user.createdAt);

    // Query all users
    const allUsers = await User.where({});
    console.log("Total users:", allUsers.length);

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
```

---

## Verificación

### Paso 1: Probar Conexión a la Base de Datos

Crea un archivo de prueba simple:

**test-connection.ts**

```typescript
import dotenv from "dotenv";
dotenv.config();

import { Dynamite } from "@arcaelas/dynamite";

async function TestConnection() {
  try {
    Dynamite.config({
      region: "us-east-1",
      endpoint: process.env.DYNAMODB_ENDPOINT || "http://localhost:8000",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
      }
    });

    console.log("✓ Dynamite configured successfully");
    console.log("✓ Connection test passed");

  } catch (error) {
    console.error("✗ Connection failed:", error);
    process.exit(1);
  }
}

TestConnection();
```

Ejecuta la prueba:

```bash
npm run build  # If using TypeScript
node dist/test-connection.js

# Or with ts-node
npx ts-node test-connection.ts
```

Salida esperada:

```
✓ Dynamite configured successfully
✓ Connection test passed
```

### Paso 2: Probar Operaciones del Modelo

Crea una prueba completa:

**test-model.ts**

```typescript
import dotenv from "dotenv";
dotenv.config();

import { ConfigureDatabase } from "./config/database";
import { User } from "./models/user";

ConfigureDatabase();

async function TestModelOperations() {
  console.log("Starting model operations test...\n");

  try {
    // Test 1: Create
    console.log("Test 1: Creating user...");
    const user = await User.create({
      name: "Test User",
      email: "test@example.com"
    });
    console.log("✓ User created:", user.id);

    // Test 2: Read
    console.log("\nTest 2: Reading user...");
    const foundUser = await User.first({ id: user.id });
    console.log("✓ User found:", foundUser?.name);

    // Test 3: Update
    console.log("\nTest 3: Updating user...");
    await User.update(user.id, { name: "Updated Name" });
    const updatedUser = await User.first({ id: user.id });
    console.log("✓ User updated:", updatedUser?.name);

    // Test 4: Query
    console.log("\nTest 4: Querying users...");
    const users = await User.where({ active: true });
    console.log("✓ Found", users.length, "active users");

    // Test 5: Delete
    console.log("\nTest 5: Deleting user...");
    await User.delete(user.id);
    const deletedUser = await User.first({ id: user.id });
    console.log("✓ User deleted:", deletedUser === undefined);

    console.log("\n✓ All tests passed!");

  } catch (error) {
    console.error("\n✗ Test failed:", error);
    process.exit(1);
  }
}

TestModelOperations();
```

Ejecuta la prueba:

```bash
npx ts-node test-model.ts
```

Salida esperada:

```
Starting model operations test...

Test 1: Creating user...
✓ User created: abc-123-def-456

Test 2: Reading user...
✓ User found: Test User

Test 3: Updating user...
✓ User updated: Updated Name

Test 4: Querying users...
✓ Found 1 active users

Test 5: Deleting user...
✓ User deleted: true

✓ All tests passed!
```

### Paso 3: Verificar Creación de Tablas

Verifica que las tablas de DynamoDB fueron creadas:

```bash
# For DynamoDB Local
aws dynamodb list-tables \
  --endpoint-url http://localhost:8000 \
  --region us-east-1

# For AWS DynamoDB
aws dynamodb list-tables --region us-east-1
```

Salida esperada:

```json
{
  "TableNames": [
    "User"
  ]
}
```

Describe la estructura de la tabla:

```bash
# For DynamoDB Local
aws dynamodb describe-table \
  --table-name User \
  --endpoint-url http://localhost:8000 \
  --region us-east-1

# For AWS DynamoDB
aws dynamodb describe-table \
  --table-name User \
  --region us-east-1
```

---

## Solución de Problemas

### Problemas Comunes de Instalación

#### Problema: Módulo No Encontrado

**Error:**
```
Error: Cannot find module '@arcaelas/dynamite'
```

**Solución:**
```bash
# Verify installation
npm list @arcaelas/dynamite

# Reinstall if necessary
npm install @arcaelas/dynamite --save

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Problema: Dependencias Peer Faltantes

**Error:**
```
npm WARN @arcaelas/dynamite requires a peer of @aws-sdk/client-dynamodb
```

**Solución:**
```bash
# Install all peer dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

#### Problema: Errores de Decoradores de TypeScript

**Error:**
```
error TS1238: Unable to resolve signature of class decorator
```

**Solución:**

Actualiza tu `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Problemas Comunes de Configuración

#### Problema: No se Puede Conectar a DynamoDB Local

**Error:**
```
NetworkingError: connect ECONNREFUSED 127.0.0.1:8000
```

**Solución:**

```bash
# Check if DynamoDB Local is running
docker ps | grep dynamodb-local

# If not running, start it
docker run -d -p 8000:8000 amazon/dynamodb-local

# Test connection
curl http://localhost:8000
```

#### Problema: Credenciales AWS Inválidas

**Error:**
```
UnrecognizedClientException: The security token included in the request is invalid
```

**Solución:**

```bash
# Verify credentials
aws sts get-caller-identity

# Reconfigure AWS CLI
aws configure

# Or check environment variables
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
```

#### Problema: Permisos de Tabla Faltantes

**Error:**
```
AccessDeniedException: User is not authorized to perform: dynamodb:CreateTable
```

**Solución:**

Asegúrate de que tu usuario/rol IAM tenga los permisos necesarios:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/*"
    }
  ]
}
```

### Problemas de Tiempo de Ejecución

#### Problema: Metadatos No Encontrados

**Error:**
```
Error: Metadata no encontrada para la tabla User
```

**Solución:**

Asegúrate de que los decoradores se ejecuten antes de usar el modelo:

```typescript
// ✓ Correct: Import model before using
import { User } from "./models/user";
const user = await User.create({ name: "John" });

// ✗ Wrong: Using model before decorators execute
const user = await User.create({ name: "John" });
import { User } from "./models/user";
```

#### Problema: Clave Primaria Faltante

**Error:**
```
Error: PartitionKey faltante en la tabla User
```

**Solución:**

Cada modelo debe tener una clave primaria:

```typescript
class User extends Table<User> {
  @PrimaryKey()  // Add this decorator
  declare id: string;
}
```

### Problemas de Rendimiento

#### Problema: Consultas Lentas

Verifica tus patrones de consulta:

```typescript
// ✗ Bad: Scanning entire table
const users = (await User.where({})).filter(u => u.age > 18);

// ✓ Good: Using query filters
const users = await User.where("age", ">", 18);
```

#### Problema: Alto Uso de Memoria

Usa proyección de atributos para limitar datos:

```typescript
// ✓ Only fetch needed fields
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});
```

---

## Próximos Pasos

¡Felicitaciones! Has instalado y configurado exitosamente @arcaelas/dynamite.

### Próximos Pasos Recomendados

1. **Aprende lo Básico**: Lee la [Guía de Inicio](./guides/getting-started.md)
2. **Explora Características**: Revisa la [Guía de Decoradores](./guides/decorators.md)
3. **Entiende las Relaciones**: Aprende sobre [Relaciones](./guides/relationships.md)
4. **Domina las Consultas**: Estudia las [Consultas Avanzadas](./examples/advanced-queries.md)
5. **Tipos TypeScript**: Revisa los [Tipos](./api/types.md)

### Proyectos de Ejemplo

Crea un proyecto de muestra para practicar:

```bash
mkdir my-dynamite-app
cd my-dynamite-app
npm init -y
npm install @arcaelas/dynamite @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Recursos Adicionales

- [Referencia de API](./api/table.md)
- [Mejores Prácticas de DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Documentación AWS SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Repositorio GitHub](https://github.com/arcaelas/dynamite)

### Comunidad y Soporte

- **Issues**: [Reportar bugs en GitHub](https://github.com/arcaelas/dynamite/issues)
- **Discusiones**: [Únete a las discusiones de la comunidad](https://github.com/arcaelas/dynamite/discussions)
- **Actualizaciones**: [Sigue los lanzamientos](https://github.com/arcaelas/dynamite/releases)

---

**¿Necesitas Ayuda?**

Si encuentras algún problema no cubierto en esta guía, por favor:
1. Revisa la sección de [Solución de Problemas](#solución-de-problemas) arriba
2. Abre un issue en [GitHub](https://github.com/arcaelas/dynamite/issues)

---

**Hecho con ❤️ por [Miguel Alejandro](https://github.com/arcaelas) - [Arcaelas Insiders](https://github.com/arcaelas)**
