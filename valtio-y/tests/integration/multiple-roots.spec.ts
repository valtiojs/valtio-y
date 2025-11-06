import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYjsProxy } from "../../src/index";
import { waitMicrotask } from "../helpers/test-helpers";

describe("Multiple Root Proxies", () => {
  it("should support multiple root proxies on same document", async () => {
    const doc = new Y.Doc();

    const { proxy: gameState } = createYjsProxy<{ score: number }>(doc, {
      getRoot: (d) => d.getMap("gameState"),
    });

    const { proxy: chat } = createYjsProxy<string[]>(doc, {
      getRoot: (d) => d.getArray("chat"),
    });

    // Both proxies should work independently
    gameState.score = 100;
    chat.push("Hello");
    await waitMicrotask();

    expect(gameState.score).toBe(100);
    expect(chat[0]).toBe("Hello");

    // Verify they use different Y structures
    expect(doc.getMap("gameState").get("score")).toBe(100);
    expect(doc.getArray("chat").get(0)).toBe("Hello");
  });

  it("should allow multiple proxies to operate independently without interference", async () => {
    const doc = new Y.Doc();

    // Create proxies for different parts of the document
    const { proxy: userSettings } = createYjsProxy<{
      theme: string;
      notifications: boolean;
    }>(doc, {
      getRoot: (d) => d.getMap("settings"),
    });

    const { proxy: tasks } = createYjsProxy<Array<{ id: number; text: string }>>(
      doc,
      {
        getRoot: (d) => d.getArray("tasks"),
      },
    );

    const { proxy: metadata } = createYjsProxy<{ version: number; updated: string }>(
      doc,
      {
        getRoot: (d) => d.getMap("metadata"),
      },
    );

    // Perform operations on all proxies
    userSettings.theme = "dark";
    userSettings.notifications = true;

    tasks.push({ id: 1, text: "First task" });
    tasks.push({ id: 2, text: "Second task" });

    metadata.version = 1;
    metadata.updated = "2025-11-06";

    await waitMicrotask();

    // Verify each proxy maintained its own state
    expect(userSettings.theme).toBe("dark");
    expect(userSettings.notifications).toBe(true);

    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.text).toBe("First task");
    expect(tasks[1]?.text).toBe("Second task");

    expect(metadata.version).toBe(1);
    expect(metadata.updated).toBe("2025-11-06");

    // Verify Y structures are separate
    expect(doc.getMap("settings").get("theme")).toBe("dark");
    expect(doc.getArray("tasks").length).toBe(2);
    expect(doc.getMap("metadata").get("version")).toBe(1);
  });

  it("should handle updates to one proxy without affecting others", async () => {
    const doc = new Y.Doc();

    const { proxy: counter } = createYjsProxy<{ count: number }>(doc, {
      getRoot: (d) => d.getMap("counter"),
    });

    const { proxy: items } = createYjsProxy<string[]>(doc, {
      getRoot: (d) => d.getArray("items"),
    });

    // Initial state
    counter.count = 0;
    items.push("A");
    await waitMicrotask();

    // Update counter multiple times
    for (let i = 1; i <= 5; i++) {
      counter.count = i;
    }
    await waitMicrotask();

    // Verify items array is unaffected
    expect(items).toHaveLength(1);
    expect(items[0]).toBe("A");
    expect(counter.count).toBe(5);

    // Update items array
    items.push("B", "C");
    await waitMicrotask();

    // Verify counter is unaffected
    expect(counter.count).toBe(5);
    expect(items).toHaveLength(3);
    expect(items).toEqual(["A", "B", "C"]);
  });

  it("should support nested objects in multiple roots", async () => {
    const doc = new Y.Doc();

    const { proxy: profile } = createYjsProxy<{
      user: { name: string; age: number };
      preferences: { color: string };
    }>(doc, {
      getRoot: (d) => d.getMap("profile"),
    });

    const { proxy: history } = createYjsProxy<
      Array<{ action: string; timestamp: number }>
    >(doc, {
      getRoot: (d) => d.getArray("history"),
    });

    // Set up nested structures
    profile.user = { name: "Alice", age: 30 };
    profile.preferences = { color: "blue" };

    history.push({ action: "login", timestamp: 1000 });
    history.push({ action: "view", timestamp: 2000 });

    await waitMicrotask();

    // Verify nested structures work correctly
    expect(profile.user.name).toBe("Alice");
    expect(profile.user.age).toBe(30);
    expect(profile.preferences.color).toBe("blue");

    expect(history[0]?.action).toBe("login");
    expect(history[1]?.timestamp).toBe(2000);

    // Modify nested objects
    profile.user.age = 31;
    history[0]!.action = "signin";

    await waitMicrotask();

    expect(profile.user.age).toBe(31);
    expect(history[0]?.action).toBe("signin");
  });

  it("should allow disposal of individual proxies without affecting others", async () => {
    const doc = new Y.Doc();

    const proxy1 = createYjsProxy<{ value: number }>(doc, {
      getRoot: (d) => d.getMap("proxy1"),
    });

    const proxy2 = createYjsProxy<{ value: number }>(doc, {
      getRoot: (d) => d.getMap("proxy2"),
    });

    // Set values
    proxy1.proxy.value = 10;
    proxy2.proxy.value = 20;
    await waitMicrotask();

    // Dispose first proxy
    proxy1.dispose();

    // Second proxy should still work
    proxy2.proxy.value = 30;
    await waitMicrotask();

    expect(proxy2.proxy.value).toBe(30);
    expect(doc.getMap("proxy2").get("value")).toBe(30);

    // First proxy's data is still in the Y.Doc (just not synced)
    expect(doc.getMap("proxy1").get("value")).toBe(10);

    // Clean up
    proxy2.dispose();
  });
});
