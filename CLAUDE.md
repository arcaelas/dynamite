# Estilo de Programación - Arcaelas Insiders

## 📋 Resumen General

Este documento define los estándares de programación, patrones de código y convenciones técnicas universales de Arcaelas Insiders. Estos estándares garantizan **consistencia**, **legibilidad** y **mantenibilidad** del código base en todos los proyectos.

---

## 🎯 Principios Fundamentales

### 1. **Prioridad a Estándares Nativos**
- **JavaScript/TypeScript nativo** antes que librerías externas
- **Métodos nativos** antes que helpers personalizados
- **APIs estándar** antes que abstracciones propias
- Aprovechar las **capacidades del lenguaje** para código limpio y robusto

### 2. **Brevedad y Expresividad**
- Código **conciso pero legible**
- **Hardcodear valores** antes que variables de un solo uso
- **Lambda functions** preferidas sobre declaraciones independientes
- Evitar código extenso y verboso

### 3. **Robustez a través de Simplicidad**
- Menos líneas de código = menos bugs
- Utilizar características nativas del lenguaje
- Código autodocumentado a través de nombres descriptivos

---

## 🔧 Formateo y Estilo

### Indentación y Espaciado
```typescript
// ✅ Correcto: 2 espacios, líneas en blanco estratégicas
export interface ProviderOptions {
  baseURL: string;
  model: string;
  apiKey?: string;
}

// ❌ Incorrecto: 4 espacios o tabs
export interface ProviderOptions {
    baseURL: string;
    model: string;
}
```

### Puntuación y Operadores
```typescript
// ✅ Correcto: espacios alrededor de operadores
const idx = Math.floor(Math.random() * providers.length);
const { func, ...schema } = tool;

// ❌ Incorrecto: sin espacios
const idx=Math.floor(Math.random()*providers.length);
```

---

## 📝 Convenciones de Nomenclatura

### Variables y Funciones
```typescript
// ✅ Variables en inglés con camelCase
const base_url = "https://api.openai.com";
const tool_options = { name: "search", description: "..." };

// ✅ Métodos y funciones con snake_case
function parse_arguments(text: string) { }
const handle_request = async () => { };

// ✅ Abreviaciones claras cuando son obvias
const idx = 0;
const args = JSON.parse(arg_text);
const desc = "Tool description";
```

### Clases, Interfaces y Constantes
```typescript
// ✅ Clases con PascalCase
class Agent<T extends AgentOptions> { }
class HttpClient { }

// ✅ Interfaces con PascalCase
interface ProviderOptions { }
interface AgentOptions { }

// ✅ Constantes y enums con UPPER_CASE
const MAX_RETRIES = 3;
const API_BASE_URL = "https://api.example.com";

enum Status {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}
```

---

## 🔀 Control de Flujo

### Condicionales: if-else vs Ternarios

**Usa ternarios para:**
- Asignaciones simples
- Valores condicionales en línea
- Expresiones cortas

```typescript
// ✅ Ternarios para asignaciones
const tool = typeof v === "function" ? v : v.func;
const name = typeof v === "function" ? Math.random().toString(36).slice(2) : k;

// ✅ Ternarios en parámetros
["func" as any]: typeof v === "function" ? v : v.func,
```

**Usa if-else para:**
- Lógica de múltiples líneas
- Validaciones con side effects
- Control de flujo complejo

```typescript
// ✅ if-else para validaciones
if (this.tools.has(k)) throw new Error("Tool already exists");

if (!choices.length) {
  providers.splice(idx, 1);
  continue;
}

// ✅ if-else para bloques de código
if (argText.trim()) {
  try {
    args = JSON.parse(argText);
  } catch {
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: "Error: JSON.parse failed on tool arguments",
    });
    continue;
  }
}
```

### Early Returns
**Usar early returns** para reducir anidamiento:

```typescript
// ✅ Early return
function process_data(data: unknown) {
  if (!data) return null;
  if (typeof data !== "object") return null;

  // lógica principal
  return transform(data);
}

// ❌ Anidamiento innecesario
function process_data(data: unknown) {
  if (data) {
    if (typeof data === "object") {
      // lógica principal
      return transform(data);
    }
  }
  return null;
}
```

### Switch vs If-Else
**Usar switch solo para casos lineales simples:**

```typescript
// ✅ Switch para casos lineales
switch (status) {
  case "pending": return "⏳";
  case "completed": return "✅";
  case "failed": return "❌";
  default: return "❓";
}

// ✅ If-else para lógica compleja
if (user.is_admin && has_permission) {
  return admin_dashboard();
} else if (user.is_verified) {
  return user_dashboard();
} else {
  return login_page();
}
```

---

## ⚡ Declaración de Funciones

### Prioridad: Lambdas > Funciones Declaradas

**✅ Preferir funciones anónimas cortas**
```typescript
// Callbacks y transformaciones
const tools = [...this.tools.values()].map(({ func, ...schema }) => schema);

const providers = this.providers.map(({ base_url, api_key, model }) => {
  const client = new OpenAI({ base_url, api_key });
  return (params) => client.chat.completions.create({ ...params, model });
});

// Funciones inline para operaciones simples
const filtered_items = items.filter(item => item.is_active && item.price > 0);
const transformed_data = data.map(item => ({ ...item, id: generate_id() }));
```

**✅ Lógica encapsulada vs helpers externos**
```typescript
// ✅ Lógica encapsulada (preferido)
function process_user_data(user: User) {
  const normalize_email = (email: string) => email.toLowerCase().trim();
  const is_valid_age = (age: number) => age >= 18 && age <= 120;

  return {
    email: normalize_email(user.email),
    is_adult: is_valid_age(user.age)
  };
}

// ❌ Helpers externos (evitar a menos que sea inevitable)
function normalize_email(email: string) { return email.toLowerCase().trim(); }
function is_valid_age(age: number) { return age >= 18 && age <= 120; }
```

**✅ Usar funciones declaradas solo cuando:**
- La lógica es compleja y reutilizable
- Se necesita hoisting
- La función es parte de la API pública
- Es inevitablemente necesario un helper externo

---

## 🏗️ Gestión de Variables y Constantes

### Regla: Hardcodear antes que Variables Únicas

**✅ Hardcodear valores de un solo uso**
```typescript
// ✅ Correcto: valor hardcodeado
for (let loop = 0; loop < 6; loop++) {
  // ...
}

// ✅ Correcto: string literal
throw new Error("Tool already exists");
```

**❌ Evitar variables innecesarias**
```typescript
// ❌ Incorrecto: variable para un solo uso
const MAX_LOOPS = 6;
for (let loop = 0; loop < MAX_LOOPS; loop++) {
  // ...
}

// ❌ Incorrecto: constante para string único
const TOOL_EXISTS_ERROR = "Tool already exists";
throw new Error(TOOL_EXISTS_ERROR);
```

**✅ Usar variables/constantes cuando:**
- El valor se reutiliza múltiples veces
- Representa configuración modificable
- Mejora significativamente la legibilidad

```typescript
// ✅ Correcto: reutilización
const client = new OpenAI({ baseURL, apiKey });
return (p: Omit<...>) => client.chat.completions.create({ ...p, model });
```

---

## 📚 Uso de Métodos Nativos

### Priorizar APIs Nativas del Lenguaje

**✅ Array methods nativos**
```typescript
// Transformaciones
const tools = [...this.tools.values()].map(transform);

// Búsquedas
const tool = this.tools.get(call.function.name);

// Validaciones
if (!choices.length) return;
```

**✅ Destructuring y Spread**
```typescript
// Destructuring con rest
const { func, ...schema } = tool;

// Spread para arrays
const tools = [...this.tools.values()];

// Spread para objetos
return { ...p, model };
```

**✅ Optional chaining y assignment operators**
```typescript
// Nullish coalescing
const arg_text = call.function.arguments ?? "";
const config = user_config ?? default_config;

// Assignment operators
config.timeout ??= 5000;
config.retries ||= 3;

// Preferir x = y ?? z sobre alternativas
const result = response.data ?? fallback_data;
const value = input?.trim() ?? "";
```

**✅ Validaciones complejas simplificadas**
```typescript
// ✅ Validación en cadena
const is_valid_user = user?.id && user?.email && user.is_active;

// ✅ Múltiples validaciones con early return
function validate_request(req: Request) {
  if (!req.headers.authorization) return false;
  if (!req.body?.data) return false;
  if (req.method !== "POST") return false;
  return true;
}

// ✅ Validación con destructuring
const { name, email, age } = user_data ?? {};
if (!name || !email || age < 18) return;
```

---

## 🎨 TypeScript Específico

### Tipado y Generics
```typescript
// ✅ Generics condicionales para flexibilidad
type Params<T> = T extends object ? T : { input: string };

// ✅ Type assertions cuando es necesario
["func" as any]: typeof v === "function" ? v : v.func,

// ✅ Tipos de unión y opcionales
limits?: string[];
apiKey?: string;
```

### Modificadores de Acceso
```typescript
// ✅ readonly para inmutabilidad
readonly name: string;
private readonly providers: ProviderOptions[];

// ✅ private para estado interno
private readonly tools = new Map<string, OpenAI.ChatCompletionTool>();
```

---

## 📖 Documentación

### JSDoc en Español para APIs Públicas

**✅ Documentación profesional completa**
```typescript
/**
 * @description
 * Opciones de configuración para el agente de IA.
 * @example
 * ```typescript
 * const options: AgentOptions = {
 *   name: "Assistant",
 *   description: "Agente especializado en soporte técnico",
 *   providers: [{ base_url: "...", model: "gpt-4", api_key: "..." }]
 * };
 * ```
 */
export interface AgentOptions {
  /**
   * @description
   * Nombre único del agente utilizado para identificación durante conversaciones.
   */
  name: string;

  /**
   * @description
   * Descripción de la personalidad y comportamiento del agente.
   */
  description: string;

  /**
   * @description
   * Lista de proveedores de IA disponibles para el agente.
   */
  providers: ProviderOptions[];
}

/**
 * @namespace Utils
 * @description
 * Utilidades generales para el procesamiento de datos.
 */
export namespace Utils {
  /**
   * @description
   * Procesa y valida datos de entrada del usuario.
   * @param data - Datos sin procesar del usuario
   * @param options - Opciones de procesamiento
   * @returns Datos procesados y validados
   * @example
   * ```typescript
   * const result = process_user_data(rawData, { strict: true });
   * ```
   */
  export function process_user_data(
    data: unknown,
    options?: ProcessOptions
  ): ProcessedData | null {
    // implementación
  }
}
```

**✅ Tags JSDoc recomendados:**
- `@description` - Descripción detallada
- `@param` - Parámetros de función
- `@returns` - Valor de retorno
- `@example` - Ejemplos de uso
- `@typedef` - Definiciones de tipos
- `@namespace` - Organización de utilidades
- `@throws` - Excepciones que puede lanzar
- `@since` - Versión de introducción
- `@deprecated` - Elementos obsoletos

### Comentarios de Sección
```typescript
/* 1 · Schemas de herramientas (omitimos `func` con `as any`) */
const tools = [...this.tools.values()].map(
  ({ func, ...schema }: any) => schema
);

/* 2 · Creamos un wrapper por proveedor con el modelo inyectado */
const providers = this.providers.map(({ baseURL, apiKey, model }) => {
  // ...
});
```

---

## 📋 Documentación de Proyectos

### README.md Obligatorio
**Cada librería debe incluir un README.md descriptivo:**

```markdown
# Nombre del Proyecto

Descripción concisa de qué hace la librería y por qué es útil.

## 🚀 Instalación

\`\`\`bash
npm install @arcaelas/nombre-proyecto
yarn add @arcaelas/nombre-proyecto
\`\`\`

## 📖 Uso Básico

\`\`\`typescript
import { main_function } from "@arcaelas/nombre-proyecto";

const result = main_function({ config: "value" });
\`\`\`

## 🔧 API

### Funciones Principales

#### \`main_function(options: Options): Result\`
Descripción de la función principal.

**Parámetros:**
- \`options.config\` - Configuración específica
- \`options.mode\` - Modo de operación

**Retorna:** Objeto con el resultado procesado

## 📝 Ejemplos

### Ejemplo Básico
\`\`\`typescript
// Código de ejemplo funcional
\`\`\`

### Ejemplo Avanzado
\`\`\`typescript
// Ejemplo más complejo con todas las opciones
\`\`\`

## 🧪 Testing

\`\`\`bash
npm test
\`\`\`

## 📄 Licencia

[Tipo de licencia] - Ver archivo LICENSE para más detalles.
```

### Estructura Estándar de README
1. **Título y descripción** clara y concisa
2. **Instalación** con comandos específicos
3. **Uso básico** con ejemplo mínimo funcional
4. **API completa** documentada
5. **Ejemplos** progresivos (básico → avanzado)
6. **Testing** instrucciones de prueba
7. **Licencia** información legal

---

## ⚙️ Herramientas y Build

### Herramientas Esenciales
- **Build**: ESBuild para compilación rápida
- **TypeScript**: Configuración estricta con decorators
- **Testing**: Jest para pruebas unitarias
- **Linting**: ESLint + Prettier para formato consistente

### Scripts Básicos Requeridos
```json
{
  "build": "tsc && node esbuild.js",
  "test": "jest",
  "lint": "eslint src/ --ext .ts",
  "format": "prettier --write src/"
}
```

---

## 🎯 Estándares de Programación - Resumen

### Control de Flujo
1. **Early returns** > anidamiento profundo
2. **Ternarios** para asignaciones simples
3. **if-else** para lógica compleja
4. **Switch** solo para casos lineales simples
5. **Spread operator** para transformaciones
6. **Operadores de asignación** ??= y ||= cuando aplique
7. **Nullish coalescing** x = y ?? z como preferencia

### Funciones y Métodos
8. **Funciones nativas** > métodos personalizados
9. **Lambdas anónimas** > funciones declaradas de un solo uso
10. **Lógica encapsulada** > helpers externos
11. **Hardcode** > variables de un solo uso
12. **Validaciones simplificadas** en pocos pasos

### Nomenclatura
13. **Variables en inglés** con snake_case para funciones
14. **PascalCase** para clases e interfaces
15. **UPPER_CASE** para constantes y enums
16. **Nombres descriptivos** y autodocumentados

### Documentación
17. **JSDoc en español** para APIs públicas
18. **Tags profesionales** sin saturar
19. **README.md descriptivo** obligatorio por proyecto
20. **Ejemplos funcionales** en documentación

### Calidad
21. **2 espacios** de indentación siempre
22. **Código autodocumentado** > comentarios explicativos
23. **Simplicidad** > complejidad innecesaria
24. **Natividad del lenguaje** > abstracciones personalizadas

Estos estándares garantizan código **limpio**, **consistente** y **mantenible** siguiendo las mejores prácticas de programación moderna.