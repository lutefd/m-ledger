# AlgoDrill

A private SvelteKit practice tracker for coding interview drills. AlgoDrill focuses on recurring problem-solving traps, redo scheduling, timed sessions, and lightweight recap notes for LeetCode, HackerRank, and similar problem sets.

## Local Development

```bash
npm install
npm run db:migrate
npm run dev
```

Local SQLite defaults to `.data/algodrill.sqlite`. Production sets `DATABASE_PATH=/data/algodrill.sqlite`.

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
2. Set `BETTER_AUTH_URL=https://your-hostname` and `SITE_HOST=your-hostname`.
3. Point DNS for `SITE_HOST` at the server.
4. Ensure ports 80 and 443 are open for Caddy.
5. Run `docker compose up -d --build`.
6. Open `https://$SITE_HOST/setup`, enter `SETUP_TOKEN`, and create the owner account.
7. Confirm health with `curl https://$SITE_HOST/api/health`.

The app container runs `npm run db:migrate` before `node build`, uses one replica, and stores SQLite under the `app-data` volume mounted at `/data`.

## Hosting Checklist

- Generate secrets:
  ```bash
  openssl rand -base64 48 # BETTER_AUTH_SECRET
  openssl rand -base64 32 # SETUP_TOKEN
  ```
- Configure an S3-compatible bucket for Litestream before relying on the deployment.
- Keep exactly one `app` replica; SQLite writes are local to the mounted volume.
- Back up `.env` somewhere private. It is ignored by Git and not baked into the image.
- Before the first public run, verify:
  ```bash
  docker compose config
  docker compose up -d --build
  docker compose ps
  curl https://$SITE_HOST/api/health
  ```

## Migrations And Rollback

Drizzle migration files live in `drizzle/`. To upgrade, deploy the new image and let startup apply pending migrations. Roll back by restoring the previous image and a compatible database backup. If a migration is not backward-compatible, restore a Litestream snapshot from before the migration.

## Backups

Litestream replicates `/data/algodrill.sqlite` to the configured S3-compatible bucket. Do not copy the live SQLite/WAL files directly for backups.

Verify replicas:

```bash
docker compose exec litestream litestream snapshots -config /etc/litestream.yml /data/algodrill.sqlite
```

## Full Restore

1. Stop the app: `docker compose stop app`.
2. Restore into an empty volume path:
   ```bash
   docker compose run --rm litestream restore -config /etc/litestream.yml -o /data/algodrill.sqlite /data/algodrill.sqlite
   ```
3. Start the app: `docker compose up -d app`.
4. Check `https://$SITE_HOST/api/health` and inspect recent sessions.

## Operations Notes

- Caddy terminates HTTPS and proxies to the app container.
- SQLite uses `foreign_keys=ON`, WAL mode, and a 5-second busy timeout.
- Keep one app replica only.
- Rotate `BETTER_AUTH_SECRET` carefully; active sessions may be invalidated.
