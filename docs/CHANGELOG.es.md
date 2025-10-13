# Registro de Cambios

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto se adhiere al [Versionado Semántico](https://semver.org/spec/v2.0.0.html).

## [Sin Publicar]

### Planificado
- Soporte mejorado de transacciones para operaciones complejas
- Optimizaciones de rendimiento para operaciones por lotes
- Operadores de consulta y filtros adicionales
- Herramientas mejoradas de manejo de errores y depuración

---

## [1.0.13] - 2025-10-13

### Versión Actual
Esta es la versión estable actual de @arcaelas/dynamite - un ORM moderno, centrado en decoradores para DynamoDB con soporte completo de TypeScript.

### Características

#### Funcionalidad Principal
- ORM completo con enfoque centrado en decoradores
- Soporte completo de TypeScript con seguridad de tipos
- Creación y gestión automática de tablas
- Configuración sin código repetitivo

#### Decoradores
- **Decoradores Principales**: `@PrimaryKey()`, `@Index()`, `@IndexSort()`, `@Name()`
- **Decoradores de Datos**: `@Default()`, `@Mutate()`, `@Validate()`, `@NotNull()`
- **Decoradores de Marca de Tiempo**: `@CreatedAt()`, `@UpdatedAt()`
- **Decoradores de Relaciones**: `@HasMany()`, `@BelongsTo()`

#### Tipos TypeScript
- `CreationOptional<T>` - Marcar campos como opcionales durante la creación
- `NonAttribute<T>` - Excluir propiedades computadas de la base de datos
- `HasMany<T>` - Relaciones uno a muchos
- `BelongsTo<T>` - Relaciones muchos a uno
- `InferAttributes<T>` - Inferencia de tipos para atributos del modelo

#### Operaciones de Consulta
- Operaciones CRUD básicas (crear, leer, actualizar, eliminar)
- Operadores de consulta avanzados: `=`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not-in`, `contains`, `begins-with`
- Soporte de paginación con `limit` y `skip`
- Ordenamiento con `order` (ASC/DESC)
- Selección de atributos con array `attributes`
- Filtrado complejo con múltiples condiciones

#### Relaciones
- Relaciones uno a muchos mediante `@HasMany()`
- Relaciones muchos a uno mediante `@BelongsTo()`
- Carga de relaciones anidadas con `include`
- Consultas de relaciones filtradas
- Soporte de relaciones recursivas

#### Validación y Transformación de Datos
- Validación de campos con validadores personalizados
- Mutación/transformación de datos antes de guardar
- Cadenas de validación de múltiples pasos
- Restricciones de no nulo
- Validación de email, edad y formatos personalizados

#### Configuración
- Soporte de conexión AWS DynamoDB
- Soporte de desarrollo DynamoDB Local
- Configuración de endpoint personalizada
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
- Guía de referencia de la API
- Instrucciones de configuración de desarrollo
- Guía de solución de problemas
- Mejores prácticas y consejos de rendimiento

---

## [1.0.0] - Versión Inicial

### Agregado
- Versión inicial de @arcaelas/dynamite
- Implementación de la clase base Table
- Sistema de decoradores principal
- Envoltura del cliente DynamoDB
- Sistema de gestión de metadatos
- Operaciones CRUD básicas
- Funcionalidad de constructor de consultas
- Fundamento de soporte de relaciones
- Definiciones TypeScript
- Configuración de pruebas Jest

---

## Resumen del Historial de Versiones

- **v1.0.13** (Actual) - Versión estable con conjunto completo de características
- **v1.0.0** - Versión pública inicial

---

## Enlaces

- **Repositorio**: https://github.com/arcaelas/dynamite
- **Problemas**: https://github.com/arcaelas/dynamite/issues
- **Paquete NPM**: https://www.npmjs.com/package/@arcaelas/dynamite
- **Autor**: [Arcaelas Insiders](https://github.com/arcaelas)

---

## Guías de Migración

### Actualización a v1.0.13

Sin cambios incompatibles desde v1.0.0. Todas las características son compatibles hacia atrás.

---

## Contribuciones

Consulte [README.md](../README.md#-contributing) para pautas de contribución.

---

**Nota**: Para ejemplos de uso detallados y documentación de la API, consulte el archivo [README.md](../README.md).
