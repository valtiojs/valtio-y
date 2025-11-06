# Multiplayer Tic-Tac-Toe with valtio-y

A real-time multiplayer Tic-Tac-Toe game built with **valtio-y**, **Cloudflare Durable Objects**, and **Wrangler**. This example demonstrates how to build collaborative applications with persistent state sync across multiple clients.

## Features

- 🎮 **Real-time multiplayer** - Two players can play together, with spectator support
- 🔄 **Auto-sync** - All game state syncs automatically across clients via Yjs
- 🏆 **Score tracking** - Keeps track of wins, losses, and draws for the session
- 🎨 **Beautiful UI** - Modern, responsive design with Tailwind CSS
- ⚡ **Cloudflare Durable Objects** - Persistent state with WebSocket support
- 🚀 **Fast development** - Vite for client + Wrangler for local DO development

## Architecture

This example uses:

- **Client**: Vite + React + valtio-y + y-partyserver provider
- **Server**: Cloudflare Durable Objects + y-partyserver
- **State Sync**: All game state lives in a Y.Doc inside the Durable Object
- **Network**: WebSocket connection between client and Durable Object

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) 1.3.1 or later
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) 3.0 or later (installed as dev dependency)

### Installation

From the example directory:

```bash
# Install dependencies
bun install
```

### Development

Run both the Durable Object server and Vite dev server:

```bash
# Run both server and client
bun run dev

# Or run separately in different terminals:
bun run dev:server  # Wrangler dev server on port 8787
bun run dev:client  # Vite dev server on port 5173
```

Then open http://localhost:5173 in multiple browser windows or tabs to test multiplayer functionality.

### Using Different Rooms

To play in different rooms, add a `?room=<room-id>` query parameter:

- http://localhost:5173?room=game1
- http://localhost:5173?room=game2

Each room maintains its own independent game state.

## How It Works

### Server Side (Durable Objects)

The `TicTacToeRoom` Durable Object extends `YPartyKitDurable` from `y-partyserver`, which:

1. Manages a Y.Doc instance with game state
2. Handles WebSocket connections from clients
3. Syncs Yjs updates bidirectionally
4. Persists state automatically via Durable Objects storage

### Client Side

The client uses:

1. **valtio-y** to create a reactive proxy around the Y.Doc
2. **y-partyserver provider** to connect to the Durable Object via WebSocket
3. **React** components that read from the proxy using `useSnapshot()`
4. Direct mutations to the proxy (e.g., `proxy.board[0] = 'X'`) automatically sync

### Game State Structure

```typescript
{
  board: [null, null, null, null, null, null, null, null, null], // 3x3 grid
  currentPlayer: 'X' | 'O',
  winner: 'X' | 'O' | 'draw' | null,
  winningLine: number[] | null,  // indices of winning cells
  scores: { X: 0, O: 0, draws: 0 },
  players: { X: clientId | null, O: clientId | null },
  spectators: string[]  // array of spectator client IDs
}
```

## Deployment

To deploy to Cloudflare Workers:

1. Update your Cloudflare account ID in `wrangler.toml` (or use `wrangler login`)
2. Update the production WebSocket URL in `src/yjs-setup.ts`
3. Build the client: `bun run build`
4. Deploy the worker: `wrangler deploy`

## Project Structure

```
y-partyserver-tictactoe/
├── server/
│   └── index.ts           # Durable Object + Worker entry point
├── src/
│   ├── components/        # React components
│   │   ├── Board.tsx      # Game board grid
│   │   ├── Cell.tsx       # Individual cell
│   │   ├── GameStatus.tsx # Status display
│   │   ├── GameControls.tsx # Reset/new game buttons
│   │   └── SyncStatus.tsx # Connection indicator
│   ├── hooks/
│   │   └── useGameActions.ts # Game logic hooks
│   ├── game-logic.ts      # Win detection, board utils
│   ├── yjs-setup.ts       # Y.Doc + Provider setup
│   ├── types.ts           # TypeScript types
│   ├── App.tsx            # Main app component
│   ├── main.tsx           # React entry point
│   └── styles.css         # Tailwind styles
├── wrangler.toml          # Cloudflare Workers config
├── vite.config.ts         # Vite config with WebSocket proxy
├── package.json           # Dependencies and scripts
└── README.md              # This file
```

## Key Concepts

### Player Assignment

- First client to connect becomes player X
- Second client becomes player O
- Additional clients become spectators
- Assignment is automatic on `joinGame()` call

### Turn Management

- Only the current player can make moves
- Turn switches automatically after each valid move
- Spectators can watch but not play

### Win Detection

- Checks all rows, columns, and diagonals after each move
- Highlights winning cells with green background
- Updates score immediately

### Presence System

- Each client has a unique `clientId`
- Player roles are stored in shared state
- Spectators are tracked in an array

## Learn More

- [valtio-y Documentation](../../README.md)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [y-partyserver](https://github.com/threepointone/y-partyserver)
- [Yjs](https://docs.yjs.dev/)

## License

MIT
