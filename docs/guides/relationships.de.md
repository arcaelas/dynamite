# Beziehungsleitfaden

Dieser umfassende Leitfaden behandelt, wie man Beziehungen zwischen Modellen in Dynamite ORM definiert, lädt und abfragt. Beziehungen ermöglichen es, komplexe Daten zu strukturieren und effizient zwischen verwandten Entitäten zu navigieren.

## Inhaltsverzeichnis

- [Beziehungstypen](#beziehungstypen)
- [Eins-zu-Viele (@HasMany)](#eins-zu-viele-hasmany)
- [Viele-zu-Eins (@BelongsTo)](#viele-zu-eins-belongsto)
- [Beziehungen definieren](#beziehungen-definieren)
- [Beziehungen laden](#beziehungen-laden)
- [Abfragen mit Beziehungen](#abfragen-mit-beziehungen)
- [Beziehungsoptionen](#beziehungsoptionen)
- [Zirkuläre Abhängigkeiten](#zirkuläre-abhängigkeiten)
- [Leistungsüberlegungen](#leistungsüberlegungen)
- [Best Practices](#best-practices)

---

## Beziehungstypen

Dynamite unterstützt zwei Haupttypen von Beziehungen:

### 1. Eins-zu-Viele (@HasMany)

Ein Elternmodell kann mehrere verwandte Instanzen haben. Beispiel: Ein Benutzer hat viele Bestellungen.

```typescript
@HasMany(() => Order, "user_id")
declare orders: NonAttribute<HasMany<Order>>;
```

### 2. Viele-zu-Eins (@BelongsTo)

Ein Kindmodell gehört zu einem einzelnen Elternmodell. Beispiel: Eine Bestellung gehört zu einem Benutzer.

```typescript
@BelongsTo(() => User, "user_id")
declare user: NonAttribute<BelongsTo<User>>;
```

---

## Eins-zu-Viele (@HasMany)

Die Eins-zu-Viele-Beziehung ermöglicht es einem Elternmodell, mehrere verwandte Datensätze zu haben. Dies ist die häufigste Beziehung in Anwendungen.

### Grundbeispiel: Benutzer und Beiträge

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  BelongsTo,
  NotNull,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

// Benutzermodell (Eltern)
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Beziehung: Ein Benutzer hat viele Beiträge
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;

  // Beziehung: Ein Benutzer hat viele Kommentare
  @HasMany(() => Comment, "user_id")
  declare comments: NonAttribute<HasMany<Comment>>;
}

// Beitragsmodell (Kind)
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare title: string;

  @NotNull()
  declare content: string;

  @Default(() => "draft")
  declare status: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Inverse Beziehung: Ein Beitrag gehört zu einem Benutzer
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  // Beziehung: Ein Beitrag hat viele Kommentare
  @HasMany(() => Comment, "post_id")
  declare comments: NonAttribute<HasMany<Comment>>;
}
```

### HasMany verwenden

```typescript
// Benutzer mit Beiträgen erstellen
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
});

// Beiträge für den Benutzer erstellen
await Post.create({
  user_id: user.id,
  title: "Mein erster Beitrag",
  content: "Beitragsinhalt...",
  status: "published"
});

await Post.create({
  user_id: user.id,
  title: "Zweiter Beitrag",
  content: "Mehr Inhalt...",
  status: "draft"
});

// Benutzer mit seinen Beiträgen laden
const usersWithPosts = await User.where({ id: user.id }, {
  include: {
    posts: {}
  }
});

const userWithPosts = usersWithPosts[0];
console.log(`${userWithPosts.name} hat ${userWithPosts.posts.length} Beiträge`);

// Über die Beiträge iterieren
userWithPosts.posts.forEach(post => {
  console.log(`- ${post.title} (${post.status})`);
});
```

---

## Viele-zu-Eins (@BelongsTo)

Die Viele-zu-Eins-Beziehung ist die Umkehrung von Eins-zu-Viele. Sie definiert, dass ein Kindmodell zu einem einzelnen Elternmodell gehört.

### BelongsTo-Merkmale

1. **Erforderlicher Fremdschlüssel**: Das Kindmodell muss den Fremdschlüssel haben
2. **Gibt einzelne Instanz zurück**: Gibt eine Instanz oder null zurück
3. **Lazy Loading**: Wird nur geladen, wenn in `include` angegeben

### Grundbeispiel

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;

  @Default(() => "pending")
  declare status: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  // Beziehung: Eine Bestellung gehört zu einem Benutzer
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}

// Verwendung
const orders = await Order.where({}, {
  include: {
    user: {
      attributes: ["id", "name", "email"]
    }
  }
});

orders.forEach(order => {
  if (order.user) {
    console.log(`Bestellung ${order.id} von ${order.user.name}`);
  }
});
```

---

## Beziehungen laden

### include()-Methode

Die `include()`-Methode lädt Beziehungen zusammen mit dem Hauptmodell:

```typescript
// Eine einfache Beziehung laden
const users = await User.where({}, {
  include: {
    posts: {}
  }
});

// Mehrere Beziehungen laden
const users = await User.where({}, {
  include: {
    posts: {},
    comments: {}
  }
});
```

### Verschachtelte Beziehungen

Sie können Beziehungen innerhalb von Beziehungen laden:

```typescript
// 3 Ebenen Tiefe
const users = await User.where({}, {
  include: {
    posts: {
      include: {
        comments: {
          include: {
            user: {
              attributes: ["id", "name"]
            }
          }
        }
      }
    }
  }
});

// Zugriff auf verschachtelte Daten
users.forEach(user => {
  console.log(`Benutzer: ${user.name}`);

  user.posts?.forEach(post => {
    console.log(`  Beitrag: ${post.title}`);

    post.comments?.forEach(comment => {
      console.log(`    Kommentar von ${comment.user?.name}: ${comment.content}`);
    });
  });
});
```

---

## Zirkuläre Abhängigkeiten

Zirkuläre Abhängigkeiten treten auf, wenn sich zwei Modelle gegenseitig referenzieren. Dynamite behandelt sie mithilfe von Funktionen anstelle direkter Verweise.

### Lösung: Funktionen verwenden

```typescript
// KORREKT - Arrow-Funktionen verwenden
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // () => Post anstelle von Post direkt verwenden
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;
}

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  // () => User verwenden
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}
```

---

## Leistungsüberlegungen

### N+1-Abfrageproblem

Das N+1-Problem tritt auf, wenn Sie Datensätze laden und dann zusätzliche Abfragen für jeden durchführen:

```typescript
// SCHLECHT - N+1 Abfragen
const users = await User.where({});  // 1 Abfrage

for (const user of users) {
  // N zusätzliche Abfragen (eine für jeden Benutzer)
  const posts = await Post.where({ user_id: user.id });
  console.log(`${user.name}: ${posts.length} Beiträge`);
}
// Gesamt: 1 + N Abfragen
```

### Lösung: Eager Loading

Verwenden Sie `include`, um alle Beziehungen in einer einzigen Operation zu laden:

```typescript
// GUT - Eine einzige Operation
const users = await User.where({}, {
  include: {
    posts: {}
  }
});

users.forEach(user => {
  console.log(`${user.name}: ${user.posts?.length || 0} Beiträge`);
});
// Gesamt: Effiziente Operation mit include
```

---

## Best Practices

### 1. Immer Funktionen in Decorators verwenden

```typescript
// KORREKT
@HasMany(() => Order, "user_id")
@BelongsTo(() => User, "user_id")

// FALSCH
@HasMany(Order, "user_id")
@BelongsTo(User, "user_id")
```

### 2. Fremdschlüssel validieren

```typescript
class Order extends Table<Order> {
  // Immer validieren, dass der Fremdschlüssel nicht null ist
  @NotNull()
  @Validate((value) => typeof value === "string" && value.length > 0 || "user_id erforderlich")
  declare user_id: string;
}
```

### 3. NonAttribute für Beziehungen verwenden

```typescript
// KORREKT - Von DB-Operationen ausschließen
@HasMany(() => Post, "user_id")
declare posts: NonAttribute<HasMany<Post>>;

// FALSCH - Versucht in DB zu speichern
@HasMany(() => Post, "user_id")
declare posts: HasMany<Post>;
```

---

## Zusammenfassung

Beziehungen in Dynamite ermöglichen:

1. **Komplexe Daten strukturieren** mit Eins-zu-Viele und Viele-zu-Eins
2. **Zwischen Entitäten navigieren** mit verschachtelten includes
3. **Abfragen optimieren** mit Eager Loading
4. **Verwandte Daten filtern und begrenzen**
5. **Effiziente Aggregationen** mit berechneten Eigenschaften

**Wichtige Punkte:**
- `() =>` in Decorators verwenden, um zirkuläre Abhängigkeiten zu vermeiden
- `NonAttribute<>` auf Beziehungseigenschaften anwenden
- Eager Loading gegenüber mehreren Abfragen bevorzugen
- Tiefe und Menge geladener Daten begrenzen
- Fremdschlüssel mit `@NotNull()` und `@Validate()` validieren

Weitere Informationen finden Sie in der [API-Referenz](../api/table.md).
