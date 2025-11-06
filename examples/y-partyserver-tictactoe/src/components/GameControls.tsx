/**
 * Game control buttons (reset, new game, etc.)
 */

import { useGameActions } from "../hooks/useGameActions";
import { RefreshCw } from "lucide-react";

export function GameControls() {
  const { resetGame, state } = useGameActions();

  return (
    <div className="flex gap-3 w-full max-w-md">
      <button
        onClick={resetGame}
        disabled={!state.winner}
        className={`
          flex-1 flex items-center justify-center gap-2
          px-6 py-3 rounded-lg font-semibold
          transition-all duration-200
          ${
            state.winner
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl active:scale-95"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }
        `}
      >
        <RefreshCw size={18} />
        {state.winner ? "Play Again" : "New Game"}
      </button>
    </div>
  );
}
