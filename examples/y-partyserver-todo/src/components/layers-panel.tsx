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
import { GripVertical, Trash2 } from "lucide-react";
import { proxy } from "../yjs-setup";

interface LayersPanelProps {
  onShapeSelect?: (shapeId: string) => void;
  selectedShapeId?: string;
}

export function LayersPanel({
  onShapeSelect,
  selectedShapeId,
}: LayersPanelProps) {
  const snap = useSnapshot(proxy);

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

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-5 shadow-lg h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center justify-between">
        <span>Layers</span>
        <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
          {shapes.length}
        </span>
      </h3>

      {shapes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="text-gray-400 text-sm space-y-2">
            <p className="font-medium">No shapes yet.</p>
            <p className="text-xs">Start drawing to see layers here!</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={shapes.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {/* Render in reverse order (top layer first) */}
                {[...shapes].reverse().map((shape) => (
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

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 leading-relaxed">
          💡 <strong>Tip:</strong> Drag layers to reorder them - showcases array
          moves without fractional indexes!
        </p>
      </div>
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
        <svg width="32" height="32" viewBox="0 0 32 32">
          <path
            d={`M ${shape.points.map((p: any, i: number) => `${i === 0 ? "M" : "L"} ${Math.min(30, (p.x / 1200) * 32)} ${Math.min(30, (p.y / 800) * 32)}`).join(" ")}`}
            stroke={shape.style.color}
            strokeWidth="2"
            fill="none"
          />
        </svg>
      );
    } else if (shape.type === "rect") {
      return (
        <svg width="32" height="32" viewBox="0 0 32 32">
          <rect
            x="4"
            y="4"
            width="24"
            height="24"
            stroke={shape.style.color}
            strokeWidth="2"
            fill={shape.style.fillColor || "none"}
          />
        </svg>
      );
    } else if (shape.type === "circle") {
      return (
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle
            cx="16"
            cy="16"
            r="12"
            stroke={shape.style.color}
            strokeWidth="2"
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
      className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all duration-200 ${
        selected
          ? "bg-blue-50 border-blue-300 shadow-sm"
          : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical size={16} />
      </button>

      {/* Shape Preview */}
      <div className="flex-shrink-0">{getShapePreview(shape)}</div>

      {/* Shape Info */}
      <div className="flex-1 min-w-0" onClick={onSelect}>
        <p className="text-sm font-medium text-gray-800 truncate">
          {getShapeLabel(shape)}
        </p>
        <p className="text-xs text-gray-500">
          {new Date(shape.timestamp).toLocaleTimeString()}
        </p>
      </div>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-all duration-200"
        title="Delete shape"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
