import { describe, it, expect } from 'vitest';
import { planArrayOps } from './array-ops-planner';

describe('Array Operations Planner', () => {
  describe('planArrayOps', () => {
    it('should handle empty operations array', () => {
      const result = planArrayOps([], 3, undefined);
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(0);
    });

    it('should categorize single set operation as replace when index < length', () => {
      // Set at index 0 when array length is 3 should be a replace
      const ops = [['set', [0], 'new-value', undefined]];
      const result = planArrayOps(ops, 3, undefined);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(1);
      expect(result.replaces.get(0)).toBe('new-value');
    });

    it('should categorize single delete operation as pure delete', () => {
      const ops = [['delete', [1], 'old-value']];
      const result = planArrayOps(ops, 3, undefined);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(1);
      expect(result.deletes.has(1)).toBe(true);
      expect(result.replaces.size).toBe(0);
    });

    it('should identify delete + set at same index as replace operation', () => {
      const ops = [
        ['delete', [1], 'old-value'],
        ['set', [1], 'new-value', undefined]
      ];
      const result = planArrayOps(ops, 3, undefined);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(1);
      expect(result.replaces.get(1)).toBe('new-value');
    });

    it('should identify set + delete at same index as replace operation (order reversed)', () => {
      const ops = [
        ['set', [2], 'new-value', undefined],
        ['delete', [2], 'old-value']
      ];
      const result = planArrayOps(ops, 5, undefined);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(1);
      expect(result.replaces.get(2)).toBe('new-value');
    });

    it('should handle multiple sets based on index vs length', () => {
      // With yArrayLength = 3:
      // index 0, 2 < 3 -> replaces
      // index 4 >= 3 -> set (insert)
      const ops = [
        ['set', [0], 'value-0', undefined],
        ['set', [2], 'value-2', undefined],
        ['set', [4], 'value-4', undefined]
      ];
      const result = planArrayOps(ops, 3, undefined);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get(4)).toBe('value-4');
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(2);
      expect(result.replaces.get(0)).toBe('value-0');
      expect(result.replaces.get(2)).toBe('value-2');
    });

    it('should handle multiple pure deletes', () => {
      const ops = [
        ['delete', [0], 'old-0'],
        ['delete', [2], 'old-2'],
        ['delete', [4], 'old-4']
      ];
      const result = planArrayOps(ops, 5, undefined);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(3);
      expect(result.deletes.has(0)).toBe(true);
      expect(result.deletes.has(2)).toBe(true);
      expect(result.deletes.has(4)).toBe(true);
      expect(result.replaces.size).toBe(0);
    });

    it('should handle multiple replaces', () => {
      const ops = [
        ['delete', [1], 'old-1'],
        ['set', [1], 'new-1', undefined],
        ['delete', [3], 'old-3'],
        ['set', [3], 'new-3', undefined]
      ];
      const result = planArrayOps(ops, 5, undefined);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(2);
      expect(result.replaces.get(1)).toBe('new-1');
      expect(result.replaces.get(3)).toBe('new-3');
    });

    it('should handle mix of sets, deletes, and replaces', () => {
      const ops = [
        ['set', [0], 'replace-0', undefined],    // index 0 < 5 = replace
        ['delete', [1], 'old-1'],               // part of replace
        ['set', [1], 'replace-value', undefined], // part of replace
        ['delete', [2], 'old-2'],               // pure delete
        ['set', [6], 'insert-6', undefined]     // index 6 >= 5 = insert/set
      ];
      const result = planArrayOps(ops, 5, undefined);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get(6)).toBe('insert-6');
      
      expect(result.deletes.size).toBe(1);
      expect(result.deletes.has(2)).toBe(true);
      
      expect(result.replaces.size).toBe(2);
      expect(result.replaces.get(0)).toBe('replace-0');
      expect(result.replaces.get(1)).toBe('replace-value');
    });

    it('should ignore non-array operations', () => {
      const ops = [
        ['set', [3], 'array-value', undefined],     // index 3 >= 3 = set/insert
        ['set', ['key'], 'map-value', undefined],   // map set (should be ignored)
        ['delete', [1], 'old-value'],               // valid array delete
        ['delete', ['key']],                        // map delete (should be ignored)
        ['some-other-op', [2]],                     // unknown operation
        'invalid-op'                                // completely invalid
      ];
      const result = planArrayOps(ops, 3, undefined);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get(3)).toBe('array-value');
      expect(result.deletes.size).toBe(1);
      expect(result.deletes.has(1)).toBe(true);
      expect(result.replaces.size).toBe(0);
    });

    it('should handle string indices by normalizing them to numbers', () => {
      const ops = [
        ['set', ['5'], 'value-at-5', undefined],   // index 5 >= 5 = set/insert
        ['delete', ['2'], 'old-value'],
        ['set', ['2'], 'new-value', undefined]     // combined with delete = replace
      ];
      const result = planArrayOps(ops, 5, undefined);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get(5)).toBe('value-at-5');
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(1);
      expect(result.replaces.get(2)).toBe('new-value');
    });

    it('should handle complex values in operations', () => {
      const complexValue = { nested: { deep: 'value' }, array: [1, 2, 3] };
      const ops = [
        ['set', [3], complexValue, undefined]  // index 3 >= 3 = set/insert
      ];
      const result = planArrayOps(ops, 3, undefined);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get(3)).toEqual(complexValue);
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(0);
    });

    it('should handle null and undefined values', () => {
      const ops = [
        ['set', [0], null, undefined],          // index 0 < 5 = replace
        ['set', [1], undefined, undefined],     // index 1 < 5 = replace
        ['delete', [2], null],
        ['set', [2], 'replacement', undefined]  // combined with delete = replace
      ];
      const result = planArrayOps(ops, 5, undefined);
      
      expect(result.sets.size).toBe(0);
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(3);
      expect(result.replaces.get(0)).toBeNull();
      expect(result.replaces.get(1)).toBeUndefined();
      expect(result.replaces.get(2)).toBe('replacement');
    });

    it('should handle edge case with zero-length array', () => {
      const ops = [
        ['set', [0], 'first-item', undefined]
      ];
      const result = planArrayOps(ops, 0, undefined);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get(0)).toBe('first-item');
      expect(result.deletes.size).toBe(0);
      expect(result.replaces.size).toBe(0);
    });

    it('should handle large indices correctly', () => {
      const ops = [
        ['set', [1000], 'large-index-value', undefined],
        ['delete', [999], 'old-value']
      ];
      const result = planArrayOps(ops, 100, undefined);
      
      expect(result.sets.size).toBe(1);
      expect(result.sets.get(1000)).toBe('large-index-value');
      expect(result.deletes.size).toBe(1);
      expect(result.deletes.has(999)).toBe(true);
      expect(result.replaces.size).toBe(0);
    });
  });
});

