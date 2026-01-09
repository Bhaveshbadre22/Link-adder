const path = require('path');

// Simple DB abstraction that can use either SQLite (for local dev)
// or Postgres (for production / Vercel with external DB).
// Choose backend via DB_CLIENT env var: 'pg' or 'sqlite' (default).

const client = (process.env.DB_CLIENT || 'sqlite').toLowerCase();

// Small debug to confirm which DB host is being used
if (client === 'pg' && process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    // Will print something like: Using Postgres DB at db.gtvqjbhwsoxuktnlrsrq.supabase.co
    console.log('Using Postgres DB at', u.hostname);
  } catch (_e) {}
}

let dbApi;

if (client === 'pg') {
  // Postgres backend (external DB, e.g. Supabase/Neon/Railway)
  const { Pool } = require('pg');

  // DATABASE_URL should be a standard Postgres connection string
  // e.g. postgres://user:password@host:5432/dbname
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Convert our SQLite-style '?' placeholders into Postgres $1, $2, ...
  function toPg(sql, params) {
    let i = 0;
    const text = sql.replace(/\?/g, () => {
      i += 1;
      return '$' + i;
    });
    return { text, params };
  }

  dbApi = {
    run(sql, params = []) {
      const { text, params: finalParams } = toPg(sql, params);
      return pool.query(text, finalParams).then(result => {
        const hasReturning = /\breturning\b/i.test(sql);
        if (hasReturning && result.rows && result.rows[0] && Object.prototype.hasOwnProperty.call(result.rows[0], 'id')) {
          return { id: result.rows[0].id };
        }
        return { id: undefined };
      });
    },
    all(sql, params = []) {
      const { text, params: finalParams } = toPg(sql, params);
      return pool.query(text, finalParams).then(result => result.rows || []);
    },
    get(sql, params = []) {
      const { text, params: finalParams } = toPg(sql, params);
      return pool.query(text, finalParams).then(result => (result.rows && result.rows[0]) || null);
    }
  };
} else {
  // SQLite backend (local dev only)
  const sqlite3 = require('sqlite3').verbose();

  // Allow overriding the database location via environment variable for hosting
  // (falls back to a local file for development).
  const dbFile = process.env.DB_FILE || path.join(__dirname, 'data.sqlite');
  const rawDb = new sqlite3.Database(dbFile);

  rawDb.serialize(() => {
    rawDb.run(`CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(parent_id) REFERENCES folders(id)
    )`);

    // ensure parent_id exists for older DBs
    rawDb.all("PRAGMA table_info(folders)", (err, rows) => {
      if (err) return;
      const hasParent = rows && rows.some(r => r.name === 'parent_id');
      if (!hasParent) {
        rawDb.run('ALTER TABLE folders ADD COLUMN parent_id INTEGER');
      }
    });

    rawDb.run(`CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      image TEXT,
      note TEXT,
      folder_id INTEGER,
      video TEXT,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(folder_id) REFERENCES folders(id)
    )`);
    // ensure 'note' column exists for older DBs
    rawDb.all("PRAGMA table_info(links)", (err, rows) => {
      if (err) return;
      const hasNote = rows && rows.some(r => r.name === 'note');
      if (!hasNote) {
        rawDb.run('ALTER TABLE links ADD COLUMN note TEXT');
      }
    });
    // ensure 'video' column exists for storing preview video URLs
    rawDb.all("PRAGMA table_info(links)", (err2, rows2) => {
      if (err2) return;
      const hasVideo = rows2 && rows2.some(r => r.name === 'video');
      if (!hasVideo) {
        rawDb.run('ALTER TABLE links ADD COLUMN video TEXT');
      }
      // ensure 'created_at' exists for dashboards relying on timestamps
      const hasCreatedAt = rows2 && rows2.some(r => r.name === 'created_at');
      if (!hasCreatedAt) {
        rawDb.run('ALTER TABLE links ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      }
      const hasCreatedBy = rows2 && rows2.some(r => r.name === 'created_by');
      if (!hasCreatedBy) {
        rawDb.run('ALTER TABLE links ADD COLUMN created_by TEXT');
      }
    });
    // create junction table for many-to-many link<->folder
    rawDb.run(`CREATE TABLE IF NOT EXISTS link_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL,
      folder_id INTEGER NOT NULL,
      UNIQUE(link_id, folder_id),
      FOREIGN KEY(link_id) REFERENCES links(id),
      FOREIGN KEY(folder_id) REFERENCES folders(id)
    )`);

    // migrate existing links.folder_id into link_folders (idempotent)
    rawDb.all('SELECT id, folder_id FROM links WHERE folder_id IS NOT NULL', (err, rows) => {
      if (err || !rows) return;
      rows.forEach(r => {
        if (!r.folder_id) return;
        rawDb.run('INSERT OR IGNORE INTO link_folders (link_id, folder_id) VALUES (?, ?)', [r.id, r.folder_id]);
      });
    });

    // simple profiles table for storing per-user avatar path
    rawDb.run(`CREATE TABLE IF NOT EXISTS user_profiles (
      username TEXT PRIMARY KEY,
      avatar_path TEXT,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });

  dbApi = {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        });
      });
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      });
    },
    get(sql, params = []) {
      return new Promise((resolve, reject) => {
        rawDb.get(sql, params, (err, row) => {
          if (err) return reject(err);
          resolve(row);
        });
      });
    }
  };
}

module.exports = dbApi;
