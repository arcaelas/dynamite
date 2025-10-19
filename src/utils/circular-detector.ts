/**
 * @file circular-detector.ts
 * @description Detection and prevention of circular references in relations
 * @author Miguel Alejandro
 * @fecha 2025-08-31
 */

interface TraversalPath {
  modelName: string;
  relationKey: string;
  depth: number;
}

interface CircularDetectionConfig {
  maxDepth: number;
  maxIncludeDepth: number;
  trackingEnabled: boolean;
}

class CircularReferenceDetector {
  private static readonly DEFAULT_CONFIG: CircularDetectionConfig = {
    maxDepth: 10,
    maxIncludeDepth: 5,
    trackingEnabled: true,
  };

  private config: CircularDetectionConfig;
  private activePaths: Set<string> = new Set();
  private pathHistory: TraversalPath[] = [];

  constructor(config?: Partial<CircularDetectionConfig>) {
    this.config = { ...CircularReferenceDetector.DEFAULT_CONFIG, ...config };
  }

  /**
   * Verificar si una ruta de inclusión es segura
   */
  validateIncludePath(
    modelName: string,
    includeOptions: any,
    currentDepth: number = 0,
    visitedModels: Set<string> = new Set()
  ): void {
    // Verificar profundidad máxima
    if (currentDepth > this.config.maxIncludeDepth) {
      throw new CircularReferenceError(
        `Include depth exceeded limit of ${this.config.maxIncludeDepth} at model: ${modelName}`
      );
    }

    // Detectar referencia circular directa
    if (visitedModels.has(modelName)) {
      const path = Array.from(visitedModels).join(" -> ") + ` -> ${modelName}`;
      throw new CircularReferenceError(
        `Circular reference detected in include path: ${path}`
      );
    }

    if (!includeOptions || typeof includeOptions !== "object") {
      return;
    }

    const newVisited = new Set(visitedModels);
    newVisited.add(modelName);

    // Validar cada relación incluida
    for (const [relationKey, relationOptions] of Object.entries(
      includeOptions
    )) {
      if (this.config.trackingEnabled) {
        this.pathHistory.push({
          modelName,
          relationKey,
          depth: currentDepth,
        });
      }

      // Si la relación tiene sus propios includes, validar recursivamente
      if (
        relationOptions &&
        typeof relationOptions === "object" &&
        "include" in relationOptions
      ) {
        // Aquí necesitaríamos obtener el modelo target de la relación
        // Por simplicidad, usamos el relationKey como modelo (esto debería mejorar)
        const targetModelName = this.inferTargetModelName(relationKey);

        this.validateIncludePath(
          targetModelName,
          (relationOptions as any).include,
          currentDepth + 1,
          newVisited
        );
      }
    }
  }

  /**
   * Validar estructura de relaciones en tiempo de definición
   */
  validateRelationStructure(
    models: Map<string, any>,
    maxAllowedCycles: number = 0
  ): ValidationResult {
    const graph = this.buildRelationGraph(models);
    const cycles = this.detectCycles(graph);

    return {
      isValid: cycles.length <= maxAllowedCycles,
      cycles,
      suggestions: this.generateSuggestions(cycles),
    };
  }

  /**
   * Construir grafo de relaciones
   */
  private buildRelationGraph(models: Map<string, any>): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const [modelName, model] of models.entries()) {
      const relations: string[] = [];

      // Esto necesitaría acceso a los metadatos del modelo
      // Por ahora simulamos la extracción de relaciones
      const meta = model.getMeta?.();
      if (meta?.relations) {
        for (const [relationKey, relation] of meta.relations.entries()) {
          const targetModel = relation.targetModel?.()?.name || relationKey;
          relations.push(targetModel);
        }
      }

      graph.set(modelName, relations);
    }

    return graph;
  }

  /**
   * Detectar ciclos usando DFS
   */
  private detectCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Ciclo detectado
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat(node);
        cycles.push(cycle);
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path]);
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Generar sugerencias para resolver ciclos
   */
  private generateSuggestions(cycles: string[][]): string[] {
    const suggestions: string[] = [];

    for (const cycle of cycles) {
      if (cycle.length === 2) {
        suggestions.push(
          `Circular reference between ${cycle[0]} and ${cycle[1]}. Consider using lazy loading or removing one direction.`
        );
      } else {
        suggestions.push(
          `Complex circular reference detected: ${cycle.join(
            " -> "
          )}. Consider breaking the cycle at the weakest relationship.`
        );
      }
    }

    if (cycles.length > 0) {
      suggestions.push(
        "General: Use @NonAttribute for computed relationships or implement lazy loading to break cycles."
      );
    }

    return suggestions;
  }

  /**
   * Inferir nombre del modelo target (simplificado)
   */
  private inferTargetModelName(relationKey: string): string {
    // Conversión simple: posts -> Post, user -> User
    return (
      relationKey.charAt(0).toUpperCase() +
      relationKey.slice(1).replace(/s$/, "")
    );
  }

  /**
   * Crear contexto de rastreo para includes anidados
   */
  createTrackingContext(): CircularTracker {
    return new CircularTracker(this.config.maxIncludeDepth);
  }

  /**
   * Obtener historial de paths para debugging
   */
  getPathHistory(): TraversalPath[] {
    return [...this.pathHistory];
  }

  /**
   * Limpiar historial
   */
  clearHistory(): void {
    this.pathHistory = [];
    this.activePaths.clear();
  }
}

/**
 * Tracker específico para una operación de include
 */
class CircularTracker {
  private visitedModels: Set<string> = new Set();
  private currentPath: string[] = [];
  private maxDepth: number;

  constructor(maxDepth: number) {
    this.maxDepth = maxDepth;
  }

  enter(modelName: string): void {
    if (this.currentPath.length >= this.maxDepth) {
      throw new CircularReferenceError(
        `Maximum include depth ${this.maxDepth} exceeded at: ${modelName}`
      );
    }

    if (this.visitedModels.has(modelName)) {
      const cyclePath = this.currentPath.join(" -> ") + ` -> ${modelName}`;
      throw new CircularReferenceError(
        `Circular reference detected: ${cyclePath}`
      );
    }

    this.visitedModels.add(modelName);
    this.currentPath.push(modelName);
  }

  exit(modelName: string): void {
    this.currentPath.pop();
    this.visitedModels.delete(modelName);
  }

  getCurrentPath(): string[] {
    return [...this.currentPath];
  }
}

interface ValidationResult {
  isValid: boolean;
  cycles: string[][];
  suggestions: string[];
}

class CircularReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircularReferenceError";
  }
}

// Instancia singleton
const circularDetector = new CircularReferenceDetector();

export {
  CircularReferenceDetector,
  CircularReferenceError,
  CircularTracker,
  ValidationResult,
  circularDetector,
};
export default circularDetector;
