import indexHtml from "./index.html"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { Client } from "pg"

const PORT = 80

const DATABASE_HOST = process.env.DATABASE_HOST
if (!DATABASE_HOST) {
  throw new Error("DATABASE_HOST is not defined")
}

const DATABASE_USERNAME = process.env.DATABASE_USERNAME
if (!DATABASE_USERNAME) {
  throw new Error("DATABASE_USERNAME is not defined")
}

const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD
if (!DATABASE_PASSWORD) {
  throw new Error("DATABASE_PASSWORD is not defined")
}

const DATABASE_DB = process.env.DATABASE_DB

const TOKEN = process.env.TOKEN
if (!TOKEN) {
  throw new Error("TOKEN is not defined")
}

const [dbHost, dbPortStr] = DATABASE_HOST.split(":")
const dbPort = dbPortStr ? parseInt(dbPortStr) : 5432

const clients = new Map<string, Client>()

async function getClient(database: string): Promise<Client> {
  const existing = clients.get(database)
  if (existing) return existing

  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: DATABASE_USERNAME,
    password: DATABASE_PASSWORD,
    database: database,
  })

  await client.connect()
  clients.set(database, client)
  return client
}

const app = new Hono()

async function main() {
  app.get("/", (c) => {
    return c.html(indexHtml)
  })

  app.post("/query", async (c) => {
    const key = c.req.header("Authorization")
    if (key !== `Bearer ${TOKEN}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const { sql, params, method, database: queryDb } = await c.req.json()

    const database = DATABASE_DB ?? queryDb
    if (!database) {
      return c.json({ error: "database is required" }, 400)
    }

    // prevent multiple queries
    const sqlBody = sql.replace(/;/g, "")

    try {
      const client = await getClient(database)

      if (method === "all") {
        const result = await client.query({
          text: sqlBody,
          values: params,
          rowMode: "array",
        })
        return c.json(result.rows)
      }

      if (method === "execute") {
        const result = await client.query({
          text: sqlBody,
          values: params,
        })
        return c.json(result.rows)
      }

      return c.json({ error: "Unknown method value" }, 500)
    } catch (e) {
      return c.json({ error: "error" }, 500)
    }
  })

  console.log(`Listening on port ${PORT}`)

  serve({
    fetch: app.fetch,
    port: PORT,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
