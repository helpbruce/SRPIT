// Утилита для кеширования данных в localStorage с автоматической синхронизацией с Supabase

export interface CacheOptions {
  ttl?: number; // Time to live в миллисекундах (по умолчанию 30 минут)
  key: string; // Уникальный ключ для кеша
}

// Версия кэша — при изменении структуры данных все старые кэши инвалидируются
const CACHE_VERSION = 1;

export class CacheManager {
  private static prefix = 'srpit_v' + CACHE_VERSION + '_';

  // TTL по умолчанию: 30 минут для персонажей, 1 час для бестиария
  static DEFAULT_TTL = 30 * 60 * 1000;
  static LONG_TTL = 60 * 60 * 1000;

  static set<T>(key: string, data: T, ttl: number = CacheManager.DEFAULT_TTL): void {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (e: any) {
      // Quota exceeded — очищаем старые кеши и пробуем снова
      try {
        this.clearAll();
        const item = { data, timestamp: Date.now(), ttl };
        localStorage.setItem(this.prefix + key, JSON.stringify(item));
      } catch (e2) {
        console.warn('Cache quota exceeded, skipping:', key);
      }
    }
  }

  static get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(this.prefix + key);
      if (!itemStr) return null;

      const item = JSON.parse(itemStr);
      const now = Date.now();

      // Проверяем TTL
      if (now - item.timestamp > item.ttl) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }

      return item.data as T;
    } catch (e) {
      console.warn('Failed to read cache:', e);
      return null;
    }
  }

  // Получить данные, даже если кэш истёк (возвращает stale данные + флаг)
  static getStale<T>(key: string): { data: T | null; isStale: boolean } {
    try {
      const itemStr = localStorage.getItem(this.prefix + key);
      if (!itemStr) return { data: null, isStale: false };

      const item = JSON.parse(itemStr);
      const now = Date.now();
      const isStale = now - item.timestamp > item.ttl;

      return { data: item.data as T, isStale };
    } catch (e) {
      return { data: null, isStale: false };
    }
  }

  static clear(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch (e) {
      console.warn('Failed to clear cache:', e);
    }
  }

  static clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Failed to clear all cache:', e);
    }
  }

  // Очистить только кэши с истёкшим TTL
  static sweepExpired(): void {
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          try {
            const itemStr = localStorage.getItem(key);
            if (itemStr) {
              const item = JSON.parse(itemStr);
              if (now - item.timestamp > item.ttl) {
                localStorage.removeItem(key);
              }
            }
          } catch {
            // Невалидный JSON — удалить
            localStorage.removeItem(key);
          }
        }
      });
    } catch (e) {
      // ignore
    }
  }
}
