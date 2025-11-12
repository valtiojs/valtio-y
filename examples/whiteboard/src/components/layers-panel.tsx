/**
 * Layers Panel - Manage and reorder shapes
 *
 * This component showcases valtio-y's array move capabilities:
 * - Drag to reorder layers without fractional indexes
 * - Delete layers
 * - Show layer previews
 *
 * Uses Motion's Reorder API for buttery-smooth layer drag & drop
 */

import { useCallback, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useSnapshot } from "valtio";
import {
  GripVertical,
  Trash2,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AnimatePresence, Reorder, useDragControls } from "motion/react";
import type { AppState, Shape } from "../types";

type SnapshotShape = Readonly<Shape>;

interface LayersPanelProps {
  onShapeSelect?: (shapeId: string | undefined) => void;
  selectedShapeId?: string;
  proxy: AppState;
}

export function LayersPanel({
  onShapeSelect,
  selectedShapeId,
  proxy,
}: LayersPanelProps) {
  const snap = useSnapshot(proxy);
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleDeleteShape = useCallback(
    (shapeId: string) => {
      if (!proxy.shapes) return;
      const index = proxy.shapes.findIndex((shape) => shape.id === shapeId);
      if (index !== -1) {
        proxy.shapes.splice(index, 1);

        if (shapeId === selectedShapeId) {
          onShapeSelect?.(undefined);
        }
      }
    },
    [proxy, onShapeSelect, selectedShapeId],
  );

  const handleSelectShape = useCallback(
    (shapeId: string) => {
      onShapeSelect?.(shapeId);
    },
    [onShapeSelect],
  );

  const shapes = (snap.shapes || []) as SnapshotShape[];
  const renderedShapes = useMemo<SnapshotShape[]>(
    () => [...shapes].reverse(),
    [shapes],
  );

  const handleReorder = useCallback(
    (newOrder: SnapshotShape[]) => {
      if (!proxy.shapes) return;

      const idToShape = new Map(proxy.shapes.map((shape) => [shape.id, shape]));
      const normalizedIds = [...newOrder].reverse().map((shape) => shape.id);
      const reordered = normalizedIds
        .map((id) => idToShape.get(id))
        .filter((shape): shape is Shape => Boolean(shape));

      if (reordered.length === proxy.shapes.length) {
        proxy.shapes = reordered;
      }
    },
    [proxy],
  );

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 max-h-96 flex flex-col">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between text-left hover:bg-gray-50/50 px-4 py-3 rounded-t-2xl transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Layers size={16} />
          Layers
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {shapes.length}
          </span>
        </h3>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {isExpanded &&
        (shapes.length === 0 ? (
          <div className="px-4 pb-4 text-center">
            <p className="text-xs text-gray-500">No shapes yet</p>
          </div>
        ) : (
          <div className="px-3 pb-3 overflow-y-auto max-h-72">
            <Reorder.Group<SnapshotShape>
              axis="y"
              values={renderedShapes}
              onReorder={handleReorder}
              className="space-y-1.5 list-none"
            >
              <AnimatePresence initial={false}>
                {renderedShapes.map((shape) => (
                  <LayerItem
                    key={shape.id}
                    shape={shape}
                    selected={shape.id === selectedShapeId}
                    onSelect={handleSelectShape}
                    onDelete={handleDeleteShape}
                  />
                ))}
              </AnimatePresence>
            </Reorder.Group>
          </div>
        ))}
    </div>
  );
}

// ============================================================================
// LAYER ITEM COMPONENT
// ============================================================================

interface LayerItemProps {
  shape: SnapshotShape;
  selected: boolean;
  onSelect: (shapeId: string) => void;
  onDelete: (shapeId: string) => void;
}

const LAYER_INITIAL = { opacity: 0, y: -6 } as const;
const LAYER_EXIT = { opacity: 0, y: 8 } as const;
const LAYER_TRANSITION = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.65,
};

function LayerItem({ shape, selected, onSelect, onDelete }: LayerItemProps) {
  const dragControls = useDragControls();

  const handleDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      dragControls.start(event);
    },
    [dragControls],
  );

  const handleSelect = useCallback(() => {
    onSelect(shape.id);
  }, [onSelect, shape.id]);

  const handleDelete = useCallback(() => {
    onDelete(shape.id);
  }, [onDelete, shape.id]);

  const animate = useMemo(
    () => ({
      opacity: 1,
      y: 0,
      scale: selected ? 1.02 : 1,
    }),
    [selected],
  );

  const shapeLabel = useMemo(() => getShapeLabel(shape), [shape]);
  const shapePreview = useMemo(() => getShapePreview(shape), [shape]);

  return (
    <Reorder.Item
      value={shape}
      dragControls={dragControls}
      dragListener={false}
      initial={LAYER_INITIAL}
      animate={animate}
      exit={LAYER_EXIT}
      transition={LAYER_TRANSITION}
      layout
      className={`flex items-center gap-1.5 p-2 rounded-lg border backdrop-blur-sm ${
        selected
          ? "bg-blue-50/70 border-blue-300 shadow-sm"
          : "bg-white/60 border-gray-200/80 hover:bg-gray-50/70"
      }`}
    >
      {/* Drag Handle */}
      <button
        type="button"
        onPointerDown={handleDragPointerDown}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 shrink-0"
        aria-label="Reorder layer"
      >
        <GripVertical size={14} />
      </button>

      {/* Shape Preview */}
      <div className="shrink-0">{shapePreview}</div>

      {/* Shape Info */}
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={handleSelect}
        title={shapeLabel}
      >
        <p className="text-xs font-medium text-gray-800 truncate">
          {shapeLabel}
        </p>
      </button>

      {/* Delete Button */}
      <button
        type="button"
        onClick={handleDelete}
        className="shrink-0 text-gray-400 hover:text-red-600 p-1 rounded transition-all"
        title="Delete shape"
      >
        <Trash2 size={13} />
      </button>
    </Reorder.Item>
  );
}

function getShapeLabel(shape: SnapshotShape): string {
  if (shape.type === "path") {
    return `Path (${shape.points.length} points)`;
  }
  if (shape.type === "rect") {
    return "Rectangle";
  }
  if (shape.type === "circle") {
    return "Circle";
  }
  return "Shape";
}

function getShapePreview(shape: SnapshotShape) {
  if (shape.type === "path") {
    if (shape.points.length === 0) {
      return null;
    }

    const pathCommands = shape.points
      .map((point, index) => {
        const command = index === 0 ? "M" : "L";
        const x = Math.min(22, (point.x / 1200) * 24);
        const y = Math.min(22, (point.y / 800) * 24);
        return `${command} ${x} ${y}`;
      })
      .join(" ");

    return (
      <svg width="24" height="24" viewBox="0 0 24 24">
        <path
          d={pathCommands}
          stroke={shape.style.color}
          strokeWidth="1.5"
          fill="none"
        />
      </svg>
    );
  }

  if (shape.type === "rect") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24">
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          stroke={shape.style.color}
          strokeWidth="1.5"
          fill={shape.style.fillColor || "none"}
        />
      </svg>
    );
  }

  if (shape.type === "circle") {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke={shape.style.color}
          strokeWidth="1.5"
          fill={shape.style.fillColor || "none"}
        />
      </svg>
    );
  }

  return null;
}
