/**
 * @file load_seed.ts
 * @description Carga archivos JSON de seed en DynamoDB con inserción por lotes
 */

import { readFile } from "fs/promises";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { requireClient } from "../src/core/client";

interface SeedFile {
  schema_version: string;
  count: number;
  data: Record<string, any>[];
}

async function load_file(filepath: string, table_name: string): Promise<number> {
  const file_content = await readFile(filepath, "utf-8");
  const json: SeedFile = JSON.parse(file_content);
  const client = requireClient();

  console.log(`  Total records: ${json.count}`);

  for (let i = 0; i < json.data.length; i += 25) {
    const chunk = json.data.slice(i, i + 25);

    await Promise.all(
      chunk.map((item) =>
        client.send(
          new PutItemCommand({
            TableName: table_name,
            Item: marshall(item, { removeUndefinedValues: true }),
          })
        )
      )
    );

    if ((i + 25) % 1000 === 0 || i + 25 >= json.data.length) {
      const loaded = Math.min(i + 25, json.data.length);
      console.log(`  Loaded ${loaded}/${json.count} records...`);
    }
  }

  return json.count;
}

export async function load_all(): Promise<void> {
  console.log("📦 Loading seed data into DynamoDB...\n");
  const start_time = Date.now();

  const loads = [
    { file: "/tmp/dynamite_seed_users.json", table: "test_users" },
    { file: "/tmp/dynamite_seed_categories.json", table: "test_categories" },
    { file: "/tmp/dynamite_seed_roles.json", table: "test_roles" },
    { file: "/tmp/dynamite_seed_products.json", table: "test_products" },
    { file: "/tmp/dynamite_seed_orders.json", table: "test_orders" },
  ];

  for (const { file, table } of loads) {
    console.log(`\n📄 Loading ${file}...`);
    const count = await load_file(file, table);
    console.log(`✅ Loaded ${count} records into ${table}`);
  }

  const elapsed = ((Date.now() - start_time) / 1000).toFixed(2);
  console.log(`\n✅ Seed loading complete in ${elapsed}s`);
}

if (require.main === module) {
  load_all().catch((error) => {
    console.error("❌ Error loading seed data:", error);
    process.exit(1);
  });
}
