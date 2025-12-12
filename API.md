# Dynamite ORM - Documentacion API

Dynamite es un ORM para DynamoDB basado en decoradores TypeScript que proporciona una API intuitiva para definir esquemas, relaciones y transformaciones de datos.

## Tabla de Contenidos

1. [Como crear un decorador](#1-como-crear-un-decorador)
2. [Lista de decoradores existentes](#2-lista-de-decoradores-existentes)
3. [Conexion a base de datos](#3-conexion-a-base-de-datos)
4. [Schema simple - Role](#4-schema-simple---role)
5. [Schema intermedio - User](#5-schema-intermedio---user)
6. [Schema avanzado con relaciones](#6-schema-avanzado-con-relaciones)
7. [Metodos estaticos](#7-metodos-estaticos)
8. [Metodos de instancia](#8-metodos-de-instancia)

---

## 1. Como crear un decorador

Dynamite utiliza un sistema de decoradores basado en la funcion `decorator()` que permite crear decoradores personalizados con soporte para pipelines de getter y setter.

### Arquitectura del sistema

Cada columna tiene tres componentes:
- **`col.get[]`**: Pipeline de funciones ejecutadas al leer el valor
- **`col.set[]`**: Pipeline de funciones ejecutadas al asignar un valor
- **`col.store{}`**: Metadata de configuracion (flags, relaciones, etc.)

### Ejemplo basico: Decorador sin parametros

```typescript
import { decorator } from "./core/decorator";

/**
 * @description Marca una columna como requerida (no permite valores vacios)
 * @example
 * class User extends Table<User> {
 *   @Required()
 *   name!: string;
 * }
 */
export const Required = decorator((_schema, col) => {
  col.store.required = true;
  col.set.push((current: any, next: any) => {
    if (next === null || next === undefined || next === "") {
      throw new Error(`El campo ${col.name} es requerido`);
    }
    return next;
  });
});
```

### Ejemplo avanzado: Decorador con parametros y pipelines

```typescript
import { decorator } from "./core/decorator";

/**
 * @description Valida que un string tenga una longitud minima y maxima
 * @param min_length - Longitud minima permitida
 * @param max_length - Longitud maxima permitida
 * @example
 * class User extends Table<User> {
 *   @Length(3, 50)
 *   username!: string;
 * }
 */
export const Length = decorator((_schema, col, params) => {
  const [min_length, max_length] = params;

  // Metadata para introspection
  col.store.minLength = min_length;
  col.store.maxLength = max_length;

  // Pipeline de setter: validacion antes de guardar
  col.set.push((current: any, next: any) => {
    if (typeof next !== "string") {
      throw new TypeError(`${col.name} debe ser un string`);
    }
    if (next.length < min_length) {
      throw new Error(`${col.name} debe tener al menos ${min_length} caracteres`);
    }
    if (next.length > max_length) {
      throw new Error(`${col.name} no puede exceder ${max_length} caracteres`);
    }
    return next;
  });
});

/**
 * @description Encripta un valor al guardar y lo desencripta al leer
 * @param secret - Clave de encriptacion
 * @example
 * class User extends Table<User> {
 *   @Encrypted("my-secret-key")
 *   password!: string;
 * }
 */
export const Encrypted = decorator((_schema, col, params) => {
  const [secret] = params;

  // Pipeline de getter: desencriptar al leer
  col.get.push((value: any) => {
    if (!value) return value;
    return decrypt(value, secret);
  });

  // Pipeline de setter: encriptar al guardar
  col.set.push((current: any, next: any) => {
    if (!next) return next;
    return encrypt(next, secret);
  });
});
```

### Orden de ejecucion de decoradores

Los decoradores se ejecutan de abajo hacia arriba (el mas cercano a la propiedad se ejecuta primero en el pipeline de setter):

```typescript
class Example extends Table<Example> {
  @Validate((v) => v <= 100 || "Max 100")  // Ejecuta tercero
  @Mutate((v) => Math.abs(v))              // Ejecuta segundo
  @NotNull("Requerido")                     // Ejecuta primero
  value!: number;
}

// Flujo: NotNull -> Mutate -> Validate
// Input: -50
// 1. NotNull: -50 (pasa, no es null)
// 2. Mutate: 50 (valor absoluto)
// 3. Validate: 50 (pasa, <= 100)
```

---

## 2. Lista de decoradores existentes

### Decoradores de Indice

#### @PrimaryKey()

Declara la clave primaria de la tabla.

```typescript
import { PrimaryKey } from "./decorators/indexes";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;
}
```

#### @Index()

Marca una propiedad como clave de particion (alternativa a `@PrimaryKey`).

```typescript
import { Index } from "./decorators/indexes";

class User extends Table<User> {
  @Index()
  id!: string;
}
```

#### @IndexSort()

Marca una propiedad como clave de ordenamiento (sort key).

```typescript
import { IndexSort } from "./decorators/indexes";

class Post extends Table<Post> {
  @Index()
  user_id!: string;

  @IndexSort()
  created_at!: string;
}
```

---

### Decoradores de Relacion

#### @HasMany(modelo, foreignKey, localKey?)

Define una relacion uno-a-muchos (1:N). El modelo padre tiene muchos hijos.

```typescript
import { HasMany } from "./decorators/relations";
import type { NonAttribute } from "./@types/index";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  @HasMany(() => Order, "user_id", "id")
  orders?: NonAttribute<Order[]>;
}

// Uso con include
const user = await User.first({ id: "user-1" }, {
  include: { orders: true }
});
console.log(user.orders); // Order[]
```

**Parametros:**
- `modelo`: Funcion que retorna la clase relacionada (lazy loading para evitar dependencias circulares)
- `foreignKey`: Columna en la tabla hija que referencia al padre
- `localKey`: Columna en la tabla padre (default: `"id"`)

#### @HasOne(modelo, foreignKey, localKey?)

Define una relacion uno-a-uno (1:1). El modelo padre tiene un solo hijo.

```typescript
import { HasOne } from "./decorators/relations";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  @HasOne(() => Profile, "user_id", "id")
  profile?: NonAttribute<Profile>;
}

// Uso
const user = await User.first({ id: "user-1" }, {
  include: { profile: true }
});
console.log(user.profile); // Profile | null
```

#### @BelongsTo(modelo, localKey, foreignKey?)

Define una relacion muchos-a-uno (N:1). El modelo hijo pertenece a un padre.

```typescript
import { BelongsTo } from "./decorators/relations";

class Order extends Table<Order> {
  @PrimaryKey()
  id!: string;

  user_id!: string;

  @BelongsTo(() => User, "user_id", "id")
  user?: NonAttribute<User>;
}

// Uso
const order = await Order.first({ id: "order-1" }, {
  include: { user: true }
});
console.log(order.user); // User | null
```

**Parametros:**
- `modelo`: Funcion que retorna la clase padre
- `localKey`: Columna local que contiene la referencia (foreign key)
- `foreignKey`: Columna en la tabla padre (default: `"id"`)

#### @ManyToMany(modelo, pivotTable, foreignKey, relatedKey, localKey?, relatedPK?)

Define una relacion muchos-a-muchos (N:M) a traves de una tabla pivote.

```typescript
import { ManyToMany } from "./decorators/relations";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  @ManyToMany(() => Role, "users_roles", "user_id", "role_id")
  roles?: NonAttribute<Role[]>;
}

class Role extends Table<Role> {
  @PrimaryKey()
  id!: string;

  @ManyToMany(() => User, "users_roles", "role_id", "user_id")
  users?: NonAttribute<User[]>;
}
```

**Parametros:**
- `modelo`: Funcion que retorna la clase relacionada
- `pivotTable`: Nombre de la tabla pivote (junction table)
- `foreignKey`: Columna en pivote que apunta a este modelo
- `relatedKey`: Columna en pivote que apunta al modelo relacionado
- `localKey`: Clave primaria local (default: `"id"`)
- `relatedPK`: Clave primaria del modelo relacionado (default: `"id"`)

---

### Decoradores de Timestamp

#### @CreatedAt()

Establece automaticamente la fecha de creacion. Es inmutable despues de la primera asignacion.

```typescript
import { CreatedAt } from "./decorators/timestamps";
import type { CreationOptional } from "./@types/index";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  @CreatedAt()
  created_at!: CreationOptional<string>;
}

// Uso
const user = await User.create({ name: "Juan" });
console.log(user.created_at); // "2024-01-15T10:30:00.000Z"

// Intentar modificar no tiene efecto
user.created_at = "otro-valor";
await user.save();
console.log(user.created_at); // Sigue siendo el valor original
```

#### @UpdatedAt()

Actualiza automaticamente la fecha en cada modificacion.

```typescript
import { UpdatedAt } from "./decorators/timestamps";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  name!: string;

  @UpdatedAt()
  updated_at!: CreationOptional<string>;
}

// Uso
const user = await User.create({ name: "Juan" });
console.log(user.updated_at); // "2024-01-15T10:30:00.000Z"

await user.update({ name: "Carlos" });
console.log(user.updated_at); // "2024-01-15T10:35:00.000Z" (actualizado)
```

#### @DeleteAt()

Habilita soft delete. En lugar de eliminar el registro, marca la fecha de eliminacion.

```typescript
import { DeleteAt } from "./decorators/timestamps";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  name!: string;

  @DeleteAt()
  deleted_at?: string;
}

// Soft delete
const user = await User.first({ id: "user-1" });
await user.destroy(); // No elimina, solo marca deleted_at

// Consultas normales excluyen registros eliminados
const users = await User.where({}); // No incluye user-1

// Incluir eliminados
const all = await User.withTrashed({});

// Solo eliminados
const deleted = await User.onlyTrashed({});

// Eliminacion permanente
await user.forceDestroy();
```

---

### Decoradores de Transformacion

#### @Column()

Marca explicitamente una propiedad como columna de base de datos.

```typescript
import { Column } from "./decorators/transforms";

class Product extends Table<Product> {
  @PrimaryKey()
  id!: string;

  @Column()
  price!: number;

  @Column()
  category_id!: string;
}
```

#### @Default(valor | funcion)

Establece un valor por defecto cuando el valor es `null` o `undefined`.

```typescript
import { Default } from "./decorators/transforms";

class User extends Table<User> {
  @PrimaryKey()
  @Default(() => `user-${Date.now()}`)
  id!: string;

  @Default(18)
  age!: number;

  @Default(() => new Date().toISOString())
  registered_at!: string;
}

// Uso
const user = await User.create({ name: "Juan" });
console.log(user.id);  // "user-1705312200000"
console.log(user.age); // 18
```

**Variantes:**
- Valor estatico: `@Default("activo")`
- Funcion generadora: `@Default(() => uuid())`
- Timestamp: `@Default(() => Date.now())`

#### @Mutate(transformFn)

Transforma el valor cada vez que se asigna.

```typescript
import { Mutate } from "./decorators/transforms";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  @Mutate((v) => v.toLowerCase().trim())
  email!: string;

  @Mutate((v) => typeof v === "string" ? parseInt(v, 10) : v)
  age!: number;
}

// Uso
const user = await User.create({
  email: "  JUAN@EXAMPLE.COM  ",
  age: "25"
});
console.log(user.email); // "juan@example.com"
console.log(user.age);   // 25 (number)
```

#### @Validate(validador | validadores[])

Valida el valor antes de asignarlo. El validador debe retornar `true` o un mensaje de error.

```typescript
import { Validate } from "./decorators/transforms";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  // Validador simple
  @Validate((v) => v.length >= 3 || "Minimo 3 caracteres")
  name!: string;

  // Validador con regex
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Email invalido")
  email!: string;

  // Multiples validadores
  @Validate([
    (v) => v >= 0 || "Debe ser positivo",
    (v) => v <= 150 || "Edad maxima 150"
  ])
  age!: number;
}

// Uso
try {
  await User.create({ name: "AB" }); // Error: "Minimo 3 caracteres"
} catch (e) {
  console.error(e.message);
}
```

#### @Serialize(fromDB, toDB)

Transforma valores bidirecionalmente entre la aplicacion y la base de datos.

```typescript
import { Serialize } from "./decorators/transforms";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  // JSON serialization
  @Serialize(JSON.parse, JSON.stringify)
  metadata!: Record<string, any>;

  // Date serialization
  @Serialize(
    (v) => new Date(v),           // fromDB: string -> Date
    (v) => v.toISOString()        // toDB: Date -> string
  )
  birth_date!: Date;
}

// Uso
const user = await User.create({
  metadata: { theme: "dark", lang: "es" },
  birth_date: new Date("1990-05-15")
});

// En la app: objeto/Date
console.log(user.metadata.theme); // "dark"
console.log(user.birth_date);     // Date object

// En DynamoDB: string serializado
// { "metadata": "{\"theme\":\"dark\",\"lang\":\"es\"}" }
```

#### @NotNull(mensaje?)

Rechaza valores `null`, `undefined` o strings vacios.

```typescript
import { NotNull } from "./decorators/transforms";

class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  @NotNull()
  name!: string;

  @NotNull("El email es obligatorio")
  email!: string;
}

// Uso
try {
  await User.create({ name: "" }); // Error: "The name field cannot be empty"
} catch (e) {
  console.error(e.message);
}

try {
  await User.create({ name: "Juan", email: null }); // Error: "El email es obligatorio"
} catch (e) {
  console.error(e.message);
}
```

#### @Name(label)

Renombra la tabla (en clase) o columna (en propiedad) en la base de datos.

```typescript
import { Name } from "./decorators/transforms";

// Renombrar tabla
@Name("usuarios")
class User extends Table<User> {
  @PrimaryKey()
  id!: string;

  // Renombrar columna
  @Name("correo_electronico")
  email!: string;

  @Name("fecha_registro")
  registered_at!: string;
}

// En TypeScript: user.email
// En DynamoDB: item.correo_electronico
```

---

## 3. Conexion a base de datos

### Clase Dynamite

La clase `Dynamite` es el punto de entrada para configurar la conexion a DynamoDB.

```typescript
import { Dynamite } from "./core/client";

const dynamite = new Dynamite(config);
await dynamite.connect();
```

### Conexion local (DynamoDB Local)

```typescript
import { Dynamite } from "./core/client";
import { User, Order, Role } from "./models";

const dynamite = new Dynamite({
  endpoint: "http://localhost:8000",
  region: "local",
  credentials: {
    accessKeyId: "local",
    secretAccessKey: "local",
  },
  tables: [User, Order, Role]
});

await dynamite.connect();
```

### Conexion AWS con credenciales

```typescript
import { Dynamite } from "./core/client";
import { User, Order, Role } from "./models";

const dynamite = new Dynamite({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  tables: [User, Order, Role]
});

await dynamite.connect();
```

### Conexion AWS con variables de entorno

Si las variables `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` estan configuradas en el entorno:

```typescript
import { Dynamite } from "./core/client";

const dynamite = new Dynamite({
  region: "us-east-1",
  tables: [User, Order, Role]
});

await dynamite.connect();
```

### Metodo connect()

El metodo `connect()` realiza las siguientes operaciones:
1. Establece el cliente global de DynamoDB
2. Crea las tablas que no existen
3. Crea tablas pivote para relaciones `@ManyToMany`
4. Crea indices secundarios globales (GSI) segun los decoradores `@Index`

```typescript
await dynamite.connect();
// Tablas creadas automaticamente si no existen
```

### Transacciones

```typescript
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "Juan" }, tx);
  await Order.create({ user_id: user.id, total: 100 }, tx);
  // Si alguna operacion falla, todas se revierten
});
```

---

## 4. Schema simple - Role

Ejemplo de un schema minimo con decoradores basicos.

```typescript
import Table from "./core/table";
import { PrimaryKey } from "./decorators/indexes";
import { Default, NotNull } from "./decorators/transforms";
import type { CreationOptional } from "./@types/index";

@Name("roles")
class Role extends Table<Role> {
  /**
   * @description Identificador unico del rol
   */
  @PrimaryKey()
  @Default(() => `role-${Date.now()}`)
  id!: string;

  /**
   * @description Nombre del rol
   */
  @NotNull("El nombre del rol es requerido")
  name!: string;

  /**
   * @description Descripcion opcional del rol
   */
  description?: string;
}

export default Role;
```

### Uso del schema Role

```typescript
// Crear rol
const admin = await Role.create({ name: "admin", description: "Administrador" });

// Buscar rol
const role = await Role.first({ name: "admin" });

// Listar roles
const roles = await Role.where({});

// Actualizar rol
await role.update({ description: "Administrador del sistema" });

// Eliminar rol
await role.destroy();
```

---

## 5. Schema intermedio - User

Ejemplo con validaciones, mutaciones y relaciones simples.

```typescript
import Table from "./core/table";
import { PrimaryKey } from "./decorators/indexes";
import { HasOne, HasMany, ManyToMany } from "./decorators/relations";
import { CreatedAt, UpdatedAt } from "./decorators/timestamps";
import { Default, NotNull, Validate, Mutate } from "./decorators/transforms";
import type { CreationOptional, NonAttribute } from "./@types/index";
import Profile from "./Profile";
import Order from "./Order";
import Role from "./Role";

@Name("users")
class User extends Table<User> {
  /**
   * @description Identificador unico del usuario
   */
  @PrimaryKey()
  @Default(() => `user-${Date.now()}`)
  id!: string;

  /**
   * @description Nombre del usuario (minimo 3 caracteres)
   */
  @NotNull("El nombre es requerido")
  @Validate((v) => v.length >= 3 || "El nombre debe tener al menos 3 caracteres")
  name!: string;

  /**
   * @description Email del usuario (normalizado a minusculas)
   */
  @Validate((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Email invalido")
  @Mutate((v) => v.toLowerCase().trim())
  email!: string;

  /**
   * @description Edad del usuario
   */
  @Default(18)
  @Validate((v) => v >= 0 && v <= 150 || "Edad debe estar entre 0 y 150")
  age?: number;

  /**
   * @description Estado del usuario
   */
  @Default("active")
  status?: "active" | "inactive" | "suspended";

  /**
   * @description Perfil del usuario (relacion 1:1)
   */
  @HasOne(() => Profile, "user_id", "id")
  profile?: NonAttribute<Profile>;

  /**
   * @description Ordenes del usuario (relacion 1:N)
   */
  @HasMany(() => Order, "user_id", "id")
  orders?: NonAttribute<Order[]>;

  /**
   * @description Roles del usuario (relacion N:M)
   */
  @ManyToMany(() => Role, "users_roles", "user_id", "role_id")
  roles?: NonAttribute<Role[]>;

  /**
   * @description Fecha de creacion
   */
  @CreatedAt()
  created_at!: CreationOptional<string>;

  /**
   * @description Fecha de ultima actualizacion
   */
  @UpdatedAt()
  updated_at!: CreationOptional<string>;
}

export default User;
```

### Schemas relacionados

```typescript
// Profile.ts
@Name("profiles")
class Profile extends Table<Profile> {
  @PrimaryKey()
  @Default(() => `profile-${Date.now()}`)
  id!: string;

  user_id!: string;

  bio?: string;

  avatar_url?: string;

  @BelongsTo(() => User, "user_id", "id")
  user?: NonAttribute<User>;
}

// Order.ts
@Name("orders")
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => `order-${Date.now()}`)
  id!: string;

  user_id!: string;

  @NotNull()
  total!: number;

  @Default("pending")
  status?: "pending" | "completed" | "cancelled";

  @BelongsTo(() => User, "user_id", "id")
  user?: NonAttribute<User>;
}
```

### Uso del schema User

```typescript
// Crear usuario
const user = await User.create({
  name: "Juan Perez",
  email: "JUAN@EXAMPLE.COM"  // Se normaliza a "juan@example.com"
});

// Crear perfil asociado
await Profile.create({
  user_id: user.id,
  bio: "Desarrollador full-stack"
});

// Cargar usuario con relaciones
const loaded = await User.first({ id: user.id }, {
  include: {
    profile: true,
    orders: { limit: 5, order: "DESC" },
    roles: true
  }
});

console.log(loaded.profile?.bio);    // "Desarrollador full-stack"
console.log(loaded.orders?.length);  // 0
console.log(loaded.roles?.length);   // 0

// Asignar roles
await user.attach(Role, "role-admin");
await user.attach(Role, "role-editor");

// Verificar roles
const withRoles = await User.first({ id: user.id }, {
  include: { roles: true }
});
console.log(withRoles.roles?.map(r => r.name)); // ["admin", "editor"]
```

---

## 6. Schema avanzado con relaciones

Ejemplo completo con todas las relaciones y decoradores combinados.

```typescript
import Table from "./core/table";
import { PrimaryKey, IndexSort } from "./decorators/indexes";
import { HasOne, HasMany, BelongsTo, ManyToMany } from "./decorators/relations";
import { CreatedAt, UpdatedAt, DeleteAt } from "./decorators/timestamps";
import { Default, NotNull, Validate, Mutate, Serialize, Name, Column } from "./decorators/transforms";
import type { CreationOptional, NonAttribute } from "./@types/index";

// ============================================
// SCHEMA: Category (padre de productos)
// ============================================
@Name("categories")
class Category extends Table<Category> {
  @PrimaryKey()
  @Default(() => `cat-${Date.now()}`)
  id!: string;

  @NotNull()
  @Mutate((v) => v.toLowerCase().trim())
  name!: string;

  @HasMany(() => Product, "category_id", "id")
  products?: NonAttribute<Product[]>;
}

// ============================================
// SCHEMA: Tag (relacion N:M con productos)
// ============================================
@Name("tags")
class Tag extends Table<Tag> {
  @PrimaryKey()
  @Default(() => `tag-${Date.now()}`)
  id!: string;

  @NotNull()
  name!: string;

  @ManyToMany(() => Product, "products_tags", "tag_id", "product_id")
  products?: NonAttribute<Product[]>;
}

// ============================================
// SCHEMA: Product (ejemplo complejo)
// ============================================
@Name("products")
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => `prod-${Date.now()}`)
  id!: string;

  @NotNull("El nombre del producto es requerido")
  @Validate((v) => v.length >= 3 || "Nombre minimo 3 caracteres")
  name!: string;

  @Validate((v) => v >= 0 || "El precio no puede ser negativo")
  @Mutate((v) => Math.round(v * 100) / 100)  // Redondear a 2 decimales
  @NotNull("El precio es requerido")
  price!: number;

  @Default(0)
  @Validate((v) => v >= 0 || "Stock no puede ser negativo")
  stock!: number;

  @Serialize(JSON.parse, JSON.stringify)
  metadata?: Record<string, any>;

  @Name("cat_id")
  @Column()
  category_id!: string;

  owner_id!: string;

  // Relacion N:1 - Producto pertenece a una categoria
  @BelongsTo(() => Category, "category_id", "id")
  category?: NonAttribute<Category>;

  // Relacion N:1 - Producto pertenece a un usuario (owner)
  @BelongsTo(() => User, "owner_id", "id")
  owner?: NonAttribute<User>;

  // Relacion N:M - Producto tiene muchos tags
  @ManyToMany(() => Tag, "products_tags", "product_id", "tag_id")
  tags?: NonAttribute<Tag[]>;

  // Relacion 1:N - Producto tiene muchas reviews
  @HasMany(() => Review, "product_id", "id")
  reviews?: NonAttribute<Review[]>;

  // Relacion 1:1 - Producto tiene una imagen destacada
  @HasOne(() => ProductImage, "product_id", "id")
  featured_image?: NonAttribute<ProductImage>;

  @CreatedAt()
  created_at!: CreationOptional<string>;

  @UpdatedAt()
  updated_at!: CreationOptional<string>;

  @DeleteAt()
  deleted_at?: string;
}

// ============================================
// SCHEMA: ProductImage (1:1 con Product)
// ============================================
@Name("product_images")
class ProductImage extends Table<ProductImage> {
  @PrimaryKey()
  @Default(() => `img-${Date.now()}`)
  id!: string;

  product_id!: string;

  @NotNull()
  url!: string;

  @Default("main")
  type?: "main" | "gallery" | "thumbnail";

  @BelongsTo(() => Product, "product_id", "id")
  product?: NonAttribute<Product>;
}

// ============================================
// SCHEMA: Review (1:N con Product y User)
// ============================================
@Name("reviews")
class Review extends Table<Review> {
  @PrimaryKey()
  @Default(() => `review-${Date.now()}`)
  id!: string;

  product_id!: string;
  user_id!: string;

  @Validate((v) => v >= 1 && v <= 5 || "Rating debe ser entre 1 y 5")
  rating!: number;

  @Validate((v) => v.length >= 10 || "Comentario minimo 10 caracteres")
  comment!: string;

  @BelongsTo(() => Product, "product_id", "id")
  product?: NonAttribute<Product>;

  @BelongsTo(() => User, "user_id", "id")
  user?: NonAttribute<User>;

  @CreatedAt()
  created_at!: CreationOptional<string>;
}
```

### Uso del schema avanzado

```typescript
// Crear categoria
const electronics = await Category.create({ name: "ELECTRONICS" });
console.log(electronics.name); // "electronics" (mutado a lowercase)

// Crear tags
const tagNew = await Tag.create({ name: "Nuevo" });
const tagSale = await Tag.create({ name: "Oferta" });

// Crear producto completo
const product = await Product.create({
  name: "Smartphone X",
  price: 999.999,  // Se redondea a 999.99
  stock: 50,
  category_id: electronics.id,
  owner_id: "user-1",
  metadata: { color: "black", storage: "128GB" }
});

// Crear imagen destacada
await ProductImage.create({
  product_id: product.id,
  url: "https://example.com/phone.jpg",
  type: "main"
});

// Asignar tags (ManyToMany)
await product.attach(Tag, tagNew.id);
await product.attach(Tag, tagSale.id);

// Cargar producto con todas las relaciones (3 niveles)
const loaded = await Product.first({ id: product.id }, {
  include: {
    category: true,
    owner: {
      include: {
        profile: true,
        roles: true
      }
    },
    tags: true,
    reviews: {
      include: { user: true },
      limit: 10,
      order: "DESC"
    },
    featured_image: true
  }
});

console.log(loaded.category?.name);           // "electronics"
console.log(loaded.owner?.name);              // "Juan"
console.log(loaded.owner?.profile?.bio);      // "Developer"
console.log(loaded.tags?.map(t => t.name));   // ["Nuevo", "Oferta"]
console.log(loaded.featured_image?.url);      // "https://..."

// Sincronizar tags (reemplaza todos)
await product.sync(Tag, [tagSale.id]); // Solo queda "Oferta"

// Soft delete
await product.destroy();

// Consultar solo eliminados
const deleted = await Product.onlyTrashed({});

// Restaurar (eliminando deleted_at)
await product.update({ deleted_at: null } as any);
```

---

## 7. Metodos estaticos

Los metodos estaticos operan a nivel de tabla y permiten consultar, crear, actualizar y eliminar registros.

### where(filtros, opciones?)

Busca registros que coincidan con los filtros.

```typescript
// Sintaxis simple: campo, valor
const users = await User.where("name", "Juan");

// Sintaxis con operador: campo, operador, valor
const adults = await User.where("age", ">=", 18);

// Sintaxis objeto: filtros complejos
const results = await User.where({
  status: "active",
  age: { $gte: 18, $lte: 65 }
});
```

#### Operadores soportados

| Operador | Alias | Descripcion |
|----------|-------|-------------|
| `=` | `$eq` | Igual a |
| `<>`, `!=` | `$ne` | Diferente de |
| `<` | `$lt` | Menor que |
| `<=` | `$lte` | Menor o igual que |
| `>` | `$gt` | Mayor que |
| `>=` | `$gte` | Mayor o igual que |
| `in` | `$in` | Incluido en array |
| `contains` | `$contains`, `include`, `$include` | Contiene substring |

#### Ejemplos de operadores

```typescript
// Igualdad
await User.where({ status: "active" });
await User.where({ status: { $eq: "active" } });

// Desigualdad
await User.where("status", "!=", "inactive");
await User.where({ status: { $ne: "inactive" } });

// Comparaciones numericas
await User.where("age", ">", 18);
await User.where({ age: { $gt: 18 } });
await User.where({ age: { $gte: 18, $lte: 65 } }); // Rango

// Inclusion en array
await User.where("status", "in", ["active", "pending"]);
await User.where({ status: { $in: ["active", "pending"] } });

// Busqueda de substring
await User.where("email", "contains", "@gmail.com");
await User.where({ email: { $contains: "@gmail.com" } });
```

#### Opciones de consulta

```typescript
const users = await User.where({ status: "active" }, {
  // Ordenamiento
  order: "ASC",                      // Por primary key
  order: "DESC",
  order: { created_at: "DESC" },     // Por campo especifico

  // Paginacion
  limit: 10,                         // Maximo registros
  offset: 20,                        // Saltar N registros
  skip: 20,                          // Alias de offset

  // Proyeccion
  attributes: ["id", "name", "email"], // Solo estos campos

  // Eager loading
  include: {
    profile: true,                   // Cargar relacion
    orders: {                        // Con opciones
      limit: 5,
      order: "DESC",
      where: { status: "completed" }
    },
    roles: true
  }
});
```

### create(data, tx?)

Crea un nuevo registro.

```typescript
// Creacion simple
const user = await User.create({
  name: "Juan",
  email: "juan@example.com"
});

// Con transaccion
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "Juan" }, tx);
  const order = await Order.create({ user_id: user.id, total: 100 }, tx);
});
```

### update(cambios, filtros, tx?)

Actualiza multiples registros que coincidan con los filtros.

```typescript
// Actualizar todos los usuarios inactivos
const affected = await User.update(
  { status: "suspended" },           // Cambios
  { status: "inactive", age: { $lt: 18 } }  // Filtros
);
console.log(`${affected} usuarios actualizados`);

// Con transaccion
await dynamite.tx(async (tx) => {
  await User.update({ status: "active" }, { id: "user-1" }, tx);
});
```

### delete(filtros, tx?)

Elimina registros que coincidan con los filtros.

```typescript
// Eliminar usuarios suspendidos
const deleted = await User.delete({ status: "suspended" });
console.log(`${deleted} usuarios eliminados`);

// Con soft delete: marca deleted_at en lugar de eliminar
// (si el schema tiene @DeleteAt)
```

### first(filtros, opciones?)

Obtiene el primer registro que coincida.

```typescript
// Por campo y valor
const user = await User.first("email", "juan@example.com");

// Por filtros
const admin = await User.first({ role: "admin", status: "active" });

// Con include
const user = await User.first({ id: "user-1" }, {
  include: { profile: true, orders: true }
});

// Retorna undefined si no encuentra
const notFound = await User.first({ id: "inexistente" });
console.log(notFound); // undefined
```

### last(filtros?, opciones?)

Obtiene el ultimo registro (ordenado por primary key DESC).

```typescript
const lastUser = await User.last();
const lastActive = await User.last({ status: "active" });
```

### withTrashed(filtros?, opciones?)

Incluye registros soft-deleted en la consulta.

```typescript
// Todos los usuarios (incluyendo eliminados)
const all = await User.withTrashed({});

// Con filtros
const allAdmins = await User.withTrashed({ role: "admin" });
```

### onlyTrashed(filtros?, opciones?)

Obtiene solo registros soft-deleted.

```typescript
// Solo usuarios eliminados
const deleted = await User.onlyTrashed({});

// Filtrados
const deletedAdmins = await User.onlyTrashed({ role: "admin" });
```

---

## 8. Metodos de instancia

Los metodos de instancia operan sobre un registro especifico.

### save()

Inserta o actualiza el registro en la base de datos.

```typescript
// Crear nuevo registro
const user = new User();
user.name = "Juan";
user.email = "juan@example.com";
await user.save(); // INSERT

// Modificar y guardar
user.name = "Juan Carlos";
await user.save(); // UPDATE
```

### update(cambios)

Actualiza propiedades especificas del registro.

```typescript
const user = await User.first({ id: "user-1" });

// Actualizar campos
await user.update({
  name: "Nuevo Nombre",
  status: "inactive"
});

// Equivalente a:
// user.name = "Nuevo Nombre";
// user.status = "inactive";
// await user.save();
```

### destroy()

Elimina el registro. Si el schema tiene `@DeleteAt`, realiza soft delete.

```typescript
const user = await User.first({ id: "user-1" });

// Soft delete (si tiene @DeleteAt)
await user.destroy();
// El registro permanece con deleted_at = timestamp

// Hard delete (si NO tiene @DeleteAt)
await user.destroy();
// El registro se elimina permanentemente
```

### forceDestroy()

Elimina permanentemente el registro, ignorando soft delete.

```typescript
const user = await User.first({ id: "user-1" });

// Elimina permanentemente (ignora @DeleteAt)
await user.forceDestroy();
```

### attach(Modelo, related_id, pivot_data?)

Agrega una relacion ManyToMany.

```typescript
const user = await User.first({ id: "user-1" });
const role = await Role.first({ name: "admin" });

// Agregar relacion
await user.attach(Role, role.id);

// Con datos adicionales en la tabla pivote
await user.attach(Role, role.id, {
  granted_at: new Date().toISOString(),
  granted_by: "admin-user-id"
});
```

**Requisitos:**
- El registro debe estar persistido (usar `create()` o `save()` primero)
- Debe existir una relacion `@ManyToMany` configurada

### detach(Modelo, related_id)

Elimina una relacion ManyToMany.

```typescript
const user = await User.first({ id: "user-1" });

// Eliminar relacion con un rol
await user.detach(Role, "role-admin-id");

// Verificar
const updated = await User.first({ id: user.id }, {
  include: { roles: true }
});
console.log(updated.roles); // Ya no incluye el rol eliminado
```

### sync(Modelo, related_ids)

Sincroniza las relaciones ManyToMany. Agrega las nuevas, elimina las que no estan en el array.

```typescript
const user = await User.first({ id: "user-1" });

// Estado actual: roles = ["admin", "editor", "viewer"]

// Sincronizar a solo estos roles
await user.sync(Role, ["admin", "moderator"]);

// Estado final: roles = ["admin", "moderator"]
// - "admin" se mantuvo
// - "editor" y "viewer" fueron removidos
// - "moderator" fue agregado
```

### toJSON()

Serializa el registro a un objeto plano.

```typescript
const user = await User.first({ id: "user-1" }, {
  include: { profile: true }
});

const json = user.toJSON();
console.log(json);
// {
//   id: "user-1",
//   name: "Juan",
//   email: "juan@example.com",
//   profile: { id: "profile-1", bio: "..." }
// }
```

### toString()

Retorna una representacion en string del registro.

```typescript
const user = await User.first({ id: "user-1" });
console.log(user.toString());
// "[User user-1]"
```
