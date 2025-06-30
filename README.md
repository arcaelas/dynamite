![Arcaelas Insiders](https://raw.githubusercontent.com/arcaelas/dist/main/banner/svg/dark.svg#gh-dark-mode-only)
![Arcaelas Insiders](https://raw.githubusercontent.com/arcaelas/dist/main/banner/svg/light.svg#gh-light-mode-only)

# Dinamite ORM

> A **decorator‑first**, zero‑boilerplate ORM for DynamoDB (AWS SDK v3).
>
> _Auto‑provisions tables · Runs anywhere Node.js runs · Written in TypeScript only_

<p align="center">
  <a href="https://www.npmjs.com/package/@arcaelas/dinamite"><img src="https://img.shields.io/npm/v/@arcaelas/dinamite?color=cb3837" alt="npm"></a>
  <img src="https://img.shields.io/bundlephobia/minzip/@arcaelas/dinamite?label=gzip" alt="size">
  <img src="https://img.shields.io/github/license/arcaelas/dinamite" alt="MIT">
</p>

---

## Contents

- [Install](#install)
- [Hello World](#hello-world)
- [Decorators Reference](#decorators-reference)
- [Model API](#model-api)

  - [Static CRUD](#static-crud)
  - [Instance CRUD](#instance-crud)
  - [Serialization](#serialization)

- [Configuration](#configuration)

  - [Connection](#connection)
  - [Naming rules & pluralisation](#naming-rules--pluralisation)
  - [Running on DynamoDB Local](#running-on-dynamodb-local)

- [Type Reference](#type-reference)
- [Recipes](#recipes)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Install

```bash
npm i @arcaelas/dinamite
# peer deps (unless already installed)
npm i @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb pluralize
```

---

## Hello World

```ts
import {
  connect,
  Table,
  Index, // PK
  CreatedAt,
  UpdatedAt,
  Default,
} from "@arcaelas/dinamite";

connect({
  region: "us-east-1",
  // DynamoDB Local example
  endpoint: "http://localhost:7007",
  credentials: { accessKeyId: "x", secretAccessKey: "x" },
});

class User extends Table {
  @Index() // Partition Key
  declare id: string;

  @Default(() => "")
  declare name: string;

  @CreatedAt() // ISO‑string timestamp
  declare created: string;

  @UpdatedAt()
  declare updated: string;
}

const bob = await User.create({ id: "u1", name: "Bob" });

bob.name = "Robert";
await bob.save(); // upsert

console.log(await User.where());
await bob.destroy();
```

First call auto‑creates a table `users` (`user` → **snake + plural**).

---

## Decorators Reference

| Decorator          | Purpose                                               | Extras |
| ------------------ | ----------------------------------------------------- | ------ |
| `@Index()`         | **Partition key**. Exactly one «PK» per model.        |        |
| `@IndexSort()`     | **Sort key**. Requires previous `@Index()`.           |        |
| `@PrimaryKey()`    | Shortcut: _PK + SK on same property_.                 |        |
| `@Default(fn)`     | Lazy default value, evaluated once per instance.      |        |
| `@Mutate(fn)`      | Sequential value transformer. Runs before validators. |        |
| `@Validate(fn\[])` | Sync validator(s); return `true` or error `string`.   |        |
| `@NotNull()`       | Built‑in not‑null / not‑empty validation.             |        |
| `@CreatedAt()`     | Timestamp (ISO) on first assignment.                  |        |
| `@UpdatedAt()`     | Timestamp (ISO) **every** assignment.                 |        |
| `@Name("alias")`   | Override table _or_ column name.                      |        |

Execution order: **Default → Mutate\[] → Validate\[]**

---

## Model API

### Static CRUD

```ts
User.create(data); // PutItem (auto‑table‑creation)
User.update(id, patch); // PutItem replacement
User.destroy(id); // DeleteItem
User.where(); // Scan → User[]
```

### Instance CRUD

```ts
const u = new User({ id: "42", name: "Neo" });
await u.save(); // inserts

u.name = "The One";
await u.save(); // updates

await u.update({ name: "Thomas" });
await u.destroy();
```

### Serialization

`model.toJSON()` → **only fields declared via decorators** are included.
Undefined values are stripped before `marshall()` (`removeUndefinedValues`).

---

## Configuration

### Connection

```ts
connect({
  region: "…",
  endpoint: "https://…", // optional – for DynamoDB Local
  credentials: {
    accessKeyId: "…",
    secretAccessKey: "…",
  },
});
```

### Naming rules & pluralisation

- `PascalCase` / `camelCase` → `snake_case`
- Singular → **plural** using [`pluralize`](https://www.npmjs.com/package/pluralize)

Override with `@Name("my_table")`.

### Running on DynamoDB Local

```bash
docker run -p 7007:8000 amazon/dynamodb-local
```

---

## Type Reference

```ts
type Inmutable = string | number | boolean | null | object;

type Mutate = (value: any) => Inmutable;
type Default = Inmutable | (() => Inmutable);
type Validate = (value: any) => true | string;

interface Column {
  name: string;
  default?: Default;
  mutate?: Mutate[];
  validate?: Validate[];
  index?: true; // PK
  indexSort?: true; // SK
  unique?: true; // not yet enforced
}

interface WrapperEntry {
  name: string; // physical table
  columns: Map<string | symbol, Column>; // property → Column
}
```

Internal state lives in **`src/core/wrapper.ts`**.

---

## Recipes

### Soft‑delete flag

```ts
class Post extends Table {
  @Index() declare id: string;
  @Default(() => false) declare deleted: boolean;

  async softDelete() {
    this.deleted = true;
    await this.save();
  }
}
```

### Custom mutator – email normalisation

```ts
import { Mutate } from "@arcaelas/dinamite";

const lower: Mutate = (v) => String(v).toLowerCase();

class Subscriber extends Table {
  @Index() declare id: string;
  @Mutate(lower) declare email: string;
}
```

### Using DynamoDB Streams + Lambda

Because tables are created at runtime you can safely deploy stacks without `resources`, then subscribe Lambdas to the **physical table names** emitted by Dinamite (`User` → `users`, unless overridden).

---

## Troubleshooting

| Error                                 | Explanation & fix                                                                                           |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Metadata no encontrada`              | Model file imported before decorators executed – avoid circular imports; ensure `connect()` runs **first**. |
| `PartitionKey faltante`               | No `@Index()` in the model. Add one.                                                                        |
| `Two keys can not have the same name` | PK & SK attribute clash. Use `@PrimaryKey()` or distinct column names.                                      |
| `UnrecognizedClientException`         | Wrong credentials / DynamoDB Local not running.                                                             |

---

## Contributing

1. Fork → feature → PR. Conventional commits (`feat:`, `fix:`…).
2. `yarn test` must pass (Jest + ESLint).
3. Document new features in this README.

_Made with ❤️ by [Miguel Alejandro](https://github.com/arcaelas)_ – MIT License.
