import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { SynchronizationContext } from './context';

describe('SynchronizationContext', () => {
  describe('Constructor and Logger', () => {
    it('creates context with default settings (debug=false)', () => {
      const ctx = new SynchronizationContext();
      expect(ctx).toBeInstanceOf(SynchronizationContext);
      expect(ctx.isReconciling).toBe(false);
      expect(ctx.log).toBeDefined();
      expect(ctx.log.debug).toBeInstanceOf(Function);
      expect(ctx.log.warn).toBeInstanceOf(Function);
      expect(ctx.log.error).toBeInstanceOf(Function);
    });

    it('creates context with debug enabled', () => {
      const ctx = new SynchronizationContext(true);
      expect(ctx).toBeInstanceOf(SynchronizationContext);
    });

    it('creates context with trace mode enabled', () => {
      const ctx = new SynchronizationContext(false, true);
      expect(ctx).toBeInstanceOf(SynchronizationContext);
    });

    it('creates context with both debug and trace enabled', () => {
      const ctx = new SynchronizationContext(true, true);
      expect(ctx).toBeInstanceOf(SynchronizationContext);
    });

    it('debug logs are disabled by default', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const ctx = new SynchronizationContext(false);
      
      ctx.log.debug('test message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('debug logs are enabled when debug=true', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const ctx = new SynchronizationContext(true);
      
      ctx.log.debug('test message', 123);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[valtio-yjs] test message',
        123
      );
      consoleSpy.mockRestore();
    });

    it('warn logs always work regardless of debug setting', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const ctx = new SynchronizationContext(false);
      
      ctx.log.warn('warning message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[valtio-yjs] warning message'
      );
      consoleSpy.mockRestore();
    });

    it('error logs always work regardless of debug setting', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ctx = new SynchronizationContext(false);
      
      const testError = new Error('test');
      ctx.log.error('error message', testError);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[valtio-yjs] error message',
        testError
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Cache Management', () => {
    it('initializes with empty caches', () => {
      const ctx = new SynchronizationContext();
      const yMap = new Y.Map();
      const proxy = {};
      
      expect(ctx.yTypeToValtioProxy.get(yMap)).toBeUndefined();
      expect(ctx.valtioProxyToYType.get(proxy)).toBeUndefined();
    });

    it('can store and retrieve Y type to proxy mappings', () => {
      const ctx = new SynchronizationContext();
      const yMap = new Y.Map();
      const proxy = { test: true };
      
      ctx.yTypeToValtioProxy.set(yMap, proxy);
      
      expect(ctx.yTypeToValtioProxy.get(yMap)).toBe(proxy);
    });

    it('can store and retrieve proxy to Y type mappings', () => {
      const ctx = new SynchronizationContext();
      const yMap = new Y.Map();
      const proxy = { test: true };
      
      ctx.valtioProxyToYType.set(proxy, yMap);
      
      expect(ctx.valtioProxyToYType.get(proxy)).toBe(yMap);
    });
  });

  describe('Reconciling Lock', () => {
    it('starts with isReconciling=false', () => {
      const ctx = new SynchronizationContext();
      expect(ctx.isReconciling).toBe(false);
    });

    it('sets isReconciling=true during lock execution', () => {
      const ctx = new SynchronizationContext();
      let valueInside = false;
      
      ctx.withReconcilingLock(() => {
        valueInside = ctx.isReconciling;
      });
      
      expect(valueInside).toBe(true);
    });

    it('resets isReconciling to false after lock execution', () => {
      const ctx = new SynchronizationContext();
      
      ctx.withReconcilingLock(() => {
        // do nothing
      });
      
      expect(ctx.isReconciling).toBe(false);
    });

    it('restores previous isReconciling value on nested calls', () => {
      const ctx = new SynchronizationContext();
      ctx.isReconciling = true;
      
      ctx.withReconcilingLock(() => {
        expect(ctx.isReconciling).toBe(true);
      });
      
      expect(ctx.isReconciling).toBe(true);
    });

    it('resets isReconciling even if function throws', () => {
      const ctx = new SynchronizationContext();
      
      expect(() => {
        ctx.withReconcilingLock(() => {
          throw new Error('test error');
        });
      }).toThrow('test error');
      
      expect(ctx.isReconciling).toBe(false);
    });
  });

  describe('Subscription Management', () => {
    it('registerSubscription stores unsubscribe function', () => {
      const ctx = new SynchronizationContext();
      const yMap = new Y.Map();
      const unsub = vi.fn();
      
      ctx.registerSubscription(yMap, unsub);
      
      expect(ctx.yTypeToUnsubscribe.get(yMap)).toBe(unsub);
    });

    it('registerSubscription calls existing unsubscribe if replacing', () => {
      const ctx = new SynchronizationContext();
      const yMap = new Y.Map();
      const oldUnsub = vi.fn();
      const newUnsub = vi.fn();
      
      ctx.registerSubscription(yMap, oldUnsub);
      ctx.registerSubscription(yMap, newUnsub);
      
      expect(oldUnsub).toHaveBeenCalledOnce();
      expect(ctx.yTypeToUnsubscribe.get(yMap)).toBe(newUnsub);
    });

    it('disposeAll calls all registered unsubscribers', () => {
      const ctx = new SynchronizationContext();
      const yMap1 = new Y.Map();
      const yMap2 = new Y.Map();
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      
      ctx.registerSubscription(yMap1, unsub1);
      ctx.registerSubscription(yMap2, unsub2);
      
      ctx.disposeAll();
      
      expect(unsub1).toHaveBeenCalledOnce();
      expect(unsub2).toHaveBeenCalledOnce();
    });

    it('disposeAll clears all unsubscribers after calling them', () => {
      const ctx = new SynchronizationContext();
      const yMap = new Y.Map();
      const unsub = vi.fn();
      
      ctx.registerSubscription(yMap, unsub);
      ctx.disposeAll();
      
      // Calling disposeAll again shouldn't call unsub again
      ctx.disposeAll();
      expect(unsub).toHaveBeenCalledOnce();
    });

    it('disposeAll handles errors in unsubscribe functions gracefully', () => {
      const ctx = new SynchronizationContext();
      const yMap1 = new Y.Map();
      const yMap2 = new Y.Map();
      const throwingUnsub = vi.fn(() => {
        throw new Error('unsub error');
      });
      const normalUnsub = vi.fn();
      
      ctx.registerSubscription(yMap1, throwingUnsub);
      ctx.registerSubscription(yMap2, normalUnsub);
      
      // Should not throw
      expect(() => ctx.disposeAll()).not.toThrow();
      
      // Both should have been called
      expect(throwingUnsub).toHaveBeenCalledOnce();
      expect(normalUnsub).toHaveBeenCalledOnce();
    });

    it('disposeAll is idempotent', () => {
      const ctx = new SynchronizationContext();
      const yMap = new Y.Map();
      const unsub = vi.fn();
      
      ctx.registerSubscription(yMap, unsub);
      
      ctx.disposeAll();
      ctx.disposeAll();
      ctx.disposeAll();
      
      expect(unsub).toHaveBeenCalledOnce();
    });
  });

  describe('bindDoc', () => {
    it('binds a Y.Doc to the context', () => {
      const ctx = new SynchronizationContext();
      const doc = new Y.Doc();
      
      // Should not throw
      expect(() => ctx.bindDoc(doc)).not.toThrow();
    });

    it('can bind multiple times (rebinding)', () => {
      const ctx = new SynchronizationContext();
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      ctx.bindDoc(doc1);
      ctx.bindDoc(doc2);
      
      // Should work without errors
      expect(true).toBe(true);
    });
  });

  describe('Arrays with Delta During Sync', () => {
    it('initially no arrays are marked with delta', () => {
      const ctx = new SynchronizationContext();
      const yArray = new Y.Array();
      
      expect(ctx.shouldSkipArrayStructuralReconcile(yArray)).toBe(false);
    });

    it('setArraysWithDeltaDuringSync marks arrays', () => {
      const ctx = new SynchronizationContext();
      const yArray1 = new Y.Array();
      const yArray2 = new Y.Array();
      
      ctx.setArraysWithDeltaDuringSync([yArray1, yArray2]);
      
      expect(ctx.shouldSkipArrayStructuralReconcile(yArray1)).toBe(true);
      expect(ctx.shouldSkipArrayStructuralReconcile(yArray2)).toBe(true);
    });

    it('clearArraysWithDeltaDuringSync clears all marks', () => {
      const ctx = new SynchronizationContext();
      const yArray = new Y.Array();
      
      ctx.setArraysWithDeltaDuringSync([yArray]);
      expect(ctx.shouldSkipArrayStructuralReconcile(yArray)).toBe(true);
      
      ctx.clearArraysWithDeltaDuringSync();
      expect(ctx.shouldSkipArrayStructuralReconcile(yArray)).toBe(false);
    });

    it('only marked arrays return true for shouldSkip', () => {
      const ctx = new SynchronizationContext();
      const yArray1 = new Y.Array();
      const yArray2 = new Y.Array();
      
      ctx.setArraysWithDeltaDuringSync([yArray1]);
      
      expect(ctx.shouldSkipArrayStructuralReconcile(yArray1)).toBe(true);
      expect(ctx.shouldSkipArrayStructuralReconcile(yArray2)).toBe(false);
    });

    it('can handle empty array set', () => {
      const ctx = new SynchronizationContext();
      const yArray = new Y.Array();
      
      ctx.setArraysWithDeltaDuringSync([]);
      
      expect(ctx.shouldSkipArrayStructuralReconcile(yArray)).toBe(false);
    });
  });

  describe('Write Scheduler Integration', () => {
    let ctx: SynchronizationContext;
    let doc: Y.Doc;

    beforeEach(() => {
      ctx = new SynchronizationContext();
      doc = new Y.Doc();
      ctx.bindDoc(doc);
    });

    afterEach(() => {
      ctx.disposeAll();
    });

    it('enqueueMapSet queues a map set operation', () => {
      const yMap = doc.getMap('test');
      
      // Should not throw
      expect(() => {
        ctx.enqueueMapSet(yMap, 'key', 'value');
      }).not.toThrow();
    });

    it('enqueueMapDelete queues a map delete operation', () => {
      const yMap = doc.getMap('test');
      yMap.set('key', 'value');
      
      expect(() => {
        ctx.enqueueMapDelete(yMap, 'key');
      }).not.toThrow();
    });

    it('enqueueArraySet queues an array set operation', () => {
      const yArray = doc.getArray('test');
      yArray.push(['initial']);
      
      expect(() => {
        ctx.enqueueArraySet(yArray, 0, 'newValue');
      }).not.toThrow();
    });

    it('enqueueArrayReplace queues an array replace operation', () => {
      const yArray = doc.getArray('test');
      yArray.push(['initial']);
      
      expect(() => {
        ctx.enqueueArrayReplace(yArray, 0, 'replacement');
      }).not.toThrow();
    });

    it('enqueueArrayDelete queues an array delete operation', () => {
      const yArray = doc.getArray('test');
      yArray.push(['item']);
      
      expect(() => {
        ctx.enqueueArrayDelete(yArray, 0);
      }).not.toThrow();
    });
  });
});

