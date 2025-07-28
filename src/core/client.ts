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
} from "@aws-sdk/client-dynamodb";
import wrapper from "./wrapper";

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
    const { tables, ...clientConfig } = config;
    this.client = new DynamoDBClient(clientConfig);
    this.tables = tables;
  }

  /**
   * Synchronize all declared tables and their GSIs
   */
  async sync(): Promise<void> {
    if (this.synced && this.connected) return;
    await Promise.all(
      this.tables.map((table) => this.createTableWithGSI(table))
    );
    this.synced = true;
  }

  /**
   * Connect the client for Table operations
   */
  connect(): void {
    if (this.connected) return;
    setGlobalClient(this.client);
    this.connected = true;
  }

  /**
   * Get the underlying DynamoDB client
   */
  getClient(): DynamoDBClient {
    return this.client;
  }

  /**
   * Check if client is connected and tables are synced
   */
  isReady(): boolean {
    return this.connected && this.synced;
  }

  /**
   * Disconnect and cleanup DynamoDB client
   */
  disconnect(): void {
    try {
      this.client.destroy();
      this.connected = false;
      this.synced = false;
      if (globalClient === this.client) globalClient = undefined;
    } catch (error) {
      console.warn("Error during Dynamite disconnect:", error);
    }
  }

  /**
   * Create table with automatic GSI detection and creation
   * @param ctor Table class constructor
   */
  private async createTableWithGSI(ctor: Function): Promise<void> {
    const meta = wrapper.get(ctor);
    if (!meta) throw new Error(`Class ${ctor.name} not registered in wrapper`);

    const cols = [...meta.columns.values()];
    const pk = cols.find((c) => c.index);
    if (!pk) throw new Error(`PartitionKey missing in ${ctor.name}`);

    const sk = cols.find((c) => c.indexSort);
    const attr = new Map<string, "S" | "N" | "B">();
    attr.set(pk.name, "S");
    if (sk) attr.set(sk.name, "S");

    let gsiIndex = 1;
    const gsiDefinitions = [...meta.relations.values()]
      .filter((relation) => relation.type === "hasMany")
      .map((relation) => {
        const { foreignKey } = relation;
        if (!attr.has(foreignKey)) attr.set(foreignKey, "S");
        return {
          IndexName: `GSI${gsiIndex++}_${foreignKey}`,
          KeySchema: [{ AttributeName: foreignKey, KeyType: "HASH" as const }],
          Projection: { ProjectionType: "ALL" as const },
        };
      });

    const schema: Array<{ AttributeName: string; KeyType: "HASH" | "RANGE" }> =
      [{ AttributeName: pk.name, KeyType: "HASH" }];
    if (sk && sk.name !== pk.name)
      schema.push({ AttributeName: sk.name, KeyType: "RANGE" });

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
export const hasGlobalClient = (): boolean => globalClient !== undefined;
