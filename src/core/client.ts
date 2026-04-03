/**
 * @file client.ts
 * @description Centralized Dynamite client with multi-client support and table sync
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  DynamoDBClientConfig,
  TransactWriteItemsCommand,
  UpdateTableCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { SCHEMA } from "./decorator";
import type { Schema } from "./decorator";

/**
 * Configuration for Dynamite client initialization
 */
export interface DynamiteConfig extends DynamoDBClientConfig {
  tables: Array<new (...args: any[]) => any>;
}

/**
 * Centralized Dynamite client for managing DynamoDB connections and table synchronization
 */
export class Dynamite {
  private client: DynamoDBClient;
  private tables: Array<new (...args: any[]) => any>;
  private connected = false;
  private synced = false;

  /**
   * Initialize Dynamite client with configuration
   * @param config Dynamite client configuration
   */
  constructor(config: DynamiteConfig) {
    const { tables, ...options } = config;
    this.client = new DynamoDBClient({
      ...options,
    });
    this.tables = tables;
  }

  /**
   * @description Configure the DynamoDB client. Does not create tables or GSIs -- use sync() for that.
   * @description Configura el cliente DynamoDB. No crea tablas ni GSIs -- usar sync() para eso.
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    setGlobalClient(this.client);
    this.connected = true;

    // Computar GSIs esperados desde los schemas (sin llamadas API)
    const pk_by_table = new Map<string, string>();
    for (const tc of this.tables) {
      const s: Schema = (tc as any)[SCHEMA];
      if (!s) continue;
      const pk_col = Object.values(s.columns).find(c => c.store.index || c.store.primaryKey);
      pk_by_table.set(s.name, pk_col?.name ?? 'id');
    }

    for (const tc of this.tables) {
      const s: Schema = (tc as any)[SCHEMA];
      if (!s) continue;
      for (const col_name in s.columns) {
        const rel = s.columns[col_name].store.relation;
        if (!rel || (rel.type !== 'HasMany' && rel.type !== 'HasOne')) continue;
        const related: Schema | undefined = rel.model()?.[SCHEMA];
        if (!related) continue;
        const related_pk = pk_by_table.get(related.name);
        if (rel.foreignKey !== related_pk) {
          related.gsis.add(rel.foreignKey);
        }
      }
    }
  }

  /**
   * @description Synchronize all tables, GSIs and pivot tables with DynamoDB.
   * @description Sincroniza tablas, GSIs y pivot tables con DynamoDB.
   */
  async sync(): Promise<void> {
    if (!this.connected) throw new Error('Call connect() before sync()');
    if (this.synced) return;

    // Phase 1: Collect requirements
    const tables = new Map<string, { pk: string; sk: string | null; gsis: Set<string> }>();
    const pivots = new Map<string, { foreignKey: string; relatedKey: string }>();

    for (const table_class of this.tables) {
      const schema: Schema = (table_class as any)[SCHEMA];
      if (!schema) throw new Error(`Class ${table_class.name} not registered. Use decorators.`);

      const cols = Object.values(schema.columns);
      const pk = cols.find(c => c.store.index || c.store.primaryKey);
      if (!pk) throw new Error(`PartitionKey missing in ${table_class.name}`);

      const sk = cols.find(c => c.store.indexSort) ?? null;
      tables.set(schema.name, { pk: pk.name, sk: sk?.name ?? null, gsis: new Set() });
    }

    for (const table_class of this.tables) {
      const schema: Schema = (table_class as any)[SCHEMA];

      for (const col_name in schema.columns) {
        const relation = schema.columns[col_name].store.relation;
        if (!relation) continue;

        if (relation.type === 'HasMany' || relation.type === 'HasOne') {
          const related_schema: Schema | undefined = relation.model()?.[SCHEMA];
          if (related_schema && tables.has(related_schema.name)) {
            const entry = tables.get(related_schema.name)!;
            if (relation.foreignKey !== entry.pk) {
              entry.gsis.add(relation.foreignKey);
            }
          }
        }

        if (relation.type === 'ManyToMany' && relation.pivotTable) {
          pivots.set(relation.pivotTable, {
            foreignKey: relation.foreignKey,
            relatedKey: relation.relatedKey!,
          });
        }
      }
    }

    // Phase 2: Describe all tables + pivots in parallel
    const all_table_names = [...tables.keys()];
    const all_pivot_names = [...pivots.keys()];
    const all_names = [...all_table_names, ...all_pivot_names];

    const descriptions = await Promise.all(
      all_names.map(async (name) => {
        try {
          const result = await this.client.send(new DescribeTableCommand({ TableName: name }));
          const existing_gsis = new Set(
            (result.Table?.GlobalSecondaryIndexes ?? []).map(g => g.IndexName!)
          );
          return { name, exists: true, existing_gsis } as const;
        } catch (e: any) {
          if (e.name === 'ResourceNotFoundException') return { name, exists: false, existing_gsis: new Set<string>() } as const;
          throw e;
        }
      })
    );

    const described = new Map(descriptions.map(d => [d.name, d]));

    // Phase 3: Create missing tables in parallel
    const to_create: Promise<void>[] = [];

    for (const [name, entry] of tables) {
      const desc = described.get(name)!;
      if (desc.exists) continue;

      const attrs = new Map<string, 'S'>([[entry.pk, 'S']]);
      if (entry.sk) attrs.set(entry.sk, 'S');
      for (const gsi_field of entry.gsis) attrs.set(gsi_field, 'S');

      const key_schema: { AttributeName: string; KeyType: 'HASH' | 'RANGE' }[] = [
        { AttributeName: entry.pk, KeyType: 'HASH' },
      ];
      if (entry.sk) key_schema.push({ AttributeName: entry.sk, KeyType: 'RANGE' });

      const gsi_defs = [...entry.gsis].map(field => ({
        IndexName: `${field}_index`,
        KeySchema: [{ AttributeName: field, KeyType: 'HASH' as const }],
        Projection: { ProjectionType: 'ALL' as const },
      }));

      to_create.push(
        this.client.send(new CreateTableCommand({
          TableName: name,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [...attrs].map(([AttributeName, AttributeType]) => ({ AttributeName, AttributeType })),
          KeySchema: key_schema,
          ...(gsi_defs.length > 0 && { GlobalSecondaryIndexes: gsi_defs }),
        })).then(() => {})
      );
    }

    for (const [name, meta] of pivots) {
      const desc = described.get(name)!;
      if (desc.exists) continue;

      to_create.push(
        this.client.send(new CreateTableCommand({
          TableName: name,
          BillingMode: 'PAY_PER_REQUEST',
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [
            { AttributeName: 'id', AttributeType: 'S' },
            { AttributeName: meta.foreignKey, AttributeType: 'S' },
            { AttributeName: meta.relatedKey, AttributeType: 'S' },
          ],
          GlobalSecondaryIndexes: [
            { IndexName: `${meta.foreignKey}_index`, KeySchema: [{ AttributeName: meta.foreignKey, KeyType: 'HASH' }], Projection: { ProjectionType: 'ALL' } },
            { IndexName: `${meta.relatedKey}_index`, KeySchema: [{ AttributeName: meta.relatedKey, KeyType: 'HASH' }], Projection: { ProjectionType: 'ALL' } },
          ],
        })).then(() => {})
      );
    }

    await Promise.all(to_create);

    // Phase 4: Add missing GSIs to existing tables (round-robin, parallel across tables)
    const pending_gsis = new Map<string, string[]>();

    for (const [name, entry] of tables) {
      const desc = described.get(name)!;
      if (!desc.exists) continue;

      const missing = [...entry.gsis].filter(field => !desc.existing_gsis.has(`${field}_index`));
      if (missing.length > 0) pending_gsis.set(name, missing);
    }

    for (const [name, meta] of pivots) {
      const desc = described.get(name)!;
      if (!desc.exists) continue;

      const expected = [`${meta.foreignKey}_index`, `${meta.relatedKey}_index`];
      const missing_fields: string[] = [];
      if (!desc.existing_gsis.has(expected[0])) missing_fields.push(meta.foreignKey);
      if (!desc.existing_gsis.has(expected[1])) missing_fields.push(meta.relatedKey);
      if (missing_fields.length > 0) pending_gsis.set(name, missing_fields);
    }

    while (pending_gsis.size > 0) {
      const round: Promise<void>[] = [];

      for (const [table_name, fields] of pending_gsis) {
        const field = fields.shift()!;
        if (fields.length === 0) pending_gsis.delete(table_name);

        round.push(
          this.client.send(new UpdateTableCommand({
            TableName: table_name,
            AttributeDefinitions: [{ AttributeName: field, AttributeType: 'S' }],
            GlobalSecondaryIndexUpdates: [{
              Create: {
                IndexName: `${field}_index`,
                KeySchema: [{ AttributeName: field, KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' },
              },
            }],
          })).then(() => {})
        );
      }

      await Promise.all(round);

      // Wait for all GSIs in this round to become ACTIVE
      const tables_in_round = round.length;
      if (tables_in_round > 0) {
        const active_checks = [...pending_gsis.keys()];
        // Also check tables that just had their last GSI added
        for (const [table_name] of tables) {
          if (!pending_gsis.has(table_name)) active_checks.push(table_name);
        }
        for (const [pivot_name] of pivots) {
          if (!pending_gsis.has(pivot_name)) active_checks.push(pivot_name);
        }

        await this.waitForActiveGSIs([...new Set(active_checks)]);
      }
    }

    this.synced = true;
  }

  /**
   * @description Poll DescribeTable until all GSIs on the given tables are ACTIVE.
   * @description Polling de DescribeTable hasta que todos los GSIs de las tablas dadas estén ACTIVE.
   */
  private async waitForActiveGSIs(table_names: string[]): Promise<void> {
    const pending = new Set(table_names);

    while (pending.size > 0) {
      await new Promise(r => setTimeout(r, 3000));

      const checks = await Promise.all(
        [...pending].map(async (name) => {
          const result = await this.client.send(new DescribeTableCommand({ TableName: name }));
          const all_active = (result.Table?.GlobalSecondaryIndexes ?? [])
            .every(g => g.IndexStatus === 'ACTIVE');
          return { name, all_active };
        })
      );

      for (const { name, all_active } of checks) {
        if (all_active) pending.delete(name);
      }
    }
  }

  /**
   * Ejecutar operaciones en una transacción atómica.
   * Si cualquier operación falla, todas se revierten automáticamente.
   *
   * @param callback Función que recibe el contexto de transacción
   * @returns Resultado del callback
   *
   * @example
   * await dynamite.tx(async (tx) => {
   *   const user = await User.create({ name: "Juan" }, tx);
   *   await Order.create({ user_id: user.id, total: 100 }, tx);
   * });
   */
  async tx<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R> {
    const ctx = new TransactionContext(this.client);
    const result = await callback(ctx);
    await ctx.commit();
    return result;
  }

}

let globalClient: DynamoDBClient | undefined;

/**
 * Set global client for Table class operations
 * @param client DynamoDB client instance
 */
export const setGlobalClient = (client: DynamoDBClient): void => {
  globalClient = client;
};

/**
 * Get global client for Table class operations
 */
export const getGlobalClient = (): DynamoDBClient => {
  if (!globalClient)
    throw new Error(
      "No global DynamoDB client set. Call setGlobalClient() first."
    );
  return globalClient;
};

/**
 * Check if global client is available
 */
export const hasGlobalClient = (): boolean => {
  return globalClient !== undefined;
};

/**
 * Require global client for Table operations (throws if not available)
 */
export const requireClient = (): DynamoDBClient => {
  if (!globalClient) {
    throw new Error(
      "DynamoDB client no configurado. Use Dynamite.connect() primero."
    );
  }
  return globalClient;
};

/**
 * @description Transaction context for grouping atomic operations. Max 100 operations (auto-chunked in batches of 25).
 * @description Contexto de transacción para operaciones atómicas. Máximo 100 operaciones (auto-divididas en lotes de 25).
 */
export class TransactionContext {
  private operations: TransactionItem[] = [];
  private after_commit: (() => void)[] = [];
  private client: DynamoDBClient;

  constructor(client: DynamoDBClient) {
    this.client = client;
  }

  addPut(table_name: string, item: Record<string, any>, condition?: { expression: string; names: Record<string, string> }): void {
    this.guard();
    const op: any = {
      Put: {
        TableName: table_name,
        Item: marshall(item, { removeUndefinedValues: true }),
      },
    };
    if (condition) {
      op.Put.ConditionExpression = condition.expression;
      op.Put.ExpressionAttributeNames = condition.names;
    }
    this.operations.push(op);
  }

  addDelete(table_name: string, key: Record<string, any>): void {
    this.guard();
    this.operations.push({
      Delete: {
        TableName: table_name,
        Key: marshall(key),
      },
    });
  }

  addUpdate(table_name: string, key: Record<string, any>, expression: string, names: Record<string, string>, values: Record<string, any>): void {
    this.guard();
    this.operations.push({
      Update: {
        TableName: table_name,
        Key: marshall(key),
        UpdateExpression: expression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: marshall(values, { removeUndefinedValues: true }),
      },
    });
  }

  /**
   * @description Register a callback to run after successful commit.
   * @description Registra un callback que se ejecuta después de un commit exitoso.
   */
  onCommit(fn: () => void): void {
    this.after_commit.push(fn);
  }

  async commit(): Promise<void> {
    if (this.operations.length === 0) return;

    // DynamoDB limit: 25 per TransactWriteItems. Chunk if needed.
    for (let i = 0; i < this.operations.length; i += 25) {
      const chunk = this.operations.slice(i, i + 25);
      await this.client.send(
        new TransactWriteItemsCommand({ TransactItems: chunk })
      );
    }

    for (const fn of this.after_commit) fn();
  }

  private guard(): void {
    if (this.operations.length >= 100) {
      throw new Error(`Transaction exceeds 100 operations limit (has ${this.operations.length})`);
    }
  }
}

type TransactionItem =
  | { Put: { TableName: string; Item: Record<string, any> } }
  | { Delete: { TableName: string; Key: Record<string, any> } }
  | { Update: { TableName: string; Key: Record<string, any>; UpdateExpression: string; ExpressionAttributeNames: Record<string, string>; ExpressionAttributeValues: Record<string, any> } };
