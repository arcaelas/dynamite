# Installationsanleitung

> Vollständige Installations- und Konfigurationsanleitung für @arcaelas/dynamite

Diese Anleitung deckt alles ab, was Sie benötigen, um @arcaelas/dynamite in Ihrem Projekt zu installieren, zu konfigurieren und zu überprüfen.

---

## Inhaltsverzeichnis

- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [AWS-Konfiguration](#aws-konfiguration)
- [Basiskonfiguration](#basiskonfiguration)
- [Überprüfung](#überprüfung)
- [Fehlerbehebung](#fehlerbehebung)
- [Nächste Schritte](#nächste-schritte)

---

## Voraussetzungen

Bevor Sie @arcaelas/dynamite installieren, stellen Sie sicher, dass Ihre Entwicklungsumgebung diese Anforderungen erfüllt:

### Node.js-Version

- **Node.js 16.x oder höher** (18.x oder 20.x empfohlen)
- **npm 7.x oder höher** oder **yarn 1.22.x oder höher**

Überprüfen Sie Ihre Versionen:

```bash
node --version  # Should be >= 16.0.0
npm --version   # Should be >= 7.0.0
```

Wenn Sie Node.js aktualisieren müssen, empfehlen wir die Verwendung von [nvm](https://github.com/nvm-sh/nvm):

```bash
# Install Node.js 20 LTS
nvm install 20
nvm use 20
```

### AWS-Kontoanforderungen

Sie benötigen eines der folgenden:

1. **AWS-Konto** mit DynamoDB-Zugriff
   - Gültige AWS-Anmeldeinformationen (Access Key ID und Secret Access Key)
   - IAM-Berechtigungen für DynamoDB-Operationen
   - AWS-Regionsauswahl (z.B. `us-east-1`, `eu-west-1`)

2. **DynamoDB Local** für die Entwicklung (empfohlen zum Testen)
   - Docker installiert (einfachste Methode)
   - Oder Java Runtime Environment 8.x oder höher

### DynamoDB-Tabelleneinrichtung

@arcaelas/dynamite kann Tabellen automatisch erstellen, aber Sie sollten verstehen:

- **Primärschlüssel-Struktur**: Jede Tabelle benötigt einen Partitionsschlüssel (und optional einen Sortierschlüssel)
- **Abrechnungsmodus**: Wählen Sie zwischen On-Demand oder bereitgestellter Kapazität
- **Tabellenbenennung**: Tabellen werden automatisch basierend auf Ihren Modellklassennamen benannt

> **Hinweis**: Für die Produktion möchten Sie möglicherweise Tabellen manuell erstellen, um eine bessere Kontrolle über Kapazität und Indizes zu haben.

### TypeScript (Optional aber Empfohlen)

- **TypeScript 5.x oder höher** für vollständige Typsicherheit
- Konfigurieren Sie `tsconfig.json` mit aktiviertem Strict-Modus

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

## Installation

### Installation über npm

```bash
# Install @arcaelas/dynamite
npm install @arcaelas/dynamite

# Install peer dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Installation über yarn

```bash
# Install @arcaelas/dynamite
yarn add @arcaelas/dynamite

# Install peer dependencies
yarn add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Installation über pnpm

```bash
# Install @arcaelas/dynamite
pnpm add @arcaelas/dynamite

# Install peer dependencies
pnpm add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Installation überprüfen

Überprüfen Sie nach der Installation, ob die Pakete korrekt installiert sind:

```bash
npm list @arcaelas/dynamite @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

Sie sollten eine Ausgabe ähnlich dieser sehen:

```
project@1.0.0 /path/to/project
├── @arcaelas/dynamite@x.x.x
├── @aws-sdk/client-dynamodb@x.x.x
└── @aws-sdk/lib-dynamodb@x.x.x
```

---

## AWS-Konfiguration

### Option 1: DynamoDB Local (Empfohlen für die Entwicklung)

DynamoDB Local ist perfekt für Entwicklung und Tests ohne AWS-Kosten.

#### Mit Docker

Der einfachste Weg, DynamoDB Local auszuführen:

```bash
# Pull and run DynamoDB Local
docker run -d \
  -p 8000:8000 \
  --name dynamodb-local \
  amazon/dynamodb-local
```

#### Mit Docker Compose

Erstellen Sie eine `docker-compose.yml`-Datei:

```yaml
version: '3.8'

services:
  dynamodb-local:
    image: amazon/dynamodb-local
    container_name: dynamodb-local
    ports:
      - "8000:8000"
    command: ["-jar", "DynamoDBLocal.jar", "-sharedDb", "-dbPath", "/home/dynamodblocal/data/"]
    volumes:
      - dynamodb_data:/home/dynamodblocal/data
    working_dir: /home/dynamodblocal

volumes:
  dynamodb_data:
    driver: local
```

Starten Sie den Dienst:

```bash
docker-compose up -d
```

#### Mit Java Runtime

Wenn Sie Docker nicht verwenden, laden Sie DynamoDB Local herunter und führen Sie es direkt aus:

```bash
# Download DynamoDB Local
wget https://s3.us-west-2.amazonaws.com/dynamodb-local/dynamodb_local_latest.tar.gz

# Extract
tar -xvzf dynamodb_local_latest.tar.gz

# Run
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
```

#### Überprüfen, ob DynamoDB Local läuft

```bash
# Test connection
curl http://localhost:8000

# Or list tables (should return empty array initially)
aws dynamodb list-tables --endpoint-url http://localhost:8000 --region us-east-1
```

### Option 2: AWS DynamoDB (Produktion)

Für die Produktionsbereitstellung verwenden Sie AWS DynamoDB.

#### AWS-Anmeldeinformationen einrichten

**Methode 1: AWS CLI-Konfiguration** (Empfohlen)

```bash
# Install AWS CLI if not already installed
# https://aws.amazon.com/cli/

# Configure credentials
aws configure

# Enter your credentials when prompted:
# AWS Access Key ID: YOUR_ACCESS_KEY_ID
# AWS Secret Access Key: YOUR_SECRET_ACCESS_KEY
# Default region name: us-east-1
# Default output format: json
```

**Methode 2: Umgebungsvariablen**

```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_REGION="us-east-1"
```

**Methode 3: IAM-Rollen** (Für EC2, Lambda, ECS)

Wenn Sie auf AWS-Infrastruktur ausführen, verwenden Sie IAM-Rollen anstelle von Anmeldeinformationen:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:DescribeTable",
        "dynamodb:CreateTable"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/*"
    }
  ]
}
```

#### Wählen Sie Ihre AWS-Region

Wählen Sie eine Region in der Nähe Ihrer Benutzer für geringere Latenz:

- `us-east-1` - US East (N. Virginia)
- `us-west-2` - US West (Oregon)
- `eu-west-1` - Europe (Ireland)
- `ap-southeast-1` - Asia Pacific (Singapore)
- [Alle Regionen anzeigen](https://docs.aws.amazon.com/general/latest/gr/rande.html#ddb_region)

---

## Basiskonfiguration

### Konfigurationsdatei erstellen

Erstellen Sie eine Konfigurationsdatei, um Dynamite zu initialisieren:

**config/database.ts** (TypeScript)

```typescript
import { Dynamite } from "@arcaelas/dynamite";

export function ConfigureDatabase() {
  // Development configuration (DynamoDB Local)
  if (process.env.NODE_ENV === "development") {
    Dynamite.config({
      region: "us-east-1",
      endpoint: "http://localhost:8000",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test"
      }
    });
  }
  // Production configuration (AWS DynamoDB)
  else {
    Dynamite.config({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
      }
    });
  }
}
```

**config/database.js** (JavaScript)

```javascript
const { Dynamite } = require("@arcaelas/dynamite");

function ConfigureDatabase() {
  // Development configuration (DynamoDB Local)
  if (process.env.NODE_ENV === "development") {
    Dynamite.config({
      region: "us-east-1",
      endpoint: "http://localhost:8000",
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test"
      }
    });
  }
  // Production configuration (AWS DynamoDB)
  else {
    Dynamite.config({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }
}

module.exports = { ConfigureDatabase };
```

### Umgebungsvariablen einrichten

Erstellen Sie eine `.env`-Datei im Projektstammverzeichnis:

```bash
# Development
NODE_ENV=development
DYNAMODB_ENDPOINT=http://localhost:8000

# Production (only set these in production)
# NODE_ENV=production
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=your-access-key-id
# AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

Installieren Sie dotenv, um Umgebungsvariablen zu laden:

```bash
npm install dotenv
```

Laden Sie Umgebungsvariablen in Ihrer Anwendung:

```typescript
// At the top of your main file (index.ts, app.ts, server.ts)
import dotenv from "dotenv";
dotenv.config();

import { ConfigureDatabase } from "./config/database";
ConfigureDatabase();
```

### Definieren Sie Ihr erstes Modell

Erstellen Sie ein einfaches Benutzermodell, um die Installation zu testen:

**models/user.ts** (TypeScript)

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  NotNull
} from "@arcaelas/dynamite";

export class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;
}
```

**models/user.js** (JavaScript)

```javascript
const {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  NotNull
} = require("@arcaelas/dynamite");

class User extends Table {
  id;
  name;
  email;
  role;
  active;
  createdAt;
  updatedAt;
}

// Apply decorators
PrimaryKey()(User.prototype, "id");
Default(() => crypto.randomUUID())(User.prototype, "id");
NotNull()(User.prototype, "name");
NotNull()(User.prototype, "email");
Default(() => "customer")(User.prototype, "role");
Default(() => true)(User.prototype, "active");
CreatedAt()(User.prototype, "createdAt");
UpdatedAt()(User.prototype, "updatedAt");

module.exports = { User };
```

### Vollständige Anwendungseinrichtung

**index.ts** (TypeScript)

```typescript
import dotenv from "dotenv";
dotenv.config();

import { ConfigureDatabase } from "./config/database";
import { User } from "./models/user";

// Initialize database connection
ConfigureDatabase();

async function main() {
  try {
    // Create a new user
    const user = await User.create({
      name: "John Doe",
      email: "john@example.com"
    });

    console.log("User created:", user);
    console.log("ID:", user.id);
    console.log("Name:", user.name);
    console.log("Email:", user.email);
    console.log("Role:", user.role);
    console.log("Active:", user.active);
    console.log("Created At:", user.createdAt);

    // Query all users
    const allUsers = await User.where({});
    console.log("Total users:", allUsers.length);

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
```

---

## Überprüfung

### Schritt 1: Datenbankverbindung testen

Erstellen Sie eine einfache Testdatei:

**test-connection.ts**

```typescript
import dotenv from "dotenv";
dotenv.config();

import { Dynamite } from "@arcaelas/dynamite";

async function TestConnection() {
  try {
    Dynamite.config({
      region: "us-east-1",
      endpoint: process.env.DYNAMODB_ENDPOINT || "http://localhost:8000",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
      }
    });

    console.log("✓ Dynamite configured successfully");
    console.log("✓ Connection test passed");

  } catch (error) {
    console.error("✗ Connection failed:", error);
    process.exit(1);
  }
}

TestConnection();
```

Führen Sie den Test aus:

```bash
npm run build  # If using TypeScript
node dist/test-connection.js

# Or with ts-node
npx ts-node test-connection.ts
```

Erwartete Ausgabe:

```
✓ Dynamite configured successfully
✓ Connection test passed
```

### Schritt 2: Modelloperationen testen

Erstellen Sie einen umfassenden Test:

**test-model.ts**

```typescript
import dotenv from "dotenv";
dotenv.config();

import { ConfigureDatabase } from "./config/database";
import { User } from "./models/user";

ConfigureDatabase();

async function TestModelOperations() {
  console.log("Starting model operations test...\n");

  try {
    // Test 1: Create
    console.log("Test 1: Creating user...");
    const user = await User.create({
      name: "Test User",
      email: "test@example.com"
    });
    console.log("✓ User created:", user.id);

    // Test 2: Read
    console.log("\nTest 2: Reading user...");
    const foundUser = await User.first({ id: user.id });
    console.log("✓ User found:", foundUser?.name);

    // Test 3: Update
    console.log("\nTest 3: Updating user...");
    await User.update(user.id, { name: "Updated Name" });
    const updatedUser = await User.first({ id: user.id });
    console.log("✓ User updated:", updatedUser?.name);

    // Test 4: Query
    console.log("\nTest 4: Querying users...");
    const users = await User.where({ active: true });
    console.log("✓ Found", users.length, "active users");

    // Test 5: Delete
    console.log("\nTest 5: Deleting user...");
    await User.delete(user.id);
    const deletedUser = await User.first({ id: user.id });
    console.log("✓ User deleted:", deletedUser === undefined);

    console.log("\n✓ All tests passed!");

  } catch (error) {
    console.error("\n✗ Test failed:", error);
    process.exit(1);
  }
}

TestModelOperations();
```

Führen Sie den Test aus:

```bash
npx ts-node test-model.ts
```

Erwartete Ausgabe:

```
Starting model operations test...

Test 1: Creating user...
✓ User created: abc-123-def-456

Test 2: Reading user...
✓ User found: Test User

Test 3: Updating user...
✓ User updated: Updated Name

Test 4: Querying users...
✓ Found 1 active users

Test 5: Deleting user...
✓ User deleted: true

✓ All tests passed!
```

### Schritt 3: Tabellenerstellung überprüfen

Überprüfen Sie, ob DynamoDB-Tabellen erstellt wurden:

```bash
# For DynamoDB Local
aws dynamodb list-tables \
  --endpoint-url http://localhost:8000 \
  --region us-east-1

# For AWS DynamoDB
aws dynamodb list-tables --region us-east-1
```

Erwartete Ausgabe:

```json
{
  "TableNames": [
    "User"
  ]
}
```

Beschreiben Sie die Tabellenstruktur:

```bash
# For DynamoDB Local
aws dynamodb describe-table \
  --table-name User \
  --endpoint-url http://localhost:8000 \
  --region us-east-1

# For AWS DynamoDB
aws dynamodb describe-table \
  --table-name User \
  --region us-east-1
```

---

## Fehlerbehebung

### Häufige Installationsprobleme

#### Problem: Modul nicht gefunden

**Fehler:**
```
Error: Cannot find module '@arcaelas/dynamite'
```

**Lösung:**
```bash
# Verify installation
npm list @arcaelas/dynamite

# Reinstall if necessary
npm install @arcaelas/dynamite --save

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Problem: Peer-Abhängigkeiten fehlen

**Fehler:**
```
npm WARN @arcaelas/dynamite requires a peer of @aws-sdk/client-dynamodb
```

**Lösung:**
```bash
# Install all peer dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

#### Problem: TypeScript-Decorator-Fehler

**Fehler:**
```
error TS1238: Unable to resolve signature of class decorator
```

**Lösung:**

Aktualisieren Sie Ihre `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Häufige Konfigurationsprobleme

#### Problem: Verbindung zu DynamoDB Local nicht möglich

**Fehler:**
```
NetworkingError: connect ECONNREFUSED 127.0.0.1:8000
```

**Lösung:**

```bash
# Check if DynamoDB Local is running
docker ps | grep dynamodb-local

# If not running, start it
docker run -d -p 8000:8000 amazon/dynamodb-local

# Test connection
curl http://localhost:8000
```

#### Problem: AWS-Anmeldeinformationen ungültig

**Fehler:**
```
UnrecognizedClientException: The security token included in the request is invalid
```

**Lösung:**

```bash
# Verify credentials
aws sts get-caller-identity

# Reconfigure AWS CLI
aws configure

# Or check environment variables
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
```

#### Problem: Fehlende Tabellenberechtigungen

**Fehler:**
```
AccessDeniedException: User is not authorized to perform: dynamodb:CreateTable
```

**Lösung:**

Stellen Sie sicher, dass Ihr IAM-Benutzer/Ihre Rolle über die erforderlichen Berechtigungen verfügt:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/*"
    }
  ]
}
```

### Laufzeitprobleme

#### Problem: Metadaten nicht gefunden

**Fehler:**
```
Error: Metadata no encontrada para la tabla User
```

**Lösung:**

Stellen Sie sicher, dass Dekoratoren ausgeführt werden, bevor Sie das Modell verwenden:

```typescript
// ✓ Correct: Import model before using
import { User } from "./models/user";
const user = await User.create({ name: "John" });

// ✗ Wrong: Using model before decorators execute
const user = await User.create({ name: "John" });
import { User } from "./models/user";
```

#### Problem: Primärschlüssel fehlt

**Fehler:**
```
Error: PartitionKey faltante en la tabla User
```

**Lösung:**

Jedes Modell muss einen Primärschlüssel haben:

```typescript
class User extends Table<User> {
  @PrimaryKey()  // Add this decorator
  declare id: string;
}
```

### Leistungsprobleme

#### Problem: Langsame Abfragen

Überprüfen Sie Ihre Abfragemuster:

```typescript
// ✗ Bad: Scanning entire table
const users = (await User.where({})).filter(u => u.age > 18);

// ✓ Good: Using query filters
const users = await User.where("age", ">", 18);
```

#### Problem: Hohe Speichernutzung

Verwenden Sie Attributprojektion, um Daten zu begrenzen:

```typescript
// ✓ Only fetch needed fields
const users = await User.where({}, {
  attributes: ["id", "name", "email"]
});
```

---

## Nächste Schritte

Herzlichen Glückwunsch! Sie haben @arcaelas/dynamite erfolgreich installiert und konfiguriert.

### Empfohlene nächste Schritte

1. **Grundlagen lernen**: Lesen Sie den [Einstiegsleitfaden](./getting-started.md)
2. **Funktionen erkunden**: Sehen Sie sich [Erweiterte Funktionen](../README.md#-advanced-features) an
3. **Beziehungen verstehen**: Lernen Sie über [Beziehungen](../README.md#-relationships)
4. **Abfragen meistern**: Studieren Sie [Abfrageoperationen](../README.md#-query-operations)
5. **TypeScript-Typen**: Überprüfen Sie [TypeScript-Typen](../README.md#-typescript-types)

### Beispielprojekte

Erstellen Sie ein Beispielprojekt zum Üben:

```bash
mkdir my-dynamite-app
cd my-dynamite-app
npm init -y
npm install @arcaelas/dynamite @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### Zusätzliche Ressourcen

- [API-Referenz](../README.md#-api-reference)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [AWS SDK v3-Dokumentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [GitHub-Repository](https://github.com/arcaelas/dynamite)

### Community und Support

- **Issues**: [Fehler auf GitHub melden](https://github.com/arcaelas/dynamite/issues)
- **Diskussionen**: [An Community-Diskussionen teilnehmen](https://github.com/arcaelas/dynamite/discussions)
- **Updates**: [Releases verfolgen](https://github.com/arcaelas/dynamite/releases)

---

**Benötigen Sie Hilfe?**

Wenn Sie auf Probleme stoßen, die in diesem Leitfaden nicht behandelt werden, bitte:
1. Überprüfen Sie den Abschnitt [Fehlerbehebung](#fehlerbehebung) oben
2. Lesen Sie die [Haupt-README](../README.md#-troubleshooting)
3. Öffnen Sie ein Issue auf [GitHub](https://github.com/arcaelas/dynamite/issues)

---

**Mit ❤️ erstellt von [Miguel Alejandro](https://github.com/arcaelas) - [Arcaelas Insiders](https://github.com/arcaelas)**
