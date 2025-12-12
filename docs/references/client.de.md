# API-Referenz: Client

## Allgemeine Beschreibung

Der Dynamite-Client ist der zentrale Konfigurationsverwalter für DynamoDB-Verbindungen. Er verwaltet die Client-Initialisierung, Tabellensynchronisierung und das Verbindungs-Lifecycle-Management. Die `Dynamite`-Klasse bietet eine saubere API zur Konfiguration von AWS SDK DynamoDB-Clients und zur automatischen Erstellung von Tabellen mit ihren Globalen Sekundärindizes (GSI).

## Klasse: Dynamite

Die Hauptclient-Klasse, die DynamoDB-Verbindungen und Tabellenoperationen verwaltet.

### Konstruktor

```typescript
constructor(config: DynamiteConfig)
```

Erstellt eine neue Dynamite-Client-Instanz mit der bereitgestellten Konfiguration.

**Parameter:**
- `config` (DynamiteConfig): Konfigurationsobjekt mit DynamoDB-Client-Einstellungen und Tabellendefinitionen

**Beispiel:**
```typescript
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order, Product } from "./models";

const client = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  tables: [User, Order, Product]
});
```

## Konfiguration

### Interface DynamiteConfig

```typescript
interface DynamiteConfig extends DynamoDBClientConfig {
  tables: Array<new (...args: any[]) => any>;
}
```

Das Konfigurationsinterface erweitert `DynamoDBClientConfig` vom AWS SDK und fügt Tabellendefinitionen hinzu.

**Eigenschaften:**

| Eigenschaft | Typ | Erforderlich | Beschreibung |
|-------------|-----|--------------|--------------|
| `tables` | `Array<Class>` | Ja | Array von Table-Klassenkonstruktoren zur Registrierung |
| `region` | `string` | Ja | AWS-Region (z.B. "us-east-1") |
| `endpoint` | `string` | Nein | Benutzerdefinierte Endpoint-URL (für DynamoDB Local) |
| `credentials` | `AwsCredentials` | Nein | AWS-Anmeldeinformationsobjekt |
| `maxAttempts` | `number` | Nein | Maximale Anzahl von Wiederholungsversuchen |
| `requestTimeout` | `number` | Nein | Anfrage-Timeout in Millisekunden |

### AWS-Anmeldeinformationen

```typescript
interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}
```

## Instanzmethoden

### connect()

```typescript
connect(): void
```

Verbindet den Client und legt ihn als globalen DynamoDB-Client für Table-Operationen fest. Diese Methode muss vor der Ausführung von Table-Operationen aufgerufen werden.

**Beispiel:**
```typescript
const client = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  tables: [User, Order]
});

client.connect();

// Jetzt sind Table-Operationen verfügbar
const user = await User.create({ name: "John" });
```

**Hinweise:**
- Idempotente Operation - mehrfaches Aufrufen hat keine Auswirkung
- Legt den internen Client als globalen Client für alle Table-Instanzen fest
- Muss vor Table.create(), Table.where() usw. aufgerufen werden

### sync()

```typescript
async sync(): Promise<void>
```

Synchronisiert alle deklarierten Tabellen mit DynamoDB. Diese Methode erstellt Tabellen, wenn sie nicht existieren, einschließlich ihrer Globalen Sekundärindizes (GSI) für `@HasMany`-Beziehungen.

**Rückgabe:**
- `Promise<void>`: Wird aufgelöst, wenn alle Tabellen synchronisiert sind

**Beispiel:**
```typescript
await client.sync();

// Alle in config.tables definierten Tabellen sind jetzt in DynamoDB erstellt
// mit ihren Primärschlüsseln, Sortierschlüsseln und GSI-Indizes
```

**Verhalten:**
- Erstellt Tabellen mit Abrechnungsmodus `PAY_PER_REQUEST`
- Erkennt und erstellt automatisch GSI für `@HasMany`-Beziehungen
- Idempotent - sicher mehrfach aufzurufen
- Ignoriert `ResourceInUseException` (Tabelle existiert bereits)
- Wirft Fehler bei anderen Fehlschlägen

**Details zur Tabellenerstellung:**
- **Partition Key**: Erkannt aus dem Decorator `@PrimaryKey()` oder `@Index()`
- **Sort Key**: Erkannt aus dem Decorator `@IndexSort()` (optional)
- **GSI**: Automatisch erstellt für jede `@HasMany`-Beziehung mit Benennungsmuster `GSI{N}_{foreignKey}`
- **Abrechnungsmodus**: `PAY_PER_REQUEST` (On-Demand)
- **Attributdefinitionen**: Automatisch abgeleitet (alle Schlüssel standardmäßig vom Typ String)

### getClient()

```typescript
getClient(): DynamoDBClient
```

Gibt die zugrundeliegende AWS SDK DynamoDB-Client-Instanz zurück.

**Rückgabe:**
- `DynamoDBClient`: Der AWS SDK DynamoDB-Client

**Beispiel:**
```typescript
const awsClient = client.getClient();

// Für direkte AWS SDK-Operationen verwenden
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
const result = await awsClient.send(
  new DescribeTableCommand({ TableName: "users" })
);
```

**Anwendungsfälle:**
- Direkter Zugriff auf AWS SDK-Operationen
- Benutzerdefinierte Befehle, die von Dynamite nicht unterstützt werden
- Erweiterte DynamoDB-Funktionen
- Tests und Debugging

### isReady()

```typescript
isReady(): boolean
```

Prüft, ob der Client verbunden und alle Tabellen synchronisiert sind.

**Rückgabe:**
- `boolean`: `true` wenn sowohl `connect()` als auch `sync()` erfolgreich abgeschlossen wurden

**Beispiel:**
```typescript
console.log(client.isReady()); // false

client.connect();
await client.sync();

console.log(client.isReady()); // true
```

### disconnect()

```typescript
disconnect(): void
```

Trennt und bereinigt den DynamoDB-Client. Zerstört den zugrundeliegenden AWS SDK-Client und setzt den internen Zustand zurück.

**Beispiel:**
```typescript
client.disconnect();

// Client ist nicht mehr verwendbar
// Table-Operationen werden Fehler werfen
```

**Verhalten:**
- Ruft `client.destroy()` auf dem zugrundeliegenden AWS SDK-Client auf
- Setzt die `connected`- und `synced`-Flags zurück
- Löscht die globale Client-Referenz, wenn sie mit dieser Instanz übereinstimmt
- Sicher mehrfach aufzurufen
- Protokolliert Warnungen, wenn die Zerstörung fehlschlägt

### tx()

```typescript
async tx<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R>
```

Führt Operationen innerhalb einer atomaren Transaktion aus. Wenn eine Operation fehlschlägt, werden alle Änderungen automatisch zurückgerollt.

**Typ-Parameter:**
- `R`: Rückgabetyp der Callback-Funktion

**Parameter:**
- `callback` (`(tx: TransactionContext) => Promise<R>`): Funktion mit transaktionalen Operationen

**Rückgabe:**
- `Promise<R>`: Von der Callback-Funktion zurückgegebenes Ergebnis

**Beispiel:**
```typescript
const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User, Order]
});

dynamite.connect();
await dynamite.sync();

// Atomare Transaktion - alle Operationen sind erfolgreich oder alle schlagen fehl
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, tx);
  await Order.create({ user_id: user.id, total: 100 }, tx);
  await Order.create({ user_id: user.id, total: 200 }, tx);
  // Wenn ein create fehlschlägt, werden alle Operationen zurückgerollt
});
```

**Einschränkungen:**
- Maximal 25 Operationen pro Transaktion (DynamoDB-Limit)
- Wirft Fehler, wenn das Limit überschritten wird

**Transaktionsoperationen:**
```typescript
// Datensätze in Transaktion erstellen
await dynamite.tx(async (tx) => {
  await User.create({ name: "John" }, tx);
  await User.create({ name: "Jane" }, tx);
});

// Gemischte Operationen
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, tx);
  await user.destroy(tx); // Soft Delete in Transaktion
});
```

**Anwendungsfälle:**
- Atomares Erstellen verwandter Datensätze (Benutzer + Bestellungen)
- Sicherstellung der Datenkonsistenz über mehrere Tabellen
- Batch-Operationen, die alle erfolgreich sein oder alle fehlschlagen müssen
- Soft-Delete von Eltern- und Kind-Datensätzen zusammen

**Fehlerbehandlung:**
```typescript
try {
  await dynamite.tx(async (tx) => {
    await User.create({ name: "John" }, tx);
    throw new Error("Simulierter Fehler");
    // Das erste create wird zurückgerollt
  });
} catch (error) {
  console.log("Transaktion fehlgeschlagen, alle Änderungen wurden zurückgerollt");
}
```

## Klasse: TransactionContext

Interne Klasse, die transaktionale Operationen verwaltet. Wird an Callbacks in `tx()` übergeben.

### addPut()

```typescript
addPut(table_name: string, item: Record<string, any>): void
```

Fügt eine Put-Operation zur Transaktion hinzu.

**Parameter:**
- `table_name` (`string`): Name der DynamoDB-Tabelle
- `item` (`Record<string, any>`): Einzufügendes Element

### addDelete()

```typescript
addDelete(table_name: string, key: Record<string, any>): void
```

Fügt eine Delete-Operation zur Transaktion hinzu.

**Parameter:**
- `table_name` (`string`): Name der DynamoDB-Tabelle
- `key` (`Record<string, any>`): Primärschlüssel des zu löschenden Elements

### commit()

```typescript
async commit(): Promise<void>
```

Committet alle eingereiht Operationen atomar. Wird automatisch von `tx()` aufgerufen.

**Wirft:**
- `Error`: Wenn die Transaktion 25 Operationen überschreitet
- DynamoDB-Fehler, wenn die Transaktion fehlschlägt

## Konfigurationsbeispiele

### Lokale Entwicklung (DynamoDB Local)

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order, Product } from "./models";

const client = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  },
  tables: [User, Order, Product]
});

client.connect();
await client.sync();
```

**Docker-Konfiguration:**
```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

**Docker Compose:**
```yaml
version: '3.8'
services:
  dynamodb-local:
    image: amazon/dynamodb-local
    ports:
      - "8000:8000"
    command: ["-jar", "DynamoDBLocal.jar", "-sharedDb"]
```

### AWS-Produktionskonfiguration

```typescript
const client = new Dynamite({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product],
  maxAttempts: 3,
  requestTimeout: 3000
});

client.connect();
await client.sync();
```

### Umgebungsvariablen

```bash
# .env Datei
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Für lokale Entwicklung
DYNAMODB_ENDPOINT=http://localhost:8000
```

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import * as dotenv from "dotenv";

dotenv.config();

const config: any = {
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product]
};

// Endpoint nur für lokale Entwicklung hinzufügen
if (process.env.DYNAMODB_ENDPOINT) {
  config.endpoint = process.env.DYNAMODB_ENDPOINT;
}

const client = new Dynamite(config);
client.connect();
await client.sync();
```

### Mehrere Client-Instanzen

Sie können mehrere Dynamite-Clients für verschiedene Konfigurationen oder Regionen erstellen.

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order } from "./models";
import { Log, Metric } from "./monitoring";

// Produktionsdatenbank-Client
const production_client = new Dynamite({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.PROD_AWS_KEY!,
    secretAccessKey: process.env.PROD_AWS_SECRET!
  },
  tables: [User, Order]
});

// Analytics-Datenbank-Client (andere Region)
const analytics_client = new Dynamite({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.ANALYTICS_AWS_KEY!,
    secretAccessKey: process.env.ANALYTICS_AWS_SECRET!
  },
  tables: [Log, Metric]
});

// Produktions-Client verbinden (wird global)
production_client.connect();
await production_client.sync();

// User- und Order-Operationen verwenden production_client
const user = await User.create({ name: "John" });

// Zu Analytics-Client wechseln
analytics_client.connect();
await analytics_client.sync();

// Log- und Metric-Operationen verwenden jetzt analytics_client
const log = await Log.create({ message: "User created" });
```

**Wichtige Hinweise:**
- Nur ein Client kann gleichzeitig der "globale" Client sein
- Das Aufrufen von `connect()` auf einem neuen Client ersetzt den globalen Client
- Table-Operationen verwenden immer den aktuellen globalen Client
- Erwägen Sie explizite Client-Übergabe für Multi-Client-Szenarien

### Benutzerdefinierte Konfigurationsoptionen

```typescript
const client = new Dynamite({
  region: "us-east-1",
  endpoint: "https://dynamodb.us-east-1.amazonaws.com",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product],

  // Erweiterte AWS SDK-Optionen
  maxAttempts: 5,
  requestTimeout: 5000,

  // Benutzerdefinierte Wiederholungsstrategie
  retryMode: "adaptive",

  // Protokollierung aktivieren
  logger: console
});
```

## Hilfsfunktionen

### setGlobalClient()

```typescript
export const setGlobalClient = (client: DynamoDBClient): void
```

Legt den globalen DynamoDB-Client für Table-Operationen fest. Wird typischerweise intern von `Dynamite.connect()` aufgerufen.

**Parameter:**
- `client` (DynamoDBClient): AWS SDK DynamoDB-Client-Instanz

**Beispiel:**
```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { setGlobalClient } from "@arcaelas/dynamite";

const custom_client = new DynamoDBClient({
  region: "us-east-1"
});

setGlobalClient(custom_client);
```

### getGlobalClient()

```typescript
export const getGlobalClient = (): DynamoDBClient
```

Gibt den aktuellen globalen DynamoDB-Client zurück. Wirft einen Fehler, wenn kein Client festgelegt ist.

**Rückgabe:**
- `DynamoDBClient`: Der globale DynamoDB-Client

**Wirft:**
- `Error`: Wenn kein globaler Client festgelegt wurde

**Beispiel:**
```typescript
import { getGlobalClient } from "@arcaelas/dynamite";

try {
  const client = getGlobalClient();
  console.log("Client ist konfiguriert");
} catch (error) {
  console.error("Kein Client konfiguriert");
}
```

### hasGlobalClient()

```typescript
export const hasGlobalClient = (): boolean
```

Prüft, ob ein globaler DynamoDB-Client verfügbar ist.

**Rückgabe:**
- `boolean`: `true` wenn ein globaler Client existiert

**Beispiel:**
```typescript
import { hasGlobalClient } from "@arcaelas/dynamite";

if (hasGlobalClient()) {
  console.log("Client ist verfügbar");
} else {
  console.log("Kein Client konfiguriert");
}
```

### requireClient()

```typescript
export const requireClient = (): DynamoDBClient
```

Erfordert, dass ein globaler Client verfügbar ist. Wirft einen Fehler mit lokalisierter Nachricht, wenn nicht festgelegt.

**Rückgabe:**
- `DynamoDBClient`: Der globale DynamoDB-Client

**Wirft:**
- `Error`: Wenn kein globaler Client konfiguriert ist (Fehlermeldung auf Spanisch)

**Beispiel:**
```typescript
import { requireClient } from "@arcaelas/dynamite";

try {
  const client = requireClient();
  // Client für Operationen verwenden
} catch (error) {
  console.error(error.message); // "DynamoDB client no configurado. Use Dynamite.connect() primero."
}
```

## Fehlerbehandlung

### Häufige Fehler

#### ResourceInUseException

Wird geworfen, wenn versucht wird, eine bereits existierende Tabelle zu erstellen.

```typescript
try {
  await client.sync();
} catch (error) {
  if (error.name === "ResourceInUseException") {
    console.log("Tabelle existiert bereits");
  }
}
```

**Hinweis:** Dynamite behandelt diesen Fehler während `sync()` automatisch.

#### ValidationException

Wird geworfen, wenn das Tabellenschema oder die Attribute ungültig sind.

```typescript
try {
  await client.sync();
} catch (error) {
  if (error.name === "ValidationException") {
    console.error("Ungültiges Tabellenschema:", error.message);
  }
}
```

**Häufige Ursachen:**
- Fehlender Decorator `@PrimaryKey()` oder `@Index()`
- Reserviertes Schlüsselwort als Attributname verwendet
- Ungültiger Attributtyp
- PK und SK mit demselben Attributnamen

#### UnrecognizedClientException

Wird geworfen, wenn die Anmeldeinformationen ungültig sind oder der DynamoDB-Endpoint nicht erreichbar ist.

```typescript
try {
  client.connect();
  await client.sync();
} catch (error) {
  if (error.name === "UnrecognizedClientException") {
    console.error("Ungültige Anmeldeinformationen oder Endpoint");
  }
}
```

**Lösungen:**
- AWS-Anmeldeinformationen überprüfen
- Sicherstellen, dass DynamoDB Local läuft (für lokale Entwicklung)
- Endpoint-URL überprüfen
- Netzwerkverbindung prüfen

#### Metadata Not Found

Wird geworfen, wenn versucht wird, eine Tabelle ohne entsprechende Decorators zu synchronisieren.

```typescript
try {
  await client.sync();
} catch (error) {
  if (error.message.includes("not registered in wrapper")) {
    console.error("Table-Klasse fehlen Decorators");
  }
}
```

**Lösung:** Sicherstellen, dass alle Table-Klassen den Decorator `@PrimaryKey()` oder `@Index()` verwenden.

#### No Global Client

Wird geworfen, wenn Table-Operationen ohne vorherige Verbindung versucht werden.

```typescript
try {
  const user = await User.create({ name: "John" });
} catch (error) {
  if (error.message.includes("DynamoDB client no configurado")) {
    console.error("Zuerst client.connect() aufrufen");
  }
}
```

### Best Practices für Fehlerbehandlung

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order } from "./models";

async function initialize_database() {
  const client = new Dynamite({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    },
    tables: [User, Order]
  });

  try {
    // Client verbinden
    client.connect();
    console.log("Client verbunden");

    // Tabellen synchronisieren
    await client.sync();
    console.log("Tabellen synchronisiert");

    // Ready-Status prüfen
    if (client.isReady()) {
      console.log("Datenbank bereit für Operationen");
    }

    return client;
  } catch (error: any) {
    // Spezifische Fehler behandeln
    if (error.name === "UnrecognizedClientException") {
      console.error("Authentifizierung fehlgeschlagen. Anmeldeinformationen prüfen.");
    } else if (error.name === "ValidationException") {
      console.error("Ungültiges Tabellenschema:", error.message);
    } else if (error.message?.includes("not registered in wrapper")) {
      console.error("Table-Klasse fehlen Decorators");
    } else {
      console.error("Datenbank-Initialisierung fehlgeschlagen:", error);
    }

    // Bereinigung bei Fehler
    client.disconnect();
    throw error;
  }
}

// Verwendung
try {
  const client = await initialize_database();

  // Operationen ausführen
  const user = await User.create({ name: "John" });

  // Bereinigung beim Herunterfahren
  process.on("SIGINT", () => {
    client.disconnect();
    process.exit(0);
  });
} catch (error) {
  console.error("Anwendung konnte nicht gestartet werden");
  process.exit(1);
}
```

## Vollständiges Verwendungsbeispiel

### Grundlegende Anwendungskonfiguration

```typescript
import { Dynamite } from "@arcaelas/dynamite";
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

// Modelle definieren
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare total: number;

  @Default(() => "pending")
  declare status: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;
}

// Client initialisieren
async function setup_database() {
  const client = new Dynamite({
    region: "us-east-1",
    endpoint: "http://localhost:8000",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test"
    },
    tables: [User, Order]
  });

  // Verbinden und synchronisieren
  client.connect();
  await client.sync();

  console.log("Datenbank bereit:", client.isReady());
  return client;
}

// Anwendungs-Einstiegspunkt
async function main() {
  const client = await setup_database();

  try {
    // Benutzer erstellen
    const user = await User.create({
      name: "John Doe",
      email: "john@example.com"
    });

    console.log("Benutzer erstellt:", user.id);

    // Bestellungen erstellen
    const order1 = await Order.create({
      user_id: user.id,
      total: 99.99
    });

    const order2 = await Order.create({
      user_id: user.id,
      total: 149.99
    });

    // Mit Beziehungen abfragen
    const users_with_orders = await User.where({ id: user.id }, {
      include: {
        orders: {
          where: { status: "pending" }
        }
      }
    });

    console.log("Benutzer-Bestellungen:", users_with_orders[0].orders.length);
  } finally {
    // Bereinigung beim Beenden
    client.disconnect();
  }
}

main().catch(console.error);
```

### Integration mit Express.js

```typescript
import express from "express";
import { Dynamite } from "@arcaelas/dynamite";
import { User } from "./models";

const app = express();
app.use(express.json());

// Datenbank initialisieren
let client: Dynamite;

async function initialize() {
  client = new Dynamite({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    },
    tables: [User]
  });

  client.connect();
  await client.sync();
  console.log("Datenbank initialisiert");
}

// API-Routen
app.get("/users", async (req, res) => {
  try {
    const users = await User.where({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Benutzer konnten nicht abgerufen werden" });
  }
});

app.post("/users", async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "Benutzer konnte nicht erstellt werden" });
  }
});

// Server starten
initialize()
  .then(() => {
    app.listen(3000, () => {
      console.log("Server läuft auf Port 3000");
    });
  })
  .catch((error) => {
    console.error("Start fehlgeschlagen:", error);
    process.exit(1);
  });

// Graceful Shutdown
process.on("SIGINT", () => {
  console.log("Herunterfahren...");
  client.disconnect();
  process.exit(0);
});
```

## Best Practices

### 1. Einzelne Client-Instanz

Eine Client-Instanz pro Anwendung erstellen und wiederverwenden.

```typescript
// Gut
const client = new Dynamite({ /* config */ });
client.connect();
await client.sync();

// Schlecht - erstellt unnötig mehrere Clients
function get_client() {
  return new Dynamite({ /* config */ });
}
```

### 2. sync() einmal aufrufen

`sync()` nur während der Anwendungsinitialisierung aufrufen, nicht vor jeder Operation.

```typescript
// Gut - einmal beim Start synchronisieren
await client.sync();
const user = await User.create({ name: "John" });
const order = await Order.create({ user_id: user.id });

// Schlecht - wiederholt synchronisieren
await client.sync();
const user = await User.create({ name: "John" });
await client.sync();
const order = await Order.create({ user_id: user.id });
```

### 3. Graceful Shutdown

Client beim Herunterfahren der Anwendung immer trennen.

```typescript
process.on("SIGINT", () => {
  console.log("Graceful Shutdown");
  client.disconnect();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Graceful Shutdown");
  client.disconnect();
  process.exit(0);
});
```

### 4. Umgebungsbasierte Konfiguration

Umgebungsvariablen für die Konfiguration verwenden, um dev/staging/Produktion zu trennen.

```typescript
const client = new Dynamite({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : undefined,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  },
  tables: [User, Order, Product]
});
```

### 5. Fehlerbehandlung

Fehler während der Initialisierung immer behandeln und aussagekräftiges Feedback geben.

```typescript
try {
  client.connect();
  await client.sync();
} catch (error: any) {
  if (error.name === "UnrecognizedClientException") {
    console.error("DynamoDB Local läuft prüfen: docker run -p 8000:8000 amazon/dynamodb-local");
  } else {
    console.error("Datenbank-Initialisierung fehlgeschlagen:", error.message);
  }
  process.exit(1);
}
```

### 6. Test-Konfiguration

Separate Clients für Tests mit isolierter Konfiguration verwenden.

```typescript
// test/setup.ts
import { Dynamite } from "@arcaelas/dynamite";
import { User, Order } from "../models";

export async function setup_test_database() {
  const client = new Dynamite({
    region: "us-east-1",
    endpoint: "http://localhost:8000",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test"
    },
    tables: [User, Order]
  });

  client.connect();
  await client.sync();
  return client;
}

export async function teardown_test_database(client: Dynamite) {
  client.disconnect();
}
```

## Siehe auch

- [Table API-Referenz](./table.md) - Vollständige Table-Klassendokumentation
- [Decorator-Referenz](./decorators/) - Alle verfügbaren Decorators
- [AWS SDK DynamoDB-Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/) - Zugrundeliegende AWS SDK-Dokumentation
- [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) - Lokale Entwicklungseinrichtung
