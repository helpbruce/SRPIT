/**
 * Управление версией сессии PDA.
 * При изменении SESSION_VERSION все пользователи автоматически разлогиниваются.
 *
 * Как использовать:
 * 1. Увеличьте SESSION_VERSION чтобы разлогинить всех пользователей
 * 2. При каждом входе сохраняется текущая версия
 * 3. При загрузке страницы версия сравнивается — если не совпадает, пользователь разлогинивается
 */

// УВЕЛИЧИТЕ ЭТУ ВЕРСИЮ чтобы разлогинить всех пользователей
export const SESSION_VERSION = 'v3';

const PDA_SESSION_VERSION_KEY = 'pda_session_version';

/**
 * Проверяет, совпадает ли версия сессии пользователя с текущей.
 * @returns true если версия совпадает (пользователь может оставаться залогиненным)
 */
export function isSessionValid(): boolean {
  try {
    const savedVersion = localStorage.getItem(PDA_SESSION_VERSION_KEY);
    return savedVersion === SESSION_VERSION;
  } catch {
    return false;
  }
}

/**
 * Сохраняет текущую версию сессии при успешном логине.
 */
export function saveSessionVersion(): void {
  try {
    localStorage.setItem(PDA_SESSION_VERSION_KEY, SESSION_VERSION);
  } catch {}
}

/**
 * Очищает все данные сессии PDA (разлогинивает пользователя).
 */
export function clearPdaSession(): void {
  try {
    localStorage.removeItem('pda_login');
    localStorage.removeItem('pda_user_role');
    localStorage.removeItem('pda_can_access_abd');
    localStorage.removeItem(PDA_SESSION_VERSION_KEY);
  } catch {}
}

/**
 * Проверяет валидность сессии и при необходимости разлогинивает.
 * @returns true если сессия валидна
 */
export function validateAndCleanupSession(): boolean {
  if (!isSessionValid()) {
    clearPdaSession();
    return false;
  }
  return true;
}
