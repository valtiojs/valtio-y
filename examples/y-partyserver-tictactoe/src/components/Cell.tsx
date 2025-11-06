/**
 * Individual cell component for the Tic-Tac-Toe board
 */

import type { CellValue } from "../types";

interface CellProps {
  value: CellValue;
  index: number;
  onClick: () => void;
  isWinningCell?: boolean;
}

export function Cell({ value, onClick, isWinningCell }: CellProps) {
  return (
    <button
      onClick={onClick}
      className={`
        aspect-square flex items-center justify-center
        text-6xl font-bold rounded-lg
        transition-all duration-200 ease-in-out
        hover:scale-105 active:scale-95
        ${
          isWinningCell
            ? "bg-green-500 text-white shadow-lg shadow-green-500/50"
            : "bg-gray-700 hover:bg-gray-600"
        }
        ${!value && "cursor-pointer"}
        ${value && "cursor-default"}
      `}
      disabled={!!value}
    >
      {value && (
        <span
          className={`
            ${value === "X" ? "text-blue-400" : "text-pink-400"}
            ${isWinningCell ? "text-white" : ""}
            animate-in fade-in zoom-in duration-200
          `}
        >
          {value}
        </span>
      )}
    </button>
  );
}
