import { env } from "./env"
import indexHtml from "./index.html"
import { logger } from "./logger"
import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { Pool } from "pg"
import { z } from "zod"

const PORT = env.PORT

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
})

const querySchema = z.object({
  sql: z.string(),
  params: z
    .array(z.unknown())
    .nullish()
    .transform((v) => v ?? []),
  method: z.enum(["all", "execute"]),
  database: z
    .never({
      message:
        "The 'database' field is not accepted; this proxy is locked to a single database via DATABASE_URL",
    })
    .optional(),
})

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

    const rawBody = await c.req.json()
    const parsed = querySchema.safeParse(rawBody)
    if (!parsed.success) {
      logger.debug(
        { requestBody: rawBody, issues: parsed.error.issues },
        "POST /query rejected: invalid body",
      )
      return c.json({ error: "Bad Request", issues: parsed.error.issues }, 400)
    }
    const { sql, params, method } = parsed.data

    logger.debug({ requestBody: parsed.data }, "POST /query request")

    // prevent multiple queries
    const sqlBody = sql.replace(/;/g, "")

    try {
      const client = pool

      logger.debug({ sql: sqlBody, params, method }, "Executing query")

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
    } catch (e) {
      logger.error({ err: e, sql: sqlBody }, "Query execution failed")
      return c.json({ error: "error" }, 500)
    }
  })

  logger.info({ port: PORT, logLevel: env.LOG_LEVEL }, "Server started")

  serve({
    fetch: app.fetch,
    port: PORT,
  })

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down")
    pool
      .end()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

main().catch((e) => {
  logger.error({ err: e }, "Fatal error during startup")
  process.exit(1)
})
