import { useState, useEffect } from "react";
import { useYDoc } from "../y/useYDoc";
import { getPlayers, getPhase } from "../y/selectors";

export function Lobby({ onJoin }: { onJoin: (name: string, spectator: boolean) => void }) {
  const { doc } = useYDoc();
  const [name, setName] = useState("");
  const [spectator, setSpectator] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  const [phase, setPhase] = useState<string>("lobby");

  useEffect(() => {
    const update = () => {
      setPlayers(getPlayers(doc));
      setPhase(getPhase(doc));
    };

    update();
    doc.on("update", update);
    return () => doc.off("update", update);
  }, [doc]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onJoin(name.trim(), spectator);
    }
  };

  const activePlayers = players.filter((p) => !p.isSpectator);
  const spectators = players.filter((p) => p.isSpectator);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full shadow-2xl border border-white/20">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          🃏 Crazy Eights
        </h1>
        <p className="text-white/70 text-center mb-6">
          Multiplayer card game
        </p>

        <form onSubmit={handleJoin} className="mb-6 space-y-4">
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
              maxLength={20}
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="spectator"
              checked={spectator}
              onChange={(e) => setSpectator(e.target.checked)}
              className="w-4 h-4 rounded"
              disabled={activePlayers.length >= 6}
            />
            <label htmlFor="spectator" className="text-white/80 text-sm">
              Join as spectator
              {activePlayers.length >= 6 && " (game is full)"}
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg"
          >
            Join Game
          </button>
        </form>

        <div className="space-y-4">
          {activePlayers.length > 0 && (
            <div>
              <h3 className="text-white/60 text-xs uppercase tracking-wide font-semibold mb-2">
                Players ({activePlayers.length}/6)
              </h3>
              <div className="space-y-1">
                {activePlayers.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center space-x-2 text-white/90 bg-white/5 rounded-lg px-3 py-2"
                  >
                    <span className="text-lg">👤</span>
                    <span>{player.name}</span>
                    {player.isHost && (
                      <span className="text-xs bg-yellow-500/30 text-yellow-200 px-2 py-0.5 rounded">
                        Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {spectators.length > 0 && (
            <div>
              <h3 className="text-white/60 text-xs uppercase tracking-wide font-semibold mb-2">
                Spectators ({spectators.length})
              </h3>
              <div className="space-y-1">
                {spectators.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center space-x-2 text-white/70 bg-white/5 rounded-lg px-3 py-2"
                  >
                    <span className="text-lg">👁️</span>
                    <span>{player.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePlayers.length === 0 && (
            <div className="text-center text-white/50 py-8">
              <p>Waiting for players to join...</p>
              <p className="text-sm mt-2">Need at least 2 players to start</p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-white/10 text-white/50 text-xs space-y-1">
          <p>📋 Game Rules:</p>
          <ul className="list-disc list-inside space-y-1 text-white/40">
            <li>Match suit or rank of the top card</li>
            <li>8s are wild - choose any suit</li>
            <li>Draw if you can't play</li>
            <li>First to empty their hand wins!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
