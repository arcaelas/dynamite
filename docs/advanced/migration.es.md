# Guía de Migración

Esta guía le ayuda a migrar a Dynamite desde otros ORMs o actualizar entre versiones.

## Tabla de Contenidos

- [Migrar desde Otros ORMs](#migrar-desde-otros-orms)
- [Guía de Actualización de Versión](#guía-de-actualización-de-versión)
- [Migración de Esquema](#migración-de-esquema)
- [Migración de Datos](#migración-de-datos)
- [Pruebas de Migraciones](#pruebas-de-migraciones)
- [Despliegue en Producción](#despliegue-en-producción)

## Migrar desde Otros ORMs

### Desde Sequelize (SQL)

Sequelize está diseñado para bases de datos relacionales. Aquí está cómo adaptarse al paradigma NoSQL de DynamoDB.

**Modelo Sequelize:**

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

**Equivalente en Dynamite:**

```typescript
// Dynamite (DynamoDB)
@Entity()
class User {
  @PartitionKey()
  id!: string; // Use UUID instead of auto-increment

  @Attribute()
  @Index('EmailIndex', { type: 'PARTITION' })
  email!: string;

  @Attribute()
  name!: string;

  @Attribute()
  created_at!: number; // Unix timestamp

  @HasMany(() => Order, 'user_id')
  orders!: Order[];
}

@Entity()
class Order {
  @PartitionKey()
  user_id!: string; // Partition by user for efficient queries

  @SortKey()
  id!: string; // Order ID as sort key

  @Attribute()
  total!: number;

  @Attribute()
  status!: string;

  @BelongsTo(() => User, 'user_id')
  user!: User;
}

// Query - different approach for NoSQL
const users = await User.find({
  where: { email: 'user@example.com' }, // Exact match with GSI
  index: 'EmailIndex',
  include: ['orders']
});

// For "LIKE" queries, fetch and filter in memory
const all_users = await User.scan();
const filtered = all_users.filter(u => u.email.endsWith('@example.com'));
```

**Diferencias Clave:**

| Concepto | Sequelize (SQL) | Dynamite (DynamoDB) |
|----------|----------------|---------------------|
| Clave Primaria | Auto-incremento integer | UUID o clave compuesta |
| Consultas | Cláusulas WHERE complejas | Condiciones de clave + filtros |
| Joins | Soporte nativo JOIN | Carga manual de relaciones |
| Transacciones | Transacciones ACID | Transacciones limitadas (25 elementos) |
| Esquema | Esquema rígido | Esquema flexible |

**Estrategia de Migración:**

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
    created_at: user.created_at.getTime()
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
  for (let i = 0; i < data.length; i += 25) {
    const batch = data.slice(i, i + 25);

    await User.batchWrite(
      batch.map(item => ({
        action: 'put',
        item
      }))
    );

    console.log(`Imported ${Math.min(i + 25, data.length)}/${data.length}`);
  }
}
```

### Desde TypeORM

TypeORM soporta múltiples bases de datos incluyendo DynamoDB (soporte básico).

**Entidad TypeORM:**

```typescript
// TypeORM
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

**Equivalente en Dynamite:**

```typescript
// Dynamite
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute()
  @Index('EmailIndex', { type: 'PARTITION' })
  email!: string;

  @Attribute()
  name!: string;

  @HasMany(() => Order, 'user_id')
  orders!: Order[];

  @Attribute()
  created_at!: number;

  @Attribute()
  updated_at!: number;
}

@Entity()
class Order {
  @PartitionKey()
  user_id!: string;

  @SortKey()
  id!: string;

  @Attribute()
  total!: number;

  @BelongsTo(() => User, 'user_id')
  user!: User;
}

// Query
const users = await User.scan({
  filter: { name: { contains: 'John' } }
});

// Load relationships
for (const user of users) {
  user.orders = await Order.find({
    where: { user_id: user.id }
  });
}
```

**Pasos de Migración:**

```typescript
// 1. Create mapping function
function MapTypeORMToDynamite(typeorm_user: any): any {
  return {
    id: `user-${typeorm_user.id}`,
    email: typeorm_user.email,
    name: typeorm_user.name,
    created_at: typeorm_user.created_at.getTime(),
    updated_at: typeorm_user.updated_at.getTime()
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

    await User.batchWrite(
      dynamite_users.map(user => ({
        action: 'put',
        item: user
      }))
    );

    page++;
    console.log(`Migrated page ${page}`);
  }
}
```

### Desde Mongoose (MongoDB)

MongoDB y DynamoDB son ambos NoSQL, pero tienen patrones de consulta diferentes.

**Esquema Mongoose:**

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

**Equivalente en Dynamite:**

```typescript
// Dynamite
@Entity()
class User {
  @PartitionKey()
  id!: string; // MongoDB _id → DynamoDB id

  @Attribute()
  @Index('EmailIndex', { type: 'PARTITION' })
  email!: string;

  @Attribute()
  name!: string;

  @Attribute()
  profile!: {
    bio: string;
    avatar_url: string;
  };

  @Attribute()
  tags!: string[];

  @Attribute()
  created_at!: number;
}

// Query - use sparse index for tag queries
@Entity()
class User {
  // ... other fields

  @Attribute()
  @Index('TagIndex', { type: 'PARTITION' })
  tag_premium?: string; // Set to 'true' if has premium tag

  @Attribute()
  @Index('TagIndex', { type: 'SORT' })
  created_at!: number;
}

const users = await User.find({
  where: {
    tag_premium: 'true'
  },
  index: 'TagIndex',
  sort: 'desc'
});
```

**Script de Migración:**

```typescript
// Migrate from MongoDB to DynamoDB
async function MigrateFromMongoDB(): Promise<void> {
  const mongo_users = await mongoose.models.User.find().lean();

  const dynamite_users = mongo_users.map(user => ({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    profile: user.profile,
    tags: user.tags,
    created_at: user.created_at.getTime(),
    // Create sparse index attributes
    tag_premium: user.tags.includes('premium') ? 'true' : undefined,
    tag_verified: user.tags.includes('verified') ? 'true' : undefined
  }));

  // Batch write
  for (let i = 0; i < dynamite_users.length; i += 25) {
    await User.batchWrite(
      dynamite_users.slice(i, i + 25).map(user => ({
        action: 'put',
        item: user
      }))
    );
  }
}
```

## Guía de Actualización de Versión

### Actualizar a v2.0

**Cambios Incompatibles:**

1. **Cambios en Sintaxis de Decoradores**

```typescript
// v1.x
@Entity({ table_name: 'Users' })
class User {
  @PrimaryKey()
  id!: string;

  @Column()
  name!: string;
}

// v2.x
@Entity()
class User {
  @PartitionKey() // Renamed from @PrimaryKey
  id!: string;

  @Attribute() // Renamed from @Column
  name!: string;
}
```

2. **Cambios en Configuración**

```typescript
// v1.x
Dynamite.init({
  region: 'us-east-1',
  table_prefix: 'prod_'
});

// v2.x
Dynamite.Configure({
  client: new DynamoDBClient({ region: 'us-east-1' }),
  table_prefix: 'prod_'
});
```

3. **Cambios en Sintaxis de Consulta**

```typescript
// v1.x
const users = await User.find({
  status: 'active'
});

// v2.x
const users = await User.find({
  where: { status: 'active' }
});
```

**Pasos de Migración:**

```bash
# 1. Install new version
npm install dynamite@2.0.0

# 2. Run migration script
npx dynamite migrate --from=1.x --to=2.x

# 3. Update code with codemod
npx dynamite-codemod v1-to-v2 ./src
```

### Actualizar a v3.0

**Cambios Incompatibles:**

1. **Configuración Asíncrona**

```typescript
// v2.x
Dynamite.Configure({ client });

// v3.x
await Dynamite.Configure({ client });
```

2. **Carga de Relaciones**

```typescript
// v2.x
const user = await User.findOne({
  where: { id: 'user-123' },
  include: { orders: true }
});

// v3.x
const user = await User.findOne({
  where: { id: 'user-123' },
  include: ['orders']
});
```

**Migración Automatizada:**

```typescript
// migration_v2_to_v3.ts
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function MigrateFile(file_path: string): void {
  let content = readFileSync(file_path, 'utf-8');

  // Replace sync Configure with async
  content = content.replace(
    /Dynamite\.Configure\(/g,
    'await Dynamite.Configure('
  );

  // Replace include object with array
  content = content.replace(
    /include:\s*{\s*(\w+):\s*true\s*}/g,
    "include: ['$1']"
  );

  writeFileSync(file_path, content);
  console.log(`Migrated: ${file_path}`);
}

// Run on all TypeScript files
function MigrateDirectory(dir: string): void {
  for (const file of readdirSync(dir)) {
    const file_path = join(dir, file);

    if (file.endsWith('.ts')) {
      MigrateFile(file_path);
    }
  }
}

MigrateDirectory('./src');
```

## Migración de Esquema

### Agregar Nuevos Atributos

Agregar atributos a elementos existentes requiere planificación cuidadosa.

```typescript
// Old schema
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute()
  name!: string;
}

// New schema
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute()
  name!: string;

  @Attribute()
  email?: string; // New optional attribute

  @Attribute()
  created_at!: number; // New required attribute
}

// Migration script
async function AddAttributes(): Promise<void> {
  let cursor: any;

  do {
    const page = await User.scan({ limit: 100, cursor });

    for (const user of page.items) {
      await User.update(
        { id: user.id },
        {
          email: user.email || `${user.id}@example.com`,
          created_at: user.created_at || Date.now()
        }
      );
    }

    cursor = page.cursor;
  } while (cursor);
}
```

### Crear Nuevos Índices

Los Global Secondary Indexes pueden agregarse sin tiempo de inactividad.

```typescript
// Add GSI to entity
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute()
  @Index('EmailIndex', { type: 'PARTITION' }) // New GSI
  email!: string;

  @Attribute()
  name!: string;
}

// Create index using AWS SDK
import { UpdateTableCommand } from '@aws-sdk/client-dynamodb';

async function CreateIndex(): Promise<void> {
  const client = new DynamoDBClient({ region: 'us-east-1' });

  await client.send(new UpdateTableCommand({
    TableName: 'Users',
    AttributeDefinitions: [
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexUpdates: [{
      Create: {
        IndexName: 'EmailIndex',
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    }]
  }));

  console.log('Index creation started');

  // Wait for index to be active
  let status = 'CREATING';
  while (status === 'CREATING') {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const table = await User.describeTable();
    const index = table.GlobalSecondaryIndexes?.find(
      i => i.IndexName === 'EmailIndex'
    );

    status = index?.IndexStatus || 'CREATING';
    console.log(`Index status: ${status}`);
  }

  console.log('Index created successfully');
}
```

### Renombrar Atributos

DynamoDB no soporta renombrar atributos. Cree nuevo atributo y copie datos.

```typescript
// Migration: name → full_name
async function RenameAttribute(): Promise<void> {
  let cursor: any;
  let processed = 0;

  do {
    const page = await User.scan({ limit: 100, cursor });

    const updates = page.items.map(user => ({
      action: 'put' as const,
      item: {
        ...user,
        full_name: user.name, // Copy to new attribute
        name: undefined // Remove old attribute
      }
    }));

    await User.batchWrite(updates);

    processed += page.items.length;
    cursor = page.cursor;

    console.log(`Processed ${processed} users`);
  } while (cursor);
}

// Update entity definition
@Entity()
class User {
  @PartitionKey()
  id!: string;

  @Attribute()
  full_name!: string; // Renamed from 'name'
}
```

### Cambiar Esquema de Claves

Cambiar claves de partición o ordenamiento requiere crear una nueva tabla.

```typescript
// Old schema
@Entity({ table_name: 'Orders_v1' })
class OrderV1 {
  @PartitionKey()
  order_id!: string;

  @Attribute()
  customer_id!: string;
}

// New schema - optimized for customer queries
@Entity({ table_name: 'Orders_v2' })
class OrderV2 {
  @PartitionKey()
  customer_id!: string; // Changed to partition key

  @SortKey()
  order_id!: string; // Changed to sort key
}

// Migration script
async function MigrateKeySchema(): Promise<void> {
  // 1. Create new table
  await OrderV2.createTable();

  // 2. Copy data
  let cursor: any;

  do {
    const page = await OrderV1.scan({ limit: 100, cursor });

    await OrderV2.batchWrite(
      page.items.map(order => ({
        action: 'put',
        item: {
          customer_id: order.customer_id,
          order_id: order.order_id,
          // ... copy other attributes
        }
      }))
    );

    cursor = page.cursor;
  } while (cursor);

  // 3. Switch application to use new table
  // 4. Delete old table after verification
  await OrderV1.deleteTable();
}
```

## Migración de Datos

### Exportar a S3

Para conjuntos de datos grandes, use exportación a S3.

```typescript
import { ExportTableToPointInTimeCommand } from '@aws-sdk/client-dynamodb';

async function ExportToS3(): Promise<void> {
  const client = new DynamoDBClient({ region: 'us-east-1' });

  const export_arn = await client.send(
    new ExportTableToPointInTimeCommand({
      TableArn: 'arn:aws:dynamodb:us-east-1:123456789:table/Users',
      S3Bucket: 'my-exports-bucket',
      S3Prefix: 'dynamodb-exports/',
      ExportFormat: 'DYNAMODB_JSON'
    })
  );

  console.log('Export started:', export_arn.ExportDescription?.ExportArn);
}
```

### Transformar Datos Durante Migración

Aplique transformaciones mientras migra.

```typescript
interface TransformFunction<TInput, TOutput> {
  (input: TInput): TOutput;
}

async function MigrateWithTransform<TInput, TOutput>(
  source_model: typeof Entity,
  target_model: typeof Entity,
  transform: TransformFunction<TInput, TOutput>
): Promise<void> {
  let cursor: any;
  let migrated = 0;

  do {
    const page = await source_model.scan({ limit: 100, cursor });

    const transformed = page.items.map(transform);

    await target_model.batchWrite(
      transformed.map(item => ({
        action: 'put',
        item
      }))
    );

    migrated += transformed.length;
    cursor = page.cursor;

    console.log(`Migrated ${migrated} items`);
  } while (cursor);
}

// Usage
await MigrateWithTransform(
  OldUser,
  NewUser,
  (old_user) => ({
    id: old_user.id,
    email: old_user.email.toLowerCase(), // Transform: normalize email
    name: old_user.first_name + ' ' + old_user.last_name, // Transform: combine names
    created_at: new Date(old_user.created_at).getTime() // Transform: date to timestamp
  })
);
```

### Migración Paralela

Acelere la migración con procesamiento paralelo.

```typescript
async function ParallelMigration(partition_count = 10): Promise<void> {
  const workers = Array.from({ length: partition_count }, async (_, segment) => {
    let cursor: any;
    let processed = 0;

    do {
      const page = await User.scan({
        limit: 100,
        cursor,
        segment,
        total_segments: partition_count
      });

      // Process items
      for (const user of page.items) {
        await ProcessUser(user);
        processed++;
      }

      cursor = page.cursor;

      console.log(`Worker ${segment}: processed ${processed}`);
    } while (cursor);
  });

  await Promise.all(workers);
}
```

## Pruebas de Migraciones

### Framework de Prueba

Cree un framework de prueba para migraciones.

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

class MigrationTester {
  private readonly test_client: DynamoDBClient;

  constructor() {
    this.test_client = new DynamoDBClient({
      region: 'local',
      endpoint: 'http://localhost:8000',
      credentials: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy'
      }
    });
  }

  async Setup(): Promise<void> {
    // Create test tables
    await User.createTable();

    // Seed test data
    await this.SeedData();
  }

  private async SeedData(): Promise<void> {
    const test_users = Array.from({ length: 100 }, (_, i) => ({
      id: `user-${i}`,
      name: `User ${i}`,
      email: `user${i}@example.com`
    }));

    for (let i = 0; i < test_users.length; i += 25) {
      await User.batchWrite(
        test_users.slice(i, i + 25).map(user => ({
          action: 'put',
          item: user
        }))
      );
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
    await User.deleteTable();
  }
}

// Usage
const tester = new MigrationTester();

await tester.Setup();

const result = await tester.RunMigration(async () => {
  // Run your migration
  await AddEmailAttribute();
});

const verified = await tester.Verify(async () => {
  const users = await User.scan();
  return users.every(u => u.email !== undefined);
});

console.log('Migration:', result.success ? 'PASS' : 'FAIL');
console.log('Verification:', verified ? 'PASS' : 'FAIL');

await tester.Teardown();
```

## Despliegue en Producción

### Lista de Verificación Pre-Despliegue

```markdown
- [ ] Probar migración en datos similares a producción
- [ ] Verificar que la creación de índice no impactará el rendimiento
- [ ] Preparar plan de rollback
- [ ] Configurar alertas de monitoreo
- [ ] Programar durante ventana de bajo tráfico
- [ ] Comunicar con el equipo
- [ ] Respaldar datos críticos
- [ ] Probar en ambiente de staging
```

### Despliegue Blue-Green

Despliegue sin tiempo de inactividad usando estrategia blue-green.

```typescript
// 1. Deploy new version (green) alongside old (blue)
// 2. Route small percentage to green
// 3. Monitor metrics
// 4. Gradually increase traffic to green
// 5. Decommission blue when stable

class BlueGreenDeployment {
  private green_percentage = 0;

  async RouteRequest(user_id: string): Promise<'blue' | 'green'> {
    const hash = this.HashUserId(user_id);
    return hash < this.green_percentage ? 'green' : 'blue';
  }

  private HashUserId(user_id: string): number {
    let hash = 0;
    for (let i = 0; i < user_id.length; i++) {
      hash = (hash << 5) - hash + user_id.charCodeAt(i);
    }
    return Math.abs(hash % 100);
  }

  IncreaseGreenTraffic(percentage: number): void {
    this.green_percentage = Math.min(100, percentage);
    console.log(`Green traffic: ${this.green_percentage}%`);
  }
}
```

### Estrategia de Rollback

Siempre tenga un plan de rollback.

```typescript
class MigrationRollback {
  private backup_table_name = 'Users_backup';

  async CreateBackup(): Promise<void> {
    console.log('Creating backup...');

    let cursor: any;

    do {
      const page = await User.scan({ limit: 100, cursor });

      // Write to backup table
      await this.WriteToBackup(page.items);

      cursor = page.cursor;
    } while (cursor);

    console.log('Backup complete');
  }

  private async WriteToBackup(items: any[]): Promise<void> {
    // Implementation depends on your backup strategy
    // Could be: S3, separate DynamoDB table, etc.
  }

  async Rollback(): Promise<void> {
    console.log('Rolling back...');

    // Restore from backup
    // Delete new table
    // Rename backup to original
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

Para más información:
- [Guía de Rendimiento](./performance.md)
- [Guía de Solución de Problemas](./troubleshooting.md)
- [Documentación AWS DynamoDB](https://docs.aws.amazon.com/dynamodb/)
