# db-proxy

An HTTP-to-PostgreSQL proxy for edge runtimes (Cloudflare Workers, Vercel Edge Functions, etc.) that can't make direct TCP connections to a database.

Exposes a single `POST /query` endpoint that accepts SQL over HTTP, forwards it to Postgres, and returns JSON results. Built with [Hono](https://hono.dev/) and designed to work with [Drizzle ORM's HTTP proxy driver](https://orm.drizzle.team/docs/connect-drizzle-proxy).

## Migration from 1.x

Version 2.0 collapses the four database environment variables into a single
`DATABASE_URL` and locks each proxy instance to one database. If you are
upgrading from 1.x:

1. Replace `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and
   `DATABASE_DB` with a single `DATABASE_URL`, e.g.
   `postgres://user:pass@host:5432/dbname`.
2. Remove the `"database"` field from every request body — the proxy will
   now reject any request that includes it with a `400`.
3. Run one proxy instance per database you need to expose.

Notes:

- Passwords with special characters must be percent-encoded
  (`@` → `%40`, `:` → `%3A`, `#` → `%23`, `%` → `%25`).
- SSL is configured via the URL: append `?sslmode=require` (or
  `?sslmode=verify-full`) to enable TLS.

## Setup

```sh
npm install
```

### Environment variables

| Variable       | Description                                                                            | Default |
| -------------- | -------------------------------------------------------------------------------------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgres://user:pass@host:5432/dbname`)            |         |
| `TOKEN`        | Bearer token used to authenticate requests                                             |         |
| `PORT`         | _(Optional)_ Port the server listens on                                                | `80`    |
| `LOG_LEVEL`    | _(Optional)_ Logging verbosity: `debug`, `info`, `warn`, or `error` (case-insensitive) | `info`  |

### Logging

Structured JSON logging is powered by [pino](https://github.com/pinojs/pino). Set `LOG_LEVEL=debug` to see full details of every request, including SQL queries and response bodies:

```jsonl
{"level":20,"time":1717000000000,"requestBody":{"sql":"SELECT * FROM users","params":[],"method":"all"},"msg":"POST /query request"}
{"level":20,"time":1717000000001,"sql":"SELECT * FROM users","params":[],"method":"all","msg":"Executing query"}
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
docker run -e DATABASE_URL="postgres://user:pass@host:5432/dbname" -e TOKEN="secret" -p 80:80 kvqn/db-proxy
```

To run on a custom port with debug logging:

```sh
docker run -e DATABASE_URL="postgres://user:pass@host:5432/dbname" -e TOKEN="secret" -e PORT=3000 -e LOG_LEVEL=debug -p 3000:3000 kvqn/db-proxy
```

Or build it yourself:

```sh
docker build -t db-proxy .
docker run -e DATABASE_URL="postgres://user:pass@host:5432/dbname" -e TOKEN="secret" -p 80:80 db-proxy
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
  "method": "all"
}
```

- `method: "all"` -- returns rows as arrays (for Drizzle ORM's proxy driver)
- `method: "execute"` -- returns rows as objects

### Use it from Next.js with Drizzle

Add your proxy URL and token to `.env.local`:

```env
DATABASE_PROXY_URL=https://your-proxy-url
DATABASE_PROXY_TOKEN=your-secret-token
```

Create a singleton Drizzle client. The `globalThis` cache prevents
Next.js's dev-mode HMR from creating a new client on every request:

```ts
// src/db/index.ts
import { drizzle } from "drizzle-orm/pg-proxy"

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof makeDb> | undefined
}

function makeDb() {
  const url = process.env.DATABASE_PROXY_URL!
  const token = process.env.DATABASE_PROXY_TOKEN!

  return drizzle(async (sql, params, method) => {
    const response = await fetch(`${url}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params, method }),
    })

    if (!response.ok) {
      throw new Error(`db-proxy ${response.status}: ${await response.text()}`)
    }

    const rows = await response.json()
    return { rows }
  })
}

export const db = globalThis.__db ?? (globalThis.__db = makeDb())
```

Note: Next.js 15 may re-evaluate `globalThis` on dynamic route segments in
dev. The pattern still prevents accidental client churn in production.

Use it from a Server Component:

```tsx
// src/app/users/page.tsx
import { db } from "@/db"
import { sql } from "drizzle-orm"

export default async function UsersPage() {
  const rows = await db.execute(sql`SELECT id, name FROM users ORDER BY id`)
  return (
    <ul>
      {rows.map((u) => (
        <li key={u.id as number}>{u.name as string}</li>
      ))}
    </ul>
  )
}
```

Or from a Route Handler:

```ts
// src/app/api/users/route.ts
import { db } from "@/db"
import { sql } from "drizzle-orm"

export async function GET() {
  const rows = await db.execute(sql`SELECT id, name FROM users ORDER BY id`)
  return Response.json(rows)
}
```

#### Drizzle Kit (migrations)

Drizzle Kit talks to Postgres directly over TCP — it does not speak the
HTTP proxy protocol. Run migrations locally (or from CI) using a separate
`DATABASE_URL` env var that points directly at the database, bypassing
the proxy:

```sh
DATABASE_URL=postgres://user:pass@db:5432/dbname npx drizzle-kit push
```

#### Caveats

- **Multi-statement queries are not supported.** Semicolons are stripped from
  every query before execution, which means SQL containing a semicolon
  inside a string literal (e.g. `INSERT INTO t VALUES ('a; b')`) will be
  mangled. Use parameterised queries.
- **Healthcheck.** `GET /` returns `200` and is suitable for a Docker
  `HEALTHCHECK` or a Kubernetes liveness/readiness probe.
