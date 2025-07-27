/* __tests__/crud.spec.ts
 * -----------------------------------------------------------
 * CRUD end-to-end contra DynamoDB Local (puerto 7007)
 */

import { DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { connect, default as Table } from "../src/core/table";
import wrapper from "../src/core/wrapper";

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
      /* tabla puede no existir */
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
      declare id: string;

      @NotNull()
      declare email: string;

      @Default(() => new Date().toISOString())
      declare created_at: string;
    }

    /* ---------- create (auto-crea tabla) ---------- */
    const u1 = await User.create({ id: "u1", email: "a@b.com" });
    expect(u1.email).toBe("a@b.com");

    /* ---------- update ---------- */
    await User.update("u1", { email: "c@d.com" });
    const [after] = await User.where();
    expect(after.email).toBe("c@d.com");

    /* ---------- destroy ---------- */
    await User.destroy("u1");
    expect(await User.where()).toHaveLength(0);
  });

  it("where() devuelve [] si la tabla no existe", async () => {
    @Name("ghosts")
    class Ghost extends Table {
      @PrimaryKey()
      declare id: string;
    }

    const rows = await Ghost.where();
    expect(rows).toEqual([]);
  });
});
