/**
 * @file crud.spec.ts
 * @descripcion Tests CRUD básicos y operaciones de tabla
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { Dynamite } from "../src/core/client";
import Table from "../src/core/table";
import { NonAttribute, CreationOptional } from "../src/core/wrapper";
import PrimaryKey from "../src/decorators/primary_key";
import Default from "../src/decorators/default";
import CreatedAt from "../src/decorators/created_at";
import UpdatedAt from "../src/decorators/updated_at";
import { stopCleanupInterval } from '../src/utils/relations';

// =============================================================================
// MODELOS DE PRUEBA - ESTRUCTURA MODULAR
// =============================================================================

class User extends Table<User> {
  @PrimaryKey() id: CreationOptional<string>;
  @Default("") email: CreationOptional<string>;
  @Default(18) age: CreationOptional<number>;
  @CreatedAt() created_at: NonAttribute<string>;
  @UpdatedAt() updated_at: NonAttribute<string>;
}

class Product extends Table<Product> {
  @PrimaryKey() id: CreationOptional<string>;
  @Default("Default Product") name: CreationOptional<string>;
  @Default(0) price: CreationOptional<number>;
  @Default("default") category: CreationOptional<string>;
}

class Order extends Table<Order> {
  @PrimaryKey() id: CreationOptional<string>;
  @Default("unknown") customer_id: CreationOptional<string>;
  @Default(0) total: CreationOptional<number>;
  @Default("pending") status: CreationOptional<string>;
  @Default("normal") priority: CreationOptional<string>;
  @Default("") notes: CreationOptional<string>;
}

// =============================================================================
// CONFIGURACIÓN DE CLIENTE PARA TESTS CRUD
// =============================================================================

const client = new Dynamite({
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "x", secretAccessKey: "x" },
  tables: [User, Product, Order],
});

// =============================================================================
// SUITE DE TESTS CRUD
// =============================================================================

describe("🔄 CRUD Operations", () => {
  jest.setTimeout(30_000);

  beforeAll(async () => {
    await client.sync();
    client.connect();
    
    // Limpieza completa de datos residuales de otros archivos de test
    const allUsers = await User.where({});
    for (const user of allUsers) {
      await User.destroy(user.id);
    }
    const allProducts = await Product.where({});
    for (const product of allProducts) {
      await Product.destroy(product.id);
    }
    const allOrders = await Order.where({});
    for (const order of allOrders) {
      await Order.destroy(order.id);
    }
  });

  afterEach(async () => {
    // Limpieza después de cada test
    try {
      await User.destroy("u1");
      await User.destroy("u2");
      await Product.destroy("p1");
      await Product.destroy("p2");
      await Order.destroy("o1");
      await Order.destroy("o2");
    } catch (e) {
      // Ignorar errores de limpieza
    }
  });

  afterAll(() => {
    // Limpiar interval para evitar warning de Jest
    stopCleanupInterval();
  });

  // ===========================================================================
  // TESTS CREATE
  // ===========================================================================

  describe("create()", () => {
    beforeEach(async () => {
      // Limpiar datos antes de cada test
      const users = await User.where({});
      for (const user of users) {
        await User.destroy(user.id);
      }
      const products = await Product.where({});
      for (const product of products) {
        await Product.destroy(product.id);
      }
    });

    it("crea un nuevo registro con datos completos", async () => {
      const user = await User.create({
        id: "u1",
        email: "test@example.com",
        age: 25,
      });

      expect(user.id).toBe("u1");
      expect(user.email).toBe("test@example.com");
      expect(user.age).toBe(25);
      expect(user.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("aplica valores por defecto", async () => {
      const product = await Product.create({ id: "p1" });
      expect(product.name).toBe("Default Product");
      expect(product.price).toBe(0);
      expect(product.category).toBe("default");
    });
  });

  // ===========================================================================
  // TESTS WHERE
  // ===========================================================================

  describe("where()", () => {
    beforeEach(async () => {
      // Limpiar datos antes de cada test
      const users = await User.where({});
      for (const user of users) {
        await User.destroy(user.id);
      }
      // Crear datos específicos para estos tests
      await User.create({ id: "u1", email: "a@b.com", age: 20 });
      await User.create({ id: "u2", email: "c@d.com", age: 30 });
    });

    it("busca por ID (clave primaria)", async () => {
      const users = await User.where("id", "u1");
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe("u1");
      expect(users[0].email).toBe("a@b.com");
    });

    it("busca con operador de igualdad", async () => {
      const users = await User.where("age", "=", 20);
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe("u1");
    });

    it("busca con operador de desigualdad", async () => {
      const users = await User.where("age", "!=", 20);
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe("u2");
    });

    it("aplica límites correctamente", async () => {
      const users = await User.where({}, { limit: 1 });
      expect(users).toHaveLength(1);
    });

    it("aplica skip correctamente", async () => {
      const users = await User.where({}, { skip: 1, limit: 1 });
      expect(users).toHaveLength(1);
    });
  });

  // ===========================================================================
  // TESTS UPDATE
  // ===========================================================================

  describe("update()", () => {
    beforeEach(async () => {
      // Limpiar datos antes de cada test
      const users = await User.where({});
      for (const user of users) {
        await User.destroy(user.id);
      }
      // Crear datos específicos para este test
      await User.create({ id: "u1", email: "old@example.com", age: 25 });
    });

    it("actualiza campos específicos", async () => {
      // Usar método de instancia para actualización parcial
      const user = await User.where("id", "u1");
      await user[0].update({ email: "new@example.com" });
      const updatedUsers = await User.where("id", "u1");
      expect(updatedUsers[0].email).toBe("new@example.com");
      expect(updatedUsers[0].age).toBe(25); // No cambió
    });
  });

  // ===========================================================================
  // TESTS DESTROY
  // ===========================================================================

  describe("destroy()", () => {
    beforeEach(async () => {
      // Limpiar datos antes de cada test
      const users = await User.where({});
      for (const user of users) {
        await User.destroy(user.id);
      }
      // Crear datos específicos para este test
      await User.create({ id: "u1", email: "test@example.com", age: 25 });
    });

    it("elimina un registro existente", async () => {
      await User.destroy("u1");
      const users = await User.where("id", "u1");
      expect(users).toHaveLength(0);
    });
  });

  // ===========================================================================
  // TESTS OPERADORES AVANZADOS
  // ===========================================================================

  describe("operadores avanzados", () => {
    beforeEach(async () => {
      // Limpiar datos antes de cada test
      const orders = await Order.where({});
      for (const order of orders) {
        await Order.destroy(order.id);
      }
      // Crear datos específicos para estos tests
      await Order.create({ id: "o1", status: "pending", priority: "high" });
      await Order.create({ id: "o2", status: "completed", priority: "low" });
    });

    it("operadores 'in' y 'not-in'", async () => {
      const pending = await Order.where("status", "in", ["pending", "processing"]);
      expect(pending).toHaveLength(1);
      expect(pending[0].status).toBe("pending");

      const notCompleted = await Order.where("status", "not-in", ["completed"]);
      expect(notCompleted).toHaveLength(1);
      expect(notCompleted[0].status).toBe("pending");
    });

    it("arrays en objetos de filtro (conversión automática a 'in')", async () => {
      const orders = await Order.where({ status: ["pending", "completed"] });
      expect(orders).toHaveLength(2);
    });
  });
});
