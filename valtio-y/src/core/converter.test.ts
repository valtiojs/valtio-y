/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  plainObjectToYType,
  yTypeToPlainObject,
  validateDeepForSharedState,
} from "./converter";
import { SynchronizationState } from "./synchronization-state";
import { createLogger } from "./logger";

describe("Converters: plainObjectToYType and yTypeToPlainObject", () => {
  it("plainObjectToYType handles primitives, undefined, null", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    // Test valid primitives
    const validVals = [0, 1, "s", true, null];
    const converted = validVals.map((v) =>
      plainObjectToYType(v, state, logger),
    );
    expect(converted).toEqual([0, 1, "s", true, null]);

    // Test that undefined throws an error per new architecture
    expect(() => plainObjectToYType(undefined, state, logger)).toThrowError(
      "[valtio-y] undefined is not allowed in shared state",
    );
  });

  it("plainObjectToYType converts nested structures", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    // Test with valid nested structure (no undefined)
    const input = {
      a: 1,
      b: { c: 2, d: [3, { e: 4 }] },
    } as const;
    const yVal = plainObjectToYType(input, state, logger) as Y.Map<unknown>;
    expect(yVal instanceof Y.Map).toBe(true);
    // Integrate into a document before reading
    const doc = new Y.Doc();
    const root = doc.getMap("root");
    root.set("val", yVal);
    const json = (root.get("val") as Y.Map<unknown>).toJSON();
    expect(json).toEqual({ a: 1, b: { c: 2, d: [3, { e: 4 }] } });

    // Test that undefined in object throws error (validation should happen before conversion)
    const inputWithUndefined = { a: 1, f: undefined };
    expect(() => {
      validateDeepForSharedState(inputWithUndefined);
      plainObjectToYType(inputWithUndefined, state, logger);
    }).toThrowError(
      "[valtio-y] undefined is not allowed in objects for shared state",
    );
  });

  it("plainObjectToYType rejects Date (must be explicitly converted)", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    const d = new Date("2020-01-01T00:00:00.000Z");
    expect(() => plainObjectToYType(d, state, logger)).toThrow(
      /Unable to convert non-plain object of type "Date"/,
    );
  });

  it("plainObjectToYType rejects RegExp (must be explicitly converted)", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    const r = /abc/gi;
    expect(() => plainObjectToYType(r, state, logger)).toThrow(
      /Unable to convert non-plain object of type "RegExp"/,
    );
  });

  it("plainObjectToYType throws on unknown non-plain objects", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    class Foo {
      constructor(public x: number) {}
    }
    const foo = new Foo(42);
    expect(() => plainObjectToYType(foo, state, logger)).toThrowError();
  });

  it("plainObjectToYType rejects URL (must be explicitly converted)", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    const u = new URL("https://example.com/path?q=1");
    expect(() => plainObjectToYType(u, state, logger)).toThrow(
      /Unable to convert non-plain object of type "URL"/,
    );
  });

  it("roundtrip: plain → Y → plain for supported shapes (normalized)", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    // Use only supported values - no undefined, explicitly convert Date/RegExp/URL
    const input = {
      a: 1,
      b: "s",
      c: true,
      d: null,
      f: [1, { x: 2 }],
      g: { nested: [{ k: "v" }] },
      dte: new Date("2020-01-02T00:00:00.000Z").toISOString(),
      re: /ab+/i.toString(),
      url: new URL("https://example.com/x?y=1").href,
    } as const;
    const yVal = plainObjectToYType(input, state, logger) as Y.Map<unknown>;
    const doc = new Y.Doc();
    const root = doc.getMap("root");
    root.set("val", yVal);
    const normalized = yTypeToPlainObject(yVal);
    expect(normalized).toEqual({
      a: 1,
      b: "s",
      c: true,
      d: null,
      f: [1, { x: 2 }],
      g: { nested: [{ k: "v" }] },
      dte: "2020-01-02T00:00:00.000Z",
      re: "/ab+/i",
      url: "https://example.com/x?y=1",
    });
  });

  it("arrays of explicitly converted special objects convert to string arrays", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    const arr = [
      new Date("2021-01-01T00:00:00.000Z").toISOString(),
      /x/gi.toString(),
      new URL("https://x.test/").href,
    ];
    const y = plainObjectToYType(arr, state, logger) as Y.Array<unknown>;
    const doc = new Y.Doc();
    const root = doc.getArray("arr");
    root.insert(0, [y]);
    const json = (root.get(0) as Y.Array<unknown>).toJSON();
    expect(json).toEqual([
      "2021-01-01T00:00:00.000Z",
      "/x/gi",
      "https://x.test/",
    ]);
  });

  it("deep undefined values are rejected per new architecture", () => {
    // Test that undefined in objects throws (validation layer)
    const objWithUndefined = {
      a: undefined,
    } as const;
    expect(() => validateDeepForSharedState(objWithUndefined)).toThrow(
      "[valtio-y] undefined is not allowed in objects for shared state",
    );

    // Test that undefined in nested objects throws (validation layer)
    const nestedObjWithUndefined = {
      b: { c: undefined },
    } as const;
    expect(() => validateDeepForSharedState(nestedObjWithUndefined)).toThrow(
      "[valtio-y] undefined is not allowed in objects for shared state",
    );

    // Arrays with undefined should also throw errors per new architecture (validation layer)
    const arrayWithUndefined = [1, undefined, 2];
    expect(() => validateDeepForSharedState(arrayWithUndefined)).toThrow(
      "[valtio-y] undefined is not allowed in shared state",
    );
  });

  it("throws for unsupported primitives and values", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    expect(() => plainObjectToYType(BigInt(1), state, logger)).toThrowError();
    expect(() => plainObjectToYType(Symbol("x"), state, logger)).toThrowError();
    expect(() => plainObjectToYType(() => {}, state, logger)).toThrowError();
    expect(() => plainObjectToYType(NaN, state, logger)).toThrowError();
    expect(() => plainObjectToYType(Infinity, state, logger)).toThrowError();
  });

  it("throws for unsupported object types", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    expect(() =>
      plainObjectToYType(new Promise(() => {}), state, logger),
    ).toThrowError();
    expect(() =>
      plainObjectToYType(new Error("x"), state, logger),
    ).toThrowError();
    expect(() =>
      plainObjectToYType(new WeakMap(), state, logger),
    ).toThrowError();
    expect(() =>
      plainObjectToYType(new WeakSet(), state, logger),
    ).toThrowError();
    expect(() =>
      plainObjectToYType(new Map([["a", 1]]), state, logger),
    ).toThrowError();
    expect(() =>
      plainObjectToYType(new Set([1, 2, 3]), state, logger),
    ).toThrowError();
    expect(() =>
      plainObjectToYType(new Uint8Array([1, 2]), state, logger),
    ).toThrowError();
    // DOM nodes are not available in happy-dom minimal by default; simulate by custom class
    class NodeLike {}
    expect(() =>
      plainObjectToYType(new NodeLike(), state, logger),
    ).toThrowError();
  });

  it("throws for unsupported nested values in objects and arrays", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    const obj = { ok: 1, bad: new Map([["a", 1]]) } as const;
    expect(() => plainObjectToYType(obj, state, logger)).toThrowError();

    const arr = [1, new Set([1])] as const;
    expect(() => plainObjectToYType(arr, state, logger)).toThrowError();
  });

  it("rejects nested Date/RegExp/URL inside containers (must be explicitly converted)", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    const d = new Date("2020-01-01T00:00:00.000Z");
    const r = /abc/gi;
    const u = new URL("https://example.com");

    // Test that raw Date/RegExp/URL are rejected in objects
    expect(() => plainObjectToYType({ d }, state, logger)).toThrow(
      /Unable to convert non-plain object of type "Date"/,
    );
    expect(() => plainObjectToYType({ r }, state, logger)).toThrow(
      /Unable to convert non-plain object of type "RegExp"/,
    );
    expect(() => plainObjectToYType({ u }, state, logger)).toThrow(
      /Unable to convert non-plain object of type "URL"/,
    );

    // Test that explicitly converted values work
    const input = {
      d: d.toISOString(),
      r: r.toString(),
      u: u.href,
      list: [d.toISOString(), r.toString(), u.href],
    };
    const yVal = plainObjectToYType(input, state, logger) as Y.Map<unknown>;
    expect(yVal instanceof Y.Map).toBe(true);
    const doc = new Y.Doc();
    const root = doc.getMap("root");
    root.set("val", yVal);
    const json = (root.get("val") as Y.Map<unknown>).toJSON();
    expect(json).toEqual({
      d: "2020-01-01T00:00:00.000Z",
      r: "/abc/gi",
      u: "https://example.com/",
      list: ["2020-01-01T00:00:00.000Z", "/abc/gi", "https://example.com/"],
    });
  });

  it("plainObjectToYType leaves AbstractType and controller proxies as-is", () => {
    const state = new SynchronizationState();
    const logger = createLogger();
    const yMap = new Y.Map();
    // Simulate controller proxy mapping
    const controller = {};
    state.valtioProxyToYType.set(controller, yMap);

    expect(plainObjectToYType(yMap, state, logger)).toBe(yMap);
    expect(plainObjectToYType(controller, state, logger)).toBe(yMap);
  });

  it("yTypeToPlainObject converts Y types to plain structures", () => {
    const yMap = new Y.Map();
    const arr = new Y.Array();
    arr.insert(0, [1, 2, 3]);
    yMap.set("a", 1);
    yMap.set("b", arr);
    const nested = new Y.Map();
    nested.set("x", "y");
    yMap.set("c", nested);
    // Integrate into a document before reading
    const doc = new Y.Doc();
    const root = doc.getMap("root");
    root.set("val", yMap);
    const out = yTypeToPlainObject(yMap);
    expect(out).toEqual({ a: 1, b: [1, 2, 3], c: { x: "y" } });
  });
});
