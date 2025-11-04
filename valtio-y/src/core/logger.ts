import { LOG_PREFIX } from "./constants";

/**
 * Log level configuration for valtio-y logger.
 *
 * Levels (from most to least verbose):
 * - "trace": Most verbose, includes all internal operation traces
 * - "debug": Debug information for troubleshooting
 * - "warn": Warnings about potential issues
 * - "error": Errors only
 * - "off": Disable all logging
 */
export type LogLevel = "off" | "error" | "warn" | "debug" | "trace";

/**
 * Logger interface for valtio-y.
 * Provides trace, debug, warn, and error logging with automatic prefix handling.
 */
export interface Logger {
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Create a logger instance with specified log level.
 *
 * @param level - Log level (default: "off")
 * @returns Logger instance that automatically prefixes all messages with [valtio-y]
 */
export function createLogger(level: LogLevel = "off"): Logger {
  const withPrefix = (...args: unknown[]): unknown[] =>
    args.length > 0 && typeof args[0] === "string"
      ? [`${LOG_PREFIX} ${args[0] as string}`, ...(args.slice(1) as unknown[])]
      : [LOG_PREFIX, ...args];

  // Determine which log levels are enabled based on hierarchy
  const isTraceEnabled = level === "trace";
  const isDebugEnabled = level === "debug" || isTraceEnabled;
  // Warn and error ALWAYS log (important user-facing messages)
  const isWarnEnabled = true;
  const isErrorEnabled = true;

  return {
    trace: (...args: unknown[]) => {
      if (!isTraceEnabled) return;
      console.debug(...(withPrefix(...args) as unknown[]));
    },
    debug: (...args: unknown[]) => {
      if (!isDebugEnabled) return;
      console.debug(...(withPrefix(...args) as unknown[]));
    },
    warn: (...args: unknown[]) => {
      if (!isWarnEnabled) return;
      console.warn(...(withPrefix(...args) as unknown[]));
    },
    error: (...args: unknown[]) => {
      if (!isErrorEnabled) return;
      console.error(...(withPrefix(...args) as unknown[]));
    },
  };
}
