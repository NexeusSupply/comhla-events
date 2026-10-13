import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';
import { accessMiddleware } from './access.js';
import { COLLECTIONS, allDocs, getDoc, putDoc, deleteDoc, lastChange, seedIfEmpty } from './db.js';

seedIfEmpty();
fs.mkdirSync(config.uploadsDir, { recursive: true });

const app = express();
app.disable('x-powered-by');

// access.js reads the Access cookie when the header is missing.
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries((req.get('Cookie') || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  next();
});
app.use(accessMiddleware());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(config.root, 'public')));
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '30d', immutable: true }));

const validColl = (req, res) => {
  if (COLLECTIONS.includes(req.params.coll)) return true;
  res.status(404).json({ error: 'unknown collection' });
  return false;
};
const validId = (id) => /^[A-Za-z0-9_\-.:@+~]{1,120}$/.test(id);

app.get('/api/me', (req, res) => res.json({ email: req.user?.email || '' }));

// The page loads everything at once (a few hundred records at most) and re-checks /api/version every so often.
app.get('/api/data', (_req, res) => res.json({ version: lastChange(), ...allDocs() }));
app.get('/api/version', (_req, res) => res.json({ version: lastChange() }));

app.put('/api/:coll/:id', (req, res) => {
  if (!validColl(req, res)) return;
  const { coll, id } = req.params;
  if (!validId(id)) return res.status(400).json({ error: 'bad id' });
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'expected an object' });
  const who = req.user?.email || '';
  const now = new Date().toISOString();
  const existing = getDoc(coll, id);
  const doc = { ...body, updatedAt: now };
  if (coll === 'events') {
    // Who entered and edited an event is recorded here, from the login, never trusted from the page.
    doc.updatedBy = who;
    doc.createdBy = existing?.createdBy ?? (existing ? undefined : who);
    doc.createdAt = existing?.createdAt ?? (existing ? undefined : now);
    for (const k of ['createdBy', 'createdAt']) if (doc[k] === undefined) delete doc[k];
  }
  res.json(putDoc(coll, id, doc, who));
});

app.delete('/api/:coll/:id', (req, res) => {
  if (!validColl(req, res)) return;
  deleteDoc(req.params.coll, req.params.id, req.user?.email);
  res.json({ ok: true });
});

const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
app.post('/api/logo', express.raw({ type: Object.keys(IMAGE_TYPES), limit: '3mb' }), (req, res) => {
  const ext = IMAGE_TYPES[req.get('Content-Type')];
  if (!ext || !req.body?.length) return res.status(415).json({ error: 'Use a PNG, JPG, WebP or SVG image.' });
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(config.uploadsDir, name), req.body);
  res.json({ url: `/uploads/${name}` });
});

app.listen(config.port, () => {
  console.log(`Comhla Events on http://localhost:${config.port}`);
  if (config.access.enabled) console.log('Access: enforced');
  else console.warn(config.access.previewPassword ? 'Cloudflare Access is not set up: PREVIEW_PASSWORD is protecting the site.' : 'WARNING: Cloudflare Access is not set up and no PREVIEW_PASSWORD is set. Anyone who can reach this address can use the app. Local development only.');
});
