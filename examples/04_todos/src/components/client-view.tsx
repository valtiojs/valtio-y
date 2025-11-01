/**
 * ClientView Component
 * 
 * Represents a single client's view of the shared todo list.
 * 
 * Key features demonstrated:
 * - useSnapshot() to read reactive state from valtio-yjs
 * - Direct mutations to the proxy for all write operations
 * - Drag-and-drop reordering with array manipulation
 * - Bulk operations on multiple items
 * 
 * This component shows how valtio-yjs makes collaborative state
 * feel like local state - just read from snapshot, write to proxy!
 */

import { useState } from "react";
import { useSnapshot } from "valtio";
import { Plus, Circle, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { TodoItem as TodoItemType, AppState } from "../types";
import { countTodos, countCompletedTodos } from "../utils";
import { SyncStatus } from "./sync-status";
import { TodoItem } from "./todo-item";

interface ClientViewProps {
  /** Display name for this client */
  name: string;
  /** The valtio-yjs proxy to read from (via useSnapshot) and write to */
  stateProxy: AppState;
  /** Color scheme for visual distinction */
  colorScheme: "blue" | "purple";
  /** Client ID for sync status */
  clientId: 1 | 2;
}

export function ClientView({ name, stateProxy, colorScheme, clientId }: ClientViewProps) {
  /**
   * IMPORTANT: useSnapshot() gives us a reactive snapshot of the state.
   * This automatically re-renders when the underlying Yjs document changes,
   * whether from local edits or remote sync!
   */
  const snap = useSnapshot(stateProxy);

  const [newTodoText, setNewTodoText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Color scheme configuration
  const colors = {
    blue: {
      border: "border-blue-200",
      bg: "bg-blue-50",
      bgLight: "bg-blue-50/50",
      text: "text-blue-900",
      button: "bg-blue-600 hover:bg-blue-700",
      accent: "text-blue-600",
      ring: "focus:ring-blue-300",
      header: "bg-gradient-to-r from-blue-50 to-blue-100",
    },
    purple: {
      border: "border-purple-200",
      bg: "bg-purple-50",
      bgLight: "bg-purple-50/50",
      text: "text-purple-900",
      button: "bg-purple-600 hover:bg-purple-700",
      accent: "text-purple-600",
      ring: "focus:ring-purple-300",
      header: "bg-gradient-to-r from-purple-50 to-purple-100",
    },
  };

  const color = colors[colorScheme];

  // Setup drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Add a new todo to the root level.
   * Note the direct push() - valtio-yjs tracks this mutation!
   */
  function addTodo() {
    if (!newTodoText.trim()) return;

    const newTodo: TodoItemType = {
      id: `${Date.now()}-${Math.random()}`,
      text: newTodoText,
      completed: false,
      children: [],
    };

    // Direct mutation - automatically syncs to all clients!
    (stateProxy.todos).push(newTodo);
    setNewTodoText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      addTodo();
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  /**
   * Handle reordering of root-level todos.
   * Uses arrayMove and splice to reorder in place.
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const todos = stateProxy.todos;
      const oldIndex = todos.findIndex((t) => t.id === active.id);
      const newIndex = todos.findIndex((t) => t.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(todos, oldIndex, newIndex);
        // Splice to update in place - valtio-yjs tracks this!
        todos.splice(0, todos.length, ...newOrder);
      }
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  function toggleSelectionMode() {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedIds(new Set());
    }
  }

  /**
   * Recursively collect all todo IDs for "select all"
   */
  function selectAll() {
    const allIds = new Set<string>();
    function collectIds(todos: TodoItemType[] | unknown) {
      if (!Array.isArray(todos)) return;
      todos.forEach((todo) => {
        allIds.add(todo.id);
        if (todo.children) {
          collectIds(todo.children);
        }
      });
    }
    collectIds(snap.todos);
    setSelectedIds(allIds);
  }

  /**
   * Delete all selected todos (bulk operation).
   * Recursively filters the tree structure.
   */
  function deleteSelected() {
    if (selectedIds.size === 0) return;

    const todos = stateProxy.todos;
    function filterTodos(items: TodoItemType[]): TodoItemType[] {
      return items.filter((item) => {
        if (selectedIds.has(item.id)) return false;
        if (item.children) {
          item.children = filterTodos(item.children);
        }
        return true;
      });
    }

    const filtered = filterTodos([...todos]);
    todos.splice(0, todos.length, ...filtered);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }

  /**
   * Mark all selected todos as complete (bulk operation).
   * Recursively updates the tree structure.
   */
  function completeSelected() {
    if (selectedIds.size === 0) return;

    const todos = stateProxy.todos;
    function updateTodos(items: TodoItemType[]) {
      items.forEach((item) => {
        if (selectedIds.has(item.id)) {
          item.completed = true; // Direct mutation
        }
        if (item.children) {
          updateTodos(item.children);
        }
      });
    }

    updateTodos(todos);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }

  // Calculate statistics
  const totalTodos = countTodos(snap.todos);
  const completedTodos = countCompletedTodos(snap.todos);

  const activeTodo = activeId
    ? (snap.todos).find((t) => t.id === activeId)
    : null;

  return (
    <div
      className={`flex-1 min-w-[400px] border-2 ${color.border} rounded-lg overflow-hidden shadow-lg bg-white`}
    >
      {/* Header with sync status */}
      <div className={`${color.header} px-6 py-5 border-b-2 ${color.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-lg font-semibold ${color.text} tracking-tight`}>
              {name}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {completedTodos} of {totalTodos} tasks completed
            </p>
          </div>
          <SyncStatus clientId={clientId} />
        </div>
      </div>

      {/* Add new todo input */}
      <div className={`p-5 border-b border-slate-100 ${color.bgLight}`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a new task..."
            className={`flex-1 px-4 py-2.5 border-2 ${color.border} rounded-md focus:outline-none focus:ring-2 ${color.ring} focus:border-transparent text-sm placeholder:text-slate-400`}
            aria-label="New task input"
          />
          <button
            onClick={addTodo}
            className={`px-5 py-2.5 ${color.button} text-white rounded-md transition-colors flex items-center gap-2 font-medium text-sm`}
            aria-label="Add task"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      {/* Bulk actions toolbar (shown in selection mode) */}
      {selectionMode && (
        <div
          className={`p-4 ${color.bg} border-b ${color.border} flex items-center gap-3`}
        >
          <span className="text-sm font-medium text-slate-700">
            {selectedIds.size} selected
          </span>
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={completeSelected}
            disabled={selectedIds.size === 0}
            className={`px-3 py-1.5 text-xs ${color.button} text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Complete
          </button>
          <button
            onClick={deleteSelected}
            disabled={selectedIds.size === 0}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete
          </button>
          <button
            onClick={toggleSelectionMode}
            className="ml-auto px-3 py-1.5 text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Selection mode toggle */}
      {!selectionMode && totalTodos > 0 && (
        <div className="px-5 pt-3 pb-0">
          <button
            onClick={toggleSelectionMode}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            Enable selection mode
          </button>
        </div>
      )}

      {/* Todo list */}
      <div className="p-5 bg-white max-h-[600px] overflow-y-auto">
        {Array.isArray(snap.todos) && snap.todos.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={(snap.todos).map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {(snap.todos).map((todo, index) => (
                  <TodoItem
                    key={todo.id}
                    item={todo}
                    stateProxy={stateProxy}
                    path={[index]}
                    isSelected={selectedIds.has(todo.id)}
                    onToggleSelect={toggleSelect}
                    selectionMode={selectionMode}
                    nestLevel={0}
                    colorScheme={colorScheme}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeTodo ? (
                <div className="bg-white border-2 border-slate-300 rounded-lg p-3 shadow-xl">
                  <div className="flex items-center gap-3">
                    <GripVertical size={16} className="text-slate-400" />
                    <Circle size={20} className="text-slate-400" />
                    <span className="text-slate-700">{activeTodo.text}</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-base font-medium text-slate-600 mb-2">
              No tasks yet
            </p>
            <p className="text-sm text-slate-400 mb-4">
              Add your first task to get started
            </p>
            <div className="text-xs text-slate-400 space-y-1">
              <p>💡 Double-click to edit</p>
              <p>🔄 Drag to reorder</p>
              <p>➕ Click + to add subtasks</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
