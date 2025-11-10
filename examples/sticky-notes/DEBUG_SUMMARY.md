# Sync Issue Debug Summary

## **ISSUE DESCRIPTION**

The valtio-y sticky notes app shows "Connected" status but **notes don't load after page refresh**.

- ✅ **Works**: First time navigating to a room (with hash change)
- ✅ **Works**: After hot module reload (HMR)
- ❌ **Fails**: After page refresh (F5 / Cmd+R)

## **ARCHITECTURE**

```
React App (http://localhost:5173)
  └─> y-partyserver YProvider
      └─> WebSocket to Cloudflare Worker
          └─> Routes to Durable Object (via getServerByName)
              └─> YServer with Y.Doc containing notes
```

## **KEY FINDINGS FROM DEBUGGING**

### 1. **WebSocket URL Pattern**

From console logs, `y-partyserver` creates URLs like this:

```javascript
// y-partyserver behavior:
provider.url: "ws://localhost:5173/collab/default"  // When room='' and prefix='/collab/default'
provider.url: "ws://localhost:5173/collab"          // When room='default' and prefix='/collab'
provider.roomname: "default"  // Stored separately
```

**Critical Discovery**: When `room` parameter is provided, y-partyserver uses:
- URL: `prefix` only (e.g., `/collab`)
- Room name: Sent via PartyServer protocol (headers or handshake), NOT in URL path

### 2. **Worker Routing Logic**

The Cloudflare Worker in `worker/index.ts` extracts the room from the URL path:

```typescript
// Line 200-214 in worker/index.ts
if (url.pathname === "/collab" || url.pathname.startsWith("/collab/")) {
  let roomId = "default";
  
  if (url.pathname.startsWith("/collab/") && url.pathname.length > 8) {
    const extracted = url.pathname.slice(8); // Remove "/collab/"
    roomId = extracted || "default";
  }
  
  const stub = await getServerByName(env.STICKYNOTES_DO, roomId);
  return stub.fetch(request);
}
```

**Problem**: 
- If URL is just `/collab`, roomId is always "default"
- All rooms connecting to `/collab` route to the same Durable Object!

### 3. **The Fix Attempted**

Changed `app.tsx` to include room in the URL path:

```typescript
// Before (WRONG):
const provider = useRoomProvider({
  room: roomId,        // e.g., "my-room"
  prefix: `/collab`,   // Results in URL: /collab (room sent separately)
});

// After (ATTEMPTED FIX):
const provider = useRoomProvider({
  room: '',                    // Empty - don't append
  prefix: `/collab/${roomId}`, // Results in URL: /collab/my-room
});
```

This should make the URL pattern consistent: `/collab/{roomId}`

## **WHAT TO VERIFY**

### Step 1: Check Provider URL Construction

Add this debug logging to `src/use-room-provider.ts`:

```typescript
useEffect(() => {
  console.log('[DEBUG] Provider details:', {
    url: (provider as any).url,
    roomname: (provider as any).roomname,
    room: room, // The parameter passed to useRoomProvider
  });
  
  void provider.connect();
}, [provider, room]);
```

**Expected**: URL should be `/collab/{roomId}`, not just `/collab`

### Step 2: Check Worker Routing

The worker already has logging at line 216. Check the server logs (where `bun run dev` is running) for:

```
[Worker] Routing to room: {roomId} for URL: {url}
```

**Expected**: Should see the correct room ID being extracted from the URL

### Step 3: Check Doc State

In `app.tsx`, the debug logging shows:

```javascript
// Around line 63-70 (may need to re-add if removed)
useEffect(() => {
  console.log('[DEBUG] Doc state:', {
    roomId,
    clientID: doc.clientID,
    rootMapSize: doc.getMap('root').size,
    rootKeys: Array.from(doc.getMap('root').keys()),
  });
}, [roomId, doc, state.notes]);
```

**Expected after sync**: 
- `rootMapSize: 2` (has "notes" and "nextZ")
- `rootKeys: ["notes", "nextZ"]`

### Step 4: Reproduce the Issue

1. Navigate to http://localhost:5173/
2. Wait for "Connected" status
3. Check if notes appear
4. **Press F5 to refresh**
5. Check console logs for the above debug info

## **POSSIBLE ROOT CAUSES**

### Theory 1: Provider URL Still Wrong

Even with `room=''`, y-partyserver might be appending something. Check if the actual WebSocket URL in the browser's Network tab matches `/collab/{roomId}`.

### Theory 2: Race Condition

The provider might be connecting before the valtio-y bridge is fully set up. Check the order of:
1. `new RoomState()` (creates Y.Doc + bridge)
2. `useRoomProvider()` (creates provider)
3. `provider.connect()` (starts WebSocket)

### Theory 3: Multiple Y.Doc Instances

The `useMemo(() => new RoomState(), [roomId])` creates a new doc on EVERY render during HMR. Check if `doc.clientID` changes between renders.

### Theory 4: Provider Not Syncing

Check for 'sync' events:

```typescript
provider.on('sync', (isSynced) => {
  console.log('[DEBUG] Sync event:', isSynced);
});
```

If `isSynced: false`, the provider connected but didn't receive initial state.

## **FILES TO EXAMINE**

1. **`src/app.tsx`** (lines 37-60): Room/provider setup
2. **`src/use-room-provider.ts`**: Provider creation and connection
3. **`src/yjs-setup.ts`**: RoomState class (Y.Doc + bridge)
4. **`worker/index.ts`** (lines 199-224): Worker routing logic

## **CONSOLE LOGS TO CHECK**

Look for these patterns in the browser console:

### ✅ **Working Case** (after HMR):
```
[DEBUG] Creating room for roomId: default
[DEBUG] useRoomProvider creating provider: {room: '', prefix: '/collab/default'}
[DEBUG] provider.url: ws://localhost:5173/collab/default
[DEBUG] Provider status: {status: 'connected'}
[DEBUG] Sync event: true
[DEBUG] Doc state: {rootMapSize: 2, notesCount: 6}
```

### ❌ **Broken Case** (after F5):
```
[DEBUG] Creating room for roomId: default
[DEBUG] useRoomProvider creating provider: {room: '', prefix: '/collab/default'}
[DEBUG] provider.url: ws://localhost:5173/collab  ← WRONG!
[DEBUG] Provider status: {status: 'connected'}
[DEBUG] Sync event: true
[DEBUG] Doc state: {rootMapSize: 0, notesCount: 0}  ← EMPTY!
```

## **CURRENT CODE STATE**

All debug logging has been added. The current configuration in `app.tsx` is:

```typescript
const provider = useRoomProvider({
  host: window.location.host,
  room: '',                    // EMPTY - don't append room to URL
  doc,
  prefix: `/collab/${roomId}`, // Room ID is in prefix
});
```

Expected WebSocket URL: `ws://localhost:5173/collab/{roomId}`

## **NEXT STEPS FOR INVESTIGATION**

1. **Start the dev server** (if not running):
   ```bash
   cd /Users/alex/code/valtio-yjs/examples/y-partyserver-stickynotes
   bun run dev
   ```

2. **Open browser** to http://localhost:5173/

3. **Open DevTools** → Console tab

4. **Test Sequence**:
   - Navigate to http://localhost:5173/ (default room)
   - Wait 3 seconds
   - Check: Do notes appear?
   - **Press F5** to refresh
   - Wait 3 seconds  
   - Check: Do notes appear after refresh?

5. **Check Console Logs** - Look for:
   ```
   [DEBUG] Creating NEW RoomState for roomId: default
   [DEBUG] useEffect - Connecting provider
   [DEBUG] - room param: (empty string)
   [DEBUG] - provider.url: ws://localhost:5173/collab/??? ← CHECK THIS!
   [DEBUG] - provider.roomname: default
   [DEBUG] Provider STATUS event: {status: 'connected'}
   [DEBUG] Provider SYNC event, isSynced: true
   [DEBUG] Doc state for room: default {...}
   ```

6. **Check Network Tab** → Filter: WS
   - Look for WebSocket connection
   - URL should be: `ws://localhost:5173/collab/default`
   - NOT: `ws://localhost:5173/collab`

7. **Check Terminal** (where dev server runs):
   - Look for: `[Worker] Routing to room: default for URL: ...`

## **HYPOTHESIS**

The `room` parameter in `useRoomProvider` might need to match the room ID, not be empty. Try this:

```typescript
const provider = useRoomProvider({
  room: roomId,        // Try WITH room ID
  prefix: `/collab`,   // WITHOUT room ID in prefix
});
```

OR check if y-partyserver needs both to be set for URL construction.

---

**Status**: Fix attempted but user reports it still doesn't work on refresh.
**Created**: 2025-01-09

