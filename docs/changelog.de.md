# Änderungsprotokoll

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
und dieses Projekt hält sich an [Semantische Versionierung](https://semver.org/spec/v2.0.0.html).

## [Unveröffentlicht]

### Geplant
- Leistungsoptimierungen für Batch-Operationen
- Zusätzliche Abfrageoperatoren und Filter
- Verbesserte Fehlerbehandlung und Debugging-Tools

---

## [1.0.21] - 2025-12-13

### Behoben
- **mkdocs.yml**: Navigationsstruktur korrigiert, die auf nicht existierende Pfade verwies (`guides/`, `api/`)
- **TOC-Anker**: 47 defekte Ankerlinks in ES/DE-Dokumentationsdateien behoben
  - Akzente aus Ankern entfernt (`#introducción` → `#introduccion`)
  - Dreifach-Strich-Anker korrigiert (`#primarykey---claves` → `#primarykey-claves`)
- **docs/index.es.md, docs/index.de.md**: Startseiten-Links auf korrekte Pfade korrigiert
- **docs/installation.*.md**: API-Referenzlinks korrigiert (`./api/table.md` → `./references/table.md`)
- **docs/getting-started.*.md**: Core-Concepts- und Beispiel-Links korrigiert
- **docs/references/client.*.md**: Decorators-Linkformat korrigiert (`./decorators/` → `./decorators.md`)
- **docs/references/decorators.de.md**: TOC-Einträge für nicht existierende Abschnitte entfernt (Datei unvollständig)
- **docs/examples/relations.*.md**: Decorator-Referenzlinks auf korrekte Anker korrigiert
- **docs/examples/advanced.*.md**: Core-Concepts-Querverweislink korrigiert

### Dokumentation
- Alle MkDocs-Build-Warnungen behoben (von 47 auf 0 defekte Links)
- Mehrsprachige Dokumentationskonsistenz verbessert (EN/ES/DE)
- Deutsche Navigationsleiste auf 404-Seiten aufgrund falscher Linkpfade behoben

---

## [1.0.20] - 2025-12-12

### Hinzugefügt
- `API.md` - Umfassende API-Dokumentation zu Decorators, Schemas und Methoden
- `docs/references/table.md` - Vollständige Table-Klassen-API-Referenz auf Englisch
- `docs/references/types.md` - Vollständige TypeScript-Typen-Dokumentation auf Englisch
- `src/@types/index.ts` - Zentralisierte TypeScript-Typdefinitionen für bessere Typinferenz
- `eslint.config.js` - ESLint-Konfiguration für konsistente Codequalität
- `scripts/generate_seed.ts` - Hilfsskript zur Generierung von Testdaten
- `scripts/load_seed.ts` - Hilfsskript zum Laden von Testdaten in DynamoDB
- `tsx.config.json` - TSX-Laufzeitkonfiguration für Entwicklung

### Geändert
- Dokumentationsstruktur von `guides/`, `api/`, `advanced/` in einheitliches `references/`-Verzeichnis reorganisiert
- Beispieldateien für Konsistenz umbenannt: `basic-model` → `basic`, `advanced-queries` → `advanced`, `relationships` → `relations`
- `getting-started.md` von `guides/` in Dokumentationswurzel für einfacheren Zugriff verschoben
- ~40 interne Dokumentationslinks an neue Struktur angepasst
- Navigation in `index.md` mit sauberer Hierarchie vereinfacht
- Changelog-Dateinamen in Kleinbuchstaben für plattformübergreifende Konsistenz
- `src/core/table.ts` mit verbesserter Abfragebehandlung und Beziehungsladung refaktoriert
- `src/core/decorator.ts` mit optimierten Getter/Setter-Pipelines verbessert
- `src/core/client.ts` mit besserer DynamoDB-Verbindungsbehandlung verbessert
- Alle Decorators in `src/decorators/*.ts` für bessere Leistung optimiert
- `src/utils/relations.ts` mit sauberer Beziehungsauflösungslogik refaktoriert
- `src/index.ts`-Exports für vereinfachte Modulstruktur aktualisiert
- `src/index.test.ts`-Testsuite für schnellere Ausführung reduziert
- `package.json` mit verbesserten Skripten und Abhängigkeiten aktualisiert
- `yarn.lock` bereinigt und redundante Abhängigkeitseinträge entfernt

### Entfernt
- `docs/examples/validation.*` - Redundante Beispiele, Inhalt in `basic`-Beispiele zusammengeführt
- `docs/guides/relationships.*` - Doppelter Inhalt, in `relations`-Beispiele konsolidiert
- `docs/api/table.md` und `docs/api/types.md` - Durch neue englische Versionen in `references/` ersetzt
- `src/core/method.ts` - Funktionalität in `table.ts` konsolidiert

### Behoben
- Sprache von `table.md` und `types.md` korrigiert (waren fälschlicherweise auf Spanisch, jetzt korrekt auf Englisch)
- Alle defekten internen Dokumentationslinks in 39 Dateien behoben
- Inkonsistente Dateibenennungskonventionen im Beispielverzeichnis behoben

### Leistung
- Testkomplexität für schnellere CI/CD-Ausführung reduziert
- yarn.lock mit -2873 Zeilen redundanter Einträge optimiert
- Netto-Codebasisreduktion von -9220 Zeilen bei Erhaltung der Funktionalität

### Dokumentation
- Vollständige Dokumentationsumstrukturierung nach: Erste Schritte → Installation → Beispiele → Referenzen → Changelog
- Mehrsprachige Unterstützung (EN/ES/DE) in allen Dokumentationsdateien beibehalten
- Querverweise zwischen verwandten Dokumentationsabschnitten verbessert

---

## [1.0.17] - 2025-12-03

### Hinzugefügt
- `@Serialize(fromDB, toDB)` - Bidirektionaler Datentransformations-Decorator
- `@DeleteAt()` - Soft-Delete-Decorator mit Zeitstempel
- `Dynamite.tx()` - Atomare Transaktionen mit automatischem Rollback
- `TransactionContext`-Klasse zur Verwaltung transaktionaler Operationen
- `withTrashed()`-Methode zum Einschließen soft-gelöschter Datensätze
- `onlyTrashed()`-Methode zur Abfrage nur soft-gelöschter Datensätze
- Unterstützung für `null` als Fallback in `@Serialize`-Parametern

### Geändert
- `destroy()`-Methode verbessert zur Unterstützung von Soft-Delete wenn `@DeleteAt` vorhanden ist
- `destroy()` akzeptiert jetzt optionalen `TransactionContext`-Parameter für transaktionale Operationen
- Verbesserte Dokumentation mit `@Serialize`- und `@DeleteAt`-Beispielen
- Decorator-Dokumentation in `/guides/decorators.md` konsolidiert

### Entfernt
- `/api/decorators/`-Verzeichnis (21 Dateien) - Inhalt in `/guides/decorators.md` zusammengeführt

### Dokumentation
- Umfassende `@Serialize`-Dokumentation mit Verschlüsselungs- und Komprimierungsbeispielen hinzugefügt
- `@DeleteAt`-Dokumentation mit Papierkorb-Systemmustern hinzugefügt
- `Dynamite.tx()`-Transaktions-API-Dokumentation hinzugefügt
- Modellbeispiele mit neuen Decorators aktualisiert
- Mehrsprachige Dokumentation (EN/ES/DE) konsolidiert

---

## [1.0.13] - 2025-10-13

### Aktuelle Version
Dies ist eine stabile Version von @arcaelas/dynamite - ein modernes, Decorator-first ORM für DynamoDB mit vollständiger TypeScript-Unterstützung.

### Funktionen

#### Kernfunktionalität
- Vollwertiges ORM mit Decorator-first-Ansatz
- Vollständige TypeScript-Unterstützung mit Typsicherheit
- Automatische Tabellenerstellung und -verwaltung
- Konfiguration ohne Boilerplate

#### Decorators
- **Kern-Decorators**: `@PrimaryKey()`, `@Index()`, `@IndexSort()`, `@Name()`
- **Daten-Decorators**: `@Default()`, `@Mutate()`, `@Validate()`, `@NotNull()`
- **Zeitstempel-Decorators**: `@CreatedAt()`, `@UpdatedAt()`
- **Beziehungs-Decorators**: `@HasMany()`, `@BelongsTo()`

#### TypeScript-Typen
- `CreationOptional<T>` - Felder bei Erstellung als optional markieren
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
- Datenmutation/Transformation vor dem Speichern
- Mehrstufige Validierungsketten
- Nicht-null-Einschränkungen
- E-Mail-, Alters- und benutzerdefinierte Formatvalidierung

#### Konfiguration
- AWS DynamoDB-Verbindungsunterstützung
- DynamoDB Local-Entwicklungsunterstützung
- Benutzerdefinierte Endpoint-Konfiguration
- Flexible Anmeldedatenverwaltung
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
- Basis-Table-Klassen-Implementierung
- Kern-Decorator-System
- DynamoDB-Client-Wrapper
- Metadaten-Verwaltungssystem
- Grundlegende CRUD-Operationen
- Query-Builder-Funktionalität
- Beziehungsunterstützungs-Grundlage
- TypeScript-Definitionen
- Jest-Test-Setup

---

## Versionsverlauf-Zusammenfassung

- **v1.0.21** (Aktuell) - Dokumentationslink-Korrekturen, TOC-Anker-Korrekturen, mehrsprachige Konsistenz
- **v1.0.20** - Dokumentationsumstrukturierung, Codebasis-Optimierung, API.md-Erstellung
- **v1.0.17** - @Serialize, @DeleteAt, Dynamite.tx()-Transaktionen hinzugefügt
- **v1.0.13** - Stabile Version mit vollständigem Funktionsumfang
- **v1.0.0** - Erste öffentliche Veröffentlichung

---

## Links

- **Repository**: https://github.com/arcaelas/dynamite
- **Issues**: https://github.com/arcaelas/dynamite/issues
- **NPM-Paket**: https://www.npmjs.com/package/@arcaelas/dynamite
- **Autor**: [Arcaelas Insiders](https://github.com/arcaelas)

---

## Migrationshandbücher

### Upgrade auf v1.0.20

#### Dokumentationslinks
Wenn Sie externe Links zur Dokumentation haben, aktualisieren Sie diese:
- `docs/guides/getting-started.md` → `docs/getting-started.md`
- `docs/api/*` → `docs/references/*`
- `docs/guides/decorators.md` → `docs/references/decorators.md`
- `docs/examples/basic-model.md` → `docs/examples/basic.md`
- `docs/examples/advanced-queries.md` → `docs/examples/advanced.md`
- `docs/examples/relationships.md` → `docs/examples/relations.md`

Keine Breaking Changes an der API. Alle Funktionen sind abwärtskompatibel.

### Upgrade auf v1.0.13

Keine Breaking Changes seit v1.0.0. Alle Funktionen sind abwärtskompatibel.

---

## Mitwirken

Siehe [GitHub-Repository](https://github.com/arcaelas/dynamite#contributing) für Beitragsrichtlinien.

---

**Hinweis**: Für detaillierte Verwendungsbeispiele und API-Dokumentation besuchen Sie bitte das [GitHub-Repository](https://github.com/arcaelas/dynamite).
