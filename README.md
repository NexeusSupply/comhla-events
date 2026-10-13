# Comhla Events

One place to plan and track every event across the Comhla group: A&P shows, trade shows, in-clinic events, staff training, conferences, internal conferences, roadshows and sponsorships. It shows events on a calendar and a year planner, links each event to brands, National Programmes, products and the production animal calendar, and prints month and year calendars, event lists and event briefs.

Everyone works on the same shared data. The app records the signed-in email of whoever adds or edits an event.

## Login (Cloudflare Access)

The app has no login of its own. It sits behind Cloudflare Access, so staff sign in with their work email (a one-time code or Microsoft/Google sign-in), and nobody needs a Claude account. The server checks the Access token on every request and takes the user's email from it.

**Previewing before Access is ready:** set `PREVIEW_PASSWORD` and the browser asks for a password instead. The username is used as the person's name. It's a stopgap for trying the app on Railway's own `*.up.railway.app` address. Once the two Access values are set, it is ignored.

## Running locally

Requires Node 22.13 or newer. There are no native dependencies.

```bash
npm install
npm start          # http://localhost:3050
```

On first start, an empty database is filled from `seed.json`: the events imported from the spreadsheet, the brands with their logos, and the production calendar seasons. Later starts leave the data alone.

## Deploying on Railway

Do these in order. Setting up Access (step 2) before the first deploy means the app is never reachable without a login.

1. **Project.** Railway → New Project → Deploy from GitHub repo → `NexeusSupply/comhla-events`. The `Dockerfile` is detected. Then right-click the service → **Attach volume**, with mount path `/app/data`. The database and uploaded logos live there. Don't add a healthcheck path, because Access would refuse it.
2. **Cloudflare Access.** Zero Trust → Access → Applications → Add → *Self-hosted*. Use the domain `events.comhlavet.com` and a policy that allows your team's emails. Copy the **Application Audience (AUD) tag** from the application's Overview tab. The team domain is under Settings → Custom pages (it looks like `yourteam.cloudflareaccess.com`).
3. **Variables.** Service → Variables, then set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`. Leave `PORT` and `DB_PATH` out: Railway sets `PORT`, and the image sets `DB_PATH` and `TZ`.
4. **Domain.** Service → Settings → Networking → Custom domain `events.comhlavet.com`. Railway shows a CNAME target, and sometimes a TXT verification record. Add them in Cloudflare with the CNAME proxied. The zone's SSL/TLS mode must be **Full**, not Flexible, because Flexible causes a redirect loop. Skip "Generate domain", since the `*.up.railway.app` address would only ever answer 403.
5. **Check.** The deploy log should say `Seeded 19 events, 21 brands, 6 seasons` on the first start, and `Access: enforced`. Open `https://events.comhlavet.com` and sign in through Access. The new-event form should say "Entered by" with your email.

`seed.json` sits at the repo root, not under `data/`, because the volume mounted at `/app/data` hides anything committed there.

## Backups

All data is one SQLite file at `/app/data/comhla-events.sqlite`, plus logos in `/app/data/uploads`. Railway's volume backups cover both. The Events tab also exports a CSV at any time. Every save and delete is also written to a `history` table with who made it and when.

## Layout

```
src/
  server.js     Express: JSON API, static front end, logo uploads
  access.js     Cloudflare Access JWT check (and the preview password)
  db.js         SQLite document store, history, first-run seed
  config.js     Environment settings
public/
  index.html    The whole front end (calendar, planner, forms, printing)
  logos/        Brand logos shipped with the seed data
seed.json       Starting data, loaded once into an empty database
```

The API is small: `GET /api/data` returns everything, `PUT /api/:collection/:id` saves one item, `DELETE /api/:collection/:id` removes one, and `POST /api/logo` stores an image. The collections are `events`, `brands`, `programmes`, `products` and `seasons`. Open pages check `/api/version` every 20 seconds, so changes from other people show up without a reload.
