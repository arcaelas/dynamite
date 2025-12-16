/**
 * @file client.ts
 * @description Centralized Dynamite client with multi-client support and table sync
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import {
  CreateTableCommand,
  DynamoDBClient,
  DynamoDBClientConfig,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { SCHEMA } from "./decorator";

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
   * Connect client and synchronize all declared tables and their GSIs (upsert pattern)
   */
  async connect(): Promise<void> {
    if (this.synced && this.connected) return;

    // Set global client for Table operations
    setGlobalClient(this.client);
    this.connected = true;

    // Crear tablas principales con GSIs
    await Promise.all(
      this.tables.map((table) => this.createTableWithGSI(table))
    );

    // Crear pivot tables para relaciones ManyToMany
    await this.createPivotTables();

    this.synced = true;
  }

  /**
   * Auto-crear pivot tables para relaciones ManyToMany
   */
  private async createPivotTables(): Promise<void> {
    const pivot_tables = new Map<
      string,
      { foreignKey: string; relatedKey: string }
    >();

    // Recolectar nombres de pivot tables con metadata
    for (const table_class of this.tables) {
      const schema = (table_class as any)[SCHEMA];
      if (!schema) continue;

      for (const col_name in schema.columns) {
        const col = schema.columns[col_name];
        const relation = col.store?.relation;

        if (relation?.type === "ManyToMany" && relation.pivotTable) {
          pivot_tables.set(relation.pivotTable, {
            foreignKey: relation.foreignKey || "source_id",
            relatedKey: relation.relatedKey || "target_id",
          });
        }
      }
    }

    // Crear cada pivot table con GSIs usando los nombres de columna correctos
    const { CreateTableCommand } = await import("@aws-sdk/client-dynamodb");

    await Promise.all(
      Array.from(pivot_tables.entries()).map(async ([pivot_name, metadata]) => {
        const { foreignKey, relatedKey } = metadata;

        try {
          await this.client.send(
            new CreateTableCommand({
              TableName: pivot_name,
              KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
              AttributeDefinitions: [
                { AttributeName: "id", AttributeType: "S" },
                { AttributeName: foreignKey, AttributeType: "S" },
                { AttributeName: relatedKey, AttributeType: "S" },
              ],
              GlobalSecondaryIndexes: [
                {
                  IndexName: `${foreignKey}_index`,
                  KeySchema: [{ AttributeName: foreignKey, KeyType: "HASH" }],
                  Projection: { ProjectionType: "ALL" },
                  ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5,
                  },
                },
                {
                  IndexName: `${relatedKey}_index`,
                  KeySchema: [{ AttributeName: relatedKey, KeyType: "HASH" }],
                  Projection: { ProjectionType: "ALL" },
                  ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5,
                  },
                },
              ],
              ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5,
              },
            })
          );
          console.log(`✓ Pivot table '${pivot_name}' created`);
        } catch (error: any) {
          if (error.name === "ResourceInUseException") {
            console.log(`✓ Pivot table '${pivot_name}' already exists`);
          } else {
            throw error;
          }
        }
      })
    );
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

  /**
   * Create table with automatic GSI detection and creation
   * @param ctor Table class constructor
   */
  private async createTableWithGSI(
    ctor: new (...args: any[]) => any
  ): Promise<void> {
    const meta: any = (ctor as any)[SCHEMA];
    if (!meta)
      throw new Error(`Class ${ctor.name} not registered. Use decorators.`);

    const cols = Object.values(meta.columns);
    const pk = cols.find((c: any) => c.store?.index);
    if (!pk) throw new Error(`PartitionKey missing in ${ctor.name}`);

    const sk = cols.find((c: any) => c.store?.indexSort);
    const attr = new Map<string, "S" | "N" | "B">();
    attr.set((pk as any).name || "id", "S");
    if (sk) attr.set((sk as any).name || "id", "S");

    // Temporalmente deshabilitamos la creación automática de GSI hasta implementar relaciones
    const gsiDefinitions: any[] = [];

    const schema: Array<{ AttributeName: string; KeyType: "HASH" | "RANGE" }> =
      [{ AttributeName: (pk as any).name || "id", KeyType: "HASH" }];
    if (sk && (sk as any).name !== (pk as any).name)
      schema.push({
        AttributeName: (sk as any).name || "id",
        KeyType: "RANGE",
      });

    try {
      await this.client.send(
        new CreateTableCommand({
          TableName: meta.name,
          BillingMode: "PAY_PER_REQUEST",
          AttributeDefinitions: [...attr].map(
            ([AttributeName, AttributeType]) => ({
              AttributeName,
              AttributeType,
            })
          ),
          KeySchema: schema,
          ...(gsiDefinitions.length > 0 && {
            GlobalSecondaryIndexes: gsiDefinitions,
          }),
        })
      );
    } catch (error: any) {
      if (error.name !== "ResourceInUseException") throw error;
    }
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
 * Contexto de transacción para agrupar operaciones atómicas.
 * Máximo 25 operaciones por transacción (límite DynamoDB).
 */
export class TransactionContext {
  private operations: TransactionItem[] = [];
  private client: DynamoDBClient;

  constructor(client: DynamoDBClient) {
    this.client = client;
  }

  /**
   * Agregar operación Put a la transacción
   */
  addPut(table_name: string, item: Record<string, any>): void {
    this.operations.push({
      Put: {
        TableName: table_name,
        Item: marshall(item, { removeUndefinedValues: true }),
      },
    });
  }

  /**
   * Agregar operación Delete a la transacción
   */
  addDelete(table_name: string, key: Record<string, any>): void {
    this.operations.push({
      Delete: {
        TableName: table_name,
        Key: marshall(key),
      },
    });
  }

  /**
   * Confirmar todas las operaciones de la transacción.
   * Si alguna falla, todas se revierten.
   */
  async commit(): Promise<void> {
    if (this.operations.length === 0) return;

    if (this.operations.length > 25) {
      throw new Error(
        `Transacción excede el límite de 25 operaciones (tiene ${this.operations.length})`
      );
    }

    await this.client.send(
      new TransactWriteItemsCommand({
        TransactItems: this.operations,
      })
    );
  }
}

type TransactionItem =
  | { Put: { TableName: string; Item: Record<string, any> } }
  | { Delete: { TableName: string; Key: Record<string, any> } };
