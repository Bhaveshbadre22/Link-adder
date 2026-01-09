const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const db = require('../../db');
const { getUserFromRequest } = require('../_auth');

// Multer in-memory storage for serverless function
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB
});

// Supabase client (same env vars as server.js)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_AVATARS_BUCKET = process.env.SUPABASE_AVATARS_BUCKET || 'avatars';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = (req, res) => {
  const method = req.method || 'GET';

  if (method === 'POST') {
    const user = getUserFromRequest(req, res);
    if (!user) return; // getUserFromRequest already sent response

    if (!supabase) {
      return json(res, 500, { error: 'avatar storage not configured' });
    }

    upload.single('avatar')(req, res, async (err) => {
      if (err) {
        return json(res, 400, { error: err.message || 'upload failed' });
      }
      if (!req.file) {
        return json(res, 400, { error: 'no file uploaded' });
      }

      const username = user.username;
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
          return json(res, 500, { error: uploadError.message });
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

        return json(res, 200, { avatar_url: publicUrl });
      } catch (e) {
        return json(res, 500, { error: e.message });
      }
    });
  } else if (method === 'DELETE') {
    const user = getUserFromRequest(req, res);
    if (!user) return;

    const username = user.username;
    (async () => {
      try {
        const profile = await db.get('SELECT avatar_path FROM user_profiles WHERE username = ?', [username]);
        if (profile && profile.avatar_path && supabase) {
          await supabase
            .storage
            .from(SUPABASE_AVATARS_BUCKET)
            .remove([profile.avatar_path]);
        }
        await db.run('UPDATE user_profiles SET avatar_path = NULL WHERE username = ?', [username]);
        return json(res, 200, { success: true });
      } catch (e) {
        return json(res, 500, { error: e.message });
      }
    })();
  } else {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Allow', 'POST, DELETE');
    res.end(JSON.stringify({ error: 'method not allowed' }));
  }
};
