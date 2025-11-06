import * as Y from "yjs";
import type { SynchronizationState } from "./synchronization-state";
import type { Logger } from "./logger";
import { isYArray, isYMap, isYAbstractType } from "./guards";
import { isPlainObject } from "./types";
import { ValtioYValidationError } from "./errors";

/**
 * Error message constants (DRY principle - single source of truth)
 */
const ERROR_UNDEFINED =
  "[valtio-y] undefined is not allowed in shared state. Use null, delete the key, or omit the field.";
const ERROR_UNDEFINED_IN_OBJECT =
  "[valtio-y] undefined is not allowed in objects for shared state. Use null, delete the key, or omit the field.";
const ERROR_FUNCTION =
  "[valtio-y] Unable to convert function. Functions are not allowed in shared state.";
const ERROR_SYMBOL =
  "[valtio-y] Unable to convert symbol. Symbols are not allowed in shared state.";
const ERROR_BIGINT =
  "[valtio-y] Unable to convert BigInt. BigInt is not allowed in shared state.";
const ERROR_NON_FINITE =
  "[valtio-y] Infinity and NaN are not allowed in shared state. Only finite numbers are supported.";
const ERROR_REPARENTING =
  "[valtio-y] Cannot re-assign a collaborative object that is already in the document. " +
  "If you intended to move or copy this object, you must explicitly create a deep clone of it " +
  "at the application layer before assigning it.";

const createUnsupportedObjectError = (ctorName: string): string =>
  `[valtio-y] Unable to convert non-plain object of type "${ctorName}". ` +
  "Only plain objects/arrays/primitives are supported. Use explicit conversion for Date, RegExp, etc.";

/**
 * Throws if a Y.js type is already parented (attached to a document).
 * Re-parenting Y.js types can cause data corruption, so we forbid it.
 */
function throwIfReparenting(yType: Y.AbstractType<unknown>): void {
  if (yType.parent !== null) {
    throw new ValtioYValidationError(ERROR_REPARENTING, yType, "reparenting");
  }
}

/**
 * Recursively converts a Yjs shared type (or primitive) into a plain JavaScript object/array.
 */
export function yTypeToPlainObject(yValue: unknown): unknown {
  if (isYMap(yValue)) {
    const entries = Array.from(yValue.entries()).map(
      ([key, value]) => [key, yTypeToPlainObject(value)] as const,
    );
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
  if (jsValue === null || typeof jsValue !== "object") {
    if (jsValue === undefined) {
      throw new ValtioYValidationError(ERROR_UNDEFINED, jsValue, "undefined");
    }

    const t = typeof jsValue;
    if (t === "function") {
      throw new ValtioYValidationError(ERROR_FUNCTION, jsValue, "function");
    }
    if (t === "symbol") {
      throw new ValtioYValidationError(ERROR_SYMBOL, jsValue, "symbol");
    }
    if (t === "bigint") {
      throw new ValtioYValidationError(ERROR_BIGINT, jsValue, "bigint");
    }
    if (t === "number" && !Number.isFinite(jsValue as number)) {
      throw new ValtioYValidationError(
        ERROR_NON_FINITE,
        jsValue,
        "non-finite",
      );
    }
    return; // Valid primitive
  }

  // Arrays and plain objects are valid (will be recursively validated during conversion)
  if (Array.isArray(jsValue) || isPlainObject(jsValue)) return;

  // Unknown object types are invalid
  const ctorName =
    (jsValue as { constructor?: { name?: string } }).constructor?.name ??
    "UnknownObject";
  throw new ValtioYValidationError(
    createUnsupportedObjectError(ctorName),
    jsValue,
    "non-plain",
  );
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
  if (jsValue === null || typeof jsValue !== "object") {
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
        throw new ValtioYValidationError(
          ERROR_UNDEFINED_IN_OBJECT,
          jsValue,
          "undefined-in-object",
        );
      }
      validateDeepForSharedState(value);
    }
    return;
  }

  // Unknown object types are invalid (same rule as validateValueForSharedState)
  const ctorName =
    (jsValue as { constructor?: { name?: string } }).constructor?.name ??
    "UnknownObject";
  throw new ValtioYValidationError(
    createUnsupportedObjectError(ctorName),
    jsValue,
    "non-plain",
  );
}

/**
 * Recursively converts a plain JavaScript object/array (or primitive) into Yjs shared types.
 * Enforces re-parenting restrictions for collaborative objects.
 *
 * IMPORTANT: This function assumes input is pre-validated at trust boundaries.
 * Callers MUST call validateDeepForSharedState() before calling this function.
 * Defensive checks remain for fundamentally invalid types as a fail-safe.
 *
 * @param jsValue - The JavaScript value to convert
 * @param state - Synchronization state for proxy-to-Y-type mapping
 * @param _logger - Logger instance (currently unused, reserved for future debugging)
 */
export function plainObjectToYType(
  jsValue: unknown,
  state: SynchronizationState,
  _logger: Logger,
): unknown {
  // Already a Yjs value: check for forbidden re-parenting
  if (isYAbstractType(jsValue)) {
    throwIfReparenting(jsValue);
    return jsValue;
  }

  // Defensive validation for primitives (fail-safe if called without proper validation)
  // Primary validation should happen at trust boundaries via validateDeepForSharedState
  if (jsValue === null || typeof jsValue !== "object") {
    // Quick defensive checks for fundamentally invalid primitives
    if (jsValue === undefined) {
      throw new ValtioYValidationError(ERROR_UNDEFINED, jsValue, "undefined");
    }
    const t = typeof jsValue;
    if (t === "function") {
      throw new ValtioYValidationError(ERROR_FUNCTION, jsValue, "function");
    }
    if (t === "symbol") {
      throw new ValtioYValidationError(ERROR_SYMBOL, jsValue, "symbol");
    }
    if (t === "bigint") {
      throw new ValtioYValidationError(ERROR_BIGINT, jsValue, "bigint");
    }
    if (t === "number" && !Number.isFinite(jsValue as number)) {
      throw new ValtioYValidationError(
        ERROR_NON_FINITE,
        jsValue,
        "non-finite",
      );
    }
    return jsValue;
  }

  // If this is one of our controller proxies, return the underlying Y type if it has no parent,
  // otherwise clone it to prevent re-parenting
  if (typeof jsValue === "object" && state.valtioProxyToYType.has(jsValue)) {
    const underlyingYType = state.valtioProxyToYType.get(jsValue)!;
    // Check if the Y type is already attached to a document
    if (isYAbstractType(underlyingYType)) {
      const yType = underlyingYType as Y.AbstractType<unknown>;
      if (yType.parent !== null) {
        // Y type is already in a document - clone it to prevent re-parenting
        const plainFromProxy = deepPlainFromValtioProxy(
          jsValue as object,
          state,
        );
        return plainObjectToYType(plainFromProxy, state, _logger);
      }
      // Y type has no parent - safe to return as-is
      return underlyingYType;
    }
    return underlyingYType;
  }

  if (Array.isArray(jsValue)) {
    const yArray = new Y.Array();
    yArray.insert(
      0,
      jsValue.map((v) => plainObjectToYType(v, state, _logger)),
    );
    return yArray;
  }

  // Only convert plain objects.
  if (isPlainObject(jsValue)) {
    const yMap = new Y.Map();
    for (const [key, value] of Object.entries(jsValue)) {
      yMap.set(key, plainObjectToYType(value, state, _logger));
    }
    return yMap;
  }

  // Defensive check: Unknown object types (should have been caught by validation layer)
  // This is a fail-safe in case converter is called without proper validation
  const ctorName = jsValue.constructor?.name ?? "UnknownObject";
  throw new ValtioYValidationError(
    createUnsupportedObjectError(ctorName),
    jsValue,
    "non-plain",
  );
}

// Build a deep plain JS value from a Valtio controller proxy, without touching its underlying Y types.
function deepPlainFromValtioProxy(
  value: unknown,
  state: SynchronizationState,
): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => deepPlainFromValtioProxy(v, state));
  }
  // Plain object or Valtio proxy object
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    // If nested value is a controller proxy too, recurse similarly
    if (
      v &&
      typeof v === "object" &&
      state.valtioProxyToYType.has(v as object)
    ) {
      result[k] = deepPlainFromValtioProxy(v, state);
    } else {
      result[k] = deepPlainFromValtioProxy(v, state);
    }
  }
  return result;
}
