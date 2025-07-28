/**
 * @file debug-decorators.spec.ts
 * @descripcion Test diagnóstico para entender el problema de decoradores
 * @autor Miguel Alejandro
 * @fecha 2025-01-27
 */

import { Dynamite } from "../src/core/client";
import { stopCleanupInterval } from '../src/utils/relations';
import Table from "../src/core/table";
import wrapper from "../src/core/wrapper";
import PrimaryKey from "../src/decorators/primary_key";
import Default from "../src/decorators/default";
import { CreationOptional } from "../src/core/wrapper";

describe("🔍 Diagnóstico de Decoradores", () => {
  
  // Configuración del cliente DynamoDB para tests
  const client = new Dynamite({
    tables: [],
    region: "us-east-1",
    endpoint: "http://localhost:8000",
    credentials: {
      accessKeyId: "fake",
      secretAccessKey: "fake",
    },
  });

  beforeAll(async () => {
    await client.sync();
    client.connect();
  });
  
  // Hooks simplificados - funcionalidad de diagnóstico básica
  beforeEach(() => {
    // Setup test state if needed
  });

  afterEach(() => {
    // Cleanup test state if needed
  });

  afterAll(() => {
    // Limpiar interval para evitar warning de Jest
    stopCleanupInterval();
  });

  it("debería registrar una clase simple con decoradores", () => {
    console.log("📝 Definiendo clase TestModel...");
    
    class TestModel extends Table<TestModel> {
      @PrimaryKey() 
      declare id: CreationOptional<string>;
      
      @Default("test")
      declare name: CreationOptional<string>;
    }
    
    console.log("✅ Clase definida. Verificando registro...");
    console.log("TestModel registrado:", wrapper.has(TestModel));
    
    if (wrapper.has(TestModel)) {
      const meta = wrapper.get(TestModel);
      console.log("Metadatos:", meta);
      console.log("Columnas:", Array.from(meta!.columns.keys()));
    }
    
    expect(wrapper.has(TestModel)).toBe(true);
  });

  it("debería crear instancia de clase registrada", () => {
    class TestModel2 extends Table<TestModel2> {
      @PrimaryKey() 
      declare id: CreationOptional<string>;
      
      @Default("test")
      declare name: CreationOptional<string>;
    }
    
    console.log("📦 Intentando crear instancia...");
    
    try {
      const instance = new TestModel2({ id: "test1" });
      console.log("✅ Instancia creada:", instance);
      expect(instance.id).toBe("test1");
    } catch (error) {
      console.error("❌ Error al crear instancia:", error);
      throw error;
    }
  });

  it("debería mostrar orden de ejecución de decoradores", () => {
    console.log("📋 Orden de ejecución de decoradores:");
    
    let executionOrder: string[] = [];
    
    // Mock decorators para tracking
    const trackingPrimaryKey = () => {
      executionOrder.push("PrimaryKey");
      return PrimaryKey();
    };
    
    const trackingDefault = (value: any) => {
      executionOrder.push(`Default(${value})`);
      return Default(value);
    };
    
    class TestModel3 extends Table<TestModel3> {
      @trackingPrimaryKey()
      declare id: CreationOptional<string>;
      
      @trackingDefault("tracking")
      declare name: CreationOptional<string>;
    }
    
    console.log("🔄 Orden de ejecución:", executionOrder);
    console.log("📊 Estado del wrapper:", wrapper.has(TestModel3));
    
    expect(executionOrder.length).toBeGreaterThan(0);
  });

  it("debería mostrar diferencias entre entorno consolidado y separado", () => {
    console.log("🔍 Análisis de entorno:");
    console.log("Jest describe actual:", expect.getState().currentTestName);
    console.log("Variables de entorno:", process.env.NODE_ENV);
    console.log("Contexto de ejecución:", typeof global !== 'undefined' ? 'global' : 'window');
    
    // Verificar si los decoradores están siendo aplicados
    const descriptor = Object.getOwnPropertyDescriptor(PrimaryKey, 'name');
    console.log("Descriptor de PrimaryKey:", descriptor);
    
    // Verificar prototipo de clases
    class TestModel4 extends Table<TestModel4> {
      @PrimaryKey()
      declare id: CreationOptional<string>;
    }
    
    const proto = Object.getPrototypeOf(TestModel4);
    console.log("Prototipo de TestModel4:", proto);
    console.log("Propiedades de TestModel4:", Object.getOwnPropertyNames(TestModel4));
    
    expect(true).toBe(true);
  });

});
