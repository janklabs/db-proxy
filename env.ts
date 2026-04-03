import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    DATABASE_HOST: z.string(),
    DATABASE_USERNAME: z.string(),
    DATABASE_PASSWORD: z.string(),
    DATABASE_DB: z.string().optional(),
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
