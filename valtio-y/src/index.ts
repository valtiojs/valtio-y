/**
 * valtio-y: Bi-directional synchronization between Valtio and Y.js
 *
 * This is a barrel file that re-exports the public API.
 */

// Main API
export { createYjsProxy } from "./create-yjs-proxy";
export type {
  CreateYjsProxyOptions,
  YjsProxy,
  YjsProxyWithUndo,
  UndoManagerOptions,
  UndoRedoState,
} from "./create-yjs-proxy";

// Constants
export { VALTIO_Y_ORIGIN } from "./core/constants";

// Error classes
export {
  ValtioYError,
  ValtioYValidationError,
  ValtioYTransactionError,
  ValtioYReconciliationError,
  isValtioYError,
  isValtioYValidationError,
  isValtioYTransactionError,
  isValtioYReconciliationError,
} from "./core/errors";
export type { ValidationErrorType } from "./core/errors";

// Type utilities for advanced users
export type {
  ValtioProxy,
  ValtioProxyObject,
  ValtioProxyArray,
  ValtioMapOperation,
  ValtioArrayOperation,
  ValtioOperation,
  RawValtioOperation,
} from "./core/types";
