# VPS Update Checklist

Use this when pulling a new AlgoDrill version onto a VPS that already runs the shared Cloudflare Tunnel ingress network.

## Pull The Latest Code

```bash
git pull
```

## Update Environment

Remove this variable if it exists:

```bash
SITE_HOST=...
```

Set the public app origin and secrets:

```bash
BETTER_AUTH_URL=https://algodrill.luisdourado.com
BETTER_AUTH_SECRET=replace-with-a-private-secret
SETUP_TOKEN=replace-with-a-private-setup-token
DATABASE_PATH=/data/algodrill.sqlite
EXPORT_API_TOKEN=replace-with-openssl-rand-base64-48
EXPORT_API_USER_EMAIL=you@example.com
```

`EXPORT_API_TOKEN` is required for Bob (and weekly export) bearer access. Keep the `LITESTREAM_*` variables if backups are enabled.

Optional NeetCode GitHub sync:

```bash
NEETCODE_GITHUB_REPOSITORY=lutefd/neetcode-submissions
NEETCODE_IMPORT_USER_EMAIL=you@example.com
GITHUB_WEBHOOK_SECRET=replace-with-a-private-webhook-secret
GITHUB_API_TOKEN=replace-with-a-read-only-github-token
```

Startup applies pending Drizzle migrations (including `daily_plans`, `external_solves`, and `external_solve_links`). No manual SQL step is needed beyond `docker compose up -d --build`.

## Ensure The Shared Network Exists

```bash
docker network create --driver bridge --internal cloudflare_ingress
```

If the network already exists, Docker will print an error and no change is needed.

Compose creates the separate `algodrill_egress` network automatically. The app needs it
because the shared ingress network is internal and cannot reach GitHub's API.

## Update Cloudflare Tunnel

Add the public hostname in the tunnel configuration:

```text
algodrill.luisdourado.com -> http://algodrill:3000
```

## Rebuild And Start

```bash
docker compose up -d --build app
docker compose ps
```

Expected containers:

```text
algodrill-app
```

If Litestream backups are configured, start `algodrill-litestream` separately:

```bash
docker compose --profile backup up -d litestream
```

## Verify Health

```bash
curl https://algodrill.luisdourado.com/api/health
```

## Existing Database Rename

The default database path is now:

```bash
/data/algodrill.sqlite
```

If an existing deployment still has data at the previous path, either rename the database file inside the Docker volume before starting the new app, or temporarily keep `DATABASE_PATH` pointed at the old file until the rename is planned.
