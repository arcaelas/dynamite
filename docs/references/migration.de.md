# Migrationsanleitung

Diese Anleitung hilft Ihnen bei der Migration zu Dynamite von anderen ORMs oder beim Upgrade zwischen Versionen.

## Inhaltsverzeichnis

- [Migration von anderen ORMs](#migration-von-anderen-orms)
- [Versions-Upgrade-Anleitung](#versions-upgrade-anleitung)
- [Schema-Migration](#schema-migration)
- [Daten-Migration](#daten-migration)
- [Migrationen testen](#migrationen-testen)
- [Produktions-Deployment](#produktions-deployment)

## Migration von anderen ORMs

### Von Sequelize (SQL)

Sequelize ist für relationale Datenbanken konzipiert. Hier erfahren Sie, wie Sie sich an das NoSQL-Paradigma von DynamoDB anpassen können.

**Sequelize-Modell:**

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

// Abfrage
const users = await User.findAll({
  where: {
    email: { [Op.like]: '%@example.com' }
  },
  include: [Order]
});
```

**Dynamite-Äquivalent:**

```typescript
// Dynamite (DynamoDB)
import {
  Table, PrimaryKey, Default, NotNull, CreatedAt,
  HasMany, BelongsTo, CreationOptional, NonAttribute
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>; // UUID statt Auto-Increment verwenden

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

// Abfrage - anderer Ansatz für NoSQL
const users = await User.where({ email: "user@example.com" }, {
  include: { orders: true }
});

// Für Pattern-Matching: abrufen und filtern
const all_users = await User.where({});
const filtered = all_users.filter(u => u.email.endsWith("@example.com"));
```

**Wichtige Unterschiede:**

| Konzept | Sequelize (SQL) | Dynamite (DynamoDB) |
|---------|----------------|---------------------|
| Primärschlüssel | Auto-Increment Integer | UUID oder zusammengesetzter Schlüssel |
| Abfragen | Komplexe WHERE-Klauseln | Schlüsselbedingungen + Filter |
| Joins | Native JOIN-Unterstützung | Manuelle Beziehungsladung |
| Transaktionen | ACID-Transaktionen | Begrenzte Transaktionen (25 Items) |
| Schema | Starres Schema | Flexibles Schema |

**Migrationsstrategie:**

```typescript
// 1. Daten aus SQL exportieren
import { Sequelize } from 'sequelize';

async function ExportFromSQL(): Promise<void> {
  const sequelize = new Sequelize('postgresql://...');
  const users = await sequelize.models.User.findAll();

  const export_data = users.map(user => ({
    id: `user-${user.id}`, // ID-Format transformieren
    email: user.email,
    name: user.name,
    created_at: user.created_at.toISOString()
  }));

  // In Datei speichern
  await fs.writeFile(
    'users_export.json',
    JSON.stringify(export_data, null, 2)
  );
}

// 2. In DynamoDB importieren
async function ImportToDynamoDB(): Promise<void> {
  const data = JSON.parse(
    await fs.readFile('users_export.json', 'utf-8')
  );

  // In Batches importieren
  for (const item of data) {
    await User.create(item);
  }

  console.log(`${data.length} Benutzer importiert`);
}
```

### Von TypeORM

TypeORM unterstützt mehrere Datenbanken einschließlich DynamoDB (grundlegende Unterstützung).

**TypeORM-Entity:**

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

// Abfrage
const users = await userRepository.find({
  where: { name: Like('%John%') },
  relations: ['orders']
});
```

**Dynamite-Äquivalent:**

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

// Abfrage
const users = await User.where({});
const filtered = users.filter(u => u.name.includes("John"));

// Beziehungen laden
const users_with_orders = await User.where({}, {
  include: { orders: true }
});
```

**Migrationsschritte:**

```typescript
// 1. Mapping-Funktion erstellen
function MapTypeORMToDynamite(typeorm_user: any): any {
  return {
    id: `user-${typeorm_user.id}`,
    email: typeorm_user.email,
    name: typeorm_user.name,
    created_at: typeorm_user.created_at.toISOString(),
    updated_at: typeorm_user.updated_at.toISOString()
  };
}

// 2. Mit Streaming migrieren
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
    console.log(`Seite ${page} migriert`);
  }
}
```

### Von Mongoose (MongoDB)

MongoDB und DynamoDB sind beide NoSQL, haben aber unterschiedliche Abfragemuster.

**Mongoose-Schema:**

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

// Abfrage
const users = await User.find({
  tags: { $in: ['premium', 'verified'] }
}).sort({ created_at: -1 });
```

**Dynamite-Äquivalent:**

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

// Abfrage - Abrufen und Filtern für Tag-Abfragen
const all_users = await User.where({}, { order: "DESC" });
const premium_users = all_users.filter(u =>
  u.tags?.some(tag => ["premium", "verified"].includes(tag))
);
```

**Migrationsskript:**

```typescript
// Von MongoDB zu DynamoDB migrieren
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

## Versions-Upgrade-Anleitung

### Upgrade auf v1.0

**Wichtige Änderungen:**

1. **Klassenbasierte Modelle**

```typescript
// Vorher: Einfache Objekte
const user = { id: "123", name: "John" };

// Nachher: Klasse erweitert Table
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
}

const user = await User.create({ name: "John" });
```

2. **Decorator-basierte Konfiguration**

```typescript
// Alle Konfiguration über Decorators
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v as string) || "Ungültige E-Mail")
  declare email: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}
```

3. **Client-Initialisierung**

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

## Schema-Migration

### Neue Attribute hinzufügen

Das Hinzufügen von Attributen zu bestehenden Items erfordert sorgfältige Planung.

```typescript
// Altes Schema
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
}

// Neues Schema
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  declare email?: string; // Neues optionales Attribut

  @Default(() => new Date().toISOString())
  declare created_at: CreationOptional<string>; // Neu mit Default
}

// Migrationsskript
async function AddAttributes(): Promise<void> {
  const users = await User.where({});

  for (const user of users) {
    if (!user.created_at) {
      user.created_at = new Date().toISOString();
      await user.save();
    }
  }

  console.log(`${users.length} Benutzer migriert`);
}
```

### Attribute umbenennen

DynamoDB unterstützt das Umbenennen von Attributen nicht. Erstellen Sie ein neues Attribut und kopieren Sie die Daten.

```typescript
// Migration: name → full_name
async function RenameAttribute(): Promise<void> {
  const users = await User.where({});

  for (const user of users) {
    // In neues Attribut kopieren
    (user as any).full_name = user.name;
    await user.save();
  }

  console.log(`${users.length} Benutzer verarbeitet`);
}

// Entity-Definition nach der Migration aktualisieren
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare full_name: string; // Umbenannt von 'name'
}
```

## Daten-Migration

### Daten während der Migration transformieren

Wenden Sie Transformationen während der Migration an.

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
      console.log(`${migrated} Items migriert`);
    }
  }

  console.log(`Migration abgeschlossen: ${migrated} Items`);
}

// Verwendung
await MigrateWithTransform(
  old_users,
  User,
  (old_user) => ({
    id: old_user.id,
    email: old_user.email.toLowerCase(), // Transformieren: E-Mail normalisieren
    name: old_user.first_name + ' ' + old_user.last_name, // Transformieren: Namen kombinieren
    created_at: new Date(old_user.created_at).toISOString() // Transformieren: Datum zu ISO
  })
);
```

## Migrationen testen

### Test-Framework

Erstellen Sie ein Test-Framework für Migrationen.

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
        name: `Benutzer ${i}`,
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
      console.error('Migration fehlgeschlagen:', error);
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

// Verwendung
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
console.log('Verifizierung:', verified ? 'PASS' : 'FAIL');

await tester.Teardown();
```

## Produktions-Deployment

### Pre-Deployment-Checkliste

```markdown
- [ ] Migration mit produktionsähnlichen Daten testen
- [ ] Rollback-Plan vorbereiten
- [ ] Überwachungsalarme einrichten
- [ ] Während Niedrigverkehrs-Zeitfenster planen
- [ ] Mit dem Team kommunizieren
- [ ] Kritische Daten sichern
- [ ] In Staging-Umgebung testen
```

### Rollback-Strategie

Haben Sie immer einen Rollback-Plan.

```typescript
class MigrationRollback {
  private backup_data: any[] = [];

  async CreateBackup(): Promise<void> {
    console.log('Backup wird erstellt...');
    this.backup_data = await User.where({});
    console.log(`Backup abgeschlossen: ${this.backup_data.length} Items`);
  }

  async Rollback(): Promise<void> {
    console.log('Rollback wird durchgeführt...');

    for (const item of this.backup_data) {
      await User.create(item);
    }

    console.log('Rollback abgeschlossen');
  }
}

// Verwendung
const rollback = new MigrationRollback();

await rollback.CreateBackup();

try {
  await RunMigration();
} catch (error) {
  console.error('Migration fehlgeschlagen, Rollback wird durchgeführt...');
  await rollback.Rollback();
}
```

---

Weitere Informationen:
- [Decorator-Leitfaden](./decorators.md)
- [API-Referenz](./table.md)
- [AWS DynamoDB-Dokumentation](https://docs.aws.amazon.com/dynamodb/)
