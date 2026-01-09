# @arcaelas/dynamite

![Banner](assets/cover.png)

> **Modernes Decorator-First ORM für AWS DynamoDB**
> TypeScript Decorators | Typsichere Beziehungen | Automatische Tabellensync | Minimaler Boilerplate

---

## Funktionen

- **Decorator-First Design** - Modelle mit TypeScript Decorators definieren
- **Typsichere Beziehungen** - HasMany, BelongsTo, ManyToMany mit vollständiger Typisierung
- **Automatische Tabellensync** - Tabellen und Indizes werden automatisch erstellt
- **Validierung & Transformation** - Integrierte Decorators für Datenverarbeitung
- **Soft Deletes** - @DeleteAt Decorator für wiederherstellbare Datensätze
- **Transaktionen** - Volle Transaktionsunterstützung mit Rollback

---

## Schnellstart

```typescript
import { Dynamite, Table, PrimaryKey, Default, CreatedAt } from '@arcaelas/dynamite';

// Definiere dein Modell
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: string;

  declare name: string;
  declare email: string;

  @CreatedAt()
  declare created_at: string;
}

// Konfigurieren und verbinden
const dynamite = new Dynamite({
  region: 'us-east-1',
  tables: [User]
});
await dynamite.connect();

// Erstellen
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Abfragen
const users = await User.where('name', 'John Doe');

// Aktualisieren
user.email = 'newemail@example.com';
await user.save();

// Löschen
await user.destroy();
```

---

## Decorators

| Decorator | Beschreibung |
|-----------|--------------|
| `@PrimaryKey()` | Partitionsschlüssel |
| `@Index()` | Globaler Sekundärindex |
| `@Default(value)` | Standardwert (statisch oder Funktion) |
| `@Validate(fn)` | Validierung beim Setzen |
| `@Mutate(fn)` | Transformation beim Setzen |
| `@CreatedAt()` | Auto-Setzen beim Erstellen |
| `@UpdatedAt()` | Auto-Setzen beim Aktualisieren |
| `@DeleteAt()` | Soft Delete Zeitstempel |
| `@HasMany()` | Eins-zu-Viele Beziehung |
| `@BelongsTo()` | Viele-zu-Eins Beziehung |
| `@ManyToMany()` | Viele-zu-Viele mit Pivot-Tabelle |

---

## Beziehungen

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Post, 'user_id')
  declare posts: NonAttribute<Post[]>;
}

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;

  @BelongsTo(() => User, 'user_id')
  declare user: NonAttribute<User | null>;
}

// Mit Beziehungen laden
const user = await User.first({ id: '123' }, { include: { posts: true } });
console.log(user.posts); // Post[]
```

---

## Nächste Schritte

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } **Installation**

    ---

    Dynamite in deinem Projekt einrichten

    [:octicons-arrow-right-24: Installieren](installation.md)

-   :material-rocket-launch:{ .lg .middle } **Erste Schritte**

    ---

    Erstelle dein erstes Modell Schritt für Schritt

    [:octicons-arrow-right-24: Starten](getting-started.md)

-   :material-api:{ .lg .middle } **API Referenz**

    ---

    Vollständige Dokumentation aller Klassen

    [:octicons-arrow-right-24: Referenz](references/table.md)

-   :material-code-tags:{ .lg .middle } **Beispiele**

    ---

    Praktische Beispiele zum Verwenden

    [:octicons-arrow-right-24: Beispiele](examples/basic.md)

</div>

---

**Entwickelt von [Arcaelas Insiders](https://github.com/arcaelas)**
