# Client API Reference

## Overview

The Dynamite client is the central configuration manager for DynamoDB connections. It handles client initialization, table synchronization, and connection lifecycle management. The `Dynamite` class provides a clean API for configuring AWS SDK DynamoDB clients and automatically creating tables with their Global Secondary Indexes (GSI).

## Class: Dynamite

The main client class that manages DynamoDB connections and table operations.

### Constructor

```typescript
constructor(config: DynamiteConfig)
```

Creates a new Dynamite client instance with the provided configuration.

**Parameters:**
- `config` (DynamiteConfig): Configuration object containing DynamoDB client settings and table definitions

**Example:**
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

## Configuration

### DynamiteConfig Interface

```typescript
interface DynamiteConfig extends DynamoDBClientConfig {
  tables: Array<new (...args: any[]) => any>;
}
```

The configuration interface extends AWS SDK's `DynamoDBClientConfig` and adds table definitions.

**Properties:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tables` | `Array<Class>` | Yes | Array of Table class constructors to register |
| `region` | `string` | Yes | AWS region (e.g., "us-east-1") |
| `endpoint` | `string` | No | Custom endpoint URL (for DynamoDB Local) |
| `credentials` | `AwsCredentials` | No | AWS credentials object |
| `maxAttempts` | `number` | No | Maximum retry attempts |
| `requestTimeout` | `number` | No | Request timeout in milliseconds |

### AWS Credentials

```typescript
interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}
```

## Instance Methods

### connect()

```typescript
connect(): void
```

Connects the client and sets it as the global DynamoDB client for Table operations. This method must be called before performing any Table operations.

**Example:**
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

// Now Table operations are available
const user = await User.create({ name: "John" });
```

**Notes:**
- Idempotent operation - calling multiple times has no effect
- Sets the internal client as the global client for all Table instances
- Must be called before any Table.create(), Table.where(), etc.

### sync()

```typescript
async sync(): Promise<void>
```

Synchronizes all declared tables with DynamoDB. This method creates tables if they don't exist, including their Global Secondary Indexes (GSI) for `@HasMany` relationships.

**Returns:**
- `Promise<void>`: Resolves when all tables are synchronized

**Example:**
```typescript
await client.sync();

// All tables defined in config.tables are now created in DynamoDB
// with their primary keys, sort keys, and GSI indexes
```

**Behavior:**
- Creates tables with `PAY_PER_REQUEST` billing mode
- Automatically detects and creates GSI for `@HasMany` relationships
- Idempotent - safe to call multiple times
- Ignores `ResourceInUseException` (table already exists)
- Throws errors for other failures

**Table Creation Details:**
- **Partition Key**: Detected from `@PrimaryKey()` or `@Index()` decorator
- **Sort Key**: Detected from `@IndexSort()` decorator (optional)
- **GSI**: Automatically created for each `@HasMany` relationship with naming pattern `GSI{N}_{foreignKey}`
- **Billing Mode**: `PAY_PER_REQUEST` (on-demand)
- **Attribute Definitions**: Automatically inferred (all keys default to String type)

### getClient()

```typescript
getClient(): DynamoDBClient
```

Returns the underlying AWS SDK DynamoDB client instance.

**Returns:**
- `DynamoDBClient`: The AWS SDK DynamoDB client

**Example:**
```typescript
const awsClient = client.getClient();

// Use for direct AWS SDK operations
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
const result = await awsClient.send(
  new DescribeTableCommand({ TableName: "users" })
);
```

**Use Cases:**
- Direct access to AWS SDK operations
- Custom commands not supported by Dynamite
- Advanced DynamoDB features
- Testing and debugging

### isReady()

```typescript
isReady(): boolean
```

Checks if the client is connected and all tables are synchronized.

**Returns:**
- `boolean`: `true` if both `connect()` and `sync()` have completed successfully

**Example:**
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

Disconnects and cleans up the DynamoDB client. Destroys the underlying AWS SDK client and resets internal state.

**Example:**
```typescript
client.disconnect();

// Client is no longer usable
// Table operations will throw errors
```

**Behavior:**
- Calls `client.destroy()` on the underlying AWS SDK client
- Resets `connected` and `synced` flags
- Clears the global client reference if it matches this instance
- Safe to call multiple times
- Logs warnings if destruction fails

### tx()

```typescript
async tx<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R>
```

Executes operations within an atomic transaction. If any operation fails, all changes are automatically rolled back.

**Type Parameters:**
- `R`: Return type of the callback function

**Parameters:**
- `callback` (`(tx: TransactionContext) => Promise<R>`): Function containing transactional operations

**Returns:**
- `Promise<R>`: Result returned by the callback function

**Example:**
```typescript
const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User, Order]
});

dynamite.connect();
await dynamite.sync();

// Atomic transaction - all operations succeed or all fail
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, tx);
  await Order.create({ user_id: user.id, total: 100 }, tx);
  await Order.create({ user_id: user.id, total: 200 }, tx);
  // If any create fails, all operations are rolled back
});
```

**Limitations:**
- Maximum 25 operations per transaction (DynamoDB limit)
- Throws error if limit exceeded

**Transaction Operations:**
```typescript
// Creating records in transaction
await dynamite.tx(async (tx) => {
  await User.create({ name: "John" }, tx);
  await User.create({ name: "Jane" }, tx);
});

// Mixed operations
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, tx);
  await user.destroy(tx); // Soft delete in transaction
});
```

**Use Cases:**
- Creating related records atomically (user + orders)
- Ensuring data consistency across multiple tables
- Batch operations that must all succeed or all fail
- Soft-deleting parent and child records together

**Error Handling:**
```typescript
try {
  await dynamite.tx(async (tx) => {
    await User.create({ name: "John" }, tx);
    throw new Error("Simulated failure");
    // First create is rolled back
  });
} catch (error) {
  console.log("Transaction failed, all changes rolled back");
}
```

## Class: TransactionContext

Internal class that manages transactional operations. Passed to callbacks in `tx()`.

### addPut()

```typescript
addPut(table_name: string, item: Record<string, any>): void
```

Adds a Put operation to the transaction.

**Parameters:**
- `table_name` (`string`): DynamoDB table name
- `item` (`Record<string, any>`): Item to insert

### addDelete()

```typescript
addDelete(table_name: string, key: Record<string, any>): void
```

Adds a Delete operation to the transaction.

**Parameters:**
- `table_name` (`string`): DynamoDB table name
- `key` (`Record<string, any>`): Primary key of item to delete

### commit()

```typescript
async commit(): Promise<void>
```

Commits all queued operations atomically. Called automatically by `tx()`.

**Throws:**
- `Error`: If transaction exceeds 25 operations
- DynamoDB errors if transaction fails

## Configuration Examples

### Local Development (DynamoDB Local)

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

**Docker Setup:**
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

### AWS Production Configuration

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

### Environment Variables

```bash
# .env file
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# For local development
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

// Add endpoint only for local development
if (process.env.DYNAMODB_ENDPOINT) {
  config.endpoint = process.env.DYNAMODB_ENDPOINT;
}

const client = new Dynamite(config);
client.connect();
await client.sync();
```

### Multiple Client Instances

You can create multiple Dynamite clients for different configurations or regions.

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order } from "./models";
import { Log, Metric } from "./monitoring";

// Production database client
const production_client = new Dynamite({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.PROD_AWS_KEY!,
    secretAccessKey: process.env.PROD_AWS_SECRET!
  },
  tables: [User, Order]
});

// Analytics database client (different region)
const analytics_client = new Dynamite({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.ANALYTICS_AWS_KEY!,
    secretAccessKey: process.env.ANALYTICS_AWS_SECRET!
  },
  tables: [Log, Metric]
});

// Connect production client (becomes global)
production_client.connect();
await production_client.sync();

// User and Order operations use production_client
const user = await User.create({ name: "John" });

// Switch to analytics client
analytics_client.connect();
await analytics_client.sync();

// Log and Metric operations now use analytics_client
const log = await Log.create({ message: "User created" });
```

**Important Notes:**
- Only one client can be the "global" client at a time
- Calling `connect()` on a new client replaces the global client
- Table operations always use the current global client
- Consider using explicit client passing for multi-client scenarios

### Custom Configuration Options

```typescript
const client = new Dynamite({
  region: "us-east-1",
  endpoint: "https://dynamodb.us-east-1.amazonaws.com",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product],

  // Advanced AWS SDK options
  maxAttempts: 5,
  requestTimeout: 5000,

  // Custom retry strategy
  retryMode: "adaptive",

  // Enable logging
  logger: console
});
```

## Utility Functions

### setGlobalClient()

```typescript
export const setGlobalClient = (client: DynamoDBClient): void
```

Sets the global DynamoDB client for Table operations. Typically called internally by `Dynamite.connect()`.

**Parameters:**
- `client` (DynamoDBClient): AWS SDK DynamoDB client instance

**Example:**
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

Gets the current global DynamoDB client. Throws an error if no client is set.

**Returns:**
- `DynamoDBClient`: The global DynamoDB client

**Throws:**
- `Error`: If no global client has been set

**Example:**
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

Checks if a global DynamoDB client is available.

**Returns:**
- `boolean`: `true` if a global client exists

**Example:**
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

Requires a global client to be available. Throws an error with a localized message if not set.

**Returns:**
- `DynamoDBClient`: The global DynamoDB client

**Throws:**
- `Error`: If no global client is configured (Spanish error message)

**Example:**
```typescript
import { requireClient } from "@arcaelas/dynamite";

try {
  const client = requireClient();
  // Use client for operations
} catch (error) {
  console.error(error.message); // "DynamoDB client no configurado. Use Dynamite.connect() primero."
}
```

## Error Handling

### Common Errors

#### ResourceInUseException

Thrown when attempting to create a table that already exists.

```typescript
try {
  await client.sync();
} catch (error) {
  if (error.name === "ResourceInUseException") {
    console.log("Table already exists");
  }
}
```

**Note:** Dynamite automatically handles this error during `sync()`.

#### ValidationException

Thrown when table schema or attributes are invalid.

```typescript
try {
  await client.sync();
} catch (error) {
  if (error.name === "ValidationException") {
    console.error("Invalid table schema:", error.message);
  }
}
```

**Common Causes:**
- Missing `@PrimaryKey()` or `@Index()` decorator
- Reserved keyword used as attribute name
- Invalid attribute type
- PK and SK with same attribute name

#### UnrecognizedClientException

Thrown when credentials are invalid or DynamoDB endpoint is unreachable.

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

**Solutions:**
- Verify AWS credentials
- Check DynamoDB Local is running (for local development)
- Verify endpoint URL is correct
- Check network connectivity

#### Metadata Not Found

Thrown when attempting to sync a table without proper decorators.

```typescript
try {
  await client.sync();
} catch (error) {
  if (error.message.includes("not registered in wrapper")) {
    console.error("Table class missing decorators");
  }
}
```

**Solution:** Ensure all table classes use `@PrimaryKey()` or `@Index()` decorator.

#### No Global Client

Thrown when attempting Table operations without connecting first.

```typescript
try {
  const user = await User.create({ name: "John" });
} catch (error) {
  if (error.message.includes("DynamoDB client no configurado")) {
    console.error("Call client.connect() first");
  }
}
```

### Error Handling Best Practices

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
    // Connect client
    client.connect();
    console.log("Client connected");

    // Sync tables
    await client.sync();
    console.log("Tables synchronized");

    // Verify ready state
    if (client.isReady()) {
      console.log("Database ready for operations");
    }

    return client;
  } catch (error: any) {
    // Handle specific errors
    if (error.name === "UnrecognizedClientException") {
      console.error("Authentication failed. Check credentials.");
    } else if (error.name === "ValidationException") {
      console.error("Invalid table schema:", error.message);
    } else if (error.message?.includes("not registered in wrapper")) {
      console.error("Table class missing decorators");
    } else {
      console.error("Database initialization failed:", error);
    }

    // Cleanup on failure
    client.disconnect();
    throw error;
  }
}

// Usage
try {
  const client = await initialize_database();

  // Perform operations
  const user = await User.create({ name: "John" });

  // Cleanup on shutdown
  process.on("SIGINT", () => {
    client.disconnect();
    process.exit(0);
  });
} catch (error) {
  console.error("Application failed to start");
  process.exit(1);
}
```

## Complete Usage Example

### Basic Application Setup

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

// Define models
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

// Initialize client
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

  // Connect and sync
  client.connect();
  await client.sync();

  console.log("Database ready:", client.isReady());
  return client;
}

// Application entry point
async function main() {
  const client = await setup_database();

  try {
    // Create user
    const user = await User.create({
      name: "John Doe",
      email: "john@example.com"
    });

    console.log("User created:", user.id);

    // Create orders
    const order1 = await Order.create({
      user_id: user.id,
      total: 99.99
    });

    const order2 = await Order.create({
      user_id: user.id,
      total: 149.99
    });

    // Query with relationships
    const users_with_orders = await User.where({ id: user.id }, {
      include: {
        orders: {
          where: { status: "pending" }
        }
      }
    });

    console.log("User orders:", users_with_orders[0].orders.length);
  } finally {
    // Cleanup on exit
    client.disconnect();
  }
}

main().catch(console.error);
```

### Express.js Integration

```typescript
import express from "express";
import { Dynamite } from "@arcaelas/dynamite";
import { User } from "./models";

const app = express();
app.use(express.json());

// Initialize database
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

// API routes
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

// Start server
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

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  client.disconnect();
  process.exit(0);
});
```

## Best Practices

### 1. Single Client Instance

Create one client instance per application and reuse it.

```typescript
// Good
const client = new Dynamite({ /* config */ });
client.connect();
await client.sync();

// Bad - creates multiple clients unnecessarily
function get_client() {
  return new Dynamite({ /* config */ });
}
```

### 2. Call sync() Once

Call `sync()` only during application initialization, not before every operation.

```typescript
// Good - sync once at startup
await client.sync();
const user = await User.create({ name: "John" });
const order = await Order.create({ user_id: user.id });

// Bad - syncing repeatedly
await client.sync();
const user = await User.create({ name: "John" });
await client.sync();
const order = await Order.create({ user_id: user.id });
```

### 3. Graceful Shutdown

Always disconnect the client on application shutdown.

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

### 4. Environment-Based Configuration

Use environment variables for configuration to separate dev/staging/production.

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

### 5. Error Handling

Always handle errors during initialization and provide meaningful feedback.

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

### 6. Testing Setup

Use separate clients for testing with isolated configuration.

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

## See Also

- [Table API Reference](./table.md) - Complete Table class documentation
- [Decorators Reference](./decorators.md) - All available decorators
- [AWS SDK DynamoDB Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/) - Underlying AWS SDK documentation
- [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) - Local development setup
