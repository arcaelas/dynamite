/**
 * @file security-production.spec.ts
 * @description Comprehensive security and production readiness tests
 * @author Miguel Alejandro
 * @fecha 2025-08-31
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  Table,
  PrimaryKey,
  Default,
  NotNull,
  HasMany,
  BelongsTo,
  Dynamite,
} from "../src";
import { SecurityValidator, SecurityError } from "../src/utils/security-validator";
import { ThrottleManager } from "../src/utils/throttle-manager";
import { CircularReferenceDetector, CircularReferenceError } from "../src/utils/circular-detector";
import { TransactionManager, TransactionError } from "../src/utils/transaction-manager";
import MemoryManager from "../src/utils/memory-manager";

const ddbCfg = {
  region: "local",
  endpoint: "http://localhost:8000",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
};

describe("🚨 SECURITY & PRODUCTION READINESS TESTS", () => {
  let dynamoClient: DynamoDBClient;
  let securityValidator: SecurityValidator;
  let throttleManager: ThrottleManager;
  let circularDetector: CircularReferenceDetector;
  let transactionManager: TransactionManager;
  let memoryManager: MemoryManager;

  beforeAll(async () => {
    dynamoClient = new DynamoDBClient(ddbCfg);
    securityValidator = new SecurityValidator();
    throttleManager = new ThrottleManager();
    circularDetector = new CircularReferenceDetector();
    transactionManager = new TransactionManager(dynamoClient);
    memoryManager = MemoryManager.getInstance();
  });

  afterAll(async () => {
    memoryManager.shutdown();
  });

  describe("🛡️ SECURITY VALIDATION", () => {
    class TestModel extends Table<TestModel> {
      @PrimaryKey() declare id: string;
      @NotNull() declare data: string;
    }

    it("should prevent NoSQL injection attacks", () => {
      const maliciousInputs = [
        "{ $where: 'this.password.length > 0' }",
        "javascript:alert('xss')",
        "<script>alert('xss')</script>",
        "'; DROP TABLE users; --",
        "{ $regex: /.*/ }",
        "../../../etc/passwd",
        "eval(maliciousCode)",
        "function() { return true; }",
      ];

      maliciousInputs.forEach(input => {
        expect(() => {
          securityValidator.validateValue(input);
        }).toThrow(SecurityError);
      });
    });

    it("should validate attribute names against injection", () => {
      const maliciousNames = [
        "$where",
        "user.password",
        "admin'; DROP TABLE",
        "eval()",
        "../../../etc",
        "javascript:",
        "$regex",
        "__proto__",
      ];

      maliciousNames.forEach(name => {
        expect(() => {
          securityValidator.validateAttributeName(name);
        }).toThrow(SecurityError);
      });
    });

    it("should enforce size limits", () => {
      const oversizedString = "A".repeat(50000);
      const oversizedArray = new Array(5000).fill("data");
      const oversizedItem = { data: "A".repeat(500000) };

      expect(() => securityValidator.validateValue(oversizedString)).toThrow(SecurityError);
      expect(() => securityValidator.validateValue(oversizedArray)).toThrow(SecurityError);
      expect(() => securityValidator.validateItemSize(oversizedItem)).toThrow(SecurityError);
    });

    it("should prevent deeply nested objects", () => {
      let deepObject: any = {};
      let current = deepObject;
      
      // Create 20-level deep nesting
      for (let i = 0; i < 20; i++) {
        current.nested = {};
        current = current.nested;
      }
      current.value = "deep";

      expect(() => {
        securityValidator.validateValue(deepObject);
      }).toThrow(SecurityError);
    });

    it("should sanitize dangerous strings", () => {
      const dangerousString = "Hello\\x00\\x1F\\x7FWorld";
      const sanitized = securityValidator.sanitizeString(dangerousString);
      
      expect(sanitized).toBe("HelloWorld");
      expect(sanitized).not.toContain("\\x00");
    });
  });

  describe("⚡ THROTTLING & RETRY MANAGEMENT", () => {
    it("should handle throttling with exponential backoff", async () => {
      let attempts = 0;
      const mockFailingOperation = async () => {
        attempts++;
        if (attempts < 3) {
          const error = new Error("ProvisionedThroughputExceededException");
          (error as any).name = "ProvisionedThroughputExceededException";
          throw error;
        }
        return "success";
      };

      const startTime = Date.now();
      const result = await throttleManager.executeWithRetry(mockFailingOperation);
      const duration = Date.now() - startTime;

      expect(result).toBe("success");
      expect(attempts).toBe(3);
      expect(duration).toBeGreaterThan(200); // Should have delays
    });

    it("should respect concurrency limits", async () => {
      throttleManager.setConcurrencyLimit(2);
      let concurrentExecutions = 0;
      let maxConcurrent = 0;

      const trackingOperation = async () => {
        concurrentExecutions++;
        maxConcurrent = Math.max(maxConcurrent, concurrentExecutions);
        await new Promise(resolve => setTimeout(resolve, 100));
        concurrentExecutions--;
        return "done";
      };

      const promises = Array(5).fill(null).map(() => 
        throttleManager.executeWithRetry(trackingOperation)
      );

      await Promise.all(promises);

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it("should provide accurate throttling metrics", async () => {
      throttleManager.resetStats();
      
      let failCount = 0;
      const mockOperation = async () => {
        failCount++;
        if (failCount <= 2) {
          const error = new Error("ThrottlingException");
          (error as any).name = "ThrottlingException";
          throw error;
        }
        return "success";
      };

      await throttleManager.executeWithRetry(mockOperation);
      
      const stats = throttleManager.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.throttledRequests).toBe(2);
      expect(stats.retriedRequests).toBe(2);
    });

    it("should fail after max retries exceeded", async () => {
      const alwaysFailingOperation = async () => {
        const error = new Error("ProvisionedThroughputExceededException");
        (error as any).name = "ProvisionedThroughputExceededException";
        throw error;
      };

      await expect(
        throttleManager.executeWithRetry(alwaysFailingOperation)
      ).rejects.toThrow("Max retries exceeded");
    });
  });

  describe("🔄 CIRCULAR REFERENCE DETECTION", () => {
    it("should detect simple circular references", () => {
      const includeOptions = {
        posts: {
          include: {
            user: {
              include: {
                posts: {} // Circular: User -> Posts -> User
              }
            }
          }
        }
      };

      expect(() => {
        circularDetector.validateIncludePath("User", includeOptions);
      }).toThrow(CircularReferenceError);
    });

    it("should detect deep circular references", () => {
      const deepInclude = {
        level1: {
          include: {
            level2: {
              include: {
                level3: {
                  include: {
                    level4: {
                      include: {
                        level5: {
                          include: {
                            level1: {} // Deep circular reference
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      expect(() => {
        circularDetector.validateIncludePath("Level1", deepInclude);
      }).toThrow(CircularReferenceError);
    });

    it("should enforce maximum include depth", () => {
      const veryDeepInclude: any = {};
      let current = veryDeepInclude;
      
      // Create 12-level deep include (exceeds default limit of 5)
      for (let i = 0; i < 12; i++) {
        current[`level${i}`] = { include: {} };
        current = current[`level${i}`].include;
      }

      expect(() => {
        circularDetector.validateIncludePath("Start", veryDeepInclude);
      }).toThrow(CircularReferenceError);
    });

    it("should provide helpful suggestions for breaking cycles", () => {
      const mockModels = new Map([
        ["User", { getMeta: () => ({ relations: new Map([["posts", { targetModel: () => ({ name: "Post" }) }]]) }) }],
        ["Post", { getMeta: () => ({ relations: new Map([["user", { targetModel: () => ({ name: "User" }) }]]) }) }],
      ]);

      const result = circularDetector.validateRelationStructure(mockModels, 0);
      
      expect(result.isValid).toBe(false);
      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]).toContain("Consider using lazy loading");
    });
  });

  describe("🔄 TRANSACTION & ROLLBACK SYSTEM", () => {
    beforeEach(async () => {
      // Mock DynamoDB operations for transaction tests
      jest.clearAllMocks();
    });

    it("should successfully commit multi-operation transaction", async () => {
      // Mock DynamoDB client send method
      const mockSend = jest.fn().mockResolvedValue({ Responses: [] });
      (transactionManager as any).client.send = mockSend;

      const operations = [
        {
          type: "create" as const,
          tableName: "transaction_tests",
          key: { id: "test1" },
          item: { id: "test1", value: 100 }
        },
        {
          type: "create" as const,
          tableName: "transaction_tests",
          key: { id: "test2" },
          item: { id: "test2", value: 200 }
        }
      ];

      const txnId = await transactionManager.beginTransaction(operations);
      await transactionManager.commitTransaction(txnId);

      const status = transactionManager.getTransactionStatus(txnId);
      expect(status?.status).toBe("committed");
    });

    it("should rollback failed transaction", async () => {
      const operations = [
        {
          type: "create" as const,
          tableName: "transaction_tests",
          key: { id: "test1" },
          item: { id: "test1", value: 100 }
        },
        {
          type: "create" as const,
          tableName: "non_existent_table", // This will fail
          key: { id: "test2" },
          item: { id: "test2", value: 200 }
        }
      ];

      const txnId = await transactionManager.beginTransaction(operations);
      
      await expect(
        transactionManager.commitTransaction(txnId)
      ).rejects.toThrow(TransactionError);

      const status = transactionManager.getTransactionStatus(txnId);
      expect(status?.status).toBe("rolled_back");
    });

    it("should handle large batch transactions", async () => {
      // Create 50 operations (exceeds single TransactWrite limit of 25)
      const operations = Array.from({ length: 50 }, (_, i) => ({
        type: "create" as const,
        tableName: "transaction_tests",
        key: { id: `batch_${i}` },
        item: { id: `batch_${i}`, value: i }
      }));

      const txnId = await transactionManager.beginTransaction(operations);
      await transactionManager.commitTransaction(txnId);

      const status = transactionManager.getTransactionStatus(txnId);
      expect(status?.status).toBe("committed");
    });

    it("should prevent invalid transactions", async () => {
      const invalidOperations = [
        {
          type: "create" as const,
          tableName: "", // Invalid table name
          key: {},
          item: { malicious: "'; DROP TABLE users; --" }
        }
      ];

      await expect(
        transactionManager.beginTransaction(invalidOperations)
      ).rejects.toThrow(TransactionError);
    });
  });

  describe("🧠 MEMORY LEAK PREVENTION", () => {
    it("should register and cleanup tasks properly", () => {
      let cleanupCalled = false;
      
      memoryManager.registerCleanup("test-task", () => {
        cleanupCalled = true;
      });

      memoryManager.unregisterCleanup("test-task");
      expect(cleanupCalled).toBe(true);
    });

    it("should manage cache size limits", () => {
      const testCache = new Map([
        ["key1", { data: "value1", expires: Date.now() + 10000, created: Date.now() - 10000 }],
        ["key2", { data: "value2", expires: Date.now() + 10000, created: Date.now() - 5000 }],
        ["key3", { data: "value3", expires: Date.now() - 1000, created: Date.now() - 15000 }], // Expired
      ]);

      memoryManager.cleanCache(testCache, 2);

      expect(testCache.size).toBeLessThanOrEqual(2);
      expect(testCache.has("key3")).toBe(false); // Expired item removed
    });

    it("should track memory usage", () => {
      const memoryUsage = memoryManager.getMemoryUsage();
      
      expect(memoryUsage).toHaveProperty("rss");
      expect(memoryUsage).toHaveProperty("heapUsed");
      expect(memoryUsage).toHaveProperty("heapTotal");
      expect(typeof memoryUsage.rss).toBe("number");
    });

    it("should handle cleanup intervals without memory leaks", (done) => {
      let cleanupCount = 0;
      
      memoryManager.registerCleanup("interval-test", () => {
        cleanupCount++;
      }, 50);

      setTimeout(() => {
        expect(cleanupCount).toBeGreaterThan(1);
        memoryManager.unregisterCleanup("interval-test");
        done();
      }, 150);
    });
  });

  describe("📊 PRODUCTION LOAD TESTING", () => {
    it("should handle concurrent operations without memory leaks", async () => {
      const initialMemory = process.memoryUsage();
      
      class LoadTest extends Table<LoadTest> {
        @PrimaryKey() declare id: string;
        @NotNull() declare data: string;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [LoadTest] });
      dynamite.connect();
      await dynamite.sync();

      // Create 100 concurrent operations
      const promises = Array.from({ length: 100 }, async (_, i) => {
        return LoadTest.create({
          id: `load_${i}`,
          data: `test_data_${i}`,
        });
      });

      await Promise.all(promises);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 30000);

    it("should maintain performance under stress", async () => {
      class StressTest extends Table<StressTest> {
        @PrimaryKey() declare id: string;
        @NotNull() declare counter: number;
      }

      const dynamite = new Dynamite({ ...ddbCfg, tables: [StressTest] });
      dynamite.connect();
      await dynamite.sync();

      const startTime = Date.now();
      const operations = 50;

      // Mixed operations: create, read, update
      const promises = Array.from({ length: operations }, async (_, i) => {
        if (i % 3 === 0) {
          return StressTest.create({ id: `stress_${i}`, counter: i });
        } else if (i % 3 === 1) {
          return StressTest.where("counter", ">=", 0);
        } else {
          const items = await StressTest.where({ counter: i - 1 });
          if (items.length > 0) {
            return items[0].update({ counter: i * 2 });
          }
        }
      });

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (10 seconds)
      expect(duration).toBeLessThan(10000);
      
      // Throttle manager should show good performance
      const throttleStats = throttleManager.getStats();
      expect(throttleStats.averageLatency).toBeLessThan(1000); // Less than 1s average
    }, 15000);
  });

  describe("🔍 ERROR HANDLING & EDGE CASES", () => {
    it("should gracefully handle DynamoDB service errors", async () => {
      const mockClient = {
        send: jest.fn().mockRejectedValue({
          name: "ServiceUnavailableException",
          message: "Service temporarily unavailable"
        })
      };

      const customThrottleManager = new ThrottleManager();
      
      await expect(
        customThrottleManager.executeWithRetry(
          () => mockClient.send({}),
          "Mock Operation"
        )
      ).rejects.toThrow("Max retries exceeded");
    });

    it("should validate data integrity during failures", async () => {
      // Test data corruption detection
      const corruptedData = {
        id: "test",
        data: null,
        corrupted: undefined,
        invalid: Symbol("test") // Invalid data type
      };

      expect(() => {
        securityValidator.validateValue(corruptedData);
      }).toThrow(SecurityError);
    });

    it("should handle connection timeouts gracefully", async () => {
      const timeoutOperation = () => new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error("Connection timeout");
          (error as any).name = "TimeoutError";
          reject(error);
        }, 100);
      });

      await expect(
        throttleManager.executeWithRetry(timeoutOperation)
      ).rejects.toThrow("Max retries exceeded");
    });
  });
});