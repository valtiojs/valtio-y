# Error Handling in valtio-y

This guide explains how error handling works in valtio-y and how to handle errors in your application.

## Table of Contents

- [Overview](#overview)
- [Error Types](#error-types)
- [Validation Errors](#validation-errors)
- [Transaction Errors](#transaction-errors)
- [Reconciliation Errors](#reconciliation-errors)
- [Common Error Scenarios](#common-error-scenarios)
- [Error Recovery Patterns](#error-recovery-patterns)
- [Network Error Handling](#network-error-handling)
- [Debugging Tips](#debugging-tips)

## Overview

valtio-y uses a **layered error handling approach** with three main layers:

1. **Validation Layer**: Synchronous validation at trust boundaries
2. **Transaction Layer**: Error context during Y.js write operations
3. **Reconciliation Layer**: Error handling during Y.js → Valtio sync

All valtio-y errors extend from the base `ValtioYError` class, making them easy to identify and handle.

## Error Types

### Base Error

```typescript
import { ValtioYError, isValtioYError } from 'valtio-y';

try {
  proxy.value = invalidValue;
} catch (err) {
  if (isValtioYError(err)) {
    console.log('This is a valtio-y error:', err.message);
  }
}
```

### Error Class Hierarchy

```
ValtioYError (base class)
├── ValtioYValidationError
├── ValtioYTransactionError
└── ValtioYReconciliationError
```

## Validation Errors

### What They Are

`ValtioYValidationError` is thrown when you try to assign an unsupported value type to shared state. **Validation is synchronous and fail-fast**, ensuring invalid data never enters the shared state.

### Supported Types

✅ **Allowed in shared state:**
- Primitives: `string`, `number`, `boolean`, `null`
- Plain objects: `{ key: value }`
- Arrays: `[1, 2, 3]`
- Y.js types: `Y.Map`, `Y.Array` (if not already parented)

❌ **NOT allowed in shared state:**
- `undefined` (use `null` instead)
- Functions
- Symbols
- BigInt
- Non-finite numbers (`Infinity`, `-Infinity`, `NaN`)
- Non-plain objects (`Date`, `RegExp`, `Map`, `Set`, class instances)
- Y.js types already attached to a document (re-parenting)

### Error Structure

```typescript
interface ValtioYValidationError extends ValtioYError {
  value: unknown;              // The invalid value that was rejected
  errorType: ValidationErrorType;  // Type of validation error
  getUserFriendlyMessage(): string;  // Human-readable explanation
  getSuggestedFix(): string;         // How to fix the error
}
```

### Validation Error Types

```typescript
type ValidationErrorType =
  | 'undefined'           // undefined at top level
  | 'undefined-in-object' // undefined inside an object
  | 'function'            // function value
  | 'symbol'              // symbol value
  | 'bigint'              // BigInt value
  | 'non-finite'          // Infinity or NaN
  | 'non-plain'           // Custom class, Date, RegExp, etc.
  | 'reparenting';        // Y.js type already in document
```

### Handling Validation Errors

```typescript
import {
  ValtioYValidationError,
  isValtioYValidationError
} from 'valtio-y';

try {
  proxy.user = { name: 'Alice', age: undefined };
} catch (err) {
  if (isValtioYValidationError(err)) {
    console.error('Validation failed:', err.errorType);
    console.error('User-friendly message:', err.getUserFriendlyMessage());
    console.error('Suggested fix:', err.getSuggestedFix());
    console.error('Invalid value:', err.value);
  }
}
```

### Example: Display Error in UI

```typescript
function saveUserData(userData: unknown) {
  try {
    proxy.user = userData;
    return { success: true };
  } catch (err) {
    if (isValtioYValidationError(err)) {
      return {
        success: false,
        message: err.getUserFriendlyMessage(),
        suggestion: err.getSuggestedFix(),
      };
    }
    throw err; // Re-throw unexpected errors
  }
}
```

### Automatic Rollback

**When validation fails, valtio-y automatically rolls back the proxy to its previous state:**

```typescript
proxy.value = 'original';

try {
  proxy.value = Symbol('invalid');
} catch (err) {
  // Validation failed
}

console.log(proxy.value); // Still 'original' - automatic rollback!
```

The rollback mechanism:
- **For maps**: Reverts individual keys to their previous values
- **For arrays**: Resyncs from Y.Array source using `yArray.toArray()`
- **Maintains referential integrity**: Controller proxies remain live and writable

## Transaction Errors

### What They Are

`ValtioYTransactionError` is thrown when an error occurs during Y.js write operations (inside a transaction). These errors wrap the underlying error and provide context about which operation failed.

### Error Structure

```typescript
interface ValtioYTransactionError extends ValtioYError {
  operation: 'map-deletes' | 'map-sets' | 'array-operations';
  cause: unknown;  // The underlying error that caused the failure
}
```

### Handling Transaction Errors

```typescript
import {
  ValtioYTransactionError,
  isValtioYTransactionError
} from 'valtio-y';

try {
  proxy.items.push({ id: 1, value: 'test' });
  await waitForSync();
} catch (err) {
  if (isValtioYTransactionError(err)) {
    console.error(`Transaction failed during: ${err.operation}`);
    console.error('Underlying cause:', err.cause);

    // Handle based on operation type
    switch (err.operation) {
      case 'map-sets':
        // Handle map set failure
        break;
      case 'array-operations':
        // Handle array operation failure
        break;
    }
  }
}
```

## Reconciliation Errors

### What They Are

`ValtioYReconciliationError` is thrown when valtio-y fails to synchronize changes from Y.js to the Valtio proxy. This is rare and usually indicates a bug or corrupted state.

### Error Structure

```typescript
interface ValtioYReconciliationError extends ValtioYError {
  containerType: 'map' | 'array';
  cause: unknown;  // The underlying error
}
```

### Handling Reconciliation Errors

```typescript
import {
  ValtioYReconciliationError,
  isValtioYReconciliationError
} from 'valtio-y';

try {
  // Remote changes being applied
} catch (err) {
  if (isValtioYReconciliationError(err)) {
    console.error(`Failed to reconcile ${err.containerType}`);
    console.error('Cause:', err.cause);

    // May need to re-bootstrap the proxy
    if (err.containerType === 'map') {
      // Re-initialize map proxy
    }
  }
}
```

## Common Error Scenarios

### 1. Undefined Values

**Problem:**
```typescript
proxy.user = { name: 'Alice', age: undefined }; // ❌ Throws
```

**Solutions:**
```typescript
// Option 1: Use null
proxy.user = { name: 'Alice', age: null }; // ✅

// Option 2: Omit the property
proxy.user = { name: 'Alice' }; // ✅

// Option 3: Delete after creation
proxy.user = { name: 'Alice', age: 30 };
delete proxy.user.age; // ✅
```

### 2. Custom Objects

**Problem:**
```typescript
proxy.date = new Date(); // ❌ Throws (non-plain object)
```

**Solutions:**
```typescript
// Convert to ISO string
proxy.date = new Date().toISOString(); // ✅

// Or store as timestamp
proxy.timestamp = Date.now(); // ✅

// Reconstruct on read
const date = new Date(proxy.date);
```

### 3. Functions

**Problem:**
```typescript
proxy.callback = () => {}; // ❌ Throws
```

**Solution:**
```typescript
// Store data only, define functions separately
proxy.actionType = 'click';

// Functions in your component code
function handleAction(actionType: string) {
  switch (actionType) {
    case 'click': // ...
  }
}
```

### 4. BigInt

**Problem:**
```typescript
proxy.bigNumber = BigInt(123); // ❌ Throws
```

**Solutions:**
```typescript
// Convert to string
proxy.bigNumber = BigInt(123).toString(); // ✅

// Convert back when reading
const bigInt = BigInt(proxy.bigNumber);
```

### 5. Non-Finite Numbers

**Problem:**
```typescript
proxy.result = Infinity; // ❌ Throws
proxy.calculated = NaN; // ❌ Throws
```

**Solutions:**
```typescript
// Use null for missing/invalid values
proxy.result = isFinite(value) ? value : null; // ✅

// Or use a sentinel value
proxy.result = isFinite(value) ? value : -1; // ✅

// Or store as string
proxy.status = 'infinity'; // ✅
```

### 6. Re-parenting Y.js Types

**Problem:**
```typescript
const yMap = new Y.Map();
yRoot.set('first', yMap);
await waitForSync();

yRoot.set('second', yMap); // ❌ Throws (already parented)
```

**Solution:**
```typescript
// Create a deep clone at application layer
const clonedData = JSON.parse(JSON.stringify(proxy.first));
proxy.second = clonedData; // ✅
```

## Error Recovery Patterns

### Pattern 1: Validate Before Assignment

```typescript
function isValidUserData(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;

  const user = data as Record<string, unknown>;

  // Check for undefined values
  for (const value of Object.values(user)) {
    if (value === undefined) return false;
  }

  // Check for unsupported types
  return Object.values(user).every(value => {
    const type = typeof value;
    return (
      type === 'string' ||
      type === 'number' ||
      type === 'boolean' ||
      value === null ||
      Array.isArray(value) ||
      (type === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    );
  });
}

// Use the validator
if (isValidUserData(userData)) {
  proxy.user = userData;
} else {
  console.error('Invalid user data');
}
```

### Pattern 2: Sanitize Input

```typescript
function sanitizeForSharedState(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    // Handle primitives
    if (obj === undefined) return null;
    if (typeof obj === 'bigint') return obj.toString();
    if (typeof obj === 'number' && !isFinite(obj)) return null;
    return obj;
  }

  // Handle Date
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle RegExp
  if (obj instanceof RegExp) {
    return obj.toString();
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForSharedState);
  }

  // Handle plain objects
  if (Object.getPrototypeOf(obj) === Object.prototype) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = sanitizeForSharedState(value);
      }
    }
    return result;
  }

  // Unknown object type - can't sanitize
  throw new Error(`Cannot sanitize object of type ${obj.constructor?.name}`);
}

// Use the sanitizer
try {
  proxy.data = sanitizeForSharedState(untrustedData);
} catch (err) {
  console.error('Failed to sanitize data:', err);
}
```

### Pattern 3: Try-Catch with User Feedback

```typescript
function updateSharedState(updates: unknown) {
  try {
    Object.assign(proxy, updates);
    return { success: true };
  } catch (err) {
    if (isValtioYValidationError(err)) {
      return {
        success: false,
        error: 'validation',
        message: err.getUserFriendlyMessage(),
        suggestion: err.getSuggestedFix(),
      };
    }

    // Unexpected error
    console.error('Unexpected error:', err);
    return {
      success: false,
      error: 'unknown',
      message: 'An unexpected error occurred',
    };
  }
}
```

### Pattern 4: Fallback Values

```typescript
function safeAssign<T>(
  proxy: Record<string, unknown>,
  key: string,
  value: T,
  fallback: T
): void {
  try {
    proxy[key] = value;
  } catch (err) {
    if (isValtioYValidationError(err)) {
      console.warn(`Invalid value for ${key}, using fallback`);
      proxy[key] = fallback;
    } else {
      throw err;
    }
  }
}

// Usage
safeAssign(proxy, 'age', userInput, 0);
```

## Network Error Handling

While valtio-y doesn't provide built-in network providers, here are patterns for handling network errors with common providers:

### Pattern: Resilient Provider

```typescript
class ResilientProvider {
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  async connect(doc: Y.Doc, url: string): Promise<void> {
    try {
      await this.provider.connect();
      this.reconnectAttempts = 0; // Reset on success
    } catch (err) {
      if (this.reconnectAttempts < this.maxReconnects) {
        await this.scheduleReconnect(doc, url);
      } else {
        this.emit('connection-failed', err);
        throw new Error('Failed to connect after maximum retries');
      }
    }
  }

  private async scheduleReconnect(doc: Y.Doc, url: string): Promise<void> {
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnects})`);

    this.reconnectAttempts++;

    await new Promise(resolve => setTimeout(resolve, delay));
    await this.connect(doc, url);
  }
}
```

### Pattern: Connection State Management

```typescript
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

function useYjsConnection(doc: Y.Doc, url: string) {
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let provider: WebsocketProvider;

    const connect = async () => {
      setState('connecting');
      setError(null);

      try {
        provider = new WebsocketProvider(url, 'room', doc);

        provider.on('status', (event: { status: string }) => {
          if (event.status === 'connected') {
            setState('connected');
          } else if (event.status === 'disconnected') {
            setState('disconnected');
          }
        });

        provider.on('connection-error', (err: Error) => {
          setState('error');
          setError(err);
        });
      } catch (err) {
        setState('error');
        setError(err as Error);
      }
    };

    connect();

    return () => {
      provider?.destroy();
    };
  }, [doc, url]);

  return { state, error };
}
```

### Pattern: Offline Support

```typescript
function createOfflineSupport(doc: Y.Doc) {
  // Store updates while offline
  const pendingUpdates: Uint8Array[] = [];
  let isOnline = navigator.onLine;

  // Listen to online/offline events
  window.addEventListener('online', () => {
    isOnline = true;
    flushPendingUpdates();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
  });

  // Capture updates while offline
  doc.on('update', (update: Uint8Array) => {
    if (!isOnline) {
      pendingUpdates.push(update);
    }
  });

  async function flushPendingUpdates() {
    if (pendingUpdates.length === 0) return;

    try {
      // Send pending updates to server
      await fetch('/api/sync', {
        method: 'POST',
        body: Y.mergeUpdates(pendingUpdates),
      });

      pendingUpdates.length = 0;
    } catch (err) {
      console.error('Failed to flush pending updates:', err);
      // Will retry on next online event
    }
  }

  return { isOnline: () => isOnline, pendingCount: () => pendingUpdates.length };
}
```

## Debugging Tips

### 1. Enable Debug Logging

```typescript
import { createYjsProxy } from 'valtio-y';

const { proxy } = createYjsProxy(doc, {
  getRoot: (d) => d.getMap('root'),
  logLevel: 'debug', // or 'trace' for even more detail
});
```

### 2. Inspect Error Objects

```typescript
try {
  proxy.value = invalidValue;
} catch (err) {
  if (isValtioYValidationError(err)) {
    console.log('Error type:', err.errorType);
    console.log('Invalid value:', err.value);
    console.log('Message:', err.message);
    console.log('User-friendly:', err.getUserFriendlyMessage());
    console.log('Suggested fix:', err.getSuggestedFix());
    console.log('Stack trace:', err.stack);
  }
}
```

### 3. Check Y.js Document State

```typescript
// After an error, inspect Y.js state
console.log('Y.js state:', doc.getMap('root').toJSON());
console.log('Valtio proxy state:', proxy);

// Check if they're in sync
const yState = JSON.stringify(doc.getMap('root').toJSON());
const proxyState = JSON.stringify(proxy);
console.log('In sync?', yState === proxyState);
```

### 4. Test Validation

```typescript
import { validateValueForSharedState, validateDeepForSharedState } from 'valtio-y';

// Test if a value would pass validation
try {
  validateValueForSharedState(myValue);
  console.log('Value is valid');
} catch (err) {
  console.error('Value would fail validation:', err);
}

// Test deep validation (recursively checks objects/arrays)
try {
  validateDeepForSharedState(myObject);
  console.log('Object is valid');
} catch (err) {
  console.error('Object contains invalid values:', err);
}
```

### 5. Monitor Rollback Events

```typescript
// Wrap proxy assignments to detect rollbacks
function assignWithRollbackDetection(
  proxy: Record<string, unknown>,
  key: string,
  value: unknown
) {
  const previous = proxy[key];

  try {
    proxy[key] = value;
    console.log(`✓ Successfully assigned ${key}`);
  } catch (err) {
    console.error(`✗ Assignment failed, rolled back to:`, previous);
    console.error('Error:', err);
    throw err;
  }
}
```

### 6. Validate CI/CD Integration

```typescript
// In your tests
describe('Data Validation', () => {
  it('should reject undefined in objects', () => {
    expect(() => {
      proxy.data = { value: undefined };
    }).toThrow(ValtioYValidationError);
  });

  it('should automatically rollback on error', () => {
    proxy.value = 'original';

    expect(() => {
      proxy.value = Symbol('invalid');
    }).toThrow();

    expect(proxy.value).toBe('original');
  });
});
```

## Best Practices

1. **Always validate external data** before assigning to shared state
2. **Use TypeScript** to catch type errors at compile time
3. **Sanitize user input** to convert unsupported types
4. **Handle errors gracefully** with user-friendly messages
5. **Enable debug logging** during development
6. **Test error scenarios** in your test suite
7. **Monitor for reconciliation errors** in production (they indicate bugs)
8. **Implement retry logic** for network errors
9. **Use typed error guards** (`isValtioYValidationError`, etc.)
10. **Trust automatic rollback** - don't try to manually revert state

## Related Documentation

- [Architecture Guide](architecture/architecture.md) - Understanding valtio-y's internals
- [Limitations](architecture/limitations.md) - What's supported and what's not
- [API Reference](../README.md) - Full API documentation
