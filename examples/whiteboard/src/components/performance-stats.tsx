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
import { getSyncStatus, subscribeSyncStatus } from "../yjs-setup";
import type { SyncStatus, AppState } from "../types";
import * as Y from "yjs";

interface PerformanceStatsProps {
  proxy: AppState;
  doc?: Y.Doc;
}

export function PerformanceStats({ proxy, doc }: PerformanceStatsProps) {
  const snap = useSnapshot(proxy);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const [colo, setColo] = useState<string>("--");
  const [rtt, setRtt] = useState<number>(0);
  const [snapshotSize, setSnapshotSize] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(true);

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
    if (!doc) return;

    const updateSnapshotSize = () => {
      const state = Y.encodeStateAsUpdate(doc);
      setSnapshotSize(state.byteLength);
    };

    updateSnapshotSize(); // Initial
    const interval = setInterval(updateSnapshotSize, 2000); // Every 2s

    return () => clearInterval(interval);
  }, [doc]);

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
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left hover:bg-gray-50/50 px-4 py-3 rounded-t-2xl transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Activity size={16} />
          Edge Metrics
        </h3>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Cloudflare Colo */}
          <StatItem
            icon={Globe}
            label="Datacenter"
            value={colo}
            suffix=""
            color="text-purple-600"
          />

          {/* Round-Trip Time */}
          <StatItem
            icon={Clock}
            label="RTT"
            value={rtt}
            suffix=" ms"
            color="text-blue-600"
          />

          {/* Snapshot Size */}
          <StatItem
            icon={Database}
            label="Snapshot"
            value={formatBytes(snapshotSize)}
            suffix=""
            color="text-orange-600"
          />

          {/* Shape Count */}
          <StatItem
            icon={Hash}
            label="Shapes"
            value={shapes.length}
            color="text-indigo-600"
          />
        </div>
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
}: StatItemProps) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50/50">
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={color} />
        <span className="text-xs text-gray-600">{label}</span>
      </div>
      <span className={`text-xs font-semibold ${color}`}>
        {value}
        {suffix}
      </span>
    </div>
  );
}
