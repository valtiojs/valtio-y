## **Valtio-Yjs Library: Architectural Capabilities & Design Philosophy (Revised)**

### **1. Core Mandate: Predictability over Magic**

The primary goal of this library is to be a **correct, predictable, and robust** bridge between Valtio's reactive state management and Yjs's collaborative data structures. Our core philosophy is **predictability over magic**.

We achieve this by translating a developer's actions into unambiguous CRDT operations. When a developer's action is ambiguous, the library will prefer to **throw a clear error with guidance** rather than guess the intent, which could lead to silent data corruption or unpredictable behavior.

This library is a **transparent bridge**, not an extension of the Valtio API. It does not add new methods to Valtio proxies. Instead, it defines a clear "contract" of supported and unsupported mutation patterns, enforcing this contract through runtime checks and extensive documentation.
For arrays, we use a deterministic rule: a `'set'` to an existing index at batch start (`index < length`) is a **replace**; a `'set'` to the end (`index === length`) is an **insert**.

### **2. Supported Capabilities (The "Do's")**

This section defines the features the library **must** implement flawlessly.

#### **2.1. Atomic Operations on Maps (`Y.Map`)**

- **Capability:** All primitive property assignments and deletions on a collaborative object will be synced.
- **Implementation Details:**
  - A `set` operation in Valtio (`proxy.foo = 'bar'`) translates directly to `yMap.set('foo', 'bar')`.
  - A `delete` operation in Valtio (`delete proxy.foo`) translates directly to `yMap.delete('foo')`.
  - Yjs `YMapEvent`s will be reconciled back to the Valtio proxy.

#### **2.2. Explicit, CRDT-Safe Array Operations (`Y.Array`)**

- **Capability:** The library supports a specific subset of native Valtio array mutations that can be translated unambiguously to CRDT operations.
- **Implementation Details:** These are the **only** supported ways to mutate a collaborative array.
  - **`push(...items)`:** Translates to `yArray.insert(yArray.length, items)`.
  - **`pop()`:** Translates to `yArray.delete(yArray.length - 1, 1)`.
  - **`shift()`:** Translates to `yArray.delete(0, 1)`.
  - **`unshift(...items)`:** Translates to `yArray.insert(0, items)`.
  - **`splice(start, deleteCount?, ...items)`:** This is the **primary and recommended method for all complex mutations**. It translates directly to a `yArray.delete()` followed by a `yArray.insert()` in a single transaction. It is the designated way to **replace, insert, or remove** elements from anywhere in the array.

#### **2.3. Data Model & Type Safety**

- **Capability:** The library will manage the conversion between plain JavaScript objects/arrays and their Yjs counterparts, enforcing a JSON-compatible data model.
- **Implementation Details:**
  - The `plainObjectToYType` converter will handle the recursive creation of `Y.Map` and `Y.Array` types.
  - The library **must throw a runtime error** for unsupported data types (e.g., Functions, Symbols, class instances other than Date/RegExp).
  - Special types like `Date` will be serialized to a primitive (ISO string) for storage in Yjs.

#### **2.4. Lazy Materialization and Reconciliation**

- **Capability:** The library will efficiently manage state by only creating Valtio proxies for parts of the Yjs document tree that are active or have received updates.
- **Implementation Details:**
  - The bridge will maintain bidirectional weak maps (`yTypeToValtioProxy`, `valtioProxyToYType`) to manage proxy identity.
  - Remote changes (`observeDeep` events) will trigger reconciliation on the nearest materialized ancestor, ensuring the Valtio state tree correctly reflects the Yjs state tree. Delta-based updates (`reconcileValtioArrayWithDelta`) should be used for array changes for performance.

### **3. Unsupported Capabilities (The "Don'ts")**

This section defines the features the library **must not** implement. The responsibility for these patterns is explicitly placed on the application developer, and the library will provide clear runtime errors and documentation to guide them.

#### **3.1. Defined Behavior for Direct Array Index Assignment (`arr[i] = ...`)**

- **Capability:** The library will treat a direct index assignment on an existing index as a **replace** operation, identical to `arr.splice(i, 1, newValue)`.
- **Why:** Analysis of Valtio's `ops` shows that a direct assignment (`arr[i] = val`) and a simple replace-splice are **indistinguishable**. Both generate a single `['set', [i], newVal, oldVal]` operation. Instead of forbidding an undetectable pattern, we define its behavior to be the safest and most intuitive equivalent: a replacement.
- **Implementation Details:** The `planArrayOps` function classifies any `'set'` where the index is less than the array's length at the start of the batch (`index < yArrayLength`) as a **replace** intent. This is translated into `yArray.delete(i, 1)` followed by `yArray.insert(i, [newValue])`.

#### **3.2. No Automatic "Move" Operations**

- **Capability:** The library **must not** attempt to automatically detect or implement "move" operations.
- **Why:** The developer's intent cannot be reliably determined, and Yjs does not support re-parenting of shared types, making a true "move" impossible.
- **Implementation Details:**
  - The library will treat a `delete(i)` and `insert(j)` as two separate, atomic operations and execute them as such.
  - A `console.warn` should be issued when this pattern is detected to alert the developer that they may be performing an inefficient or unintended action.
  - Documentation must guide developers on how to implement moves correctly at the application layer (e.g., via fractional indexing).

#### **3.3. No Re-Parenting of Collaborative Objects**

- **Capability:** The library **must forbid** assigning an existing collaborative object to a new location in the state tree.
- **Why:** This violates the core principle of Yjs's tree model. The application builder must be explicit about their intent when duplicating or moving data. The library will not magically clone anything.
- **Implementation Details:** Before setting a value, the library **must** check if the value corresponds to an existing Yjs type that already has a parent (`yValue.parent`). If it does, the library **must throw a runtime error with clear guidance**:
  > **Error Example:** `[valtio-yjs] Cannot re-assign a collaborative object that is already in the document. If you intended to move or copy this object, you must explicitly create a deep clone of it at the application layer before assigning it.`

Excellent. Let's create that concise "Translator's Guide." This document will define the exact, unambiguous mappings from Valtio operations to Yjs operations. We will then assess the safety and reliability of detecting each pattern.

This is the definitive contract for your subscription planner.

---

## **Valtio-to-Yjs Operations: The Translator's Guide**

This guide defines the precise translation rules based on analysis of Valtio's `ops` generation. The primary goal is **100% deterministic translation**, eliminating ambiguity.

### **I. Map Operations (`Y.Map`)**

These are simple and have a direct 1-to-1 mapping.

| Valtio Operation (`op`)    | Yjs CRDT Operation(s)           | Detectable? | Assessment                                           |
| :------------------------- | :------------------------------ | :---------- | :--------------------------------------------------- |
| `['set', [key], newValue]` | `yMap.set(key, convertedValue)` | **Yes**     | **SAFE.** This is a direct, unambiguous translation. |
| `['delete', [key]]`        | `yMap.delete(key)`              | **Yes**     | **SAFE.** This is a direct, unambiguous translation. |

---

### **II. Array Operations (`Y.Array`)**

This is where precision is critical. The planner categorizes operations based on the state of the array at the beginning of the batch (`yArrayLength`).

#### **A. Supported & Unambiguous Translations**

| Valtio Mutation (User Action) | Resulting Valtio `ops` Pattern | Library Action & Yjs Operation(s) | Assessment |
| :--- | :--- | :--- | :--- |
| **`arr.push(val)`** | `['set', [oldLen], val, undefined]` | **PROCESS AS INSERT.** `yArray.insert(oldLen, [val])` | **SAFE.** A `set` op on an index `oldLen` is clearly an insert/push. |
| **`arr.pop()`** | `['delete', [oldLen - 1]]` | **PROCESS AS DELETE.** `yArray.delete(oldLen - 1, 1)` | **SAFE.** A single `delete` at the end is a clear "pop" intent. |
| **`arr.unshift(val)`** | Complex: `['set', [0], val]` plus sets for shifted items | **PROCESS AS INSERT.** `yArray.insert(0, [val])` | **SAFE.** The planner should identify the full `unshift` pattern and coalesce to a single insert for performance. |
| **Complex `splice`** | Combination of `delete` and/or `set` ops, often with a `length` change. | **PROCESS OPS INDIVIDUALLY.** A sequence of `yArray.delete(...)` and `yArray.insert(...)`. | **SAFE.** The planner categorizes each op into `replace`, `insert`, or `delete` based on the `index < yArrayLength` rule. |

#### **B. Handled Ambiguous Operations (Defined Translations)**

| Valtio Mutation (User Action) | Resulting Valtio `ops` Pattern | Library Action & Yjs Operation(s) | Assessment |
| :--- | :--- | :--- | :--- |
| **`arr[i] = val`** (where `i < arr.length`) | `['set', [i], val, oldVal]` | **PROCESS AS REPLACE.** `yArray.delete(i, 1); yArray.insert(i, [val])` | **SAFE & PREDICTABLE.** Indistinguishable from a simple replace-splice; rule enforces consistency. |
| **`arr.splice(i, 1, val)`** | `['set', [i], val, oldVal]` | **PROCESS AS REPLACE.** `yArray.delete(i, 1); yArray.insert(i, [val])` | **SAFE & PREDICTABLE.** Same logic as direct assignment ensures consistent behavior. |

#### **C. Unsupported Operations**

The "Move" and "Re-Parenting" constraints from Section 3 remain in effect. The library does not auto-detect moves and forbids re-parenting collaborative objects.

### **III. Final Assessment & Planner Implementation Strategy**

1. **Safety Check:** Can we safely and reliably detect the patterns we've committed to supporting?
    - **Maps:** Yes. Trivial.
    - **Array push/pop/splice/delete:** Yes. The Valtio ops provide a clear, unambiguous signal.
    - **Array unshift/shift:** Yes, but the resulting cascade of `set` ops makes detection more complex. A safe fallback is to trigger a full structural reconciliation for this specific pattern if simple detection is too difficult.
    - **Direct index assignment (`arr[i] = val`):** **Yes.** It is indistinguishable from `splice(i, 1, val)` and is handled by the `index < yArrayLength -> replace` rule.

2. **Implementation Flow:**
    - Analyze the **entire batch of operations** first.
    - For each array, determine `yArrayLength` at the start of the batch.
    - Classify ops deterministically:
      - `'set'` where `index === yArrayLength` → **insert**
      - `'set'` where `index < yArrayLength` → **replace** (translate to `delete(i, 1)` + `insert(i, [val])`)
      - `'delete'` → **delete**
    - Coalesce recognized patterns like `unshift`/`shift` for performance when detected; otherwise process per-op classification.
    - **Move Heuristic:** Do not auto-translate moves. If a `delete` and `insert` occur at different indices, process them independently and optionally `console.warn`.

This translator's guide provides a clear and robust blueprint. It prioritizes safety through deterministic classification, defines a predictable behavior for direct index assignment, and avoids the dangerous guessing game of automatic move detection.
