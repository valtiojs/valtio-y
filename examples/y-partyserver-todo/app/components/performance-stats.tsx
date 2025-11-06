/**
 * Performance Stats Panel
 *
 * Showcases the edge-native architecture:
 * - Cloudflare datacenter (colo) location
 * - Round-trip time (RTT) to the edge
 * - Snapshot size showing CRDT compression
 * - Operations per second and batching stats
 */

import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";
import {
  Activity,
  Zap,
  Hash,
  Wifi,
  WifiOff,
  Globe,
  Clock,
  Database,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { proxy, getSyncStatus, subscribeSyncStatus, yDoc } from "../yjs-setup";
import type { SyncStatus } from "../types";
import * as Y from "yjs";

export function PerformanceStats() {
  const snap = useSnapshot(proxy);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const [colo, setColo] = useState<string>("--");
  const [rtt, setRtt] = useState<number>(0);
  const [snapshotSize, setSnapshotSize] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch Cloudflare colo (datacenter location)
  useEffect(() => {
    fetch("/cdn-cgi/trace")
      .then((res) => res.text())
      .then((text) => {
        const coloMatch = text.match(/colo=([A-Z]+)/);
        if (coloMatch) {
          setColo(coloMatch[1]);
        }
      })
      .catch(() => {
        // Fallback for dev - not on Cloudflare
        setColo("DEV");
      });
  }, []);

  // Measure RTT periodically
  useEffect(() => {
    const measureRTT = () => {
      const start = Date.now();
      fetch("/cdn-cgi/trace", { method: "HEAD" })
        .then(() => {
          const end = Date.now();
          setRtt(end - start);
        })
        .catch(() => {
          setRtt(0);
        });
    };

    measureRTT(); // Initial measurement
    const interval = setInterval(measureRTT, 5000); // Every 5s

    return () => clearInterval(interval);
  }, []);

  // Calculate snapshot size
  useEffect(() => {
    const updateSnapshotSize = () => {
      const state = Y.encodeStateAsUpdate(yDoc);
      setSnapshotSize(state.byteLength);
    };

    updateSnapshotSize(); // Initial
    const interval = setInterval(updateSnapshotSize, 2000); // Every 2s

    return () => clearInterval(interval);
  }, []);

  // Subscribe to sync status
  useEffect(() => {
    setSyncStatus(getSyncStatus());

    const unsubscribe = subscribeSyncStatus(() => {
      setSyncStatus(getSyncStatus());
    });

    return unsubscribe;
  }, []);

  const stats = snap.stats;
  const shapes = snap.shapes || [];

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left hover:bg-gray-50 -m-4 p-4 rounded-t-lg transition-colors"
      >
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Activity size={20} />
          Edge Metrics
        </h3>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && (
        <>
          <div className="space-y-3 mt-4">
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

            {/* Cloudflare Colo */}
            <StatItem
              icon={Globe}
              label="Datacenter"
              value={colo}
              suffix=""
              color="text-purple-600"
              highlight={colo !== "DEV" && colo !== "--"}
            />

            {/* Round-Trip Time */}
            <StatItem
              icon={Clock}
              label="RTT"
              value={rtt}
              suffix=" ms"
              color="text-blue-600"
              highlight={rtt > 0 && rtt < 100}
            />

            {/* Snapshot Size */}
            <StatItem
              icon={Database}
              label="Snapshot"
              value={formatBytes(snapshotSize)}
              suffix=""
              color="text-orange-600"
            />

            <div className="border-t border-gray-200 my-2" />

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
              suffix=" pts"
              color="text-purple-600"
              highlight={stats && stats.batchSize > 10}
            />

            {/* Shape Count */}
            <StatItem
              icon={Hash}
              label="Shapes"
              value={shapes.length}
              color="text-indigo-600"
            />
          </div>

          {/* Info Box - Edge Architecture */}
          <div className="mt-4 p-3 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-md">
            <h4 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-1">
              <Zap size={14} />
              Running on the Edge
            </h4>
            <ul className="text-xs text-blue-800 space-y-1 leading-relaxed">
              <li>
                <strong>Colo:</strong> Cloudflare datacenter serving this session
              </li>
              <li>
                <strong>RTT:</strong> Sub-50ms latency to nearest edge location
              </li>
              <li>
                <strong>Snapshot:</strong> CRDT state compressed for fast sync
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
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
        <Icon size={14} className={color} />
        <span className="text-xs font-medium text-gray-700">{label}</span>
      </div>
      <span className={`text-xs font-bold ${color}`}>
        {value}
        {suffix}
      </span>
    </div>
  );
}
