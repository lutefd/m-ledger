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

## Bot / Export API

AlgoDrill is single-owner. External agents (for example Bob the study coach) authenticate with the same bearer token used by the weekly export:

| Variable                | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `EXPORT_API_TOKEN`      | Shared secret (`Authorization: Bearer …`). Min 32 chars.     |
| `EXPORT_API_USER_EMAIL` | Optional owner email. Defaults to the earliest created user. |

Calendar dates for daily plans use `TZ` (compose sets `America/Sao_Paulo`).

### Push today’s plan (idempotent upsert)

```bash
curl -sS -X POST "https://your-hostname/api/daily-plans" \
  -H "Authorization: Bearer $EXPORT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-11-22",
    "items": [
      {
        "url": "https://leetcode.com/problems/two-sum/",
        "title": "Two Sum",
        "dueReason": "D+3 shaky",
        "source": "bob"
      },
      {
        "slug": "valid-parentheses",
        "dueReason": "D+1 help reset",
        "source": "bob"
      }
    ]
  }'
```

Rules: 1–3 ordered items; problems upsert by LeetCode URL; replacing a date’s plan is allowed only before Luis starts a session from it (`409` once started).

### Read a plan

```bash
curl -sS "https://your-hostname/api/daily-plans?date=2026-11-22" \
  -H "Authorization: Bearer $EXPORT_API_TOKEN"
```

### Incremental attempt feed

`since` is exclusive (`completedAt > since`).

```bash
curl -sS "https://your-hostname/api/attempts?since=2026-11-22T00:00:00.000Z" \
  -H "Authorization: Bearer $EXPORT_API_TOKEN"
```

Each attempt includes `slug`, `url`, `outcome`, `elapsedMs`, `confidence`, `mistakes`, `patterns`, `completedAt`, and `fromBotPlan`.

### Weekly export (existing)

```bash
curl -sS "https://your-hostname/api/export/weekly?weekStart=2026-11-17" \
  -H "Authorization: Bearer $EXPORT_API_TOKEN"
```

## Deploy

1. Copy `.env.example` to `.env` and fill every secret.
2. Set `BETTER_AUTH_URL=https://your-hostname`.
3. Set `EXPORT_API_TOKEN` (and optionally `EXPORT_API_USER_EMAIL`) if Bob or other bots will call the JSON APIs.
4. Point DNS for that hostname at the VPS.
5. Ensure the shared Docker network exists:
   ```bash
   docker network create caddy_net
   ```
6. Add this block to the VPS Caddyfile:
   ```caddy
   your-hostname {
           reverse_proxy algodrill-app:3000
   }
   ```
7. Reload Caddy on the VPS.
8. Run `docker compose up -d --build` (startup runs `npm run db:migrate`).
9. Open `https://your-hostname/setup`, enter `SETUP_TOKEN`, and create the owner account.
10. Confirm health with `curl https://your-hostname/api/health`.

The app container runs `npm run db:migrate` before `node build`, uses one replica, joins the external `caddy_net` Docker network as `algodrill-app`, and stores SQLite under the `app-data` volume mounted at `/data`.

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
  curl https://your-hostname/api/health
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
4. Check `https://your-hostname/api/health` and inspect recent sessions.

## Operations Notes

- Caddy terminates HTTPS and proxies to the app container.
- SQLite uses `foreign_keys=ON`, WAL mode, and a 5-second busy timeout.
- Keep one app replica only.
- Rotate `BETTER_AUTH_SECRET` carefully; active sessions may be invalidated.
