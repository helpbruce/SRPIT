// Discord API helper functions

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

// Получение Discord user ID через OAuth2 popup flow
export function getDiscordUserId(): Promise<DiscordUser | null> {
  return new Promise((resolve) => {
    if (!DISCORD_CLIENT_ID) {
      console.warn('DISCORD_CLIENT_ID not configured');
      resolve(null);
      return;
    }

    const redirectUri = window.location.origin + '/discord-callback.html';
    const scope = 'identify guilds';
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'discord-auth',
      `width=${width},height=${height},left=${left},top=${top}`
    );

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

    // Слушаем message от popup
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'discord-auth-success') {
        clearInterval(checkClosed);
        window.removeEventListener('message', handler);
        popup.close();
        resolve(event.data.user as DiscordUser);
      }
    };
    window.addEventListener('message', handler);
  });
}

// Проверка: требуется ли Discord верификация
// Фронтенд читает переменную VITE_DISCORD_REQUIRED напрямую
export function isDiscordVerificationRequired(): boolean {
  return import.meta.env.VITE_DISCORD_REQUIRED === 'true';
}

// Проверка членства пользователя в Discord сервере
export async function checkDiscordMembership(userId: string): Promise<{ isMember: boolean; user?: any }> {
  try {
    const response = await fetch('/api/discord-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordId: userId }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Discord verification failed:', response.status, errorText);
      return { isMember: false };
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to check Discord membership:', error);
    return { isMember: false };
  }
}
