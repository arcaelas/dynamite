/**
 * @file security-validator.ts
 * @description Security validation and NoSQL injection prevention
 * @author Miguel Alejandro
 * @fecha 2025-08-31
 */

import { QueryOperator } from "@type/index";

interface SecurityConfig {
  maxStringLength: number;
  maxArrayLength: number;
  maxNestedDepth: number;
  allowedOperators: QueryOperator[];
  blockedPatterns: RegExp[];
}

class SecurityValidator {
  private static readonly DEFAULT_CONFIG: SecurityConfig = {
    maxStringLength: 10000,
    maxArrayLength: 1000,
    maxNestedDepth: 10,
    allowedOperators: ["=", "!=", "<", "<=", ">", ">=", "in", "not-in", "contains", "begins-with"],
    blockedPatterns: [
      /\$\w+/g,                    // MongoDB operators
      /javascript:/gi,              // JavaScript injection
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /eval\s*\(/gi,               // eval() calls
      /function\s*\(/gi,           // function declarations
      /\{\s*\$\w+/g,               // NoSQL operators
      /\.\.\//g,                   // Path traversal
      /union\s+select/gi,          // SQL injection patterns
      /drop\s+table/gi,            // Destructive SQL
    ]
  };

  private config: SecurityConfig;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...SecurityValidator.DEFAULT_CONFIG, ...config };
  }

  /**
   * Validar nombre de atributo/tabla
   */
  validateAttributeName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new SecurityError('Nombre de atributo inválido');
    }

    if (name.length > 255) {
      throw new SecurityError('Nombre de atributo muy largo');
    }

    // Solo permitir caracteres alfanuméricos, guiones y guiones bajos
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      throw new SecurityError('Nombre de atributo contiene caracteres inválidos');
    }

    // Verificar patrones bloqueados
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(name)) {
        throw new SecurityError('Nombre de atributo contiene patrones peligrosos');
      }
    }
  }

  /**
   * Validar operador de query
   */
  validateOperator(operator: string): QueryOperator {
    if (!this.config.allowedOperators.includes(operator as QueryOperator)) {
      throw new SecurityError(`Operador no permitido: ${operator}`);
    }
    return operator as QueryOperator;
  }

  /**
   * Validar valor de campo
   */
  validateValue(value: any, depth = 0): any {
    if (depth > this.config.maxNestedDepth) {
      throw new SecurityError('Estructura de datos anidada muy profunda');
    }

    // Valores null/undefined son válidos
    if (value === null || value === undefined) {
      return value;
    }

    // Validar strings
    if (typeof value === 'string') {
      if (value.length > this.config.maxStringLength) {
        throw new SecurityError('String muy largo');
      }
      
      for (const pattern of this.config.blockedPatterns) {
        if (pattern.test(value)) {
          throw new SecurityError('Valor contiene patrones peligrosos');
        }
      }
      return value;
    }

    // Validar arrays
    if (Array.isArray(value)) {
      if (value.length > this.config.maxArrayLength) {
        throw new SecurityError('Array muy largo');
      }
      
      return value.map(item => this.validateValue(item, depth + 1));
    }

    // Validar objetos
    if (typeof value === 'object') {
      const validated: any = {};
      for (const [key, val] of Object.entries(value)) {
        this.validateAttributeName(key);
        validated[key] = this.validateValue(val, depth + 1);
      }
      return validated;
    }

    // Números, booleans son válidos
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    throw new SecurityError(`Tipo de valor no permitido: ${typeof value}`);
  }

  /**
   * Validar filtros de query completos
   */
  validateQueryFilters(filters: Record<string, any>): Record<string, any> {
    const validated: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(filters)) {
      this.validateAttributeName(key);
      validated[key] = this.validateValue(value);
    }

    return validated;
  }

  /**
   * Sanitizar string para DynamoDB
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    return input
      .replace(/[\x00-\x1F\x7F]/g, '') // Remover caracteres de control
      .trim()
      .slice(0, this.config.maxStringLength);
  }

  /**
   * Validar tamaño de item para DynamoDB (límite 400KB)
   */
  validateItemSize(item: any): void {
    const size = JSON.stringify(item).length;
    const maxSize = 400 * 1024; // 400KB en bytes
    
    if (size > maxSize) {
      throw new SecurityError(`Item muy grande: ${size} bytes (máximo: ${maxSize} bytes)`);
    }
  }
}

class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

// Instancia singleton
const securityValidator = new SecurityValidator();

export { SecurityValidator, SecurityError, securityValidator };
export default securityValidator;