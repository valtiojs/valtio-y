/**
 * Valtio-Yjs Integration Setup
 * 
 * This module customizes Valtio's internal behavior to work correctly with Y.js types.
 * It must be imported early, before any proxies are created.
 * 
 * Key customization:
 * - Prevents Valtio from deep-proxying Y.js types (AbstractType instances)
 * - This allows Y.js to maintain its internal state and generate transactions correctly
 */

import * as Y from 'yjs';
import { unstable_replaceInternalFunction } from 'valtio/vanilla';

// Track if we've already initialized
let initialized = false;

/**
 * Initialize Valtio customizations for Y.js compatibility.
 * This function is idempotent - calling it multiple times is safe.
 */
export function initializeValtioYjsIntegration(): void {
  if (initialized) {
    return;
  }

  // Customize Valtio's canProxy to never deep-proxy Y.js types
  unstable_replaceInternalFunction('canProxy', (defaultCanProxy) => {
    return (x: unknown): boolean => {
      // Never proxy Y.js AbstractType instances (Y.Map, Y.Array, Y.Text, Y.XmlFragment, etc.)
      if (x instanceof Y.AbstractType) {
        return false;
      }
      
      // For all other values, use Valtio's default logic
      return defaultCanProxy(x);
    };
  });

  initialized = true;
}

/**
 * Reset the initialization state (useful for testing).
 * @internal
 */
export function __resetValtioYjsIntegration(): void {
  initialized = false;
}

