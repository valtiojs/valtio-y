import * as Y from "yjs";

/**
 * Wait for a microtask to complete.
 * Useful for waiting for async operations in tests.
 */
export const waitMicrotask = () => Promise.resolve();

/**
 * Wait for a specific amount of time.
 * @param ms - Milliseconds to wait
 */
export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a fresh Y.Doc for testing.
 */
export const createTestDoc = () => new Y.Doc();

/**
 * Make a change to a proxy and wait for it to propagate.
 * @param proxy - The proxy to modify
 * @param key - The property key to set
 * @param value - The value to set
 */
export const makeChange = async <T>(
  proxy: T,
  key: keyof T,
  value: T[keyof T],
) => {
  proxy[key] = value;
  await waitMicrotask();
};

/**
 * Wait for the undo manager's capture timeout to expire.
 * Ensures operations are separated into distinct undo items.
 * @param captureTimeout - The capture timeout value (default 500ms)
 */
export const waitForCaptureTimeout = async (captureTimeout = 500) => {
  await wait(captureTimeout + 100); // Add 100ms buffer
};

/**
 * Create two connected Y.Docs for testing collaborative scenarios.
 * Returns docs and a sync function to propagate updates between them.
 */
export const createConnectedDocs = () => {
  const doc1 = new Y.Doc();
  const doc2 = new Y.Doc();

  const syncDocs = () => {
    const state1 = Y.encodeStateAsUpdate(doc1);
    const state2 = Y.encodeStateAsUpdate(doc2);
    Y.applyUpdate(doc2, state1);
    Y.applyUpdate(doc1, state2);
  };

  return { doc1, doc2, syncDocs };
};
