# VPS Update Checklist

Use this when pulling a new AlgoDrill version onto a VPS that already runs a host-level Caddy instance and shared Docker network.

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
BETTER_AUTH_URL=https://your-hostname
BETTER_AUTH_SECRET=replace-with-a-private-secret
SETUP_TOKEN=replace-with-a-private-setup-token
DATABASE_PATH=/data/algodrill.sqlite
```

Keep the `LITESTREAM_*` variables if backups are enabled.

## Ensure The Shared Network Exists

```bash
docker network create caddy_net
```

If the network already exists, Docker will print an error and no change is needed.

## Update Host Caddy

Add this block to the VPS Caddyfile:

```caddy
your-hostname {
        reverse_proxy algodrill-app:3000
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

## Rebuild And Start

```bash
docker compose up -d --build
docker compose ps
```

Expected containers:

```text
algodrill-app
algodrill-litestream
```

## Verify Health

```bash
curl https://your-hostname/api/health
```

## Existing Database Rename

The default database path is now:

```bash
/data/algodrill.sqlite
```

If an existing deployment still has data at the previous path, either rename the database file inside the Docker volume before starting the new app, or temporarily keep `DATABASE_PATH` pointed at the old file until the rename is planned.
