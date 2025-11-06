# Collaborative Kanban Board with Cloudflare Durable Objects

A real-time collaborative Kanban board built with valtio-y, React, and Cloudflare Durable Objects.

## Features

- **Real-time Collaboration**: Multiple users can edit the board simultaneously
- **Drag & Drop**: Move cards between columns seamlessly
- **Presence Indicators**: See who's online and which cards they're interacting with
- **Persistent State**: All data stored in Cloudflare Durable Objects
- **Minimal Setup**: No external database required

## Architecture

- **Client**: Vite + React + valtio-y + dnd-kit
- **Server**: Cloudflare Durable Objects with y-partyserver
- **State Sync**: Yjs CRDTs for conflict-free collaboration

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
# Terminal 1: Start the Durable Objects server
bun run dev:server

# Terminal 2: Start the Vite client
bun run dev
```

Then open http://localhost:3000 in multiple browser windows to see real-time collaboration!

### Deployment

```bash
# Deploy to Cloudflare Workers
bun run deploy
```

## How It Works

1. **Durable Objects**: Each Kanban room is a separate Durable Object instance
2. **Yjs Integration**: The DO stores a Y.Doc with columns and cards
3. **valtio-y Binding**: Client-side Valtio proxy is bound to the Y.Doc
4. **Real-time Sync**: Changes propagate instantly via WebSocket
5. **Presence**: Yjs Awareness API tracks online users and their actions

## Project Structure

```
y-partyserver-kanban/
├── server/
│   └── index.ts          # Durable Object implementation
├── src/
│   ├── components/
│   │   ├── Column.tsx    # Kanban column component
│   │   └── Card.tsx      # Draggable card component
│   ├── App.tsx           # Main application
│   ├── main.tsx          # Entry point
│   └── index.css         # Tailwind styles
├── wrangler.toml         # Cloudflare Workers config
├── vite.config.ts        # Vite configuration
└── package.json          # Dependencies and scripts
```

## State Schema

The shared state is structured as:

```typescript
interface KanbanState {
  columns: KanbanColumn[];          // Array of columns
  cards: Record<string, KanbanCard>; // Map of card ID to card
  presence: Record<string, User>;    // Online users
}
```

## Technologies

- [valtio-y](../../valtio-y) - Valtio + Yjs integration
- [Yjs](https://github.com/yjs/yjs) - CRDT library
- [y-partyserver](https://github.com/partykit/partykit/tree/main/packages/y-partyserver) - Yjs provider for Durable Objects
- [dnd-kit](https://dndkit.com/) - Drag and drop
- [React](https://react.dev/) - UI framework
- [Vite](https://vitejs.dev/) - Build tool
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge runtime
