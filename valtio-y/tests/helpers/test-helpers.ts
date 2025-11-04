/* eslint @typescript-eslint/no-explicit-any: "off" */

import * as Y from "yjs";
import { createYjsProxy } from "../../src/index";

export const waitMicrotask = () => Promise.resolve();

export type LooseRecord = Record<string, any>;
export type LooseArray = any[];

export const asLooseRecord = (value: unknown): LooseRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected record-like proxy node");
  }
  return value as LooseRecord;
};

export const asLooseArray = (value: unknown): LooseArray => {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected array-like proxy node");
  }
  return value as LooseArray;
};

export type GetRootFn = (d: Y.Doc) => Y.Map<unknown> | Y.Array<unknown>;

export function createDocWithProxy<T extends object>(getRoot: GetRootFn) {
  const doc = new Y.Doc();
  const result = createYjsProxy<T>(doc, { getRoot });
  return { doc, ...result } as const;
}

export function createTwoDocsWithRelay(): {
  docA: Y.Doc;
  docB: Y.Doc;
  RELAY_ORIGIN: symbol;
} {
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const RELAY_ORIGIN = Symbol("relay-origin");

  docA.on("update", (update, origin) => {
    if (origin === RELAY_ORIGIN) return;
    docB.transact(() => {
      Y.applyUpdate(docB, update);
    }, RELAY_ORIGIN);
  });
  docB.on("update", (update, origin) => {
    if (origin === RELAY_ORIGIN) return;
    docA.transact(() => {
      Y.applyUpdate(docA, update);
    }, RELAY_ORIGIN);
  });

  return { docA, docB, RELAY_ORIGIN } as const;
}

export function createRelayedProxiesMapRoot<
  T extends object = LooseRecord,
>(options?: { logLevel?: "off" | "error" | "warn" | "debug" | "trace" }) {
  const { docA, docB } = createTwoDocsWithRelay();
  const a = createYjsProxy<T>(docA, {
    getRoot: (d) => d.getMap("root"),
    logLevel: options?.logLevel,
  });
  const b = createYjsProxy<T>(docB, {
    getRoot: (d) => d.getMap("root"),
    logLevel: options?.logLevel,
  });
  return {
    docA,
    docB,
    proxyA: a.proxy,
    proxyB: b.proxy,
    bootstrapA: a.bootstrap,
    disposeA: a.dispose,
    disposeB: b.dispose,
  } as const;
}

export function createRelayedProxiesArrayRoot<
  T extends unknown[] = LooseArray,
>() {
  const { docA, docB } = createTwoDocsWithRelay();
  const a = createYjsProxy<T>(docA, { getRoot: (d) => d.getArray("arr") });
  const b = createYjsProxy<T>(docB, { getRoot: (d) => d.getArray("arr") });
  return {
    docA,
    docB,
    proxyA: a.proxy,
    proxyB: b.proxy,
    bootstrapA: a.bootstrap,
    disposeA: a.dispose,
    disposeB: b.dispose,
  } as const;
}

// Helper functions for type-safe Y.Map access
export function asYMap<T = unknown>(value: unknown): Y.Map<T> {
  return value as Y.Map<T>;
}

export function getYMap<T = unknown>(
  yMap: Y.Map<unknown>,
  key: string,
): Y.Map<T> | undefined {
  const value = yMap.get(key);
  return value instanceof Y.Map ? (value as Y.Map<T>) : undefined;
}

// Helper for accessing nested properties on LooseRecord
export function getNested<T>(obj: LooseRecord, path: string[]): T | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (
      current &&
      typeof current === "object" &&
      !Array.isArray(current) &&
      key in current
    ) {
      current = (current as LooseRecord)[key];
    } else {
      return undefined;
    }
  }
  return current as T;
}

// Type guards for unknown values in tests
export function assertObject(value: unknown): asserts value is object {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Expected object");
  }
}

export function assertArray(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Expected array");
  }
}

export function assertRecord(value: unknown): asserts value is LooseRecord {
  assertObject(value);
  if (Array.isArray(value)) {
    throw new TypeError("Expected record, got array");
  }
}
