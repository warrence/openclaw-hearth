# Local Docker

This stack runs the Hearth API, a static web container, and PostgreSQL on one local Compose network.

## Services

- `web` serves the built Quasar PWA on `http://localhost:8080`
- `api` serves Laravel on `http://localhost:8000`
- `db` is PostgreSQL on `localhost:5432`

## Start

```bash
docker compose up --build
```

The web container proxies `/api` and `/storage` back to the Laravel container, so the browser stays same-origin at `http://localhost:8080`.

## Assumptions

- The API container reads `apps/api/.env` and Compose overrides the database settings to PostgreSQL.
- PostgreSQL data persists in the named `hearth_postgres_data` volume.
- Uploaded files and generated attachments persist in the named `hearth_api_storage` volume.
- Laravel already supports the `pgsql` connection in `apps/api/config/database.php`, so no app code changes were needed for database selection.

## Fresh clone setup

If you are starting from a fresh checkout, create `apps/api/.env` first:

```bash
cd apps/api
cp .env.example .env
```

Then fill in `APP_KEY` and any OpenClaw / Web Push secrets you actually need. The checked-in workspace already has an `apps/api/.env`, so the compose stack can use it directly here.

If you prefer a dedicated Docker env file, copy `apps/api/.env.docker.example` to `apps/api/.env.docker` and keep the same secrets there.

## Manual one-time step

This Docker slice does not migrate the existing SQLite content into PostgreSQL automatically. To preserve the current data set, run the Laravel migration command outside the container startup flow before relying on the Postgres volume:

```bash
cd apps/api
php artisan hearth:migrate-sqlite-to-postgres --source=sqlite --target=pgsql
```

## Useful commands

```bash
docker compose logs -f api
docker compose logs -f web
docker compose down -v
```

`down -v` removes the Postgres and storage volumes, so use it only when you want a full reset.
