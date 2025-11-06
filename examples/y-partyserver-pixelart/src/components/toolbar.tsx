/**
 * Toolbar Component
 *
 * Displays tools for drawing: Pencil, Eraser, Color Picker
 */

import { useSnapshot } from "valtio";
import { Pencil, Eraser, Pipette } from "lucide-react";
import { uiState } from "../yjs-setup";
import type { Tool } from "../types";

export function Toolbar() {
  const snap = useSnapshot(uiState);

  const tools: Array<{
    id: Tool;
    name: string;
    icon: React.ReactNode;
    description: string;
  }> = [
    {
      id: "pencil",
      name: "Pencil",
      icon: <Pencil className="w-5 h-5" />,
      description: "Draw pixels",
    },
    {
      id: "eraser",
      name: "Eraser",
      icon: <Eraser className="w-5 h-5" />,
      description: "Erase pixels",
    },
    {
      id: "picker",
      name: "Color Picker",
      icon: <Pipette className="w-5 h-5" />,
      description: "Pick color from pixel",
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Tools</h3>

      <div className="flex flex-col gap-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => (uiState.selectedTool = tool.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              snap.selectedTool === tool.id
                ? "bg-blue-500 text-white shadow-md"
                : "bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
            title={tool.description}
          >
            {tool.icon}
            <div className="text-left flex-1">
              <div className="text-sm font-medium">{tool.name}</div>
              <div
                className={`text-xs ${
                  snap.selectedTool === tool.id
                    ? "text-blue-100"
                    : "text-slate-500"
                }`}
              >
                {tool.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
