/**
 * Layers Panel - Manage and reorder shapes
 *
 * This component showcases valtio-y's array move capabilities:
 * - Drag to reorder layers without fractional indexes
 * - Delete layers
 * - Show layer previews
 *
 * Uses @dnd-kit for drag-and-drop functionality
 */

import { useState } from "react";
import { useSnapshot } from "valtio";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Trash2,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { AppState } from "../types";

interface LayersPanelProps {
  onShapeSelect?: (shapeId: string) => void;
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && proxy.shapes) {
      const oldIndex = proxy.shapes.findIndex(
        (shape) => shape.id === active.id,
      );
      const newIndex = proxy.shapes.findIndex((shape) => shape.id === over.id);

      // Use valtio-y's array move - no fractional indexes needed!
      const moved = arrayMove(proxy.shapes, oldIndex, newIndex);
      proxy.shapes = moved;
    }
  };

  const handleDeleteShape = (shapeId: string) => {
    if (!proxy.shapes) return;
    const index = proxy.shapes.findIndex((shape) => shape.id === shapeId);
    if (index !== -1) {
      proxy.shapes.splice(index, 1);
    }
  };

  const shapes = snap.shapes || [];
  const renderedShapes = [...shapes].reverse();

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-200 max-h-96 flex flex-col">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
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

      {isExpanded && (
        <>
          {shapes.length === 0 ? (
            <div className="px-4 pb-4 text-center">
              <p className="text-xs text-gray-500">No shapes yet</p>
            </div>
          ) : (
            <div className="px-3 pb-3 overflow-y-auto max-h-72">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={renderedShapes.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {/* Render in reverse order (top layer first) */}
                    {renderedShapes.map((shape) => (
                      <LayerItem
                        key={shape.id}
                        shape={shape}
                        selected={shape.id === selectedShapeId}
                        onSelect={() => onShapeSelect?.(shape.id)}
                        onDelete={() => handleDeleteShape(shape.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// LAYER ITEM COMPONENT
// ============================================================================

interface LayerItemProps {
  shape: any;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function LayerItem({ shape, selected, onSelect, onDelete }: LayerItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: shape.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getShapeLabel = (shape: any): string => {
    if (shape.type === "path") {
      return `Path (${shape.points.length} points)`;
    } else if (shape.type === "rect") {
      return `Rectangle`;
    } else if (shape.type === "circle") {
      return `Circle`;
    }
    return "Shape";
  };

  const getShapePreview = (shape: any) => {
    if (shape.type === "path") {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path
            d={`M ${shape.points.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${Math.min(22, (p.x / 1200) * 24)} ${Math.min(22, (p.y / 800) * 24)}`).join(" ")}`}
            stroke={shape.style.color}
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    } else if (shape.type === "rect") {
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
    } else if (shape.type === "circle") {
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
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 p-2 rounded-lg border transition-all ${
        selected
          ? "bg-blue-50/50 border-blue-300"
          : "bg-white/50 border-gray-200 hover:bg-gray-50/50"
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 flex-shrink-0"
      >
        <GripVertical size={14} />
      </button>

      {/* Shape Preview */}
      <div className="flex-shrink-0">{getShapePreview(shape)}</div>

      {/* Shape Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onSelect}>
        <p className="text-xs font-medium text-gray-800 truncate">
          {getShapeLabel(shape)}
        </p>
      </div>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 text-gray-400 hover:text-red-600 p-1 rounded transition-all"
        title="Delete shape"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
