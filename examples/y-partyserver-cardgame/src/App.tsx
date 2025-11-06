import { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import { proxy } from 'valtio';
import * as Y from 'yjs';
import { YPartyKitProvider } from 'y-partyserver/client';
import { bind } from 'valtio-y';
import { Users, Play, RotateCcw } from 'lucide-react';
import { PlayingCard } from './components/PlayingCard';
import { PlayerList } from './components/PlayerList';
import { SuitSelector } from './components/SuitSelector';

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  id: string;
}

interface Player {
  id: string;
  name: string;
  hand: string[];
  connected: boolean;
}

interface GameState {
  deck: string[];
  discard: string[];
  players: Record<string, Player>;
  currentPlayerIndex: number;
  currentSuit: string | null;
  winner: string | null;
  started: boolean;
  cards: Record<string, Card>;
}

export function App() {
  const [state] = useState(() => {
    const ydoc = new Y.Doc();
    const provider = new YPartyKitProvider('localhost:8788', 'cardgame-room', ydoc);

    const valtioState = proxy<GameState>({
      deck: [],
      discard: [],
      players: {},
      currentPlayerIndex: 0,
      currentSuit: null,
      winner: null,
      started: false,
      cards: {}
    });

    bind(valtioState, ydoc.getMap('game'));

    // Get client info
    const clientId = provider.awareness?.clientID.toString() || `player-${Date.now()}`;

    return { valtioState, ydoc, provider, clientId };
  });

  const snap = useSnapshot(state.valtioState);
  const [showSuitSelector, setShowSuitSelector] = useState(false);
  const [pendingEightId, setPendingEightId] = useState<string | null>(null);

  // Register player on mount
  useEffect(() => {
    if (!state.valtioState.players[state.clientId]) {
      state.valtioState.players[state.clientId] = {
        id: state.clientId,
        name: `Player ${state.clientId.slice(-4)}`,
        hand: [],
        connected: true
      };
    }

    // Update presence
    if (state.provider.awareness) {
      state.provider.awareness.setLocalStateField('user', {
        id: state.clientId,
        connected: true
      });
    }

    return () => {
      if (state.valtioState.players[state.clientId]) {
        state.valtioState.players[state.clientId].connected = false;
      }
    };
  }, [state]);

  const currentPlayer = snap.players[Object.keys(snap.players)[snap.currentPlayerIndex]];
  const myPlayer = snap.players[state.clientId];
  const isMyTurn = currentPlayer?.id === state.clientId;

  const startGame = () => {
    const playerIds = Object.keys(state.valtioState.players).filter(
      id => state.valtioState.players[id].connected
    );

    if (playerIds.length < 2) {
      alert('Need at least 2 players to start!');
      return;
    }

    // Reset game state
    const suits: Array<'hearts' | 'diamonds' | 'clubs' | 'spades'> = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const cards: Record<string, Card> = {};
    const deck: string[] = [];

    suits.forEach(suit => {
      ranks.forEach(rank => {
        const id = `${suit}-${rank}`;
        cards[id] = { suit, rank, id };
        deck.push(id);
      });
    });

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    state.valtioState.cards = cards;
    state.valtioState.deck = deck;
    state.valtioState.discard = [];

    // Deal 5 cards to each player
    playerIds.forEach(playerId => {
      const hand: string[] = [];
      for (let i = 0; i < 5; i++) {
        const cardId = state.valtioState.deck.pop();
        if (cardId) hand.push(cardId);
      }
      state.valtioState.players[playerId].hand = hand;
    });

    // Place first card on discard pile
    const firstCard = state.valtioState.deck.pop();
    if (firstCard) {
      state.valtioState.discard.push(firstCard);
      const card = state.valtioState.cards[firstCard];
      state.valtioState.currentSuit = card.suit;
    }

    state.valtioState.currentPlayerIndex = 0;
    state.valtioState.winner = null;
    state.valtioState.started = true;
  };

  const canPlayCard = (card: Card): boolean => {
    if (!isMyTurn || !snap.started) return false;

    const topCardId = snap.discard[snap.discard.length - 1];
    if (!topCardId) return true;

    const topCard = snap.cards[topCardId];
    const activeSuit = snap.currentSuit || topCard.suit;

    return card.rank === '8' || card.suit === activeSuit || card.rank === topCard.rank;
  };

  const playCard = (cardId: string) => {
    if (!canPlayCard(state.valtioState.cards[cardId])) return;

    const card = state.valtioState.cards[cardId];

    // Remove from hand
    const handIndex = state.valtioState.players[state.clientId].hand.indexOf(cardId);
    if (handIndex !== -1) {
      state.valtioState.players[state.clientId].hand.splice(handIndex, 1);
    }

    // Add to discard
    state.valtioState.discard.push(cardId);

    // If it's an 8, show suit selector
    if (card.rank === '8') {
      setPendingEightId(cardId);
      setShowSuitSelector(true);
      return;
    }

    // Update current suit
    state.valtioState.currentSuit = card.suit;

    // Check for winner
    if (state.valtioState.players[state.clientId].hand.length === 0) {
      state.valtioState.winner = state.clientId;
      return;
    }

    // Next turn
    nextTurn();
  };

  const chooseSuit = (suit: 'hearts' | 'diamonds' | 'clubs' | 'spades') => {
    state.valtioState.currentSuit = suit;
    setShowSuitSelector(false);
    setPendingEightId(null);

    // Check for winner
    if (state.valtioState.players[state.clientId].hand.length === 0) {
      state.valtioState.winner = state.clientId;
      return;
    }

    nextTurn();
  };

  const drawCard = () => {
    if (!isMyTurn || !snap.started) return;

    if (state.valtioState.deck.length === 0) {
      // Reshuffle discard pile (except top card)
      const topCard = state.valtioState.discard.pop();
      const reshuffled = [...state.valtioState.discard];
      for (let i = reshuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [reshuffled[i], reshuffled[j]] = [reshuffled[j], reshuffled[i]];
      }
      state.valtioState.deck = reshuffled;
      state.valtioState.discard = topCard ? [topCard] : [];
    }

    const cardId = state.valtioState.deck.pop();
    if (cardId) {
      state.valtioState.players[state.clientId].hand.push(cardId);
    }
  };

  const passTurn = () => {
    if (!isMyTurn || !snap.started) return;
    nextTurn();
  };

  const nextTurn = () => {
    const connectedPlayers = Object.keys(state.valtioState.players).filter(
      id => state.valtioState.players[id].connected
    );
    const nextIndex = (state.valtioState.currentPlayerIndex + 1) % connectedPlayers.length;
    state.valtioState.currentPlayerIndex = nextIndex;
  };

  const playAgain = () => {
    state.valtioState.started = false;
    state.valtioState.winner = null;
    startGame();
  };

  const topCard = snap.discard[snap.discard.length - 1]
    ? snap.cards[snap.discard[snap.discard.length - 1]]
    : null;

  const activeSuit = snap.currentSuit || topCard?.suit;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-teal-800 text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Crazy Eights</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4" />
            <span>{Object.values(snap.players).filter(p => p.connected).length} players</span>
          </div>
          {!snap.started && (
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Start Game
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-teal-700 text-white p-4">
          <PlayerList
            players={Object.values(snap.players)}
            currentPlayerId={currentPlayer?.id}
            myPlayerId={state.clientId}
          />
        </aside>

        {/* Main game area */}
        <main className="flex-1 flex flex-col items-center justify-between p-8">
          {snap.winner ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <h2 className="text-4xl font-bold text-white mb-4">
                {snap.winner === state.clientId ? '🎉 You Won! 🎉' : `${snap.players[snap.winner]?.name} Won!`}
              </h2>
              <button
                onClick={playAgain}
                className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Play Again
              </button>
            </div>
          ) : snap.started ? (
            <>
              {/* Other players' hands (hidden) */}
              <div className="flex gap-4 flex-wrap justify-center">
                {Object.values(snap.players)
                  .filter(p => p.id !== state.clientId && p.connected)
                  .map(player => (
                    <div key={player.id} className="text-center">
                      <div className="text-white text-sm mb-2 font-medium">
                        {player.name}
                        {player.id === currentPlayer?.id && ' (current)'}
                      </div>
                      <div className="flex gap-1">
                        {player.hand.map((_, i) => (
                          <div
                            key={i}
                            className="w-12 h-16 bg-blue-900 border-2 border-blue-700 rounded-lg"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Center area: deck and discard */}
              <div className="flex items-center gap-8">
                {/* Deck */}
                <div className="text-center">
                  <div className="text-white text-sm mb-2 font-medium">Deck</div>
                  <div className="relative w-24 h-32">
                    {snap.deck.length > 0 ? (
                      <div className="absolute inset-0 bg-blue-900 border-2 border-blue-700 rounded-lg shadow-lg flex items-center justify-center">
                        <div className="text-white text-xl font-bold">{snap.deck.length}</div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center">
                        <div className="text-white/50 text-sm">Empty</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Discard pile */}
                <div className="text-center">
                  <div className="text-white text-sm mb-2 font-medium">
                    Discard {activeSuit && `(${activeSuit})`}
                  </div>
                  <div className="w-24 h-32">
                    {topCard ? (
                      <PlayingCard card={topCard} faceUp />
                    ) : (
                      <div className="w-full h-full border-2 border-dashed border-white/30 rounded-lg" />
                    )}
                  </div>
                </div>
              </div>

              {/* My hand */}
              <div className="w-full max-w-4xl">
                <div className="text-center mb-4">
                  <div className="text-white font-medium mb-2">
                    {isMyTurn ? '🎯 Your Turn!' : 'Waiting for other players...'}
                  </div>
                  {isMyTurn && (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={drawCard}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                      >
                        Draw Card
                      </button>
                      <button
                        onClick={passTurn}
                        className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                      >
                        Pass
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 justify-center flex-wrap">
                  {myPlayer?.hand.map(cardId => {
                    const card = snap.cards[cardId];
                    const playable = canPlayCard(card);
                    return (
                      <button
                        key={cardId}
                        onClick={() => playable && playCard(cardId)}
                        disabled={!playable}
                        className={`transition-transform ${
                          playable ? 'hover:-translate-y-4 cursor-pointer' : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <PlayingCard card={card} faceUp />
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-white">
                <h2 className="text-3xl font-bold mb-4">Waiting for players...</h2>
                <p className="text-lg opacity-80">Press "Start Game" when ready (min 2 players)</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Suit selector modal */}
      {showSuitSelector && (
        <SuitSelector onSelectSuit={chooseSuit} />
      )}
    </div>
  );
}
