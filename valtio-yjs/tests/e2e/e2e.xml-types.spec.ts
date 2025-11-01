import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { subscribe } from "valtio/vanilla";
import {
  createRelayedProxiesMapRoot,
  createRelayedProxiesArrayRoot,
  waitMicrotask,
} from "../helpers/test-helpers";

describe("E2E: Y.Xml Types", () => {
  describe("Y.XmlFragment", () => {
    it("can create and sync Y.XmlFragment as a container", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      // Create XmlFragment on A
      const fragment = new Y.XmlFragment();
      const element = new Y.XmlElement("div");
      fragment.insert(0, [element]);

      proxyA.fragment = fragment;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // B should see the fragment
      expect(proxyB.fragment).toBeInstanceOf(Y.XmlFragment);
      expect(proxyB.fragment.length).toBe(1);
      expect(proxyB.fragment.get(0)).toBeInstanceOf(Y.XmlElement);
    });

    it("syncs insertions into Y.XmlFragment", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const fragment = new Y.XmlFragment();
      proxyA.fragment = fragment;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // A inserts an element
      const element = new Y.XmlElement("p");
      proxyA.fragment.insert(0, [element]);
      await waitMicrotask();

      // B sees the insertion
      expect(proxyB.fragment.length).toBe(1);
      expect(proxyB.fragment.get(0)).toBeInstanceOf(Y.XmlElement);
      expect(proxyB.fragment.get(0).nodeName).toBe("p");
    });

    it("syncs deletions from Y.XmlFragment", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const fragment = new Y.XmlFragment();
      const el1 = new Y.XmlElement("div");
      const el2 = new Y.XmlElement("span");
      const el3 = new Y.XmlElement("p");
      fragment.insert(0, [el1, el2, el3]);

      proxyA.fragment = fragment;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      expect(proxyB.fragment.length).toBe(3);

      // A deletes the middle element
      proxyA.fragment.delete(1, 1);
      await waitMicrotask();

      // B sees the deletion
      expect(proxyB.fragment.length).toBe(2);
      expect(proxyB.fragment.get(0).nodeName).toBe("div");
      expect(proxyB.fragment.get(1).nodeName).toBe("p");
    });

    it("handles empty Y.XmlFragment", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const fragment = new Y.XmlFragment();
      proxyA.fragment = fragment;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // B should see empty fragment
      expect(proxyB.fragment).toBeInstanceOf(Y.XmlFragment);
      expect(proxyB.fragment.length).toBe(0);
    });
  });

  describe("Y.XmlElement", () => {
    it("can create and sync Y.XmlElement with attributes", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      // Create XmlElement with attributes
      const element = new Y.XmlElement("div");
      element.setAttribute("class", "container");
      element.setAttribute("id", "main");

      proxyA.element = element;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // B should see the element with attributes
      expect(proxyB.element).toBeInstanceOf(Y.XmlElement);
      expect(proxyB.element.nodeName).toBe("div");
      expect(proxyB.element.getAttribute("class")).toBe("container");
      expect(proxyB.element.getAttribute("id")).toBe("main");
    });

    it("syncs attribute changes", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const element = new Y.XmlElement("div");
      proxyA.element = element;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // A sets attribute
      proxyA.element.setAttribute("data-test", "value");
      await waitMicrotask();

      // B sees the attribute
      expect(proxyB.element.getAttribute("data-test")).toBe("value");
    });

    it("syncs children insertions", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const element = new Y.XmlElement("div");
      proxyA.element = element;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // A inserts a child
      const child = new Y.XmlElement("span");
      proxyA.element.insert(0, [child]);
      await waitMicrotask();

      // B sees the child
      expect(proxyB.element.length).toBe(1);
      expect(proxyB.element.get(0)).toBeInstanceOf(Y.XmlElement);
      expect(proxyB.element.get(0).nodeName).toBe("span");
    });

    it("syncs Y.XmlText children", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const element = new Y.XmlElement("p");
      const text = new Y.XmlText("Hello World");
      element.insert(0, [text]);

      proxyA.element = element;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // B sees the text
      expect(proxyB.element.length).toBe(1);
      expect(proxyB.element.get(0)).toBeInstanceOf(Y.XmlText);
      expect(proxyB.element.get(0).toString()).toBe("Hello World");

      // A edits the text
      proxyA.element.get(0).insert(11, "!");
      await waitMicrotask();

      // B sees the edit
      expect(proxyB.element.get(0).toString()).toBe("Hello World!");
    });

    it("syncs attribute deletions", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const element = new Y.XmlElement("div");
      element.setAttribute("class", "test");
      element.setAttribute("id", "main");

      proxyA.element = element;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      expect(proxyB.element.getAttribute("class")).toBe("test");
      expect(proxyB.element.getAttribute("id")).toBe("main");

      // A removes an attribute
      proxyA.element.removeAttribute("class");
      await waitMicrotask();

      // B sees the removal
      expect(proxyB.element.getAttribute("class")).toBeUndefined();
      expect(proxyB.element.getAttribute("id")).toBe("main");
    });

    it("syncs child removals from Y.XmlElement", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const element = new Y.XmlElement("div");
      const child1 = new Y.XmlElement("span");
      const child2 = new Y.XmlElement("p");
      element.insert(0, [child1, child2]);

      proxyA.element = element;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      expect(proxyB.element.length).toBe(2);

      // A removes first child
      proxyA.element.delete(0, 1);
      await waitMicrotask();

      // B sees the removal
      expect(proxyB.element.length).toBe(1);
      expect(proxyB.element.get(0).nodeName).toBe("p");
    });

    it("handles empty Y.XmlElement", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const element = new Y.XmlElement("div");
      // No attributes, no children

      proxyA.element = element;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // B should see empty element
      expect(proxyB.element).toBeInstanceOf(Y.XmlElement);
      expect(proxyB.element.nodeName).toBe("div");
      expect(proxyB.element.length).toBe(0);
    });

    it("handles deeply nested Y.XmlElement structures", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      // Create 5-level deep structure
      const level1 = new Y.XmlElement("div");
      const level2 = new Y.XmlElement("section");
      const level3 = new Y.XmlElement("article");
      const level4 = new Y.XmlElement("p");
      const level5 = new Y.XmlText("Deep content");

      level4.insert(0, [level5]);
      level3.insert(0, [level4]);
      level2.insert(0, [level3]);
      level1.insert(0, [level2]);

      proxyA.root = level1;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // B sees the full depth
      expect(proxyB.root.nodeName).toBe("div");
      expect(proxyB.root.get(0).nodeName).toBe("section");
      expect(proxyB.root.get(0).get(0).nodeName).toBe("article");
      expect(proxyB.root.get(0).get(0).get(0).nodeName).toBe("p");
      expect(proxyB.root.get(0).get(0).get(0).get(0).toString()).toBe("Deep content");
    });
  });

  describe("Y.XmlHook", () => {
    it("can create and sync Y.XmlHook as a map-like container", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      // Create XmlHook (behaves like Y.Map)
      const hook = new Y.XmlHook("custom-hook");
      hook.set("data", "value");
      hook.set("count", 42);

      proxyA.hook = hook;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // B should see the hook
      expect(proxyB.hook).toBeInstanceOf(Y.XmlHook);
      expect(proxyB.hook.get("data")).toBe("value");
      expect(proxyB.hook.get("count")).toBe(42);
    });

    it("syncs Y.XmlHook property changes", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const hook = new Y.XmlHook("custom-hook");
      proxyA.hook = hook;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // A sets a property
      proxyA.hook.set("status", "active");
      await waitMicrotask();

      // B sees the property
      expect(proxyB.hook.get("status")).toBe("active");
    });

    it("triggers Valtio updates when Y.XmlHook content changes", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const hook = new Y.XmlHook("test");
      proxyA.hook = hook;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      let renderCount = 0;
      // Subscribe to changes on B's proxy
      const unsub = subscribe(proxyB, () => {
        renderCount++;
      });

      // Change via A
      proxyA.hook.set("key", "value");
      await waitMicrotask();

      // Verify reactivity triggered
      expect(renderCount).toBeGreaterThan(0);
      expect(proxyB.hook.get("key")).toBe("value");

      unsub();
    });

    it("syncs Y.XmlHook property deletions", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const hook = new Y.XmlHook("test");
      hook.set("key1", "value1");
      hook.set("key2", "value2");

      proxyA.hook = hook;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      expect(proxyB.hook.get("key1")).toBe("value1");
      expect(proxyB.hook.get("key2")).toBe("value2");

      // A deletes a property
      proxyA.hook.delete("key1");
      await waitMicrotask();

      // B sees the deletion
      expect(proxyB.hook.has("key1")).toBe(false);
      expect(proxyB.hook.get("key2")).toBe("value2");
    });
  });

  describe("Mixed XML Structures", () => {
    it("handles nested XML elements with mixed content", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      // Create a complex XML structure
      const root = new Y.XmlElement("article");
      root.setAttribute("lang", "en");

      const title = new Y.XmlElement("h1");
      const titleText = new Y.XmlText("My Article");
      title.insert(0, [titleText]);

      const paragraph = new Y.XmlElement("p");
      const paraText = new Y.XmlText("Some content");
      paragraph.insert(0, [paraText]);

      root.insert(0, [title, paragraph]);

      proxyA.article = root;
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // B sees the full structure
      expect(proxyB.article).toBeInstanceOf(Y.XmlElement);
      expect(proxyB.article.nodeName).toBe("article");
      expect(proxyB.article.getAttribute("lang")).toBe("en");
      expect(proxyB.article.length).toBe(2);

      const h1 = proxyB.article.get(0);
      expect(h1.nodeName).toBe("h1");
      expect(h1.get(0).toString()).toBe("My Article");

      const p = proxyB.article.get(1);
      expect(p.nodeName).toBe("p");
      expect(p.get(0).toString()).toBe("Some content");
    });

    it("handles XML types mixed with regular objects", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

      const element = new Y.XmlElement("article");
      element.setAttribute("id", "main");

      proxyA.data = {
        title: "Regular string",
        content: element,
        metadata: { count: 0 },
      };
      await waitMicrotask();

      bootstrapA({});
      await waitMicrotask();

      // B sees mixed structure
      expect(proxyB.data.title).toBe("Regular string");
      expect(proxyB.data.content).toBeInstanceOf(Y.XmlElement);
      expect(proxyB.data.content.nodeName).toBe("article");
      expect(proxyB.data.content.getAttribute("id")).toBe("main");
      expect(proxyB.data.metadata.count).toBe(0);
    });
  });

  describe("XML Types in Arrays", () => {
    it("can store Y.XmlElement in Y.Array", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesArrayRoot();

      const el1 = new Y.XmlElement("div");
      el1.setAttribute("class", "item1");
      const el2 = new Y.XmlElement("span");
      el2.setAttribute("class", "item2");

      proxyA.push(el1, el2);
      await waitMicrotask();

      bootstrapA([]);
      await waitMicrotask();

      // B sees the XML elements in array
      expect(proxyB.length).toBe(2);
      expect(proxyB[0]).toBeInstanceOf(Y.XmlElement);
      expect(proxyB[0].nodeName).toBe("div");
      expect(proxyB[0].getAttribute("class")).toBe("item1");
      expect(proxyB[1]).toBeInstanceOf(Y.XmlElement);
      expect(proxyB[1].nodeName).toBe("span");
      expect(proxyB[1].getAttribute("class")).toBe("item2");
    });

    it("syncs XML element changes in array", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesArrayRoot();

      const element = new Y.XmlElement("p");
      proxyA.push(element);
      await waitMicrotask();

      bootstrapA([]);
      await waitMicrotask();

      // A modifies the element
      proxyA[0].setAttribute("data-test", "value");
      await waitMicrotask();

      // B sees the change
      expect(proxyB[0].getAttribute("data-test")).toBe("value");
    });

    it("can store Y.XmlHook in Y.Array", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesArrayRoot();

      const hook1 = new Y.XmlHook("hook1");
      hook1.set("name", "first");
      const hook2 = new Y.XmlHook("hook2");
      hook2.set("name", "second");

      proxyA.push(hook1, hook2);
      await waitMicrotask();

      bootstrapA([]);
      await waitMicrotask();

      // B sees the hooks in array
      expect(proxyB.length).toBe(2);
      expect(proxyB[0]).toBeInstanceOf(Y.XmlHook);
      expect(proxyB[0].get("name")).toBe("first");
      expect(proxyB[1]).toBeInstanceOf(Y.XmlHook);
      expect(proxyB[1].get("name")).toBe("second");
    });

    it("can store Y.XmlFragment in Y.Array", async () => {
      const { proxyA, proxyB, bootstrapA } = createRelayedProxiesArrayRoot();

      const fragment = new Y.XmlFragment();
      const element = new Y.XmlElement("div");
      fragment.insert(0, [element]);

      proxyA.push(fragment);
      await waitMicrotask();

      bootstrapA([]);
      await waitMicrotask();

      // B sees the fragment in array
      expect(proxyB.length).toBe(1);
      expect(proxyB[0]).toBeInstanceOf(Y.XmlFragment);
      expect(proxyB[0].length).toBe(1);
      expect(proxyB[0].get(0).nodeName).toBe("div");
    });
  });
});

