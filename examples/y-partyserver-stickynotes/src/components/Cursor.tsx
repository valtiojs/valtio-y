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
        size={20}
        style={{ color }}
        className="drop-shadow-md"
        fill={color}
        strokeWidth={2}
      />
      <div
        className="mt-1 ml-2 px-2.5 py-1 rounded-full text-white text-xs font-semibold whitespace-nowrap shadow-lg opacity-90"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  );
}
