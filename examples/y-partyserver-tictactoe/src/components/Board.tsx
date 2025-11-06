/**
 * Tic-Tac-Toe board component
 */

import { useGameActions } from "../hooks/useGameActions";
import { Cell } from "./Cell";

export function Board() {
  const { makeMove, state } = useGameActions();

  return (
    <div className="grid grid-cols-3 gap-2 bg-gray-800 p-2 rounded-lg shadow-2xl w-full max-w-md aspect-square">
      {state.board.map((value, index) => (
        <Cell
          key={index}
          value={value}
          index={index}
          onClick={() => makeMove(index)}
          isWinningCell={state.winningLine?.includes(index)}
        />
      ))}
    </div>
  );
}
