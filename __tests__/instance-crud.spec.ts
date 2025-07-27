/* __tests__/instance-crud.spec.ts
 * ------------------------------------------------------------------
 * CRUD usando métodos de **instancia** de Dinamite ORM con DynamoDB Local.
 * Se asume que DynamoDB Local está corriendo en http://localhost:7007.
 * ------------------------------------------------------------------ */
import {
  connect,
  CreatedAt,
  Name,
  NotNull,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "../src";

// ---------- conexión DynamoDB Local ----------
beforeAll(() =>
  connect({
    region: "local",
    endpoint: "http://localhost:8000",
    credentials: { accessKeyId: "x", secretAccessKey: "x" },
  })
);

// ---------- Modelo de prueba ----------
@Name("users")
class User extends Table {
  @PrimaryKey()
  declare id: string;

  @NotNull() // ← registra la columna en el wrapper
  declare email: string;

  @CreatedAt()
  declare created: string;

  @UpdatedAt()
  declare updated: string;
}

describe("CRUD Dinamite ORM – instancia", () => {
  it("where() antes de existir la tabla → []", async () => {
    const rows = await User.where();
    expect(rows).toEqual([]);
  });

  it("save() → crea, update() → modifica, destroy() → elimina", async () => {
    /* ---------- save (create) ---------- */
    const u = new User({ id: "u1", email: "a@b.com" });
    await u.save();

    let rows = await User.where();
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("a@b.com");

    const firstCreated = rows[0].created;
    const firstUpdated = rows[0].updated;

    /* ---------- update ---------- */
    await u.update({ email: "c@d.com" });

    rows = await User.where();
    expect(rows[0].email).toBe("c@d.com");
    expect(rows[0].updated).not.toBe(firstUpdated);
    expect(rows[0].created).toBe(firstCreated);

    /* ---------- destroy ---------- */
    await u.destroy();

    rows = await User.where();
    expect(rows).toEqual([]);
  });

  it("la tabla realmente contiene el ítem mientras existe", async () => {
    const u = new User({ id: "u2", email: "real@test.com" });
    await u.save();

    let rows = await User.where();
    expect(rows.map((x) => x.id)).toContain("u2");

    await u.destroy();

    rows = await User.where();
    expect(rows.map((x) => x.id)).not.toContain("u2");
  });
});
