/**
 * Core type utilities for valtio-yjs
 * 
 * This file contains:
 * - Branded types for Valtio proxies
 * - Type-safe helper functions for container operations
 * - Discriminated union types for Valtio operations
 * - Utility types for common patterns
 */

import { normalizeIndex } from '../utils/index-utils';

// ============================================================================
// Branded Types for Valtio Proxies
// ============================================================================

/**
 * Branded type to distinguish Valtio controller proxies from plain objects/arrays.
 * This helps prevent accidental mixing of proxy and non-proxy values at the type level.
 */
declare const ValtioProxyBrand: unique symbol;

export type ValtioProxy<T = unknown> = T & { readonly [ValtioProxyBrand]: true };

export type ValtioProxyObject = ValtioProxy<Record<string, unknown>>;
export type ValtioProxyArray = ValtioProxy<unknown[]>;

// ============================================================================
// Valtio Operation Types (Discriminated Unions)
// ============================================================================

/**
 * Type-safe representation of Valtio subscription operations.
 * These are discriminated unions that make it easier to work with operations.
 */

export type ValtioMapPath = [string];
export type ValtioArrayPath = [number];

export interface ValtioSetMapOp {
  readonly type: 'set';
  readonly path: ValtioMapPath;
  readonly newValue: unknown;
  readonly prevValue: unknown;
}

export interface ValtioDeleteMapOp {
  readonly type: 'delete';
  readonly path: ValtioMapPath;
}

export interface ValtioSetArrayOp {
  readonly type: 'set';
  readonly path: ValtioArrayPath;
  readonly newValue: unknown;
  readonly prevValue: unknown;
}

export interface ValtioDeleteArrayOp {
  readonly type: 'delete';
  readonly path: ValtioArrayPath;
}

export type ValtioMapOperation = ValtioSetMapOp | ValtioDeleteMapOp;
export type ValtioArrayOperation = ValtioSetArrayOp | ValtioDeleteArrayOp;
export type ValtioOperation = ValtioMapOperation | ValtioArrayOperation;

/**
 * Raw operation format as received from Valtio's subscribe.
 * Format: [operation, path, newValue?, prevValue?]
 */
export type RawValtioOperation = 
  | ['set', [string | number], unknown, unknown]
  | ['delete', [string | number]];

// ============================================================================
// Type Guards for Valtio Operations
// ============================================================================

export function isRawSetMapOp(op: unknown): op is ['set', [string], unknown, unknown] {
  return (
    Array.isArray(op) &&
    op[0] === 'set' &&
    Array.isArray(op[1]) &&
    op[1].length === 1 &&
    typeof op[1][0] === 'string'
  );
}

export function isRawDeleteMapOp(op: unknown): op is ['delete', [string]] {
  return (
    Array.isArray(op) &&
    op[0] === 'delete' &&
    Array.isArray(op[1]) &&
    op[1].length === 1 &&
    typeof op[1][0] === 'string'
  );
}

export function isRawSetArrayOp(op: unknown): op is ['set', [number | string], unknown, unknown] {
  if (!Array.isArray(op) || op[0] !== 'set' || !Array.isArray(op[1]) || op[1].length !== 1) {
    return false;
  }
  const idx = op[1][0];
  // Accept both numeric indices and string indices that represent numbers
  return typeof idx === 'number' || (typeof idx === 'string' && /^\d+$/.test(idx));
}

export function isRawDeleteArrayOp(op: unknown): op is ['delete', [number | string]] {
  if (!Array.isArray(op) || op[0] !== 'delete' || !Array.isArray(op[1]) || op[1].length !== 1) {
    return false;
  }
  const idx = op[1][0];
  // Accept both numeric indices and string indices that represent numbers
  return typeof idx === 'number' || (typeof idx === 'string' && /^\d+$/.test(idx));
}

/**
 * Parse a raw Valtio operation into a type-safe discriminated union.
 */
export function parseValtioMapOp(op: unknown): ValtioMapOperation | null {
  if (isRawSetMapOp(op)) {
    return {
      type: 'set',
      path: [op[1][0]],
      newValue: op[2],
      prevValue: op[3],
    };
  }
  if (isRawDeleteMapOp(op)) {
    return {
      type: 'delete',
      path: [op[1][0]],
    };
  }
  return null;
}

export function parseValtioArrayOp(op: unknown): ValtioArrayOperation | null {
  if (isRawSetArrayOp(op)) {
    const idx = op[1][0];
    const normalizedIndex = normalizeIndex(idx);
    return {
      type: 'set',
      path: [normalizedIndex],
      newValue: op[2],
      prevValue: op[3],
    };
  }
  if (isRawDeleteArrayOp(op)) {
    const idx = op[1][0];
    const normalizedIndex = normalizeIndex(idx);
    return {
      type: 'delete',
      path: [normalizedIndex],
    };
  }
  return null;
}

// ============================================================================
// Type-Safe Container Access Helpers
// ============================================================================

/**
 * Type-safe helper to get a value from an object container.
 * Reduces the need for unsafe type assertions.
 */
export function getObjectValue(
  container: Record<string, unknown>,
  key: string,
): unknown {
  return container[key];
}

/**
 * Type-safe helper to set a value in an object container.
 */
export function setObjectValue(
  container: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  container[key] = value;
}

/**
 * Type-safe helper to delete a key from an object container.
 */
export function deleteObjectKey(
  container: Record<string, unknown>,
  key: string,
): void {
  delete container[key];
}

/**
 * Type-safe helper to get a value from an array container.
 * Handles both numeric and string indices.
 */
export function getArrayValue(
  container: unknown[],
  index: number | string,
): unknown {
  const idx = typeof index === 'number' ? index : Number.parseInt(index, 10);
  return container[idx];
}

/**
 * Type-safe helper to set a value in an array container.
 * Handles both numeric and string indices.
 */
export function setArrayValue(
  container: unknown[],
  index: number | string,
  value: unknown,
): void {
  const idx = typeof index === 'number' ? index : Number.parseInt(index, 10);
  container[idx] = value;
}

/**
 * Type-safe helper for generic container access (object or array).
 * This replaces the unsafe pattern:
 * (container as Record<string, unknown>)[key as keyof typeof container] as unknown
 */
export function getContainerValue(
  container: Record<string, unknown> | unknown[],
  key: string | number,
): unknown {
  if (Array.isArray(container) && typeof key === 'number') {
    return getArrayValue(container, key);
  }
  if (typeof container === 'object' && container !== null && typeof key === 'string') {
    return getObjectValue(container as Record<string, unknown>, key);
  }
  return undefined;
}

/**
 * Type-safe helper for generic container set (object or array).
 */
export function setContainerValue(
  container: Record<string, unknown> | unknown[],
  key: string | number,
  value: unknown,
): void {
  if (Array.isArray(container) && typeof key === 'number') {
    setArrayValue(container, key, value);
  } else if (typeof container === 'object' && container !== null) {
    setObjectValue(container as Record<string, unknown>, String(key), value);
  }
}

// ============================================================================
// Y.js Type Utilities
// ============================================================================

/**
 * Type-safe helper to access Y.js internal _item property.
 * This avoids unsafe type assertions like:
 * (yArray as unknown as { _item?: { id?: { toString?: () => string } } })
 */
export interface YInternalItem {
  id?: {
    toString?: () => string;
  };
}

export function getYItemId(target: unknown): string | undefined {
  const item = (target as { _item?: YInternalItem })._item;
  return item?.id?.toString?.();
}

/**
 * Type-safe helper to access Y.js doc property.
 */
export function getYDoc(target: unknown): import('yjs').Doc | undefined {
  return (target as { doc?: import('yjs').Doc | undefined })?.doc;
}

/**
 * Type-safe helper to call Y.js toJSON method.
 */
export function yTypeToJSON(target: unknown): unknown {
  const json = (target as { toJSON?: () => unknown })?.toJSON?.();
  return json ?? undefined;
}

// ============================================================================
// Utility Type Predicates
// ============================================================================

/**
 * Check if a value is a plain object (created by object literal or with null prototype).
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Check if a value is a record-like object (has string keys).
 */
export function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for object with specific property.
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make all properties in T mutable (remove readonly).
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Extract the value type from a Map.
 */
export type MapValue<T> = T extends Map<unknown, infer V> ? V : never;

/**
 * Extract the value type from a Set.
 */
export type SetValue<T> = T extends Set<infer V> ? V : never;

/**
 * A function that takes no arguments and returns void.
 */
export type VoidFunction = () => void;

/**
 * A callback function that receives a value.
 */
export type Callback<T = unknown> = (value: T) => void;

