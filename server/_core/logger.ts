/**
 * Structured Logger (pino)
 *
 * JSON output in production, pretty-printed in development.
 * Use `log.info(...)`, `log.error(...)` etc. throughout the server.
 */

import pino from "pino";

const isDev = (process.env.NODE_ENV || "development") !== "production";

export const log = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  ...(isDev
    ? { transport: { target: "pino/file", options: { destination: 1 } } }
    : {}),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default log;
