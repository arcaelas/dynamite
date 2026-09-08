# Referencia de la API de Table

## Descripción general

`Table` es la clase base de todos los modelos. Aporta el CRUD tipado, el sistema de consultas, la carga de relaciones y el ciclo de vida de una instancia.

**Lo que ofrece:**

- Tipado estricto derivado de la propia clase
- CRUD como métodos estáticos y como métodos de instancia
- Un sistema de consultas que elige `GetItem`, `BatchGetItem`, `Query` o `Scan` según la forma del filtro
- Relaciones `HasMany`, `HasOne`, `BelongsTo` y `ManyToMany` con carga por lotes
- Timestamps automáticos y soft delete
- Paginación por cursor, ordenamiento, proyección e includes anidados

## Importación

```typescript
import { Table } from '@arcaelas/dynamite';
```

## Definición de modelo

```typescript
import {
  Table, Name, PrimaryKey, NotNull, Default, Index,
  CreatedAt, UpdatedAt, DeleteAt, CreationOptional
} from '@arcaelas/dynamite';

@Name("users")
class User extends Table<User> {
  @PrimaryKey()
  declare id: CreationOptional<string>;

  @Index()
  @NotNull()
  declare email: string;

  @NotNull()
  declare name: string;

  @Default(() => 25)
  declare age: CreationOptional<number>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;

  @DeleteAt()
  declare deleted_at: CreationOptional<string>;
}
```

---

## Constructor

### `constructor(data: Partial<InferAttributes<T>>)`

Construye una instancia en memoria. No escribe nada en DynamoDB.

**Comportamiento:**

- Ejecuta el pipeline de escritura de **todas** las columnas, no solo de las presentes en `data`. Por eso `@Default`, `@PrimaryKey` y `@CreatedAt` quedan resueltos en la construcción, y por eso `@NotNull` rechaza ahí mismo un campo ausente
- Exige un cliente configurado: lanza si no se llamó a `connect()`
- La instancia no está persistida hasta que corre `save()` o `create()`

```typescript
const user = new User({ email: "john@example.com", name: "John Doe" });

user.id;         // "01JBQ8..." — ya generado
user.created_at; // ya generado

await user.save(); // ahora existe en DynamoDB
```

---

## Opciones de mutación

Toda mutación recibe el mismo objeto de opciones como último argumento:

```typescript
interface MutationOptions {
  hook?: boolean;          // ejecuta los hooks de ciclo de vida; apagado por defecto
  tx?: TransactionContext; // ejecuta dentro de una transacción atómica
}
```

- Los hooks son opt-in por llamada: sin `{ hook: true }` no corre ninguno.
- Dentro de una transacción no se escribe nada hasta que el callback retorna. Los hooks `after*` y `__isPersisted` solo se activan tras el commit.
- `increment()` y `decrement()` aceptan `{ tx }` pero nunca disparan hooks.

---

## Métodos de instancia

### `save(options?: MutationOptions): Promise<boolean>`

Escribe el item completo.

**Comportamiento:**

- Sobre una instancia que nunca se persistió delega en `create()`, que se niega a pisar una clave primaria existente
- Sobre una instancia persistida envía un `PutItem` con todas las columnas, así que cualquier campo que hayas mutado a mano queda escrito
- Que una instancia esté persistida se registra internamente, no se deduce del id: una instancia nueva ya trae su id resuelto por `@PrimaryKey`

**Retorna:** `true`

```typescript
const user = new User({ email: "jane@example.com", name: "Jane Smith" });
await user.save(); // alta

user.name = "Jane Doe";
await user.save(); // reescritura completa del item
```

---

### `update(patch: Partial<InferAttributes<T>>, options?: MutationOptions): Promise<boolean>`

Actualiza solo los campos que le pasas.

**Comportamiento:**

- Los campos de relación presentes en `patch` se ignoran en lugar de lanzar
- Las columnas `@UpdatedAt` se renuevan aunque no formen parte de `patch`
- Sin hooks y fuera de una transacción es un solo `UpdateItem` que escribe únicamente los campos tocados, condicionado a que el registro siga existiendo. Si ya no existe, retorna `false` y no escribe nada
- Con `{ hook: true }` aplica los cambios, ejecuta `beforeUpdate`, escribe el item y ejecuta `afterUpdate`. Ambos hooks reciben el delta de cambios

**Retorna:** `true` cuando el registro se actualizó

```typescript
await user.update({ name: "Jane Doe" });
await user.update({ name: "Jane Doe" }, { hook: true });
```

---

### `destroy(options?: MutationOptions): Promise<null>`

Elimina el registro, de forma suave cuando el modelo lo permite.

**Comportamiento:**

- Con una columna `@DeleteAt` escribe ahí el timestamp actual y guarda: el registro sigue en la tabla y desaparece de `where()`
- Sin `@DeleteAt` elimina el registro
- Lanza `Cannot destroy record without ID` cuando la instancia no tiene clave primaria

```typescript
await post.destroy();               // soft delete
await post.destroy({ hook: true }); // beforeDestroy + afterDestroy
```

---

### `forceDestroy(options?: MutationOptions): Promise<null>`

Elimina el registro con un `DeleteItem`, ignorando `@DeleteAt`.

```typescript
await post.forceDestroy();
```

---

### `increment(campo, cantidad = 1): Promise<void>` / `decrement(campo, cantidad = 1): Promise<void>`

Suma o resta sobre una columna numérica de forma atómica en el servidor, sin leer el valor previo, y refleja el cambio en memoria.

- El tipo restringe `campo` a las columnas numéricas del modelo
- Lanza `Cannot increment without primary key` cuando la instancia no tiene id

```typescript
await user.increment("credits", 10);
await user.decrement("credits");
```

---

### `attach<R>(Modelo, related_id, pivot_data?): Promise<void>`

Agrega una fila a la tabla pivote de una relación `@ManyToMany`.

- La instancia tiene que estar persistida: si no, lanza
- Es idempotente, un par existente se deja como está
- `pivot_data` agrega columnas extra a la fila del pivote
- La búsqueda usa el GSI `<clave_foranea>_index` del pivote, nunca un Scan

```typescript
await user.attach(Role, "role-123");
await user.attach(Role, "role-123", { granted_by: "admin" });
```

---

### `detach<R>(Modelo, related_id): Promise<void>`

Quita la fila del pivote de ese par. No hace nada si falta la relación, la fila o la clave local.

```typescript
await user.detach(Role, "role-123");
```

---

### `sync<R>(Modelo, related_ids): Promise<void>`

Deja la relación con exactamente `related_ids`: quita lo que no está en la lista y agrega lo que falta, en lotes de 25.

- Lanza si el modelo relacionado no tiene schema, si no hay relación `@ManyToMany` entre ambos modelos, o si la clave local está indefinida

```typescript
await user.sync(Role, ["role-1", "role-2"]);
```

---

### `toJSON(): Record<string, unknown>`

Objeto plano con las columnas del modelo. Omite `null` y `undefined`, y serializa recursivamente las relaciones cargadas.

### `toString(): string`

`JSON.stringify` de la instancia.

---

## Métodos estáticos

### `create<M>(data, options?: MutationOptions): Promise<M>`

Crea un registro.

- Escribe con `attribute_not_exists` sobre la clave primaria: nunca pisa, y lanza `Record with <clave> '<valor>' already exists in <tabla>` cuando el id ya está tomado
- Dentro de una transacción la instancia se marca como persistida solo tras el commit

```typescript
const user = await User.create({ name: "Juan", email: "juan@example.com" });
await User.create({ name: "Juan" }, { hook: true });
await dynamite.tx(async (tx) => { await User.create({ name: "Juan" }, { tx }); });
```

---

### `createMany<M>(filas, options?: MutationOptions): Promise<M[]>`

Crea varios registros con `BatchWriteItem`, 25 por petición, reintentando lo que DynamoDB deje sin procesar.

- No puede comprobar claves primarias duplicadas, que `BatchWriteItem` no admite: un registro existente se sobreescribe
- Retorna las instancias ya marcadas como persistidas

```typescript
const logs = await Log.createMany([
  { level: "info", message: "arranque" },
  { level: "warn", message: "cache vacía" }
]);
```

---

### `update<M>(cambios, filtros, options?: MutationOptions): Promise<number>`

Actualiza todos los registros que casan con `filtros` y retorna cuántos.

- Con un filtro simple por clave primaria es un solo `UpdateItem` con los campos tocados, sin lectura previa, siempre que ningún `@Set` ni `@Validate` de esos campos declare el argumento `current`. Cuando alguno lo declara, el registro se lee primero para poder pasárselo
- Con cualquier otro filtro resuelve la consulta, aplica los cambios y escribe en lotes de 25
- Las columnas `@UpdatedAt` se renuevan en cada registro afectado
- Con `{ hook: true }`, `beforeUpdate` y `afterUpdate` corren una vez por registro afectado

```typescript
const afectados = await User.update({ status: "suspended" }, { status: "inactive" });
await User.update({ status: "active" }, { id: "user-1" });
```

---

### `delete<M>(filtros, options?: MutationOptions): Promise<number>`

Elimina todos los registros que casan con `filtros` y retorna cuántos.

- Siempre es borrado definitivo, con o sin `@DeleteAt`: el soft delete es una decisión de la instancia y vive en `destroy()`
- Un filtro simple por clave primaria sobre un modelo sin `@DeleteAt` y sin hooks de destroy es un solo `DeleteItem`
- En el resto de los casos resuelve la consulta y borra en lotes de 25

```typescript
const eliminados = await User.delete({ status: "suspended" });
await User.delete({ id: "user-1" }, { hook: true });
```

---

### `deleteMany<M>(ids, options?: MutationOptions): Promise<number>`

Elimina por clave primaria con `BatchWriteItem`, sin leer nada antes. Siempre es borrado definitivo y no ejecuta hooks.

```typescript
const eliminados = await Log.deleteMany(["01JBQ8...", "01JBQ9..."]);
```

---

### `increment<M>(campo, cantidad, filtros, options?): Promise<number>` / `decrement<M>(...)`

Suma atómica en el servidor.

- Un filtro por clave primaria actualiza ese único registro sin leerlo
- Cualquier otro filtro resuelve primero la consulta y luego actualiza en paralelo todo lo que casa
- Retorna cuántos registros se tocaron

```typescript
await User.increment("credits", 10, { id: "user-1" });
await User.decrement("stock", 1, { sku: "ABC" });
```

---

### `first<M>(filtros, options?): Promise<M | undefined>`

El primer registro que casa con los filtros, o `undefined`. Es `where()` con `limit: 1`, así que sobre un campo indexado es una sola petición.

```typescript
const user = await User.first({ email: "juan@example.com" });
const reciente = await User.first({ role: "admin" }, { order: { created_at: "DESC" } });
```

---

### `last<M>(filtros?, options?): Promise<M | undefined>`

El último registro, ordenado en descendente por la columna `@CreatedAt` o, si no la hay, por la clave primaria.

Sin sort key en la tabla el orden se resuelve en memoria, lo que obliga a leer todo lo que casa con el filtro para quedarse con un registro. Sobre una tabla grande se usa `first(filtros, { order: { created_at: "DESC" } })` acotado por un `@Index`.

```typescript
const ultimo = await User.last();
```

---

## `where()` — Consultas

### Sobrecargas

```typescript
User.where(filtros, opciones?)
User.where(campo, valor, opciones?)
User.where(campo, operador, valor, opciones?)
```

```typescript
await User.where({ status: "active" });
await User.where("name", "Juan");
await User.where("age", ">=", 18);
await User.where({ age: { $gte: 18, $lte: 65 } });
```

### Operadores

| Operador | Alias | Significado |
|----------|-------|-------------|
| `=` | `$eq` | Igual. Con `null`, "el atributo no existe" |
| `<>`, `!=` | `$ne` | Distinto. Con `null`, "el atributo sí existe" |
| `<` | `$lt` | Menor que |
| `<=` | `$lte` | Menor o igual |
| `>` | `$gt` | Mayor que |
| `>=` | `$gte` | Mayor o igual |
| `in` | `$in` | Contenido en el arreglo |
| `include` | `$include`, `contains`, `$contains` | Contiene el substring o el elemento |

Una columna desconocida lanza `Unknown column '<campo>' in <tabla>`. Un arreglo vacío en `in` lanza `Operator 'in' requires a non-empty array.`

### Opciones

```typescript
const users = await User.where({ status: "active" }, {
  order: { created_at: "DESC" },  // por campo; "ASC"/"DESC" solo ordena por @CreatedAt
  limit: 10,
  skip: 20,                       // alias: offset
  cursor: anterior.cursor,        // página siguiente; ignora skip
  attributes: ["id", "name"],     // proyección
  deleted: true,                  // incluye los que tienen soft delete
  include: {
    profile: true,
    orders: { where: { status: "completed" }, limit: 5 }
  }
});
```

- `limit: 0` retorna un arreglo vacío sin tocar la red.
- `order` a secas ordena por la columna `@CreatedAt`, o por la clave primaria si no la hay. Para ordenar por una fecha hay que nombrarla: `{ created_at: "DESC" }`.
- `attributes` construye instancias con solo esas columnas.
- `deleted` sustituye al antiguo `_includeTrashed`, que sigue funcionando como alias.

### Resultado y paginación

`where()` retorna el arreglo de instancias con una propiedad no enumerable `cursor`. Trae valor mientras queden páginas.

```typescript
let pagina = await User.where({}, { limit: 50 });
while (pagina.cursor) {
  pagina = await User.where({}, { limit: 50, cursor: pagina.cursor });
}
```

`skip` lee y descarta todo lo anterior en cada página; el cursor lee solo la página pedida.

---

## Costo y rendimiento

| Filtro | Comando | Peticiones |
|--------|---------|-----------|
| `=` sobre la clave primaria | `GetItem` | 1 |
| `in` sobre la clave primaria | `BatchGetItem` | 1 por cada 100 claves |
| `=` o `in` sobre una columna `@Index` | `Query` sobre `<campo>_index` | 1 por valor distinto |
| Cualquier otro filtro | `Scan` | la tabla completa, filtrada en el servidor |

- Los filtros extra sobre una lectura por clave primaria se evalúan sobre el item ya leído: la consulta sigue siendo una sola petición.
- Un `limit` corta la lectura en cuanto reúne los registros pedidos, y viaja como `Limit` cuando no queda nada que filtrar en el servidor.
- Una lectura sin `limit` que termina en `Scan` se parte en cuatro segmentos paralelos: las mismas unidades de lectura y una fracción de la latencia. Sin `order`, el orden resultante es arbitrario, como ya lo era.
- Si el GSI de un `@Index` no existe, la consulta no falla: cae a `Scan`, quita el índice de su registro interno y sigue. Funciona, y cuesta la tabla entera: declara `<campo>_index` con proyección `ALL` en la infraestructura.
- `attributes` recorta la carga útil, no las unidades de lectura: DynamoDB cobra el item completo.
- Las relaciones se cargan por lotes: una tanda de consultas por relación y por nivel, hasta cinco niveles. Las tablas pivote se leen por su GSI `<clave_foranea>_index`.

---

## Errores

| Mensaje | Causa |
|---------|-------|
| `DynamoDB client no configurado. Use Dynamite.connect() primero.` | Se construyó una instancia o se consultó antes de `connect()` |
| `Record with <clave> '<valor>' already exists in <tabla>` | `create()` sobre una clave primaria ya tomada |
| `Unknown column '<campo>' in <tabla>` | Un filtro sobre una columna que el modelo no declara |
| `Operator 'in' requires a non-empty array.` | `in` con un arreglo vacío |
| `Cannot destroy record without ID` | `destroy()`/`forceDestroy()` sobre una instancia sin clave primaria |
| `Cannot increment without primary key` | `increment()`/`decrement()` sobre una instancia sin clave primaria |
| `No se puede attach sin ID: la instancia debe persistirse primero con save() o create()` | `attach()` sobre una instancia que nunca se persistió |
| `Transaction exceeds 100 operations limit` | Más de 100 operaciones dentro de un mismo `tx()` |

---

## Límites

- Una transacción admite 100 operaciones como máximo y se envía en lotes de 25.
- `include` anida hasta cinco niveles.
- `BatchGetItem` lee 100 claves por petición y `BatchWriteItem` escribe 25; la librería trocea y reintenta sola.
- DynamoDB limita un item a 400 KB y una página de consulta a 1 MB.

---

## Archivo fuente

`src/core/table.ts`
