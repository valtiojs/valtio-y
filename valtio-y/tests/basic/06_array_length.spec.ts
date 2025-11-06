import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsProxy } from "../../src/index";

const waitMicrotask = () => Promise.resolve();

describe("array length manipulation", () => {
  // Note: Direct length manipulation is not supported in valtio-y.
  // See docs/architecture/limitations.md for details.
  // Use splice() for array resizing operations.

  it("clear array using splice", async () => {
    // Recommended approach: use splice instead of length manipulation
    const doc = new Y.Doc();
    const { proxy: p, bootstrap } = createYjsProxy<string[]>(doc, {
      getRoot: (d) => d.getArray("root"),
    });
    const a = doc.getArray<string>("root");

    bootstrap(["a", "b", "c"]);
    await waitMicrotask();

    p.splice(0);
    await waitMicrotask();

    expect(a.toJSON()).toEqual([]);
    expect(p).toEqual([]);

    p.push("b");
    await waitMicrotask();

    expect(a.toJSON()).toEqual(["b"]);
    expect(p).toEqual(["b"]);
  });

  it("shrink array using splice", async () => {
    // Recommended approach: use splice instead of length manipulation
    const doc = new Y.Doc();
    const { proxy: p, bootstrap } = createYjsProxy<string[]>(doc, {
      getRoot: (d) => d.getArray("root"),
    });
    const a = doc.getArray<string>("root");

    bootstrap(["a", "b", "c"]);
    await waitMicrotask();

    p.splice(2);
    await waitMicrotask();

    expect(a.toJSON()).toEqual(["a", "b"]);
    expect(p).toEqual(["a", "b"]);

    p.push("c");
    await waitMicrotask();

    expect(a.toJSON()).toEqual(["a", "b", "c"]);
    expect(p).toEqual(["a", "b", "c"]);
  });
});
