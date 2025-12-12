# Ejemplo de Relaciones

Este ejemplo completo demuestra cómo definir y usar relaciones en Dynamite ORM. Aprende cómo crear relaciones uno-a-muchos (HasMany) y muchos-a-uno (BelongsTo), realizar includes anidados, filtrar datos relacionados y construir estructuras de datos complejas.

## Tabla de Contenidos

- [Conceptos Básicos de Relaciones](#conceptos-básicos-de-relaciones)
- [Uno-a-Muchos (HasMany)](#uno-a-muchos-hasmany)
- [Muchos-a-Uno (BelongsTo)](#muchos-a-uno-belongsto)
- [Relaciones Anidadas](#relaciones-anidadas)
- [Relaciones Filtradas](#relaciones-filtradas)
- [Ejemplo Completo de E-Commerce](#ejemplo-completo-de-e-commerce)
- [Salida Esperada](#salida-esperada)
- [Patrones Avanzados](#patrones-avanzados)
- [Mejores Prácticas](#mejores-prácticas)

## Conceptos Básicos de Relaciones

Dynamite soporta dos tipos de relaciones:

- **HasMany** - Relación uno-a-muchos (padre tiene múltiples hijos)
- **BelongsTo** - Relación muchos-a-uno (hijo pertenece a padre)

### Conceptos Clave

```typescript
import { HasMany, BelongsTo, NonAttribute } from "@arcaelas/dynamite";

// Modelo padre (User tiene muchos Orders)
class User extends Table<User> {
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;
}

// Modelo hijo (Order pertenece a User)
class Order extends Table<Order> {
  declare user_id: string; // Clave foránea

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}
```

**Importante:**
- Usa el wrapper `NonAttribute<>` para campos de relación (no se almacenan en DB)
- `HasMany<T>` se resuelve a `T[]` (array de registros relacionados)
- `BelongsTo<T>` se resuelve a `T | null` (un único registro relacionado o null)
- El campo de clave foránea debe existir en el modelo hijo

## Uno-a-Muchos (HasMany)

Define una relación uno-a-muchos donde un modelo padre tiene múltiples hijos relacionados.

### Ejemplo Básico de HasMany

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  HasMany,
  CreationOptional,
  NonAttribute
} from "@arcaelas/dynamite";

// Modelo User (padre)
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  // Uno-a-muchos: User tiene muchos Posts
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;
}

// Modelo Post (hijo)
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string; // Clave foránea
  declare title: string;
  declare content: string;
}
```

### Cargar Relaciones HasMany

```typescript
// Cargar usuarios con sus posts
const users_with_posts = await User.where({}, {
  include: {
    posts: {}
  }
});

users_with_posts.forEach(user => {
  console.log(`${user.name} has ${user.posts.length} posts`);
  user.posts.forEach(post => {
    console.log(`  - ${post.title}`);
  });
});

// Cargar usuario específico con posts
const user = await User.first({ id: "user-123" });
if (user) {
  const user_with_posts = await User.where({ id: user.id }, {
    include: { posts: {} }
  });
  console.log(`Posts: ${user_with_posts[0].posts.length}`);
}
```

### Múltiples Relaciones HasMany

Un modelo puede tener múltiples relaciones uno-a-muchos:

```typescript
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;

  // User tiene muchos Posts
  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;

  // User tiene muchos Comments
  @HasMany(() => Comment, "user_id")
  declare comments: NonAttribute<HasMany<Comment>>;

  // User tiene muchos Orders
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;
}

// Cargar usuario con todas las relaciones
const users = await User.where({ id: "user-123" }, {
  include: {
    posts: {},
    comments: {},
    orders: {}
  }
});

const user = users[0];
console.log(`Posts: ${user.posts.length}`);
console.log(`Comments: ${user.comments.length}`);
console.log(`Orders: ${user.orders.length}`);
```

## Muchos-a-Uno (BelongsTo)

Define una relación muchos-a-uno donde un modelo hijo pertenece a un solo padre.

### Ejemplo Básico de BelongsTo

```typescript
// Modelo Post (hijo)
class Post extends Table<Post> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string; // Clave foránea
  declare title: string;
  declare content: string;

  // Muchos-a-uno: Post pertenece a User
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}

// Modelo User (padre)
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;
}
```

### Cargar Relaciones BelongsTo

```typescript
// Cargar posts con su autor
const posts_with_author = await Post.where({}, {
  include: {
    user: {}
  }
});

posts_with_author.forEach(post => {
  console.log(`${post.title} by ${post.user?.name || 'Unknown'}`);
});

// Cargar post específico con autor
const post = await Post.first({ id: "post-123" });
if (post) {
  const post_with_author = await Post.where({ id: post.id }, {
    include: { user: {} }
  });
  console.log(`Author: ${post_with_author[0].user?.name}`);
}
```

### Múltiples Relaciones BelongsTo

Un modelo hijo puede pertenecer a múltiples padres:

```typescript
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare product_id: string;
  declare quantity: number;

  // Order pertenece a User
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  // Order pertenece a Product
  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

// Cargar orden con ambas relaciones
const orders = await Order.where({ id: "order-123" }, {
  include: {
    user: {},
    product: {}
  }
});

const order = orders[0];
console.log(`Customer: ${order.user?.name}`);
console.log(`Product: ${order.product?.name}`);
console.log(`Quantity: ${order.quantity}`);
```

## Relaciones Anidadas

Cargar relaciones que tienen sus propias relaciones (includes anidados).

### Anidamiento de Dos Niveles

```typescript
// User tiene muchos Posts, Post tiene muchos Comments
class User extends Table<User> {
  @PrimaryKey()
  declare id: string;
  declare name: string;

  @HasMany(() => Post, "user_id")
  declare posts: NonAttribute<HasMany<Post>>;
}

class Post extends Table<Post> {
  @PrimaryKey()
  declare id: string;
  declare user_id: string;
  declare title: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @HasMany(() => Comment, "post_id")
  declare comments: NonAttribute<HasMany<Comment>>;
}

class Comment extends Table<Comment> {
  @PrimaryKey()
  declare id: string;
  declare post_id: string;
  declare content: string;
}

// Cargar usuarios con posts y comentarios
const users = await User.where({}, {
  include: {
    posts: {
      include: {
        comments: {}
      }
    }
  }
});

users.forEach(user => {
  console.log(`${user.name}:`);
  user.posts.forEach(post => {
    console.log(`  ${post.title} (${post.comments.length} comments)`);
    post.comments.forEach(comment => {
      console.log(`    - ${comment.content}`);
    });
  });
});
```

### Anidamiento Multi-Nivel

```typescript
// Order -> OrderItem -> Product
class Order extends Table<Order> {
  @PrimaryKey()
  declare id: string;
  declare user_id: string;

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @HasMany(() => OrderItem, "order_id")
  declare items: NonAttribute<HasMany<OrderItem>>;
}

class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  declare id: string;
  declare order_id: string;
  declare product_id: string;
  declare quantity: number;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

class Product extends Table<Product> {
  @PrimaryKey()
  declare id: string;
  declare name: string;
  declare price: number;
}

// Cargar órdenes con items y productos
const orders = await Order.where({}, {
  include: {
    user: {},
    items: {
      include: {
        product: {}
      }
    }
  }
});

orders.forEach(order => {
  console.log(`Order ${order.id} by ${order.user?.name}`);
  order.items.forEach(item => {
    console.log(`  ${item.quantity}x ${item.product?.name} @ $${item.product?.price}`);
  });
});
```

## Relaciones Filtradas

Aplicar filtros, límites y ordenamiento a datos relacionados.

### Filtrar Registros Relacionados

```typescript
// Cargar usuario solo con posts publicados
const users = await User.where({ id: "user-123" }, {
  include: {
    posts: {
      where: { status: "published" }
    }
  }
});

console.log(`Published posts: ${users[0].posts.length}`);
```

### Limitar Registros Relacionados

```typescript
// Cargar usuario con 5 posts más recientes
const users = await User.where({ id: "user-123" }, {
  include: {
    posts: {
      limit: 5,
      order: "DESC"
    }
  }
});

console.log(`Recent posts: ${users[0].posts.length}`);
```

### Seleccionar Atributos Específicos

```typescript
// Cargar posts solo con nombre y email del usuario
const posts = await Post.where({}, {
  include: {
    user: {
      attributes: ["id", "name", "email"]
    }
  }
});

posts.forEach(post => {
  console.log(`${post.title} by ${post.user?.name} (${post.user?.email})`);
});
```

### Filtros Combinados

```typescript
// Consulta de relación compleja
const users = await User.where({ role: "premium" }, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 10,
      order: "DESC",
      attributes: ["id", "total", "created_at"]
    },
    posts: {
      where: { published: true },
      limit: 5
    }
  }
});

users.forEach(user => {
  console.log(`${user.name}:`);
  console.log(`  Recent orders: ${user.orders.length}`);
  console.log(`  Published posts: ${user.posts.length}`);
});
```

## Ejemplo Completo de E-Commerce

Aquí hay un sistema completo de e-commerce que demuestra todos los patrones de relaciones:

```typescript
import {
  Table,
  PrimaryKey,
  Default,
  HasMany,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  CreationOptional,
  NonAttribute,
  Dynamite
} from "@arcaelas/dynamite";

// Modelo User
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare email: string;

  @Default(() => "customer")
  declare role: CreationOptional<string>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  // Relaciones
  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<HasMany<Order>>;

  @HasMany(() => Review, "user_id")
  declare reviews: NonAttribute<HasMany<Review>>;
}

// Modelo Product
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare name: string;
  declare description: string;
  declare price: number;

  @Default(() => 0)
  declare stock: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Relaciones
  @HasMany(() => OrderItem, "product_id")
  declare order_items: NonAttribute<HasMany<OrderItem>>;

  @HasMany(() => Review, "product_id")
  declare reviews: NonAttribute<HasMany<Review>>;
}

// Modelo Order
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;

  @Default(() => "pending")
  declare status: CreationOptional<string>;

  declare total: number;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  // Relaciones
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @HasMany(() => OrderItem, "order_id")
  declare items: NonAttribute<HasMany<OrderItem>>;
}

// Modelo OrderItem
class OrderItem extends Table<OrderItem> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare order_id: string;
  declare product_id: string;
  declare quantity: number;
  declare price: number;

  // Relaciones
  @BelongsTo(() => Order, "order_id")
  declare order: NonAttribute<BelongsTo<Order>>;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

// Modelo Review
class Review extends Table<Review> {
  @PrimaryKey()
  @Default(() => crypto.randomUUID())
  declare id: CreationOptional<string>;

  declare user_id: string;
  declare product_id: string;
  declare rating: number;
  declare comment: string;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  // Relaciones
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;

  @BelongsTo(() => Product, "product_id")
  declare product: NonAttribute<BelongsTo<Product>>;
}

// Configurar DynamoDB y registrar todas las tablas
const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  tables: [User, Product, Order, OrderItem, Review],
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test"
  }
});

// Aplicación principal
async function main() {
  // Conectar y sincronizar tablas
  dynamite.connect();
  await dynamite.sync();
  console.log("=== E-Commerce Relationships Example ===\n");

  // 1. Crear usuarios
  console.log("1. Creating users...");
  const user1 = await User.create({
    name: "John Doe",
    email: "john@example.com"
  });
  const user2 = await User.create({
    name: "Jane Smith",
    email: "jane@example.com"
  });
  console.log(`Created: ${user1.name}, ${user2.name}\n`);

  // 2. Crear productos
  console.log("2. Creating products...");
  const product1 = await Product.create({
    name: "Laptop",
    description: "High-performance laptop",
    price: 999.99,
    stock: 10
  });
  const product2 = await Product.create({
    name: "Mouse",
    description: "Wireless mouse",
    price: 29.99,
    stock: 50
  });
  const product3 = await Product.create({
    name: "Keyboard",
    description: "Mechanical keyboard",
    price: 79.99,
    stock: 30
  });
  console.log(`Created: ${product1.name}, ${product2.name}, ${product3.name}\n`);

  // 3. Crear órdenes
  console.log("3. Creating orders...");
  const order1 = await Order.create({
    user_id: user1.id,
    total: 1109.97,
    status: "pending"
  });
  const order2 = await Order.create({
    user_id: user2.id,
    total: 79.99,
    status: "completed"
  });
  console.log(`Created: Order ${order1.id}, Order ${order2.id}\n`);

  // 4. Crear items de orden
  console.log("4. Creating order items...");
  await OrderItem.create({
    order_id: order1.id,
    product_id: product1.id,
    quantity: 1,
    price: 999.99
  });
  await OrderItem.create({
    order_id: order1.id,
    product_id: product2.id,
    quantity: 2,
    price: 29.99
  });
  await OrderItem.create({
    order_id: order1.id,
    product_id: product3.id,
    quantity: 1,
    price: 79.99
  });
  await OrderItem.create({
    order_id: order2.id,
    product_id: product3.id,
    quantity: 1,
    price: 79.99
  });
  console.log("Order items created\n");

  // 5. Crear reseñas
  console.log("5. Creating reviews...");
  await Review.create({
    user_id: user1.id,
    product_id: product1.id,
    rating: 5,
    comment: "Excellent laptop! Very fast and reliable."
  });
  await Review.create({
    user_id: user2.id,
    product_id: product3.id,
    rating: 4,
    comment: "Great keyboard, but a bit loud."
  });
  console.log("Reviews created\n");

  // 6. Cargar usuario con órdenes
  console.log("6. Loading user with orders...");
  const users_with_orders = await User.where({ id: user1.id }, {
    include: {
      orders: {}
    }
  });
  const user_with_orders = users_with_orders[0];
  console.log(`${user_with_orders.name} has ${user_with_orders.orders.length} order(s)`);
  user_with_orders.orders.forEach(order => {
    console.log(`  Order ${order.id}: $${order.total} (${order.status})`);
  });
  console.log();

  // 7. Cargar orden con items y productos
  console.log("7. Loading order with items and products...");
  const orders_with_items = await Order.where({ id: order1.id }, {
    include: {
      user: {},
      items: {
        include: {
          product: {}
        }
      }
    }
  });
  const order_with_items = orders_with_items[0];
  console.log(`Order ${order_with_items.id} by ${order_with_items.user?.name}`);
  console.log(`Total: $${order_with_items.total}`);
  console.log("Items:");
  order_with_items.items.forEach(item => {
    console.log(`  ${item.quantity}x ${item.product?.name} @ $${item.price}`);
  });
  console.log();

  // 8. Cargar producto con reseñas y revisores
  console.log("8. Loading product with reviews...");
  const products_with_reviews = await Product.where({ id: product1.id }, {
    include: {
      reviews: {
        include: {
          user: {}
        }
      }
    }
  });
  const product_with_reviews = products_with_reviews[0];
  console.log(`${product_with_reviews.name} - Reviews:`);
  product_with_reviews.reviews.forEach(review => {
    console.log(`  ${review.rating}/5 by ${review.user?.name}`);
    console.log(`  "${review.comment}"`);
  });
  console.log();

  // 9. Cargar usuario con todas las relaciones
  console.log("9. Loading user with all relationships...");
  const users_complete = await User.where({ id: user1.id }, {
    include: {
      orders: {
        include: {
          items: {
            include: {
              product: {}
            }
          }
        }
      },
      reviews: {
        include: {
          product: {}
        }
      }
    }
  });
  const user_complete = users_complete[0];
  console.log(`${user_complete.name}:`);
  console.log(`  Orders: ${user_complete.orders.length}`);
  user_complete.orders.forEach(order => {
    console.log(`    - Order ${order.id}: ${order.items.length} items, $${order.total}`);
  });
  console.log(`  Reviews: ${user_complete.reviews.length}`);
  user_complete.reviews.forEach(review => {
    console.log(`    - ${review.rating}/5 for ${review.product?.name}`);
  });
  console.log();

  // 10. Cargar órdenes con filtros
  console.log("10. Loading completed orders only...");
  const all_users_with_completed = await User.where({}, {
    include: {
      orders: {
        where: { status: "completed" }
      }
    }
  });
  all_users_with_completed.forEach(user => {
    if (user.orders.length > 0) {
      console.log(`${user.name}: ${user.orders.length} completed order(s)`);
    }
  });
  console.log();

  console.log("=== All relationship operations completed ===");
}

// Ejecutar la aplicación
main().catch(console.error);
```

## Salida Esperada

```
=== E-Commerce Relationships Example ===

1. Creating users...
Created: John Doe, Jane Smith

2. Creating products...
Created: Laptop, Mouse, Keyboard

3. Creating orders...
Created: Order 550e8400-..., Order 6ba7b810-...

4. Creating order items...
Order items created

5. Creating reviews...
Reviews created

6. Loading user with orders...
John Doe has 1 order(s)
  Order 550e8400-...: $1109.97 (pending)

7. Loading order with items and products...
Order 550e8400-... by John Doe
Total: $1109.97
Items:
  1x Laptop @ $999.99
  2x Mouse @ $29.99
  1x Keyboard @ $79.99

8. Loading product with reviews...
Laptop - Reviews:
  5/5 by John Doe
  "Excellent laptop! Very fast and reliable."

9. Loading user with all relationships...
John Doe:
  Orders: 1
    - Order 550e8400-...: 3 items, $1109.97
  Reviews: 1
    - 5/5 for Laptop

10. Loading completed orders only...
Jane Smith: 1 completed order(s)

=== All relationship operations completed ===
```

## Patrones Avanzados

### Relaciones Auto-Referenciales

Los modelos pueden tener relaciones consigo mismos:

```typescript
class Category extends Table<Category> {
  @PrimaryKey()
  declare id: string;

  declare name: string;
  declare parent_id: string | null;

  // Category tiene muchas categorías hijas
  @HasMany(() => Category, "parent_id")
  declare children: NonAttribute<HasMany<Category>>;

  // Category pertenece a categoría padre
  @BelongsTo(() => Category, "parent_id")
  declare parent: NonAttribute<BelongsTo<Category>>;
}

// Cargar árbol de categorías
const categories = await Category.where({ parent_id: null }, {
  include: {
    children: {
      include: {
        children: {}
      }
    }
  }
});
```

### Relaciones Muchos-a-Muchos (vía Tabla de Unión)

Implementar muchos-a-muchos usando tabla de unión:

```typescript
// Modelo Student
class Student extends Table<Student> {
  @PrimaryKey()
  declare id: string;
  declare name: string;

  @HasMany(() => Enrollment, "student_id")
  declare enrollments: NonAttribute<HasMany<Enrollment>>;
}

// Modelo Course
class Course extends Table<Course> {
  @PrimaryKey()
  declare id: string;
  declare name: string;

  @HasMany(() => Enrollment, "course_id")
  declare enrollments: NonAttribute<HasMany<Enrollment>>;
}

// Tabla de unión
class Enrollment extends Table<Enrollment> {
  @PrimaryKey()
  declare id: string;

  declare student_id: string;
  declare course_id: string;
  declare grade: string;

  @BelongsTo(() => Student, "student_id")
  declare student: NonAttribute<BelongsTo<Student>>;

  @BelongsTo(() => Course, "course_id")
  declare course: NonAttribute<BelongsTo<Course>>;
}

// Cargar estudiante con cursos
const students = await Student.where({ id: "student-123" }, {
  include: {
    enrollments: {
      include: {
        course: {}
      }
    }
  }
});

const student = students[0];
console.log(`${student.name}'s courses:`);
student.enrollments.forEach(enrollment => {
  console.log(`  ${enrollment.course?.name} - Grade: ${enrollment.grade}`);
});
```

### Relaciones Polimórficas

Implementar relaciones polimórficas usando campos de tipo:

```typescript
class Comment extends Table<Comment> {
  @PrimaryKey()
  declare id: string;

  declare commentable_type: string; // "Post" o "Video"
  declare commentable_id: string;
  declare content: string;

  // Cargar relación polimórfica manualmente
  async get_commentable() {
    if (this.commentable_type === "Post") {
      return await Post.first({ id: this.commentable_id });
    } else if (this.commentable_type === "Video") {
      return await Video.first({ id: this.commentable_id });
    }
    return null;
  }
}
```

## Mejores Prácticas

### 1. Usar NonAttribute para Relaciones

```typescript
// Bueno - marcado como NonAttribute
@HasMany(() => Order, "user_id")
declare orders: NonAttribute<HasMany<Order>>;

// Malo - intentará guardar en la base de datos
@HasMany(() => Order, "user_id")
declare orders: Order[];
```

### 2. Definir Claves Foráneas Explícitamente

```typescript
// Bueno - clave foránea explícita
class Order extends Table<Order> {
  declare user_id: string; // Campo de clave foránea

  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}

// Malo - falta campo de clave foránea
class Order extends Table<Order> {
  @BelongsTo(() => User, "user_id")
  declare user: NonAttribute<BelongsTo<User>>;
}
```

### 3. Usar Funciones Flecha en Decoradores

```typescript
// Bueno - función flecha (evita dependencia circular)
@HasMany(() => Order, "user_id")
declare orders: NonAttribute<HasMany<Order>>;

// Malo - referencia directa (puede causar problemas de dependencia circular)
@HasMany(Order, "user_id")
declare orders: NonAttribute<HasMany<Order>>;
```

### 4. Filtrar Relaciones para Rendimiento

```typescript
// Bueno - cargar solo lo que necesitas
const users = await User.where({}, {
  include: {
    orders: {
      where: { status: "completed" },
      limit: 10,
      attributes: ["id", "total"]
    }
  }
});

// Malo - cargar todas las órdenes con todos los campos
const users = await User.where({}, {
  include: {
    orders: {}
  }
});
```

### 5. Evitar Consultas N+1

```typescript
// Bueno - cargar relaciones en una consulta
const posts = await Post.where({}, {
  include: {
    user: {},
    comments: {}
  }
});

// Malo - consultas N+1
const posts = await Post.where({});
for (const post of posts) {
  const user = await User.first({ id: post.user_id });
  const comments = await Comment.where({ post_id: post.id });
}
```

## Próximos Pasos

### Documentación Relacionada

- [Ejemplo de Modelo Básico](./basic.es.md) - Operaciones CRUD simples
- [Ejemplo de Consultas Avanzadas](./advanced.es.md) - Consultas complejas y paginación

### Referencias de API

- [Decorador HasMany](../references/decorators.md#hasmany) - Documentación completa de HasMany
- [Decorador BelongsTo](../references/decorators.md#belongsto) - Documentación completa de BelongsTo
- [Consultas Avanzadas](./advanced.es.md) - Consultas complejas con relaciones

¡Feliz codificación con relaciones de Dynamite!
