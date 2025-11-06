import { useState, useEffect, useRef } from "react";
import { LogEntry } from "../y/selectors";

interface ChatProps {
  log: LogEntry[];
  onSendMessage: (text: string) => void;
}

export function Chat({ log, onSendMessage }: ChatProps) {
  const [message, setMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [log, isOpen]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  return (
    <div
      className={`
        fixed right-4 bottom-40 w-80 bg-gray-800/95 backdrop-blur-lg rounded-lg shadow-2xl border border-gray-700
        transition-all duration-300
        ${isOpen ? "h-96" : "h-12"}
      `}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-white hover:bg-gray-700/50 rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <span className="font-medium">Game Log</span>
          {!isOpen && log.length > 0 && (
            <span className="bg-red-500 text-xs px-2 py-0.5 rounded-full">
              {log.length}
            </span>
          )}
        </div>
        <span className="text-xl">{isOpen ? "▼" : "▲"}</span>
      </button>

      {isOpen && (
        <>
          {/* Log */}
          <div className="h-64 overflow-y-auto px-4 py-2 space-y-2">
            {log.map((entry, index) => (
              <div
                key={index}
                className="text-sm text-gray-300 bg-gray-900/50 rounded px-2 py-1"
              >
                {entry.msg}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={500}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
