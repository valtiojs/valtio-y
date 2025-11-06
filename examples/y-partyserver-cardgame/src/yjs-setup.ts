/**
 * Yjs Setup for Card Game
 *
 * This simulates a multiplayer card game using local Y.Doc instances.
 * In a real application, you would connect these documents to a network provider
 * (like y-websocket, y-webrtc, y-partyserver, etc.).
 */

import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";

// ============================================================================
// TYPES
// ============================================================================

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

export type GamePhase = "lobby" | "playing" | "finished";

export interface Player {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  deck: Card[];
  discard: Card[];
  hands: Record<string, Card[]>;
  currentPlayerIndex: number;
  forcedSuit?: Suit;
  winnerId?: string;
  log: Array<{ t: number; msg: string }>;
}

// ============================================================================
// GAME LOGIC
// ============================================================================

const PLAYER_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // yellow
  "#8b5cf6", // purple
  "#ec4899", // pink
];

/**
 * Create a standard 52-card deck
 */
export function createDeck(): Card[] {
  const suits: Suit[] = ["♠", "♥", "♦", "♣"];
  const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck: Card[] = [];

  let id = 0;
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ id: `card-${id++}`, rank, suit });
    }
  }

  return shuffleArray(deck);
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Check if a card can be legally played
 */
export function isLegalPlay(card: Card, topCard: Card | null, forcedSuit?: Suit): boolean {
  if (!topCard) return true; // First card
  if (card.rank === "8") return true; // 8s are wild

  if (forcedSuit) {
    return card.suit === forcedSuit;
  }

  return card.rank === topCard.rank || card.suit === topCard.suit;
}

// ============================================================================
// YJS DOCUMENT SETUP
// ============================================================================

/**
 * Create three separate Y.Doc instances to simulate three clients
 */
export const doc1 = new Y.Doc();
export const doc2 = new Y.Doc();
export const doc3 = new Y.Doc();

const docs = [doc1, doc2, doc3];

// ============================================================================
// NETWORK SIMULATION
// ============================================================================

const RELAY_ORIGIN = Symbol("relay-origin");

/**
 * Set up a simulated network relay between all documents
 */
function setupRelay(sourceDoc: Y.Doc, targetDocs: Y.Doc[]) {
  sourceDoc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin === RELAY_ORIGIN) return;

    // Simulate network delay (50ms)
    setTimeout(() => {
      targetDocs.forEach((targetDoc) => {
        targetDoc.transact(() => {
          Y.applyUpdate(targetDoc, update);
        }, RELAY_ORIGIN);
      });
    }, 50);
  });
}

// Set up bidirectional relay between all docs
setupRelay(doc1, [doc2, doc3]);
setupRelay(doc2, [doc1, doc3]);
setupRelay(doc3, [doc1, doc2]);

// ============================================================================
// VALTIO-YJS PROXY CREATION
// ============================================================================

export const { proxy: gameState1, bootstrap: bootstrap1 } = createYjsProxy<GameState>(doc1, {
  getRoot: (doc: Y.Doc) => doc.getMap("cardgame"),
});

export const { proxy: gameState2 } = createYjsProxy<GameState>(doc2, {
  getRoot: (doc: Y.Doc) => doc.getMap("cardgame"),
});

export const { proxy: gameState3 } = createYjsProxy<GameState>(doc3, {
  getRoot: (doc: Y.Doc) => doc.getMap("cardgame"),
});

// ============================================================================
// GAME ACTIONS
// ============================================================================

export function addPlayer(state: GameState, name: string, playerId: string): void {
  if (state.phase !== "lobby") {
    throw new Error("Cannot join: game already in progress");
  }

  if (state.players?.some((p) => p.id === playerId)) {
    return; // Already joined
  }

  if (!state.players) {
    state.players = [];
  }

  if (state.players.length >= 6) {
    throw new Error("Game is full (max 6 players)");
  }

  const player: Player = {
    id: playerId,
    name,
    color: PLAYER_COLORS[state.players.length % PLAYER_COLORS.length],
    isHost: state.players.length === 0,
  };

  state.players.push(player);

  if (!state.log) state.log = [];
  state.log.push({
    t: Date.now(),
    msg: `${name} joined${player.isHost ? " (host)" : ""}`,
  });
}

export function startGame(state: GameState, playerId: string): void {
  if (state.phase !== "lobby") {
    throw new Error("Game already started");
  }

  const player = state.players?.find((p) => p.id === playerId);
  if (!player?.isHost) {
    throw new Error("Only host can start game");
  }

  if (!state.players || state.players.length < 2) {
    throw new Error("Need at least 2 players to start");
  }

  // Create and shuffle deck
  const fullDeck = createDeck();

  // Deal 7 cards to each player
  state.hands = {};
  let deckIndex = 0;

  for (const p of state.players) {
    state.hands[p.id] = fullDeck.slice(deckIndex, deckIndex + 7);
    deckIndex += 7;
  }

  // Put first card on discard (skip 8s)
  state.discard = [];
  while (deckIndex < fullDeck.length) {
    const card = fullDeck[deckIndex];
    deckIndex++;
    if (card.rank !== "8") {
      state.discard.push(card);
      break;
    }
  }

  // Remaining cards in deck
  state.deck = fullDeck.slice(deckIndex);

  // Start game
  state.phase = "playing";
  state.currentPlayerIndex = 0;
  state.log.push({ t: Date.now(), msg: "Game started!" });
}

export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  chosenSuit?: Suit
): void {
  if (state.phase !== "playing") {
    throw new Error("Game not in progress");
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error("Not your turn");
  }

  const hand = state.hands[playerId];
  const cardIndex = hand.findIndex((c) => c.id === cardId);

  if (cardIndex === -1) {
    throw new Error("Card not in hand");
  }

  const card = hand[cardIndex];
  const topCard = state.discard[state.discard.length - 1];

  if (!isLegalPlay(card, topCard, state.forcedSuit)) {
    throw new Error("Illegal play");
  }

  if (card.rank === "8" && !chosenSuit) {
    throw new Error("Must choose a suit when playing an 8");
  }

  // Remove from hand and add to discard
  hand.splice(cardIndex, 1);
  state.discard.push(card);

  // Set forced suit if 8
  if (card.rank === "8" && chosenSuit) {
    state.forcedSuit = chosenSuit;
  } else {
    delete state.forcedSuit;
  }

  state.log.push({
    t: Date.now(),
    msg: `${currentPlayer.name} played ${card.rank}${card.suit}${card.rank === "8" ? ` (chose ${chosenSuit})` : ""}`,
  });

  // Check win condition
  if (hand.length === 0) {
    state.phase = "finished";
    state.winnerId = playerId;
    state.log.push({ t: Date.now(), msg: `${currentPlayer.name} wins! 🎉` });
    return;
  }

  // Advance turn
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
}

export function drawCard(state: GameState, playerId: string): void {
  if (state.phase !== "playing") {
    throw new Error("Game not in progress");
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error("Not your turn");
  }

  if (state.deck.length === 0) {
    // Reshuffle discard pile
    if (state.discard.length <= 1) {
      state.log.push({ t: Date.now(), msg: "No cards left to draw!" });
      return;
    }

    const topCard = state.discard.pop()!;
    state.deck = shuffleArray(state.discard);
    state.discard = [topCard];
  }

  if (state.deck.length > 0) {
    const card = state.deck.shift()!;
    state.hands[playerId].push(card);
    state.log.push({ t: Date.now(), msg: `${currentPlayer.name} drew a card` });
  }
}

export function passTurn(state: GameState, playerId: string): void {
  if (state.phase !== "playing") {
    throw new Error("Game not in progress");
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) {
    throw new Error("Not your turn");
  }

  state.log.push({ t: Date.now(), msg: `${currentPlayer.name} passed` });
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
}

export function sendChat(state: GameState, playerId: string, message: string): void {
  const player = state.players?.find((p) => p.id === playerId);
  if (!player) return;

  state.log.push({ t: Date.now(), msg: `${player.name}: ${message}` });
}

export function resetGame(state: GameState, playerId: string): void {
  const player = state.players?.find((p) => p.id === playerId);
  if (!player?.isHost) {
    throw new Error("Only host can reset game");
  }

  state.phase = "lobby";
  state.deck = [];
  state.discard = [];
  state.hands = {};
  state.currentPlayerIndex = 0;
  delete state.forcedSuit;
  delete state.winnerId;
  state.log.push({ t: Date.now(), msg: "Game reset to lobby" });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize empty game state
gameState1.phase = "lobby";
gameState1.players = [];
gameState1.deck = [];
gameState1.discard = [];
gameState1.hands = {};
gameState1.currentPlayerIndex = 0;
gameState1.log = [];
