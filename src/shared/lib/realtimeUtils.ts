/**
 * Debounce helper — предотвращает слишком частые вызовы.
 * Используется для realtime подписок чтобы не спамить Supabase.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Creates a deduplicated async loader — если уже идёт загрузка,
 * повторный вызов верёт тот же Promise.
 */
export function deduplicateLoader<T>(loader: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;

  return async () => {
    if (pending) return pending;
    try {
      pending = loader();
      return await pending;
    } finally {
      pending = null;
    }
  };
}
