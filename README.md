README below is AI-generated. Please forgive me, I have a lot going on at the moment.

# db-proxy

An HTTP-to-PostgreSQL proxy for edge runtimes (Cloudflare Workers, Vercel Edge Functions, etc.) that can't make direct TCP connections to a database.

Exposes a single `POST /query` endpoint that accepts SQL over HTTP, forwards it to Postgres, and returns JSON results. Built with [Hono](https://hono.dev/) and designed to work with [Drizzle ORM's HTTP proxy driver](https://orm.drizzle.team/docs/connect-drizzle-proxy).

## Setup

```sh
npm install
```

### Environment variables

| Variable       | Description                                |
| -------------- | ------------------------------------------ |
| `DATABASE_URL` | PostgreSQL connection string               |
| `TOKEN`        | Bearer token used to authenticate requests |

## Usage

### Run locally

```sh
npm run build
npm start
```

### Docker

```sh
docker build -t db-proxy .
docker run -e DATABASE_URL="postgresql://user:pass@host:5432/db" -e TOKEN="secret" -p 80:80 db-proxy
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
    body: JSON.stringify({ sql, params, method }),
  })

  const rows = await response.json()
  return { rows }
})
```
