import { MousePointer2 } from "lucide-react";

interface CursorProps {
  x: number;
  y: number;
  color: string;
  name: string;
}

export function Cursor({ x, y, color, name }: CursorProps) {
  return (
    <div
      className="absolute pointer-events-none transition-all duration-100 ease-out z-[9999]"
      style={{
        left: x,
        top: y,
        transform: "translate(-2px, -2px)",
      }}
    >
      <MousePointer2
        size={24}
        style={{ color }}
        className="drop-shadow-lg"
        fill={color}
      />
      <div
        className="mt-1 ml-1 px-2 py-1 rounded-md text-white text-xs font-medium whitespace-nowrap shadow-lg"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  );
}
