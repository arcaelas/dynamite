# Referencia de la API del cliente

## Descripción general

`Dynamite` sostiene la conexión con DynamoDB, la lista de modelos a los que sirve, la sincronización opcional de tablas y las transacciones.

## Clase: Dynamite

### Constructor

```typescript
constructor(config: DynamiteConfig)
```

Construye el cliente. No abre ninguna conexión ni llama a la API de AWS.

```typescript
import { Dynamite } from "@arcaelas/dynamite";

const dynamite = new Dynamite({
  region: "us-east-1",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  tables: [User, Order, Product]
});
```

## Configuración

### `DynamiteConfig`

```typescript
interface DynamiteConfig extends DynamoDBClientConfig {
  tables: Array<new (...args: any[]) => any>;
}
```

| Propiedad | Tipo | Obligatoria | Descripción |
|-----------|------|-------------|-------------|
| `tables` | `Array<Class>` | Sí | Las clases de modelo a las que sirve este cliente |
| `region` | `string` | No | Región de AWS. Si se omite, la resuelve el entorno |
| `endpoint` | `string` | No | Endpoint propio, para DynamoDB Local |
| `credentials` | `AwsCredentialIdentity` | No | Credenciales explícitas. Si se omiten, las resuelve el entorno |

Todo lo demás que acepte `DynamoDBClientConfig` —proveedores de credenciales, `maxAttempts`, `requestHandler`, endpoints propios— se acepta aquí y viaja tal cual al SDK de AWS.

## Métodos de instancia

### `connect()`

```typescript
async connect(): Promise<void>
```

Configura el cliente y deduce qué GSI esperan los modelos. **No llama a la API de AWS ni crea nada.**

**Comportamiento:**

- Registra el cliente global que usa toda operación de `Table`
- Anota, solo a partir de los schemas, los GSI que espera cada modelo: toda columna `@Index` que no sea la clave primaria y toda clave foránea de un `@HasMany` o un `@HasOne`
- Es idempotente: llamarlo dos veces no hace nada la segunda

```typescript
const dynamite = new Dynamite({ region: "us-east-1", tables: [User, Order] });
await dynamite.connect();

const user = await User.create({ name: "John" });
```

---

### `sync()`

```typescript
async sync(): Promise<void>
```

Crea en DynamoDB lo que los modelos declaran y la cuenta todavía no tiene. Es el camino de desarrollo.

**Comportamiento:**

- Exige `connect()` antes; si no, lanza `Call connect() before sync()`
- Describe en paralelo todas las tablas y tablas pivote
- Crea las tablas que faltan con facturación `PAY_PER_REQUEST`, su partition key, su sort key cuando alguna columna lleva `@IndexSort`, y sus GSI
- Crea las tablas pivote de `@ManyToMany` con clave `id` y un GSI por cada lado
- Agrega los GSI que faltan a las tablas existentes de a una ronda, esperando que cada ronda quede `ACTIVE`, porque DynamoDB construye un índice a la vez por tabla
- Es idempotente: llamarlo dos veces no hace nada la segunda

```typescript
await dynamite.connect();
await dynamite.sync();
```

En producción la infraestructura declara las tablas y sus índices con los mismos nombres
—`<campo>_index`, partition key sobre `<campo>`, proyección `ALL`— y `sync()` no se llama.

---

### `tx()`

```typescript
async tx<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R>
```

Ejecuta un conjunto de mutaciones de forma atómica. No se escribe nada hasta que el callback retorna; si lanza, no se aplica ninguna operación.

```typescript
await dynamite.tx(async (tx) => {
  const user = await User.create({ name: "John" }, { tx });
  await Order.create({ user_id: user.id, total: 100 }, { tx });
  await User.increment("orders_count", 1, { id: user.id }, { tx });
});
```

**Comportamiento y límites:**

- Toda mutación recibe la transacción dentro de su objeto de opciones: `{ tx }`
- Hasta 100 operaciones, enviadas en lotes de 25
- `__isPersisted` y los hooks `after*` se activan tras el commit, nunca antes
- Las lecturas dentro del callback son lecturas normales: no ven lo que la transacción tiene encolado

## Clase: TransactionContext

El objeto que `tx()` entrega al callback. Rara vez se toca directamente, lo hacen los modelos.

### `addPut()`

```typescript
addPut(table_name: string, item: Record<string, any>, condition?: { expression: string; names: Record<string, string> }): void
```

Encola una escritura. `create()` usa la condición para negarse a pisar una clave primaria existente.

### `addDelete()`

```typescript
addDelete(table_name: string, key: Record<string, any>): void
```

Encola un borrado.

### `addUpdate()`

```typescript
addUpdate(table_name: string, key: Record<string, any>, expression: string, names: Record<string, string>, values: Record<string, any>): void
```

Encola una actualización parcial. La usan `increment()` y `decrement()`.

### `onCommit()`

```typescript
onCommit(fn: () => void | Promise<void>): void
```

Registra un callback que corre tras un commit exitoso. Ahí se marcan las instancias como persistidas y ahí corren los hooks `after*`.

### `commit()`

```typescript
async commit(): Promise<void>
```

Envía todo lo encolado, en lotes de 25, y después ejecuta los callbacks de `onCommit`. Lo llama `tx()` por ti.

## Funciones de utilidad

### `setGlobalClient(client)`

Fija el cliente global de DynamoDB. Lo llama `connect()`.

### `getGlobalClient()`

Retorna el cliente actual. Lanza si no hay ninguno.

### `hasGlobalClient()`

`true` cuando hay un cliente configurado.

### `requireClient()`

Retorna el cliente actual o lanza `DynamoDB client no configurado. Use Dynamite.connect() primero.` Es lo que llama toda operación de un modelo.

## Ejemplos de configuración

### Desarrollo local

```typescript
const dynamite = new Dynamite({
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
  tables: [User, Order]
});

await dynamite.connect();
await dynamite.sync();
```

```bash
docker run -d -p 8000:8000 amazon/dynamodb-local
```

### Producción en AWS

```typescript
const dynamite = new Dynamite({
  region: process.env.AWS_REGION!,
  tables: [User, Order]
});

await dynamite.connect();
// sin sync(): las tablas y sus índices son de la infraestructura
```

## Ejemplo completo

```typescript
import { Dynamite, Table, PrimaryKey, Index, HasMany, BelongsTo, NonAttribute, CreationOptional } from "@arcaelas/dynamite";

class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  declare name: string;

  @HasMany(() => Order, "user_id")
  declare orders: NonAttribute<Order[]>;
}

class Order extends Table<Order> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Index()
  declare user_id: string;

  declare total: number;

  @BelongsTo(() => User, "id", "user_id")
  declare user: NonAttribute<User | null>;
}

async function main() {
  const dynamite = new Dynamite({
    region: "local",
    endpoint: "http://localhost:8000",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    tables: [User, Order]
  });

  await dynamite.connect();
  await dynamite.sync();

  await dynamite.tx(async (tx) => {
    const user = await User.create({ name: "John" }, { tx });
    await Order.create({ user_id: user.id, total: 99.99 }, { tx });
  });

  const users = await User.where({}, { include: { orders: true } });
  console.log(users[0].orders);
}

main();
```

## Ver también

- [Referencia de la API de Table](./table.md)
- [Referencia de decoradores](./decorators.md)
