# Beispiel für Datenvalidierung

Dieses umfassende Beispiel demonstriert Datenvalidierungs- und Transformationsmuster in Dynamite ORM. Lernen Sie, wie Sie Benutzereingaben validieren, Daten transformieren, benutzerdefinierte Validatoren erstellen und robuste Modelle mit Datenintegrität aufbauen.

## Inhaltsverzeichnis

- [Grundlegende Validierung](#grundlegende-validierung)
- [Datentransformation mit Mutate](#datentransformation-mit-mutate)
- [Benutzerdefinierte Validatoren](#benutzerdefinierte-validatoren)
- [Verkettung von Validatoren](#verkettung-von-validatoren)
- [NotNull-Validierung](#notnull-validierung)
- [Komplexe Validierungsmuster](#komplexe-validierungsmuster)
- [Vollständiges Funktionierendes Beispiel](#vollständiges-funktionierendes-beispiel)
- [Erwartete Ausgabe](#erwartete-ausgabe)
- [Best Practices](#best-practices)
- [Häufige Validierungsmuster](#häufige-validierungsmuster)

## Grundlegende Validierung

Der Decorator `@Validate()` ermöglicht es Ihnen, Validierungsregeln für Modellfelder zu definieren. Validatoren geben `true` für gültige Daten oder eine Fehlermeldung als String für ungültige Daten zurück.

### Einfache Validierung

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  Validate,
  CreationOptional
} from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Namenslänge validieren
  @Validate((value) => {
    const name = value as string;
    return name.length >= 2 || "Name must be at least 2 characters";
  })
  declare name: string;

  // E-Mail-Format validieren
  @Validate((value) => {
    const email = value as string;
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email_regex.test(email) || "Invalid email format";
  })
  declare email: string;

  // Altersbereich validieren
  @Validate((value) => {
    const age = value as number;
    if (age < 0) return "Age cannot be negative";
    if (age > 150) return "Age must be realistic";
    return true;
  })
  declare age: number;
}
```

### Verwendung

```typescript
// Gültige Daten
const user1 = await User.create({
  name: "John Doe",
  email: "john@example.com",
  age: 25
});
console.log("User created successfully");

// Ungültiger Name (zu kurz)
try {
  await User.create({
    name: "J",
    email: "john@example.com",
    age: 25
  });
} catch (error) {
  console.error(error.message); // "Name must be at least 2 characters"
}

// Ungültiges E-Mail-Format
try {
  await User.create({
    name: "John Doe",
    email: "invalid-email",
    age: 25
  });
} catch (error) {
  console.error(error.message); // "Invalid email format"
}

// Ungültiges Alter (negativ)
try {
  await User.create({
    name: "John Doe",
    email: "john@example.com",
    age: -5
  });
} catch (error) {
  console.error(error.message); // "Age cannot be negative"
}
```

## Datentransformation mit Mutate

Der Decorator `@Mutate()` transformiert Daten, bevor sie validiert oder gespeichert werden. **Wichtig: Mutate wird immer vor Validate ausgeführt.**

### Grundlegende Transformation

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // E-Mail in Kleinbuchstaben umwandeln und Leerzeichen entfernen
  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate((value) => {
    const email = value as string;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || "Invalid email";
  })
  declare email: string;

  // Namen kürzen und kapitalisieren
  @Mutate((value) => {
    const name = value as string;
    return name.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  })
  declare name: string;

  // Alter auf Ganzzahl runden
  @Mutate((value) => Math.round(value as number))
  @Validate((value) => (value as number) >= 0 || "Age must be positive")
  declare age: number;
}
```

### Verwendung

```typescript
const user = await User.create({
  name: "  john DOE  ",
  email: "  JOHN@EXAMPLE.COM  ",
  age: 25.7
});

console.log(user.name);  // "John Doe" (transformiert)
console.log(user.email); // "john@example.com" (transformiert)
console.log(user.age);   // 26 (gerundet)
```

## Benutzerdefinierte Validatoren

Erstellen Sie wiederverwendbare Validierungsfunktionen für häufige Muster:

### E-Mail-Validator

```typescript
function validate_email(value: any): boolean | string {
  const email = value as string;
  const email_regex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  return email_regex.test(email) || "Invalid email format";
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate(validate_email)
  declare email: string;
}
```

### Passwort-Stärke-Validator

```typescript
function validate_password_strength(value: any): boolean | string {
  const password = value as string;

  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }

  if (!/[!@#$%^&*]/.test(password)) {
    return "Password must contain at least one special character (!@#$%^&*)";
  }

  return true;
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_password_strength)
  declare password: string;
}
```

### URL-Validator

```typescript
function validate_url(value: any): boolean | string {
  const url = value as string;
  try {
    new URL(url);
    return true;
  } catch {
    return "Invalid URL format";
  }
}

class Profile extends Table<Profile> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_url)
  declare website: string;
}
```

### Telefonnummer-Validator

```typescript
function validate_phone_number(value: any): boolean | string {
  const phone = value as string;
  const phone_regex = /^\+?[1-9]\d{1,14}$/;
  return phone_regex.test(phone) || "Invalid phone number format";
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Mutate((value) => (value as string).replace(/[\s\-\(\)]/g, ''))
  @Validate(validate_phone_number)
  declare phone: string;
}
```

## Verkettung von Validatoren

Sie können mehrere Validatoren auf ein einzelnes Feld anwenden. **Validatoren werden von oben nach unten ausgeführt.**

### Mehrere Validierungsregeln

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Mehrere Validatoren für Namen
  @Validate((value) => (value as string).length >= 2 || "Name too short (min 2)")
  @Validate((value) => (value as string).length <= 50 || "Name too long (max 50)")
  @Validate((value) => /^[a-zA-Z\s]+$/.test(value as string) || "Name can only contain letters and spaces")
  declare name: string;

  // Mehrere Validatoren für Benutzernamen
  @Validate((value) => (value as string).length >= 3 || "Username too short (min 3)")
  @Validate((value) => (value as string).length <= 20 || "Username too long (max 20)")
  @Validate((value) => /^[a-z0-9_]+$/.test(value as string) || "Username can only contain lowercase letters, numbers, and underscores")
  @Validate((value) => !/^\d/.test(value as string) || "Username cannot start with a number")
  declare username: string;
}
```

## NotNull-Validierung

Der Decorator `@NotNull()` stellt sicher, dass ein Feld nicht `null` oder `undefined` sein kann:

```typescript
import { NotNull } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare email: string;

  @NotNull()
  @Validate((value) => (value as string).length >= 2 || "Name required")
  declare name: string;

  // Optionales Feld (kein @NotNull)
  declare bio: string;
}

// Gültig - alle erforderlichen Felder bereitgestellt
const user1 = await User.create({
  id: "user-1",
  email: "john@example.com",
  name: "John Doe"
  // bio ist optional
});

// Ungültig - fehlendes erforderliches Feld
try {
  await User.create({
    id: "user-2",
    name: "Jane Doe"
    // E-Mail ist erforderlich (@NotNull)
  });
} catch (error) {
  console.error(error.message); // "Field 'email' cannot be null"
}
```

## Komplexe Validierungsmuster

### Feldübergreifende Validierung

Ein Feld basierend auf dem Wert eines anderen Felds validieren:

```typescript
class Event extends Table<Event> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  @Validate((value) => {
    const date = new Date(value as string);
    return !isNaN(date.getTime()) || "Invalid date format";
  })
  declare start_date: string;

  @Validate((value) => {
    const date = new Date(value as string);
    return !isNaN(date.getTime()) || "Invalid date format";
  })
  declare end_date: string;

  // Im Konstruktor validieren, dass end_date nach start_date liegt
  constructor(data?: any) {
    super(data);

    if (data && data.start_date && data.end_date) {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);

      if (end <= start) {
        throw new Error("End date must be after start date");
      }
    }
  }
}
```

### Enum-Validierung

Validieren, dass ein Wert eine der zulässigen Optionen ist:

```typescript
function validate_enum<T>(allowed_values: T[]) {
  return (value: any): boolean | string => {
    if (!allowed_values.includes(value as T)) {
      return `Value must be one of: ${allowed_values.join(', ')}`;
    }
    return true;
  };
}

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_enum(["customer", "premium", "admin"]))
  declare role: string;

  @Validate(validate_enum(["active", "inactive", "suspended"]))
  declare status: string;
}
```

### Bereichsvalidierung

Wiederverwendbare Bereichsvalidatoren erstellen:

```typescript
function validate_range(min: number, max: number, field_name: string = "Value") {
  return (value: any): boolean | string => {
    const num = value as number;
    if (num < min) return `${field_name} must be at least ${min}`;
    if (num > max) return `${field_name} must be at most ${max}`;
    return true;
  };
}

class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @Validate(validate_range(0.01, 999999.99, "Price"))
  declare price: number;

  @Validate(validate_range(0, 10000, "Quantity"))
  declare quantity: number;

  @Validate(validate_range(1, 5, "Rating"))
  declare rating: number;
}
```

## Vollständiges Funktionierendes Beispiel

Hier ist ein vollständiges Beispiel, das alle Validierungsmuster demonstriert:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  Validate,
  Mutate,
  NotNull,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  Dynamite
} from "@arcaelas/dynamite";

// Benutzerdefinierte Validatoren
function validate_email(value: any): boolean | string {
  const email = value as string;
  const email_regex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  return email_regex.test(email) || "Invalid email format";
}

function validate_password(value: any): boolean | string {
  const password = value as string;
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain lowercase letter";
  if (!/[0-9]/.test(password)) return "Password must contain number";
  if (!/[!@#$%^&*]/.test(password)) return "Password must contain special character";
  return true;
}

// User-Modell mit umfassender Validierung
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Mutate((value) => (value as string).trim())
  @Validate((value) => (value as string).length >= 2 || "Name too short (min 2)")
  declare name: string;

  @NotNull()
  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate(validate_email)
  declare email: string;

  @NotNull()
  @Validate(validate_password)
  declare password: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;
}

// DynamoDB konfigurieren und User-Tabelle registrieren
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User],
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Hauptanwendung
async function main() {
  // Verbindung herstellen und Tabellen synchronisieren
  dynamite.connect();
  await dynamite.sync();
  console.log("=== Data Validation Example ===\n");

  // Gültigen Benutzer erstellen
  console.log("1. Creating valid user...");
  try {
    const user1 = await User.create({
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass123!"
    });
    console.log(`✓ Created: ${user1.name} (${user1.email})\n`);
  } catch (error: any) {
    console.error(`✗ Error: ${error.message}\n`);
  }

  // Ungültigen Namen testen
  console.log("2. Testing invalid name...");
  try {
    await User.create({
      name: "J",
      email: "john@example.com",
      password: "SecurePass123!"
    });
  } catch (error: any) {
    console.error(`✗ Validation failed: ${error.message}\n`);
  }

  console.log("=== Validation tests completed ===");
}

// Anwendung ausführen
main().catch(console.error);
```

## Erwartete Ausgabe

```
=== Data Validation Example ===

1. Creating valid user...
✓ Created: John Doe (john@example.com)

2. Testing invalid name...
✗ Validation failed: Name too short (min 2)

=== Validation tests completed ===
```

## Best Practices

### 1. Früh Validieren und Schnell Fehlschlagen

```typescript
// Gut - sofort bei Erstellung validieren
@Validate((value) => (value as string).length > 0 || "Name required")
declare name: string;
```

### 2. Mutate Vor Validate Verwenden

```typescript
// Gut - transformieren dann validieren
@Mutate((value) => (value as string).trim().toLowerCase())
@Validate((value) => /^[a-z0-9]+$/.test(value as string) || "Invalid format")
declare username: string;
```

### 3. Wiederverwendbare Validatoren Erstellen

```typescript
// Gut - wiederverwendbarer Validator
const validate_email = (value: any) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string) || "Invalid email";

class User extends Table<User> {
  @Validate(validate_email)
  declare email: string;
}
```

### 4. Klare Fehlermeldungen Bereitstellen

```typescript
// Gut - spezifische Fehlermeldungen
@Validate((value) => (value as string).length >= 8 || "Password must be at least 8 characters")
declare password: string;
```

### 5. NotNull für Erforderliche Felder Verwenden

```typescript
// Gut - erforderliche Felder explizit markieren
@NotNull()
@Validate(validate_email)
declare email: string;
```

## Häufige Validierungsmuster

### Kreditkartenvalidierung

```typescript
function validate_credit_card(value: any): boolean | string {
  const card = (value as string).replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(card)) {
    return "Credit card must be 13-19 digits";
  }
  // Luhn-Algorithmus implementierung...
  return true;
}
```

### Benutzernamenvalidierung

```typescript
function validate_username(value: any): boolean | string {
  const username = value as string;
  if (username.length < 3) return "Username too short (min 3)";
  if (username.length > 20) return "Username too long (max 20)";
  if (!/^[a-z0-9_]+$/.test(username)) {
    return "Username: lowercase, numbers, underscore only";
  }
  return true;
}
```

### Datumsvalidierung

```typescript
function validate_future_date(value: any): boolean | string {
  const date = new Date(value as string);
  if (isNaN(date.getTime())) return "Invalid date format";
  if (date <= new Date()) return "Date must be in the future";
  return true;
}
```

## Nächste Schritte

### Verwandte Dokumentation

- [Beispiel für Grundlegendes Modell](./basic-model.de.md) - Einfache CRUD-Operationen
- [Beziehungsbeispiel](./relationships.de.md) - Eins-zu-Viele- und Viele-zu-Eins-Beziehungen
- [Beispiel für Fortgeschrittene Abfragen](./advanced-queries.de.md) - Komplexe Abfragen und Filterung

Viel Erfolg beim Validieren mit Dynamite!
