/**
 * @file memory-manager.ts
 * @description Memory management and leak prevention
 * @author Miguel Alejandro
 * @fecha 2025-08-31
 */

interface CleanupTask {
  id: string;
  cleanup: () => void;
  interval?: NodeJS.Timeout;
}

class MemoryManager {
  private static instance: MemoryManager;
  private cleanupTasks: Map<string, CleanupTask> = new Map();
  private maxCacheSize = 1000;
  private maxCacheAge = 300000; // 5 minutos

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Registrar una tarea de limpieza
   */
  registerCleanup(id: string, cleanup: () => void, intervalMs?: number): void {
    // Limpiar tarea previa si existe
    this.unregisterCleanup(id);

    const task: CleanupTask = { id, cleanup };
    
    if (intervalMs) {
      task.interval = setInterval(() => {
        try {
          cleanup();
        } catch (error) {
          console.warn(`Cleanup task ${id} failed:`, error);
        }
      }, intervalMs);
    }

    this.cleanupTasks.set(id, task);
  }

  /**
   * Desregistrar y limpiar tarea
   */
  unregisterCleanup(id: string): void {
    const task = this.cleanupTasks.get(id);
    if (task) {
      if (task.interval) {
        clearInterval(task.interval);
      }
      task.cleanup();
      this.cleanupTasks.delete(id);
    }
  }

  /**
   * Limpiar cache con límites de tamaño y edad
   */
  cleanCache<T>(
    cache: Map<string, { data: T; expires: number; created: number }>,
    maxSize: number = this.maxCacheSize
  ): void {
    const now = Date.now();
    
    // Remover entradas expiradas
    for (const [key, entry] of cache.entries()) {
      if (entry.expires <= now || (now - entry.created) > this.maxCacheAge) {
        cache.delete(key);
      }
    }

    // Si aún excede el tamaño, remover las más antiguas
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].created - b[1].created);
      
      const toRemove = entries.slice(0, cache.size - maxSize);
      toRemove.forEach(([key]) => cache.delete(key));
    }
  }

  /**
   * Monitorear uso de memoria
   */
  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Forzar garbage collection si está disponible
   */
  forceGC(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Cleanup completo al shutdown
   */
  shutdown(): void {
    console.log('MemoryManager: Iniciando cleanup completo...');
    
    for (const [id, task] of this.cleanupTasks.entries()) {
      try {
        this.unregisterCleanup(id);
      } catch (error) {
        console.warn(`Error cleaning up task ${id}:`, error);
      }
    }
    
    this.cleanupTasks.clear();
    this.forceGC();
  }
}

// Cleanup automático en shutdown
process.on('SIGTERM', () => MemoryManager.getInstance().shutdown());
process.on('SIGINT', () => MemoryManager.getInstance().shutdown());
process.on('uncaughtException', () => MemoryManager.getInstance().shutdown());

export default MemoryManager;