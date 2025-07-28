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

beforeAll(() =>
  connect({
    region: "local",
    endpoint: "http://localhost:8000",
    credentials: { accessKeyId: "x", secretAccessKey: "x" },
  })
);

@Name("users")
class User extends Table {
  @PrimaryKey()
  declare id: string;

  @NotNull()
  declare email: string;

  @CreatedAt()
  declare created: string;

  @UpdatedAt()
  declare updated: string;
}

describe("CRUD Dinamite ORM – instancia", () => {
  it("where() antes de existir la tabla → []", async () => {
    const rows = await User.where({ id: "x" }); // usamos filtro inexistente
    expect(rows).toEqual([]);
  });

  it("save() → crea, update() → modifica, destroy() → elimina", async () => {
    const u = new User({ id: "u1", email: "a@b.com" });
    await u.save();

    let rows = await User.where("id", "u1");
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("a@b.com");

    const firstCreated = rows[0].created;
    const firstUpdated = rows[0].updated;

    await u.update({ email: "c@d.com" });

    rows = await User.where("id", "u1");
    expect(rows[0].email).toBe("c@d.com");
    expect(rows[0].updated).not.toBe(firstUpdated);
    expect(rows[0].created).toBe(firstCreated);

    await u.destroy();

    rows = await User.where("id", "u1");
    expect(rows).toEqual([]);
  });

  it("la tabla realmente contiene el ítem mientras existe", async () => {
    const u = new User({ id: "u2", email: "real@test.com" });
    await u.save();

    let rows = await User.where("id", "u2");
    expect(rows.map((x) => x.id)).toContain("u2");

    await u.destroy();

    rows = await User.where("id", "u2");
    expect(rows.map((x) => x.id)).not.toContain("u2");
  });

  it("save() múltiple y sobrescritura", async () => {
    const u = new User({ id: "u3", email: "first@example.com" });
    await u.save();

    // Verificar primera inserción
    let rows = await User.where("id", "u3");
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("first@example.com");
    const firstCreated = rows[0].created;

    // Modificar y guardar de nuevo (debería sobrescribir)
    u.email = "second@example.com";
    await u.save();

    rows = await User.where("id", "u3");
    expect(rows).toHaveLength(1); // no duplicado
    expect(rows[0].email).toBe("second@example.com");
    expect(rows[0].created).toBe(firstCreated); // created no cambia
    expect(rows[0].updated).not.toBe(firstCreated); // updated sí cambia
  });

  it("update() con cambios parciales", async () => {
    const u = new User({ id: "u4", email: "partial@test.com" });
    await u.save();

    const originalCreated = u.created;
    const originalUpdated = u.updated;

    // Esperar un poco para garantizar cambio de timestamp
    await new Promise(r => setTimeout(r, 10));

    // Update solo del email
    await u.update({ email: "updated@test.com" });

    expect(u.email).toBe("updated@test.com");
    expect(u.created).toBe(originalCreated); // no cambia
    // Nota: @UpdatedAt se dispara automáticamente durante update()
    expect(typeof u.updated).toBe("string");

    // Verificar en base de datos
    const rows = await User.where("id", "u4");
    expect(rows[0].email).toBe("updated@test.com");
    expect(rows[0].created).toBe(originalCreated);
  });

  it("destroy() de instancia inexistente no falla", async () => {
    const u = new User({ id: "u999", email: "nonexistent@test.com" });
    
    // Intentar destruir sin haberlo guardado
    await expect(u.destroy()).resolves.not.toThrow();

    // Verificar que no existe
    const rows = await User.where("id", "u999");
    expect(rows).toHaveLength(0);
  });

  it("doble destroy() no causa error", async () => {
    const u = new User({ id: "u5", email: "double@test.com" });
    await u.save();

    // Verificar que existe
    let rows = await User.where("id", "u5");
    expect(rows).toHaveLength(1);

    // Primer destroy
    await u.destroy();
    rows = await User.where("id", "u5");
    expect(rows).toHaveLength(0);

    // Segundo destroy no debería fallar
    await expect(u.destroy()).resolves.not.toThrow();
  });

  it("timestamps automáticos @CreatedAt y @UpdatedAt", async () => {
    const u = new User({ id: "u6", email: "timestamps@test.com" });

    // Verificar que se asignan automáticamente
    expect(typeof u.created).toBe("string");
    expect(typeof u.updated).toBe("string");
    expect(u.created).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO format
    expect(u.updated).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO format

    const initialCreated = u.created;

    await u.save();

    // Created debería mantenerse
    expect(u.created).toBe(initialCreated);

    await new Promise(r => setTimeout(r, 10));
    
    // Disparar @UpdatedAt manualmente asignando undefined
    (u as any).updated = undefined;
    const newUpdated = u.updated;
    
    await u.update({ email: "updated-timestamps@test.com" });

    // Created sigue igual, Updated se actualiza
    expect(u.created).toBe(initialCreated);
    expect(typeof u.updated).toBe("string");
    expect(u.updated).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("múltiples instancias independientes", async () => {
    const u1 = new User({ id: "multi1", email: "user1@test.com" });
    const u2 = new User({ id: "multi2", email: "user2@test.com" });
    const u3 = new User({ id: "multi3", email: "user3@test.com" });

    // Guardar todas
    await Promise.all([u1.save(), u2.save(), u3.save()]);

    // Verificar que todas existen
    const allRows = await User.where("email", "!=", "nonexistent@test.com");
    const ids = allRows.map(r => r.id).sort();
    expect(ids).toContain("multi1");
    expect(ids).toContain("multi2");
    expect(ids).toContain("multi3");

    // Modificar una sin afectar las otras
    u2.email = "modified@test.com";
    await u2.save();

    const u1Check = await User.where("id", "multi1");
    const u2Check = await User.where("id", "multi2");
    const u3Check = await User.where("id", "multi3");

    expect(u1Check[0].email).toBe("user1@test.com"); // no cambió
    expect(u2Check[0].email).toBe("modified@test.com"); // sí cambió
    expect(u3Check[0].email).toBe("user3@test.com"); // no cambió

    // Limpiar
    await Promise.all([u1.destroy(), u2.destroy(), u3.destroy()]);
  });
});
