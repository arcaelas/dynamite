# Guía de Migración

Esta guía te ayuda a migrar a Dynamite desde otros ORMs o actualizar entre versiones.

## Tabla de Contenidos

- [Migrar desde Otros ORMs](#migrar-desde-otros-orms)
- [Guia de Actualizacion de Version](#guia-de-actualizacion-de-version)
- [Migracion de Esquema](#migracion-de-esquema)
- [Migracion de Datos](#migracion-de-datos)
- [Pruebas de Migraciones](#pruebas-de-migraciones)
- [Despliegue en Produccion](#despliegue-en-produccion)

## Migrar desde Otros ORMs

### Desde Sequelize (SQL)

Sequelize está diseñado para bases de datos relacionales. Aquí te mostramos cómo adaptarte al paradigma NoSQL de DynamoDB.

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

// Consulta
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
import {
  Table, PrimaryKey, Default, NotNull, CreatedAt,
  HasMany, BelongsTo, CreationOptional, NonAttribute
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>; // Usar UUID en lugar de auto-increment

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

// Consulta - enfoque diferente para NoSQL
const users = await User.where({ email: "user@example.com" }, {
  include: { orders: true }
});

// Para coincidencia de patrones, obtener y filtrar
const all_users = await User.where({});
const filtered = all_users.filter(u => u.email.endsWith("@example.com"));
```

**Diferencias Clave:**

| Concepto | Sequelize (SQL) | Dynamite (DynamoDB) |
|----------|----------------|---------------------|
| Clave Primaria | Entero auto-increment | UUID o clave compuesta |
| Consultas | Cláusulas WHERE complejas | Condiciones de clave + filtros |
| Joins | Soporte nativo de JOIN | Carga manual de relaciones |
| Transacciones | Transacciones ACID | Transacciones limitadas (25 items) |
| Esquema | Esquema rígido | Esquema flexible |

**Estrategia de Migración:**

```typescript
// 1. Exportar datos desde SQL
import { Sequelize } from 'sequelize';

async function ExportFromSQL(): Promise<void> {
  const sequelize = new Sequelize('postgresql://...');
  const users = await sequelize.models.User.findAll();

  const export_data = users.map(user => ({
    id: `user-${user.id}`, // Transformar formato de ID
    email: user.email,
    name: user.name,
    created_at: user.created_at.toISOString()
  }));

  // Guardar en archivo
  await fs.writeFile(
    'users_export.json',
    JSON.stringify(export_data, null, 2)
  );
}

// 2. Importar a DynamoDB
async function ImportToDynamoDB(): Promise<void> {
  const data = JSON.parse(
    await fs.readFile('users_export.json', 'utf-8')
  );

  // Importar en lotes
  for (const item of data) {
    await User.create(item);
  }

  console.log(`Importados ${data.length} usuarios`);
}
```

### Desde TypeORM

TypeORM soporta múltiples bases de datos incluyendo DynamoDB (soporte básico).

**Entidad TypeORM:**

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

// Consulta
const users = await userRepository.find({
  where: { name: Like('%John%') },
  relations: ['orders']
});
```

**Equivalente en Dynamite:**

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

// Consulta
const users = await User.where({});
const filtered = users.filter(u => u.name.includes("John"));

// Cargar relaciones
const users_with_orders = await User.where({}, {
  include: { orders: true }
});
```

**Pasos de Migración:**

```typescript
// 1. Crear función de mapeo
function MapTypeORMToDynamite(typeorm_user: any): any {
  return {
    id: `user-${typeorm_user.id}`,
    email: typeorm_user.email,
    name: typeorm_user.name,
    created_at: typeorm_user.created_at.toISOString(),
    updated_at: typeorm_user.updated_at.toISOString()
  };
}

// 2. Migrar con streaming
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
    console.log(`Migrada página ${page}`);
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

// Consulta
const users = await User.find({
  tags: { $in: ['premium', 'verified'] }
}).sort({ created_at: -1 });
```

**Equivalente en Dynamite:**

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

// Consulta - obtener y filtrar para consultas de tags
const all_users = await User.where({}, { order: "DESC" });
const premium_users = all_users.filter(u =>
  u.tags?.some(tag => ["premium", "verified"].includes(tag))
);
```

**Script de Migración:**

```typescript
// Migrar de MongoDB a DynamoDB
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

## Guía de Actualización de Versión

### Actualizando a v1.0

**Cambios Clave:**

1. **Modelos basados en Clases**

```typescript
// Antes: Objetos planos
const user = { id: "123", name: "John" };

// Después: Clase extendiendo Table
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
}

const user = await User.create({ name: "John" });
```

2. **Configuración basada en Decoradores**

```typescript
// Toda la configuración via decoradores
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Email inválido")
  declare email: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}
```

3. **Inicialización del Cliente**

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

client.connect();
await client.sync();
```

## Migración de Esquema

### Agregar Nuevos Atributos

Agregar atributos a items existentes requiere planificación cuidadosa.

```typescript
// Esquema antiguo
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
}

// Esquema nuevo
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  declare email?: string; // Nuevo atributo opcional

  @Default(() => new Date().toISOString())
  declare created_at: CreationOptional<string>; // Nuevo con default
}

// Script de migración
async function AddAttributes(): Promise<void> {
  const users = await User.where({});

  for (const user of users) {
    if (!user.created_at) {
      user.created_at = new Date().toISOString();
      await user.save();
    }
  }

  console.log(`Migrados ${users.length} usuarios`);
}
```

### Renombrar Atributos

DynamoDB no soporta renombrar atributos. Crea un nuevo atributo y copia los datos.

```typescript
// Migración: name → full_name
async function RenameAttribute(): Promise<void> {
  const users = await User.where({});

  for (const user of users) {
    // Copiar al nuevo atributo
    (user as any).full_name = user.name;
    await user.save();
  }

  console.log(`Procesados ${users.length} usuarios`);
}

// Actualizar definición de entidad después de la migración
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare full_name: string; // Renombrado desde 'name'
}
```

## Migración de Datos

### Transformar Datos Durante la Migración

Aplica transformaciones mientras migras.

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
      console.log(`Migrados ${migrated} items`);
    }
  }

  console.log(`Migración completa: ${migrated} items`);
}

// Uso
await MigrateWithTransform(
  old_users,
  User,
  (old_user) => ({
    id: old_user.id,
    email: old_user.email.toLowerCase(), // Transformar: normalizar email
    name: old_user.first_name + ' ' + old_user.last_name, // Transformar: combinar nombres
    created_at: new Date(old_user.created_at).toISOString() // Transformar: fecha a ISO
  })
);
```

## Pruebas de Migraciones

### Framework de Pruebas

Crea un framework de pruebas para migraciones.

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
    await this.client.sync();
    await this.SeedData();
  }

  private async SeedData(): Promise<void> {
    for (let i = 0; i < 100; i++) {
      await User.create({
        name: `Usuario ${i}`,
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
      console.error('Migración fallida:', error);
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

// Uso
const tester = new MigrationTester();

await tester.Setup();

const result = await tester.RunMigration(async () => {
  await AddEmailAttribute();
});

const verified = await tester.Verify(async () => {
  const users = await User.where({});
  return users.every(u => u.email !== undefined);
});

console.log('Migración:', result.success ? 'PASS' : 'FAIL');
console.log('Verificación:', verified ? 'PASS' : 'FAIL');

await tester.Teardown();
```

## Despliegue en Producción

### Lista de Verificación Pre-Despliegue

```markdown
- [ ] Probar migración con datos similares a producción
- [ ] Preparar plan de rollback
- [ ] Configurar alertas de monitoreo
- [ ] Programar durante ventana de bajo tráfico
- [ ] Comunicar con el equipo
- [ ] Respaldar datos críticos
- [ ] Probar en ambiente de staging
```

### Estrategia de Rollback

Siempre ten un plan de rollback.

```typescript
class MigrationRollback {
  private backup_data: any[] = [];

  async CreateBackup(): Promise<void> {
    console.log('Creando respaldo...');
    this.backup_data = await User.where({});
    console.log(`Respaldo completo: ${this.backup_data.length} items`);
  }

  async Rollback(): Promise<void> {
    console.log('Revirtiendo...');

    for (const item of this.backup_data) {
      await User.create(item);
    }

    console.log('Rollback completo');
  }
}

// Uso
const rollback = new MigrationRollback();

await rollback.CreateBackup();

try {
  await RunMigration();
} catch (error) {
  console.error('Migración fallida, revirtiendo...');
  await rollback.Rollback();
}
```

---

Para más información:
- [Guía de Decoradores](./decorators.md)
- [Referencia de API](./table.md)
- [Documentación de AWS DynamoDB](https://docs.aws.amazon.com/dynamodb/)
