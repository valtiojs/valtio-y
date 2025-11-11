/**
 * Canvas Component - The main drawing surface
 *
 * Features Figma-like two-layer rendering:
 * - Ghost layer: In-progress strokes (via Awareness - ephemeral)
 * - Committed layer: Finished shapes (via Yjs CRDT - persisted)
 * - Automatic commitment every 200ms or on mouseup
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useSnapshot } from "valtio";
import getStroke from "perfect-freehand";
import { Eraser } from "lucide-react";
import { trackOperation, getAwarenessUsers } from "../yjs-setup";
import { Cursor } from "./cursor";
import type {
  Point,
  Tool,
  Shape,
  PathShape,
  AppState,
  CursorState,
  User,
} from "../types";
import type * as awarenessProtocol from "y-protocols/awareness";

interface CanvasProps {
  tool: Tool;
  color: string;
  strokeWidth: number;
  userId: string;
  fillEnabled: boolean;
  selectedShapeId?: string;
  onShapeSelect?: (shapeId: string | undefined) => void;
  proxy: AppState;
  awareness: awarenessProtocol.Awareness;
  zoom: number;
}

// Type for ghost shape (in-progress drawing)
type GhostShape = PathShape | RectShape | CircleShape;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function Canvas({
  tool,
  color,
  strokeWidth,
  userId,
  fillEnabled,
  selectedShapeId,
  onShapeSelect,
  proxy,
  awareness,
  zoom,
}: CanvasProps) {
  const snap = useSnapshot(proxy);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ghostShape, setGhostShape] = useState<GhostShape | null>(null);
  const [awarenessUsers, setAwarenessUsers] = useState<User[]>([]);
  const commitTimerRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [eraserScreenPos, setEraserScreenPos] = useState<Point | null>(null);
  const canvasMetricsRef = useRef({
    left: 0,
    top: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    scaleX: 1,
    scaleY: 1,
  });
  const [canvasMetrics, setCanvasMetrics] = useState(canvasMetricsRef.current);
  const eraserRadius = 20; // Size of the eraser cursor

  // Update awareness users on change
  useEffect(() => {
    const updateUsers = () => {
      setAwarenessUsers(getAwarenessUsers(awareness));
    };

    awareness.on("change", updateUsers);
    updateUsers(); // Initial update

    return () => {
      awareness.off("change", updateUsers);
    };
  }, [awareness]);

  const updateCanvasViewport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || CANVAS_WIDTH;
    const height = rect.height || CANVAS_HEIGHT;
    const scaleX = canvas.width ? rect.width / canvas.width : 1;
    const scaleY = canvas.height ? rect.height / canvas.height : 1;

    const nextMetrics = {
      left: rect.left,
      top: rect.top,
      width,
      height,
      scaleX: scaleX || 1,
      scaleY: scaleY || 1,
    };

    canvasMetricsRef.current = nextMetrics;
    setCanvasMetrics(nextMetrics);
  }, []);

  useEffect(() => {
    updateCanvasViewport();

    window.addEventListener("resize", updateCanvasViewport);
    window.addEventListener("scroll", updateCanvasViewport, true);

    const canvas = canvasRef.current;
    const resizeObserver = canvas
      ? new ResizeObserver(updateCanvasViewport)
      : null;
    if (canvas && resizeObserver) {
      resizeObserver.observe(canvas);
    }

    return () => {
      window.removeEventListener("resize", updateCanvasViewport);
      window.removeEventListener("scroll", updateCanvasViewport, true);
      if (resizeObserver && canvas) {
        resizeObserver.unobserve(canvas);
        resizeObserver.disconnect();
      }
    };
  }, [updateCanvasViewport]);

  useEffect(() => {
    updateCanvasViewport();
  }, [updateCanvasViewport, zoom]);

  // Convert screen coordinates to canvas coordinates
  const getCanvasPoint = useCallback(
    (e: MouseEvent | React.MouseEvent | Touch): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const { scaleX, scaleY } = canvasMetricsRef.current;
      const effectiveScaleX = scaleX || 1;
      const effectiveScaleY = scaleY || 1;

      return {
        x: (e.clientX - rect.left) / effectiveScaleX,
        y: (e.clientY - rect.top) / effectiveScaleY,
      };
    },
    [],
  );

  // Commit the current ghost shape to the CRDT
  const commitShape = useCallback(() => {
    if (!ghostShape) return;

    // Validate shape before committing
    if (ghostShape.type === "path" && ghostShape.points.length < 3) {
      // Too small, discard
      setGhostShape(null);
      return;
    }

    // For shapes that are too small, use default sizes
    let shapeToCommit = ghostShape;

    if (ghostShape.type === "rect") {
      const width = Math.abs(ghostShape.width);
      const height = Math.abs(ghostShape.height);

      // If too small, create a default-sized rectangle
      if (width < 5 || height < 5) {
        const defaultSize = 60;
        shapeToCommit = {
          ...ghostShape,
          width: defaultSize,
          height: defaultSize,
        };
      }
    }

    if (ghostShape.type === "circle" && ghostShape.radius < 5) {
      // Create a default-sized circle
      shapeToCommit = {
        ...ghostShape,
        radius: 30,
      };
    }

    // Commit to CRDT (persisted layer)
    if (!proxy.shapes) {
      proxy.shapes = [];
    }

    proxy.shapes.push(shapeToCommit as Shape);
    trackOperation(proxy, 1);

    // Clear ghost
    setGhostShape(null);
  }, [ghostShape, proxy]);

  // Check if a point is inside a shape
  const isPointInShape = useCallback(
    (point: Point, shape: Readonly<Shape>): boolean => {
      if (shape.type === "rect") {
        const x1 = Math.min(shape.x, shape.x + shape.width);
        const x2 = Math.max(shape.x, shape.x + shape.width);
        const y1 = Math.min(shape.y, shape.y + shape.height);
        const y2 = Math.max(shape.y, shape.y + shape.height);
        return point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2;
      } else if (shape.type === "circle") {
        const dx = point.x - shape.x;
        const dy = point.y - shape.y;
        return Math.sqrt(dx * dx + dy * dy) <= shape.radius;
      } else if (shape.type === "path" && shape.points.length > 0) {
        // Simple bounding box check for paths
        const xs = shape.points.map((p) => p.x);
        const ys = shape.points.map((p) => p.y);
        const minX = Math.min(...xs) - 10;
        const maxX = Math.max(...xs) + 10;
        const minY = Math.min(...ys) - 10;
        const maxY = Math.max(...ys) + 10;
        return (
          point.x >= minX &&
          point.x <= maxX &&
          point.y >= minY &&
          point.y <= maxY
        );
      }
      return false;
    },
    [],
  );

  // Check if a shape intersects with a circle (for eraser)
  const shapeIntersectsCircle = useCallback(
    (shape: Readonly<Shape>, center: Point, radius: number): boolean => {
      if (shape.type === "rect") {
        // Check if rectangle intersects with circle
        const x1 = Math.min(shape.x, shape.x + shape.width);
        const x2 = Math.max(shape.x, shape.x + shape.width);
        const y1 = Math.min(shape.y, shape.y + shape.height);
        const y2 = Math.max(shape.y, shape.y + shape.height);

        // Find closest point on rectangle to circle center
        const closestX = Math.max(x1, Math.min(center.x, x2));
        const closestY = Math.max(y1, Math.min(center.y, y2));

        // Check distance to closest point
        const dx = center.x - closestX;
        const dy = center.y - closestY;
        return dx * dx + dy * dy <= radius * radius;
      } else if (shape.type === "circle") {
        // Check if circles overlap
        const dx = center.x - shape.x;
        const dy = center.y - shape.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= radius + shape.radius;
      } else if (shape.type === "path" && shape.points.length > 0) {
        // Check if any point in the path is within the eraser circle
        return shape.points.some((point) => {
          const dx = center.x - point.x;
          const dy = center.y - point.y;
          return Math.sqrt(dx * dx + dy * dy) <= radius;
        });
      }
      return false;
    },
    [],
  );

  // Handle mouse down - start drawing
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const point = getCanvasPoint(e.nativeEvent);

      // Handle select tool
      if (tool === "select") {
        // Check if clicking on a shape (iterate in reverse to check top shapes first)
        const shapes = snap.shapes || [];
        let foundShape: Readonly<Shape> | undefined;

        for (let i = shapes.length - 1; i >= 0; i--) {
          if (isPointInShape(point, shapes[i])) {
            foundShape = shapes[i] as Readonly<Shape>;
            break;
          }
        }

        if (foundShape) {
          onShapeSelect?.(foundShape.id);

          // Start dragging if clicking on a shape
          setIsDragging(true);

          // Calculate drag offset based on shape type
          if (foundShape.type === "rect") {
            setDragOffset({
              x: point.x - foundShape.x,
              y: point.y - foundShape.y,
            });
          } else if (foundShape.type === "circle") {
            setDragOffset({
              x: point.x - foundShape.x,
              y: point.y - foundShape.y,
            });
          } else if (
            foundShape.type === "path" &&
            foundShape.points.length > 0
          ) {
            // For paths, use the first point as reference
            setDragOffset({
              x: point.x - foundShape.points[0].x,
              y: point.y - foundShape.points[0].y,
            });
          }
        } else {
          onShapeSelect?.(undefined);
        }
        return;
      }

      // Handle eraser tool - start erasing mode
      if (tool === "eraser") {
        setIsDrawing(true);

        // Delete any shapes under the eraser immediately
        if (proxy.shapes) {
          for (let i = proxy.shapes.length - 1; i >= 0; i--) {
            const shape = proxy.shapes[i];
            // Check if shape intersects with eraser circle
            if (shapeIntersectsCircle(shape, point, eraserRadius)) {
              proxy.shapes.splice(i, 1);
            }
          }
        }
        return;
      }

      setIsDrawing(true);

      const shapeId = `${userId}-${Date.now()}`;
      const timestamp = Date.now();

      if (tool === "pen") {
        // Start a new path in the ghost layer
        setGhostShape({
          id: shapeId,
          type: "path",
          points: [point],
          style: { color, strokeWidth },
          timestamp,
        });
      } else if (tool === "rect") {
        setGhostShape({
          id: shapeId,
          type: "rect",
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
          style: {
            color,
            strokeWidth,
            ...(fillEnabled && { fillColor: color }),
          },
          timestamp,
        });
      } else if (tool === "circle") {
        setGhostShape({
          id: shapeId,
          type: "circle",
          x: point.x,
          y: point.y,
          radius: 0,
          style: {
            color,
            strokeWidth,
            ...(fillEnabled && { fillColor: color }),
          },
          timestamp,
        });
      }

      // Start 200ms auto-commit timer for pen strokes
      if (tool === "pen") {
        commitTimerRef.current = setInterval(() => {
          // Commit current ghost if it has enough points
          if (
            ghostShape &&
            ghostShape.type === "path" &&
            ghostShape.points.length >= 10
          ) {
            commitShape();
          }
        }, 200) as unknown as number;
      }
    },
    [
      tool,
      color,
      strokeWidth,
      fillEnabled,
      userId,
      getCanvasPoint,
      ghostShape,
      commitShape,
      snap.shapes,
      isPointInShape,
      onShapeSelect,
      proxy,
      eraserRadius,
      shapeIntersectsCircle,
    ],
  );

  // Handle mouse move - continue drawing or dragging
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const point = getCanvasPoint(e.nativeEvent);

      // Update cursor position in awareness (ephemeral)
      const currentState = awareness.getLocalState();
      const canvas = canvasRef.current;
      if (currentState && canvas) {
        const normalizedX = clamp(point.x / canvas.width, 0, 1);
        const normalizedY = clamp(point.y / canvas.height, 0, 1);

        awareness.setLocalStateField("cursor", {
          x: point.x,
          y: point.y,
          normalizedX,
          normalizedY,
        } satisfies CursorState);
      }

      // Track eraser position for rendering
      if (tool === "eraser") {
        // Track screen position for icon rendering
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          setEraserScreenPos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }

        // If actively erasing, delete shapes under the eraser
        if (isDrawing && proxy.shapes) {
          for (let i = proxy.shapes.length - 1; i >= 0; i--) {
            const shape = proxy.shapes[i];
            if (shapeIntersectsCircle(shape, point, eraserRadius)) {
              proxy.shapes.splice(i, 1);
            }
          }
        }
        return;
      } else {
        // Clear eraser position when not using eraser
        setEraserScreenPos(null);
      }

      // Handle dragging selected shape
      if (isDragging && tool === "select" && selectedShapeId && proxy.shapes) {
        const shapeIndex = proxy.shapes.findIndex(
          (s) => s.id === selectedShapeId,
        );
        if (shapeIndex !== -1) {
          const shape = proxy.shapes[shapeIndex];

          if (shape.type === "rect") {
            const newX = point.x - dragOffset.x;
            const newY = point.y - dragOffset.y;
            proxy.shapes[shapeIndex] = { ...shape, x: newX, y: newY };
          } else if (shape.type === "circle") {
            const newX = point.x - dragOffset.x;
            const newY = point.y - dragOffset.y;
            proxy.shapes[shapeIndex] = { ...shape, x: newX, y: newY };
          } else if (shape.type === "path") {
            // Calculate delta from original first point
            const firstPoint = shape.points[0];
            const targetX = point.x - dragOffset.x;
            const targetY = point.y - dragOffset.y;
            const deltaX = targetX - firstPoint.x;
            const deltaY = targetY - firstPoint.y;

            // Move all points
            const movedPoints = shape.points.map((p) => ({
              x: p.x + deltaX,
              y: p.y + deltaY,
            }));

            proxy.shapes[shapeIndex] = { ...shape, points: movedPoints };
          }
        }
        return;
      }

      if (!isDrawing || !ghostShape) return;

      if (tool === "pen" && ghostShape.type === "path") {
        // Add point to ghost layer
        setGhostShape({
          ...ghostShape,
          points: [...ghostShape.points, point],
        });
      } else if (tool === "rect" && ghostShape.type === "rect") {
        // Update rect dimensions in ghost layer
        setGhostShape({
          ...ghostShape,
          width: point.x - ghostShape.x,
          height: point.y - ghostShape.y,
        });
      } else if (tool === "circle" && ghostShape.type === "circle") {
        // Update circle radius in ghost layer
        const dx = point.x - ghostShape.x;
        const dy = point.y - ghostShape.y;
        setGhostShape({
          ...ghostShape,
          radius: Math.sqrt(dx * dx + dy * dy),
        });
      }
    },
    [
      isDrawing,
      ghostShape,
      tool,
      getCanvasPoint,
      isDragging,
      selectedShapeId,
      dragOffset,
      proxy,
      awareness,
      eraserRadius,
      shapeIntersectsCircle,
    ],
  );

  // Handle mouse up - finish drawing or dragging
  const handlePointerUp = useCallback(() => {
    // Stop dragging
    if (isDragging) {
      setIsDragging(false);
      return;
    }

    if (!isDrawing) return;

    // Clear auto-commit timer
    if (commitTimerRef.current) {
      clearInterval(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    // Commit final shape
    commitShape();

    setIsDrawing(false);
  }, [isDrawing, commitShape, isDragging]);

  // Render the canvas (two-layer architecture)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Layer 1: Committed shapes (from CRDT)
    snap.shapes?.forEach((shape) => {
      renderShape(ctx, shape);

      // Draw selection indicator if this shape is selected
      if (selectedShapeId && shape.id === selectedShapeId) {
        ctx.save();
        ctx.strokeStyle = "#3B82F6";
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);

        if (shape.type === "rect") {
          const padding = 5;
          const x1 = Math.min(shape.x, shape.x + shape.width) - padding;
          const y1 = Math.min(shape.y, shape.y + shape.height) - padding;
          const w = Math.abs(shape.width) + padding * 2;
          const h = Math.abs(shape.height) + padding * 2;
          ctx.strokeRect(x1, y1, w, h);
        } else if (shape.type === "circle") {
          ctx.beginPath();
          ctx.arc(shape.x, shape.y, shape.radius + 5, 0, Math.PI * 2);
          ctx.stroke();
        } else if (shape.type === "path" && shape.points.length > 0) {
          const xs = shape.points.map((p) => p.x);
          const ys = shape.points.map((p) => p.y);
          const minX = Math.min(...xs) - 10;
          const maxX = Math.max(...xs) + 10;
          const minY = Math.min(...ys) - 10;
          const maxY = Math.max(...ys) + 10;
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        }

        ctx.restore();
      }
    });

    // Layer 2: Ghost shape (in-progress, ephemeral)
    if (ghostShape) {
      ctx.save();
      ctx.globalAlpha = 0.7; // Slightly transparent to indicate it's uncommitted
      renderShape(ctx, ghostShape);
      ctx.restore();
    }
  }, [snap.shapes, ghostShape, selectedShapeId]);

  const hasShapes = snap.shapes && snap.shapes.length > 0;

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={`border border-gray-300 rounded-lg bg-white touch-none ${
          tool === "select"
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : tool === "eraser"
              ? "cursor-none"
              : "cursor-crosshair"
        }`}
        style={{
          backgroundImage: hasShapes
            ? "none"
            : "radial-gradient(circle, #e5e7eb 1px, transparent 1px)",
          backgroundSize: hasShapes ? "0" : "20px 20px",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Empty State Overlay */}
      {!hasShapes && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
          <div className="text-center max-w-2xl space-y-8">
            {/* Header */}
            <div className="space-y-3">
              <h3 className="text-4xl font-bold text-gray-900">
                Collaborative Whiteboard Demo
              </h3>
              <p className="text-base text-gray-600">
                Powered by{" "}
                <strong className="font-semibold text-blue-600">
                  valtio-y
                </strong>
                , Yjs, and CRDTs
              </p>
            </div>

            {/* Main Message */}
            <div className="space-y-4">
              <p className="text-gray-700 leading-relaxed">
                This is a public demo showcasing real-time collaboration.
                <br />
                The canvas resets every 30 minutes. Please keep it nice!
              </p>

              <p className="text-sm text-gray-600">
                👥 Open this page in two browser windows to see real-time sync
                in action!
              </p>
            </div>

            {/* Tools */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Quick Start
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-200">
                  <p className="font-bold text-gray-900 mb-1">Pen (P)</p>
                  <p className="text-gray-600 text-xs">Click & drag to draw</p>
                </div>
                <div className="bg-white/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-200">
                  <p className="font-bold text-gray-900 mb-1">Rectangle (R)</p>
                  <p className="text-gray-600 text-xs">
                    Click to place, drag to size
                  </p>
                </div>
                <div className="bg-white/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-200">
                  <p className="font-bold text-gray-900 mb-1">Circle (C)</p>
                  <p className="text-gray-600 text-xs">
                    Click to place, drag to size
                  </p>
                </div>
              </div>
            </div>

            {/* Tip */}
            <div className="inline-block">
              <p className="text-sm text-gray-600">
                💡 <strong className="font-semibold">Pro tip:</strong> Use the
                URL hash to create your own private room (e.g.,{" "}
                <code className="bg-gray-200/70 px-2 py-1 rounded text-xs font-mono">
                  #my-room
                </code>
                )
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Eraser Icon Cursor */}
      {eraserScreenPos && tool === "eraser" && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: eraserScreenPos.x,
            top: eraserScreenPos.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="relative">
            <Eraser className="w-6 h-6 text-gray-800" strokeWidth={2} />
            {/* Eraser range indicator circle */}
            <div
              className="absolute top-1/2 left-1/2 border-2 border-gray-400 rounded-full opacity-40"
              style={{
                width: eraserRadius * 2,
                height: eraserRadius * 2,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
        </div>
      )}

      {/* Other users' cursors - render in viewport space for perfect alignment */}
      {awarenessUsers.map((user) => {
        const cursor = user.cursor;
        if (!cursor) return null;

        const canvas = canvasRef.current;
        if (!canvas) return null;

        const baseX =
          typeof cursor.x === "number"
            ? cursor.x
            : clamp(cursor.normalizedX ?? 0, 0, 1) * (canvas.width || CANVAS_WIDTH);
        const baseY =
          typeof cursor.y === "number"
            ? cursor.y
            : clamp(cursor.normalizedY ?? 0, 0, 1) * (canvas.height || CANVAS_HEIGHT);

        return (
          <Cursor
            key={user.id}
            x={baseX}
            y={baseY}
            color={user.color}
            name={user.name}
            scaleX={canvasMetrics.scaleX}
            scaleY={canvasMetrics.scaleY}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// RENDERING HELPERS
// ============================================================================

function renderShape(ctx: CanvasRenderingContext2D, shape: any) {
  ctx.save();

  if (shape.type === "path") {
    renderPath(ctx, shape);
  } else if (shape.type === "rect") {
    renderRect(ctx, shape);
  } else if (shape.type === "circle") {
    renderCircle(ctx, shape);
  }

  ctx.restore();
}

function renderPath(ctx: CanvasRenderingContext2D, shape: any) {
  if (shape.points.length < 2) return;

  // Use perfect-freehand to get a smooth stroke
  const stroke = getStroke([...shape.points] as Point[], {
    size: shape.style.strokeWidth * 2,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  });

  // Draw the stroke
  ctx.fillStyle = shape.style.color;
  ctx.beginPath();

  if (stroke.length > 0) {
    ctx.moveTo(stroke[0][0], stroke[0][1]);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i][0], stroke[i][1]);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function renderRect(ctx: CanvasRenderingContext2D, shape: any) {
  ctx.strokeStyle = shape.style.color;
  ctx.lineWidth = shape.style.strokeWidth;

  if (shape.style.fillColor) {
    ctx.fillStyle = shape.style.fillColor;
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
  }

  ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
}

function renderCircle(ctx: CanvasRenderingContext2D, shape: any) {
  ctx.strokeStyle = shape.style.color;
  ctx.lineWidth = shape.style.strokeWidth;

  ctx.beginPath();
  ctx.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);

  if (shape.style.fillColor) {
    ctx.fillStyle = shape.style.fillColor;
    ctx.fill();
  }

  ctx.stroke();
}

// Type definitions for ghost shapes
type RectShape = {
  id: string;
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  style: { color: string; strokeWidth: number; fillColor?: string };
  timestamp: number;
};

type CircleShape = {
  id: string;
  type: "circle";
  x: number;
  y: number;
  radius: number;
  style: { color: string; strokeWidth: number; fillColor?: string };
  timestamp: number;
};
