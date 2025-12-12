/**
 * @file generate_seed.ts
 * @description Genera archivos JSON con datos de seed determinísticos para pruebas
 */

import { writeFile } from "fs/promises";

interface Config {
  users: number;
  posts_per_user: number;
  comments_per_post: number;
  categories: number;
  products: number;
  orders: number;
  roles: number;
}

const DEFAULT_CONFIG: Config = {
  users: 100,
  posts_per_user: 0,
  comments_per_post: 0,
  categories: 5,
  products: 20,
  orders: 15,
  roles: 3,
};

const generate_user_id = (index: number): string =>
  `user-${String(index + 1).padStart(6, "0")}`;

const generate_post_id = (index: number): string =>
  `post-${String(index + 1).padStart(6, "0")}`;

const generate_comment_id = (index: number): string =>
  `comment-${String(index + 1).padStart(6, "0")}`;

const generate_category_id = (index: number): string =>
  `cat-${String(index + 1).padStart(6, "0")}`;

const generate_product_id = (index: number): string =>
  `prod-${String(index + 1).padStart(6, "0")}`;

const generate_order_id = (index: number): string =>
  `order-${String(index + 1).padStart(6, "0")}`;

const generate_role_id = (index: number): string =>
  `role-${String(index + 1).padStart(6, "0")}`;

const generate_timestamp = (base_date: Date, offset_seconds: number): string =>
  new Date(base_date.getTime() + offset_seconds * 1000).toISOString();

async function generate_users(config: Config): Promise<void> {
  console.log(`📝 Generating ${config.users} users...`);

  const base_date = new Date("2025-01-28T10:00:00.000Z");
  const users = Array.from({ length: config.users }, (_, i) => ({
    id: generate_user_id(i),
    name: `User${i}`,
    email: `user${i}@test.com`,
    age: 20 + (i % 50),
    created_at: generate_timestamp(base_date, i),
    updated_at: generate_timestamp(base_date, i),
  }));

  const json = {
    schema_version: "1.0.0",
    count: config.users,
    data: users,
  };

  await writeFile(
    "/tmp/dynamite_seed_users.json",
    JSON.stringify(json, null, 2),
    "utf-8"
  );

  console.log(`✅ Generated ${config.users} users → /tmp/dynamite_seed_users.json`);
}

async function generate_categories(config: Config): Promise<void> {
  console.log(`📝 Generating ${config.categories} categories...`);

  const base_date = new Date("2025-01-28T10:00:00.000Z");
  const categories = Array.from({ length: config.categories }, (_, i) => ({
    id: generate_category_id(i),
    name: `category${i}`,
    description: `Test category ${i}`,
    created_at: generate_timestamp(base_date, i),
  }));

  const json = {
    schema_version: "1.0.0",
    count: config.categories,
    data: categories,
  };

  await writeFile(
    "/tmp/dynamite_seed_categories.json",
    JSON.stringify(json, null, 2),
    "utf-8"
  );

  console.log(`✅ Generated ${config.categories} categories → /tmp/dynamite_seed_categories.json`);
}

async function generate_roles(config: Config): Promise<void> {
  console.log(`📝 Generating ${config.roles} roles...`);

  const base_date = new Date("2025-01-28T10:00:00.000Z");
  const roles = Array.from({ length: config.roles }, (_, i) => ({
    id: generate_role_id(i),
    name: `Role${i}`,
    created_at: generate_timestamp(base_date, i),
  }));

  const json = {
    schema_version: "1.0.0",
    count: config.roles,
    data: roles,
  };

  await writeFile(
    "/tmp/dynamite_seed_roles.json",
    JSON.stringify(json, null, 2),
    "utf-8"
  );

  console.log(`✅ Generated ${config.roles} roles → /tmp/dynamite_seed_roles.json`);
}

async function generate_products(config: Config): Promise<void> {
  console.log(`📝 Generating ${config.products} products...`);

  const base_date = new Date("2025-01-28T10:00:00.000Z");
  const products = Array.from({ length: config.products }, (_, i) => ({
    id: generate_product_id(i),
    name: `Product${i}`,
    price: 100 + (i * 10),
    stock: 50,
    category_id: generate_category_id(i % config.categories),
    owner_id: generate_user_id(i % 10),
    created_at: generate_timestamp(base_date, i),
    updated_at: generate_timestamp(base_date, i),
  }));

  const json = {
    schema_version: "1.0.0",
    count: config.products,
    data: products,
  };

  await writeFile(
    "/tmp/dynamite_seed_products.json",
    JSON.stringify(json, null, 2),
    "utf-8"
  );

  console.log(`✅ Generated ${config.products} products → /tmp/dynamite_seed_products.json`);
}

async function generate_orders(config: Config): Promise<void> {
  console.log(`📝 Generating ${config.orders} orders...`);

  const base_date = new Date("2025-01-28T10:00:00.000Z");
  const statuses = ["pending", "completed", "cancelled"];

  const orders = Array.from({ length: config.orders }, (_, i) => ({
    id: generate_order_id(i),
    user_id: generate_user_id(i % 10),
    total: 100 + (i * 50),
    status: statuses[i % 3],
    created_at: generate_timestamp(base_date, i),
    updated_at: generate_timestamp(base_date, i),
  }));

  const json = {
    schema_version: "1.0.0",
    count: config.orders,
    data: orders,
  };

  await writeFile(
    "/tmp/dynamite_seed_orders.json",
    JSON.stringify(json, null, 2),
    "utf-8"
  );

  console.log(`✅ Generated ${config.orders} orders → /tmp/dynamite_seed_orders.json`);
}

async function generate_posts(config: Config): Promise<void> {
  const total_posts = config.users * config.posts_per_user;
  console.log(`📝 Generating ${total_posts} posts (${config.posts_per_user} per user)...`);

  const base_date = new Date("2025-01-28T10:00:01.000Z");
  const posts = [];

  for (let i = 0; i < total_posts; i++) {
    const user_index = Math.floor(i / config.posts_per_user);
    posts.push({
      id: generate_post_id(i),
      user_id: generate_user_id(user_index),
      title: `Post ${i} by User${user_index}`,
      content: `Content for post ${i}...`,
      published: i % 3 !== 0,
      created_at: generate_timestamp(base_date, i),
      updated_at: generate_timestamp(base_date, i),
    });

    if ((i + 1) % 1000 === 0) {
      console.log(`  Progress: ${i + 1}/${total_posts} posts...`);
    }
  }

  const json = {
    schema_version: "1.0.0",
    count: total_posts,
    data: posts,
  };

  await writeFile(
    "/tmp/dynamite_seed_posts.json",
    JSON.stringify(json, null, 2),
    "utf-8"
  );

  console.log(`✅ Generated ${total_posts} posts → /tmp/dynamite_seed_posts.json`);
}

async function generate_comments(config: Config): Promise<void> {
  const total_posts = config.users * config.posts_per_user;
  const total_comments = total_posts * config.comments_per_post;

  console.log(`📝 Generating ${total_comments} comments (${config.comments_per_post} per post)...`);

  const base_date = new Date("2025-01-28T10:00:02.000Z");
  const comments = [];

  for (let i = 0; i < total_comments; i++) {
    const post_index = Math.floor(i / config.comments_per_post);
    const commenter_index = (i + 1) % config.users;

    comments.push({
      id: generate_comment_id(i),
      post_id: generate_post_id(post_index),
      user_id: generate_user_id(commenter_index),
      content: `Comment ${i} on post-${String(post_index + 1).padStart(6, "0")}`,
      created_at: generate_timestamp(base_date, i),
      updated_at: generate_timestamp(base_date, i),
    });

    if ((i + 1) % 10000 === 0) {
      console.log(`  Progress: ${i + 1}/${total_comments} comments...`);
    }
  }

  const json = {
    schema_version: "1.0.0",
    count: total_comments,
    data: comments,
  };

  await writeFile(
    "/tmp/dynamite_seed_comments.json",
    JSON.stringify(json, null, 2),
    "utf-8"
  );

  console.log(`✅ Generated ${total_comments} comments → /tmp/dynamite_seed_comments.json`);
}

async function generate_all(): Promise<void> {
  console.log("🌱 Generating seed data...\n");
  const start_time = Date.now();

  const config = DEFAULT_CONFIG;

  console.log("Phase 1: Base entities (parallel)");
  await Promise.all([
    generate_users(config),
    generate_categories(config),
    generate_roles(config),
  ]);

  console.log("\nPhase 2: Dependent entities (parallel)");
  await Promise.all([
    generate_products(config),
    generate_orders(config),
  ]);

  const elapsed = ((Date.now() - start_time) / 1000).toFixed(2);
  console.log(`\n✅ Seed generation complete in ${elapsed}s`);
  console.log("\nGenerated files:");
  console.log("  - /tmp/dynamite_seed_users.json");
  console.log("  - /tmp/dynamite_seed_categories.json");
  console.log("  - /tmp/dynamite_seed_roles.json");
  console.log("  - /tmp/dynamite_seed_products.json");
  console.log("  - /tmp/dynamite_seed_orders.json");
}

generate_all().catch((error) => {
  console.error("❌ Error generating seed data:", error);
  process.exit(1);
});
