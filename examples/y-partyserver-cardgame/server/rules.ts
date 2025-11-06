import * as Y from "yjs";
import { Card, getActivePlayers, getPlayerHand, yArrayToArray } from "./schema.js";

/**
 * Check if a card play is legal
 */
export function isLegalPlay(
  doc: Y.Doc,
  card: Card,
  chosenSuit?: string
): boolean {
  const discard = doc.getArray("discard");
  const state = doc.getMap("state");

  if (discard.length === 0) {
    // First card can be anything
    return true;
  }

  const topCard = discard.get(discard.length - 1) as Card;
  const forcedSuit = state.get("forceSuit") as string | undefined;

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
 * Check if it's the given player's turn
 */
export function isPlayerTurn(doc: Y.Doc, playerId: string): boolean {
  const state = doc.getMap("state");
  const phase = state.get("phase");

  if (phase !== "playing") {
    return false;
  }

  const players = getActivePlayers(doc);
  const turnIndex = state.get("turnIndex") as number;

  if (turnIndex < 0 || turnIndex >= players.length) {
    return false;
  }

  return players[turnIndex].id === playerId;
}

/**
 * Advance to the next player's turn
 */
export function advanceTurn(doc: Y.Doc): void {
  const state = doc.getMap("state");
  const players = getActivePlayers(doc);
  const turnIndex = state.get("turnIndex") as number;
  const direction = (state.get("direction") as number) || 1;

  let nextIndex = (turnIndex + direction) % players.length;
  if (nextIndex < 0) {
    nextIndex += players.length;
  }

  state.set("turnIndex", nextIndex);
  state.delete("forceSuit"); // Clear forced suit on turn advance
}

/**
 * Remove a card from a player's hand
 */
export function removeCardFromHand(
  doc: Y.Doc,
  playerId: string,
  cardId: string
): Card {
  const hand = getPlayerHand(doc, playerId);
  const handArray = yArrayToArray<Card>(hand);
  const cardIndex = handArray.findIndex((c) => c.id === cardId);

  if (cardIndex === -1) {
    throw new Error(`Card ${cardId} not in player's hand`);
  }

  const card = handArray[cardIndex];
  hand.delete(cardIndex, 1);
  return card;
}

/**
 * Check if a player has any legal plays
 */
export function hasLegalPlay(doc: Y.Doc, playerId: string): boolean {
  const hand = getPlayerHand(doc, playerId);
  const handArray = yArrayToArray<Card>(hand);

  for (const card of handArray) {
    if (isLegalPlay(doc, card)) {
      return true;
    }
  }

  return false;
}

/**
 * Draw cards from the deck to a player's hand
 */
export function drawCards(doc: Y.Doc, playerId: string, count: number): Card[] {
  const deck = doc.getArray("deck");
  const discard = doc.getArray("discard");
  const hand = getPlayerHand(doc, playerId);

  const drawnCards: Card[] = [];

  for (let i = 0; i < count; i++) {
    // If deck is empty, shuffle discard back into deck (keep top card)
    if (deck.length === 0) {
      if (discard.length <= 1) {
        // No cards left to draw
        break;
      }

      // Move all but top card from discard to deck
      const topCard = discard.get(discard.length - 1);
      const cardsToShuffle: Card[] = [];

      for (let j = 0; j < discard.length - 1; j++) {
        cardsToShuffle.push(discard.get(j) as Card);
      }

      // Simple shuffle without seed (for reshuffling mid-game)
      for (let j = cardsToShuffle.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [cardsToShuffle[j], cardsToShuffle[k]] = [cardsToShuffle[k], cardsToShuffle[j]];
      }

      // Clear discard except top card
      discard.delete(0, discard.length - 1);

      // Add shuffled cards to deck
      deck.push(cardsToShuffle);
    }

    if (deck.length > 0) {
      const card = deck.get(0) as Card;
      deck.delete(0, 1);
      hand.push([card]);
      drawnCards.push(card);
    }
  }

  return drawnCards;
}

/**
 * Get the current player
 */
export function getCurrentPlayer(doc: Y.Doc): string | null {
  const state = doc.getMap("state");
  const phase = state.get("phase");

  if (phase !== "playing") {
    return null;
  }

  const players = getActivePlayers(doc);
  const turnIndex = state.get("turnIndex") as number;

  if (turnIndex < 0 || turnIndex >= players.length) {
    return null;
  }

  return players[turnIndex].id;
}
