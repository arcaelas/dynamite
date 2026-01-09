# Beispiel für Beziehungen

Dieses umfassende Beispiel demonstriert, wie Sie Beziehungen in Dynamite ORM definieren und verwenden. Lernen Sie, wie Sie Eins-zu-Viele (HasMany) und Viele-zu-Eins (BelongsTo) Beziehungen erstellen, verschachtelte Includes durchführen, zugehörige Daten filtern und komplexe Datenstrukturen aufbauen.

## Inhaltsverzeichnis

- [Grundlagen von Beziehungen](#grundlagen-von-beziehungen)
- [Eins-zu-Viele (HasMany)](#eins-zu-viele-hasmany)
- [Viele-zu-Eins (BelongsTo)](#viele-zu-eins-belongsto)
- [Verschachtelte Beziehungen](#verschachtelte-beziehungen)
- [Gefilterte Beziehungen](#gefilterte-beziehungen)
- [Vollstandiges E-Commerce-Beispiel](#vollstandiges-e-commerce-beispiel)
- [Erwartete Ausgabe](#erwartete-ausgabe)
- [Erweiterte Muster](#erweiterte-muster)
- [Best Practices](#best-practices)

## Grundlagen von Beziehungen

Dynamite unterstützt zwei Arten von Beziehungen:

- **HasMany** - Eins-zu-Viele-Beziehung (Eltern hat mehrere Kinder)
- **BelongsTo** - Viele-zu-Eins-Beziehung (Kind gehört zu Eltern)

### Schlüsselkonzepte

```typescript
import { HasMany, BelongsTo, NonAttribute } from "@arcaelas/dynamite";

// Elternmodell (User hat viele Orders)
class User extends Table<User> {
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

// Kindmodell (Order gehört zu User)
class Order extends Table<Order> {
  declare user_id: string; // Fremdschlüssel

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;
}
```

**Wichtig:**
- Verwenden Sie den `NonAttribute<>` Wrapper für Beziehungsfelder (werden nicht in DB gespeichert)
- `HasMany<T>` löst sich zu `T[]` auf (Array von zugehörigen Datensätzen)
- `BelongsTo<T>` löst sich zu `T | null` auf (einzelner zugehöriger Datensatz oder null)
- Fremdschlüsselfeld muss im Kindmodell vorhanden sein

## Eins-zu-Viele (HasMany)

Definieren Sie eine Eins-zu-Viele-Beziehung, bei der ein Elternmodell mehrere zugehörige Kinder hat.

### Grundlegendes HasMany-Beispiel

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  HasMany,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

// User-Modell (Eltern)
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  // Eins-zu-Viele: User hat viele Posts
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<Post[]>;
}

// Post-Modell (Kind)
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string; // Fremdschlüssel
  declare title: string;
  declare content: string;
}
```

### HasMany-Beziehungen Laden

```typescript
// Benutzer mit ihren Posts laden
const users_with_posts = await User.where({}, {
  include: {
    posts: {}
  }
});

users_with_posts.forEach(user => {
  console.log(`${user.name} has ${user.posts.length} posts`);
  user.posts.forEach(post => {
    console.log(`  - ${post.title}`);
  });
});

// Spezifischen Benutzer mit Posts laden
const user = await User.first({ id: "user-123" });
if (user) {
  const user_with_posts = await User.where({ id: user.id }, {
    include: { posts: {} }
  });
  console.log(`Posts: ${user_with_posts[0].posts.length}`);
}
```

### Mehrere HasMany-Beziehungen

Ein Modell kann mehrere Eins-zu-Viele-Beziehungen haben:

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  // User hat viele Posts
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<Post[]>;

  // User hat viele Comments
  @HasMany(() => Comment, "user_id")
  declare comments: NonAttribute<Comment[]>;

  // User hat viele Orders
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

// Benutzer mit allen Beziehungen laden
const users = await User.where({ id: "user-123" }, {
  include: {
    posts: {},
    comments: {},
    orders: {}
  }
});

const user = users[0];
console.log(`Posts: ${user.posts.length}`);
console.log(`Comments: ${user.comments.length}`);
console.log(`Orders: ${user.orders.length}`);
```

## Viele-zu-Eins (BelongsTo)

Definieren Sie eine Viele-zu-Eins-Beziehung, bei der ein Kindmodell zu einem einzelnen Elternteil gehört.

### Grundlegendes BelongsTo-Beispiel

```typescript
// Post-Modell (Kind)
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string; // Fremdschlüssel
  declare title: string;
  declare content: string;

  // Viele-zu-Eins: Post gehört zu User
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;
}

// User-Modell (Eltern)
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;
}
```

### BelongsTo-Beziehungen Laden

```typescript
// Posts mit ihrem Autor laden
const posts_with_author = await Post.where({}, {
  include: {
    user: {}
  }
});

posts_with_author.forEach(post => {
  console.log(`${post.title} by ${post.user?.name || 'Unknown'}`);
});

// Spezifischen Post mit Autor laden
const post = await Post.first({ id: "post-123" });
if (post) {
  const post_with_author = await Post.where({ id: post.id }, {
    include: { user: {} }
  });
  console.log(`Author: ${post_with_author[0].user?.name}`);
}
```

## Verschachtelte Beziehungen

Laden Sie Beziehungen, die ihre eigenen Beziehungen haben (verschachtelte Includes).

### Zweistufige Verschachtelung

```typescript
// User hat viele Posts, Post hat viele Comments
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;
  declare name: string;

  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<Post[]>;
}

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;
  declare user_id: string;
  declare title: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;

  @HasMany(() => Comment, "post_id")
  declare comments: NonAttribute<Comment[]>;
}

class Comment extends Table<Comment> {
  @PrimaryKey()
  declare id: string;
  declare post_id: string;
  declare content: string;
}

// Benutzer mit Posts und Kommentaren laden
const users = await User.where({}, {
  include: {
    posts: {
      include: {
        comments: {}
      }
    }
  }
});

users.forEach(user => {
  console.log(`${user.name}:`);
  user.posts.forEach(post => {
    console.log(`  ${post.title} (${post.comments.length} comments)`);
    post.comments.forEach(comment => {
      console.log(`    - ${comment.content}`);
    });
  });
});
```

## Gefilterte Beziehungen

Filter, Limits und Sortierung auf zugehörige Daten anwenden.

### Zugehörige Datensätze Filtern

```typescript
// Benutzer nur mit veröffentlichten Posts laden
const users = await User.where({ id: "user-123" }, {
  include: {
    posts: {
      where: { status: "published" }
    }
  }
});

console.log(`Published posts: ${users[0].posts.length}`);
```

### Zugehörige Datensätze Begrenzen

```typescript
// Benutzer mit 5 neuesten Posts laden
const users = await User.where({ id: "user-123" }, {
  include: {
    posts: {
      limit: 5,
      order: "DESC"
    }
  }
});

console.log(`Recent posts: ${users[0].posts.length}`);
```

### Spezifische Attribute Auswählen

```typescript
// Posts nur mit Benutzername und E-Mail laden
const posts = await Post.where({}, {
  include: {
    user: {
      attributes: ["id", "name", "email"]
    }
  }
});

posts.forEach(post => {
  console.log(`${post.title} by ${post.user?.name} (${post.user?.email})`);
});
```

## Vollständiges E-Commerce-Beispiel

Hier ist ein vollständiges E-Commerce-System, das alle Beziehungsmuster demonstriert:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  HasMany,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  NonAttribute,
  Dynamite
} from "@arcaelas/dynamite";

// User-Modell
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Beziehungen
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

// Product-Modell
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare price: number;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Beziehungen
  @HasMany(() => OrderItem, "product_id")
  declare order_items: NonAttribute<OrderItem[]>;
}

// Order-Modell
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare total: number;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Beziehungen
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;

  @HasMany(() => OrderItem, "order_id")
  declare items: NonAttribute<OrderItem[]>;
}

// OrderItem-Modell
class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare order_id: string;
  declare product_id: string;
  declare quantity: number;
  declare price: number;

  // Beziehungen
  @BelongsTo(() => Order, "order_id")
  declare order: NonAttribute<Order | null>;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<Product | null>;
}

// DynamoDB konfigurieren und alle Tabellen registrieren
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User, Product, Order, OrderItem],
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Hauptanwendung
async function main() {
  // Verbindung herstellen und Tabellen synchronisieren
  await dynamite.connect();
  
  console.log("=== E-Commerce Relationships Example ===\n");

  // Benutzer erstellen
  const user1 = await User.create({
    name: "John Doe",
    email: "john@example.com"
  });

  // Produkte erstellen
  const product1 = await Product.create({
    name: "Laptop",
    price: 999.99
  });

  // Bestellung erstellen
  const order1 = await Order.create({
    user_id: user1.id,
    total: 999.99
  });

  // Bestellartikel erstellen
  await OrderItem.create({
    order_id: order1.id,
    product_id: product1.id,
    quantity: 1,
    price: 999.99
  });

  // Benutzer mit Bestellungen laden
  const users_with_orders = await User.where({ id: user1.id }, {
    include: {
      orders: {}
    }
  });
  console.log(`${users_with_orders[0].name} has ${users_with_orders[0].orders.length} order(s)`);

  // Bestellung mit Artikeln und Produkten laden
  const orders_with_items = await Order.where({ id: order1.id }, {
    include: {
      user: {},
      items: {
        include: {
          product: {}
        }
      }
    }
  });
  console.log(`Order ${orders_with_items[0].id} by ${orders_with_items[0].user?.name}`);

  console.log("=== All relationship operations completed ===");
}

// Anwendung ausführen
main().catch(console.error);
```

## Erwartete Ausgabe

```
=== E-Commerce Relationships Example ===

John Doe has 1 order(s)
Order 550e8400-... by John Doe

=== All relationship operations completed ===
```

## Erweiterte Muster

### Selbstreferenzielle Beziehungen

Modelle können Beziehungen zu sich selbst haben:

```typescript
class Category extends Table<Category> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare parent_id: string | null;

  // Category hat viele Kindkategorien
  @HasMany(() => Category, "parent_id")
  declare children: NonAttribute<Category[]>;

  // Category gehört zu Elternkategorie
  @BelongsTo(() => Category, "parent_id")
  declare parent: NonAttribute<Category | null>;
}
```

### Viele-zu-Viele-Beziehungen (über Verbindungstabelle)

Viele-zu-Viele mit Verbindungstabelle implementieren:

```typescript
// Student-Modell
class Student extends Table<Student> {
  @PrimaryKey()
  declare id: string;
  declare name: string;

  @HasMany(() => Enrollment, "student_id")
  declare enrollments: NonAttribute<Enrollment[]>;
}

// Course-Modell
class Course extends Table<Course> {
  @PrimaryKey()
  declare id: string;
  declare name: string;

  @HasMany(() => Enrollment, "course_id")
  declare enrollments: NonAttribute<Enrollment[]>;
}

// Verbindungstabelle
class Enrollment extends Table<Enrollment> {
  @PrimaryKey()
  declare id: string;

  declare student_id: string;
  declare course_id: string;
  declare grade: string;

  @BelongsTo(() => Student, "student_id")
  declare student: NonAttribute<Student | null>;

  @BelongsTo(() => Course, "course_id")
  declare course: NonAttribute<Course | null>;
}
```

## Best Practices

### 1. NonAttribute für Beziehungen Verwenden

```typescript
// Gut - als NonAttribute markiert
@HasMany(() => Order, "user_id")
declare orders: NonAttribute<Order[]>;

// Schlecht - wird versuchen, in Datenbank zu speichern
@HasMany(() => Order, "user_id")
declare orders: Order[];
```

### 2. Fremdschlüssel Explizit Definieren

```typescript
// Gut - expliziter Fremdschlüssel
class Order extends Table<Order> {
  declare user_id: string; // Fremdschlüsselfeld

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;
}
```

### 3. Pfeilfunktionen in Decorators Verwenden

```typescript
// Gut - Pfeilfunktion (vermeidet Zirkelbezug)
@HasMany(() => Order, "user_id")
declare orders: NonAttribute<Order[]>;
```

### 4. Beziehungen für Performance Filtern

```typescript
// Gut - nur laden, was benötigt wird
const users = await User.where({}, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 10,
      attributes: ["id", "total"]
    }
  }
});
```

### 5. N+1-Abfragen Vermeiden

```typescript
// Gut - Beziehungen in einer Abfrage laden
const posts = await Post.where({}, {
  include: {
    user: {},
    comments: {}
  }
});
```

## Nächste Schritte

### Verwandte Dokumentation

- [Beispiel für Grundlegendes Modell](./basic.de.md) - Einfache CRUD-Operationen
- [Beispiel für Fortgeschrittene Abfragen](./advanced.de.md) - Komplexe Abfragen und Paginierung

Viel Erfolg beim Programmieren mit Dynamite-Beziehungen!
