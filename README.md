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
    "name": "Sliding window day",
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

Rules: 1–3 ordered items; problems upsert by LeetCode URL; replacing a date’s plan is allowed only before Luis starts a session from it (`409` once started). `name` is optional (trimmed, max 80 chars, blank or `null` means unnamed). Starting the plan names the session after it.

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

Each attempt includes `sessionId`, `sessionName`, `slug`, `url`, `outcome`, `elapsedMs`, `confidence`, `mistakes`, `patterns`, `completedAt`, and `fromBotPlan`. `sessionName` is `null` for unnamed sessions.

### Rename a session

```bash
curl -sS -X PATCH "https://your-hostname/api/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $EXPORT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Sliding window day" }'
```

Returns `{ "session": { "id", "name" } }`. Send `"name": null` or `""` to clear the name. Unknown sessions return `404`.

### Weekly export

Each attempt includes `sessionName` next to `sessionId`.

```bash
curl -sS "https://your-hostname/api/export/weekly?weekStart=2026-11-17" \
  -H "Authorization: Bearer $EXPORT_API_TOKEN"
```

## Deploy

1. Copy `.env.example` to `.env` and fill every secret.
2. Set `BETTER_AUTH_URL=https://algodrill.example.com`.
3. Set `EXPORT_API_TOKEN` (and optionally `EXPORT_API_USER_EMAIL`) if Bob or other bots will call the JSON APIs.
4. Ensure the shared Cloudflare Tunnel ingress network exists:
   ```bash
   docker network create --driver bridge --internal cloudflare_ingress
   ```
5. Add the Cloudflare Tunnel public hostname `algodrill.example.com` with service
   `http://algodrill:3000`.
6. Run `docker compose up -d --build app` (startup runs `npm run db:migrate`).
7. Open `https://algodrill.example.com/setup`, enter `SETUP_TOKEN`, and create the owner account.
8. Confirm health with `curl https://algodrill.example.com/api/health`.

The app container runs `npm run db:migrate` before `node build`, uses one replica, joins the external `cloudflare_ingress` network as `algodrill`, joins a separate `algodrill_egress` network for GitHub API access, and stores SQLite under the `app-data` volume mounted at `/data`.

## Hosting Checklist

- Generate secrets:
  ```bash
  openssl rand -base64 48 # BETTER_AUTH_SECRET
  openssl rand -base64 32 # SETUP_TOKEN
  ```
- Configure an S3-compatible bucket for Litestream before relying on the deployment.
- Configure the personal NeetCode GitHub sync values in `.env`: repository, import
  user email, webhook secret, and a read-only GitHub API token. Add a GitHub
  `push` webhook for `/api/integrations/github/neetcode` with the same secret.
- Keep exactly one `app` replica; SQLite writes are local to the mounted volume.
- Back up `.env` somewhere private. It is ignored by Git and not baked into the image.
- Before the first public run, verify:
  ```bash
  docker compose config
  docker compose up -d --build app
  docker compose ps
  curl https://algodrill.example.com/api/health
  ```

## Migrations And Rollback

Drizzle migration files live in `drizzle/`. To upgrade, deploy the new image and let startup apply pending migrations. Roll back by restoring the previous image and a compatible database backup. If a migration is not backward-compatible, restore a Litestream snapshot from before the migration.

## Backups

When the `LITESTREAM_*` values are configured, start the optional backup service with
`docker compose --profile backup up -d litestream`. It replicates `/data/algodrill.sqlite`
to the configured S3-compatible bucket. Do not copy the live SQLite/WAL files directly
for backups.

Verify replicas:

```bash
docker compose --profile backup exec litestream litestream snapshots -config /etc/litestream.yml /data/algodrill.sqlite
```

## Full Restore

1. Stop the app: `docker compose stop app`.
2. Restore into an empty volume path:
   ```bash
   docker compose --profile backup run --rm litestream restore -config /etc/litestream.yml -o /data/algodrill.sqlite /data/algodrill.sqlite
   ```
3. Start the app: `docker compose up -d app`.
4. Check `https://algodrill.example.com/api/health` and inspect recent sessions.

## Operations Notes

- Cloudflare Tunnel terminates HTTPS and proxies `algodrill.example .com` to `algodrill:3000`.
- SQLite uses `foreign_keys=ON`, WAL mode, and a 5-second busy timeout.
- Keep one app replica only.
- Rotate `BETTER_AUTH_SECRET` carefully; active sessions may be invalidated.
