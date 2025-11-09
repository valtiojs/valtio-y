# Sticky Notes with Real-Time Collaboration

A collaborative sticky notes application built with `valtio-y`, demonstrating real-time synchronization using PartyServer.

## Features

- **Real-time collaboration** - Multiple users can edit simultaneously
- **Awareness-based dragging** - Smooth, real-time drag updates without document overhead
- **Cursor tracking** - See other users' cursors in real-time
- **Sticky notes** - Create, edit, resize, and drag notes
- **Color picker** - Choose from multiple note colors
- **Z-index management** - Notes automatically come to front when selected

## Architecture Highlights

### Smooth Dragging with Motion

This example demonstrates how to achieve smooth collaborative dragging using **Framer Motion + valtio-y**:

**During drag:**
- Motion handles the local drag animation with MotionValues
- No document updates (butter smooth!)
- No parent rerenders

**On drag end:**
- Final position is written to the **Yjs document** (persistent)
- Single document update per drag operation
- Motion automatically animates the position change for remote users

**Key benefits:**
1. **Motion** owns the animation during drag - no fighting with snapshot updates
2. **Minimal updates** - only write to document on drag end
3. **Smooth remote updates** - Motion animates changes from other users
4. **Clean history** - single position update per drag in undo/redo

The secret: Use Motion's `animate` prop instead of `style` for x/y positions. This lets Motion smoothly interpolate between document updates without fighting the drag gesture.


## Implementation

```tsx
// Key: Use animate prop instead of style for x/y
// This lets Motion smoothly interpolate without fighting the drag
<motion.div
  drag={!isEditing}
  dragMomentum={false}
  dragElastic={0}
  onDragEnd={handleDragEnd}
  // Use initial/animate instead of style={{ x, y }}
  initial={{ x: note.x, y: note.y }}
  animate={{ x: note.x, y: note.y }}
  transition={{ type: "tween", duration: 0.1 }}
>
  {/* Note content */}
</motion.div>

// On drag end - update document with final position
const handleDragEnd = (info: PanInfo) => {
  if (proxy.notes && noteId in proxy.notes) {
    proxy.notes[noteId].x = Math.max(0, note.x + info.offset.x);
    proxy.notes[noteId].y = Math.max(0, note.y + info.offset.y);
  }
};
```

**Why this works:**
- During drag, Motion controls the position via internal MotionValues
- On drag end, we update the document (snapshot changes)
- Motion sees the new animate values and smoothly interpolates
- No jank because we're not overriding Motion during the gesture!

## Running the Example

```bash
# Install dependencies
bun install

# Start the development server
bun run dev

# In a separate terminal, start the PartyServer
bun run server
```

Open multiple browser windows to see real-time collaboration in action!

## Technical Stack

- **valtio-y** - Valtio + Yjs synchronization
- **PartyServer** - WebSocket server for collaboration
- **Framer Motion** - Smooth animations and drag interactions
- **React** - UI framework
- **TypeScript** - Type safety

## Pattern: Awareness for Cursors, Document for State

This example demonstrates a clean separation:

| Data | Storage | When Updated |
|------|---------|--------------|
| **Cursor positions** | Awareness (ephemeral) | On every mouse move (throttled with RAF) |
| **Note positions** | Document (persistent) | Only on drag end |
| **Note content** | Document (persistent) | On text change |

**Why it works:**
- Cursors are ephemeral - no need to persist or sync via CRDT
- Note positions are persistent - need to sync and support undo/redo
- Motion bridges the gap by smoothly animating document updates
