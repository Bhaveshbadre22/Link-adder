// ...existing code...

// Load environment variables from .env in local development
try {
  require('dotenv').config({ override: true });
} catch (_e) {}

const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Supabase client for avatars and future cloud storage
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_AVATARS_BUCKET = process.env.SUPABASE_AVATARS_BUCKET || 'avatars';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

// Avatar upload storage: in-memory via multer, then upload to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// Very simple in-memory auth for multiple users
// Username is the first name; password is as specified
const users = [
  { username: 'Bhavesh',  password: 'Bhavesh22' },
  { username: 'Sandy',    password: 'Sandy20' },
  { username: 'Mukul',    password: 'Mukul31' },
  { username: 'Prateek',  password: 'Prateek23' },
  { username: 'Sakshi',   password: 'Sakshi30' },
  { username: 'Vaishnavi',password: 'Vaishnavi15' },
  { username: 'Pravin',   password: 'Pravin19' },
  { username: 'Richank',  password: 'Richank17' },
  { username: 'Kshitija', password: 'Kshitija17' }
];

const AUTH_SECRET = process.env.AUTH_SECRET || 'change_this_secret_in_env';

function authRequired(req, res, next) {
  const headerToken = req.header('x-auth-token');
  const authHeader = req.header('authorization') || '';
  let token = headerToken;
  if (!token && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, AUTH_SECRET);
    if (!payload || !payload.username) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.user = { username: payload.username };
    next();
  } catch (_e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const uname = (username || '').toString().trim();
  const pwd = (password || '').toString();
  if (!uname || !pwd) {
    return res.status(400).json({ error: 'username and password are required' });
  }
  // case-insensitive username match so "bhavesh" and "Bhavesh" both work
  const user = users.find(u => u.username.toLowerCase() === uname.toLowerCase() && u.password === pwd);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  // store a normalized username for DB consistency (lowercase)
  const canonicalUsername = user.username.toLowerCase();
  const token = jwt.sign({ username: canonicalUsername }, AUTH_SECRET, { expiresIn: '7d' });
  res.json({ token, username: canonicalUsername });
});

// Logout endpoint (no real action needed for JWT-based auth)

app.post('/api/logout', authRequired, (req, res) => {
  res.json({ success: true });
});

// Current user profile
app.get('/api/me', authRequired, async (req, res) => {
  const username = req.user.username;
  try {
    const profile = await db.get('SELECT * FROM user_profiles WHERE username = ?', [username]);
    let avatar_url = null;
    if (profile && profile.avatar_path) {
      if (supabase) {
        const { data } = supabase
          .storage
          .from(SUPABASE_AVATARS_BUCKET)
          .getPublicUrl(profile.avatar_path);
        avatar_url = data && data.publicUrl ? data.publicUrl : null;
      } else {
        avatar_url = null;
      }
    }
    res.json({ username, avatar_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload profile avatar
app.post('/api/profile/avatar', authRequired, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'no file uploaded' });
  }
  if (!supabase) {
    return res.status(500).json({ error: 'avatar storage not configured' });
  }
  const username = req.user.username;
  const ext = path.extname(req.file.originalname || '') || '.png';
  const storagePath = `${username}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  try {
    const { error: uploadError } = await supabase
      .storage
      .from(SUPABASE_AVATARS_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype || 'image/png',
        upsert: true
      });
    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    const { data } = supabase
      .storage
      .from(SUPABASE_AVATARS_BUCKET)
      .getPublicUrl(storagePath);
    const publicUrl = data && data.publicUrl ? data.publicUrl : null;

    const existing = await db.get('SELECT username FROM user_profiles WHERE username = ?', [username]);
    if (existing) {
      await db.run('UPDATE user_profiles SET avatar_path = ? WHERE username = ?', [storagePath, username]);
    } else {
      await db.run('INSERT INTO user_profiles (username, avatar_path) VALUES (?, ?)', [username, storagePath]);
    }
    res.json({ avatar_url: publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove profile avatar
app.delete('/api/profile/avatar', authRequired, async (req, res) => {
  const username = req.user.username;
  try {
    const profile = await db.get('SELECT avatar_path FROM user_profiles WHERE username = ?', [username]);
    if (profile && profile.avatar_path) {
      if (supabase) {
        await supabase
          .storage
          .from(SUPABASE_AVATARS_BUCKET)
          .remove([profile.avatar_path]);
      }
    }
    await db.run('UPDATE user_profiles SET avatar_path = NULL WHERE username = ?', [username]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats endpoint (auth required)
app.get('/api/dashboard', authRequired, async (req, res) => {
  try {
    const currentUser = req.user && req.user.username;
    const today = new Date().toISOString().slice(0,10);

    // count of links created today: we build the literal timestamps into the
    // SQL to avoid any cross-dialect placeholder quirks.
    const startOfToday = `${today}T00:00:00.000Z`;
    const endOfToday = `${today}T23:59:59.999Z`;
    const linksToday = await db.get(
      `SELECT COUNT(*) as c FROM links
       WHERE created_at >= '${startOfToday}'
         AND created_at <= '${endOfToday}'`
    );

    const mostLinked = await db.get(
      "SELECT f.id, f.name, COUNT(lf.link_id) as count FROM folders f JOIN link_folders lf ON f.id = lf.folder_id GROUP BY f.id ORDER BY count DESC LIMIT 1"
    );

    // links this month vs last month using explicit date ranges so the
    // SQL works on both SQLite and Postgres.
    const now = new Date();
    const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const firstOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    function iso(dt) {
      return dt.toISOString();
    }

    const linksThisMonth = await db.get(
      `SELECT COUNT(*) as c FROM links
       WHERE created_at >= '${iso(firstOfThisMonth)}'
         AND created_at < '${iso(firstOfNextMonth)}'`
    );

    const linksLastMonth = await db.get(
      `SELECT COUNT(*) as c FROM links
       WHERE created_at >= '${iso(firstOfLastMonth)}'
         AND created_at < '${iso(firstOfThisMonth)}'`
    );

    const foldersCount = await db.get('SELECT COUNT(*) as c FROM folders');

    let linksByUser = null;
    if (currentUser) {
      linksByUser = await db.get('SELECT COUNT(*) as c FROM links WHERE created_by = ?', [currentUser]);
    }

    // series of links per day for current month; group by calendar date.
    const dailyRows = await db.all(
      `SELECT DATE(created_at) as day, COUNT(*) as count
       FROM links
       WHERE created_at >= '${iso(firstOfThisMonth)}'
         AND created_at < '${iso(firstOfNextMonth)}'
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    );

    // folder distribution for pie chart (include folders with zero via LEFT JOIN)
    const folderDistribution = await db.all(
      `SELECT f.name, COUNT(lf.link_id) as count
       FROM folders f
       LEFT JOIN link_folders lf ON f.id = lf.folder_id
       GROUP BY f.id
       ORDER BY count DESC`
    );

    // per-user link counts for current month, with avatars if available
    const perUserMonth = await db.all(
      `SELECT u.username,
              u.count,
              p.avatar_path AS avatar_url
       FROM (
         SELECT created_by AS username,
                COUNT(*) AS count
         FROM links
         WHERE created_by IS NOT NULL
           AND created_at >= '${iso(firstOfThisMonth)}'
           AND created_at < '${iso(firstOfNextMonth)}'
         GROUP BY created_by
       ) u
       LEFT JOIN user_profiles p ON p.username = u.username
       ORDER BY u.count DESC`
    );

    res.json({
      links_today: linksToday ? linksToday.c : 0,
      links_this_month: linksThisMonth ? linksThisMonth.c : 0,
      links_last_month: linksLastMonth ? linksLastMonth.c : 0,
      folders_count: foldersCount ? foldersCount.c : 0,
      most_linked_folder: mostLinked ? { name: mostLinked.name, count: mostLinked.count } : null,
      monthly_links: dailyRows || [],
      folders_breakdown: folderDistribution || [],
      links_by_current_user: linksByUser ? linksByUser.c : 0,
      users_monthly: perUserMonth || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isPrivateIP(ip) {
  const kind = net.isIP(ip);
  if (!kind) return false;
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) {
    if (ip === '::1') return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // ULA
    return false;
  }
  return false;
}

async function ensurePublicHost(urlStr) {
  try {
    const urlObj = new URL(urlStr);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('only http(s) URLs allowed');
    }
    const lookup = await dns.lookup(urlObj.hostname, { all: true });
    for (const item of lookup) {
      if (isPrivateIP(item.address)) throw new Error('host resolves to private IP');
    }
    return true;
  } catch (err) {
    throw err;
  }
}

async function fetchPreview(url) {
  try {
    await ensurePublicHost(url);
    const res = await fetch(url, { timeout: 8000 });
    const html = await res.text();
    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const title = (ogTitle || $('title').first().text() || '').trim();
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const desc = (ogDesc || $('meta[name="description"]').attr('content') || '').trim();
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const ogVideo = $('meta[property="og:video"]').attr('content') || $('meta[property="og:video:url"]').attr('content') || $('meta[property="og:video:secure_url"]').attr('content') || $('meta[name="twitter:player"]').attr('content') || '';
    // try to find <video> source
    let videoSrc = '';
    const videoTag = $('video').first();
    if (videoTag && videoTag.length) {
      videoSrc = videoTag.attr('src') || $('video source').first().attr('src') || '';
    }
    // clean description: remove hashtags/mentions and trim for Instagram
    function cleanDescription(text, hostname) {
      if (!text) return '';
      let s = text.replace(/#[\w-]+/g, '').replace(/@[\w.]+/g, '').replace(/\s{2,}/g, ' ').trim();
      if (hostname && hostname.includes('instagram.com')) s = '';
      if (s.length > 300) s = s.slice(0, 300) + '...';
      return s;
    }
    let hostname = '';
    try { hostname = new URL(url).hostname; } catch (e) {}
    const cleanDesc = cleanDescription(desc, hostname);
    const video = ogVideo || videoSrc || '';
    return { title, description: cleanDesc, image: ogImage, video };
  } catch (err) {
    return { title: '', description: '', image: '' };
  }
}

// Folders
app.post('/api/folders', authRequired, async (req, res) => {
  const { name, parent_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const parentId = parent_id || null;
  try {
    const result = await db.run('INSERT INTO folders (name, parent_id) VALUES (?, ?) RETURNING id', [name, parentId]);
    const folder = await db.get('SELECT * FROM folders WHERE id = ?', [result.id]);
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// rename folder
app.put('/api/folders/:id', authRequired, async (req, res) => {
  const id = req.params.id;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    await db.run('UPDATE folders SET name = ? WHERE id = ?', [name, id]);
    const folder = await db.get('SELECT * FROM folders WHERE id = ?', [id]);
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// delete folder (and its subfolders) and cleanup orphaned links
app.delete('/api/folders/:id', authRequired, async (req, res) => {
  const id = req.params.id;
  async function deleteFolderTree(folderId) {
    const children = await db.all('SELECT id FROM folders WHERE parent_id = ?', [folderId]);
    for (const child of children) {
      await deleteFolderTree(child.id);
    }
    await db.run('DELETE FROM link_folders WHERE folder_id = ?', [folderId]);
    await db.run('DELETE FROM folders WHERE id = ?', [folderId]);
  }
  try {
    await deleteFolderTree(id);
    // delete links that no longer have any folder association
    const orphaned = await db.all(
      `SELECT l.id FROM links l LEFT JOIN link_folders lf ON l.id = lf.link_id WHERE lf.link_id IS NULL`
    );
    if (orphaned && orphaned.length) {
      for (const r of orphaned) {
        await db.run('DELETE FROM links WHERE id = ?', [r.id]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/folders', authRequired, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM folders ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Links
app.post('/api/links', authRequired, async (req, res) => {
  const { url } = req.body;
  const folder_ids = req.body.folder_ids || (req.body.folder_id ? [req.body.folder_id] : []);
  const note = req.body.note || null;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    try { new URL(url); } catch (_) { return res.status(400).json({ error: 'invalid url' }); }
    await ensurePublicHost(url);
    // check duplicate
    const existing = await db.get('SELECT * FROM links WHERE url = ?', [url]);
    if (existing && !req.body.force) {
      // fetch existing folder associations
      const frows = await db.all('SELECT folder_id FROM link_folders WHERE link_id = ?', [existing.id]);
      existing.folder_ids = frows.map(r => r.folder_id);
      return res.status(409).json({ error: 'duplicate', existing });
    }

    const preview = await fetchPreview(url);
    const createdBy = req.user && req.user.username ? req.user.username : null;
    const result = await db.run(
      'INSERT INTO links (url, title, description, image, video, note, folder_id, created_by) VALUES (?, ?, ?, ?, ?, ?, NULL, ?) RETURNING id',
      [url, preview.title, preview.description, preview.image, preview.video || null, note, createdBy]
    );
    const link = await db.get('SELECT * FROM links WHERE id = ?', [result.id]);
    // insert folder associations (portable SQL without INSERT OR IGNORE)
    if (Array.isArray(folder_ids) && folder_ids.length) {
      for (const fid of folder_ids) {
        const existingLinkFolder = await db.get(
          'SELECT 1 FROM link_folders WHERE link_id = ? AND folder_id = ?',
          [link.id, fid]
        );
        if (!existingLinkFolder) {
          await db.run('INSERT INTO link_folders (link_id, folder_id) VALUES (?, ?)', [link.id, fid]);
        }
      }
    }
    // return link with folder_ids
    const frows2 = await db.all('SELECT folder_id FROM link_folders WHERE link_id = ?', [link.id]);
    link.folder_ids = frows2.map(r => r.folder_id);
    res.json(link);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/links', authRequired, async (req, res) => {
  const folderId = req.query.folder_id;
  // optional date filtering: date=YYYY-MM-DD OR start=YYYY-MM-DD&end=YYYY-MM-DD
  const date = req.query.date;
  const start = req.query.start;
  const end = req.query.end;
  try {
    let params = [];
    let whereClauses = [];
    let joinFolder = false;
    if (folderId) {
      joinFolder = true;
      whereClauses.push('lf.folder_id = ?');
      params.push(folderId);
    }
    if (date) {
      // filter by single day using an inclusive day range
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;
      whereClauses.push('l.created_at >= ? AND l.created_at <= ?');
      params.push(startOfDay, endOfDay);
    } else if (start || end) {
      if (start) {
        whereClauses.push('l.created_at >= ?');
        params.push(`${start}T00:00:00.000Z`);
      }
      if (end) {
        whereClauses.push('l.created_at <= ?');
        params.push(`${end}T23:59:59.999Z`);
      }
    }

    const baseSelect = `SELECT DISTINCT l.* FROM links l`;
    const join = joinFolder ? ' JOIN link_folders lf ON l.id = lf.link_id' : ' LEFT JOIN link_folders lf ON l.id = lf.link_id';
    const where = whereClauses.length ? ' WHERE ' + whereClauses.join(' AND ') : '';
    const sql = `${baseSelect} ${join} ${where} ORDER BY l.created_at DESC`;
    let rows = await db.all(sql, params) || [];

    // For each link, fetch its folder_ids in a separate portable query
    for (const row of rows) {
      const frows = await db.all('SELECT folder_id FROM link_folders WHERE link_id = ?', [row.id]);
      row.folder_ids = frows.map(r => r.folder_id);
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/links/:id', async (req, res) => {
  const id = req.params.id;
  // accept either folder_ids (array) or folder_id (single) as fallback
  const folder_ids = req.body.folder_ids || (req.body.folder_id ? [req.body.folder_id] : undefined);
  const { title, description, url, note } = req.body;
  try {
    const existing = await db.get('SELECT * FROM links WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'not found' });
    let newTitle = title !== undefined ? title : existing.title;
    let newDesc = description !== undefined ? description : existing.description;
    let newImage = existing.image;
    let newVideo = existing.video;
    let newUrl = url !== undefined ? url : existing.url;
    let newNote = note !== undefined ? note : existing.note;
    if (url && url !== existing.url) {
      try { new URL(url); } catch (_) { return res.status(400).json({ error: 'invalid url' }); }
      await ensurePublicHost(url);
      const preview = await fetchPreview(url);
      newTitle = preview.title || newTitle;
      newDesc = preview.description || newDesc;
      newImage = preview.image || newImage;
      newVideo = preview.video || newVideo;
    }
    await db.run(
      'UPDATE links SET url = ?, title = ?, description = ?, image = ?, video = ?, note = ? WHERE id = ?',
      [newUrl, newTitle, newDesc, newImage, newVideo, newNote, id]
    );
    // update folder associations if provided
    if (Array.isArray(folder_ids)) {
      await db.run('DELETE FROM link_folders WHERE link_id = ?', [id]);
      for (const fid of folder_ids) {
        await db.run('INSERT INTO link_folders (link_id, folder_id) VALUES (?, ?)', [id, fid]);
      }
    }
    const link = await db.get('SELECT * FROM links WHERE id = ?', [id]);
    const frows = await db.all('SELECT folder_id FROM link_folders WHERE link_id = ?', [id]);
    link.folder_ids = frows.map(r => r.folder_id);
    res.json(link);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/links/:id', async (req, res) => {
  const id = req.params.id;
  try {
    await db.run('DELETE FROM link_folders WHERE link_id = ?', [id]);
    await db.run('DELETE FROM links WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Link Storer server running on port ${PORT}`);
});
