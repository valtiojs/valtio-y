import { isYArray, isYMap } from './guards';
import type { YArrayEvent, YMapEvent } from './yjs-types';

// Event types and type guards for Yjs observeDeep events

// Types are declared in yjs-types.ts

export function isYMapEvent(event: unknown): event is YMapEvent {
  return !!event && typeof event === 'object' && isYMap((event as { target?: unknown }).target);
}

// Types are declared in yjs-types.ts

export function isYArrayEvent(event: unknown): event is YArrayEvent {
  return !!event && typeof event === 'object' && isYArray((event as { target?: unknown }).target);
}


