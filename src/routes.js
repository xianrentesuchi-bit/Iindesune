import express from 'express';
import { db } from './db.js';

const router = express.Router();

async function fetchGAS(action, params) {
  const url = new URL(process.env.GAS_WEBAPP_URL);
  url.searchParams.append('action', action);
  for (const key in params) {
    url.searchParams.append(key, params[key]);
  }
  const response = await fetch(url.toString(), { method: 'POST' });
  return await response.json();
}

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await fetchGAS('login', { username, password });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'GAS認証エラー' });
  }
});

router.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await fetchGAS('register', { username, password });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'GAS登録エラー' });
  }
});

router.get('/tweets', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM tweets ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tweets', async (req, res) => {
  const { display_name, username, message, avatar_url } = req.body;
  try {
    await db.execute({
      sql: 'INSERT INTO tweets (display_name, username, message, avatar_url) VALUES (?, ?, ?, ?)',
      args: [display_name, username, message, avatar_url || '']
    });

    const mentionMatch = message.match(/@([a-zA-Z0-9_]+)/);
    if (mentionMatch) {
      const mentionedUser = mentionMatch[1];
      await db.execute({
        sql: 'INSERT INTO notifications (target_username, from_display_name, type, message) VALUES (?, ?, ?, ?)',
        args: [mentionedUser, display_name, 'mention', 'あなた宛てにメンションを送信しました']
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notifications/:username', async (req, res) => {
  try {
    const result = await db.execute({
      sql: 'SELECT * FROM notifications WHERE target_username = ? ORDER BY id DESC',
      args: [req.params.username]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
