/**
 * @file jest.setup.ts
 * @description Jest global setup para tests de DynamoDB
 * @author Miguel Alejandro
 * @fecha 2025-08-31
 */

// Configuración global para tests
beforeAll(async () => {
  // Configurar variables de entorno para DynamoDB Local
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  process.env.AWS_REGION = 'us-east-1';
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';

  // Configurar timezone para tests consistentes
  process.env.TZ = 'UTC';
});

afterAll(async () => {
  // Pequeña pausa para permitir cleanup
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Configuración global para manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.warn('Uncaught Exception:', error);
});

// Aumentar límite de listeners para tests que usan muchos eventos
require('events').EventEmitter.defaultMaxListeners = 15;

// Mock console.warn para tests que esperan warnings específicos
const originalWarn = console.warn;
const warnings: string[] = [];

beforeEach(() => {
  warnings.length = 0;
  console.warn = jest.fn((...args) => {
    warnings.push(args.join(' '));
    originalWarn(...args);
  });
});

afterEach(() => {
  console.warn = originalWarn;
});

// Hacer warnings disponible globalmente para tests
(global as any).testWarnings = warnings;