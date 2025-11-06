import { createContext, useContext, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

interface YDocContextValue {
  doc: Y.Doc;
  ws: WebSocket | null;
  connected: boolean;
  playerId: string;
  sendOp: (op: any) => void;
}

const YDocContext = createContext<YDocContextValue | null>(null);

export function YDocProvider({
  children,
  roomId,
  playerId,
  serverUrl = "ws://localhost:1999",
}: {
  children: React.ReactNode;
  roomId: string;
  playerId: string;
  serverUrl?: string;
}) {
  const [doc] = useState(() => new Y.Doc());
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const sendOp = (op: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "op",
          playerId,
          op,
        })
      );
    }
  };

  useEffect(() => {
    // Connect to PartyKit server
    const socket = new WebSocket(`${serverUrl}/parties/cardgame/${roomId}`);
    wsRef.current = socket;
    setWs(socket);

    socket.addEventListener("open", () => {
      console.log("Connected to server");
      setConnected(true);
    });

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "sync") {
          // Apply Yjs update
          const update = new Uint8Array(data.update);
          Y.applyUpdate(doc, update);
        } else if (data.type === "error") {
          console.error("Server error:", data.error);
        } else if (data.type === "op-ack") {
          // Operation acknowledged
          console.log("Op acknowledged:", data.op);
        }
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });

    socket.addEventListener("close", () => {
      console.log("Disconnected from server");
      setConnected(false);
    });

    socket.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
    });

    // Send local updates to server
    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== "remote" && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "sync",
            update: Array.from(update),
          })
        );
      }
    };

    doc.on("update", updateHandler);

    return () => {
      doc.off("update", updateHandler);
      socket.close();
    };
  }, [doc, roomId, serverUrl]);

  return (
    <YDocContext.Provider value={{ doc, ws, connected, playerId, sendOp }}>
      {children}
    </YDocContext.Provider>
  );
}

export function useYDoc() {
  const context = useContext(YDocContext);
  if (!context) {
    throw new Error("useYDoc must be used within YDocProvider");
  }
  return context;
}
