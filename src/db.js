// One small document store: every record is a JSON document in a collection, the same shape the
// front end works with (events, brands, programmes, products, seasons).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

export const COLLECTIONS = ['events', 'brands', 'programmes', 'products', 'seasons'];

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS docs (
  coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (coll, id)
);
CREATE TABLE IF NOT EXISTS history (
  at TEXT NOT NULL, user TEXT, action TEXT NOT NULL, coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT
);
`);

const getStmt = db.prepare('SELECT data FROM docs WHERE coll = ? AND id = ?');
const allStmt = db.prepare('SELECT id, data FROM docs WHERE coll = ?');
const putStmt = db.prepare('INSERT INTO docs (coll, id, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at');
const delStmt = db.prepare('DELETE FROM docs WHERE coll = ? AND id = ?');
const histStmt = db.prepare('INSERT INTO history (at, user, action, coll, id, data) VALUES (?, ?, ?, ?, ?, ?)');
const lastStmt = db.prepare('SELECT MAX(at) AS at FROM history');

export function getDoc(coll, id) {
  const row = getStmt.get(coll, id);
  return row ? { id, ...JSON.parse(row.data) } : null;
}

export function allDocs() {
  const out = {};
  for (const c of COLLECTIONS) out[c] = allStmt.all(c).map((r) => ({ id: r.id, ...JSON.parse(r.data) }));
  return out;
}

export function putDoc(coll, id, data, user) {
  const now = new Date().toISOString();
  const { id: _drop, ...body } = data;
  putStmt.run(coll, id, JSON.stringify(body), now);
  histStmt.run(now, user || null, 'put', coll, id, JSON.stringify(body));
  return { id, ...body };
}

export function deleteDoc(coll, id, user) {
  const now = new Date().toISOString();
  const before = getDoc(coll, id);
  delStmt.run(coll, id);
  histStmt.run(now, user || null, 'delete', coll, id, before ? JSON.stringify(before) : null);
}

/** A cheap version stamp so the page can tell whether anything changed since it last loaded. */
export function lastChange() {
  return lastStmt.get().at || '';
}

/** First run only: load the events, brands and seasons carried over from the first version of the app. */
export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM docs').get().n;
  if (count || !fs.existsSync(config.seedPath)) return;
  const seed = JSON.parse(fs.readFileSync(config.seedPath, 'utf8'));
  db.exec('BEGIN');
  try {
    for (const c of COLLECTIONS) for (const d of seed[c] || []) putDoc(c, d.id, d, 'seed');
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  console.log(`Seeded ${Object.entries(seed).map(([k, v]) => `${v.length} ${k}`).join(', ')}`);
}
