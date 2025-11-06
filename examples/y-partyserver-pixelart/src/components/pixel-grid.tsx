/**
 * Pixel Grid Component
 *
 * Displays a grid of pixels that can be colored by clicking or dragging.
 * Syncs changes in real-time via valtio-y.
 */

import { useSnapshot } from "valtio";
import { proxy, uiState, awareness } from "../yjs-setup";
import { useEffect, useState } from "react";

interface PixelGridProps {
  gridSize?: number;
  pixelSize?: number;
}

export function PixelGrid({
  gridSize = 32,
  pixelSize = 16,
}: PixelGridProps) {
  const snap = useSnapshot(proxy);
  const uiSnap = useSnapshot(uiState);
  const [cursors, setCursors] = useState<
    Map<number, { x: number; y: number; user: any }>
  >(new Map());

  // Listen to awareness changes for other users' cursors
  useEffect(() => {
    const updateCursors = () => {
      const states = awareness.getStates();
      const newCursors = new Map();

      states.forEach((state, clientId) => {
        if (clientId !== awareness.clientID && state.cursor) {
          newCursors.set(clientId, {
            x: state.cursor.x,
            y: state.cursor.y,
            user: state.user,
          });
        }
      });

      setCursors(newCursors);
    };

    awareness.on("change", updateCursors);
    updateCursors();

    return () => {
      awareness.off("change", updateCursors);
    };
  }, []);

  const handlePixelAction = (row: number, col: number) => {
    if (!snap.grid?.pixels) return;

    const { selectedTool, selectedColor } = uiSnap;

    switch (selectedTool) {
      case "pencil":
        // Draw with selected color
        proxy.grid.pixels[row][col] = selectedColor;
        break;
      case "eraser":
        // Erase (set to null/transparent)
        proxy.grid.pixels[row][col] = null;
        break;
      case "picker":
        // Pick color from pixel
        const pickedColor = snap.grid.pixels[row][col];
        if (pickedColor) {
          uiState.selectedColor = pickedColor;
        }
        break;
    }
  };

  const handleMouseDown = (row: number, col: number) => {
    uiState.isDrawing = true;
    handlePixelAction(row, col);
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (uiSnap.isDrawing) {
      handlePixelAction(row, col);
    }

    // Update cursor position in awareness
    awareness.setLocalStateField("cursor", { x: col, y: row });
  };

  const handleMouseUp = () => {
    uiState.isDrawing = false;
  };

  const handleMouseLeave = () => {
    // Clear cursor position when leaving grid
    awareness.setLocalStateField("cursor", null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      uiState.isDrawing = false;
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  if (!snap.grid?.pixels) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-100 rounded-lg">
        <p className="text-slate-500">Loading grid...</p>
      </div>
    );
  }

  const getCursorStyle = (tool: string) => {
    switch (tool) {
      case "pencil":
        return "cursor-crosshair";
      case "eraser":
        return "cursor-not-allowed";
      case "picker":
        return "cursor-pointer";
      default:
        return "cursor-default";
    }
  };

  return (
    <div className="relative inline-block">
      {/* Grid */}
      <div
        className={`grid bg-white border-2 border-slate-300 shadow-lg ${getCursorStyle(uiSnap.selectedTool)}`}
        style={{
          gridTemplateColumns: `repeat(${gridSize}, ${pixelSize}px)`,
          gridTemplateRows: `repeat(${gridSize}, ${pixelSize}px)`,
        }}
        onMouseLeave={handleMouseLeave}
      >
        {snap.grid.pixels.map((row, rowIndex) =>
          row.map((color, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="border border-slate-200 hover:border-slate-400 transition-colors"
              style={{
                backgroundColor: color || "#ffffff",
                width: `${pixelSize}px`,
                height: `${pixelSize}px`,
              }}
              onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
              onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
              onMouseUp={handleMouseUp}
            />
          ))
        )}
      </div>

      {/* Other users' cursors */}
      {Array.from(cursors.entries()).map(([clientId, cursor]) => (
        <div
          key={clientId}
          className="absolute pointer-events-none"
          style={{
            left: `${cursor.x * pixelSize}px`,
            top: `${cursor.y * pixelSize}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="w-3 h-3 rounded-full border-2 border-white shadow-lg"
            style={{ backgroundColor: cursor.user?.color || "#999" }}
          />
          <div
            className="text-xs font-medium mt-1 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap"
            style={{
              backgroundColor: cursor.user?.color || "#999",
              color: "white",
            }}
          >
            {cursor.user?.name || "Anonymous"}
          </div>
        </div>
      ))}
    </div>
  );
}
