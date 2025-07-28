/**
 * @file decorators.spec.ts
 * @descripcion Tests de decoradores y metadatos
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { Dynamite } from "../src/core/client";
import Table from "../src/core/table";
import { CreationOptional, NonAttribute } from "../src/core/wrapper";
import CreatedAt from "../src/decorators/created_at";
import Default from "../src/decorators/default";
import Mutate from "../src/decorators/mutate";
import PrimaryKey from "../src/decorators/primary_key";
import UpdatedAt from "../src/decorators/updated_at";
import Validate from "../src/decorators/validate";
import { stopCleanupInterval } from "../src/utils/relations";

// =============================================================================
// MODELOS DE PRUEBA PARA DECORADORES
// =============================================================================

class TestConfig extends Table<TestConfig> {
  @PrimaryKey() id: CreationOptional<string>;
  @Default(() => new Date().toISOString()) timestamp: CreationOptional<string>;
  @Default(() => []) tags: CreationOptional<string[]>;
  @Default(() => ({ active: true, count: 0 })) status: CreationOptional<{
    active: boolean;
    count: number;
  }>;
}

class Article extends Table<Article> {
  @PrimaryKey() id: CreationOptional<string>;
  @Default("Default Title")
  @Validate(
    (v: unknown) =>
      (typeof v === "string" && v.length >= 3) || "Título muy corto"
  )
  @Mutate((v: unknown) =>
    typeof v === "string" ? v.trim().toUpperCase() : String(v)
  )
  title: CreationOptional<string>;
  @Default("draft")
  @Mutate((v: unknown) => (typeof v === "string" ? v.toLowerCase() : String(v)))
  status: CreationOptional<string>;
  @Default("") content: CreationOptional<string>;
  @Default("unknown") author: CreationOptional<string>;
  @CreatedAt() created_at: NonAttribute<string>;
  @UpdatedAt() updated_at: NonAttribute<string>;
}

// =============================================================================
// CONFIGURACIÓN DE CLIENTE PARA TESTS DE DECORADORES
// =============================================================================

const client = new Dynamite({
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "x", secretAccessKey: "x" },
  tables: [TestConfig, Article],
});

// =============================================================================
// SUITE DE TESTS DE DECORADORES
// =============================================================================

describe("🎨 Decorators", () => {
  jest.setTimeout(30_000);

  beforeAll(async () => {
    await client.sync();
    client.connect();
  });

  afterEach(async () => {
    // Limpieza después de cada test
    try {
      await TestConfig.destroy("test1");
      await TestConfig.destroy("test2");
      await Article.destroy("art1");
      await Article.destroy("art2");
    } catch (e) {
      // Ignorar errores de limpieza
    }
  });

  afterAll(() => {
    // Limpiar interval para evitar warning de Jest
    stopCleanupInterval();
  });

  // ===========================================================================
  // TESTS @DEFAULT
  // ===========================================================================

  describe("@Default", () => {
    it("aplica valores por defecto simples", () => {
      const a = new Article({ id: "art1" });
      expect(a.title).toBe("DEFAULT TITLE"); // Valor mutado por @Mutate toUpperCase
      expect(a.status).toBe("draft");
      expect(a.content).toBe("");
      expect(a.author).toBe("unknown");
    });

    it("aplica valores por defecto de funciones", () => {
      const c = new TestConfig({ id: "test1" });
      expect(c.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(Array.isArray(c.tags)).toBe(true);
      expect(c.tags).toEqual([]);
      expect(typeof c.status).toBe("object");
      expect(c.status.active).toBe(true);
      expect(c.status.count).toBe(0);
    });

    it("valores y mutaciones funcionan correctamente", () => {
      const a = new Article({ id: "test1", title: "Test Title" });
      (a as any).status = undefined;
      (a as any).title = "  VALID TITLE  ";

      expect(a.status).toBe("draft");
      expect(a.title).toBe("VALID TITLE");
      expect(() => (a.title = "ab")).toThrow("Título muy corto");
    });
  });

  // ===========================================================================
  // TESTS @MUTATE
  // ===========================================================================

  describe("@Mutate", () => {
    it("transforma valores antes de asignar", () => {
      const a = new Article({ id: "art1", title: "Test Title" });
      a.title = "  lower case title  ";
      a.status = "PUBLISHED";

      expect(a.title).toBe("LOWER CASE TITLE"); // trim + toUpperCase
      expect(a.status).toBe("published"); // toLowerCase
    });
  });

  // ===========================================================================
  // TESTS @VALIDATE
  // ===========================================================================

  describe("@Validate", () => {
    it("valida campos correctamente", () => {
      const a = new Article({ id: "art1", title: "Valid Title" });

      expect(() => {
        a.title = "ab"; // Muy corto
      }).toThrow("Título muy corto");
    });
  });

  // ===========================================================================
  // TESTS @CREATEDAT / @UPDATEDAT
  // ===========================================================================

  describe("@CreatedAt / @UpdatedAt", () => {
    it("@CreatedAt y @UpdatedAt", async () => {
      const a = new Article({ id: "a1" });

      expect(a.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(a.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const initialUpdated = a.updated_at;

      // Simular pausa y actualizar updated_at directamente (comportamiento real del decorador)
      await new Promise((resolve) => setTimeout(resolve, 10));
      (a as any).updated_at = "trigger"; // Trigger del decorador @UpdatedAt
      expect(a.updated_at).not.toBe(initialUpdated);
    });
  });

  // ===========================================================================
  // TESTS ORDEN DE EJECUCIÓN
  // ===========================================================================

  describe("orden de ejecución: Default → Mutate → Validate", () => {
    it("ejecuta decoradores en orden correcto", () => {
      const a = new Article({ id: "art1", title: "Test Title" });

      // Default se aplica primero (valor inicial)
      expect(a.status).toBe("draft");

      // Mutate transforma el valor
      a.status = "PUBLISHED";
      expect(a.status).toBe("published"); // toLowerCase

      // Validate puede fallar después de mutación
      expect(() => {
        a.title = "x"; // Muy corto después de trim
      }).toThrow("Título muy corto");
    });
  });
});
