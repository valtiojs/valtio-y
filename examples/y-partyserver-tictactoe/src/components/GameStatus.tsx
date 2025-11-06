/**
 * Component to display game status (turn, winner, etc.)
 */

import { useGameActions } from "../hooks/useGameActions";
import { Trophy, Users } from "lucide-react";

export function GameStatus() {
  const { state, getMyRole } = useGameActions();
  const myRole = getMyRole();

  const getStatusMessage = () => {
    if (state.winner === "draw") {
      return "It's a draw!";
    }
    if (state.winner) {
      return `${state.winner} wins!`;
    }
    const isMyTurn = state.currentPlayer === myRole;
    if (myRole === "spectator") {
      return `${state.currentPlayer}'s turn`;
    }
    return isMyTurn ? "Your turn" : `${state.currentPlayer}'s turn`;
  };

  const getStatusColor = () => {
    if (state.winner === "draw") return "text-yellow-400";
    if (state.winner) return "text-green-400";
    if (state.currentPlayer === myRole && myRole !== "spectator") {
      return "text-blue-400";
    }
    return "text-gray-400";
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      {/* Status message */}
      <div
        className={`text-3xl font-bold ${getStatusColor()} transition-colors duration-300`}
      >
        {getStatusMessage()}
      </div>

      {/* Player info */}
      <div className="flex items-center gap-4 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <Users size={16} />
          <span>
            You are:{" "}
            <span className={myRole === "spectator" ? "text-gray-500" : "text-white"}>
              {myRole === "spectator" ? "Spectator" : myRole}
            </span>
          </span>
        </div>
      </div>

      {/* Score board */}
      <div className="flex gap-6 text-lg bg-gray-800 px-6 py-3 rounded-lg">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-blue-400" />
          <span className="text-blue-400 font-bold">X:</span>
          <span className="text-white font-bold">{state.scores.X}</span>
        </div>
        <div className="text-gray-600">|</div>
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-pink-400" />
          <span className="text-pink-400 font-bold">O:</span>
          <span className="text-white font-bold">{state.scores.O}</span>
        </div>
        <div className="text-gray-600">|</div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 font-bold">Draws:</span>
          <span className="text-white font-bold">{state.scores.draws}</span>
        </div>
      </div>
    </div>
  );
}
