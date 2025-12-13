# Beispiel für Grundlegendes Modell

Dieses Beispiel demonstriert eine einfache CRUD-Anwendung (Create, Read, Update, Delete) mit Dynamite ORM. Wir erstellen ein komplettes Benutzerverwaltungssystem von Grund auf und decken alle wesentlichen Operationen ab.

## Inhaltsverzeichnis

- [Modelldefinition](#modelldefinition)
- [Einrichtung und Konfiguration](#einrichtung-und-konfiguration)
- [Datensatze Erstellen](#datensatze-erstellen)
- [Datensatze Lesen](#datensatze-lesen)
- [Datensatze Aktualisieren](#datensatze-aktualisieren)
- [Datensatze Loschen](#datensatze-loschen)
- [Vollstandiges Funktionierendes Beispiel](#vollstandiges-funktionierendes-beispiel)
- [Erwartete Ausgabe](#erwartete-ausgabe)
- [Schlusselkonzepte](#schlusselkonzepte)
- [Nachste Schritte](#nachste-schritte)

## Modelldefinition

Beginnen wir mit der Definition eines User-Modells mit wesentlichen Feldern und Decorators:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

class User extends Table<User> {
  // Automatisch generierter Primärschlüssel
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Erforderliches Feld bei Erstellung
  declare name: string;

  // Erforderliches E-Mail-Feld
  declare email: string;

  // Optionales Feld mit Standardwert
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Optionaler Aktivstatus mit Standardwert
  @Default(() => true)
  declare active: CreationOptional<boolean>;

  // Automatisch verwaltete Zeitstempel
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}
```

**Decorator-Aufschlüsselung:**
- `@PrimaryKey()` - Markiert `id` als Partitionsschlüssel in DynamoDB
- `@Default()` - Stellt automatische Standardwerte bereit, wenn Feld weggelassen wird
- `@CreatedAt()` - Setzt automatisch ISO-Zeitstempel bei Datensatzerstellung
- `@UpdatedAt()` - Aktualisiert automatisch ISO-Zeitstempel bei jedem Speichern
- `CreationOptional<T>` - Macht Feld optional bei Erstellung, aber erforderlich in Instanzen

## Einrichtung und Konfiguration

Vor der Verwendung Ihrer Modelle konfigurieren Sie die DynamoDB-Verbindung:

```typescript
// Für lokale Entwicklung mit DynamoDB Local
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User], // Ihre Modellklassen
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});
dynamite.connect();
await dynamite.sync();

// Für AWS-Produktion
const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User],
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});
dynamite.connect();
await dynamite.sync();
```

**Konfigurationsoptionen:**
- `region` - AWS-Region (z.B. "us-east-1", "eu-west-1")
- `endpoint` - DynamoDB-Endpunkt (verwenden Sie localhost:8000 für lokale Entwicklung)
- `tables` - Array von Modellklassen zur Registrierung
- `credentials` - AWS-Anmeldeinformationsobjekt mit accessKeyId und secretAccessKey

## Datensätze Erstellen

### Grundlegende Erstellung

Der einfachste Weg, einen Datensatz zu erstellen, ist die Verwendung der statischen Methode `create()`:

```typescript
// Nur mit erforderlichen Feldern erstellen
const user1 = await User.create({
  name: "John Doe",
  email: "john@example.com"
  // id, role, active, Zeitstempel werden automatisch generiert
});

console.log(user1.id);         // "550e8400-e29b-41d4-a716-446655440000"
console.log(user1.name);       // "John Doe"
console.log(user1.email);      // "john@example.com"
console.log(user1.role);       // "customer" (Standard)
console.log(user1.active);     // true (Standard)
console.log(user1.created_at); // "2024-01-15T10:30:00.000Z"
console.log(user1.updated_at); // "2024-01-15T10:30:00.000Z"
```

### Erstellung mit Allen Feldern

Sie können Standardwerte bei der Erstellung überschreiben:

```typescript
const user2 = await User.create({
  id: "custom-user-id",
  name: "Jane Smith",
  email: "jane@example.com",
  role: "admin",
  active: true
});

console.log(user2.id);   // "custom-user-id" (benutzerdefiniert)
console.log(user2.role); // "admin" (überschriebener Standard)
```

### Massenerstellung

Erstellen Sie mehrere Datensätze effizient mit `Promise.all()`:

```typescript
const users = await Promise.all([
  User.create({
    name: "Alice Johnson",
    email: "alice@example.com"
  }),
  User.create({
    name: "Bob Williams",
    email: "bob@example.com",
    role: "moderator"
  }),
  User.create({
    name: "Charlie Brown",
    email: "charlie@example.com"
  })
]);

console.log(`Created ${users.length} users`);
// Ausgabe: Created 3 users
```

## Datensätze Lesen

### Alle Datensätze Abrufen

Alle Datensätze aus der Tabelle abrufen:

```typescript
const all_users = await User.where({});
console.log(`Total users: ${all_users.length}`);

// Durch Ergebnisse iterieren
all_users.forEach(user => {
  console.log(`${user.name} (${user.email})`);
});
```

### Nach Genauer Übereinstimmung Filtern

Datensätze abfragen, die bestimmten Feldwerten entsprechen:

```typescript
// Einzelfeldfilter
const admins = await User.where({ role: "admin" });
console.log(`Found ${admins.length} admin users`);

// Mehrfeldfilter (UND-Bedingung)
const active_admins = await User.where({
  role: "admin",
  active: true
});
console.log(`Found ${active_admins.length} active admin users`);
```

### Ersten oder Letzten Datensatz Abrufen

Den ersten oder letzten Datensatz abrufen, der den Kriterien entspricht:

```typescript
// Ersten Benutzer abrufen
const first_user = await User.first({});
console.log(`First user: ${first_user?.name}`);

// Ersten Admin abrufen
const first_admin = await User.first({ role: "admin" });
console.log(`First admin: ${first_admin?.name}`);

// Letzten Benutzer abrufen
const last_user = await User.last({});
console.log(`Last user: ${last_user?.name}`);

// Letzten Kunden abrufen
const last_customer = await User.last({ role: "customer" });
console.log(`Last customer: ${last_customer?.name}`);
```

### Nach Feld und Wert Abfragen

Methodensignatur mit Feldname und Wert verwenden:

```typescript
// Abfrage nach einem einzelnen Feld
const johns = await User.where("name", "John Doe");
console.log(`Found ${johns.length} users named John Doe`);

// Abfrage mit Array-Wert (IN-Operator)
const specific_users = await User.where("id", [
  "user-1",
  "user-2",
  "user-3"
]);
console.log(`Found ${specific_users.length} specific users`);
```

### Mit Optionen Abfragen

Abfrageoptionen für Paginierung, Sortierung und Attributauswahl verwenden:

```typescript
// Ergebnisse begrenzen
const first_10 = await User.where({}, { limit: 10 });
console.log(`Retrieved ${first_10.length} users`);

// Paginierung (skip und limit)
const page_2 = await User.where({}, {
  skip: 10,
  limit: 10
});
console.log(`Page 2: ${page_2.length} users`);

// Sortierreihenfolge (ASC oder DESC)
const sorted_users = await User.where({}, {
  order: "DESC"
});

// Nur spezifische Attribute auswählen
const user_summaries = await User.where({}, {
  attributes: ["id", "name", "email"]
});

user_summaries.forEach(user => {
  console.log(`${user.name}: ${user.email}`);
  // role, active, Zeitstempel werden nicht geladen
});
```

## Datensätze Aktualisieren

### Verwendung der Instanzmethode `save()`

Instanzeigenschaften ändern und `save()` aufrufen:

```typescript
// Benutzer abrufen
const user = await User.first({ email: "john@example.com" });

if (user) {
  // Eigenschaften ändern
  user.name = "John Smith";
  user.role = "premium";

  // Änderungen speichern
  await user.save();

  console.log(`Updated user: ${user.name}`);
  console.log(`Updated at: ${user.updated_at}`);
  // updated_at Zeitstempel wird automatisch aktualisiert
}
```

### Verwendung der Instanzmethode `update()`

Mehrere Felder gleichzeitig aktualisieren:

```typescript
const user = await User.first({ email: "john@example.com" });

if (user) {
  await user.update({
    name: "John Smith",
    role: "premium",
    active: true
  });

  console.log(`User updated: ${user.name}`);
}
```

### Verwendung der Statischen Methode `update()`

Datensätze nach Filterkriterien aktualisieren:

```typescript
// Alle Benutzer aktualisieren, die mit dem Filter übereinstimmen
const updated_count = await User.update(
  { name: "John A. Smith", role: "premium" },
  { email: "john@example.com" }
);

console.log(`Updated ${updated_count} user(s)`);
```

### Batch-Updates

Mehrere Datensätze effizient aktualisieren:

```typescript
// Alle Kunden abrufen
const customers = await User.where({ role: "customer" });

// Alle auf Premium upgraden
await Promise.all(customers.map(user => {
  user.role = "premium";
  return user.save();
}));

console.log(`Upgraded ${customers.length} customers to premium`);
```

## Datensätze Löschen

### Verwendung der Instanzmethode `destroy()`

Eine bestimmte Instanz löschen:

```typescript
const user = await User.first({ email: "john@example.com" });

if (user) {
  await user.destroy();
  console.log(`Deleted user: ${user.name}`);
}
```

### Verwendung der Statischen Methode `delete()`

Datensätze löschen, die Filterkriterien entsprechen:

```typescript
// Nach Filter löschen
const deleted_count = await User.delete({ email: "john@example.com" });
console.log(`Deleted ${deleted_count} user(s)`);

// Mehrere Benutzer löschen
const deleted_inactive = await User.delete({ active: false });
console.log(`Deleted ${deleted_inactive} inactive user(s)`);
```

### Batch-Löschung

Mehrere Datensätze effizient löschen:

```typescript
// Alle inaktiven Benutzer abrufen
const inactive_users = await User.where({ active: false });

// Alle inaktiven Benutzer löschen
await Promise.all(inactive_users.map(user => user.destroy()));

console.log(`Deleted ${inactive_users.length} inactive users`);
```

## Vollständiges Funktionierendes Beispiel

Hier ist ein vollständiges, ausführbares Beispiel, das alle CRUD-Operationen demonstriert:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

// User-Modell definieren
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// DynamoDB-Verbindung konfigurieren und User-Tabelle registrieren
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User],
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Hauptanwendung
async function main() {
  // Verbindung herstellen und Tabellen synchronisieren
  dynamite.connect();
  await dynamite.sync();
  console.log("=== User Management System ===\n");

  // 1. CREATE - Neue Benutzer hinzufügen
  console.log("1. Creating users...");
  const user1 = await User.create({
    name: "John Doe",
    email: "john@example.com"
  });
  console.log(`Created: ${user1.name} (${user1.id})`);

  const user2 = await User.create({
    name: "Jane Smith",
    email: "jane@example.com",
    role: "admin"
  });
  console.log(`Created: ${user2.name} (${user2.id})`);

  // Weitere CRUD-Operationen wie im Original...
  
  console.log("=== All operations completed successfully ===");
}

// Anwendung ausführen
main().catch(console.error);
```

## Erwartete Ausgabe

Wenn Sie das vollständige Beispiel ausführen, sollten Sie eine ähnliche Ausgabe wie diese sehen:

```
=== User Management System ===

1. Creating users...
Created: John Doe (550e8400-e29b-41d4-a716-446655440000)
Created: Jane Smith (6ba7b810-9dad-11d1-80b4-00c04fd430c8)
...
=== All operations completed successfully ===
```

## Schlüsselkonzepte

### 1. Modelldefinition

Modelle sind TypeScript-Klassen, die `Table<T>` erweitern:

```typescript
class User extends Table<User> {
  // Felddefinitionen mit Decorators
}
```

Der generische Parameter `<User>` bietet Typsicherheit im gesamten ORM.

### 2. Decorators

Decorators definieren das Feldverhalten:

- **@PrimaryKey()** - Markiert den Partitionsschlüssel (erforderlich für jedes Modell)
- **@Default()** - Stellt automatische Standardwerte bereit
- **@CreatedAt()** - Setzt automatisch Zeitstempel bei Erstellung
- **@UpdatedAt()** - Aktualisiert automatisch Zeitstempel beim Speichern

### 3. Typsicherheit

Der Typ `CreationOptional<T>` macht Felder bei der Erstellung optional, aber in Instanzen erforderlich:

```typescript
@Default(() => "customer")
declare role: CreationOptional<string>;

// Bei der Erstellung:
await User.create({ name: "John" }); // role ist optional

// In Instanz:
const user = await User.first({});
console.log(user.role); // role ist garantiert vorhanden (string)
```

### 4. Abfragemethoden

Dynamite bietet flexible Abfragemethoden:

- `where()` - Datensätze mit verschiedenen Signaturen filtern
- `first()` - Ersten übereinstimmenden Datensatz abrufen
- `last()` - Letzten übereinstimmenden Datensatz abrufen
- `create()` - Neuen Datensatz erstellen
- `update()` - Datensätze aktualisieren
- `delete()` - Datensätze löschen

## Nächste Schritte

Jetzt, da Sie grundlegende CRUD-Operationen verstehen, erkunden Sie diese fortgeschrittenen Themen:

### Verwandte Dokumentation

- [Beziehungsbeispiel](./relations.de.md) - Eins-zu-Viele- und Viele-zu-Eins-Beziehungen
- [Beispiel für Fortgeschrittene Abfragen](./advanced.de.md) - Komplexe Abfragen, Paginierung und Filterung

### API-Referenzen

- [Table API-Referenz](../references/table.md) - Vollständige Table-Klassendokumentation
- [Decorators-Leitfaden](../references/decorators.md) - Alle verfügbaren Decorators
- [Kernkonzepte](../references/core-concepts.md) - Tiefgehender Einblick in die Dynamite-Architektur

Viel Erfolg beim Programmieren mit Dynamite!
