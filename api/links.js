const db = require('../db');
const { getUserFromRequest } = require('./_auth');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const dns = require('dns').promises;
const net = require('net');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_AVATARS_BUCKET = process.env.SUPABASE_AVATARS_BUCKET || 'avatars';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

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
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
    return false;
  }
  return false;
}

async function ensurePublicHost(urlStr) {
  const urlObj = new URL(urlStr);
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    throw new Error('only http(s) URLs allowed');
  }
  const lookup = await dns.lookup(urlObj.hostname, { all: true });
  for (const item of lookup) {
    if (isPrivateIP(item.address)) throw new Error('host resolves to private IP');
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
    let videoSrc = '';
    const videoTag = $('video').first();
    if (videoTag && videoTag.length) {
      videoSrc = videoTag.attr('src') || $('video source').first().attr('src') || '';
    }
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

module.exports = async (req, res) => {
  const method = req.method || 'GET';
  if (method === 'GET') {
    const user = getUserFromRequest(req, res);
    if (!user) return;
    try {
      const urlObj = new URL(req.url, 'http://dummy');
      const folderId = urlObj.searchParams.get('folder_id');
      const date = urlObj.searchParams.get('date');
      const start = urlObj.searchParams.get('start');
      const end = urlObj.searchParams.get('end');

      let params = [];
      let whereClauses = [];
      let joinFolder = false;
      if (folderId) {
        joinFolder = true;
        whereClauses.push('lf.folder_id = ?');
        params.push(folderId);
      }
      if (date) {
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

      const baseSelect = `SELECT DISTINCT l.*, p.avatar_path AS created_by_avatar_path FROM links l`;
      const userJoin = ' LEFT JOIN user_profiles p ON p.username = l.created_by';
      const join = joinFolder
        ? `${userJoin} JOIN link_folders lf ON l.id = lf.link_id`
        : `${userJoin} LEFT JOIN link_folders lf ON l.id = lf.link_id`;
      const where = whereClauses.length ? ' WHERE ' + whereClauses.join(' AND ') : '';
      const sql = `${baseSelect} ${join} ${where} ORDER BY l.created_at DESC`;
      let rows = await db.all(sql, params) || [];
      for (const row of rows) {
        const frows = await db.all('SELECT folder_id FROM link_folders WHERE link_id = ?', [row.id]);
        row.folder_ids = frows.map(r => r.folder_id);
        if (row.created_by_avatar_path && supabase) {
          const { data } = supabase
            .storage
            .from(SUPABASE_AVATARS_BUCKET)
            .getPublicUrl(row.created_by_avatar_path);
          row.created_by_avatar_url = data && data.publicUrl ? data.publicUrl : null;
        } else {
          row.created_by_avatar_url = null;
        }
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (method === 'POST') {
    const user = getUserFromRequest(req, res);
    if (!user) return;
    let bodyText = '';
    await new Promise((resolve) => {
      req.on('data', (chunk) => { bodyText += chunk; });
      req.on('end', resolve);
    });
    let body = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = {}; }
    const { url, folder_ids: providedFolders, folder_id, note, force } = body;
    const folder_ids = providedFolders || (folder_id ? [folder_id] : []);
    if (!url) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'url required' }));
    }
    try {
      new URL(url);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'invalid url' }));
    }
    try {
      await ensurePublicHost(url);
      const existing = await db.get('SELECT * FROM links WHERE url = ?', [url]);
      if (existing && !force) {
        const frows = await db.all('SELECT folder_id FROM link_folders WHERE link_id = ?', [existing.id]);
        existing.folder_ids = frows.map(r => r.folder_id);
        res.statusCode = 409;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'duplicate', existing }));
      }
      const preview = await fetchPreview(url);
      const createdBy = user.username || null;
      const result = await db.run(
        'INSERT INTO links (url, title, description, image, video, note, folder_id, created_by) VALUES (?, ?, ?, ?, ?, ?, NULL, ?) RETURNING id',
        [url, preview.title, preview.description, preview.image, preview.video || null, note || null, createdBy]
      );
      const link = await db.get('SELECT * FROM links WHERE id = ?', [result.id]);
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
      const frows2 = await db.all('SELECT folder_id FROM link_folders WHERE link_id = ?', [link.id]);
      link.folder_ids = frows2.map(r => r.folder_id);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(link));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'method not allowed' }));
  }
};
