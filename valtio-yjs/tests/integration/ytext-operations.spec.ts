/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy, syncedText } from '../../src/index';
import { createRelayedProxiesMapRoot, waitMicrotask } from '../helpers/test-helpers';

describe('Integration: Y.Text Operations', () => {
  describe('Single Client Y.Text Operations', () => {
    it('can insert Y.Text into a Y.Map via proxy', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      const text = syncedText('Hello World');
      proxy.description = text;
      await waitMicrotask();

      const yText = yRoot.get('description');
      expect(yText).toBeInstanceOf(Y.Text);
      expect((yText as Y.Text).toString()).toBe('Hello World');
    });

    it('can insert Y.Text into a Y.Array via proxy', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      const text = syncedText('Array text');
      proxy.push(text);
      await waitMicrotask();

      const yText = yArr.get(0);
      expect(yText).toBeInstanceOf(Y.Text);
      expect((yText as Y.Text).toString()).toBe('Array text');
    });

    it('Y.Text reference is accessible through proxy after assignment', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      const text = syncedText('Initial');
      proxy.text = text;
      await waitMicrotask();

      // The proxy should contain the Y.Text instance
      expect(proxy.text).toBeInstanceOf(Y.Text);
      expect(proxy.text.toString()).toBe('Initial');
    });

    it('can modify Y.Text content directly', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      const text = syncedText('Hello');
      proxy.text = text;
      await waitMicrotask();

      // Modify the Y.Text directly
      const yText = yRoot.get('text') as Y.Text;
      yText.insert(5, ' World');

      expect(yText.toString()).toBe('Hello World');
      // Proxy should reflect the same Y.Text instance
      expect(proxy.text.toString()).toBe('Hello World');
    });

    it('can delete from Y.Text', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      const text = syncedText('Hello World');
      proxy.text = text;
      await waitMicrotask();

      // Delete " World" from the text
      proxy.text.delete(5, 6);

      expect(proxy.text.toString()).toBe('Hello');
    });

    it('can insert at specific positions in Y.Text', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      const text = syncedText('Hello World');
      proxy.text = text;
      await waitMicrotask();

      // Insert at position 6
      proxy.text.insert(6, 'Beautiful ');

      expect(proxy.text.toString()).toBe('Hello Beautiful World');
    });

    it('can handle empty Y.Text', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      const text = syncedText();
      proxy.text = text;
      await waitMicrotask();

      const yText = yRoot.get('text') as Y.Text;
      expect(yText.toString()).toBe('');
      expect(yText.length).toBe(0);
    });

    it('can handle Y.Text with unicode characters', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      const text = syncedText('Hello 👋 World 🌍');
      proxy.text = text;
      await waitMicrotask();

      expect(proxy.text.toString()).toBe('Hello 👋 World 🌍');
    });

    it('can handle Y.Text with multiline content', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      const content = 'Line 1\nLine 2\nLine 3';
      const text = syncedText(content);
      proxy.text = text;
      await waitMicrotask();

      expect(proxy.text.toString()).toBe(content);
    });
  });

  describe('Bootstrap with Y.Text', () => {
    it('bootstrap creates proxy with Y.Text reference', () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<any>('root');
      
      // Setup Y.Text in document before creating proxy
      const yText = new Y.Text('Existing content');
      yRoot.set('description', yText);

      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      expect(proxy.description).toBeInstanceOf(Y.Text);
      expect(proxy.description.toString()).toBe('Existing content');
    });

    it('bootstrap handles nested Y.Text in objects', () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<any>('root');
      
      const yNested = new Y.Map<any>();
      const yText = new Y.Text('Nested text');
      yNested.set('text', yText);
      yRoot.set('nested', yNested);

      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      expect(proxy.nested.text).toBeInstanceOf(Y.Text);
      expect(proxy.nested.text.toString()).toBe('Nested text');
    });

    it('bootstrap handles Y.Text in arrays', () => {
      const doc = new Y.Doc();
      const yArr = doc.getArray<any>('arr');
      
      const yText = new Y.Text('Item text');
      yArr.push([yText]);

      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });

      expect(proxy[0]).toBeInstanceOf(Y.Text);
      expect(proxy[0].toString()).toBe('Item text');
    });

    it('bootstrap with multiple Y.Text instances', () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<any>('root');
      
      const yText1 = new Y.Text('First');
      const yText2 = new Y.Text('Second');
      yRoot.set('text1', yText1);
      yRoot.set('text2', yText2);

      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      expect(proxy.text1.toString()).toBe('First');
      expect(proxy.text2.toString()).toBe('Second');
      expect(proxy.text1).not.toBe(proxy.text2);
    });
  });

  describe('Remote Y.Text Changes', () => {
    it('syncs Y.Text changes to proxy', () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<any>('root');
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      // Add Y.Text via Yjs directly (simulating remote change)
      const yText = new Y.Text('Remote text');
      yRoot.set('description', yText);

      expect(proxy.description).toBeInstanceOf(Y.Text);
      expect(proxy.description.toString()).toBe('Remote text');
    });

    it('proxy reflects direct Y.Text modifications', () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<any>('root');
      const yText = new Y.Text('Initial');
      yRoot.set('text', yText);

      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      // Modify Y.Text directly (simulating remote change)
      yText.insert(7, ' content');

      expect(proxy.text.toString()).toBe('Initial content');
    });

    it('proxy reflects Y.Text deletions', () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<any>('root');
      const yText = new Y.Text('Delete me');
      yRoot.set('text', yText);

      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      // Delete from Y.Text (simulating remote change)
      yText.delete(0, 7);

      expect(proxy.text.toString()).toBe('me');
    });
  });

  describe('Y.Text in Nested Structures', () => {
    it('handles Y.Text in deeply nested maps', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      proxy.level1 = { level2: { level3: {} } };
      await waitMicrotask();

      const text = syncedText('Deep text');
      proxy.level1.level2.level3.text = text;
      await waitMicrotask();

      expect(proxy.level1.level2.level3.text).toBeInstanceOf(Y.Text);
      expect(proxy.level1.level2.level3.text.toString()).toBe('Deep text');
    });

    it('handles Y.Text in nested arrays', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      proxy.items = [[]];
      await waitMicrotask();

      const text = syncedText('Nested array text');
      proxy.items[0].push(text);
      await waitMicrotask();

      expect(proxy.items[0][0]).toBeInstanceOf(Y.Text);
      expect(proxy.items[0][0].toString()).toBe('Nested array text');
    });

    it('handles mixed structures with Y.Text', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      proxy.document = {
        title: 'My Document',
        sections: []
      };
      await waitMicrotask();

      const sectionText = syncedText('Section content');
      proxy.document.sections.push({
        heading: 'Introduction',
        content: sectionText
      });
      await waitMicrotask();

      expect(proxy.document.sections[0].content).toBeInstanceOf(Y.Text);
      expect(proxy.document.sections[0].content.toString()).toBe('Section content');
    });
  });

  describe('Y.Text Edge Cases', () => {
    it('handles replacing Y.Text with another Y.Text', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      const text1 = syncedText('First');
      proxy.text = text1;
      await waitMicrotask();

      const text2 = syncedText('Second');
      proxy.text = text2;
      await waitMicrotask();

      const yText = yRoot.get('text') as Y.Text;
      expect(yText.toString()).toBe('Second');
      expect(proxy.text.toString()).toBe('Second');
    });

    it('handles deleting Y.Text from map', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      const text = syncedText('To be deleted');
      proxy.text = text;
      await waitMicrotask();

      delete proxy.text;
      await waitMicrotask();

      expect(yRoot.has('text')).toBe(false);
      expect(proxy.text).toBeUndefined();
    });

    it('handles removing Y.Text from array', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      const text = syncedText('Array item');
      proxy.push(text);
      await waitMicrotask();

      proxy.splice(0, 1);
      await waitMicrotask();

      expect(yArr.length).toBe(0);
      expect(proxy.length).toBe(0);
    });

    it('Y.Text operations are observable', () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap<any>('root');
      const yText = new Y.Text('Initial');
      
      // Y.Text must be in the document for observe to work
      yRoot.set('text', yText);
      
      let observeCount = 0;
      yText.observe(() => {
        observeCount++;
      });

      yText.insert(7, ' text');
      expect(observeCount).toBe(1);

      yText.delete(0, 1);
      expect(observeCount).toBe(2);
    });

    it('Y.Text persists and works correctly after modifications', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      const text = syncedText('Hello');
      proxy.text = text;
      await waitMicrotask();

      const reference1 = proxy.text;
      
      // Modify the text
      proxy.text.insert(5, ' World');
      
      const reference2 = proxy.text;

      // Both should be Y.Text instances pointing to the same underlying Y.Text
      // Note: They may be different proxy wrappers, but should have same content
      expect(reference1).toBeInstanceOf(Y.Text);
      expect(reference2).toBeInstanceOf(Y.Text);
      expect(reference1.toString()).toBe('Hello World');
      expect(reference2.toString()).toBe('Hello World');
    });
  });

  describe('Y.Text Two-Client Collaboration', () => {
    it('Y.Text changes sync between two clients', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Shared text');
      proxyA.text = text;
      await waitMicrotask();

      expect(proxyB.text).toBeInstanceOf(Y.Text);
      expect(proxyB.text.toString()).toBe('Shared text');
    });

    it('concurrent Y.Text inserts merge correctly', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      // Setup shared Y.Text
      const text = syncedText('');
      proxyA.text = text;
      await waitMicrotask();

      // Concurrent inserts at different positions
      proxyA.text.insert(0, 'A');
      proxyB.text.insert(0, 'B');
      await waitMicrotask();

      // Both should have both characters (CRDT resolution)
      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      expect(contentA.length).toBe(2);
      expect(contentA).toMatch(/[AB]{2}/);
    });

    it('Y.Text modifications sync in real-time', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Initial');
      proxyA.text = text;
      await waitMicrotask();

      // Client A appends
      proxyA.text.insert(7, ' text');
      await waitMicrotask();

      expect(proxyB.text.toString()).toBe('Initial text');

      // Client B appends
      proxyB.text.insert(12, ' content');
      await waitMicrotask();

      expect(proxyA.text.toString()).toBe('Initial text content');
    });
  });
});

