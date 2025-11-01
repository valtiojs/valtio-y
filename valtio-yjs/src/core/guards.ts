import * as Y from 'yjs';
import type { YSharedContainer, YLeafType } from './yjs-types';

export function isYSharedContainer(value: unknown): value is YSharedContainer {
  return (
    value instanceof Y.Map ||
    value instanceof Y.Array
  );
  // Note: Y.XmlFragment, Y.XmlElement, and Y.XmlHook are treated as leaf types,
  // not containers, even though they have container-like APIs. This is because
  // they need to preserve their native Y.js methods and shouldn't be wrapped in
  // Valtio proxies. See isYLeafType() for the complete list of leaf types.
}

export function isYMap(value: unknown): value is Y.Map<unknown> {
  return value instanceof Y.Map;
}

export function isYArray(value: unknown): value is Y.Array<unknown> {
  return value instanceof Y.Array;
}

export function isYText(value: unknown): value is Y.Text {
  return value instanceof Y.Text;
}

export function isYXmlFragment(value: unknown): value is Y.XmlFragment {
  return value instanceof Y.XmlFragment;
}

export function isYXmlElement(value: unknown): value is Y.XmlElement {
  return value instanceof Y.XmlElement;
}

export function isYXmlHook(value: unknown): value is Y.XmlHook {
  return value instanceof Y.XmlHook;
}

export function isYAbstractType(value: unknown): value is Y.AbstractType<unknown> {
  return value instanceof Y.AbstractType;
}

/**
 * Checks if a value is a Y.js leaf type (non-container CRDT).
 * Leaf types have internal CRDT state and should not be deeply proxied.
 * They are stored as-is (wrapped in ref()) rather than being proxied.
 * 
 * Currently supports:
 * - Y.Text: Collaborative text CRDT
 * - Y.XmlText: XML-specific text (extends Y.Text)
 * - Y.XmlFragment: XML container with array-like interface
 * - Y.XmlElement: XML element with attributes + children
 * - Y.XmlHook: Custom hook type (extends Y.Map)
 * 
 * Note: Y.XmlText extends Y.Text, so instanceof Y.Text catches both.
 * 
 * XML types (XmlFragment, XmlElement, XmlHook) are treated as leaf types because:
 * - They have their own native interfaces that shouldn't be wrapped
 * - They need to preserve their Y.js methods (insert, setAttribute, etc.)
 * - Proxying them would break their specialized APIs
 * 
 * To add more leaf types:
 * 1. Add instanceof check here (e.g., || value instanceof Y.SomeLeafType)
 * 2. Add tests in tests/e2e/ to verify convergence and reactivity
 * 3. Update README.md to document the new leaf type
 * 
 * Future leaf types to consider:
 * - Custom Y.AbstractType implementations with specialized APIs
 */
export function isYLeafType(value: unknown): value is YLeafType {
  // Y.Text includes Y.XmlText since it extends Y.Text
  // XML types are treated as leaf types to preserve their native APIs
  return (
    value instanceof Y.Text ||
    value instanceof Y.XmlFragment ||
    value instanceof Y.XmlElement ||
    value instanceof Y.XmlHook
  );
}


