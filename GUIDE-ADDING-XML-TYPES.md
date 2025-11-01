# Guide: Adding Y.Xml Type Support

**For**: Future contributors  
**Task**: Add support for Y.XmlFragment, Y.XmlElement, and Y.XmlHook  
**Difficulty**: Easy (follow the Y.Text pattern)

---

## Overview

Y.js has three XML-related types:

| Type              | Category       | Description                            | Should Add?              |
| ----------------- | -------------- | -------------------------------------- | ------------------------ |
| **Y.XmlFragment** | Container      | XML document container (like Y.Array)  | ✅ Add container support |
| **Y.XmlElement**  | Container      | XML element with attributes + children | ✅ Add container support |
| **Y.XmlHook**     | Leaf/Container | Hook type (extends Y.Map)              | ⚠️ Special case          |

**Note**: Y.XmlText is already supported (it extends Y.Text)

---

## Step 1: Understand the Types

### Y.XmlFragment (Container)

```javascript
const fragment = new Y.XmlFragment();
fragment.insert(0, [new Y.XmlElement("div")]); // Like Y.Array
fragment.get(0); // Access children
```

**Category**: Container (holds other Y types)  
**Similar to**: Y.Array  
**Already supported**: YES (containers work automatically)

### Y.XmlElement (Container)

```javascript
const element = new Y.XmlElement("div");
element.setAttribute("class", "container"); // Attributes (like Y.Map)
element.insert(0, [new Y.XmlText("Hello")]); // Children (like Y.Array)
```

**Category**: Container (holds children + has attributes)  
**Similar to**: Y.Array + Y.Map hybrid  
**Already supported**: YES (containers work automatically)

### Y.XmlHook (Special Case)

```javascript
const hook = new Y.XmlHook("custom-hook");
hook.set("data", value); // Like Y.Map
```

**Category**: Extends Y.Map (treated as container)  
**Similar to**: Y.Map  
**Already supported**: YES (extends Y.Map, so container logic applies)

---

## Step 2: Determine What Needs Work

### ✅ Good News!

**Y.XmlFragment and Y.XmlElement are already supported** because they're containers, and valtio-yjs already has full container support.

### ⚠️ Special Consideration: Y.XmlHook

Y.XmlHook extends Y.Map, so it's automatically treated as a container. However, you might want to add a specific guard for clarity:

```typescript
// In src/core/guards.ts
export function isYXmlHook(value: unknown): value is Y.XmlHook {
  return value instanceof Y.XmlHook;
}
```

---

## Step 3: Add Basic Tests (Minimal Set)

### Create Test File

**File**: `valtio-yjs/tests/e2e/e2e.xml-types.spec.ts`

```typescript
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  createRelayedProxiesMapRoot,
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

      bootstrapA();
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

      bootstrapA();
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

      bootstrapA();
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

      bootstrapA();
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

      bootstrapA();
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

      bootstrapA();
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

      bootstrapA();
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

      bootstrapA();
      await waitMicrotask();

      // A sets a property
      proxyA.hook.set("status", "active");
      await waitMicrotask();

      // B sees the property
      expect(proxyB.hook.get("status")).toBe("active");
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

      bootstrapA();
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
  });
});
```

---

## Step 4: Run the Tests

```bash
cd valtio-yjs
pnpm test e2e.xml-types.spec.ts --run
```

**Expected Result**: All tests should pass ✅

Why? Because XML containers are already supported by the existing container infrastructure.

---

## Step 5: Update Documentation

### Add to README.md

Find the "Data Types" section and update:

```markdown
### Data Types

- ✅ **Objects** (Y.Map → Valtio proxy)
- ✅ **Arrays** (Y.Array → Valtio proxy)
- ✅ **Collaborative text** (Y.Text & Y.XmlText) - [See below](#collaborative-text-ytext)
- ✅ **XML types** (Y.XmlFragment, Y.XmlElement, Y.XmlHook)
- ✅ **Primitives** (string, number, boolean, null)
- ✅ **Deep nesting** (arbitrary depth)
```

Add a new section after the Y.Text section:

````markdown
## XML Types

valtio-yjs fully supports Y.js XML types for building collaborative document editors.

### Y.XmlFragment

Container for XML nodes (similar to Y.Array):

```js
const fragment = new Y.XmlFragment();
const element = new Y.XmlElement("div");
fragment.insert(0, [element]);

proxy.document = fragment;
```
````

### Y.XmlElement

XML element with attributes and children:

```js
const element = new Y.XmlElement("div");
element.setAttribute("class", "container");
element.setAttribute("id", "main");

const text = new Y.XmlText("Hello");
element.insert(0, [text]);

proxy.root = element;
```

### Y.XmlHook

Custom hook type (extends Y.Map):

```js
const hook = new Y.XmlHook("custom-hook");
hook.set("data", "value");
proxy.customHook = hook;
```

**Note**: All XML types work as containers and are automatically reactive. Y.XmlText (which extends Y.Text) has the same automatic reactivity as Y.Text.

````

---

## Step 6: Optional Enhancements

### Add Type Guards (Optional)

If you want explicit type guards for clarity:

```typescript
// In src/core/guards.ts

export function isYXmlFragment(value: unknown): value is Y.XmlFragment {
  return value instanceof Y.XmlFragment;
}

export function isYXmlElement(value: unknown): value is Y.XmlElement {
  return value instanceof Y.XmlElement;
}

export function isYXmlHook(value: unknown): value is Y.XmlHook {
  return value instanceof Y.XmlHook;
}

// Update isYSharedContainer if needed (though they already work)
export function isYSharedContainer(value: unknown): value is YSharedContainer {
  return (
    value instanceof Y.Map ||
    value instanceof Y.Array ||
    value instanceof Y.XmlFragment ||
    value instanceof Y.XmlElement ||
    value instanceof Y.XmlHook
  );
}
````

**Note**: This is optional since the current implementation already handles these types via `instanceof Y.AbstractType` checks.

---

## Verification Checklist

- [ ] Create test file `tests/e2e/e2e.xml-types.spec.ts`
- [ ] Copy minimal test suite from this guide
- [ ] Run tests: `pnpm test e2e.xml-types.spec.ts --run`
- [ ] All tests pass ✅
- [ ] Update README.md with XML types section
- [ ] (Optional) Add explicit type guards
- [ ] Commit changes with clear message

---

## Commit Message Template

```
feat: add comprehensive tests for Y.Xml types

- Add e2e tests for Y.XmlFragment, Y.XmlElement, Y.XmlHook
- Verify XML containers sync correctly across clients
- Test attribute changes, children insertions, and mixed structures
- Update README.md with XML types documentation

All tests passing - XML types work with existing container infrastructure
```

---

## Why This Works

XML types in Y.js are designed as containers:

1. **Y.XmlFragment** - Like Y.Array (holds children)
2. **Y.XmlElement** - Like Y.Array + Y.Map (children + attributes)
3. **Y.XmlHook** - Extends Y.Map

Since valtio-yjs already has full container support, XML types work automatically. The tests just verify this works correctly!

---

## Questions?

If you encounter issues:

1. Check that Y.XmlText edits trigger reactivity (it extends Y.Text, so should work)
2. Verify attributes sync (they're stored like Y.Map entries)
3. Ensure children sync (they're stored like Y.Array items)

All of these should work with the current implementation. If not, check:

- Is Y.XmlText being wrapped with `ref()` like Y.Text? (It should be)
- Are XmlFragment/XmlElement being treated as containers? (They should be)

---

**Happy coding! 🚀**
