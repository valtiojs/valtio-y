import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Y from "yjs";
import { ValtioYjsCoordinator } from "./coordinator";

describe("ValtioYjsCoordinator", () => {
  describe("Constructor and Logger", () => {
    it("creates coordinator with default settings (debug=false)", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      expect(coordinator).toBeInstanceOf(ValtioYjsCoordinator);
      expect(coordinator.state.isReconciling).toBe(false);
      expect(coordinator.logger).toBeDefined();
      expect(coordinator.logger.debug).toBeInstanceOf(Function);
      expect(coordinator.logger.warn).toBeInstanceOf(Function);
      expect(coordinator.logger.error).toBeInstanceOf(Function);
    });

    it("creates coordinator with debug enabled", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc, true);
      expect(coordinator).toBeInstanceOf(ValtioYjsCoordinator);
    });

    it("creates coordinator with trace mode enabled", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc, false, true);
      expect(coordinator).toBeInstanceOf(ValtioYjsCoordinator);
    });

    it("creates coordinator with both debug and trace enabled", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc, true, true);
      expect(coordinator).toBeInstanceOf(ValtioYjsCoordinator);
    });

    it("trace logs are disabled by default", () => {
      const consoleSpy = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);

      coordinator.trace.log("trace message", { value: 1 });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("trace logs emit even when debug is disabled", () => {
      const consoleSpy = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc, false, true);

      coordinator.trace.log("trace message", { value: 2 });

      expect(consoleSpy).toHaveBeenCalledWith("[valtio-y] trace message", {
        value: 2,
      });
      consoleSpy.mockRestore();
    });

    it("debug logs are disabled by default", () => {
      const consoleSpy = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc, false);

      coordinator.logger.debug("test message");

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("debug logs are enabled when debug=true", () => {
      const consoleSpy = vi
        .spyOn(console, "debug")
        .mockImplementation(() => {});
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc, true);

      coordinator.logger.debug("test message", 123);

      expect(consoleSpy).toHaveBeenCalledWith("[valtio-y] test message", 123);
      consoleSpy.mockRestore();
    });

    it("warn logs always work regardless of debug setting", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc, false);

      coordinator.logger.warn("warning message");

      expect(consoleSpy).toHaveBeenCalledWith("[valtio-y] warning message");
      consoleSpy.mockRestore();
    });

    it("error logs always work regardless of debug setting", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc, false);

      const testError = new Error("test");
      coordinator.logger.error("error message", testError);

      expect(consoleSpy).toHaveBeenCalledWith(
        "[valtio-y] error message",
        testError,
      );
      consoleSpy.mockRestore();
    });
  });

  describe("Cache Management", () => {
    it("initializes with empty caches", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yMap = new Y.Map();
      const proxy = {};

      expect(coordinator.state.yTypeToValtioProxy.get(yMap)).toBeUndefined();
      expect(coordinator.state.valtioProxyToYType.get(proxy)).toBeUndefined();
    });

    it("can store and retrieve Y type to proxy mappings", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yMap = new Y.Map();
      const proxy = { test: true };

      coordinator.state.yTypeToValtioProxy.set(yMap, proxy);

      expect(coordinator.state.yTypeToValtioProxy.get(yMap)).toBe(proxy);
    });

    it("can store and retrieve proxy to Y type mappings", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yMap = new Y.Map();
      const proxy = { test: true };

      coordinator.state.valtioProxyToYType.set(proxy, yMap);

      expect(coordinator.state.valtioProxyToYType.get(proxy)).toBe(yMap);
    });
  });

  describe("Reconciling Lock", () => {
    it("starts with isReconciling=false", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      expect(coordinator.state.isReconciling).toBe(false);
    });

    it("sets isReconciling=true during lock execution", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      let valueInside = false;

      coordinator.withReconcilingLock(() => {
        valueInside = coordinator.state.isReconciling;
      });

      expect(valueInside).toBe(true);
    });

    it("resets isReconciling to false after lock execution", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);

      coordinator.withReconcilingLock(() => {
        // do nothing
      });

      expect(coordinator.state.isReconciling).toBe(false);
    });

    it("restores previous isReconciling value on nested calls", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      coordinator.state.isReconciling = true;

      coordinator.withReconcilingLock(() => {
        expect(coordinator.state.isReconciling).toBe(true);
      });

      expect(coordinator.state.isReconciling).toBe(true);
    });

    it("resets isReconciling even if function throws", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);

      expect(() => {
        coordinator.withReconcilingLock(() => {
          throw new Error("test error");
        });
      }).toThrow("test error");

      expect(coordinator.state.isReconciling).toBe(false);
    });
  });

  describe("Subscription Management", () => {
    it("registerSubscription stores unsubscribe function", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yMap = new Y.Map();
      const unsub = vi.fn();

      coordinator.registerSubscription(yMap, unsub);

      expect(coordinator.state.yTypeToUnsubscribe.get(yMap)).toBe(unsub);
    });

    it("registerSubscription calls existing unsubscribe if replacing", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yMap = new Y.Map();
      const oldUnsub = vi.fn();
      const newUnsub = vi.fn();

      coordinator.registerSubscription(yMap, oldUnsub);
      coordinator.registerSubscription(yMap, newUnsub);

      expect(oldUnsub).toHaveBeenCalledOnce();
      expect(coordinator.state.yTypeToUnsubscribe.get(yMap)).toBe(newUnsub);
    });

    it("disposeAll calls all registered unsubscribers", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yMap1 = new Y.Map();
      const yMap2 = new Y.Map();
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();

      coordinator.registerSubscription(yMap1, unsub1);
      coordinator.registerSubscription(yMap2, unsub2);

      coordinator.disposeAll();

      expect(unsub1).toHaveBeenCalledOnce();
      expect(unsub2).toHaveBeenCalledOnce();
    });

    it("disposeAll clears all unsubscribers after calling them", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yMap = new Y.Map();
      const unsub = vi.fn();

      coordinator.registerSubscription(yMap, unsub);
      coordinator.disposeAll();

      // Calling disposeAll again shouldn't call unsub again
      coordinator.disposeAll();
      expect(unsub).toHaveBeenCalledOnce();
    });

    it("disposeAll handles errors in unsubscribe functions gracefully", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yMap1 = new Y.Map();
      const yMap2 = new Y.Map();
      const throwingUnsub = vi.fn(() => {
        throw new Error("unsub error");
      });
      const normalUnsub = vi.fn();

      coordinator.registerSubscription(yMap1, throwingUnsub);
      coordinator.registerSubscription(yMap2, normalUnsub);

      // Should not throw
      expect(() => coordinator.disposeAll()).not.toThrow();

      // Both should have been called
      expect(throwingUnsub).toHaveBeenCalledOnce();
      expect(normalUnsub).toHaveBeenCalledOnce();
    });

    it("disposeAll is idempotent", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yMap = new Y.Map();
      const unsub = vi.fn();

      coordinator.registerSubscription(yMap, unsub);

      coordinator.disposeAll();
      coordinator.disposeAll();
      coordinator.disposeAll();

      expect(unsub).toHaveBeenCalledOnce();
    });
  });

  describe("Arrays with Delta During Sync", () => {
    it("initially no arrays are marked with delta", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yArray = new Y.Array();

      expect(coordinator.shouldSkipArrayStructuralReconcile(yArray)).toBe(
        false,
      );
    });

    it("setArraysWithDeltaDuringSync marks arrays", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yArray1 = new Y.Array();
      const yArray2 = new Y.Array();

      coordinator.setArraysWithDeltaDuringSync([yArray1, yArray2]);

      expect(coordinator.shouldSkipArrayStructuralReconcile(yArray1)).toBe(
        true,
      );
      expect(coordinator.shouldSkipArrayStructuralReconcile(yArray2)).toBe(
        true,
      );
    });

    it("clearArraysWithDeltaDuringSync clears all marks", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yArray = new Y.Array();

      coordinator.setArraysWithDeltaDuringSync([yArray]);
      expect(coordinator.shouldSkipArrayStructuralReconcile(yArray)).toBe(true);

      coordinator.clearArraysWithDeltaDuringSync();
      expect(coordinator.shouldSkipArrayStructuralReconcile(yArray)).toBe(
        false,
      );
    });

    it("only marked arrays return true for shouldSkip", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yArray1 = new Y.Array();
      const yArray2 = new Y.Array();

      coordinator.setArraysWithDeltaDuringSync([yArray1]);

      expect(coordinator.shouldSkipArrayStructuralReconcile(yArray1)).toBe(
        true,
      );
      expect(coordinator.shouldSkipArrayStructuralReconcile(yArray2)).toBe(
        false,
      );
    });

    it("can handle empty array set", () => {
      const doc = new Y.Doc();
      const coordinator = new ValtioYjsCoordinator(doc);
      const yArray = new Y.Array();

      coordinator.setArraysWithDeltaDuringSync([]);

      expect(coordinator.shouldSkipArrayStructuralReconcile(yArray)).toBe(
        false,
      );
    });
  });

  describe("Write Scheduler Integration", () => {
    let coordinator: ValtioYjsCoordinator;
    let doc: Y.Doc;

    beforeEach(() => {
      doc = new Y.Doc();
      coordinator = new ValtioYjsCoordinator(doc);
    });

    afterEach(() => {
      coordinator.disposeAll();
    });

    it("enqueueMapSet queues a map set operation", () => {
      const yMap = doc.getMap("test");

      // Should not throw
      expect(() => {
        coordinator.enqueueMapSet(yMap, "key", "value");
      }).not.toThrow();
    });

    it("enqueueMapDelete queues a map delete operation", () => {
      const yMap = doc.getMap("test");
      yMap.set("key", "value");

      expect(() => {
        coordinator.enqueueMapDelete(yMap, "key");
      }).not.toThrow();
    });

    it("enqueueArraySet queues an array set operation", () => {
      const yArray = doc.getArray("test");
      yArray.push(["initial"]);

      expect(() => {
        coordinator.enqueueArraySet(yArray, 0, "newValue");
      }).not.toThrow();
    });

    it("enqueueArrayReplace queues an array replace operation", () => {
      const yArray = doc.getArray("test");
      yArray.push(["initial"]);

      expect(() => {
        coordinator.enqueueArrayReplace(yArray, 0, "replacement");
      }).not.toThrow();
    });

    it("enqueueArrayDelete queues an array delete operation", () => {
      const yArray = doc.getArray("test");
      yArray.push(["item"]);

      expect(() => {
        coordinator.enqueueArrayDelete(yArray, 0);
      }).not.toThrow();
    });
  });
});
