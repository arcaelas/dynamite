# Änderungsprotokoll

Alle wichtigen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
und dieses Projekt hält sich an [Semantische Versionierung](https://semver.org/spec/v2.0.0.html).

## [3.3.0] - 2026-09-07

### Hinzugefügt

- **Cursor-Paginierung**: `where()` gibt die Instanzen mit einer nicht aufzählbaren Eigenschaft `cursor` zurück, sobald ein `limit` gesetzt ist. Wird sie als `{ cursor }` zurückgegeben, wird nur die nächste Seite gelesen, während `skip` auf jeder Seite alles Vorherige liest und verwirft.
- **`createMany(zeilen, options?)`**: legt mehrere Datensätze mit `BatchWriteItem` an, 25 pro Anfrage, und wiederholt, was DynamoDB unverarbeitet lässt. Doppelte Primärschlüssel lassen sich nicht prüfen, `BatchWriteItem` kennt diese Bedingung nicht.
- **`deleteMany(ids, options?)`**: löscht über den Primärschlüssel, ohne die Datensätze vorher zu lesen. Immer endgültig und ohne Hooks.
- **Abfrageoption `deleted`**: ersetzt `_includeTrashed`, das als veralteter Alias weiterhin funktioniert.
- **Option `where` auf oberster Ebene**: die Filter aus `WhereOptions.where` werden jetzt mit denen des ersten Arguments zusammengeführt. Bisher wurden sie stillschweigend ignoriert.
- **Neue öffentliche Typen**: `QueryResult<M>`, `DynamiteConfig`.

### Geändert

- **Lesezugriffe über den Primärschlüssel nutzen `GetItem` und `BatchGetItem`**: ein `=` auf den Primärschlüssel ist ein einziges `GetItem`, ein `in` ein `BatchGetItem` mit 100 Schlüsseln pro Anfrage statt einer `Query` je Wert. Jeder zusätzliche Filter wird auf dem bereits gelesenen Item ausgewertet, die Abfrage bleibt also eine einzige Anfrage.
- **`limit` bricht die Lesung ab**: die Paginierung stoppt, sobald genug Datensätze zusammen sind, und das Limit reist als `Limit` zu DynamoDB, wenn serverseitig nichts mehr zu filtern ist. `first()` liest nicht mehr die ganze Tabelle.
- **Paralleler `Scan`**: eine Lesung ohne `limit`, die in einem `Scan` endet, wird in vier Segmente geteilt. Dieselben Leseeinheiten, ein Bruchteil der Latenz. Ohne `order` ist die Reihenfolge beliebig, wie schon zuvor.
- **Native Sortierung über den Sort Key**: eine `Query` auf den Primärschlüssel, sortiert nach der `@IndexSort`-Spalte, nutzt `ScanIndexForward` statt im Speicher zu sortieren.
- **`update()` über den Primärschlüssel schreibt ohne zu lesen**: ein einziges `UpdateItem` mit den berührten Feldern, unter der Bedingung, dass der Datensatz existiert, sofern kein `@Set` und kein `@Validate` dieser Felder das Argument `current` deklariert. Das `update()` der Instanz tut dasselbe mit den Werten, die sie bereits hält.
- **Batch-Schreibvorgänge**: `delete()`, das Massen-`update()`, das `sync()` einer Beziehung, `createMany()` und `deleteMany()` schreiben in Blöcken von 25.
- **Pivot-Tabellen werden abgefragt, nie gescannt**: `attach()`, `detach()`, das `sync()` der Instanz und das Laden eines `@ManyToMany` gehen über den GSI `<fremdschlüssel>_index` der Pivot-Tabelle und fallen nur dann auf einen `Scan` zurück, wenn dieser Index nicht existiert.
- **Abhängigkeiten**: `pluralize`, `uuid`, `@arcaelas/utils` und `@aws-sdk/lib-dynamodb` waren deklariert, wurden aber nie importiert, und sind entfernt. `@aws-sdk/util-dynamodb` wurde ohne Deklaration importiert und ist jetzt eine Abhängigkeit. Das AWS SDK wechselte von einer festen Version zu `^3.329.0` und wird so mit der Kopie des Konsumenten dedupliziert.

### Behoben

- Der mit `@Name` umbenannte Primärschlüssel eines Modells wird jetzt in `delete`, `forceDestroy`, `increment` und `decrement` korrekt verwendet.
- Dokumentation: `withTrashed()`, `onlyTrashed()`, `relationDecorator()`, `ColumnBuilder` und `WrapperEntry` waren dokumentiert und existieren nicht. Die Signatur von `@BelongsTo` war mit vertauschten Argumenten dokumentiert. `connect()` galt als Erzeuger der Tabellen, was `sync()` tut. Die Schreib-Pipeline galt als `(current, next)`, obwohl sie `(next, current)` erhält.

## [3.2.1] - 2026-09-03

### Behoben

- **Typisierung von `WhereFilters`**: `in`/`$in` akzeptieren jetzt ein Array des Spaltentyps (`{ role: { $in: ["user", "assistant"] } }`); zuvor verlangte der Typ einen einzelnen Wert und TypeScript wies gültige Filter zurück.

## [3.2.0] - 2026-09-03

### Geändert

- **`@PrimaryKey`** akzeptiert jede nicht leere Zeichenkette als id. Ohne Angabe wird weiterhin eine ULID erzeugt, aber vorhandene UUID- oder eigene Schlüssel werfen kein `Invalid ULID` mehr.
- **`@Index`-Spalten sind GSIs**: `connect()` registriert jede `@Index`-Spalte, die nicht der Primärschlüssel ist, als GSI `<feld>_index`, und `sync()` erstellt ihn, sodass `where`/`first` auf diesen Feldern `QueryCommand` verwenden. Zuvor wurden nur die Fremdschlüssel von `@HasMany`/`@HasOne` berücksichtigt.
- **`$in` auf dem Primärschlüssel oder einem GSI führt einen `QueryCommand` je unterschiedlichem Wert aus** statt eines vollständigen `ScanCommand` mit `OR`-Filter. Das Laden von Beziehungen (`include`) profitiert automatisch.

### Behoben

- Die Erkennung des Primärschlüssels bevorzugt die `@PrimaryKey`-Spalte gegenüber der ersten `@Index`-Spalte.
- Die Selbstheilung nach einem fehlenden GSI entfernt jetzt den Datenbanknamen der Spalte aus der GSI-Registrierung.

## [3.0.0] - 2026-06-06

### Inkompatible Änderungen

- **Vereinheitlichte Mutations-Optionen**: Die statischen Methoden `create`, `update`, `delete`, `increment`, `decrement` sowie die Instanzmethoden `save`, `update`, `destroy`, `forceDestroy` erhalten als letztes Argument ein `options`-Objekt vom Typ `MutationOptions = { hook?: boolean; tx?: TransactionContext }`. Das positionelle `tx`-Argument wurde entfernt. Vorher: `User.create(data, tx)` → jetzt: `User.create(data, { tx })`. Vorher: `order.destroy(tx)` → jetzt: `order.destroy({ tx })`.

### Hinzugefügt

- **Lifecycle-Hooks**: Sechs neue Methoden-Dekoratoren für Instanzen — `@BeforeCreate`, `@AfterCreate`, `@BeforeUpdate`, `@AfterUpdate`, `@BeforeDestroy`, `@AfterDestroy`. Pro Operation opt-in über `{ hook: true }`. Innerhalb des Hooks ist `this` die Entität; die Update-Hooks erhalten das Delta als erstes Argument. Mehrere Hooks desselben Typs laufen in Deklarationsreihenfolge, async-Hooks werden awaited. Bei Massen-`update`/`delete` laufen die Hooks einmal pro betroffener Entität. `before*` läuft vor dem Persistieren, `after*` danach (in einer Transaktion nach dem Commit). `increment()`/`decrement()` akzeptieren `{ tx }`, lösen aber keine Hooks aus.
- **`TransactionContext.onCommit`** akzeptiert jetzt async-Callbacks.

## [2.0.0] - 2026-04-02

### Inkompatible Änderungen

- **Primitive Dekoratoren**: `@Get`, `@Set`, `@Validate` ersetzen `@Mutate`, `@Column`, `@Serialize` (entfernt).
- **`@Default`** von Get- in Set-Pipeline verschoben. Wird bei Konstruktion aufgelöst, nicht beim Lesen.
- **`@PrimaryKey`** generiert ULID statt UUID. Validiert ULID-Format. Unveränderlich nach erster Zuweisung.
- **`@NotNull`** ist Komposition von `@Validate`. `store.nullable` aus Schema entfernt.
- **`@UpdatedAt`** respektiert explizite Werte. Generiert `now()` nur wenn kein Wert übergeben wird.
- **`@BelongsTo`** Signatur vereinheitlicht zu `(model, foreignKey, localKey)`, wie `@HasMany`/`@HasOne`.
- **Set-Pipeline** Argumentreihenfolge von `(current, next)` zu `(next, current)` geändert.
- **Konstruktor** führt Setter für alle Felder aus, nicht nur für in Props vorhandene.
- **`connect()`** erstellt keine Tabellen mehr. Konfiguriert nur den DynamoDB-Client.
- **Entfernt**: `withTrashed()`, `onlyTrashed()`, `relationDecorator()`, `@Column`, `@Mutate`, `@Serialize`.
- **`where()`** wirft Fehler wenn Feld nicht in `schema.columns` existiert.

### Hinzugefügt

- **`sync()`**: erstellt Tabellen, GSIs und Pivot-Tabellen. Erkennt GSIs automatisch aus Relationen. Parallele Operationen mit Polling.
- **Intelligentes `where()`**: `QueryCommand` mit PK oder GSI, Fallback zu `ScanCommand`. Self-Healing wenn GSI nicht existiert.
- **`connect()`** berechnet erwartete GSIs aus Schemas ohne API-Aufrufe.
- **`update()`/`delete()` PK-Optimierung**: direktes `GetItemCommand`/`DeleteItemCommand`.
- **`increment()`/`decrement()`**: atomar via `UpdateItemCommand`. Statisch, Instanz und transaktional.
- **`create()` Eindeutigkeit**: `ConditionExpression: attribute_not_exists(pk)`.
- **ULID**: interner Generator ohne Abhängigkeiten. Monoton, sequentiell, lexikographisch sortierbar.
- **Transaktionen**: `addUpdate()`, `onCommit()`, `__isPersisted` nach Commit, Auto-Chunking in 25er-Batches.
- **Typisierung**: `Schema` mit echten Typen. `WhereOptions` mit rekursivem typisierten `include`. `PickByType<T, V>`. `order` akzeptiert Objekte.

### Behoben

- `@CreatedAt` setzt jetzt `store.createdAt = true` für Standard-Sortierung.
- Relationen-Cache vereinfacht mit Dirty-Flag.
- `processIncludes` weist via Setter zu.
- `_mapPropertiesToDB` entfernt (toter Code).
- `where()` Normalisierung vereinheitlicht.

### Tests

- 165 Tests gegen DynamoDB Local: Dekoratoren, CRUD, rekursive Relationen, ManyToMany, kombinierte Filter, Bulk 3000, Query vs Scan, Pipeline-Verträge, PK-Unveränderlichkeit, PK-Duplikate, ULID-Sequenzialität.

---

## [1.0.23] - 2025-12-13

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

- **v3.0.0** (Aktuell) - Lifecycle-Hooks (@Before/@After) und vereinheitlichte `{ hook, tx }`-Mutationsoptionen (Breaking: positionales `tx` entfernt)
- **v1.0.23** - Dokumentationslink-Korrekturen, TOC-Anker-Korrekturen, mehrsprachige Konsistenz
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
