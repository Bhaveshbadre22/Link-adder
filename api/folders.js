const db = require('../db');
const { getUserFromRequest } = require('./_auth');

module.exports = async (req, res) => {
  const method = req.method || 'GET';
  if (method === 'GET') {
    const user = getUserFromRequest(req, res);
    if (!user) return;
    try {
      const rows = await db.all('SELECT * FROM folders ORDER BY created_at DESC');
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
    let body = {};
    try { body = req.body || {}; } catch { body = {}; }
    const { name, parent_id } = body;
    if (!name) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'name required' }));
    }
    const parentId = parent_id || null;
    try {
      const result = await db.run('INSERT INTO folders (name, parent_id) VALUES (?, ?) RETURNING id', [name, parentId]);
      const folder = await db.get('SELECT * FROM folders WHERE id = ?', [result.id]);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(folder));
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
