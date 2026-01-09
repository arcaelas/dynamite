# Typen API-Referenz

Diese Anleitung dokumentiert alle TypeScript-Typen, die von Dynamite ORM exportiert werden.

## Inhaltsverzeichnis

- [Attribut-Markierungstypen](#attribut-markierungstypen)
  - [CreationOptional\<T\>](#creationoptionalt)
  - [NonAttribute\<T\>](#nonattributet)
- [Inferenz-Typen](#inferenz-typen)
  - [InferAttributes\<T\>](#inferattributest)
  - [InferRelations\<T\>](#inferrelationst)
  - [PickRelations\<T\>](#pickrelationst)
- [Eingabe-Typen](#eingabe-typen)
  - [CreateInput\<T\>](#createinputt)
  - [UpdateInput\<T\>](#updateinputt)
- [Abfrage-Typen](#abfrage-typen)
  - [QueryOperator](#queryoperator)
  - [WhereOptions\<T\>](#whereoptionst)

---

## Attribut-Markierungstypen

### CreationOptional\<T\>

Markiert ein Feld als optional während der Erstellung, aber vorhanden nach dem Speichern. Verwenden Sie dies für Felder mit Standardwerten, automatisch generierte oder automatisch berechnete Felder.

**Syntax:**
```typescript
declare field_name: CreationOptional<Type>;
```

**Merkmale:**
- Das Feld ist optional beim Aufruf von `Model.create()`
- Das Feld ist in der Instanz nach dem Speichern vorhanden
- Ideal für automatisch generierte IDs, Zeitstempel und Standardwerte

**Beispiele:**

```typescript
import { Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from '@arcaelas/dynamite';

class User extends Table<User> {
  // Automatisch generierter Primärschlüssel
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Pflichtfeld (ohne CreationOptional)
  declare email: string;

  // Feld mit Standardwert
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Automatisch gesetzte Zeitstempel
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Nur email ist während der Erstellung erforderlich
const user = await User.create({
  email: "john@example.com"
  // id, role, created_at, updated_at sind optional
});

// Nach der Erstellung sind alle Felder vorhanden
console.log(user.id);         // "550e8400-e29b-..."
console.log(user.role);       // "customer"
console.log(user.created_at); // "2025-01-15T10:30:00.000Z"
```

---

### NonAttribute\<T\>

Markiert ein Feld, das NICHT in der Datenbank gespeichert wird. Verwenden Sie dies für berechnete Eigenschaften, Beziehungen und virtuelle Getter.

**Syntax:**
```typescript
declare field_name: NonAttribute<Type>;
```

**Merkmale:**
- Das Feld wird von Datenbankoperationen ausgeschlossen
- Ideal für Beziehungen und berechnete Werte
- Erscheint nicht in `toJSON()`, es sei denn, es wird explizit hinzugefügt

**Beispiele:**

```typescript
import { Table, HasMany, BelongsTo, NonAttribute } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  // Beziehung - nicht in der Datenbank gespeichert
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;

  // Berechnete Eigenschaft
  declare display_name: NonAttribute<string>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;
}
```

---

## Inferenz-Typen

### InferAttributes\<T\>

Extrahiert nur die Datenbankattribute aus einem Modell, ohne Methoden, Beziehungen und Nicht-Attribut-Felder.

**Verwendung:**
```typescript
import type { InferAttributes } from '@arcaelas/dynamite';

type UserAttributes = InferAttributes<User>;
// Ergebnis:
// {
//   id?: string;            // CreationOptional wird optional
//   email: string;          // Erforderlich
//   name: string;           // Erforderlich
//   role?: string;          // CreationOptional wird optional
//   created_at?: string;    // CreationOptional wird optional
//   updated_at?: string;    // CreationOptional wird optional
// }
```

**Anwendungsfälle:**
- Type-sichere Funktionsparameter
- DTO (Data Transfer Object) Definitionen
- API-Antwort-Typen

**Beispiel:**

```typescript
import type { InferAttributes } from '@arcaelas/dynamite';

// Funktion mit type-sicherer Eingabe
async function updateUser(
  id: string,
  data: Partial<InferAttributes<User>>
): Promise<boolean> {
  const user = await User.first({ id });
  if (user) {
    return user.update(data);
  }
  return false;
}

// Verwendung
await updateUser("user-123", { name: "Neuer Name", role: "admin" });
```

---

### InferRelations\<T\>

Extrahiert nur die Beziehungsfelder aus einem Modell (mit `NonAttribute` markierte Felder).

**Verwendung:**
```typescript
import type { InferRelations } from '@arcaelas/dynamite';

type UserRelations = InferRelations<User>;
// Ergebnis:
// {
//   orders: Order[];        // HasMany wird zu Array
//   profile: Profile;       // HasOne wird zu Einzelwert
// }
```

**Beispiel:**

```typescript
import type { InferRelations } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<Post[]>;

  @HasOne(() => Profile, "user_id")
  declare profile: NonAttribute<Profile | null>;
}

// InferRelations<User> = { posts: Post[], profile: Profile | null }
```

---

### PickRelations\<T\>

Extrahiert nur Beziehungsfelder. Wird intern für Validierung verwendet.

**Verwendung:**
```typescript
import type { PickRelations } from '@arcaelas/dynamite';

type UserRelations = PickRelations<User>;
// { posts: Post[], profile: Profile | null }
```

---

## Eingabe-Typen

### CreateInput\<T\>

Typ für `Model.create()` Eingabe. Alias von `InferAttributes<T>`.

**Verwendung:**
```typescript
import type { CreateInput } from '@arcaelas/dynamite';

type UserCreateData = CreateInput<User>;
// { email: string; name: string; id?: string; role?: string; ... }

const data: CreateInput<User> = {
  email: "john@example.com",
  name: "John"
  // id, role, Zeitstempel sind optional
};

await User.create(data);
```

---

### UpdateInput\<T\>

Typ für `instance.update()` Eingabe. Alle Felder sind optional.

**Verwendung:**
```typescript
import type { UpdateInput } from '@arcaelas/dynamite';

type UserUpdateData = UpdateInput<User>;
// { email?: string; name?: string; role?: string; ... }

const data: UpdateInput<User> = {
  name: "Neuer Name"
  // Alle Felder sind optional
};

await user.update(data);
```

---

## Abfrage-Typen

### QueryOperator

Union-Typ aller unterstützten Abfrageoperatoren.

**Definition:**
```typescript
type QueryOperator =
  | "="      // Gleich
  | "$eq"   // Gleich (Alias)
  | "<>"    // Ungleich
  | "!="    // Ungleich (Alias)
  | "$ne"   // Ungleich (Alias)
  | "<"     // Kleiner als
  | "$lt"   // Kleiner als (Alias)
  | "<="    // Kleiner oder gleich
  | "$lte"  // Kleiner oder gleich (Alias)
  | ">"     // Größer als
  | "$gt"   // Größer als (Alias)
  | ">="    // Größer oder gleich
  | "$gte"  // Größer oder gleich (Alias)
  | "in"    // In Array
  | "$in"   // In Array (Alias)
  | "include"  // Enthält
  | "$include" // Enthält (Alias)
```

**Verwendung:**

```typescript
// Gleichheit
await User.where("role", "=", "admin");
await User.where("role", "$eq", "admin");

// Vergleich
await User.where("age", ">=", 18);
await User.where("age", "$gte", 18);
await User.where("balance", "<", 100);
await User.where("balance", "$lt", 100);

// Ungleich
await User.where("status", "!=", "banned");
await User.where("status", "<>", "banned");
await User.where("status", "$ne", "banned");

// Array-Zugehörigkeit
await User.where("status", "in", ["active", "pending"]);
await User.where("status", "$in", ["active", "pending"]);

// Enthält
await User.where("email", "include", "@gmail.com");
await User.where("email", "$include", "@gmail.com");
```

---

### WhereOptions\<T\>

Optionen zur Konfiguration des Abfrageverhaltens.

**Definition:**
```typescript
interface WhereOptions<T> {
  where?: {
    [K in keyof InferAttributes<T>]?:
      | InferAttributes<T>[K]
      | { [op in QueryOperator]?: InferAttributes<T>[K] };
  };
  order?: "ASC" | "DESC";
  skip?: number;              // Alias von offset
  offset?: number;            // Anzahl zu überspringender Datensätze
  limit?: number;             // Maximale Anzahl zurückzugebender Datensätze
  attributes?: (keyof InferAttributes<T>)[];  // Auszuwählende Felder
  include?: {                 // Einzubeziehende Beziehungen
    [relation: string]: boolean | WhereOptions<any>;
  };
  _includeTrashed?: boolean;  // Soft-gelöschte Datensätze einbeziehen
}
```

**Eigenschaften:**

| Eigenschaft | Typ | Beschreibung |
|-------------|-----|--------------|
| `where` | `object` | Filterbedingungen mit Operator-Unterstützung |
| `order` | `"ASC" \| "DESC"` | Sortierreihenfolge |
| `skip` | `number` | Anzahl zu überspringender Datensätze (Alias: offset) |
| `offset` | `number` | Anzahl zu überspringender Datensätze |
| `limit` | `number` | Maximale Anzahl zurückzugebender Datensätze |
| `attributes` | `string[]` | Spezifisch auszuwählende Felder |
| `include` | `object` | Einzubeziehende Beziehungen |
| `_includeTrashed` | `boolean` | Soft-gelöschte Datensätze einbeziehen |

**Beispiel:**

```typescript
const users = await User.where({ active: true }, {
  order: "DESC",
  skip: 20,
  limit: 10,
  attributes: ["id", "name", "email"],
  include: {
    orders: {
      where: { status: "completed" },
      limit: 5,
      order: "DESC",
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    }
  }
});
```

---

## Best Practices

### 1. Immer CreationOptional für Felder mit Standardwerten verwenden

```typescript
// Richtig
@Default(() => "active")
declare status: CreationOptional<string>;

// Falsch - TypeScript erfordert status in create()
@Default(() => "active")
declare status: string;
```

### 2. Beziehungen immer in NonAttribute einschließen

```typescript
// Richtig
@HasMany(() => Post, "user_id")
declare posts: NonAttribute<Post[]>;

// Falsch - posts würde als Datenbankspalte behandelt
@HasMany(() => Post, "user_id")
declare posts: Post[];
```

### 3. InferAttributes für type-sichere Funktionen verwenden

```typescript
// Richtig - type-sicherer Parameter
function processUser(data: InferAttributes<User>) { ... }

// Falsch - keine Typsicherheit
function processUser(data: any) { ... }
```

### 4. Foreign Keys explizit definieren

```typescript
// Richtig - Foreign Key ist deklariert
class Post extends Table<Post> {
  declare user_id: string; // FK-Feld

  @BelongsTo(() => User, "user_id")
  declare author: NonAttribute<User | null>;
}

// Falsch - Foreign Key nicht deklariert
class Post extends Table<Post> {
  @BelongsTo(() => User, "user_id")
  declare author: NonAttribute<User | null>;
}
```
