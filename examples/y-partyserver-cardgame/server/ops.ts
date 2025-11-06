import * as Y from "yjs";
import {
  addLog,
  createDeck,
  getActivePlayers,
  getPlayerHand,
  Player,
  Suit,
  yArrayToArray,
  yMapToObject,
} from "./schema.js";
import {
  advanceTurn,
  drawCards,
  isLegalPlay,
  isPlayerTurn,
  removeCardFromHand,
} from "./rules.js";
import { generateSeed, seededShuffle } from "./rng.js";

export type ClientOp =
  | { t: "JOIN"; name: string; spectator?: boolean }
  | { t: "START" }
  | { t: "PLAY_CARD"; cardId: string; chosenSuit?: Suit }
  | { t: "DRAW"; count?: number }
  | { t: "PASS" }
  | { t: "CHAT"; text: string }
  | { t: "RESET" };

/**
 * Handle JOIN operation
 */
export function handleJoin(
  doc: Y.Doc,
  playerId: string,
  name: string,
  spectator = false
): void {
  const players = doc.getMap("players");
  const state = doc.getMap("state");
  const phase = state.get("phase");

  // Can only join in lobby
  if (phase !== "lobby") {
    throw new Error("Cannot join: game already in progress");
  }

  // Check if player already exists
  if (players.has(playerId)) {
    throw new Error("Player already joined");
  }

  // Check player limit (max 6 active players)
  const activePlayers = getActivePlayers(doc);
  if (!spectator && activePlayers.length >= 6) {
    throw new Error("Game is full (max 6 players)");
  }

  // First player is host
  const isHost = players.size === 0;

  // Create player
  const playerMap = new Y.Map();
  playerMap.set("id", playerId);
  playerMap.set("name", name);
  playerMap.set("joinedAt", Date.now());
  playerMap.set("isHost", isHost);
  playerMap.set("isSpectator", spectator);

  players.set(playerId, playerMap);

  addLog(
    doc,
    `${name} joined${spectator ? " as spectator" : ""}${isHost ? " (host)" : ""}`
  );
}

/**
 * Handle START operation
 */
export function handleStart(doc: Y.Doc, playerId: string): void {
  const players = doc.getMap("players");
  const state = doc.getMap("state");
  const phase = state.get("phase");
  const settings = doc.getMap("settings");
  const deck = doc.getArray("deck");
  const discard = doc.getArray("discard");

  // Check phase
  if (phase !== "lobby") {
    throw new Error("Game already started");
  }

  // Check if player is host
  const playerMap = players.get(playerId) as Y.Map<any>;
  if (!playerMap) {
    throw new Error("Player not found");
  }

  const player = yMapToObject<Player>(playerMap);
  if (!player.isHost) {
    throw new Error("Only host can start game");
  }

  // Check minimum players
  const activePlayers = getActivePlayers(doc);
  if (activePlayers.length < 2) {
    throw new Error("Need at least 2 players to start");
  }

  // Generate seed and shuffle deck
  const seed = generateSeed();
  state.set("seed", seed);

  const fullDeck = createDeck();
  const shuffledDeck = seededShuffle(fullDeck, seed);

  // Deal cards
  const startingHand = (settings.get("startingHand") as number) || 7;
  let deckIndex = 0;

  for (const activePlayer of activePlayers) {
    const hand = getPlayerHand(doc, activePlayer.id);
    const cards = shuffledDeck.slice(deckIndex, deckIndex + startingHand);
    hand.push(cards);
    deckIndex += startingHand;
  }

  // Put remaining cards in deck
  const remainingCards = shuffledDeck.slice(deckIndex);
  deck.push(remainingCards);

  // Flip first card to discard (or draw until we get a non-8)
  while (deck.length > 0) {
    const firstCard = deck.get(0);
    deck.delete(0, 1);
    discard.push([firstCard]);

    // Start with a simple card (not an 8)
    if ((firstCard as any).rank !== "8") {
      break;
    }
  }

  // Start game
  state.set("phase", "playing");
  state.set("turnIndex", 0);
  state.set("direction", 1);

  addLog(doc, "Game started!");
}

/**
 * Handle PLAY_CARD operation
 */
export function handlePlayCard(
  doc: Y.Doc,
  playerId: string,
  cardId: string,
  chosenSuit?: Suit
): void {
  const state = doc.getMap("state");
  const discard = doc.getArray("discard");

  // Check if it's player's turn
  if (!isPlayerTurn(doc, playerId)) {
    throw new Error("Not your turn");
  }

  // Remove card from hand
  const card = removeCardFromHand(doc, playerId, cardId);

  // Validate play
  if (!isLegalPlay(doc, card, chosenSuit)) {
    throw new Error("Illegal play: card doesn't match suit or rank");
  }

  // If playing an 8, must choose suit
  if (card.rank === "8" && !chosenSuit) {
    throw new Error("Must choose a suit when playing an 8");
  }

  // Add to discard
  discard.push([card]);

  // Set forced suit if 8
  if (card.rank === "8" && chosenSuit) {
    state.set("forceSuit", chosenSuit);
  }

  // Get player name
  const players = doc.getMap("players");
  const playerMap = players.get(playerId) as Y.Map<any>;
  const player = yMapToObject<Player>(playerMap);

  addLog(
    doc,
    `${player.name} played ${card.rank}${card.suit}${card.rank === "8" ? ` (chose ${chosenSuit})` : ""}`
  );

  // Check win condition
  const hand = getPlayerHand(doc, playerId);
  if (hand.length === 0) {
    state.set("phase", "finished");
    state.set("winnerPlayerId", playerId);
    addLog(doc, `${player.name} wins! 🎉`);
    return;
  }

  // Advance turn
  advanceTurn(doc);
}

/**
 * Handle DRAW operation
 */
export function handleDraw(doc: Y.Doc, playerId: string, count = 1): void {
  const settings = doc.getMap("settings");

  // Check if it's player's turn
  if (!isPlayerTurn(doc, playerId)) {
    throw new Error("Not your turn");
  }

  const drawCount = Math.max(1, Math.min(count, 3)); // Limit to 1-3 cards
  const drawnCards = drawCards(doc, playerId, drawCount);

  // Get player name
  const players = doc.getMap("players");
  const playerMap = players.get(playerId) as Y.Map<any>;
  const player = yMapToObject<Player>(playerMap);

  addLog(doc, `${player.name} drew ${drawnCards.length} card(s)`);

  // Auto-advance turn (player must pass or play on next turn)
  // In Crazy Eights, you typically get one draw attempt per turn
}

/**
 * Handle PASS operation
 */
export function handlePass(doc: Y.Doc, playerId: string): void {
  // Check if it's player's turn
  if (!isPlayerTurn(doc, playerId)) {
    throw new Error("Not your turn");
  }

  // Get player name
  const players = doc.getMap("players");
  const playerMap = players.get(playerId) as Y.Map<any>;
  const player = yMapToObject<Player>(playerMap);

  addLog(doc, `${player.name} passed`);

  // Advance turn
  advanceTurn(doc);
}

/**
 * Handle CHAT operation
 */
export function handleChat(doc: Y.Doc, playerId: string, text: string): void {
  if (!text || text.trim().length === 0) {
    throw new Error("Empty message");
  }

  if (text.length > 500) {
    throw new Error("Message too long");
  }

  // Get player name
  const players = doc.getMap("players");
  const playerMap = players.get(playerId) as Y.Map<any>;
  if (!playerMap) {
    throw new Error("Player not found");
  }

  const player = yMapToObject<Player>(playerMap);
  addLog(doc, `${player.name}: ${text.trim()}`);
}

/**
 * Handle RESET operation
 */
export function handleReset(doc: Y.Doc, playerId: string): void {
  const players = doc.getMap("players");
  const state = doc.getMap("state");

  // Check if player is host
  const playerMap = players.get(playerId) as Y.Map<any>;
  if (!playerMap) {
    throw new Error("Player not found");
  }

  const player = yMapToObject<Player>(playerMap);
  if (!player.isHost) {
    throw new Error("Only host can reset game");
  }

  // Clear game state
  const hands = doc.getMap("hands");
  const deck = doc.getArray("deck");
  const discard = doc.getArray("discard");

  hands.clear();
  deck.delete(0, deck.length);
  discard.delete(0, discard.length);

  state.set("phase", "lobby");
  state.set("turnIndex", 0);
  state.delete("seed");
  state.delete("winnerPlayerId");
  state.delete("forceSuit");

  addLog(doc, "Game reset to lobby");
}

/**
 * Process a client operation
 */
export function processOp(doc: Y.Doc, playerId: string, op: ClientOp): void {
  try {
    switch (op.t) {
      case "JOIN":
        handleJoin(doc, playerId, op.name, op.spectator);
        break;
      case "START":
        handleStart(doc, playerId);
        break;
      case "PLAY_CARD":
        handlePlayCard(doc, playerId, op.cardId, op.chosenSuit);
        break;
      case "DRAW":
        handleDraw(doc, playerId, op.count);
        break;
      case "PASS":
        handlePass(doc, playerId);
        break;
      case "CHAT":
        handleChat(doc, playerId, op.text);
        break;
      case "RESET":
        handleReset(doc, playerId);
        break;
      default:
        throw new Error(`Unknown operation: ${(op as any).t}`);
    }
  } catch (error) {
    // Log error but don't crash
    console.error(`Error processing op ${op.t} from ${playerId}:`, error);
    throw error;
  }
}
