/**
 * Error types for valtio-y validation and synchronization errors.
 *
 * These typed error classes provide better error discrimination and
 * debugging capabilities compared to generic Error instances.
 */

/**
 * Base class for all valtio-y errors.
 * Provides common functionality and type discrimination.
 */
export class ValtioYError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValtioYError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error types for validation failures.
 */
export type ValidationErrorType =
  | "undefined"
  | "undefined-in-object"
  | "function"
  | "symbol"
  | "bigint"
  | "non-finite"
  | "non-plain"
  | "reparenting";

/**
 * Thrown when a value fails validation before being added to shared state.
 *
 * This error indicates that the application attempted to assign an unsupported
 * value type to the shared state. The proxy will automatically roll back to
 * its previous state when this error is thrown.
 *
 * @example
 * ```typescript
 * try {
 *   proxy.value = Symbol("test");
 * } catch (err) {
 *   if (err instanceof ValtioYValidationError) {
 *     console.log(`Invalid ${err.errorType}: ${err.message}`);
 *     console.log('Rejected value:', err.value);
 *   }
 * }
 * ```
 */
export class ValtioYValidationError extends ValtioYError {
  constructor(
    message: string,
    public readonly value: unknown,
    public readonly errorType: ValidationErrorType,
  ) {
    super(message);
    this.name = "ValtioYValidationError";
  }

  /**
   * Returns a user-friendly explanation of this error type.
   */
  getUserFriendlyMessage(): string {
    switch (this.errorType) {
      case "undefined":
        return "The value 'undefined' cannot be stored in shared state. Use null instead, or delete the property.";
      case "undefined-in-object":
        return "Objects in shared state cannot contain 'undefined' values. Use null instead, or omit the property.";
      case "function":
        return "Functions cannot be stored in shared state. Store data only, and define functions separately in your application code.";
      case "symbol":
        return "Symbols cannot be stored in shared state. Use strings or numbers as identifiers instead.";
      case "bigint":
        return "BigInt values cannot be stored in shared state. Convert to string or use regular numbers if the value fits in Number.MAX_SAFE_INTEGER.";
      case "non-finite":
        return "Infinity and NaN cannot be stored in shared state. Use null to represent missing numeric values, or store as a string.";
      case "non-plain":
        return "Only plain objects and arrays can be stored in shared state. Convert custom class instances, Date, RegExp, etc. to plain representations first.";
      case "reparenting":
        return "Cannot move a Y.js type that is already in the document. Create a deep clone if you want to copy this object to a new location.";
      default:
        return this.message;
    }
  }

  /**
   * Returns suggested fixes for this error.
   */
  getSuggestedFix(): string {
    switch (this.errorType) {
      case "undefined":
      case "undefined-in-object":
        return "Replace 'undefined' with null, or delete the property.";
      case "function":
        return "Remove functions from your data objects. Define functions in your component code instead.";
      case "symbol":
        return "Replace symbols with strings or numbers.";
      case "bigint":
        return "Convert BigInt to string: bigIntValue.toString()";
      case "non-finite":
        return "Replace with null or a string representation.";
      case "non-plain":
        return "Convert to plain object. For Date: date.toISOString(), for RegExp: regex.toString()";
      case "reparenting":
        return "Create a deep clone at the application layer before assigning.";
      default:
        return "";
    }
  }
}

/**
 * Thrown when a transaction fails during write operations.
 *
 * This error wraps the underlying error and provides context about
 * which operation failed (map sets, map deletes, array operations).
 *
 * @example
 * ```typescript
 * catch (err) {
 *   if (err instanceof ValtioYTransactionError) {
 *     console.log(`Transaction failed during ${err.operation}`);
 *     console.log('Cause:', err.cause);
 *   }
 * }
 * ```
 */
export class ValtioYTransactionError extends ValtioYError {
  constructor(
    message: string,
    public readonly operation: "map-deletes" | "map-sets" | "array-operations",
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = "ValtioYTransactionError";
  }
}

/**
 * Thrown when reconciliation fails during Yjs -> Valtio sync.
 *
 * This error indicates that the library failed to synchronize changes
 * from the Y.js document to the Valtio proxy. This is rare and usually
 * indicates a bug or corrupted state.
 *
 * @example
 * ```typescript
 * catch (err) {
 *   if (err instanceof ValtioYReconciliationError) {
 *     console.error('Reconciliation failed:', err.containerType);
 *     // May need to re-bootstrap the proxy
 *   }
 * }
 * ```
 */
export class ValtioYReconciliationError extends ValtioYError {
  constructor(
    message: string,
    public readonly containerType: "map" | "array",
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = "ValtioYReconciliationError";
  }
}

/**
 * Type guard to check if an error is a ValtioYError.
 */
export function isValtioYError(error: unknown): error is ValtioYError {
  return error instanceof ValtioYError;
}

/**
 * Type guard to check if an error is a ValtioYValidationError.
 */
export function isValtioYValidationError(
  error: unknown,
): error is ValtioYValidationError {
  return error instanceof ValtioYValidationError;
}

/**
 * Type guard to check if an error is a ValtioYTransactionError.
 */
export function isValtioYTransactionError(
  error: unknown,
): error is ValtioYTransactionError {
  return error instanceof ValtioYTransactionError;
}

/**
 * Type guard to check if an error is a ValtioYReconciliationError.
 */
export function isValtioYReconciliationError(
  error: unknown,
): error is ValtioYReconciliationError {
  return error instanceof ValtioYReconciliationError;
}
