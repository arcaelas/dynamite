# Migration Guide

This guide helps you migrate to Dynamite from other ORMs or upgrade between versions.

## Table of Contents

- [Migrating from Other ORMs](#migrating-from-other-orms)
- [Version Upgrade Guide](#version-upgrade-guide)
- [Schema Migration](#schema-migration)
- [Data Migration](#data-migration)
- [Testing Migrations](#testing-migrations)
- [Production Deployment](#production-deployment)

## Migrating from Other ORMs

### From Sequelize (SQL)

Sequelize is designed for relational databases. Here's how to adapt to DynamoDB's NoSQL paradigm.

**Sequelize Model:**

```typescript
// Sequelize (PostgreSQL/MySQL)
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  name: DataTypes.STRING,
  created_at: DataTypes.DATE
});

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    }
  },
  total: DataTypes.DECIMAL,
  status: DataTypes.STRING
});

// Query
const users = await User.findAll({
  where: {
    email: { [Op.like]: '%@example.com' }
  },
  include: [Order]
});
```

**Dynamite Equivalent:**

```typescript
// Dynamite (DynamoDB)
import {
  Table, PrimaryKey, Default, NotNull, CreatedAt,
  HasMany, BelongsTo, CreationOptional, NonAttribute
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>; // Use UUID instead of auto-increment

  @NotNull()
  declare email: string;

  declare name: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  declare total: number;
  declare status: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;
}

// Query - different approach for NoSQL
const users = await User.where({ email: "user@example.com" }, {
  include: { orders: true }
});

// For pattern matching, fetch and filter
const all_users = await User.where({});
const filtered = all_users.filter(u => u.email.endsWith("@example.com"));
```

**Key Differences:**

| Concept | Sequelize (SQL) | Dynamite (DynamoDB) |
|---------|----------------|---------------------|
| Primary Key | Auto-increment integer | UUID or composite key |
| Queries | Complex WHERE clauses | Key conditions + filters |
| Joins | Native JOIN support | Manual relationship loading |
| Transactions | ACID transactions | Limited transactions (25 items) |
| Schema | Rigid schema | Flexible schema |

**Migration Strategy:**

```typescript
// 1. Export data from SQL
import { Sequelize } from 'sequelize';

async function ExportFromSQL(): Promise<void> {
  const sequelize = new Sequelize('postgresql://...');
  const users = await sequelize.models.User.findAll();

  const export_data = users.map(user => ({
    id: `user-${user.id}`, // Transform ID format
    email: user.email,
    name: user.name,
    created_at: user.created_at.toISOString()
  }));

  // Save to file
  await fs.writeFile(
    'users_export.json',
    JSON.stringify(export_data, null, 2)
  );
}

// 2. Import to DynamoDB
async function ImportToDynamoDB(): Promise<void> {
  const data = JSON.parse(
    await fs.readFile('users_export.json', 'utf-8')
  );

  // Import in batches
  for (const item of data) {
    await User.create(item);
  }

  console.log(`Imported ${data.length} users`);
}
```

### From TypeORM

TypeORM supports multiple databases including DynamoDB (basic support).

**TypeORM Entity:**

```typescript
// TypeORM
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  name!: string;

  @OneToMany(() => Order, order => order.user)
  orders!: Order[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

@Entity()
class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, user => user.orders)
  user!: User;

  @Column('decimal')
  total!: number;
}

// Query
const users = await userRepository.find({
  where: { name: Like('%John%') },
  relations: ['orders']
});
```

**Dynamite Equivalent:**

```typescript
// Dynamite
import {
  Table, PrimaryKey, Default, NotNull, CreatedAt, UpdatedAt,
  HasMany, BelongsTo, CreationOptional, NonAttribute
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare email: string;

  declare name: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  declare total: number;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;
}

// Query
const users = await User.where({});
const filtered = users.filter(u => u.name.includes("John"));

// Load relationships
const users_with_orders = await User.where({}, {
  include: { orders: true }
});
```

**Migration Steps:**

```typescript
// 1. Create mapping function
function MapTypeORMToDynamite(typeorm_user: any): any {
  return {
    id: `user-${typeorm_user.id}`,
    email: typeorm_user.email,
    name: typeorm_user.name,
    created_at: typeorm_user.created_at.toISOString(),
    updated_at: typeorm_user.updated_at.toISOString()
  };
}

// 2. Migrate with streaming
async function MigrateFromTypeORM(): Promise<void> {
  const typeorm_repo = connection.getRepository(TypeORMUser);

  let page = 0;
  const page_size = 100;

  while (true) {
    const users = await typeorm_repo.find({
      skip: page * page_size,
      take: page_size
    });

    if (users.length === 0) break;

    const dynamite_users = users.map(MapTypeORMToDynamite);

    for (const user of dynamite_users) {
      await User.create(user);
    }

    page++;
    console.log(`Migrated page ${page}`);
  }
}
```

### From Mongoose (MongoDB)

MongoDB and DynamoDB are both NoSQL, but have different query patterns.

**Mongoose Schema:**

```typescript
// Mongoose (MongoDB)
const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  name: String,
  profile: {
    bio: String,
    avatar_url: String
  },
  tags: [String],
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// Query
const users = await User.find({
  tags: { $in: ['premium', 'verified'] }
}).sort({ created_at: -1 });
```

**Dynamite Equivalent:**

```typescript
// Dynamite
import {
  Table, PrimaryKey, Default, NotNull, CreatedAt,
  CreationOptional
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>; // MongoDB _id → DynamoDB id

  @NotNull()
  declare email: string;

  declare name: string;

  declare profile: {
    bio: string;
    avatar_url: string;
  };

  declare tags: string[];

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// Query - fetch and filter for tag queries
const all_users = await User.where({}, { order: "DESC" });
const premium_users = all_users.filter(u =>
  u.tags?.some(tag => ["premium", "verified"].includes(tag))
);
```

**Migration Script:**

```typescript
// Migrate from MongoDB to DynamoDB
async function MigrateFromMongoDB(): Promise<void> {
  const mongo_users = await mongoose.models.User.find().lean();

  for (const user of mongo_users) {
    await User.create({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      profile: user.profile,
      tags: user.tags,
      created_at: user.created_at.toISOString()
    });
  }
}
```

## Version Upgrade Guide

### Upgrading to v1.0

**Key Changes:**

1. **Class-based Models**

```typescript
// Before: Plain objects
const user = { id: "123", name: "John" };

// After: Class extending Table
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
}

const user = await User.create({ name: "John" });
```

2. **Decorator-based Configuration**

```typescript
// All configuration via decorators
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Invalid email")
  declare email: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}
```

3. **Client Initialization**

```typescript
import { Dynamite } from "@arcaelas/dynamite";

const client = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  tables: [User, Order]
});

await client.connect();

```

## Schema Migration

### Adding New Attributes

Adding attributes to existing items requires careful planning.

```typescript
// Old schema
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
}

// New schema
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  declare email?: string; // New optional attribute

  @Default(() => new Date().toISOString())
  declare created_at: CreationOptional<string>; // New with default
}

// Migration script
async function AddAttributes(): Promise<void> {
  const users = await User.where({});

  for (const user of users) {
    if (!user.created_at) {
      user.created_at = new Date().toISOString();
      await user.save();
    }
  }

  console.log(`Migrated ${users.length} users`);
}
```

### Renaming Attributes

DynamoDB doesn't support renaming attributes. Create new attribute and copy data.

```typescript
// Migration: name → full_name
async function RenameAttribute(): Promise<void> {
  const users = await User.where({});

  for (const user of users) {
    // Copy to new attribute
    (user as any).full_name = user.name;
    await user.save();
  }

  console.log(`Processed ${users.length} users`);
}

// Update entity definition after migration
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare full_name: string; // Renamed from 'name'
}
```

## Data Migration

### Transform Data During Migration

Apply transformations while migrating.

```typescript
interface TransformFunction<TInput, TOutput> {
  (input: TInput): TOutput;
}

async function MigrateWithTransform<TInput, TOutput>(
  source_data: TInput[],
  target_model: typeof Table,
  transform: TransformFunction<TInput, TOutput>
): Promise<void> {
  let migrated = 0;

  for (const item of source_data) {
    const transformed = transform(item);
    await target_model.create(transformed as any);
    migrated++;

    if (migrated % 100 === 0) {
      console.log(`Migrated ${migrated} items`);
    }
  }

  console.log(`Migration complete: ${migrated} items`);
}

// Usage
await MigrateWithTransform(
  old_users,
  User,
  (old_user) => ({
    id: old_user.id,
    email: old_user.email.toLowerCase(), // Transform: normalize email
    name: old_user.first_name + ' ' + old_user.last_name, // Transform: combine names
    created_at: new Date(old_user.created_at).toISOString() // Transform: date to ISO
  })
);
```

## Testing Migrations

### Test Framework

Create a test framework for migrations.

```typescript
import { Dynamite } from "@arcaelas/dynamite";

class MigrationTester {
  private client: Dynamite;

  constructor() {
    this.client = new Dynamite({
      region: "us-east-1",
      endpoint: "http://localhost:8000",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test"
      },
      tables: [User]
    });
  }

  async Setup(): Promise<void> {
    this.client.connect();
    await this.
    await this.SeedData();
  }

  private async SeedData(): Promise<void> {
    for (let i = 0; i < 100; i++) {
      await User.create({
        name: `User ${i}`,
        email: `user${i}@example.com`
      });
    }
  }

  async RunMigration(
    migration_fn: () => Promise<void>
  ): Promise<{ success: boolean; duration_ms: number }> {
    const start = Date.now();

    try {
      await migration_fn();
      return { success: true, duration_ms: Date.now() - start };
    } catch (error) {
      console.error('Migration failed:', error);
      return { success: false, duration_ms: Date.now() - start };
    }
  }

  async Verify(
    assertion: () => Promise<boolean>
  ): Promise<boolean> {
    return assertion();
  }

  async Teardown(): Promise<void> {
    this.client.disconnect();
  }
}

// Usage
const tester = new MigrationTester();

await tester.Setup();

const result = await tester.RunMigration(async () => {
  await AddEmailAttribute();
});

const verified = await tester.Verify(async () => {
  const users = await User.where({});
  return users.every(u => u.email !== undefined);
});

console.log('Migration:', result.success ? 'PASS' : 'FAIL');
console.log('Verification:', verified ? 'PASS' : 'FAIL');

await tester.Teardown();
```

## Production Deployment

### Pre-Deployment Checklist

```markdown
- [ ] Test migration on production-like data
- [ ] Prepare rollback plan
- [ ] Set up monitoring alerts
- [ ] Schedule during low-traffic window
- [ ] Communicate with team
- [ ] Backup critical data
- [ ] Test in staging environment
```

### Rollback Strategy

Always have a rollback plan.

```typescript
class MigrationRollback {
  private backup_data: any[] = [];

  async CreateBackup(): Promise<void> {
    console.log('Creating backup...');
    this.backup_data = await User.where({});
    console.log(`Backup complete: ${this.backup_data.length} items`);
  }

  async Rollback(): Promise<void> {
    console.log('Rolling back...');

    for (const item of this.backup_data) {
      await User.create(item);
    }

    console.log('Rollback complete');
  }
}

// Usage
const rollback = new MigrationRollback();

await rollback.CreateBackup();

try {
  await RunMigration();
} catch (error) {
  console.error('Migration failed, rolling back...');
  await rollback.Rollback();
}
```

---

For more information:
- [Decorators Guide](./decorators.md)
- [API Reference](./table.md)
- [AWS DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
