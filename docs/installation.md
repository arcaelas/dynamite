# Installation Guide

> Complete installation and configuration guide for @arcaelas/dynamite

This guide covers everything you need to install, configure, and verify @arcaelas/dynamite in your project.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [AWS Configuration](#aws-configuration)
- [Basic Configuration](#basic-configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

---

## Prerequisites

Before installing @arcaelas/dynamite, ensure your development environment meets these requirements:

### Node.js Version

- **Node.js 16.x or higher** (18.x or 20.x recommended)
- **npm 7.x or higher** or **yarn 1.22.x or higher**

Check your versions:

```bash
node --version  # Should be >= 16.0.0
npm --version   # Should be >= 7.0.0
```

If you need to upgrade Node.js, we recommend using [nvm](https://github.com/nvm-sh/nvm):

```bash
# Install Node.js 20 LTS
nvm install 20
nvm use 20
```

### AWS Account Requirements

You'll need one of the following:

1. **AWS Account** with DynamoDB access
   - Valid AWS credentials (Access Key ID and Secret Access Key)
   - IAM permissions for DynamoDB operations
   - AWS region selection (e.g., `us-east-1`, `eu-west-1`)

2. **DynamoDB Local** for development (recommended for testing)
   - Docker installed (easiest method)
   - Or Java Runtime Environment 8.x or higher

### DynamoDB Table Setup

@arcaelas/dynamite can automatically create tables, but you should understand:

- **Primary Key Structure**: Each table needs a partition key (and optionally a sort key)
- **Billing Mode**: Choose between On-Demand or Provisioned capacity
- **Table Naming**: Tables are automatically named based on your model class names

> **Note**: For production, you may want to create tables manually for better control over capacity and indexes.

### TypeScript (Optional but Recommended)

- **TypeScript 5.x or higher** for full type safety
- Configure `tsconfig.json` with strict mode enabled

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

## Installation

### Install via npm

```bash
# Install @arcaelas/dynamite
npm install @arcaelas/dynamite

# Install peer dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Install via yarn

```bash
# Install @arcaelas/dynamite
yarn add @arcaelas/dynamite

# Install peer dependencies
yarn add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Install via pnpm

```bash
# Install @arcaelas/dynamite
pnpm add @arcaelas/dynamite

# Install peer dependencies
pnpm add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Verify Installation

After installation, verify the packages are installed correctly:

```bash
npm list @arcaelas/dynamite @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

You should see output similar to:

```
project@1.0.0 /path/to/project
├── @arcaelas/dynamite@x.x.x
├── @aws-sdk/client-dynamodb@x.x.x
└── @aws-sdk/lib-dynamodb@x.x.x
```

---

## AWS Configuration

### Option 1: DynamoDB Local (Recommended for Development)

DynamoDB Local is perfect for development and testing without AWS costs.

#### Using Docker

The easiest way to run DynamoDB Local:

```bash
# Pull and run DynamoDB Local
docker run -d \
  -p 8000:8000 \
  --name dynamodb-local \
  amazon/dynamodb-local
```

#### Using Docker Compose

Create a `docker-compose.yml` file:

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

Start the service:

```bash
docker-compose up -d
```

#### Using Java Runtime

If you don't use Docker, download and run DynamoDB Local directly:

```bash
# Download DynamoDB Local
wget https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz

# Extract
tar -xvzf dynamodb_local_latest.tar.gz

# Run
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
```

#### Verify DynamoDB Local is Running

```bash
# Test connection
curl http://localhost:8000

# Or list tables (should return empty array initially)
aws dynamodb list-tables --endpoint-url http://localhost:8000 --region us-east-1
```

### Option 2: AWS DynamoDB (Production)

For production deployment, use AWS DynamoDB.

#### Set Up AWS Credentials

**Method 1: AWS CLI Configuration** (Recommended)

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

**Method 2: Environment Variables**

```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_REGION="us-east-1"
```

**Method 3: IAM Roles** (For EC2, Lambda, ECS)

If running on AWS infrastructure, use IAM roles instead of credentials:

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

#### Select Your AWS Region

Choose a region close to your users for lower latency:

- `us-east-1` - US East (N. Virginia)
- `us-west-2` - US West (Oregon)
- `eu-west-1` - Europe (Ireland)
- `ap-southeast-1` - Asia Pacific (Singapore)
- [View all regions](https://docs.aws.amazon.com/general/latest/gr/rande.html#ddb_region)

---

## Basic Configuration

### Create Configuration File

Create a configuration file to initialize Dynamite:

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

### Environment Variables Setup

Create a `.env` file in your project root:

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

Install dotenv to load environment variables:

```bash
npm install dotenv
```

Load environment variables in your application:

```typescript
// At the top of your main file (index.ts, app.ts, server.ts)
import dotenv from "dotenv";
dotenv.config();

import { ConfigureDatabase } from "./config/database";
ConfigureDatabase();
```

### Define Your First Model

Create a simple User model to test the installation:

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

### Complete Application Setup

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

## Verification

### Step 1: Test Database Connection

Create a simple test file:

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

Run the test:

```bash
npm run build  # If using TypeScript
node dist/test-connection.js

# Or with ts-node
npx ts-node test-connection.ts
```

Expected output:

```
✓ Dynamite configured successfully
✓ Connection test passed
```

### Step 2: Test Model Operations

Create a comprehensive test:

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

Run the test:

```bash
npx ts-node test-model.ts
```

Expected output:

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

### Step 3: Verify Table Creation

Check that DynamoDB tables were created:

```bash
# For DynamoDB Local
aws dynamodb list-tables \
  --endpoint-url http://localhost:8000 \
  --region us-east-1

# For AWS DynamoDB
aws dynamodb list-tables --region us-east-1
```

Expected output:

```json
{
  "TableNames": [
    "User"
  ]
}
```

Describe the table structure:

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

## Troubleshooting

### Common Installation Issues

#### Issue: Module Not Found

**Error:**
```
Error: Cannot find module '@arcaelas/dynamite'
```

**Solution:**
```bash
# Verify installation
npm list @arcaelas/dynamite

# Reinstall if necessary
npm install @arcaelas/dynamite --save

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Issue: Peer Dependencies Missing

**Error:**
```
npm WARN @arcaelas/dynamite requires a peer of @aws-sdk/client-dynamodb
```

**Solution:**
```bash
# Install all peer dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

#### Issue: TypeScript Decorator Errors

**Error:**
```
error TS1238: Unable to resolve signature of class decorator
```

**Solution:**

Update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Common Configuration Issues

#### Issue: Cannot Connect to DynamoDB Local

**Error:**
```
NetworkingError: connect ECONNREFUSED 127.0.0.1:8000
```

**Solution:**

```bash
# Check if DynamoDB Local is running
docker ps | grep dynamodb-local

# If not running, start it
docker run -d -p 8000:8000 amazon/dynamodb-local

# Test connection
curl http://localhost:8000
```

#### Issue: AWS Credentials Invalid

**Error:**
```
UnrecognizedClientException: The security token included in the request is invalid
```

**Solution:**

```bash
# Verify credentials
aws sts get-caller-identity

# Reconfigure AWS CLI
aws configure

# Or check environment variables
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
```

#### Issue: Missing Table Permissions

**Error:**
```
AccessDeniedException: User is not authorized to perform: dynamodb:CreateTable
```

**Solution:**

Ensure your IAM user/role has the necessary permissions:

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

### Runtime Issues

#### Issue: Metadata Not Found

**Error:**
```
Error: Metadata no encontrada para la tabla User
```

**Solution:**

Ensure decorators are executed before using the model:

```typescript
// ✓ Correct: Import model before using
import { User } from "./models/user";
const user = await User.create({ name: "John" });

// ✗ Wrong: Using model before decorators execute
const user = await User.create({ name: "John" });
import { User } from "./models/user";
```

#### Issue: Primary Key Missing

**Error:**
```
Error: PartitionKey faltante en la tabla User
```

**Solution:**

Every model must have a primary key:

```typescript
class User extends Table<User> {
  @PrimaryKey()  // Add this decorator
  declare id: string;
}
```

### Performance Issues

#### Issue: Slow Queries

Check your query patterns:

```typescript
// ✗ Bad: Scanning entire table
const users = (await User.where({})).filter(u => u.age > 18);

// ✓ Good: Using query filters
const users = await User.where("age", ">", 18);
```

#### Issue: High Memory Usage

Use attribute projection to limit data:

```typescript
// ✓ Only fetch needed fields
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});
```

---

## Next Steps

Congratulations! You've successfully installed and configured @arcaelas/dynamite.

### Recommended Next Steps

1. **Learn the Basics**: Read the [Getting Started Guide](./getting-started.md)
2. **Explore Features**: Check out [Advanced Features](../README.md#-advanced-features)
3. **Understand Relationships**: Learn about [Relationships](../README.md#-relationships)
4. **Master Queries**: Study [Query Operations](../README.md#-query-operations)
5. **TypeScript Types**: Review [TypeScript Types](../README.md#-typescript-types)

### Example Projects

Create a sample project to practice:

```bash
mkdir my-dynamite-app
cd my-dynamite-app
npm init -y
npm install @arcaelas/dynamite @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Additional Resources

- [API Reference](../README.md#-api-reference)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [AWS SDK v3 Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [GitHub Repository](https://github.com/arcaelas/dynamite)

### Community and Support

- **Issues**: [Report bugs on GitHub](https://github.com/arcaelas/dynamite/issues)
- **Discussions**: [Join community discussions](https://github.com/arcaelas/dynamite/discussions)
- **Updates**: [Follow releases](https://github.com/arcaelas/dynamite/releases)

---

**Need Help?**

If you encounter any issues not covered in this guide, please:
1. Check the [Troubleshooting](#troubleshooting) section above
2. Review the [main README](../README.md#-troubleshooting)
3. Open an issue on [GitHub](https://github.com/arcaelas/dynamite/issues)

---

**Made with ❤️ by [Miguel Alejandro](https://github.com/arcaelas) - [Arcaelas Insiders](https://github.com/arcaelas)**
