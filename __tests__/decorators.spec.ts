/* __tests__/decorators.spec.ts
 * -----------------------------------------------------------
 * Suite para verificar todos los decoradores Dinamite ORM.
 */

import wrapper, { STORE } from "../src/core/wrapper";

import CreatedAt from "../src/decorators/created_at";
import Default from "../src/decorators/default";
import Index from "../src/decorators/index";
import IndexSort from "../src/decorators/index_sort";
import Mutate from "../src/decorators/mutate";
import Name from "../src/decorators/name";
import NotNull from "../src/decorators/not_null";
import PrimaryKey from "../src/decorators/primary_key";
import UpdatedAt from "../src/decorators/updated_at";
import Validate from "../src/decorators/validate";

describe("Decoradores Dinamite ORM", () => {
  beforeEach(() => wrapper.clear());

  /* ---------------------------------------------------------- */
  it("nombre de tabla por defecto (snake_plural) cuando no se usa @Name", () => {
    class Book {
      @NotNull()
      declare title: string;
    }
    const meta = wrapper.get(Book)!;
    expect(meta.name).toBe("books"); // Book → books
  });

  /* ---------------------------------------------------------- */
  it("@Name (clase y propiedad)", () => {
    @Name("usuarios")
    class User {
      @Name("correo")
      declare email: string;
    }

    const meta = wrapper.get(User)!;
    expect(meta.name).toBe("usuarios");
    expect(meta.columns.get("email")!.name).toBe("correo");
  });

  /* ---------------------------------------------------------- */
  it("@Index + @IndexSort (PK + SK)", () => {
    class Post {
      @Index() // Partition Key
      declare slug: string;

      @IndexSort() // Sort Key
      declare created: string;
    }

    const meta = wrapper.get(Post)!;
    const pkCol = meta.columns.get("slug")!;
    const skCol = meta.columns.get("created")!;

    expect(pkCol.index).toBe(true);
    expect(skCol.indexSort).toBe(true);
  });

  /* ---------------------------------------------------------- */
  it("@PrimaryKey (combinado)", () => {
    class Comment {
      @PrimaryKey()
      declare id: string;
    }

    const meta = wrapper.get(Comment)!;
    const col = meta.columns.get("id")!;

    expect(col.index).toBe(true);
    expect(col.indexSort).toBe(true);
  });

  /* ---------------------------------------------------------- */
  it("@Default + @Mutate + @Validate pipeline", () => {
    @Name("tests")
    class Model {
      @Default(() => 10)
      @Mutate((v) => (v as number) * 2)
      @Validate((v) => ((v as number) >= 20 ? true : "menor a 20"))
      declare score: number;
    }

    const m = new Model();
    (m as any).score = undefined; // dispara pipeline
    expect(m.score).toBe(20);
    expect((m as any)[STORE].score).toBe(20);

    expect(() => {
      m.score = 5 as any;
    }).toThrow("menor a 20");
  });

  /* ---------------------------------------------------------- */
  it("@NotNull rechaza null/undefined/cadena vacía", () => {
    class File {
      @NotNull()
      declare path: string;
    }

    const f = new File();
    expect(() => ((f as any).path = null)).toThrow();
    expect(() => ((f as any).path = " ")).toThrow();
    f.path = "/tmp/file";
    expect(f.path).toBe("/tmp/file");
  });

  /* ---------------------------------------------------------- */
  it("@CreatedAt y @UpdatedAt gestionan timestamps", () => {
    class Audit {
      @CreatedAt()
      declare created: string;

      @UpdatedAt()
      declare updated: string;
    }

    const a = new Audit();
    (a as any).created = undefined;
    (a as any).updated = undefined;

    const firstCreated = a.created;
    const firstUpdated = a.updated;

    return new Promise((r) => setTimeout(r, 10)).then(() => {
      (a as any).updated = undefined;
      expect(a.created).toBe(firstCreated);
      expect(a.updated).not.toBe(firstUpdated);
    });
  });

  /* ---------------------------------------------------------- */
  it("@Validate - casos de error y validaciones complejas", () => {
    class Product {
      @Validate((v) => (v as number) > 0 ? true : "El precio debe ser positivo")
      declare price: number;

      @Validate((v) => typeof v === 'string' && (v as string).length >= 3 ? true : "Nombre muy corto")
      declare name: string;

      @Validate((v) => ["A", "B", "C"].includes(v as string) ? true : "Categoría inválida")
      declare category: string;
    }

    const p = new Product();
    
    // Casos de error
    expect(() => { p.price = -10; }).toThrow("El precio debe ser positivo");
    expect(() => { p.price = 0; }).toThrow("El precio debe ser positivo");
    expect(() => { p.name = "ab"; }).toThrow("Nombre muy corto");
    expect(() => { p.category = "X"; }).toThrow("Categoría inválida");
    
    // Casos de éxito
    p.price = 100;
    p.name = "Laptop";
    p.category = "A";
    expect(p.price).toBe(100);
    expect(p.name).toBe("Laptop");
    expect(p.category).toBe("A");
  });

  /* ---------------------------------------------------------- */
  it("@Mutate - transformaciones y casos extremos", () => {
    class User {
      @Mutate((v) => (v as string)?.trim().toLowerCase())
      declare email: string;

      @Mutate((v) => Math.max(0, v as number))
      declare age: number;

      @Mutate((v) => (v as string)?.replace(/[^a-zA-Z0-9]/g, ""))
      declare username: string;
    }

    const u = new User();
    
    // Transformaciones de strings
    u.email = "  USER@EXAMPLE.COM  ";
    expect(u.email).toBe("user@example.com");
    
    // Clamp de números
    u.age = -5;
    expect(u.age).toBe(0);
    u.age = 25;
    expect(u.age).toBe(25);
    
    // Limpieza de caracteres especiales
    u.username = "user@123#$%";
    expect(u.username).toBe("user123");
  });

  /* ---------------------------------------------------------- */
  it("@Default - valores por defecto complejos", () => {
    class Config {
      @Default(() => new Date().toISOString())
      declare timestamp: string;

      @Default(() => [])
      declare tags: string[];

      @Default(() => ({ active: true, count: 0 }))
      declare status: { active: boolean; count: number };

      @Default(() => Math.random().toString(36).slice(2))
      declare id: string;
    }

    const c1 = new Config();
    (c1 as any).timestamp = undefined;
    (c1 as any).tags = undefined;
    (c1 as any).status = undefined;
    (c1 as any).id = undefined;

    // Verificar que se aplicaron defaults
    expect(typeof c1.timestamp).toBe("string");
    expect(c1.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO format
    expect(Array.isArray(c1.tags)).toBe(true);
    expect(c1.tags).toHaveLength(0);
    expect(c1.status.active).toBe(true);
    expect(c1.status.count).toBe(0);
    expect(typeof c1.id).toBe("string");
    expect(c1.id.length).toBeGreaterThan(0);

    // Verificar que cada instancia tiene defaults únicos
    const c2 = new Config();
    (c2 as any).id = undefined;
    expect(c1.id).not.toBe(c2.id);
  });

  /* ---------------------------------------------------------- */
  it("combinación múltiple de decoradores", () => {
    class Article {
      @Default(() => "draft")
      @Validate((v) => ["draft", "published", "archived"].includes(v as string) ? true : "Estado inválido")
      @Mutate((v) => (v as string)?.toLowerCase())
      declare status: string;

      @NotNull()
      @Mutate((v) => (v as string)?.trim())
      @Validate((v) => (v as string)?.length >= 5 ? true : "Título muy corto")
      declare title: string;

      @Default(() => 0)
      @Mutate((v) => Math.max(0, v as number))
      @Validate((v) => (v as number) <= 5 ? true : "Rating máximo es 5")
      declare rating: number;
    }

    const a = new Article();
    
    // Aplicación de default
    (a as any).status = undefined;
    expect(a.status).toBe("draft");
    
    // Pipeline completo: mutate -> validate
    a.status = "PUBLISHED";
    expect(a.status).toBe("published");
    
    // NotNull + Mutate + Validate
    a.title = "   Mi Artículo Genial   ";
    expect(a.title).toBe("Mi Artículo Genial");
    
    // Error en validación después de mutación
    expect(() => { a.title = "  ab  "; }).toThrow("Título muy corto");
    
    // Default + Mutate + Validate para rating
    (a as any).rating = undefined;
    expect(a.rating).toBe(0);
    
    a.rating = -2; // mutate lo convierte a 0
    expect(a.rating).toBe(0);
    
    expect(() => { a.rating = 10; }).toThrow("Rating máximo es 5");
    
    a.rating = 4;
    expect(a.rating).toBe(4);
  });
});
