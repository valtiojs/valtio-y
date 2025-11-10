# Y-PartyServer Drawing Demo

A collaborative drawing application demonstrating real-time synchronization using valtio-y, Yjs, and y-partyserver on Cloudflare Workers.

## Features

- 🚀 Real-time collaborative drawing
- ⚡️ Powered by Yjs CRDTs for conflict-free synchronization
- 🔄 y-partyserver backend on Cloudflare Durable Objects
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📦 Simple Vite + React setup

## Architecture

This example demonstrates a unified worker architecture:

- **Single Cloudflare Worker**: `workers/app.ts` hosts both the React app and the Durable Object
- **YServer (Durable Object)**: `YDocServer` extends `y-partyserver`'s `YServer` to host Yjs documents
- **WebSocket Connection**: Real-time sync over `/parties/:party/:room` on the same origin as the app
- **Client Provider**: `YProvider` connects to the Durable Object through the shared worker
- **React Components**: Drawing canvas with real-time collaboration

## Getting Started

### Installation

Install the dependencies (from the monorepo root):

```bash
bun install
```

### Development

Run the unified dev server:

```bash
bun run dev
```

This starts Vite dev server with the Cloudflare plugin. The worker and Durable Object run alongside the frontend on the same origin (default `http://localhost:5173`), and WebSocket connections are proxied automatically.

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

The example includes a YServer Durable Object (`workers/app.ts`) that:

- Extends the `YDocServer` class from `y-partyserver`
- Hosts Yjs documents in Cloudflare Durable Objects
- Handles WebSocket connections for real-time sync
- Routes requests via `/parties/:party/:room` paths
- Saves document snapshots periodically

### Client Setup

The drawing app (`src/app.tsx`):

- Creates a Yjs document with valtio-y proxy
- Connects to the YServer using YProvider
- Uses valtio-y for reactive state management
- Syncs drawing operations in real-time

### Testing Collaboration

1. Start the dev server with `bun run dev`
2. Open `http://localhost:5173` in multiple browser windows
3. Draw in one window and watch it appear in the others in real-time!

**Note:** The WebSocket connections to `/parties/:party/:room` are handled by the Cloudflare Workers runtime via the `@cloudflare/vite-plugin`.

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
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using Vite, React, Yjs, and y-partyserver.
