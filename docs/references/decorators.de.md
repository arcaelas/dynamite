# Vollständiger Leitfaden zu Decorators in Dynamite

Dieser Leitfaden bietet umfassende Dokumentation zu allen in Dynamite ORM verfügbaren Decorators, einschließlich praktischer Beispiele, gängiger Muster und Best Practices.

## Inhaltsverzeichnis

1. [Einfuhrung in Decorators](#einfuhrung-in-decorators)
2. [@PrimaryKey - Primarschlussel](#primarykey-primarschlussel)
3. [@Default - Standardwerte](#default-standardwerte)
4. [@Validate - Validierungsfunktionen](#validate-validierungsfunktionen)
5. [@Set - Transformation beim Schreiben](#set-transformation-beim-schreiben)
6. [@Get - Transformation beim Lesen](#get-transformation-beim-lesen)
7. [@NotNull - Erforderliche Felder](#notnull-erforderliche-felder)
8. [@CreatedAt - Erstellungs-Zeitstempel](#createdat-erstellungs-zeitstempel)
9. [@UpdatedAt - Aktualisierungs-Zeitstempel](#updatedat-aktualisierungs-zeitstempel)
10. [Lifecycle-Hook-Dekoratoren](#lifecycle-hook-dekoratoren)
11. [Best Practices](#best-practices)

---

## Einführung in Decorators

Decorators in Dynamite sind spezielle Funktionen, die Metadaten und Verhalten zu Klassen und Eigenschaften hinzufügen. Sie ermöglichen es, Datenbankschemas deklarativ und typsicher zu definieren.

### Grundkonzepte

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Primärschlüssel-Decorator
  @PrimaryKey()
  declare id: CreationOptional<string>;

  // Einfaches Feld ohne Decorators
  declare name: string;

  // Feld mit Standardwert
  @Default(() => "customer")
  declare role: CreationOptional<string>;
}
```

### Decorator-Typen

**Schlüssel-Decorators:**
- `@PrimaryKey()` - Definiert den Primärschlüssel
- `@Index()` - Definiert Partition Key (GSI)
- `@IndexSort()` - Definiert Sort Key (LSI)

**Daten-Decorators:**
- `@Default()` - Setzt Standardwerte
- `@Set()` - Transformiert Werte beim Schreiben
- `@Get()` - Transformiert Werte beim Lesen
- `@Validate()` - Validiert Werte vor dem Speichern
- `@NotNull()` - Markiert Felder als erforderlich

**Zeitstempel-Decorators:**
- `@CreatedAt()` - Auto-Zeitstempel bei Erstellung
- `@UpdatedAt()` - Auto-Zeitstempel bei Aktualisierung

**Beziehungs-Decorators:**
- `@HasMany()` - Eins-zu-Viele-Beziehung
- `@BelongsTo()` - Viele-zu-Eins-Beziehung

**Konfigurations-Decorators:**
- `@Name()` - Benutzerdefinierte Namen für Tabellen/Spalten

---

## @PrimaryKey - Primärschlüssel

Der `@PrimaryKey`-Decorator definiert den Primärschlüssel der Tabelle. Intern wendet er automatisch `@Index` und `@IndexSort` an. Er generiert und validiert außerdem automatisch eine ULID für das Feld; kombinieren Sie ihn daher nicht mit einem `@Default()`, das eine eigene ID erzeugt (z. B. ein UUID), da dies fehlschlägt.

### Syntax

```typescript
@PrimaryKey(name?: string): PropertyDecorator
```

### Einfacher Primärschlüssel

```typescript
import { Table, PrimaryKey, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;
}

// Verwendung
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
  // id ist optional (CreationOptional) und wird automatisch generiert
});

console.log(user.id); // "01ARZ3NDEKTSV4RRFFQ69G5FAV"
```

---

## @Default - Standardwerte

Der `@Default`-Decorator setzt statische oder dynamische Standardwerte für Eigenschaften.

### Syntax

```typescript
@Default(value: any | (() => any)): PropertyDecorator
```

### Statische Werte

```typescript
class Settings extends Table<Settings> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Default("dark")
  declare theme: CreationOptional<string>;

  @Default(true)
  declare notifications: CreationOptional<boolean>;

  @Default(100)
  declare volume: CreationOptional<number>;

  @Default([])
  declare tags: CreationOptional<string[]>;
}

// Verwendung
const settings = await Settings.create({}); // Alle Felder optional
console.log(settings.theme); // "dark"
console.log(settings.notifications); // true
console.log(settings.volume); // 100
console.log(settings.tags); // []
```

### Dynamische Werte (Funktionen)

```typescript
class Document extends Table<Document> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Default(() => new Date().toISOString())
  declare created: CreationOptional<string>;

  @Default(() => `DOC-${Date.now()}`)
  declare code: CreationOptional<string>;

  @Default(() => Math.floor(Math.random() * 1000000))
  declare reference_number: CreationOptional<number>;
}

// Jede Instanz erhält eindeutige Werte
const doc1 = await Document.create({});
const doc2 = await Document.create({});

console.log(doc1.id !== doc2.id); // true
console.log(doc1.code !== doc2.code); // true
```

---

## @Validate - Validierungsfunktionen

Der `@Validate`-Decorator ermöglicht die Definition benutzerdefinierter Validierungsfunktionen, die vor dem Speichern von Daten ausgeführt werden.

### Syntax

```typescript
@Validate(validator: (value: unknown) => true | string): PropertyDecorator
@Validate(validators: Array<(value: unknown) => true | string>): PropertyDecorator
```

### Einfache Validierung

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Validate((value) => {
    const email = value as string;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || "Ungültige E-Mail";
  })
  declare email: string;

  @Validate((value) => {
    const age = value as number;
    return age >= 18 || "Muss volljährig sein";
  })
  declare age: number;
}

// Gültig
const user1 = await User.create({
  id: "user-1",
  email: "john@example.com",
  age: 25
});

// Ungültig - wirft Fehler
try {
  await User.create({
    id: "user-2",
    email: "invalid-email",
    age: 25
  });
} catch (error) {
  console.error(error.message); // "Ungültige E-Mail"
}
```

### Mehrere Validatoren

```typescript
class Password extends Table<Password> {
  @PrimaryKey()
  declare user_id: string;

  @Validate([
    (v) => (v as string).length >= 8 || "Mindestens 8 Zeichen",
    (v) => /[A-Z]/.test(v as string) || "Muss Großbuchstaben enthalten",
    (v) => /[a-z]/.test(v as string) || "Muss Kleinbuchstaben enthalten",
    (v) => /[0-9]/.test(v as string) || "Muss Zahl enthalten",
    (v) => /[^A-Za-z0-9]/.test(v as string) || "Muss Symbol enthalten"
  ])
  declare password: string;
}
```

---

## @Set - Transformation beim Schreiben

Der `@Set`-Decorator transformiert Werte, bevor sie in die Datenbank geschrieben werden.

### Syntax

```typescript
@Set(transformer: (next: any, current: any) => any): PropertyDecorator
```

Die Transformerfunktion erhält den neuen Wert (`next`) und den aktuellen Wert (`current`) der Eigenschaft.

### Grundlegende Transformationen

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Set((v) => (v as string).toLowerCase().trim())
  declare email: string;

  @Set((v) => (v as string).trim())
  @Set((v) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase())
  declare name: string;

  @Set((v) => (v as string).replace(/\D/g, ""))
  declare phone: string;
}

// Verwendung
const user = await User.create({
  id: "user-1",
  email: "  JOHN@EXAMPLE.COM  ",
  name: "  jOhN dOe  ",
  phone: "+1 (555) 123-4567"
});

console.log(user.email); // "john@example.com"
console.log(user.name); // "John doe"
console.log(user.phone); // "15551234567"
```

---

## @Get - Transformation beim Lesen

Der `@Get`-Decorator transformiert Werte, wenn sie aus der Datenbank gelesen werden. Er ist das Gegenstück zu `@Set` und eignet sich, um gespeicherte Rohwerte beim Zugriff in ein bequemeres Format zu überführen.

### Syntax

```typescript
@Get(transformer: (value: any) => any): PropertyDecorator
```

### Grundlegende Transformationen

```typescript
class Event extends Table<Event> {
  @PrimaryKey()
  declare id: string;

  // Beim Schreiben als ISO-String speichern, beim Lesen als Date zurückgeben
  @Set((v) => (v as Date).toISOString())
  @Get((v) => new Date(v as string))
  declare starts_at: Date;

  // Komma-getrennte Tags speichern, beim Lesen als Array zurückgeben
  @Set((v) => (v as string[]).join(","))
  @Get((v) => (v as string).split(","))
  declare tags: string[];
}

// Verwendung
const event = await Event.create({
  id: "event-1",
  starts_at: new Date("2025-01-15T10:30:00.000Z"),
  tags: ["typescript", "dynamodb"]
});

console.log(event.starts_at instanceof Date); // true
console.log(event.tags); // ["typescript", "dynamodb"]
```

> **Hinweis:** Ältere Schreib- und Serialisierungs-Decorators wurden durch `@Get` (Lesen) und `@Set` (Schreiben) ersetzt. Migrationsdetails finden Sie im [Migrationsleitfaden](./migration.de.md).

---

## @NotNull - Erforderliche Felder

Der `@NotNull`-Decorator markiert Felder als erforderlich und validiert, dass sie nicht null, undefined oder leere Strings sind.

### Syntax

```typescript
@NotNull(): PropertyDecorator
```

### Pflichtfelder

```typescript
class Customer extends Table<Customer> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare phone: string;

  declare address: string; // Optional
}

// Gültig
const customer1 = await Customer.create({
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234"
});

// Ungültig - wirft Fehler
try {
  await Customer.create({
    name: "",
    email: "john@example.com",
    phone: "555-1234"
  });
} catch (error) {
  console.error("Validierung fehlgeschlagen"); // name ist leer
}
```

---

## @CreatedAt - Erstellungs-Zeitstempel

Der `@CreatedAt`-Decorator setzt automatisch Datum und Uhrzeit der Erstellung im ISO 8601-Format.

### Syntax

```typescript
@CreatedAt(): PropertyDecorator
```

### Grundlegende Verwendung

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// Datum wird automatisch gesetzt
const post = await Post.create({
  title: "Mein erster Beitrag",
  content: "Beitragsinhalt"
});

console.log(post.created_at); // "2025-01-15T10:30:00.123Z"
```

---

## @UpdatedAt - Aktualisierungs-Zeitstempel

Der `@UpdatedAt`-Decorator aktualisiert automatisch Datum und Uhrzeit bei jedem Speichern des Datensatzes.

### Syntax

```typescript
@UpdatedAt(): PropertyDecorator
```

### Grundlegende Verwendung

```typescript
class Document extends Table<Document> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare title: string;
  declare content: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Erstellung
const doc = await Document.create({
  title: "Dokument",
  content: "Anfangsinhalt"
});

console.log(doc.created_at); // "2025-01-15T10:00:00Z"
console.log(doc.updated_at); // "2025-01-15T10:00:00Z"

// Aktualisierung
doc.content = "Aktualisierter Inhalt";
await doc.save();

console.log(doc.created_at); // "2025-01-15T10:00:00Z" (keine Änderung)
console.log(doc.updated_at); // "2025-01-15T10:15:00Z" (aktualisiert)
```

---

## Lifecycle-Hook-Dekoratoren

Lifecycle-Hooks sind Methoden-Dekoratoren, die automatisch rund um die Persistenz-Operationen ausgeführt werden. Sie sind pro Operation opt-in und werden nur aktiviert, wenn die Operation mit `{ hook: true }` aufgerufen wird. Innerhalb eines Hooks verweist `this` auf die Entität, sodass deren Felder gelesen und mutiert werden können.

### Verfügbare Hooks

| Dekorator | Zeitpunkt | Argument |
|-----------|-----------|----------|
| `@BeforeCreate()` | vor dem Einfügen, kann `this` mutieren | kein Argument |
| `@AfterCreate()` | nach dem Einfügen (`this` bereits persistiert) | kein Argument |
| `@BeforeUpdate()` | vor dem Update | `changes` (Delta) |
| `@AfterUpdate()` | nach dem Update | `changes` (Delta) |
| `@BeforeDestroy()` | vor dem Löschen | kein Argument |
| `@AfterDestroy()` | nach dem Löschen | kein Argument |

### Grundlegende Verwendung

```typescript
import {
  Table,
  PrimaryKey,
  CreationOptional,
  BeforeCreate,
  AfterCreate,
  BeforeUpdate
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare email: string;
  declare name: string;
  declare slug: string;

  @BeforeCreate()
  normalize() {
    // `this` ist die Entität und kann mutiert werden
    this.email = this.email.toLowerCase().trim();
    this.slug = this.name.toLowerCase().replace(/\s+/g, "-");
  }

  @AfterCreate()
  async notify() {
    // async-Hooks werden awaited
    await sendWelcomeEmail(this.email);
  }

  @BeforeUpdate()
  audit(changes: Partial<User>) {
    // `changes` enthält das Delta der zu aktualisierenden Felder
    console.log("Geänderte Felder:", Object.keys(changes));
  }
}
```

### Verhalten

- Mehrere Hooks desselben Typs laufen in Deklarationsreihenfolge; async-Hooks werden awaited.
- Aktivierung pro Operation: `User.create(data, { hook: true })`, `user.update(data, { hook: true })`, `user.destroy({ hook: true })`.
- Bei Massen-`update`/`delete` laufen die Hooks einmal pro betroffener Entität.
- Innerhalb einer Transaktion (`{ hook: true, tx }`) laufen `before*` beim Einreihen und `after*` nach dem Commit.
- `increment()`/`decrement()` akzeptieren `{ tx }`, lösen aber keine Hooks aus.

---

## Best Practices

### 1. CreationOptional richtig verwenden

```typescript
class User extends Table<User> {
  // Immer CreationOptional mit @Default
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Immer CreationOptional mit @CreatedAt/@UpdatedAt
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Erforderliche Felder ohne CreationOptional
  @NotNull()
  declare email: string;
}
```

### 2. Reihenfolge der Decorators

```typescript
class User extends Table<User> {
  // Empfohlene Reihenfolge: Schlüssel → Validierung → Transformation → Defaults → Zeitstempel
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @NotNull()
  @Validate((v) => /^[^\s@]+@/.test(v as string) || "Ungültig")
  @Set((v) => (v as string).toLowerCase())
  @Name("email_address")
  declare email: string;
}
```

### 3. Beschreibende Validierungen

```typescript
// Schlecht
@Validate((v) => (v as number) > 0)
declare price: number;

// Gut
@Validate((v) => (v as number) > 0 || "Preis muss größer als 0 sein")
declare price: number;
```

---

Dieser Leitfaden deckt alle in Dynamite verfügbaren Decorators mit praktischen Beispielen und empfohlenen Mustern ab, um robuste und typsichere Modelle zu erstellen.
