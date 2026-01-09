# @arcaelas/dynamite

![Banner](assets/cover.png)

> **ORM moderno con decoradores para AWS DynamoDB**
> Decoradores TypeScript | Relaciones tipadas | Sincronización automática | Mínimo boilerplate

---

## Características

- **Diseño con decoradores** - Define modelos con decoradores TypeScript
- **Relaciones tipadas** - HasMany, BelongsTo, ManyToMany con tipado completo
- **Sincronización automática** - Tablas e índices creados automáticamente
- **Validación y transformación** - Decoradores integrados para procesar datos
- **Soft deletes** - Decorador @DeleteAt para registros recuperables
- **Transacciones** - Soporte completo de transacciones con rollback

---

## Inicio Rápido

```typescript
import { Dynamite, Table, PrimaryKey, Default, CreatedAt } from '@arcaelas/dynamite';

// Define tu modelo
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: string;

  declare name: string;
  declare email: string;

  @CreatedAt()
  declare created_at: string;
}

// Configura y conecta
const dynamite = new Dynamite({
  region: 'us-east-1',
  tables: [User]
});
await dynamite.connect();

// Crear
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Consultar
const users = await User.where('name', 'John Doe');

// Actualizar
user.email = 'newemail@example.com';
await user.save();

// Eliminar
await user.destroy();
```

---

## Decoradores

| Decorador | Descripción |
|-----------|-------------|
| `@PrimaryKey()` | Clave de partición |
| `@Index()` | Índice Secundario Global |
| `@Default(value)` | Valor por defecto (estático o función) |
| `@Validate(fn)` | Validación al asignar |
| `@Mutate(fn)` | Transformación al asignar |
| `@CreatedAt()` | Auto-asignar al crear |
| `@UpdatedAt()` | Auto-asignar al actualizar |
| `@DeleteAt()` | Timestamp de soft delete |
| `@HasMany()` | Relación uno a muchos |
| `@BelongsTo()` | Relación muchos a uno |
| `@ManyToMany()` | Muchos a muchos con tabla pivote |

---

## Relaciones

```typescript
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Post, 'user_id')
  declare posts: NonAttribute<Post[]>;
}

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;

  @BelongsTo(() => User, 'user_id')
  declare user: NonAttribute<User | null>;
}

// Cargar con relaciones
const user = await User.first({ id: '123' }, { include: { posts: true } });
console.log(user.posts); // Post[]
```

---

## Siguientes Pasos

<div class="grid cards" markdown>

-   :material-download:{ .lg .middle } **Instalación**

    ---

    Configura Dynamite en tu proyecto

    [:octicons-arrow-right-24: Instalar](installation.md)

-   :material-rocket-launch:{ .lg .middle } **Primeros Pasos**

    ---

    Crea tu primer modelo paso a paso

    [:octicons-arrow-right-24: Comenzar](getting-started.md)

-   :material-api:{ .lg .middle } **Referencia API**

    ---

    Documentación completa de todas las clases

    [:octicons-arrow-right-24: Referencia](references/table.md)

-   :material-code-tags:{ .lg .middle } **Ejemplos**

    ---

    Ejemplos prácticos listos para usar

    [:octicons-arrow-right-24: Ejemplos](examples/basic.md)

</div>

---

**Desarrollado por [Arcaelas Insiders](https://github.com/arcaelas)**
