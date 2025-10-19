/**
 * @file throttle-manager.ts
 * @description AWS DynamoDB throttling and retry management
 * @author Miguel Alejandro
 * @fecha 2025-08-31
 */

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

interface ThrottleStats {
  totalRequests: number;
  throttledRequests: number;
  retriedRequests: number;
  averageLatency: number;
}

class ThrottleManager {
  private static readonly DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 10,
    baseDelay: 100, // 100ms base delay
    maxDelay: 30000, // 30s max delay
    backoffMultiplier: 2, // Exponential backoff
    jitterFactor: 0.1, // 10% jitter
  };

  private config: RetryConfig;
  private stats: ThrottleStats;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private concurrentRequests = 0;
  private maxConcurrentRequests = 25; // DynamoDB default

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...ThrottleManager.DEFAULT_CONFIG, ...config };
    this.stats = {
      totalRequests: 0,
      throttledRequests: 0,
      retriedRequests: 0,
      averageLatency: 0,
    };
  }

  /**
   * Ejecutar operación con retry automático
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = "DynamoDB Operation"
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    this.stats.totalRequests++;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Control de concurrencia
        await this.acquireConcurrencySlot();

        const result = await operation();

        this.releaseConcurrencySlot();
        this.updateLatencyStats(Date.now() - startTime);

        if (attempt > 0) {
          console.log(`✅ ${operationName} succeeded after ${attempt} retries`);
        }

        return result;
      } catch (error: any) {
        this.releaseConcurrencySlot();
        lastError = error;

        // Verificar si es un error que podemos reintentar
        if (!this.isRetryableError(error)) {
          throw error;
        }

        this.stats.throttledRequests++;

        if (attempt === this.config.maxRetries) {
          console.error(
            `❌ ${operationName} failed after ${this.config.maxRetries} retries:`,
            error.message
          );
          throw new Error(
            `Max retries exceeded for ${operationName}: ${error.message}`
          );
        }

        this.stats.retriedRequests++;
        const delay = this.calculateDelay(attempt);

        console.warn(
          `⚠️  ${operationName} throttled, retrying in ${delay}ms (attempt ${
            attempt + 1
          }/${this.config.maxRetries})`
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Verificar si el error es reintentable
   */
  private isRetryableError(error: any): boolean {
    if (!error.name) return false;

    const retryableErrors = [
      "ProvisionedThroughputExceededException",
      "ThrottlingException",
      "RequestLimitExceeded",
      "ServiceUnavailableException",
      "InternalServerError",
      "NetworkingError",
      "TimeoutError",
    ];

    return retryableErrors.includes(error.name) || error.retryable === true;
  }

  /**
   * Calcular delay con exponential backoff + jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);

    // Agregar jitter para evitar "thundering herd"
    const jitter = cappedDelay * this.config.jitterFactor * Math.random();

    return Math.floor(cappedDelay + jitter);
  }

  /**
   * Controlar concurrencia de requests
   */
  private async acquireConcurrencySlot(): Promise<void> {
    while (this.concurrentRequests >= this.maxConcurrentRequests) {
      await this.sleep(10); // Esperar 10ms
    }
    this.concurrentRequests++;
  }

  private releaseConcurrencySlot(): void {
    this.concurrentRequests = Math.max(0, this.concurrentRequests - 1);
  }

  /**
   * Queue para operaciones batch con rate limiting
   */
  async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeWithRetry(operation);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const operation = this.requestQueue.shift()!;

      try {
        await operation();
      } catch (error) {
        console.error("Queue operation failed:", error);
      }

      // Rate limiting: pequeña pausa entre operaciones
      if (this.requestQueue.length > 0) {
        await this.sleep(50); // 50ms entre requests
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Obtener estadísticas de throttling
   */
  getStats(): ThrottleStats {
    return { ...this.stats };
  }

  /**
   * Resetear estadísticas
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      throttledRequests: 0,
      retriedRequests: 0,
      averageLatency: 0,
    };
  }

  private updateLatencyStats(latency: number): void {
    const totalRequests = this.stats.totalRequests;
    this.stats.averageLatency =
      (this.stats.averageLatency * (totalRequests - 1) + latency) /
      totalRequests;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Configurar límites de concurrencia dinámicamente
   */
  setConcurrencyLimit(limit: number): void {
    this.maxConcurrentRequests = Math.max(1, Math.min(limit, 100));
  }

  /**
   * Obtener métricas de salud del throttling
   */
  getHealthMetrics(): {
    throttleRate: number;
    retryRate: number;
    avgLatency: number;
    concurrentRequests: number;
    queueSize: number;
  } {
    const stats = this.getStats();
    return {
      throttleRate:
        stats.totalRequests > 0
          ? stats.throttledRequests / stats.totalRequests
          : 0,
      retryRate:
        stats.totalRequests > 0
          ? stats.retriedRequests / stats.totalRequests
          : 0,
      avgLatency: stats.averageLatency,
      concurrentRequests: this.concurrentRequests,
      queueSize: this.requestQueue.length,
    };
  }
}

// Instancia singleton
const throttleManager = new ThrottleManager();

export { RetryConfig, ThrottleManager, ThrottleStats, throttleManager };
export default throttleManager;
