/**
 * Collaborative Todo List - Main Application
 * 
 * This example demonstrates the key features of valtio-yjs:
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

import { proxy1, proxy2 } from "./yjs-setup";
import { ClientView } from "./components/client-view";

/**
 * Main App Component
 * 
 * Renders two side-by-side clients to demonstrate real-time collaboration.
 * Each client has its own Y.Doc and proxy, but they sync through a simulated network.
 * 
 * Try it:
 * - Add a todo in Client 1, watch it appear in Client 2
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
            Powered by <strong>valtio-yjs</strong> · Real-time synchronization
            between clients
          </p>
          <p className="text-sm text-slate-500 max-w-2xl mx-auto mb-4">
            This example showcases how valtio-yjs handles complex state including
            nested arrays, drag-and-drop reordering, and bulk operations. All
            changes sync automatically through Yjs CRDTs.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <span>💡 Double-click to edit</span>
            <span>🔄 Drag to reorder</span>
            <span>➕ Click + to add subtasks</span>
            <span>✅ Enable selection for bulk actions</span>
            <span>⚡ Changes sync instantly</span>
          </div>
        </div>

        {/* Two clients side by side - demonstrates collaboration */}
        <div className="flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
          <ClientView
            name="Client 1"
            stateProxy={proxy1}
            colorScheme="blue"
            clientId={1}
          />
          <ClientView
            name="Client 2"
            stateProxy={proxy2}
            colorScheme="purple"
            clientId={2}
          />
        </div>

        {/* Educational footer */}
        <div className="mt-12 max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">
            How valtio-yjs Works
          </h3>
          <div className="space-y-3 text-sm text-slate-600">
            <div>
              <strong className="text-slate-900">Read with useSnapshot():</strong>{" "}
              Get a reactive snapshot of the state that triggers re-renders when it changes.
            </div>
            <div>
              <strong className="text-slate-900">Write with direct mutations:</strong>{" "}
              Modify the proxy like a normal object. valtio-yjs converts mutations into Yjs operations.
            </div>
            <div>
              <strong className="text-slate-900">Sync happens automatically:</strong>{" "}
              Yjs CRDTs ensure changes merge correctly across all clients, even with conflicts.
            </div>
            <div>
              <strong className="text-slate-900">Complex structures work:</strong>{" "}
              Nested objects, arrays, and even recursive structures sync seamlessly.
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              💡 <strong>Tip:</strong> In a real application, replace the simulated network
              relay in <code className="bg-slate-100 px-1.5 py-0.5 rounded">yjsSetup.ts</code> with
              a provider like <code className="bg-slate-100 px-1.5 py-0.5 rounded">y-websocket</code> or{" "}
              <code className="bg-slate-100 px-1.5 py-0.5 rounded">y-webrtc</code> for real
              network synchronization.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

