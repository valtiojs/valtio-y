import * as Y from 'yjs';

/**
 * Creates a collaborative text type. Use this in initial data
 * to mark strings that should be collaboratively editable.
 */
export function syncedText(initialContent = ''): Y.Text {
  return new Y.Text(initialContent);
}


