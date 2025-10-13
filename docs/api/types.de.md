# API-Referenz: Typen

Diese Anleitung dokumentiert alle TypeScript-Typen, die von Dynamite ORM exportiert werden und die Erstellung von Modellen mit vollständiger Type-Safety ermöglichen.

## Inhaltsverzeichnis

- [Attribut-Markierungstypen](#attribut-markierungstypen)
  - [CreationOptional\<T\>](#creationoptionalt)
  - [NonAttribute\<T\>](#nonattributet)
- [Inferenz-Typen](#inferenz-typen)
  - [InferAttributes\<T\>](#inferattributest)
  - [FilterableAttributes\<T\>](#filterableattributest)
- [Beziehungstypen](#beziehungstypen)
  - [HasMany\<T\>](#hasmanyt)
  - [BelongsTo\<T\>](#belongstot)
- [Abfrage-Typen](#abfrage-typen)
  - [QueryOperator](#queryoperator)
  - [QueryResult\<T, A, I\>](#queryresultt-a-i)
  - [WhereOptions\<T\>](#whereoptionst)
  - [WhereOptionsWithoutWhere\<T\>](#whereoptionswithoutwheret)

---

## Attribut-Markierungstypen

### CreationOptional\<T\>

Markiert ein Feld als optional während der Erstellung, aber vorhanden nach dem Speichern. Verwenden Sie dies für Felder mit Standardwerten, automatisch generierte oder automatisch berechnete Felder.

**Syntax:**
```typescript
declare field_name: CreationOptional<Type>;
```

**Merkmale:**
- Feld ist optional beim Aufruf von `Model.create()`
- Feld ist in der Instanz nach dem Speichern vorhanden
- Ideal für automatisch generierte IDs, Zeitstempel und Standardwerte

**Beispiele:**

```typescript
import { Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from '@arcaelas/dynamite';

class User extends Table<User> {
  // Automatisch generierte ID - IMMER CreationOptional verwenden
  @PrimaryKey()
  declare id: CreationOptional<string>;

  // Erforderliches Feld während der Erstellung
  @NotNull()
  declare email: string;

  // Feld mit Standardwert - CreationOptional verwenden
  @Default(() => 'customer')
  declare role: CreationOptional<string>;

  // Boolean mit Standardwert - CreationOptional verwenden
  @Default(() => true)
  declare active: CreationOptional<boolean>;

  // Numerisch mit Standardwert - CreationOptional verwenden
  @Default(() => 0)
  declare balance: CreationOptional<number>;

  // Automatisch generierte Zeitstempel - IMMER CreationOptional verwenden
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;
}

// Während der Erstellung: nur erforderliche Felder
const user = await User.create({
  email: 'user@test.com'
  // id, role, active, balance, createdAt, updatedAt sind optional
});

// Nach dem Speichern: alle Felder sind vorhanden
console.log(user.id);        // string (automatisch generiert)
console.log(user.role);      // 'customer' (Standardwert)
console.log(user.active);    // true (Standardwert)
console.log(user.balance);   // 0 (Standardwert)
console.log(user.createdAt); // string (automatisch generierter Zeitstempel)
console.log(user.updatedAt); // string (automatisch generierter Zeitstempel)
```

**Verwendungsregel:**

Verwenden Sie `CreationOptional<T>` für:
1. Felder mit Decorator `@PrimaryKey()` (automatisch generierte IDs)
2. Felder mit Decorator `@Default()` (Standardwerte)
3. Felder mit Decorator `@CreatedAt()` oder `@UpdatedAt()` (Zeitstempel)
4. Alle automatisch vom System berechneten Felder

---

### NonAttribute\<T\>

Markiert ein Feld als nicht persistent in der Datenbank. Verwenden Sie dies für berechnete Eigenschaften, Getter, Methoden oder temporäre Daten.

**Syntax:**
```typescript
declare field_name: NonAttribute<Type>;
```

**Merkmale:**
- Feld wird NICHT in DynamoDB gespeichert
- Feld wird NICHT in Abfragen einbezogen
- Ideal für berechnete Eigenschaften, Getter und Instanzmethoden
- Wird automatisch von `InferAttributes<T>` ausgeschlossen

**Beispiele:**

```typescript
import { Table, PrimaryKey, NotNull, NonAttribute } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare first_name: string;

  @NotNull()
  declare last_name: string;

  @NotNull()
  declare birth_date: string;

  // Berechnete Eigenschaft - wird NICHT persistiert
  declare full_name: NonAttribute<string>;

  // Berechnete Eigenschaft - wird NICHT persistiert
  declare age: NonAttribute<number>;

  // Instanzmethode - wird NICHT persistiert
  declare get_display_name: NonAttribute<() => string>;

  constructor(data: any) {
    super(data);

    // Berechnete Eigenschaften berechnen
    this.full_name = `${this.first_name} ${this.last_name}`;

    const birth = new Date(this.birth_date);
    const today = new Date();
    this.age = today.getFullYear() - birth.getFullYear();

    // Instanzmethode definieren
    this.get_display_name = () => {
      return `${this.full_name} (${this.age} Jahre)`;
    };
  }
}

const user = await User.create({
  id: 'user-1',
  first_name: 'Juan',
  last_name: 'Pérez',
  birth_date: '1990-05-15'
});

// Berechnete Eigenschaften verfügbar
console.log(user.full_name);           // 'Juan Pérez'
console.log(user.age);                 // 34
console.log(user.get_display_name());  // 'Juan Pérez (34 Jahre)'

// Aber sie werden NICHT in der Datenbank gespeichert
// Nur persistiert werden: id, first_name, last_name, birth_date
```

**Anwendungsfälle:**

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare price: number;

  @Default(() => 0)
  declare discount: CreationOptional<number>;

  // Berechneter Endpreis - NonAttribute
  declare final_price: NonAttribute<number>;

  // Indikator ob im Angebot - NonAttribute
  declare is_on_sale: NonAttribute<boolean>;

  // Methode zum Anwenden von Rabatten - NonAttribute
  declare apply_discount: NonAttribute<(additional: number) => number>;

  constructor(data: any) {
    super(data);

    this.final_price = this.price * (1 - (this.discount ?? 0) / 100);
    this.is_on_sale = (this.discount ?? 0) > 0;

    this.apply_discount = (additional: number) => {
      const total_discount = (this.discount ?? 0) + additional;
      return this.price * (1 - total_discount / 100);
    };
  }
}

const product = await Product.create({
  id: 'prod-1',
  name: 'Laptop',
  price: 1000,
  discount: 10
});

console.log(product.final_price);        // 900 (berechnet)
console.log(product.is_on_sale);         // true (berechnet)
console.log(product.apply_discount(5));  // 850 (Methode)
```

---

## Inferenz-Typen

### InferAttributes\<T\>

Leitet automatisch die persistenten Attribute eines Modells ab und schließt Beziehungen, Methoden und `NonAttribute`-Felder aus.

**Syntax:**
```typescript
type ModelAttributes = InferAttributes<ModelClass>;
```

**Merkmale:**
- Schließt automatisch Beziehungen aus (`HasMany`, `BelongsTo`)
- Schließt automatisch `NonAttribute`-Felder aus
- Schließt automatisch Methoden aus
- Enthält nur Felder, die in DynamoDB persistiert werden
- Wird intern von `where()`, `create()`, `update()` verwendet

**Beispiele:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany, BelongsTo, NonAttribute, InferAttributes } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  @Default(() => 'customer')
  declare role: CreationOptional<string>;

  // Beziehung - ist KEIN persistentes Attribut
  @HasMany(() => Order, 'user_id')
  declare orders: any;

  // Berechnetes Feld - ist KEIN persistentes Attribut
  declare display_name: NonAttribute<string>;
}

// InferAttributes schließt 'orders' und 'display_name' aus
type UserAttributes = InferAttributes<User>;
// Entspricht:
// {
//   id: string;
//   email: string;
//   name: string;
//   role: string | undefined;
// }

// Verwendung in Abfragen
const users = await User.where({
  role: 'customer',
  // orders: {} // ❌ Fehler: 'orders' ist kein filterbares Attribut
  // display_name: 'X' // ❌ Fehler: 'display_name' ist kein filterbares Attribut
});

// Verwendung in Updates
await User.update(
  {
    name: 'Neuer Name',
    // orders: [] // ❌ Fehler: Beziehung kann nicht aktualisiert werden
    // display_name: 'X' // ❌ Fehler: NonAttribute kann nicht aktualisiert werden
  },
  { id: 'user-1' }
);
```

**Interne Verwendung:**

```typescript
// Dynamite verwendet InferAttributes intern
class Table<T> {
  // Konstruktor akzeptiert nur persistente Attribute
  constructor(data: InferAttributes<T>) { }

  // where() akzeptiert nur persistente Attribute als Filter
  static async where<M extends Table>(
    this: { new (data: InferAttributes<M>): M },
    filters: Partial<InferAttributes<M>>
  ): Promise<M[]> { }

  // update() erlaubt nur die Aktualisierung persistenter Attribute
  static async update<M extends Table>(
    this: { new (data: InferAttributes<M>): M },
    updates: Partial<InferAttributes<M>>,
    filters: Partial<InferAttributes<M>>
  ): Promise<number> { }
}
```

---

### FilterableAttributes\<T\>

Alias von `InferAttributes<T>`, der Attribute darstellt, die in Abfragefiltern verwendet werden können.

**Syntax:**
```typescript
type Filterable = FilterableAttributes<ModelClass>;
```

**Merkmale:**
- Ist äquivalent zu `InferAttributes<T>`
- Wird in `WhereOptions<T>` zur Validierung von Filtern verwendet
- Semantischer bei Verwendung im Kontext von Abfragen

**Beispiele:**

```typescript
import { Table, PrimaryKey, NotNull, FilterableAttributes } from '@arcaelas/dynamite';

class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare price: number;

  @Default(() => 0)
  declare stock: CreationOptional<number>;

  @HasMany(() => Review, 'product_id')
  declare reviews: any;
}

// FilterableAttributes enthält nur persistente Felder
type ProductFilters = FilterableAttributes<Product>;
// Entspricht:
// {
//   id: string;
//   name: string;
//   price: number;
//   stock: number | undefined;
// }

// Verwendung in Abfragen mit Type-Safety
const filters: Partial<ProductFilters> = {
  price: 100,
  stock: 50,
  // reviews: [] // ❌ Fehler: 'reviews' ist nicht filterbar
};

const products = await Product.where(filters);
```

---

## Beziehungstypen

### HasMany\<T\>

Repräsentiert eine Eins-zu-Viele-Beziehung, bei der das aktuelle Modell mehrere Instanzen des verknüpften Modells hat.

**Syntax:**
```typescript
@HasMany(() => RelatedModel, 'foreign_key')
declare relation_name: any;
```

**Merkmale:**
- Gibt Array von Instanzen des verknüpften Modells zurück
- Wird über die Option `include` in Abfragen geladen
- Unterstützt Filter, Limits und Sortierung in der Beziehung
- Implementiert automatisches Lazy Loading

**Grundlegende Beispiele:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  // Ein Benutzer hat viele Bestellungen
  @HasMany(() => Order, 'user_id')
  declare orders: any;

  // Ein Benutzer hat viele Bewertungen
  @HasMany(() => Review, 'user_id')
  declare reviews: any;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;

  // Eine Bestellung hat viele Artikel
  @HasMany(() => OrderItem, 'order_id')
  declare items: any;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare order_id: string;

  @NotNull()
  declare product_id: string;

  @NotNull()
  declare quantity: number;
}

class Review extends Table<Review> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare product_id: string;

  @NotNull()
  declare rating: number;
}
```

**Verwendungsbeispiele:**

```typescript
// 1. Einfaches Include
const users = await User.where({}, {
  include: {
    orders: {}
  }
});

users.forEach(user => {
  console.log(user.name);
  console.log(user.orders); // Array von Order[]
});

// 2. Include mit Filtern
const users_with_pending = await User.where({}, {
  include: {
    orders: {
      where: { status: 'pending' },
      limit: 10,
      order: 'DESC'
    }
  }
});

// 3. Include mit mehreren Beziehungen
const users_full = await User.where({ id: 'user-1' }, {
  include: {
    orders: {
      include: {
        items: {} // Verschachtelte Beziehung
      }
    },
    reviews: {
      where: { rating: 5 }
    }
  }
});

console.log(users_full[0].orders);        // Order[]
console.log(users_full[0].orders[0].items); // OrderItem[]
console.log(users_full[0].reviews);       // Review[]

// 4. Include mit selektiven Attributen
const users_minimal = await User.where({}, {
  attributes: ['id', 'name'],
  include: {
    orders: {
      attributes: ['id', 'total', 'status']
    }
  }
});
```

**HasMany-Beziehungsoptionen:**

```typescript
interface IncludeOptions {
  where?: Record<string, any>;    // Filter für die Beziehung
  attributes?: string[];          // Auszuwählende Felder
  limit?: number;                 // Limit der Ergebnisse
  skip?: number;                  // Offset für Paginierung
  order?: 'ASC' | 'DESC';         // Sortierung
  include?: Record<string, any>;  // Verschachtelte Beziehungen
}
```

---

### BelongsTo\<T\>

Repräsentiert eine Viele-zu-Eins-Beziehung, bei der das aktuelle Modell zu einer Instanz des verknüpften Modells gehört.

**Syntax:**
```typescript
@BelongsTo(() => RelatedModel, 'local_key')
declare relation_name: any;
```

**Merkmale:**
- Gibt eine Instanz des verknüpften Modells oder `null` zurück
- Wird über die Option `include` in Abfragen geladen
- Verwendet den lokalen Schlüssel (Foreign Key), um den verknüpften Datensatz zu finden
- Unterstützt verschachtelte Beziehungen

**Grundlegende Beispiele:**

```typescript
import { Table, PrimaryKey, NotNull, BelongsTo } from '@arcaelas/dynamite';

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;

  // Eine Bestellung gehört zu einem Benutzer
  @BelongsTo(() => User, 'user_id')
  declare user: any;
}

class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare category_id: string;

  @NotNull()
  declare name: string;

  // Ein Produkt gehört zu einer Kategorie
  @BelongsTo(() => Category, 'category_id')
  declare category: any;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare order_id: string;

  @NotNull()
  declare product_id: string;

  // Ein Artikel gehört zu einer Bestellung
  @BelongsTo(() => Order, 'order_id')
  declare order: any;

  // Ein Artikel gehört zu einem Produkt
  @BelongsTo(() => Product, 'product_id')
  declare product: any;
}

class Category extends Table<Category> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;
}
```

**Verwendungsbeispiele:**

```typescript
// 1. Einfaches Include
const orders = await Order.where({}, {
  include: {
    user: {}
  }
});

orders.forEach(order => {
  console.log(order.total);
  console.log(order.user.name); // User | null
});

// 2. Include mit verschachtelten Beziehungen
const products = await Product.where({}, {
  include: {
    category: {}
  }
});

products.forEach(product => {
  console.log(product.name);
  if (product.category) {
    console.log(product.category.name);
  }
});

// 3. Include mit mehreren BelongsTo
const items = await OrderItem.where({}, {
  include: {
    order: {
      include: {
        user: {} // Verschachtelte Beziehung
      }
    },
    product: {
      include: {
        category: {} // Verschachtelte Beziehung
      }
    }
  }
});

items.forEach(item => {
  console.log(item.order.user.name);      // Benutzer der Bestellung
  console.log(item.product.category.name); // Kategorie des Produkts
});

// 4. Include mit Filtern in übergeordneter Beziehung
const recent_orders = await Order.where(
  { status: 'delivered' },
  {
    include: {
      user: {
        where: { active: true }
      }
    }
  }
);
```

**Umgang mit Nullwerten:**

```typescript
const products = await Product.where({}, {
  include: {
    category: {}
  }
});

products.forEach(product => {
  // BelongsTo kann null zurückgeben, wenn die Beziehung nicht existiert
  if (product.category) {
    console.log(product.category.name);
  } else {
    console.log('Produkt ohne Kategorie');
  }
});
```

---

## Abfrage-Typen

### QueryOperator

Verfügbare Operatoren für Filter in where-Abfragen.

**Syntax:**
```typescript
type QueryOperator =
  | '='           // Gleich
  | '!='          // Ungleich
  | '<'           // Kleiner als
  | '<='          // Kleiner oder gleich
  | '>'           // Größer als
  | '>='          // Größer oder gleich
  | 'in'          // In Array
  | 'not-in'      // Nicht in Array
  | 'contains'    // Enthält (Strings)
  | 'begins-with' // Beginnt mit (Strings)
```

**Beispiele:**

```typescript
import { Table, PrimaryKey, NotNull } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare age: number;

  @NotNull()
  declare role: string;

  @Default(() => true)
  declare active: CreationOptional<boolean>;
}

// Operator '=' (implizit)
const admins = await User.where('role', 'admin');
const admins2 = await User.where('role', '=', 'admin');

// Operator '!='
const non_admins = await User.where('role', '!=', 'admin');

// Numerische Operatoren
const adults = await User.where('age', '>=', 18);
const young = await User.where('age', '<', 30);
const specific_age = await User.where('age', '>', 25);
const age_limit = await User.where('age', '<=', 65);

// Operator 'in'
const staff = await User.where('role', 'in', ['admin', 'employee']);
const staff2 = await User.where('role', ['admin', 'employee']); // Abkürzung

// Operator 'not-in'
const customers = await User.where('role', 'not-in', ['admin', 'employee']);

// Operator 'contains' (Strings)
const gmail_users = await User.where('email', 'contains', '@gmail.com');
const name_with_a = await User.where('name', 'contains', 'a');

// Operator 'begins-with' (Strings)
const admins_by_email = await User.where('email', 'begins-with', 'admin@');
const a_names = await User.where('name', 'begins-with', 'A');
```

**Kombination von Operatoren:**

```typescript
// Mehrere Bedingungen mit Objekt
const active_admins = await User.where({
  role: 'admin',
  active: true
});

// Operatoren in Kette
const young_admins = await User.where('age', '<', 30);
const active_young_admins = young_admins.filter(u => u.active);

// Operatoren mit Optionen
const paginated = await User.where(
  'age',
  '>=',
  18,
  {
    limit: 10,
    skip: 20,
    order: 'DESC'
  }
);
```

---

### QueryResult\<T, A, I\>

Typ des Ergebnisses einer Abfrage mit Includes und Attributauswahl.

**Syntax:**
```typescript
type Result = QueryResult<Model, Attributes, Includes>;
```

**Parameter:**
- `T`: Modellklasse
- `A`: Ausgewählte Attribute (Keys von T)
- `I`: Eingeschlossene Beziehungen (Include-Konfigurationsobjekt)

**Merkmale:**
- Leitet automatisch den Rückgabetyp basierend auf Includes ab
- Vollständige Type-Safety für eingeschlossene Beziehungen
- Unterstützt partielle Attributauswahl

**Beispiele:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany, BelongsTo, QueryResult } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @HasMany(() => Order, 'user_id')
  declare orders: any;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;

  @BelongsTo(() => User, 'user_id')
  declare user: any;

  @HasMany(() => OrderItem, 'order_id')
  declare items: any;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare order_id: string;

  @NotNull()
  declare quantity: number;
}

// Beispiel 1: Ohne Includes
const users1 = await User.where({});
// Typ: User[]

// Beispiel 2: Mit einfachem Include
const users2 = await User.where({}, {
  include: {
    orders: {}
  }
});
// Inferierter Typ:
// (User & { orders: Order[] })[]

// Beispiel 3: Mit Attributauswahl
const users3 = await User.where({}, {
  attributes: ['id', 'name']
});
// Inferierter Typ:
// Pick<User, 'id' | 'name'>[]

// Beispiel 4: Mit verschachtelten Includes
const users4 = await User.where({}, {
  include: {
    orders: {
      include: {
        items: {}
      }
    }
  }
});
// Inferierter Typ:
// (User & {
//   orders: (Order & {
//     items: OrderItem[]
//   })[]
// })[]

// Verwendung mit Type-Safety
users4.forEach(user => {
  console.log(user.name);      // ✓ Type-safe
  console.log(user.orders);    // ✓ Order[]
  user.orders.forEach(order => {
    console.log(order.items);  // ✓ OrderItem[]
  });
});
```

---

### WhereOptions\<T\>

Vollständige Optionen für where-Abfragen, einschließlich Filter, Paginierung, Sortierung und Includes.

**Syntax:**
```typescript
interface WhereOptions<T> {
  where?: Partial<FilterableAttributes<T>>;
  skip?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  attributes?: (keyof FilterableAttributes<T>)[];
  include?: {
    [K in keyof T]?: T[K] extends HasMany<any> | BelongsTo<any>
      ? IncludeOptions | {}
      : never;
  };
}
```

**Eigenschaften:**

| Eigenschaft | Typ | Beschreibung |
|-------------|-----|--------------|
| `where` | `Partial<FilterableAttributes<T>>` | Filter für die Abfrage |
| `skip` | `number` | Offset für Paginierung |
| `limit` | `number` | Limit der Ergebnisse |
| `order` | `'ASC' \| 'DESC'` | Sortierung nach Primärschlüssel |
| `attributes` | `(keyof FilterableAttributes<T>)[]` | Auszuwählende Felder |
| `include` | `object` | Einzuschließende Beziehungen |

**Beispiele:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany, WhereOptions } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare age: number;

  @Default(() => 'customer')
  declare role: CreationOptional<string>;

  @HasMany(() => Order, 'user_id')
  declare orders: any;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;
}

// Beispiel 1: Nur Filter
const options1: WhereOptions<User> = {
  where: {
    role: 'admin',
    age: 30
  }
};
const admins = await User.where({}, options1);

// Beispiel 2: Mit Paginierung
const options2: WhereOptions<User> = {
  where: {
    role: 'customer'
  },
  limit: 10,
  skip: 20,
  order: 'DESC'
};
const customers = await User.where({}, options2);

// Beispiel 3: Mit Attributauswahl
const options3: WhereOptions<User> = {
  where: {
    age: 25
  },
  attributes: ['id', 'name', 'email']
};
const users = await User.where({}, options3);

// Beispiel 4: Mit Includes
const options4: WhereOptions<User> = {
  where: {
    role: 'customer'
  },
  include: {
    orders: {
      where: { total: 100 },
      limit: 5,
      order: 'DESC'
    }
  }
};
const customers_with_orders = await User.where({}, options4);

// Beispiel 5: Vollständig
const options5: WhereOptions<User> = {
  where: {
    role: 'customer',
    age: 30
  },
  attributes: ['id', 'name', 'email'],
  limit: 20,
  skip: 0,
  order: 'ASC',
  include: {
    orders: {
      attributes: ['id', 'total'],
      where: { total: 500 },
      limit: 10
    }
  }
};
const filtered = await User.where({}, options5);
```

**Verwendung mit Operatoren:**

```typescript
// where() akzeptiert Operatoren und Optionen
const users = await User.where(
  'age',
  '>=',
  18,
  {
    limit: 10,
    order: 'DESC',
    attributes: ['id', 'name'],
    include: {
      orders: {}
    }
  } as WhereOptions<User>
);
```

---

### WhereOptionsWithoutWhere\<T\>

Abfrageoptionen ohne das Feld `where`, nützlich wenn Filter als erstes Argument übergeben werden.

**Syntax:**
```typescript
type OptionsWithoutWhere<T> = Omit<WhereOptions<T>, 'where'>;
```

**Merkmale:**
- Ist `WhereOptions<T>` ohne die Eigenschaft `where`
- Wird verwendet, wenn Filter separat übergeben werden
- Semantischer in bestimmten Kontexten

**Beispiele:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany, WhereOptionsWithoutWhere } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @HasMany(() => Order, 'user_id')
  declare orders: any;
}

// Filter getrennt von Optionen
const filters = { role: 'admin' };

const options: WhereOptionsWithoutWhere<User> = {
  limit: 10,
  skip: 0,
  order: 'DESC',
  attributes: ['id', 'name'],
  include: {
    orders: {}
  }
};

const users = await User.where(filters, options);

// Auch nützlich in Hilfsfunktionen
async function find_paginated<T extends Table>(
  Model: { new (data: any): T },
  filters: Partial<InferAttributes<T>>,
  page: number,
  page_size: number
): Promise<T[]> {
  const options: WhereOptionsWithoutWhere<T> = {
    limit: page_size,
    skip: page * page_size,
    order: 'ASC'
  };

  return Model.where(filters, options);
}
```

---

## Häufige Muster

### Vollständiges Modell mit allen Typen

```typescript
import {
  Table,
  PrimaryKey,
  NotNull,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  BelongsTo,
  CreationOptional,
  NonAttribute,
  InferAttributes,
  FilterableAttributes
} from '@arcaelas/dynamite';

class User extends Table<User> {
  // Automatisch generierte ID - CreationOptional
  @PrimaryKey()
  declare id: CreationOptional<string>;

  // Erforderliche Felder - keine Markierung
  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  // Felder mit Standardwerten - CreationOptional
  @Default(() => 'customer')
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @Default(() => 0)
  declare balance: CreationOptional<number>;

  // Automatisch generierte Zeitstempel - CreationOptional
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Berechnete Eigenschaften - NonAttribute
  declare full_name: NonAttribute<string>;
  declare display_role: NonAttribute<string>;

  // Beziehungen - keine spezielle Markierung erforderlich
  @HasMany(() => Order, 'user_id')
  declare orders: any;

  @HasMany(() => Review, 'user_id')
  declare reviews: any;

  constructor(data: InferAttributes<User>) {
    super(data);

    this.full_name = `${this.name} <${this.email}>`;
    this.display_role = this.role === 'admin' ? 'Administrator' : 'Kunde';
  }
}

// Während der Erstellung: nur erforderliche Felder
const user = await User.create({
  email: 'user@test.com',
  name: 'Juan Pérez'
});

// Nach dem Speichern: alle Felder vorhanden
console.log(user.id);          // string (automatisch generiert)
console.log(user.role);        // 'customer' (Standard)
console.log(user.active);      // true (Standard)
console.log(user.balance);     // 0 (Standard)
console.log(user.createdAt);   // string (Zeitstempel)
console.log(user.full_name);   // 'Juan Pérez <user@test.com>' (berechnet)
console.log(user.display_role); // 'Kunde' (berechnet)
```

### Erweiterte Abfrage mit allen Typen

```typescript
import { WhereOptions, QueryOperator } from '@arcaelas/dynamite';

// Generische Hilfsfunktion mit Type-Safety
async function find_advanced<T extends Table>(
  Model: { new (data: InferAttributes<T>): T },
  field: keyof FilterableAttributes<T>,
  operator: QueryOperator,
  value: any,
  options?: WhereOptionsWithoutWhere<T>
): Promise<T[]> {
  return Model.where(field as string, operator, value, options);
}

// Verwendung mit vollständiger Inferenz
const admins = await find_advanced(
  User,
  'role',
  '=',
  'admin',
  {
    limit: 10,
    attributes: ['id', 'name', 'email'],
    include: {
      orders: {
        where: { status: 'delivered' },
        limit: 5
      }
    }
  }
);
```

---

## Zusammenfassung

| Typ | Zweck | Wann verwenden |
|-----|-------|----------------|
| `CreationOptional<T>` | Optionale Felder bei Erstellung | Automatisch generierte IDs, Standardwerte, Zeitstempel |
| `NonAttribute<T>` | Nicht persistente Felder | Berechnete Eigenschaften, Getter, Methoden |
| `InferAttributes<T>` | Persistente Attribute | Type-Safety in Abfragen und Updates |
| `FilterableAttributes<T>` | Filterbare Attribute | Type-Safety in where-Klauseln |
| `HasMany<T>` | Eins-zu-Viele-Beziehung | Wenn ein Modell mehrere verknüpfte Instanzen hat |
| `BelongsTo<T>` | Viele-zu-Eins-Beziehung | Wenn ein Modell zu einem anderen gehört |
| `QueryOperator` | Abfrageoperatoren | Erweiterte Filter in where |
| `QueryResult<T, A, I>` | Ergebnistyp | Typinferenz in Abfragen mit Includes |
| `WhereOptions<T>` | Abfrageoptionen | Vollständige Abfragen mit Filtern, Paginierung und Includes |
| `WhereOptionsWithoutWhere<T>` | Optionen ohne Filter | Abfragen, bei denen Filter separat übergeben werden |

---

## Best Practices

1. **Immer `CreationOptional<T>` verwenden für**:
   - Felder mit `@PrimaryKey()` (automatisch generiert)
   - Felder mit `@Default()` (Standardwerte)
   - Felder mit `@CreatedAt()` oder `@UpdatedAt()` (Zeitstempel)

2. **Immer `NonAttribute<T>` verwenden für**:
   - Im Konstruktor berechnete Eigenschaften
   - Getter, die von anderen Feldern abgeleitet werden
   - Instanzmethoden

3. **Beziehungen**:
   - `@HasMany` für Arrays von verknüpften Modellen verwenden
   - `@BelongsTo` für einzelne Referenzen auf verknüpfte Modelle verwenden
   - Keine zusätzlichen Typmarkierungen auf Beziehungen anwenden

4. **Type-Safety**:
   - `InferAttributes<T>` in generischen Funktionen verwenden
   - `FilterableAttributes<T>` zur Validierung von Filtern verwenden
   - `WhereOptions<T>` für vollständige Abfrageoptionen verwenden

5. **Performance**:
   - Nur notwendige Beziehungen mit `include` einschließen
   - `attributes` verwenden, um nur erforderliche Felder auszuwählen
   - `limit` und `skip` für Paginierung anwenden

---

Für weitere Informationen siehe:
- [Installationsanleitung](../installation.md)
- [Decorator-Referenz](./decorators.md)
- [Table-Referenz](./table.md)
