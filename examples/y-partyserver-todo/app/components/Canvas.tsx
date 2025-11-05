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
import {
  proxy,
  trackOperation,
  updateCursor,
  getAwareness,
  getAwarenessUsers,
} from "../yjs-setup";
import type { Point, Tool, Shape, PathShape } from "../types";

interface CanvasProps {
  tool: Tool;
  color: string;
  strokeWidth: number;
  userId: string;
  fillEnabled: boolean;
}

// Type for ghost shape (in-progress drawing)
type GhostShape = PathShape | RectShape | CircleShape;

export function Canvas({
  tool,
  color,
  strokeWidth,
  userId,
  fillEnabled,
}: CanvasProps) {
  const snap = useSnapshot(proxy);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ghostShape, setGhostShape] = useState<GhostShape | null>(null);
  const [awarenessUsers, setAwarenessUsers] = useState<any[]>([]);
  const commitTimerRef = useRef<number | null>(null);

  // Update awareness users on change
  useEffect(() => {
    const awareness = getAwareness();

    const updateUsers = () => {
      setAwarenessUsers(getAwarenessUsers());
    };

    awareness.on("change", updateUsers);
    updateUsers(); // Initial update

    return () => {
      awareness.off("change", updateUsers);
    };
  }, []);

  // Convert screen coordinates to canvas coordinates
  const getCanvasPoint = useCallback(
    (e: MouseEvent | React.MouseEvent | Touch): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
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

    if (ghostShape.type === "rect") {
      const hasSize =
        Math.abs(ghostShape.width) > 5 && Math.abs(ghostShape.height) > 5;
      if (!hasSize) {
        setGhostShape(null);
        return;
      }
    }

    if (ghostShape.type === "circle" && ghostShape.radius < 5) {
      setGhostShape(null);
      return;
    }

    // Commit to CRDT (persisted layer)
    if (!proxy.shapes) {
      proxy.shapes = [];
    }

    proxy.shapes.push(ghostShape as Shape);
    trackOperation(1);

    // Clear ghost
    setGhostShape(null);
  }, [ghostShape]);

  // Handle mouse down - start drawing
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool === "select" || tool === "eraser") return;

      const point = getCanvasPoint(e.nativeEvent);
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
            fillColor: fillEnabled ? color : undefined,
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
            fillColor: fillEnabled ? color : undefined,
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
        }, 200);
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
    ],
  );

  // Handle mouse move - continue drawing
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const point = getCanvasPoint(e.nativeEvent);

      // Update cursor position in awareness (ephemeral)
      updateCursor(point.x, point.y);

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
    [isDrawing, ghostShape, tool, getCanvasPoint],
  );

  // Handle mouse up - finish drawing
  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return;

    // Clear auto-commit timer
    if (commitTimerRef.current) {
      clearInterval(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    // Commit final shape
    commitShape();

    setIsDrawing(false);
  }, [isDrawing, commitShape]);

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
    });

    // Layer 2: Ghost shape (in-progress, ephemeral)
    if (ghostShape) {
      ctx.save();
      ctx.globalAlpha = 0.7; // Slightly transparent to indicate it's uncommitted
      renderShape(ctx, ghostShape);
      ctx.restore();
    }

    // Layer 3: Cursors from awareness (ephemeral)
    awarenessUsers.forEach((user) => {
      if (user.cursor) {
        renderCursor(ctx, user.cursor, user.color, user.name);
      }
    });
  }, [snap.shapes, ghostShape, awarenessUsers]);

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={800}
      className="border border-gray-300 rounded-lg bg-white cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
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

function renderCursor(
  ctx: CanvasRenderingContext2D,
  point: Point,
  color: string,
  name: string,
) {
  // Draw cursor circle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Draw name label
  ctx.fillStyle = color;
  ctx.font = "12px sans-serif";
  ctx.fillText(name, point.x + 10, point.y - 10);
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
