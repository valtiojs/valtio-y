import { useState, useEffect } from "react";
import { useSnapshot } from "valtio/react";
import type { GameState, Card, Suit } from "../yjs-setup";
import {
  addPlayer,
  startGame,
  playCard,
  drawCard,
  passTurn,
  sendChat,
  resetGame,
  isLegalPlay,
} from "../yjs-setup";

interface ClientViewProps {
  name: string;
  gameState: GameState;
  playerId: string;
  colorScheme: "blue" | "purple" | "green";
}

const COLOR_SCHEMES = {
  blue: {
    bg: "from-blue-900 to-blue-800",
    border: "border-blue-600",
    button: "bg-blue-600 hover:bg-blue-700",
    text: "text-blue-400",
  },
  purple: {
    bg: "from-purple-900 to-purple-800",
    border: "border-purple-600",
    button: "bg-purple-600 hover:bg-purple-700",
    text: "text-purple-400",
  },
  green: {
    bg: "from-green-900 to-green-800",
    border: "border-green-600",
    button: "bg-green-600 hover:bg-green-700",
    text: "text-green-400",
  },
};

export function ClientView({ name, gameState, playerId, colorScheme }: ClientViewProps) {
  const snap = useSnapshot(gameState);
  const [playerName, setPlayerName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [chatMessage, setChatMessage] = useState("");

  const colors = COLOR_SCHEMES[colorScheme];
  const myPlayer = snap.players?.find((p) => p.id === playerId);
  const isMyTurn = snap.currentPlayerIndex !== undefined &&
                   snap.players?.[snap.currentPlayerIndex]?.id === playerId;
  const myHand = snap.hands?.[playerId] || [];
  const topCard = snap.discard?.[snap.discard.length - 1] || null;
  const currentPlayer = snap.players?.[snap.currentPlayerIndex];
  const winner = snap.winnerId ? snap.players?.find((p) => p.id === snap.winnerId) : null;

  const handleJoin = () => {
    if (!playerName.trim()) return;
    try {
      addPlayer(gameState, playerName.trim(), playerId);
      setHasJoined(true);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleStart = () => {
    try {
      startGame(gameState, playerId);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handlePlayCard = (card: Card) => {
    if (!isMyTurn) return;

    // If playing an 8, show suit picker
    if (card.rank === "8") {
      setPendingCard(card);
      setShowSuitPicker(true);
    } else {
      try {
        playCard(gameState, playerId, card.id);
      } catch (error) {
        alert((error as Error).message);
      }
    }
  };

  const handleSelectSuit = (suit: Suit) => {
    if (pendingCard) {
      try {
        playCard(gameState, playerId, pendingCard.id, suit);
      } catch (error) {
        alert((error as Error).message);
      }
    }
    setShowSuitPicker(false);
    setPendingCard(null);
  };

  const handleDraw = () => {
    try {
      drawCard(gameState, playerId);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handlePass = () => {
    try {
      passTurn(gameState, playerId);
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    sendChat(gameState, playerId, chatMessage.trim());
    setChatMessage("");
  };

  const handleReset = () => {
    try {
      resetGame(gameState, playerId);
      setHasJoined(false);
      setPlayerName("");
    } catch (error) {
      alert((error as Error).message);
    }
  };

  // Show join screen
  if (!hasJoined || !myPlayer) {
    return (
      <div className={`bg-gradient-to-br ${colors.bg} rounded-xl border-2 ${colors.border} p-6 shadow-xl min-h-[600px] flex flex-col`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">{name}</h2>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Join Game</h3>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 mb-4"
              maxLength={20}
            />
            <button
              onClick={handleJoin}
              className={`w-full py-3 ${colors.button} text-white font-semibold rounded-lg transition-colors`}
            >
              Join Game
            </button>

            {snap.players && snap.players.length > 0 && (
              <div className="mt-6 pt-6 border-t border-white/20">
                <p className="text-white/60 text-sm mb-3">Players in lobby:</p>
                {snap.players.map((p) => (
                  <div key={p.id} className="text-white/80 text-sm mb-1">
                    • {p.name} {p.isHost && "(host)"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show game view
  return (
    <div className={`bg-gradient-to-br ${colors.bg} rounded-xl border-2 ${colors.border} p-4 shadow-xl min-h-[700px] flex flex-col relative`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white">{name}</h2>
          <p className="text-xs text-white/60">Playing as {myPlayer.name}</p>
        </div>
        {snap.phase === "lobby" && myPlayer.isHost && (
          <button
            onClick={handleStart}
            disabled={!snap.players || snap.players.length < 2}
            className={`px-4 py-2 ${colors.button} text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Start Game
          </button>
        )}
        {snap.phase === "finished" && myPlayer.isHost && (
          <button
            onClick={handleReset}
            className={`px-4 py-2 ${colors.button} text-white text-sm font-semibold rounded-lg transition-colors`}
          >
            New Game
          </button>
        )}
      </div>

      {/* Players */}
      <div className="flex gap-2 mb-3 overflow-x-auto">
        {snap.players?.map((player, idx) => {
          const isCurrent = idx === snap.currentPlayerIndex;
          const handSize = snap.hands?.[player.id]?.length || 0;
          return (
            <div
              key={player.id}
              className={`flex-shrink-0 px-3 py-2 rounded-lg ${
                isCurrent ? "bg-yellow-500/30 ring-2 ring-yellow-500" : "bg-white/10"
              } ${player.id === playerId ? "ring-2 ring-white" : ""}`}
            >
              <div className="text-white font-medium text-sm">{player.name}</div>
              <div className="text-white/60 text-xs">{handSize} cards</div>
            </div>
          );
        })}
      </div>

      {/* Game Area */}
      <div className="flex-1 flex flex-col items-center justify-center bg-black/20 rounded-lg p-4 mb-3">
        {snap.phase === "lobby" && (
          <div className="text-center text-white">
            <div className="text-4xl mb-2">🃏</div>
            <div className="font-bold mb-1">Waiting for host...</div>
            <div className="text-sm text-white/60">
              {snap.players?.length || 0} player(s) ready
            </div>
          </div>
        )}

        {(snap.phase === "playing" || snap.phase === "finished") && (
          <>
            {/* Table */}
            <div className="flex items-center gap-6 mb-4">
              {/* Deck */}
              <div className="relative">
                <div className="w-20 h-28 rounded-lg border-2 border-blue-900 bg-blue-800 flex items-center justify-center text-white text-sm">
                  <div className="text-center">
                    <div className="text-3xl mb-1">🂠</div>
                    <div className="font-bold">{snap.deck?.length || 0}</div>
                  </div>
                </div>
              </div>

              {/* Discard */}
              {topCard ? (
                <div className={`w-20 h-28 rounded-lg border-2 bg-white flex flex-col items-center justify-center font-bold ${topCard.suit === "♥" || topCard.suit === "♦" ? "text-red-600 border-red-600" : "text-black border-black"}`}>
                  <div className="text-3xl">{topCard.rank}</div>
                  <div className="text-4xl">{topCard.suit}</div>
                  {snap.forcedSuit && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center text-2xl">
                      {snap.forcedSuit}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-20 h-28 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center text-white/40 text-xs">
                  Discard
                </div>
              )}
            </div>

            {/* Turn indicator */}
            {currentPlayer && (
              <div className={`text-sm font-medium mb-2 ${isMyTurn ? "text-yellow-400" : "text-white/80"}`}>
                {isMyTurn ? "Your Turn!" : `${currentPlayer.name}'s Turn`}
              </div>
            )}

            {/* Winner banner */}
            {winner && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10 rounded-xl">
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-8 text-center">
                  <div className="text-6xl mb-2">🎉</div>
                  <div className="text-3xl font-bold text-white">
                    {winner.id === playerId ? "You Win!" : `${winner.name} Wins!`}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hand */}
      {snap.phase === "playing" && myHand.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white text-sm font-medium">Your Hand</div>
            {isMyTurn && (
              <div className="flex gap-2">
                <button
                  onClick={handleDraw}
                  className={`px-3 py-1 ${colors.button} text-white text-xs font-medium rounded transition-colors`}
                >
                  Draw
                </button>
                <button
                  onClick={handlePass}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium rounded transition-colors"
                >
                  Pass
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {myHand.map((card) => {
              const legal = topCard ? isLegalPlay(card, topCard, snap.forcedSuit) : true;
              const canPlay = isMyTurn && legal;
              return (
                <button
                  key={card.id}
                  onClick={() => canPlay && handlePlayCard(card)}
                  disabled={!canPlay}
                  className={`flex-shrink-0 w-16 h-22 rounded-lg border-2 flex flex-col items-center justify-center font-bold text-lg transition-all
                    ${canPlay ? "border-green-500 bg-white cursor-pointer hover:scale-105" : legal ? "border-yellow-500 bg-white opacity-60" : "border-gray-400 bg-gray-100 opacity-40 cursor-not-allowed"}
                    ${card.suit === "♥" || card.suit === "♦" ? "text-red-600" : "text-black"}
                  `}
                >
                  <div>{card.rank}</div>
                  <div className="text-2xl">{card.suit}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat/Log */}
      <div className="bg-black/30 rounded-lg p-2 max-h-32 overflow-y-auto">
        <div className="text-xs text-white/70 space-y-1">
          {snap.log?.slice(-10).map((entry, idx) => (
            <div key={idx}>{entry.msg}</div>
          ))}
        </div>
      </div>

      {/* Suit Picker Modal */}
      {showSuitPicker && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded-xl">
          <div className="bg-gray-800 rounded-xl p-6 max-w-sm">
            <h3 className="text-white text-lg font-bold mb-4 text-center">Choose a Suit</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { symbol: "♠" as Suit, name: "Spades", color: "text-black" },
                { symbol: "♥" as Suit, name: "Hearts", color: "text-red-600" },
                { symbol: "♦" as Suit, name: "Diamonds", color: "text-red-600" },
                { symbol: "♣" as Suit, name: "Clubs", color: "text-black" },
              ].map((suit) => (
                <button
                  key={suit.symbol}
                  onClick={() => handleSelectSuit(suit.symbol)}
                  className={`p-4 rounded-lg bg-white hover:bg-gray-100 transition-all ${suit.color}`}
                >
                  <div className="text-5xl mb-1">{suit.symbol}</div>
                  <div className="text-xs font-medium text-gray-700">{suit.name}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setShowSuitPicker(false);
                setPendingCard(null);
              }}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
