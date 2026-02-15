import pino from "pino";

/**
 * Pino logger for server-side use.
 *
 * Note: pino-pretty uses worker threads via ThreadStream which crashes
 * the Next.js dev server. In development we use a simple stdout destination
 * with colorized output disabled to avoid the worker thread issue.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
});
