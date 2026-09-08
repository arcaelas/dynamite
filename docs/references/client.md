# Client API Reference

## Overview

`Dynamite` holds the DynamoDB connection, the list of models it serves, the optional table synchronization and the transactions.

## Class: Dynamite

### Constructor

```typescript
constructor(config: DynamiteConfig)
```

Builds the client. It opens no connection and calls no AWS API.

```typescript
import { Dynamite } from "@arcaelas/dynamite";

const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  tables: [User, Order, Product]
});
```

## Configuration

### `DynamiteConfig`

```typescript
interface DynamiteConfig extends DynamoDBClientConfig {
  tables: Array<new (...args: any[]) => any>;
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tables` | `Array<Class>` | Yes | The model classes this client serves |
| `region` | `string` | No | AWS region. Resolved from the environment when omitted |
| `endpoint` | `string` | No | Custom endpoint, for DynamoDB Local |
| `credentials` | `AwsCredentialIdentity` | No | Explicit credentials. Resolved from the environment when omitted |

Everything else `DynamoDBClientConfig` accepts — credential providers, `maxAttempts`, `requestHandler`, custom endpoints — is accepted here and passed straight to the AWS SDK.

## Instance Methods

### `connect()`

```typescript
async connect(): Promise<void>
```

Configures the client and works out which GSIs the models expect. **It calls no AWS API and creates nothing.**

**Behaviour:**

- Registers the global client every `Table` operation uses
- Records, from the schemas alone, the GSIs each model expects: every non-primary `@Index` column and every foreign key of a `@HasMany` or `@HasOne`
- Idempotent: calling it twice does nothing the second time

```typescript
const dynamite = new Dynamite({ region: "us-east-1", tables: [User, Order] });
await dynamite.connect();

const user = await User.create({ name: "John" });
```

---

### `sync()`

```typescript
async sync(): Promise<void>
```

Creates in DynamoDB whatever the models declare and the account does not have yet. It is the development path.

**Behaviour:**

- Requires `connect()` first, otherwise it throws `Call connect() before sync()`
- Describes every table and pivot table in parallel
- Creates the missing tables with `PAY_PER_REQUEST` billing, their partition key, their sort key when a column carries `@IndexSort`, and their GSIs
- Creates the pivot tables of `@ManyToMany` with an `id` key and one GSI per side
- Adds the missing GSIs to existing tables one round at a time, waiting for each round to become `ACTIVE`, because DynamoDB only builds one index at a time per table
- Idempotent: calling it twice does nothing the second time

```typescript
await dynamite.connect();
await dynamite.sync();
```

In production the infrastructure declares the tables and their indexes with the same names —
`<field>_index`, partition key on `<field>`, projection `ALL` — and `sync()` is not called.

---

### `tx()`

```typescript
async tx<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R>
```

Runs a set of mutations atomically. Nothing is written until the callback returns; if it throws, no operation is applied.

```typescript
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, { tx });
  await Order.create({ user_id: user.id, total: 100 }, { tx });
  await User.increment("orders_count", 1, { id: user.id }, { tx });
});
```

**Behaviour and limits:**

- Every mutation takes the transaction inside its options object: `{ tx }`
- Up to 100 operations, sent in batches of 25
- `__isPersisted` and the `after*` hooks fire after the commit, never before
- Reads inside the callback are ordinary reads: they do not see what the transaction has queued

## Class: TransactionContext

The object `tx()` hands to the callback. You rarely touch it directly, the models do it for you.

### `addPut()`

```typescript
addPut(table_name: string, item: Record<string, any>, condition?: { expression: string; names: Record<string, string> }): void
```

Queues a write. `create()` uses the condition to refuse an existing primary key.

### `addDelete()`

```typescript
addDelete(table_name: string, key: Record<string, any>): void
```

Queues a delete.

### `addUpdate()`

```typescript
addUpdate(table_name: string, key: Record<string, any>, expression: string, names: Record<string, string>, values: Record<string, any>): void
```

Queues a partial update. `increment()` and `decrement()` use it.

### `onCommit()`

```typescript
onCommit(fn: () => void | Promise<void>): void
```

Registers a callback that runs after a successful commit. That is where the instances are marked as persisted and where the `after*` hooks run.

### `commit()`

```typescript
async commit(): Promise<void>
```

Sends everything queued, in batches of 25, and then runs the `onCommit` callbacks. `tx()` calls it for you.

## Utility Functions

### `setGlobalClient(client)`

Sets the global DynamoDB client. `connect()` calls it.

### `getGlobalClient()`

Returns the current client. Throws when there is none.

### `hasGlobalClient()`

`true` when a client has been configured.

### `requireClient()`

Returns the current client or throws `DynamoDB client no configurado. Use Dynamite.connect() primero.` It is what every model operation calls.

## Configuration Examples

### Local Development

```typescript
const dynamite = new Dynamite({
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  tables: [User, Order]
});

await dynamite.connect();
await dynamite.sync();
```

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

### AWS Production

```typescript
const dynamite = new Dynamite({
  region: process.env.AWS_REGION!,
  tables: [User, Order]
});

await dynamite.connect();
// no sync(): the infrastructure owns the tables and their indexes
```

## Complete Example

```typescript
import { Dynamite, Table, PrimaryKey, Index, HasMany, BelongsTo, NonAttribute, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare name: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Index()
  declare user_id: string;

  declare total: number;

  @BelongsTo(() => User, "id", "user_id")
  declare user: NonAttribute<User | null>;
}

async function main() {
  const dynamite = new Dynamite({
    region: "local",
    endpoint: "http://localhost:8000",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    tables: [User, Order]
  });

  await dynamite.connect();
  await dynamite.sync();

  await dynamite.tx(async (tx) => {
    const user = await User.create({ name: "John" }, { tx });
    await Order.create({ user_id: user.id, total: 99.99 }, { tx });
  });

  const users = await User.where({}, { include: { orders: true } });
  console.log(users[0].orders);
}

main();
```

## See Also

- [Table API Reference](./table.md)
- [Decorators Reference](./decorators.md)
