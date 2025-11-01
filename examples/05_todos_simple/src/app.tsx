/**
 * Simple Collaborative Todo List
 * 
 * This example demonstrates the core features of valtio-yjs in a single file:
 * 
 * 1. **Simple State Management**: Just mutate the proxy like regular objects
 * 2. **Real-time Sync**: Changes automatically sync between clients
 * 3. **CRUD Operations**: Create, read, update, delete todos
 * 4. **Nested Todos**: One level of subtasks to show nested structures
 * 5. **Reordering**: Move todos up/down with buttons
 */

import { useSnapshot } from 'valtio';
import * as Y from 'yjs';
import { createYjsProxy } from 'valtio-yjs';
import { useState, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
  children?: TodoItem[];
};

type AppState = {
  todos: TodoItem[];
};

// ============================================================================
// YJS SETUP WITH OFFLINE/ONLINE SUPPORT
// ============================================================================

/**
 * THE "GLUE" THAT MAKES OFFLINE SYNC WORK: Yjs CRDTs
 * 
 * When both clients are offline and make changes independently, how do they
 * sync when coming back online? The answer is Yjs's CRDT (Conflict-free 
 * Replicated Data Type) algorithm:
 * 
 * 1. **Logical Clocks**: Each change gets a unique timestamp (version vector)
 *    that doesn't depend on wall-clock time. This creates a partial ordering
 *    of all changes across all clients.
 * 
 * 2. **Causality Tracking**: Updates contain information about what other 
 *    updates they depend on, ensuring changes are understood in context.
 * 
 * 3. **Commutative Operations**: Updates can be applied in ANY order and will
 *    converge to the same final state. If Client 1 applies [updateA, updateB]
 *    and Client 2 applies [updateB, updateA], both end up identical.
 * 
 * 4. **Deterministic Conflict Resolution**: When both clients edit the same
 *    thing (e.g., same text), Yjs uses consistent rules (client ID as 
 *    tiebreaker) so both clients resolve conflicts identically.
 * 
 * This is why we can queue updates while offline and simply call Y.applyUpdate()
 * when coming back online - Yjs handles all the complexity!
 */

// Create two Y.Docs to simulate two clients
const doc1 = new Y.Doc();
const doc2 = new Y.Doc();

// Set up automatic syncing between documents (simulates network)
const RELAY_ORIGIN = Symbol('relay');

// Track online/offline status for each client
let client1Online = true;
let client2Online = true;

// Queue updates when offline - these are binary Yjs update messages
// Each update contains the change + causality information for CRDT merging
const client1Queue: Uint8Array[] = [];
const client2Queue: Uint8Array[] = [];

// Listeners for status changes
const statusListeners = new Set<() => void>();

function notifyStatusChange() {
  statusListeners.forEach(listener => listener());
}

export function toggleClient1Online() {
  client1Online = !client1Online;
  if (client1Online) {
    // CLIENT 1 COMES BACK ONLINE
    // Flush queued updates to Client 2
    // The "glue" that makes this work: Yjs CRDTs ensure these updates
    // merge correctly with any changes Client 2 made, even if Client 2
    // was also offline. Y.applyUpdate uses logical clocks and causality
    // tracking to guarantee convergence.
    client1Queue.forEach(update => {
      setTimeout(() => {
        doc2.transact(() => Y.applyUpdate(doc2, update), RELAY_ORIGIN);
      }, 50);
    });
    client1Queue.length = 0;
    
    // If Client 2 is also online and has queued updates, sync them too
    // This handles the case where both were offline and come back online
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
    // CLIENT 2 COMES BACK ONLINE
    // Flush queued updates to Client 1
    client2Queue.forEach(update => {
      setTimeout(() => {
        doc1.transact(() => Y.applyUpdate(doc1, update), RELAY_ORIGIN);
      }, 50);
    });
    client2Queue.length = 0;
    
    // If Client 1 is also online and has queued updates, sync them too
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
    // Online: sync immediately
    setTimeout(() => {
      doc2.transact(() => Y.applyUpdate(doc2, update), RELAY_ORIGIN);
    }, 50);
  } else {
    // Offline: queue the update
    client1Queue.push(update);
  }
});

doc2.on('update', (update: Uint8Array, origin: unknown) => {
  if (origin === RELAY_ORIGIN) return;
  
  if (client2Online) {
    // Online: sync immediately
    setTimeout(() => {
      doc1.transact(() => Y.applyUpdate(doc1, update), RELAY_ORIGIN);
    }, 50);
  } else {
    // Offline: queue the update
    client2Queue.push(update);
  }
});

// Create valtio-yjs proxies
const { proxy: proxy1 } = createYjsProxy<AppState>(doc1, {
  getRoot: (doc) => doc.getMap('sharedState'),
});

const { proxy: proxy2 } = createYjsProxy<AppState>(doc2, {
  getRoot: (doc) => doc.getMap('sharedState'),
});

// Initialize with sample data
if (!proxy1.todos) {
  proxy1.todos = [
    {
      id: '1',
      text: 'Welcome to Simple Todos!',
      completed: false,
      children: [
        { id: '1-1', text: 'Try editing this subtask', completed: false },
        { id: '1-2', text: 'Try marking this complete', completed: false },
      ],
    },
    {
      id: '2',
      text: 'Add a new todo below',
      completed: false,
    },
  ];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================================================
// TODO ITEM COMPONENT
// ============================================================================

type TodoItemProps = {
  todo: TodoItem;
  todos: TodoItem[];
  index: number;
  isSubtask?: boolean;
};

function TodoItemComponent({ todo, todos, index, isSubtask = false }: TodoItemProps) {
  // Use snapshot to track changes and trigger re-renders
  const snap = useSnapshot(todo);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  const handleToggle = () => {
    todo.completed = !todo.completed;
  };

  const handleDelete = () => {
    todos.splice(index, 1);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditText(snap.text);
  };

  const handleSave = () => {
    if (editText.trim()) {
      todo.text = editText.trim();
    }
    setIsEditing(false);
  };

  const handleMoveUp = () => {
    if (index > 0) {
      const [item] = todos.splice(index, 1);
      if (item) todos.splice(index - 1, 0, item);
    }
  };

  const handleMoveDown = () => {
    if (index < todos.length - 1) {
      const [item] = todos.splice(index, 1);
      if (item) todos.splice(index + 1, 0, item);
    }
  };

  const handleAddSubtask = () => {
    if (!todo.children) {
      todo.children = [];
    }
    todo.children.push({
      id: generateId(),
      text: 'New subtask',
      completed: false,
    });
  };

  return (
    <div className={`rounded-lg p-3 mb-2 ${isSubtask ? 'ml-8 bg-slate-50 border border-slate-200' : 'bg-white border border-slate-300 shadow-sm'}`}>
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={snap.completed}
          onChange={handleToggle}
          className="mt-1 w-4 h-4 text-blue-600 rounded cursor-pointer"
        />

        {/* Text or Input */}
        <div className="flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              className="w-full px-2 py-1 border rounded"
              autoFocus
            />
          ) : (
            <span
              className={`${snap.completed ? 'line-through text-slate-400' : 'text-slate-900'} cursor-pointer`}
              onDoubleClick={handleEdit}
            >
              {snap.text}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1">
          {!isSubtask && (
            <button
              onClick={handleAddSubtask}
              className="px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded"
              title="Add subtask"
            >
              + Sub
            </button>
          )}
          <button
            onClick={handleEdit}
            className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
          >
            Edit
          </button>
          <button
            onClick={handleMoveUp}
            disabled={index === 0}
            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded disabled:opacity-30"
            title="Move up"
          >
            ↑
          </button>
          <button
            onClick={handleMoveDown}
            disabled={index === todos.length - 1}
            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded disabled:opacity-30"
            title="Move down"
          >
            ↓
          </button>
          <button
            onClick={handleDelete}
            className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Subtasks */}
      {snap.children && snap.children.length > 0 && todo.children && (
        <div className="mt-2">
          {snap.children.map((child, childIndex) => {
            const childProxy = todo.children![childIndex];
            if (!childProxy) return null;
            return (
              <TodoItemComponent
                key={child.id}
                todo={childProxy}
                todos={todo.children!}
                index={childIndex}
                isSubtask={true}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const [newTodoText, setNewTodoText] = useState('');
  const [isOnline, setIsOnline] = useState(clientId === 1 ? getClient1Online() : getClient2Online());
  
  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = subscribeToStatus(() => {
      setIsOnline(clientId === 1 ? getClient1Online() : getClient2Online());
    });
    return unsubscribe;
  }, [clientId]);
  
  const handleToggleOnline = () => {
    if (clientId === 1) {
      toggleClient1Online();
    } else {
      toggleClient2Online();
    }
  };

  const handleAddTodo = () => {
    if (newTodoText.trim()) {
      if (!stateProxy.todos) {
        stateProxy.todos = [];
      }
      stateProxy.todos.push({
        id: generateId(),
        text: newTodoText.trim(),
        completed: false,
      });
      setNewTodoText('');
    }
  };

  const handleClearCompleted = () => {
    if (!stateProxy.todos) return;
    
    // Clear completed subtasks
    stateProxy.todos.forEach((todo) => {
      if (todo.children) {
        todo.children = todo.children.filter((child) => !child.completed);
      }
    });
    
    // Clear completed top-level todos
    stateProxy.todos = stateProxy.todos.filter((todo) => !todo.completed);
  };

  const todoCount = snap.todos?.length || 0;
  const completedCount = snap.todos?.filter((t) => t.completed).length || 0;

  return (
    <div className={`flex-1 rounded-xl shadow-lg border-2 p-6 transition-all ${
      isOnline 
        ? 'bg-white border-slate-200' 
        : 'bg-slate-100 border-orange-300'
    }`}>
      {/* Header */}
      <div className="mb-6">
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
        <h2 className="text-2xl font-bold text-slate-900 mb-2">My Todos</h2>
        <p className="text-sm text-slate-600">
          {todoCount} total · {completedCount} completed
          {!isOnline && ' · Working offline'}
        </p>
      </div>

      {/* Add Todo Form */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
            placeholder="What needs to be done?"
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddTodo}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      {/* Todo List */}
      <div className="mb-4">
        {snap.todos && snap.todos.length > 0 ? (
          snap.todos.map((todo, index) => {
            const todoProxy = stateProxy.todos[index];
            if (!todoProxy) return null;
            return (
              <TodoItemComponent
                key={todo.id}
                todo={todoProxy}
                todos={stateProxy.todos}
                index={index}
              />
            );
          })
        ) : (
          <p className="text-slate-400 text-center py-8">No todos yet. Add one above!</p>
        )}
      </div>

      {/* Clear Completed Button */}
      {completedCount > 0 && (
        <button
          onClick={handleClearCompleted}
          className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
        >
          Clear {completedCount} Completed
        </button>
      )}
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
            Simple Collaborative Todos
          </h1>
          <p className="text-slate-600 mb-2">
            Powered by <strong>valtio-yjs</strong> · Two clients syncing in real-time
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-500">
            <span>✏️ Double-click to edit</span>
            <span>↕️ Use arrows to reorder</span>
            <span>➕ Add subtasks (one level deep)</span>
            <span>⚡ Changes sync instantly</span>
            <span>🔴 Toggle offline/online to test sync</span>
          </div>
        </div>

        {/* Two Clients Side by Side */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <ClientView name="Client 1" stateProxy={proxy1} color="blue" clientId={1} />
          <ClientView name="Client 2" stateProxy={proxy2} color="purple" clientId={2} />
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            How valtio-yjs Works
          </h3>
          <div className="space-y-2 text-sm text-slate-600 mb-4">
            <p>
              <strong className="text-slate-900">Read:</strong> Use <code className="bg-slate-100 px-1 py-0.5 rounded">useSnapshot()</code> to get reactive state that triggers re-renders.
            </p>
            <p>
              <strong className="text-slate-900">Write:</strong> Mutate the proxy directly like a normal object. valtio-yjs converts it to Yjs operations.
            </p>
            <p>
              <strong className="text-slate-900">Sync:</strong> Yjs CRDTs ensure changes merge correctly across all clients, even with conflicts.
            </p>
            <p>
              <strong className="text-slate-900">Offline Support:</strong> Changes made while offline are queued and automatically sync when reconnected.
            </p>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">The "Glue": How CRDT Sync Works</h4>
            <p className="text-xs text-slate-600 mb-2">
              When <strong>both clients are offline</strong> and make changes, how do they sync when coming back online?
            </p>
            <ol className="text-xs text-slate-600 space-y-1 ml-4 list-decimal">
              <li><strong>Logical timestamps</strong> track causality without relying on system clocks</li>
              <li><strong>Updates are commutative</strong> - they can be applied in any order</li>
              <li><strong>Deterministic conflict resolution</strong> ensures all clients converge to the same state</li>
              <li><strong>Y.applyUpdate()</strong> merges changes automatically using this CRDT magic ✨</li>
            </ol>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
            💡 <strong>Try this:</strong> Make <em>both</em> clients offline, add different todos to each, edit the same todo in both, then bring them back online one by one. Watch how Yjs merges everything correctly!
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
