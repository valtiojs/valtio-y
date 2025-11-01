/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  isYMap,
  isYArray,
  isYSharedContainer,
  isYAbstractType,
} from "./guards";

describe("Type Guards", () => {
  describe("isYMap()", () => {
    it("returns true for Y.Map instances", () => {
      const yMap = new Y.Map();
      expect(isYMap(yMap)).toBe(true);
    });

    it("returns false for Y.Array instances", () => {
      const yArr = new Y.Array();
      expect(isYMap(yArr)).toBe(false);
    });


    it("returns false for plain objects", () => {
      expect(isYMap({})).toBe(false);
      expect(isYMap({ key: "value" })).toBe(false);
    });

    it("returns false for null and undefined", () => {
      expect(isYMap(null)).toBe(false);
      expect(isYMap(undefined)).toBe(false);
    });

    it("returns false for primitives", () => {
      expect(isYMap(42)).toBe(false);
      expect(isYMap("string")).toBe(false);
      expect(isYMap(true)).toBe(false);
    });

    it("returns false for arrays", () => {
      expect(isYMap([])).toBe(false);
      expect(isYMap([1, 2, 3])).toBe(false);
    });
  });

  describe("isYArray()", () => {
    it("returns true for Y.Array instances", () => {
      const yArr = new Y.Array();
      expect(isYArray(yArr)).toBe(true);
    });

    it("returns false for Y.Map instances", () => {
      const yMap = new Y.Map();
      expect(isYArray(yMap)).toBe(false);
    });


    it("returns false for plain arrays", () => {
      expect(isYArray([])).toBe(false);
      expect(isYArray([1, 2, 3])).toBe(false);
    });

    it("returns false for null and undefined", () => {
      expect(isYArray(null)).toBe(false);
      expect(isYArray(undefined)).toBe(false);
    });

    it("returns false for objects", () => {
      expect(isYArray({})).toBe(false);
      expect(isYArray({ length: 0 })).toBe(false);
    });
  });

  describe("isYSharedContainer()", () => {
    it("returns true for Y.Map instances", () => {
      const yMap = new Y.Map();
      expect(isYSharedContainer(yMap)).toBe(true);
    });

    it("returns true for Y.Array instances", () => {
      const yArr = new Y.Array();
      expect(isYSharedContainer(yArr)).toBe(true);
    });


    it("returns false for plain objects and arrays", () => {
      expect(isYSharedContainer({})).toBe(false);
      expect(isYSharedContainer([])).toBe(false);
    });

    it("returns false for null and undefined", () => {
      expect(isYSharedContainer(null)).toBe(false);
      expect(isYSharedContainer(undefined)).toBe(false);
    });
  });

  describe("isYAbstractType()", () => {
    it("returns true for Y.Map instances", () => {
      const yMap = new Y.Map();
      expect(isYAbstractType(yMap)).toBe(true);
    });

    it("returns true for Y.Array instances", () => {
      const yArr = new Y.Array();
      expect(isYAbstractType(yArr)).toBe(true);
    });


    it("returns false for plain objects and arrays", () => {
      expect(isYAbstractType({})).toBe(false);
      expect(isYAbstractType([])).toBe(false);
    });

    it("returns false for primitives", () => {
      expect(isYAbstractType(42)).toBe(false);
      expect(isYAbstractType("string")).toBe(false);
      expect(isYAbstractType(true)).toBe(false);
      expect(isYAbstractType(null)).toBe(false);
      expect(isYAbstractType(undefined)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles Y types attached to documents", () => {
      const doc = new Y.Doc();
      const yMap = doc.getMap("test");
      const yArr = doc.getArray("arr");

      expect(isYMap(yMap)).toBe(true);
      expect(isYArray(yArr)).toBe(true);
      expect(isYSharedContainer(yMap)).toBe(true);
      expect(isYSharedContainer(yArr)).toBe(true);
    });

    it("handles nested Y types", () => {
      const doc = new Y.Doc();
      const yRoot = doc.getMap("root");
      const yNested = new Y.Map();
      yRoot.set("nested", yNested);

      const retrieved = yRoot.get("nested");
      expect(isYMap(retrieved)).toBe(true);
      expect(isYSharedContainer(retrieved)).toBe(true);
    });

    it("correctly identifies different types in mixed array", () => {
      const doc = new Y.Doc();
      const yArr = doc.getArray("arr");
      const yMap = new Y.Map();
      const yNestedArr = new Y.Array();

      yArr.insert(0, [yMap, yNestedArr, "string", 42]);

      expect(isYMap(yArr.get(0))).toBe(true);
      expect(isYArray(yArr.get(1))).toBe(true);
      expect(isYMap(yArr.get(2))).toBe(false);
      expect(isYMap(yArr.get(3))).toBe(false);
    });
  });
});
