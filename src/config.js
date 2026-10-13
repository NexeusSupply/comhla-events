import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const teamDomain = (process.env.CF_ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const aud = process.env.CF_ACCESS_AUD || '';

export const config = {
  root,
  port: Number(process.env.PORT || 3050),
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'comhla-events.sqlite'),
  uploadsDir: process.env.UPLOADS_DIR || path.join(path.dirname(process.env.DB_PATH || path.join(root, 'data', 'x')), 'uploads'),
  seedPath: path.join(root, 'seed.json'),
  access: {
    enabled: Boolean(teamDomain && aud),
    teamDomain,
    aud,
    previewPassword: process.env.PREVIEW_PASSWORD || '',
  },
};
