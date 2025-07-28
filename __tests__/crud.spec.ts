/* __tests__/crud.spec.ts
 * -----------------------------------------------------------
 * CRUD end‑to‑end contra DynamoDB Local (puerto 7007)
 */
import { DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { connect, default as Table } from "../src/core/table";
import wrapper, { CreationOptional } from "../src/core/wrapper";
import Name from "../src/decorators/name";
import NotNull from "../src/decorators/not_null";
import PrimaryKey from "../src/decorators/primary_key";

const ddbCfg = {
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "x", secretAccessKey: "x" },
};

beforeAll(() => connect(ddbCfg));

afterEach(async () => {
  const ddb = new DynamoDBClient(ddbCfg);
  for (const e of wrapper.values()) {
    try {
      await ddb.send(new DeleteTableCommand({ TableName: e.name }));
    } catch {
      /* tabla puede no existir */
    }
  }
  wrapper.clear();
});

describe("Dinamite ORM – CRUD & where()", () => {
  jest.setTimeout(10_000);

  /* -------------------------- CASOS DE ÉXITO ------------------------- */

  it("create() - casos de éxito y error", async () => {
    @Name("crud_create_test")
    class Product extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare name: string;
      @NotNull() declare price: number;
    }

    // Caso de éxito
    const product = await Product.create({ id: "p1", name: "Laptop", price: 1500 });
    expect(product.id).toBe("p1");
    expect(product.name).toBe("Laptop");
    expect(product.price).toBe(1500);

    // Verificar que se guardó en la base
    const found = await Product.where("id", "p1");
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe("Laptop");

    // Caso duplicado - debería sobrescribir
    const product2 = await Product.create({ id: "p1", name: "Desktop", price: 800 });
    expect(product2.name).toBe("Desktop");

    const foundAgain = await Product.where("id", "p1");
    expect(foundAgain).toHaveLength(1);
    expect(foundAgain[0].name).toBe("Desktop");
  });

  it("update() estático - casos completos", async () => {
    @Name("crud_update_test")
    class Order extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare status: string;
      @NotNull() declare total: number;
      declare notes?: string;
    }

    // Crear registro inicial
    await Order.create({ id: "o1", status: "pending", total: 100 });

    // Update parcial - simular actualización parcial con los campos mínimos
    await Order.update("o1", { status: "shipped", total: 100 });
    let found = await Order.where("id", "o1");
    expect(found[0].status).toBe("shipped");
    expect(found[0].total).toBe(100); // no cambió

    // Update completo
    await Order.update("o1", { status: "delivered", total: 95 });
    found = await Order.where("id", "o1");
    expect(found[0].status).toBe("delivered");
    expect(found[0].total).toBe(95);

    // Update de registro inexistente - debería crear
    await Order.update("o2", { status: "new", total: 200 });
    const newOrder = await Order.where("id", "o2");
    expect(newOrder).toHaveLength(1);
    expect(newOrder[0].status).toBe("new");
  });

  it("destroy() estático - casos completos", async () => {
    @Name("crud_destroy_test")
    class Task extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare title: string;
    }

    // Crear y verificar existencia
    await Task.create({ id: "t1", title: "Test task" });
    let found = await Task.where("id", "t1");
    expect(found).toHaveLength(1);

    // Eliminar exitosamente
    const result = await Task.destroy("t1");
    expect(result).toBeNull();

    // Verificar eliminación
    found = await Task.where("id", "t1");
    expect(found).toHaveLength(0);

    // Eliminar inexistente - no debería fallar
    const result2 = await Task.destroy("t999");
    expect(result2).toBeNull();
  });

  it("paginación avanzada - combinaciones complejas", async () => {
    @Name("crud_pagination_test")
    class Item extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare score: number;
      @NotNull() declare category: string;
    }

    // Crear datos de prueba
    const items = [
      { id: "i1", score: 100, category: "A" },
      { id: "i2", score: 200, category: "B" },
      { id: "i3", score: 150, category: "A" },
      { id: "i4", score: 300, category: "C" },
      { id: "i5", score: 50, category: "B" },
    ];

    await Promise.all(items.map(item => Item.create(item)));

    // Paginación sin orden específico
    const page1 = await Item.where("score", ">=", 0, { limit: 2 });
    expect(page1).toHaveLength(2);

    const page2 = await Item.where("score", ">=", 0, { skip: 2, limit: 2 });
    expect(page2).toHaveLength(2);

    const page3 = await Item.where("score", ">=", 0, { skip: 4, limit: 2 });
    expect(page3).toHaveLength(1); // solo queda 1

    // Ordenamiento ascendente con paginación
    const ascFirst = await Item.where("score", ">=", 0, { order: "ASC", limit: 3 });
    const scores = ascFirst.map(i => i.score).sort((a, b) => a - b);
    expect(ascFirst.map(i => i.score)).toEqual(scores); // debe estar ordenado

    // Ordenamiento descendente con paginación
    const descFirst = await Item.where("score", ">=", 0, { order: "DESC", limit: 2 });
    expect(descFirst[0].score).toBeGreaterThanOrEqual(descFirst[1].score);

    // Skip extremo (mayor al total)
    const empty = await Item.where("score", ">=", 0, { skip: 100, limit: 5 });
    expect(empty).toHaveLength(0);

    // Limit 0
    const zeroLimit = await Item.where("score", ">=", 0, { limit: 0 });
    expect(zeroLimit).toHaveLength(0);
  });

  it("overloads y opciones básicas de where()", async () => {
    @Name("crud_users_s1")
    class User extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare email: string;
      @NotNull() declare age: number;
    }

    await Promise.all([
      User.create({ id: "u1", email: "a@b.com", age: 30 }),
      User.create({ id: "u2", email: "b@b.com", age: 25 }),
      User.create({ id: "u3", email: "c@b.com", age: 20 }),
    ]);

    // key, value (= implícito)
    expect((await User.where("id", "u1"))[0].email).toBe("a@b.com");

    // key, '=', value
    expect((await User.where("email", "=", "b@b.com"))[0].id).toBe("u2");

    // key, '!=', value
    const notB = await User.where("email", "!=", "b@b.com");
    expect(notB.map((r) => r.id).sort()).toEqual(["u1", "u3"]);

    // rango >= y <=
    expect((await User.where("age", ">=", 25)).map((u) => u.id).sort()).toEqual(
      ["u1", "u2"]
    );
    expect((await User.where("age", "<=", 25)).map((u) => u.id).sort()).toEqual(
      ["u2", "u3"]
    );

    // objeto { ... }
    expect((await User.where({ email: "a@b.com", age: 30 }))[0].id).toBe("u1");

    // opciones limit / skip / order
    expect((await User.where("age", ">=", 0, { limit: 2 })).length).toBe(2);
    expect(
      (await User.where("age", ">=", 0, { skip: 1, limit: 1 }))[0].id
    ).toBe("u2");
    const [desc] = await User.where("age", ">=", 0, {
      order: "DESC",
      limit: 1,
    });
    expect(desc.id).toBe("u1");
  });

  /* ------------------------- CASOS DE FALLO -------------------------- */

  it("valida operador no permitido", async () => {
    @Name("crud_fail_op")
    class U extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare age: number;
    }
    await U.create({ id: "x1", age: 10 });

    await expect(U.where("age", "~~" as any, 10)).rejects.toThrow(
      "Argumentos inválidos"
    );
  });

  it("rechaza 4º argumento que no sea options", async () => {
    @Name("crud_fail_extra")
    class U extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare age: number;
    }
    await U.create({ id: "x1", age: 10 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect((U as any).where("age", "=", 10, "extra")).rejects.toThrow(
      "Argumentos inválidos"
    );
  });

  it("limit / skip negativos generan error", async () => {
    @Name("crud_fail_neg")
    class U extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare age: number;
    }
    await U.create({ id: "x1", age: 10 });

    await expect(U.where("age", "=", 10, { limit: -1 })).rejects.toThrow();
    await expect(U.where("age", "=", 10, { skip: -2 })).rejects.toThrow();
  });

  it("order inválido genera error", async () => {
    @Name("crud_fail_order")
    class U extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare age: number;
    }
    await U.create({ id: "x1", age: 10 });

    await expect(
      U.where("age", "=", 10, { order: "DOWN" as any })
    ).rejects.toThrow();
  });

  it("campo inexistente devuelve [] (no error)", async () => {
    @Name("crud_fail_field")
    class U extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare field: string;
    }
    await U.create({ id: "x1", field: "v1" });

    expect(await U.where("noField" as any, "!=", "x")).toEqual([]);
  });

  it("first() - obtiene el primer elemento", async () => {
    @Name("crud_first_test")
    class Score extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare points: number;
      @NotNull() declare player: string;
    }

    // Crear datos de prueba ordenados
    await Promise.all([
      Score.create({ id: "s1", points: 100, player: "Alice" }),
      Score.create({ id: "s2", points: 200, player: "Bob" }),
      Score.create({ id: "s3", points: 150, player: "Charlie" }),
      Score.create({ id: "s4", points: 50, player: "Dave" }),
    ]);

    // first() con clave y valor (= implícito)
    const firstById = await Score.first("id", "s2");
    expect(firstById?.player).toBe("Bob");
    expect(firstById?.points).toBe(200);

    // first() con operador explícito
    const firstHighScore = await Score.first("points", ">=", 150);
    expect(firstHighScore?.points).toBeGreaterThanOrEqual(150);
    expect(["Bob", "Charlie"]).toContain(firstHighScore?.player);

    // first() con filtro objeto
    const firstAlice = await Score.first({ player: "Alice" });
    expect(firstAlice?.id).toBe("s1");
    expect(firstAlice?.points).toBe(100);

    // first() con condición que no existe
    const firstNonExistent = await Score.first("points", ">", 500);
    expect(firstNonExistent).toBeUndefined();

    // first() devuelve el primer elemento (ASC por defecto)
    const firstByPoints = await Score.first("points", ">=", 0);
    expect(firstByPoints?.points).toBe(50); // El menor (Dave)
  });

  it("last() - obtiene el último elemento", async () => {
    @Name("crud_last_test")
    class Review extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare rating: number;
      @NotNull() declare comment: string;
    }

    // Crear datos de prueba
    await Promise.all([
      Review.create({ id: "r1", rating: 3, comment: "Average" }),
      Review.create({ id: "r2", rating: 5, comment: "Excellent" }),
      Review.create({ id: "r3", rating: 4, comment: "Good" }),
      Review.create({ id: "r4", rating: 2, comment: "Poor" }),
    ]);

    // last() con clave y valor (= implícito)
    const lastById = await Review.last("id", "r3");
    expect(lastById?.comment).toBe("Good");
    expect(lastById?.rating).toBe(4);

    // last() con operador explícito
    const lastGoodRating = await Review.last("rating", ">=", 4);
    expect(lastGoodRating?.rating).toBeGreaterThanOrEqual(4);
    expect(["Excellent", "Good"]).toContain(lastGoodRating?.comment);

    // last() con filtro objeto
    const lastExcellent = await Review.last({ comment: "Excellent" });
    expect(lastExcellent?.id).toBe("r2");
    expect(lastExcellent?.rating).toBe(5);

    // last() con condición que no existe
    const lastNonExistent = await Review.last("rating", ">", 10);
    expect(lastNonExistent).toBeUndefined();

    // last() devuelve el último elemento (DESC por defecto)
    const lastByRating = await Review.last("rating", ">=", 1);
    expect(lastByRating?.rating).toBe(5); // El mayor (r2)
  });

  it("first() y last() - comparación de comportamiento", async () => {
    @Name("crud_first_last_compare")
    class Item extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare value: number;
    }

    // Crear secuencia ordenada
    await Promise.all([
      Item.create({ id: "i1", value: 10 }),
      Item.create({ id: "i2", value: 20 }),
      Item.create({ id: "i3", value: 30 }),
      Item.create({ id: "i4", value: 40 }),
    ]);

    // Comparar first() vs last() para la misma condición
    const firstItem = await Item.first("value", ">=", 15);
    const lastItem = await Item.last("value", ">=", 15);

    expect(firstItem?.value).toBe(20); // Primero que cumple (ASC)
    expect(lastItem?.value).toBe(40);  // Último que cumple (DESC)

    // Verificar que son diferentes instancias
    expect(firstItem?.id).not.toBe(lastItem?.id);

    // Caso donde first() y last() devuelven el mismo resultado
    const onlyFirst = await Item.first("value", "=", 25); // No existe
    const onlyLast = await Item.last("value", "=", 25);   // No existe

    expect(onlyFirst).toBeUndefined();
    expect(onlyLast).toBeUndefined();

    // Caso con un solo resultado
    const singleFirst = await Item.first("value", "=", 30);
    const singleLast = await Item.last("value", "=", 30);

    expect(singleFirst?.id).toBe("i3");
    expect(singleLast?.id).toBe("i3");
    expect(singleFirst?.value).toBe(singleLast?.value);
  });

  it("where() - operador 'in' con array", async () => {
    @Name("crud_in_test")
    class Product extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare name: string;
      @NotNull() declare category: string;
    }

    // Crear datos de prueba
    await Promise.all([
      Product.create({ id: "p1", name: "Laptop", category: "electronics" }),
      Product.create({ id: "p2", name: "Book", category: "education" }),
      Product.create({ id: "p3", name: "Phone", category: "electronics" }),
      Product.create({ id: "p4", name: "Pen", category: "office" }),
    ]);

    // Buscar productos con IDs específicos usando 'in'
    const products = await Product.where("id", "in", ["p1", "p3"]);
    expect(products).toHaveLength(2);
    expect(products.map(p => p.id).sort()).toEqual(["p1", "p3"]);

    // Buscar por categorías usando 'in'
    const electronicsOrOffice = await Product.where("category", "in", ["electronics", "office"]);
    expect(electronicsOrOffice).toHaveLength(3);
    expect(electronicsOrOffice.map(p => p.category).sort()).toEqual(["electronics", "electronics", "office"]);
  });

  it("where() - operador 'not-in' con array", async () => {
    @Name("crud_not_in_test")
    class Employee extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare name: string;
      @NotNull() declare department: string;
    }

    // Crear datos de prueba
    await Promise.all([
      Employee.create({ id: "e1", name: "Alice", department: "IT" }),
      Employee.create({ id: "e2", name: "Bob", department: "HR" }),
      Employee.create({ id: "e3", name: "Charlie", department: "Finance" }),
      Employee.create({ id: "e4", name: "David", department: "IT" }),
    ]);

    // Buscar empleados que NO estén en IT o HR
    const notItOrHr = await Employee.where("department", "not-in", ["IT", "HR"]);
    expect(notItOrHr).toHaveLength(1);
    expect(notItOrHr[0].department).toBe("Finance");
    expect(notItOrHr[0].name).toBe("Charlie");

    // Buscar empleados que NO tengan IDs específicos
    const notSpecificIds = await Employee.where("id", "not-in", ["e1", "e4"]);
    expect(notSpecificIds).toHaveLength(2);
    expect(notSpecificIds.map(e => e.id).sort()).toEqual(["e2", "e3"]);
  });

  it("where() - arrays en objetos de filtro (conversión automática a 'in')", async () => {
    @Name("crud_object_arrays_test")
    class Order extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare status: string;
      @NotNull() declare priority: string;
    }

    // Crear datos de prueba
    await Promise.all([
      Order.create({ id: "o1", status: "pending", priority: "high" }),
      Order.create({ id: "o2", status: "completed", priority: "low" }),
      Order.create({ id: "o3", status: "pending", priority: "medium" }),
      Order.create({ id: "o4", status: "cancelled", priority: "high" }),
    ]);

    // Usar array en objeto → automáticamente se convierte a 'in'
    const pendingOrCompleted = await Order.where({
      status: ["pending", "completed"]
    });
    expect(pendingOrCompleted).toHaveLength(3);
    expect(pendingOrCompleted.map(o => o.status).sort()).toEqual(["completed", "pending", "pending"]);

    // Combinar valor simple + array
    const highPriorityPendingOrCancelled = await Order.where({
      priority: "high",
      status: ["pending", "cancelled"]
    });
    expect(highPriorityPendingOrCancelled).toHaveLength(2);
    expect(highPriorityPendingOrCancelled.every(o => o.priority === "high")).toBe(true);
  });

  it("where() - validaciones de error para operadores 'in' y 'not-in'", async () => {
    @Name("crud_in_validations_test")
    class Item extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare type: string;
    }

    // Error: operador 'in' sin array
    await expect(
      Item.where("id", "in", "not-an-array" as any)
    ).rejects.toThrow("Operador 'in' requiere un array");

    // Error: operador 'not-in' sin array
    await expect(
      Item.where("type", "not-in", "not-an-array" as any)
    ).rejects.toThrow("Operador 'not-in' requiere un array");

    // Error: array vacío
    await expect(
      Item.where("id", "in", [])
    ).rejects.toThrow("Operador 'in' requiere array no vacío");

    await expect(
      Item.where("type", "not-in", [])
    ).rejects.toThrow("Operador 'not-in' requiere array no vacío");

    // Error: array demasiado grande (más de 100 elementos)
    const bigArray = Array.from({ length: 101 }, (_, i) => `item${i}`);
    await expect(
      Item.where("id", "in", bigArray)
    ).rejects.toThrow("Operador 'in' limitado a 100 valores máximo");

    await expect(
      Item.where("type", "not-in", bigArray)
    ).rejects.toThrow("Operador 'not-in' limitado a 100 valores máximo");

    // Error: usar array con operadores que no lo soportan
    await expect(
      Item.where("id", "=", ["item1", "item2"] as any)
    ).rejects.toThrow("Operador '=' no acepta arrays");

    await expect(
      Item.where("type", ">", ["type1", "type2"] as any)
    ).rejects.toThrow("Operador '>' no acepta arrays");
  });

  it("where() - validaciones de error para arrays en objetos", async () => {
    @Name("crud_object_array_validations_test")
    class Task extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare status: string;
    }

    // Error: array vacío en objeto
    await expect(
      Task.where({ status: [] })
    ).rejects.toThrow("Array vacío no permitido en filtros");

    // Error: array demasiado grande en objeto
    const bigArray = Array.from({ length: 101 }, (_, i) => `status${i}`);
    await expect(
      Task.where({ status: bigArray })
    ).rejects.toThrow("Operador 'in' limitado a 100 valores máximo");
  });

  it("first() y last() - con operadores 'in' y 'not-in'", async () => {
    @Name("crud_first_last_in_test")
    class Document extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare version: number;
      @NotNull() declare type: string;
    }

    // Crear datos de prueba
    await Promise.all([
      Document.create({ id: "d1", version: 1, type: "pdf" }),
      Document.create({ id: "d2", version: 3, type: "doc" }),
      Document.create({ id: "d3", version: 2, type: "pdf" }),
      Document.create({ id: "d4", version: 5, type: "txt" }),
    ]);

    // first() con 'in'
    const firstPdfOrDoc = await Document.first("type", "in", ["pdf", "doc"]);
    expect(firstPdfOrDoc).toBeDefined();
    expect(["pdf", "doc"]).toContain(firstPdfOrDoc!.type);

    // last() con 'not-in'
    const lastNotTxt = await Document.last("type", "not-in", ["txt"]);
    expect(lastNotTxt).toBeDefined();
    expect(lastNotTxt!.type).not.toBe("txt");
  });
});
