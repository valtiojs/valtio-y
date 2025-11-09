# Sticky Notes Example - Cloudflare Workers + Durable Objects

Real-time collaborative sticky notes powered by valtio-y, running on Cloudflare Workers.

## Architecture

This example uses a **unified Cloudflare Worker** that serves both:

- **React App**: Static assets via Cloudflare's `assets` config
- **Yjs Server**: WebSocket connections at `/collab/*` using Durable Objects

## Development

```bash
# Install dependencies
bun install

# Start dev server (runs both React app and Worker)
bun run dev

# Test if worker is running
# Open browser to: http://localhost:5173/api/health
# Should see: {"status":"ok","worker":"running"}
```

## Testing the Connection

1. **Verify Worker Health**:

   ```bash
   curl http://localhost:5173/api/health
   # Should return: {"status":"ok","worker":"running"}
   ```

2. **Check WebSocket Endpoint**:
   The app connects to: `ws://localhost:5173/collab/[room-name]`
3. **View Logs**:
   The worker logs appear in the terminal running `bun run dev`

## Routes

- `/` - React app (SPA)
- `/collab` - Yjs WebSocket server (default room)
- `/collab/[room]` - Yjs WebSocket server (specific room)
- `/api/health` - Health check endpoint

## Deployment

```bash
# Build and deploy to Cloudflare
bun run deploy

# Your app will be available at:
# https://valtio-y-stickynotes.YOUR_ACCOUNT.workers.dev
```

## Project Structure

```
├── src/                # React application
│   ├── app.tsx        # Main app component
│   ├── yjs-setup.ts   # Yjs and valtio-y configuration
│   └── components/    # React components
├── worker/            # Cloudflare Worker
│   └── index.ts       # Worker + Durable Object
├── wrangler.jsonc     # Cloudflare configuration
├── vite.config.ts     # Vite + Cloudflare plugin
└── tsconfig.*.json    # TypeScript project references
```

## How It Works

### Development Mode (`bun run dev`)

1. **Vite** starts on port 5173
2. **@cloudflare/vite-plugin** automatically:
   - Reads `wrangler.jsonc`
   - Starts a local Worker
   - Proxies `/collab/*` and `/api/*` to the Worker
3. **Worker** routes `/collab/*` to Durable Objects
4. **Durable Objects** handle Yjs sync and WebSocket connections

### Production Mode (deployed)

1. Single Worker handles all requests
2. `/collab/*` → Durable Objects (Yjs sync)
3. All other routes → Static assets (React app)

## Troubleshooting

### Worker not responding in dev mode?

1. Check if the health endpoint works:

   ```bash
   curl http://localhost:5173/api/health
   ```

2. If not working, try:

   ```bash
   # Kill any existing processes
   pkill -f wrangler
   pkill -f vite

   # Regenerate types
   bun run cf-typegen

   # Rebuild
   bun run build

   # Start fresh
   bun run dev
   ```

3. Check terminal logs for errors

### WebSocket connection failing?

1. Open browser DevTools → Network tab → WS filter
2. Look for WebSocket connection to `/collab/[room]`
3. Check for upgrade errors or connection refused

### TypeScript errors?

```bash
# Regenerate Cloudflare types
bun run cf-typegen

# Type check
tsc -b
```

## Notes

- The example uses ephemeral Durable Objects (resets every minute in dev)
- For production, adjust the cleanup interval in `worker/index.ts`
- Each room is a separate Durable Object instance
- WebSocket connections are managed by `y-partyserver`
