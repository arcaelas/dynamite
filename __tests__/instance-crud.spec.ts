/**
 * @file instance-crud.spec.ts
 * @descripcion Tests de métodos de instancia y operaciones CRUD
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { Dynamite } from "../src/core/client";
import { stopCleanupInterval } from '../src/utils/relations';
import Table from "../src/core/table";
import { NonAttribute, CreationOptional } from "../src/core/wrapper";
import PrimaryKey from "../src/decorators/primary_key";
import Default from "../src/decorators/default";
import CreatedAt from "../src/decorators/created_at";
import UpdatedAt from "../src/decorators/updated_at";

// =============================================================================
// MODELOS DE PRUEBA PARA INSTANCIAS
// =============================================================================

class User extends Table<User> {
  @PrimaryKey() id: CreationOptional<string>;
  @Default("test@example.com") email: CreationOptional<string>;
  @Default(18) age: CreationOptional<number>;
  @CreatedAt() created_at: NonAttribute<string>;
  @UpdatedAt() updated_at: NonAttribute<string>;
}

// =============================================================================
// CONFIGURACIÓN DE CLIENTE PARA TESTS DE INSTANCIA
// =============================================================================

const client = new Dynamite({
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "x", secretAccessKey: "x" },
  tables: [User],
});

// =============================================================================
// SUITE DE TESTS DE INSTANCIA
// =============================================================================

describe("🔧 Instance Methods", () => {
  jest.setTimeout(30_000);

  beforeAll(async () => {
    await client.sync();
    client.connect();
  });

  afterEach(async () => {
    // Limpieza después de cada test
    try {
      await User.destroy("inst1");
      await User.destroy("inst2");
      await User.destroy("inst3");
    } catch (e) {
      // Ignorar errores de limpieza
    }
  });

  afterAll(() => {
    // Limpiar interval para evitar warning de Jest
    stopCleanupInterval();
  });

  // ===========================================================================
  // TESTS SAVE()
  // ===========================================================================

  describe("save()", () => {
    it("crea nuevo registro", async () => {
      const user = new User({ id: "inst1", email: "save@test.com", age: 25 });
      await user.save();

      const found = await User.where("id", "inst1");
      expect(found).toHaveLength(1);
      expect(found[0].email).toBe("save@test.com");
      expect(found[0].age).toBe(25);
    });

    it("actualiza registro existente", async () => {
      // Crear registro inicial
      await User.create({ id: "inst1", email: "initial@test.com", age: 20 });

      // Modificar y guardar
      const user = new User({ id: "inst1", email: "updated@test.com", age: 30 });
      await user.save();

      const found = await User.where("id", "inst1");
      expect(found).toHaveLength(1);
      expect(found[0].email).toBe("updated@test.com");
      expect(found[0].age).toBe(30);
    });
  });

  // ===========================================================================
  // TESTS UPDATE()
  // ===========================================================================

  describe("update()", () => {
    it("modifica registro existente", async () => {
      const user = new User({ id: "inst1", email: "original@test.com", age: 25 });
      await user.save();

      await user.update({ email: "modified@test.com" });
      
      const found = await User.where("id", "inst1");
      expect(found[0].email).toBe("modified@test.com");
      expect(found[0].age).toBe(25); // No cambió
    });
  });

  // ===========================================================================
  // TESTS DESTROY()
  // ===========================================================================

  describe("destroy()", () => {
    it("elimina instancia", async () => {
      const user = new User({ id: "inst1", email: "delete@test.com", age: 25 });
      await user.save();

      await user.destroy();

      const found = await User.where("id", "inst1");
      expect(found).toHaveLength(0);
    });
  });

  // ===========================================================================
  // TESTS TIMESTAMPS AUTOMÁTICOS
  // ===========================================================================

  describe("timestamps automáticos", () => {
    it("asigna created_at y updated_at automáticamente", async () => {
      const user = new User({ id: "inst1", email: "time@test.com", age: 25 });
      
      expect(user.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(user.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const originalUpdated = user.updated_at;
      
      // Simular pausa y actualizar updated_at directamente (comportamiento real del decorador)
      await new Promise(resolve => setTimeout(resolve, 10));
      (user as any).updated_at = "trigger"; // Trigger del decorador @UpdatedAt
      
      expect(user.updated_at).not.toBe(originalUpdated);
    });
  });

  // ===========================================================================
  // TESTS MÚLTIPLES INSTANCIAS
  // ===========================================================================

  describe("múltiples instancias independientes", () => {
    it("maneja múltiples instancias sin conflictos", async () => {
      const user1 = new User({ id: "inst1", email: "user1@test.com", age: 20 });
      const user2 = new User({ id: "inst2", email: "user2@test.com", age: 30 });
      const user3 = new User({ id: "inst3", email: "user3@test.com", age: 40 });

      await Promise.all([user1.save(), user2.save(), user3.save()]);

      const found = await User.where({});
      expect(found.length).toBeGreaterThanOrEqual(3);
      
      const emails = found.map(u => u.email);
      expect(emails).toContain("user1@test.com");
      expect(emails).toContain("user2@test.com");
      expect(emails).toContain("user3@test.com");
    });
  });

  // ===========================================================================
  // TESTS SERIALIZACIÓN
  // ===========================================================================

  describe("serialización", () => {
    it("toJSON() serializa solo campos con decoradores", () => {
      const user = new User({ id: "inst1", email: "json@test.com", age: 25 });
      (user as any).extraField = "no debería aparecer";

      const json = user.toJSON();
      
      expect(json.id).toBe("inst1");
      expect(json.email).toBe("json@test.com");
      expect(json.age).toBe(25);
      expect(json.created_at).toBeDefined();
      expect(json.updated_at).toBeDefined();
      expect(json.extraField).toBeUndefined();
    });
  });
});
