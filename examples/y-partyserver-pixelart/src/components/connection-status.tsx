/**
 * Connection Status Component
 *
 * Shows the connection status to the PartyKit server and active users.
 */

import { useEffect, useState } from "react";
import { Wifi, WifiOff, Users } from "lucide-react";
import { provider, awareness, getSyncStatus, subscribeSyncStatus } from "../yjs-setup";
import type { SyncStatus } from "../types";

export function ConnectionStatus() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [userCount, setUserCount] = useState(1);

  useEffect(() => {
    // Subscribe to sync status changes
    const unsubscribe = subscribeSyncStatus(() => {
      setSyncStatus(getSyncStatus());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Listen for awareness changes to count users
    const updateUserCount = () => {
      const states = awareness.getStates();
      setUserCount(states.size);
    };

    awareness.on("change", updateUserCount);
    updateUserCount();

    return () => {
      awareness.off("change", updateUserCount);
    };
  }, []);

  const getStatusInfo = () => {
    if (syncStatus === "disconnected") {
      return {
        icon: <WifiOff className="w-4 h-4" />,
        text: "Disconnected",
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
      };
    }
    if (syncStatus === "syncing") {
      return {
        icon: <Wifi className="w-4 h-4 animate-pulse" />,
        text: "Syncing...",
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        border: "border-yellow-200",
      };
    }
    return {
      icon: <Wifi className="w-4 h-4" />,
      text: "Connected",
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-200",
    };
  };

  const status = getStatusInfo();

  return (
    <div className="flex items-center gap-3">
      {/* Connection status */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${status.bg} ${status.border}`}
      >
        <span className={status.color}>{status.icon}</span>
        <span className={`text-sm font-medium ${status.color}`}>
          {status.text}
        </span>
      </div>

      {/* Active users */}
      {syncStatus === "connected" && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-blue-50 border-blue-200">
          <Users className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">
            {userCount} {userCount === 1 ? "user" : "users"}
          </span>
        </div>
      )}
    </div>
  );
}
