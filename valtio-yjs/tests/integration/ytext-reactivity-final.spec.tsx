import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-react';
import * as Y from 'yjs';
import { createYjsProxy, syncedText } from '../../src';
import { useSnapshot } from 'valtio';

describe('Y.Text Reactivity - Final Test', () => {
  it('should re-render React component when Y.Text changes', async () => {
    console.log('\n========== FINAL REACTIVITY TEST ==========\n');
    
    const doc = new Y.Doc();
    
    type State = {
      text: Y.Text;
    };
    
    const { proxy, bootstrap } = createYjsProxy<State>(doc, {
      getRoot: (doc) => doc.getMap('state'),
    });
    
    bootstrap({
      text: syncedText('initial'),
    });
    
    let renderCount = 0;
    
    function TestComponent() {
      const snap = useSnapshot(proxy);
      renderCount++;
      
      const textContent = snap.text.toString();
      console.log(`[RENDER #${renderCount}] text="${textContent}"`);
      
      return (
        <div>
          <div data-testid="text">{textContent}</div>
        </div>
      );
    }
    
    console.log('=== Initial Render ===');
    const screen = render(<TestComponent />);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const initialRenderCount = renderCount;
    console.log('Initial render count:', initialRenderCount);
    
    await expect.element(screen.getByTestId('text')).toHaveTextContent('initial');
    
    console.log('\n=== Modifying Y.Text ===');
    proxy.text.delete(0, proxy.text.length);
    proxy.text.insert(0, 'updated');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('Final render count:', renderCount);
    
    await expect.element(screen.getByTestId('text')).toHaveTextContent('updated');
    
    expect(renderCount).toBeGreaterThan(initialRenderCount);
    console.log(`\n✅ SUCCESS: React re-rendered (${initialRenderCount} → ${renderCount})`);
  });
  
  it('should handle multiple sequential updates', async () => {
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
    const renderLog: string[] = [];
    
    function TestComponent() {
      const snap = useSnapshot(proxy);
      renderCount++;
      
      const textContent = snap.text.toString();
      renderLog.push(textContent);
      
      return <div data-testid="text">{textContent}</div>;
    }
    
    const screen = render(<TestComponent />);
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Make several updates
    proxy.text.insert(0, 'a');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    proxy.text.insert(1, 'b');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    proxy.text.insert(2, 'c');
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log('Render log:', renderLog);
    
    await expect.element(screen.getByTestId('text')).toHaveTextContent('abc');
    
    // Should have re-rendered multiple times (initial + 3 updates)
    expect(renderCount).toBeGreaterThanOrEqual(4);
    console.log(`✅ SUCCESS: ${renderCount} renders for 3 updates`);
  });
});


