/**
 * Test: When does UndoManager fire events?
 *
 * This tests the actual behavior to validate debouncing claims.
 */

import * as Y from 'yjs';
import { UndoManager } from 'yjs';
import { createYjsProxy } from './valtio-y/src/index';

type State = {
  items: Array<{ id: number; text: string }>;
  count: number;
};

console.log('\n=== Test 1: Synchronous Bulk Operations ===');
{
  const ydoc = new Y.Doc();
  const { proxy: state } = createYjsProxy<State>(ydoc, {
    getRoot: (doc) => doc.getMap('state'),
  });

  const undoManager = new UndoManager(ydoc.getMap('state'));

  let eventCount = 0;
  undoManager.on('stack-item-added', () => {
    eventCount++;
    console.log(`Event #${eventCount}: stack-item-added`);
  });

  // Initialize
  state.items = [];
  state.count = 0;

  console.log('\nDoing 100 synchronous operations in a loop...');
  for (let i = 0; i < 100; i++) {
    state.items.push({ id: i, text: `Item ${i}` });
  }

  // Wait for microtask to flush
  await new Promise(resolve => setTimeout(resolve, 0));

  console.log(`\nTotal events fired: ${eventCount}`);
  console.log(`UndoManager stack size: ${undoManager.undoStack.length}`);
  console.log('Expected: 1 event (valtio-y batches synchronous operations)');
}

console.log('\n=== Test 2: With captureTimeout (default 500ms) ===');
{
  const ydoc = new Y.Doc();
  const { proxy: state } = createYjsProxy<State>(ydoc, {
    getRoot: (doc) => doc.getMap('state'),
  });

  const undoManager = new UndoManager(ydoc.getMap('state'), {
    captureTimeout: 500,
  });

  let eventCount = 0;
  undoManager.on('stack-item-added', () => {
    eventCount++;
    console.log(`Event #${eventCount}: stack-item-added (at ${Date.now()})`);
  });

  // Initialize
  state.items = [];
  state.count = 0;

  console.log('\nDoing 5 operations 100ms apart (within 500ms captureTimeout)...');
  const startTime = Date.now();

  for (let i = 0; i < 5; i++) {
    state.items.push({ id: i, text: `Item ${i}` });
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await new Promise(resolve => setTimeout(resolve, 600)); // Wait for capture timeout

  console.log(`\nTotal events fired: ${eventCount}`);
  console.log(`Time elapsed: ${Date.now() - startTime}ms`);
  console.log(`UndoManager stack size: ${undoManager.undoStack.length}`);
  console.log('Expected: 1 event (all operations within captureTimeout are grouped)');
}

console.log('\n=== Test 3: Rapid Undo/Redo ===');
{
  const ydoc = new Y.Doc();
  const { proxy: state } = createYjsProxy<State>(ydoc, {
    getRoot: (doc) => doc.getMap('state'),
  });

  const undoManager = new UndoManager(ydoc.getMap('state'));

  state.items = [];
  for (let i = 0; i < 10; i++) {
    state.items.push({ id: i, text: `Item ${i}` });
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  let poppedCount = 0;
  undoManager.on('stack-item-popped', () => {
    poppedCount++;
  });

  console.log('\nDoing 10 rapid undos...');
  for (let i = 0; i < 10; i++) {
    undoManager.undo();
  }

  console.log(`Total 'stack-item-popped' events: ${poppedCount}`);
  console.log('Expected: 10 events (one per undo)');
  console.log('\nThis is where debouncing helps - rapid undo/redo operations!');
}

console.log('\n=== Test 4: Typical User Interaction ===');
{
  const ydoc = new Y.Doc();
  const { proxy: state } = createYjsProxy<State>(ydoc, {
    getRoot: (doc) => doc.getMap('state'),
  });

  const undoManager = new UndoManager(ydoc.getMap('state'), {
    captureTimeout: 500,
  });

  let eventCount = 0;
  undoManager.on('stack-item-added', () => {
    eventCount++;
  });

  state.items = [];

  console.log('\nSimulating typical user adding items (1 per second)...');

  for (let i = 0; i < 3; i++) {
    state.items.push({ id: i, text: `Item ${i}` });
    await new Promise(resolve => setTimeout(resolve, 1000)); // User thinks for 1 second
  }

  console.log(`Total events fired: ${eventCount}`);
  console.log('Expected: 3 events (operations are more than 500ms apart)');
  console.log('Debouncing makes minimal difference here.');
}

console.log('\n=== Conclusion ===');
console.log('Debouncing is helpful for:');
console.log('1. Rapid undo/redo (user holds Cmd+Z)');
console.log('2. Rapid manual stopCapturing() calls');
console.log('3. Edge case: many async operations within captureTimeout');
console.log('\nDebouncing is NOT needed for:');
console.log('1. Synchronous bulk operations (valtio-y batches them already)');
console.log('2. Normal user interactions (captureTimeout handles it)');
console.log('\nDebouncing is a nice-to-have defensive optimization, not the main benefit!');
