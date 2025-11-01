/**
 * TodoItem Component
 * 
 * A single todo item with support for:
 * - Nested children (recursive rendering)
 * - Drag-and-drop reordering
 * - Inline editing
 * - Completion toggling
 * - Adding subtasks
 * - Deletion
 * 
 * Key learning points:
 * - Direct mutations to the proxy automatically sync via valtio-yjs
 * - Array operations (push, splice) work seamlessly
 * - Deeply nested updates propagate correctly
 */

import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  GripVertical,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TodoItem as TodoItemType, AppState } from "../types";
import { getItemByPath, getContainingArray } from "../utils";

interface TodoItemProps {
  /** The todo item data from the snapshot */
  item: TodoItemType;
  /** The mutable valtio-yjs proxy for making changes */
  stateProxy: AppState;
  /** Path to this item in the tree (array of indices) */
  path: number[];
  /** Whether this item is selected (for bulk operations) */
  isSelected: boolean;
  /** Callback to toggle selection */
  onToggleSelect: (id: string) => void;
  /** Whether we're in selection mode */
  selectionMode: boolean;
  /** Nesting depth for visual styling */
  nestLevel: number;
  /** Color scheme for the client */
  colorScheme: "blue" | "purple";
}

export function TodoItem({
  item,
  stateProxy,
  path,
  isSelected,
  onToggleSelect,
  selectionMode,
  nestLevel,
  colorScheme,
}: TodoItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = item.children && item.children.length > 0;

  // Setup drag-and-drop for nested children
  const childSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Setup sortable for this item
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  /**
   * Toggle completion status.
   * Note: We mutate the proxy directly - valtio-yjs handles the sync!
   */
  function toggleComplete() {
    const target = getItemByPath(stateProxy.todos, path);
    if (target) {
      target.completed = !target.completed; // Direct mutation syncs automatically
    }
  }

  /**
   * Start editing the todo text
   */
  function handleEditStart() {
    if (!selectionMode) {
      setIsEditing(true);
      setEditText(item.text);
    }
  }

  /**
   * Save the edited text
   */
  function handleEditSave() {
    const target = getItemByPath(stateProxy.todos, path);
    if (target && editText.trim()) {
      target.text = editText; // Direct mutation
    }
    setIsEditing(false);
  }

  function handleEditCancel() {
    setEditText(item.text);
    setIsEditing(false);
  }

  /**
   * Add a new subtask to this todo.
   * Demonstrates array mutation with nested structures.
   */
  function addSubtask() {
    const target = getItemByPath(stateProxy.todos, path);
    if (target) {
      // Initialize children array if needed
      if (!Array.isArray(target.children)) {
        target.children = [];
      }
      const newId = `${item.id}-${Date.now()}`;
      // Push directly - valtio-yjs tracks this!
      (target.children).push({
        id: newId,
        text: "New subtask",
        completed: false,
        children: [],
      });
      setIsExpanded(true);
    }
  }

  /**
   * Delete this todo from its parent array
   */
  function deleteTodo() {
    const arr = getContainingArray(stateProxy.todos, path);
    const index = path[path.length - 1];
    if (arr && index !== undefined) {
      arr.splice(index, 1); // Splice syncs automatically
    }
  }

  /**
   * Handle reordering of child todos via drag-and-drop
   */
  function handleChildDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const target = getItemByPath(stateProxy.todos, path);
      if (target && target.children) {
        const children = target.children;
        const oldIndex = children.findIndex((c) => c.id === active.id);
        const newIndex = children.findIndex((c) => c.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          // Reorder and update the array
          const newOrder = arrayMove(children, oldIndex, newIndex);
          children.splice(0, children.length, ...newOrder);
        }
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (isEditing) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleEditSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleEditCancel();
      }
    }
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Visual styling based on nesting
  const bgColors = ["bg-white", "bg-slate-50/50", "bg-slate-100/50", "bg-slate-150/50"];
  const bgColor = bgColors[Math.min(nestLevel, bgColors.length - 1)];

  const accentColors = {
    blue: "text-blue-600",
    purple: "text-purple-600",
  };
  const accentColor = accentColors[colorScheme];

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`group ${bgColor} ${
          isSelected ? "ring-2 ring-blue-500 ring-inset" : ""
        }`}
      >
        <div className="flex items-start gap-2 py-2.5 px-3 rounded-md hover:bg-slate-50/50 transition-all duration-150">
          {/* Drag handle */}
          {!selectionMode && (
            <button
              {...attributes}
              {...listeners}
              className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing transition-colors"
              aria-label="Drag to reorder"
            >
              <GripVertical size={16} />
            </button>
          )}

          {/* Selection checkbox */}
          {selectionMode && (
            <button
              onClick={() => onToggleSelect(item.id)}
              className="mt-0.5 flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
              aria-label={isSelected ? "Deselect task" : "Select task"}
            >
              {isSelected ? (
                <CheckSquare size={20} className={accentColor} />
              ) : (
                <Square size={20} />
              )}
            </button>
          )}

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`mt-0.5 flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors ${
              hasChildren ? "visible" : "invisible"
            }`}
            aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Complete checkbox */}
          <button
            onClick={toggleComplete}
            className="mt-0.5 flex-shrink-0 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label={item.completed ? "Mark as incomplete" : "Mark as complete"}
          >
            {item.completed ? (
              <CheckCircle2 size={20} className={accentColor} />
            ) : (
              <Circle size={20} />
            )}
          </button>

          {/* Todo text (editable on double-click) */}
          {isEditing ? (
            <div className="flex-1 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleEditSave}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm"
                aria-label="Edit task text"
              />
            </div>
          ) : (
            <div
              onDoubleClick={handleEditStart}
              className={`flex-1 cursor-pointer leading-relaxed ${
                item.completed ? "text-slate-400 line-through" : "text-slate-700"
              }`}
              role="button"
              tabIndex={0}
              aria-label={`Task: ${item.text}. Double-click to edit`}
            >
              {item.text}
            </div>
          )}

          {/* Action buttons */}
          {!selectionMode && (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={addSubtask}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                aria-label="Add subtask"
                title="Add subtask"
              >
                <Plus size={15} />
              </button>
              <button
                onClick={deleteTodo}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                aria-label="Delete task"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Recursive children rendering */}
        {hasChildren && isExpanded && (
          <div className="ml-8 border-l-2 border-slate-200 pl-3">
            <DndContext
              sensors={childSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleChildDragEnd}
            >
              <SortableContext
                items={item.children!.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {item.children!.map((child, index) => (
                  <TodoItem
                    key={child.id}
                    item={child}
                    stateProxy={stateProxy}
                    path={[...path, index]}
                    isSelected={isSelected}
                    onToggleSelect={onToggleSelect}
                    selectionMode={selectionMode}
                    nestLevel={nestLevel + 1}
                    colorScheme={colorScheme}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}
