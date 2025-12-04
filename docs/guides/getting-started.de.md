# Erste Schritte mit Dynamite

Willkommen bei Dynamite! Diese Anleitung führt Sie durch alles, was Sie wissen müssen, um mit diesem modernen, Decorator-basierten ORM für DynamoDB Anwendungen zu erstellen.

## Voraussetzungen

Bevor Sie beginnen, stellen Sie sicher, dass Sie haben:
- Node.js 16+ installiert
- Grundkenntnisse in TypeScript
- AWS-Konto (oder DynamoDB Local für die Entwicklung)

## Installation

```bash
npm install @arcaelas/dynamite

# Peer-Abhängigkeiten (falls noch nicht installiert)
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

## Konfiguration

Konfigurieren Sie zunächst Ihre DynamoDB-Verbindung:

```typescript
import { Dynamite } from "@arcaelas/dynamite";

// Für lokale Entwicklung
Dynamite.config({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Für AWS-Produktion
Dynamite.config({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});
```

## Schritt 1: Ihr erstes Modell

Lassen Sie uns ein einfaches Benutzermodell erstellen. In Dynamite sind Modelle Klassen, die `Table` erweitern und Decorators verwenden, um ihre Struktur zu definieren.

```typescript
import { Table, PrimaryKey, Default, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  // Primärschlüssel mit automatisch generierter UUID
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Erforderliches Feld während der Erstellung
  declare name: string;

  // Optionales Feld mit Standardwert
  @Default(() => "customer")
  declare role: CreationOptional<string>;
}
```

**Schlüsselkonzepte:**
- `@PrimaryKey()` markiert den Primärschlüssel (Partition Key in DynamoDB)
- `@Default()` bietet automatische Standardwerte
- `CreationOptional<T>` macht Felder während der Erstellung optional, aber in Instanzen erforderlich
- `declare` ist TypeScript-Syntax für Klasseneigenschaften

## Schritt 2: Datensätze erstellen

Es gibt mehrere Möglichkeiten, Datensätze in Dynamite zu erstellen:

### Mit der `create()`-Methode

```typescript
// Erstellen mit nur erforderlichen Feldern
const user1 = await User.create({
  name: "John Doe"
  // id und role sind optional (automatisch generiert/standardmäßig)
});

console.log(user1.id);   // "550e8400-e29b-41d4-a716-446655440000"
console.log(user1.name); // "John Doe"
console.log(user1.role); // "customer"

// Erstellen mit allen Feldern
const user2 = await User.create({
  id: "custom-id",
  name: "Jane Smith",
  role: "admin"
});
```

### Mehrere Datensätze erstellen

```typescript
const users = await Promise.all([
  User.create({ name: "Alice" }),
  User.create({ name: "Bob" }),
  User.create({ name: "Charlie" })
]);

console.log(`${users.length} Benutzer erstellt`);
```

## Schritt 3: Datensätze lesen

Dynamite bietet mehrere Methoden zum Abfragen Ihrer Daten:

### Alle Datensätze abrufen

```typescript
const all_users = await User.where({});
console.log(`Gesamtanzahl der Benutzer: ${all_users.length}`);
```

### Nach Feldern filtern

```typescript
// Nach exakter Übereinstimmung filtern
const admins = await User.where({ role: "admin" });

// Nach mehreren Bedingungen filtern
const admin_johns = await User.where({
  name: "John Doe",
  role: "admin"
});
```

### Ersten oder letzten Datensatz abrufen

```typescript
// Ersten Benutzer abrufen
const first_user = await User.first({});

// Ersten Administrator abrufen
const first_admin = await User.first({ role: "admin" });

// Letzten Benutzer abrufen
const last_user = await User.last({});
```

### Erweiterte Abfragen mit Operatoren

```typescript
// Größer oder gleich
const premium_users = await User.where("id", ">=", "user-100");

// String enthält
const gmail_users = await User.where("name", "contains", "gmail");

// In Array
const special_roles = await User.where("role", "in", ["admin", "premium", "vip"]);

// Nicht gleich
const non_customers = await User.where("role", "!=", "customer");
```

### Abfrage mit Optionen

```typescript
// Ergebnisse begrenzen
const first_10_users = await User.where({}, { limit: 10 });

// Paginierung (skip und limit)
const page_2_users = await User.where({}, {
  limit: 10,
  skip: 10
});

// Sortierreihenfolge
const sorted_users = await User.where({}, { order: "DESC" });

// Spezifische Attribute auswählen
const user_names = await User.where({}, {
  attributes: ["id", "name"]
});
```

## Schritt 4: Datensätze aktualisieren

Sie können Datensätze mit Instanz- oder statischen Methoden aktualisieren:

### Mit der Instanz-`save()`-Methode

```typescript
// Benutzer abrufen
const user = await User.first({ name: "John Doe" });

if (user) {
  // Eigenschaften ändern
  user.name = "John Smith";
  user.role = "premium";

  // Änderungen speichern
  await user.save();

  console.log("Benutzer erfolgreich aktualisiert");
}
```

### Mit der Instanz-`update()`-Methode

```typescript
const user = await User.first({ name: "John Doe" });

if (user) {
  // Mehrere Felder gleichzeitig aktualisieren
  await user.update({
    name: "John Smith",
    role: "premium"
  });
}
```

### Mit der statischen `update()`-Methode

```typescript
// Nach ID aktualisieren
await User.update("user-123", {
  name: "John Smith",
  role: "premium"
});
```

### Batch-Aktualisierungen

```typescript
const users = await User.where({ role: "customer" });

// Alle Kunden auf Premium aktualisieren
await Promise.all(users.map(user => {
  user.role = "premium";
  return user.save();
}));
```

## Schritt 5: Datensätze löschen

Löschen Sie Datensätze mit Instanz- oder statischen Methoden:

### Mit der Instanz-`destroy()`-Methode

```typescript
const user = await User.first({ name: "John Doe" });

if (user) {
  await user.destroy();
  console.log("Benutzer gelöscht");
}
```

### Mit der statischen `delete()`-Methode

```typescript
// Nach ID löschen
await User.delete("user-123");
```

### Batch-Löschung

```typescript
const inactive_users = await User.where({ active: false });

// Alle inaktiven Benutzer löschen
await Promise.all(inactive_users.map(user => user.destroy()));
```

## Schritt 6: Zeitstempel hinzufügen

Zeitstempel verfolgen, wann Datensätze erstellt und aktualisiert werden. Verwenden Sie die Decorators `@CreatedAt` und `@UpdatedAt`:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Automatisch bei Erstellung gesetzt
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Automatisch beim Speichern aktualisiert
  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Verwendung
const user = await User.create({ name: "John Doe" });

console.log(user.created_at); // "2024-01-15T10:30:00.000Z"
console.log(user.updated_at); // "2024-01-15T10:30:00.000Z"

// Benutzer aktualisieren
user.name = "John Smith";
await user.save();

console.log(user.updated_at); // "2024-01-15T10:35:00.000Z" (aktualisiert!)
```

## Schritt 7: Vollständiges Arbeitsbeispiel

Hier ist ein vollständiges Beispiel, das alles zusammenbringt - ein einfaches Aufgabenverwaltungssystem:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  Validate,
  Mutate,
  NotNull,
  CreationOptional,
  NonAttribute,
  Dynamite
} from "@arcaelas/dynamite";

// DynamoDB-Verbindung konfigurieren
Dynamite.config({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Task-Modell definieren
class Task extends Table<Task> {
  // Automatisch generierte ID
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Erforderlicher Titel mit Validierung
  @NotNull()
  @Mutate((value) => (value as string).trim())
  @Validate((value) => (value as string).length >= 3 || "Titel muss mindestens 3 Zeichen lang sein")
  declare title: string;

  // Optionale Beschreibung
  @Default(() => "")
  declare description: CreationOptional<string>;

  // Status mit Standardwert
  @Default(() => "pending")
  @Validate((value) => ["pending", "in_progress", "completed"].includes(value as string) || "Ungültiger Status")
  declare status: CreationOptional<string>;

  // Priorität mit Validierung
  @Default(() => 1)
  @Validate((value) => (value as number) >= 1 && (value as number) <= 5 || "Priorität muss zwischen 1 und 5 liegen")
  declare priority: CreationOptional<number>;

  // Zeitstempel
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  // Berechnete Eigenschaft (nicht in Datenbank gespeichert)
  declare display_title: NonAttribute<string>;

  constructor(data?: any) {
    super(data);

    // Berechnete Eigenschaft definieren
    Object.defineProperty(this, 'display_title', {
      get: () => `[${this.status.toUpperCase()}] ${this.title}`,
      enumerable: true
    });
  }
}

// Hauptanwendung
async function main() {
  console.log("=== Aufgabenverwaltungssystem ===\n");

  // 1. Aufgaben erstellen
  console.log("1. Aufgaben erstellen...");
  const task1 = await Task.create({
    title: "Dokumentation schreiben",
    description: "Die Erste-Schritte-Anleitung vervollständigen",
    priority: 3
  });
  console.log(`Erstellt: ${task1.display_title}`);

  const task2 = await Task.create({
    title: "Fehler in API beheben",
    priority: 5
  });
  console.log(`Erstellt: ${task2.display_title}`);

  const task3 = await Task.create({
    title: "Pull Request überprüfen",
    priority: 2
  });
  console.log(`Erstellt: ${task3.display_title}\n`);

  // 2. Alle Aufgaben abrufen
  console.log("2. Alle Aufgaben auflisten...");
  const all_tasks = await Task.where({});
  all_tasks.forEach(task => {
    console.log(`  - ${task.title} (Priorität: ${task.priority})`);
  });
  console.log();

  // 3. Aufgaben nach Status filtern
  console.log("3. Ausstehende Aufgaben filtern...");
  const pending_tasks = await Task.where({ status: "pending" });
  console.log(`${pending_tasks.length} ausstehende Aufgaben gefunden\n`);

  // Finale Anzahl
  const final_count = await Task.where({});
  console.log(`=== Endgültige Aufgabenanzahl: ${final_count.length} ===`);
}

// Anwendung ausführen
main().catch(console.error);
```

## Das Beispiel verstehen

Lassen Sie uns die Schlüsselteile aufschlüsseln:

### Modelldefinition
```typescript
class Task extends Table<Task> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;
  // ...
}
```
- Erweitert `Table<Task>` für ORM-Funktionalität
- Decorators definieren Feldverhalten
- `CreationOptional` macht Felder während der Erstellung optional

### Datenvalidierung
```typescript
@Validate((value) => (value as string).length >= 3 || "Titel muss mindestens 3 Zeichen lang sein")
declare title: string;
```
- Validiert Daten vor dem Speichern
- Gibt `true` oder Fehlermeldungszeichenfolge zurück

### Datentransformation
```typescript
@Mutate((value) => (value as string).trim())
declare title: string;
```
- Transformiert Daten vor dem Speichern
- Nützlich für Normalisierung (trim, lowercase, etc.)

### Berechnete Eigenschaften
```typescript
declare display_title: NonAttribute<string>;

constructor(data?: any) {
  super(data);
  Object.defineProperty(this, 'display_title', {
    get: () => `[${this.status.toUpperCase()}] ${this.title}`,
    enumerable: true
  });
}
```
- `NonAttribute` schließt von Datenbank aus
- Dynamisch aus anderen Feldern berechnet
- Nicht gespeichert, bei Zugriff neu berechnet

## Nächste Schritte

Jetzt, da Sie die Grundlagen verstehen, erkunden Sie diese erweiterten Themen:

### Kernkonzepte
Lernen Sie die grundlegenden Konzepte und Architektur kennen:
- [Kernkonzepte](./core-concepts.de.md) - Tiefer Einblick in Decorators, Modelle und Beziehungen

### Erweiterte Funktionen
- **Beziehungen** - Definieren Sie Eins-zu-Viele- und Viele-zu-Eins-Beziehungen
- **Komplexe Abfragen** - Erweiterte Filterung und Abfrageerstellung
- **Datenvalidierung** - Benutzerdefinierte Validatoren und Transformationen
- **TypeScript-Typen** - Vollständige Typsicherheit mit `CreationOptional` und `NonAttribute`

### Best Practices
- Definieren Sie immer einen `@PrimaryKey()`
- Verwenden Sie `CreationOptional` für Felder mit `@Default`, `@CreatedAt`, `@UpdatedAt`
- Verwenden Sie `NonAttribute` für berechnete Eigenschaften
- Validieren Sie Benutzereingaben mit `@Validate`
- Transformieren Sie Daten mit `@Mutate` vor der Validierung
- Verwenden Sie spezifische Attributauswahl, um Datenübertragung zu reduzieren
- Behandeln Sie Fehler elegant mit Try-Catch-Blöcken

### Zusätzliche Ressourcen
- [API-Referenz](../api/table.md) - Vollständige API-Dokumentation
- [Beispiele](../../examples/) - Weitere Codebeispiele
- [GitHub Issues](https://github.com/arcaelas/dynamite/issues) - Häufige Probleme und Lösungen

## Schnellreferenz

### Wesentliche Decorators
| Decorator | Zweck | Beispiel |
|-----------|-------|----------|
| `@PrimaryKey()` | Primärschlüssel | `@PrimaryKey() declare id: string` |
| `@Default(fn)` | Standardwert | `@Default(() => uuid()) declare id: string` |
| `@CreatedAt()` | Auto-Zeitstempel bei Erstellung | `@CreatedAt() declare created_at: string` |
| `@UpdatedAt()` | Auto-Zeitstempel bei Aktualisierung | `@UpdatedAt() declare updated_at: string` |
| `@Validate(fn)` | Validierung | `@Validate((v) => v.length > 0) declare name: string` |
| `@Mutate(fn)` | Daten transformieren | `@Mutate((v) => v.trim()) declare email: string` |
| `@NotNull()` | Nicht-Null-Prüfung | `@NotNull() declare email: string` |

### Wesentliche Typen
| Typ | Zweck | Verwendung |
|-----|-------|------------|
| `CreationOptional<T>` | Optional bei Erstellung | Felder mit `@Default`, `@CreatedAt`, `@UpdatedAt` |
| `NonAttribute<T>` | Nicht in DB gespeichert | Berechnete Eigenschaften, Getter, Methoden |

### CRUD-Operationen
```typescript
// Erstellen
const user = await User.create({ name: "John" });

// Lesen
const users = await User.where({ active: true });
const user = await User.first({ id: "123" });

// Aktualisieren
user.name = "Jane";
await user.save();
// oder
await User.update("123", { name: "Jane" });

// Löschen
await user.destroy();
// oder
await User.delete("123");
```

## Hilfe erhalten

Wenn Sie auf Probleme stoßen:
1. Überprüfen Sie die [API-Referenz](../api/table.md)
2. Suchen Sie in bestehenden [GitHub-Issues](https://github.com/arcaelas/dynamite/issues)
3. Erstellen Sie ein neues Issue mit einem minimalen reproduzierbaren Beispiel

Viel Spaß beim Programmieren mit Dynamite!
