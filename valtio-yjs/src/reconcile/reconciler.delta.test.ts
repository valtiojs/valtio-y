/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { SynchronizationContext } from '../core/context';
import { getOrCreateValtioProxy } from '../bridge/valtio-bridge';
import { reconcileValtioArrayWithDelta } from './reconciler';

describe('Reconciler: delta insert materializes fields immediately', () => {
  it('delta.insert of Y.Map makes fields available on proxy right away', () => {
    const doc = new Y.Doc();
    const context = new SynchronizationContext(true);
    const yArr = new Y.Array<any>();
    const proxy = getOrCreateValtioProxy(context, yArr, doc) as any[];

    // Prepare inserted map and integrate it under the same doc first
    const inserted = new Y.Map<any>();
    inserted.set('id', 1);
    inserted.set('text', 'Replaced Alpha');
    const ch = new Y.Array<any>();
    ch.insert(0, [{ id: 1001, text: 'Alpha - Child A' }, { id: 1002, text: 'Alpha - Child B' }]);
    inserted.set('children', ch);
    const root = doc.getMap('pool');
    root.set('tmp', inserted);

    const delta = [{ insert: [inserted] }, { delete: 0 }];

    reconcileValtioArrayWithDelta(context, yArr, doc, delta as any);
    expect(Array.isArray(proxy)).toBe(true);
    expect(proxy.length).toBe(1);
    expect(proxy[0].text).toBe('Replaced Alpha');
    expect(Array.isArray(proxy[0].children)).toBe(true);
    expect(proxy[0].children[0].text).toBe('Alpha - Child A');
  });
});


