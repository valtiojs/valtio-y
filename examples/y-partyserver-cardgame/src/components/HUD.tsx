import { Player } from "../y/selectors";

interface HUDProps {
  phase: string;
  winner: Player | null;
  isHost: boolean;
  onStart: () => void;
  onReset: () => void;
  roomId: string;
}

export function HUD({
  phase,
  winner,
  isHost,
  onStart,
  onReset,
  roomId,
}: HUDProps) {
  return (
    <>
      {/* Room Info */}
      <div className="fixed top-4 left-4 bg-gray-800/90 backdrop-blur-lg px-4 py-2 rounded-lg border border-gray-700 shadow-lg">
        <div className="text-white text-sm">
          <span className="text-gray-400">Room:</span>{" "}
          <span className="font-mono font-bold">{roomId}</span>
        </div>
      </div>

      {/* Host Controls */}
      {isHost && phase === "lobby" && (
        <div className="fixed top-4 right-4 bg-yellow-500/90 backdrop-blur-lg px-6 py-3 rounded-lg shadow-lg">
          <button
            onClick={onStart}
            className="font-bold text-black hover:text-gray-800 transition-colors"
          >
            ▶️ Start Game
          </button>
        </div>
      )}

      {isHost && phase === "finished" && (
        <div className="fixed top-4 right-4 bg-blue-500/90 backdrop-blur-lg px-6 py-3 rounded-lg shadow-lg">
          <button
            onClick={onReset}
            className="font-bold text-white hover:text-gray-200 transition-colors"
          >
            🔄 New Game
          </button>
        </div>
      )}

      {/* Winner Banner */}
      {winner && phase === "finished" && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-12 shadow-2xl border-4 border-white transform scale-100 animate-bounce">
            <div className="text-center">
              <div className="text-8xl mb-4">🎉</div>
              <div className="text-4xl font-bold text-white mb-2">
                {winner.name} Wins!
              </div>
              <div className="text-xl text-white/80">
                Congratulations! 🏆
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
