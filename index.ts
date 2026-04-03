import { env } from "./env"
import indexHtml from "./index.html"
import { logger } from "./logger"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { Client } from "pg"

const PORT = env.PORT

const [dbHost, dbPortStr] = env.DATABASE_HOST.split(":")
const dbPort = dbPortStr ? parseInt(dbPortStr) : 5432

const clients = new Map<string, Client>()

async function getClient(database: string): Promise<Client> {
  const existing = clients.get(database)
  if (existing) return existing

  const client = new Client({
    host: dbHost,
    port: dbPort,
    user: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    database: database,
  })

  await client.connect()
  logger.info({ database }, "New database connection established")
  clients.set(database, client)
  return client
}

const app = new Hono()

async function main() {
  // Debug logging middleware for all requests
  app.use("*", async (c, next) => {
    const start = Date.now()
    await next()
    const durationMs = Date.now() - start

    logger.debug(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
      },
      "HTTP request",
    )
  })

  app.get("/", (c) => {
    return c.html(indexHtml)
  })

  app.post("/query", async (c) => {
    const key = c.req.header("Authorization")
    if (key !== `Bearer ${env.TOKEN}`) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const body = await c.req.json()
    const { sql, params, method, database: queryDb } = body

    logger.debug({ requestBody: body }, "POST /query request")

    const database = env.DATABASE_DB ?? queryDb
    if (!database) {
      return c.json({ error: "database is required" }, 400)
    }

    // prevent multiple queries
    const sqlBody = sql.replace(/;/g, "")

    try {
      const client = await getClient(database)

      logger.debug(
        { sql: sqlBody, params, method, database },
        "Executing query",
      )

      if (method === "all") {
        const result = await client.query({
          text: sqlBody,
          values: params,
          rowMode: "array",
        })
        const responseBody = result.rows

        logger.debug(
          { rowCount: result.rowCount, responseBody },
          "Query result",
        )

        return c.json(responseBody)
      }

      if (method === "execute") {
        const result = await client.query({
          text: sqlBody,
          values: params,
        })
        const responseBody = result.rows

        logger.debug(
          { rowCount: result.rowCount, responseBody },
          "Query result",
        )

        return c.json(responseBody)
      }

      return c.json({ error: "Unknown method value" }, 500)
    } catch (e) {
      logger.error({ err: e, sql: sqlBody, database }, "Query execution failed")
      return c.json({ error: "error" }, 500)
    }
  })

  logger.info({ port: PORT }, "Listening on port")

  serve({
    fetch: app.fetch,
    port: PORT,
  })
}

main().catch((e) => {
  logger.error({ err: e }, "Fatal error during startup")
  process.exit(1)
})
