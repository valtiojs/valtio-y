/**
 * Resilient Provider Demo Application
 *
 * This demonstrates how to use the ResilientProvider with valtio-y
 * to handle network errors gracefully in a real application.
 */

import * as Y from "yjs";
import { createYjsProxy } from "valtio-y";
import { useSnapshot } from "valtio/vanilla";
import { ResilientProvider, type ConnectionState } from "./resilient-provider";

// Define the shared state shape
interface SharedState {
  messages: Array<{ id: number; text: string; timestamp: number }>;
  connectionQuality: "excellent" | "good" | "poor" | "offline";
}

/**
 * Create the Y.js document and initialize valtio-y
 */
function initializeSharedState() {
  const doc = new Y.Doc();

  // Create the valtio-y proxy
  const { proxy, bootstrap } = createYjsProxy<SharedState>(doc, {
    getRoot: (d) => d.getMap("root"),
    logLevel: "debug",
  });

  // Bootstrap with initial data
  bootstrap({
    messages: [],
    connectionQuality: "offline",
  });

  return { doc, proxy };
}

/**
 * Connection state indicator component
 */
function createConnectionIndicator(
  container: HTMLElement,
  getState: () => ConnectionState,
): void {
  const indicator = document.createElement("div");
  indicator.className = "connection-indicator";
  container.appendChild(indicator);

  function update() {
    const state = getState();
    indicator.className = `connection-indicator ${state}`;

    const statusText = {
      disconnected: "⚫ Disconnected",
      connecting: "🟡 Connecting...",
      connected: "🟢 Connected",
      error: "🔴 Connection Error",
    };

    indicator.textContent = statusText[state];
  }

  // Update immediately and periodically
  update();
  setInterval(update, 1000);
}

/**
 * Retry button component
 */
function createRetryButton(
  container: HTMLElement,
  onRetry: () => void,
): void {
  const button = document.createElement("button");
  button.textContent = "Retry Connection";
  button.onclick = onRetry;
  container.appendChild(button);
}

/**
 * Message list component
 */
function createMessageList(
  container: HTMLElement,
  proxy: SharedState,
): void {
  const list = document.createElement("div");
  list.className = "message-list";
  container.appendChild(list);

  function render() {
    list.innerHTML = "";

    if (proxy.messages.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No messages yet. Add one below!";
      list.appendChild(empty);
      return;
    }

    proxy.messages.forEach((message) => {
      const item = document.createElement("div");
      item.className = "message-item";
      item.innerHTML = `
        <div class="message-text">${message.text}</div>
        <div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>
      `;
      list.appendChild(item);
    });
  }

  // Initial render
  render();

  // Re-render on changes (in a real app, use React/Vue/etc with useSnapshot)
  setInterval(render, 100);
}

/**
 * Message input component
 */
function createMessageInput(
  container: HTMLElement,
  proxy: SharedState,
): void {
  const form = document.createElement("form");
  form.className = "message-form";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type a message...";
  input.className = "message-input";

  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Send";

  form.onsubmit = (e) => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    try {
      // Add message to shared state
      proxy.messages.push({
        id: Date.now(),
        text,
        timestamp: Date.now(),
      });

      input.value = "";
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message. Please check your connection.");
    }
  };

  form.appendChild(input);
  form.appendChild(button);
  container.appendChild(form);
}

/**
 * Main application
 */
function main() {
  // Initialize shared state
  const { doc, proxy } = initializeSharedState();

  // Create resilient provider
  const provider = new ResilientProvider(
    doc,
    "ws://localhost:1234", // Replace with your WebSocket server URL
    "demo-room",
    {
      maxReconnects: 5,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      onStateChange: (state) => {
        console.log("Connection state changed:", state);

        // Update connection quality indicator
        proxy.connectionQuality =
          state === "connected"
            ? "excellent"
            : state === "connecting"
              ? "good"
              : state === "error"
                ? "poor"
                : "offline";
      },
      onError: (error) => {
        console.error("Connection error:", error);
        alert(`Connection error: ${error.message}`);
      },
    },
  );

  // Create UI
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("App container not found");
  }

  const header = document.createElement("div");
  header.className = "header";
  app.appendChild(header);

  const title = document.createElement("h1");
  title.textContent = "Resilient Provider Demo";
  header.appendChild(title);

  createConnectionIndicator(header, () => provider.state);
  createRetryButton(header, () => provider.reconnect());

  createMessageList(app, proxy);
  createMessageInput(app, proxy);

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    provider.destroy();
  });

  console.log(
    "App initialized. Try disconnecting your network to see resilience in action!",
  );
}

// Start the app
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", main);
}
