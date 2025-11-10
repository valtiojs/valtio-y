import { useState, useEffect } from "react";
import { getSyncStatus, subscribeSyncStatus } from "../yjs-setup";
import type { SyncStatus } from "../types";

/**
 * Custom hook for reactive sync status
 *
 * Subscribes to sync status changes from the Y-PartyServer provider
 * and provides reactive state for connection status indicators.
 *
 * @returns Current sync status ("offline" | "syncing" | "connected")
 *
 * @example
 * ```tsx
 * const syncStatus = useSyncStatus();
 *
 * {syncStatus === "connected" ? (
 *   <Wifi className="text-green-600" />
 * ) : (
 *   <WifiOff className="text-red-600" />
 * )}
 * ```
 */
export function useSyncStatus(): SyncStatus {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    getSyncStatus(),
  );

  useEffect(() => {
    // Subscribe to sync status changes
    const unsubscribe = subscribeSyncStatus(() => {
      setSyncStatus(getSyncStatus());
    });

    return unsubscribe;
  }, []);

  return syncStatus;
}
