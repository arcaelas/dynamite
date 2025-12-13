# Willkommen bei Arcaelas Dynamite

Modernes Decorator-basiertes ORM für AWS DynamoDB mit TypeScript-Unterstützung.

## Was ist Dynamite?

Arcaelas Dynamite ist eine leistungsstarke, Decorator-basierte Object-Relational Mapping (ORM) Bibliothek für AWS DynamoDB. Sie bietet eine saubere, intuitive API, die TypeScript-Decorators nutzt, um Ihre Datenmodelle mit Typsicherheit und minimalem Boilerplate zu definieren.

## Hauptmerkmale

### Decorator-First Design
Definieren Sie Ihre Modelle mit vertrauten TypeScript-Decorators:

```typescript
import { Table, PrimaryKey, CreatedAt, UpdatedAt } from '@arcaelas/dynamite';

class User extends Table {
  @PrimaryKey()
  id: string;

  @Default(() => 'active')
  status: string;

  @CreatedAt()
  created_at: Date;

  @UpdatedAt()
  updated_at: Date;
}
```

### Typsichere Beziehungen
Integrierte Unterstützung für Eins-zu-Viele und Viele-zu-Eins Beziehungen:

```typescript
import { HasMany, BelongsTo } from '@arcaelas/dynamite';

class User extends Table {
  @HasMany(() => Post, 'user_id')
  posts: HasMany<Post>;
}

class Post extends Table {
  @BelongsTo(() => User, 'user_id')
  user: BelongsTo<User>;
}
```

### Einfache Query-API
Direkte async-Methoden mit vollständiger TypeScript-Unterstützung:

```typescript
// Einfache Gleichheit
const active_users = await User.where('status', 'active');

// Mit Operator
const recent = await User.where('created_at', '>', '2024-01-01');

// Mehrere Filter mit Optionen
const users = await User.where(
  { status: 'active' },
  { include: { posts: true }, limit: 10 }
);
```

### Validierung & Transformation
Integrierte Decorators für Datenvalidierung und Mutation:

```typescript
class User extends Table {
  @Validate(value => value.length >= 8, 'Passwort muss mindestens 8 Zeichen haben')
  password: string;

  @Mutate(value => value.toLowerCase().trim())
  email: string;
}
```

## Schnellstart

### Installation

```bash
npm install @arcaelas/dynamite
# oder
yarn add @arcaelas/dynamite
```

### Grundlegende Verwendung

```typescript
import { Dynamite, Table, PrimaryKey, Default } from '@arcaelas/dynamite';

// Definieren Sie Ihr Modell
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: string;

  declare name: string;
  declare email: string;
}

// Konfigurieren und verbinden
const dynamite = new Dynamite({
  region: 'us-east-1',
  tables: [User]
});
dynamite.connect();
await dynamite.sync();

// Neuen Benutzer erstellen
const user = await User.create({
  name: 'Max Mustermann',
  email: 'max@beispiel.de'
});

// Benutzer abfragen
const users = await User.where('name', 'Max Mustermann');

// Aktualisieren
user.email = 'neueemail@beispiel.de';
await user.save();

// Löschen
await user.destroy();
```

## Architekturübersicht

Dynamite basiert auf drei Kernkonzepten:

1. **Table** - Basisklasse für alle Modelle mit CRUD-Operationen
2. **Decorators** - Definieren Schema, Validierung und Verhalten
3. **Relationships** - Verbinden Modelle mit typsicheren Assoziationen

```
┌─────────────────────────────────────────┐
│             Ihre Modelle                 │
│  ┌─────────────────────────────────┐   │
│  │  User extends Table              │   │
│  │  - @PrimaryKey() id              │   │
│  │  - @HasMany() posts              │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          Dynamite ORM                    │
│  - Query Builder                         │
│  - Relationship Resolver                 │
│  - Decorator-Verarbeitung                │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         AWS SDK v3                       │
│  - DynamoDBClient                        │
│  - DynamoDB Document Client              │
└──────────────────────────────────────────┘
```

## Warum Dynamite?

- **Typsicherheit** - Vollständige TypeScript-Unterstützung mit erweiterten Typen
- **Entwicklererfahrung** - Saubere, intuitive API mit minimalem Boilerplate
- **Modern** - Basierend auf AWS SDK v3 mit ESM-Unterstützung
- **Flexibel** - Unterstützt komplexe Abfragen, Beziehungen und benutzerdefinierte Logik
- **Leichtgewichtig** - Minimale Abhängigkeiten, fokussiert auf DynamoDB

## Nächste Schritte

- **[Installationsanleitung](installation.md)** - Richten Sie Dynamite in Ihrem Projekt ein
- **[Erste Schritte](getting-started.md)** - Ihr erstes Dynamite-Modell
- **[Kernkonzepte](references/core-concepts.md)** - Die Grundlagen verstehen
- **[API-Referenz](references/table.md)** - Vollständige API-Dokumentation
- **[Beispiele](examples/basic.md)** - Praktische Beispiele
  - [Grundlegend](examples/basic.md) - CRUD-Operationen
  - [Beziehungen](examples/relations.md) - HasMany, BelongsTo, ManyToMany
  - [Fortgeschritten](examples/advanced.md) - Komplexe Abfragen und Muster
- **[Changelog](changelog.md)** - Versionshistorie

## Community

- **GitHub**: [github.com/arcaelas/dynamite](https://github.com/arcaelas/dynamite)
- **Issues**: [Fehler melden oder Funktionen anfordern](https://github.com/arcaelas/dynamite/issues)
- **NPM**: [@arcaelas/dynamite](https://www.npmjs.com/package/@arcaelas/dynamite)

---

**Bereit anzufangen?** [Installieren Sie Dynamite](installation.md) und erstellen Sie Ihr erstes Modell in Minuten.
