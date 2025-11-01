/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../../src/index';

const waitMicrotask = () => Promise.resolve();

describe('Comprehensive Edge Cases', () => {
  describe('Reference Reuse Across Mutations', () => {
    it('should preserve object identity when possible', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      // Create nested structure
      proxy.items = [{ id: 1, data: { value: 'a' } }];
      await waitMicrotask();
      
      const itemRef = proxy.items[0];
      const dataRef = proxy.items[0].data;
      
      // Mutate nested data
      proxy.items[0].data.value = 'modified';
      await waitMicrotask();
      
      // References should be preserved
      expect(proxy.items[0]).toBe(itemRef);
      expect(proxy.items[0].data).toBe(dataRef);
      expect(proxy.items[0].data.value).toBe('modified');
    });

    it('should handle object replacement with nested references', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      proxy.container = { 
        items: [
          { id: 1, children: [{ text: 'child1' }, { text: 'child2' }] }
        ]
      };
      await waitMicrotask();
      
      const containerRef = proxy.container;
      
      // Replace the entire container
      proxy.container = {
        items: [
          { id: 1, children: [{ text: 'child1' }, { text: 'child2' }] }
        ]
      };
      await waitMicrotask();
      
      // Container should be replaced, but internal structure should be consistent
      expect(proxy.container).not.toBe(containerRef);
      expect(Array.isArray(proxy.container.items)).toBe(true);
      expect(Array.isArray(proxy.container.items[0].children)).toBe(true);
      expect(proxy.container.items[0].children.length).toBe(2);
    });
  });

  describe('Deep Nesting Scenarios', () => {
    it('should handle deeply nested array modifications', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      proxy.level1 = {
        level2: {
          level3: {
            items: ['a', 'b', 'c']
          }
        }
      };
      await waitMicrotask();
      
      // Deep modification
      proxy.level1.level2.level3.items.splice(1, 1, 'B');
      await waitMicrotask();
      
      expect(proxy.level1.level2.level3.items).toEqual(['a', 'B', 'c']);
      
      // Deep deletion
      proxy.level1.level2.level3.items.splice(0, 1);
      await waitMicrotask();
      
      expect(proxy.level1.level2.level3.items).toEqual(['B', 'c']);
    });

    it('should handle nested arrays with complex operations', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });

      proxy.push([1, 2], [3, 4], [5, 6]);
      await waitMicrotask();
      
      // Modify inner array
      proxy[1].splice(1, 1, 40);
      await waitMicrotask();
      expect(proxy[1]).toEqual([3, 40]);
      
      // Replace entire inner array
      proxy.splice(0, 1, [10, 20]);
      await waitMicrotask();
      expect(proxy[0]).toEqual([10, 20]);
      expect(proxy[1]).toEqual([3, 40]);
      expect(proxy[2]).toEqual([5, 6]);
    });
  });

  describe('Timing and Race Conditions', () => {
    it('should handle rapid mutations without microtask waits', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      // Rapid sequence without awaiting
      proxy.push('a', 'b', 'c');
      proxy.splice(1, 1, 'B');
      proxy.unshift('start');
      proxy.splice(2, 1);
      proxy.push('end');
      
      await waitMicrotask();
      
      console.log('Rapid mutations result:', yArr.toJSON());
      console.log('Proxy state:', JSON.stringify(proxy));
      
      // The exact result depends on how operations are batched and planned
      // At minimum, we should have no undefined values and consistent state
      const result = yArr.toJSON();
      expect(result.every(item => item !== undefined)).toBe(true);
      expect(proxy.every((item: any) => item !== undefined)).toBe(true);
    });

    it('should handle interleaved mutations and reconciliation', async () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();
      
      const { proxy: proxyA } = createYjsProxy<any[]>(docA, { getRoot: (d) => d.getArray('arr') });
      createYjsProxy<any[]>(docB, { getRoot: (d) => d.getArray('arr') });
      
      // Set up relay with delay to simulate network
      docA.on('update', async (update: Uint8Array) => {
        await new Promise(resolve => setTimeout(resolve, 1));
        Y.applyUpdate(docB, update);
      });
      
      // Rapid mutations on A
      proxyA.push('1', '2', '3');
      proxyA.splice(1, 1, 'TWO');
      proxyA.unshift('0');
      
      // Wait for all operations to propagate
      await new Promise(resolve => setTimeout(resolve, 10));
      
      console.log('Interleaved result A:', docA.getArray('arr').toJSON());
      console.log('Interleaved result B:', docB.getArray('arr').toJSON());
      
      // Both should be consistent
      const resultA = docA.getArray('arr').toJSON();
      const resultB = docB.getArray('arr').toJSON();
      expect(resultA).toEqual(resultB);
      expect(resultA.every(item => item !== undefined)).toBe(true);
    });
  });

  describe('Stress Testing Scenarios', () => {
    it('should handle large arrays with many operations', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      // Create large initial array
      const initialItems = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      proxy.push(...initialItems);
      await waitMicrotask();
      
      expect(yArr.length).toBe(100);
      
      // Perform many operations
      for (let i = 0; i < 10; i++) {
        proxy.splice(i * 5, 1, `replaced-${i}`);
      }
      await waitMicrotask();
      
      const result = yArr.toJSON();
      expect(result.length).toBe(100);
      expect(result.every(item => item !== undefined)).toBe(true);
      
      // Check that replacements occurred
      expect(result[0]).toBe('replaced-0');
      expect(result[5]).toBe('replaced-1');
      expect(result[10]).toBe('replaced-2');
    });

    it('should handle high-frequency updates', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      // Initialize
      proxy.push('a', 'b', 'c', 'd', 'e');
      await waitMicrotask();
      
      // High-frequency updates
      const updates = [];
      for (let i = 0; i < 50; i++) {
        const operation = i % 3;
        switch (operation) {
          case 0: // replace
            proxy.splice(i % proxy.length, 1, `update-${i}`);
            updates.push(`replace at ${i % proxy.length}`);
            break;
          case 1: // insert
            proxy.splice(i % proxy.length, 0, `insert-${i}`);
            updates.push(`insert at ${i % proxy.length}`);
            break;
          case 2: // delete
            if (proxy.length > 1) {
              proxy.splice(i % proxy.length, 1);
              updates.push(`delete at ${i % proxy.length}`);
            }
            break;
        }
        
        if (i % 10 === 0) {
          await waitMicrotask();
        }
      }
      
      await waitMicrotask();
      
      const result = yArr.toJSON();
      console.log(`After ${updates.length} operations, array length: ${result.length}`);
      console.log('Sample items:', result.slice(0, 5));
      
      // Verify no undefined values
      expect(result.every(item => item !== undefined)).toBe(true);
      expect(proxy.every((item: any) => item !== undefined)).toBe(true);
    });
  });

  describe('Value Integrity Testing', () => {
    it('should maintain consistent state between proxy and Y.Array', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      const operations = [
        () => proxy.push('initial'),
        () => proxy.unshift('start'),
        () => proxy.splice(1, 1, 'replaced'),
        () => proxy.push('end'),
        () => proxy.splice(0, 1),
        () => proxy.splice(-1, 1, 'new-end')
      ];
      
      for (let i = 0; i < operations.length; i++) {
        console.log(`\n=== Operation ${i + 1} ===`);
        console.log('Before:', yArr.toJSON());
        
        operations[i]!();
        await waitMicrotask();
        
        console.log('After:', yArr.toJSON());
        console.log('Proxy:', JSON.stringify(proxy));
        
        // Verify consistency
        expect(yArr.toJSON()).toEqual(proxy);
        expect(yArr.length).toBe(proxy.length);
        
        // No undefined values
        expect(yArr.toJSON().every(item => item !== undefined)).toBe(true);
        expect(proxy.every((item: any) => item !== undefined)).toBe(true);
      }
    });
  });
});
