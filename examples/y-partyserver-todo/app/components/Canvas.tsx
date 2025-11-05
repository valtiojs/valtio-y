/**
 * Canvas Component - The main drawing surface
 *
 * Handles:
 * - Drawing with different tools (pen, rect, circle)
 * - Rendering all shapes
 * - Mouse/touch interaction
 * - Multiplayer cursor tracking
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useSnapshot } from "valtio";
import getStroke from "perfect-freehand";
import { proxy, trackOperation } from "../yjs-setup";
import type { Point, Tool, Shape, PathShape } from "../types";

interface CanvasProps {
  tool: Tool;
  color: string;
  strokeWidth: number;
  userId: string;
  fillEnabled: boolean;
}

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
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);

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
    []
  );

  // Handle mouse down - start drawing
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (tool === "select" || tool === "eraser") return;

      const point = getCanvasPoint(e.nativeEvent);
      setIsDrawing(true);
      setCurrentPoints([point]);

      const shapeId = `${userId}-${Date.now()}`;
      const timestamp = Date.now();

      if (tool === "pen") {
        const newShape: PathShape = {
          id: shapeId,
          type: "path",
          points: [point],
          style: { color, strokeWidth },
          timestamp,
        };
        setCurrentShape(newShape);
      } else if (tool === "rect" || tool === "circle") {
        setCurrentShape({
          id: shapeId,
          type: tool,
          x: point.x,
          y: point.y,
          ...(tool === "rect" ? { width: 0, height: 0 } : { radius: 0 }),
          style: {
            color,
            strokeWidth,
            fillColor: fillEnabled ? color : undefined,
          },
          timestamp,
        } as Shape);
      }
    },
    [tool, color, strokeWidth, fillEnabled, userId, getCanvasPoint]
  );

  // Handle mouse move - continue drawing
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Update cursor position for multiplayer
      const point = getCanvasPoint(e.nativeEvent);
      if (proxy.users?.[userId]) {
        proxy.users[userId].cursor = point;
      }

      if (!isDrawing || !currentShape) return;

      const newPoint = point;

      if (tool === "pen" && currentShape.type === "path") {
        // For pen tool, accumulate points - this showcases BATCHING!
        const newPoints = [...currentPoints, newPoint];
        setCurrentPoints(newPoints);

        // Update the current shape for preview
        setCurrentShape({
          ...currentShape,
          points: newPoints,
        });

        // Track this as a batch operation
        trackOperation(1);
      } else if (tool === "rect" || tool === "circle") {
        // For shapes, update dimensions based on drag
        const startPoint = currentPoints[0];
        const dx = newPoint.x - startPoint.x;
        const dy = newPoint.y - startPoint.y;

        if (tool === "rect") {
          setCurrentShape({
            ...currentShape,
            width: dx,
            height: dy,
          } as Shape);
        } else if (tool === "circle") {
          const radius = Math.sqrt(dx * dx + dy * dy);
          setCurrentShape({
            ...currentShape,
            radius,
          } as Shape);
        }
      }
    },
    [
      isDrawing,
      currentShape,
      currentPoints,
      tool,
      userId,
      getCanvasPoint,
    ]
  );

  // Handle mouse up - finish drawing
  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !currentShape) return;

    // Only add the shape if it has meaningful content
    if (tool === "pen" && currentPoints.length > 2) {
      // Add the path shape with all accumulated points
      if (!proxy.shapes) {
        proxy.shapes = [];
      }
      proxy.shapes.push(currentShape as PathShape);

      // Track the final batch size
      trackOperation(currentPoints.length);
    } else if (
      (tool === "rect" || tool === "circle") &&
      currentPoints.length > 0
    ) {
      // Add rectangle or circle if it has size
      const hasSize =
        tool === "rect"
          ? Math.abs((currentShape as any).width) > 5 &&
            Math.abs((currentShape as any).height) > 5
          : (currentShape as any).radius > 5;

      if (hasSize) {
        if (!proxy.shapes) {
          proxy.shapes = [];
        }
        proxy.shapes.push(currentShape);
      }
    }

    setIsDrawing(false);
    setCurrentShape(null);
    setCurrentPoints([]);
  }, [isDrawing, currentShape, currentPoints, tool]);

  // Render the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render all shapes from state
    snap.shapes?.forEach((shape) => {
      renderShape(ctx, shape);
    });

    // Render current shape being drawn
    if (currentShape) {
      renderShape(ctx, currentShape);
    }

    // Render multiplayer cursors
    if (snap.users) {
      Object.values(snap.users).forEach((user) => {
        if (user.id !== userId && user.cursor) {
          renderCursor(ctx, user.cursor, user.color, user.name);
        }
      });
    }
  }, [snap.shapes, snap.users, currentShape, userId]);

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
  // Convert readonly points to mutable array for getStroke
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
  name: string
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
