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
    } catch (e: any) {
      // Quota exceeded — очищаем самые старые кеши и пробуем снова
      try {
        this.clearOldest(3);
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

  static clearOldest(count: number): void {
    try {
      const keys = Object.keys(localStorage)
        .filter(key => key.startsWith(this.prefix))
        .map(key => {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '');
            return { key, timestamp: item.timestamp || 0 };
          } catch {
            return { key, timestamp: 0 };
          }
        })
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, count);

      keys.forEach(({ key }) => {
        localStorage.removeItem(key);
      });
    } catch (e) {
      console.warn('Failed to clear oldest cache:', e);
    }
  }
}
