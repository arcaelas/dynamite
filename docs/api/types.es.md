# Referencia de API: Tipos

Esta guía documenta todos los tipos TypeScript exportados por Dynamite ORM que permiten crear modelos con type-safety completo.

## Tabla de Contenidos

- [Tipos de Marca de Atributos](#tipos-de-marca-de-atributos)
  - [CreationOptional\<T\>](#creationoptionalt)
  - [NonAttribute\<T\>](#nonattributet)
- [Tipos de Inferencia](#tipos-de-inferencia)
  - [InferAttributes\<T\>](#inferattributest)
  - [FilterableAttributes\<T\>](#filterableattributest)
- [Tipos de Relaciones](#tipos-de-relaciones)
  - [HasMany\<T\>](#hasmanyt)
  - [BelongsTo\<T\>](#belongstot)
- [Tipos de Consultas](#tipos-de-consultas)
  - [QueryOperator](#queryoperator)
  - [QueryResult\<T, A, I\>](#queryresultt-a-i)
  - [WhereOptions\<T\>](#whereoptionst)
  - [WhereOptionsWithoutWhere\<T\>](#whereoptionswithoutwheret)

---

## Tipos de Marca de Atributos

### CreationOptional\<T\>

Marca un campo como opcional durante la creación pero presente después de guardar. Usar para campos con valores por defecto, auto-generados o auto-calculados.

**Sintaxis:**
```typescript
declare field_name: CreationOptional<Type>;
```

**Características:**
- Campo opcional al llamar `Model.create()`
- Campo presente en la instancia después de guardar
- Ideal para IDs auto-generados, timestamps y valores por defecto

**Ejemplos:**

```typescript
import { Table, PrimaryKey, Default, CreatedAt, UpdatedAt, CreationOptional } from '@arcaelas/dynamite';

class User extends Table<User> {
  // ID auto-generado - SIEMPRE usar CreationOptional
  @PrimaryKey()
  declare id: CreationOptional<string>;

  // Campo requerido durante creación
  @NotNull()
  declare email: string;

  // Campo con valor por defecto - usar CreationOptional
  @Default(() => 'customer')
  declare role: CreationOptional<string>;

  // Booleano con valor por defecto - usar CreationOptional
  @Default(() => true)
  declare active: CreationOptional<boolean>;

  // Numérico con valor por defecto - usar CreationOptional
  @Default(() => 0)
  declare balance: CreationOptional<number>;

  // Timestamps auto-generados - SIEMPRE usar CreationOptional
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;
}

// Durante creación: solo campos requeridos
const user = await User.create({
  email: 'user@test.com'
  // id, role, active, balance, createdAt, updatedAt son opcionales
});

// Después de guardar: todos los campos están presentes
console.log(user.id);        // string (auto-generado)
console.log(user.role);      // 'customer' (valor por defecto)
console.log(user.active);    // true (valor por defecto)
console.log(user.balance);   // 0 (valor por defecto)
console.log(user.createdAt); // string (timestamp auto-generado)
console.log(user.updatedAt); // string (timestamp auto-generado)
```

**Regla de uso:**

Usar `CreationOptional<T>` para:
1. Campos con decorador `@PrimaryKey()` (IDs auto-generados)
2. Campos con decorador `@Default()` (valores por defecto)
3. Campos con decorador `@CreatedAt()` o `@UpdatedAt()` (timestamps)
4. Cualquier campo calculado automáticamente por el sistema

---

### NonAttribute\<T\>

Marca un campo como no persistente en la base de datos. Usar para propiedades calculadas, getters, métodos o datos temporales.

**Sintaxis:**
```typescript
declare field_name: NonAttribute<Type>;
```

**Características:**
- Campo NO se guarda en DynamoDB
- Campo NO se incluye en queries
- Ideal para propiedades computadas, getters y métodos de instancia
- Se excluye automáticamente de `InferAttributes<T>`

**Ejemplos:**

```typescript
import { Table, PrimaryKey, NotNull, NonAttribute } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare first_name: string;

  @NotNull()
  declare last_name: string;

  @NotNull()
  declare birth_date: string;

  // Propiedad computada - NO se persiste
  declare full_name: NonAttribute<string>;

  // Propiedad computada - NO se persiste
  declare age: NonAttribute<number>;

  // Método de instancia - NO se persiste
  declare get_display_name: NonAttribute<() => string>;

  constructor(data: any) {
    super(data);

    // Calcular propiedades computadas
    this.full_name = `${this.first_name} ${this.last_name}`;

    const birth = new Date(this.birth_date);
    const today = new Date();
    this.age = today.getFullYear() - birth.getFullYear();

    // Definir método de instancia
    this.get_display_name = () => {
      return `${this.full_name} (${this.age} años)`;
    };
  }
}

const user = await User.create({
  id: 'user-1',
  first_name: 'Juan',
  last_name: 'Pérez',
  birth_date: '1990-05-15'
});

// Propiedades computadas disponibles
console.log(user.full_name);           // 'Juan Pérez'
console.log(user.age);                 // 34
console.log(user.get_display_name());  // 'Juan Pérez (34 años)'

// Pero NO se guardan en la base de datos
// Solo se persisten: id, first_name, last_name, birth_date
```

**Casos de uso:**

```typescript
class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare price: number;

  @Default(() => 0)
  declare discount: CreationOptional<number>;

  // Precio final calculado - NonAttribute
  declare final_price: NonAttribute<number>;

  // Indicador si está en oferta - NonAttribute
  declare is_on_sale: NonAttribute<boolean>;

  // Método para aplicar descuento - NonAttribute
  declare apply_discount: NonAttribute<(additional: number) => number>;

  constructor(data: any) {
    super(data);

    this.final_price = this.price * (1 - (this.discount ?? 0) / 100);
    this.is_on_sale = (this.discount ?? 0) > 0;

    this.apply_discount = (additional: number) => {
      const total_discount = (this.discount ?? 0) + additional;
      return this.price * (1 - total_discount / 100);
    };
  }
}

const product = await Product.create({
  id: 'prod-1',
  name: 'Laptop',
  price: 1000,
  discount: 10
});

console.log(product.final_price);        // 900 (calculado)
console.log(product.is_on_sale);         // true (calculado)
console.log(product.apply_discount(5));  // 850 (método)
```

---

## Tipos de Inferencia

### InferAttributes\<T\>

Infiere automáticamente los atributos persistentes de un modelo, excluyendo relaciones, métodos y campos `NonAttribute`.

**Sintaxis:**
```typescript
type ModelAttributes = InferAttributes<ModelClass>;
```

**Características:**
- Excluye automáticamente relaciones (`HasMany`, `BelongsTo`)
- Excluye automáticamente campos `NonAttribute`
- Excluye automáticamente métodos
- Incluye solo campos que se persisten en DynamoDB
- Usado internamente por `where()`, `create()`, `update()`

**Ejemplos:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany, BelongsTo, NonAttribute, InferAttributes } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  @Default(() => 'customer')
  declare role: CreationOptional<string>;

  // Relación - NO es atributo persistente
  @HasMany(() => Order, 'user_id')
  declare orders: any;

  // Campo computado - NO es atributo persistente
  declare display_name: NonAttribute<string>;
}

// InferAttributes excluye 'orders' y 'display_name'
type UserAttributes = InferAttributes<User>;
// Equivale a:
// {
//   id: string;
//   email: string;
//   name: string;
//   role: string | undefined;
// }

// Uso en queries
const users = await User.where({
  role: 'customer',
  // orders: {} // ❌ Error: 'orders' no es atributo filtrable
  // display_name: 'X' // ❌ Error: 'display_name' no es atributo filtrable
});

// Uso en updates
await User.update(
  {
    name: 'Nuevo Nombre',
    // orders: [] // ❌ Error: no se puede actualizar relación
    // display_name: 'X' // ❌ Error: no se puede actualizar NonAttribute
  },
  { id: 'user-1' }
);
```

**Uso interno:**

```typescript
// Dynamite usa InferAttributes internamente
class Table<T> {
  // Constructor solo acepta atributos persistentes
  constructor(data: InferAttributes<T>) { }

  // where() solo acepta atributos persistentes como filtros
  static async where<M extends Table>(
    this: { new (data: InferAttributes<M>): M },
    filters: Partial<InferAttributes<M>>
  ): Promise<M[]> { }

  // update() solo permite actualizar atributos persistentes
  static async update<M extends Table>(
    this: { new (data: InferAttributes<M>): M },
    updates: Partial<InferAttributes<M>>,
    filters: Partial<InferAttributes<M>>
  ): Promise<number> { }
}
```

---

### FilterableAttributes\<T\>

Alias de `InferAttributes<T>` que representa atributos que pueden usarse en filtros de consultas.

**Sintaxis:**
```typescript
type Filterable = FilterableAttributes<ModelClass>;
```

**Características:**
- Es equivalente a `InferAttributes<T>`
- Usado en `WhereOptions<T>` para validar filtros
- Más semántico cuando se usa en contexto de queries

**Ejemplos:**

```typescript
import { Table, PrimaryKey, NotNull, FilterableAttributes } from '@arcaelas/dynamite';

class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare price: number;

  @Default(() => 0)
  declare stock: CreationOptional<number>;

  @HasMany(() => Review, 'product_id')
  declare reviews: any;
}

// FilterableAttributes solo incluye campos persistentes
type ProductFilters = FilterableAttributes<Product>;
// Equivale a:
// {
//   id: string;
//   name: string;
//   price: number;
//   stock: number | undefined;
// }

// Uso en queries con type-safety
const filters: Partial<ProductFilters> = {
  price: 100,
  stock: 50,
  // reviews: [] // ❌ Error: 'reviews' no es filtrable
};

const products = await Product.where(filters);
```

---

## Tipos de Relaciones

### HasMany\<T\>

Representa una relación uno-a-muchos donde el modelo actual tiene múltiples instancias del modelo relacionado.

**Sintaxis:**
```typescript
@HasMany(() => RelatedModel, 'foreign_key')
declare relation_name: any;
```

**Características:**
- Retorna array de instancias del modelo relacionado
- Se carga mediante opción `include` en queries
- Soporta filtros, límites y ordenamiento en la relación
- Implementa lazy loading automático

**Ejemplos básicos:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  // Un usuario tiene muchas órdenes
  @HasMany(() => Order, 'user_id')
  declare orders: any;

  // Un usuario tiene muchas reviews
  @HasMany(() => Review, 'user_id')
  declare reviews: any;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;

  // Una orden tiene muchos items
  @HasMany(() => OrderItem, 'order_id')
  declare items: any;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare order_id: string;

  @NotNull()
  declare product_id: string;

  @NotNull()
  declare quantity: number;
}

class Review extends Table<Review> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare product_id: string;

  @NotNull()
  declare rating: number;
}
```

**Ejemplos de uso:**

```typescript
// 1. Include simple
const users = await User.where({}, {
  include: {
    orders: {}
  }
});

users.forEach(user => {
  console.log(user.name);
  console.log(user.orders); // Array de Order[]
});

// 2. Include con filtros
const users_with_pending = await User.where({}, {
  include: {
    orders: {
      where: { status: 'pending' },
      limit: 10,
      order: 'DESC'
    }
  }
});

// 3. Include con múltiples relaciones
const users_full = await User.where({ id: 'user-1' }, {
  include: {
    orders: {
      include: {
        items: {} // Relación anidada
      }
    },
    reviews: {
      where: { rating: 5 }
    }
  }
});

console.log(users_full[0].orders);        // Order[]
console.log(users_full[0].orders[0].items); // OrderItem[]
console.log(users_full[0].reviews);       // Review[]

// 4. Include con atributos selectivos
const users_minimal = await User.where({}, {
  attributes: ['id', 'name'],
  include: {
    orders: {
      attributes: ['id', 'total', 'status']
    }
  }
});
```

**Opciones de relación HasMany:**

```typescript
interface IncludeOptions {
  where?: Record<string, any>;    // Filtros para la relación
  attributes?: string[];          // Campos a seleccionar
  limit?: number;                 // Límite de resultados
  skip?: number;                  // Offset para paginación
  order?: 'ASC' | 'DESC';         // Ordenamiento
  include?: Record<string, any>;  // Relaciones anidadas
}
```

---

### BelongsTo\<T\>

Representa una relación muchos-a-uno donde el modelo actual pertenece a una instancia del modelo relacionado.

**Sintaxis:**
```typescript
@BelongsTo(() => RelatedModel, 'local_key')
declare relation_name: any;
```

**Características:**
- Retorna una instancia del modelo relacionado o `null`
- Se carga mediante opción `include` en queries
- Usa la clave local (foreign key) para encontrar el registro relacionado
- Soporta relaciones anidadas

**Ejemplos básicos:**

```typescript
import { Table, PrimaryKey, NotNull, BelongsTo } from '@arcaelas/dynamite';

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;

  // Una orden pertenece a un usuario
  @BelongsTo(() => User, 'user_id')
  declare user: any;
}

class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare category_id: string;

  @NotNull()
  declare name: string;

  // Un producto pertenece a una categoría
  @BelongsTo(() => Category, 'category_id')
  declare category: any;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare order_id: string;

  @NotNull()
  declare product_id: string;

  // Un item pertenece a una orden
  @BelongsTo(() => Order, 'order_id')
  declare order: any;

  // Un item pertenece a un producto
  @BelongsTo(() => Product, 'product_id')
  declare product: any;
}

class Category extends Table<Category> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;
}
```

**Ejemplos de uso:**

```typescript
// 1. Include simple
const orders = await Order.where({}, {
  include: {
    user: {}
  }
});

orders.forEach(order => {
  console.log(order.total);
  console.log(order.user.name); // User | null
});

// 2. Include con relaciones anidadas
const products = await Product.where({}, {
  include: {
    category: {}
  }
});

products.forEach(product => {
  console.log(product.name);
  if (product.category) {
    console.log(product.category.name);
  }
});

// 3. Include múltiples BelongsTo
const items = await OrderItem.where({}, {
  include: {
    order: {
      include: {
        user: {} // Relación anidada
      }
    },
    product: {
      include: {
        category: {} // Relación anidada
      }
    }
  }
});

items.forEach(item => {
  console.log(item.order.user.name);      // Usuario de la orden
  console.log(item.product.category.name); // Categoría del producto
});

// 4. Include con filtros en relación padre
const recent_orders = await Order.where(
  { status: 'delivered' },
  {
    include: {
      user: {
        where: { active: true }
      }
    }
  }
);
```

**Manejo de valores nulos:**

```typescript
const products = await Product.where({}, {
  include: {
    category: {}
  }
});

products.forEach(product => {
  // BelongsTo puede retornar null si la relación no existe
  if (product.category) {
    console.log(product.category.name);
  } else {
    console.log('Producto sin categoría');
  }
});
```

---

## Tipos de Consultas

### QueryOperator

Operadores disponibles para filtros en consultas where.

**Sintaxis:**
```typescript
type QueryOperator =
  | '='           // Igual
  | '!='          // Diferente
  | '<'           // Menor que
  | '<='          // Menor o igual
  | '>'           // Mayor que
  | '>='          // Mayor o igual
  | 'in'          // En array
  | 'not-in'      // No en array
  | 'contains'    // Contiene (strings)
  | 'begins-with' // Comienza con (strings)
```

**Ejemplos:**

```typescript
import { Table, PrimaryKey, NotNull } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare age: number;

  @NotNull()
  declare role: string;

  @Default(() => true)
  declare active: CreationOptional<boolean>;
}

// Operador '=' (implícito)
const admins = await User.where('role', 'admin');
const admins2 = await User.where('role', '=', 'admin');

// Operador '!='
const non_admins = await User.where('role', '!=', 'admin');

// Operadores numéricos
const adults = await User.where('age', '>=', 18);
const young = await User.where('age', '<', 30);
const specific_age = await User.where('age', '>', 25);
const age_limit = await User.where('age', '<=', 65);

// Operador 'in'
const staff = await User.where('role', 'in', ['admin', 'employee']);
const staff2 = await User.where('role', ['admin', 'employee']); // Atajo

// Operador 'not-in'
const customers = await User.where('role', 'not-in', ['admin', 'employee']);

// Operador 'contains' (strings)
const gmail_users = await User.where('email', 'contains', '@gmail.com');
const name_with_a = await User.where('name', 'contains', 'a');

// Operador 'begins-with' (strings)
const admins_by_email = await User.where('email', 'begins-with', 'admin@');
const a_names = await User.where('name', 'begins-with', 'A');
```

**Combinación de operadores:**

```typescript
// Múltiples condiciones con objeto
const active_admins = await User.where({
  role: 'admin',
  active: true
});

// Operadores en cadena
const young_admins = await User.where('age', '<', 30);
const active_young_admins = young_admins.filter(u => u.active);

// Operadores con opciones
const paginated = await User.where(
  'age',
  '>=',
  18,
  {
    limit: 10,
    skip: 20,
    order: 'DESC'
  }
);
```

---

### QueryResult\<T, A, I\>

Tipo del resultado de una consulta con includes y selección de atributos.

**Sintaxis:**
```typescript
type Result = QueryResult<Model, Attributes, Includes>;
```

**Parámetros:**
- `T`: Clase del modelo
- `A`: Atributos seleccionados (keys de T)
- `I`: Relaciones incluidas (objeto de configuración de includes)

**Características:**
- Infiere automáticamente el tipo de retorno basado en includes
- Type-safety completo para relaciones incluidas
- Soporta selección parcial de atributos

**Ejemplos:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany, BelongsTo, QueryResult } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @HasMany(() => Order, 'user_id')
  declare orders: any;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;

  @BelongsTo(() => User, 'user_id')
  declare user: any;

  @HasMany(() => OrderItem, 'order_id')
  declare items: any;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare order_id: string;

  @NotNull()
  declare quantity: number;
}

// Ejemplo 1: Sin includes
const users1 = await User.where({});
// Tipo: User[]

// Ejemplo 2: Con include simple
const users2 = await User.where({}, {
  include: {
    orders: {}
  }
});
// Tipo inferido:
// (User & { orders: Order[] })[]

// Ejemplo 3: Con selección de atributos
const users3 = await User.where({}, {
  attributes: ['id', 'name']
});
// Tipo inferido:
// Pick<User, 'id' | 'name'>[]

// Ejemplo 4: Con includes anidados
const users4 = await User.where({}, {
  include: {
    orders: {
      include: {
        items: {}
      }
    }
  }
});
// Tipo inferido:
// (User & {
//   orders: (Order & {
//     items: OrderItem[]
//   })[]
// })[]

// Uso con type-safety
users4.forEach(user => {
  console.log(user.name);      // ✓ Type-safe
  console.log(user.orders);    // ✓ Order[]
  user.orders.forEach(order => {
    console.log(order.items);  // ✓ OrderItem[]
  });
});
```

---

### WhereOptions\<T\>

Opciones completas para consultas where, incluyendo filtros, paginación, ordenamiento e includes.

**Sintaxis:**
```typescript
interface WhereOptions<T> {
  where?: Partial<FilterableAttributes<T>>;
  skip?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  attributes?: (keyof FilterableAttributes<T>)[];
  include?: {
    [K in keyof T]?: T[K] extends HasMany<any> | BelongsTo<any>
      ? IncludeOptions | {}
      : never;
  };
}
```

**Propiedades:**

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `where` | `Partial<FilterableAttributes<T>>` | Filtros para la consulta |
| `skip` | `number` | Offset para paginación |
| `limit` | `number` | Límite de resultados |
| `order` | `'ASC' \| 'DESC'` | Ordenamiento por clave primaria |
| `attributes` | `(keyof FilterableAttributes<T>)[]` | Campos a seleccionar |
| `include` | `object` | Relaciones a incluir |

**Ejemplos:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany, WhereOptions } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @NotNull()
  declare age: number;

  @Default(() => 'customer')
  declare role: CreationOptional<string>;

  @HasMany(() => Order, 'user_id')
  declare orders: any;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;
}

// Ejemplo 1: Solo filtros
const options1: WhereOptions<User> = {
  where: {
    role: 'admin',
    age: 30
  }
};
const admins = await User.where({}, options1);

// Ejemplo 2: Con paginación
const options2: WhereOptions<User> = {
  where: {
    role: 'customer'
  },
  limit: 10,
  skip: 20,
  order: 'DESC'
};
const customers = await User.where({}, options2);

// Ejemplo 3: Con selección de atributos
const options3: WhereOptions<User> = {
  where: {
    age: 25
  },
  attributes: ['id', 'name', 'email']
};
const users = await User.where({}, options3);

// Ejemplo 4: Con includes
const options4: WhereOptions<User> = {
  where: {
    role: 'customer'
  },
  include: {
    orders: {
      where: { total: 100 },
      limit: 5,
      order: 'DESC'
    }
  }
};
const customers_with_orders = await User.where({}, options4);

// Ejemplo 5: Completo
const options5: WhereOptions<User> = {
  where: {
    role: 'customer',
    age: 30
  },
  attributes: ['id', 'name', 'email'],
  limit: 20,
  skip: 0,
  order: 'ASC',
  include: {
    orders: {
      attributes: ['id', 'total'],
      where: { total: 500 },
      limit: 10
    }
  }
};
const filtered = await User.where({}, options5);
```

**Uso con operadores:**

```typescript
// where() acepta operadores y opciones
const users = await User.where(
  'age',
  '>=',
  18,
  {
    limit: 10,
    order: 'DESC',
    attributes: ['id', 'name'],
    include: {
      orders: {}
    }
  } as WhereOptions<User>
);
```

---

### WhereOptionsWithoutWhere\<T\>

Opciones de consulta sin el campo `where`, útil cuando los filtros se pasan como primer argumento.

**Sintaxis:**
```typescript
type OptionsWithoutWhere<T> = Omit<WhereOptions<T>, 'where'>;
```

**Características:**
- Es `WhereOptions<T>` sin la propiedad `where`
- Usado cuando los filtros se pasan separadamente
- Más semántico en ciertos contextos

**Ejemplos:**

```typescript
import { Table, PrimaryKey, NotNull, HasMany, WhereOptionsWithoutWhere } from '@arcaelas/dynamite';

class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare name: string;

  @HasMany(() => Order, 'user_id')
  declare orders: any;
}

// Filtros separados de opciones
const filters = { role: 'admin' };

const options: WhereOptionsWithoutWhere<User> = {
  limit: 10,
  skip: 0,
  order: 'DESC',
  attributes: ['id', 'name'],
  include: {
    orders: {}
  }
};

const users = await User.where(filters, options);

// También útil en funciones helper
async function find_paginated<T extends Table>(
  Model: { new (data: any): T },
  filters: Partial<InferAttributes<T>>,
  page: number,
  page_size: number
): Promise<T[]> {
  const options: WhereOptionsWithoutWhere<T> = {
    limit: page_size,
    skip: page * page_size,
    order: 'ASC'
  };

  return Model.where(filters, options);
}
```

---

## Patrones Comunes

### Modelo completo con todos los tipos

```typescript
import {
  Table,
  PrimaryKey,
  NotNull,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  BelongsTo,
  CreationOptional,
  NonAttribute,
  InferAttributes,
  FilterableAttributes
} from '@arcaelas/dynamite';

class User extends Table<User> {
  // ID auto-generado - CreationOptional
  @PrimaryKey()
  declare id: CreationOptional<string>;

  // Campos requeridos - sin marca
  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  // Campos con valores por defecto - CreationOptional
  @Default(() => 'customer')
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @Default(() => 0)
  declare balance: CreationOptional<number>;

  // Timestamps auto-generados - CreationOptional
  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Propiedades computadas - NonAttribute
  declare full_name: NonAttribute<string>;
  declare display_role: NonAttribute<string>;

  // Relaciones - no requieren marca especial
  @HasMany(() => Order, 'user_id')
  declare orders: any;

  @HasMany(() => Review, 'user_id')
  declare reviews: any;

  constructor(data: InferAttributes<User>) {
    super(data);

    this.full_name = `${this.name} <${this.email}>`;
    this.display_role = this.role === 'admin' ? 'Administrador' : 'Cliente';
  }
}

// Durante creación: solo campos requeridos
const user = await User.create({
  email: 'user@test.com',
  name: 'Juan Pérez'
});

// Después de guardar: todos los campos presentes
console.log(user.id);          // string (auto-generado)
console.log(user.role);        // 'customer' (default)
console.log(user.active);      // true (default)
console.log(user.balance);     // 0 (default)
console.log(user.createdAt);   // string (timestamp)
console.log(user.full_name);   // 'Juan Pérez <user@test.com>' (computed)
console.log(user.display_role); // 'Cliente' (computed)
```

### Query avanzada con todos los tipos

```typescript
import { WhereOptions, QueryOperator } from '@arcaelas/dynamite';

// Función helper genérica con type-safety
async function find_advanced<T extends Table>(
  Model: { new (data: InferAttributes<T>): T },
  field: keyof FilterableAttributes<T>,
  operator: QueryOperator,
  value: any,
  options?: WhereOptionsWithoutWhere<T>
): Promise<T[]> {
  return Model.where(field as string, operator, value, options);
}

// Uso con inferencia completa
const admins = await find_advanced(
  User,
  'role',
  '=',
  'admin',
  {
    limit: 10,
    attributes: ['id', 'name', 'email'],
    include: {
      orders: {
        where: { status: 'delivered' },
        limit: 5
      }
    }
  }
);
```

---

## Resumen

| Tipo | Propósito | Cuándo Usar |
|------|-----------|-------------|
| `CreationOptional<T>` | Campos opcionales al crear | IDs auto-generados, defaults, timestamps |
| `NonAttribute<T>` | Campos no persistentes | Propiedades computadas, getters, métodos |
| `InferAttributes<T>` | Atributos persistentes | Type-safety en queries y updates |
| `FilterableAttributes<T>` | Atributos filtrables | Type-safety en where clauses |
| `HasMany<T>` | Relación uno-a-muchos | Cuando un modelo tiene múltiples instancias relacionadas |
| `BelongsTo<T>` | Relación muchos-a-uno | Cuando un modelo pertenece a otro |
| `QueryOperator` | Operadores de consulta | Filtros avanzados en where |
| `QueryResult<T, A, I>` | Tipo de resultado | Inferencia de tipo en queries con includes |
| `WhereOptions<T>` | Opciones de consulta | Queries completas con filtros, paginación e includes |
| `WhereOptionsWithoutWhere<T>` | Opciones sin filtros | Queries donde filtros se pasan separadamente |

---

## Mejores Prácticas

1. **Siempre usar `CreationOptional<T>` para**:
   - Campos con `@PrimaryKey()` (auto-generados)
   - Campos con `@Default()` (valores por defecto)
   - Campos con `@CreatedAt()` o `@UpdatedAt()` (timestamps)

2. **Siempre usar `NonAttribute<T>` para**:
   - Propiedades calculadas en el constructor
   - Getters que derivan de otros campos
   - Métodos de instancia

3. **Relaciones**:
   - Usar `@HasMany` para arrays de modelos relacionados
   - Usar `@BelongsTo` para referencias únicas a modelos relacionados
   - No aplicar marcas de tipo adicionales a relaciones

4. **Type-safety**:
   - Usar `InferAttributes<T>` en funciones genéricas
   - Usar `FilterableAttributes<T>` para validar filtros
   - Usar `WhereOptions<T>` para opciones completas de query

5. **Performance**:
   - Solo incluir relaciones necesarias con `include`
   - Usar `attributes` para seleccionar solo campos requeridos
   - Aplicar `limit` y `skip` para paginación

---

Para más información, consulta:
- [Guía de Instalación](../installation.md)
- [Referencia de Decoradores](./decorators.md)
- [Referencia de Table](./table.md)
