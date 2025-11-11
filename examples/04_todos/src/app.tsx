/**
 * Collaborative Todo List - Main Application
 *
 * This example demonstrates the key features of valtio-y:
 *
 * 1. **Simple API**: Just mutate the proxy like regular JavaScript objects
 * 2. **Real-time Sync**: Changes sync automatically between clients via Yjs
 * 3. **Nested Structures**: Deep nesting and arrays work seamlessly
 * 4. **React Integration**: Use useSnapshot() to read state reactively
 * 5. **Complex Operations**: Drag-and-drop, bulk edits, all sync correctly
 *
 * The code is split into logical files for learning:
 * - types.ts: Type definitions
 * - yjsSetup.ts: Yjs document setup and network simulation
 * - utils.ts: Helper functions for nested data
 * - components/: Individual React components
 */

import { proxy } from "./yjs-setup";
import { ClientView } from "./components/client-view";

/**
 * Main App Component
 *
 * Renders a single shared todo list backed by a Y.Doc hosted on PartyServer.
 * Open this example in a second browser or device to experience real-time sync.
 *
 * Try it:
 * - Add a todo and watch it appear instantly everywhere
 * - Disconnect/reconnect to test offline behavior
 * - Drag items to reorder them
 * - Add nested subtasks with the + button
 * - Use selection mode for bulk operations
 * - Double-click any todo to edit it inline
 */
const App = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-12">
        {/* Header with instructions */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">
            Collaborative Todo List
          </h1>
          <p className="text-slate-600 text-base mb-2">
            Powered by <strong>valtio-y</strong> +{" "}
            <strong>Y-PartyServer</strong> · Real-time synchronization over
            WebSockets
          </p>
          <p className="text-sm text-slate-500 max-w-2xl mx-auto mb-4">
            This example showcases how valtio-y handles complex state including
            nested arrays, drag-and-drop reordering, and bulk operations. Every
            open browser tab connects to the same PartyServer backend, so edits
            synchronize instantly via Yjs CRDTs.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <span>💡 Double-click to edit</span>
            <span>🔄 Drag to reorder</span>
            <span>➕ Click + to add subtasks</span>
            <span>✅ Enable selection for bulk actions</span>
            <span>📡 Connect/disconnect to test offline mode</span>
            <span>⚡ Changes sync instantly</span>
          </div>
        </div>

        {/* Shared client view */}
        <div className="flex flex-col gap-6 max-w-4xl mx-auto">
          <ClientView stateProxy={proxy} />
        </div>

        {/* Educational footer */}
        <div className="mt-12 max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">
            How valtio-y Works
          </h3>
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <strong className="text-slate-900">
                Read with useSnapshot():
              </strong>{" "}
              Get a reactive snapshot of the state that triggers re-renders when
              it changes.
            </div>
            <div>
              <strong className="text-slate-900">
                Write with direct mutations:
              </strong>{" "}
              Modify the proxy like a normal object. valtio-y converts mutations
              into Yjs operations.
            </div>
            <div>
              <strong className="text-slate-900">
                Sync happens automatically:
              </strong>{" "}
              Yjs CRDTs ensure changes merge correctly across all clients, even
              with conflicts.
            </div>
            <div>
              <strong className="text-slate-900">
                Complex structures work:
              </strong>{" "}
              Nested objects, arrays, and even recursive structures sync
              seamlessly.
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              💡 <strong>Real-time sync:</strong> Every open browser tab
              connects to the same PartyServer-backed Y.Doc. Open this example
              in a second window or device to watch todos update instantly, even
              with complex nested structures. Use the Connect button to simulate
              going offline—changes merge the moment you reconnect.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
