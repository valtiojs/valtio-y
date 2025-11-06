# Multiplayer Crazy Eights Card Game with Cloudflare Durable Objects

A real-time multiplayer card game built with valtio-y, React, and Cloudflare Durable Objects.

## Features

- **Real-time Multiplayer**: Play Crazy Eights with friends in real-time
- **Turn-based Gameplay**: Automatic turn management and game flow
- **Card Game Rules**: Match suit or rank, 8s are wild (choose suit)
- **Live Presence**: See who's online and whose turn it is
- **Persistent State**: Game state stored in Cloudflare Durable Objects
- **Winner Detection**: Automatic game completion and play-again functionality

## Game Rules (Crazy Eights)

1. Each player starts with 5 cards
2. On your turn, play a card that matches either:
   - The suit of the top discard card
   - The rank of the top discard card
3. 8s are wild - play an 8 to choose any suit
4. If you can't play, draw a card from the deck
5. First player to empty their hand wins!

## Architecture

- **Client**: Vite + React + valtio-y
- **Server**: Cloudflare Durable Objects with y-partyserver
- **State Sync**: Yjs CRDTs for conflict-free game state

## Getting Started

### Prerequisites

- Bun 1.3.1 or later
- Cloudflare account (for deployment)

### Installation

```bash
# From the example directory
bun install
```

### Development

Run both the Vite dev server and Wrangler dev server:

```bash
# Terminal 1: Start the Durable Objects server (port 8788)
bun run dev:server

# Terminal 2: Start the Vite client (port 3001)
bun run dev
```

Then open http://localhost:3001 in multiple browser windows to play with yourself, or share the link with friends!

### Deployment

```bash
# Deploy to Cloudflare Workers
bun run deploy
```

## How It Works

1. **Durable Objects**: Each game room is a separate Durable Object instance
2. **Yjs Integration**: The DO stores a Y.Doc with game state (deck, hands, discard)
3. **valtio-y Binding**: Client-side Valtio proxy is bound to the Y.Doc
4. **Real-time Sync**: All player actions propagate instantly via WebSocket
5. **Turn Management**: Game logic ensures fair turn-based gameplay

## Project Structure

```
y-partyserver-cardgame/
├── server/
│   └── index.ts              # Durable Object with game initialization
├── src/
│   ├── components/
│   │   ├── PlayingCard.tsx   # Card rendering component
│   │   ├── PlayerList.tsx    # Player sidebar
│   │   └── SuitSelector.tsx  # Modal for choosing suit after playing 8
│   ├── App.tsx               # Main game logic
│   ├── main.tsx              # Entry point
│   └── index.css             # Tailwind styles
├── wrangler.toml             # Cloudflare Workers config
├── vite.config.ts            # Vite configuration
└── package.json              # Dependencies and scripts
```

## State Schema

The shared game state is structured as:

```typescript
interface GameState {
  deck: string[];                    // Card IDs in deck
  discard: string[];                 // Card IDs in discard pile
  players: Record<string, Player>;   // Player data (id, name, hand)
  currentPlayerIndex: number;        // Index of current player
  currentSuit: string | null;        // Active suit (for 8s)
  winner: string | null;             // Winner player ID
  started: boolean;                  // Game in progress?
  cards: Record<string, Card>;       // Card definitions
}
```

## Technologies

- [valtio-y](../../valtio-y) - Valtio + Yjs integration
- [Yjs](https://github.com/yjs/yjs) - CRDT library
- [y-partyserver](https://github.com/partykit/partykit/tree/main/packages/y-partyserver) - Yjs provider for Durable Objects
- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge runtime

## Gameplay Tips

- **Drawing Cards**: If you can't play, click "Draw Card" to add one to your hand
- **Passing**: Use "Pass" to skip your turn without drawing
- **8s Strategy**: Playing an 8 lets you choose the suit - use wisely!
- **Watch the Count**: Keep an eye on other players' card counts to anticipate the end
