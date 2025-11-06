# 🃏 Crazy Eights - Multiplayer Card Game

A real-time, multiplayer implementation of Crazy Eights using **PartyKit**, **Yjs**, and **React**.

## Features

- ✅ **2-6 players** per room (spectators allowed)
- ✅ **Server-authoritative** game logic prevents cheating
- ✅ **Deterministic shuffle** using seeded RNG for reproducible games
- ✅ **Real-time sync** via Yjs CRDTs
- ✅ **Game chat** and action log
- ✅ **Reconnection support** - rejoin and resume playing
- ✅ **Full Crazy Eights rules**:
  - Match suit or rank of the top card
  - 8s are wild - choose any suit
  - Draw if you can't play
  - First to empty their hand wins!

## Architecture

### Server (PartyKit)

- **Authoritative state**: All game mutations happen server-side
- **Validation**: Server validates every player action
- **Deterministic shuffle**: Seeded RNG ensures reproducible game states
- **Y.Doc storage**: Game state stored in Yjs document for automatic sync

### Client (React)

- **Non-optimistic UI**: Clients send intents, wait for server state updates
- **Yjs sync**: Automatic state synchronization via WebSocket
- **React hooks**: Clean integration with Y.Doc updates

### Data Model

All state lives in a single `Y.Doc` per room:

```typescript
state: Y.Map
  - phase: "lobby" | "playing" | "finished"
  - seed: string (server-generated)
  - turnIndex: number
  - direction: 1 | -1
  - winnerPlayerId?: string
  - forceSuit?: string (from playing an 8)

players: Y.Map<playerId, Y.Map>
  - id, name, joinedAt, isHost, isSpectator

hands: Y.Map<playerId, Y.Array<Card>>

deck: Y.Array<Card>

discard: Y.Array<Card>

log: Y.Array<{t: number, msg: string}>

settings: Y.Map
  - startingHand: 7
  - drawOnNoMatch: 1
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm, pnpm, or bun

### Installation

```bash
npm install
```

### Development

Run both the PartyKit server and Vite dev server:

```bash
npm run dev
```

This starts:
- **PartyKit server** on `ws://localhost:1999`
- **Vite dev server** on `http://localhost:3000`

Open multiple browser tabs to test multiplayer!

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

## How to Play

1. **Join a Room**
   - Open the app and enter your name
   - Optionally join as a spectator
   - Share the room URL with friends

2. **Start the Game**
   - Wait for at least 2 players to join
   - Host clicks "Start Game"
   - Each player gets 7 cards

3. **Take Your Turn**
   - When it's your turn, play a card that matches the suit or rank of the top discard
   - **8s are wild**: Choose any suit when playing an 8
   - **Can't play?** Draw a card, then pass

4. **Win Condition**
   - First player to empty their hand wins! 🎉

5. **New Game**
   - Host can reset the game to lobby

## Server Operations

All client actions go through validated server operations:

| Operation | Description | Validation |
|-----------|-------------|------------|
| `JOIN` | Join game as player or spectator | Phase must be "lobby", max 6 players |
| `START` | Start the game | Only host, min 2 players |
| `PLAY_CARD` | Play a card from hand | Must be player's turn, card must be legal |
| `DRAW` | Draw card(s) from deck | Must be player's turn |
| `PASS` | Pass turn | Must be player's turn |
| `CHAT` | Send chat message | Max 500 chars |
| `RESET` | Reset game to lobby | Only host |

## Anti-Cheat Features

- ✅ **Server-side validation**: All moves validated before applying
- ✅ **Read-only hands**: Clients can't directly mutate their hands
- ✅ **Authoritative shuffle**: Server controls card distribution
- ✅ **Turn enforcement**: Only active player can act

## Tech Stack

- **PartyKit** - WebSocket server infrastructure
- **Yjs** - CRDT for state synchronization
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling

## File Structure

```
examples/y-partyserver-cardgame/
├── server/
│   ├── index.ts           # PartyKit server entry
│   ├── ops.ts             # Operation handlers
│   ├── rules.ts           # Game logic
│   ├── rng.ts             # Seeded RNG
│   └── schema.ts          # Y.Doc schema
├── src/
│   ├── views/
│   │   ├── Lobby.tsx      # Lobby view
│   │   └── Table.tsx      # Game table
│   ├── components/
│   │   ├── Hand.tsx       # Player hand
│   │   ├── PlayersBar.tsx # Player list
│   │   ├── Chat.tsx       # Chat/log
│   │   ├── SuitPicker.tsx # Suit selection for 8s
│   │   └── HUD.tsx        # Game HUD
│   ├── y/
│   │   ├── useYDoc.tsx    # Y.Doc connection
│   │   └── selectors.ts   # State selectors
│   ├── App.tsx
│   └── main.tsx
├── partykit.config.ts
├── package.json
└── README.md
```

## Development Tips

### Testing Multiplayer

1. Open multiple browser tabs
2. Use different names for each player
3. Test reconnection by refreshing a tab mid-game

### Debugging

- Check browser console for client logs
- Check terminal for PartyKit server logs
- All operations are logged to the game log (visible in chat)

### Seeded Games

For testing, you can reuse game seeds:
1. Check the console for the seed when a game starts
2. Modify `handleStart` to use a fixed seed for reproducible tests

## Known Limitations

- No persistence (games reset on server restart)
- No player authentication
- No spectator-specific UI enhancements
- Deck reshuffling uses non-seeded shuffle (when deck runs out mid-game)

## Future Enhancements

- [ ] Spectator mode toggle in-game
- [ ] Room code sharing UI
- [ ] Mobile-optimized layout
- [ ] House rules panel (reverse, skip, draw-2)
- [ ] Game statistics/analytics
- [ ] Player avatars/emojis
- [ ] Sound effects

## License

MIT
