# Error Handling Guide

A practical guide to understanding and handling errors in valtio-y. This covers validation errors, recovery patterns, and debugging techniques.

---

## Table of Contents

1. [Error Types](#error-types)
2. [Supported vs Unsupported Types](#supported-vs-unsupported-types)
3. [Common Error Scenarios](#common-error-scenarios)
4. [Error Recovery Patterns](#error-recovery-patterns)
5. [Debugging Tips](#debugging-tips)

---

## Error Types

valtio-y provides typed error classes for better error handling:

```typescript
import {
  ValtioYValidationError,
  ValtioYTransactionError,
  ValtioYReconciliationError,
  isValtioYValidationError,
} from 'valtio-y';

try {
  proxy.value = Symbol('invalid');
} catch (err) {
  if (isValtioYValidationError(err)) {
    console.log('Error type:', err.errorType);
    console.log('User-friendly message:', err.getUserFriendlyMessage());
    console.log('Suggested fix:', err.getSuggestedFix());
  }
}
```

**Error Classes:**
- `ValtioYValidationError` - Invalid value types (synchronous, fail-fast)
- `ValtioYTransactionError` - Failures during Y.js write operations
- `ValtioYReconciliationError` - Failures during Y.js → Valtio sync

---

## Supported vs Unsupported Types

### ✅ Supported Types

```typescript
// Primitives
proxy.string = "hello";
proxy.number = 42;
proxy.boolean = true;
proxy.null = null;

// Plain objects
proxy.user = { name: "Alice", age: 30 };

// Arrays
proxy.items = [1, 2, 3];
proxy.users = [{ id: 1, name: "Bob" }];

// Nested structures
proxy.app = { ui: { theme: "light" } };
```

### ❌ Unsupported Types

```typescript
// undefined - Use null instead
proxy.value = undefined; // ❌ Throws

// Functions - Store data only
proxy.callback = () => {}; // ❌ Throws

// Symbols - Use strings/numbers
proxy.id = Symbol('id'); // ❌ Throws

// BigInt - Convert to string
proxy.big = BigInt(123); // ❌ Throws

// Non-finite numbers - Use null
proxy.result = Infinity; // ❌ Throws
proxy.calc = NaN; // ❌ Throws

// Non-plain objects - Convert first
proxy.date = new Date(); // ❌ Throws
proxy.regex = /test/; // ❌ Throws
proxy.map = new Map(); // ❌ Throws
```

---

## Common Error Scenarios

### 1. Undefined Values

**Problem:**
```typescript
proxy.user = { name: "Alice", age: undefined }; // ❌
```

**Solutions:**
```typescript
// Use null
proxy.user = { name: "Alice", age: null }; // ✅

// Omit the property
proxy.user = { name: "Alice" }; // ✅

// Delete after creation
proxy.user = { name: "Alice", age: 30 };
delete proxy.user.age; // ✅
```

### 2. Custom Objects

**Problem:**
```typescript
proxy.date = new Date(); // ❌
```

**Solutions:**
```typescript
// Convert to ISO string
proxy.date = new Date().toISOString(); // ✅

// Store as timestamp
proxy.timestamp = Date.now(); // ✅

// Reconstruct on read
const date = new Date(proxy.date);
```

### 3. BigInt

**Problem:**
```typescript
proxy.big = BigInt(123); // ❌
```

**Solution:**
```typescript
// Convert to string
proxy.big = BigInt(123).toString(); // ✅

// Convert back when needed
const bigInt = BigInt(proxy.big);
```

### 4. Non-Finite Numbers

**Problem:**
```typescript
proxy.result = Infinity; // ❌
```

**Solutions:**
```typescript
// Use null for missing values
proxy.result = isFinite(value) ? value : null; // ✅

// Or use a sentinel value
proxy.result = isFinite(value) ? value : -1; // ✅
```

---

## Error Recovery Patterns

### Pattern 1: Validate Before Assignment

```typescript
function isValidData(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as Record<string, unknown>;

  // Check for undefined values
  for (const value of Object.values(obj)) {
    if (value === undefined) return false;
  }

  return true;
}

// Use the validator
if (isValidData(userData)) {
  proxy.user = userData;
} else {
  console.error('Invalid user data');
}
```

### Pattern 2: Sanitize Input

```typescript
function sanitize(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    // Handle primitives
    if (obj === undefined) return null;
    if (typeof obj === 'bigint') return obj.toString();
    if (typeof obj === 'number' && !isFinite(obj)) return null;
    return obj;
  }

  // Handle Date
  if (obj instanceof Date) return obj.toISOString();

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  // Handle plain objects
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = sanitize(value);
    }
  }
  return result;
}

// Use the sanitizer
proxy.data = sanitize(untrustedData);
```

### Pattern 3: Try-Catch with Feedback

```typescript
function updateState(updates: unknown) {
  try {
    Object.assign(proxy, updates);
    return { success: true };
  } catch (err) {
    if (isValtioYValidationError(err)) {
      return {
        success: false,
        message: err.getUserFriendlyMessage(),
        suggestion: err.getSuggestedFix(),
      };
    }
    throw err;
  }
}
```

### Pattern 4: Automatic Rollback

valtio-y automatically rolls back on validation errors:

```typescript
proxy.value = 'original';

try {
  proxy.value = Symbol('invalid');
} catch (err) {
  // Validation failed
}

console.log(proxy.value); // Still 'original' - automatic rollback!
```

---

## Debugging Tips

### 1. Enable Debug Logging

```typescript
const { proxy } = createYjsProxy(doc, {
  getRoot: (d) => d.getMap('root'),
  logLevel: 'debug', // or 'trace'
});
```

### 2. Inspect Error Details

```typescript
try {
  proxy.value = invalidValue;
} catch (err) {
  if (isValtioYValidationError(err)) {
    console.log('Error type:', err.errorType);
    console.log('Invalid value:', err.value);
    console.log('Message:', err.message);
    console.log('User-friendly:', err.getUserFriendlyMessage());
    console.log('Fix:', err.getSuggestedFix());
  }
}
```

### 3. Check State Sync

```typescript
// Compare Y.js and Valtio state
console.log('Y.js state:', doc.getMap('root').toJSON());
console.log('Valtio state:', proxy);
```

### 4. Test Validation

```typescript
import { validateValueForSharedState } from 'valtio-y';

// Test if a value would pass validation
try {
  validateValueForSharedState(myValue);
  console.log('Value is valid');
} catch (err) {
  console.error('Value would fail:', err);
}
```

### 5. Monitor Rollbacks

```typescript
function assignWithMonitoring(proxy: any, key: string, value: unknown) {
  const previous = proxy[key];

  try {
    proxy[key] = value;
    console.log(`✓ Assigned ${key}`);
  } catch (err) {
    console.error(`✗ Failed, rolled back to:`, previous);
    throw err;
  }
}
```

---

## Best Practices

1. **Validate external data** before assigning to shared state
2. **Use TypeScript** to catch type errors at compile time
3. **Sanitize user input** to convert unsupported types
4. **Handle errors gracefully** with user-friendly messages
5. **Enable debug logging** during development
6. **Test error scenarios** in your test suite
7. **Trust automatic rollback** - don't manually revert state
8. **Use typed error guards** for better error handling
9. **Convert special types** (Date → ISO string, BigInt → string)
10. **Prefer null over undefined** in shared state

---

## Related Documentation

- [Basic Operations](./basic-operations.md) - Core operations
- [Concepts](./concepts.md) - Understanding valtio-y
- [Architecture](../docs/architecture/architecture.md) - Internals
