# Registro de Cambios

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/spec/v2.0.0.html).

## [3.4.0] - 2026-09-08

### Agregado

- **Paginación por cursor**: `where()` devuelve las instancias con una propiedad `cursor` no enumerable siempre que se pida un `limit`. Pasarla de vuelta como `{ cursor }` lee solo la página siguiente, mientras que `skip` lee y descarta todo lo anterior en cada página.
- **`createMany(filas, options?)`**: crea varios registros con `BatchWriteItem`, 25 por petición, reintentando lo que DynamoDB deje sin procesar. No puede comprobar claves primarias duplicadas, que `BatchWriteItem` no admite.
- **`deleteMany(ids, options?)`**: elimina por clave primaria sin leer los registros antes. Siempre es borrado definitivo y no ejecuta hooks.
- **Opción de consulta `deleted`**: sustituye a `_includeTrashed`, que sigue funcionando como alias obsoleto.
- **Opción `where` de nivel superior**: los filtros de `WhereOptions.where` ahora se suman a los del primer argumento. Hasta ahora se ignoraban en silencio.
- **Tipos públicos nuevos**: `QueryResult<M>`, `DynamiteConfig`.

### Cambiado

- **Las lecturas por clave primaria usan `GetItem` y `BatchGetItem`**: un `=` sobre la clave primaria es un solo `GetItem`, y un `in` es un `BatchGetItem` de 100 claves por petición, en lugar de una `Query` por valor. Cualquier filtro extra se evalúa sobre el item ya leído, así que la consulta sigue siendo una sola petición.
- **`limit` corta la lectura**: la paginación se detiene en cuanto reúne los registros pedidos, y el límite viaja a DynamoDB como `Limit` cuando no queda nada que filtrar en el servidor. `first()` ya no lee la tabla entera.
- **`Scan` paralelo**: una lectura sin `limit` que termina en `Scan` se parte en cuatro segmentos. Las mismas unidades de lectura y una fracción de la latencia. Sin `order`, el orden resultante es arbitrario, como ya lo era.
- **Orden nativo por sort key**: una `Query` por clave primaria ordenada por la columna `@IndexSort` usa `ScanIndexForward` en vez de ordenar en memoria.
- **`update()` por clave primaria escribe sin leer**: un solo `UpdateItem` con los campos tocados, condicionado a que el registro exista, siempre que ningún `@Set` ni `@Validate` de esos campos declare el argumento `current`. El `update()` de instancia hace lo mismo con los valores que ya tiene.
- **Escrituras por lotes**: `delete()`, el `update()` masivo, el `sync()` de una relación, `createMany()` y `deleteMany()` escriben en lotes de 25.
- **Las tablas pivote se consultan, nunca se escanean**: `attach()`, `detach()`, el `sync()` de instancia y la carga de un `@ManyToMany` usan el GSI `<clave_foranea>_index` del pivote, y solo caen a un `Scan` cuando ese índice no existe.
- **Dependencias**: `pluralize`, `uuid`, `@arcaelas/utils` y `@aws-sdk/lib-dynamodb` estaban declaradas y nunca se importaban, y se eliminaron. `@aws-sdk/util-dynamodb` se importaba sin estar declarada, y ahora es dependencia. El SDK de AWS pasó de una versión fija a `^3.329.0`, para deduplicarse con la copia del consumidor.

### Corregido

- La clave primaria de un modelo renombrada con `@Name` ahora se usa correctamente en `delete`, `forceDestroy`, `increment` y `decrement`.
- Documentación: `withTrashed()`, `onlyTrashed()`, `relationDecorator()`, `ColumnBuilder` y `WrapperEntry` estaban documentados y no existen. La firma de `@BelongsTo` estaba documentada con los argumentos invertidos. `connect()` figuraba como creador de tablas, que es lo que hace `sync()`. El pipeline de escritura figuraba como `(current, next)` cuando recibe `(next, current)`.

## [3.2.1] - 2026-09-03

### Correcciones

- **Tipado de `WhereFilters`**: `in`/`$in` aceptan un arreglo del tipo de la columna (`{ role: { $in: ["user", "assistant"] } }`); antes el tipo exigía un valor único y TypeScript rechazaba filtros válidos.

## [3.2.0] - 2026-09-03

### Cambios

- **`@PrimaryKey`** acepta cualquier id string no vacío. Sigue generando ULID cuando no se pasa id, pero las claves UUID (u otras) ya almacenadas dejan de lanzar `Invalid ULID`.
- **Las columnas `@Index` son GSI**: `connect()` registra cada `@Index` que no sea la PK como GSI `<campo>_index` y `sync()` lo crea, así `where`/`first` sobre esos campos usan `QueryCommand`. Antes solo contaban las claves foráneas de `@HasMany`/`@HasOne`.
- **`$in` sobre la PK o un GSI ejecuta una `QueryCommand` por valor distinto** en vez de un `ScanCommand` completo con filtro `OR`. La carga de relaciones (`include`) se beneficia automáticamente.

### Correcciones

- La detección de la PK prioriza la columna `@PrimaryKey` sobre la primera `@Index`.
- El self-healing tras un GSI inexistente elimina del registro el nombre de base de datos de la columna.

## [3.0.0] - 2026-06-06

### Cambios Incompatibles

- **Opciones de mutación unificadas**: los métodos de mutación (`create`, `update`, `delete`, `save`, `destroy`, `increment`, `decrement`) reciben un objeto `options` de tipo `{ hook?: boolean; tx?: TransactionContext }` como último argumento. Se eliminó el parámetro posicional `tx`; ahora se usa `{ tx }` (por ejemplo, `User.create(data, { tx })` y `order.destroy({ tx })`).

### Agregado

- **Lifecycle hooks**: seis decoradores de método de instancia (`@BeforeCreate`, `@AfterCreate`, `@BeforeUpdate`, `@AfterUpdate`, `@BeforeDestroy`, `@AfterDestroy`). Son opt-in por operación con `{ hook: true }`. Dentro del hook, `this` es la entidad y los hooks de actualización reciben el delta de cambios como primer argumento. Varios hooks del mismo tipo corren en orden de declaración y los async se esperan con `await`. En `update`/`delete` masivos corren una vez por entidad afectada. Los `before*` se ejecutan antes de persistir y los `after*` después (tras el commit dentro de una transacción). `increment()`/`decrement()` aceptan `{ tx }` pero no disparan hooks.
- **`TransactionContext.onCommit`** ahora acepta callbacks async.

---

## [2.0.0] - 2026-04-02

### Cambios Incompatibles

- **Decoradores primitivos**: `@Get`, `@Set`, `@Validate` reemplazan a `@Mutate`, `@Column`, `@Serialize` (eliminados).
- **`@Default`** movido del get al set pipeline. Se resuelve en la construccion, no en la lectura.
- **`@PrimaryKey`** genera ULID en vez de UUID. Valida formato ULID. Inmutable despues de la primera asignacion.
- **`@NotNull`** es composicion de `@Validate`. Eliminado `store.nullable` del schema.
- **`@UpdatedAt`** respeta valores explicitos. Solo genera `now()` cuando no se pasa valor.
- **`@BelongsTo`** firma unificada a `(model, foreignKey, localKey)`, igual que `@HasMany`/`@HasOne`.
- **Set pipeline** orden de argumentos cambiado de `(current, next)` a `(next, current)`.
- **Constructor** ejecuta setters para todos los campos, no solo los presentes en props.
- **`connect()`** ya no crea tablas. Solo configura el cliente DynamoDB.
- **Eliminados**: `withTrashed()`, `onlyTrashed()`, `relationDecorator()`, `@Column`, `@Mutate`, `@Serialize`.
- **`where()`** lanza error si el campo no existe en `schema.columns`.

### Agregado

- **`sync()`**: crea tablas, GSIs y pivot tables. Detecta GSIs desde relaciones. Operaciones en paralelo con polling.
- **`where()` inteligente**: `QueryCommand` con PK o GSI, fallback a `ScanCommand`. Self-healing si GSI no existe.
- **`connect()`** computa GSIs esperados desde schemas sin llamadas API.
- **`update()`/`delete()` por PK**: `GetItemCommand`/`DeleteItemCommand` directo.
- **`increment()`/`decrement()`**: atomicos con `UpdateItemCommand`. Estatico, instancia y transaccional.
- **`create()` con unicidad**: `ConditionExpression: attribute_not_exists(pk)`.
- **ULID**: generador interno sin dependencias. Monotónico, secuencial, lexicograficamente ordenable.
- **Transacciones**: `addUpdate()`, `onCommit()`, `__isPersisted` post-commit, auto-chunking en lotes de 25.
- **Tipado**: `Schema` con tipos reales. `WhereOptions` con `include` recursivo. `PickByType<T, V>`. `order` acepta objetos.

### Corregido

- `@CreatedAt` setea `store.createdAt = true` para sort default.
- Cache de relaciones simplificado con dirty flag.
- `processIncludes` asigna via setter.
- `_mapPropertiesToDB` eliminado (dead code).
- Normalización de `where()` unificada.

### Tests

- 165 tests contra DynamoDB Local: decoradores, CRUD, relaciones recursivas, ManyToMany, filtros combinados, bulk 3000, Query vs Scan, contratos de pipeline, PK immutability, PK duplicado, ULID secuencialidad.

---

## [1.0.23] - 2025-12-13

### Corregido
- **mkdocs.yml**: Corregida la estructura de navegación que apuntaba a rutas inexistentes (`guides/`, `api/`)
- **Anclas TOC**: Corregidos 47 enlaces de anclas rotos en archivos de documentación ES/DE
  - Eliminados acentos de anclas (`#introducción` → `#introduccion`)
  - Corregidos anclas con triple guión (`#primarykey---claves` → `#primarykey-claves`)
- **docs/index.es.md, docs/index.de.md**: Corregidos enlaces de página de inicio a rutas correctas
- **docs/installation.*.md**: Corregidos enlaces de referencia API (`./api/table.md` → `./references/table.md`)
- **docs/getting-started.*.md**: Corregidos enlaces de core-concepts y ejemplos
- **docs/references/client.*.md**: Corregido formato de enlace de decoradores (`./decorators/` → `./decorators.md`)
- **docs/references/decorators.de.md**: Eliminadas entradas TOC para secciones inexistentes (archivo incompleto)
- **docs/examples/relations.*.md**: Corregidos enlaces de referencia de decoradores a anclas correctas
- **docs/examples/advanced.*.md**: Corregido enlace de referencia cruzada de core-concepts

### Documentación
- Resueltas todas las advertencias de compilación de MkDocs (de 47 a 0 enlaces rotos)
- Mejorada la consistencia de documentación multilingüe (EN/ES/DE)
- Corregida la barra de navegación alemana que aparecía en páginas 404 debido a rutas de enlaces incorrectas

---

## [1.0.20] - 2025-12-12

### Agregado
- `API.md` - Documentación completa de la API cubriendo decoradores, esquemas y métodos
- `docs/references/table.md` - Referencia completa de la API de la clase Table en inglés
- `docs/references/types.md` - Documentación completa de tipos TypeScript en inglés
- `src/@types/index.ts` - Definiciones de tipos TypeScript centralizadas para mejor inferencia
- `eslint.config.js` - Configuración de ESLint para calidad de código consistente
- `scripts/generate_seed.ts` - Script utilitario para generar datos de prueba
- `scripts/load_seed.ts` - Script utilitario para cargar datos de prueba en DynamoDB
- `tsx.config.json` - Configuración de runtime TSX para desarrollo

### Cambiado
- Reorganizada la estructura de documentación de `guides/`, `api/`, `advanced/` a un directorio unificado `references/`
- Renombrados archivos de ejemplos para consistencia: `basic-model` → `basic`, `advanced-queries` → `advanced`, `relationships` → `relations`
- Movido `getting-started.md` de `guides/` a la raíz de documentación para acceso más fácil
- Actualizados ~40 enlaces internos de documentación para coincidir con la nueva estructura
- Simplificada la navegación en `index.md` con jerarquía más limpia
- Nombres de archivo de changelog en minúsculas para consistencia multiplataforma
- Refactorizado `src/core/table.ts` con manejo de consultas y carga de relaciones mejorado
- Mejorado `src/core/decorator.ts` con pipelines getter/setter optimizados
- Mejorado `src/core/client.ts` con mejor manejo de conexión a DynamoDB
- Optimizados todos los decoradores en `src/decorators/*.ts` para mejor rendimiento
- Refactorizado `src/utils/relations.ts` con lógica de resolución de relaciones más limpia
- Actualizado `src/index.ts` exports para estructura de módulo simplificada
- Reducido el archivo de pruebas `src/index.test.ts` para ejecución más rápida
- Actualizado `package.json` con scripts y dependencias mejorados
- Limpiado `yarn.lock` eliminando entradas de dependencias redundantes

### Eliminado
- `docs/examples/validation.*` - Ejemplos redundantes, contenido fusionado en ejemplos `basic`
- `docs/guides/relationships.*` - Contenido duplicado, consolidado en ejemplos `relations`
- `docs/api/table.md` y `docs/api/types.md` - Reemplazados con nuevas versiones en inglés en `references/`
- `src/core/method.ts` - Funcionalidad consolidada en `table.ts`

### Corregido
- Corregido el idioma de `table.md` y `types.md` (estaban incorrectamente en español, ahora correctamente en inglés)
- Corregidos todos los enlaces internos rotos en 39 archivos de documentación
- Resueltas convenciones de nomenclatura de archivos inconsistentes en directorio de ejemplos

### Rendimiento
- Reducida la complejidad del archivo de pruebas para ejecución más rápida de CI/CD
- Optimizado yarn.lock con -2873 líneas de entradas redundantes
- Reducción neta del código base de -9220 líneas manteniendo la funcionalidad

### Documentación
- Reestructuración completa de documentación siguiendo: Inicio → Instalación → Ejemplos → Referencias → Changelog
- Soporte multilingüe mantenido (EN/ES/DE) en todos los archivos de documentación
- Mejoradas las referencias cruzadas entre secciones de documentación relacionadas

---

## [1.0.17] - 2025-12-03

### Agregado
- `@Serialize(fromDB, toDB)` - Decorador de transformación de datos bidireccional
- `@DeleteAt()` - Decorador de eliminación suave con marca de tiempo
- `Dynamite.tx()` - Transacciones atómicas con rollback automático
- Clase `TransactionContext` para gestionar operaciones transaccionales
- Método `withTrashed()` para incluir registros eliminados suavemente
- Método `onlyTrashed()` para consultar solo registros eliminados suavemente
- Soporte para `null` como respaldo en parámetros de `@Serialize`

### Cambiado
- Mejorado el método `destroy()` para soportar eliminación suave cuando `@DeleteAt` está presente
- `destroy()` ahora acepta parámetro opcional `TransactionContext` para operaciones transaccionales
- Documentación mejorada con ejemplos de `@Serialize` y `@DeleteAt`
- Documentación de decoradores consolidada en `/guides/decorators.md`

### Eliminado
- Directorio `/api/decorators/` (21 archivos) - contenido fusionado en `/guides/decorators.md`

### Documentación
- Agregada documentación completa de `@Serialize` con ejemplos de encriptación y compresión
- Agregada documentación de `@DeleteAt` con patrones de sistema de papelera
- Agregada documentación de API de transacciones `Dynamite.tx()`
- Actualizados ejemplos de modelos para incluir nuevos decoradores
- Documentación multilingüe consolidada (EN/ES/DE)

---

## [1.0.13] - 2025-10-13

### Versión Actual
Esta es una versión estable de @arcaelas/dynamite - un ORM moderno basado en decoradores para DynamoDB con soporte completo de TypeScript.

### Características

#### Funcionalidad Principal
- ORM completo con enfoque basado en decoradores
- Soporte completo de TypeScript con seguridad de tipos
- Creación y gestión automática de tablas
- Configuración sin código repetitivo

#### Decoradores
- **Decoradores Principales**: `@PrimaryKey()`, `@Index()`, `@IndexSort()`, `@Name()`
- **Decoradores de Datos**: `@Default()`, `@Mutate()`, `@Validate()`, `@NotNull()`
- **Decoradores de Timestamp**: `@CreatedAt()`, `@UpdatedAt()`
- **Decoradores de Relaciones**: `@HasMany()`, `@BelongsTo()`

#### Tipos TypeScript
- `CreationOptional<T>` - Marcar campos como opcionales durante la creación
- `NonAttribute<T>` - Excluir propiedades computadas de la base de datos
- `HasMany<T>` - Relaciones uno-a-muchos
- `BelongsTo<T>` - Relaciones muchos-a-uno
- `InferAttributes<T>` - Inferencia de tipos para atributos del modelo

#### Operaciones de Consulta
- Operaciones CRUD básicas (crear, leer, actualizar, eliminar)
- Operadores de consulta avanzados: `=`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not-in`, `contains`, `begins-with`
- Soporte de paginación con `limit` y `skip`
- Ordenamiento con `order` (ASC/DESC)
- Selección de atributos con array `attributes`
- Filtrado complejo con múltiples condiciones

#### Relaciones
- Relaciones uno-a-muchos vía `@HasMany()`
- Relaciones muchos-a-uno vía `@BelongsTo()`
- Carga de relaciones anidadas con `include`
- Consultas de relaciones filtradas
- Soporte de relaciones recursivas

#### Validación y Transformación de Datos
- Validación de campos con validadores personalizados
- Mutación/transformación de datos antes de guardar
- Cadenas de validación de múltiples pasos
- Restricciones de no-nulo
- Validación de email, edad y formatos personalizados

#### Configuración
- Soporte de conexión AWS DynamoDB
- Soporte de desarrollo DynamoDB Local
- Configuración de endpoint personalizado
- Gestión flexible de credenciales
- Soporte de variables de entorno

### Dependencias
- `@aws-sdk/client-dynamodb`: ^3.329.0
- `@aws-sdk/lib-dynamodb`: ^3.329.0
- `pluralize`: ^8.0.0
- `uuid`: ^11.1.0

### Documentación
- README completo con ejemplos
- Documentación de tipos TypeScript
- Guía de referencia de API
- Instrucciones de configuración de desarrollo
- Guía de solución de problemas
- Mejores prácticas y consejos de rendimiento

---

## [1.0.0] - Versión Inicial

### Agregado
- Versión inicial de @arcaelas/dynamite
- Implementación de clase Table base
- Sistema de decoradores principal
- Wrapper de cliente DynamoDB
- Sistema de gestión de metadatos
- Operaciones CRUD básicas
- Funcionalidad de constructor de consultas
- Base de soporte de relaciones
- Definiciones TypeScript
- Configuración de pruebas Jest

---

## Resumen del Historial de Versiones

- **v3.0.0** (Actual) - Hooks de ciclo de vida (@Before/@After) y opciones de mutación unificadas `{ hook, tx }` (breaking: se eliminó el `tx` posicional)
- **v2.0.0** - Reestructuración completa: decoradores primitivos, ULID, Query inteligente, sync(), transacciones mejoradas
- **v1.0.23** - Corrección de enlaces de documentación, anclas TOC, consistencia multilingüe
- **v1.0.20** - Reestructuración de documentación, optimización del código base, creación de API.md
- **v1.0.17** - Agregado @Serialize, @DeleteAt, transacciones Dynamite.tx()
- **v1.0.13** - Versión estable con conjunto completo de características
- **v1.0.0** - Versión pública inicial

---

## Enlaces

- **Repositorio**: https://github.com/arcaelas/dynamite
- **Issues**: https://github.com/arcaelas/dynamite/issues
- **Paquete NPM**: https://www.npmjs.com/package/@arcaelas/dynamite
- **Autor**: [Arcaelas Insiders](https://github.com/arcaelas)

---

## Guías de Migración

### Actualización a v1.0.20

#### Enlaces de Documentación
Si tienes enlaces externos a la documentación, actualízalos:
- `docs/guides/getting-started.md` → `docs/getting-started.md`
- `docs/api/*` → `docs/references/*`
- `docs/guides/decorators.md` → `docs/references/decorators.md`
- `docs/examples/basic-model.md` → `docs/examples/basic.md`
- `docs/examples/advanced-queries.md` → `docs/examples/advanced.md`
- `docs/examples/relationships.md` → `docs/examples/relations.md`

Sin cambios que rompan la compatibilidad en la API. Todas las características son retrocompatibles.

### Actualización a v1.0.13

Sin cambios que rompan la compatibilidad desde v1.0.0. Todas las características son retrocompatibles.

---

## Contribuir

Ver [Repositorio de GitHub](https://github.com/arcaelas/dynamite#contributing) para guías de contribución.

---

**Nota**: Para ejemplos de uso detallados y documentación de API, por favor consulta el [Repositorio de GitHub](https://github.com/arcaelas/dynamite).
