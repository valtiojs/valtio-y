# 🃏 Crazy Eights - Multiplayer Card Game Example

A real-time, multiplayer implementation of Crazy Eights demonstrating **valtio-y** with **Yjs** CRDTs and **React**.

## Features

- ✅ **Multi-player game** with real-time synchronization
- ✅ **Local network simulation** for development and demonstration
- ✅ **Side-by-side clients** showing live state sync
- ✅ **Full Crazy Eights rules**:
  - Match suit or rank of the top card
  - 8s are wild - choose any suit
  - Draw if you can't play
  - First to empty their hand wins!

## Architecture

This example demonstrates valtio-y's capabilities using **local network simulation**. Three clients run in the same browser window, each with its own Y.Doc that syncs through a simulated network relay.

### How It Works

1. **Three Y.Docs**: Each client has its own `Y.Doc` instance
2. **Network Relay**: Updates relay between docs with simulated network delay (50ms)
3. **Valtio Integration**: `createYjsProxy()` creates reactive proxies over each Y.Doc
4. **React UI**: Components use `useSnapshot()` to reactively render game state
5. **Direct Mutations**: Game actions mutate the proxy directly - changes sync automatically

### Game State

All state is stored in Yjs structures:

```typescript
{
  phase: "lobby" | "playing" | "finished",
  players: Player[],               // Array of players
  deck: Card[],                    // Remaining cards
  discard: Card[],                 // Played cards
  hands: Record<playerId, Card[]>, // Each player's hand
  currentPlayerIndex: number,      // Whose turn it is
  forcedSuit?: Suit,              // Suit chosen from playing an 8
  winnerId?: string,              // Winner's player ID
  log: Array<{t: number, msg: string}> // Game log
}
```

### Code Structure

```
src/
├── yjs-setup.ts       # Y.Doc setup, network relay, game logic
├── App.tsx            # Main app with 3 side-by-side clients
├── components/
│   └── ClientView.tsx # Individual client/player view
└── main.tsx           # Entry point
```

## Getting Started

### Installation

This example is part of the valtio-y monorepo. From the repository root:

```bash
# Install all dependencies (uses Bun workspace)
bun install
```

### Development

Run from the example directory:

```bash
cd examples/y-partyserver-cardgame
bun run dev
```

This starts Vite on `http://localhost:3000` (or next available port).

Open your browser and you'll see three clients side-by-side. Try:
1. Join with different names in each client
2. First player to join is the host
3. Host starts the game
4. Take turns playing cards - watch updates sync instantly!

### Type Checking

```bash
bun run typecheck
```

## Game Rules

**Objective**: Be the first player to play all your cards!

**On Your Turn**:
1. **Play a card** that matches the top discard's suit or rank
2. **8s are wild** - play an 8 and choose any suit
3. **Can't play?** Draw a card from the deck
4. **Pass** to end your turn

**Winning**: Empty your hand first!

## Production Deployment

This example uses **local simulation** for demonstration. For real multiplayer, replace the relay code in `yjs-setup.ts` with a network provider:

### Using y-websocket

```typescript
import { WebsocketProvider } from "y-websocket";

const doc = new Y.Doc();
const provider = new WebsocketProvider("ws://yourserver.com", "room-name", doc);

const { proxy } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("cardgame"),
});
```

### Using y-webrtc

```typescript
import { WebrtcProvider } from "y-webrtc";

const doc = new Y.Doc();
const provider = new WebrtcProvider("room-name", doc);

const { proxy } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("cardgame"),
});
```

### Using y-partyserver

```typescript
import PartySocket from "partysocket";
import { IndexeddbPersistence } from "y-indexeddb";

const doc = new Y.Doc();

// Connect to PartyKit server
const provider = new PartySocket({
  host: "your-app.username.partykit.dev",
  room: "room-name",
});

// Optional: Add offline persistence
const persistence = new IndexeddbPersistence("cardgame", doc);

const { proxy } = createYjsProxy(doc, {
  getRoot: (doc) => doc.getMap("cardgame"),
});
```

## Key Concepts

### Direct Mutations

valtio-y lets you mutate state directly:

```typescript
// Add a player
gameState.players.push({ id: "player-1", name: "Alice", ... });

// Play a card
const card = gameState.hands["player-1"].shift();
gameState.discard.push(card);

// Change game phase
gameState.phase = "playing";
```

All mutations automatically convert to Yjs operations and sync across clients!

### Reactive UI

Use Valtio's `useSnapshot()` for reactive rendering:

```typescript
import { useSnapshot } from "valtio/react";

function GameView({ gameState }) {
  const snap = useSnapshot(gameState);

  return (
    <div>
      <p>Phase: {snap.phase}</p>
      <p>Players: {snap.players.length}</p>
      <p>Your hand: {snap.hands["player-1"]?.length} cards</p>
    </div>
  );
}
```

Components automatically re-render when accessed state changes!

## Tech Stack

- **Valtio** - Reactive state management
- **Yjs** - CRDT for conflict-free state sync
- **valtio-y** - Bridge between Valtio and Yjs
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling

## License

MIT
