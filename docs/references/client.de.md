# Client-API-Referenz

## Überblick

`Dynamite` hält die Verbindung zu DynamoDB, die Liste der bedienten Modelle, die optionale Tabellensynchronisation und die Transaktionen.

## Klasse: Dynamite

### Konstruktor

```typescript
constructor(config: DynamiteConfig)
```

Erzeugt den Client. Er öffnet keine Verbindung und ruft keine AWS-API auf.

```typescript
import { Dynamite } from "@arcaelas/dynamite";

const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  tables: [User, Order, Product]
});
```

## Konfiguration

### `DynamiteConfig`

```typescript
interface DynamiteConfig extends DynamoDBClientConfig {
  tables: Array<new (...args: any[]) => any>;
}
```

| Eigenschaft | Typ | Pflicht | Beschreibung |
|-------------|-----|---------|--------------|
| `tables` | `Array<Class>` | Ja | Die Modellklassen, die dieser Client bedient |
| `region` | `string` | Nein | AWS-Region. Ohne Angabe aus der Umgebung aufgelöst |
| `endpoint` | `string` | Nein | Eigener Endpunkt, für DynamoDB Local |
| `credentials` | `AwsCredentialIdentity` | Nein | Explizite Zugangsdaten. Ohne Angabe aus der Umgebung aufgelöst |

Alles Weitere, was `DynamoDBClientConfig` akzeptiert — Credential-Provider, `maxAttempts`, `requestHandler`, eigene Endpunkte —, wird hier akzeptiert und unverändert an das AWS SDK gereicht.

## Instanzmethoden

### `connect()`

```typescript
async connect(): Promise<void>
```

Konfiguriert den Client und ermittelt, welche GSIs die Modelle erwarten. **Es wird keine AWS-API aufgerufen und nichts erstellt.**

**Verhalten:**

- Registriert den globalen Client, den jede `Table`-Operation verwendet
- Notiert allein aus den Schemas, welche GSIs jedes Modell erwartet: jede `@Index`-Spalte, die nicht der Primärschlüssel ist, und jeden Fremdschlüssel eines `@HasMany` oder `@HasOne`
- Idempotent: ein zweiter Aufruf tut nichts

```typescript
const dynamite = new Dynamite({ region: "us-east-1", tables: [User, Order] });
await dynamite.connect();

const user = await User.create({ name: "John" });
```

---

### `sync()`

```typescript
async sync(): Promise<void>
```

Erstellt in DynamoDB, was die Modelle deklarieren und das Konto noch nicht hat. Das ist der Entwicklungsweg.

**Verhalten:**

- Setzt `connect()` voraus, sonst wirft es `Call connect() before sync()`
- Beschreibt alle Tabellen und Pivot-Tabellen parallel
- Erstellt fehlende Tabellen mit Abrechnung `PAY_PER_REQUEST`, ihrem Partition Key, ihrem Sort Key wenn eine Spalte `@IndexSort` trägt, und ihren GSIs
- Erstellt die Pivot-Tabellen von `@ManyToMany` mit Schlüssel `id` und einem GSI je Seite
- Ergänzt fehlende GSIs an bestehenden Tabellen rundenweise und wartet, bis jede Runde `ACTIVE` ist, da DynamoDB pro Tabelle nur einen Index gleichzeitig aufbaut
- Idempotent: ein zweiter Aufruf tut nichts

```typescript
await dynamite.connect();
await dynamite.sync();
```

In der Produktion deklariert die Infrastruktur die Tabellen und Indizes mit denselben Namen —
`<feld>_index`, Partition Key auf `<feld>`, Projektion `ALL` — und `sync()` wird nicht aufgerufen.

---

### `tx()`

```typescript
async tx<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R>
```

Führt eine Menge von Mutationen atomar aus. Es wird nichts geschrieben, bis der Callback zurückkehrt; wirft er, wird keine Operation angewendet.

```typescript
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, { tx });
  await Order.create({ user_id: user.id, total: 100 }, { tx });
  await User.increment("orders_count", 1, { id: user.id }, { tx });
});
```

**Verhalten und Grenzen:**

- Jede Mutation erhält die Transaktion in ihrem Optionsobjekt: `{ tx }`
- Bis zu 100 Operationen, gesendet in Blöcken von 25
- `__isPersisted` und die `after*`-Hooks greifen nach dem Commit, nie davor
- Lesezugriffe im Callback sind gewöhnliche Lesezugriffe: sie sehen nicht, was die Transaktion in der Warteschlange hat

## Klasse: TransactionContext

Das Objekt, das `tx()` dem Callback übergibt. Man fasst es selten direkt an, das erledigen die Modelle.

### `addPut()`

```typescript
addPut(table_name: string, item: Record<string, any>, condition?: { expression: string; names: Record<string, string> }): void
```

Reiht einen Schreibvorgang ein. `create()` nutzt die Bedingung, um einen vorhandenen Primärschlüssel nicht zu überschreiben.

### `addDelete()`

```typescript
addDelete(table_name: string, key: Record<string, any>): void
```

Reiht einen Löschvorgang ein.

### `addUpdate()`

```typescript
addUpdate(table_name: string, key: Record<string, any>, expression: string, names: Record<string, string>, values: Record<string, any>): void
```

Reiht eine partielle Aktualisierung ein. `increment()` und `decrement()` nutzen sie.

### `onCommit()`

```typescript
onCommit(fn: () => void | Promise<void>): void
```

Registriert einen Callback, der nach einem erfolgreichen Commit läuft. Dort werden die Instanzen als persistiert markiert und dort laufen die `after*`-Hooks.

### `commit()`

```typescript
async commit(): Promise<void>
```

Sendet alles Eingereihte in Blöcken von 25 und führt danach die `onCommit`-Callbacks aus. `tx()` ruft es für dich auf.

## Hilfsfunktionen

### `setGlobalClient(client)`

Setzt den globalen DynamoDB-Client. `connect()` ruft sie auf.

### `getGlobalClient()`

Gibt den aktuellen Client zurück. Wirft, wenn keiner gesetzt ist.

### `hasGlobalClient()`

`true`, wenn ein Client konfiguriert ist.

### `requireClient()`

Gibt den aktuellen Client zurück oder wirft `DynamoDB client no configurado. Use Dynamite.connect() primero.` Das ruft jede Modelloperation auf.

## Konfigurationsbeispiele

### Lokale Entwicklung

```typescript
const dynamite = new Dynamite({
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  tables: [User, Order]
});

await dynamite.connect();
await dynamite.sync();
```

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

### Produktion auf AWS

```typescript
const dynamite = new Dynamite({
  region: process.env.AWS_REGION!,
  tables: [User, Order]
});

await dynamite.connect();
// kein sync(): Tabellen und Indizes gehören der Infrastruktur
```

## Vollständiges Beispiel

```typescript
import { Dynamite, Table, PrimaryKey, Index, HasMany, BelongsTo, NonAttribute, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare name: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Index()
  declare user_id: string;

  declare total: number;

  @BelongsTo(() => User, "id", "user_id")
  declare user: NonAttribute<User | null>;
}

async function main() {
  const dynamite = new Dynamite({
    region: "local",
    endpoint: "http://localhost:8000",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    tables: [User, Order]
  });

  await dynamite.connect();
  await dynamite.sync();

  await dynamite.tx(async (tx) => {
    const user = await User.create({ name: "John" }, { tx });
    await Order.create({ user_id: user.id, total: 99.99 }, { tx });
  });

  const users = await User.where({}, { include: { orders: true } });
  console.log(users[0].orders);
}

main();
```

## Siehe auch

- [Table-API-Referenz](./table.md)
- [Decorator-Referenz](./decorators.md)
