# Bienvenido a Arcaelas Dynamite

ORM moderno basado en decoradores para AWS DynamoDB con soporte TypeScript.

## ¿Qué es Dynamite?

Arcaelas Dynamite es una potente librería de Mapeo Objeto-Relacional (ORM) basada en decoradores para AWS DynamoDB. Proporciona una API limpia e intuitiva que aprovecha los decoradores de TypeScript para definir tus modelos de datos con seguridad de tipos y mínimo código repetitivo.

## Características Principales

### Diseño Basado en Decoradores
Define tus modelos usando decoradores familiares de TypeScript:

```typescript
import { Table, PrimaryKey, CreatedAt, UpdatedAt } from '@arcaelas/dynamite';

class User extends Table {
  @PrimaryKey()
  id: string;

  @Default(() => 'active')
  status: string;

  @CreatedAt()
  created_at: Date;

  @UpdatedAt()
  updated_at: Date;
}
```

### Relaciones con Seguridad de Tipos
Soporte integrado para relaciones uno-a-muchos y muchos-a-uno:

```typescript
import { HasMany, BelongsTo } from '@arcaelas/dynamite';

class User extends Table {
  @HasMany(() => Post, 'user_id')
  posts: HasMany<Post>;
}

class Post extends Table {
  @BelongsTo(() => User, 'user_id')
  user: BelongsTo<User>;
}
```

### API de Consultas Simple
Métodos async directos con soporte completo de TypeScript:

```typescript
// Igualdad simple
const active_users = await User.where('status', 'active');

// Con operador
const recent = await User.where('created_at', '>', '2024-01-01');

// Múltiples filtros con opciones
const users = await User.where(
  { status: 'active' },
  { include: { posts: true }, limit: 10 }
);
```

### Validación y Transformación
Decoradores integrados para validación y mutación de datos:

```typescript
class User extends Table {
  @Validate(value => value.length >= 8, 'La contraseña debe tener al menos 8 caracteres')
  password: string;

  @Mutate(value => value.toLowerCase().trim())
  email: string;
}
```

## Inicio Rápido

### Instalación

```bash
npm install @arcaelas/dynamite
# o
yarn add @arcaelas/dynamite
```

### Uso Básico

```typescript
import { Dynamite, Table, PrimaryKey, Default } from '@arcaelas/dynamite';

// Define tu modelo
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: string;

  declare name: string;
  declare email: string;
}

// Configurar y conectar
const dynamite = new Dynamite({
  region: 'us-east-1',
  tables: [User]
});
dynamite.connect();
await dynamite.sync();

// Crear un nuevo usuario
const user = await User.create({
  name: 'Juan Pérez',
  email: 'juan@ejemplo.com'
});

// Consultar usuarios
const users = await User.where('name', 'Juan Pérez');

// Actualizar
user.email = 'nuevoemail@ejemplo.com';
await user.save();

// Eliminar
await user.destroy();
```

## Resumen de Arquitectura

Dynamite está construido sobre tres conceptos fundamentales:

1. **Table** - Clase base para todos los modelos con operaciones CRUD
2. **Decorators** - Definen esquema, validación y comportamiento
3. **Relationships** - Conectan modelos con asociaciones seguras de tipos

```
┌─────────────────────────────────────────┐
│             Tus Modelos                  │
│  ┌─────────────────────────────────┐   │
│  │  User extends Table              │   │
│  │  - @PrimaryKey() id              │   │
│  │  - @HasMany() posts              │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│          Dynamite ORM                    │
│  - Constructor de Consultas              │
│  - Resolutor de Relaciones               │
│  - Procesamiento de Decoradores          │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│         AWS SDK v3                       │
│  - DynamoDBClient                        │
│  - DynamoDB Document Client              │
└──────────────────────────────────────────┘
```

## ¿Por Qué Dynamite?

- **Seguridad de Tipos** - Soporte completo de TypeScript con tipos avanzados
- **Experiencia del Desarrollador** - API limpia e intuitiva con mínimo código repetitivo
- **Moderno** - Construido sobre AWS SDK v3 con soporte ESM
- **Flexible** - Soporta consultas complejas, relaciones y lógica personalizada
- **Ligero** - Dependencias mínimas, enfocado en DynamoDB

## Próximos Pasos

- **[Guía de Instalación](installation.md)** - Configura Dynamite en tu proyecto
- **[Comenzando](guides/getting-started.md)** - Tu primer modelo Dynamite
- **[Conceptos Básicos](guides/core-concepts.md)** - Entendiendo los fundamentos
- **[Referencia API](api/table.md)** - Documentación completa de la API

## Comunidad

- **GitHub**: [github.com/arcaelas/dynamite](https://github.com/arcaelas/dynamite)
- **Issues**: [Reportar bugs o solicitar características](https://github.com/arcaelas/dynamite/issues)
- **NPM**: [@arcaelas/dynamite](https://www.npmjs.com/package/@arcaelas/dynamite)

---

**¿Listo para comenzar?** [Instala Dynamite](installation.md) y crea tu primer modelo en minutos.
