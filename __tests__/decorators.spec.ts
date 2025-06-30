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
});
