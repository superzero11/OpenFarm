import pino from "pino";

/**
 * Pino structured logger for server-side use.
 *
 * - JSON output in production (machine-parseable)
 * - Human-friendly output in development
 * - Child loggers via `logger.child({ component: "..." })` for scoped context
 *
 * Note: pino-pretty uses worker threads via ThreadStream which can crash
 * the Next.js dev server, so we stick with plain pino in all environments.
 */
const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
    level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
    ...(isProduction
        ? {} // JSON output in production (default)
        : { formatters: { level: (label: string) => ({ level: label }) } }),
    base: { service: "openfarm-web" },
});
