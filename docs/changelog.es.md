# Registro de Cambios

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/spec/v2.0.0.html).

## [Sin Publicar]

### Planificado
- Optimizaciones de rendimiento para operaciones en lote
- Operadores y filtros de consulta adicionales
- Herramientas mejoradas de manejo de errores y depuración

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

- **v1.0.20** (Actual) - Reestructuración de documentación, optimización del código base, creación de API.md
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
