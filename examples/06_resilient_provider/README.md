# Resilient Provider Example

This example demonstrates how to implement robust network error handling with valtio-y and Y.js providers.

## Features

- **Automatic Reconnection**: Exponential backoff retry logic
- **Connection State Management**: Track connection status
- **Offline Support**: Queue updates while offline, sync when reconnected
- **Error Boundaries**: Graceful error handling with user feedback
- **Connection Quality Indicator**: Visual feedback for connection state

## What You'll Learn

1. How to implement a resilient WebSocket provider
2. How to handle connection failures and retries
3. How to provide user feedback for network issues
4. How to support offline mode
5. How to monitor connection quality

## Running the Example

```bash
cd examples/06_resilient_provider
bun install
bun run dev
```

## Key Concepts

### Resilient Provider Pattern

The `ResilientProvider` class wraps a standard Y.js provider (like `y-websocket`) with:
- Exponential backoff retry logic
- Maximum retry attempts
- Connection state tracking
- Error event handling

### Connection State Management

Track connection state through:
- `disconnected` - Not connected
- `connecting` - Connection attempt in progress
- `connected` - Successfully connected
- `error` - Connection failed

### Offline Support

When offline:
- Buffer local changes
- Show offline indicator to user
- Automatically sync when back online

## Code Structure

- `resilient-provider.ts` - Resilient provider implementation
- `connection-state.ts` - Connection state management
- `offline-support.ts` - Offline mode handling
- `app.ts` - Main application with UI

## Best Practices Demonstrated

1. **User Feedback**: Always show connection status to users
2. **Retry Logic**: Use exponential backoff to avoid overwhelming the server
3. **Offline Mode**: Support working offline with sync on reconnect
4. **Error Boundaries**: Catch and handle errors gracefully
5. **State Management**: Separate connection state from application state

## Related Documentation

- [Error Handling Guide](../../docs/error-handling.md)
- [Network Error Patterns](../../docs/error-handling.md#network-error-handling)
