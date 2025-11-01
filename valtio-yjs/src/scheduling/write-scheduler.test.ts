import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../index';
import { yTypeToPlainObject } from '../core/converter';

// Helper type for accessing internal Y.js properties
type YTypeWithInternals = { _item?: { id?: { toString: () => string } } };

const waitMicrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Detailed investigation: What does the conservative merge check actually prevent?
 * 
 * We'll spy on Y.js operations to see if operations are being merged into replaces
 * or executed as separate delete+insert operations.
 */

describe('Conservative merge check - detailed analysis', () => {
  it('logs Y.js operations for single assignment (should merge)', async () => {
    const doc = new Y.Doc();
    const operations: string[] = [];
    
    // Spy on document updates
    doc.on('update', (update, origin) => {
      if (origin?.toString() === 'Symbol(valtio-yjs-origin)') {
        operations.push('transaction');
      }
    });
    
    const { proxy, dispose, bootstrap } = createYjsProxy<{ items: unknown[] }>(doc, {
      getRoot: (doc) => doc.getMap('root'),
    });
    
    bootstrap({ items: [
      { id: 1, value: 'a' },
      { id: 2, value: 'b' },
      { id: 3, value: 'c' },
    ]});
    
    operations.length = 0; // Reset
    
    // Single assignment - should trigger conservative merge
    proxy.items[0] = { id: 10, value: 'NEW' };
    await waitMicrotask();
    
    console.log('Single assignment operations:', operations);
    expect(operations.length).toBe(1); // One transaction
    
    const yItems = doc.getMap('root').get('items') as Y.Array<unknown>;
    const result = yTypeToPlainObject(yItems) as unknown[];
    expect(result[0]).toMatchObject({ id: 10, value: 'NEW' });
    
    dispose();
  });

  it('logs Y.js operations for multiple assignments (conservative check prevents merge)', async () => {
    const doc = new Y.Doc();
    const operations: string[] = [];
    
    // Spy on document updates  
    doc.on('update', (update, origin) => {
      if (origin?.toString() === 'Symbol(valtio-yjs-origin)') {
        operations.push('transaction');
      }
    });
    
    const { proxy, dispose, bootstrap } = createYjsProxy<{ items: unknown[] }>(doc, {
      getRoot: (doc) => doc.getMap('root'),
    });
    
    bootstrap({ items: [
      { id: 1, value: 'a' },
      { id: 2, value: 'b' },
      { id: 3, value: 'c' },
    ]});
    
    operations.length = 0; // Reset
    
    // Multiple assignments - conservative check prevents merge
    proxy.items[0] = { id: 10, value: 'NEW_A' };
    proxy.items[2] = { id: 30, value: 'NEW_C' };
    await waitMicrotask();
    
    console.log('Multiple assignment operations:', operations);
    expect(operations.length).toBe(1); // Still one transaction (batched)
    
    // But the result should still be correct
    const yItems = doc.getMap('root').get('items') as Y.Array<unknown>;
    const result = yTypeToPlainObject(yItems) as unknown[];
    expect(result[0]).toMatchObject({ id: 10, value: 'NEW_A' });
    expect(result[2]).toMatchObject({ id: 30, value: 'NEW_C' });
    
    dispose();
  });

  it('compares Y.js structure for single vs multiple assignments', async () => {
    // Test 1: Single assignment
    const doc1 = new Y.Doc();
    const { proxy: proxy1, dispose: dispose1, bootstrap: bootstrap1 } = createYjsProxy<{ items: unknown[] }>(doc1, {
      getRoot: (doc) => doc.getMap('root'),
    });
    
    bootstrap1({ items: [{ id: 1, value: 'a' }, { id: 2, value: 'b' }, { id: 3, value: 'c' }]});
    proxy1.items[0] = { id: 10, value: 'NEW' };
    await waitMicrotask();
    
    const yItems1 = doc1.getMap('root').get('items') as Y.Array<unknown>;
    console.log('Single assignment - Y.Array length:', yItems1.length);
    console.log('Single assignment - First item type:', yItems1.get(0)?.constructor.name);
    
    // Test 2: Multiple assignments
    const doc2 = new Y.Doc();
    const { proxy: proxy2, dispose: dispose2, bootstrap: bootstrap2 } = createYjsProxy<{ items: unknown[] }>(doc2, {
      getRoot: (doc) => doc.getMap('root'),
    });
    
    bootstrap2({ items: [{ id: 1, value: 'a' }, { id: 2, value: 'b' }, { id: 3, value: 'c' }]});
    proxy2.items[0] = { id: 10, value: 'NEW_A' };
    proxy2.items[2] = { id: 30, value: 'NEW_C' };
    await waitMicrotask();
    
    const yItems2 = doc2.getMap('root').get('items') as Y.Array<unknown>;
    console.log('Multiple assignments - Y.Array length:', yItems2.length);
    console.log('Multiple assignments - First item type:', yItems2.get(0)?.constructor.name);
    console.log('Multiple assignments - Third item type:', yItems2.get(2)?.constructor.name);
    
    // Both should have correct length and types
    expect(yItems1.length).toBe(3);
    expect(yItems2.length).toBe(3);
    
    dispose1();
    dispose2();
  });

  it('checks if identity is preserved with single assignment', async () => {
    const doc = new Y.Doc();
    const { proxy, dispose, bootstrap } = createYjsProxy<{ items: unknown[] }>(doc, {
      getRoot: (doc) => doc.getMap('root'),
    });
    
    bootstrap({ items: [{ id: 1, value: 'a' }]});
    
    const yItems = doc.getMap('root').get('items') as Y.Array<unknown>;
    const originalItem = yItems.get(0);
    const originalId = (originalItem as YTypeWithInternals)._item?.id?.toString();
    
    console.log('Original item Y.ID:', originalId);
    
    // Replace with single assignment (should merge to replace)
    proxy.items[0] = { id: 10, value: 'NEW' };
    await waitMicrotask();
    
    const newItem = yItems.get(0);
    const newId = (newItem as YTypeWithInternals)._item?.id?.toString();
    
    console.log('After single assignment Y.ID:', newId);
    console.log('Identity preserved?', originalId === newId);
    
    dispose();
  });

  it('checks if identity is preserved with multiple assignments', async () => {
    const doc = new Y.Doc();
    const { proxy, dispose, bootstrap } = createYjsProxy<{ items: unknown[] }>(doc, {
      getRoot: (doc) => doc.getMap('root'),
    });
    
    bootstrap({ items: [{ id: 1, value: 'a' }, { id: 2, value: 'b' }, { id: 3, value: 'c' }]});
    
    const yItems = doc.getMap('root').get('items') as Y.Array<unknown>;
    const originalItem0 = yItems.get(0);
    const originalItem2 = yItems.get(2);
    const originalId0 = (originalItem0 as YTypeWithInternals)._item?.id?.toString();
    const originalId2 = (originalItem2 as YTypeWithInternals)._item?.id?.toString();
    
    console.log('Original item[0] Y.ID:', originalId0);
    console.log('Original item[2] Y.ID:', originalId2);
    
    // Replace with multiple assignments (conservative check may prevent merge)
    proxy.items[0] = { id: 10, value: 'NEW_A' };
    proxy.items[2] = { id: 30, value: 'NEW_C' };
    await waitMicrotask();
    
    const newItem0 = yItems.get(0);
    const newItem2 = yItems.get(2);
    const newId0 = (newItem0 as YTypeWithInternals)._item?.id?.toString();
    const newId2 = (newItem2 as YTypeWithInternals)._item?.id?.toString();
    
    console.log('After multiple assignments item[0] Y.ID:', newId0);
    console.log('After multiple assignments item[2] Y.ID:', newId2);
    console.log('Item[0] identity preserved?', originalId0 === newId0);
    console.log('Item[2] identity preserved?', originalId2 === newId2);
    
    dispose();
  });
});

