/**
 * @file index.test.ts
 * @description Test suite para Dynamite ORM
 * @run tsx --tsconfig tsx.config.json src/index.test.ts
 */

import type { CreationOptional, NonAttribute } from "./@types/index";
import { Dynamite } from "./core/client";
import Table from "./core/table";
import { PrimaryKey } from "./decorators/indexes";
import { BelongsTo, HasMany, HasOne, ManyToMany } from "./decorators/relations";
import { CreatedAt, UpdatedAt, DeleteAt } from "./decorators/timestamps";
import { Column, Default, Mutate, Name, NotNull, Serialize, Validate } from "./decorators/transforms";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assert_throws(fn: () => Promise<any>, expected_message?: string) {
  try {
    await fn();
    throw new Error("Expected function to throw");
  } catch (error: any) {
    if (expected_message && !error.message.includes(expected_message)) {
      throw new Error(`Expected "${expected_message}" but got "${error.message}"`);
    }
  }
}

// =============================================================================
// MODELS
// =============================================================================

@Name("test_users")
class User extends Table<User> {
  @PrimaryKey()
  @Default(() => `user-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  id!: string;

  @NotNull("Name required")
  @Validate((v) => (typeof v === "string" && v.length >= 3) || "Name min 3 chars")
  name!: string;

  @Validate((v) => (typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || "Invalid email")
  email?: string;

  @Default(18)
  @Mutate((v) => (typeof v === "string" ? parseInt(v, 10) : v))
  age?: number;

  @HasMany(() => Order, "user_id", "id")
  orders?: NonAttribute<Order[]>;

  @HasOne(() => Profile, "user_id", "id")
  profile?: NonAttribute<Profile>;

  @ManyToMany(() => Role, "test_users_roles", "user_id", "role_id")
  roles?: NonAttribute<Role[]>;

  @CreatedAt()
  declare created_at: CreationOptional<string>;

  @UpdatedAt()
  declare updated_at: CreationOptional<string>;
}

@Name("test_products")
class Product extends Table<Product> {
  @PrimaryKey()
  @Default(() => `prod-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  id!: string;

  @NotNull("Name required")
  name!: string;

  @Column()
  price!: number;

  @Column()
  category_id!: string;

  @Column()
  owner_id!: string;

  @BelongsTo(() => Category, "category_id", "id")
  category?: NonAttribute<Category>;

  @BelongsTo(() => User, "owner_id", "id")
  owner?: NonAttribute<User>;
}

@Name("test_orders")
class Order extends Table<Order> {
  @PrimaryKey()
  @Default(() => `order-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  id!: string;

  @Column()
  user_id!: string;

  @Column()
  total!: number;

  @Column()
  status?: "pending" | "completed" | "cancelled";

  @BelongsTo(() => User, "user_id", "id")
  user?: NonAttribute<User>;
}

@Name("test_categories")
class Category extends Table<Category> {
  @PrimaryKey()
  @Default(() => `cat-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  id!: string;

  @Mutate((v) => (typeof v === "string" ? v.toLowerCase() : v))
  name!: string;

  @HasMany(() => Product, "category_id", "id")
  products?: NonAttribute<Product[]>;
}

@Name("test_roles")
class Role extends Table<Role> {
  @PrimaryKey()
  @Default(() => `role-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  id!: string;

  name!: string;

  @ManyToMany(() => User, "test_users_roles", "role_id", "user_id")
  users?: NonAttribute<User[]>;
}

@Name("test_soft_delete")
class SoftDeleteModel extends Table<SoftDeleteModel> {
  @PrimaryKey()
  @Default(() => `soft-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  id!: string;

  name!: string;

  @DeleteAt()
  deleted_at?: string;
}

@Name("test_profiles")
class Profile extends Table<Profile> {
  @PrimaryKey()
  @Default(() => `profile-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  id!: string;

  @Column()
  user_id!: string;

  @Column()
  bio!: string;

  @BelongsTo(() => User, "user_id", "id")
  user?: NonAttribute<User>;
}

const isPositive = (v: number) => v > 0 || "Must be positive";
const isLessThan100 = (v: number) => v < 100 || "Must be < 100";

@Name("test_validators")
class ValidatorModel extends Table<ValidatorModel> {
  @PrimaryKey()
  @Default(() => `val-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  id!: string;

  @Default(5)
  @Validate((v: number) => v >= 0 || "Must be >= 0")
  with_default!: number;

  @Validate((v: string) => v.length >= 3 || "Min 3 chars")
  @Mutate((v: string) => v.trim().toLowerCase())
  transformed!: string;

  @Validate((v: number) => v <= 1000 || "Max 1000")
  @Mutate((v: number) => Math.abs(v))
  @NotNull("Required")
  absolute!: number;

  @Serialize(JSON.parse, JSON.stringify)
  metadata!: Record<string, any>;

  @Validate([isPositive, isLessThan100])
  multi_validated!: number;

  @Name("db_column_name")
  @Column()
  renamed!: string;
}

// =============================================================================
// TEST RUNNER
// =============================================================================

type Test = { name: string; fn: () => Promise<void> };

(async function main() {
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];
  const start = performance.now();

  console.log("\n DYNAMITE ORM - TEST SUITE\n");

  try {
    const dynamite = new Dynamite({
      endpoint: "http://localhost:8000",
      region: "us-east-1",
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
      tables: [User, Product, Order, Category, Role, SoftDeleteModel, Profile, ValidatorModel],
    });

    await dynamite.connect();

    const { load_all } = await import("../scripts/load_seed");
    await load_all();

    const [categories, users, products, orders, roles] = await Promise.all([
      Category.where({}, { limit: 5 }),
      User.where({}, { limit: 10 }),
      Product.where({}, { limit: 20 }),
      Order.where({}, { limit: 15 }),
      Role.where({}, { limit: 3 }),
    ]);

    const tests: Test[] = [
      // =========================================================================
      // DECORATORS
      // =========================================================================
      {
        name: "@Default applies default value",
        fn: async () => {
          const user = new User({ name: "Test", email: "test@example.com" } as any);
          assert(user.age === 18, "Default age should be 18");
          assert(typeof user.id === "string" && user.id.length > 0, "ID should be generated");
        },
      },
      {
        name: "@Validate rejects invalid values",
        fn: async () => {
          await assert_throws(() => User.create({ name: "AB", email: "test@test.com" } as any), "Name min 3 chars");
        },
      },
      {
        name: "@NotNull rejects null/undefined/empty",
        fn: async () => {
          await assert_throws(() => Product.create({ price: 100 } as any), "Name required");
          await assert_throws(() => Product.create({ name: null, price: 100 } as any), "Name required");
          await assert_throws(() => Product.create({ name: "", price: 100 } as any), "Name required");
          await assert_throws(() => Product.create({ name: "   ", price: 100 } as any), "Name required");
        },
      },
      {
        name: "@Mutate transforms values",
        fn: async () => {
          const cat = new Category({ name: "UPPER" } as any);
          assert(cat.name === "upper", "Should transform to lowercase");
        },
      },
      {
        name: "@CreatedAt sets timestamp on create",
        fn: async () => {
          const user = await User.create({ name: "New User", email: "new@test.com" } as any);
          assert(typeof user.created_at === "string", "created_at should be set");
        },
      },
      {
        name: "@UpdatedAt sets timestamp on save",
        fn: async () => {
          const user = users[0];
          const original = user.created_at;
          user.name = "Updated";
          await user.save();
          assert(typeof user.updated_at === "string", "updated_at should be set");
          assert(user.created_at === original, "created_at should not change");
        },
      },

      // =========================================================================
      // SOFT DELETE
      // =========================================================================
      {
        name: "@DeleteAt marks record without physical deletion",
        fn: async () => {
          const record = await SoftDeleteModel.create({ name: "Test" } as any);
          assert(record.deleted_at === undefined, "deleted_at should be undefined initially");
          await record.destroy();
          const loaded = await SoftDeleteModel.withTrashed({ id: record.id });
          assert(loaded.length === 1 && loaded[0].deleted_at !== undefined, "deleted_at should be set");
        },
      },
      {
        name: "Normal queries exclude soft-deleted records",
        fn: async () => {
          const record = await SoftDeleteModel.create({ name: "ToDelete" } as any);
          await record.destroy();
          const all = await SoftDeleteModel.where({});
          assert(!all.some((r) => r.id === record.id), "Soft deleted should not appear");
        },
      },
      {
        name: "onlyTrashed returns only deleted records",
        fn: async () => {
          const active = await SoftDeleteModel.create({ name: "Active" } as any);
          const deleted = await SoftDeleteModel.create({ name: "Deleted" } as any);
          await deleted.destroy();
          const trashed = await SoftDeleteModel.onlyTrashed({});
          assert(trashed.some((r) => r.id === deleted.id), "Should include deleted");
          assert(!trashed.some((r) => r.id === active.id), "Should not include active");
        },
      },
      {
        name: "forceDestroy permanently removes record",
        fn: async () => {
          const record = await SoftDeleteModel.create({ name: "ForceDelete" } as any);
          const id = record.id;
          await record.forceDestroy();
          const result = await SoftDeleteModel.withTrashed({ id });
          assert(result.length === 0, "Record should not exist");
        },
      },

      // =========================================================================
      // RELATIONS - HasMany / BelongsTo
      // =========================================================================
      {
        name: "@HasMany returns array of related records",
        fn: async () => {
          const order = orders[0];
          const user = await User.first({ id: order.user_id }, { include: { orders: true } });
          assert(user !== undefined, "User should exist");
          assert(Array.isArray(user!.orders) && user!.orders!.length > 0, "Should have orders");
        },
      },
      {
        name: "@BelongsTo returns parent record",
        fn: async () => {
          const product = await Product.first({ id: products[0].id }, { include: { category: true } });
          assert(product !== undefined, "Product should exist");
          assert(product!.category !== undefined && product!.category!.id === products[0].category_id, "Category should match");
        },
      },
      {
        name: "@HasOne returns single object, not array",
        fn: async () => {
          const user = await User.create({ name: "HasOneUser", email: "hasone@test.com" } as any);
          const profile = await Profile.create({ user_id: user.id, bio: "Bio" } as any);
          const loaded = await User.first({ id: user.id }, { include: { profile: true } });
          assert(loaded !== undefined && !Array.isArray(loaded!.profile), "HasOne should return object");
          assert(loaded!.profile!.id === profile.id, "Profile should match");
        },
      },
      {
        name: "Empty HasMany returns empty array",
        fn: async () => {
          const user = await User.create({ name: "NoOrders", email: "noorders@test.com" } as any);
          const loaded = await User.first({ id: user.id }, { include: { orders: true } });
          assert(loaded !== undefined && Array.isArray(loaded!.orders) && loaded!.orders!.length === 0, "Should be empty array");
        },
      },
      {
        name: "HasOne returns null when no related record",
        fn: async () => {
          const user = await User.create({ name: "NoProfile", email: "noprofile@test.com" } as any);
          const loaded = await User.first({ id: user.id }, { include: { profile: true } });
          assert(loaded !== undefined && (loaded!.profile === null || loaded!.profile === undefined), "Profile should be null/undefined");
        },
      },
      {
        name: "BelongsTo returns null when FK not found",
        fn: async () => {
          const order = await Order.create({ user_id: "non-existent", total: 100, status: "pending" } as any);
          const loaded = await Order.first({ id: order.id }, { include: { user: true } });
          assert(loaded !== undefined && (loaded!.user === null || loaded!.user === undefined), "User should be null/undefined");
        },
      },

      // =========================================================================
      // RELATIONS - ManyToMany
      // =========================================================================
      {
        name: "attach adds ManyToMany relation",
        fn: async () => {
          const user = users[1];
          const role = roles[0];
          await user.attach(Role, role.id);
          const loaded = await User.first({ id: user.id }, { include: { roles: true } });
          assert(loaded !== undefined && loaded!.roles!.some((r) => r.id === role.id), "Should have attached role");
        },
      },
      {
        name: "detach removes ManyToMany relation",
        fn: async () => {
          const user = users[1];
          const role = roles[0];
          await user.detach(Role, role.id);
          const loaded = await User.first({ id: user.id }, { include: { roles: true } });
          assert(loaded !== undefined && !loaded!.roles?.some((r) => r.id === role.id), "Role should be detached");
        },
      },
      {
        name: "sync replaces ManyToMany relations",
        fn: async () => {
          const user = users[2];
          await user.sync(Role, [roles[0].id, roles[1].id]);
          const loaded = await User.first({ id: user.id }, { include: { roles: true } });
          assert(loaded !== undefined && loaded!.roles!.length === 2, "Should have exactly 2 roles");
        },
      },

      // =========================================================================
      // QUERY OPTIONS
      // =========================================================================
      {
        name: "limit returns N records",
        fn: async () => {
          const results = await User.where({}, { limit: 5 });
          assert(results.length === 5, "Should return 5 records");
        },
      },
      {
        name: "skip/offset paginates results",
        fn: async () => {
          const page1 = await User.where({}, { limit: 3, skip: 0 });
          const page2 = await User.where({}, { limit: 3, skip: 3 });
          assert(page1.length === 3 && page2.length === 3 && page1[0].id !== page2[0].id, "Pages should differ");
        },
      },
      {
        name: "order sorts by field ASC/DESC",
        fn: async () => {
          const asc = await User.where({}, { order: { age: "ASC" }, limit: 5 });
          const desc = await User.where({}, { order: { age: "DESC" }, limit: 5 });
          for (let i = 1; i < asc.length; i++) assert(asc[i - 1].age! <= asc[i].age!, "ASC order failed");
          for (let i = 1; i < desc.length; i++) assert(desc[i - 1].age! >= desc[i].age!, "DESC order failed");
        },
      },
      {
        name: "attributes selects specific fields",
        fn: async () => {
          const [user] = await User.where({}, { attributes: ["id", "name"], limit: 1 });
          assert(user.id !== undefined && user.name !== undefined && user.email === undefined, "Should only have id, name");
        },
      },
      {
        name: "limit 0 returns empty array",
        fn: async () => {
          const results = await User.where({}, { limit: 0 });
          assert(results.length === 0, "Should be empty");
        },
      },
      {
        name: "offset > total returns empty array",
        fn: async () => {
          const results = await User.where({}, { offset: 100000 });
          assert(results.length === 0, "Should be empty");
        },
      },

      // =========================================================================
      // WHERE OPERATORS
      // =========================================================================
      {
        name: "where with equality",
        fn: async () => {
          const target = users[0].age;
          const results = await User.where({ age: target });
          assert(results.length > 0 && results.every((u) => u.age === target), "All should match age");
        },
      },
      {
        name: "where with != operator",
        fn: async () => {
          const results = await User.where("age", "!=", 20);
          assert(results.length > 0 && results.every((u) => u.age !== 20), "None should be 20");
        },
      },
      {
        name: "where with > operator",
        fn: async () => {
          const results = await User.where("age", ">", 25);
          assert(results.length > 0 && results.every((u) => u.age! > 25), "All should be > 25");
        },
      },
      {
        name: "where with < operator",
        fn: async () => {
          const results = await User.where("age", "<", 25);
          assert(results.length > 0 && results.every((u) => u.age! < 25), "All should be < 25");
        },
      },
      {
        name: "where with >= operator",
        fn: async () => {
          const results = await User.where("age", ">=", 25);
          assert(results.length > 0 && results.every((u) => u.age! >= 25), "All should be >= 25");
        },
      },
      {
        name: "where with <= operator",
        fn: async () => {
          const results = await User.where("age", "<=", 25);
          assert(results.length > 0 && results.every((u) => u.age! <= 25), "All should be <= 25");
        },
      },
      {
        name: "where with in operator",
        fn: async () => {
          const ages = [20, 22, 24];
          const results = await User.where("age", "in", ages);
          assert(results.length > 0 && results.every((u) => ages.includes(u.age!)), "All should be in list");
        },
      },
      {
        name: "where with contains operator",
        fn: async () => {
          const results = await User.where({ name: { contains: "User" } as any });
          assert(results.length > 0 && results.every((u) => u.name.includes("User")), "All should contain 'User'");
        },
      },
      {
        name: "where with range (between)",
        fn: async () => {
          const results = await User.where({ age: { $gt: 20, $lt: 30 } as any });
          assert(results.length > 0 && results.every((u) => u.age! > 20 && u.age! < 30), "All should be between 20-30");
        },
      },
      {
        name: "where with multiple conditions",
        fn: async () => {
          const results = await User.where({ age: { $gte: 20 } as any, name: { contains: "User" } as any });
          results.forEach((u) => {
            assert(u.age! >= 20 && u.name.includes("User"), "Should match all conditions");
          });
        },
      },

      // =========================================================================
      // INCLUDE OPTIONS
      // =========================================================================
      {
        name: "include with where filters relations",
        fn: async () => {
          const order = orders[0];
          order.status = "completed";
          await order.save();
          const user = await User.first({ id: order.user_id }, { include: { orders: { where: { status: "completed" } } } });
          assert(user !== undefined && user!.orders!.every((o) => o.status === "completed"), "All orders should be completed");
        },
      },
      {
        name: "include with limit paginates relations",
        fn: async () => {
          const loaded = await Category.first({ id: categories[0].id }, { include: { products: { limit: 2 } } });
          assert(loaded !== undefined && loaded!.products!.length <= 2, "Should have <= 2 products");
        },
      },
      {
        name: "nested include loads 3 levels",
        fn: async () => {
          const loaded = await Category.first(
            { id: categories[0].id },
            { include: { products: { include: { owner: { include: { orders: true } } } } } }
          );
          assert(loaded !== undefined && Array.isArray(loaded!.products), "Products should be loaded");
          if (loaded!.products!.length > 0 && loaded!.products![0].owner) {
            assert(Array.isArray(loaded!.products![0].owner.orders), "3rd level should be loaded");
          }
        },
      },
      {
        name: "multiple includes load several relations",
        fn: async () => {
          const loaded = await Product.first({ id: products[0].id }, { include: { category: true, owner: true } });
          assert(loaded !== undefined && loaded!.category !== undefined && loaded!.owner !== undefined, "Both relations loaded");
        },
      },

      // =========================================================================
      // VALIDATOR PIPELINES
      // =========================================================================
      {
        name: "@Default + @Validate: default passes validation",
        fn: async () => {
          const model = new ValidatorModel({ transformed: "test", absolute: 5, metadata: {}, multi_validated: 50, renamed: "x" } as any);
          assert(model.with_default === 5, "Default should be applied");
        },
      },
      {
        name: "@Mutate → @Validate: transform then validate",
        fn: async () => {
          const model = new ValidatorModel({ transformed: "  ABC  ", absolute: 5, metadata: {}, multi_validated: 50, renamed: "x" } as any);
          assert(model.transformed === "abc", "Should trim and lowercase");
        },
      },
      {
        name: "@Mutate → @Validate: rejects invalid after transform",
        fn: async () => {
          await assert_throws(
            () => ValidatorModel.create({ transformed: "  AB  ", absolute: 5, metadata: {}, multi_validated: 50, renamed: "x" } as any),
            "Min 3 chars"
          );
        },
      },
      {
        name: "@NotNull + @Mutate + @Validate: full pipeline",
        fn: async () => {
          const model = await ValidatorModel.create({ transformed: "test", absolute: -500, metadata: {}, multi_validated: 50, renamed: "x" } as any);
          assert(model.absolute === 500, "Should apply Math.abs");
        },
      },
      {
        name: "@NotNull rejects null in pipeline",
        fn: async () => {
          await assert_throws(
            () => ValidatorModel.create({ transformed: "test", absolute: null, metadata: {}, multi_validated: 50, renamed: "x" } as any),
            "Required"
          );
        },
      },
      {
        name: "@Validate array: all validators must pass",
        fn: async () => {
          await assert_throws(
            () => ValidatorModel.create({ transformed: "test", absolute: 5, metadata: {}, multi_validated: -5, renamed: "x" } as any),
            "Must be positive"
          );
          await assert_throws(
            () => ValidatorModel.create({ transformed: "test", absolute: 5, metadata: {}, multi_validated: 150, renamed: "x" } as any),
            "Must be < 100"
          );
        },
      },
      {
        name: "@Name renames column in DB",
        fn: async () => {
          const model = await ValidatorModel.create({ transformed: "test", absolute: 5, metadata: {}, multi_validated: 50, renamed: "value" } as any);
          const loaded = await ValidatorModel.first({ id: model.id });
          assert(loaded !== undefined && loaded!.renamed === "value", "Renamed field should work");
        },
      },
      {
        name: "@Serialize transforms to/from DB",
        fn: async () => {
          const data = { key: "value", nested: { a: 1 } };
          const model = await ValidatorModel.create({ transformed: "test", absolute: 5, metadata: data, multi_validated: 50, renamed: "x" } as any);
          const loaded = await ValidatorModel.first({ id: model.id });
          assert(loaded !== undefined && loaded!.metadata.key === "value", "Serialized data should be restored");
        },
      },

      // =========================================================================
      // EDGE CASES
      // =========================================================================
      {
        name: "@Validate accepts boundary value (exactly 3 chars)",
        fn: async () => {
          const user = await User.create({ name: "ABC", email: "abc@test.com" } as any);
          assert(user.name === "ABC", "Boundary value should be accepted");
        },
      },
      {
        name: "first returns undefined for non-existent record",
        fn: async () => {
          const result = await User.first({ id: "non-existent-xyz" });
          assert(result === undefined, "Should return undefined");
        },
      },
      {
        name: "where returns empty array for no matches",
        fn: async () => {
          const results = await User.where({ id: "non-existent-xyz" });
          assert(results.length === 0, "Should return empty array");
        },
      },
      {
        name: "partial update preserves other fields",
        fn: async () => {
          const user = users[3];
          const original_email = user.email;
          user.name = "Partially Updated";
          await user.save();
          const loaded = await User.first({ id: user.id });
          assert(loaded !== undefined && loaded!.name === "Partially Updated" && loaded!.email === original_email, "Email should be preserved");
        },
      },
      {
        name: "include with no matches returns empty results",
        fn: async () => {
          const results = await User.where({ id: "non-existent-xyz" }, { include: { orders: true } });
          assert(results.length === 0, "Should return empty array");
        },
      },
    ];

    // =========================================================================
    // RUN TESTS
    // =========================================================================

    for (const test of tests) {
      try {
        await test.fn();
        console.log(`  ✓ ${test.name}`);
        passed++;
      } catch (error: any) {
        console.log(`  ✗ ${test.name}`);
        failures.push(`${test.name}: ${error.message}`);
        failed++;
      }
    }
  } catch (error: any) {
    console.error(`\nFatal error: ${error.message}`);
    process.exit(1);
  }

  const duration = ((performance.now() - start) / 1000).toFixed(2);
  console.log(`\n${passed + failed} tests | ${passed} passed | ${failed} failed | ${duration}s\n`);

  if (failures.length > 0) {
    console.log("Failures:");
    failures.forEach((f) => console.log(`  ${f}`));
  }

  process.exit(failed > 0 ? 1 : 0);
})();
