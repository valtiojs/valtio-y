# Y.Text Collaborative Editor Example

A minimal example demonstrating character-level collaborative text editing with Y.Text.

## What You'll Learn

This example showcases:

- 📝 **Y.Text CRDT**: Character-level collaborative text editing
- ⌨️ **Simultaneous Editing**: Multiple users can type at the same time
- 🔄 **Character Merging**: Changes merge at the character level, not by replacing entire strings
- 🔴 **Offline Support**: Changes sync when clients come back online
- ⚛️ **React Integration**: Use Y.Text with valtio-yjs in React

## Why Y.Text?

### Problem with Plain Strings

When using plain JavaScript strings in collaborative editing:

```tsx
// Client 1
text = "Hello";

// Client 2 (simultaneously)
text = "World";

// Result: One completely overwrites the other ❌
// Final state: Either "Hello" OR "World"
```

### Solution with Y.Text

Y.Text is a CRDT that tracks each character individually:

```tsx
// Client 1
ytext.insert(0, "Hello");

// Client 2 (simultaneously)
ytext.insert(0, "World");

// Result: Both edits merge intelligently ✅
// Final state: "WorldHello" or "HelloWorld" (deterministic based on timestamps)
```

## Key Features

### Character-Level Operations

Instead of replacing the entire text, Y.Text uses granular operations:

```tsx
// Insert characters
stateProxy.sharedText.insert(position, "text");

// Delete characters
stateProxy.sharedText.delete(position, length);

// Read as string
const content = snap.sharedText.toString();
```

### Intelligent Merging

When multiple clients edit simultaneously:
1. Y.Text assigns each character a unique identity
2. Changes are tracked with logical timestamps
3. Edits merge without conflicts using CRDT algorithms
4. All clients converge to the same final state

## Running the Example

```bash
# Install dependencies (from the workspace root)
pnpm install

# Start the dev server
cd examples/06_ytext
pnpm dev
```

## Try This

1. **Simultaneous Typing**: Type in both editors at the same time and watch the characters merge
2. **Offline Editing**: Make both clients offline, type different text in each, then bring them online
3. **Conflict Resolution**: Edit the same position in both clients while one is offline
4. **Character Preservation**: Unlike string replacement, individual characters are preserved and merged

## Implementation Details

### Text Change Detection

The example implements efficient change detection:

```tsx
const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const newValue = e.target.value;
  const oldValue = stateProxy.sharedText.toString();
  
  // Calculate minimal operations (insert/delete) instead of replacing entire text
  if (newValue.length > oldValue.length) {
    // Insert
    stateProxy.sharedText.insert(position, insertedText);
  } else if (newValue.length < oldValue.length) {
    // Delete
    stateProxy.sharedText.delete(position, deleteCount);
  }
};
```

### Y.Text vs Strings

| Feature | Plain String | Y.Text |
|---------|-------------|--------|
| Collaborative editing | ❌ Last write wins | ✅ Character-level merge |
| Conflict resolution | ❌ Overwrites | ✅ Deterministic merging |
| Simultaneous edits | ❌ One edit lost | ✅ Both preserved |
| Performance | ⚡ Simple | ⚡ Optimized for collaboration |

## When to Use Y.Text

Use Y.Text when:
- Multiple users need to edit text simultaneously
- You need real-time collaborative text editing
- Preserving all edits is important
- You want Google Docs-style collaboration

Use plain strings when:
- Only one user edits at a time
- Last-write-wins is acceptable
- Simple form fields without collaboration
- The text is replaced entirely on each edit

## Next Steps

After understanding Y.Text, you can:
1. Add cursor position tracking for multi-user awareness
2. Implement rich text formatting with `Y.XmlFragment`
3. Add undo/redo with Yjs's built-in history
4. Build a full collaborative text editor with syntax highlighting
5. Connect to a real network provider for production use

## Related Examples

- **05_todos_simple**: Shows plain strings for simple data (recommended for non-text fields)
- **04_todos**: Complex example with nested structures
- Check valtio-yjs docs for more Y.Text features and options
