/* __tests__/crud.spec.ts
 * -----------------------------------------------------------
 * CRUD end-to-end contra DynamoDB Local (puerto 7007)
 */
import { DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { connect, default as Table } from "../src/core/table";
import wrapper, { CreationOptional, NonAttribute } from "../src/core/wrapper";
import Default from "../src/decorators/default";
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
  /* Eliminar todas las tablas creadas por los tests */
  const ddb = new DynamoDBClient(ddbCfg);
  for (const e of wrapper.values()) {
    try {
      await ddb.send(new DeleteTableCommand({ TableName: e.name }));
    } catch (_) {
      /* la tabla puede no existir */
    }
  }
  wrapper.clear();
});

describe("CRUD Dinamite ORM (DynamoDB Local)", () => {
  jest.setTimeout(10_000);

  it("create → update → where → destroy", async () => {
    @Name("crud_users1")
    class User extends Table {
      @PrimaryKey()
      declare id: CreationOptional<string>;

      @NotNull()
      declare email: string;

      @Default(() => new Date().toISOString())
      declare created_at: NonAttribute<string>;
    }

    /* ---------- create (auto‑crea tabla) ---------- */
    const u1 = await User.create({ id: "u1", email: "a@b.com" });
    expect(u1.email).toBe("a@b.com");

    /* ---------- update ---------- */
    await User.update("u1", { email: "c@d.com" });
    const [after] = await User.where("id", "u1");
    expect(after.email).toBe("c@d.com");

    /* ---------- destroy ---------- */
    await User.destroy("u1");
    expect(await User.where("id", "u1")).toHaveLength(0);
  });

  it("cubre todas las variantes válidas de where(...)", async () => {
    @Name("crud_users2")
    class User extends Table {
      @PrimaryKey() declare id: CreationOptional<string>;
      @NotNull() declare email: string;
      @NotNull() declare age: number;
    }

    await User.create({ id: "u1", email: "a@b.com", age: 30 });
    await User.create({ id: "u2", email: "b@b.com", age: 25 });
    await User.create({ id: "u3", email: "c@b.com", age: 20 });

    // 1· key, value  (= implícito)
    expect((await User.where("id", "u1"))[0].email).toBe("a@b.com");

    // 2· key, '=', value
    expect((await User.where("email", "=", "b@b.com"))[0].id).toBe("u2");

    // 3· key, '!=', value
    const notB = await User.where("email", "!=", "b@b.com");
    expect(notB).toHaveLength(2);
    expect(notB.some((u) => u.id === "u2")).toBe(false);

    // 4· key, '>=', value
    expect((await User.where("age", ">=", 25)).map((u) => u.id).sort()).toEqual(
      ["u1", "u2"]
    );

    // 5· key, '<=', value
    expect((await User.where("age", "<=", 25)).map((u) => u.id).sort()).toEqual(
      ["u2", "u3"]
    );

    // 6· objeto { k: v, … } (AND implícito)
    expect((await User.where({ email: "a@b.com", age: 30 }))[0].id).toBe("u1");

    // 7· destroy y ver vacío usando filtro
    for (const id of ["u1", "u2", "u3"]) await User.destroy(id);
    expect(await User.where("id", "u1")).toHaveLength(0);
  });
});
