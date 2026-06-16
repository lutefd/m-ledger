# Mistake Ledger

A private SvelteKit study tracker focused on recurring problem-solving mistakes, redo scheduling, and timed LeetCode sessions.

## Local Development

```bash
npm install
npm run db:migrate
npm run dev
```

Local SQLite defaults to `.data/mistake-ledger.sqlite`. Production sets `DATABASE_PATH=/data/mistake-ledger.sqlite`.

## Required Checks

```bash
npm run check
npm run lint
npm run test
npm run test:e2e
npm run build
```

## Deploy

1. Copy `.env.example` to `.env` and fill every secret.
2. Point DNS for `SITE_HOST` at the server.
3. Run `docker compose up -d --build`.
4. Open `https://$SITE_HOST/setup`, enter `SETUP_TOKEN`, and create the owner account.
5. Confirm health with `curl https://$SITE_HOST/api/health`.

The app container runs `npm run db:migrate` before `node build`, uses one replica, and stores SQLite under the `app-data` volume mounted at `/data`.

## Migrations And Rollback

Drizzle migration files live in `drizzle/`. To upgrade, deploy the new image and let startup apply pending migrations. Roll back by restoring the previous image and a compatible database backup. If a migration is not backward-compatible, restore a Litestream snapshot from before the migration.

## Backups

Litestream replicates `/data/mistake-ledger.sqlite` to the configured S3-compatible bucket. Do not copy the live SQLite/WAL files directly for backups.

Verify replicas:

```bash
docker compose exec litestream litestream snapshots -config /etc/litestream.yml /data/mistake-ledger.sqlite
```

## Full Restore

1. Stop the app: `docker compose stop app`.
2. Restore into an empty volume path:
   ```bash
   docker compose run --rm litestream restore -config /etc/litestream.yml -o /data/mistake-ledger.sqlite /data/mistake-ledger.sqlite
   ```
3. Start the app: `docker compose up -d app`.
4. Check `https://$SITE_HOST/api/health` and inspect recent sessions.

## Operations Notes

- Caddy terminates HTTPS and proxies to the app container.
- SQLite uses `foreign_keys=ON`, WAL mode, and a 5-second busy timeout.
- Keep one app replica only.
- Rotate `BETTER_AUTH_SECRET` carefully; active sessions may be invalidated.
