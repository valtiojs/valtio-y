import { useEffect, useState } from "react";
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";

/**
 * CollaborativeTextBox demonstrates real-time collaborative text editing
 * using Yjs and y-partyserver.
 */
export function CollaborativeTextBox() {
  const [text, setText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [provider, setProvider] = useState<YProvider | null>(null);

  useEffect(() => {
    // Create a new Yjs document
    const yDoc = new Y.Doc();

    // Get or create a Y.Text type for our text content
    const yText = yDoc.getText("content");

    // Connect to unified worker (same host handles both frontend and Y-PartyServer)
    const yPartyHost = typeof window !== "undefined" ? window.location.host : undefined;
    const roomName = "shared-text-document";
    // PartyServer automatically converts YDocServer -> y-doc-server (kebab-case)
    const partyName = "y-doc-server";

    console.log("[Client] Creating YProvider");
    console.log("[Client] Host:", yPartyHost);
    console.log("[Client] Party:", partyName);
    console.log("[Client] Room:", roomName);

    // Create the provider to connect to our YServer
    // URL will be: /parties/y-doc-server/shared-text-document
    if (!yPartyHost) {
      console.error("[Client] Cannot create provider: no host available");
      return;
    }
    
    const newProvider = new YProvider(yPartyHost, roomName, yDoc, {
      connect: true,
      party: partyName,
    });

    // Listen for connection status changes
    newProvider.on("status", ({ status }: { status: string }) => {
      console.log("[Client] Status changed:", status);
      setIsConnected(status === "connected");
    });

    newProvider.on("connection-error", (error: unknown) => {
      console.error("[Client] Connection error:", error);
    });

    // Listen for changes to the Y.Text and update local state
    const observer = () => {
      setText(yText.toString());
    };

    yText.observe(observer);

    // Initialize the text state
    setText(yText.toString());

    setProvider(newProvider);

    // Cleanup on unmount
    return () => {
      yText.unobserve(observer);
      newProvider.destroy();
    };
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setText(newValue);

    if (provider) {
      const yDoc = provider.doc;
      const yText = yDoc.getText("content");

      // Update the Yjs document which will sync to other clients
      yDoc.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, newValue);
      });
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Collaborative Text Box</h1>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <p className="text-gray-600">
        Try opening this page in multiple windows to see real-time
        synchronization in action!
      </p>

      <textarea
        value={text}
        onChange={handleTextChange}
        className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Start typing... your changes will sync across all connected clients"
      />

      <div className="text-sm text-gray-500">Characters: {text.length}</div>
    </div>
  );
}
