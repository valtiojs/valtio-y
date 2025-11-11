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
    <div className="w-full h-full flex items-center justify-center p-6">
      {/* Main content container */}
      <div className="w-full max-w-2xl">
        <ClientView stateProxy={proxy} />
      </div>
    </div>
  );
};

export default App;
