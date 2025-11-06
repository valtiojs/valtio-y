# Y-PartyServer Todo Example

A collaborative text editing application demonstrating real-time synchronization using Yjs and y-partyserver on Cloudflare Workers.

## Features

- 🚀 Real-time collaborative text editing
- ⚡️ Powered by Yjs CRDTs for conflict-free synchronization
- 🔄 y-partyserver backend on Cloudflare Durable Objects
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📦 React Router for frontend routing

## Architecture

This example demonstrates:
- **Y-Party Worker**: Separate Cloudflare Worker hosting the YServer Durable Object
- **YServer (Durable Object)**: A y-partyserver instance that hosts Yjs documents
- **WebSocket Connection**: Real-time bidirectional communication to `ws://localhost:8788/party/:room`
- **Client Provider**: YProvider connects directly to the Y-Party worker and syncs local Yjs documents
- **React Component**: CollaborativeTextBox uses Yjs for collaborative text editing

## Getting Started

### Installation

Install the dependencies (from the monorepo root):

```bash
bun install
```

### Development

This example uses **two separate workers**:
1. **Main worker**: React Router app (port 5173) - serves the UI
2. **Y-Party worker**: Durable Objects for WebSocket connections (port 8788) - handles Yjs sync

**Start both workers with one command**:

```bash
bun run dev
```

This runs both workers in parallel:
- Y-Party worker on `http://localhost:8788`
- React Router app on `http://localhost:5173`

**Why two workers?** React Router 7 doesn't properly handle WebSocket upgrades when Durable Objects are in the same worker. The client connects directly to the Y-Party worker on port 8788 for WebSocket sync.

Alternatively, you can run them separately in different terminals:
```bash
# Terminal 1
bun run dev:y-party

# Terminal 2
bun run dev:app
```

## Previewing the Production Build

Preview the production build locally:

```bash
bun run preview
```

## Building for Production

Create a production build:

```bash
bun run build
```

## How It Works

### Server Setup

The example includes a YServer Durable Object (`workers/y-server.ts`) that:
- Extends the `YServer` class from y-partyserver
- Hosts Yjs documents in Cloudflare Durable Objects
- Handles WebSocket connections for real-time sync
- Routes requests via `/party/:room` paths

### Client Setup

The CollaborativeTextBox component (`app/components/collaborative-text-box.tsx`):
- Creates a Yjs document with a Y.Text type
- Connects to the YServer using YProvider
- Observes changes to the Yjs document and updates the UI
- Sends local changes to the server for synchronization

### Testing Collaboration

1. Start the dev server with `bun run dev`
2. Open `http://localhost:5173` in multiple browser windows
3. Type in one window and watch the text appear in the others in real-time!

**Note:** The WebSocket connections to `/party/:room` are handled by the Cloudflare Workers runtime via the `@cloudflare/vite-plugin`.

## Deployment

Deployment is done using the Wrangler CLI.

To build and deploy directly to production:

```sh
bun run deploy
```

To deploy a preview URL:

```sh
npx wrangler versions upload
```

You can then promote a version to production after verification or roll it out progressively.

```sh
npx wrangler versions deploy
```

## Learn More

- [y-partyserver documentation](https://github.com/threepointone/partyserver/tree/main/packages/y-partyserver)
- [Yjs documentation](https://docs.yjs.dev/)
- [React Router documentation](https://reactrouter.com/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router, Yjs, and y-partyserver.
