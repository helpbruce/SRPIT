/**
 * Периодическая проверка членства в Discord сервере.
 * Проверяет каждые CHECK_INTERVAL миллисекунд.
 * При неудачной проверке вызывает onMemberLeft callback.
 */

const DISCORD_SERVER_ID = '1000026315476455445';

// Интервал проверки: 10 минут (оптимизация для снижения нагрузки на Supabase)
export const CHECK_INTERVAL = 10 * 60 * 1000;

const DISCORD_TOKEN_KEY = 'srpit_discord_token';
const DISCORD_TOKEN_TIMESTAMP_KEY = 'srpit_discord_token_timestamp';

// Токен хранится 30 минут, потом нужно переавторизоваться
const TOKEN_TTL = 30 * 60 * 1000;

/**
 * Сохраняет Discord access token
 */
export function saveDiscordToken(token: string): void {
  try {
    localStorage.setItem(DISCORD_TOKEN_KEY, token);
    localStorage.setItem(DISCORD_TOKEN_TIMESTAMP_KEY, String(Date.now()));
  } catch {}
}

/**
 * Получает сохранённый токен (если он ещё валиден)
 */
export function getDiscordToken(): string | null {
  try {
    const token = localStorage.getItem(DISCORD_TOKEN_KEY);
    const timestamp = localStorage.getItem(DISCORD_TOKEN_TIMESTAMP_KEY);
    if (!token || !timestamp) return null;
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > TOKEN_TTL) {
      clearDiscordToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Очищает сохранённый токен
 */
export function clearDiscordToken(): void {
  try {
    localStorage.removeItem(DISCORD_TOKEN_KEY);
    localStorage.removeItem(DISCORD_TOKEN_TIMESTAMP_KEY);
  } catch {}
}

/**
 * Проверяет членство пользователя в Discord сервере по заданному токену.
 * @returns true если пользователь всё ещё участник сервера
 */
async function checkDiscordMembership(token: string | null): Promise<boolean> {
  if (!token) return false;

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return false;
    }

    const guilds = await response.json();
    return guilds.some((g: any) => g.id === DISCORD_SERVER_ID);
  } catch {
    return false;
  }
}

/**
 * Проверяет членство пользователя в Discord сервере используя сохранённый токен.
 * @returns true если пользователь всё ещё участник сервера
 */
export async function checkDiscordMembershipWithToken(): Promise<boolean> {
  const token = getDiscordToken();
  if (!token) return false;

  const isMember = await checkDiscordMembership(token);
  if (!isMember) {
    // Токен протух или невалиден
    clearDiscordToken();
    return false;
  }

  return true;
}

/**
 * Запускает периодическую проверку Discord membership.
 * @param onMemberLeft - callback вызывается когда пользователь больше не участник сервера
 * @param token - необязательный свежий access token
 * @returns функция для остановки проверки
 */
export function startDiscordPeriodicCheck(
  onMemberLeft: () => void,
  token: string | null = null
): () => void {
  const check = async () => {
    const isMember = token ? await checkDiscordMembership(token) : await checkDiscordMembershipWithToken();
    if (!isMember) {
      onMemberLeft();
    }
  };

  const intervalId = setInterval(() => {
    check();
  }, CHECK_INTERVAL);

  return () => clearInterval(intervalId);
}

