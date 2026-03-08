README below is AI-generated. Please forgive me, I have a lot going on at the moment.

# db-proxy

An HTTP-to-PostgreSQL proxy for edge runtimes (Cloudflare Workers, Vercel Edge Functions, etc.) that can't make direct TCP connections to a database.

Exposes a single `POST /query` endpoint that accepts SQL over HTTP, forwards it to Postgres, and returns JSON results. Built with [Hono](https://hono.dev/) and designed to work with [Drizzle ORM's HTTP proxy driver](https://orm.drizzle.team/docs/connect-drizzle-proxy).

## Setup

```sh
npm install
```

### Environment variables

| Variable            | Description                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `DATABASE_HOST`     | PostgreSQL host with optional port (e.g. `localhost` or `db.example.com:5432`)                           |
| `DATABASE_USERNAME` | PostgreSQL username                                                                                      |
| `DATABASE_PASSWORD` | PostgreSQL password                                                                                      |
| `DATABASE_DB`       | _(Optional)_ Lock the proxy to a specific database. If set, `database` in the request body is not needed |
| `TOKEN`             | Bearer token used to authenticate requests                                                               |

## Usage

### Run locally

```sh
npm run build
npm start
```

### Docker

A pre-built image is available on Docker Hub at [`kvqn/db-proxy`](https://hub.docker.com/r/kvqn/db-proxy):

```sh
docker run -e DATABASE_HOST="host:5432" -e DATABASE_USERNAME="user" -e DATABASE_PASSWORD="pass" -e TOKEN="secret" -p 80:80 kvqn/db-proxy
```

Or build it yourself:

```sh
docker build -t db-proxy .
docker run -e DATABASE_HOST="host:5432" -e DATABASE_USERNAME="user" -e DATABASE_PASSWORD="pass" -e TOKEN="secret" -p 80:80 db-proxy
```

### API

**`POST /query`**

Headers:

```
Authorization: Bearer <TOKEN>
```

Body:

```json
{
  "sql": "SELECT * FROM users WHERE id = $1",
  "params": [1],
  "method": "all",
  "database": "mydb"
}
```

- `method: "all"` -- returns rows as arrays (for Drizzle ORM's proxy driver)
- `method: "execute"` -- returns rows as objects
- `database` -- the target database name. Required unless `DATABASE_DB` is set as an environment variable.

### Drizzle ORM integration

```ts
import { drizzle } from "drizzle-orm/pg-proxy"

const db = drizzle(async (sql, params, method) => {
  const response = await fetch("https://your-proxy-url/query", {
    method: "POST",
    headers: {
      Authorization: "Bearer <TOKEN>",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params, method, database: "mydb" }),
  })

  const rows = await response.json()
  return { rows }
})
```
