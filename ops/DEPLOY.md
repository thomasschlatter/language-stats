# Deployment (groupifier.com)

The app runs on a DigitalOcean droplet (`152.42.181.186`, SGP1, Ubuntu 24.04).

## Services (pm2)
- **`language-stats`** — Express app on `:3000`. Env in `/var/data/language-stats/secret.env`
  (`JWT_SECRET`, `WORLD_URL`) plus `NODE_ENV=production PORT=3000 DATA_DIR=/var/data/language-stats`.
- **`world-server`** — Colyseus (SkyOffice) on `:2567`, TLS via the Let's Encrypt cert
  (`TLS_KEY_PATH`/`TLS_CERT_PATH`).

## Web
- nginx reverse-proxies `/` → `:3000` and serves the built world client at `/game/`
  (from `world/client/dist`). Let's Encrypt cert for `groupifier.com` (+ `api`, and `www`
  once DNS propagates).

## Auto-deploy
Push to `main`. Within ~2 minutes `/usr/local/bin/gf-deploy.sh` (cron `/etc/cron.d/gf-deploy`)
pulls it and rebuilds/restarts **only what changed**:
- `package*.json` → `npm install` (main app)
- `world/client/**` → rebuild the Vite client (base `/game/`, `wss://groupifier.com:2567`)
- `world/server|types/**` → install + restart `world-server`
- `server/**` → restart `language-stats`

Log: `/var/log/gf-deploy.log`. Manual run: `gf-deploy.sh`.

## Data
- SQLite DB at `/var/data/language-stats/language-stats.db` (persists across deploys).
- Daily backup via `/etc/cron.daily/backup-language-stats` → `/var/data/language-stats/backups/` (keeps 14).

## Manual world client rebuild
`world/client/build-prod.sh` (bakes base `/game/` + the Colyseus wss endpoint).
