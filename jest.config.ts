// jest.config.ts
import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/*.spec.ts"],
  collectCoverageFrom: ["src/**/*.ts"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  verbose: true,
  clearMocks: true,
  forceExit: true, // Forzar salida después de tests
  detectOpenHandles: false, // Para debugging de handles abiertos
  testTimeout: 30000, // 30 segundos timeout para tests de integración
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@type/(.*)$": "<rootDir>/src/@types/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/coverage/", "/build/"],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/coverage/",
    "/build/",
    "/__tests__/",
    "/scripts/"
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  maxWorkers: 1, // Solo un worker para evitar conflictos con DynamoDB Local
};

export default config;
