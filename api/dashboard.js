const db = require('../db');
const { getUserFromRequest } = require('./_auth');
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

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'method not allowed' }));
  }
  const user = getUserFromRequest(req, res);
  if (!user) return;
  try {
    const currentUser = user.username;
    const today = new Date().toISOString().slice(0, 10);
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

    const now = new Date();
    const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const firstOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    function iso(dt) { return dt.toISOString(); }

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

    const dailyRows = await db.all(
      `SELECT DATE(created_at) as day, COUNT(*) as count
       FROM links
       WHERE created_at >= '${iso(firstOfThisMonth)}'
         AND created_at < '${iso(firstOfNextMonth)}'
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) ASC`
    );

    const folderDistribution = await db.all(
      `SELECT f.name, COUNT(lf.link_id) as count
       FROM folders f
       LEFT JOIN link_folders lf ON f.id = lf.folder_id
       GROUP BY f.id
       ORDER BY count DESC`
    );

    let perUserMonth = await db.all(
      `SELECT u.username,
              u.count,
              p.avatar_path AS avatar_path
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

    if (Array.isArray(perUserMonth) && supabase) {
      perUserMonth = perUserMonth.map((row) => {
        let avatar_url = null;
        if (row.avatar_path) {
          const { data } = supabase
            .storage
            .from(SUPABASE_AVATARS_BUCKET)
            .getPublicUrl(row.avatar_path);
          avatar_url = data && data.publicUrl ? data.publicUrl : null;
        }
        return Object.assign({}, row, { avatar_url });
      });
    } else if (Array.isArray(perUserMonth)) {
      perUserMonth = perUserMonth.map((row) => Object.assign({}, row, { avatar_url: null }));
    }

    const payload = {
      links_today: linksToday ? linksToday.c : 0,
      links_this_month: linksThisMonth ? linksThisMonth.c : 0,
      links_last_month: linksLastMonth ? linksLastMonth.c : 0,
      folders_count: foldersCount ? foldersCount.c : 0,
      most_linked_folder: mostLinked ? { name: mostLinked.name, count: mostLinked.count } : null,
      monthly_links: dailyRows || [],
      folders_breakdown: folderDistribution || [],
      links_by_current_user: linksByUser ? linksByUser.c : 0,
      users_monthly: perUserMonth || []
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message }));
  }
};
