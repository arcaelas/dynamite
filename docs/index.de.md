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

### Leistungsstarker Query Builder
Intuitive Query-Schnittstelle mit vollständiger TypeScript-Unterstützung:

```typescript
const active_users = await User.where('status', '=', 'active')
  .where('created_at', '>', new Date('2024-01-01'))
  .include('posts')
  .get();
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
import { Dynamite, Table, PrimaryKey } from '@arcaelas/dynamite';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// DynamoDB-Client konfigurieren
const client = new DynamoDBClient({ region: 'us-east-1' });
Dynamite.configure({ client });

// Definieren Sie Ihr Modell
class User extends Table {
  @PrimaryKey()
  id: string;

  name: string;
  email: string;
}

// Neuen Benutzer erstellen
const user = await User.create({
  id: '123',
  name: 'Max Mustermann',
  email: 'max@beispiel.de'
});

// Benutzer abfragen
const users = await User.where('name', '=', 'Max Mustermann').get();

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
- **[Erste Schritte](guides/getting-started.md)** - Ihr erstes Dynamite-Modell
- **[Kernkonzepte](guides/core-concepts.md)** - Die Grundlagen verstehen
- **[API-Referenz](api/table.md)** - Vollständige API-Dokumentation

## Community

- **GitHub**: [github.com/arcaelas/dynamite](https://github.com/arcaelas/dynamite)
- **Issues**: [Fehler melden oder Funktionen anfordern](https://github.com/arcaelas/dynamite/issues)
- **NPM**: [@arcaelas/dynamite](https://www.npmjs.com/package/@arcaelas/dynamite)

---

**Bereit anzufangen?** [Installieren Sie Dynamite](installation.md) und erstellen Sie Ihr erstes Modell in Minuten.
