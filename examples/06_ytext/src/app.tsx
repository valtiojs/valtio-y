/**
 * Y.Text Collaborative Editing Example
 * 
 * This example demonstrates character-level collaborative text editing with Y.Text:
 * 
 * 1. **Y.Text**: Yjs's CRDT for text that supports character-level merging
 * 2. **Conflict-Free Editing**: Multiple users can edit the same text simultaneously
 * 3. **Offline Support**: Changes sync when coming back online
 * 4. **Character Preservation**: Unlike string replacement, Y.Text merges edits character-by-character
 */

import { useSnapshot } from 'valtio';
import * as Y from 'yjs';
import { createYjsProxy, syncedText } from 'valtio-yjs';
import { useState, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

type AppState = {
  sharedText: Y.Text;
};

// ============================================================================
// YJS SETUP
// ============================================================================

// Create two Y.Docs to simulate two clients
const doc1 = new Y.Doc();
const doc2 = new Y.Doc();

const RELAY_ORIGIN = Symbol('relay');

// Track online/offline status
let client1Online = true;
let client2Online = true;

const client1Queue: Uint8Array[] = [];
const client2Queue: Uint8Array[] = [];

const statusListeners = new Set<() => void>();

function notifyStatusChange() {
  statusListeners.forEach(listener => listener());
}

export function toggleClient1Online() {
  client1Online = !client1Online;
  if (client1Online) {
    client1Queue.forEach(update => {
      setTimeout(() => {
        doc2.transact(() => Y.applyUpdate(doc2, update), RELAY_ORIGIN);
      }, 50);
    });
    client1Queue.length = 0;
    
    if (client2Online && client2Queue.length > 0) {
      client2Queue.forEach(update => {
        setTimeout(() => {
          doc1.transact(() => Y.applyUpdate(doc1, update), RELAY_ORIGIN);
        }, 50);
      });
      client2Queue.length = 0;
    }
  }
  notifyStatusChange();
}

export function toggleClient2Online() {
  client2Online = !client2Online;
  if (client2Online) {
    client2Queue.forEach(update => {
      setTimeout(() => {
        doc1.transact(() => Y.applyUpdate(doc1, update), RELAY_ORIGIN);
      }, 50);
    });
    client2Queue.length = 0;
    
    if (client1Online && client1Queue.length > 0) {
      client1Queue.forEach(update => {
        setTimeout(() => {
          doc2.transact(() => Y.applyUpdate(doc2, update), RELAY_ORIGIN);
        }, 50);
      });
      client1Queue.length = 0;
    }
  }
  notifyStatusChange();
}

export function subscribeToStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function getClient1Online() {
  return client1Online;
}

export function getClient2Online() {
  return client2Online;
}

doc1.on('update', (update: Uint8Array, origin: unknown) => {
  if (origin === RELAY_ORIGIN) return;
  
  if (client1Online) {
    setTimeout(() => {
      doc2.transact(() => Y.applyUpdate(doc2, update), RELAY_ORIGIN);
    }, 50);
  } else {
    client1Queue.push(update);
  }
});

doc2.on('update', (update: Uint8Array, origin: unknown) => {
  if (origin === RELAY_ORIGIN) return;
  
  if (client2Online) {
    setTimeout(() => {
      doc1.transact(() => Y.applyUpdate(doc1, update), RELAY_ORIGIN);
    }, 50);
  } else {
    client2Queue.push(update);
  }
});

// Create valtio-yjs proxies
const { proxy: proxy1, bootstrap: bootstrap1 } = createYjsProxy<AppState>(doc1, {
  getRoot: (doc) => doc.getMap('sharedState'),
});

const { proxy: proxy2 } = createYjsProxy<AppState>(doc2, {
  getRoot: (doc) => doc.getMap('sharedState'),
});

// Initialize with sample text - use bootstrap to ensure proper initialization
bootstrap1({
  sharedText: syncedText('Start typing here! Try editing from both clients at the same time.')
});

// ============================================================================
// CLIENT VIEW COMPONENT
// ============================================================================

type ClientViewProps = {
  name: string;
  stateProxy: AppState;
  color: string;
  clientId: 1 | 2;
};

function ClientView({ name, stateProxy, color, clientId }: ClientViewProps) {
  const snap = useSnapshot(stateProxy);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isOnline, setIsOnline] = useState(clientId === 1 ? getClient1Online() : getClient2Online());
  const cursorPositionRef = useRef<number | null>(null);
  
  useEffect(() => {
    const unsubscribe = subscribeToStatus(() => {
      setIsOnline(clientId === 1 ? getClient1Online() : getClient2Online());
    });
    return unsubscribe;
  }, [clientId]);
  
  // Get text content (safe even if sharedText is undefined)
  const textContent = snap.sharedText?.toString() || '';
  
  // Restore cursor position after re-render from remote changes
  useEffect(() => {
    if (cursorPositionRef.current !== null && textareaRef.current) {
      const pos = cursorPositionRef.current;
      textareaRef.current.setSelectionRange(pos, pos);
      cursorPositionRef.current = null;
    }
  }, [textContent]);
  
  // Safety check: ensure sharedText exists (after all hooks)
  if (!snap.sharedText) {
    return (
      <div className="flex-1 rounded-xl shadow-lg border-2 p-6 bg-white border-slate-200">
        <p className="text-slate-500">Initializing...</p>
      </div>
    );
  }
  
  const handleToggleOnline = () => {
    if (clientId === 1) {
      toggleClient1Online();
    } else {
      toggleClient2Online();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const oldValue = stateProxy.sharedText.toString();
    const textarea = textareaRef.current;
    
    if (!textarea) return;
    
    // Skip if values are the same (shouldn't happen but defensive)
    if (newValue === oldValue) {
      return;
    }
    
    const cursorPos = textarea.selectionStart;
    
    // Calculate the diff and apply minimal changes to Y.Text
    if (newValue.length > oldValue.length) {
      // Text was inserted
      const inserted = newValue.substring(cursorPos - (newValue.length - oldValue.length), cursorPos);
      const insertPos = cursorPos - inserted.length;
      stateProxy.sharedText.insert(insertPos, inserted);
      // Save cursor position to restore after re-render
      cursorPositionRef.current = cursorPos;
    } else if (newValue.length < oldValue.length) {
      // Text was deleted
      const deleteCount = oldValue.length - newValue.length;
      stateProxy.sharedText.delete(cursorPos, deleteCount);
      // Save cursor position to restore after re-render
      cursorPositionRef.current = cursorPos;
    } else {
      // Text was replaced (same length) - delete and insert
      const diffStart = Array.from(oldValue).findIndex((char, i) => char !== newValue[i]);
      if (diffStart !== -1 && diffStart < newValue.length) {
        stateProxy.sharedText.delete(diffStart, 1);
        stateProxy.sharedText.insert(diffStart, newValue[diffStart]!);
        cursorPositionRef.current = cursorPos;
      }
    }
  };

  const charCount = textContent.length;
  const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;

  return (
    <div className={`flex-1 rounded-xl shadow-lg border-2 p-6 transition-all ${
      isOnline 
        ? 'bg-white border-slate-200' 
        : 'bg-slate-100 border-orange-300'
    }`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold bg-${color}-100 text-${color}-700`}>
            {name}
          </div>
          <button
            onClick={handleToggleOnline}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isOnline
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            }`}
          >
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </button>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Shared Editor</h2>
        <p className="text-sm text-slate-600">
          {charCount} characters · {wordCount} words
          {!isOnline && ' · Working offline'}
        </p>
      </div>

      {/* Text Editor */}
      <textarea
        ref={textareaRef}
        value={textContent}
        onChange={handleTextChange}
        className="w-full h-64 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
        placeholder="Start typing..."
      />

      {/* Info */}
      <div className="mt-3 text-xs text-slate-500">
        💡 Try typing in both editors simultaneously to see character-level merging
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

const App = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            Y.Text Collaborative Editor
          </h1>
          <p className="text-slate-600 mb-2">
            Character-level collaborative text editing with <strong>valtio-yjs</strong>
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500">
            <span>⌨️ Type in both editors simultaneously</span>
            <span>✨ Watch character-level merging</span>
            <span>🔴 Toggle offline to test sync</span>
          </div>
        </div>

        {/* Two Clients Side by Side */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <ClientView name="Client 1" stateProxy={proxy1} color="blue" clientId={1} />
          <ClientView name="Client 2" stateProxy={proxy2} color="purple" clientId={2} />
        </div>

        {/* Explanation */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Why Y.Text Instead of Strings?
          </h3>
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <strong className="text-slate-900">String Replacement:</strong> When using plain strings, 
              editing replaces the entire value. If two clients edit at the same time, one edit overwrites the other.
            </div>
            <div>
              <strong className="text-slate-900">Y.Text (CRDT):</strong> Y.Text tracks every character with 
              its own identity and position. When two clients edit simultaneously, their changes merge at the 
              character level without conflicts.
            </div>
            <div className="pt-3 border-t border-slate-200">
              <strong className="text-slate-900">Example:</strong>
              <ul className="mt-2 ml-4 space-y-1 text-xs list-disc">
                <li>Client 1 types "Hello" at position 0</li>
                <li>Client 2 types "World" at position 0 (offline)</li>
                <li>When Client 2 comes online: Y.Text merges to "WorldHello" or "HelloWorld" depending on timestamps</li>
                <li>With strings: One would completely replace the other ❌</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
            💡 <strong>Try this:</strong> Make both clients offline. Type different text in each. 
            Bring them back online and watch Y.Text merge the changes intelligently!
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
