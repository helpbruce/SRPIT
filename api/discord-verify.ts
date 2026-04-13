// API route for Discord OAuth verification
// Проверка: состоит ли пользователь в определённом Discord сервере

import type { VercelRequest, VercelResponse } from '@vercel/node';

const DISCORD_SERVER_ID = process.env.DISCORD_SERVER_ID || '';
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // HEAD запрос — проверка, настроен ли Discord
  if (req.method === 'HEAD') {
    if (DISCORD_SERVER_ID && DISCORD_BOT_TOKEN) {
      return res.status(200).end();
    }
    return res.status(503).end();
  }

  if (!DISCORD_SERVER_ID || !DISCORD_BOT_TOKEN) {
    return res.status(503).json({ error: 'Discord credentials not configured' });
  }

  // Проверка членства пользователя в сервере через Discord API
  if (req.method === 'POST') {
    const { discordId } = req.body;

    if (!discordId) {
      return res.status(400).json({ error: 'discordId is required' });
    }

    try {
      // Проверяем состоит ли пользователь в гильдии
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${DISCORD_SERVER_ID}/members/${discordId}`,
        {
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          },
        }
      );

      if (response.status === 200) {
        const member = await response.json();
        return res.status(200).json({
          isMember: true,
          user: {
            id: member.user?.id,
            username: member.user?.username,
            discriminator: member.user?.discriminator,
            avatar: member.user?.avatar,
            nick: member.nick,
          },
        });
      } else if (response.status === 404) {
        return res.status(200).json({ isMember: false });
      } else {
        const errorText = await response.text();
        console.error('Discord API error:', response.status, errorText);
        return res.status(response.status).json({ error: 'Discord API error' });
      }
    } catch (error) {
      console.error('Failed to check Discord membership:', error);
      return res.status(500).json({ error: 'Failed to check membership' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
