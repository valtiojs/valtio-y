/**
 * Main Tic-Tac-Toe application component
 */

import { useEffect } from "react";
import { Board } from "./components/Board";
import { GameStatus } from "./components/GameStatus";
import { GameControls } from "./components/GameControls";
import { SyncStatus } from "./components/SyncStatus";
import { useGameActions } from "./hooks/useGameActions";
import { bootstrap, cleanup } from "./yjs-setup";

export default function App() {
  const { joinGame } = useGameActions();

  useEffect(() => {
    // Bootstrap the proxy and join the game when component mounts
    bootstrap();
    joinGame();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <SyncStatus />

      <div className="flex flex-col items-center gap-8 w-full">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-2">Tic-Tac-Toe</h1>
          <p className="text-gray-400 text-lg">
            Multiplayer with <span className="text-blue-400">valtio-y</span>
          </p>
        </div>

        {/* Game Status */}
        <GameStatus />

        {/* Game Board */}
        <Board />

        {/* Controls */}
        <GameControls />

        {/* Info */}
        <div className="text-center text-sm text-gray-500 mt-4">
          <p>Share the room URL with friends to play together</p>
          <p className="mt-1 text-xs">
            Room ID: <code className="bg-gray-800 px-2 py-1 rounded">{getRoomId()}</code>
          </p>
        </div>
      </div>
    </div>
  );
}

function getRoomId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("room") || "default";
}
