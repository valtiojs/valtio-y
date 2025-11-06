/**
 * Game logic utilities for Tic-Tac-Toe
 */

import type { Board, Player } from "./types";

/**
 * All possible winning combinations (row, column, diagonal)
 */
const WINNING_LINES = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left column
  [1, 4, 7], // middle column
  [2, 5, 8], // right column
  [0, 4, 8], // diagonal top-left to bottom-right
  [2, 4, 6], // diagonal top-right to bottom-left
];

/**
 * Check if there's a winner on the board
 * @returns The winning player and line, or null if no winner
 */
export function checkWinner(board: Board): { winner: Player; line: number[] } | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a] as Player, line };
    }
  }
  return null;
}

/**
 * Check if the board is full (draw condition)
 */
export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}

/**
 * Check if the game is over (winner or draw)
 */
export function isGameOver(board: Board): boolean {
  return checkWinner(board) !== null || isBoardFull(board);
}

/**
 * Get the next player
 */
export function getNextPlayer(currentPlayer: Player): Player {
  return currentPlayer === "X" ? "O" : "X";
}

/**
 * Create an empty board
 */
export function createEmptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}
