// Leaf Node Reactivity via Computed Properties
//
// This approach uses computed properties (getters) instead of proxy wrappers.
// When a component accesses snap.text, it calls the getter which:
// 1. Touches the version counter (creating a Valtio dependency)
// 2. Returns the underlying Y.js leaf node
//
// This works because Valtio tracks computed property accesses in snapshots.

import type { YLeafType } from '../core/yjs-types';
import type { SynchronizationContext } from '../core/context';
import { ref } from 'valtio/vanilla';

/**
 * String property used to store/access the version counter for dependency tracking
 * IMPORTANT: Must be a string property, NOT a symbol, because Valtio only tracks
 * string properties for dependencies in snapshots.
 */
export const LEAF_VERSION_KEY = '__valtio_yjs_version';

/**
 * Creates a reactive wrapper around a Y.js leaf node that automatically
 * touches the version counter on every property/method access.
 * This ensures Valtio tracks the dependency without requiring explicit version access.
 */
function createReactiveLeafWrapper(
  leafNode: YLeafType,
  objProxy: Record<string | symbol, unknown>,
): YLeafType {
  return new Proxy(leafNode, {
    get(target, prop, receiver) {
      // Touch the version counter on EVERY access to the leaf node
      // This creates a Valtio dependency automatically when methods like
      // toString(), length, etc. are accessed from a snapshot
      void objProxy[LEAF_VERSION_KEY];
      
      const value = Reflect.get(target, prop, receiver);
      
      // If the value is a function, bind it to the original target
      if (typeof value === 'function') {
        return value.bind(target);
      }
      
      return value;
    },
  }) as YLeafType;
}

/**
 * Sets up a Y.js leaf node with automatic reactivity using a computed property.
 * 
 * Instead of wrapping the leaf node in a proxy, we:
 * 1. Store the leaf node in a symbol property
 * 2. Define a getter that touches the version counter before returning the leaf
 * 3. Set up an observer that increments the version counter on changes
 * 
 * This ensures that when a component accesses `snap.text`, it creates a dependency
 * on the version counter, causing re-renders when the Y.js content changes.
 * 
 * @param context - Synchronization context for lock management and cleanup
 * @param objProxy - The Valtio proxy object to attach the leaf to
 * @param key - The property key where the leaf should be accessible
 * @param leafNode - The Y.js leaf type (Y.Text, Y.XmlText, etc.)
 */
export function setupLeafNodeAsComputed(
  context: SynchronizationContext,
  objProxy: Record<string | symbol, unknown>,
  key: string,
  leafNode: YLeafType,
): void {
  // Initialize version counter if it doesn't exist
  if (!(LEAF_VERSION_KEY in objProxy)) {
    objProxy[LEAF_VERSION_KEY] = 0;
  }
  
  // Create a reactive wrapper that touches version counter on every access
  const reactiveLeaf = createReactiveLeafWrapper(leafNode, objProxy);
  
  // Store the reactive wrapper in a symbol property (ref'd to prevent deep proxying)
  const storageKey = Symbol.for(`valtio-yjs:leaf:${key}`);
  objProxy[storageKey] = ref(reactiveLeaf);
  
  // Define a computed property (getter) that returns the reactive wrapper
  Object.defineProperty(objProxy, key, {
    get(this: typeof objProxy) {
      // The reactive wrapper will touch the version counter on every access
      // to its properties/methods, so components don't need explicit version access
      return this[storageKey];
    },
    enumerable: true,
    configurable: true,
  });
  
  // Set up Y.js observer to increment version counter on changes
  const handler = () => {
    // Increment the version counter - this is a tracked property so it will
    // notify all subscribers (including React components using useSnapshot)
    const currentVersion = objProxy[LEAF_VERSION_KEY] as number;
    objProxy[LEAF_VERSION_KEY] = currentVersion + 1;
  };
  
  leafNode.observe(handler);
  
  // Register cleanup
  context.registerDisposable(() => {
    leafNode.unobserve(handler);
  });
  
  context.log.debug('[leaf-computed] setup complete (with reactive wrapper)', {
    key,
    type: leafNode.constructor.name,
  });
}

/**
 * Array version of setupLeafNodeAsComputed
 */
export function setupLeafNodeAsComputedInArray(
  context: SynchronizationContext,
  arrProxy: unknown[],
  index: number,
  leafNode: YLeafType,
): void {
  // For arrays, we can't use computed properties on indices (they're not stable)
  // So we store the ref'd leaf directly and use a version counter on the array
  const arrAsRecord = arrProxy as unknown as Record<string, unknown>;
  
  // Initialize version counter on the array
  if (!(LEAF_VERSION_KEY in arrAsRecord)) {
    arrAsRecord[LEAF_VERSION_KEY] = 0;
  }
  
  // Store the ref'd leaf directly in the array
  arrProxy[index] = ref(leafNode);
  
  // Set up observer to increment the array's version counter
  const handler = () => {
    const currentVersion = arrAsRecord[LEAF_VERSION_KEY] as number;
    arrAsRecord[LEAF_VERSION_KEY] = currentVersion + 1;
  };
  
  leafNode.observe(handler);
  
  context.registerDisposable(() => {
    leafNode.unobserve(handler);
  });
  
  context.log.debug('[leaf-computed] setup complete (array)', {
    index,
    type: leafNode.constructor.name,
  });
}

/**
 * Gets the underlying Y.js leaf node from a proxy
 */
export function getUnderlyingLeaf(
  obj: Record<string | symbol, unknown>,
  key: string,
): YLeafType | undefined {
  const storageKey = Symbol.for(`valtio-yjs:leaf:${key}`);
  return obj[storageKey] as YLeafType | undefined;
}

