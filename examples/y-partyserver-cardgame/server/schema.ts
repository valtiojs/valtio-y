import * as Y from "yjs";

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
  joinedAt: number;
  isHost: boolean;
  isSpectator: boolean;
}

export interface LogEntry {
  t: number;
  msg: string;
}

/**
 * Initialize the Y.Doc schema for a new game
 */
export function initializeGameDoc(doc: Y.Doc): void {
  const state = doc.getMap("state");
  const players = doc.getMap("players");
  const hands = doc.getMap("hands");
  const deck = doc.getArray("deck");
  const discard = doc.getArray("discard");
  const log = doc.getArray("log");
  const settings = doc.getMap("settings");

  // Only initialize if empty
  if (state.size === 0) {
    state.set("phase", "lobby");
    state.set("turnIndex", 0);
    state.set("direction", 1);
  }

  if (settings.size === 0) {
    settings.set("startingHand", 7);
    settings.set("drawOnNoMatch", 1);
  }
}

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
      deck.push({
        id: `card-${id++}`,
        rank,
        suit,
      });
    }
  }

  return deck;
}

/**
 * Convert Y.Map to plain object
 */
export function yMapToObject<T = any>(ymap: Y.Map<any>): T {
  const obj: any = {};
  ymap.forEach((value, key) => {
    obj[key] = value;
  });
  return obj as T;
}

/**
 * Convert Y.Array to plain array
 */
export function yArrayToArray<T = any>(yarray: Y.Array<any>): T[] {
  return yarray.toArray();
}

/**
 * Get a player's hand
 */
export function getPlayerHand(doc: Y.Doc, playerId: string): Y.Array<Card> {
  const hands = doc.getMap("hands");
  let hand = hands.get(playerId) as Y.Array<Card> | undefined;

  if (!hand) {
    hand = new Y.Array<Card>();
    hands.set(playerId, hand);
  }

  return hand;
}

/**
 * Get all non-spectator players in join order
 */
export function getActivePlayers(doc: Y.Doc): Player[] {
  const players = doc.getMap("players");
  const playerList: Player[] = [];

  players.forEach((playerMap: Y.Map<any>, playerId: string) => {
    const player = yMapToObject<Player>(playerMap);
    if (!player.isSpectator) {
      playerList.push(player);
    }
  });

  return playerList.sort((a, b) => a.joinedAt - b.joinedAt);
}

/**
 * Add a log entry
 */
export function addLog(doc: Y.Doc, message: string): void {
  const log = doc.getArray("log");
  log.push([{ t: Date.now(), msg: message }]);
}
