# Guía de Mejores Prácticas

Esta guía proporciona orientación lista para producción para construir aplicaciones escalables y mantenibles con Dynamite ORM.

## 1. Diseño de Modelos

### Convenciones de Nomenclatura

Usa nombres claros y descriptivos que reflejen tu dominio:

```typescript
// ✅ Bueno - Nombres de entidad claros
@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  @Attribute()
  email!: string;
}

@Table({ name: 'order_items' })
class OrderItem extends Model {
  @PrimaryKey()
  item_id!: string;
}

// ❌ Evitar - Nombres genéricos o poco claros
@Table({ name: 'data' })
class Data extends Model { }
```

### Estructura de Archivos

Organiza modelos por contexto de dominio:

```
src/
├── models/
│   ├── user/
│   │   ├── user.model.ts
│   │   ├── user_profile.model.ts
│   │   └── user_preferences.model.ts
│   ├── order/
│   │   ├── order.model.ts
│   │   ├── order_item.model.ts
│   │   └── order_history.model.ts
│   └── index.ts
```

### Organización de Modelos

Mantén modelos enfocados y cohesivos:

```typescript
// ✅ Bueno - Modelo enfocado con atributos relacionados
@Table({ name: 'products' })
class Product extends Model {
  @PrimaryKey()
  product_id!: string;

  @Attribute()
  name!: string;

  @Attribute()
  price!: number;

  @Attribute()
  category!: string;

  @Attribute()
  inventory_count!: number;

  @Attribute()
  created_at!: number;

  @Attribute()
  updated_at!: number;
}

// ❌ Evitar - Mezclar preocupaciones no relacionadas
@Table({ name: 'products' })
class Product extends Model {
  @PrimaryKey()
  product_id!: string;

  @Attribute()
  name!: string;

  // No incrustar datos completos de usuario en producto
  @Attribute()
  created_by_user!: {
    user_id: string;
    email: string;
    full_name: string;
    profile_image: string;
  };
}
```

## 2. Estrategia de Clave Primaria

### UUID vs IDs Secuenciales

**Usar UUIDs para sistemas distribuidos:**

```typescript
import { v4 as uuid } from 'uuid';

@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  static async Create(data: CreateUserData): Promise<User> {
    const user = new User();
    user.user_id = uuid(); // Globalmente único
    user.email = data.email;
    user.created_at = Date.now();
    await user.Save();
    return user;
  }
}

// ✅ Beneficios: No necesita coordinación, globalmente único
// ❌ Desventaja: No se puede ordenar por tiempo de creación
```

**Usar ULID para IDs ordenables:**

```typescript
import { ulid } from 'ulid';

@Table({ name: 'events' })
class Event extends Model {
  @PrimaryKey()
  event_id!: string; // ULID es lexicográficamente ordenable

  static async Create(data: CreateEventData): Promise<Event> {
    const event = new Event();
    event.event_id = ulid(); // Basado en timestamp, ordenable
    event.type = data.type;
    await event.Save();
    return event;
  }
}

// ✅ Beneficios: Ordenable por tiempo, globalmente único
// ✅ Mejor para consultas de rango
```

## 3. Estrategia de Índices

### Índices Secundarios Globales (GSI)

Crear GSIs para patrones de consulta alternativos:

```typescript
@Table({ name: 'orders' })
class Order extends Model {
  @PrimaryKey()
  order_id!: string;

  @Attribute()
  @Index({ name: 'user_orders_index', type: 'gsi' })
  user_id!: string;

  @Attribute()
  @Index({ name: 'user_orders_index', type: 'gsi', sort_key: true })
  created_at!: number;

  @Attribute()
  status!: 'pending' | 'completed' | 'cancelled';

  // ✅ Consulta eficiente usando GSI
  static async GetUserOrders(user_id: string, limit = 20): Promise<Order[]> {
    return Order.Query({
      user_id,
      index: 'user_orders_index',
      limit,
      scan_forward: false // Más recientes primero
    });
  }
}
```

### Evitar Particiones Calientes

Distribuir escrituras entre particiones:

```typescript
// ❌ Evitar - Una sola partición caliente
@Table({ name: 'metrics' })
class Metric extends Model {
  @PrimaryKey()
  metric_type!: string; // Solo unos pocos valores = partición caliente

  @SortKey()
  timestamp!: number;
}

// ✅ Bueno - Escrituras distribuidas
@Table({ name: 'metrics' })
class Metric extends Model {
  @PrimaryKey()
  partition_key!: string; // metric_type#shard_0-99

  @SortKey()
  timestamp!: number;

  static async Create(metric_type: string, data: MetricData): Promise<Metric> {
    const metric = new Metric();
    const shard = Math.floor(Math.random() * 100);
    metric.partition_key = `${metric_type}#${shard}`;
    metric.timestamp = Date.now();
    metric.value = data.value;
    await metric.Save();
    return metric;
  }
}
```

## 4. Optimización de Consultas

### Consultas Eficientes

Usar Query en lugar de Scan siempre que sea posible:

```typescript
// ✅ Eficiente - Query con partition key
const user_orders = await Order.Query({ user_id: 'user_123' });

// ✅ Eficiente - Query con condición de rango
const recent_orders = await Order.Query({
  user_id: 'user_123',
  created_at: { gte: Date.now() - 86400000 } // Últimas 24 horas
});

// ❌ Lento - Escanear tabla completa
const pending_orders = await Order.Scan({ status: 'pending' });

// ✅ Mejor - GSI para consultas de estado
@Table({ name: 'orders' })
class Order extends Model {
  @Attribute()
  @Index({ name: 'status_index', type: 'gsi' })
  status!: string;
}

const pending_orders = await Order.Query({
  status: 'pending',
  index: 'status_index'
});
```

### Paginación

Implementar paginación eficiente:

```typescript
interface PaginatedResponse<T> {
  items: T[];
  next_token?: string;
  has_more: boolean;
}

class Order extends Model {
  static async GetUserOrdersPaginated(
    user_id: string,
    limit = 20,
    next_token?: string
  ): Promise<PaginatedResponse<Order>> {
    const result = await Order.Query({
      user_id,
      limit,
      exclusive_start_key: next_token ? JSON.parse(
        Buffer.from(next_token, 'base64').toString()
      ) : undefined
    });

    return {
      items: result,
      next_token: result.last_evaluated_key ? Buffer.from(
        JSON.stringify(result.last_evaluated_key)
      ).toString('base64') : undefined,
      has_more: !!result.last_evaluated_key
    };
  }
}
```

## 5. Estrategia de Validación

### Validación a Nivel de Modelo

Implementar validación en métodos de modelo:

```typescript
@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: string;

  @Attribute()
  email!: string;

  @Attribute()
  age?: number;

  private static ValidateEmail(email: string): void {
    const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email_regex.test(email)) {
      throw new Error('Formato de email inválido');
    }
  }

  private static ValidateAge(age?: number): void {
    if (age !== undefined && (age < 0 || age > 150)) {
      throw new Error('La edad debe estar entre 0 y 150');
    }
  }

  static async Create(data: CreateUserData): Promise<User> {
    // Validar antes de guardar
    this.ValidateEmail(data.email);
    this.ValidateAge(data.age);

    const user = new User();
    user.user_id = uuid();
    user.email = data.email;
    user.age = data.age;
    user.created_at = Date.now();

    await user.Save();
    return user;
  }
}
```

## 6. Manejo de Errores

### Patrones Try-Catch

Manejar errores con gracia:

```typescript
class User extends Model {
  // ✅ Bueno - Manejo específico de errores
  static async FindByEmail(email: string): Promise<User | null> {
    try {
      const results = await User.Query({
        email,
        index: 'email_index',
        limit: 1
      });
      return results[0] || null;
    } catch (error) {
      // Registrar errores inesperados
      console.error('Error al buscar usuario por email:', error);
      throw new Error('Fallo al buscar usuario');
    }
  }
}
```

## 7. Pruebas

### Pruebas Unitarias

Probar lógica de modelo de forma aislada:

```typescript
// user.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { User } from './user.model';

describe('User Model', () => {
  describe('Create', () => {
    it('debería crear usuario con datos válidos', async () => {
      const user = await User.Create({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(user.user_id).toBeDefined();
      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.created_at).toBeGreaterThan(0);
    });

    it('debería lanzar error con email inválido', async () => {
      await expect(
        User.Create({
          email: 'invalid-email',
          name: 'Test User'
        })
      ).rejects.toThrow('Formato de email inválido');
    });
  });
});
```

## 8. Seguridad de Tipos

### Aprovechando TypeScript

Usar características de TypeScript para seguridad de tipos:

```typescript
// Definir tipos estrictos
interface CreateUserData {
  email: string;
  name: string;
  age?: number;
}

interface UpdateUserData {
  name?: string;
  age?: number;
}

// Usar tipos marcados para IDs
type UserId = string & { readonly brand: unique symbol };
type OrderId = string & { readonly brand: unique symbol };

@Table({ name: 'users' })
class User extends Model {
  @PrimaryKey()
  user_id!: UserId;

  @Attribute()
  email!: string;

  @Attribute()
  name!: string;

  @Attribute()
  age?: number;

  // Creación type-safe
  static async Create(data: CreateUserData): Promise<User> {
    const user = new User();
    user.user_id = uuid() as UserId;
    user.email = data.email;
    user.name = data.name;
    user.age = data.age;
    await user.Save();
    return user;
  }

  // Actualizaciones type-safe
  async Update(data: UpdateUserData): Promise<void> {
    if (data.name !== undefined) this.name = data.name;
    if (data.age !== undefined) this.age = data.age;
    await this.Save();
  }
}
```

## Resumen

Seguir estas mejores prácticas te ayudará a construir aplicaciones escalables y mantenibles con Dynamite ORM:

1. **Diseño de Modelos**: Usar nomenclatura clara, organizar por dominio, mantener modelos enfocados
2. **Claves Primarias**: Elegir estrategia de ID apropiada (UUID, ULID, compuesto)
3. **Índices**: Crear GSI/LSI para patrones de consulta, evitar particiones calientes
4. **Consultas**: Preferir Query sobre Scan, implementar paginación, usar proyecciones
5. **Validación**: Validar a nivel de modelo, crear validadores reutilizables
6. **Manejo de Errores**: Manejar errores con gracia, implementar reintentos
7. **Pruebas**: Escribir pruebas unitarias y de integración
8. **Seguridad de Tipos**: Aprovechar características de TypeScript
