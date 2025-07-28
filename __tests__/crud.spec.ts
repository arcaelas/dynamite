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
});
