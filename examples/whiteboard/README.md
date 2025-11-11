# Collaborative Whiteboard

A demo application showcasing real-time collaborative drawing powered by **valtio-y**, **Yjs**, **y-partyserver**, and **Cloudflare Durable Objects**.

> ⚠️ **Note:** This is a demonstration application designed to showcase valtio-y's capabilities. It is not production-ready and should be used as a reference for building your own collaborative applications.

## Tech Stack

- **[valtio-y](https://github.com/valtiojs/valtio-y)** - Syncs Valtio state with Yjs CRDTs for seamless real-time collaboration
- **[Yjs](https://docs.yjs.dev/)** - CRDT library for conflict-free data synchronization
- **[y-partyserver](https://github.com/threepointone/partyserver/tree/main/packages/y-partyserver)** - WebSocket server for Yjs on Cloudflare
- **[Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)** - Stateful backend for persistent collaborative sessions
- **React + TypeScript** - Frontend framework with type safety
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first styling

## Scripts

```bash
# Run the local dev experience (Vite + worker)
bun run dev

# Build for production
bun run build

# Preview production build locally
bun run preview

# Deploy to your Cloudflare account
bun run deploy
```

## How It Works

The application uses a unified architecture where a single Cloudflare Worker hosts both the React app and the Durable Object:

1. **YServer Durable Object** (`worker/app.ts`) extends `y-partyserver`'s `YDocServer` to host Yjs documents
2. **Client connects** via WebSocket to `/parties/:party/:room` on the same origin
3. **valtio-y syncs** drawing state between Valtio proxies and Yjs CRDTs
4. **Real-time collaboration** happens automatically through Yjs conflict-free merging

### Testing Collaboration

1. Run `bun run dev`
2. Open `http://localhost:5173` in multiple browser windows
3. Draw in one window and watch it appear in the others in real-time!

## Learn More

- [valtio-y documentation](https://github.com/valtiojs/valtio-y)
- [Yjs documentation](https://docs.yjs.dev/)
- [y-partyserver documentation](https://github.com/threepointone/partyserver/tree/main/packages/y-partyserver)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
