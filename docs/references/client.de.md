# Client API Reference

## Overview

The `Dynamite` class manages DynamoDB connections, table synchronization, and transactions.

## Class: Dynamite

### Constructor

```typescript
constructor(config: DynamiteConfig)
```

Creates a new Dynamite client instance.

**Parameters:**
- `config` (DynamiteConfig): Configuration object

**Example:**
```typescript
import { Dynamite } from "@arcaelas/dynamite";

const dynamite = new Dynamite({
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

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tables` | `Array<Class>` | Yes | Array of Table class constructors |
| `region` | `string` | Yes | AWS region |
| `endpoint` | `string` | No | Custom endpoint (DynamoDB Local) |
| `credentials` | `AwsCredentials` | No | AWS credentials |

## Instance Methods

### connect()

```typescript
async connect(): Promise<void>
```

Connects to DynamoDB and synchronizes all declared tables. Creates tables and GSIs if they don't exist.

**Example:**
```typescript
const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User, Order]
});

await dynamite.connect();

// Now Table operations are available
const user = await User.create({ name: "John" });
```

**Behavior:**
- Sets the global client for all Table operations
- Creates tables with `PAY_PER_REQUEST` billing mode
- Creates pivot tables for ManyToMany relationships
- Idempotent - safe to call multiple times

### tx()

```typescript
async tx<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R>
```

Executes operations within an atomic transaction. If any operation fails, all changes are rolled back.

**Parameters:**
- `callback`: Function containing transactional operations

**Returns:**
- Result returned by the callback function

**Example:**
```typescript
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, tx);
  await Order.create({ user_id: user.id, total: 100 }, tx);
  // If any create fails, all operations are rolled back
});
```

**Limitations:**
- Maximum 25 operations per transaction (DynamoDB limit)

## Class: TransactionContext

Internal class passed to `tx()` callbacks.

### addPut()

```typescript
addPut(table_name: string, item: Record<string, any>): void
```

Adds a Put operation to the transaction.

### addDelete()

```typescript
addDelete(table_name: string, key: Record<string, any>): void
```

Adds a Delete operation to the transaction.

### commit()

```typescript
async commit(): Promise<void>
```

Commits all queued operations atomically. Called automatically by `tx()`.

## Utility Functions

### setGlobalClient()

```typescript
export const setGlobalClient = (client: DynamoDBClient): void
```

Sets the global DynamoDB client. Called internally by `connect()`.

### getGlobalClient()

```typescript
export const getGlobalClient = (): DynamoDBClient
```

Gets the current global client. Throws if no client is set.

### hasGlobalClient()

```typescript
export const hasGlobalClient = (): boolean
```

Checks if a global client is available.

### requireClient()

```typescript
export const requireClient = (): DynamoDBClient
```

Requires a global client. Throws with error message if not set.

## Configuration Examples

### Local Development

```typescript
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  tables: [User, Order]
});

await dynamite.connect();
```

**Docker:**
```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

### AWS Production

```typescript
const dynamite = new Dynamite({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order]
});

await dynamite.connect();
```

## Complete Example

```typescript
import { Dynamite, Table, PrimaryKey, Default, HasMany, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: string;

  declare name: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: string;

  declare user_id: string;
  declare total: number;
}

async function main() {
  const dynamite = new Dynamite({
    region: "us-east-1",
    endpoint: "http://localhost:8000",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    tables: [User, Order]
  });

  await dynamite.connect();

  // Atomic transaction
  await dynamite.tx(async (tx) => {
    const user = await User.create({ name: "John" }, tx);
    await Order.create({ user_id: user.id, total: 99.99 }, tx);
  });

  // Query with relations
  const users = await User.where({}, {
    include: { orders: {} }
  });

  console.log(users[0].orders);
}

main();
```

## See Also

- [Table API Reference](./table.md)
- [Decorators Reference](./decorators.md)
