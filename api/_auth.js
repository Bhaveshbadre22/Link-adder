const jwt = require('jsonwebtoken');

const AUTH_SECRET = process.env.AUTH_SECRET || 'change_this_secret_in_env';

function getUserFromRequest(req, res) {
  const headers = req.headers || {};
  const headerToken = headers['x-auth-token'] || headers['x-auth-token'.toLowerCase()];
  const authHeader = headers['authorization'] || headers['Authorization'] || '';
  let token = headerToken;
  if (!token && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return null;
  }
  try {
    const payload = jwt.verify(token, AUTH_SECRET);
    if (!payload || !payload.username) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return null;
    }
    return { username: payload.username };
  } catch (_e) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return null;
  }
}

module.exports = { getUserFromRequest };
