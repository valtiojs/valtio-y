/**
 * SyncStatus Component
 * 
 * Displays the real-time synchronization status between clients.
 * This provides visual feedback about network state and helps users
 * understand when their changes have been synced.
 */

import { useEffect, useState } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { getSyncStatus, subscribeSyncStatus } from "../yjs-setup";
import type { SyncStatus as SyncStatusType } from "../types";

interface SyncStatusProps {
  clientId: 1 | 2;
}

/**
 * Shows the sync status with appropriate icon and color.
 * Updates in real-time as documents sync through the network.
 */
export function SyncStatus({ clientId }: SyncStatusProps) {
  const [status, setStatus] = useState<SyncStatusType>("connected");

  useEffect(() => {
    // Update when sync status changes
    const updateStatus = () => {
      setStatus(getSyncStatus(clientId));
    };

    // Subscribe to sync status changes
    const unsubscribe = subscribeSyncStatus(updateStatus);

    return unsubscribe;
  }, [clientId]);

  if (status === "syncing") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-blue-600">
        <Loader2 size={12} className="animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (status === "offline") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-600">
        <WifiOff size={12} />
        <span>Offline</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-green-600">
      <Wifi size={12} />
      <span>Connected</span>
    </div>
  );
}

