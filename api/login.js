const jwt = require('jsonwebtoken');

// Hard-coded users, same as in server.js
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ error: 'method not allowed' });
  }

  const { username, password } = req.body || {};
  const uname = (username || '').toString().trim();
  const pwd = (password || '').toString();

  if (!uname || !pwd) {
    res.statusCode = 400;
    return res.json({ error: 'username and password are required' });
  }

  const user = users.find(u => u.username.toLowerCase() === uname.toLowerCase() && u.password === pwd);
  if (!user) {
    res.statusCode = 401;
    return res.json({ error: 'Invalid username or password' });
  }

  const canonicalUsername = user.username.toLowerCase();
  const token = jwt.sign({ username: canonicalUsername }, AUTH_SECRET, { expiresIn: '7d' });

  res.statusCode = 200;
  return res.json({ token, username: canonicalUsername });
};
