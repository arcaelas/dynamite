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

### Constructor de Consultas Potente
Interfaz de consultas intuitiva con soporte completo de TypeScript:

```typescript
const active_users = await User.where('status', '=', 'active')
  .where('created_at', '>', new Date('2024-01-01'))
  .include('posts')
  .get();
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
import { Dynamite, Table, PrimaryKey } from '@arcaelas/dynamite';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

// Configurar cliente DynamoDB
const client = new DynamoDBClient({ region: 'us-east-1' });
Dynamite.configure({ client });

// Define tu modelo
class User extends Table {
  @PrimaryKey()
  id: string;

  name: string;
  email: string;
}

// Crear un nuevo usuario
const user = await User.create({
  id: '123',
  name: 'Juan Pérez',
  email: 'juan@ejemplo.com'
});

// Consultar usuarios
const users = await User.where('name', '=', 'Juan Pérez').get();

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
