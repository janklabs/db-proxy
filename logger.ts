import { env } from "./env"
import pino from "pino"

export const logger = pino({
  level: env.LOG_LEVEL,
})
