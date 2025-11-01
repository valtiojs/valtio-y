/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsProxy } from "../../src/index";
import { waitMicrotask } from "../helpers/test-helpers";

describe("Integration: Error Handling", () => {
  describe("Invalid Value Types", () => {
    it("normalizes undefined to null (not an error)", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      proxy.value = undefined;
      await waitMicrotask();

      expect(yRoot.get("value")).toBe(null);
    });

    it("rejects function values synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.fn = () => {};
      }).toThrow(/Unable to convert function/);
    });

    it("rejects symbol values synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.sym = Symbol("test");
      }).toThrow(/Unable to convert symbol/);
    });

    it("rejects BigInt values synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.big = BigInt(123);
      }).toThrow(/Unable to convert BigInt/);
    });

    it("rejects Infinity synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.inf = Infinity;
      }).toThrow(/Infinity and NaN are not allowed/);
    });

    it("rejects NaN synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.nan = NaN;
      }).toThrow(/Infinity and NaN are not allowed/);
    });

    it("rejects -Infinity synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.negInf = -Infinity;
      }).toThrow(/Infinity and NaN are not allowed/);
    });
  });

  describe("Invalid Object Types", () => {
    it("rejects custom class instances synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      class CustomClass {
        value = 42;
      }

      expect(() => {
        proxy.custom = new CustomClass();
      }).toThrow(/Unable to convert non-plain object of type "CustomClass"/);
    });

    it("rejects Map instances synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.map = new Map([["key", "value"]]);
      }).toThrow(/Unable to convert non-plain object of type "Map"/);
    });

    it("rejects Set instances synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.set = new Set([1, 2, 3]);
      }).toThrow(/Unable to convert non-plain object of type "Set"/);
    });

    it("rejects WeakMap instances synchronously", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.weakMap = new WeakMap();
      }).toThrow(/Unable to convert non-plain object of type "WeakMap"/);
    });

    it("rejects Date objects (must be explicitly converted)", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.date = new Date("2024-01-01T00:00:00.000Z");
      }).toThrow(/Unable to convert non-plain object of type "Date"/);
    });

    it("rejects RegExp objects (must be explicitly converted)", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.regex = /test/gi;
      }).toThrow(/Unable to convert non-plain object of type "RegExp"/);
    });

    it("allows explicitly converted Date as string", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      // User must explicitly convert
      proxy.date = new Date("2024-01-01T00:00:00.000Z").toISOString();
      await waitMicrotask();

      expect(yRoot.get("date")).toBe("2024-01-01T00:00:00.000Z");
    });

    it("allows explicitly converted RegExp as string", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      // User must explicitly convert
      proxy.regex = /test/gi.toString();
      await waitMicrotask();

      expect(yRoot.get("regex")).toBe("/test/gi");
    });
  });

  describe("Nested Invalid Values", () => {
    it("rejects undefined in nested objects", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.nested = { valid: "value", invalid: undefined };
      }).toThrow(/undefined is not allowed in objects for shared state/);
    });

    it("rejects functions in nested objects", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.nested = { valid: "value", fn: () => {} };
      }).toThrow(/Unable to convert function/);
    });

    it("rejects invalid values in arrays", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.arr = [1, 2, Symbol("bad"), 4];
      }).toThrow(/Unable to convert symbol/);
    });

    it("rejects invalid values deep in structure", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      expect(() => {
        proxy.deep = {
          level1: {
            level2: {
              level3: {
                invalid: BigInt(999),
              },
            },
          },
        };
      }).toThrow(/Unable to convert BigInt/);
    });
  });

  describe("Y.js Type Re-parenting", () => {
    it("rejects re-assigning Y type that is already in document", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      const yMap = new Y.Map();
      yRoot.set("original", yMap);
      await waitMicrotask();

      expect(() => {
        proxy.duplicate = yMap;
      }).toThrow(
        /Cannot re-assign a collaborative object that is already in the document/
      );
    });

    it("rejects re-assigning Y.Array that is already in document", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      const yArray = new Y.Array();
      yRoot.set("original", yArray);
      await waitMicrotask();

      expect(() => {
        proxy.duplicate = yArray;
      }).toThrow(
        /Cannot re-assign a collaborative object that is already in the document/
      );
    });

    it("rejects re-assigning Y.Text that is already in document", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      const yText = new Y.Text("content");
      yRoot.set("original", yText);
      await waitMicrotask();

      expect(() => {
        proxy.duplicate = yText;
      }).toThrow(
        /Cannot re-assign a collaborative object that is already in the document/
      );
    });

    it("allows assigning Y type that has no parent", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      const yMap = new Y.Map();
      yMap.set("key", "value");

      proxy.newMap = yMap;
      await waitMicrotask();

      expect(yRoot.get("newMap")).toBe(yMap);
    });
  });

  describe("Recovery from Errors", () => {
    it("proxy remains functional after validation error", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      expect(() => {
        proxy.bad = Symbol("test");
      }).toThrow();

      // Proxy should still work
      proxy.good = "value";
      await waitMicrotask();

      expect(yRoot.get("good")).toBe("value");
      expect(yRoot.has("bad")).toBe(false);
    });

    it("can correct invalid value after error", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      expect(() => {
        proxy.value = NaN;
      }).toThrow();

      // Fix with valid value
      proxy.value = 42;
      await waitMicrotask();

      expect(yRoot.get("value")).toBe(42);
    });

    it("rollsback proxy state after error", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });

      proxy.existing = "original";

      expect(() => {
        proxy.existing = Infinity;
      }).toThrow();

      // Value should be rolled back to original
      expect(proxy.existing).toBe("original");
    });
  });

  describe("Array Operation Errors", () => {
    it("rejects pushing invalid values to array", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, {
        getRoot: (d) => d.getArray("arr"),
      });

      expect(() => {
        proxy.push(BigInt(123));
      }).toThrow(/Unable to convert BigInt/);
    });

    it("rejects unshifting invalid values to array", () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, {
        getRoot: (d) => d.getArray("arr"),
      });

      expect(() => {
        proxy.unshift(Symbol("bad"));
      }).toThrow(/Unable to convert symbol/);
    });

    it("rejects setting invalid values in array", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, {
        getRoot: (d) => d.getArray("arr"),
      });

      proxy.push(1, 2, 3);
      await waitMicrotask();

      expect(() => {
        proxy[1] = NaN;
      }).toThrow(/Infinity and NaN are not allowed/);
    });

    it("rejects splice with invalid values", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, {
        getRoot: (d) => d.getArray("arr"),
      });

      proxy.push(1, 2, 3);
      await waitMicrotask();

      expect(() => {
        proxy.splice(1, 1, () => {});
      }).toThrow(/Unable to convert function/);
    });
  });

  describe("Edge Case Error Scenarios", () => {
    it("handles null correctly (not an error)", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      proxy.nullValue = null;
      await waitMicrotask();

      expect(yRoot.get("nullValue")).toBe(null);
    });

    it("handles empty objects correctly", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      proxy.empty = {};
      await waitMicrotask();

      const yEmpty = yRoot.get("empty") as Y.Map<any>;
      expect(yEmpty).toBeInstanceOf(Y.Map);
      expect(yEmpty.size).toBe(0);
    });

    it("handles empty arrays correctly", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      proxy.emptyArr = [];
      await waitMicrotask();

      const yArr = yRoot.get("emptyArr") as Y.Array<any>;
      expect(yArr).toBeInstanceOf(Y.Array);
      expect(yArr.length).toBe(0);
    });

    it("handles zero correctly", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      proxy.zero = 0;
      await waitMicrotask();

      expect(yRoot.get("zero")).toBe(0);
    });

    it("handles empty string correctly", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      proxy.empty = "";
      await waitMicrotask();

      expect(yRoot.get("empty")).toBe("");
    });

    it("handles false boolean correctly", async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, {
        getRoot: (d) => d.getMap("root"),
      });
      const yRoot = doc.getMap<any>("root");

      proxy.falseValue = false;
      await waitMicrotask();

      expect(yRoot.get("falseValue")).toBe(false);
    });
  });

  describe('Map Validation and Rollback', () => {
    it('should rollback map changes on validation error (nested undefined)', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap('root'),
      });
      
      bootstrap({ user: { name: 'Alice', age: 30 } });
      await waitMicrotask();
      
      const originalState = { ...proxy.user as object };
      const yRoot = doc.getMap('root');
      
      // Try to assign an object with nested undefined (should fail validation)
      expect(() => {
        (proxy as Record<string, unknown>).user = { name: 'Bob', invalid: undefined };
      }).toThrow('[valtio-yjs] undefined is not allowed');
      
      // Should rollback to original state in proxy
      expect(proxy.user).toEqual(originalState);
      
      // Yjs should still have original state
      expect(yRoot.get('user')).toBeInstanceOf(Y.Map);
      const yUser = yRoot.get('user') as Y.Map<unknown>;
      expect(yUser.get('name')).toBe('Alice');
      expect(yUser.get('age')).toBe(30);
    });

    it('should rollback individual key change on validation error', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap('root'),
      });
      
      bootstrap({ a: 1, b: 2, c: 3 });
      await waitMicrotask();
      
      const yRoot = doc.getMap('root');
      
      // Valid changes should succeed
      (proxy as Record<string, unknown>).a = 10;
      await waitMicrotask();
      expect(yRoot.get('a')).toBe(10);
      
      // Invalid change should fail and rollback only that key
      expect(() => {
        (proxy as Record<string, unknown>).invalid = { nested: undefined };
      }).toThrow('[valtio-yjs] undefined is not allowed');
      
      // The invalid key should not be set in proxy (rolled back)
      expect((proxy as Record<string, unknown>).invalid).toBeUndefined();
      
      // Yjs should not have the invalid key
      expect(yRoot.has('invalid')).toBe(false);
      
      // Other keys should remain untouched
      expect(yRoot.get('a')).toBe(10);
      expect(yRoot.get('b')).toBe(2);
      expect(yRoot.get('c')).toBe(3);
    });

    it('should rollback on function assignment', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap('root'),
      });
      
      bootstrap({ data: { value: 42 } });
      await waitMicrotask();
      
      const originalState = { ...proxy.data as object };
      const yRoot = doc.getMap('root');
      
      // Try to assign a function (not allowed)
      expect(() => {
        (proxy as Record<string, unknown>).data = { callback: () => {} };
      }).toThrow('Unable to convert function');
      
      // Should rollback to original state
      expect(proxy.data).toEqual(originalState);
      
      // Yjs should still have original state
      const yData = yRoot.get('data') as Y.Map<unknown>;
      expect(yData.get('value')).toBe(42);
    });

    it('should rollback on non-plain object assignment', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap('root'),
      });
      
      bootstrap({ settings: { mode: 'light' } });
      await waitMicrotask();
      
      const originalState = { ...proxy.settings as object };
      const yRoot = doc.getMap('root');
      
      class CustomClass {
        constructor(public x: number) {}
      }
      
      // Try to assign a non-plain object
      expect(() => {
        (proxy as Record<string, unknown>).settings = { custom: new CustomClass(42) };
      }).toThrow('Unable to convert non-plain object');
      
      // Should rollback to original state
      expect(proxy.settings).toEqual(originalState);
      
      // Yjs should still have original state
      const ySettings = yRoot.get('settings') as Y.Map<unknown>;
      expect(ySettings.get('mode')).toBe('light');
    });

    it('should handle delete operations without rollback issues', async () => {
      const doc = new Y.Doc();
      const { proxy, bootstrap } = createYjsProxy<Record<string, unknown>>(doc, {
        getRoot: (d) => d.getMap('root'),
      });
      
      bootstrap({ a: 1, b: 2 });
      await waitMicrotask();
      
      const yRoot = doc.getMap('root');
      
      // Delete operations should work normally
      delete (proxy as Record<string, unknown>).a;
      await waitMicrotask();
      
      expect(proxy.a).toBeUndefined();
      expect(yRoot.has('a')).toBe(false);
      expect(yRoot.get('b')).toBe(2);
    });

    it('should match array rollback behavior pattern', async () => {
      const docArray = new Y.Doc();
      const docMap = new Y.Doc();
      
      const { proxy: arrayProxy, bootstrap: bootstrapArray } = createYjsProxy<unknown[]>(docArray, {
        getRoot: (d) => d.getArray('data'),
      });
      
      const { proxy: mapProxy, bootstrap: bootstrapMap } = createYjsProxy<Record<string, unknown>>(docMap, {
        getRoot: (d) => d.getMap('data'),
      });
      
      // Bootstrap both with valid data
      bootstrapArray([{ id: 1, value: 'a' }]);
      bootstrapMap({ item: { id: 1, value: 'a' } });
      await waitMicrotask();
      
      // Try to assign invalid data to both
      let arrayError: Error | undefined;
      let mapError: Error | undefined;
      
      try {
        arrayProxy[0] = { id: 2, nested: { invalid: undefined } };
      } catch (err) {
        arrayError = err as Error;
      }
      
      try {
        (mapProxy as Record<string, unknown>).item = { id: 2, nested: { invalid: undefined } };
      } catch (err) {
        mapError = err as Error;
      }
      
      // Both should throw similar errors
      expect(arrayError).toBeDefined();
      expect(mapError).toBeDefined();
      expect(arrayError?.message).toContain('undefined is not allowed');
      expect(mapError?.message).toContain('undefined is not allowed');
      
      // Both should maintain original state
      expect((arrayProxy[0] as Record<string, unknown>).id).toBe(1);
      expect(((mapProxy as Record<string, unknown>).item as Record<string, unknown>).id).toBe(1);
      
      // Both Yjs docs should have original state
      expect(docArray.getArray('data').toJSON()).toEqual([{ id: 1, value: 'a' }]);
      expect(docMap.getMap('data').toJSON()).toEqual({ item: { id: 1, value: 'a' } });
    });
  });
});
