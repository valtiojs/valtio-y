# Performance Guide

valtio-y is fast by design. This guide covers optimization patterns, automatic performance features, and common pitfalls to avoid.

## Table of Contents

- [Automatic Optimizations](#automatic-optimizations)
- [Batching Patterns](#batching-patterns)
- [Large Arrays](#large-arrays)
- [Deep Nesting](#deep-nesting)
- [React Optimization](#react-optimization)
- [Benchmarking](#benchmarking)
- [Common Pitfalls](#common-pitfalls)

---

## Automatic Optimizations

valtio-y includes several automatic performance features that work without configuration.

### Automatic Batching

Multiple mutations in the same JavaScript tick are automatically batched into a single Yjs transaction:

```typescript
// These 100 operations become 1 network update
for (let i = 0; i < 100; i++) {
  state.count++;
}
// ✅ Single Yjs transaction, one sync event
```

**How it works:** valtio-y queues mutations during the current tick and flushes them together at the end. This means:

- One network message instead of 100
- One React re-render instead of 100
- Faster sync across clients

**Breaking the batch:** Using `await` between mutations splits them into separate transactions:

```typescript
// ❌ Creates 2 separate transactions
state.count = 1;
await Promise.resolve();
state.count = 2;

// ✅ Single transaction
state.count = 1;
state.count = 2;
```

### Lazy Materialization

Nested objects create Valtio proxies only when accessed, not when the entire structure is loaded:

```typescript
state.users = Array(10000).fill({ name: "User", data: {...} });
// ✅ Fast initialization - no proxies created yet

const user = state.users[0]; // Materializes this user only
user.name = "Alice";         // Now it's a proxy
```

**Benefits:**

- Fast initial load for large nested structures
- Memory efficient - only accessed objects consume memory for proxies
- Scales well with deep nesting

### Bulk Operations

Array operations with multiple items are automatically optimized:

```typescript
// ✅ Optimized: 6.3x faster for large inserts
state.items.push(...Array(1000).fill({ data: "x" }));
state.items.unshift(...newItems);

// vs. individual operations (slower)
for (const item of items) {
  state.items.push(item); // Each push is a separate operation
}
```

**When this matters:** Operations with 10+ items see significant speedup. Single-item operations are already fast.

---

## Batching Patterns

Understanding how batching works helps you write performant code.

### Same-Tick Batching

All mutations in a single tick are automatically batched:

```typescript
// ✅ Batched automatically (1 transaction)
state.todos[0].done = true;
state.todos[1].done = true;
state.todos.push({ text: "New", done: false });
delete state.todos[2];
```

**Performance:** ~1-3ms for typical UI interactions with automatic batching.

### Event Handler Pattern

Event handlers naturally batch mutations:

```typescript
function handleBulkComplete() {
  // All mutations batched into single transaction
  state.todos.forEach((todo) => {
    todo.done = true;
  });
  state.stats.completed = state.todos.length;
  state.lastModified = Date.now();
}
// ✅ 1 network update, 1 React re-render
```

### Async Operations

Be careful with async code - it breaks batching:

```typescript
async function fetchAndUpdate() {
  state.loading = true; // Transaction 1

  const data = await fetch("/api/data");

  // ❌ Transaction 2 (after await)
  state.loading = false;
  state.data = data;
}
```

**Solution:** Minimize awaits between related mutations:

```typescript
async function fetchAndUpdate() {
  const data = await fetch("/api/data");

  // ✅ Single transaction
  state.loading = false;
  state.data = data;
  state.lastSync = Date.now();
}
```

### Batching Large Updates

When updating many items, keep mutations in the same tick:

```typescript
// ✅ Good: batched (1 transaction)
for (let i = 0; i < 100; i++) {
  state.items[i].count++;
}

// ❌ Bad: 100 separate transactions
for (let i = 0; i < 100; i++) {
  state.items[i].count++;
  await waitForAnimation(); // Breaks batch
}
```

**Performance:** Batched updates of 100 items: ~3-8ms. Unbatched: ~100-300ms.

---

## Large Arrays

Handling arrays with 1000+ items efficiently.

### Bootstrap Performance

Loading large arrays is fast with `bootstrap`:

```typescript
// ✅ Fast initialization
const { proxy: state, bootstrap } = createYjsProxy(ydoc, {
  getRoot: (doc) => doc.getMap("state"),
});

bootstrap({
  items: Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    value: `item-${i}`,
  })),
});
```

**Performance:**

- 1000 items: ~15-30ms
- 5000 items: ~60-100ms
- Lazy materialization keeps memory usage low

### Bulk Array Operations

Use spread syntax for better performance:

```typescript
// ✅ Fast: bulk insert (6.3x faster)
const newItems = Array(100).fill({ data: "x" });
state.items.push(...newItems);

// ❌ Slow: individual inserts
for (const item of newItems) {
  state.items.push(item);
}
```

**Performance:**

- Bulk push 100 items: ~3-5ms
- Individual push 100 times: ~20-30ms

### Array Mutations

Standard array methods work efficiently:

```typescript
// All automatically optimized when batched
state.items.push(item); // Add to end
state.items.unshift(item); // Add to start
state.items.pop(); // Remove from end
state.items.shift(); // Remove from start
state.items.splice(2, 1); // Remove by index
state.items[5] = newValue; // Replace by index

// Batch multiple operations
state.items.splice(0, 10); // Remove first 10
state.items.push(...newItems); // Add many new items
// ✅ Single transaction
```

### Iteration Performance

Cache references when iterating:

```typescript
// ❌ Slow: repeated deep access
for (let i = 0; i < 1000; i++) {
  state.users[i].profile.settings.theme = "dark";
}

// ✅ Fast: cache reference
for (let i = 0; i < 1000; i++) {
  const settings = state.users[i].profile.settings;
  settings.theme = "dark";
}
```

**Why this matters:** Each property access may trigger proxy materialization. Cache the deepest object you need.

---

## Deep Nesting

Performance with deeply nested structures (10+ levels).

### Access Performance

Lazy materialization makes deep access efficient:

```typescript
// First access: creates proxy chain
const value = state.data.level1.level2.level3.value;
// ~2-4ms for 10 levels

// Subsequent access: reuses proxies
const value2 = state.data.level1.level2.level3.value;
// ~0.1ms (cached proxies)
```

**Performance:**

- 10 levels deep: ~2-4ms first access
- 20 levels deep: ~4-8ms first access
- Cached access: <1ms at any depth

### Mutation Performance

Mutations at any depth are fast:

```typescript
// Update deep property
state.data.level1.level2.level3.value = "updated";
// ~2-4ms regardless of depth
```

**Why it's fast:** Only the changed node sends updates to Yjs. Parent nodes don't re-process.

### Cache Deep References

When repeatedly accessing the same deep path:

```typescript
// ❌ Repeated deep access in loop
for (let i = 0; i < 100; i++) {
  state.app.data.user.settings.theme = themes[i];
}

// ✅ Cache the reference
const settings = state.app.data.user.settings;
for (let i = 0; i < 100; i++) {
  settings.theme = themes[i];
}
```

**Performance improvement:** 3-5x faster for loops with 100+ iterations.

---

## React Optimization

valtio-y integrates seamlessly with Valtio's fine-grained reactivity.

### Fine-Grained Subscriptions

Components only re-render when their accessed properties change:

```typescript
function TodoItem({ id }) {
  const snap = useSnapshot(state);
  const todo = snap.todos[id];

  // ✅ Only re-renders when todos[id] changes
  return (
    <div>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => (state.todos[id].done = !todo.done)}
      />
      {todo.text}
    </div>
  );
}
```

**Key principle:** `useSnapshot` tracks which properties you read. Only changes to those properties trigger re-renders.

### Subscribe to Specific Items

Don't subscribe to entire arrays when you only need one item:

```typescript
// ❌ Re-renders on any array change
function TodoItem({ id }) {
  const snap = useSnapshot(state);
  const todos = snap.todos; // Subscribes to entire array
  const todo = todos[id];
  return <div>{todo.text}</div>;
}

// ✅ Only re-renders when this item changes
function TodoItem({ id }) {
  const snap = useSnapshot(state);
  const todo = snap.todos[id]; // Subscribes to this item only
  return <div>{todo.text}</div>;
}
```

### Avoid Top-Level Spreads

Spreading `snap` subscribes to all properties:

```typescript
// ❌ Re-renders on any state change
function App() {
  const { todos, users, settings } = useSnapshot(state);
  // Subscribes to todos, users, AND settings
  return <div>{todos.length} todos</div>;
}

// ✅ Only subscribes to todos
function App() {
  const snap = useSnapshot(state);
  const todos = snap.todos; // Subscribes to todos only
  return <div>{todos.length} todos</div>;
}
```

### Deriving Data

Compute derived values outside the render:

```typescript
// ✅ Derive data in snapshot
function TodoList() {
  const snap = useSnapshot(state);
  const completed = snap.todos.filter((t) => t.done).length;
  const total = snap.todos.length;

  return (
    <div>
      {completed}/{total} completed
    </div>
  );
}
// Re-renders only when todos array changes
```

**Note:** Valtio tracks array access, not individual items during filter/map. This component re-renders when the array changes, but that's often acceptable.

### Optimizing Lists

For large lists, split into smaller components:

```typescript
// ✅ Each item is independently subscribed
function TodoList() {
  const snap = useSnapshot(state);

  return (
    <ul>
      {snap.todos.map((_, i) => (
        <TodoItem key={i} index={i} />
      ))}
    </ul>
  );
}

function TodoItem({ index }) {
  const snap = useSnapshot(state);
  const todo = snap.todos[index];

  // Only this item re-renders when changed
  return <li>{todo.text}</li>;
}
```

**Performance:** 1000-item list with fine-grained subscriptions handles 60fps updates easily.

---

## Benchmarking

Measure performance in your specific use case.

### Using Performance API

Measure operation timing:

```typescript
const start = performance.now();

// Your operations
for (let i = 0; i < 1000; i++) {
  state.items.push({ id: i, value: `item-${i}` });
}

const end = performance.now();
console.log(`Took ${end - start}ms`);
```

### Measuring Sync Latency

Time how long updates take to sync between clients:

```typescript
// Client A
const start = performance.now();
state.message = "hello";

// Client B (after receiving update)
ydoc.on("update", () => {
  const latency = performance.now() - start;
  console.log(`Sync latency: ${latency}ms`);
});
```

**Typical latencies:**

- Local (same machine): 1-5ms
- Same network: 10-50ms
- Internet: 50-200ms (depends on distance)

### Using valtio-y Benchmarks

Run the built-in benchmark suite:

```bash
cd valtio-y && bun run bench
```

This measures:

- Large array operations (1000+ items)
- Deep nesting performance (10-20 levels)
- Rapid mutations and batching effectiveness
- Multi-client sync latency
- Memory efficiency

### React DevTools Profiler

Use React DevTools to measure render performance:

1. Open React DevTools → Profiler tab
2. Click "Record"
3. Perform operations
4. Stop recording
5. Review commit timings

Look for:

- Unnecessary re-renders (components that didn't need to update)
- Expensive renders (>16ms for 60fps)
- Cascading updates (many commits in sequence)

---

## Common Pitfalls

Patterns to avoid for better performance.

### Repeated Deep Access in Loops

**Problem:**

```typescript
// ❌ Slow: creates new proxy chain on each iteration
for (let i = 0; i < 1000; i++) {
  state.app.data.users[i].profile.name = names[i];
}
```

**Solution:**

```typescript
// ✅ Fast: cache the deep reference
const users = state.app.data.users;
for (let i = 0; i < 1000; i++) {
  users[i].profile.name = names[i];
}
```

### Breaking Batches with Await

**Problem:**

```typescript
// ❌ Creates 1000 separate transactions
for (let i = 0; i < 1000; i++) {
  state.items[i].processed = true;
  await processItem(state.items[i]); // Breaks batch
}
```

**Solution:**

```typescript
// ✅ Single transaction
const promises = state.items.map((item) => processItem(item));
await Promise.all(promises);

// Then update all at once
for (let i = 0; i < 1000; i++) {
  state.items[i].processed = true;
}
```

### Top-Level Array Subscription

**Problem:**

```typescript
// ❌ Re-renders on ANY array change
function TodoStats() {
  const snap = useSnapshot(state);
  const todos = snap.todos; // Subscribes to entire array

  return <div>Count: {todos.length}</div>;
}
// Re-renders even when todo.done changes
```

**Solution:**

```typescript
// ✅ Only re-renders when length changes
function TodoStats() {
  const snap = useSnapshot(state);
  const count = snap.todos.length;

  return <div>Count: {count}</div>;
}
```

For more specific subscriptions, access only what you need.

### Individual Array Operations

**Problem:**

```typescript
// ❌ Slow: each push is separate
for (const item of newItems) {
  state.items.push(item);
}
```

**Solution:**

```typescript
// ✅ Fast: bulk operation
state.items.push(...newItems);
```

### Unnecessary Array Cloning

**Problem:**

```typescript
// ❌ Creates unnecessary copies
const newTodos = [...state.todos];
newTodos.push(newTodo);
state.todos = newTodos; // Replaces entire array
```

**Solution:**

```typescript
// ✅ Direct mutation is faster
state.todos.push(newTodo);
```

valtio-y is designed for mutation. Don't fight it with immutable patterns.

### Reading Snapshot in Mutation

**Problem:**

```typescript
// ❌ Mixed proxy/snapshot access
function addTodo() {
  const snap = useSnapshot(state);
  state.todos.push({ text: snap.newTodo, done: false });
}
```

**Solution:**

```typescript
// ✅ Use proxy for both reads and writes
function addTodo() {
  state.todos.push({ text: state.newTodo, done: false });
}
```

Or read from snapshot, mutate from proxy:

```typescript
function addTodo() {
  const snap = useSnapshot(state);
  const text = snap.newTodo; // Read
  state.todos.push({ text, done: false }); // Mutate
}
```

---

## Performance Characteristics

Summary of typical performance numbers:

| Operation                   | Time      | Notes                      |
| --------------------------- | --------- | -------------------------- |
| Small updates (1-10 items)  | ~1-3ms    | Typical UI interactions    |
| Bulk operations (100 items) | ~3-8ms    | Automatically optimized    |
| Large arrays (1000 items)   | ~15-30ms  | Bootstrap/import scenarios |
| Deep nesting (10+ levels)   | ~2-4ms    | Lazy materialization       |
| React re-render             | ~1-5ms    | Fine-grained subscriptions |
| Multi-client sync (local)   | ~1-5ms    | Same machine               |
| Multi-client sync (network) | ~50-200ms | Depends on latency         |

These numbers are from the benchmark suite running on modern hardware. Your mileage may vary based on:

- Data complexity (nesting depth, object size)
- Network conditions (latency, bandwidth)
- React component tree size
- Browser/device performance

---

## Summary

**Key takeaways:**

1. **Automatic batching** handles most performance concerns - write natural code
2. **Lazy materialization** makes large nested structures efficient
3. **Bulk operations** (`push(...items)`) are 6x faster than loops
4. **Cache deep references** in loops to avoid repeated proxy creation
5. **Fine-grained subscriptions** in React prevent unnecessary re-renders
6. **Keep mutations in same tick** to benefit from batching
7. **Measure** performance in your specific use case

**When in doubt:** Write straightforward code first, measure with benchmarks, then optimize specific bottlenecks. valtio-y's automatic optimizations handle the common cases well.
