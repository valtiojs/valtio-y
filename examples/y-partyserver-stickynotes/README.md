# Collaborative Sticky Notes with Cloudflare Durable Objects

A real-time collaborative sticky notes board powered by valtio-y, Yjs, and Cloudflare Durable Objects.

## Features

- **Create & Edit Notes**: Add sticky notes with custom colors and text
- **Drag & Drop**: Click and drag notes anywhere on the board
- **Resize**: Drag the corner handle to resize notes
- **Real-time Sync**: All changes sync instantly across all connected clients
- **Presence Awareness**: See other users' cursors and which notes they're editing
- **Persistent State**: Notes are stored in a Cloudflare Durable Object
- **Offline Support**: Changes queue and sync when reconnected

## Architecture

This example uses a Cloudflare Workers + Durable Objects backend for real-time collaboration:

- **Client**: Vite + React + valtio-y
- **Server**: Cloudflare Durable Objects with Yjs sync protocol
- **Communication**: WebSocket connections for real-time sync

Each room is a separate Durable Object instance that maintains a Yjs document and handles WebSocket connections from multiple clients.

## Getting Started

### Prerequisites

- Bun 1.3.1+
- Cloudflare account (for deployment)

### Installation

From the repository root:

```bash
# Install dependencies
bun install
```

### Development

Start both the worker and client with a single command:

```bash
cd examples/y-partyserver-stickynotes
bun run dev
```

This starts:
- Cloudflare Workers dev server on port 8787 (for the Durable Object backend)
- Vite dev server (for the React frontend)

Open http://localhost:5173 in your browser.

**Note:** If you need to run them separately, you can use:
- `bun run dev:worker` - Start only the worker server
- `vite` - Start only the Vite dev server

### Testing Multi-User Collaboration

1. Open http://localhost:5173 in multiple browser windows or tabs
2. Create, edit, drag, or resize notes in one window
3. Watch the changes sync instantly to all other windows
4. Hover over notes to see which user is editing them

### Using Different Rooms

You can create separate rooms by adding a hash to the URL:

- http://localhost:5173#room1
- http://localhost:5173#room2

Each room maintains its own separate set of notes.

## How It Works

### Data Model

The application state is stored in a Yjs document with the following structure:

```typescript
interface AppState {
  notes: Record<string, StickyNote>;  // Map of note ID → note
  nextZ: number;  // For z-index management
}

interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
  z: number;
}
```

### valtio-y Integration

The Yjs document is wrapped with valtio-y, allowing you to work with it like a normal JavaScript object:

```typescript
// Add a note
proxy.notes[newNote.id] = newNote;

// Update a note
proxy.notes[noteId].text = "Updated text";

// Delete a note
delete proxy.notes[noteId];
```

**Why Record instead of Array?**

Using `Record<string, StickyNote>` instead of `StickyNote[]` enables true granular reactivity:
- Each note gets its own Valtio proxy (via valtio-y's nested Y.Map support)
- Updating one note only re-renders that specific note component
- Prevents unnecessary re-renders and cursor position issues
- Better performance with large numbers of notes

When iterating in React, use `Object.entries()` and pass the proxy object directly:

```typescript
{Object.entries(proxy.notes).map(([noteId, note]) => (
  <StickyNote key={noteId} note={note} />  // Pass proxy, not snapshot!
))}
```

All changes are automatically:
1. Reflected in React components via `useSnapshot(proxy)`
2. Synced to the Yjs CRDT
3. Broadcast to all connected clients
4. Persisted in the Durable Object

### Server Architecture

The Durable Object server (`server/index.ts`):

1. Maintains a Y.Doc instance for the room
2. Handles WebSocket connections from clients
3. Broadcasts Yjs updates to all connected clients
4. Manages awareness (presence) state
5. Initializes rooms with sample notes

## Deployment

### Deploy to Cloudflare

1. Install Wrangler CLI:
```bash
bun add -g wrangler
```

2. Authenticate with Cloudflare:
```bash
wrangler login
```

3. Deploy the worker:
```bash
cd examples/y-partyserver-stickynotes
bun run deploy
```

4. Build and deploy the client to your hosting service of choice (Cloudflare Pages, Vercel, Netlify, etc.)

Update the WebSocket URL in `src/yjs-setup.ts` to point to your deployed worker.

## Project Structure

```
y-partyserver-stickynotes/
├── server/
│   └── index.ts           # Durable Object server with Yjs sync
├── src/
│   ├── components/
│   │   ├── Toolbar.tsx    # Top toolbar with controls
│   │   ├── StickyNote.tsx # Individual sticky note component
│   │   └── Cursor.tsx     # Other users' cursor display
│   ├── app.tsx            # Main application component
│   ├── main.tsx           # React entry point
│   ├── yjs-setup.ts       # Yjs & valtio-y setup, WebSocket provider
│   ├── types.ts           # TypeScript type definitions
│   └── styles.css         # Global styles
├── wrangler.toml          # Cloudflare Workers configuration
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Key Concepts

### Real-time Collaboration with CRDTs

This example uses Yjs, a CRDT (Conflict-free Replicated Data Type) library, which ensures that:

- Changes from multiple users are automatically merged without conflicts
- The order of operations doesn't matter
- Users can work offline and sync when reconnected
- No central authority is needed to resolve conflicts

### Valtio Integration

valtio-y bridges Valtio's reactive state management with Yjs CRDTs:

- Write state changes using familiar JavaScript operations
- React components automatically re-render when data changes
- All changes are automatically synced via Yjs

### Presence Awareness

The Yjs Awareness protocol tracks ephemeral user state:

- Cursor positions
- Selected/editing notes
- User names and colors

This state is temporary and not persisted in the CRDT.

## Important Implementation Details

### Preventing Cursor Jumps in Text Inputs

When building collaborative editors with Valtio, you may encounter **cursor position jumping to the end** when typing in controlled inputs. This is caused by Valtio's default async batching behavior.

**The solution: Use `sync: true` option (No workarounds needed!)**

```typescript
// Add sync: true to useSnapshot for text inputs
const noteSnapshot = useSnapshot(note, { sync: true });

// Now you can use standard controlled input pattern
const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  note.text = e.target.value;  // Direct proxy mutation works perfectly!
};

<textarea value={noteSnapshot.text} onChange={handleTextChange} />
```

**Why this works:**

- Valtio's default batching uses microtasks (async), which causes React to treat updates as separate operations
- This breaks cursor position tracking in controlled inputs
- `sync: true` forces synchronous updates, keeping cursor position intact
- Real-time character-by-character sync works perfectly!
- **No local state buffering needed** - this is the clean, simple solution

**What this enables:**
- ✅ Standard controlled input pattern (no workarounds)
- ✅ Direct proxy mutations on every keystroke
- ✅ Real-time collaboration with perfect cursor tracking
- ✅ Automatic sync via valtio-y + Yjs

**References:**
- See [Valtio Issue #270](https://github.com/pmndrs/valtio/issues/270) for the original discussion
- Implementation in `src/components/StickyNote.tsx`

## Learn More

- [valtio-y Documentation](../../README.md)
- [Yjs Documentation](https://docs.yjs.dev/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Valtio Documentation](https://valtio.pmnd.rs/)

## License

MIT
