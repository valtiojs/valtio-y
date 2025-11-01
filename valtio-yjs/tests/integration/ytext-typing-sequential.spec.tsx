import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-react';
import * as Y from 'yjs';
import { createYjsProxy, syncedText } from '../../src';
import { useSnapshot } from 'valtio';
import React, { useRef } from 'react';
import { userEvent } from '@vitest/browser/context';

describe('Y.Text Sequential Typing - Definitive Test', () => {
  /**
   * This test definitively proves that typing "hello" character by character works.
   * 
   * Key points:
   * - Uses controlled textarea with proper React patterns
   * - Simulates real user typing using CDP (not mocked)
   * - Verifies each character appears correctly
   * - Tracks render counts to detect double-rendering issues
   * - Confirms Y.Text internal state matches DOM state
   */
  it('should handle typing "hello" character by character', async () => {
    const doc = new Y.Doc();
    
    type State = {
      text: Y.Text;
    };
    
    const { proxy, bootstrap } = createYjsProxy<State>(doc, {
      getRoot: (doc) => doc.getMap('state'),
    });
    
    bootstrap({
      text: syncedText(''),
    });
    
    const renderLog: string[] = [];
    const changeLog: string[] = [];
    
    function ControlledTextarea() {
      const snap = useSnapshot(proxy);
      const textContent = snap.text.toString();
      const renderCountRef = useRef(0);
      renderCountRef.current += 1;
      
      renderLog.push(`render #${renderCountRef.current}: "${textContent}"`);
      
      const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const oldValue = proxy.text.toString();
        
        changeLog.push(`onChange: "${oldValue}" → "${newValue}"`);
        
        // Simple append-only logic (for this test we only add characters)
        if (newValue.length > oldValue.length) {
          const inserted = newValue.substring(oldValue.length);
          proxy.text.insert(oldValue.length, inserted);
        } else if (newValue.length < oldValue.length) {
          // Handle deletion
          const deleteCount = oldValue.length - newValue.length;
          proxy.text.delete(newValue.length, deleteCount);
        }
      };
      
      return (
        <div>
          <textarea
            data-testid="controlled-textarea"
            value={textContent}
            onChange={handleChange}
            placeholder="Type here..."
          />
          <div data-testid="display">{textContent}</div>
          <div data-testid="render-count">{renderCountRef.current}</div>
          <div data-testid="ytext-value">{proxy.text.toString()}</div>
        </div>
      );
    }
    
    const screen = render(<ControlledTextarea />);
    const textarea = screen.getByTestId('controlled-textarea');
    
    console.log('\n=== INITIAL STATE ===');
    await expect.element(textarea).toHaveValue('');
    await expect.element(screen.getByTestId('display')).toHaveTextContent('');
    console.log('✓ Initial state correct');
    
    // Clear logs after initial render
    renderLog.length = 0;
    changeLog.length = 0;
    
    // TYPE: 'h'
    console.log('\n=== TYPING "h" ===');
    await textarea.click(); // Focus first
    await userEvent.keyboard('h');
    
    // Wait for React to process
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Render log:', renderLog);
    console.log('Change log:', changeLog);
    
    await expect.element(textarea).toHaveValue('h');
    await expect.element(screen.getByTestId('display')).toHaveTextContent('h');
    expect(proxy.text.toString()).toBe('h');
    console.log('✓ "h" successful');
    
    renderLog.length = 0;
    changeLog.length = 0;
    
    // TYPE: 'e'
    console.log('\n=== TYPING "e" ===');
    await userEvent.keyboard('e');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Render log:', renderLog);
    console.log('Change log:', changeLog);
    
    await expect.element(textarea).toHaveValue('he');
    await expect.element(screen.getByTestId('display')).toHaveTextContent('he');
    expect(proxy.text.toString()).toBe('he');
    console.log('✓ "he" successful');
    
    renderLog.length = 0;
    changeLog.length = 0;
    
    // TYPE: 'l'
    console.log('\n=== TYPING "l" ===');
    await userEvent.keyboard('l');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Render log:', renderLog);
    console.log('Change log:', changeLog);
    
    await expect.element(textarea).toHaveValue('hel');
    await expect.element(screen.getByTestId('display')).toHaveTextContent('hel');
    expect(proxy.text.toString()).toBe('hel');
    console.log('✓ "hel" successful');
    
    renderLog.length = 0;
    changeLog.length = 0;
    
    // TYPE: 'l'
    console.log('\n=== TYPING second "l" ===');
    await userEvent.keyboard('l');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Render log:', renderLog);
    console.log('Change log:', changeLog);
    
    await expect.element(textarea).toHaveValue('hell');
    await expect.element(screen.getByTestId('display')).toHaveTextContent('hell');
    expect(proxy.text.toString()).toBe('hell');
    console.log('✓ "hell" successful');
    
    renderLog.length = 0;
    changeLog.length = 0;
    
    // TYPE: 'o'
    console.log('\n=== TYPING "o" ===');
    await userEvent.keyboard('o');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Render log:', renderLog);
    console.log('Change log:', changeLog);
    
    await expect.element(textarea).toHaveValue('hello');
    await expect.element(screen.getByTestId('display')).toHaveTextContent('hello');
    expect(proxy.text.toString()).toBe('hello');
    console.log('✓ "hello" successful');
    
    console.log('\n=== SUCCESS: All 5 characters typed successfully ===');
  });
  
  /**
   * Alternative test using .fill() to progressively build the string.
   * This verifies that even with .fill() (which replaces the entire value),
   * the controlled component pattern works correctly.
   */
  it('should handle progressive .fill() calls', async () => {
    const doc = new Y.Doc();
    
    type State = {
      text: Y.Text;
    };
    
    const { proxy, bootstrap } = createYjsProxy<State>(doc, {
      getRoot: (doc) => doc.getMap('state'),
    });
    
    bootstrap({
      text: syncedText(''),
    });
    
    let renderCount = 0;
    let onChangeCount = 0;
    
    function TestComponent() {
      const snap = useSnapshot(proxy);
      const textContent = snap.text.toString();
      // eslint-disable-next-line react-hooks/react-compiler
      renderCount += 1;
      
      const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChangeCount += 1;
        const newValue = e.target.value;
        const oldValue = proxy.text.toString();
        
        // Handle both insertions and replacements
        if (newValue.length > oldValue.length) {
          const inserted = newValue.substring(oldValue.length);
          proxy.text.insert(oldValue.length, inserted);
        } else if (newValue.length < oldValue.length) {
          const deleteCount = oldValue.length - newValue.length;
          proxy.text.delete(newValue.length, deleteCount);
        } else if (newValue !== oldValue) {
          // Complete replacement
          proxy.text.delete(0, oldValue.length);
          proxy.text.insert(0, newValue);
        }
      };
      
      return (
        <div>
          <textarea
            data-testid="textarea"
            value={textContent}
            onChange={handleChange}
          />
          <div data-testid="display">{textContent}</div>
          <div data-testid="onChange-count">{onChangeCount}</div>
          <div data-testid="render-count">{renderCount}</div>
        </div>
      );
    }
    
    const screen = render(<TestComponent />);
    const textarea = screen.getByTestId('textarea');
    
    // Initial state
    const initialRenderCount = renderCount;
    console.log('\n=== Initial render count:', initialRenderCount);
    
    // Progressive fills
    console.log('\n=== Fill with "h" ===');
    await textarea.fill('h');
    await new Promise(resolve => setTimeout(resolve, 50));
    await expect.element(textarea).toHaveValue('h');
    expect(proxy.text.toString()).toBe('h');
    console.log('onChange count:', onChangeCount, 'render count:', renderCount);
    
    console.log('\n=== Fill with "he" ===');
    await textarea.fill('he');
    await new Promise(resolve => setTimeout(resolve, 50));
    await expect.element(textarea).toHaveValue('he');
    expect(proxy.text.toString()).toBe('he');
    console.log('onChange count:', onChangeCount, 'render count:', renderCount);
    
    console.log('\n=== Fill with "hel" ===');
    await textarea.fill('hel');
    await new Promise(resolve => setTimeout(resolve, 50));
    await expect.element(textarea).toHaveValue('hel');
    expect(proxy.text.toString()).toBe('hel');
    console.log('onChange count:', onChangeCount, 'render count:', renderCount);
    
    console.log('\n=== Fill with "hell" ===');
    await textarea.fill('hell');
    await new Promise(resolve => setTimeout(resolve, 50));
    await expect.element(textarea).toHaveValue('hell');
    expect(proxy.text.toString()).toBe('hell');
    console.log('onChange count:', onChangeCount, 'render count:', renderCount);
    
    console.log('\n=== Fill with "hello" ===');
    await textarea.fill('hello');
    await new Promise(resolve => setTimeout(resolve, 50));
    await expect.element(textarea).toHaveValue('hello');
    expect(proxy.text.toString()).toBe('hello');
    console.log('onChange count:', onChangeCount, 'render count:', renderCount);
    
    // Final assertions
    console.log('\n=== FINAL STATE ===');
    console.log('Total onChange calls:', onChangeCount);
    console.log('Total renders:', renderCount);
    console.log('Expected onChange: 5 (one per fill)');
    console.log('Expected renders: ~10-15 (initial + after each Y.Text change)');
    
    // onChange should be called once per .fill()
    expect(onChangeCount).toBe(5);
    
    // Final state should be correct
    await expect.element(textarea).toHaveValue('hello');
    await expect.element(screen.getByTestId('display')).toHaveTextContent('hello');
    expect(proxy.text.toString()).toBe('hello');
    
    console.log('\n=== SUCCESS: Progressive fills work correctly ===');
  });
  
  /**
   * Test to verify that observer is only registered ONCE per Y.Text change.
   * This directly tests the reconciler fix.
   */
  it('should only trigger ONE observer call per Y.Text modification', async () => {
    const doc = new Y.Doc();
    
    type State = {
      text: Y.Text;
    };
    
    const { proxy, bootstrap } = createYjsProxy<State>(doc, {
      getRoot: (doc) => doc.getMap('state'),
    });
    
    bootstrap({
      text: syncedText(''),
    });
    
    // Track observer calls
    let observerCallCount = 0;
    const observerLog: string[] = [];
    
    // Add our own observer to verify behavior
    proxy.text.observe((event) => {
      observerCallCount++;
      observerLog.push(`Observer called #${observerCallCount}, changes: ${event.changes.delta.length}`);
    });
    
    function TestComponent() {
      const snap = useSnapshot(proxy);
      const textContent = snap.text.toString();
      
      const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const oldValue = proxy.text.toString();
        
        if (newValue.length > oldValue.length) {
          const inserted = newValue.substring(oldValue.length);
          proxy.text.insert(oldValue.length, inserted);
        }
      };
      
      return (
        <textarea
          data-testid="textarea"
          value={textContent}
          onChange={handleChange}
        />
      );
    }
    
    const screen = render(<TestComponent />);
    const textarea = screen.getByTestId('textarea');
    
    console.log('\n=== Testing observer call frequency ===');
    
    // Reset counter
    observerCallCount = 0;
    observerLog.length = 0;
    
    // Type one character
    await textarea.fill('x');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Observer log after typing "x":', observerLog);
    console.log('Observer call count:', observerCallCount);
    console.log('Expected: 1 (CRITICAL: if this is 2, the bug still exists!)');
    
    // CRITICAL ASSERTION: Should be exactly 1
    expect(observerCallCount).toBe(1);
    
    // Reset for second character
    observerCallCount = 0;
    observerLog.length = 0;
    
    // Type second character
    await textarea.fill('xy');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Observer log after typing "y":', observerLog);
    console.log('Observer call count:', observerCallCount);
    console.log('Expected: 1');
    
    // Should still be exactly 1
    expect(observerCallCount).toBe(1);
    
    console.log('\n=== SUCCESS: Each Y.Text change triggers exactly ONE observer call ===');
  });
});

