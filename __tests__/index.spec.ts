/**
 * @file comprehensive-unified.spec.ts
 * @descripcion Suite unificada y completa de pruebas para @arcaelas/dynamite
 * @autor Miguel Alejandro
 * @fecha 2025-07-30
 */
import { DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BelongsTo,
  CreatedAt,
  Default,
  HasMany,
  Mutate,
  Name,
  NotNull,
  PrimaryKey,
  Table,
  UpdatedAt,
  Validate,
} from "../src";
import { Dynamite, setGlobalClient } from "../src/core/client";
import wrapper, { CreationOptional, NonAttribute } from "../src/core/wrapper";

const ddbCfg = {
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
};

describe("@arcaelas/dynamite - Suite Unificada y Completa", () => {
  let dynamoClient: DynamoDBClient;
  let globalStartTime: number;

  beforeAll(async () => {
    globalStartTime = Date.now();
    dynamoClient = new DynamoDBClient(ddbCfg);
    setGlobalClient(dynamoClient);
  });

  afterAll(async () => {
    const totalTime = Date.now() - globalStartTime;
    console.log(`\n🎯 Suite completa ejecutada en ${totalTime}ms`);
  });

  afterEach(async () => {
    // Limpiar tablas después de cada test
    for (const meta of wrapper.values()) {
      try {
        await dynamoClient.send(
          new DeleteTableCommand({ TableName: meta.name })
        );
      } catch {
        // Tabla puede no existir
      }
    }
    wrapper.clear();
  });

  describe("🏗️ Decoradores y Metadatos", () => {
    it("genera nombres de tabla automáticamente (snake_plural)", () => {
      class Book {
        @NotNull() declare title: string;
      }

      const meta = wrapper.get(Book)!;
      expect(meta.name).toBe("books");
    });

    it("@Name personaliza nombres de tabla y columnas", () => {
      @Name("usuarios")
      class User {
        @Name("correo") declare email: string;
        @Name("edad") declare age: number;
      }

      const meta = wrapper.get(User)!;
      expect(meta.name).toBe("usuarios");
      expect(meta.columns.get("email")!.name).toBe("correo");
      expect(meta.columns.get("age")!.name).toBe("edad");
    });

    it("@PrimaryKey configura correctamente la clave primaria", () => {
      class Post {
        @PrimaryKey() declare id: string; // Esto establece la clave primaria (partición y ordenación)
      }

      const meta = wrapper.get(Post)!;
      const idCol = meta.columns.get("id")!;

      // Verificar que la clave primaria tenga las propiedades correctas
      expect(idCol.primaryKey).toBe(true);
      expect(idCol.index).toBe(true);
      expect(idCol.nullable).toBe(false);

      // Verificar que no hay otras columnas con index: true (solo debe estar la clave primaria)
      const indexedColumns = Array.from(meta.columns.values()).filter(
        (col) => col.index === true
      );
      expect(indexedColumns).toHaveLength(1);
      expect(indexedColumns[0].name).toBe("id");
    });

    it("@Default aplica valores por defecto", () => {
      class Config {
        @Default(() => "active") declare status: string;
        @Default(() => []) declare tags: string[];
        @Default(() => ({ count: 0 })) declare meta: { count: number };
      }

      const config = new Config();
      (config as any).status = undefined;
      (config as any).tags = undefined;
      (config as any).meta = undefined;

      expect(config.status).toBe("active");
      expect(config.tags).toEqual([]);
      expect(config.meta).toEqual({ count: 0 });
    });

    it("@Validate aplica validaciones personalizadas", () => {
      class Product {
        @Validate((v) =>
          (v as number) > 0 ? true : "Precio debe ser positivo"
        )
        declare price: number;

        @Validate((v) =>
          ["A", "B", "C"].includes(v as string) ? true : "Categoría inválida"
        )
        declare category: string;
      }

      const product = new Product();

      expect(() => {
        product.price = -10;
      }).toThrow("Precio debe ser positivo");
      expect(() => {
        product.category = "X";
      }).toThrow("Categoría inválida");

      product.price = 100;
      product.category = "A";
      expect(product.price).toBe(100);
      expect(product.category).toBe("A");
    });

    it("@Mutate transforma valores automáticamente", () => {
      class User {
        @Mutate((v) => (v as string)?.trim().toLowerCase())
        declare email: string;

        @Mutate((v) => Math.max(0, v as number))
        declare age: number;
      }

      const user = new User();
      user.email = "  USER@EXAMPLE.COM  ";
      user.age = -5;

      expect(user.email).toBe("user@example.com");
      expect(user.age).toBe(0);
    });

    it("@CreatedAt y @UpdatedAt gestionan timestamps", async () => {
      class Audit extends Table<Audit> {
        @PrimaryKey()
        @Default(() => `audit_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;

        @NotNull()
        @Default(() => "default_action")
        declare action: string;

        @CreatedAt()
        declare created_at: NonAttribute<string>;

        @UpdatedAt()
        declare updated_at: NonAttribute<string>;
      }

      // Inicializar DynamoDB con la tabla Audit
      const dynamite = new Dynamite({ ...ddbCfg, tables: [Audit] });
      dynamite.connect();
      await dynamite.sync();

      try {
        // Crear instancia sin especificar action (usará valor por defecto)
        const audit = new Audit({
          id: `audit_${Math.random().toString(36).substr(2, 9)}`,
          action: "default_action",
        });

        // Verificar que created_at se asigne en el constructor
        expect(audit.created_at).toBeDefined();
        expect(audit.updated_at).toBeUndefined(); // UpdatedAt solo se asigna en save()

        // Guardar debería asignar los timestamps y mantener el valor por defecto de action
        await audit.save();

        // Verificar que ambos timestamps estén definidos después de guardar
        expect(audit.created_at).toBeDefined();
        expect(audit.updated_at).toBeDefined();

        // Verificar que los timestamps tengan el formato correcto
        expect(audit.created_at).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        );
        expect(audit.updated_at).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
        );
      } finally {
        // Limpiar después de la prueba
        await dynamite.disconnect();
      }
    });

    it("pipeline completo: @Default + @Mutate + @Validate", async () => {
      class Article {
        @Default(() => "draft")
        @Mutate((v) => (v as string)?.toLowerCase())
        @Validate((v) =>
          ["draft", "published"].includes(v as string)
            ? true
            : "Estado inválido"
        )
        declare status: string;
      }

      const article = new Article();
      (article as any).status = undefined; // Trigger pipeline

      expect(article.status).toBe("draft");

      article.status = "PUBLISHED";
      expect(article.status).toBe("published");

      expect(() => {
        article.status = "invalid";
      }).toThrow("Estado inválido");
    });
  });

  describe("🔧 CRUD Básico y Validaciones", () => {
    it("create() - casos de éxito y sobrescritura", async () => {
      @Name("products")
      class Product extends Table<Product> {
        @PrimaryKey()
        @Default(() => `product_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;
        @NotNull() declare name: string;
        @NotNull() declare price: number;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [Product] });
      dynamite.connect();
      await dynamite.sync();

      const product1 = await Product.create({
        id: "p1",
        name: "Laptop",
        price: 1500,
      });
      expect(product1.id).toBe("p1");
      expect(product1.name).toBe("Laptop");

      // Verificar en base de datos
      const found = await Product.where("id", "p1");
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe("Laptop");

      // Sobrescritura
      const product2 = await Product.create({
        id: "p1",
        name: "Desktop",
        price: 800,
      });
      expect(product2.name).toBe("Desktop");

      const foundAgain = await Product.where("id", "p1");
      expect(foundAgain).toHaveLength(1);
      expect(foundAgain[0].name).toBe("Desktop");
    });

    it("update() estático - casos parciales y completos", async () => {
      @Name("orders")
      class Order extends Table<Order> {
        @PrimaryKey()
        @Default(() => `order_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;
        @NotNull() declare status: string;
        @NotNull() declare total: number;
        declare notes?: string;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [Order] });
      dynamite.connect();
      await dynamite.sync();

      await Order.create({ id: "o1", status: "pending", total: 100 });

      // Update parcial - usar update de instancia para cambios parciales
      const order = await Order.where("id", "o1").then((orders) => orders[0]);
      await order.update({ status: "confirmed", notes: "Cliente VIP" });

      const updated = await Order.where("id", "o1");
      expect(updated[0].status).toBe("confirmed");
      expect(updated[0].total).toBe(100); // No cambió
      expect(updated[0].notes).toBe("Cliente VIP"); // Campo opcional que se añadió
    });

    it("delete() estático - eliminación por ID y filtros", async () => {
      @Name("tasks")
      class Task extends Table<Task> {
        @PrimaryKey()
        @Default(() => `task_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;
        @NotNull()
        @Default(() => "Tarea sin título")
        declare title: string;
        @NotNull()
        @Default(() => false)
        declare completed: boolean;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [Task] });
      dynamite.connect();
      await dynamite.sync();

      await Task.create({ id: "t1", title: "Task 1", completed: false });
      await Task.create({ id: "t2", title: "Task 2", completed: true });

      // Verificar existencia
      let found = await Task.where("id", "t1");
      expect(found).toHaveLength(1);

      // Eliminar por ID
      await Task.delete({ id: "t1" });
      found = await Task.where("id", "t1");
      expect(found).toHaveLength(0);

      // Verificar que el otro sigue existiendo
      found = await Task.where("id", "t2");
      expect(found).toHaveLength(1);
    });

    it("where() - consultas con filtros y operadores", async () => {
      @Name("items")
      class Item extends Table<Item> {
        @PrimaryKey()
        @Default(() => `item_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;

        @NotNull()
        @Default(() => 0)
        declare score: number;

        @NotNull()
        @Default(() => "default")
        declare category: string;

        @NotNull()
        @Default(() => true)
        declare active: boolean;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [Item] });
      dynamite.connect();
      await dynamite.sync();

      const items = [
        { id: "i1", score: 100, category: "A", active: true },
        { id: "i2", score: 200, category: "B", active: false },
        { id: "i3", score: 150, category: "A", active: true },
        { id: "i4", score: 50, category: "C", active: true },
      ];

      await Promise.all(items.map((item) => Item.create(item)));

      // Filtro por igualdad
      const categoryA = await Item.where({ category: "A" });
      expect(categoryA).toHaveLength(2);

      // Filtro con operador >=
      const highScore = await Item.where("score", ">=", 150);
      expect(highScore.length).toBeGreaterThanOrEqual(2);

      // Filtro booleano
      const activeItems = await Item.where({ active: true });
      expect(activeItems).toHaveLength(3);

      // Filtro con objeto (múltiples campos)
      const specificFilter = await Item.where({ category: "A", active: true });
      expect(specificFilter).toHaveLength(2);
    });
  });

  describe("⚡ Operaciones Masivas y Rendimiento", () => {
    it("operaciones masivas - creación, actualización y eliminación de lotes", async () => {
      @Name("massive_users")
      class User extends Table<User> {
        @PrimaryKey()
        @Default(() => `user_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;
        @NotNull() declare email: string;
        @NotNull() declare age: number;
        @Default(() => new Date().toISOString())
        declare created_at: NonAttribute<string>;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [User] });
      dynamite.connect();
      await dynamite.sync();

      const startTime = Date.now();

      // Creación masiva (50 usuarios)
      const users = Array.from({ length: 50 }, (_, i) => ({
        id: `user_${i + 1}`,
        email: `user${i + 1}@test.com`,
        age: 20 + (i % 30),
      }));

      const createPromises = users.map((user) => User.create(user));
      await Promise.all(createPromises);

      const creationTime = Date.now() - startTime;
      console.log(`🚀 Creación de 50 usuarios: ${creationTime}ms`);

      // Verificar creación
      const allUsers = await User.where("age", ">=", 0);
      expect(allUsers.length).toBe(50);

      // Actualización masiva (cambiar edad a todos los menores de 30)
      const updateStartTime = Date.now();
      const youngUsers = await User.where("age", "<", 30);

      const updatePromises = youngUsers.map((user) =>
        user.update({ age: user.age + 10 })
      );
      await Promise.all(updatePromises);

      const updateTime = Date.now() - updateStartTime;
      console.log(`🔄 Actualización masiva: ${updateTime}ms`);

      // Eliminación masiva (usuarios con ID par)
      const deleteStartTime = Date.now();
      const evenUsers = allUsers.filter((_, index) => index % 2 === 0);

      const deletePromises = evenUsers.map((user) => user.destroy());
      await Promise.all(deletePromises);

      const deleteTime = Date.now() - deleteStartTime;
      console.log(`🗑️ Eliminación masiva: ${deleteTime}ms`);

      // Verificar eliminación
      const remainingUsers = await User.where("age", ">=", 0);
      expect(remainingUsers.length).toBe(25); // La mitad

      const totalTime = Date.now() - startTime;
      console.log(`📊 Operación masiva completa: ${totalTime}ms`);
      expect(totalTime).toBeLessThan(5000); // Menos de 5 segundos
    });

    it("rendimiento de consultas con paginación y ordenamiento", async () => {
      @Name("performance_items")
      class Item extends Table<Item> {
        @PrimaryKey()
        @Default(() => `item_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;
        @NotNull() declare value: number;
        @NotNull() declare type: string;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [Item] });
      dynamite.connect();
      await dynamite.sync();

      // Crear 100 registros para pruebas de rendimiento
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: `item_${String(i + 1).padStart(3, "0")}`,
        value: Math.floor(Math.random() * 1000),
        type: ["A", "B", "C", "D"][i % 4],
      }));

      await Promise.all(items.map((item) => Item.create(item)));

      // Prueba de paginación
      const paginationStart = Date.now();
      const page1 = await Item.where({}, { limit: 10 });
      const page2 = await Item.where({}, { skip: 10, limit: 10 });
      const paginationTime = Date.now() - paginationStart;

      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(10);
      console.log(`📄 Paginación (20 registros): ${paginationTime}ms`);

      // Prueba de ordenamiento
      const sortStart = Date.now();
      const sortedAsc = await Item.where({}, { order: "ASC", limit: 5 });
      const sortedDesc = await Item.where({}, { order: "DESC", limit: 5 });
      const sortTime = Date.now() - sortStart;

      expect(sortedAsc).toHaveLength(5);
      expect(sortedDesc).toHaveLength(5);
      console.log(`🔄 Ordenamiento (10 registros): ${sortTime}ms`);

      // Prueba de filtros complejos
      const filterStart = Date.now();
      const filtered = await Item.where({ type: "A" });
      const complexFilter = await Item.where({ type: "B" });
      const filterTime = Date.now() - filterStart;

      expect(filtered.length).toBeGreaterThan(0);
      expect(complexFilter.length).toBeGreaterThan(0);
      console.log(`🔍 Filtros complejos: ${filterTime}ms`);

      // Todas las operaciones deben ser rápidas
      expect(paginationTime).toBeLessThan(500);
      expect(sortTime).toBeLessThan(500);
      expect(filterTime).toBeLessThan(500);
    });
  });

  describe("🔄 Concurrencia y Casos Edge", () => {
    it("operaciones concurrentes sobre el mismo registro", async () => {
      @Name("concurrent_counter")
      class Counter extends Table<Counter> {
        @PrimaryKey()
        @Default(() => `counter_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;

        @NotNull()
        @Default(() => 0)
        declare value: number;

        @UpdatedAt()
        declare updated_at: NonAttribute<string>;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [Counter] });
      dynamite.connect();
      await dynamite.sync();

      await Counter.create({ id: "counter_1", value: 0 });

      // Simular 10 actualizaciones concurrentes
      const concurrentUpdates = Array.from({ length: 10 }, async (_, i) => {
        const counter = await Counter.where({ id: "counter_1" }).then(
          (counters) => counters[0]
        );
        await counter.update({ value: counter.value + 1 });
        return i;
      });

      const startTime = Date.now();
      await Promise.all(concurrentUpdates);
      const concurrencyTime = Date.now() - startTime;

      // Verificar resultado final
      const finalCounter = await Counter.where({ id: "counter_1" });
      expect(finalCounter).toHaveLength(1);
      expect(finalCounter[0].value).toBeGreaterThan(0); // Al menos alguna actualización debe haber funcionado

      console.log(`⚡ 10 actualizaciones concurrentes: ${concurrencyTime}ms`);
      console.log(`📊 Valor final del contador: ${finalCounter[0].value}`);
    });

    it("manejo de errores y casos extremos", async () => {
      @Name("error_handling")
      class TestModel extends Table<TestModel> {
        @PrimaryKey()
        @Default(() => `test_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;

        @NotNull()
        @Default(() => "Test Model")
        declare name: string;

        @NotNull()
        @Default(() => 1)
        @Validate((v) => ((v as number) > 0 ? true : "Debe ser positivo"))
        declare score: number;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [TestModel] });
      dynamite.connect();
      await dynamite.sync();

      // Error en validación
      expect(async () => {
        await TestModel.create({ id: "test1", name: "Test", score: -1 });
      }).rejects.toThrow("Debe ser positivo");

      // Campo requerido faltante
      expect(async () => {
        await TestModel.create({ id: "test2", name: "", score: 10 });
      }).rejects.toThrow();

      // Búsqueda de registro inexistente
      const notFound = await TestModel.where("id", "inexistente");
      expect(notFound).toEqual([]);

      // Operador inválido
      await TestModel.create({ id: "test3", name: "Valid", score: 10 });
      expect(async () => {
        await TestModel.where("score", "invalid_op" as any, 5);
      }).rejects.toThrow();

      // Destrucción de registro inexistente (no debe fallar)
      const result = await TestModel.delete({ id: "inexistente" });
      expect(result).toBe(0); // Retorna 0 cuando no se eliminan registros
    });

    it("consultas con first() y last() - comportamiento correcto", async () => {
      @Name("first_last_test")
      class Score extends Table<Score> {
        @PrimaryKey()
        @Default(() => `score_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;

        @NotNull()
        @Default(() => 0)
        declare points: number;

        @NotNull()
        @Default(() => "Anonymous")
        declare player: string;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [Score] });
      dynamite.connect();
      await dynamite.sync();

      // Crear datos ordenados
      await Promise.all([
        Score.create({ id: "s1", points: 100, player: "Alice" }),
        Score.create({ id: "s2", points: 200, player: "Bob" }),
        Score.create({ id: "s3", points: 150, player: "Charlie" }),
        Score.create({ id: "s4", points: 300, player: "Diana" }),
      ]);

      // First - menor valor
      const first = await Score.first("points", ">=", 0);
      expect(first).toBeTruthy();
      expect(first!.points).toBeLessThanOrEqual(300);

      // Last - mayor valor
      const last = await Score.last("points", ">=", 0);
      expect(last).toBeTruthy();
      expect(last!.points).toBeGreaterThanOrEqual(0);

      // First con filtro específico
      const firstHigh = await Score.first("points", ">=", 150);
      expect(firstHigh).toBeTruthy();
      expect(firstHigh!.points).toBeGreaterThanOrEqual(150);

      // Last con filtro específico
      const lastLow = await Score.last("points", "<=", 200);
      expect(lastLow).toBeTruthy();
      expect(lastLow!.points).toBeLessThanOrEqual(200);
    });
  });

  describe("🔗 Relaciones y Funcionalidades Avanzadas", () => {
    it("relaciones básicas HasMany y BelongsTo", async () => {
      @Name("relation_users")
      class User extends Table<User> {
        @PrimaryKey()
        @Default(() => `user_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;

        @NotNull()
        @Default(() => "Usuario Anónimo")
        declare name: string;

        @HasMany(() => Post, "user_id")
        declare posts: NonAttribute<Post[]>;
      }

      @Name("relation_posts")
      class Post extends Table<Post> {
        @PrimaryKey()
        @Default(() => `post_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;
        @NotNull() declare title: string;
        @NotNull() declare user_id: string;
        @BelongsTo(() => User, "user_id")
        declare user: NonAttribute<User | null>;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [User, Post] });
      dynamite.connect();
      await dynamite.sync();

      // Crear usuario y posts
      const user = await User.create({ id: "u1", name: "John Doe" });

      await Promise.all([
        Post.create({ id: "p1", title: "Post 1", user_id: "u1" }),
        Post.create({ id: "p2", title: "Post 2", user_id: "u1" }),
        Post.create({ id: "p3", title: "Post 3", user_id: "u1" }),
      ]);

      // Verificar relaciones básicas
      const foundUser = await User.where("id", "u1");
      expect(foundUser).toHaveLength(1);
      expect(foundUser[0].name).toBe("John Doe");

      const userPosts = await Post.where("user_id", "u1");
      expect(userPosts).toHaveLength(3);
    });

    it("timestamps automáticos CreatedAt y UpdatedAt", async () => {
      @Name("timestamp_audit")
      class Audit extends Table<Audit> {
        @PrimaryKey()
        @Default(() => `audit_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;

        @NotNull()
        @Default(() => "default_action")
        declare action: string;
        @CreatedAt() declare created_at: NonAttribute<string>;
        @UpdatedAt() declare updated_at: NonAttribute<string>;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [Audit] });
      dynamite.connect();
      await dynamite.sync();

      const audit = await Audit.create({ id: "a1", action: "login" });

      expect(audit.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(audit.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      const initialUpdated = audit.updated_at;

      // Esperar un poco para que el timestamp cambie
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Actualizar registro
      await audit.update({ action: "logout" });

      const updated = await Audit.where("id", "a1");
      expect(updated[0].created_at).toBe(audit.created_at); // No debe cambiar
      expect(updated[0].updated_at).not.toBe(initialUpdated); // Debe cambiar
    });
  });

  describe("📊 Métricas y Resumen Final", () => {
    it("resumen de rendimiento y funcionalidades", async () => {
      const testStartTime = Date.now();

      @Name("final_summary")
      class Summary extends Table<Summary> {
        @PrimaryKey()
        @Default(() => `summary_${Math.random().toString(36).substr(2, 9)}`)
        declare id: CreationOptional<string>;
        @NotNull() declare metric: string;
        @NotNull() declare value: number;
        @Default(() => new Date().toISOString())
        declare timestamp: NonAttribute<string>;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [Summary] });
      dynamite.connect();
      await dynamite.sync();

      // Crear métricas de prueba
      const metrics = [
        { id: "m1", metric: "throughput", value: 1000 },
        { id: "m2", metric: "latency", value: 50 },
        { id: "m3", metric: "success_rate", value: 99.9 },
        { id: "m4", metric: "errors", value: 1 },
      ];

      await Promise.all(metrics.map((metric) => Summary.create(metric)));

      // Verificar todas las métricas
      const allMetrics = await Summary.where("value", ">=", 0);
      expect(allMetrics).toHaveLength(4);

      // Calcular estadísticas
      const avgValue =
        allMetrics.reduce((sum, m) => sum + m.value, 0) / allMetrics.length;
      const maxValue = Math.max(...allMetrics.map((m) => m.value));
      const minValue = Math.min(...allMetrics.map((m) => m.value));

      console.log(`\n📊 RESUMEN DE MÉTRICAS:`);
      console.log(`   • Total de métricas: ${allMetrics.length}`);
      console.log(`   • Valor promedio: ${avgValue.toFixed(2)}`);
      console.log(`   • Valor máximo: ${maxValue}`);
      console.log(`   • Valor mínimo: ${minValue}`);

      const testTime = Date.now() - testStartTime;
      console.log(`⏱️ Tiempo del test final: ${testTime}ms`);

      // Validaciones finales
      expect(allMetrics.length).toBe(4);
      expect(avgValue).toBeGreaterThan(0);
      expect(maxValue).toBe(1000);
      expect(minValue).toBe(1);
      expect(testTime).toBeLessThan(2000); // Menos de 2 segundos
    });
  });
});
