/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../../src/index';

const waitMicrotask = () => Promise.resolve();

describe('Integration 2A: Yjs → Valtio (Remote Change Simulation)', () => {
  it('map change in Yjs reflects in proxy, identity preserved', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap<unknown>('root') as Y.Map<any>;
    const { proxy } = createYjsProxy<{ users: Array<{ id: string; profile?: { name?: string } }> }>(doc, {
      getRoot: (d) => d.getMap('root'),
    });

    // Initialize through Yjs first to avoid races with controller scheduler
    const yUsers = new Y.Array<any>();
    yRoot.set('users', yUsers);
    await waitMicrotask();

    const prevUsersRef = proxy.users;

    // Remote mutation directly on Yjs
    const newUser = new Y.Map<any>();
    newUser.set('id', 'u1');
    const profile = new Y.Map<any>();
    profile.set('name', 'Alice');
    newUser.set('profile', profile);
    yUsers.insert(0, [newUser]);

    await waitMicrotask();

    expect(Array.isArray(proxy.users)).toBe(true);
    expect(proxy.users).toHaveLength(1);
    expect(proxy.users).toBe(prevUsersRef);
    const item = proxy.users[0];
    expect(typeof item).toBe('object');
    expect(item!.id).toBe('u1');
    expect(item!.profile!.name).toBe('Alice');

    // Update primitive value remotely and ensure proxy updates in place
    (newUser.get('profile') as Y.Map<any>).set('name', 'Alicia');
    await waitMicrotask();
    expect(proxy.users[0]).toBe(item); // identity preserved
    expect(item!.profile!.name).toBe('Alicia');
  });

  it('array push in Yjs reflects in proxy length and content', async () => {
    const doc = new Y.Doc();
    const { proxy } = createYjsProxy<number[]>(doc, { getRoot: (d) => d.getArray('arr') });
    const yArr = doc.getArray<number>('arr');

    yArr.push([1, 2]);
    await waitMicrotask();
    expect(proxy.length).toBe(2);
    expect(proxy[0]).toBe(1);
    expect(proxy[1]).toBe(2);

    yArr.insert(2, [3]);
    await waitMicrotask();
    expect(proxy).toEqual([1, 2, 3]);
  });

  it('Y.Map delete propagates and preserves sibling identity', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap<any>('root');
    const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

    const obj1 = new Y.Map<any>();
    obj1.set('v', 1);
    const obj2 = new Y.Map<any>();
    obj2.set('w', 2);
    yRoot.set('obj1', obj1);
    yRoot.set('obj2', obj2);
    await waitMicrotask();

    const obj2Ref = proxy.obj2;
    yRoot.delete('obj1');
    await waitMicrotask();

    expect('obj1' in proxy).toBe(false);
    expect(proxy.obj2).toBe(obj2Ref);
    expect(proxy.obj2.w).toBe(2);
  });

  it('Y.Map primitive update propagates and preserves nested identity', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap<any>('root');
    const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

    const user = new Y.Map<any>();
    user.set('name', 'A');
    yRoot.set('user', user);
    await waitMicrotask();

    const userRef = proxy.user;
    user.set('name', 'B');
    await waitMicrotask();

    expect(proxy.user).toBe(userRef);
    expect(userRef.name).toBe('B');
  });

  it('Y.Array delete propagates; other indices keep identity', async () => {
    const doc = new Y.Doc();
    const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
    const yArr = doc.getArray<any>('arr');

    const a = new Y.Map<any>();
    a.set('id', 'a');
    const b = new Y.Map<any>();
    b.set('id', 'b');
    yArr.insert(0, [a, b]);
    await waitMicrotask();

    const bRef = proxy[1];
    yArr.delete(0, 1);
    await waitMicrotask();

    expect(proxy).toHaveLength(1);
    expect(proxy[0]).toBe(bRef);
    expect(proxy[0].id).toBe('b');
  });

  it('single transaction: create nested array under map and insert items without double-apply', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap<any>('root');
    const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

    // In one transaction, create the array and insert items into it
    doc.transact(() => {
      const list = new Y.Array<number>();
      yRoot.set('list', list);
      list.insert(0, [1, 2, 3]);
    });

    await waitMicrotask();
    expect(Array.isArray(proxy.list)).toBe(true);
    expect(proxy.list).toEqual([1, 2, 3]); // no duplication from structural + delta
  });

  it('Deep nested remote insert/replace upgrades child controllers', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap<any>('root');
    const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

    const container = new Y.Map<any>();
    yRoot.set('container', container);
    await waitMicrotask();

    const list = new Y.Array<any>();
    container.set('list', list);
    const item = new Y.Map<any>();
    item.set('k', 'v');
    list.insert(0, [item]);
    await waitMicrotask();

    expect(Array.isArray(proxy.container.list)).toBe(true);
    expect(proxy.container.list).toHaveLength(1);
    expect(proxy.container.list[0].k).toBe('v');
  });

  it('remote set to null reflects as null; remote delete reflects as undefined', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap<any>('root');
    const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

    yRoot.set('prop', 'value');
    await waitMicrotask();
    expect((proxy as any).prop).toBe('value');

    yRoot.set('prop', null);
    await waitMicrotask();
    expect((proxy as any).prop).toBe(null);

    yRoot.delete('prop');
    await waitMicrotask();
    expect((proxy as any).prop).toBe(undefined);
    expect('prop' in (proxy as any)).toBe(false);
  });

  it('remote replace of nested container preserves sibling identity', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap<any>('root');
    const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

    const left = new Y.Map<any>();
    left.set('v', 1);
    const right = new Y.Map<any>();
    right.set('w', 2);
    yRoot.set('left', left);
    yRoot.set('right', right);
    await waitMicrotask();

    const prevRight = proxy.right;
    // Replace left and set nested value in one transaction so reconcile sees final state
    doc.transact(() => {
      const newLeft = new Y.Map<any>();
      newLeft.set('v', 9);
      yRoot.set('left', newLeft);
    });
    await waitMicrotask();
    // Force materialization, then let deep reconcile run
    // before checking nested value
    void proxy.left;
    await waitMicrotask();

    expect(proxy.left.v).toBe(9);
    expect(proxy.right).toBe(prevRight);
  });

  it('nested: null then delete on a key yields proxy transitions value → null → undefined', async () => {
    const doc = new Y.Doc();
    const yRoot = doc.getMap<any>('root');
    const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

    const user = new Y.Map<any>();
    user.set('name', 'A');
    yRoot.set('user', user);
    await waitMicrotask();
    expect(proxy.user.name).toBe('A');

    user.set('name', null);
    await waitMicrotask();
    expect(proxy.user.name).toBe(null);

    user.delete('name');
    await waitMicrotask();
    expect(proxy.user.name).toBe(undefined);
    expect('name' in proxy.user).toBe(false);
  });
});

