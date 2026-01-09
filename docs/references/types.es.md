# Referencia de Tipos API

Esta guía documenta todos los tipos TypeScript exportados por Dynamite ORM.

## Tabla de Contenidos

- [Tipos Marcadores de Atributos](#tipos-marcadores-de-atributos)
  - [CreationOptional\<T\>](#creationoptionalt)
  - [NonAttribute\<T\>](#nonattributet)
- [Tipos de Inferencia](#tipos-de-inferencia)
  - [InferAttributes\<T\>](#inferattributest)
  - [InferRelations\<T\>](#inferrelationst)
  - [PickRelations\<T\>](#pickrelationst)
- [Tipos de Entrada](#tipos-de-entrada)
  - [CreateInput\<T\>](#createinputt)
  - [UpdateInput\<T\>](#updateinputt)
- [Tipos de Consulta](#tipos-de-consulta)
  - [QueryOperator](#queryoperator)
  - [WhereOptions\<T\>](#whereoptionst)

---

## Tipos Marcadores de Atributos

### CreationOptional\<T\>

Marca un campo como opcional durante la creación pero presente después de guardar. Usar para campos con valores por defecto, valores auto-generados o valores auto-calculados.

**Sintaxis:**
```typescript
declare field_name: CreationOptional<Type>;
```

**Características:**
- El campo es opcional al llamar `Model.create()`
- El campo está presente en la instancia después de guardar
- Ideal para IDs auto-generados, timestamps y valores por defecto

**Ejemplos:**

```typescript
import { Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from '@arcaelas/dynamite';

class User extends Table<User> {
  // Clave primaria auto-generada
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  // Campo requerido (sin CreationOptional)
  declare email: string;

  // Campo con valor por defecto
  @Default(() => "customer")
  declare role: CreationOptional<string>;

  // Timestamps auto-establecidos
  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

// Solo email es requerido durante la creación
const user = await User.create({
  email: "john@example.com"
  // id, role, created_at, updated_at son opcionales
});

// Después de la creación, todos los campos están presentes
console.log(user.id);         // "550e8400-e29b-..."
console.log(user.role);       // "customer"
console.log(user.created_at); // "2025-01-15T10:30:00.000Z"
```

---

### NonAttribute\<T\>

Marca un campo que NO se almacena en la base de datos. Usar para propiedades calculadas, relaciones y getters virtuales.

**Sintaxis:**
```typescript
declare field_name: NonAttribute<Type>;
```

**Características:**
- El campo se excluye de las operaciones de base de datos
- Ideal para relaciones y valores calculados
- No aparece en `toJSON()` a menos que se agregue explícitamente

**Ejemplos:**

```typescript
import { Table, HasMany, BelongsTo, NonAttribute } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  declare name: string;

  // Relación - no se almacena en la base de datos
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;

  // Propiedad calculada
  declare display_name: NonAttribute<string>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  declare user_id: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<User | null>;
}
```

---

## Tipos de Inferencia

### InferAttributes\<T\>

Extrae solo los atributos de base de datos de un modelo, excluyendo métodos, relaciones y campos no-atributos.

**Uso:**
```typescript
import type { InferAttributes } from '@arcaelas/dynamite';

type UserAttributes = InferAttributes<User>;
// Resultado:
// {
//   id?: string;            // CreationOptional se vuelve opcional
//   email: string;          // Requerido
//   name: string;           // Requerido
//   role?: string;          // CreationOptional se vuelve opcional
//   created_at?: string;    // CreationOptional se vuelve opcional
//   updated_at?: string;    // CreationOptional se vuelve opcional
// }
```

**Casos de Uso:**
- Parámetros de función type-safe
- Definiciones de DTO (Data Transfer Object)
- Tipos de respuesta de API

**Ejemplo:**

```typescript
import type { InferAttributes } from '@arcaelas/dynamite';

// Función con entrada type-safe
async function updateUser(
  id: string,
  data: Partial<InferAttributes<User>>
): Promise<boolean> {
  const user = await User.first({ id });
  if (user) {
    return user.update(data);
  }
  return false;
}

// Uso
await updateUser("user-123", { name: "Nuevo Nombre", role: "admin" });
```

---

### InferRelations\<T\>

Extrae solo los campos de relación de un modelo (campos marcados con `NonAttribute`).

**Uso:**
```typescript
import type { InferRelations } from '@arcaelas/dynamite';

type UserRelations = InferRelations<User>;
// Resultado:
// {
//   orders: Order[];        // HasMany resuelve a array
//   profile: Profile;       // HasOne resuelve a singular
// }
```

**Ejemplo:**

```typescript
import type { InferRelations } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<Post[]>;

  @HasOne(() => Profile, "user_id")
  declare profile: NonAttribute<Profile | null>;
}

// InferRelations<User> = { posts: Post[], profile: Profile | null }
```

---

### PickRelations\<T\>

Extrae solo los campos de relación. Usado internamente para validación.

**Uso:**
```typescript
import type { PickRelations } from '@arcaelas/dynamite';

type UserRelations = PickRelations<User>;
// { posts: Post[], profile: Profile | null }
```

---

## Tipos de Entrada

### CreateInput\<T\>

Tipo para entrada de `Model.create()`. Alias de `InferAttributes<T>`.

**Uso:**
```typescript
import type { CreateInput } from '@arcaelas/dynamite';

type UserCreateData = CreateInput<User>;
// { email: string; name: string; id?: string; role?: string; ... }

const data: CreateInput<User> = {
  email: "john@example.com",
  name: "John"
  // id, role, timestamps son opcionales
};

await User.create(data);
```

---

### UpdateInput\<T\>

Tipo para entrada de `instance.update()`. Todos los campos son opcionales.

**Uso:**
```typescript
import type { UpdateInput } from '@arcaelas/dynamite';

type UserUpdateData = UpdateInput<User>;
// { email?: string; name?: string; role?: string; ... }

const data: UpdateInput<User> = {
  name: "Nuevo Nombre"
  // Todos los campos son opcionales
};

await user.update(data);
```

---

## Tipos de Consulta

### QueryOperator

Tipo union de todos los operadores de consulta soportados.

**Definición:**
```typescript
type QueryOperator =
  | "="      // Igual
  | "$eq"   // Igual (alias)
  | "<>"    // No igual
  | "!="    // No igual (alias)
  | "$ne"   // No igual (alias)
  | "<"     // Menor que
  | "$lt"   // Menor que (alias)
  | "<="    // Menor o igual
  | "$lte"  // Menor o igual (alias)
  | ">"     // Mayor que
  | "$gt"   // Mayor que (alias)
  | ">="    // Mayor o igual
  | "$gte"  // Mayor o igual (alias)
  | "in"    // En array
  | "$in"   // En array (alias)
  | "include"  // Contiene
  | "$include" // Contiene (alias)
```

**Uso:**

```typescript
// Igualdad
await User.where("role", "=", "admin");
await User.where("role", "$eq", "admin");

// Comparación
await User.where("age", ">=", 18);
await User.where("age", "$gte", 18);
await User.where("balance", "<", 100);
await User.where("balance", "$lt", 100);

// No igual
await User.where("status", "!=", "banned");
await User.where("status", "<>", "banned");
await User.where("status", "$ne", "banned");

// Membresía en array
await User.where("status", "in", ["active", "pending"]);
await User.where("status", "$in", ["active", "pending"]);

// Contiene
await User.where("email", "include", "@gmail.com");
await User.where("email", "$include", "@gmail.com");
```

---

### WhereOptions\<T\>

Opciones para configurar el comportamiento de las consultas.

**Definición:**
```typescript
interface WhereOptions<T> {
  where?: {
    [K in keyof InferAttributes<T>]?:
      | InferAttributes<T>[K]
      | { [op in QueryOperator]?: InferAttributes<T>[K] };
  };
  order?: "ASC" | "DESC";
  skip?: number;              // Alias de offset
  offset?: number;            // Número de registros a saltar
  limit?: number;             // Máximo de registros a retornar
  attributes?: (keyof InferAttributes<T>)[];  // Campos a seleccionar
  include?: {                 // Relaciones a incluir
    [relation: string]: boolean | WhereOptions<any>;
  };
  _includeTrashed?: boolean;  // Incluir registros soft-deleted
}
```

**Propiedades:**

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `where` | `object` | Condiciones de filtro con soporte de operadores |
| `order` | `"ASC" \| "DESC"` | Orden de resultados |
| `skip` | `number` | Número de registros a saltar (alias: offset) |
| `offset` | `number` | Número de registros a saltar |
| `limit` | `number` | Máximo de registros a retornar |
| `attributes` | `string[]` | Campos específicos a seleccionar |
| `include` | `object` | Relaciones a incluir |
| `_includeTrashed` | `boolean` | Incluir registros soft-deleted |

**Ejemplo:**

```typescript
const users = await User.where({ active: true }, {
  order: "DESC",
  skip: 20,
  limit: 10,
  attributes: ["id", "name", "email"],
  include: {
    orders: {
      where: { status: "completed" },
      limit: 5,
      order: "DESC",
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    }
  }
});
```

---

## Mejores Prácticas

### 1. Siempre Usar CreationOptional para Campos con Defaults

```typescript
// Correcto
@Default(() => "active")
declare status: CreationOptional<string>;

// Incorrecto - TypeScript requerirá status en create()
@Default(() => "active")
declare status: string;
```

### 2. Siempre Envolver Relaciones en NonAttribute

```typescript
// Correcto
@HasMany(() => Post, "user_id")
declare posts: NonAttribute<Post[]>;

// Incorrecto - posts sería tratado como columna de base de datos
@HasMany(() => Post, "user_id")
declare posts: Post[];
```

### 3. Usar InferAttributes para Funciones Type-Safe

```typescript
// Correcto - parámetro type-safe
function processUser(data: InferAttributes<User>) { ... }

// Incorrecto - sin seguridad de tipos
function processUser(data: any) { ... }
```

### 4. Definir Foreign Keys Explícitamente

```typescript
// Correcto - foreign key está declarado
class Post extends Table<Post> {
  declare user_id: string; // Campo FK

  @BelongsTo(() => User, "user_id")
  declare author: NonAttribute<User | null>;
}

// Incorrecto - foreign key no declarado
class Post extends Table<Post> {
  @BelongsTo(() => User, "user_id")
  declare author: NonAttribute<User | null>;
}
```
