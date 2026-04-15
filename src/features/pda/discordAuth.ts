// Discord OAuth2 verification - полностью на фронтенде
// Пользователь авторизуется через Discord popup, проверяем членство в сервере

// Хардкодим переменные для гарантии работы на Vercel
const DISCORD_CLIENT_ID = '1493292269011210352';
const DISCORD_SERVER_ID = '1000026315476455445';

const REDIRECT_URI = window.location.origin + '/discord-callback.html';

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

// Открывает Discord OAuth popup и возвращает access token
function openDiscordAuth(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!DISCORD_CLIENT_ID) {
      console.warn('DISCORD_CLIENT_ID not configured');
      resolve(null);
      return;
    }

    const scope = 'identify guilds';
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(scope)}`;

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(authUrl, 'discord-auth', `width=${width},height=${height},left=${left},top=${top}`);

    if (!popup) {
      alert('Разрешите всплывающие окна для Discord авторизации');
      resolve(null);
      return;
    }

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        resolve(null);
      }
    }, 500);

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'discord-auth-success') {
        clearInterval(checkClosed);
        window.removeEventListener('message', handler);
        popup.close();
        resolve(event.data.accessToken as string);
      }
    };
    window.addEventListener('message', handler);
  });
}

// Проверяет членство пользователя в сервере через Discord API
async function checkGuildMembership(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return false;

    const guilds = await response.json();
    return guilds.some((g: any) => g.id === DISCORD_SERVER_ID);
  } catch {
    return false;
  }
}

// Главная функция: открывает Discord OAuth и проверяет членство
export async function verifyDiscordMembership(): Promise<{ success: boolean; user?: DiscordUser; accessToken?: string }> {
  const accessToken = await openDiscordAuth();
  if (!accessToken) return { success: false };

  const isMember = await checkGuildMembership(accessToken);
  if (!isMember) return { success: false };

  // Получаем инфо о пользователе
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) {
      const user = await response.json();
      return { success: true, user, accessToken };
    }
  } catch {
    // ignore
  }

  return { success: true, accessToken };
}

// Проверяет, настроен ли Discord (есть ли Client ID и Server ID)
export function isDiscordConfigured(): boolean {
  return !!(DISCORD_CLIENT_ID && DISCORD_SERVER_ID);
}
