/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createYjsProxy } from '../../src/index';
import { waitMicrotask } from '../helpers/test-helpers';

describe('Integration: Special Values', () => {
  describe('Null and Falsy Values', () => {
    it('handles null correctly', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = null;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(null);
      expect(proxy.value).toBe(null);
    });

    it('handles empty string', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = '';
      await waitMicrotask();

      expect(yRoot.get('value')).toBe('');
      expect(proxy.value).toBe('');
    });

    it('handles zero', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = 0;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(0);
      expect(proxy.value).toBe(0);
    });

    it('handles false', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = false;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(false);
      expect(proxy.value).toBe(false);
    });

    it('handles -0 (negative zero)', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = -0;
      await waitMicrotask();

      // -0 is actually preserved as -0 (Object.is distinguishes them)
      expect(Object.is(yRoot.get('value'), -0)).toBe(true);
    });
  });

  describe('Number Edge Cases', () => {
    it('handles very small numbers', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = Number.EPSILON;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(Number.EPSILON);
    });

    it('handles very large numbers', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = Number.MAX_VALUE;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(Number.MAX_VALUE);
    });

    it('handles MIN_VALUE (smallest positive number)', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = Number.MIN_VALUE;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(Number.MIN_VALUE);
    });

    it('handles MAX_SAFE_INTEGER', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = Number.MAX_SAFE_INTEGER;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('handles MIN_SAFE_INTEGER', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = Number.MIN_SAFE_INTEGER;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(Number.MIN_SAFE_INTEGER);
    });

    it('handles negative numbers', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = -42.5;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(-42.5);
    });

    it('handles floating point numbers', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = 3.14159265359;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(3.14159265359);
    });
  });

  describe('String Edge Cases', () => {
    it('handles unicode characters', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = '你好世界 🌍';
      await waitMicrotask();

      expect(yRoot.get('value')).toBe('你好世界 🌍');
    });

    it('handles emoji', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = '😀😃😄😁';
      await waitMicrotask();

      expect(yRoot.get('value')).toBe('😀😃😄😁');
    });

    it('handles newlines and tabs', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = 'line1\nline2\tindented';
      await waitMicrotask();

      expect(yRoot.get('value')).toBe('line1\nline2\tindented');
    });

    it('handles special characters', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\';
      await waitMicrotask();

      expect(yRoot.get('value')).toBe('!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\');
    });

    it('handles very long strings', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      const longString = 'a'.repeat(10000);
      proxy.value = longString;
      await waitMicrotask();

      expect(yRoot.get('value')).toBe(longString);
    });

    it('handles strings with null bytes', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.value = 'before\x00after';
      await waitMicrotask();

      expect(yRoot.get('value')).toBe('before\x00after');
    });
  });

  describe('Empty Collections', () => {
    it('handles empty objects', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.obj = {};
      await waitMicrotask();

      const yObj = yRoot.get('obj') as Y.Map<any>;
      expect(yObj).toBeInstanceOf(Y.Map);
      expect(yObj.size).toBe(0);
    });

    it('handles empty arrays', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.arr = [];
      await waitMicrotask();

      const yArr = yRoot.get('arr') as Y.Array<any>;
      expect(yArr).toBeInstanceOf(Y.Array);
      expect(yArr.length).toBe(0);
    });

    it('handles nested empty structures', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      proxy.nested = {
        emptyObj: {},
        emptyArr: [],
        level2: {
          moreEmpty: {}
        }
      };
      await waitMicrotask();

      expect(proxy.nested.emptyObj).toBeDefined();
      expect(proxy.nested.emptyArr).toBeInstanceOf(Array);
      expect(proxy.nested.emptyArr.length).toBe(0);
    });
  });

  describe('Arrays with Special Values', () => {
    it('handles array with all null values', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push(null, null, null);
      await waitMicrotask();

      expect(yArr.toJSON()).toEqual([null, null, null]);
    });

    it('handles array with mixed falsy values', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push(0, '', false, null);
      await waitMicrotask();

      expect(yArr.toJSON()).toEqual([0, '', false, null]);
    });

    it('handles sparse-like arrays (nulls for missing indices)', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push(1, null, null, 4);
      await waitMicrotask();

      expect(yArr.toJSON()).toEqual([1, null, null, 4]);
    });
  });

  describe('Nested Special Values', () => {
    it('handles objects with all null values', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      proxy.obj = {
        a: null,
        b: null,
        c: null
      };
      await waitMicrotask();

      expect(proxy.obj.a).toBe(null);
      expect(proxy.obj.b).toBe(null);
      expect(proxy.obj.c).toBe(null);
    });

    it('handles deeply nested falsy values', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      proxy.deep = {
        level1: {
          zero: 0,
          level2: {
            empty: '',
            level3: {
              nul: null,
              fals: false
            }
          }
        }
      };
      await waitMicrotask();

      expect(proxy.deep.level1.zero).toBe(0);
      expect(proxy.deep.level1.level2.empty).toBe('');
      expect(proxy.deep.level1.level2.level3.nul).toBe(null);
      expect(proxy.deep.level1.level2.level3.fals).toBe(false);
    });
  });

  describe('Key Names with Special Characters', () => {
    it('handles keys with spaces', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy['key with spaces'] = 'value';
      await waitMicrotask();

      expect(yRoot.get('key with spaces')).toBe('value');
      expect(proxy['key with spaces']).toBe('value');
    });

    it('handles keys with special characters', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy['key-with-dashes'] = 'value1';
      proxy['key.with.dots'] = 'value2';
      proxy['key_with_underscores'] = 'value3';
      await waitMicrotask();

      expect(yRoot.get('key-with-dashes')).toBe('value1');
      expect(yRoot.get('key.with.dots')).toBe('value2');
      expect(yRoot.get('key_with_underscores')).toBe('value3');
    });

    it('handles keys with unicode', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy['键名'] = 'chinese key';
      proxy['🔑'] = 'emoji key';
      await waitMicrotask();

      expect(yRoot.get('键名')).toBe('chinese key');
      expect(yRoot.get('🔑')).toBe('emoji key');
    });

    it('handles empty string as key', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy[''] = 'empty key';
      await waitMicrotask();

      expect(yRoot.get('')).toBe('empty key');
      expect(proxy['']).toBe('empty key');
    });
  });

  describe('Boolean Edge Cases', () => {
    it('handles explicit true and false', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });
      const yRoot = doc.getMap<any>('root');

      proxy.t = true;
      proxy.f = false;
      await waitMicrotask();

      expect(yRoot.get('t')).toBe(true);
      expect(yRoot.get('f')).toBe(false);
    });

    it('handles arrays of booleans', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push(true, false, true, true, false);
      await waitMicrotask();

      expect(yArr.toJSON()).toEqual([true, false, true, true, false]);
    });
  });

  describe('Mixed Type Collections', () => {
    it('handles objects with mixed primitive types', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      proxy.mixed = {
        str: 'hello',
        num: 42,
        bool: true,
        nul: null,
        zero: 0,
        empty: '',
        fals: false
      };
      await waitMicrotask();

      expect(proxy.mixed.str).toBe('hello');
      expect(proxy.mixed.num).toBe(42);
      expect(proxy.mixed.bool).toBe(true);
      expect(proxy.mixed.nul).toBe(null);
      expect(proxy.mixed.zero).toBe(0);
      expect(proxy.mixed.empty).toBe('');
      expect(proxy.mixed.fals).toBe(false);
    });

    it('handles arrays with mixed primitive types', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      proxy.push('string', 123, true, null, false, 0, '');
      await waitMicrotask();

      expect(yArr.toJSON()).toEqual(['string', 123, true, null, false, 0, '']);
    });
  });

  describe('Duplicate Values', () => {
    it('handles duplicate values in arrays', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any[]>(doc, { getRoot: (d) => d.getArray('arr') });
      const yArr = doc.getArray<any>('arr');

      const val = 'duplicate';
      proxy.push(val, val, val);
      await waitMicrotask();

      expect(yArr.toJSON()).toEqual(['duplicate', 'duplicate', 'duplicate']);
    });

    it('handles same object reference in multiple keys', async () => {
      const doc = new Y.Doc();
      const { proxy } = createYjsProxy<any>(doc, { getRoot: (d) => d.getMap('root') });

      const sharedData = { value: 42 };
      proxy.ref1 = sharedData;
      await waitMicrotask();
      
      proxy.ref2 = sharedData;
      await waitMicrotask();

      // Each should have its own Y.Map
      expect(proxy.ref1.value).toBe(42);
      expect(proxy.ref2.value).toBe(42);
    });
  });
});

