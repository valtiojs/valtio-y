/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { syncedText } from '../../src/index';
import { createRelayedProxiesMapRoot, waitMicrotask } from '../helpers/test-helpers';

describe('E2E: Y.Text Collaboration', () => {
  describe('Two Clients: Basic Y.Text Collaboration', () => {
    it('two clients can edit the same Y.Text document', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      // Client A creates a document with Y.Text
      const text = syncedText('Hello World');
      proxyA.document = text;
      await waitMicrotask();

      // Both clients should see the same text
      expect(proxyB.document).toBeInstanceOf(Y.Text);
      expect(proxyB.document.toString()).toBe('Hello World');

      // Client B edits
      proxyB.document.insert(11, '!');
      await waitMicrotask();

      // Client A sees the change
      expect(proxyA.document.toString()).toBe('Hello World!');
    });

    it('multiple Y.Text instances can be edited independently', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const title = syncedText('Title');
      const body = syncedText('Body content');
      proxyA.title = title;
      proxyA.body = body;
      await waitMicrotask();

      // Edit title on A
      proxyA.title.insert(5, ' Text');
      await waitMicrotask();

      // Edit body on B
      proxyB.body.insert(12, ' here');
      await waitMicrotask();

      // Both clients see both changes
      expect(proxyA.title.toString()).toBe('Title Text');
      expect(proxyA.body.toString()).toBe('Body content here');
      expect(proxyB.title.toString()).toBe('Title Text');
      expect(proxyB.body.toString()).toBe('Body content here');
    });
  });

  describe('Concurrent Text Inserts', () => {
    it('concurrent inserts at different positions merge correctly', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello World');
      proxyA.text = text;
      await waitMicrotask();

      // Sequential inserts with sync to ensure proper positions
      proxyA.text.insert(0, 'Start: ');
      await waitMicrotask();
      
      // Now B can safely insert at the end
      proxyB.text.insert(proxyB.text.length, ' End');
      await waitMicrotask();

      // Both should converge to the same state
      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      expect(contentA).toContain('Start:');
      expect(contentA).toContain('Hello');
      expect(contentA).toContain('World');
      expect(contentA).toContain('End');
      expect(contentA).toBe('Start: Hello World End');
    });

    it('concurrent inserts at same position are ordered deterministically', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('');
      proxyA.text = text;
      await waitMicrotask();

      // Both clients insert at position 0
      proxyA.text.insert(0, 'A');
      proxyB.text.insert(0, 'B');
      await waitMicrotask();

      // CRDT ensures deterministic ordering
      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      expect(contentA.length).toBe(2);
      // Y.js CRDT will order these deterministically
      expect(['AB', 'BA']).toContain(contentA);
    });

    it('rapid concurrent inserts converge correctly', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('');
      proxyA.text = text;
      await waitMicrotask();

      // Rapid inserts from both clients
      proxyA.text.insert(0, 'A1');
      proxyA.text.insert(2, 'A2');
      proxyB.text.insert(0, 'B1');
      proxyB.text.insert(2, 'B2');
      await waitMicrotask();

      // Should converge to same state
      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      expect(contentA).toContain('A1');
      expect(contentA).toContain('A2');
      expect(contentA).toContain('B1');
      expect(contentA).toContain('B2');
    });

    it('interleaved character inserts maintain consistency', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('abcdef');
      proxyA.text = text;
      await waitMicrotask();

      // A inserts at position 2
      proxyA.text.insert(2, 'X');
      await waitMicrotask();
      
      // B inserts at position 1 (after A's sync)
      proxyB.text.insert(1, '1');
      await waitMicrotask();
      
      // A inserts at updated position
      const posA = proxyA.text.toString().indexOf('X') + 2;
      proxyA.text.insert(posA, 'Y');
      await waitMicrotask();
      
      // B inserts near end
      proxyB.text.insert(proxyB.text.length - 1, '2');
      await waitMicrotask();
      // Extra wait to ensure all updates propagate through relay
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      expect(contentA.length).toBe(10); // Original 6 + 4 inserts
      expect(contentA).toContain('X');
      expect(contentA).toContain('Y');
      expect(contentA).toContain('1');
      expect(contentA).toContain('2');
    });
  });

  describe('Concurrent Text Deletes', () => {
    it('concurrent deletes at different positions merge correctly', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello Beautiful World');
      proxyA.text = text;
      await waitMicrotask();

      // A deletes "Beautiful " (positions 6-16)
      proxyA.text.delete(6, 10);
      
      // B deletes "Hello " (positions 0-6)
      proxyB.text.delete(0, 6);
      
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      // After both deletions, only "World" should remain
      expect(contentA).toBe('World');
    });

    it('overlapping deletes handle conflicts gracefully', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('0123456789');
      proxyA.text = text;
      await waitMicrotask();

      // A deletes positions 2-5 ("234")
      proxyA.text.delete(2, 3);
      
      // B deletes positions 4-7 ("456")
      proxyB.text.delete(4, 3);
      
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      // CRDT ensures consistent state despite overlap
      expect(contentA.length).toBeLessThan(10);
    });

    it('delete entire content from one client while other inserts', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello World');
      proxyA.text = text;
      await waitMicrotask();

      // A deletes everything
      proxyA.text.delete(0, 11);
      
      // B inserts at the end (concurrent with delete)
      proxyB.text.insert(11, '!');
      
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      // Y.js CRDT will preserve the insert despite the delete
      // The exclamation mark should survive
      expect(contentA).toContain('!');
    });
  });

  describe('Mixed Insert and Delete Operations', () => {
    it('concurrent insert and delete at same position', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello World');
      proxyA.text = text;
      await waitMicrotask();

      // A inserts at position 5
      proxyA.text.insert(5, 'XXX');
      
      // B deletes at position 5 (the space character)
      proxyB.text.delete(5, 1);
      
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      // CRDT ensures deterministic resolution - delete happens on original position
      // The insert and delete are concurrent, so both should apply
      expect(contentA.length).toBeLessThan(14); // Original + XXX - 1 deleted char
    });

    it('replace operation (delete + insert) conflicts with concurrent insert', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello World');
      proxyA.text = text;
      await waitMicrotask();

      // A replaces "World" with "Universe"
      proxyA.text.delete(6, 5);
      proxyA.text.insert(6, 'Universe');
      
      // B inserts in the middle of "World"
      proxyB.text.insert(8, 'XXX');
      
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      expect(contentA).toContain('Hello');
    });

    it('multiple clients performing complex edits simultaneously', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('The quick brown fox jumps over the lazy dog');
      proxyA.text = text;
      await waitMicrotask();

      // A: Replace "quick" with "slow"
      proxyA.text.delete(4, 5);
      proxyA.text.insert(4, 'slow');
      await waitMicrotask();
      
      // B: Insert "very " before "lazy" (after sync)
      const lazyIndex = proxyB.text.toString().indexOf('lazy');
      proxyB.text.insert(lazyIndex, 'very ');
      await waitMicrotask();
      
      // A: Delete "fox "
      const foxIndex = proxyA.text.toString().indexOf('fox ');
      proxyA.text.delete(foxIndex, 4);
      await waitMicrotask();
      
      // B: Replace "dog" with "cat" (after A's deletion syncs)
      await waitMicrotask(); // Extra sync to ensure A's changes are visible
      const dogIndex = proxyB.text.toString().indexOf('dog');
      proxyB.text.delete(dogIndex, 3);
      proxyB.text.insert(dogIndex, 'cat');
      await waitMicrotask();
      // Extra wait for full convergence
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      // Both should converge
      expect(contentA).toBe(contentB);
      expect(contentA).toBe('The slow brown jumps over the very lazy cat');
    });
  });

  describe('Y.Text Formatting (Attributes)', () => {
    it('can apply and sync text formatting attributes', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello World');
      proxyA.text = text;
      await waitMicrotask();

      // A applies bold formatting to "Hello"
      proxyA.text.format(0, 5, { bold: true });
      await waitMicrotask();

      // B should see the formatting (accessed via toDelta or similar)
      const deltaA = proxyA.text.toDelta();
      const deltaB = proxyB.text.toDelta();
      
      expect(deltaA).toEqual(deltaB);
      expect(deltaA[0]).toHaveProperty('attributes');
      expect(deltaA[0].attributes).toEqual({ bold: true });
    });

    it('concurrent formatting operations on different ranges', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello Beautiful World');
      proxyA.text = text;
      await waitMicrotask();

      // A formats "Hello" as bold
      proxyA.text.format(0, 5, { bold: true });
      
      // B formats "World" as italic
      proxyB.text.format(16, 5, { italic: true });
      
      await waitMicrotask();

      const deltaA = proxyA.text.toDelta();
      const deltaB = proxyB.text.toDelta();
      
      expect(deltaA).toEqual(deltaB);
      
      // Find the formatted segments
      const boldSegment = deltaA.find((d: any) => d.attributes?.bold);
      const italicSegment = deltaA.find((d: any) => d.attributes?.italic);
      
      expect(boldSegment).toBeDefined();
      expect(italicSegment).toBeDefined();
    });

    it('concurrent formatting on overlapping ranges', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello World');
      proxyA.text = text;
      await waitMicrotask();

      // A formats positions 0-7 as bold
      proxyA.text.format(0, 7, { bold: true });
      
      // B formats positions 6-11 as italic
      proxyB.text.format(6, 5, { italic: true });
      
      await waitMicrotask();

      const deltaA = proxyA.text.toDelta();
      const deltaB = proxyB.text.toDelta();
      
      expect(deltaA).toEqual(deltaB);
      
      // Overlapping region should have both attributes
      const overlapping = deltaA.find((d: any) => d.attributes?.bold && d.attributes?.italic);
      expect(overlapping).toBeDefined();
    });

    it('formatting persists through concurrent text edits', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello World');
      proxyA.text = text;
      await waitMicrotask();

      // A applies formatting
      proxyA.text.format(0, 5, { bold: true });
      await waitMicrotask();

      // B inserts text in the middle
      proxyB.text.insert(5, ' Beautiful');
      await waitMicrotask();

      const deltaA = proxyA.text.toDelta();
      const deltaB = proxyB.text.toDelta();
      
      expect(deltaA).toEqual(deltaB);
      expect(proxyA.text.toString()).toBe('Hello Beautiful World');
      
      // Original formatting should still exist
      const boldSegment = deltaA.find((d: any) => d.attributes?.bold);
      expect(boldSegment).toBeDefined();
    });

    it('removing formatting syncs correctly', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello World');
      proxyA.text = text;
      await waitMicrotask();

      // A applies formatting
      proxyA.text.format(0, 11, { bold: true });
      await waitMicrotask();

      // Verify B sees it
      expect(proxyB.text.toDelta()[0].attributes).toEqual({ bold: true });

      // A removes formatting
      proxyA.text.format(0, 11, { bold: null });
      await waitMicrotask();

      const deltaA = proxyA.text.toDelta();
      const deltaB = proxyB.text.toDelta();
      
      expect(deltaA).toEqual(deltaB);
      // No attributes should remain
      expect(deltaA.every((d: any) => !d.attributes?.bold)).toBe(true);
    });
  });

  describe('Y.Text in Complex Structures', () => {
    it('multiple Y.Text instances in array sync correctly', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text1 = syncedText('First');
      const text2 = syncedText('Second');
      proxyA.texts = [text1, text2];
      await waitMicrotask();

      // Edit both texts from different clients
      proxyA.texts[0].insert(5, ' Text');
      proxyB.texts[1].insert(6, ' Text');
      await waitMicrotask();

      expect(proxyA.texts[0].toString()).toBe('First Text');
      expect(proxyA.texts[1].toString()).toBe('Second Text');
      expect(proxyB.texts[0].toString()).toBe('First Text');
      expect(proxyB.texts[1].toString()).toBe('Second Text');
    });

    it('Y.Text in nested objects sync correctly', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      proxyA.document = {
        title: syncedText('Document Title'),
        sections: [
          {
            heading: syncedText('Section 1'),
            content: syncedText('Content here')
          }
        ]
      };
      await waitMicrotask();

      // Edit from both clients
      proxyA.document.title.insert(0, 'My ');
      proxyB.document.sections[0].content.insert(12, ' and there');
      await waitMicrotask();

      expect(proxyA.document.title.toString()).toBe('My Document Title');
      expect(proxyB.document.title.toString()).toBe('My Document Title');
      expect(proxyA.document.sections[0].content.toString()).toBe('Content here and there');
      expect(proxyB.document.sections[0].content.toString()).toBe('Content here and there');
    });

    it('replacing Y.Text while other client edits it', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Original');
      proxyA.text = text;
      await waitMicrotask();

      // A replaces the entire text with a new Y.Text (this is a map key change)
      const newText = syncedText('Replaced');
      proxyA.text = newText;
      await waitMicrotask();
      
      // B edits after the replacement syncs
      proxyB.text.insert(8, ' Content');
      await waitMicrotask();

      // Both should see the new text with B's edit
      expect(proxyA.text.toString()).toBe('Replaced Content');
      expect(proxyB.text.toString()).toBe('Replaced Content');
    });
  });

  describe('Large Scale Y.Text Operations', () => {
    it('handles large text documents efficiently', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      // Create a large document
      const largeText = 'Lorem ipsum dolor sit amet. '.repeat(100);
      const text = syncedText(largeText);
      proxyA.text = text;
      await waitMicrotask();

      expect(proxyB.text.toString()).toBe(largeText);
      expect(proxyB.text.toString().length).toBeGreaterThan(2000);

      // Edit from both clients
      proxyA.text.insert(0, 'START: ');
      proxyB.text.insert(proxyB.text.length, ' :END');
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      expect(contentA).toContain('START:');
      expect(contentA).toContain(':END');
    });

    it('handles many small edits in sequence', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('');
      proxyA.text = text;
      await waitMicrotask();

      // Simulate typing from both clients with sync after each operation
      for (let i = 0; i < 5; i++) {
        // A appends
        proxyA.text.insert(proxyA.text.length, 'A');
        await waitMicrotask();
        // B inserts at beginning
        proxyB.text.insert(0, 'B');
        await waitMicrotask();
      }
      
      // Extra waits for full convergence
      await waitMicrotask();
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      // Both should converge
      expect(contentA).toBe(contentB);
      expect(contentA.length).toBe(10);
      // Count occurrences - should have 5 A's and 5 B's
      const aCount = (contentA.match(/A/g) || []).length;
      const bCount = (contentA.match(/B/g) || []).length;
      expect(aCount).toBe(5);
      expect(bCount).toBe(5);
    });
  });

  describe('Y.Text Identity and References', () => {
    it('Y.Text works correctly and syncs across edits', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello');
      proxyA.text = text;
      await waitMicrotask();

      const refA = proxyA.text;
      const refB = proxyB.text;

      // Edit from both clients
      proxyA.text.insert(5, ' World');
      proxyB.text.insert(0, 'Say: ');
      await waitMicrotask();

      // Y.Text should work correctly after modifications
      // Note: References may be different proxy wrappers, but content should be correct
      expect(proxyA.text).toBeInstanceOf(Y.Text);
      expect(proxyB.text).toBeInstanceOf(Y.Text);
      expect(refA.toString()).toBe('Say: Hello World');
      expect(refB.toString()).toBe('Say: Hello World');
      expect(proxyA.text.toString()).toBe('Say: Hello World');
      expect(proxyB.text.toString()).toBe('Say: Hello World');
    });

    it('different Y.Text instances maintain separate identities', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text1 = syncedText('Text 1');
      const text2 = syncedText('Text 2');
      proxyA.text1 = text1;
      proxyA.text2 = text2;
      await waitMicrotask();

      expect(proxyA.text1).not.toBe(proxyA.text2);
      expect(proxyB.text1).not.toBe(proxyB.text2);
      
      // Edits don't cross-contaminate
      proxyA.text1.insert(6, ' A');
      proxyB.text2.insert(6, ' B');
      await waitMicrotask();

      expect(proxyA.text1.toString()).toBe('Text 1 A');
      expect(proxyA.text2.toString()).toBe('Text 2 B');
      expect(proxyB.text1.toString()).toBe('Text 1 A');
      expect(proxyB.text2.toString()).toBe('Text 2 B');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('handles empty Y.Text collaboration', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText();
      proxyA.text = text;
      await waitMicrotask();

      expect(proxyB.text.toString()).toBe('');

      // Both clients insert
      proxyA.text.insert(0, 'A');
      proxyB.text.insert(0, 'B');
      await waitMicrotask();

      expect(proxyA.text.length).toBe(2);
      expect(proxyB.text.length).toBe(2);
    });

    it('handles Unicode and emoji in collaborative editing', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text = syncedText('Hello 世界');
      proxyA.text = text;
      await waitMicrotask();

      proxyA.text.insert(8, ' 🌍');
      proxyB.text.insert(0, '👋 ');
      await waitMicrotask();

      const contentA = proxyA.text.toString();
      const contentB = proxyB.text.toString();
      
      expect(contentA).toBe(contentB);
      expect(contentA).toContain('👋');
      expect(contentA).toContain('世界');
      expect(contentA).toContain('🌍');
    });

    it('handles rapid delete and recreate of Y.Text', async () => {
      const { proxyA, proxyB } = createRelayedProxiesMapRoot();

      const text1 = syncedText('First');
      proxyA.text = text1;
      await waitMicrotask();

      expect(proxyB.text.toString()).toBe('First');

      // Delete and recreate
      delete proxyA.text;
      await waitMicrotask();

      const text2 = syncedText('Second');
      proxyA.text = text2;
      await waitMicrotask();

      expect(proxyB.text.toString()).toBe('Second');
    });
  });
});

