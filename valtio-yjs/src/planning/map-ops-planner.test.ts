import { describe, it, expect } from 'vitest';
import { planMapOps } from './map-ops-planner';

describe('Map Operations Planner', () => {
  describe('planMapOps', () => {
    it('should handle empty operations array', () => {
      const result = planMapOps([]);
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(0);
    });

    it('should categorize single set operation', () => {
      const ops = [['set', ['foo'], 'bar', undefined]];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get('foo')).toBe('bar');
      expect(result.deletes.size).toBe(0);
    });

    it('should categorize single delete operation', () => {
      const ops = [['delete', ['foo']]];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(1);
      expect(result.deletes.has('foo')).toBe(true);
    });

    it('should handle multiple set operations', () => {
      const ops = [
        ['set', ['foo'], 'bar', undefined],
        ['set', ['baz'], 42, undefined]
      ];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(2);
      expect(result.sets.get('foo')).toBe('bar');
      expect(result.sets.get('baz')).toBe(42);
      expect(result.deletes.size).toBe(0);
    });

    it('should handle multiple delete operations', () => {
      const ops = [
        ['delete', ['foo']],
        ['delete', ['bar']]
      ];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(2);
      expect(result.deletes.has('foo')).toBe(true);
      expect(result.deletes.has('bar')).toBe(true);
    });

    it('should handle mix of set and delete operations', () => {
      const ops = [
        ['set', ['foo'], 'bar', undefined],
        ['delete', ['baz']],
        ['set', ['qux'], 123, undefined]
      ];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(2);
      expect(result.sets.get('foo')).toBe('bar');
      expect(result.sets.get('qux')).toBe(123);
      expect(result.deletes.size).toBe(1);
      expect(result.deletes.has('baz')).toBe(true);
    });

    it('should handle set overriding delete for same key', () => {
      const ops = [
        ['delete', ['foo']],
        ['set', ['foo'], 'new-value', undefined]
      ];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get('foo')).toBe('new-value');
      expect(result.deletes.size).toBe(0);
    });

    it('should handle delete overriding set for same key', () => {
      const ops = [
        ['set', ['foo'], 'value', undefined],
        ['delete', ['foo']]
      ];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(1);
      expect(result.deletes.has('foo')).toBe(true);
    });

    it('should ignore non-map operations', () => {
      const ops = [
        ['set', ['foo'], 'bar', undefined], // valid map set
        ['set', [0], 'array-value', undefined], // array set (should be ignored)
        ['delete', ['baz']], // valid map delete
        ['delete', [1], 'old-value'], // array delete (should be ignored)
        ['some-other-op', ['key']], // unknown operation
        'invalid-op' // completely invalid
      ];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get('foo')).toBe('bar');
      expect(result.deletes.size).toBe(1);
      expect(result.deletes.has('baz')).toBe(true);
    });

    it('should ignore nested operations (path length > 1)', () => {
      const ops = [
        ['set', ['foo'], 'top-level', undefined], // valid: top-level
        ['set', ['foo', 'nested'], 'nested-value', undefined], // invalid: nested
        ['delete', ['bar']], // valid: top-level
        ['delete', ['bar', 'nested']] // invalid: nested
      ];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get('foo')).toBe('top-level');
      expect(result.deletes.size).toBe(1);
      expect(result.deletes.has('bar')).toBe(true);
    });

    it('should handle complex values in set operations', () => {
      const complexValue = { nested: { deep: 'value' }, array: [1, 2, 3] };
      const ops = [
        ['set', ['complex'], complexValue, undefined]
      ];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get('complex')).toEqual(complexValue);
      expect(result.deletes.size).toBe(0);
    });

    it('should handle null and undefined values', () => {
      const ops = [
        ['set', ['null-key'], null, undefined],
        ['set', ['undefined-key'], undefined, undefined]
      ];
      const result = planMapOps(ops);
      
      expect(result.sets.size).toBe(2);
      expect(result.sets.get('null-key')).toBeNull();
      expect(result.sets.get('undefined-key')).toBeUndefined();
      expect(result.deletes.size).toBe(0);
    });
  });
});

