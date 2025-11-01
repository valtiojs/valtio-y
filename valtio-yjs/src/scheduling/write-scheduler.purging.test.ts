import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../index';

const waitMicrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('WriteScheduler: Subtree Purging Necessity', () => {
  describe('Scenario: Does stale operation on deleted child break things?', () => {
    it('should handle stale write to nested object before parent replacement', async () => {
      /**
       * Test the scenario that subtree purging is meant to prevent:
       * 1. Enqueue operation on nested child: arr[0].nested.value = 'stale'
       * 2. Enqueue replacement of parent: arr[0] = { nested: { value: 'new' } }
       * 3. Both operations are in the same tick (same batch)
       * 
       * Without purging: Would try to write to old nested object after parent replaced
       * With purging: Cancels the nested write since parent will be replaced
       * 
       * Question: Does Y.js handle this gracefully, or does it cause corruption?
       */
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ nested: { value: string } }>>(doc, {
        getRoot: (d) => d.getArray('arr'),
      });
      const yArr = doc.getArray('arr');

      // Initial state
      proxy.push({ nested: { value: 'initial' } });
      await waitMicrotask();
      expect(yArr.toJSON()).toEqual([{ nested: { value: 'initial' } }]);

      // Critical test: Queue two operations in same microtask
      // Operation 1: Mutate nested child
      proxy[0]!.nested.value = 'stale-write-should-not-appear';
      // Operation 2: Replace entire parent (making op 1 target a deleted node)
      proxy[0] = { nested: { value: 'replacement' } };

      await waitMicrotask();

      // What should the result be?
      const result = yArr.toJSON();
      console.log('Result after replace:', result);

      // Expected: Only the replacement should be visible
      expect(result).toEqual([{ nested: { value: 'replacement' } }]);
      expect(proxy[0]?.nested.value).toBe('replacement');
    });

    it('should handle stale write to nested object before parent deletion', async () => {
      /**
       * Similar scenario but with deletion instead of replacement:
       * 1. Enqueue write to nested child
       * 2. Enqueue deletion of parent
       */
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ nested: { value: string } }>>(doc, {
        getRoot: (d) => d.getArray('arr'),
      });
      const yArr = doc.getArray('arr');

      // Initial state with two items
      proxy.push(
        { nested: { value: 'item0' } },
        { nested: { value: 'item1' } }
      );
      await waitMicrotask();

      // Queue two operations in same tick:
      proxy[0]!.nested.value = 'stale-write';
      proxy.splice(0, 1); // Delete item 0

      await waitMicrotask();

      const result = yArr.toJSON();
      console.log('Result after deletion:', result);

      // Expected: Only item1 should remain
      expect(result).toEqual([{ nested: { value: 'item1' } }]);
      expect(proxy.length).toBe(1);
      expect(proxy[0]?.nested.value).toBe('item1');
    });

    it('should handle deep nested stale writes', async () => {
      /**
       * Test with deeper nesting to ensure purging is recursive
       */
      type DeepNested = {
        level1: {
          level2: {
            level3: {
              value: string;
            };
          };
        };
      };

      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<DeepNested[]>(doc, {
        getRoot: (d) => d.getArray('arr'),
      });
      const yArr = doc.getArray('arr');

      // Initial state
      proxy.push({
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      });
      await waitMicrotask();

      // Queue operations at different depths before parent replacement
      proxy[0]!.level1.level2.level3.value = 'stale-deep';
      proxy[0]!.level1.level2 = { level3: { value: 'replaced-level2' } };
      proxy[0] = {
        level1: {
          level2: {
            level3: {
              value: 'replaced-root',
            },
          },
        },
      };

      await waitMicrotask();

      const result = yArr.toJSON();
      console.log('Result after deep replacement:', result);

      // Expected: Only the root replacement should be visible
      expect(result).toEqual([
        {
          level1: {
            level2: {
              level3: {
                value: 'replaced-root',
              },
            },
          },
        },
      ]);
    });
  });

  describe('Performance: Does purging actually improve anything?', () => {
    it('benchmark: with many stale operations', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ value: string }>>(doc, {
        getRoot: (d) => d.getArray('arr'),
      });

      // Setup 100 items
      for (let i = 0; i < 100; i++) {
        proxy.push({ value: `item${i}` });
      }
      await waitMicrotask();

      const startTime = performance.now();

      // Create many stale operations
      for (let i = 0; i < 100; i++) {
        proxy[i]!.value = 'stale';
      }
      // Then replace all items
      for (let i = 0; i < 100; i++) {
        proxy[i] = { value: `replaced${i}` };
      }

      await waitMicrotask();
      const endTime = performance.now();

      console.log(`Batch with purging took: ${endTime - startTime}ms`);
      
      // Verify correctness
      expect(proxy.length).toBe(100);
      expect(proxy[0]?.value).toBe('replaced0');
      expect(proxy[99]?.value).toBe('replaced99');
    });
  });

  describe('Edge Case: Sibling operations (purging should NOT affect these)', () => {
    it('should NOT purge operations on sibling objects', async () => {
      /**
       * Verify that when arr[0] is replaced, we don't accidentally purge
       * operations targeting arr[1] (a sibling)
       */
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<Array<{ value: string }>>(doc, {
        getRoot: (d) => d.getArray('arr'),
      });
      const yArr = doc.getArray('arr');

      proxy.push({ value: 'item0' }, { value: 'item1' });
      await waitMicrotask();

      // Queue operations on BOTH items
      proxy[0]!.value = 'should-be-replaced';
      proxy[1]!.value = 'should-remain'; // Sibling - should NOT be purged
      proxy[0] = { value: 'replaced' }; // Only replaces item 0

      await waitMicrotask();

      const result = yArr.toJSON();
      console.log('Result with sibling operations:', result);

      // Expected: arr[0] replaced, arr[1] mutated (not purged)
      expect(result).toEqual([
        { value: 'replaced' },
        { value: 'should-remain' }, // This should NOT be purged!
      ]);
    });
  });
});

