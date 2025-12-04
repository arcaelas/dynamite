# Änderungsprotokoll

Alle bemerkenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
und dieses Projekt hält sich an [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unveröffentlicht]

### Geplant
- Leistungsoptimierungen für Batch-Operationen
- Zusätzliche Abfrageoperatoren und Filter
- Verbesserte Fehlerbehandlung und Debugging-Tools

---

## [1.0.17] - 2025-12-03

### Hinzugefügt
- `@Serialize(fromDB, toDB)` - Bidirektionaler Datentransformations-Decorator
- `@DeleteAt()` - Soft Delete Decorator mit Zeitstempel
- `Dynamite.tx()` - Atomare Transaktionen mit automatischem Rollback
- `TransactionContext` Klasse zur Verwaltung transaktionaler Operationen
- `withTrashed()` Methode zum Einschließen soft-gelöschter Datensätze
- `onlyTrashed()` Methode zum Abfragen nur soft-gelöschter Datensätze
- Unterstützung für `null` als Fallback in `@Serialize` Parametern

### Geändert
- Verbesserte `destroy()` Methode unterstützt Soft Delete wenn `@DeleteAt` vorhanden
- `destroy()` akzeptiert jetzt optionalen `TransactionContext` Parameter für transaktionale Operationen
- Verbesserte Dokumentation mit `@Serialize` und `@DeleteAt` Beispielen
- Decorator-Dokumentation konsolidiert in `/guides/decorators.md`

### Entfernt
- `/api/decorators/` Verzeichnis (21 Dateien) - Inhalt in `/guides/decorators.md` zusammengeführt

### Dokumentation
- Umfassende `@Serialize` Dokumentation mit Verschlüsselungs- und Komprimierungsbeispielen
- `@DeleteAt` Dokumentation mit Papierkorb-System-Mustern
- `Dynamite.tx()` Transaktions-API Dokumentation
- Aktualisierte Modellbeispiele mit neuen Decorators
- Konsolidierte mehrsprachige Dokumentation (EN/ES/DE)

---

## [1.0.13] - 2025-10-13

### Aktuelle Version
Dies ist die aktuelle stabile Version von @arcaelas/dynamite - ein modernes, Decorator-First ORM für DynamoDB mit vollständiger TypeScript-Unterstützung.

### Funktionen

#### Kernfunktionalität
- Vollständiges ORM mit Decorator-First-Ansatz
- Vollständige TypeScript-Unterstützung mit Typsicherheit
- Automatische Tabellenerstellung und -verwaltung
- Konfiguration ohne Boilerplate-Code

#### Decorators
- **Kern-Decorators**: `@PrimaryKey()`, `@Index()`, `@IndexSort()`, `@Name()`
- **Daten-Decorators**: `@Default()`, `@Mutate()`, `@Validate()`, `@NotNull()`
- **Zeitstempel-Decorators**: `@CreatedAt()`, `@UpdatedAt()`
- **Beziehungs-Decorators**: `@HasMany()`, `@BelongsTo()`

#### TypeScript-Typen
- `CreationOptional<T>` - Felder als optional während der Erstellung markieren
- `NonAttribute<T>` - Berechnete Eigenschaften von der Datenbank ausschließen
- `HasMany<T>` - Eins-zu-viele-Beziehungen
- `BelongsTo<T>` - Viele-zu-eins-Beziehungen
- `InferAttributes<T>` - Typinferenz für Modellattribute

#### Abfrageoperationen
- Grundlegende CRUD-Operationen (erstellen, lesen, aktualisieren, löschen)
- Erweiterte Abfrageoperatoren: `=`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not-in`, `contains`, `begins-with`
- Paginierungsunterstützung mit `limit` und `skip`
- Sortierung mit `order` (ASC/DESC)
- Attributauswahl mit `attributes`-Array
- Komplexe Filterung mit mehreren Bedingungen

#### Beziehungen
- Eins-zu-viele-Beziehungen über `@HasMany()`
- Viele-zu-eins-Beziehungen über `@BelongsTo()`
- Verschachtelte Beziehungsladung mit `include`
- Gefilterte Beziehungsabfragen
- Rekursive Beziehungsunterstützung

#### Datenvalidierung & Transformation
- Feldvalidierung mit benutzerdefinierten Validatoren
- Datenmutation/-transformation vor dem Speichern
- Mehrstufige Validierungsketten
- Not-Null-Einschränkungen
- E-Mail-, Alters- und benutzerdefinierte Formatvalidierung

#### Konfiguration
- AWS DynamoDB-Verbindungsunterstützung
- DynamoDB Local-Entwicklungsunterstützung
- Benutzerdefinierte Endpunktkonfiguration
- Flexible Anmeldeinformationsverwaltung
- Umgebungsvariablenunterstützung

### Abhängigkeiten
- `@aws-sdk/client-dynamodb`: ^3.329.0
- `@aws-sdk/lib-dynamodb`: ^3.329.0
- `pluralize`: ^8.0.0
- `uuid`: ^11.1.0

### Dokumentation
- Umfassende README mit Beispielen
- TypeScript-Typen-Dokumentation
- API-Referenzhandbuch
- Entwicklungs-Setup-Anweisungen
- Fehlerbehebungshandbuch
- Best Practices und Leistungstipps

---

## [1.0.0] - Erstveröffentlichung

### Hinzugefügt
- Erstveröffentlichung von @arcaelas/dynamite
- Implementierung der Basis-Table-Klasse
- Kern-Decorator-System
- DynamoDB-Client-Wrapper
- Metadaten-Verwaltungssystem
- Grundlegende CRUD-Operationen
- Query-Builder-Funktionalität
- Grundlage für Beziehungsunterstützung
- TypeScript-Definitionen
- Jest-Testing-Setup

---

## Zusammenfassung der Versionshistorie

- **v1.0.13** (Aktuell) - Stabile Version mit vollständigem Funktionsumfang
- **v1.0.0** - Erste öffentliche Version

---

## Links

- **Repository**: https://github.com/arcaelas/dynamite
- **Issues**: https://github.com/arcaelas/dynamite/issues
- **NPM-Paket**: https://www.npmjs.com/package/@arcaelas/dynamite
- **Autor**: [Arcaelas Insiders](https://github.com/arcaelas)

---

## Migrationsleitfäden

### Upgrade auf v1.0.13

Keine Breaking Changes seit v1.0.0. Alle Funktionen sind abwärtskompatibel.

---

## Beiträge

Siehe [GitHub-Repository](https://github.com/arcaelas/dynamite#contributing) für Beitragsrichtlinien.

---

**Hinweis**: Für detaillierte Verwendungsbeispiele und API-Dokumentation lesen Sie bitte das [GitHub-Repository](https://github.com/arcaelas/dynamite).
