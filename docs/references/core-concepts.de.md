# Kernkonzepte

Dieser Leitfaden erklärt die grundlegenden Konzepte von Dynamite ORM und wie sie zusammenarbeiten, um eine leistungsstarke, typsichere Schnittstelle für DynamoDB bereitzustellen.

## Inhaltsverzeichnis

1. [Table-Klasse](#table-klasse)
2. [Decorators-Ubersicht](#decorators-ubersicht)
3. [Primarschlussel](#primarschlussel)
4. [Indizes](#indizes)
5. [Query Builder](#query-builder)
6. [Query-Operatoren](#query-operatoren)
7. [Typsystem](#typsystem)
8. [Datenfluss](#datenfluss)

---

## Table-Klasse

Die `Table`-Klasse ist die Basisklasse für alle Ihre DynamoDB-Modelle. Sie bietet sowohl statische Methoden für Datenbankoperationen als auch Instanzmethoden für die Arbeit mit einzelnen Datensätzen.

### Statische vs. Instanzmethoden

**Statische Methoden** arbeiten direkt mit der Datenbank:

```typescript
// Statische Methoden - arbeiten mit der Datenbank
const user = await User.create({ name: "John" });
const users = await User.where({ active: true });
const count = await User.update({ status: "active" }, { role: "admin" });
await User.delete({ id: "user-123" });
```

**Instanzmethoden** arbeiten mit einzelnen Modellinstanzen:

```typescript
// Instanzmethoden - arbeiten mit der Modellinstanz
const user = new User({ name: "John" });
await user.save();           // In Datenbank speichern

user.name = "Jane";
await user.update({ name: "Jane" }); // Felder aktualisieren

await user.destroy();        // Aus Datenbank löschen
```

### Grundlegende Verwendung

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => true)
  declare active: CreationOptional<boolean>;
}

// Erstellen
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
  // id und active sind optional (CreationOptional)
});

// Lesen
const allUsers = await User.where({});
const activeUsers = await User.where({ active: true });

// Aktualisieren
user.name = "Jane Doe";
await user.save();

// Löschen
await user.destroy();
```

---

## Decorators-Übersicht

Decorators sind spezielle Funktionen, die Klasseneigenschaften mit Metadaten annotieren. Dynamite verwendet Decorators, um Tabellenstruktur, Validierungsregeln und Beziehungen zu definieren.

### Kern-Decorators

| Decorator | Zweck | Beispiel |
|-----------|-------|----------|
| `@PrimaryKey()` | Definiert den Partition Key | `@PrimaryKey() declare id: string;` |
| `@Index()` | Alias für PrimaryKey | `@Index() declare userId: string;` |
| `@IndexSort()` | Definiert den Sort Key | `@IndexSort() declare timestamp: string;` |
| `@Name("custom")` | Benutzerdefinierter Spalten-/Tabellenname | `@Name("user_email") declare email: string;` |

### Daten-Decorators

| Decorator | Zweck | Beispiel |
|-----------|-------|----------|
| `@Default(value)` | Standardwert | `@Default(() => Date.now()) declare createdAt: number;` |
| `@Mutate(fn)` | Vor Speichern transformieren | `@Mutate(v => v.toLowerCase()) declare email: string;` |
| `@Validate(fn)` | Vor Speichern validieren | `@Validate(v => v.length > 0) declare name: string;` |
| `@NotNull()` | Nicht-Null-Wert erfordern | `@NotNull() declare email: string;` |

### Zeitstempel-Decorators

| Decorator | Zweck | Beispiel |
|-----------|-------|----------|
| `@CreatedAt()` | Auto-Setzen bei Erstellung | `@CreatedAt() declare createdAt: string;` |
| `@UpdatedAt()` | Auto-Setzen bei Aktualisierung | `@UpdatedAt() declare updatedAt: string;` |

### Beziehungs-Decorators

| Decorator | Zweck | Beispiel |
|-----------|-------|----------|
| `@HasMany(Model, fk)` | Eins-zu-Viele | `@HasMany(() => Order, "userId") declare orders: any;` |
| `@BelongsTo(Model, lk)` | Viele-zu-Eins | `@BelongsTo(() => User, "userId") declare user: any;` |

### Vollständiges Beispiel

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  Mutate,
  Validate,
  NotNull,
  CreatedAt,
  UpdatedAt,
  HasMany,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Mutate(v => v.trim())
  @Mutate(v => v.toLowerCase())
  @Validate(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Ungültige E-Mail")
  declare email: string;

  @Validate(v => v.length >= 2 || "Name zu kurz")
  @Validate(v => v.length <= 50 || "Name zu lang")
  declare name: string;

  @Default(() => 18)
  @Validate(v => v >= 0 || "Alter muss positiv sein")
  declare age: CreationOptional<number>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  @HasMany(() => Order, "userId")
  declare orders: NonAttribute<Order[]>;
}
```

---

## Primärschlüssel

Primärschlüssel in DynamoDB bestehen aus einem **Partition Key** (erforderlich) und optional einem **Sort Key**. Dynamite verwendet den `@PrimaryKey`-Decorator, um den Partition Key zu definieren.

### Einfacher Primärschlüssel

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
}

// Nach Primärschlüssel abfragen
const user = await User.first({ id: "user-123" });
```

### Zusammengesetzter Primärschlüssel (Partition + Sort Key)

```typescript
class Order extends Table<Order> {
  @PrimaryKey()        // Partition Key
  declare userId: string;

  @IndexSort()         // Sort Key
  declare timestamp: string;

  declare total: number;
  declare status: string;
}

// Nach Partition Key abfragen
const userOrders = await Order.where({ userId: "user-123" });

// Nach Partition + Sort Key abfragen
const recentOrders = await Order.where({
  userId: "user-123",
  timestamp: "2023-12-01"
});
```

### Automatisch generierte Primärschlüssel

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare price: number;
}

// id wird automatisch generiert
const product = await Product.create({
  name: "Widget",
  price: 9.99
});

console.log(product.id); // "550e8400-e29b-41d4-a716-446655440000"
```

---

## Indizes

DynamoDB unterstützt Global Secondary Indexes (GSI) und Local Secondary Indexes (LSI) für effiziente Abfragen. Dynamite bietet die Decorators `@Index` und `@IndexSort`.

### Global Secondary Index (GSI)

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Index()             // GSI Partition Key
  declare email: string;

  declare name: string;
  declare role: string;
}

// Nach E-Mail abfragen (GSI)
const user = await User.first({ email: "john@example.com" });
```

### Local Secondary Index (LSI)

```typescript
class Message extends Table<Message> {
  @PrimaryKey()        // Partition Key
  declare chatId: string;

  @IndexSort()         // Sort Key (LSI)
  declare timestamp: string;

  declare userId: string;
  declare content: string;
}

// Chat-Nachrichten nach Zeitstempel sortiert abfragen
const messages = await Message.where(
  { chatId: "chat-123" },
  { order: "DESC", limit: 50 }
);
```

---

## Query Builder

Der Query Builder bietet eine fließende Schnittstelle zum Erstellen von Datenbankabfragen. Die Hauptmethode ist `where()`, die mehrere Überladungen für verschiedene Anwendungsfälle hat.

### Grundlegende Abfragen

```typescript
// Alle Datensätze abrufen
const allUsers = await User.where({});

// Nach Feld filtern (Gleichheit)
const activeUsers = await User.where({ active: true });

// Mehrere Filter (AND-Bedingung)
const premiumUsers = await User.where({
  active: true,
  role: "premium"
});
```

### Feld-Wert-Abfragen

```typescript
// Einzelfeld-Abfrage
const adults = await User.where("age", 18);

// Array von Werten (IN-Operator)
const specificAges = await User.where("age", [25, 30, 35]);
```

### Abfrageoptionen

```typescript
// Paginierung
const users = await User.where({}, {
  limit: 10,
  skip: 20
});

// Sortierung
const users = await User.where({}, {
  order: "DESC"
});

// Spezifische Felder auswählen
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Kombinierte Optionen
const users = await User.where(
  { active: true },
  {
    attributes: ["id", "name"],
    limit: 50,
    order: "ASC"
  }
);
```

---

## Query-Operatoren

Query-Operatoren ermöglichen erweiterte Filterung über einfache Gleichheitsprüfungen hinaus.

### Vergleichsoperatoren

```typescript
// Gleich (Standard)
const users = await User.where("age", "=", 25);
const users = await User.where("age", 25); // Gleich wie oben

// Nicht gleich
const nonAdmins = await User.where("role", "!=", "admin");

// Kleiner als
const minors = await User.where("age", "<", 18);

// Kleiner oder gleich
const seniors = await User.where("age", "<=", 65);

// Größer als
const highScores = await User.where("score", ">", 100);

// Größer oder gleich
const adults = await User.where("age", ">=", 18);
```

### Array-Operatoren

```typescript
// IN - Wert im Array
const specificRoles = await User.where("role", "in", ["admin", "premium", "vip"]);

// NOT IN - Wert nicht im Array
const regularUsers = await User.where("role", "not-in", ["admin", "moderator"]);
```

### String-Operatoren

```typescript
// CONTAINS - String enthält Teilstring
const gmailUsers = await User.where("email", "contains", "gmail");

// BEGINS WITH - String beginnt mit Präfix
const johnUsers = await User.where("name", "begins-with", "John");
```

---

## Typsystem

Das Typsystem von Dynamite gewährleistet Typsicherheit in Ihrer gesamten Anwendung. Es bietet spezielle Typen für optionale Felder, berechnete Eigenschaften und Beziehungen.

### CreationOptional

Markiert Felder als optional während der Erstellung, aber erforderlich in Instanzen. **Immer für automatisch generierte Felder verwenden**.

```typescript
import { Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Automatisch generierte ID - immer CreationOptional
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Erforderliche Felder
  declare name: string;
  declare email: string;

  // Standardwert - immer CreationOptional
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Automatisch gesetzte Zeitstempel - immer CreationOptional
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;
}

// TypeScript weiß, was erforderlich ist
const user = await User.create({
  name: "John",
  email: "john@test.com"
  // id, role, createdAt, updatedAt sind optional
});

// Aber alle Felder existieren nach der Erstellung
console.log(user.id);        // string (nicht undefined)
console.log(user.role);      // "customer"
console.log(user.createdAt); // "2023-12-01T10:30:00.000Z"
```

### NonAttribute

Schließt Felder von Datenbankoperationen aus. Verwendet für berechnete Eigenschaften und virtuelle Felder.

```typescript
import { Table, PrimaryKey, NonAttribute } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare firstName: string;
  declare lastName: string;
  declare birthDate: string;

  // Berechnete Eigenschaften (nicht in Datenbank gespeichert)
  declare fullName: NonAttribute<string>;
  declare age: NonAttribute<number>;

  constructor(data?: any) {
    super(data);

    // Berechnete Eigenschaften definieren
    Object.defineProperty(this, 'fullName', {
      get: () => `${this.firstName} ${this.lastName}`,
      enumerable: true
    });

    Object.defineProperty(this, 'age', {
      get: () => {
        const today = new Date();
        const birth = new Date(this.birthDate);
        return today.getFullYear() - birth.getFullYear();
      },
      enumerable: true
    });
  }
}

const user = await User.create({
  id: "user-1",
  firstName: "John",
  lastName: "Doe",
  birthDate: "1990-01-01"
});

console.log(user.fullName); // "John Doe" (berechnet, nicht gespeichert)
console.log(user.age);      // 34 (berechnet, nicht gespeichert)
```

---

## Datenfluss

Das Verständnis, wie Daten durch Dynamite fließen, hilft Ihnen, es effektiv zu nutzen.

**Schlüsselpunkte:**

1. **Decorator-Registrierung**: Erfolgt einmal zum Zeitpunkt der Klassendefinition
2. **Standardwerte**: Im Konstruktor vor Validierung angewendet
3. **Mutationen**: Vor Validierung angewendet, transformiert Daten
4. **Validierung**: Läuft nach Mutationen, kann Fehler werfen
5. **Zeitstempel**: Automatisch bei Erstellen/Aktualisieren-Operationen gesetzt
6. **Serialisierung**: Schließt NonAttribute-Felder vor Persistenz aus
7. **Beziehungen**: Lazy durch separate Abfragen geladen
8. **Typsicherheit**: Während des gesamten Flusses beibehalten

---

## Zusammenfassung

Dieser Leitfaden behandelte die Kernkonzepte von Dynamite:

- **Table-Klasse**: Basisklasse mit statischen und Instanzmethoden
- **Decorators**: Metadaten-Annotationen für Struktur und Verhalten
- **Primärschlüssel**: Partition und Sort Keys mit @PrimaryKey und @IndexSort
- **Indizes**: GSI und LSI für effiziente Abfragen
- **Query Builder**: Fließende Schnittstelle mit where(), first(), last()
- **Query-Operatoren**: =, !=, <, >, <=, >=, in, not-in, contains, begins-with
- **Typsystem**: CreationOptional, NonAttribute, InferAttributes für Typsicherheit
- **Datenfluss**: Wie Daten durch Decorators zur Datenbank fließen

Für fortgeschrittene Themen siehe:
- [Fortgeschrittene Abfragen](../examples/advanced.de.md)
- [API-Referenz](./table.md)
