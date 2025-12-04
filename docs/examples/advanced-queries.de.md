# Beispiel für Fortgeschrittene Abfragen

Dieses umfassende Beispiel demonstriert fortgeschrittene Abfragemuster, Paginierung, Filterung, Sortierung und komplexe Datenoperationen in Dynamite ORM. Lernen Sie, wie Sie effiziente, skalierbare Abfragen für reale Anwendungen erstellen.

## Inhaltsverzeichnis

- [Abfrageoperatoren](#abfrageoperatoren)
- [Vergleichsabfragen](#vergleichsabfragen)
- [Array-Abfragen](#array-abfragen)
- [String-Abfragen](#string-abfragen)
- [Paginierung](#paginierung)
- [Sortierung und Reihenfolge](#sortierung-und-reihenfolge)
- [Attributauswahl](#attributauswahl)
- [Komplexe Filterung](#komplexe-filterung)
- [Vollständiges Funktionierendes Beispiel](#vollständiges-funktionierendes-beispiel)
- [Erwartete Ausgabe](#erwartete-ausgabe)
- [Leistungsoptimierung](#leistungsoptimierung)
- [Best Practices](#best-practices)

## Abfrageoperatoren

Dynamite unterstützt einen umfangreichen Satz von Abfrageoperatoren für flexible Datenfilterung:

| Operator | Beschreibung | Beispiel |
|----------|--------------|----------|
| `=` | Gleich (Standard) | `where("age", 25)` |
| `!=` | Nicht gleich | `where("status", "!=", "deleted")` |
| `<` | Kleiner als | `where("age", "<", 18)` |
| `<=` | Kleiner oder gleich | `where("age", "<=", 65)` |
| `>` | Größer als | `where("score", ">", 100)` |
| `>=` | Größer oder gleich | `where("age", ">=", 18)` |
| `in` | In Array | `where("role", "in", ["admin", "user"])` |
| `not-in` | Nicht in Array | `where("status", "not-in", ["banned"])` |
| `contains` | String enthält | `where("email", "contains", "gmail")` |
| `begins-with` | String beginnt mit | `where("name", "begins-with", "John")` |

## Vergleichsabfragen

Verwenden Sie Vergleichsoperatoren für numerische und Datumsvergleiche:

### Gleich (Standard)

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreationOptional
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare age: number;
  declare role: string;
}

// Explizit gleich
const users1 = await User.where("age", "=", 25);

// Implizit gleich (Standardoperator)
const users2 = await User.where("age", 25);

// Objektsyntax (implizit gleich)
const users3 = await User.where({ age: 25 });

console.log(`Found ${users1.length} users aged 25`);
```

### Nicht Gleich

```typescript
// Alle Nicht-Admin-Benutzer finden
const non_admins = await User.where("role", "!=", "admin");
console.log(`Found ${non_admins.length} non-admin users`);

// Aktive Benutzer finden (nicht gelöscht)
const active_users = await User.where("status", "!=", "deleted");
```

### Größer Als / Kleiner Als

```typescript
// Erwachsene finden (Alter >= 18)
const adults = await User.where("age", ">=", 18);
console.log(`Adults: ${adults.length}`);

// Minderjährige finden (Alter < 18)
const minors = await User.where("age", "<", 18);
console.log(`Minors: ${minors.length}`);

// Benutzer im Altersbereich finden (18-65)
const working_age = await User.where("age", ">=", 18);
const filtered = working_age.filter(u => u.age <= 65);
console.log(`Working age: ${filtered.length}`);
```

### Datumsvergleiche

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;
  declare total: number;
  declare created_at: string;
}

// Bestellungen nach bestimmtem Datum
const recent_orders = await Order.where(
  "created_at",
  ">=",
  "2024-01-01T00:00:00.000Z"
);

// Bestellungen vor bestimmtem Datum
const old_orders = await Order.where(
  "created_at",
  "<",
  "2023-01-01T00:00:00.000Z"
);

// Bestellungen im Datumsbereich
const orders_2024 = await Order.where(
  "created_at",
  ">=",
  "2024-01-01T00:00:00.000Z"
);
const q1_orders = orders_2024.filter(
  o => o.created_at < "2024-04-01T00:00:00.000Z"
);
```

## Array-Abfragen

Datensätze abfragen, bei denen Feldwerte mit Elementen in einem Array übereinstimmen:

### In-Operator

```typescript
// Benutzer mit bestimmten Rollen finden
const privileged_users = await User.where(
  "role",
  "in",
  ["admin", "moderator", "premium"]
);

console.log(`Privileged users: ${privileged_users.length}`);

// Benutzer nach mehreren IDs finden
const specific_users = await User.where(
  "id",
  "in",
  ["user-1", "user-2", "user-3"]
);

// Kurzform: Array-Wert impliziert "in"-Operator
const users = await User.where("id", ["user-1", "user-2", "user-3"]);
```

### Not-In-Operator

```typescript
// Gesperrte und gelöschte Benutzer ausschließen
const active_users = await User.where(
  "status",
  "not-in",
  ["banned", "deleted", "suspended"]
);

console.log(`Active users: ${active_users.length}`);

// Testbenutzer ausschließen
const real_users = await User.where(
  "email",
  "not-in",
  ["test@example.com", "demo@example.com"]
);
```

## String-Abfragen

Musterübereinstimmung für String-Felder durchführen:

### Contains-Operator

```typescript
// Gmail-Benutzer finden
const gmail_users = await User.where("email", "contains", "gmail");
console.log(`Gmail users: ${gmail_users.length}`);

// Benutzer mit "john" im Namen finden
const johns = await User.where("name", "contains", "john");

// Benutzer mit bestimmter Domain finden
const company_users = await User.where("email", "contains", "@company.com");
```

### Begins-With-Operator

```typescript
// Benutzer mit Namen beginnend mit "J" finden
const j_users = await User.where("name", "begins-with", "J");
console.log(`Names starting with J: ${j_users.length}`);

// Benutzer mit bestimmtem Präfix finden
const admin_users = await User.where("username", "begins-with", "admin_");

// Bestellungen mit bestimmtem ID-Präfix finden
const orders_2024 = await Order.where("id", "begins-with", "2024-");
```

### Groß-/Kleinschreibung Unabhängige Suche

```typescript
// In Kleinbuchstaben umwandeln vor Suche
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((value) => (value as string).toLowerCase())
  declare email: string;
}

// Jetzt werden alle E-Mails in Kleinbuchstaben gespeichert
const users = await User.where("email", "contains", "gmail");

// Für Groß-/Kleinschreibung unabhängige Suche in nicht mutierten Feldern
const all_users = await User.where({});
const filtered = all_users.filter(u =>
  u.name.toLowerCase().includes("john")
);
```

## Paginierung

Effiziente Paginierung für große Datensätze implementieren:

### Grundlegende Paginierung

```typescript
// Seite 1: Erste 10 Benutzer
const page_1 = await User.where({}, {
  limit: 10,
  skip: 0
});

// Seite 2: Nächste 10 Benutzer
const page_2 = await User.where({}, {
  limit: 10,
  skip: 10
});

// Seite 3: Nächste 10 Benutzer
const page_3 = await User.where({}, {
  limit: 10,
  skip: 20
});

console.log(`Page 1: ${page_1.length} users`);
console.log(`Page 2: ${page_2.length} users`);
console.log(`Page 3: ${page_3.length} users`);
```

### Paginierungs-Hilfsfunktion

```typescript
async function paginate_users(
  page: number,
  page_size: number,
  filters: Partial<InferAttributes<User>> = {}
) {
  const skip = page * page_size;
  const users = await User.where(filters, {
    skip,
    limit: page_size
  });

  return {
    data: users,
    page,
    page_size,
    has_more: users.length === page_size
  };
}

// Verwendung
const result = await paginate_users(0, 10, { role: "customer" });
console.log(`Page ${result.page}: ${result.data.length} users`);
console.log(`Has more: ${result.has_more}`);
```

### Cursor-Basierte Paginierung

```typescript
async function paginate_by_cursor(
  last_id: string | null,
  page_size: number
) {
  let users: User[];

  if (last_id) {
    // Benutzer nach Cursor abrufen
    const all_users = await User.where({});
    const cursor_index = all_users.findIndex(u => u.id === last_id);
    users = all_users.slice(cursor_index + 1, cursor_index + 1 + page_size);
  } else {
    // Erste Seite
    users = await User.where({}, { limit: page_size });
  }

  return {
    data: users,
    next_cursor: users.length === page_size ? users[users.length - 1].id : null
  };
}

// Verwendung
const page_1 = await paginate_by_cursor(null, 10);
console.log(`Page 1: ${page_1.data.length} users`);

const page_2 = await paginate_by_cursor(page_1.next_cursor, 10);
console.log(`Page 2: ${page_2.data.length} users`);
```

## Sortierung und Reihenfolge

Reihenfolge der Abfrageergebnisse steuern:

### Aufsteigende Reihenfolge

```typescript
// Nach Alter aufsteigend sortieren (jüngste zuerst)
const users_asc = await User.where({}, {
  order: "ASC"
});

users_asc.forEach(user => {
  console.log(`${user.name}: ${user.age} years old`);
});
```

### Absteigende Reihenfolge

```typescript
// Nach Alter absteigend sortieren (älteste zuerst)
const users_desc = await User.where({}, {
  order: "DESC"
});

users_desc.forEach(user => {
  console.log(`${user.name}: ${user.age} years old`);
});
```

### Nach Bestimmtem Feld Sortieren

```typescript
// Alle Benutzer abrufen und nach Name sortieren
const all_users = await User.where({});
const sorted_by_name = all_users.sort((a, b) =>
  a.name.localeCompare(b.name)
);

// Alle Benutzer abrufen und nach mehreren Kriterien sortieren
const sorted = all_users.sort((a, b) => {
  // Zuerst nach Rolle
  if (a.role !== b.role) {
    return a.role.localeCompare(b.role);
  }
  // Dann nach Name
  return a.name.localeCompare(b.name);
});
```

### Neueste Datensätze

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  declare title: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// 10 neueste Posts abrufen
const recent_posts = await Post.where({}, {
  order: "DESC",
  limit: 10
});

recent_posts.forEach(post => {
  const date = new Date(post.created_at);
  console.log(`${post.title} - ${date.toLocaleDateString()}`);
});
```

## Attributauswahl

Nur spezifische Felder laden, um Leistung zu optimieren:

### Spezifische Attribute Auswählen

```typescript
// Nur id und name laden
const users = await User.where({}, {
  attributes: ["id", "name"]
});

users.forEach(user => {
  console.log(`${user.id}: ${user.name}`);
  // email, age, role sind nicht geladen
});
```

### Für Anzeige Auswählen

```typescript
// Minimale Daten für Benutzerliste laden
const user_list = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Benutzerliste anzeigen
user_list.forEach(user => {
  console.log(`${user.name} (${user.email})`);
});
```

### Für Leistung Auswählen

```typescript
// Nur notwendige Felder für Berechnung laden
const users = await User.where({ role: "premium" }, {
  attributes: ["id", "total_spent"]
});

const total_revenue = users.reduce((sum, user) => sum + user.total_spent, 0);
console.log(`Total premium revenue: $${total_revenue}`);
```

### Kombiniert mit Paginierung

```typescript
// Paginierte Benutzerliste mit minimalen Daten
const users = await User.where({}, {
  attributes: ["id", "name", "email", "role"],
  limit: 20,
  skip: 0,
  order: "ASC"
});

console.log(`Loaded ${users.length} users with minimal data`);
```

## Komplexe Filterung

Mehrere Abfragetechniken für erweiterte Filterung kombinieren:

### Mehrere Bedingungen

```typescript
// Premium-Erwachsene finden
const premium_adults = await User.where({
  role: "premium",
  age: 25
});

// Aktive Benutzer mit bestimmter Rolle finden
const active_admins = await User.where({
  role: "admin",
  status: "active"
});
```

### Filtern und Paginieren

```typescript
// Seite 2 der aktiven Premium-Benutzer abrufen
const users = await User.where(
  { role: "premium", active: true },
  {
    skip: 10,
    limit: 10,
    order: "DESC"
  }
);
```

### Filtern mit Attributauswahl

```typescript
// Namen aller Admin-Benutzer abrufen
const admins = await User.where(
  { role: "admin" },
  {
    attributes: ["id", "name", "email"]
  }
);

console.log("Admin users:");
admins.forEach(admin => {
  console.log(`  - ${admin.name} (${admin.email})`);
});
```

### Komplexe Geschäftslogik

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare price: number;
  declare stock: number;
  declare category: string;
}

// Erschwingliche Elektronik auf Lager finden
const affordable_electronics = await Product.where({
  category: "electronics"
});

const in_stock = affordable_electronics.filter(p =>
  p.stock > 0 && p.price < 500
);

console.log(`Found ${in_stock.length} affordable electronics in stock`);
```

## Vollständiges Funktionierendes Beispiel

Hier ist ein vollständiges Beispiel, das alle fortgeschrittenen Abfragemuster demonstriert:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  Mutate,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

// User-Modell
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  @Mutate((value) => (value as string).toLowerCase())
  declare email: string;

  declare age: number;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// Product-Modell
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare category: string;
  declare price: number;
  declare stock: number;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// DynamoDB konfigurieren und Tabellen registrieren
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User, Product],
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
  console.log("=== Advanced Queries Example ===\n");

  // Beispielbenutzer erstellen
  console.log("1. Creating sample users...");
  await Promise.all([
    User.create({ name: "John Doe", email: "john@gmail.com", age: 25, role: "customer" }),
    User.create({ name: "Jane Smith", email: "jane@yahoo.com", age: 32, role: "premium" }),
    User.create({ name: "Bob Johnson", email: "bob@gmail.com", age: 45, role: "admin" })
  ]);
  console.log("Created users\n");

  // Vergleichsabfragen
  console.log("2. Comparison queries...");
  const adults = await User.where("age", ">=", 18);
  console.log(`Adults (age >= 18): ${adults.length}`);

  const young_adults = await User.where("age", "<", 30);
  console.log(`Young adults (age < 30): ${young_adults.length}\n`);

  // Array-Abfragen
  console.log("3. Array queries...");
  const privileged = await User.where("role", "in", ["admin", "premium"]);
  console.log(`Privileged users: ${privileged.length}`);

  const gmail_users = await User.where("email", "contains", "gmail");
  console.log(`Gmail users: ${gmail_users.length}\n`);

  // Paginierung
  console.log("4. Pagination...");
  const page_1 = await User.where({}, { limit: 2, skip: 0 });
  console.log(`Page 1: ${page_1.length} users`);
  page_1.forEach(u => console.log(`  - ${u.name}`));
  console.log();

  // Sortierung
  console.log("5. Sorting...");
  const sorted_users = await User.where({}, { order: "DESC" });
  console.log("Users (descending order):");
  sorted_users.forEach(u => {
    console.log(`  - ${u.name} (age: ${u.age})`);
  });
  console.log();

  // Attributauswahl
  console.log("6. Attribute selection...");
  const user_list = await User.where({}, {
    attributes: ["id", "name", "email"]
  });
  console.log("User summary (minimal data):");
  user_list.forEach(u => {
    console.log(`  - ${u.name}: ${u.email}`);
  });
  console.log();

  console.log("=== All advanced queries completed ===");
}

// Anwendung ausführen
main().catch(console.error);
```

## Erwartete Ausgabe

```
=== Advanced Queries Example ===

1. Creating sample users...
Created users

2. Comparison queries...
Adults (age >= 18): 3
Young adults (age < 30): 1

3. Array queries...
Privileged users: 2
Gmail users: 2

4. Pagination...
Page 1: 2 users
  - John Doe
  - Jane Smith

5. Sorting...
Users (descending order):
  - Bob Johnson (age: 45)
  - Jane Smith (age: 32)
  - John Doe (age: 25)

6. Attribute selection...
User summary (minimal data):
  - John Doe: john@gmail.com
  - Jane Smith: jane@yahoo.com
  - Bob Johnson: bob@gmail.com

=== All advanced queries completed ===
```

## Leistungsoptimierung

### 1. Attributauswahl Verwenden

```typescript
// Gut - nur benötigte Felder laden
const users = await User.where({}, {
  attributes: ["id", "name"]
});

// Schlecht - alle Felder laden, wenn nur einige benötigt werden
const users = await User.where({});
```

### 2. Paginierung Implementieren

```typescript
// Gut - paginierte Abfragen
const users = await User.where({}, {
  limit: 20,
  skip: 0
});

// Schlecht - alle Datensätze auf einmal laden
const users = await User.where({});
```

### 3. Früh Filtern

```typescript
// Gut - in DynamoDB filtern
const admins = await User.where({ role: "admin" });

// Schlecht - in Anwendung filtern
const all_users = await User.where({});
const admins = all_users.filter(u => u.role === "admin");
```

### 4. Indizes Verwenden

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // Häufig abgefragte Felder indizieren
  @Index()
  declare email: string;

  @IndexSort()
  declare created_at: string;
}
```

### 5. Häufig Abgerufene Daten Cachen

```typescript
// Einfacher In-Memory-Cache
const cache = new Map<string, any>();

async function get_user_by_id(id: string) {
  if (cache.has(id)) {
    return cache.get(id);
  }

  const user = await User.first({ id });
  if (user) {
    cache.set(id, user);
  }
  return user;
}
```

## Best Practices

### 1. Spezifische Operatoren Verwenden

```typescript
// Gut - spezifischer Operator
const users = await User.where("age", ">=", 18);

// Schlecht - alles laden und filtern
const all_users = await User.where({});
const adults = all_users.filter(u => u.age >= 18);
```

### 2. Filter Kombinieren

```typescript
// Gut - mehrere Bedingungen in einer Abfrage
const users = await User.where({
  role: "premium",
  active: true
});

// Schlecht - mehrere separate Abfragen
const premium = await User.where({ role: "premium" });
const active_premium = premium.filter(u => u.active);
```

### 3. Große Ergebnisse Paginieren

```typescript
// Gut - paginierte Ergebnisse
async function* iterate_users(page_size: number) {
  let page = 0;
  while (true) {
    const users = await User.where({}, {
      skip: page * page_size,
      limit: page_size
    });

    if (users.length === 0) break;

    yield users;
    page++;
  }
}

for await (const users of iterate_users(100)) {
  // Batch verarbeiten
}

// Schlecht - alles laden
const all_users = await User.where({});
```

### 4. Nur Benötigte Attribute Auswählen

```typescript
// Gut - minimale Daten für Anzeige
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Schlecht - alle Felder laden
const users = await User.where({});
```

### 5. Klare Abfragenamen Verwenden

```typescript
// Gut - beschreibende Abfrage
async function get_active_premium_users() {
  return await User.where({
    role: "premium",
    active: true
  });
}

// Schlecht - unklare Abfrage
async function get_users_1() {
  return await User.where({ role: "premium", active: true });
}
```

## Nächste Schritte

### Verwandte Dokumentation

- [Beispiel für Grundlegendes Modell](./basic-model.de.md) - Einfache CRUD-Operationen
- [Validierungsbeispiel](./validation.de.md) - Datenvalidierungsmuster
- [Beziehungsbeispiel](./relationships.de.md) - Beziehungen und verschachtelte Includes

### API-Referenzen

- [Table API](../api/table.md) - Vollständige Table-Klassendokumentation
- [Abfrageoperatoren](../guides/core-concepts.md#query-operators) - Alle verfügbaren Operatoren
- [Decorator-Leitfaden](../guides/decorators.md) - Alle verfügbaren Decorators

Viel Erfolg beim Abfragen mit Dynamite!
