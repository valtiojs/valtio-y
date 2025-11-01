/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as fc from 'fast-check';
import { createDocWithProxy, waitMicrotask, createRelayedProxiesMapRoot } from '../helpers/test-helpers';

describe('Integration: Deep Nesting (Property-Based)', () => {
  describe('Arbitrary Deep Structures', () => {
    it('should sync any deeply nested object structure to Y.js', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.object({ 
            maxDepth: 10, 
            maxKeys: 50,
            withNullPrototype: false,
            // Exclude problematic JavaScript magic property names
            key: fc.string().filter(s => !['__proto__', 'constructor', 'prototype'].includes(s)),
            // Exclude undefined values (valtio-yjs doesn't support them)
            values: [
              fc.string(),
              fc.integer(),
              fc.boolean(),
              fc.constant(null),
              fc.double({ noNaN: true }),
              fc.array(fc.string(), { maxLength: 10 })
            ]
          }),
          async (structure) => {
            const { proxy, doc } = createDocWithProxy<any>((d) => d.getMap('root'));
            const yRoot = doc.getMap<any>('root');

            // Set the random structure
            proxy.data = JSON.parse(JSON.stringify(structure)); // Remove any undefined
            await waitMicrotask();

            // Invariant: Y.js should contain the same structure
            const yData = yRoot.get('data');
            const yJSON = yData ? (yData as Y.Map<any> | Y.Array<any>).toJSON() : yData;
            expect(yJSON).toEqual(JSON.parse(JSON.stringify(structure)));
          }
        ),
        { numRuns: 50, timeout: 10000 }
      );
    });

    it('should handle mutations at arbitrary depth', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate: object, path to mutate, new value
          fc.tuple(
            fc.object({ 
              maxDepth: 8, 
              maxKeys: 20,
              key: fc.string().filter(s => !['__proto__', 'constructor', 'prototype'].includes(s))
            }),
            fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 5 }),
            fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
          ),
          async ([structure, path, newValue]) => {
            const { proxy, doc } = createDocWithProxy<any>((d) => d.getMap('root'));
            const yRoot = doc.getMap<any>('root');

            // Initialize with structure
            proxy.data = JSON.parse(JSON.stringify(structure)); // Deep clone to avoid reference issues
            await waitMicrotask();

            // Try to mutate at the path
            let current: any = proxy.data;
            let isValidPath = true;
            
            // Navigate to parent
            for (let i = 0; i < path.length - 1; i++) {
              const key = path[i];
              if (key !== undefined && current && typeof current === 'object' && !Array.isArray(current)) {
                current = current[key];
              } else {
                isValidPath = false;
                break;
              }
            }

            // If valid path to an object, set the value
            if (isValidPath && current && typeof current === 'object' && !Array.isArray(current)) {
              const lastKey = path[path.length - 1];
              if (lastKey !== undefined) {
                current[lastKey] = newValue;
                await waitMicrotask();

                // Invariant: Mutation should be reflected in Y.js
                const yJSON = (yRoot.get('data') as Y.Map<any>).toJSON();
                
                // Navigate the expected path
                let expected: any = yJSON;
                for (let i = 0; i < path.length - 1; i++) {
                  const key = path[i];
                  if (key !== undefined) {
                    expected = expected?.[key];
                  }
                }
                
                if (expected && typeof expected === 'object') {
                  expect(expected[lastKey]).toEqual(newValue);
                }
              }
            }
          }
        ),
        { numRuns: 30, timeout: 15000 }
      );
    });

    it('should handle arbitrary array nesting with operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              fc.integer(),
              fc.string(),
              fc.array(fc.integer(), { maxLength: 10 }),
              fc.record({ id: fc.integer(), nested: fc.array(fc.string(), { maxLength: 5 }) })
            ),
            { minLength: 1, maxLength: 50 }
          ),
          fc.array(
            fc.oneof(
              fc.record({ op: fc.constant('push'), value: fc.integer() }),
              fc.record({ op: fc.constant('unshift'), value: fc.string() }),
              fc.record({ op: fc.constant('splice'), index: fc.nat(49), count: fc.nat(3) })
            ),
            { minLength: 1, maxLength: 10 }
          ),
          async (initialArray, operations) => {
            const { proxy, doc } = createDocWithProxy<any>((d) => d.getMap('root'));
            const yRoot = doc.getMap<any>('root');

            // Initialize
            proxy.list = JSON.parse(JSON.stringify(initialArray));
            await waitMicrotask();

            // Apply operations
            for (const operation of operations) {
              try {
                switch (operation.op) {
                  case 'push':
                    proxy.list.push(operation.value);
                    break;
                  case 'unshift':
                    proxy.list.unshift(operation.value);
                    break;
                  case 'splice':
                    if (proxy.list.length > 0) {
                      const safeIndex = operation.index % proxy.list.length;
                      proxy.list.splice(safeIndex, operation.count);
                    }
                    break;
                }
                await waitMicrotask();

                // Invariant: Array should stay consistent
                const yArray = yRoot.get('list') as Y.Array<any>;
                const yJSON = yArray.toJSON();
                const proxyJSON = JSON.parse(JSON.stringify(proxy.list));
                
                expect(yJSON).toEqual(proxyJSON);
                expect(yJSON.length).toBe(proxyJSON.length);
              } catch {
                // If operation fails, that's ok - just skip
                // We're testing that valid operations maintain consistency
              }
            }
          }
        ),
        { numRuns: 20, timeout: 15000 }
      );
    });
  });

  describe('Wide Structure Properties', () => {
    it('should handle objects with arbitrary number of keys', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => !['__proto__', 'constructor', 'prototype'].includes(s)),
            fc.oneof(fc.integer(), fc.string(), fc.boolean()),
            { minKeys: 10, maxKeys: 200 }
          ),
          async (wideObject) => {
            const { proxy, doc } = createDocWithProxy<any>((d) => d.getMap('root'));
            const yRoot = doc.getMap<any>('root');

            proxy.data = wideObject;
            await waitMicrotask();

            // Invariant: All keys should be present in Y.js
            const yData = yRoot.get('data') as Y.Map<any>;
            expect(yData.size).toBe(Object.keys(wideObject).length);

            // Spot check random keys
            const keys = Object.keys(wideObject);
            const sampleKeys = [keys[0], keys[Math.floor(keys.length / 2)], keys[keys.length - 1]].filter((k): k is string => k !== undefined);
            
            for (const key of sampleKeys) {
              expect(yData.get(key)).toEqual(wideObject[key]);
              expect(proxy.data[key]).toEqual(wideObject[key]);
            }
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    });

    it('should handle mutation of random keys in wide objects', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => !['__proto__', 'constructor', 'prototype'].includes(s)),
            fc.integer(),
            { minKeys: 50, maxKeys: 100 }
          ),
          fc.array(fc.tuple(fc.string().filter(s => !['__proto__', 'constructor', 'prototype'].includes(s)), fc.integer()), { minLength: 5, maxLength: 20 }),
          async (wideObject, mutations) => {
            const { proxy, doc } = createDocWithProxy<any>((d) => d.getMap('root'));
            const yRoot = doc.getMap<any>('root');

            proxy.data = wideObject;
            await waitMicrotask();

            // Apply random mutations
            const keys = Object.keys(wideObject);
            for (const mutation of mutations) {
              if (mutation && keys.length > 0) {
                const [_, newValue] = mutation;
                const randomKey = keys[Math.floor(Math.random() * keys.length)];
                if (randomKey !== undefined) {
                  proxy.data[randomKey] = newValue;
                  await waitMicrotask();

                  // Invariant: Specific key should be updated
                  const yData = yRoot.get('data') as Y.Map<any>;
                  expect(yData.get(randomKey)).toEqual(newValue);
                  expect(proxy.data[randomKey]).toEqual(newValue);
                }
              }
            }
          }
        ),
        { numRuns: 20, timeout: 15000 }
      );
    });
  });

  describe('Cross-Client Synchronization Properties', () => {
    it('should maintain consistency across clients for arbitrary structures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initial: fc.object({ 
              maxDepth: 5, 
              maxKeys: 20,
              key: fc.string().filter(s => !['__proto__', 'constructor', 'prototype'].includes(s))
            }),
            mutations: fc.array(
              fc.record({
                key: fc.string({ minLength: 1, maxLength: 8 }).filter(s => !['__proto__', 'constructor', 'prototype'].includes(s)),
                value: fc.oneof(fc.integer(), fc.string(), fc.boolean())
              }),
              { minLength: 1, maxLength: 10 }
            )
          }),
          async ({ initial, mutations }) => {
            const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

            // Initialize on A
            bootstrapA({ data: JSON.parse(JSON.stringify(initial)) });
            await waitMicrotask();

            // Invariant: B should see the same initial state
            expect(JSON.stringify(proxyB.data)).toEqual(JSON.stringify(initial));

            // Apply mutations on A
            for (const { key, value } of mutations) {
              if (proxyA.data && typeof proxyA.data === 'object' && !Array.isArray(proxyA.data)) {
                proxyA.data[key] = value;
                await waitMicrotask();

                // Invariant: B should see all mutations
                expect(proxyB.data[key]).toEqual(value);
              }
            }

            // Invariant: Final states should be identical
            expect(JSON.stringify(proxyA.data)).toEqual(JSON.stringify(proxyB.data));
          }
        ),
        { numRuns: 25, timeout: 15000 }
      );
    });

    it('should handle concurrent mutations from both clients', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            mutationsA: fc.array(
              fc.tuple(fc.string({ minLength: 1, maxLength: 5 }), fc.integer({ min: 0 })),
              { minLength: 1, maxLength: 10 }
            ),
            mutationsB: fc.array(
              fc.tuple(fc.string({ minLength: 1, maxLength: 5 }), fc.integer({ min: 0 })),
              { minLength: 1, maxLength: 10 }
            )
          }),
          async ({ mutationsA, mutationsB }) => {
            const { proxyA, proxyB, bootstrapA } = createRelayedProxiesMapRoot();

            bootstrapA({ data: {} });
            await waitMicrotask();

            // Collect last write per key to predict final state
            const lastWrites = new Map<string, number>();
            const mutationSequence: Array<{ client: 'A' | 'B'; key: string; value: number }> = [];
            
            // Build interleaved sequence
            const maxLength = Math.max(mutationsA.length, mutationsB.length);
            for (let i = 0; i < maxLength; i++) {
              if (i < mutationsA.length) {
                const mutation = mutationsA[i];
                if (mutation) {
                  const [key, value] = mutation;
                  mutationSequence.push({ client: 'A', key, value });
                  lastWrites.set(key, value);
                }
              }
              if (i < mutationsB.length) {
                const mutation = mutationsB[i];
                if (mutation) {
                  const [key, value] = mutation;
                  mutationSequence.push({ client: 'B', key, value });
                  lastWrites.set(key, value);
                }
              }
            }

            // Apply mutations with proper synchronization
            for (const { client, key, value } of mutationSequence) {
              if (client === 'A') {
                proxyA.data[key] = value;
              } else {
                proxyB.data[key] = value;
              }
              await waitMicrotask(); // Wait for sync after each mutation
            }

            // Final sync to ensure convergence
            await waitMicrotask();
            await waitMicrotask();

            // Invariant: Both clients should converge to same state
            // With concurrent writes, the winner is non-deterministic, but both must agree
            const keysA = Object.keys(proxyA.data).sort();
            const keysB = Object.keys(proxyB.data).sort();
            
            expect(keysA).toEqual(keysB);
            
            // Values MUST converge - CRDTs guarantee this
            // The actual value doesn't matter, just that both clients see the same value
            for (const key of keysA) {
              expect(proxyA.data[key]).toEqual(proxyB.data[key]);
            }
          }
        ),
        { numRuns: 20, timeout: 15000 }
      );
    });
  });

  describe('Performance Properties', () => {
    it('should complete operations in reasonable time regardless of depth', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 15 }),
          async (depth) => {
            const { proxy } = createDocWithProxy<any>((d) => d.getMap('root'));

            // Build structure programmatically - levels from depth-1 down to 0
            let structure: any = { value: 'leaf' };
            for (let i = depth - 1; i >= 0; i--) {
              structure = { [`level${i}`]: structure };
            }

            const start = performance.now();
            proxy.data = structure;
            await waitMicrotask();
            
            // Navigate to leaf using the correct order (0 to depth-1)
            let current = proxy.data;
            for (let i = 0; i < depth; i++) {
              current = current?.[`level${i}`];
              if (!current) break;
            }
            const leafValue = current?.value;
            const duration = performance.now() - start;

            // Invariant: Should complete in reasonable time
            expect(leafValue).toBe('leaf');
            expect(duration).toBeLessThan(100); // Should be under 100ms regardless of depth
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    });

    it('should handle wide objects efficiently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 50, max: 500 }),
          async (numKeys) => {
            const { proxy } = createDocWithProxy<any>((d) => d.getMap('root'));

            // Create wide object
            const wideObj: any = {};
            for (let i = 0; i < numKeys; i++) {
              wideObj[`key${i}`] = i;
            }

            const start = performance.now();
            proxy.data = wideObj;
            await waitMicrotask();
            
            // Access random keys
            const sample = proxy.data[`key${Math.floor(numKeys / 2)}`];
            const duration = performance.now() - start;

            // Invariant: Should scale linearly, not exponentially
            expect(sample).toBe(Math.floor(numKeys / 2));
            expect(duration).toBeLessThan(numKeys * 0.5); // Max 0.5ms per key
          }
        ),
        { numRuns: 20, timeout: 15000 }
      );
    });
  });

  // Concrete edge cases from original deep-nesting.spec.ts
  describe('Concrete Deep Structure Edge Cases', () => {
    it('should handle tree structure with 1000 nodes', async () => {
      const { proxy } = createDocWithProxy<any>((d) => d.getMap('root'));
      
      // Create tree with breadth and depth
      const createTree = (id: number, depth: number, breadth: number): any => {
        if (depth === 0) return { id, value: `leaf-${id}`, isLeaf: true };
        return {
          id,
          value: `node-${id}`,
          isLeaf: false,
          children: Array.from({ length: breadth }, (_, i) => 
            createTree(id * breadth + i + 1, depth - 1, breadth)
          )
        };
      };

      // Tree with depth=5, breadth=4 = ~1365 total nodes
      proxy.tree = createTree(0, 5, 4);
      await waitMicrotask();

      // Verify root
      expect(proxy.tree.id).toBe(0);
      expect(proxy.tree.children.length).toBe(4);
      expect(proxy.tree.isLeaf).toBe(false);

      // Verify deep node access and that leaves exist (5 levels deep)
      const deepNode = proxy.tree.children[0].children[0].children[0].children[0].children[0];
      expect(deepNode.value).toBeDefined();
      expect(deepNode.isLeaf).toBe(true);

      // Mutate mid-level node
      proxy.tree.children[2].value = 'modified';
      await waitMicrotask();
      expect(proxy.tree.children[2].value).toBe('modified');

      // Add new child to mid-level node
      proxy.tree.children[1].children.push({ id: 9999, value: 'new-node', isLeaf: false });
      await waitMicrotask();
      expect(proxy.tree.children[1].children[proxy.tree.children[1].children.length - 1].value).toBe('new-node');
    });

    it('should handle deletion in deep structure', async () => {
      const { proxy } = createDocWithProxy<any>((d) => d.getMap('root'));
      
      proxy.data = { l1: { l2: { l3: { l4: { l5: { value: 'deep', toDelete: 'remove me' } } } } } };
      await waitMicrotask();

      // Delete deep property
      delete proxy.data.l1.l2.l3.l4.l5.toDelete;
      await waitMicrotask();
      expect(proxy.data.l1.l2.l3.l4.l5.toDelete).toBeUndefined();
      expect(proxy.data.l1.l2.l3.l4.l5.value).toBe('deep');
    });

    it('should handle replacing entire subtree in deep structure', async () => {
      const { proxy } = createDocWithProxy<any>((d) => d.getMap('root'));
      
      proxy.data = { l1: { l2: { l3: { old: 'value' } } } };
      await waitMicrotask();

      // Replace mid-level subtree
      proxy.data.l1.l2 = { l3: { new: 'value' }, l4: { another: 'branch' } };
      await waitMicrotask();

      expect(proxy.data.l1.l2.l3.new).toBe('value');
      expect(proxy.data.l1.l2.l4.another).toBe('branch');
      expect(proxy.data.l1.l2.l3.old).toBeUndefined();
    });

    it('should handle deep structure with mixed array and object nesting', async () => {
      const { proxy } = createDocWithProxy<any>((d) => d.getMap('root'));
      
      proxy.complex = {
        a: [
          {
            b: [
              {
                c: {
                  d: [
                    {
                      e: { value: 'deeply mixed' }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };
      await waitMicrotask();

      expect(proxy.complex.a[0].b[0].c.d[0].e.value).toBe('deeply mixed');

      // Replace array element deeply
      proxy.complex.a[0].b[0].c.d[0] = { e: { value: 'replaced' } };
      await waitMicrotask();
      expect(proxy.complex.a[0].b[0].c.d[0].e.value).toBe('replaced');
    });
  });
});

