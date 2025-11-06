# Collaborative Pixel Art Editor

A real-time collaborative pixel art editor built with valtio-y, Yjs, and PartyKit.

## Features

- 🎨 **32×32 Pixel Grid** - Shared canvas for collaborative drawing
- 🖌️ **Drawing Tools** - Pencil, Eraser, and Color Picker
- 🌈 **Color Palette** - 20 preset colors plus custom color picker
- 👥 **Real-time Presence** - See other users' cursors with their names
- 🔄 **Instant Sync** - Changes sync automatically across all connected clients
- 💾 **Persistence** - Drawing is shared across all clients in the same room

## Architecture

This example demonstrates the full stack for real-time collaborative apps:

```
Frontend (Vite + React)
    ↓
valtio-y (State Management)
    ↓
Yjs (CRDT)
    ↓
y-partyserver (Provider)
    ↓
PartyKit Server (WebSocket + Sync)
```

## Setup

1. **Install dependencies:**

   From the repository root:
   ```bash
   bun install
   ```

2. **Run development server:**
   ```bash
   cd examples/y-partyserver-pixelart
   bun run dev
   ```

   This starts both:
   - PartyKit server on `localhost:1999` (shared across all examples)
   - Vite dev server on `localhost:3000`

3. **Open the app:**
   - Navigate to `http://localhost:3000`
   - Open multiple tabs to see real-time collaboration

## How It Works

### State Management

The pixel grid is stored as a 2D array in a Yjs document:

```typescript
interface AppState {
  grid: {
    pixels: (string | null)[][];  // 32x32 array of colors
  };
}
```

### Drawing Logic

When a user draws, valtio-y handles the sync:

```typescript
// Simple mutation - valtio-y converts it to Yjs operations
proxy.grid.pixels[row][col] = selectedColor;
```

### Presence Layer

User cursors use Yjs Awareness for ephemeral state:

```typescript
// Update cursor position
awareness.setLocalStateField("cursor", { x: col, y: row });

// Listen for other users' cursors
awareness.on("change", () => {
  const states = awareness.getStates();
  // Render cursors...
});
```

### Shared Server

This example connects to the shared PartyKit server in `examples/party-server/`. All examples use the same server, but different room names ensure documents don't conflict.

## File Structure

```
y-partyserver-pixelart/
├── src/
│   ├── components/
│   │   ├── pixel-grid.tsx      # Main drawing canvas
│   │   ├── color-palette.tsx   # Color selection
│   │   ├── toolbar.tsx         # Tool selection
│   │   └── connection-status.tsx
│   ├── app.tsx            # Main app component
│   ├── main.tsx           # Entry point
│   ├── types.ts           # TypeScript types
│   ├── yjs-setup.ts       # Yjs doc + provider setup
│   └── styles.css         # Tailwind styles
├── package.json
├── vite.config.ts
└── index.html
```

## Key Concepts

### Local-First

- All mutations are applied locally first (instant feedback)
- Then synchronized in the background
- Works offline and syncs when reconnected

### CRDT Conflict Resolution

- Multiple users can edit the same pixel
- Last write wins (based on Lamport timestamps)
- No manual conflict resolution needed

### Separation of Concerns

- **Shared state** (`proxy`) - Synced via Yjs (grid data)
- **Local UI state** (`uiState`) - Not synced (tool selection, drawing flag)
- **Presence** (`awareness`) - Ephemeral state (cursors)

## Learn More

- [valtio-y Documentation](../../README.md)
- [Yjs Documentation](https://docs.yjs.dev/)
- [PartyKit Documentation](https://docs.partykit.io/)
- [y-partyserver](https://github.com/partykit/partykit/tree/main/packages/y-partyserver)
