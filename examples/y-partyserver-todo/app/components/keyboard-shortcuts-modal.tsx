/**
 * Keyboard Shortcuts Modal
 *
 * Displays a modal with all available keyboard shortcuts
 * Toggled by pressing "?" or "Shift+/"
 */

import { X } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: "Tools",
      items: [
        { keys: ["V"], description: "Select tool" },
        { keys: ["P"], description: "Pen tool" },
        { keys: ["R"], description: "Rectangle tool" },
        { keys: ["C"], description: "Circle tool" },
        { keys: ["E"], description: "Eraser tool" },
      ],
    },
    {
      category: "Actions",
      items: [
        { keys: ["Ctrl", "Z"], description: "Undo" },
        { keys: ["Ctrl", "Y"], description: "Redo" },
        { keys: ["Ctrl", "Shift", "Z"], description: "Redo (alt)" },
      ],
    },
    {
      category: "Help",
      items: [{ keys: ["?"], description: "Show keyboard shortcuts" }],
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50"
                  >
                    <span className="text-gray-700">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center">
                          <kbd className="px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-md text-sm font-mono font-semibold text-gray-800 shadow-sm">
                            {key}
                          </kbd>
                          {keyIndex < item.keys.length - 1 && (
                            <span className="mx-1 text-gray-400">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          <p className="text-sm text-gray-600 text-center">
            Press <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">?</kbd> anytime to toggle this help dialog
          </p>
        </div>
      </div>
    </div>
  );
}
