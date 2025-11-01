import * as Y from 'yjs';
import { SynchronizationContext } from './context';
import { isYArray, isYMap, isYAbstractType } from './guards';
import { isPlainObject } from './types';

/**
 * Error message constants (DRY principle - single source of truth)
 */
const ERROR_UNDEFINED = '[valtio-yjs] undefined is not allowed in shared state. Use null, delete the key, or omit the field.';
const ERROR_UNDEFINED_IN_OBJECT = '[valtio-yjs] undefined is not allowed in objects for shared state. Use null, delete the key, or omit the field.';
const ERROR_FUNCTION = '[valtio-yjs] Unable to convert function. Functions are not allowed in shared state.';
const ERROR_SYMBOL = '[valtio-yjs] Unable to convert symbol. Symbols are not allowed in shared state.';
const ERROR_BIGINT = '[valtio-yjs] Unable to convert BigInt. BigInt is not allowed in shared state.';
const ERROR_NON_FINITE = '[valtio-yjs] Infinity and NaN are not allowed in shared state. Only finite numbers are supported.';
const ERROR_REPARENTING = '[valtio-yjs] Cannot re-assign a collaborative object that is already in the document. ' +
  'If you intended to move or copy this object, you must explicitly create a deep clone of it ' +
  'at the application layer before assigning it.';

const createUnsupportedObjectError = (ctorName: string): string =>
  `[valtio-yjs] Unable to convert non-plain object of type "${ctorName}". ` +
  'Only plain objects/arrays/primitives are supported. Use explicit conversion for Date, RegExp, etc.';

/**
 * Throws if a Y.js type is already parented (attached to a document).
 * Re-parenting Y.js types can cause data corruption, so we forbid it.
 */
function throwIfReparenting(yType: Y.AbstractType<unknown>): void {
  if (yType.parent !== null) {
    throw new Error(ERROR_REPARENTING);
  }
}

/**
 * Recursively converts a Yjs shared type (or primitive) into a plain JavaScript object/array.
 */
export function yTypeToPlainObject(yValue: unknown): unknown {
  if (isYMap(yValue)) {
    const entries = Array.from(yValue.entries()).map(([key, value]) => [key, yTypeToPlainObject(value)] as const);
    return Object.fromEntries(entries);
  }
  if (isYArray(yValue)) {
    return yValue.toArray().map(yTypeToPlainObject);
  }
  return yValue;
}

/**
 * Validates a value before it can be assigned to shared state.
 * Throws synchronously if the value is not supported.
 * This is used by the bridge to validate values before enqueueing.
 */
export function validateValueForSharedState(jsValue: unknown): void {
  // Check for re-parenting of existing Y types
  if (isYAbstractType(jsValue)) {
    throwIfReparenting(jsValue);
    return; // Y types are valid
  }
  
  // Check primitive types
  if (jsValue === null || typeof jsValue !== 'object') {
    if (jsValue === undefined) {
      throw new Error(ERROR_UNDEFINED);
    }
    
    const t = typeof jsValue;
    if (t === 'function') {
      throw new Error(ERROR_FUNCTION);
    }
    if (t === 'symbol') {
      throw new Error(ERROR_SYMBOL);
    }
    if (t === 'bigint') {
      throw new Error(ERROR_BIGINT);
    }
    if (t === 'number' && !Number.isFinite(jsValue as number)) {
      throw new Error(ERROR_NON_FINITE);
    }
    return; // Valid primitive
  }
  
  // Arrays and plain objects are valid (will be recursively validated during conversion)
  if (Array.isArray(jsValue) || isPlainObject(jsValue)) return;
  
  // Unknown object types are invalid
  const ctorName = (jsValue as { constructor?: { name?: string } }).constructor?.name ?? 'UnknownObject';
  throw new Error(createUnsupportedObjectError(ctorName));
}

/**
 * Recursively validates complex values (arrays/objects) before enqueueing writes.
 * Ensures we synchronously reject unsupported structures (e.g., undefined inside objects).
 */
export function validateDeepForSharedState(jsValue: unknown): void {
  // Y types are valid, but check for forbidden re-parenting
  if (isYAbstractType(jsValue)) {
    throwIfReparenting(jsValue);
    return;
  }

  // Primitives: validate and return
  if (jsValue === null || typeof jsValue !== 'object') {
    validateValueForSharedState(jsValue);
    return;
  }

  // Arrays: validate all elements
  if (Array.isArray(jsValue)) {
    for (const item of jsValue) {
      validateDeepForSharedState(item);
    }
    return;
  }

  // Plain objects: reject undefined values and recurse
  if (isPlainObject(jsValue)) {
    for (const [_key, value] of Object.entries(jsValue)) {
      if (value === undefined) {
        throw new Error(ERROR_UNDEFINED_IN_OBJECT);
      }
      validateDeepForSharedState(value);
    }
    return;
  }

  // Unknown object types are invalid (same rule as validateValueForSharedState)
  const ctorName = (jsValue as { constructor?: { name?: string } }).constructor?.name ?? 'UnknownObject';
  throw new Error(createUnsupportedObjectError(ctorName));
}

/**
 * Recursively converts a plain JavaScript object/array (or primitive) into Yjs shared types.
 * Enforces re-parenting restrictions for collaborative objects.
 * 
 * IMPORTANT: This function assumes input is pre-validated at trust boundaries.
 * Callers MUST call validateDeepForSharedState() before calling this function.
 * Defensive checks remain for fundamentally invalid types as a fail-safe.
 */
export function plainObjectToYType(jsValue: unknown, context: SynchronizationContext): unknown {
  // Already a Yjs value: check for forbidden re-parenting
  if (isYAbstractType(jsValue)) {
    throwIfReparenting(jsValue);
    return jsValue;
  }
  
  // Defensive validation for primitives (fail-safe if called without proper validation)
  // Primary validation should happen at trust boundaries via validateDeepForSharedState
  if (jsValue === null || typeof jsValue !== 'object') {
    // Quick defensive checks for fundamentally invalid primitives
    if (jsValue === undefined) {
      throw new Error(ERROR_UNDEFINED);
    }
    const t = typeof jsValue;
    if (t === 'function') {
      throw new Error(ERROR_FUNCTION);
    }
    if (t === 'symbol') {
      throw new Error(ERROR_SYMBOL);
    }
    if (t === 'bigint') {
      throw new Error(ERROR_BIGINT);
    }
    if (t === 'number' && !Number.isFinite(jsValue as number)) {
      throw new Error(ERROR_NON_FINITE);
    }
    return jsValue;
  }

  // If this is one of our controller proxies, return the underlying Y type if it has no parent,
  // otherwise clone it to prevent re-parenting
  if (context && typeof jsValue === 'object' && context.valtioProxyToYType.has(jsValue)) {
    const underlyingYType = context.valtioProxyToYType.get(jsValue)!;
    // Check if the Y type is already attached to a document
    if (isYAbstractType(underlyingYType)) {
      const yType = underlyingYType as Y.AbstractType<unknown>;
      if (yType.parent !== null) {
        // Y type is already in a document - clone it to prevent re-parenting
        const plainFromProxy = deepPlainFromValtioProxy(jsValue as object, context);
        return plainObjectToYType(plainFromProxy, context);
      }
      // Y type has no parent - safe to return as-is
      return underlyingYType;
    }
    return underlyingYType;
  }

  if (Array.isArray(jsValue)) {
    const yArray = new Y.Array();
    yArray.insert(0, jsValue.map((v) => plainObjectToYType(v, context)));
    return yArray;
  }

  // Only convert plain objects.
  if (isPlainObject(jsValue)) {
    const yMap = new Y.Map();
    for (const [key, value] of Object.entries(jsValue)) {
      yMap.set(key, plainObjectToYType(value, context));
    }
    return yMap;
  }

  // Defensive check: Unknown object types (should have been caught by validation layer)
  // This is a fail-safe in case converter is called without proper validation
  const ctorName = jsValue.constructor?.name ?? 'UnknownObject';
  throw new Error(createUnsupportedObjectError(ctorName));
}

// Build a deep plain JS value from a Valtio controller proxy, without touching its underlying Y types.
function deepPlainFromValtioProxy(value: unknown, context: SynchronizationContext): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => deepPlainFromValtioProxy(v, context));
  }
  // Plain object or Valtio proxy object
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // If nested value is a controller proxy too, recurse similarly
    if (v && typeof v === 'object' && context.valtioProxyToYType.has(v as object)) {
      result[k] = deepPlainFromValtioProxy(v, context);
    } else {
      result[k] = deepPlainFromValtioProxy(v, context);
    }
  }
  return result;
}


