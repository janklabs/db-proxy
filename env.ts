import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().refine(
      (url) => {
        try {
          const u = new URL(url)
          return (
            (u.protocol === "postgres:" || u.protocol === "postgresql:") &&
            u.host.length > 0 &&
            u.pathname.length > 1
          )
        } catch {
          return false
        }
      },
      {
        message:
          "DATABASE_URL must be a Postgres connection string like postgres://user:pass@host:5432/dbname",
      },
    ),
    TOKEN: z.string(),
    PORT: z.coerce.number().int().min(1).max(65535).default(80),
    LOG_LEVEL: z
      .string()
      .default("info")
      .transform((v) => v.toLowerCase())
      .pipe(z.enum(["debug", "info", "warn", "error"])),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
