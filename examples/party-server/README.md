# Shared PartyKit Server for valtio-y Examples

This directory contains a shared PartyKit server used by all valtio-y examples for real-time synchronization.

## What is This?

This is a simple [PartyKit](https://partykit.io) server that uses [y-partyserver](https://github.com/cloudflare/partykit/tree/main/packages/y-partyserver) to provide Yjs document synchronization. All examples connect to this server to enable real-time collaboration.

## Running the Server

The server is automatically started when you run any example's dev script. However, you can also run it standalone:

```bash
cd examples/party-server
bun install
bun run dev
```

The server will start on `http://localhost:1999`.

## How It Works

1. **Each example connects** to this server using `y-partyserver/provider`
2. **Each room** (identified by a room name) gets its own Y.Doc
3. **All clients** in the same room share the same document and sync automatically
4. **Documents are ephemeral** - they exist only while clients are connected

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Example 1  │────▶│             │◀────│  Example 2  │
│   Client    │     │  PartyKit   │     │   Client    │
│             │     │   Server    │     │             │
└─────────────┘     │             │     └─────────────┘
                    │  (Y.Doc)    │
┌─────────────┐     │             │     ┌─────────────┐
│  Example 3  │────▶│             │◀────│  Example 4  │
│   Client    │     │             │     │   Client    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## For Production

For production use, you would want to:

1. **Add persistence** by implementing `onLoad` and `onSave` hooks
2. **Add authentication** to control access to documents
3. **Deploy to PartyKit Cloud** or Cloudflare Workers
4. **Add monitoring** and error handling

See the [y-partyserver documentation](https://github.com/cloudflare/partykit/tree/main/packages/y-partyserver) for more details.
