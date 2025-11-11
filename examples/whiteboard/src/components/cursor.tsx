import { motion } from "motion/react";
import { MousePointer2 } from "lucide-react";

interface CursorProps {
  x: number;
  y: number;
  color: string;
  name: string;
  position?: "absolute" | "fixed";
}

export function Cursor({
  x,
  y,
  color,
  name,
  position = "absolute",
}: CursorProps) {
  return (
    <motion.div
      className={`${position} pointer-events-none z-[9999]`}
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
    </motion.div>
  );
}
