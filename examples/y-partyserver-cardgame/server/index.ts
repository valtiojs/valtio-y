import * as Y from 'yjs';
import { YPartyKitProvider } from 'y-partyserver/provider';

export interface Env {
  CARDGAME_DO: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const roomName = url.pathname.slice(1) || 'default';

    // Get or create the Durable Object instance
    const id = env.CARDGAME_DO.idFromName(roomName);
    const stub = env.CARDGAME_DO.get(id);

    // Forward the request to the Durable Object
    return stub.fetch(request);
  }
};

interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  id: string;
}

interface Player {
  id: string;
  name: string;
  hand: string[]; // card IDs
  connected: boolean;
}

interface GameState {
  deck: string[]; // card IDs
  discard: string[]; // card IDs
  players: Record<string, Player>;
  currentPlayerIndex: number;
  currentSuit: string | null;
  winner: string | null;
  started: boolean;
  cards: Record<string, Card>;
}

export class CardGameDurableObject implements DurableObject {
  private ydoc: Y.Doc;
  private provider: YPartyKitProvider;

  constructor(private state: DurableObjectState) {
    this.ydoc = new Y.Doc();
    this.provider = new YPartyKitProvider(this.ydoc, {
      party: this.state,
      load: this.loadDoc.bind(this),
      save: this.saveDoc.bind(this)
    });

    // Initialize with empty game state
    this.initializeGameState();
  }

  private async loadDoc(): Promise<Uint8Array | undefined> {
    const stored = await this.state.storage.get<Uint8Array>('ydoc');
    return stored;
  }

  private async saveDoc(update: Uint8Array): Promise<void> {
    await this.state.storage.put('ydoc', update);
  }

  private initializeGameState(): void {
    const gameMap = this.ydoc.getMap('game');

    // Only initialize if empty
    if (!gameMap.has('started')) {
      // Create a full deck
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

      gameMap.set('cards', cards);
      gameMap.set('deck', deck);
      gameMap.set('discard', []);
      gameMap.set('players', {});
      gameMap.set('currentPlayerIndex', 0);
      gameMap.set('currentSuit', null);
      gameMap.set('winner', null);
      gameMap.set('started', false);
    }
  }

  async fetch(request: Request): Promise<Response> {
    return this.provider.handleRequest(request);
  }
}
