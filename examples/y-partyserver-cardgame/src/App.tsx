import { ClientView } from "./components/ClientView";
import { gameState1, gameState2, gameState3 } from "./yjs-setup";

/**
 * Main App Component
 *
 * Renders three side-by-side game clients to demonstrate real-time collaboration.
 * Each client has its own Y.Doc and proxy, but they sync through a simulated network.
 *
 * Try it:
 * - Join as different players in each client
 * - Host starts the game
 * - Players take turns playing cards
 * - See updates sync instantly across all clients
 */
export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            🃏 Crazy Eights
          </h1>
          <p className="text-slate-300 text-lg mb-2">
            Multiplayer Card Game · Powered by <strong>valtio-y</strong>
          </p>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto mb-4">
            This example demonstrates real-time game state synchronization using Yjs CRDTs.
            All game logic and state mutations sync automatically between players.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-slate-400">
            <span>🎴 Match suit or rank</span>
            <span>🎯 8s are wild</span>
            <span>🎲 Draw if you can't play</span>
            <span>🏆 First to empty hand wins!</span>
          </div>
        </div>

        {/* Three clients side by side */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 max-w-[1800px] mx-auto">
          <ClientView
            name="Player 1"
            gameState={gameState1}
            playerId="player-1"
            colorScheme="blue"
          />
          <ClientView
            name="Player 2"
            gameState={gameState2}
            playerId="player-2"
            colorScheme="purple"
          />
          <ClientView
            name="Player 3"
            gameState={gameState3}
            playerId="player-3"
            colorScheme="green"
          />
        </div>

        {/* Educational footer */}
        <div className="mt-8 max-w-4xl mx-auto bg-slate-800/50 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">
            How It Works
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div>
              <strong className="text-white">Local Network Simulation:</strong>{" "}
              Each client has its own Y.Doc. Changes relay between them with simulated network delay
              to demonstrate real-time sync.
            </div>
            <div>
              <strong className="text-white">Game Rules:</strong>{" "}
              Classic Crazy Eights - match the suit or rank of the top card. 8s let you change suits.
              Draw if you can't play, pass to end your turn.
            </div>
            <div>
              <strong className="text-white">State Management:</strong>{" "}
              All game state (deck, hands, discard pile) is stored in Yjs and syncs automatically.
              React components use useSnapshot() to reactively update.
            </div>
            <div>
              <strong className="text-white">Production Ready:</strong>{" "}
              Replace the local relay with y-websocket, y-webrtc, or y-partyserver for real
              multiplayer over the network.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
