/* eslint @typescript-eslint/no-explicit-any: "off" */

import * as Y from 'yjs';
import { createYjsProxy } from '../../src/index';

export const waitMicrotask = () => Promise.resolve();

export type GetRootFn = (d: Y.Doc) => Y.Map<unknown> | Y.Array<unknown>;

export function createDocWithProxy<T extends object>(getRoot: GetRootFn) {
  const doc = new Y.Doc();
  const result = createYjsProxy<T>(doc, { getRoot });
  return { doc, ...result } as const;
}

export function createTwoDocsWithRelay(): { docA: Y.Doc; docB: Y.Doc; RELAY_ORIGIN: symbol } {
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

  return { docA, docB, RELAY_ORIGIN } as const;
}

export function createRelayedProxiesMapRoot(options?: { debug?: boolean }) {
  const { docA, docB } = createTwoDocsWithRelay();
  const a = createYjsProxy<any>(docA, { getRoot: (d) => d.getMap('root'), debug: options?.debug });
  const b = createYjsProxy<any>(docB, { getRoot: (d) => d.getMap('root'), debug: options?.debug });
  return {
    docA,
    docB,
    proxyA: a.proxy,
    proxyB: b.proxy,
    bootstrapA: a.bootstrap,
    disposeA: a.dispose,
    disposeB: b.dispose,
  } as const;
}

export function createRelayedProxiesArrayRoot() {
  const { docA, docB } = createTwoDocsWithRelay();
  const a = createYjsProxy<any[]>(docA, { getRoot: (d) => d.getArray('arr') });
  const b = createYjsProxy<any[]>(docB, { getRoot: (d) => d.getArray('arr') });
  return {
    docA,
    docB,
    proxyA: a.proxy,
    proxyB: b.proxy,
    bootstrapA: a.bootstrap,
    disposeA: a.dispose,
    disposeB: b.dispose,
  } as const;
}


