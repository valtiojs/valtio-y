import { describe, it, expect } from 'vitest';
import { render } from 'vitest-browser-react';
import * as Y from 'yjs';
import { createYjsProxy, syncedText } from '../../src';
import { useSnapshot } from 'valtio';

describe('Y.Text Reactivity with React', () => {
  it('updates React component when Y.Text content changes', async () => {
    const doc = new Y.Doc();
    
    type State = {
      text: Y.Text;
    };
    
    const { proxy, bootstrap } = createYjsProxy<State>(doc, {
      getRoot: (doc) => doc.getMap('state'),
    });
    
    bootstrap({
      text: syncedText('Hello'),
    });
    
    // Create a React component that displays the Y.Text content
    function TextDisplay() {
      const snap = useSnapshot(proxy);
      return (
        <div>
          <p data-testid="text-content">{snap.text.toString()}</p>
        </div>
      );
    }
    
    const screen = render(<TextDisplay />);
    
    // Initially should show "Hello"
    await expect.element(screen.getByTestId('text-content')).toHaveTextContent('Hello');
    
    // Modify Y.Text directly (simulating user input)
    proxy.text.insert(5, ' World');
    
    // The component should re-render and show the updated text
    // This is the critical test - without the fix, this would timeout/fail
    await expect.element(screen.getByTestId('text-content')).toHaveTextContent('Hello World');
  });
  
  it('updates React component on Y.Text delete operations', async () => {
    const doc = new Y.Doc();
    
    type State = {
      text: Y.Text;
    };
    
    const { proxy, bootstrap } = createYjsProxy<State>(doc, {
      getRoot: (doc) => doc.getMap('state'),
    });
    
    bootstrap({
      text: syncedText('Hello World'),
    });
    
    function TextDisplay() {
      const snap = useSnapshot(proxy);
      return <div data-testid="text-content">{snap.text.toString()}</div>;
    }
    
    const screen = render(<TextDisplay />);
    
    // Initially should show "Hello World"
    await expect.element(screen.getByTestId('text-content')).toHaveTextContent('Hello World');
    
    // Delete part of the text
    proxy.text.delete(5, 6); // Remove " World"
    
    // Component should update immediately
    await expect.element(screen.getByTestId('text-content')).toHaveTextContent('Hello');
  });
  
  it('updates React component when Y.Text is modified from remote changes', async () => {
    // Create two docs to simulate remote sync
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();
    
    type State = {
      text: Y.Text;
    };
    
    const { proxy: proxy1, bootstrap } = createYjsProxy<State>(doc1, {
      getRoot: (doc) => doc.getMap('state'),
    });
    
    const { proxy: proxy2 } = createYjsProxy<State>(doc2, {
      getRoot: (doc) => doc.getMap('state'),
    });
    
    // Setup sync between docs BEFORE bootstrap to ensure initial state syncs
    doc1.on('update', (update: Uint8Array) => {
      Y.applyUpdate(doc2, update);
    });
    
    doc2.on('update', (update: Uint8Array) => {
      Y.applyUpdate(doc1, update);
    });
    
    // Bootstrap after sync handlers are setup
    bootstrap({
      text: syncedText('Initial'),
    });
    
    // Wait for initial sync to propagate
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Component uses proxy2 but changes come from proxy1
    function TextDisplay() {
      const snap = useSnapshot(proxy2);
      return <div data-testid="remote-text">{snap.text?.toString() || 'loading...'}</div>;
    }
    
    const screen = render(<TextDisplay />);
    
    // Initially should show "Initial"
    await expect.element(screen.getByTestId('remote-text')).toHaveTextContent('Initial');
    
    // Modify via proxy1 (remote change)
    proxy1.text.insert(7, ' Text');
    
    // Component watching proxy2 should update
    await expect.element(screen.getByTestId('remote-text')).toHaveTextContent('Initial Text');
  });
  
  it('handles multiple rapid Y.Text changes', async () => {
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
    
    function TextDisplay() {
      const snap = useSnapshot(proxy);
      return (
        <div>
          <div data-testid="text-content">{snap.text.toString()}</div>
          <div data-testid="text-length">{snap.text.length}</div>
        </div>
      );
    }
    
    const screen = render(<TextDisplay />);
    
    // Perform multiple rapid inserts
    proxy.text.insert(0, 'H');
    proxy.text.insert(1, 'e');
    proxy.text.insert(2, 'l');
    proxy.text.insert(3, 'l');
    proxy.text.insert(4, 'o');
    
    // Component should eventually show all changes
    await expect.element(screen.getByTestId('text-content')).toHaveTextContent('Hello');
    await expect.element(screen.getByTestId('text-length')).toHaveTextContent('5');
  });
  
  it('displays character count that updates reactively', async () => {
    const doc = new Y.Doc();
    
    type State = {
      text: Y.Text;
    };
    
    const { proxy, bootstrap } = createYjsProxy<State>(doc, {
      getRoot: (doc) => doc.getMap('state'),
    });
    
    bootstrap({
      text: syncedText('Test'),
    });
    
    function CharacterCounter() {
      const snap = useSnapshot(proxy);
      const count = snap.text.length;
      return (
        <div>
          <p data-testid="char-count">Characters: {count}</p>
        </div>
      );
    }
    
    const screen = render(<CharacterCounter />);
    
    // Initial count
    await expect.element(screen.getByTestId('char-count')).toHaveTextContent('Characters: 4');
    
    // Add more text
    proxy.text.insert(4, ' Text');
    
    // Count should update
    await expect.element(screen.getByTestId('char-count')).toHaveTextContent('Characters: 9');
  });
});

