/**
 * Performance Stats Panel
 *
 * Showcases valtio-y's performance optimizations:
 * - Operations per second
 * - Batch sizes during drawing
 * - Total operations count
 * - Connection status
 *
 * This component helps users understand the batching behavior
 * that makes valtio-y performant for real-time collaboration.
 */

import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import { Activity, Zap, Hash, Wifi, WifiOff } from "lucide-react";
import { proxy, getSyncStatus, subscribeSyncStatus } from "../yjs-setup";
import type { SyncStatus } from "../types";

export function PerformanceStats() {
  const snap = useSnapshot(proxy);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");

  useEffect(() => {
    // Initial status
    setSyncStatus(getSyncStatus());

    // Subscribe to status changes
    const unsubscribe = subscribeSyncStatus(() => {
      setSyncStatus(getSyncStatus());
    });

    return unsubscribe;
  }, []);

  const stats = snap.stats;
  const shapes = snap.shapes || [];
  const users = snap.users ? Object.keys(snap.users).length : 0;

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-lg">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Activity size={20} />
        Performance Stats
      </h3>

      <div className="space-y-4">
        {/* Connection Status */}
        <StatItem
          icon={syncStatus === "connected" ? Wifi : WifiOff}
          label="Connection"
          value={syncStatus}
          color={
            syncStatus === "connected"
              ? "text-green-600"
              : syncStatus === "syncing"
                ? "text-yellow-600"
                : "text-red-600"
          }
        />

        {/* Operations Per Second */}
        <StatItem
          icon={Zap}
          label="Ops/Second"
          value={stats?.opsPerSecond || 0}
          suffix=" ops/s"
          color="text-blue-600"
          highlight={stats && stats.opsPerSecond > 0}
        />

        {/* Batch Size */}
        <StatItem
          icon={Hash}
          label="Batch Size"
          value={stats?.batchSize || 0}
          suffix=" points"
          color="text-purple-600"
          highlight={stats && stats.batchSize > 10}
        />

        {/* Total Operations */}
        <StatItem
          icon={Activity}
          label="Total Ops"
          value={stats?.totalOps || 0}
          color="text-gray-600"
        />

        {/* Shape Count */}
        <StatItem
          icon={Hash}
          label="Shapes"
          value={shapes.length}
          color="text-indigo-600"
        />

        {/* User Count */}
        <StatItem
          icon={Activity}
          label="Users"
          value={users}
          color="text-teal-600"
        />
      </div>

      {/* Info Box */}
      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          💡 About Batching
        </h4>
        <p className="text-xs text-blue-800 leading-relaxed">
          When you draw, valtio-y batches hundreds of point additions into
          efficient sync operations. Watch the <strong>Batch Size</strong> spike
          as you draw! This is a key advantage over other CRDT libraries.
        </p>
      </div>

      {/* USPs List */}
      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
        <h4 className="text-sm font-semibold text-green-900 mb-2">
          ✨ valtio-y USPs
        </h4>
        <ul className="text-xs text-green-800 space-y-1">
          <li>✓ Automatic batching for rapid updates</li>
          <li>✓ Array moves without fractional indexes</li>
          <li>✓ Native JavaScript API (no CRDT primitives)</li>
          <li>✓ Reactive with Valtio's useSnapshot</li>
        </ul>
      </div>
    </div>
  );
}

// ============================================================================
// STAT ITEM COMPONENT
// ============================================================================

interface StatItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  suffix?: string;
  color: string;
  highlight?: boolean;
}

function StatItem({
  icon: Icon,
  label,
  value,
  suffix = "",
  color,
  highlight = false,
}: StatItemProps) {
  return (
    <div
      className={`flex items-center justify-between p-2 rounded-md transition-colors ${
        highlight ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={16} className={color} />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <span className={`text-sm font-bold ${color}`}>
        {value}
        {suffix}
      </span>
    </div>
  );
}
