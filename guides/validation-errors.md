# Validation & Error Handling

valtio-y validates all mutations to ensure they can be synchronized across clients. Invalid data is rejected synchronously at the point of assignment, giving you immediate feedback.

---

## Table of Contents

1. [How Validation Works](#how-validation-works)
2. [Supported Data Types](#supported-data-types)
3. [Common Validation Errors](#common-validation-errors)
4. [Handling Errors in React](#handling-errors-in-react)
5. [Custom Validation](#custom-validation)
6. [Best Practices](#best-practices)

---

## How Validation Works

valtio-y validates **every write** to the proxy before it reaches the CRDT layer. If validation fails, an error is thrown **synchronously** and the mutation is rejected.

```typescript
// ✅ Valid - throws nothing
state.name = "Alice";
state.age = 30;
state.todos.push({ text: "Buy milk", done: false });

// ❌ Invalid - throws immediately
state.name = undefined; // Error: undefined not allowed
state.callback = () => {}; // Error: functions not allowed
state.date = new Date(); // Error: non-plain objects not allowed
```

### Validation Happens in Two Places

1. **Bootstrap time** - When you call `bootstrap()` with initial data
2. **Runtime** - Every time you assign a value to the proxy

Both use the same validation rules to ensure consistency.

---

## Supported Data Types

### ✅ Allowed Types

```typescript
// Primitives
state.name = "Alice"; // string
state.age = 30; // number (finite)
state.active = true; // boolean
state.deleted = null; // null

// Plain objects
state.user = { name: "Alice", age: 30 };

// Arrays
state.todos = [{ text: "Buy milk" }];
state.numbers = [1, 2, 3];

// Nested structures (any depth)
state.nested = {
  level1: {
    level2: {
      level3: { value: "deep" },
    },
  },
};

// Yjs types (already in the document)
const yMap = new Y.Map();
state.existingMap = yMap; // ✅ But see re-parenting warning below
```

### ❌ Forbidden Types

```typescript
// undefined (use null or delete the key)
state.value = undefined;
// Error: undefined is not allowed in shared state

// Functions
state.onClick = () => {};
// Error: functions are not allowed in shared state

// Symbols
state.id = Symbol("unique");
// Error: symbols are not allowed in shared state

// BigInt
state.large = 123n;
// Error: BigInt is not allowed in shared state

// Infinity / NaN
state.value = Infinity;
state.value = NaN;
// Error: Infinity and NaN are not allowed

// Non-plain objects (Date, RegExp, Set, Map, custom classes)
state.date = new Date();
state.regex = /pattern/;
state.items = new Set([1, 2, 3]);
// Error: Unable to convert non-plain object
```

---

## Common Validation Errors

### 1. Undefined Values

**Error:** `[valtio-y] undefined is not allowed in shared state`

```typescript
// ❌ Wrong
state.name = undefined;

// ✅ Correct
state.name = null; // Explicitly set to null
delete state.name; // Or remove the property
```

**Why?** `undefined` doesn't serialize in JSON and has ambiguous semantics in collaborative editing. Use `null` for "no value" or omit the property entirely.

### 2. Undefined in Objects

**Error:** `[valtio-y] undefined is not allowed in objects for shared state`

```typescript
// ❌ Wrong
state.user = { name: "Alice", age: undefined };

// ✅ Correct
state.user = { name: "Alice", age: null };
// Or
state.user = { name: "Alice" }; // Omit the property
```

### 3. Functions

**Error:** `[valtio-y] Unable to convert function. Functions are not allowed`

```typescript
// ❌ Wrong
state.onClick = () => console.log("clicked");

// ✅ Correct - Store data, derive behavior
state.buttonState = "idle"; // or "loading" | "success"

// In component
function handleClick() {
  if (snap.buttonState === "idle") {
    state.buttonState = "loading";
  }
}
```

### 4. Non-Plain Objects

**Error:** `[valtio-y] Unable to convert non-plain object of type "Date"`

```typescript
// ❌ Wrong
state.createdAt = new Date();

// ✅ Correct - Convert to primitives
state.createdAt = Date.now(); // number
state.createdAt = new Date().toISOString(); // string

// When reading
const date = new Date(snap.createdAt);
```

### 5. Re-Parenting Yjs Types

**Error:** `[valtio-y] Cannot re-assign a collaborative object that is already in the document`

```typescript
// ❌ Wrong - Moving a Y.Map to another location
const yMap = state.section1.data; // Already in doc
state.section2.data = yMap; // Error: re-parenting

// ✅ Correct - Deep clone the data
const cloned = yTypeToPlainObject(state.section1.data);
state.section2.data = cloned; // New Y.Map created
```

**Why?** Yjs types can only exist in one location in the document tree. Moving them would corrupt the CRDT structure.

### 6. Sparse Arrays

Arrays with "holes" are not supported due to CRDT limitations:

```typescript
// ❌ Wrong
state.items = ["a", "b", "c"];
state.items.length = 5; // Creates holes
// Error or undefined behavior

// ✅ Correct
state.items.push(null, null); // Explicit nulls
```

---

## Handling Errors in React

### Try-Catch for User Input

Wrap mutations in try-catch to handle validation errors gracefully:

```typescript
function TodoForm() {
  const snap = useSnapshot(state);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(text: string) {
    try {
      // Validate before mutating
      if (!text.trim()) {
        setError("Todo text cannot be empty");
        return;
      }

      // This might throw if text contains invalid characters
      state.todos.push({
        id: crypto.randomUUID(),
        text: text.trim(),
        done: false,
      });

      setError(null); // Clear error on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid input");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(e.currentTarget.todoText.value);
      }}
    >
      <input name="todoText" />
      <button type="submit">Add</button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

### Error Boundaries

For unexpected errors in components:

```typescript
class TodoErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Todo error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-state">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Optimistic UI with Rollback

valtio-y mutations are synchronous, so there's no automatic rollback. Implement your own:

```typescript
function OptimisticToggle({ todo }: { todo: TodoItem }) {
  const [optimistic, setOptimistic] = useState(false);

  async function handleToggle() {
    const previousValue = todo.done;
    setOptimistic(true);

    try {
      // Optimistically update local state
      todo.done = !todo.done;

      // Validate with server if needed
      await validateWithServer(todo);

      setOptimistic(false);
    } catch (err) {
      // Rollback on error
      todo.done = previousValue;
      setOptimistic(false);
      alert("Failed to update todo");
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={optimistic ? "opacity-50" : ""}
      disabled={optimistic}
    >
      {todo.done ? "Done" : "Todo"}
    </button>
  );
}
```

---

## Custom Validation

valtio-y validates data types, but you need to validate business logic yourself.

### Validate Before Mutating

```typescript
function addTodo(text: string) {
  // Custom validation
  if (text.length > 280) {
    throw new Error("Todo text must be 280 characters or less");
  }

  if (state.todos.length >= 100) {
    throw new Error("Maximum 100 todos allowed");
  }

  if (state.todos.some((t) => t.text === text)) {
    throw new Error("Duplicate todo");
  }

  // valtio-y validates types
  state.todos.push({
    id: crypto.randomUUID(),
    text, // Must be string (validated by valtio-y)
    done: false, // Must be boolean (validated by valtio-y)
  });
}
```

### Validation Helper

```typescript
function validateAndAssign<T extends object>(
  target: T,
  updates: Partial<T>,
  rules: Record<keyof Partial<T>, (value: unknown) => boolean>
) {
  for (const [key, value] of Object.entries(updates)) {
    const validate = rules[key as keyof T];
    if (validate && !validate(value)) {
      throw new Error(`Validation failed for ${String(key)}`);
    }
  }

  Object.assign(target, updates);
}

// Usage
validateAndAssign(
  state.user,
  { name: userName, age: userAge },
  {
    name: (v) => typeof v === "string" && v.length > 0,
    age: (v) => typeof v === "number" && v >= 0 && v <= 150,
  }
);
```

---

## Best Practices

### 1. Validate Early

Validate user input before it reaches the proxy:

```typescript
// ✅ Good - validate in event handler
function handleInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return; // Don't even try to mutate

  try {
    state.text = trimmed;
  } catch (err) {
    showError(err);
  }
}

// ❌ Bad - let invalid data reach the proxy
function handleInput(value: string) {
  state.text = value; // Might throw if value is invalid
}
```

### 2. Use TypeScript

TypeScript catches many errors at compile time:

```typescript
interface Todo {
  text: string;
  done: boolean;
}

// ❌ TypeScript error - caught before runtime
state.todos.push({
  text: "Buy milk",
  done: "yes", // Type error: string not assignable to boolean
});
```

### 3. Client vs Server Validation

- **Client (valtio-y):** Validate data types, structure, and basic constraints
- **Server:** Validate business logic, authorization, and data integrity

```typescript
async function createTodo(text: string) {
  // Client validation (fast, immediate feedback)
  if (text.length > 280) {
    throw new Error("Todo too long");
  }

  // Optimistically add to local state
  const id = crypto.randomUUID();
  state.todos.push({ id, text, done: false });

  try {
    // Server validation (authoritative)
    await api.createTodo({ id, text });
  } catch (err) {
    // Rollback on server error
    const index = state.todos.findIndex((t) => t.id === id);
    if (index >= 0) state.todos.splice(index, 1);
    throw err;
  }
}
```

### 4. Sanitize External Data

Never trust data from external sources (APIs, localStorage, URL params):

```typescript
// ❌ Bad - blindly trust API response
const apiData = await fetch("/todos").then((r) => r.json());
state.todos = apiData; // Might contain functions, undefined, etc.

// ✅ Good - validate and sanitize
const apiData = await fetch("/todos").then((r) => r.json());
const sanitized = apiData.map((item: unknown) => ({
  id: String((item as any).id ?? ""),
  text: String((item as any).text ?? "Untitled"),
  done: Boolean((item as any).done),
}));
state.todos = sanitized;
```

### 5. Handle Disconnections Gracefully

CRDTs work offline, but you might want to show connection status:

```typescript
function TodoApp() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div>
      {!isOnline && (
        <div className="offline-banner">
          Offline - Changes will sync when reconnected
        </div>
      )}
      <TodoList />
    </div>
  );
}
```

### 6. Use Bootstrap for Initial Data

Validate initial data during bootstrap instead of at runtime:

```typescript
const { proxy, bootstrap } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("state"),
});

// Bootstrap validates deeply before inserting
try {
  bootstrap({
    todos: [
      { text: "Buy milk", done: false },
      { text: "Walk dog", done: true },
    ],
  });
} catch (err) {
  console.error("Invalid bootstrap data:", err);
  // Handle initialization error
}
```

---

## Summary

- **Validation is synchronous** - Errors throw immediately at point of assignment
- **Type validation is automatic** - valtio-y validates primitives, objects, and arrays
- **Business validation is manual** - You validate constraints, uniqueness, permissions
- **Handle errors in React** - Use try-catch, error boundaries, and optimistic UI patterns
- **Sanitize external data** - Never trust APIs, localStorage, or user input
- **Use TypeScript** - Catch type errors at compile time instead of runtime

Validation ensures your collaborative state stays consistent across all clients. When in doubt, validate early and provide clear error messages to your users.
