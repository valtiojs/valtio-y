import * as Y from 'yjs';

/**
 * Safely serialize operations for logging, handling Y types with circular references.
 * Used by bridge controllers to log operations without causing circular reference errors.
 */
export function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  
  const replacer = (_key: string, val: unknown): unknown => {
    // Handle Y types first
    if (val instanceof Y.AbstractType) {
      // Replace Y types with a simple representation to avoid circular references
      if (val instanceof Y.Text) {
        try {
          const text = val.toString();
          return `[Y.Text: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"]`;
        } catch {
          return '[Y.Text: <unreadable>]';
        }
      }
      if (val instanceof Y.Map) {
        return '[Y.Map]';
      }
      if (val instanceof Y.Array) {
        return '[Y.Array]';
      }
      return '[Y.AbstractType]';
    }
    
    // Handle plain objects and arrays with circular reference detection
    if (val !== null && typeof val === 'object') {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    
    return val;
  };
  
  try {
    return JSON.stringify(value, replacer);
  } catch (err) {
    // Fallback if serialization still fails
    return `[Serialization failed: ${err instanceof Error ? err.message : String(err)}]`;
  }
}

