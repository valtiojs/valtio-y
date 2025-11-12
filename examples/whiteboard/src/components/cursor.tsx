import { motion } from "motion/react";
import { MousePointer2 } from "lucide-react";

interface CursorProps {
  x: number;
  y: number;
  color: string;
  name: string;
  scaleX?: number;
  scaleY?: number;
}

export function Cursor({
  x,
  y,
  color,
  name,
  scaleX = 1,
  scaleY = 1,
}: CursorProps) {
  const inverseScaleX = scaleX !== 0 ? 1 / scaleX : 1;
  const inverseScaleY = scaleY !== 0 ? 1 / scaleY : 1;

  return (
    <motion.div
      className="absolute pointer-events-none z-[9999]"
      style={{ left: 0, top: 0 }}
      animate={{
        x: x - 2,
        y: y - 2,
      }}
      transition={{
        type: "spring",
        damping: 30,
        stiffness: 300,
        mass: 0.5,
      }}
    >
      <div
        style={{
          transform: `scale(${inverseScaleX}, ${inverseScaleY})`,
          transformOrigin: "top left",
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
    </motion.div>
  );
}
