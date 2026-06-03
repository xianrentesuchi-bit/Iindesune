import express from 'express';
import { db } from './db.js';
import bcrypt from 'bcrypt';
import csurf from 'csurf';

const router = express.Router();
const csrfProtection = csurf({ cookie: { httpOnly: true, secure: true } });

async function fetchGAS(action, params) {
  const url = new URL(process.env.GAS_WEBAPP_URL);
  url.searchParams.append('action', action);
  for (const key in params) {
    url.searchParams.append(key, params[key]);
  }
  const response = await fetch(url.toString(), { method: 'POST' });
  return await response.json();
}

router.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

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
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await fetchGAS('register', { username, password: hashedPassword });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'GAS登録エラー' });
  }
});

router.get('/tweets', async (req, res) => {
  const { tag } = req.query;
  try {
    let result;
    if (tag) {
      result = await db.execute({
        sql: 'SELECT * FROM tweets WHERE reply_to_id IS NULL AND message LIKE ? ORDER BY id DESC',
        args: [`%#${tag}%`]
      });
    } else {
      result = await db.execute('SELECT * FROM tweets WHERE reply_to_id IS NULL ORDER BY id DESC');
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tweets/:id', async (req, res) => {
  const tweetId = req.params.id;
  try {
    const tweetRes = await db.execute({
      sql: 'SELECT * FROM tweets WHERE id = ?',
      args: [tweetId]
    });
    if (tweetRes.rows.length === 0) {
      return res.status(404).json({ error: 'ポストが見つかりません' });
    }
    const mainTweet = tweetRes.rows[0];

    const repliesRes = await db.execute({
      sql: 'SELECT * FROM tweets WHERE reply_to_id = ? ORDER BY id ASC',
      args: [tweetId]
    });

    const cleanMessage = mainTweet.message.replace(/[#@\s]/g, ' ').trim();
    const firstWord = cleanMessage.split(' ')[0] || '';
    let relatedRows = [];
    if (firstWord.length > 1) {
      const relatedRes = await db.execute({
        sql: 'SELECT * FROM tweets WHERE id != ? AND reply_to_id IS NULL AND message LIKE ? LIMIT 5',
        args: [tweetId, `%${firstWord}%`]
      });
      relatedRows = relatedRes.rows;
    }

    res.json({
      tweet: mainTweet,
      replies: repliesRes.rows,
      related: relatedRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tweets', csrfProtection, async (req, res) => {
  const { display_name, username, message, avatar_url, reply_to_id } = req.body;
  try {
    await db.execute({
      sql: 'INSERT INTO tweets (display_name, username, message, avatar_url, reply_to_id) VALUES (?, ?, ?, ?, ?)',
      args: [display_name, username, message, avatar_url || '', reply_to_id || null]
    });

    if (reply_to_id) {
      await db.execute({
        sql: 'UPDATE tweets SET reply_count = reply_count + 1 WHERE id = ?',
        args: [reply_to_id]
      });
    }

    const mentionMatch = message.match(/@([a-zA-Z0-9_]+)/);
    if (mentionMatch) {
      const mentionedUser = mentionMatch[1];
      await db.execute({
        sql: 'INSERT INTO notifications (target_username, from_display_name, type, message) VALUES (?, ?, ?, ?)',
        args: [mentionedUser, display_name, 'mention', reply_to_id ? 'あなたのポストに返信しました' : 'あなた宛てにメンションを送信しました']
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tweets/:id/view', async (req, res) => {
  try {
    await db.execute({
      sql: 'UPDATE tweets SET views_count = views_count + 1 WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tweets/:id/like', csrfProtection, async (req, res) => {
  const { username } = req.body;
  const tweetId = req.params.id;
  try {
    const check = await db.execute({
      sql: 'SELECT id FROM tweet_likes WHERE tweet_id = ? AND username = ?',
      args: [tweetId, username]
    });

    if (check.rows.length > 0) {
      await db.execute({ sql: 'DELETE FROM tweet_likes WHERE tweet_id = ? AND username = ?', args: [tweetId, username] });
      await db.execute({ sql: 'UPDATE tweets SET like_count = MAX(0, like_count - 1) WHERE id = ?', args: [tweetId] });
      res.json({ success: true, action: 'unliked' });
    } else {
      await db.execute({ sql: 'INSERT INTO tweet_likes (tweet_id, username) VALUES (?, ?)', args: [tweetId, username] });
      await db.execute({ sql: 'UPDATE tweets SET like_count = like_count + 1 WHERE id = ?', args: [tweetId] });
      res.json({ success: true, action: 'liked' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tweets/:id/repost', csrfProtection, async (req, res) => {
  const { username, display_name } = req.body;
  const tweetId = req.params.id;
  try {
    const check = await db.execute({
      sql: 'SELECT id FROM tweet_reposts WHERE tweet_id = ? AND username = ?',
      args: [tweetId, username]
    });

    if (check.rows.length > 0) {
      await db.execute({ sql: 'DELETE FROM tweet_reposts WHERE tweet_id = ? AND username = ?', args: [tweetId, username] });
      await db.execute({ sql: 'UPDATE tweets SET repost_count = MAX(0, repost_count - 1) WHERE id = ?', args: [tweetId] });
      await db.execute({ sql: 'DELETE FROM tweets WHERE is_repost_of = ? AND reposted_by = ?', args: [tweetId, username] });
      res.json({ success: true, action: 'unreposted' });
    } else {
      await db.execute({ sql: 'INSERT INTO tweet_reposts (tweet_id, username) VALUES (?, ?)', args: [tweetId, username] });
      await db.execute({ sql: 'UPDATE tweets SET repost_count = repost_count + 1 WHERE id = ?', args: [tweetId] });
      
      const orig = await db.execute({ sql: 'SELECT * FROM tweets WHERE id = ?', args: [tweetId] });
      if (orig.rows.length > 0) {
        const t = orig.rows[0];
        await db.execute({
          sql: 'INSERT INTO tweets (display_name, username, message, avatar_url, is_repost_of, reposted_by) VALUES (?, ?, ?, ?, ?, ?)',
          args: [t.display_name, t.username, t.message, t.avatar_url, tweetId, display_name]
        });
      }
      res.json({ success: true, action: 'reposted' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/hashtags/trends', async (req, res) => {
  try {
    const result = await db.execute("SELECT message FROM tweets WHERE message LIKE '%#%'");
    const tagsMap = {};
    result.rows.forEach(row => {
      const tags = row.message.match(/#[^\s#]+/g);
      if (tags) {
        tags.forEach(tag => {
          const cleanTag = tag.replace('#', '');
          tagsMap[cleanTag] = (tagsMap[cleanTag] || 0) + 1;
        });
      }
    });
    const sorted = Object.keys(tagsMap).map(k => ({ tag: k, count: tagsMap[k] })).sort((a,b) => b.count - a.count);
    res.json(sorted.slice(0, 5));
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
