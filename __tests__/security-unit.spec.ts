/**
 * @file security-unit.spec.ts
 * @description Unit tests for security components (no DynamoDB dependency)
 * @author Miguel Alejandro
 * @fecha 2025-08-31
 */
import { SecurityValidator, SecurityError } from "../src/utils/security-validator";
import { ThrottleManager } from "../src/utils/throttle-manager";
import { CircularReferenceDetector, CircularReferenceError } from "../src/utils/circular-detector";
import MemoryManager from "../src/utils/memory-manager";

describe("🛡️ SECURITY & PERFORMANCE UNIT TESTS", () => {
  let securityValidator: SecurityValidator;
  let throttleManager: ThrottleManager;
  let circularDetector: CircularReferenceDetector;
  let memoryManager: MemoryManager;

  beforeAll(() => {
    securityValidator = new SecurityValidator();
    throttleManager = new ThrottleManager();
    circularDetector = new CircularReferenceDetector();
    memoryManager = MemoryManager.getInstance();
  });

  afterAll(() => {
    memoryManager.shutdown();
  });

  describe("🛡️ SECURITY VALIDATION", () => {
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

    it("should validate valid inputs correctly", () => {
      const validInputs = [
        "normal string",
        { id: 1, name: "test" },
        [1, 2, 3, 4, 5],
        null,
        undefined,
        123,
        true,
        false
      ];

      validInputs.forEach(input => {
        expect(() => {
          securityValidator.validateValue(input);
        }).not.toThrow();
      });
    });

    it("should validate valid attribute names", () => {
      const validNames = [
        "id",
        "user_name", 
        "email",
        "created_at",
        "data123",
        "fieldA"
      ];

      validNames.forEach(name => {
        expect(() => {
          securityValidator.validateAttributeName(name);
        }).not.toThrow();
      });
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
      const newThrottleManager = new ThrottleManager();
      
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

      await newThrottleManager.executeWithRetry(mockOperation);
      
      const stats = newThrottleManager.getStats();
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

    it("should calculate delay correctly", () => {
      // Access private method for testing
      const calculateDelay = (throttleManager as any).calculateDelay.bind(throttleManager);
      
      const delay0 = calculateDelay(0);
      const delay1 = calculateDelay(1);
      const delay2 = calculateDelay(2);

      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay0).toBeGreaterThanOrEqual(100); // Base delay
    });

    it("should handle non-retryable errors immediately", async () => {
      const nonRetryableOperation = async () => {
        const error = new Error("ValidationException");
        (error as any).name = "ValidationException";
        throw error;
      };

      await expect(
        throttleManager.executeWithRetry(nonRetryableOperation)
      ).rejects.toThrow("ValidationException");
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

    it("should allow valid deep includes within limits", () => {
      const validDeepInclude = {
        user: {
          include: {
            profile: {
              include: {
                settings: {}
              }
            }
          }
        }
      };

      expect(() => {
        circularDetector.validateIncludePath("Post", validDeepInclude);
      }).not.toThrow();
    });

    it("should track path history correctly", () => {
      const includeOptions = {
        posts: {
          include: {
            comments: {}
          }
        }
      };

      circularDetector.clearHistory();
      
      try {
        circularDetector.validateIncludePath("User", includeOptions);
      } catch (error) {
        // Expected to pass
      }

      const history = circularDetector.getPathHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].modelName).toBe("User");
    });

    it("should create tracking context correctly", () => {
      const tracker = circularDetector.createTrackingContext();
      
      expect(() => {
        tracker.enter("User");
        tracker.enter("Post");
        tracker.exit("Post");
        tracker.exit("User");
      }).not.toThrow();

      expect(tracker.getCurrentPath()).toEqual([]);
    });
  });

  describe("🧠 MEMORY LEAK PREVENTION", () => {
    it("should register and cleanup tasks properly", (done) => {
      let cleanupCalled = false;
      
      memoryManager.registerCleanup("test-task", () => {
        cleanupCalled = true;
      });

      setTimeout(() => {
        memoryManager.unregisterCleanup("test-task");
        expect(cleanupCalled).toBe(true);
        done();
      }, 10);
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

    it("should clean up expired cache entries based on age", () => {
      const now = Date.now();
      const testCache = new Map([
        ["key1", { data: "value1", expires: now + 10000, created: now - 400000 }], // Too old
        ["key2", { data: "value2", expires: now + 10000, created: now - 100000 }], // Fresh
      ]);

      memoryManager.cleanCache(testCache, 10);

      expect(testCache.has("key1")).toBe(false); // Removed due to age
      expect(testCache.has("key2")).toBe(true);  // Kept
    });
  });

  describe("🔧 ERROR HANDLING & EDGE CASES", () => {
    it("should handle invalid security validator config", () => {
      const invalidConfig = {
        maxStringLength: -1,
        maxArrayLength: -1,
        maxNestedDepth: -1
      };

      const validator = new SecurityValidator(invalidConfig);
      
      // Should still work with merged defaults
      expect(() => {
        validator.validateValue("test");
      }).not.toThrow();
    });

    it("should handle empty circular detection inputs", () => {
      expect(() => {
        circularDetector.validateIncludePath("", {});
      }).not.toThrow();

      expect(() => {
        circularDetector.validateIncludePath("User", null as any);
      }).not.toThrow();
    });

    it("should handle throttle manager edge cases", async () => {
      const edgeCaseOperation = async () => {
        const error = new Error("UnknownError");
        (error as any).retryable = true; // Explicitly retryable
        throw error;
      };

      await expect(
        throttleManager.executeWithRetry(edgeCaseOperation)
      ).rejects.toThrow("Max retries exceeded");
    });

    it("should validate security error messages", () => {
      try {
        securityValidator.validateValue("{ $where: 'malicious' }");
      } catch (error: any) {
        expect(error).toBeInstanceOf(SecurityError);
        expect(error.name).toBe("SecurityError");
        expect(error.message).toContain("peligrosos");
      }
    });

    it("should handle memory manager shutdown gracefully", () => {
      const testMemoryManager = MemoryManager.getInstance();
      
      // Register multiple tasks
      testMemoryManager.registerCleanup("task1", () => {});
      testMemoryManager.registerCleanup("task2", () => {}, 100);
      
      // Should not throw during shutdown
      expect(() => {
        testMemoryManager.shutdown();
      }).not.toThrow();
    });

    it("should handle concurrent throttle operations", async () => {
      const concurrentThrottleManager = new ThrottleManager();
      
      const operation = () => Promise.resolve("success");
      
      const promises = Array(10).fill(null).map(() => 
        concurrentThrottleManager.executeWithRetry(operation)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach(result => expect(result).toBe("success"));
    });
  });
});