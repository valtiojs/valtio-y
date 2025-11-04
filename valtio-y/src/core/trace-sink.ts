import { LOG_PREFIX } from "./constants";

export interface TraceSink {
  readonly enabled: boolean;
  log: (message: string, payload?: unknown) => void;
}

class DisabledTraceSink implements TraceSink {
  readonly enabled = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  log(_message: string, _payload?: unknown): void {
    // no-op
  }
}

class ConsoleTraceSink implements TraceSink {
  readonly enabled = true;

  log(message: string, payload?: unknown): void {
    if (payload === undefined) {
      console.debug(`${LOG_PREFIX} ${message}`);
    } else {
      console.debug(`${LOG_PREFIX} ${message}`, payload);
    }
  }
}

/**
 * Create a trace sink that can be used for verbose instrumentation.
 */
export function createTraceSink(enabled: boolean): TraceSink {
  if (!enabled) {
    return new DisabledTraceSink();
  }
  return new ConsoleTraceSink();
}
