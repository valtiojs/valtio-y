/**
 * Utility functions for working with nested todo items
 * 
 * These helpers demonstrate how to navigate and manipulate deeply nested
 * data structures that are synchronized with valtio-yjs.
 */

import type { TodoItem } from "./types";

/**
 * Get a todo item by its path in the tree.
 * 
 * A path is an array of indices: [0, 1, 2] means:
 * - todos[0] -> first root todo
 * - todos[0].children[1] -> second child of first todo
 * - todos[0].children[1].children[2] -> third child of that child
 * 
 * This is useful for finding deeply nested items to modify them.
 * 
 * @example
 * const item = getItemByPath(todos, [0, 1]); // Get first todo's second child
 * if (item) {
 *   item.completed = true; // This mutation will sync through valtio-yjs!
 * }
 */
export function getItemByPath(
  todos: TodoItem[],
  path: number[]
): TodoItem | null {
  if (path.length === 0 || path[0] === undefined) return null;

  let current: TodoItem | undefined = todos[path[0]];

  for (let i = 1; i < path.length; i++) {
    if (!current || !Array.isArray(current.children)) return null;
    const index = path[i];
    if (index === undefined) return null;
    current = current.children[index];
  }

  return current ?? null;
}

/**
 * Get the array that contains the item at the given path.
 * 
 * This is useful when you need to remove an item or reorder items.
 * Returns the parent's children array, or the root todos array.
 * 
 * @example
 * const arr = getContainingArray(todos, [0, 1]);
 * // arr is now todos[0].children
 * arr.splice(1, 1); // Remove the item - syncs through valtio-yjs!
 */
export function getContainingArray(
  todos: TodoItem[],
  path: number[]
): TodoItem[] | null {
  if (path.length === 0) return null;
  if (path.length === 1) return todos;

  const parentPath = path.slice(0, -1);
  const parent = getItemByPath(todos, parentPath);
  return parent?.children ?? null;
}

/**
 * Count total number of todos recursively.
 * Includes all nested subtasks.
 */
export function countTodos(todos: TodoItem[] | unknown): number {
  if (!Array.isArray(todos)) return 0;

  let count = 0;
  for (const todo of todos) {
    count++; // Count this todo
    if (todo.children && todo.children.length > 0) {
      count += countTodos(todo.children); // Count all children recursively
    }
  }
  return count;
}

/**
 * Count completed todos recursively.
 * Includes all nested subtasks that are marked complete.
 */
export function countCompletedTodos(todos: TodoItem[] | unknown): number {
  if (!Array.isArray(todos)) return 0;

  let count = 0;
  for (const todo of todos) {
    if (todo.completed) count++;
    if (todo.children && todo.children.length > 0) {
      count += countCompletedTodos(todo.children);
    }
  }
  return count;
}

