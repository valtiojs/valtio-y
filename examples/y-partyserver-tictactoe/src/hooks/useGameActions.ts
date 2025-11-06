/**
 * Custom hook for game actions
 */

import { useSnapshot } from "valtio";
import { proxy, clientId } from "../yjs-setup";
import { checkWinner, isBoardFull, getNextPlayer, createEmptyBoard } from "../game-logic";
import type { Player } from "../types";

export function useGameActions() {
  const state = useSnapshot(proxy);

  /**
   * Make a move on the board
   */
  const makeMove = (index: number) => {
    // Check if the game is already over
    if (proxy.winner) return;

    // Check if the cell is already occupied
    if (proxy.board[index]) return;

    // Get current player role
    const myRole = getMyRole();
    if (!myRole) return; // spectator can't play

    // Check if it's this player's turn
    if (proxy.currentPlayer !== myRole) return;

    // Make the move
    proxy.board[index] = myRole;

    // Check for winner
    const winResult = checkWinner(proxy.board);
    if (winResult) {
      proxy.winner = winResult.winner;
      proxy.winningLine = winResult.line;
      proxy.scores[winResult.winner]++;
      return;
    }

    // Check for draw
    if (isBoardFull(proxy.board)) {
      proxy.winner = "draw";
      proxy.scores.draws++;
      return;
    }

    // Switch to next player
    proxy.currentPlayer = getNextPlayer(proxy.currentPlayer);
  };

  /**
   * Reset the game board for a new game
   */
  const resetGame = () => {
    proxy.board = createEmptyBoard();
    proxy.currentPlayer = "X";
    proxy.winner = null;
    proxy.winningLine = null;
  };

  /**
   * Get the current client's role (X, O, or spectator)
   */
  const getMyRole = (): Player | "spectator" => {
    if (proxy.players.X === clientId) return "X";
    if (proxy.players.O === clientId) return "O";
    return "spectator";
  };

  /**
   * Assign player role when joining
   */
  const joinGame = () => {
    // If X is not taken, join as X
    if (!proxy.players.X) {
      proxy.players.X = clientId;
      return;
    }

    // If O is not taken, join as O
    if (!proxy.players.O) {
      proxy.players.O = clientId;
      return;
    }

    // Otherwise, add to spectators if not already there
    if (!proxy.spectators.includes(clientId)) {
      proxy.spectators.push(clientId);
    }
  };

  return {
    makeMove,
    resetGame,
    getMyRole,
    joinGame,
    state,
  };
}
