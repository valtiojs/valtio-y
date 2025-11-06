import * as Y from "yjs";

export interface Card {
  id: string;
  rank: string;
  suit: string;
}

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
 * Get game phase
 */
export function getPhase(doc: Y.Doc): "lobby" | "playing" | "finished" {
  const state = doc.getMap("state");
  return (state.get("phase") as any) || "lobby";
}

/**
 * Get all players
 */
export function getPlayers(doc: Y.Doc): Player[] {
  const players = doc.getMap("players");
  const playerList: Player[] = [];

  players.forEach((playerMap: any) => {
    const player: Player = {
      id: playerMap.get("id"),
      name: playerMap.get("name"),
      joinedAt: playerMap.get("joinedAt"),
      isHost: playerMap.get("isHost"),
      isSpectator: playerMap.get("isSpectator"),
    };
    playerList.push(player);
  });

  return playerList.sort((a, b) => a.joinedAt - b.joinedAt);
}

/**
 * Get active (non-spectator) players
 */
export function getActivePlayers(doc: Y.Doc): Player[] {
  return getPlayers(doc).filter((p) => !p.isSpectator);
}

/**
 * Get a player by ID
 */
export function getPlayer(doc: Y.Doc, playerId: string): Player | null {
  const players = doc.getMap("players");
  const playerMap = players.get(playerId) as Y.Map<any> | undefined;

  if (!playerMap) {
    return null;
  }

  return {
    id: playerMap.get("id"),
    name: playerMap.get("name"),
    joinedAt: playerMap.get("joinedAt"),
    isHost: playerMap.get("isHost"),
    isSpectator: playerMap.get("isSpectator"),
  };
}

/**
 * Get player's hand
 */
export function getPlayerHand(doc: Y.Doc, playerId: string): Card[] {
  const hands = doc.getMap("hands");
  const hand = hands.get(playerId) as Y.Array<any> | undefined;

  if (!hand) {
    return [];
  }

  return hand.toArray();
}

/**
 * Get hand size for a player
 */
export function getPlayerHandSize(doc: Y.Doc, playerId: string): number {
  const hands = doc.getMap("hands");
  const hand = hands.get(playerId) as Y.Array<any> | undefined;
  return hand ? hand.length : 0;
}

/**
 * Get top discard card
 */
export function getTopDiscard(doc: Y.Doc): Card | null {
  const discard = doc.getArray("discard");
  if (discard.length === 0) {
    return null;
  }
  return discard.get(discard.length - 1) as Card;
}

/**
 * Get deck size
 */
export function getDeckSize(doc: Y.Doc): number {
  const deck = doc.getArray("deck");
  return deck.length;
}

/**
 * Get current turn index
 */
export function getTurnIndex(doc: Y.Doc): number {
  const state = doc.getMap("state");
  return (state.get("turnIndex") as number) || 0;
}

/**
 * Get current player
 */
export function getCurrentPlayer(doc: Y.Doc): Player | null {
  const phase = getPhase(doc);
  if (phase !== "playing") {
    return null;
  }

  const activePlayers = getActivePlayers(doc);
  const turnIndex = getTurnIndex(doc);

  if (turnIndex < 0 || turnIndex >= activePlayers.length) {
    return null;
  }

  return activePlayers[turnIndex];
}

/**
 * Check if it's a player's turn
 */
export function isPlayerTurn(doc: Y.Doc, playerId: string): boolean {
  const currentPlayer = getCurrentPlayer(doc);
  return currentPlayer?.id === playerId;
}

/**
 * Get forced suit (from playing an 8)
 */
export function getForcedSuit(doc: Y.Doc): string | null {
  const state = doc.getMap("state");
  return (state.get("forceSuit") as string) || null;
}

/**
 * Get winner player ID
 */
export function getWinnerPlayerId(doc: Y.Doc): string | null {
  const state = doc.getMap("state");
  return (state.get("winnerPlayerId") as string) || null;
}

/**
 * Get game log
 */
export function getLog(doc: Y.Doc): LogEntry[] {
  const log = doc.getArray("log");
  return log.toArray();
}

/**
 * Check if a card is legal to play
 */
export function isLegalPlay(doc: Y.Doc, card: Card): boolean {
  const topCard = getTopDiscard(doc);
  if (!topCard) {
    return true; // First card can be anything
  }

  const forcedSuit = getForcedSuit(doc);

  // 8s are wild
  if (card.rank === "8") {
    return true;
  }

  // If there's a forced suit (from previous 8), must match that
  if (forcedSuit) {
    return card.suit === forcedSuit;
  }

  // Otherwise, must match rank or suit
  return card.rank === topCard.rank || card.suit === topCard.suit;
}

/**
 * Get legal cards from a hand
 */
export function getLegalCards(doc: Y.Doc, playerId: string): Card[] {
  const hand = getPlayerHand(doc, playerId);
  return hand.filter((card) => isLegalPlay(doc, card));
}
