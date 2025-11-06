/**
 * Component to display connection/sync status
 */

import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { getSyncStatus, subscribeSyncStatus } from "../yjs-setup";
import type { SyncStatus as SyncStatusType } from "../types";

export function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusType>(getSyncStatus());

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(() => {
      setStatus(getSyncStatus());
    });
    return unsubscribe;
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "text-green-400";
      case "syncing":
        return "text-yellow-400";
      case "connecting":
        return "text-blue-400";
      case "disconnected":
        return "text-red-400";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "connected":
        return <Wifi size={16} />;
      case "syncing":
      case "connecting":
        return <Loader2 size={16} className="animate-spin" />;
      case "disconnected":
        return <WifiOff size={16} />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Connected";
      case "syncing":
        return "Syncing...";
      case "connecting":
        return "Connecting...";
      case "disconnected":
        return "Disconnected";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          bg-gray-800 shadow-lg
          ${getStatusColor()}
          transition-colors duration-300
        `}
      >
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>
    </div>
  );
}
