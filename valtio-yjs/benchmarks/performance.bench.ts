import { bench, describe } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../src/index.js';

// =============================================================================
// Helper Functions
// =============================================================================

const waitMicrotask = () => new Promise((resolve) => setTimeout(resolve, 0));

function createDocWithProxy<T extends object>(
  getRoot: (d: Y.Doc) => Y.Map<unknown> | Y.Array<unknown>
) {
  const doc = new Y.Doc();
  const result = createYjsProxy<T>(doc, { getRoot });
  return { doc, ...result };
}

function createTwoDocsWithRelay() {
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  const RELAY_ORIGIN = Symbol('relay-origin');

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

  return { docA, docB, RELAY_ORIGIN };
}

// =============================================================================
// Category 1: Large Arrays (1000+ items)
// =============================================================================

describe('Large Arrays Performance', () => {
  bench(
    'bootstrap 1000 items',
    async () => {
      const { bootstrap, dispose } = createDocWithProxy<{ items: Array<{ id: number; value: string }> }>(
        (d) => d.getMap('root')
      );

      const data = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `item-${i}`,
        })),
      };

      bootstrap(data);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'bootstrap 5000 items',
    async () => {
      const { bootstrap, dispose } = createDocWithProxy<{ items: Array<{ id: number; value: string }> }>(
        (d) => d.getMap('root')
      );

      const data = {
        items: Array.from({ length: 5000 }, (_, i) => ({
          id: i,
          value: `item-${i}`,
        })),
      };

      bootstrap(data);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'batch update 100 items in large array (1000 items)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; value: string }>>(
        (d) => d.getArray('arr')
      );

      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }));

      bootstrap(data);
      await waitMicrotask();

      // Batch update 100 items
      for (let i = 0; i < 100; i++) {
        proxy[i].value = `updated-${i}`;
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'push 100 items to existing large array',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; value: string }>>(
        (d) => d.getArray('arr')
      );

      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }));

      bootstrap(data);
      await waitMicrotask();

      // Push 100 new items
      for (let i = 1000; i < 1100; i++) {
        proxy.push({ id: i, value: `item-${i}` });
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'splice operations on large array (100 deletes)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; value: string }>>(
        (d) => d.getArray('arr')
      );

      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }));

      bootstrap(data);
      await waitMicrotask();

      // Delete 100 items from various positions
      for (let i = 0; i < 100; i++) {
        proxy.splice(i * 9, 1); // Delete every 9th remaining item
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'replace 100 items in large array (same-index delete+insert)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; value: string }>>(
        (d) => d.getArray('arr')
      );

      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }));

      bootstrap(data);
      await waitMicrotask();

      // Replace 100 items (tests delete+set merge optimization)
      for (let i = 0; i < 100; i++) {
        proxy[i] = { id: i, value: `replaced-${i}` };
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );
});

// =============================================================================
// Category 2: Deep Nesting (10+ levels)
// =============================================================================

describe('Deep Nesting Performance', () => {
  // Helper to create deeply nested structure
  type DeepStructure = { value: string } | { nested: DeepStructure };
  function createDeepStructure(depth: number): DeepStructure {
    if (depth === 0) {
      return { value: 'leaf' };
    }
    return { nested: createDeepStructure(depth - 1) };
  }

  bench(
    'access deep property (10 levels) - lazy materialization',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Record<string, unknown>>((d) => d.getMap('root'));

      bootstrap({ data: createDeepStructure(10) });
      await waitMicrotask();

      // Access deep property (forces materialization)
      let current: Record<string, unknown> = (proxy as Record<string, unknown>).data as Record<string, unknown>;
      for (let i = 0; i < 10; i++) {
        current = current.nested as Record<string, unknown>;
      }
      const _value = (current as { value: string }).value;

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'access deep property (20 levels) - lazy materialization',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Record<string, unknown>>((d) => d.getMap('root'));

      bootstrap({ data: createDeepStructure(20) });
      await waitMicrotask();

      // Access deep property (forces materialization)
      let current: Record<string, unknown> = (proxy as Record<string, unknown>).data as Record<string, unknown>;
      for (let i = 0; i < 20; i++) {
        current = current.nested as Record<string, unknown>;
      }
      const _value = (current as { value: string }).value;

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'mutate deep property (10 levels) - propagation time',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Record<string, unknown>>((d) => d.getMap('root'));

      bootstrap({ data: createDeepStructure(10) });
      await waitMicrotask();

      // Navigate to deep property
      let current: Record<string, unknown> = (proxy as Record<string, unknown>).data as Record<string, unknown>;
      for (let i = 0; i < 9; i++) {
        current = current.nested as Record<string, unknown>;
      }

      // Mutate at depth
      ((current.nested as Record<string, unknown>).value as string) = 'mutated';
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'mutate deep property (20 levels) - propagation time',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Record<string, unknown>>((d) => d.getMap('root'));

      bootstrap({ data: createDeepStructure(20) });
      await waitMicrotask();

      // Navigate to deep property
      let current: Record<string, unknown> = (proxy as Record<string, unknown>).data as Record<string, unknown>;
      for (let i = 0; i < 19; i++) {
        current = current.nested as Record<string, unknown>;
      }

      // Mutate at depth
      ((current.nested as Record<string, unknown>).value as string) = 'mutated';
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'replace mid-level object in deep structure (10 levels)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Record<string, unknown>>((d) => d.getMap('root'));

      bootstrap({ data: createDeepStructure(10) });
      await waitMicrotask();

      // Navigate to mid-level (level 5)
      let current: Record<string, unknown> = (proxy as Record<string, unknown>).data as Record<string, unknown>;
      for (let i = 0; i < 4; i++) {
        current = current.nested as Record<string, unknown>;
      }

      // Replace mid-level object (tests subtree purging)
      current.nested = createDeepStructure(5);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'bootstrap deep structure vs shallow - comparison',
    async () => {
      // Deep structure
      const { bootstrap: bootstrapDeep, dispose: disposeDeep } = createDocWithProxy<Record<string, unknown>>(
        (d) => d.getMap('root')
      );
      bootstrapDeep({ data: createDeepStructure(15) });
      await waitMicrotask();

      // Shallow structure with equivalent data
      const { bootstrap: bootstrapShallow, dispose: disposeShallow } = createDocWithProxy<Record<string, unknown>>(
        (d) => d.getMap('root')
      );
      bootstrapShallow({ items: Array(100).fill({ value: 'leaf' }) });
      await waitMicrotask();

      disposeDeep();
      disposeShallow();
    },
    {
      time: 5000,
    }
  );
});

// =============================================================================
// Category 3: Rapid Mutations (Batching Effectiveness)
// =============================================================================

describe('Rapid Mutations - Batching Effectiveness', () => {
  bench(
    'single microtask: 1000 operations on array',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; count: number }>>(
        (d) => d.getArray('arr')
      );

      // Bootstrap with 100 items
      bootstrap(Array.from({ length: 100 }, (_, i) => ({ id: i, count: 0 })));
      await waitMicrotask();

      // Perform 1000 mutations in same tick (tests batching)
      for (let i = 0; i < 1000; i++) {
        const idx = i % 100;
        proxy[idx].count++;
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'single microtask: 1000 map operations',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Record<string, number>>((d) => d.getMap('root'));

      // Bootstrap with 100 keys
      const data: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        data[`key${i}`] = 0;
      }
      bootstrap(data);
      await waitMicrotask();

      // Perform 1000 mutations in same tick
      for (let i = 0; i < 1000; i++) {
        const key = `key${i % 100}`;
        proxy[key]++;
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'multiple microtasks: 10 batches of 100 operations',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; count: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap(Array.from({ length: 100 }, (_, i) => ({ id: i, count: 0 })));
      await waitMicrotask();

      // 10 separate batches (tests multiple transactions)
      for (let batch = 0; batch < 10; batch++) {
        for (let i = 0; i < 100; i++) {
          const idx = i % 100;
          proxy[idx].count++;
        }
        await waitMicrotask();
      }

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'mixed operations: adds, updates, deletes in same tick',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; value: string }>>(
        (d) => d.getArray('arr')
      );

      bootstrap(Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` })));
      await waitMicrotask();

      // Mix of operations in same tick
      for (let i = 0; i < 50; i++) {
        proxy[i].value = `updated-${i}`; // Update
      }
      for (let i = 0; i < 20; i++) {
        proxy.push({ id: 100 + i, value: `new-${i}` }); // Add
      }
      for (let i = 0; i < 10; i++) {
        proxy.splice(50 + i, 1); // Delete
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'nested mutations: parent and child changes in same tick',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<
        Array<{ id: number; nested: { value: string; deep: { count: number } } }>
      >((d) => d.getArray('arr'));

      bootstrap(
        Array.from({ length: 100 }, (_, i) => ({
          id: i,
          nested: { value: `item-${i}`, deep: { count: 0 } },
        }))
      );
      await waitMicrotask();

      // Mutate at multiple nesting levels in same tick
      for (let i = 0; i < 100; i++) {
        proxy[i].nested.value = `updated-${i}`;
        proxy[i].nested.deep.count++;
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'operation deduplication test: same key updated 1000 times',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<{ counter: number }>((d) => d.getMap('root'));

      bootstrap({ counter: 0 });
      await waitMicrotask();

      // Update same key 1000 times in same tick (should deduplicate)
      for (let i = 0; i < 1000; i++) {
        proxy.counter = i;
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );
});

// =============================================================================
// Category 4: Multi-Client Sync Latency
// =============================================================================

describe('Multi-Client Sync Latency', () => {
  bench(
    'two-client: small payload sync (single property)',
    async () => {
      const { docA, docB } = createTwoDocsWithRelay();

      const proxyA = createYjsProxy<{ value: number }>(docA, {
        getRoot: (d) => d.getMap('root'),
      });
      const proxyB = createYjsProxy<{ value: number }>(docB, {
        getRoot: (d) => d.getMap('root'),
      });

      proxyA.bootstrap({ value: 0 });
      await waitMicrotask();

      // Measure sync time
      const _start = performance.now();
      proxyA.proxy.value = 42;
      await waitMicrotask();
      // Access on B to verify sync
      const _synced = proxyB.proxy.value === 42;
      const _end = performance.now();

      proxyA.dispose();
      proxyB.dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'two-client: medium payload sync (nested object)',
    async () => {
      const { docA, docB } = createTwoDocsWithRelay();

      const proxyA = createYjsProxy<Record<string, unknown>>(docA, {
        getRoot: (d) => d.getMap('root'),
      });
      const proxyB = createYjsProxy<Record<string, unknown>>(docB, {
        getRoot: (d) => d.getMap('root'),
      });

      proxyA.bootstrap({ user: { name: 'Alice', age: 30, profile: { bio: 'Developer' } } });
      await waitMicrotask();

      // Update nested object
      (((proxyA.proxy as Record<string, unknown>).user as Record<string, unknown>).profile as Record<string, unknown>).bio = 'Senior Developer';
      await waitMicrotask();
      const _synced = (((proxyB.proxy as Record<string, unknown>).user as Record<string, unknown>).profile as Record<string, unknown>).bio === 'Senior Developer';

      proxyA.dispose();
      proxyB.dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'two-client: large payload sync (100-item array)',
    async () => {
      const { docA, docB } = createTwoDocsWithRelay();

      const proxyA = createYjsProxy<{ items: Array<{ id: number; value: string }> }>(docA, {
        getRoot: (d) => d.getMap('root'),
      });
      const proxyB = createYjsProxy<{ items: Array<{ id: number; value: string }> }>(docB, {
        getRoot: (d) => d.getMap('root'),
      });

      proxyA.bootstrap({ items: [] });
      await waitMicrotask();

      // Push 100 items in one batch
      for (let i = 0; i < 100; i++) {
        ((proxyA.proxy as Record<string, unknown>).items as Array<unknown>).push({ id: i, value: `item-${i}` });
      }
      await waitMicrotask();
      const _synced = ((proxyB.proxy as Record<string, unknown>).items as Array<unknown>).length === 100;

      proxyA.dispose();
      proxyB.dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'two-client: batch of 100 individual updates',
    async () => {
      const { docA, docB } = createTwoDocsWithRelay();

      const proxyA = createYjsProxy<Array<{ id: number; count: number }>>(docA, {
        getRoot: (d) => d.getArray('arr'),
      });
      const proxyB = createYjsProxy<Array<{ id: number; count: number }>>(docB, {
        getRoot: (d) => d.getArray('arr'),
      });

      proxyA.bootstrap(Array.from({ length: 100 }, (_, i) => ({ id: i, count: 0 })));
      await waitMicrotask();

      // Update all 100 items in same tick
      for (let i = 0; i < 100; i++) {
        ((proxyA.proxy as Array<Record<string, unknown>>)[i] as Record<string, number>).count++;
      }
      await waitMicrotask();
      const _synced = ((proxyB.proxy as Array<Record<string, unknown>>)[0] as Record<string, number>).count === 1;

      proxyA.dispose();
      proxyB.dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'two-client: bidirectional sync (A->B and B->A)',
    async () => {
      const { docA, docB } = createTwoDocsWithRelay();

      const proxyA = createYjsProxy<{ counterA: number; counterB: number }>(docA, {
        getRoot: (d) => d.getMap('root'),
      });
      const proxyB = createYjsProxy<{ counterA: number; counterB: number }>(docB, {
        getRoot: (d) => d.getMap('root'),
      });

      proxyA.bootstrap({ counterA: 0, counterB: 0 });
      await waitMicrotask();

      // Update from both sides
      ((proxyA.proxy as Record<string, number>).counterA as number)++;
      ((proxyB.proxy as Record<string, number>).counterB as number)++;
      await waitMicrotask();

      const _syncedA = (proxyA.proxy as Record<string, number>).counterB === 1;
      const _syncedB = (proxyB.proxy as Record<string, number>).counterA === 1;

      proxyA.dispose();
      proxyB.dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'two-client: deep nested sync (10 levels)',
    async () => {
      const { docA, docB } = createTwoDocsWithRelay();

      const proxyA = createYjsProxy<Record<string, unknown>>(docA, {
        getRoot: (d) => d.getMap('root'),
      });
      const proxyB = createYjsProxy<Record<string, unknown>>(docB, {
        getRoot: (d) => d.getMap('root'),
      });

      type DeepStructure = { value: string } | { nested: DeepStructure };
      function createDeepStructure(depth: number): DeepStructure {
        if (depth === 0) return { value: 'leaf' };
        return { nested: createDeepStructure(depth - 1) };
      }

      proxyA.bootstrap({ data: createDeepStructure(10) });
      await waitMicrotask();

      // Navigate and mutate deep property
      let current: Record<string, unknown> = (proxyA.proxy as Record<string, unknown>).data as Record<string, unknown>;
      for (let i = 0; i < 9; i++) {
        current = current.nested as Record<string, unknown>;
      }
      ((current.nested as Record<string, unknown>).value as string) = 'updated';
      await waitMicrotask();

      // Verify on B
      let currentB: Record<string, unknown> = (proxyB.proxy as Record<string, unknown>).data as Record<string, unknown>;
      for (let i = 0; i < 9; i++) {
        currentB = currentB.nested as Record<string, unknown>;
      }
      const _synced = ((currentB.nested as Record<string, unknown>).value as string) === 'updated';

      proxyA.dispose();
      proxyB.dispose();
    },
    {
      time: 5000,
    }
  );
});

// =============================================================================
// Category 5: Memory & Efficiency Tests
// =============================================================================

describe('Memory & Efficiency', () => {
  bench(
    'lazy materialization efficiency: access 10% of large structure',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<{
        items: Array<{ id: number; nested: { value: string } }>;
      }>((d) => d.getMap('root'));

      // Bootstrap 1000 items
      bootstrap({
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          nested: { value: `item-${i}` },
        })),
      });
      await waitMicrotask();

      // Only access 10% (tests lazy materialization benefit)
      for (let i = 0; i < 100; i++) {
        const _value = (((proxy as Record<string, unknown>).items as Array<Record<string, unknown>>)[i * 10] as Record<string, Record<string, string>>).nested.value;
      }

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'subtree purging with complex nested structure',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<
        Array<{ id: number; children: Array<{ value: string }> }>
      >((d) => d.getArray('arr'));

      // Create structure with nested arrays
      bootstrap(
        Array.from({ length: 100 }, (_, i) => ({
          id: i,
          children: Array.from({ length: 10 }, (_, j) => ({ value: `${i}-${j}` })),
        }))
      );
      await waitMicrotask();

      // Trigger subtree purging by replacing parent while children have pending ops
      for (let i = 0; i < 50; i++) {
        proxy[i].children[0].value = 'stale'; // Will be purged
        proxy[i] = {
          id: i,
          children: [{ value: 'replaced' }],
        }; // Replace parent
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'transaction overhead: 100 separate microtasks vs 1 batch',
    async () => {
      // Separate microtasks (100 transactions)
      const { proxy: proxy1, bootstrap: bootstrap1, dispose: dispose1 } = createDocWithProxy<{ counter: number }>(
        (d) => d.getMap('root')
      );
      bootstrap1({ counter: 0 });
      await waitMicrotask();

      for (let i = 0; i < 100; i++) {
        proxy1.counter++;
        await waitMicrotask();
      }
      dispose1();

      // Single batch (1 transaction)
      const { proxy: proxy2, bootstrap: bootstrap2, dispose: dispose2 } = createDocWithProxy<{ counter: number }>(
        (d) => d.getMap('root')
      );
      bootstrap2({ counter: 0 });
      await waitMicrotask();

      for (let i = 0; i < 100; i++) {
        proxy2.counter++;
      }
      await waitMicrotask();
      dispose2();
    },
    {
      time: 5000,
    }
  );
});

// =============================================================================
// Category 6: Bulk Insert Optimization Impact
// =============================================================================

describe('Bulk Insert Optimization Impact', () => {
  bench(
    'baseline: push 100 items individually (current behavior)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; count: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([]);
      await waitMicrotask();

      // Current implementation: each push creates individual Y.Array insert
      for (let i = 0; i < 100; i++) {
        proxy.push({ id: i, count: 0 });
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'optimized: push 100 items bulk (spread syntax)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; count: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([]);
      await waitMicrotask();

      // Bulk push: should trigger optimization if enabled
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, count: 0 }));
      proxy.push(...items);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'baseline: unshift 100 items individually',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; count: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 999, count: 0 }]);
      await waitMicrotask();

      // Current implementation: each unshift creates individual Y.Array insert
      for (let i = 0; i < 100; i++) {
        proxy.unshift({ id: i, count: 0 });
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'optimized: unshift 100 items bulk (spread syntax)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number; count: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 999, count: 0 }]);
      await waitMicrotask();

      // Bulk unshift: should trigger optimization if enabled
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, count: 0 }));
      proxy.unshift(...items);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'push 50 items, then push 50 more (should batch both)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([]);
      await waitMicrotask();

      // Two bulk operations in same tick
      const items1 = Array.from({ length: 50 }, (_, i) => ({ id: i }));
      const items2 = Array.from({ length: 50 }, (_, i) => ({ id: i + 50 }));
      proxy.push(...items1);
      proxy.push(...items2);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'baseline: push to existing large array (1000 items)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      // Start with large array
      bootstrap(Array.from({ length: 1000 }, (_, i) => ({ id: i })));
      await waitMicrotask();

      // Push 100 more
      for (let i = 1000; i < 1100; i++) {
        proxy.push({ id: i });
      }
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'optimized: push to existing large array (1000 items)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      // Start with large array
      bootstrap(Array.from({ length: 1000 }, (_, i) => ({ id: i })));
      await waitMicrotask();

      // Bulk push 100 more
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1000 }));
      proxy.push(...items);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'nested objects: push 100 items with nested structure',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<
        Array<{ id: number; nested: { value: string; deep: { count: number } } }>
      >((d) => d.getArray('arr'));

      bootstrap([]);
      await waitMicrotask();

      // Bulk push with nested objects
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        nested: { value: `item-${i}`, deep: { count: 0 } },
      }));
      proxy.push(...items);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'two-client sync: bulk push 100 items',
    async () => {
      const { docA, docB } = createTwoDocsWithRelay();

      const proxyA = createYjsProxy<Array<{ id: number }>>(docA, {
        getRoot: (d) => d.getArray('arr'),
      });
      const proxyB = createYjsProxy<Array<{ id: number }>>(docB, {
        getRoot: (d) => d.getArray('arr'),
      });

      proxyA.bootstrap([]);
      await waitMicrotask();

      // Bulk push on A
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
      (proxyA.proxy as Array<{ id: number }>).push(...items);
      await waitMicrotask();

      // Verify sync
      const _synced = (proxyB.proxy as Array<{ id: number }>).length === 100;

      proxyA.dispose();
      proxyB.dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'push 1000 items: stress test',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([]);
      await waitMicrotask();

      // Very large bulk push
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
      proxy.push(...items);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'comparison: no optimization - mixed operations (push + replace)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 0 }, { id: 1 }]);
      await waitMicrotask();

      // Mixed: replace + push (should NOT optimize due to replaces)
      proxy[0] = { id: 10 };
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 2 }));
      proxy.push(...items);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );

  bench(
    'comparison: no optimization - mixed operations (delete + push)',
    async () => {
      const { proxy, bootstrap, dispose } = createDocWithProxy<Array<{ id: number }>>(
        (d) => d.getArray('arr')
      );

      bootstrap([{ id: 0 }, { id: 1 }, { id: 2 }]);
      await waitMicrotask();

      // Mixed: delete + push (should NOT optimize due to deletes)
      proxy.splice(1, 1); // Delete
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 3 }));
      proxy.push(...items);
      await waitMicrotask();

      dispose();
    },
    {
      time: 5000,
    }
  );
});
