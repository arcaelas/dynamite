# Relationships Guide

Esta guía completa cubre cómo definir, cargar y consultar relaciones entre modelos en Dynamite ORM. Las relaciones permiten estructurar datos complejos y navegar entre entidades relacionadas de forma eficiente.

## Tabla de Contenidos

- [Tipos de Relaciones](#tipos-de-relaciones)
- [One-to-Many (@HasMany)](#one-to-many-hasmany)
- [Many-to-One (@BelongsTo)](#many-to-one-belongsto)
- [Definiendo Relaciones](#definiendo-relaciones)
- [Cargando Relaciones](#cargando-relaciones)
- [Consultas con Relaciones](#consultas-con-relaciones)
- [Opciones de Relaciones](#opciones-de-relaciones)
- [Dependencias Circulares](#dependencias-circulares)
- [Consideraciones de Rendimiento](#consideraciones-de-rendimiento)
- [Ejemplo Completo E-commerce](#ejemplo-completo-e-commerce)
- [Mejores Prácticas](#mejores-prácticas)

---

## Tipos de Relaciones

Dynamite soporta dos tipos principales de relaciones:

### 1. One-to-Many (@HasMany)

Un modelo padre puede tener múltiples instancias relacionadas. Ejemplo: un Usuario tiene muchos Pedidos.

```typescript
@HasMany(() => Order, "user_id")
declare orders: NonAttribute<HasMany<Order>>;
```

### 2. Many-to-One (@BelongsTo)

Un modelo hijo pertenece a un único modelo padre. Ejemplo: un Pedido pertenece a un Usuario.

```typescript
@BelongsTo(() => User, "user_id")
declare user: NonAttribute<BelongsTo<User>>;
```

---

## One-to-Many (@HasMany)

La relación One-to-Many permite que un modelo padre tenga múltiples registros relacionados. Es la relación más común en aplicaciones.

### Ejemplo Básico: Usuario y Posts

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  BelongsTo,
  NotNull,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

// Modelo Usuario (Padre)
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare name: string;

  @NotNull()
  declare email: string;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Relación: Un usuario tiene muchos posts
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;

  // Relación: Un usuario tiene muchos comentarios
  @HasMany(() => Comment, "user_id")
  declare comments: NonAttribute<HasMany<Comment>>;
}

// Modelo Post (Hijo)
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare title: string;

  @NotNull()
  declare content: string;

  @Default(() => "draft")
  declare status: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Relación inversa: Un post pertenece a un usuario
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  // Relación: Un post tiene muchos comentarios
  @HasMany(() => Comment, "post_id")
  declare comments: NonAttribute<HasMany<Comment>>;
}

// Modelo Comment (Hijo de Post y User)
class Comment extends Table<Comment> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare post_id: string;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare content: string;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  // Relaciones
  @BelongsTo(() => Post, "post_id")
  declare post: NonAttribute<BelongsTo<Post>>;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}
```

### Uso de HasMany

```typescript
// Crear usuario con posts
const user = await User.create({
  name: "John Doe",
  email: "john@example.com"
});

// Crear posts para el usuario
await Post.create({
  user_id: user.id,
  title: "Mi primer post",
  content: "Contenido del post...",
  status: "published"
});

await Post.create({
  user_id: user.id,
  title: "Segundo post",
  content: "Más contenido...",
  status: "draft"
});

// Cargar usuario con sus posts
const usersWithPosts = await User.where({ id: user.id }, {
  include: {
    posts: {}
  }
});

const userWithPosts = usersWithPosts[0];
console.log(`${userWithPosts.name} tiene ${userWithPosts.posts.length} posts`);

// Iterar sobre los posts
userWithPosts.posts.forEach(post => {
  console.log(`- ${post.title} (${post.status})`);
});
```

---

## Many-to-One (@BelongsTo)

La relación Many-to-One es la inversa de One-to-Many. Define que un modelo hijo pertenece a un único modelo padre.

### Características de BelongsTo

1. **Foreign Key Requerida**: El modelo hijo debe tener la foreign key
2. **Retorna Instancia Única**: Devuelve una instancia o null
3. **Lazy Loading**: Solo se carga cuando se especifica en `include`

### Ejemplo Básico

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  @NotNull()
  declare total: number;

  @Default(() => "pending")
  declare status: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  // Relación: Un pedido pertenece a un usuario
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}

// Uso
const orders = await Order.where({}, {
  include: {
    user: {
      attributes: ["id", "name", "email"]
    }
  }
});

orders.forEach(order => {
  if (order.user) {
    console.log(`Pedido ${order.id} de ${order.user.name}`);
  }
});
```

### Relaciones Múltiples BelongsTo

Un modelo puede tener múltiples relaciones BelongsTo:

```typescript
class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare order_id: string;

  @NotNull()
  declare product_id: string;

  @NotNull()
  declare quantity: number;

  @NotNull()
  declare price: number;

  // Múltiples relaciones BelongsTo
  @BelongsTo(() => Order, "order_id")
  declare order: NonAttribute<BelongsTo<Order>>;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

// Cargar con ambas relaciones
const items = await OrderItem.where({}, {
  include: {
    order: {
      include: {
        user: {}
      }
    },
    product: {
      attributes: ["id", "name", "price"]
    }
  }
});

items.forEach(item => {
  console.log(`${item.quantity}x ${item.product?.name} en pedido ${item.order?.id}`);
  console.log(`Cliente: ${item.order?.user?.name}`);
});
```

---

## Definiendo Relaciones

### Foreign Keys

Las foreign keys son campos que almacenan el ID del modelo relacionado:

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  // Foreign key hacia User
  @NotNull()
  declare user_id: string;

  // Foreign key hacia Category
  @NotNull()
  declare category_id: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @BelongsTo(() => Category, "category_id")
  declare category: NonAttribute<BelongsTo<Category>>;
}
```

**Importante**:
- La foreign key debe existir como campo en el modelo
- Debe usar `@NotNull()` si la relación es obligatoria
- El nombre debe coincidir con el segundo parámetro del decorador

### Lazy Loading

Las relaciones no se cargan automáticamente. Debes especificarlas con `include`:

```typescript
// SIN relaciones cargadas
const users = await User.where({});
console.log(users[0].posts); // undefined

// CON relaciones cargadas
const usersWithPosts = await User.where({}, {
  include: {
    posts: {}
  }
});
console.log(usersWithPosts[0].posts); // Array de posts
```

### Nomenclatura de Foreign Keys

Convenciones recomendadas:

```typescript
// Formato: {modelo_singular}_id
declare user_id: string;      // Referencia a User
declare order_id: string;     // Referencia a Order
declare product_id: string;   // Referencia a Product
declare category_id: string;  // Referencia a Category

// Múltiples relaciones al mismo modelo
declare author_id: string;    // User como autor
declare reviewer_id: string;  // User como revisor
declare assignee_id: string;  // User como asignado
```

---

## Cargando Relaciones

### Método include()

El método `include()` carga relaciones junto con el modelo principal:

```typescript
// Cargar una relación simple
const users = await User.where({}, {
  include: {
    posts: {}
  }
});

// Cargar múltiples relaciones
const users = await User.where({}, {
  include: {
    posts: {},
    comments: {}
  }
});
```

### Relaciones Anidadas

Puedes cargar relaciones dentro de relaciones:

```typescript
// 3 niveles de profundidad
const users = await User.where({}, {
  include: {
    posts: {
      include: {
        comments: {
          include: {
            user: {
              attributes: ["id", "name"]
            }
          }
        }
      }
    }
  }
});

// Acceso a datos anidados
users.forEach(user => {
  console.log(`Usuario: ${user.name}`);

  user.posts?.forEach(post => {
    console.log(`  Post: ${post.title}`);

    post.comments?.forEach(comment => {
      console.log(`    Comentario de ${comment.user?.name}: ${comment.content}`);
    });
  });
});
```

### Include con Opciones

Puedes filtrar, limitar y ordenar relaciones cargadas:

```typescript
const users = await User.where({}, {
  include: {
    posts: {
      // Solo posts publicados
      where: { status: "published" },

      // Últimos 5 posts
      limit: 5,

      // Ordenar por más reciente
      order: "DESC",

      // Solo estos campos
      attributes: ["id", "title", "createdAt"],

      // Cargar comentarios de cada post
      include: {
        comments: {
          limit: 3,
          order: "DESC"
        }
      }
    }
  }
});
```

### Selección de Atributos en Relaciones

Limita los campos devueltos para optimizar performance:

```typescript
const orders = await Order.where({}, {
  // Campos del modelo principal
  attributes: ["id", "total", "status"],

  include: {
    user: {
      // Solo estos campos del usuario
      attributes: ["id", "name", "email"]
    },
    items: {
      attributes: ["id", "quantity", "price"],
      include: {
        product: {
          // Solo nombre y precio del producto
          attributes: ["name", "price"]
        }
      }
    }
  }
});
```

---

## Consultas con Relaciones

### Filtrar por Campos Relacionados

Puedes aplicar condiciones where a las relaciones:

```typescript
// Usuarios con posts publicados recientemente
const users = await User.where({}, {
  include: {
    posts: {
      where: {
        status: "published",
        createdAt: { $gte: "2024-01-01" }
      },
      limit: 10
    }
  }
});

// Pedidos con items de productos específicos
const orders = await Order.where({}, {
  include: {
    items: {
      where: {
        product_id: "product-123"
      }
    }
  }
});
```

### Operadores en Relaciones

Usa operadores de query en las condiciones de relaciones:

```typescript
const users = await User.where({}, {
  include: {
    posts: {
      // Posts con más de 100 vistas
      where: { views: { $gt: 100 } },
      order: "DESC"
    },
    orders: {
      // Pedidos caros
      where: { total: { $gte: 1000 } }
    }
  }
});
```

### Contar Elementos Relacionados

Para obtener conteo sin cargar todos los datos:

```typescript
// Cargar usuarios con conteo de posts
const users = await User.where({});

for (const user of users) {
  const postCount = await Post.where({ user_id: user.id }).then(posts => posts.length);
  console.log(`${user.name}: ${postCount} posts`);
}

// Más eficiente: Cargar con limit: 0 para solo contar
const usersWithCounts = await User.where({}, {
  include: {
    posts: {
      attributes: ["id"]  // Solo ID para minimizar datos
    }
  }
});

usersWithCounts.forEach(user => {
  console.log(`${user.name}: ${user.posts?.length || 0} posts`);
});
```

---

## Opciones de Relaciones

### Custom Foreign Keys

Por defecto, Dynamite usa `{modelo}_id` como foreign key, pero puedes personalizarlo:

```typescript
class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  // Foreign key personalizada
  @NotNull()
  declare author_id: string;

  // Especificar la foreign key personalizada
  @BelongsTo(() => User, "author_id")
  declare author: NonAttribute<BelongsTo<User>>;
}

// En el modelo User
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // Usar la misma foreign key personalizada
  @HasMany(() => Post, "author_id")
  declare authored_posts: NonAttribute<HasMany<Post>>;
}
```

### Múltiples Relaciones al Mismo Modelo

```typescript
class Task extends Table<Task> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare creator_id: string;

  declare assignee_id: string;

  declare reviewer_id: string;

  // Tres relaciones diferentes a User
  @BelongsTo(() => User, "creator_id")
  declare creator: NonAttribute<BelongsTo<User>>;

  @BelongsTo(() => User, "assignee_id")
  declare assignee: NonAttribute<BelongsTo<User>>;

  @BelongsTo(() => User, "reviewer_id")
  declare reviewer: NonAttribute<BelongsTo<User>>;
}

// Uso
const tasks = await Task.where({}, {
  include: {
    creator: {},
    assignee: {},
    reviewer: {}
  }
});

tasks.forEach(task => {
  console.log(`Tarea creada por ${task.creator?.name}`);
  console.log(`Asignada a ${task.assignee?.name}`);
  console.log(`Revisada por ${task.reviewer?.name}`);
});
```

---

## Dependencias Circulares

Las dependencias circulares ocurren cuando dos modelos se referencian entre sí. Dynamite las maneja usando funciones en lugar de referencias directas.

### Problema de Dependencias Circulares

```typescript
// INCORRECTO - Esto causará error
class User extends Table<User> {
  @HasMany(Post, "user_id")  // Post no está definido aún
  declare posts: NonAttribute<HasMany<Post>>;
}

class Post extends Table<Post> {
  @BelongsTo(User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}
```

### Solución: Usar Funciones

```typescript
// CORRECTO - Usar funciones arrow
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;

  // Usar () => Post en lugar de Post directamente
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;
}

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  // Usar () => User
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}
```

### Por Qué Funciona

Las funciones permiten lazy evaluation - el modelo no se resuelve hasta que se ejecuta la función, cuando ambas clases ya están definidas:

```typescript
// La función se ejecuta DESPUÉS de que ambas clases existen
() => Post  // Devuelve la clase Post cuando se llama

// Vs referencia directa que se evalúa INMEDIATAMENTE
Post  // Debe existir en el momento de evaluación
```

---

## Consideraciones de Rendimiento

### N+1 Query Problem

El problema N+1 ocurre cuando cargas registros y luego haces queries adicionales para cada uno:

```typescript
// MALO - N+1 queries
const users = await User.where({});  // 1 query

for (const user of users) {
  // N queries adicionales (uno por cada usuario)
  const posts = await Post.where({ user_id: user.id });
  console.log(`${user.name}: ${posts.length} posts`);
}
// Total: 1 + N queries
```

### Solución: Eager Loading

Usa `include` para cargar todas las relaciones en una sola operación:

```typescript
// BUENO - Una sola operación
const users = await User.where({}, {
  include: {
    posts: {}
  }
});

users.forEach(user => {
  console.log(`${user.name}: ${user.posts?.length || 0} posts`);
});
// Total: Operación eficiente con include
```

### Limitar Datos Cargados

```typescript
// Solo cargar lo necesario
const users = await User.where({}, {
  attributes: ["id", "name", "email"],  // Campos mínimos
  include: {
    posts: {
      attributes: ["id", "title"],      // Solo campos necesarios
      limit: 5,                         // Limitar cantidad
      where: { status: "published" }    // Filtrar datos
    }
  }
});
```

### Paginación con Relaciones

```typescript
// Paginar el modelo principal
const users = await User.where({}, {
  limit: 20,
  skip: 0,
  include: {
    posts: {
      limit: 5,  // Limitar posts por usuario
      order: "DESC"
    }
  }
});
```

### Campos Calculados vs Queries

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare user_id: string;

  @HasMany(() => OrderItem, "order_id")
  declare items: NonAttribute<HasMany<OrderItem>>;

  // Computed property - No requiere query adicional
  declare totalItems: NonAttribute<number>;

  constructor(data?: any) {
    super(data);

    Object.defineProperty(this, 'totalItems', {
      get: () => this.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      enumerable: true
    });
  }
}

// Uso eficiente
const orders = await Order.where({}, {
  include: {
    items: {
      attributes: ["id", "quantity"]  // Solo lo necesario
    }
  }
});

orders.forEach(order => {
  console.log(`Pedido ${order.id}: ${order.totalItems} items`);
  // No se hace query adicional - usa computed property
});
```

---

## Ejemplo Completo E-commerce

Sistema completo de e-commerce con Users, Orders, OrderItems y Products:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  HasMany,
  BelongsTo,
  NotNull,
  Validate,
  Mutate,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

// 1. MODELO USER
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Validate((value) => (value as string).length >= 2 || "Nombre muy corto")
  declare name: string;

  @NotNull()
  @Mutate((value) => (value as string).toLowerCase().trim())
  @Validate((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value as string) || "Email inválido")
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @Default(() => true)
  declare active: CreationOptional<boolean>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Relaciones
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;

  // Computed properties
  declare orderCount: NonAttribute<number>;
  declare totalSpent: NonAttribute<number>;

  constructor(data?: any) {
    super(data);

    Object.defineProperty(this, 'orderCount', {
      get: () => this.orders?.length || 0,
      enumerable: true
    });

    Object.defineProperty(this, 'totalSpent', {
      get: () => this.orders?.reduce((sum, order) => sum + order.total, 0) || 0,
      enumerable: true
    });
  }
}

// 2. MODELO PRODUCT
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  @Validate((value) => (value as string).length >= 3 || "Nombre muy corto")
  declare name: string;

  @Default(() => "")
  declare description: CreationOptional<string>;

  @NotNull()
  @Validate((value) => (value as number) >= 0 || "Precio debe ser positivo")
  declare price: number;

  @NotNull()
  @Default(() => 0)
  @Validate((value) => (value as number) >= 0 || "Stock no puede ser negativo")
  declare stock: CreationOptional<number>;

  @Default(() => true)
  declare available: CreationOptional<boolean>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Computed property
  declare inStock: NonAttribute<boolean>;

  constructor(data?: any) {
    super(data);

    Object.defineProperty(this, 'inStock', {
      get: () => this.stock > 0 && this.available,
      enumerable: true
    });
  }
}

// 3. MODELO ORDER
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare user_id: string;

  @NotNull()
  @Default(() => 0)
  @Validate((value) => (value as number) >= 0 || "Total debe ser positivo")
  declare total: CreationOptional<number>;

  @Default(() => "pending")
  @Validate((value) =>
    ["pending", "processing", "completed", "cancelled"].includes(value as string) ||
    "Estado inválido"
  )
  declare status: CreationOptional<string>;

  @Default(() => "")
  declare shipping_address: CreationOptional<string>;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  @UpdatedAt()
  declare updatedAt: CreationOptional<string>;

  // Relaciones
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @HasMany(() => OrderItem, "order_id")
  declare items: NonAttribute<HasMany<OrderItem>>;

  // Computed properties
  declare itemCount: NonAttribute<number>;
  declare totalQuantity: NonAttribute<number>;

  constructor(data?: any) {
    super(data);

    Object.defineProperty(this, 'itemCount', {
      get: () => this.items?.length || 0,
      enumerable: true
    });

    Object.defineProperty(this, 'totalQuantity', {
      get: () => this.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
      enumerable: true
    });
  }
}

// 4. MODELO ORDER ITEM
class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  @NotNull()
  declare order_id: string;

  @NotNull()
  declare product_id: string;

  @NotNull()
  @Default(() => 1)
  @Validate((value) => (value as number) > 0 || "Cantidad debe ser mayor a 0")
  declare quantity: CreationOptional<number>;

  @NotNull()
  @Validate((value) => (value as number) >= 0 || "Precio debe ser positivo")
  declare price: number;

  @CreatedAt()
  declare createdAt: CreationOptional<string>;

  // Relaciones
  @BelongsTo(() => Order, "order_id")
  declare order: NonAttribute<BelongsTo<Order>>;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;

  // Computed property
  declare subtotal: NonAttribute<number>;

  constructor(data?: any) {
    super(data);

    Object.defineProperty(this, 'subtotal', {
      get: () => this.quantity * this.price,
      enumerable: true
    });
  }
}

// ===== EJEMPLOS DE USO =====

async function CreateSampleData() {
  // Crear usuario
  const user = await User.create({
    name: "Juan Pérez",
    email: "juan@example.com"
  });

  // Crear productos
  const laptop = await Product.create({
    name: "Laptop Gaming",
    description: "Laptop de alto rendimiento",
    price: 1500,
    stock: 10
  });

  const mouse = await Product.create({
    name: "Mouse Inalámbrico",
    description: "Mouse ergonómico",
    price: 25,
    stock: 50
  });

  const keyboard = await Product.create({
    name: "Teclado Mecánico",
    description: "Teclado RGB",
    price: 80,
    stock: 30
  });

  // Crear orden
  const order = await Order.create({
    user_id: user.id,
    total: 0,  // Se calculará después
    status: "pending",
    shipping_address: "Calle Principal 123"
  });

  // Crear items del pedido
  const items = await Promise.all([
    OrderItem.create({
      order_id: order.id,
      product_id: laptop.id,
      quantity: 1,
      price: laptop.price
    }),
    OrderItem.create({
      order_id: order.id,
      product_id: mouse.id,
      quantity: 2,
      price: mouse.price
    }),
    OrderItem.create({
      order_id: order.id,
      product_id: keyboard.id,
      quantity: 1,
      price: keyboard.price
    })
  ]);

  // Calcular y actualizar total
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  await Order.update(order.id, { total });

  console.log("Datos de ejemplo creados exitosamente");
  return { user, order, products: [laptop, mouse, keyboard] };
}

async function GetUserOrders(userId: string) {
  const users = await User.where({ id: userId }, {
    include: {
      orders: {
        include: {
          items: {
            include: {
              product: {
                attributes: ["id", "name", "price"]
              }
            }
          }
        },
        order: "DESC"
      }
    }
  });

  const user = users[0];
  if (!user) return null;

  console.log(`\nUsuario: ${user.name} (${user.email})`);
  console.log(`Total de pedidos: ${user.orderCount}`);
  console.log(`Total gastado: $${user.totalSpent.toFixed(2)}\n`);

  user.orders?.forEach(order => {
    console.log(`Pedido #${order.id}`);
    console.log(`Estado: ${order.status}`);
    console.log(`Total: $${order.total.toFixed(2)}`);
    console.log(`Items: ${order.itemCount}`);
    console.log(`Cantidad total: ${order.totalQuantity}`);
    console.log(`Dirección: ${order.shipping_address}`);
    console.log(`Items:`);

    order.items?.forEach(item => {
      console.log(`  - ${item.product?.name} x${item.quantity} @ $${item.price} = $${item.subtotal}`);
    });
    console.log("");
  });

  return user;
}

async function GetOrderDetails(orderId: string) {
  const orders = await Order.where({ id: orderId }, {
    include: {
      user: {
        attributes: ["id", "name", "email"]
      },
      items: {
        include: {
          product: {}
        }
      }
    }
  });

  const order = orders[0];
  if (!order) return null;

  console.log(`\nPedido #${order.id}`);
  console.log(`Cliente: ${order.user?.name} (${order.user?.email})`);
  console.log(`Estado: ${order.status}`);
  console.log(`Dirección: ${order.shipping_address}`);
  console.log(`Fecha: ${order.createdAt}\n`);

  console.log("Items:");
  order.items?.forEach(item => {
    const product = item.product;
    console.log(`  ${product?.name}`);
    console.log(`    Precio: $${item.price}`);
    console.log(`    Cantidad: ${item.quantity}`);
    console.log(`    Subtotal: $${item.subtotal}`);
    console.log(`    Stock disponible: ${product?.stock}`);
  });

  console.log(`\nTotal del pedido: $${order.total.toFixed(2)}`);
  console.log(`Total de items: ${order.totalQuantity}`);

  return order;
}

async function UpdateOrderStatus(orderId: string, newStatus: string) {
  const order = await Order.update(orderId, {
    status: newStatus
  });

  console.log(`Pedido ${orderId} actualizado a ${newStatus}`);
  return order;
}

async function GetProductsSoldReport() {
  const products = await Product.where({});

  for (const product of products) {
    const items = await OrderItem.where({ product_id: product.id }, {
      include: {
        order: {
          where: { status: "completed" }
        }
      }
    });

    const totalSold = items.reduce((sum, item) => sum + item.quantity, 0);
    const revenue = items.reduce((sum, item) => sum + item.subtotal, 0);

    console.log(`\nProducto: ${product.name}`);
    console.log(`Precio: $${product.price}`);
    console.log(`Stock actual: ${product.stock}`);
    console.log(`Unidades vendidas: ${totalSold}`);
    console.log(`Ingresos: $${revenue.toFixed(2)}`);
  }
}
```

---

## Mejores Prácticas

### 1. Siempre Usar Funciones en Decoradores

```typescript
// CORRECTO
@HasMany(() => Order, "user_id")
@BelongsTo(() => User, "user_id")

// INCORRECTO
@HasMany(Order, "user_id")
@BelongsTo(User, "user_id")
```

### 2. Validar Foreign Keys

```typescript
class Order extends Table<Order> {
  // Siempre validar que la foreign key no sea null
  @NotNull()
  @Validate((value) => typeof value === "string" && value.length > 0 || "user_id requerido")
  declare user_id: string;
}
```

### 3. Usar NonAttribute para Relaciones

```typescript
// CORRECTO - Excluir de operaciones de BD
@HasMany(() => Post, "user_id")
declare posts: NonAttribute<HasMany<Post>>;

// INCORRECTO - Intentará guardar en BD
@HasMany(() => Post, "user_id")
declare posts: HasMany<Post>;
```

### 4. Computed Properties para Agregaciones

```typescript
class User extends Table<User> {
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;

  // Usar computed en lugar de queries adicionales
  declare totalOrders: NonAttribute<number>;
  declare totalRevenue: NonAttribute<number>;

  constructor(data?: any) {
    super(data);

    Object.defineProperty(this, 'totalOrders', {
      get: () => this.orders?.length || 0,
      enumerable: true
    });

    Object.defineProperty(this, 'totalRevenue', {
      get: () => this.orders?.reduce((sum, o) => sum + o.total, 0) || 0,
      enumerable: true
    });
  }
}
```

### 5. Limitar Profundidad de Includes

```typescript
// EVITAR - Demasiado profundo
const users = await User.where({}, {
  include: {
    orders: {
      include: {
        items: {
          include: {
            product: {
              include: {
                category: {
                  include: {
                    parent: {}  // 5 niveles
                  }
                }
              }
            }
          }
        }
      }
    }
  }
});

// PREFERIR - Máximo 2-3 niveles
const users = await User.where({}, {
  include: {
    orders: {
      include: {
        items: {}
      }
    }
  }
});
```

### 6. Seleccionar Solo Atributos Necesarios

```typescript
// Eficiente
const users = await User.where({}, {
  attributes: ["id", "name"],
  include: {
    orders: {
      attributes: ["id", "total", "status"],
      where: { status: "completed" }
    }
  }
});
```

### 7. Eager Loading vs Lazy Loading

```typescript
// Eager loading - Una sola operación
const users = await User.where({}, {
  include: { orders: {} }
});

// Lazy loading - Múltiples queries (evitar cuando sea posible)
const users = await User.where({});
for (const user of users) {
  user.orders = await Order.where({ user_id: user.id });
}
```

### 8. Paginación con Relaciones

```typescript
// Paginar modelo principal y limitar relaciones
const users = await User.where({}, {
  limit: 20,
  skip: pageNum * 20,
  include: {
    orders: {
      limit: 5,  // Solo últimos 5 pedidos por usuario
      order: "DESC"
    }
  }
});
```

### 9. Índices y Foreign Keys

```typescript
// Asegurar que foreign keys estén indexadas
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;

  // Foreign key - debería tener índice en DynamoDB
  @Index()  // Si es necesario
  @NotNull()
  declare user_id: string;
}
```

### 10. Manejo de Errores

```typescript
async function GetUserWithOrders(userId: string) {
  try {
    const users = await User.where({ id: userId }, {
      include: {
        orders: {
          include: {
            items: {}
          }
        }
      }
    });

    if (!users.length) {
      throw new Error("Usuario no encontrado");
    }

    const user = users[0];

    if (!user.orders || user.orders.length === 0) {
      console.log("Usuario sin pedidos");
    }

    return user;
  } catch (error) {
    console.error("Error al cargar usuario:", error);
    throw error;
  }
}
```

---

## Resumen

Las relaciones en Dynamite permiten:

1. **Estructurar datos complejos** con One-to-Many y Many-to-One
2. **Navegar entre entidades** usando include anidados
3. **Optimizar queries** con eager loading
4. **Filtrar y limitar** datos relacionados
5. **Computed properties** para agregaciones eficientes

**Puntos clave:**
- Usar `() =>` en decoradores para evitar dependencias circulares
- Aplicar `NonAttribute<>` a propiedades de relaciones
- Preferir eager loading sobre múltiples queries
- Limitar profundidad y cantidad de datos cargados
- Validar foreign keys con `@NotNull()` y `@Validate()`

Para más información consulta la [documentación principal](../../README.md).
