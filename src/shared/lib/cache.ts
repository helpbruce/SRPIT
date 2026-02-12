// Утилита для кеширования данных в localStorage с автоматической синхронизацией с Supabase

export interface CacheOptions {
  ttl?: number; // Time to live в миллисекундах (по умолчанию 5 минут)
  key: string; // Уникальный ключ для кеша
}

export class CacheManager {
  private static prefix = 'srpit_cache_';

  static set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    try {
      const item = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(item));
    } catch (e) {
      console.warn('Failed to cache data:', e);
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
}
