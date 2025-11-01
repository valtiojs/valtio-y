/**
 * valtio-yjs: Bi-directional synchronization between Valtio and Y.js
 * 
 * This is a barrel file that re-exports the public API.
 */

// Main API
export { createYjsProxy } from './create-yjs-proxy';
export type { CreateYjsProxyOptions, YjsProxy } from './create-yjs-proxy';

// Constants
export { VALTIO_YJS_ORIGIN } from './core/constants';

// Synced types
export { syncedText } from './synced-types';

// Type utilities for advanced users
export type {
  ValtioProxy,
  ValtioProxyObject,
  ValtioProxyArray,
  ValtioMapOperation,
  ValtioArrayOperation,
  ValtioOperation,
  RawValtioOperation,
} from './core/types';

