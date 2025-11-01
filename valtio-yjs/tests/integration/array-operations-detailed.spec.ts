/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../../src/index';
import { planArrayOps } from '../../src/planning/array-ops-planner';

const waitMicrotask = () => Promise.resolve();

describe('Array Operations Detailed Testing', () => {
  describe('Basic Array Operations', () => {
    it('should handle push operations correctly', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push('first');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['first']);
      expect(proxy).toEqual(['first']);

      proxy.push('second');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['first', 'second']);
      expect(proxy).toEqual(['first', 'second']);
    });

    it('should handle unshift operations correctly', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push('second');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['second']);

      proxy.unshift('first');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['first', 'second']);
      expect(proxy).toEqual(['first', 'second']);
    });

    it('should handle simple delete operations correctly', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push('a', 'b', 'c');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'b', 'c']);

      proxy.splice(1, 1); // delete index 1
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'c']);
      expect(proxy).toEqual(['a', 'c']);
    });

    it('should handle simple replace operations correctly', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push('a', 'b', 'c');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'b', 'c']);

      proxy.splice(1, 1, 'replaced'); // replace index 1
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'replaced', 'c']);
      expect(proxy).toEqual(['a', 'replaced', 'c']);
    });

    it('should handle insert operations correctly', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push('a', 'c');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'c']);

      proxy.splice(1, 0, 'b'); // insert at index 1
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'b', 'c']);
      expect(proxy).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Complex Array Scenarios', () => {
    it('should handle multiple operations in sequence', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      // Step 1: Initialize
      proxy.push('x', 'y');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['x', 'y']);
      expect(proxy).toEqual(['x', 'y']);

      // Step 2: Unshift
      proxy.unshift('new');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['new', 'x', 'y']);
      expect(proxy).toEqual(['new', 'x', 'y']);

      // Step 3: Replace at index 1 (this is where the bug likely occurs)
      proxy.splice(1, 1, 'mid');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['new', 'mid', 'y']);
      expect(proxy).toEqual(['new', 'mid', 'y']);

      // Step 4: Delete first element
      proxy.splice(0, 1);
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['mid', 'y']);
      expect(proxy).toEqual(['mid', 'y']);
    });

    it('should handle multiple replaces in same microtask', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push('a', 'b', 'c', 'd');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'b', 'c', 'd']);

      // Multiple replaces in same tick
      proxy[1] = 'B';
      proxy[3] = 'D';
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'B', 'c', 'D']);
      expect(proxy).toEqual(['a', 'B', 'c', 'D']);
    });

    it('should handle mixed operations in same microtask', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push('a', 'b', 'c');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'b', 'c']);

      // Mix of operations in same tick
      proxy.push('d');           // pure set/insert
      proxy[1] = 'replaced';     // replace
      delete proxy[2];           // delete (might not work as expected)
      await waitMicrotask();
      
      // This test will help us understand what actually happens
      console.log('Mixed operations result:', yArr.toJSON());
      console.log('Proxy state:', JSON.stringify(proxy));
    });
  });

  describe('Edge Cases and Debugging', () => {
    it('should show what operations Valtio generates for splice replace', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      // Set up initial state
      proxy.push('x', 'y', 'z');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['x', 'y', 'z']);

      // Spy on console to capture the operation logs
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // Perform splice replace
      proxy.splice(1, 1, 'replaced');
      await waitMicrotask();

      // Check what operations were logged
      const operationLogs = consoleSpy.mock.calls
        .filter(call => call[0]?.includes?.('[controller][array] ops'))
        .map(call => call[1]);
      
      console.log('Operations generated by splice(1, 1, "replaced"):', operationLogs);
      console.log('Final Y.Array state:', yArr.toJSON());
      console.log('Final proxy state:', JSON.stringify(proxy));
      
      consoleSpy.mockRestore();
    });

    it('should show what operations Valtio generates for direct assignment', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      // Set up initial state
      proxy.push('x', 'y', 'z');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['x', 'y', 'z']);

      // Spy on console to capture the operation logs
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // Perform direct assignment (should be a replace)
      proxy[1] = 'replaced';
      await waitMicrotask();

      // Check what operations were logged
      const operationLogs = consoleSpy.mock.calls
        .filter(call => call[0]?.includes?.('[controller][array] ops'))
        .map(call => call[1]);
      
      console.log('Operations generated by proxy[1] = "replaced":', operationLogs);
      console.log('Final Y.Array state:', yArr.toJSON());
      console.log('Final proxy state:', JSON.stringify(proxy));
      
      consoleSpy.mockRestore();
      
      expect(yArr.toJSON()).toEqual(['x', 'replaced', 'z']);
      expect(proxy).toEqual(['x', 'replaced', 'z']);
    });

    it('should show what operations Valtio generates for delete', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      // Set up initial state
      proxy.push('x', 'y', 'z');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['x', 'y', 'z']);

      // Spy on console to capture the operation logs
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // Perform delete
      delete proxy[1];
      await waitMicrotask();

      // Check what operations were logged
      const operationLogs = consoleSpy.mock.calls
        .filter(call => call[0]?.includes?.('[controller][array] ops'))
        .map(call => call[1]);
      
      console.log('Operations generated by delete proxy[1]:', operationLogs);
      console.log('Final Y.Array state:', yArr.toJSON());
      console.log('Final proxy state:', JSON.stringify(proxy));
      
      consoleSpy.mockRestore();
    });
  });

  describe('Reference Identity and Value Integrity', () => {
    it('should preserve object references during replace operations', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      const obj1 = { id: 1, name: 'first' };
      const obj2 = { id: 2, name: 'second' };
      const obj3 = { id: 3, name: 'third' };

      proxy.push(obj1, obj2);
      await waitMicrotask();
      
      const proxyRef1 = proxy[0];
      const proxyRef2 = proxy[1];
      
      // Replace second object
      proxy.splice(1, 1, obj3);
      await waitMicrotask();
      
      // First object reference should be preserved
      expect(proxy[0]).toBe(proxyRef1);
      expect(proxy[0].id).toBe(1);
      
      // Second object should be replaced
      expect(proxy[1]).not.toBe(proxyRef2);
      expect(proxy[1].id).toBe(3);
      
      expect(yArr.toJSON()).toEqual([obj1, obj3]);
    });

    it('should handle nested object mutations during replace', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push({ data: { count: 0 } }, { data: { count: 1 } });
      await waitMicrotask();
      
      // Mutate nested object
      proxy[0].data.count = 10;
      await waitMicrotask();
      
      // Replace entire object at index 1
      proxy.splice(1, 1, { data: { count: 99 } });
      await waitMicrotask();
      
      expect(proxy[0].data.count).toBe(10);
      expect(proxy[1].data.count).toBe(99);
      expect(yArr.toJSON()).toEqual([{ data: { count: 10 } }, { data: { count: 99 } }]);
    });
  });

  describe('Concurrent Operations Testing', () => {
    it('should handle rapid sequential operations', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      // Rapid operations without waiting
      proxy.push('a');
      proxy.push('b');
      proxy.push('c');
      proxy.splice(1, 1, 'B'); // replace 'b' with 'B'
      proxy.unshift('start');
      
      await waitMicrotask();
      
      console.log('Rapid operations result:', yArr.toJSON());
      console.log('Proxy state:', JSON.stringify(proxy));
      
      // Should be ['start', 'a', 'B', 'c']
      expect(yArr.toJSON()).toEqual(['start', 'a', 'B', 'c']);
      expect(proxy).toEqual(['start', 'a', 'B', 'c']);
    });

    it('should handle operations with undefined and null values', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push('a', null, undefined, 'b');
      await waitMicrotask();
      // Library normalizes undefined -> null in Y.Array
      expect(yArr.toJSON()).toEqual(['a', null, null, 'b']);
      
      // Replace null with a value
      proxy.splice(1, 1, 'not-null');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'not-null', null, 'b']);
      
      // Replace undefined with a value
      proxy.splice(2, 1, 'not-undefined');
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual(['a', 'not-null', 'not-undefined', 'b']);
    });
  });

  describe('Planning Logic Testing', () => {
    it('should correctly identify operation types in planning', () => {
      // This test will help us verify the planning logic is working

      // Test pure delete
      let result = planArrayOps([['delete', [1], 'old-value']], 3, undefined);
      expect(result.deletes.has(1)).toBe(true);
      expect(result.sets.size).toBe(0);
      expect(result.replaces.size).toBe(0);
      
      // Test replace when index is within bounds at batch start
      result = planArrayOps([['set', [1], 'new-value', 'old-value']], 3, undefined);
      expect(result.replaces.has(1)).toBe(true);
      expect(result.deletes.size).toBe(0);
      expect(result.sets.size).toBe(0);
      
      // Test replace (delete + set at same index)
      result = planArrayOps([
        ['delete', [1], 'old-value'],
        ['set', [1], 'new-value', 'old-value']
      ], 3, undefined);
      expect(result.replaces.has(1)).toBe(true);
      expect(result.replaces.get(1)).toBe('new-value');
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(0);
    });
  });

  describe('Two-Client Collaboration Testing', () => {
    function createTwoClientSetup() {
      const docA = new Y.Doc();
      const docB = new Y.Doc();
      
      const { proxy: proxyA } = createYjsProxy<any[]>(docA, { getRoot: (d) => d.getArray('arr') });
      const { proxy: proxyB } = createYjsProxy<any[]>(docB, { getRoot: (d) => d.getArray('arr') });
      
      const yArrA = docA.getArray<any>('arr');
      const yArrB = docB.getArray<any>('arr');
      
      // Set up relay
      docA.on('update', (update: Uint8Array) => {
        Y.applyUpdate(docB, update);
      });
      
      docB.on('update', (update: Uint8Array) => {
        Y.applyUpdate(docA, update);
      });
      
      return { docA, docB, proxyA, proxyB, yArrA, yArrB };
    }

    it('should sync simple replace operations between clients', async () => {
      const { proxyA, proxyB, yArrB } = createTwoClientSetup();
      
      // Initialize on A
      proxyA.push('a', 'b', 'c');
      await waitMicrotask();
      expect(yArrB.toJSON()).toEqual(['a', 'b', 'c']);
      expect(proxyB).toEqual(['a', 'b', 'c']);
      
      // Replace on A
      proxyA.splice(1, 1, 'B');
      await waitMicrotask();
      expect(yArrB.toJSON()).toEqual(['a', 'B', 'c']);
      expect(proxyB).toEqual(['a', 'B', 'c']);
    });

    it('should sync delete operations between clients', async () => {
      const { proxyA, proxyB, yArrB } = createTwoClientSetup();
      
      // Initialize on A
      proxyA.push('a', 'b', 'c');
      await waitMicrotask();
      expect(proxyB).toEqual(['a', 'b', 'c']);
      
      // Delete on A
      proxyA.splice(1, 1);
      await waitMicrotask();
      expect(yArrB.toJSON()).toEqual(['a', 'c']);
      expect(proxyB).toEqual(['a', 'c']);
    });

    it('should sync complex sequence between clients', async () => {
      const { proxyA, proxyB, yArrA, yArrB } = createTwoClientSetup();
      
      // Step 1: Initialize
      proxyA.push('x', 'y');
      await waitMicrotask();
      expect(proxyB).toEqual(['x', 'y']);
      
      // Step 2: Unshift on A
      proxyA.unshift('new');
      await waitMicrotask();
      expect(proxyB).toEqual(['new', 'x', 'y']);
      
      // Step 3: Replace on A (this is the critical test)
      proxyA.splice(1, 1, 'mid');
      await waitMicrotask();
      console.log('After splice replace - A:', yArrA.toJSON());
      console.log('After splice replace - B:', yArrB.toJSON());
      console.log('ProxyA:', JSON.stringify(proxyA));
      console.log('ProxyB:', JSON.stringify(proxyB));
      expect(proxyB).toEqual(['new', 'mid', 'y']);
      
      // Step 4: Delete on A
      proxyA.splice(0, 1);
      await waitMicrotask();
      expect(proxyB).toEqual(['mid', 'y']);
    });
  });
});
