import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-react';
import * as Y from 'yjs';
import { createYjsProxy, syncedText } from '../../src';
import { useSnapshot, subscribe } from 'valtio';

describe('Y.Text Simple useSnapshot Test', () => {
  it('should re-render when Y.Text changes (minimal test)', async () => {
    const doc = new Y.Doc();
    
    type State = {
      text: Y.Text;
    };
    
    const { proxy, bootstrap } = createYjsProxy<State>(doc, {
      getRoot: (doc) => doc.getMap('state'),
      debug: true, // Enable debug logging
    });
    
    bootstrap({
      text: syncedText(''),
    });
    
    // Add explicit subscription BEFORE rendering component
    subscribe(proxy, () => {
      console.log('[SUBSCRIBE] Proxy changed');
    });
    
    let renderCount = 0;
    
    function TestComponent() {
      const snap = useSnapshot(proxy);
      renderCount++;
      
      // NO explicit version access needed - the reactive wrapper handles it!
      const textContent = snap.text.toString();
      console.log(`[RENDER #${renderCount}] text="${textContent}"`);
      
      return (
        <div>
          <div data-testid="text">{textContent}</div>
        </div>
      );
    }
    
    const screen = render(<TestComponent />);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const initialRenderCount = renderCount;
    console.log('Initial render count:', initialRenderCount);
    
    // Modify Y.Text
    console.log('\n=== Inserting "hello" ===');
    proxy.text.insert(0, 'hello');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    console.log('Final render count:', renderCount);
    
    // Should have re-rendered
    expect(renderCount).toBeGreaterThan(initialRenderCount);
    
    const textElement = screen.getByTestId('text');
    await expect.element(textElement).toHaveTextContent('hello');
    
    console.log(`✅ SUCCESS: React re-rendered (${initialRenderCount} → ${renderCount})`);
  });
});

