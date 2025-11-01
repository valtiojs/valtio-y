/**
 * Type definitions for the collaborative todo application
 */

/**
 * A todo item that can have nested children, forming a tree structure.
 * This showcases how valtio-yjs handles deeply nested data structures.
 */
export type TodoItem = {
  /** Unique identifier for the todo */
  id: string;
  /** The todo's text content */
  text: string;
  /** Whether the todo is marked as complete */
  completed: boolean;
  /** Optional nested subtasks - demonstrates recursive data structures */
  children?: TodoItem[];
};

/**
 * The root application state structure.
 * valtio-yjs will synchronize this entire structure across clients.
 */
export type AppState = {
  todos: TodoItem[];
};

/**
 * Sync status for visual feedback to users
 */
export type SyncStatus = "connected" | "syncing" | "offline";

