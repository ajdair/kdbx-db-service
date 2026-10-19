# KDB-X DB Service GUI

This is a fork of [KxSystems/kdbx-db-service](https://github.com/KxSystems/kdbx-db-service). Its purpose is to provide a  lightweight browser UI on top of the DB Service REST API, shipped as an optional add-on to the standard Docker deployment.

Everything else in this repo is unchanged from upstream. For setup, usage, and the current documentation, see the upstream README:

**[KxSystems/kdbx-db-service README](https://github.com/KxSystems/kdbx-db-service/blob/main/README.md)**

# Quickstart

From your DB Service directory, download the built package and start it alongside your stack:

```bash
curl -fsSLO https://raw.githubusercontent.com/ajdair/kdbx-db-service/main/ui/docker-compose.ui.yaml
docker compose -f docker-compose.yaml -f docker-compose.ui.yaml up -d
```

Open `http://127.0.0.1:3000.`

To remove it, run `docker rm -f kx-db-ui`.


## About the GUI

The UI lives in [`ui/`](ui/). It is a small single-page app & talks only to the REST API on port 8080. You can:

- overview page: status, row counts, data range, how fresh the data is, and the storage tiers
- browse tables and schemas, preview rows, create tables, and drop them
- run queries (structured builder, SQL, and q) with CSV export and a chart
- start and monitor imports
- delete rows
- view the assembly config
- open the Open API Spec and find the official skill and docs

**Overview:**

![The overview page, showing summary tiles and a card for each table](ui/docs/screenshots/home.png)

**Tables:**

![The tables page, showing the schema of the Quote table](ui/docs/screenshots/tables.png)

**Query:**

![The query page, showing a SQL query and its results](ui/docs/screenshots/query.png)
