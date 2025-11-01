import * as Y from 'yjs';

// Shared Yjs container types that are deeply proxied by Valtio
// Note: Y.XmlFragment, Y.XmlElement, and Y.XmlHook are NOT included here
// because they are treated as leaf types to preserve their native Y.js APIs.
export type YSharedContainer =
  | Y.Map<unknown>
  | Y.Array<unknown>;

/**
 * Y.js leaf types that should not be deeply proxied by Valtio.
 * 
 * Leaf types have internal CRDT state and native Y.js methods that must be preserved.
 * They are wrapped in ref() to prevent deep proxying and observed for changes instead.
 * 
 * Supported leaf types:
 * - Y.Text: Collaborative text CRDT (includes Y.XmlText which extends Y.Text)
 * - Y.XmlFragment: XML container with array-like interface
 * - Y.XmlElement: XML element with attributes + children
 * - Y.XmlHook: Custom hook type (extends Y.Map)
 */
export type YLeafType =
  | Y.Text
  | Y.XmlFragment
  | Y.XmlElement
  | Y.XmlHook;

// Event-related types used with observeDeep
export type YArrayDelta = Array<{ retain?: number; delete?: number; insert?: unknown[] }>;

export interface YMapEvent extends Y.YEvent<Y.Map<unknown>> {
  keysChanged: Set<string>;
}

export interface YArrayEvent extends Y.YEvent<Y.Array<unknown>> {
  changes: {
    added: Set<Y.Item>;
    deleted: Set<Y.Item>;
    delta: YArrayDelta;
    keys: Map<string, { action: 'add' | 'delete' | 'update'; oldValue: unknown }>;
  };
}


