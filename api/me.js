const { createClient } = require('@supabase/supabase-js');
const db = require('../db');
const { getUserFromRequest } = require('./_auth');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_AVATARS_BUCKET = process.env.SUPABASE_AVATARS_BUCKET || 'avatars';

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'method not allowed' }));
  }
  const user = getUserFromRequest(req, res);
  if (!user) return;
  const username = user.username;
  try {
    const profile = await db.get('SELECT * FROM user_profiles WHERE username = ?', [username]);
    let avatar_url = null;
    if (profile && profile.avatar_path && supabase) {
      const { data } = supabase
        .storage
        .from(SUPABASE_AVATARS_BUCKET)
        .getPublicUrl(profile.avatar_path);
      avatar_url = data && data.publicUrl ? data.publicUrl : null;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ username, avatar_url }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
