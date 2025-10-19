/**
 * @file transaction-manager.ts
 * @description Transaction simulation and rollback system for DynamoDB
 * @author Miguel Alejandro
 * @fecha 2025-08-31
 */

import {
  DynamoDBClient,
  TransactGetItemsCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import securityValidator from "./security-validator";
import throttleManager from "./throttle-manager";

interface TransactionOperation {
  type: "create" | "update" | "delete";
  tableName: string;
  key: Record<string, any>;
  item?: Record<string, any>;
  conditionExpression?: string;
  rollbackData?: Record<string, any>;
}

interface TransactionSnapshot {
  id: string;
  operations: TransactionOperation[];
  timestamp: number;
  status: "pending" | "committed" | "rolled_back" | "failed";
}

interface TransactionConfig {
  maxOperationsPerTransaction: number;
  snapshotTTL: number;
  enableOptimisticLocking: boolean;
  maxRetries: number;
}

class TransactionManager {
  private static readonly DEFAULT_CONFIG: TransactionConfig = {
    maxOperationsPerTransaction: 25, // DynamoDB limit
    snapshotTTL: 3600000, // 1 hour
    enableOptimisticLocking: true,
    maxRetries: 3,
  };

  private client: DynamoDBClient;
  private config: TransactionConfig;
  private activeTransactions: Map<string, TransactionSnapshot> = new Map();
  private snapshots: Map<string, TransactionSnapshot> = new Map();

  constructor(client: DynamoDBClient, config?: Partial<TransactionConfig>) {
    this.client = client;
    this.config = { ...TransactionManager.DEFAULT_CONFIG, ...config };

    // Cleanup expired snapshots
    setInterval(() => this.cleanupExpiredSnapshots(), 300000); // 5 minutes
  }

  /**
   * Iniciar nueva transacción
   */
  async beginTransaction(operations: TransactionOperation[]): Promise<string> {
    const transactionId = this.generateTransactionId();

    // Validar operaciones
    this.validateOperations(operations);

    // Crear snapshot del estado actual para rollback
    const snapshot = await this.createSnapshot(transactionId, operations);

    this.activeTransactions.set(transactionId, snapshot);
    this.snapshots.set(transactionId, snapshot);

    return transactionId;
  }

  /**
   * Ejecutar transacción usando DynamoDB TransactWrite
   */
  async commitTransaction(transactionId: string): Promise<void> {
    const snapshot = this.activeTransactions.get(transactionId);
    if (!snapshot) {
      throw new TransactionError(`Transaction ${transactionId} not found`);
    }

    try {
      snapshot.status = "pending";

      // Agrupar operaciones en lotes de 25 (límite DynamoDB)
      const batches = this.splitIntoBatches(snapshot.operations);

      for (const batch of batches) {
        await this.executeBatch(batch);
      }

      snapshot.status = "committed";
      this.activeTransactions.delete(transactionId);
    } catch (error: any) {
      snapshot.status = "failed";

      // Intentar rollback automático
      try {
        await this.rollbackTransaction(transactionId);
      } catch (rollbackError) {
        console.error("Rollback failed after commit error:", rollbackError);
      }

      throw new TransactionError(`Transaction commit failed: ${error.message}`);
    }
  }

  /**
   * Rollback manual de transacción
   */
  async rollbackTransaction(transactionId: string): Promise<void> {
    const snapshot = this.snapshots.get(transactionId);
    if (!snapshot) {
      throw new TransactionError(
        `Transaction snapshot ${transactionId} not found`
      );
    }

    try {
      // Crear operaciones inversas para rollback
      const rollbackOps = this.createRollbackOperations(snapshot.operations);

      if (rollbackOps.length > 0) {
        const batches = this.splitIntoBatches(rollbackOps);

        for (const batch of batches) {
          await this.executeBatch(batch);
        }
      }

      snapshot.status = "rolled_back";
      this.activeTransactions.delete(transactionId);
    } catch (error: any) {
      throw new TransactionError(`Rollback failed: ${error.message}`);
    }
  }

  /**
   * Crear snapshot del estado actual para rollback
   */
  private async createSnapshot(
    transactionId: string,
    operations: TransactionOperation[]
  ): Promise<TransactionSnapshot> {
    const snapshot: TransactionSnapshot = {
      id: transactionId,
      operations: [],
      timestamp: Date.now(),
      status: "pending",
    };

    // Para cada operación, guardar el estado actual del item
    for (const op of operations) {
      try {
        const currentItem = await this.getCurrentItemState(
          op.tableName,
          op.key
        );

        const snapshotOp: TransactionOperation = {
          ...op,
          rollbackData: currentItem || undefined, // Estado actual para rollback
        };

        snapshot.operations.push(snapshotOp);
      } catch (error: any) {
        if (error.name !== "ResourceNotFoundException") {
          throw error;
        }
        // Item no existe, sin datos de rollback necesarios
        snapshot.operations.push(op);
      }
    }

    return snapshot;
  }

  /**
   * Obtener estado actual de un item
   */
  private async getCurrentItemState(
    tableName: string,
    key: Record<string, any>
  ): Promise<Record<string, any> | null> {
    const params = {
      TransactItems: [
        {
          Get: {
            TableName: tableName,
            Key: marshall(key),
          },
        },
      ],
    };

    const result = await throttleManager.executeWithRetry(
      () => this.client.send(new TransactGetItemsCommand(params)),
      `GetItem-${tableName}`
    );

    return result.Responses?.[0]?.Item
      ? unmarshall(result.Responses[0].Item)
      : null;
  }

  /**
   * Crear operaciones inversas para rollback
   */
  private createRollbackOperations(
    operations: TransactionOperation[]
  ): TransactionOperation[] {
    const rollbackOps: TransactionOperation[] = [];

    // Procesar en orden inverso
    for (let i = operations.length - 1; i >= 0; i--) {
      const op = operations[i];

      switch (op.type) {
        case "create":
          // Para rollback de create: delete el item
          rollbackOps.push({
            type: "delete",
            tableName: op.tableName,
            key: op.key,
          });
          break;

        case "update":
          if (op.rollbackData) {
            // Para rollback de update: restore estado anterior
            rollbackOps.push({
              type: "update",
              tableName: op.tableName,
              key: op.key,
              item: op.rollbackData,
            });
          }
          break;

        case "delete":
          if (op.rollbackData) {
            // Para rollback de delete: recrear el item
            rollbackOps.push({
              type: "create",
              tableName: op.tableName,
              key: op.key,
              item: op.rollbackData,
            });
          }
          break;
      }
    }

    return rollbackOps;
  }

  /**
   * Ejecutar lote de operaciones usando TransactWrite
   */
  private async executeBatch(
    operations: TransactionOperation[]
  ): Promise<void> {
    const transactItems = operations.map((op) => {
      securityValidator.validateItemSize(op.item || op.key);

      switch (op.type) {
        case "create":
        case "update":
          return {
            Put: {
              TableName: op.tableName,
              Item: marshall(op.item!, { removeUndefinedValues: true }),
              ConditionExpression: op.conditionExpression,
            },
          };

        case "delete":
          return {
            Delete: {
              TableName: op.tableName,
              Key: marshall(op.key),
              ConditionExpression: op.conditionExpression,
            },
          };

        default:
          throw new TransactionError(`Unknown operation type: ${op.type}`);
      }
    });

    const command = new TransactWriteItemsCommand({
      TransactItems: transactItems,
    });

    await throttleManager.executeWithRetry(
      () => this.client.send(command),
      "TransactWrite"
    );
  }

  /**
   * Dividir operaciones en lotes según límites DynamoDB
   */
  private splitIntoBatches(
    operations: TransactionOperation[]
  ): TransactionOperation[][] {
    const batches: TransactionOperation[][] = [];
    const batchSize = this.config.maxOperationsPerTransaction;

    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Validar operaciones antes de transacción
   */
  private validateOperations(operations: TransactionOperation[]): void {
    if (operations.length === 0) {
      throw new TransactionError(
        "Transaction must contain at least one operation"
      );
    }

    if (operations.length > this.config.maxOperationsPerTransaction * 10) {
      throw new TransactionError(`Too many operations: ${operations.length}`);
    }

    for (const op of operations) {
      // Validar estructura de la operación
      if (!op.tableName || !op.key) {
        throw new TransactionError(
          "Invalid operation: missing tableName or key"
        );
      }

      // Validar datos de seguridad
      securityValidator.validateQueryFilters(op.key);

      if (op.item) {
        securityValidator.validateValue(op.item);
      }
    }
  }

  /**
   * Limpiar snapshots expirados
   */
  private cleanupExpiredSnapshots(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, snapshot] of this.snapshots.entries()) {
      if (now - snapshot.timestamp > this.config.snapshotTTL) {
        expired.push(id);
      }
    }

    expired.forEach((id) => {
      this.snapshots.delete(id);
      this.activeTransactions.delete(id);
    });

    if (expired.length > 0) {
      console.log(`Cleaned up ${expired.length} expired transaction snapshots`);
    }
  }

  /**
   * Obtener estado de transacción
   */
  getTransactionStatus(transactionId: string): TransactionSnapshot | null {
    return this.snapshots.get(transactionId) || null;
  }

  /**
   * Listar transacciones activas
   */
  getActiveTransactions(): TransactionSnapshot[] {
    return Array.from(this.activeTransactions.values());
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

class TransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionError";
  }
}

export {
  TransactionConfig,
  TransactionError,
  TransactionManager,
  TransactionOperation,
  TransactionSnapshot,
};
