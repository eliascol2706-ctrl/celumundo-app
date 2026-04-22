/**
 * Sistema de caché en memoria para optimizar peticiones a Supabase
 * Reduce drásticamente las llamadas a la base de datos
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // milisegundos
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutos por defecto

  /**
   * Obtener dato del caché
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Verificar si expiró
    const now = Date.now();
    if (now - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Guardar dato en caché
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: ttl || this.defaultTTL
    });
  }

  /**
   * Invalidar una clave específica
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidar todas las claves que empiezan con un prefijo
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Limpiar todo el caché
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtener tamaño del caché
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Ejecutar función con caché
   */
  async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Intentar obtener del caché
    const cached = this.get<T>(key);
    if (cached !== null) {
      console.log(`[CACHE HIT] ${key}`);
      return cached;
    }

    // Si no está en caché, ejecutar función
    console.log(`[CACHE MISS] ${key}`);
    const result = await fn();

    // Guardar en caché
    this.set(key, result, ttl);

    return result;
  }
}

// Singleton
export const cache = new MemoryCache();

// Utilidades para generar claves de caché
export const cacheKeys = {
  products: (company: string) => `products:${company}`,
  product: (id: string, company: string) => `product:${id}:${company}`,
  departments: (company: string) => `departments:${company}`,
  customers: (company: string) => `customers:${company}`,
  invoices: (company: string) => `invoices:${company}`,
  movements: (company: string) => `movements:${company}`,
  exchanges: (company: string) => `exchanges:${company}`,
  warranties: (company: string) => `warranties:${company}`,
  catalogItems: (company: string) => `catalog:${company}`,
};

// Función para invalidar caché cuando se modifica data
export const invalidateCache = {
  products: (company: string) => {
    cache.invalidatePrefix(`products:${company}`);
    cache.invalidatePrefix(`product:`);
  },
  departments: (company: string) => {
    cache.invalidate(cacheKeys.departments(company));
  },
  customers: (company: string) => {
    cache.invalidate(cacheKeys.customers(company));
  },
  invoices: (company: string) => {
    cache.invalidate(cacheKeys.invoices(company));
  },
  catalog: (company: string) => {
    cache.invalidate(cacheKeys.catalogItems(company));
  },
  all: () => {
    cache.clear();
    console.log('[CACHE] Todo el caché ha sido limpiado');
  }
};

// Limpiar caché al iniciar (solo en desarrollo)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  cache.clear();
  console.log('[CACHE] Caché limpiado al iniciar (modo desarrollo)');
}
