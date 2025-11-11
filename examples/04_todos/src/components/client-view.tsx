/**
 * ClientView Component
 *
 * Represents a single client's view of the shared todo list.
 *
 * Key features demonstrated:
 * - useSnapshot() to read reactive state from valtio-y
 * - Direct mutations to the proxy for all write operations
 * - Drag-and-drop reordering with array manipulation
 * - Bulk operations on multiple items
 *
 * This component shows how valtio-y makes collaborative state
 * feel like local state - just read from snapshot, write to proxy!
 */

import { useState } from "react";
import { useSnapshot } from "valtio";
import { Plus, Circle } from "lucide-react";
import { AnimatePresence, Reorder } from "motion/react";
import type {
  TodoItem as TodoItemType,
  AppState,
  SyncStatus as SyncStatusType,
} from "../types";
import { countTodos, countCompletedTodos } from "../utils";
import { SyncStatus } from "./sync-status";
import { TodoItem } from "./todo-item";

interface ClientViewProps {
  /** The valtio-y proxy to read from (via useSnapshot) and write to */
  stateProxy: AppState;
  /** Current sync status */
  syncStatus: SyncStatusType;
}

export function ClientView({ stateProxy, syncStatus }: ClientViewProps) {
  const snap = useSnapshot(stateProxy);

  const [newTodoText, setNewTodoText] = useState("");

  /**
   * Add a new todo to the root level.
   * Note the direct push() - valtio-y tracks this mutation!
   */
  function addTodo() {
    if (!newTodoText.trim()) return;

    // Initialize todos array if it doesn't exist
    if (!stateProxy.todos) {
      stateProxy.todos = [];
    }

    const newTodo: TodoItemType = {
      id: `${Date.now()}-${Math.random()}`,
      text: newTodoText,
      completed: false,
      children: [],
    };

    // Direct mutation - automatically syncs to all clients!
    stateProxy.todos.push(newTodo);
    setNewTodoText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      addTodo();
    }
  }

  /**
   * Handle reordering of root-level todos.
   * Motion's Reorder component calls this with the new order directly.
   */
  function handleReorder(newOrder: readonly TodoItemType[]) {
    // Map the reordered snapshots back to the actual proxy items
    const idToTodo = new Map(stateProxy.todos.map((todo) => [todo.id, todo]));
    const reordered = newOrder
      .map((todo) => idToTodo.get(todo.id))
      .filter((todo): todo is TodoItemType => Boolean(todo));

    if (reordered.length === stateProxy.todos.length) {
      // Replace the entire array - valtio-y tracks this!
      stateProxy.todos = reordered;
    }
  }

  // Calculate statistics
  const totalTodos = countTodos(snap.todos);
  const completedTodos = countCompletedTodos(snap.todos);

  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl bg-white/95 backdrop-blur-md border border-gray-200/50">
      {/* Header with sync status */}
      <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 px-6 py-6 border-b border-gray-200/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Collaborative Todos ✨
            </h2>
            <p className="text-sm text-slate-600 mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Circle size={14} className="fill-green-500 text-green-500" />
                {completedTodos} of {totalTodos} tasks completed
              </span>
            </p>
          </div>
          <SyncStatus status={syncStatus} />
        </div>
      </div>

      {/* Add new todo input */}
      <div className="p-6 bg-gradient-to-br from-slate-50/50 to-white border-b border-slate-100">
        <div className="flex gap-3">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm placeholder:text-slate-400 bg-white shadow-sm transition-all"
            aria-label="New task input"
          />
          <button
            onClick={addTodo}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all flex items-center gap-2 font-medium text-sm shadow-sm hover:shadow-md active:scale-95"
            aria-label="Add task"
          >
            <Plus size={18} strokeWidth={2.5} />
            Add
          </button>
        </div>
      </div>

      {/* Todo list */}
      <div className="p-6 bg-gradient-to-b from-white to-slate-50/30 max-h-[600px] overflow-y-auto">
        {Array.isArray(snap.todos) && snap.todos.length > 0 ? (
          <Reorder.Group
            axis="y"
            values={snap.todos}
            onReorder={handleReorder}
            className="space-y-1 list-none"
          >
            <AnimatePresence initial={false}>
              {snap.todos.map((todo, index) => (
                <TodoItem
                  key={todo.id}
                  item={todo}
                  stateProxy={stateProxy}
                  path={[index]}
                  isSelected={false}
                  onToggleSelect={() => {}}
                  selectionMode={false}
                  nestLevel={0}
                  colorScheme="blue"
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        ) : (
          <div className="text-center py-20">
            <div className="text-7xl mb-5">✨</div>
            <p className="text-lg font-semibold text-slate-700 mb-2">
              No tasks yet
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Add your first task to get started
            </p>
            <div className="inline-flex flex-col gap-2 text-xs text-slate-400 bg-slate-50/50 px-6 py-4 rounded-xl border border-slate-200/50">
              <p className="flex items-center gap-2">💡 Double-click to edit</p>
              <p className="flex items-center gap-2">🔄 Drag to reorder</p>
              <p className="flex items-center gap-2">
                ➕ Click + to add subtasks
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
