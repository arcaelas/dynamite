# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when using Dynamite with DynamoDB.

## Table of Contents

- [Connection Errors](#connection-errors)
- [Query Errors](#query-errors)
- [Validation Errors](#validation-errors)
- [Relationship Errors](#relationship-errors)
- [Performance Issues](#performance-issues)
- [Type Errors](#type-errors)
- [Debugging Tips](#debugging-tips)
- [Common Error Messages](#common-error-messages)

## Connection Errors

### Invalid Credentials

**Error:**
```
UnrecognizedClientException: The security token included in the request is invalid
```

**Causes:**
- Invalid AWS credentials
- Expired credentials
- Wrong IAM permissions

**Solutions:**

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

**IAM Policy Required:**

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

### Wrong Region

**Error:**
```
ResourceNotFoundException: Requested resource not found
```

**Causes:**
- Table exists in different region
- Incorrect region configuration

**Solutions:**

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

### Connection Timeout

**Error:**
```
TimeoutError: Connection timeout after 5000ms
```

**Causes:**
- Network issues
- VPC configuration problems
- DynamoDB endpoint not accessible

**Solutions:**

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

### Local DynamoDB Connection

**Error:**
```
NetworkingError: connect ECONNREFUSED 127.0.0.1:8000
```

**Causes:**
- DynamoDB Local not running
- Wrong port configuration

**Solutions:**

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

## Query Errors

### Invalid Query Operator

**Error:**
```
ValidationException: Query key condition not supported
```

**Causes:**
- Using wrong operator for key condition
- Filter on partition key with unsupported operator

**Solutions:**

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

**Supported Operators by Key Type:**

| Key Type | Supported Operators |
|----------|-------------------|
| Partition Key | `=` (exact match only) |
| Sort Key | `=`, `<`, `<=`, `>`, `>=`, `between`, `beginsWith` |
| Non-Key Attributes | All operators (via filter expression) |

### Missing Index

**Error:**
```
ValidationException: Query condition missed key schema element
```

**Causes:**
- Querying on non-key attribute without index
- Wrong index name specified

**Solutions:**

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

### Empty Result Set

**Error:**
No error, but results are empty when data exists.

**Causes:**
- Wrong key values
- Case sensitivity issues
- Data type mismatch

**Solutions:**

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

### Inconsistent Reads

**Error:**
Data just written is not returned by query.

**Causes:**
- Eventually consistent reads (default)
- Reading from GSI (always eventually consistent)

**Solutions:**

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

## Validation Errors

### Decorator Validation Failed

**Error:**
```
ValidationError: Attribute 'email' does not match pattern
```

**Causes:**
- Input doesn't match decorator validation rules
- Missing required attributes

**Solutions:**

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

### Type Mismatch

**Error:**
```
TypeError: Cannot convert 'name' to string
```

**Causes:**
- Wrong data type for attribute
- Missing type conversion

**Solutions:**

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

### Required Attribute Missing

**Error:**
```
ValidationError: Missing required attribute 'name'
```

**Causes:**
- Required attribute not provided
- Undefined or null value for required field

**Solutions:**

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

## Relationship Errors

### Circular Dependency

**Error:**
```
ReferenceError: Cannot access 'Order' before initialization
```

**Causes:**
- Circular imports between entity files
- Bidirectional relationships

**Solutions:**

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

### Missing Foreign Key

**Error:**
```
ValidationError: Foreign key 'user_id' is required
```

**Causes:**
- Foreign key not set when creating related entity
- Null foreign key value

**Solutions:**

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

### Eager Loading Fails

**Error:**
```
Error: Cannot load relationship 'user' - relation not defined
```

**Causes:**
- Relationship not properly configured
- Wrong foreign key specified

**Solutions:**

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

## Performance Issues

### Slow Queries

**Symptoms:**
- Queries taking > 1 second
- High latency in production

**Diagnosis:**

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

**Solutions:**

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

### Memory Issues

**Error:**
```
JavaScript heap out of memory
```

**Causes:**
- Loading too many items at once
- Memory leaks in pagination
- Large attribute values

**Solutions:**

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

### High Costs

**Symptoms:**
- DynamoDB bill higher than expected
- Many read/write capacity units consumed

**Diagnosis:**

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

## Type Errors

### TypeScript Compilation Errors

**Error:**
```
TS2322: Type 'string' is not assignable to type 'number'
```

**Solutions:**

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

### Generic Type Issues

**Error:**
```
TS2345: Argument of type 'unknown' is not assignable to parameter
```

**Solutions:**

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

## Debugging Tips

### Enable Debug Logging

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

### Inspect DynamoDB Requests

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

### Use DynamoDB Console

Access AWS Console to inspect data directly:

1. Go to DynamoDB Console
2. Select your table
3. Click "Explore table items"
4. Run queries to verify data structure
5. Check indexes and capacity settings

### Local Testing

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

## Common Error Messages

### ResourceNotFoundException

```
ResourceNotFoundException: Requested resource not found
```

**Meaning:** Table or index doesn't exist.

**Solutions:**
- Verify table name is correct
- Check table exists in the specified region
- Ensure table is fully created (not in CREATING status)
- For indexes, verify GSI name

### ConditionalCheckFailedException

```
ConditionalCheckFailedException: The conditional request failed
```

**Meaning:** Condition expression evaluated to false.

**Solutions:**
- Check your condition expressions
- Verify attribute values are correct
- Use consistent reads for conditions

### ProvisionedThroughputExceededException

```
ProvisionedThroughputExceededException: Rate exceeded
```

**Meaning:** Too many requests for provisioned capacity.

**Solutions:**
- Enable auto-scaling
- Increase provisioned capacity
- Implement exponential backoff
- Use on-demand billing mode

### ValidationException

```
ValidationException: One or more parameter values were invalid
```

**Meaning:** Invalid request parameters.

**Solutions:**
- Check attribute names are correct
- Verify key schema matches
- Ensure operators are supported
- Review data types

---

For more help:
- [Performance Guide](./performance.md)
- [Migration Guide](./migration.md)
- [AWS Support](https://aws.amazon.com/support/)
