# Leitfaden für Best Practices

Dieser Leitfaden bietet produktionsreife Anleitung zum Erstellen skalierbarer, wartbarer Anwendungen mit Dynamite ORM.

## 1. Modelldesign

### Benennungskonventionen

Verwenden Sie klare, beschreibende Namen, die Ihre Domäne widerspiegeln:

```typescript
// ✅ Gut - Klare Entitätsnamen
@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  @Attribute()
  email!: string;
}

@Table({ name: 'order_items' })
class OrderItem extends Model {
  @PrimaryKey()
  item_id!: string;
}

// ❌ Vermeiden - Generische oder unklare Namen
@Table({ name: 'data' })
class Data extends Model { }
```

### Dateistruktur

Organisieren Sie Modelle nach Domänenkontext:

```
src/
├── models/
│   ├── user/
│   │   ├── user.model.ts
│   │   ├── user_profile.model.ts
│   │   └── user_preferences.model.ts
│   ├── order/
│   │   ├── order.model.ts
│   │   ├── order_item.model.ts
│   │   └── order_history.model.ts
│   └── index.ts
```

### Modellorganisation

Halten Sie Modelle fokussiert und kohäsiv:

```typescript
// ✅ Gut - Fokussiertes Modell mit verwandten Attributen
@Table({ name: 'products' })
class Product extends Model {
  @PrimaryKey()
  product_id!: string;

  @Attribute()
  name!: string;

  @Attribute()
  price!: number;

  @Attribute()
  category!: string;

  @Attribute()
  inventory_count!: number;

  @Attribute()
  created_at!: number;

  @Attribute()
  updated_at!: number;
}

// ❌ Vermeiden - Nicht verwandte Belange mischen
@Table({ name: 'products' })
class Product extends Model {
  @PrimaryKey()
  product_id!: string;

  @Attribute()
  name!: string;

  // Keine vollständigen Benutzerdaten in Produkt einbetten
  @Attribute()
  created_by_user!: {
    user_id: string;
    email: string;
    full_name: string;
    profile_image: string;
  };
}
```

## 2. Primärschlüsselstrategie

### UUID vs. Sequenzielle IDs

**UUIDs für verteilte Systeme verwenden:**

```typescript
import { v4 as uuid } from 'uuid';

@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  static async Create(data: CreateUserData): Promise<User> {
    const user = new User();
    user.user_id = uuid(); // Global eindeutig
    user.email = data.email;
    user.created_at = Date.now();
    await user.Save();
    return user;
  }
}

// ✅ Vorteile: Keine Koordination erforderlich, global eindeutig
// ❌ Nachteil: Kann nicht nach Erstellungszeit sortiert werden
```

**ULID für sortierbare IDs verwenden:**

```typescript
import { ulid } from 'ulid';

@Table({ name: 'events' })
class Event extends Model {
  @PrimaryKey()
  event_id!: string; // ULID ist lexikographisch sortierbar

  static async Create(data: CreateEventData): Promise<Event> {
    const event = new Event();
    event.event_id = ulid(); // Zeitstempelbasiert, sortierbar
    event.type = data.type;
    await event.Save();
    return event;
  }
}

// ✅ Vorteile: Nach Zeit sortierbar, global eindeutig
// ✅ Besser für Bereichsabfragen
```

## 3. Indexstrategie

### Global Secondary Indexes (GSI)

GSIs für alternative Abfragemuster erstellen:

```typescript
@Table({ name: 'orders' })
class Order extends Model {
  @PrimaryKey()
  order_id!: string;

  @Attribute()
  @Index({ name: 'user_orders_index', type: 'gsi' })
  user_id!: string;

  @Attribute()
  @Index({ name: 'user_orders_index', type: 'gsi', sort_key: true })
  created_at!: number;

  @Attribute()
  status!: 'pending' | 'completed' | 'cancelled';

  // ✅ Effiziente Abfrage mit GSI
  static async GetUserOrders(user_id: string, limit = 20): Promise<Order[]> {
    return Order.Query({
      user_id,
      index: 'user_orders_index',
      limit,
      scan_forward: false // Neueste zuerst
    });
  }
}
```

### Heiße Partitionen vermeiden

Schreibvorgänge auf Partitionen verteilen:

```typescript
// ❌ Vermeiden - Einzelne heiße Partition
@Table({ name: 'metrics' })
class Metric extends Model {
  @PrimaryKey()
  metric_type!: string; // Nur wenige Werte = heiße Partition

  @SortKey()
  timestamp!: number;
}

// ✅ Gut - Verteilte Schreibvorgänge
@Table({ name: 'metrics' })
class Metric extends Model {
  @PrimaryKey()
  partition_key!: string; // metric_type#shard_0-99

  @SortKey()
  timestamp!: number;

  static async Create(metric_type: string, data: MetricData): Promise<Metric> {
    const metric = new Metric();
    const shard = Math.floor(Math.random() * 100);
    metric.partition_key = `${metric_type}#${shard}`;
    metric.timestamp = Date.now();
    metric.value = data.value;
    await metric.Save();
    return metric;
  }
}
```

## 4. Abfrageoptimierung

### Effiziente Abfragen

Query statt Scan verwenden, wann immer möglich:

```typescript
// ✅ Effizient - Query mit Partition Key
const user_orders = await Order.Query({ user_id: 'user_123' });

// ✅ Effizient - Query mit Bereichsbedingung
const recent_orders = await Order.Query({
  user_id: 'user_123',
  created_at: { gte: Date.now() - 86400000 } // Letzte 24 Stunden
});

// ❌ Langsam - Gesamte Tabelle scannen
const pending_orders = await Order.Scan({ status: 'pending' });

// ✅ Besser - GSI für Statusabfragen
@Table({ name: 'orders' })
class Order extends Model {
  @Attribute()
  @Index({ name: 'status_index', type: 'gsi' })
  status!: string;
}

const pending_orders = await Order.Query({
  status: 'pending',
  index: 'status_index'
});
```

### Paginierung

Effiziente Paginierung implementieren:

```typescript
interface PaginatedResponse<T> {
  items: T[];
  next_token?: string;
  has_more: boolean;
}

class Order extends Model {
  static async GetUserOrdersPaginated(
    user_id: string,
    limit = 20,
    next_token?: string
  ): Promise<PaginatedResponse<Order>> {
    const result = await Order.Query({
      user_id,
      limit,
      exclusive_start_key: next_token ? JSON.parse(
        Buffer.from(next_token, 'base64').toString()
      ) : undefined
    });

    return {
      items: result,
      next_token: result.last_evaluated_key ? Buffer.from(
        JSON.stringify(result.last_evaluated_key)
      ).toString('base64') : undefined,
      has_more: !!result.last_evaluated_key
    };
  }
}
```

## 5. Validierungsstrategie

### Modellvalidierung

Validierung in Modellmethoden implementieren:

```typescript
@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  @Attribute()
  email!: string;

  @Attribute()
  age?: number;

  private static ValidateEmail(email: string): void {
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email_regex.test(email)) {
      throw new Error('Ungültiges E-Mail-Format');
    }
  }

  private static ValidateAge(age?: number): void {
    if (age !== undefined && (age < 0 || age > 150)) {
      throw new Error('Alter muss zwischen 0 und 150 liegen');
    }
  }

  static async Create(data: CreateUserData): Promise<User> {
    // Vor dem Speichern validieren
    this.ValidateEmail(data.email);
    this.ValidateAge(data.age);

    const user = new User();
    user.user_id = uuid();
    user.email = data.email;
    user.age = data.age;
    user.created_at = Date.now();

    await user.Save();
    return user;
  }
}
```

## 6. Fehlerbehandlung

### Try-Catch-Muster

Fehler elegant behandeln:

```typescript
class User extends Model {
  // ✅ Gut - Spezifische Fehlerbehandlung
  static async FindByEmail(email: string): Promise<User | null> {
    try {
      const results = await User.Query({
        email,
        index: 'email_index',
        limit: 1
      });
      return results[0] || null;
    } catch (error) {
      // Unerwartete Fehler protokollieren
      console.error('Fehler beim Suchen des Benutzers nach E-Mail:', error);
      throw new Error('Benutzer konnte nicht gefunden werden');
    }
  }
}
```

## 7. Testen

### Unit-Tests

Modelllogik isoliert testen:

```typescript
// user.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { User } from './user.model';

describe('User Model', () => {
  describe('Create', () => {
    it('sollte Benutzer mit gültigen Daten erstellen', async () => {
      const user = await User.Create({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(user.user_id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.created_at).toBeGreaterThan(0);
    });

    it('sollte Fehler bei ungültiger E-Mail werfen', async () => {
      await expect(
        User.Create({
          email: 'invalid-email',
          name: 'Test User'
        })
      ).rejects.toThrow('Ungültiges E-Mail-Format');
    });
  });
});
```

## 8. Typsicherheit

### TypeScript nutzen

TypeScript-Funktionen für Typsicherheit verwenden:

```typescript
// Strikte Typen definieren
interface CreateUserData {
  email: string;
  name: string;
  age?: number;
}

interface UpdateUserData {
  name?: string;
  age?: number;
}

// Branded Types für IDs verwenden
type UserId = string & { readonly brand: unique symbol };
type OrderId = string & { readonly brand: unique symbol };

@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: UserId;

  @Attribute()
  email!: string;

  @Attribute()
  name!: string;

  @Attribute()
  age?: number;

  // Typsichere Erstellung
  static async Create(data: CreateUserData): Promise<User> {
    const user = new User();
    user.user_id = uuid() as UserId;
    user.email = data.email;
    user.name = data.name;
    user.age = data.age;
    await user.Save();
    return user;
  }

  // Typsichere Aktualisierungen
  async Update(data: UpdateUserData): Promise<void> {
    if (data.name !== undefined) this.name = data.name;
    if (data.age !== undefined) this.age = data.age;
    await this.Save();
  }
}
```

## Zusammenfassung

Diese Best Practices helfen Ihnen, skalierbare, wartbare Anwendungen mit Dynamite ORM zu erstellen:

1. **Modelldesign**: Klare Benennung, nach Domäne organisieren, Modelle fokussiert halten
2. **Primärschlüssel**: Geeignete ID-Strategie wählen (UUID, ULID, zusammengesetzt)
3. **Indizes**: GSI/LSI für Abfragemuster erstellen, heiße Partitionen vermeiden
4. **Abfragen**: Query gegenüber Scan bevorzugen, Paginierung implementieren, Projektionen verwenden
5. **Validierung**: Auf Modellebene validieren, wiederverwendbare Validatoren erstellen
6. **Fehlerbehandlung**: Fehler elegant behandeln, Wiederholungen implementieren
7. **Testen**: Unit- und Integrationstests schreiben
8. **Typsicherheit**: TypeScript-Funktionen nutzen
