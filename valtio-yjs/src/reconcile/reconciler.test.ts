import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../index';
import { reconcileValtioMap, reconcileValtioArray, reconcileValtioArrayWithDelta } from './reconciler';
import { SynchronizationContext } from '../core/context';
// no direct usage

describe('Reconciler: map/array/delta', () => {
  it('map reconciliation: add, delete, update primitives', async () => {
    const doc = new Y.Doc();
    const yMap = doc.getMap('root');
    const { proxy } = createYjsProxy<Record<string, unknown>>(doc, { getRoot: (d) => d.getMap('root') });

    // Manually mutate Y.Map without going through proxy
    yMap.set('a', 1);
    yMap.set('b', 2);

    // Force reconcile
    const context = new SynchronizationContext();
    context.bindDoc(doc);
    // Ensure reconciler can find the existing proxy instance
    // We reuse the controller created by createYjsProxy by linking caches
    context.yTypeToValtioProxy.set(yMap, proxy);
    context.valtioProxyToYType.set(proxy, yMap);

    reconcileValtioMap(context, yMap, doc);
    expect(proxy.a).toBe(1);
    expect(proxy.b).toBe(2);

    // Delete a key in Y and reconcile
    yMap.delete('a');
    reconcileValtioMap(context, yMap, doc);
    expect('a' in proxy).toBe(false);

    // Update a primitive value in Y and reconcile
    yMap.set('b', 3);
    reconcileValtioMap(context, yMap, doc);
    expect(proxy.b).toBe(3);
  });

  it('array reconciliation: pushes in Y reflect in proxy after reconcile', async () => {
    const doc = new Y.Doc();
    const yArr = doc.getArray('arr');
    const { proxy } = createYjsProxy<unknown[]>(doc, { getRoot: (d) => d.getArray('arr') });

    const context = new SynchronizationContext();
    context.bindDoc(doc);
    context.yTypeToValtioProxy.set(yArr, proxy);
    context.valtioProxyToYType.set(proxy, yArr);

    yArr.push([10]);
    reconcileValtioArray(context, yArr, doc);
    expect(proxy.length).toBe(1);
    expect(proxy[0]).toBe(10);
  });

  it('delta reconciliation: splice via delta applies to proxy', async () => {
    const doc = new Y.Doc();
    const yArr = doc.getArray('arr');
    yArr.insert(0, [1, 2, 3, 4]);
    const { proxy } = createYjsProxy<unknown[]>(doc, { getRoot: (d) => d.getArray('arr') });

    const context = new SynchronizationContext();
    context.bindDoc(doc);
    context.yTypeToValtioProxy.set(yArr, proxy);
    context.valtioProxyToYType.set(proxy, yArr);

    // Simulate delta: retain 1, delete 2, insert [9, 8] => [1, 9, 8, 4]
    const delta = [{ retain: 1 }, { delete: 2 }, { insert: [9, 8] }];
    reconcileValtioArrayWithDelta(context, yArr, doc, delta);
    expect(proxy).toEqual([1, 9, 8, 4]);
  });

  it('reconciliation correctly materializes empty nested containers', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap('root');
    const { proxy } = createYjsProxy<Record<string, unknown>>(doc, { getRoot: (d) => d.getMap('root') });

    const context = new SynchronizationContext();
    context.bindDoc(doc);
    context.yTypeToValtioProxy.set(yRoot, proxy);
    context.valtioProxyToYType.set(proxy, yRoot);

    const emptyMap = new Y.Map<unknown>();
    const emptyArray = new Y.Array<unknown>();
    yRoot.set('emptyContainer', emptyMap);
    yRoot.set('emptyList', emptyArray);

    reconcileValtioMap(context, yRoot, doc);

    expect(typeof proxy.emptyContainer).toBe('object');
    expect(Array.isArray(proxy.emptyList)).toBe(true);

    // Verify nested containers are live proxies that can accept mutations
    const emptyContainerProxy = proxy.emptyContainer as Record<string, unknown>;
    (emptyContainerProxy as Record<string, unknown>)['foo'] = 1;
    await Promise.resolve();
    expect((yRoot.get('emptyContainer') as Y.Map<unknown>).get('foo')).toBe(1);
  });

  it('deep materialization across multiple levels in one reconcile pass', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap('root');
    const { proxy } = createYjsProxy<Record<string, unknown>>(doc, { getRoot: (d) => d.getMap('root') });

    const level2 = new Y.Map<unknown>();
    const level3 = new Y.Array<unknown>();
    level2.set('child', level3);
    yRoot.set('parent', level2);

    const context = new SynchronizationContext();
    context.bindDoc(doc);
    context.yTypeToValtioProxy.set(yRoot, proxy);
    context.valtioProxyToYType.set(proxy, yRoot);

    reconcileValtioMap(context, yRoot, doc);

    const parentProxy = (proxy as Record<string, unknown>)['parent'] as Record<string, unknown>;
    expect(typeof parentProxy).toBe('object');
    const childProxy = parentProxy['child'] as unknown[];
    expect(Array.isArray(childProxy)).toBe(true);

    // Now mutate nested proxy and ensure Y updates
    childProxy.push(1);
    await Promise.resolve();
    expect((yRoot.get('parent') as Y.Map<unknown>).get('child') instanceof Y.Array).toBe(true);
    expect(((yRoot.get('parent') as Y.Map<unknown>).get('child') as Y.Array<unknown>).toJSON()).toEqual([1]);
  });

  it('array delta with multiple retains/inserts/deletes reconciles correctly', async () => {
    const doc = new Y.Doc();
    const yArr = doc.getArray('arr');
    yArr.insert(0, [1, 2, 3, 4]);
    const { proxy } = createYjsProxy<unknown[]>(doc, { getRoot: (d) => d.getArray('arr') });

    const context = new SynchronizationContext();
    context.bindDoc(doc);
    context.yTypeToValtioProxy.set(yArr, proxy);
    context.valtioProxyToYType.set(proxy, yArr);

    // [{ retain: 1 }, { insert: [9] }, { retain: 2 }, { delete: 1 }] => [1, 9, 2, 3]
    const delta = [{ retain: 1 }, { insert: [9] }, { retain: 2 }, { delete: 1 }];
    reconcileValtioArrayWithDelta(context, yArr, doc, delta);
    expect(proxy).toEqual([1, 9, 2, 3]);
  });
});

