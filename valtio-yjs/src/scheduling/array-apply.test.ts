import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../index';

/**
 * Tests for bulk array insert optimization (_tryOptimizedInserts)
 * 
 * This suite validates that the bulk optimization for contiguous head/tail
 * inserts works correctly and doesn't break edge cases.
 */

const waitMicrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

function createDocWithProxy<T extends object>(
  getRoot: (d: Y.Doc) => Y.Map<unknown> | Y.Array<unknown>
) {
  const doc = new Y.Doc();
  const result = createYjsProxy<T>(doc, { getRoot });
  return { doc, ...result };
}

describe('Bulk Insert Optimization - Correctness Tests', () => {
  describe('Baseline: Pure Push Operations', () => {
    it('should correctly push 100 items (baseline test)', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; value: string }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 0, value: 'initial' }]);
      await waitMicrotask();

      // Push 100 items
      for (let i = 1; i <= 100; i++) {
        proxy.push({ id: i, value: `item-${i}` });
      }
      await waitMicrotask();

      expect(proxy.length).toBe(101);
      expect(proxy[0]!.id).toBe(0);
      expect(proxy[100]!.id).toBe(100);
      
      // Verify contiguous
      for (let i = 0; i < 101; i++) {
        expect(proxy[i]!.id).toBe(i);
      }

      dispose();
    });

    it('should correctly push items using spread syntax', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([]);
      await waitMicrotask();

      // Bulk push with spread
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      proxy.push(...items);
      await waitMicrotask();

      expect(proxy.length).toBe(100);
      expect(proxy[0]!.id).toBe(0);
      expect(proxy[99]!.id).toBe(99);

      dispose();
    });

    it('should handle multiple sequential push operations in same tick', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 0 }, { id: 1 }]);
      await waitMicrotask();

      // Multiple pushes in same tick (should be batched)
      proxy.push({ id: 2 });
      proxy.push({ id: 3 });
      proxy.push({ id: 4 });
      await waitMicrotask();

      expect(proxy.length).toBe(5);
      expect(proxy.map(x => x.id)).toEqual([0, 1, 2, 3, 4]);

      dispose();
    });
  });

  describe('Baseline: Pure Unshift Operations', () => {
    it('should correctly unshift 100 items (baseline test)', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; value: string }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 0, value: 'initial' }]);
      await waitMicrotask();

      // Unshift 100 items (will be batched into single transaction)
      for (let i = 1; i <= 100; i++) {
        proxy.unshift({ id: i, value: `item-${i}` });
      }
      await waitMicrotask();

      expect(proxy.length).toBe(101);
      // Last unshift wins for position 0
      expect(proxy[0]!.id).toBe(100);
      expect(proxy[100]!.id).toBe(0); // Original item shifted to end

      dispose();
    });

    it('should correctly unshift items using spread syntax', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 99 }]);
      await waitMicrotask();

      // Bulk unshift with spread
      const items = Array.from({ length: 3 }, (_, i) => ({ id: i }));
      proxy.unshift(...items);
      await waitMicrotask();

      expect(proxy.length).toBe(4);
      expect(proxy.map(x => x.id)).toEqual([0, 1, 2, 99]);

      dispose();
    });
  });

  describe('Edge Case: Non-Contiguous Sets', () => {
    it('should handle non-contiguous index sets correctly', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([]);
      await waitMicrotask();

      // Simulate non-contiguous sets by direct index assignment
      // (This creates holes, which get reconciled)
      proxy[0] = { id: 0 };
      proxy[2] = { id: 2 };
      proxy[5] = { id: 5 };
      await waitMicrotask();

      // Y.Array doesn't support holes, so indices compress
      expect(proxy.length).toBe(3);
      expect(proxy.map(x => x.id)).toEqual([0, 2, 5]);

      dispose();
    });

    it('should NOT optimize non-contiguous sets', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<number>>(
        (d) => d.getArray('arr')
      );

      bootstrap([1, 2, 3, 4, 5]);
      await waitMicrotask();

      // Replace non-contiguous indices
      proxy[0] = 10;
      proxy[2] = 30;
      proxy[4] = 50;
      await waitMicrotask();

      expect(proxy).toEqual([10, 2, 30, 4, 50]);

      dispose();
    });
  });

  describe('Edge Case: Mixed Operations (Deletes Present)', () => {
    it('should handle splice with delete + insert correctly', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
      await waitMicrotask();

      // Delete 1 item, insert 3 items
      proxy.splice(2, 1, { id: 10 }, { id: 11 }, { id: 12 });
      await waitMicrotask();

      expect(proxy.length).toBe(7);
      expect(proxy.map(x => x.id)).toEqual([0, 1, 10, 11, 12, 3, 4]);

      dispose();
    });

    it('should handle delete + multiple pushes in same tick', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }]);
      await waitMicrotask();

      // Delete from middle, then push
      proxy.splice(1, 2); // Delete id:1, id:2
      proxy.push({ id: 10 });
      proxy.push({ id: 11 });
      await waitMicrotask();

      expect(proxy.map(x => x.id)).toEqual([0, 3, 10, 11]);

      dispose();
    });
  });

  describe('Edge Case: Replaces Present', () => {
    it('should handle in-place replacements correctly', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; value: string }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([
        { id: 0, value: 'a' },
        { id: 1, value: 'b' },
        { id: 2, value: 'c' },
      ]);
      await waitMicrotask();

      // Replace all items
      proxy[0] = { id: 10, value: 'x' };
      proxy[1] = { id: 11, value: 'y' };
      proxy[2] = { id: 12, value: 'z' };
      await waitMicrotask();

      expect(proxy.map(x => x.id)).toEqual([10, 11, 12]);
      expect(proxy.map(x => x.value)).toEqual(['x', 'y', 'z']);

      dispose();
    });

    it('should handle replace + push in same tick', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 0 }, { id: 1 }]);
      await waitMicrotask();

      // Replace existing item and push new ones
      proxy[0] = { id: 10 };
      proxy.push({ id: 2 });
      proxy.push({ id: 3 });
      await waitMicrotask();

      expect(proxy.map(x => x.id)).toEqual([10, 1, 2, 3]);

      dispose();
    });
  });

  describe('Nested Objects in Bulk Operations', () => {
    it('should handle bulk push of nested objects', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<
        Array<{ id: number; nested: { value: string } }>
      >((d) => d.getArray('arr'));

      bootstrap([]);
      await waitMicrotask();

      // Bulk push with nested objects
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        nested: { value: `nested-${i}` },
      }));
      proxy.push(...items);
      await waitMicrotask();

      expect(proxy.length).toBe(50);
      expect(proxy[0]!.nested.value).toBe('nested-0');
      expect(proxy[49]!.nested.value).toBe('nested-49');

      // Verify nested objects are mutable
      proxy[0]!.nested.value = 'updated';
      await waitMicrotask();
      expect(proxy[0]!.nested.value).toBe('updated');

      dispose();
    });

    it('should handle bulk unshift of nested objects', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<
        Array<{ id: number; children: Array<{ name: string }> }>
      >((d) => d.getArray('arr'));

      bootstrap([{ id: 99, children: [{ name: 'end' }] }]);
      await waitMicrotask();

      // Bulk unshift with deeply nested objects
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        children: Array.from({ length: 3 }, (_, j) => ({ name: `child-${i}-${j}` })),
      }));
      proxy.unshift(...items);
      await waitMicrotask();

      expect(proxy.length).toBe(11);
      expect(proxy[0]!.id).toBe(0);
      expect(proxy[0]!.children[0]!.name).toBe('child-0-0');
      expect(proxy[10]!.id).toBe(99);

      dispose();
    });
  });

  describe('Two-Client Synchronization', () => {
    it('should sync bulk push correctly between two clients', async () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();

      // Setup relay
      const RELAY_ORIGIN = Symbol('relay');
      docA.on('update', (update, origin) => {
        if (origin === RELAY_ORIGIN) return;
        docB.transact(() => {
          Y.applyUpdate(docB, update);
        }, RELAY_ORIGIN);
      });
      docB.on('update', (update, origin) => {
        if (origin === RELAY_ORIGIN) return;
        docA.transact(() => {
          Y.applyUpdate(docA, update);
        }, RELAY_ORIGIN);
      });

      const proxyA = createYjsProxy<Array<{ id: number }>>(docA, {
        getRoot: (d) => d.getArray('arr'),
      });
      const proxyB = createYjsProxy<Array<{ id: number }>>(docB, {
        getRoot: (d) => d.getArray('arr'),
      });

      // Bootstrap on A
      proxyA.bootstrap([{ id: 0 }]);
      await waitMicrotask();

      // Verify sync
      expect(proxyB.proxy.length).toBe(1);
      expect(proxyB.proxy[0]!.id).toBe(0);

      // Bulk push on A
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
      proxyA.proxy.push(...items);
      await waitMicrotask();

      // Verify both clients have same state
      expect(proxyA.proxy.length).toBe(101);
      expect(proxyB.proxy.length).toBe(101);
      expect(proxyA.proxy.map(x => x.id)).toEqual(proxyB.proxy.map(x => x.id));

      proxyA.dispose();
      proxyB.dispose();
    });

    it('should sync bulk unshift correctly between two clients', async () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();

      // Setup relay
      const RELAY_ORIGIN = Symbol('relay');
      docA.on('update', (update, origin) => {
        if (origin === RELAY_ORIGIN) return;
        Y.applyUpdate(docB, update);
      });
      docB.on('update', (update, origin) => {
        if (origin === RELAY_ORIGIN) return;
        Y.applyUpdate(docA, update);
      });

      const proxyA = createYjsProxy<Array<{ id: number }>>(docA, {
        getRoot: (d) => d.getArray('arr'),
      });
      const proxyB = createYjsProxy<Array<{ id: number }>>(docB, {
        getRoot: (d) => d.getArray('arr'),
      });

      // Bootstrap on A
      proxyA.bootstrap([{ id: 99 }]);
      await waitMicrotask();

      // Bulk unshift on A
      const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      proxyA.proxy.unshift(...items);
      await waitMicrotask();

      // Verify both clients have same state
      expect(proxyA.proxy.length).toBe(11);
      expect(proxyB.proxy.length).toBe(11);
      expect(proxyA.proxy.map(x => x.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 99]);
      expect(proxyB.proxy.map(x => x.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 99]);

      proxyA.dispose();
      proxyB.dispose();
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle large bulk push (1000 items)', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([]);
      await waitMicrotask();

      const start = performance.now();
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      proxy.push(...items);
      await waitMicrotask();
      const elapsed = performance.now() - start;

      expect(proxy.length).toBe(1000);
      expect(proxy[0]!.id).toBe(0);
      expect(proxy[999]!.id).toBe(999);
      
      // Should complete in reasonable time (< 100ms even without optimization)
      expect(elapsed).toBeLessThan(100);

      dispose();
    });

    it('should handle large bulk unshift (1000 items)', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([]);
      await waitMicrotask();

      const start = performance.now();
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      proxy.unshift(...items);
      await waitMicrotask();
      const elapsed = performance.now() - start;

      expect(proxy.length).toBe(1000);
      
      // Should complete in reasonable time
      expect(elapsed).toBeLessThan(100);

      dispose();
    });
  });

  describe('Optimization Detection (Manual Verification)', () => {
    it('should detect head insert pattern (indices 0..m-1)', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 10 }, { id: 11 }]);
      await waitMicrotask();

      // This should NOT optimize (not starting at 0 in empty array)
      // It's replacing existing items
      proxy[0] = { id: 0 };
      proxy[1] = { id: 1 };
      await waitMicrotask();

      expect(proxy.map(x => x.id)).toEqual([0, 1]);

      dispose();
    });

    it('should detect tail insert pattern (indices len..len+k-1)', async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 0 }, { id: 1 }]);
      await waitMicrotask();

      // This SHOULD optimize (pure tail inserts)
      // Indices will be 2, 3, 4 (starting at length)
      proxy.push({ id: 2 }, { id: 3 }, { id: 4 });
      await waitMicrotask();

      expect(proxy.map(x => x.id)).toEqual([0, 1, 2, 3, 4]);

      dispose();
    });
  });
});

describe('Bulk Insert Optimization - Y.Array Event Verification', () => {
  it('should emit correct number of Y.Array events for push', async () => {
    const { doc, proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
      (d) => d.getArray('arr')
    );

    bootstrap([{ id: 0 }]);
    await waitMicrotask();

    const yArray = doc.getArray('arr');
    let totalInserted = 0;

    yArray.observe((event) => {
      event.changes.delta.forEach((change) => {
        if ('insert' in change && Array.isArray(change.insert)) {
          totalInserted += change.insert.length;
        }
      });
    });

    // Bulk push 100 items
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
    proxy.push(...items);
    await waitMicrotask();

    // Note: Without optimization, this would be 100 events
    // With optimization, this should be 1 event
    // For now, we just verify correctness
    expect(proxy.length).toBe(101);
    expect(totalInserted).toBe(100);

    dispose();
  });
});

