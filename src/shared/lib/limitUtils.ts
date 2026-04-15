/**
 * Утилита для определения ошибки превышения лимитов Supabase.
 * При превышении лимитов Supabase возвращает HTTP 500.
 */

const LIMIT_EXCEEDED_KEY = 'srpit_limit_exceeded';
const LIMIT_RETRY_AFTER = 60 * 60 * 1000; // 1 час перед повторной попыткой

export function isLimitExceededError(error: any): boolean {
  if (!error) return false;
  // Supabase возвращает ошибку с кодом или сообщением о лимитах
  const code = error.code || error.status;
  const message = error.message || '';
  return (
    code === 500 ||
    code === 'PGRST301' ||
    message.includes('exceeds') ||
    message.includes('limit') ||
    message.includes('quota')
  );
}

export function markLimitExceeded(): void {
  try {
    localStorage.setItem(LIMIT_EXCEEDED_KEY, String(Date.now()));
  } catch {}
}

export function shouldRetryFetch(): boolean {
  try {
    const timestamp = localStorage.getItem(LIMIT_EXCEEDED_KEY);
    if (!timestamp) return true;
    const elapsed = Date.now() - parseInt(timestamp, 10);
    return elapsed > LIMIT_RETRY_AFTER;
  } catch {
    return true;
  }
}

export function clearLimitFlag(): void {
  try {
    localStorage.removeItem(LIMIT_EXCEEDED_KEY);
  } catch {}
}
