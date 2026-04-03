README below is AI-generated. Please forgive me, I have a lot going on at the moment.

# db-proxy

An HTTP-to-PostgreSQL proxy for edge runtimes (Cloudflare Workers, Vercel Edge Functions, etc.) that can't make direct TCP connections to a database.

Exposes a single `POST /query` endpoint that accepts SQL over HTTP, forwards it to Postgres, and returns JSON results. Built with [Hono](https://hono.dev/) and designed to work with [Drizzle ORM's HTTP proxy driver](https://orm.drizzle.team/docs/connect-drizzle-proxy).

## Setup

```sh
npm install
```

### Environment variables

| Variable            | Description                                                                                              | Default |
| ------------------- | -------------------------------------------------------------------------------------------------------- | ------- |
| `DATABASE_HOST`     | PostgreSQL host with optional port (e.g. `localhost` or `db.example.com:5432`)                           |         |
| `DATABASE_USERNAME` | PostgreSQL username                                                                                      |         |
| `DATABASE_PASSWORD` | PostgreSQL password                                                                                      |         |
| `DATABASE_DB`       | _(Optional)_ Lock the proxy to a specific database. If set, `database` in the request body is not needed |         |
| `TOKEN`             | Bearer token used to authenticate requests                                                               |         |
| `PORT`              | _(Optional)_ Port the server listens on                                                                  | `80`    |
| `LOG_LEVEL`         | _(Optional)_ Logging verbosity: `debug`, `info`, `warn`, or `error` (case-insensitive)                   | `info`  |

### Logging

Structured JSON logging is powered by [pino](https://github.com/pinojs/pino). Set `LOG_LEVEL=debug` to see full details of every request, including SQL queries and response bodies:

```jsonl
{"level":20,"time":1717000000000,"requestBody":{"sql":"SELECT * FROM users","params":[],"method":"all","database":"mydb"},"msg":"POST /query request"}
{"level":20,"time":1717000000001,"sql":"SELECT * FROM users","params":[],"method":"all","database":"mydb","msg":"Executing query"}
{"level":20,"time":1717000000010,"rowCount":3,"responseBody":[[1,"alice"],[2,"bob"],[3,"charlie"]],"msg":"Query result"}
{"level":20,"time":1717000000011,"method":"POST","path":"/query","status":200,"durationMs":12,"msg":"HTTP request"}
```

At the default `info` level, only server startup and new database connections are logged.

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

To run on a custom port with debug logging:

```sh
docker run -e DATABASE_HOST="host:5432" -e DATABASE_USERNAME="user" -e DATABASE_PASSWORD="pass" -e TOKEN="secret" -e PORT=3000 -e LOG_LEVEL=debug -p 3000:3000 kvqn/db-proxy
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
