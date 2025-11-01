import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { createYjsProxy } from 'valtio-yjs';
import { useSnapshot } from 'valtio';
import { useState } from 'react';

const ydoc = new Y.Doc();
const provider = new WebsocketProvider('ws://localhost:1234', 'valtio-yjs-demo', ydoc);

const { proxy: mesgMap, bootstrap } = createYjsProxy<Record<string, string>>(ydoc, {
  getRoot: (doc: Y.Doc) => doc.getMap('messages.v1'),
});
// Initialize once after network sync; bootstrap is a no-op if remote state exists
provider.on('sync', () => {
  try {
    bootstrap({});
  } catch {}
});

const MyMessage = () => {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const send = () => {
    if (name && message) {
      mesgMap[name] = message;
    }
  };
  return (
    <div>
      <div>
        Name: <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        Message:{' '}
        <input value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <button disabled={!name || !message} onClick={send}>
        Send
      </button>
    </div>
  );
};

const Messages = () => {
  const snap = useSnapshot(mesgMap);
  return (
    <div>
      {Object.keys(snap)
        .reverse()
        .map((key) => (
          <p key={key}>
            {key}: {snap[key]}
          </p>
        ))}
    </div>
  );
};

const App = () => (
  <div>
    <h2>My Message</h2>
    <MyMessage />
    <h2>Messages</h2>
    <Messages />
  </div>
);

export default App;
