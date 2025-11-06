/**
 * Type definitions for the Tic-Tac-Toe game
 */

export type Player = "X" | "O";
export type CellValue = Player | null;
export type Board = [
  CellValue, CellValue, CellValue,
  CellValue, CellValue, CellValue,
  CellValue, CellValue, CellValue
];

export interface Scores {
  X: number;
  O: number;
  draws: number;
}

export interface Players {
  X: string | null;
  O: string | null;
}

export interface GameState {
  board: Board;
  currentPlayer: Player;
  winner: Player | "draw" | null;
  winningLine: number[] | null;
  scores: Scores;
  players: Players;
  spectators: string[];
}

export type SyncStatus = "connecting" | "connected" | "syncing" | "disconnected";
