# Table API Referenz

## Allgemeine Beschreibung

Die Klasse `Table` ist die Basisklasse für alle Modelle in Dynamite ORM. Sie bietet eine vollständige und typisierte API für die Durchführung von CRUD-Operationen, erweiterten Abfragen, Beziehungsverwaltung und Datenmanipulation in DynamoDB.

**Hauptmerkmale:**
- Strikte Typisierung mit TypeScript
- Vollständige CRUD-Operationen
- Flexibles Abfragesystem mit mehreren Operatoren
- Unterstützung für HasMany- und BelongsTo-Beziehungen
- Automatische Verwaltung von Timestamps (createdAt/updatedAt)
- Integrierte Validierungen und Mutationen
- Paginierung und Sortierung
- Auswahl spezifischer Attribute
- Einbeziehung verschachtelter Beziehungen

## Import

```typescript
import { Table } from '@arcaelas/dynamite';
```

## Modelldefinition

```typescript
import { Table, Name, PrimaryKey, NotNull, Default, CreatedAt, UpdatedAt } from '@arcaelas/dynamite';

@Name("users")
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  @Default(() => 25)
  declare age: number;

  @CreatedAt()
  declare createdAt: string;

  @UpdatedAt()
  declare updatedAt: string;
}
```

---

## Konstruktor

### `constructor(data: InferAttributes<T>)`

Erstellt eine neue Instanz des Modells mit den bereitgestellten Daten.

**Parameter:**
- `data` - Objekt mit den Modellattributen (schließt Beziehungen und Methoden aus)

**Merkmale:**
- Wendet Standardwerte an, die mit `@Default()` definiert sind
- Initialisiert im Modell deklarierte Eigenschaften
- Persistiert nicht automatisch in der Datenbank (verwenden Sie `save()` zum Persistieren)

**Beispiel:**

```typescript
const user = new User({
  id: "user-123",
  email: "john@example.com",
  name: "John Doe",
  age: 30
});

// Um in der Datenbank zu persistieren
await user.save();
```

---

## Instanzmethoden

### `save(): Promise<this>`

Speichert oder aktualisiert den aktuellen Datensatz in der Datenbank.

**Verhalten:**
- Wenn der Datensatz keine `id` hat (oder sie `null`/`undefined` ist), erstellt er einen neuen Datensatz
- Wenn der Datensatz eine `id` hat, aktualisiert er den vorhandenen Datensatz
- Aktualisiert automatisch das Feld `updatedAt`, wenn es definiert ist
- Setzt `createdAt` nur bei neuen Datensätzen

**Rückgabe:** Die aktualisierte aktuelle Instanz

**Beispiel:**

```typescript
// Neuen Datensatz erstellen
const user = new User({
  email: "jane@example.com",
  name: "Jane Smith"
});
await user.save(); // createdAt und updatedAt werden automatisch gesetzt

// Vorhandenen Datensatz aktualisieren
user.name = "Jane Doe";
await user.save(); // Nur updatedAt wird aktualisiert
```

---

### `update(patch: Partial<InferAttributes<T>>): Promise<this>`

Aktualisiert den Datensatz teilweise mit den bereitgestellten Feldern.

**Parameter:**
- `patch` - Objekt mit den zu aktualisierenden Feldern

**Rückgabe:** Die aktualisierte aktuelle Instanz

**Beispiel:**

```typescript
const user = await User.first({ id: "user-123" });
await user.update({
  name: "John Updated",
  age: 31
});

console.log(user.name); // "John Updated"
console.log(user.age);  // 31
```

---

### `destroy(): Promise<null>`

Löscht den aktuellen Datensatz aus der Datenbank.

**Anforderungen:**
- Die Instanz muss eine gültige `id` haben

**Rückgabe:** `null`

**Fehler:**
- Wirft Fehler, wenn die Instanz keine `id` hat

**Beispiel:**

```typescript
const user = await User.first({ id: "user-123" });
await user.destroy(); // Löscht den Datensatz aus der Datenbank
```

---

### `toJSON(): Record<string, any>`

Serialisiert die Instanz zu einem einfachen JSON-Objekt.

**Merkmale:**
- Enthält alle mit Dekoratoren definierten Spalten
- Schließt Beziehungen aus (HasMany, BelongsTo)
- Aktiviert im Modell definierte virtuelle Getter
- Enthält ad-hoc aufzählbare Eigenschaften

**Rückgabe:** Einfaches Objekt mit den Modelldaten

**Beispiel:**

```typescript
const user = await User.first({ id: "user-123" });
const json = user.toJSON();

console.log(json);
// {
//   id: "user-123",
//   email: "john@example.com",
//   name: "John Doe",
//   age: 30,
//   createdAt: "2025-01-15T10:30:00.000Z",
//   updatedAt: "2025-01-15T10:30:00.000Z"
// }
```

---

## Statische Methoden

### `create<M>(data: InferAttributes<M>): Promise<M>`

Erstellt und persistiert einen neuen Datensatz in der Datenbank.

**Parameter:**
- `data` - Objekt mit den Attributen des neuen Datensatzes

**Merkmale:**
- Erstellt eine neue Instanz
- Setzt automatisch `createdAt` und `updatedAt`
- Wendet Standardwerte, Validierungen und Mutationen an
- Persistiert sofort in DynamoDB

**Rückgabe:** Neue persistierte Modellinstanz

**Beispiel:**

```typescript
const user = await User.create({
  id: "user-456",
  email: "alice@example.com",
  name: "Alice Wonder",
  age: 28
});

console.log(user.id); // "user-456"
console.log(user.createdAt); // "2025-01-15T10:30:00.000Z"
```

**Mit Validierungen und Mutationen:**

```typescript
@Name("users")
class User extends Table<User> {
  @Mutate(v => v.toLowerCase().trim())
  @Validate(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? true : "Email inválido")
  declare email: string;
}

// Die E-Mail wird in Kleinbuchstaben umgewandelt und das Format validiert
const user = await User.create({
  id: "user-789",
  email: "  BOB@EXAMPLE.COM  ", // Wird zu "bob@example.com" konvertiert
  name: "Bob"
});
```

---

### `update<M>(updates: Partial<InferAttributes<M>>, filters: Partial<InferAttributes<M>>): Promise<number>`

Aktualisiert mehrere Datensätze, die den Filtern entsprechen.

**Parameter:**
- `updates` - Objekt mit den zu aktualisierenden Feldern (`undefined`-Felder werden ignoriert)
- `filters` - Objekt mit den Auswahlkriterien

**Merkmale:**
- Aktualisiert alle Datensätze, die den Filtern entsprechen
- Aktualisiert automatisch das Feld `updatedAt`
- Felder mit dem Wert `undefined` werden ignoriert
- Atomare Operation für jeden Datensatz

**Rückgabe:** Anzahl der aktualisierten Datensätze

**Beispiel:**

```typescript
// Mehrere Benutzer aktualisieren
const count = await User.update(
  { active: false, role: "suspended" },
  { status: "banned" }
);

console.log(`${count} Benutzer gesperrt`);

// Einen bestimmten Benutzer aktualisieren
await User.update(
  { balance: 100.0 },
  { id: "user-123" }
);
```

**Bedingte Aktualisierung:**

```typescript
// Inaktive Benutzer deaktivieren
const inactiveCount = await User.update(
  { active: false },
  { lastLoginDate: "2024-01-01" } // Benutzerdefinierter Filter
);
```

---

### `delete<M>(filters: Partial<InferAttributes<M>>): Promise<number>`

Löscht Datensätze, die den Filtern entsprechen.

**Parameter:**
- `filters` - Objekt mit den Auswahlkriterien

**Merkmale:**
- Löscht alle Datensätze, die den Filtern entsprechen
- Permanente Operation (standardmäßig kein Soft Delete)
- Gibt die Anzahl der gelöschten Datensätze zurück

**Rückgabe:** Anzahl der gelöschten Datensätze

**Beispiel:**

```typescript
// Einen bestimmten Benutzer löschen
const count = await User.delete({ id: "user-123" });
console.log(`${count} Benutzer gelöscht`);

// Mehrere Benutzer löschen
await User.delete({ status: "inactive", verified: false });

// Alle Datensätze löschen (mit Vorsicht verwenden)
await User.delete({});
```

---

## where()-Methode - Erweiterte Abfragen

Die `where()`-Methode ist die vielseitigste Methode zur Abfrage von Daten mit mehreren Überladungen und erweiterten Optionen.

### Überladung 1: `where(field, value): Promise<M[]>`

Sucht nach Datensätzen, bei denen ein Feld einem Wert (oder mehreren Werten) entspricht.

**Parameter:**
- `field` - Feldname
- `value` - Wert oder Array von Werten (Array wird in `IN`-Operator umgewandelt)

**Beispiel:**

```typescript
// Einfache Gleichheit
const admins = await User.where("role", "admin");

// Implizites IN mit Array
const users = await User.where("role", ["admin", "employee"]);
// Entspricht: role IN ("admin", "employee")
```

---

### Überladung 2: `where(field, operator, value): Promise<M[]>`

Sucht nach Datensätzen mit einem bestimmten Operator.

**Parameter:**
- `field` - Feldname
- `operator` - Vergleichsoperator (siehe Operatortabelle)
- `value` - Wert oder Array von Werten (je nach Operator)

**Unterstützte Operatoren:**

| Operator | Beschreibung | Beispiel |
|----------|-------------|---------|
| `"="` | Gleich | `where("age", "=", 25)` |
| `"!="` | Ungleich | `where("status", "!=", "banned")` |
| `"<"` | Kleiner als | `where("age", "<", 30)` |
| `"<="` | Kleiner oder gleich | `where("price", "<=", 100)` |
| `">"` | Größer als | `where("balance", ">", 1000)` |
| `">="` | Größer oder gleich | `where("rating", ">=", 4)` |
| `"in"` | Enthalten im Array | `where("status", "in", ["active", "pending"])` |
| `"not-in"` | Nicht enthalten im Array | `where("role", "not-in", ["banned"])` |
| `"contains"` | Enthält Substring | `where("name", "contains", "John")` |
| `"begins-with"` | Beginnt mit | `where("email", "begins-with", "admin@")` |

**Beispiele:**

```typescript
// Numerischer Vergleich
const youngUsers = await User.where("age", "<", 30);
const richUsers = await User.where("balance", ">", 1000);

// String-Vergleich
const notBanned = await User.where("status", "!=", "banned");

// Array-Operatoren
const staff = await User.where("role", "in", ["admin", "employee"]);
const customers = await User.where("role", "not-in", ["admin", "employee"]);

// Text-Operatoren
const johns = await User.where("name", "contains", "John");
const admins = await User.where("email", "begins-with", "admin@");
```

---

### Überladung 3: `where(filters): Promise<M[]>`

Sucht nach Datensätzen, die mehreren Feldern entsprechen (impliziter AND-Operator).

**Parameter:**
- `filters` - Objekt mit Feld-Wert-Paaren

**Beispiel:**

```typescript
// Mehrere Bedingungen (AND)
const activeAdmins = await User.where({
  role: "admin",
  active: true,
  verified: true
});

// Entspricht: WHERE role = "admin" AND active = true AND verified = true
```

---

### Überladung 4: `where(filters, options): Promise<M[]>`

Sucht nach Datensätzen mit erweiterten Optionen für Paginierung, Sortierung, Attributauswahl und Einbeziehung von Beziehungen.

**Parameter:**
- `filters` - Objekt mit Feld-Wert-Paaren
- `options` - Objekt mit erweiterten Optionen

**Verfügbare Optionen:**

```typescript
interface WhereQueryOptions<T> {
  order?: "ASC" | "DESC";        // Sortierung
  skip?: number;                  // Anzahl der zu überspringenden Datensätze (Offset)
  limit?: number;                 // Maximale Anzahl zurückzugebender Datensätze
  attributes?: string[];          // Spezifische auszuwählende Felder
  include?: {                     // Einzubeziehende Beziehungen
    [relation: string]: IncludeRelationOptions | true;
  };
}

interface IncludeRelationOptions {
  where?: Record<string, any>;   // Filter für die Beziehung
  attributes?: string[];          // Spezifische Felder der Beziehung
  order?: "ASC" | "DESC";        // Sortierung der Beziehung
  skip?: number;                  // Offset der Beziehung
  limit?: number;                 // Limit der Beziehung
  include?: Record<string, IncludeRelationOptions | true>; // Verschachtelte Beziehungen
}
```

**Vollständige Beispiele:**

```typescript
// Paginierung und Sortierung
const users = await User.where({}, {
  limit: 10,
  skip: 20,        // Seite 3 (20 Datensätze übersprungen)
  order: "DESC"
});

// Auswahl spezifischer Attribute
const usernames = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Nur angeforderte Felder werden zurückgegeben
console.log(usernames[0].id);    // "user-123"
console.log(usernames[0].name);  // "John Doe"
console.log(usernames[0].age);   // undefined (nicht angefordert)

// Einbeziehung einfacher Beziehungen
const usersWithOrders = await User.where({}, {
  include: {
    orders: true  // Alle Bestellungen einbeziehen
  }
});

console.log(usersWithOrders[0].orders); // Array von Bestellungen

// Einbeziehung von Beziehungen mit Filtern
const usersWithCompletedOrders = await User.where({}, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 5,
      order: "DESC"
    }
  }
});

// Verschachtelte Beziehungen
const ordersWithDetails = await Order.where({}, {
  include: {
    user: true,              // Benutzer einbeziehen
    items: {                 // Bestellpositionen einbeziehen
      include: {
        product: {           // Produkt jeder Position einbeziehen
          include: {
            category: true   // Kategorie jedes Produkts einbeziehen
          }
        }
      }
    }
  }
});

// Vollständige Kombination
const result = await User.where(
  { active: true },
  {
    attributes: ["id", "name", "email"],
    limit: 20,
    skip: 0,
    order: "ASC",
    include: {
      orders: {
        where: { status: "delivered" },
        attributes: ["id", "total", "status"],
        limit: 10,
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      },
      reviews: {
        where: { rating: 5 },
        limit: 5
      }
    }
  }
);
```

---

### `first<M>(...args): Promise<M | undefined>`

Ruft den ersten Datensatz ab, der den Kriterien entspricht.

**Überladungen:**
- `first(field, value): Promise<M | undefined>`
- `first(field, operator, value): Promise<M | undefined>`
- `first(filters): Promise<M | undefined>`

**Merkmale:**
- Ruft intern `where()` mit denselben Argumenten auf
- Gibt nur das erste Ergebnis zurück
- Gibt `undefined` zurück, wenn kein Datensatz gefunden wird

**Beispiel:**

```typescript
// Nach eindeutigem Feld suchen
const user = await User.first("id", "user-123");
if (user) {
  console.log(user.name);
}

// Suchen mit Operator
const admin = await User.first("role", "=", "admin");

// Suchen mit mehreren Bedingungen
const activeAdmin = await User.first({
  role: "admin",
  active: true
});

// Existenzprüfung
const exists = (await User.first({ email: "test@example.com" })) !== undefined;
```

---

### `last<M>(...args): Promise<M | undefined>`

Ruft den letzten Datensatz ab, der den Kriterien entspricht.

**Überladungen:**
- `last(field, value): Promise<M | undefined>`
- `last(field, operator, value): Promise<M | undefined>`
- `last(filters): Promise<M | undefined>`

**Merkmale:**
- Ähnlich wie `first()`, gibt aber das letzte Ergebnis zurück
- Nützlich zum Abrufen des neuesten Datensatzes
- Verwendet intern absteigende Sortierung

**Beispiel:**

```typescript
// Den zuletzt erstellten Benutzer abrufen
const latestUser = await User.last({});

// Die letzte Bestellung eines Benutzers abrufen
const lastOrder = await Order.last({ user_id: "user-123" });

// Mit Operator
const lastHighRating = await Review.last("rating", ">=", 4);

if (lastOrder) {
  console.log(`Letzte Bestellung: ${lastOrder.id}`);
  console.log(`Summe: $${lastOrder.total}`);
}
```

---

## Beispiele für erweiterte Verwendung

### Komplexe Abfragen mit mehreren Bedingungen

```typescript
// Aktive Benutzer mit hohem Guthaben suchen
const premiumUsers = await User.where("balance", ">", 1000);
const activePremium = premiumUsers.filter(u => u.active === true);

// Alternative: verschachtelte where verwenden
const activeUsers = await User.where({ active: true });
const activePremiumAlt = activeUsers.filter(u => (u.balance as number) > 1000);
```

### Effiziente Paginierung

```typescript
async function getPaginatedUsers(page: number, pageSize: number) {
  const skip = (page - 1) * pageSize;

  const users = await User.where({}, {
    limit: pageSize,
    skip: skip,
    order: "ASC"
  });

  return {
    page,
    pageSize,
    data: users,
    hasMore: users.length === pageSize
  };
}

// Verwendung
const page1 = await getPaginatedUsers(1, 10);
const page2 = await getPaginatedUsers(2, 10);
```

### Textsuche

```typescript
// Nach Namen suchen, der einen Text enthält
const johns = await User.where("name", "contains", "John");

// Nach E-Mail suchen, die mit einem Präfix beginnt
const adminEmails = await User.where("email", "begins-with", "admin@");

// Mit anderen Filtern kombinieren
const activeJohns = johns.filter(u => u.active === true);
```

### Arbeiten mit Beziehungen

```typescript
// HasMany: Ein Benutzer hat viele Bestellungen
@Name("users")
class User extends Table<User> {
  @HasMany(() => Order, "user_id")
  declare orders: HasMany<Order>;
}

@Name("orders")
class Order extends Table<Order> {
  @BelongsTo(() => User, "user_id")
  declare user: BelongsTo<User>;
}

// Benutzer mit seinen Bestellungen abrufen
const user = await User.first({ id: "user-123" });
const userWithOrders = await User.where(
  { id: "user-123" },
  { include: { orders: true } }
);

console.log(userWithOrders[0].orders); // Array von Order

// Bestellung mit ihrem Benutzer abrufen
const orderWithUser = await Order.where(
  { id: "order-456" },
  { include: { user: true } }
);

console.log(orderWithUser[0].user.name); // Name des Benutzers
```

### Tief verschachtelte Beziehungen

```typescript
// Struktur: User -> Orders -> OrderItems -> Products -> Categories
const completeUserData = await User.where(
  { id: "user-123" },
  {
    include: {
      orders: {
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true
                }
              }
            }
          }
        }
      }
    }
  }
);

// Auf verschachtelte Daten zugreifen
const user = completeUserData[0];
const firstOrder = user.orders[0];
const firstItem = firstOrder.items[0];
const product = firstItem.product;
const category = product.category;

console.log(`Kategorie: ${category.name}`);
```

### Batch-Operationen

```typescript
// Mehrere Datensätze erstellen
const users = await Promise.all([
  User.create({ email: "user1@example.com", name: "User 1" }),
  User.create({ email: "user2@example.com", name: "User 2" }),
  User.create({ email: "user3@example.com", name: "User 3" })
]);

// Mehrere Datensätze aktualisieren
await User.update(
  { verified: true },
  { registrationDate: "2025-01-01" }
);

// Mehrere Datensätze löschen
await User.delete({ status: "inactive" });
```

### Validierung und Fehlerbehandlung

```typescript
try {
  const user = await User.create({
    email: "invalid-email",  // Ungültige E-Mail
    name: "Test User"
  });
} catch (error) {
  console.error(`Validierung fehlgeschlagen: ${error.message}`);
  // "Validierung fehlgeschlagen: Email inválido"
}

// Existenz vor dem Aktualisieren überprüfen
const user = await User.first({ id: "user-123" });
if (user) {
  await user.update({ name: "New Name" });
} else {
  console.log("Benutzer nicht gefunden");
}
```

### Teilweise Feldauswahl

```typescript
// Nur spezifische Felder abrufen (reduziert Datenübertragung)
const lightUsers = await User.where({}, {
  attributes: ["id", "name", "email"]
});

// Nicht angeforderte Felder sind undefined
console.log(lightUsers[0].id);      // "user-123"
console.log(lightUsers[0].name);    // "John Doe"
console.log(lightUsers[0].age);     // undefined
console.log(lightUsers[0].balance); // undefined
```

---

## Typinferenz

Dynamite ORM bietet vollständige Typinferenz mit TypeScript.

### InferAttributes<T>

Extrahiert nur die Attribute (schließt Methoden und Beziehungen aus).

```typescript
import type { InferAttributes } from '@arcaelas/dynamite';

type UserAttributes = InferAttributes<User>;
// {
//   id: string;
//   email: string;
//   name: string;
//   age: number;
//   createdAt: string;
//   updatedAt: string;
// }

// Verwendung in Funktionen
function createUser(data: InferAttributes<User>) {
  return User.create(data);
}
```

### CreationOptional<T>

Markiert Felder, die während der Erstellung optional sind (haben Standardwerte).

```typescript
import { CreationOptional } from '@arcaelas/dynamite';

@Name("products")
class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @Default(() => 0)
  declare stock: CreationOptional<number>; // Optional in create()

  @Default(() => true)
  declare active: CreationOptional<boolean>;
}

// TypeScript erlaubt das Weglassen von CreationOptional-Feldern
await Product.create({
  id: "prod-123",
  name: "Product Name"
  // stock und active sind optional
});
```

### Beziehungstypen

```typescript
import { HasMany, BelongsTo } from '@arcaelas/dynamite';

@Name("users")
class User extends Table<User> {
  @HasMany(() => Order, "user_id")
  declare orders: HasMany<Order>; // Array von Order

  @HasMany(() => Review, "user_id")
  declare reviews: HasMany<Review>;
}

@Name("orders")
class Order extends Table<Order> {
  @BelongsTo(() => User, "user_id")
  declare user: BelongsTo<User>; // User oder null
}
```

---

## Fehlerbehandlung

### Häufige Fehler

```typescript
// 1. Validierung fehlgeschlagen
try {
  await User.create({
    email: "invalid",
    name: "Test"
  });
} catch (error) {
  // ValidationError: Email inválido
}

// 2. Erforderliches Feld fehlt
try {
  await User.create({
    name: "Test"
    // email ist @NotNull und fehlt
  });
} catch (error) {
  // ValidationError: email ist erforderlich
}

// 3. Versuch zu löschen ohne ID
const user = new User({ email: "test@example.com", name: "Test" });
try {
  await user.destroy();
} catch (error) {
  // Error: destroy() erfordert, dass die Instanz eine ID hat
}

// 4. Ungültiger Operator
try {
  await User.where("age", "===", 25); // Ungültiger Operator
} catch (error) {
  // Error: Ungültiger Operator: ===
}
```

### Best Practices für Fehlerbehandlung

```typescript
async function safeCreateUser(data: InferAttributes<User>) {
  try {
    const user = await User.create(data);
    return { success: true, data: user };
  } catch (error) {
    console.error("Fehler beim Erstellen des Benutzers:", error);
    return { success: false, error: error.message };
  }
}

// Verwendung
const result = await safeCreateUser({
  email: "test@example.com",
  name: "Test User"
});

if (result.success) {
  console.log(`Benutzer erstellt: ${result.data.id}`);
} else {
  console.log(`Fehler: ${result.error}`);
}
```

---

## Leistung und Optimierung

### 1. Auswahl spezifischer Attribute

Reduziert die Datenübertragung durch Auswahl nur der notwendigen Felder:

```typescript
// ❌ Schlecht: Ruft alle Felder ab (enthält unnötig große Felder)
const users = await User.where({});

// ✅ Gut: Nur notwendige Felder
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});
```

### 2. Effektive Paginierung

```typescript
// ✅ Limit verwenden, um das Laden zu vieler Datensätze zu vermeiden
const users = await User.where({}, {
  limit: 20,
  skip: (page - 1) * 20
});
```

### 3. Selektive Einbeziehung von Beziehungen

```typescript
// ❌ Schlecht: Alle Beziehungen immer einbeziehen
const users = await User.where({}, {
  include: {
    orders: true,
    reviews: true,
    notifications: true
  }
});

// ✅ Gut: Nur notwendige Beziehungen mit Limits einbeziehen
const users = await User.where({}, {
  include: {
    orders: {
      limit: 5,
      order: "DESC"
    }
  }
});
```

### 4. Batch-Operationen

```typescript
// ✅ Mehrere Datensätze parallel erstellen
await Promise.all([
  User.create({ email: "user1@example.com", name: "User 1" }),
  User.create({ email: "user2@example.com", name: "User 2" }),
  User.create({ email: "user3@example.com", name: "User 3" })
]);
```

---

## Einschränkungen und Limitierungen

### 1. AND- vs. OR-Abfragen

- `where()` mit mehreren Feldern verwendet impliziten `AND`-Operator
- Keine native Unterstützung für `OR`-Operator in einem einzelnen `where()`
- Lösung: Mehrere Abfragen durchführen und Ergebnisse kombinieren

```typescript
// Unterstützt nur AND
const result = await User.where({
  role: "admin",
  active: true  // AND active = true
});

// Für OR mehrere Abfragen durchführen
const admins = await User.where({ role: "admin" });
const employees = await User.where({ role: "employee" });
const staff = [...admins, ...employees];
```

### 2. Tiefe von Beziehungen

- Verschachtelte Beziehungen können die Abfragezeit exponentiell erhöhen
- Empfehlung: Auf 3-4 Verschachtelungsebenen beschränken
- `limit` in verschachtelten Beziehungen verwenden

### 3. Scan vs. Query

- `where()` verwendet intern `ScanCommand` von DynamoDB
- Scans sind langsamer als Queries, aber flexibler
- Für bessere Leistung Indizes in DynamoDB in Betracht ziehen

---

## Migration und Kompatibilität

### Von anderen ORMs

**Sequelize:**

```typescript
// Sequelize
const users = await User.findAll({ where: { role: "admin" } });

// Dynamite
const users = await User.where({ role: "admin" });
```

**TypeORM:**

```typescript
// TypeORM
const users = await userRepository.find({ where: { role: "admin" } });

// Dynamite
const users = await User.where({ role: "admin" });
```

---

## Versions-Changelog

### v1.0.0
- ✅ Vollständige Implementierung von CRUD-Methoden
- ✅ Unterstützung für HasMany- und BelongsTo-Beziehungen
- ✅ Validierungs- und Mutationssystem
- ✅ Paginierung und Sortierung
- ✅ Auswahl spezifischer Attribute
- ✅ Einbeziehung verschachtelter Beziehungen
- ✅ Automatische Timestamps (createdAt/updatedAt)

---

## Quelldatei

**Speicherort:** `/tmp/dynamite/src/core/table.ts`
**Codezeilen:** 636 Zeilen
**Letzte Aktualisierung:** 2025-07-30

---

## Support und Beiträge

- **Vollständige Dokumentation:** [https://github.com/arcaelas/dynamite](https://github.com/arcaelas/dynamite)
- **Fehler melden:** [https://github.com/arcaelas/dynamite/issues](https://github.com/arcaelas/dynamite/issues)
- **Diskussionen:** [https://github.com/arcaelas/dynamite/discussions](https://github.com/arcaelas/dynamite/discussions)

---

**Hinweis:** Dieses Dokument wurde aus dem tatsächlichen Quellcode in `/tmp/dynamite/src/core/table.ts` generiert. Bei Unstimmigkeiten konsultieren Sie den Quellcode als Quelle der Wahrheit.
