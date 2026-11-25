const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DEFAULT_COMPANIES } = require('./math/mcdm');

const dbPath = path.resolve(__dirname, 'logistics_dss.sqlite');
const db = new sqlite3.Database(dbPath);

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function initDatabase() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cost REAL NOT NULL,
      time REAL NOT NULL,
      reliability REAL NOT NULL,
      quality REAL NOT NULL
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      weights_json TEXT NOT NULL,
      constraints_json TEXT NOT NULL,
      companies_json TEXT NOT NULL,
      result_json TEXT NOT NULL
    )
  `);

  const countRow = await getQuery('SELECT COUNT(*) as cnt FROM companies');
  if (!countRow || countRow.cnt === 0) {
    for (const c of DEFAULT_COMPANIES) {
      await runQuery(
        'INSERT INTO companies (name, cost, time, reliability, quality) VALUES (?, ?, ?, ?, ?)',
        [c.name, c.cost, c.time, c.reliability, c.quality]
      );
    }
  }
}

async function resetCompaniesToDefault() {
  await runQuery('DELETE FROM companies');
  await runQuery("DELETE FROM sqlite_sequence WHERE name='companies'");
  for (const c of DEFAULT_COMPANIES) {
    await runQuery(
      'INSERT INTO companies (name, cost, time, reliability, quality) VALUES (?, ?, ?, ?, ?)',
      [c.name, c.cost, c.time, c.reliability, c.quality]
    );
  }
  return allQuery('SELECT * FROM companies ORDER BY id ASC');
}

module.exports = {
  db,
  runQuery,
  allQuery,
  getQuery,
  initDatabase,
  resetCompaniesToDefault
};