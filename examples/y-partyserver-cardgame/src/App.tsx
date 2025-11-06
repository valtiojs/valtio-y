import { useState, useEffect } from "react";
import { YDocProvider, useYDoc } from "./y/useYDoc";
import { Lobby } from "./views/Lobby";
import { Table } from "./views/Table";
import { Hand } from "./components/Hand";
import { PlayersBar } from "./components/PlayersBar";
import { Chat } from "./components/Chat";
import { SuitPicker } from "./components/SuitPicker";
import { HUD } from "./components/HUD";
import {
  getPhase,
  getActivePlayers,
  getPlayer,
  getPlayerHand,
  getPlayerHandSize,
  getTopDiscard,
  getDeckSize,
  getCurrentPlayer,
  isPlayerTurn,
  getForcedSuit,
  getWinnerPlayerId,
  getLog,
  getLegalCards,
} from "./y/selectors";

function GameView() {
  const { doc, sendOp, playerId } = useYDoc();
  const [phase, setPhase] = useState<string>("lobby");
  const [players, setPlayers] = useState<any[]>([]);
  const [myHand, setMyHand] = useState<any[]>([]);
  const [topCard, setTopCard] = useState<any>(null);
  const [deckSize, setDeckSize] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [forcedSuit, setForcedSuit] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [log, setLog] = useState<any[]>([]);
  const [legalCards, setLegalCards] = useState<Set<string>>(new Set());
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingEightCard, setPendingEightCard] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const update = () => {
      setPhase(getPhase(doc));
      setPlayers(getActivePlayers(doc));
      setMyHand(getPlayerHand(doc, playerId));
      setTopCard(getTopDiscard(doc));
      setDeckSize(getDeckSize(doc));
      setCurrentPlayer(getCurrentPlayer(doc));
      setIsMyTurn(isPlayerTurn(doc, playerId));
      setForcedSuit(getForcedSuit(doc));
      setWinnerId(getWinnerPlayerId(doc));
      setLog(getLog(doc));

      // Calculate legal cards
      const legal = getLegalCards(doc, playerId);
      setLegalCards(new Set(legal.map((c) => c.id)));
    };

    update();
    doc.on("update", update);
    return () => doc.off("update", update);
  }, [doc, playerId]);

  const handleJoin = (name: string, spectator: boolean) => {
    sendOp({ t: "JOIN", name, spectator });
    setJoined(true);
  };

  const handleStart = () => {
    sendOp({ t: "START" });
  };

  const handlePlayCard = (cardId: string) => {
    const card = myHand.find((c) => c.id === cardId);
    if (!card) return;

    // If playing an 8, show suit picker
    if (card.rank === "8") {
      setPendingEightCard(cardId);
      setShowSuitPicker(true);
    } else {
      sendOp({ t: "PLAY_CARD", cardId });
    }
  };

  const handleSelectSuit = (suit: string) => {
    if (pendingEightCard) {
      sendOp({ t: "PLAY_CARD", cardId: pendingEightCard, chosenSuit: suit });
      setPendingEightCard(null);
    }
    setShowSuitPicker(false);
  };

  const handleDraw = () => {
    sendOp({ t: "DRAW", count: 1 });
  };

  const handlePass = () => {
    sendOp({ t: "PASS" });
  };

  const handleChat = (text: string) => {
    sendOp({ t: "CHAT", text });
  };

  const handleReset = () => {
    sendOp({ t: "RESET" });
    setJoined(false);
  };

  const me = getPlayer(doc, playerId);
  const winner = winnerId ? getPlayer(doc, winnerId) : null;

  // Show lobby if not joined
  if (!joined) {
    return <Lobby onJoin={handleJoin} />;
  }

  // Calculate hand sizes for all players
  const handSizes = new Map<string, number>();
  players.forEach((p) => {
    handSizes.set(p.id, getPlayerHandSize(doc, p.id));
  });

  return (
    <div className="h-screen flex flex-col">
      <HUD
        phase={phase}
        winner={winner}
        isHost={me?.isHost || false}
        onStart={handleStart}
        onReset={handleReset}
        roomId={window.location.pathname.split("/").pop() || "unknown"}
      />

      <PlayersBar
        players={players}
        handSizes={handSizes}
        currentPlayerId={currentPlayer?.id || null}
        myPlayerId={playerId}
      />

      {phase === "lobby" && (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-green-800 to-green-900">
          <div className="text-center text-white">
            <div className="text-6xl mb-4">🃏</div>
            <div className="text-3xl font-bold mb-2">Waiting for host to start...</div>
            <div className="text-gray-300">
              {players.length} player{players.length !== 1 ? "s" : ""} ready
            </div>
          </div>
        </div>
      )}

      {(phase === "playing" || phase === "finished") && (
        <>
          <Table
            topCard={topCard}
            deckSize={deckSize}
            forcedSuit={forcedSuit}
            currentPlayerName={currentPlayer?.name || null}
          />

          <Hand
            cards={myHand}
            legalCards={legalCards}
            isMyTurn={isMyTurn}
            onPlayCard={handlePlayCard}
            onDraw={handleDraw}
            onPass={handlePass}
          />
        </>
      )}

      <Chat log={log} onSendMessage={handleChat} />

      {showSuitPicker && (
        <SuitPicker
          onSelectSuit={handleSelectSuit}
          onCancel={() => {
            setShowSuitPicker(false);
            setPendingEightCard(null);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  const [roomId, setRoomId] = useState<string>("");
  const [playerId] = useState(() => {
    // Generate a unique player ID
    return `player-${Math.random().toString(36).substring(2, 11)}`;
  });

  useEffect(() => {
    // Get room ID from URL or generate one
    const path = window.location.pathname;
    const parts = path.split("/");
    const urlRoomId = parts[parts.length - 1];

    if (urlRoomId && urlRoomId !== "") {
      setRoomId(urlRoomId);
    } else {
      // Generate a random room ID
      const newRoomId = Math.random().toString(36).substring(2, 9);
      setRoomId(newRoomId);
      window.history.pushState({}, "", `/${newRoomId}`);
    }
  }, []);

  if (!roomId) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <YDocProvider roomId={roomId} playerId={playerId}>
      <GameView />
    </YDocProvider>
  );
}
