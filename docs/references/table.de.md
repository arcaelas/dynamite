# Table-API-Referenz

## Überblick

`Table` ist die Basisklasse aller Modelle. Sie liefert das typisierte CRUD, das Abfragesystem, das Laden der Beziehungen und den Lebenszyklus einer Instanz.

**Was sie bietet:**

- Strikte Typisierung, aus der Klasse selbst abgeleitet
- CRUD als statische Methoden und als Instanzmethoden
- Ein Abfragesystem, das `GetItem`, `BatchGetItem`, `Query` oder `Scan` anhand der Form des Filters wählt
- Beziehungen `HasMany`, `HasOne`, `BelongsTo` und `ManyToMany` mit Batch-Laden
- Automatische Zeitstempel und Soft Delete
- Cursor-Paginierung, Sortierung, Projektion und verschachtelte Includes

## Import

```typescript
import { Table } from '@arcaelas/dynamite';
```

## Modelldefinition

```typescript
import {
  Table, Name, PrimaryKey, NotNull, Default, Index,
  CreatedAt, UpdatedAt, DeleteAt, CreationOptional
} from '@arcaelas/dynamite';

@Name("users")
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Index()
  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  @Default(() => 25)
  declare age: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at: CreationOptional<string>;
}
```

---

## Konstruktor

### `constructor(data: Partial<InferAttributes<T>>)`

Erzeugt eine Instanz im Speicher. Es wird nichts nach DynamoDB geschrieben.

**Verhalten:**

- Führt die Schreib-Pipeline **aller** Spalten aus, nicht nur der in `data` vorhandenen. Deshalb sind `@Default`, `@PrimaryKey` und `@CreatedAt` schon beim Erzeugen gesetzt, und deshalb weist `@NotNull` ein fehlendes Feld genau dort zurück
- Setzt einen konfigurierten Client voraus: ohne `connect()` wirft der Konstruktor
- Die Instanz ist erst nach `save()` oder `create()` persistiert

```typescript
const user = new User({ email: "john@example.com", name: "John Doe" });

user.id;         // "01JBQ8..." — bereits erzeugt
user.created_at; // bereits erzeugt

await user.save(); // jetzt existiert der Datensatz in DynamoDB
```

---

## Mutations-Optionen

Jede Mutation nimmt dasselbe Optionsobjekt als letztes Argument:

```typescript
interface MutationOptions {
  hook?: boolean;          // führt die Lifecycle-Hooks aus; standardmäßig aus
  tx?: TransactionContext; // führt innerhalb einer atomaren Transaktion aus
}
```

- Hooks sind pro Aufruf opt-in: ohne `{ hook: true }` läuft keiner.
- In einer Transaktion wird nichts geschrieben, bis der Callback zurückkehrt. Die `after*`-Hooks und `__isPersisted` greifen erst nach dem Commit.
- `increment()` und `decrement()` akzeptieren `{ tx }`, lösen aber nie Hooks aus.

---

## Instanzmethoden

### `save(options?: MutationOptions): Promise<boolean>`

Schreibt das komplette Item.

**Verhalten:**

- Bei einer nie persistierten Instanz delegiert sie an `create()`, das einen vorhandenen Primärschlüssel nicht überschreibt
- Bei einer persistierten Instanz sendet sie ein `PutItem` mit allen Spalten, sodass jedes von Hand geänderte Feld geschrieben wird
- Ob eine Instanz persistiert ist, wird intern geführt und nicht aus der id abgeleitet: eine neue Instanz hat ihre id durch `@PrimaryKey` bereits gesetzt

**Rückgabe:** `true`

```typescript
const user = new User({ email: "jane@example.com", name: "Jane Smith" });
await user.save(); // Anlage

user.name = "Jane Doe";
await user.save(); // vollständiges Neuschreiben des Items
```

---

### `update(patch: Partial<InferAttributes<T>>, options?: MutationOptions): Promise<boolean>`

Aktualisiert nur die übergebenen Felder.

**Verhalten:**

- Beziehungsfelder in `patch` werden ignoriert statt zu werfen
- Die `@UpdatedAt`-Spalten werden erneuert, auch wenn sie nicht in `patch` stehen
- Ohne Hooks und außerhalb einer Transaktion ist es ein einziges `UpdateItem`, das nur die berührten Felder schreibt, unter der Bedingung, dass der Datensatz noch existiert. Existiert er nicht mehr, wird `false` zurückgegeben und nichts geschrieben
- Mit `{ hook: true }` werden die Änderungen angewendet, `beforeUpdate` ausgeführt, das Item geschrieben und `afterUpdate` ausgeführt. Beide Hooks erhalten das Änderungs-Delta

**Rückgabe:** `true`, wenn der Datensatz aktualisiert wurde

```typescript
await user.update({ name: "Jane Doe" });
await user.update({ name: "Jane Doe" }, { hook: true });
```

---

### `destroy(options?: MutationOptions): Promise<null>`

Löscht den Datensatz, sanft wenn das Modell es zulässt.

**Verhalten:**

- Mit einer `@DeleteAt`-Spalte wird dort der aktuelle Zeitstempel geschrieben und gespeichert: der Datensatz bleibt in der Tabelle und verschwindet aus `where()`
- Ohne `@DeleteAt` wird der Datensatz entfernt
- Wirft `Cannot destroy record without ID`, wenn die Instanz keinen Primärschlüssel hat

```typescript
await post.destroy();               // Soft Delete
await post.destroy({ hook: true }); // beforeDestroy + afterDestroy
```

---

### `forceDestroy(options?: MutationOptions): Promise<null>`

Entfernt den Datensatz mit einem `DeleteItem` und ignoriert `@DeleteAt`.

```typescript
await post.forceDestroy();
```

---

### `increment(feld, menge = 1): Promise<void>` / `decrement(feld, menge = 1): Promise<void>`

Addiert oder subtrahiert atomar auf dem Server, ohne den vorherigen Wert zu lesen, und spiegelt die Änderung im Speicher.

- Der Typ beschränkt `feld` auf die numerischen Spalten des Modells
- Wirft `Cannot increment without primary key`, wenn die Instanz keine id hat

```typescript
await user.increment("credits", 10);
await user.decrement("credits");
```

---

### `attach<R>(Modell, related_id, pivot_data?): Promise<void>`

Fügt eine Zeile in die Pivot-Tabelle einer `@ManyToMany`-Beziehung ein.

- Die Instanz muss persistiert sein, sonst wirft die Methode
- Sie ist idempotent, ein vorhandenes Paar bleibt unverändert
- `pivot_data` ergänzt zusätzliche Spalten in der Pivot-Zeile
- Die Suche läuft über den GSI `<fremdschlüssel>_index` der Pivot-Tabelle, nie über einen Scan

```typescript
await user.attach(Role, "role-123");
await user.attach(Role, "role-123", { granted_by: "admin" });
```

---

### `detach<R>(Modell, related_id): Promise<void>`

Entfernt die Pivot-Zeile dieses Paares. Fehlt die Beziehung, die Zeile oder der lokale Schlüssel, passiert nichts.

```typescript
await user.detach(Role, "role-123");
```

---

### `sync<R>(Modell, related_ids): Promise<void>`

Lässt die Beziehung genau `related_ids` enthalten: entfernt, was nicht auf der Liste steht, und ergänzt, was fehlt, in Blöcken von 25.

- Wirft, wenn das verwandte Modell kein Schema hat, wenn es keine `@ManyToMany`-Beziehung zwischen beiden Modellen gibt, oder wenn der lokale Schlüssel undefiniert ist

```typescript
await user.sync(Role, ["role-1", "role-2"]);
```

---

### `toJSON(): Record<string, unknown>`

Einfaches Objekt mit den Spalten des Modells. Lässt `null` und `undefined` aus und serialisiert geladene Beziehungen rekursiv.

### `toString(): string`

`JSON.stringify` der Instanz.

---

## Statische Methoden

### `create<M>(data, options?: MutationOptions): Promise<M>`

Legt einen Datensatz an.

- Schreibt mit `attribute_not_exists` auf den Primärschlüssel: überschreibt nie und wirft `Record with <schlüssel> '<wert>' already exists in <tabelle>`, wenn die id vergeben ist
- In einer Transaktion gilt die Instanz erst nach dem Commit als persistiert

```typescript
const user = await User.create({ name: "Juan", email: "juan@example.com" });
await User.create({ name: "Juan" }, { hook: true });
await dynamite.tx(async (tx) => { await User.create({ name: "Juan" }, { tx }); });
```

---

### `createMany<M>(zeilen, options?: MutationOptions): Promise<M[]>`

Legt mehrere Datensätze mit `BatchWriteItem` an, 25 pro Anfrage, und wiederholt, was DynamoDB unverarbeitet zurückgibt.

- Doppelte Primärschlüssel lassen sich nicht prüfen, `BatchWriteItem` kennt diese Bedingung nicht: ein vorhandener Datensatz wird überschrieben
- Gibt die bereits als persistiert markierten Instanzen zurück

```typescript
const logs = await Log.createMany([
  { level: "info", message: "Start" },
  { level: "warn", message: "Cache leer" }
]);
```

---

### `update<M>(änderungen, filter, options?: MutationOptions): Promise<number>`

Aktualisiert alle passenden Datensätze und gibt deren Anzahl zurück.

- Bei einem einfachen Filter auf den Primärschlüssel ist es ein einziges `UpdateItem` mit den berührten Feldern und ohne vorheriges Lesen, sofern kein `@Set` und kein `@Validate` dieser Felder das Argument `current` deklariert. Tut es das, wird der Datensatz zuerst gelesen, um ihn übergeben zu können
- Bei jedem anderen Filter wird die Abfrage aufgelöst, die Änderungen werden angewendet und in Blöcken von 25 geschrieben
- Die `@UpdatedAt`-Spalten werden bei jedem betroffenen Datensatz erneuert
- Mit `{ hook: true }` laufen `beforeUpdate` und `afterUpdate` einmal pro betroffenem Datensatz

```typescript
const betroffen = await User.update({ status: "suspended" }, { status: "inactive" });
await User.update({ status: "active" }, { id: "user-1" });
```

---

### `delete<M>(filter, options?: MutationOptions): Promise<number>`

Löscht alle passenden Datensätze und gibt deren Anzahl zurück.

- Immer ein endgültiges Löschen, mit oder ohne `@DeleteAt`: Soft Delete ist eine Entscheidung der Instanz und lebt in `destroy()`
- Ein einfacher Filter auf den Primärschlüssel bei einem Modell ohne `@DeleteAt` und ohne Destroy-Hooks ist ein einziges `DeleteItem`
- Sonst wird die Abfrage aufgelöst und in Blöcken von 25 gelöscht

```typescript
const gelöscht = await User.delete({ status: "suspended" });
await User.delete({ id: "user-1" }, { hook: true });
```

---

### `deleteMany<M>(ids, options?: MutationOptions): Promise<number>`

Löscht über den Primärschlüssel mit `BatchWriteItem`, ohne vorher zu lesen. Immer endgültig und ohne Hooks.

```typescript
const gelöscht = await Log.deleteMany(["01JBQ8...", "01JBQ9..."]);
```

---

### `increment<M>(feld, menge, filter, options?): Promise<number>` / `decrement<M>(...)`

Atomare Addition auf dem Server.

- Ein Filter auf den Primärschlüssel aktualisiert genau diesen Datensatz, ohne ihn zu lesen
- Jeder andere Filter löst zuerst die Abfrage auf und aktualisiert dann alle Treffer parallel
- Gibt zurück, wie viele Datensätze berührt wurden

```typescript
await User.increment("credits", 10, { id: "user-1" });
await User.decrement("stock", 1, { sku: "ABC" });
```

---

### `first<M>(filter, options?): Promise<M | undefined>`

Der erste passende Datensatz oder `undefined`. Es ist `where()` mit `limit: 1`, auf einem indizierten Feld also eine einzige Anfrage.

```typescript
const user = await User.first({ email: "juan@example.com" });
const neueste = await User.first({ role: "admin" }, { order: { created_at: "DESC" } });
```

---

### `last<M>(filter?, options?): Promise<M | undefined>`

Der letzte Datensatz, absteigend sortiert nach der `@CreatedAt`-Spalte oder, falls es keine gibt, nach dem Primärschlüssel.

Ohne Sort Key auf der Tabelle wird im Speicher sortiert, was bedeutet, alles zu lesen, was zum Filter passt, um einen Datensatz zu behalten. Auf einer großen Tabelle nimmt man `first(filter, { order: { created_at: "DESC" } })`, eingegrenzt durch einen `@Index`.

```typescript
const letzter = await User.last();
```

---

## `where()` — Abfragen

### Überladungen

```typescript
User.where(filter, optionen?)
User.where(feld, wert, optionen?)
User.where(feld, operator, wert, optionen?)
```

```typescript
await User.where({ status: "active" });
await User.where("name", "Juan");
await User.where("age", ">=", 18);
await User.where({ age: { $gte: 18, $lte: 65 } });
```

### Operatoren

| Operator | Aliase | Bedeutung |
|----------|--------|-----------|
| `=` | `$eq` | Gleich. Mit `null`: "das Attribut existiert nicht" |
| `<>`, `!=` | `$ne` | Ungleich. Mit `null`: "das Attribut existiert" |
| `<` | `$lt` | Kleiner als |
| `<=` | `$lte` | Kleiner oder gleich |
| `>` | `$gt` | Größer als |
| `>=` | `$gte` | Größer oder gleich |
| `in` | `$in` | Im Array enthalten |
| `include` | `$include`, `contains`, `$contains` | Enthält den Teilstring oder das Element |

Eine unbekannte Spalte wirft `Unknown column '<feld>' in <tabelle>`. Ein leeres Array bei `in` wirft `Operator 'in' requires a non-empty array.`

### Optionen

```typescript
const users = await User.where({ status: "active" }, {
  order: { created_at: "DESC" },  // nach Feld; "ASC"/"DESC" allein sortiert nach @CreatedAt
  limit: 10,
  skip: 20,                       // Alias: offset
  cursor: vorherige.cursor,       // nächste Seite; ignoriert skip
  attributes: ["id", "name"],     // Projektion
  deleted: true,                  // schließt die per Soft Delete markierten ein
  include: {
    profile: true,
    orders: { where: { status: "completed" }, limit: 5 }
  }
});
```

- `limit: 0` gibt ein leeres Array zurück, ohne das Netz zu berühren.
- `order` allein sortiert nach der `@CreatedAt`-Spalte, sonst nach dem Primärschlüssel. Um nach einem Datum zu sortieren, muss man es benennen: `{ created_at: "DESC" }`.
- `attributes` erzeugt Instanzen mit ausschließlich diesen Spalten.
- `deleted` ersetzt das frühere `_includeTrashed`, das als Alias weiterhin funktioniert.

### Ergebnis und Paginierung

`where()` gibt das Array der Instanzen mit einer nicht aufzählbaren Eigenschaft `cursor` zurück. Sie trägt einen Wert, solange weitere Seiten existieren.

```typescript
let seite = await User.where({}, { limit: 50 });
while (seite.cursor) {
  seite = await User.where({}, { limit: 50, cursor: seite.cursor });
}
```

`skip` liest und verwirft auf jeder Seite alles Vorherige; der Cursor liest nur die angeforderte Seite.

---

## Kosten und Leistung

| Filter | Kommando | Anfragen |
|--------|----------|----------|
| `=` auf den Primärschlüssel | `GetItem` | 1 |
| `in` auf den Primärschlüssel | `BatchGetItem` | 1 je 100 Schlüssel |
| `=` oder `in` auf eine `@Index`-Spalte | `Query` auf `<feld>_index` | 1 pro unterschiedlichem Wert |
| Jeder andere Filter | `Scan` | die ganze Tabelle, serverseitig gefiltert |

- Zusätzliche Filter über einer Lesung per Primärschlüssel werden auf dem bereits gelesenen Item ausgewertet: die Abfrage bleibt eine einzige Anfrage.
- Ein `limit` bricht die Lesung ab, sobald genug Datensätze zusammen sind, und reist als `Limit` mit, wenn serverseitig nichts mehr zu filtern ist.
- Eine Lesung ohne `limit`, die in einem `Scan` endet, wird in vier parallele Segmente geteilt: dieselben Leseeinheiten, ein Bruchteil der Latenz. Ohne `order` ist die Reihenfolge beliebig, wie schon zuvor.
- Existiert der GSI eines `@Index` nicht, schlägt die Abfrage nicht fehl: sie fällt auf `Scan` zurück, entfernt den Index aus ihrer internen Registrierung und läuft weiter. Es funktioniert und kostet die ganze Tabelle — deklariere `<feld>_index` mit Projektion `ALL` in deiner Infrastruktur.
- `attributes` verkleinert die Nutzlast, nicht die Leseeinheiten: DynamoDB berechnet das gesamte Item.
- Beziehungen werden im Batch geladen: eine Runde Abfragen pro Beziehung und Ebene, bis zu fünf Ebenen. Pivot-Tabellen werden über ihren GSI `<fremdschlüssel>_index` gelesen.

---

## Fehler

| Meldung | Ursache |
|---------|---------|
| `DynamoDB client no configurado. Use Dynamite.connect() primero.` | Eine Instanz wurde erzeugt oder eine Abfrage vor `connect()` ausgeführt |
| `Record with <schlüssel> '<wert>' already exists in <tabelle>` | `create()` auf einen vergebenen Primärschlüssel |
| `Unknown column '<feld>' in <tabelle>` | Ein Filter auf eine Spalte, die das Modell nicht deklariert |
| `Operator 'in' requires a non-empty array.` | `in` mit leerem Array |
| `Cannot destroy record without ID` | `destroy()`/`forceDestroy()` auf einer Instanz ohne Primärschlüssel |
| `Cannot increment without primary key` | `increment()`/`decrement()` auf einer Instanz ohne Primärschlüssel |
| `No se puede attach sin ID: la instancia debe persistirse primero con save() o create()` | `attach()` auf einer nie persistierten Instanz |
| `Transaction exceeds 100 operations limit` | Mehr als 100 Operationen in einem `tx()` |

---

## Grenzen

- Eine Transaktion fasst höchstens 100 Operationen und wird in Blöcken von 25 gesendet.
- `include` verschachtelt bis zu fünf Ebenen.
- `BatchGetItem` liest 100 Schlüssel pro Anfrage, `BatchWriteItem` schreibt 25; die Bibliothek teilt und wiederholt selbst.
- DynamoDB begrenzt ein Item auf 400 KB und eine Abfrageseite auf 1 MB.

---

## Quelldatei

`src/core/table.ts`
