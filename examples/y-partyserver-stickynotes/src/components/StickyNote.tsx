import { useRef, useState, useEffect } from "react";
import { GripVertical } from "lucide-react";
import type { StickyNote as StickyNoteType } from "../types";

interface StickyNoteProps {
  note: StickyNoteType;
  isSelected: boolean;
  isEditedByOther: boolean;
  otherUserColor?: string;
  onSelect: () => void;
  onUpdate: (updates: Partial<StickyNoteType>) => void;
  onStartDrag: () => void;
  onStartResize: () => void;
}

export function StickyNote({
  note,
  isSelected,
  isEditedByOther,
  otherUserColor,
  onSelect,
  onUpdate,
  onStartDrag,
  onStartResize,
}: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditedByOther) {
      setIsEditing(true);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ text: e.target.value });
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if (isEditing) return;

    e.stopPropagation();
    onSelect();
    onStartDrag();

    const startX = e.clientX;
    const startY = e.clientY;
    const startNoteX = note.x;
    const startNoteY = note.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      onUpdate({
        x: Math.max(0, startNoteX + deltaX),
        y: Math.max(0, startNoteY + deltaY),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    onStartResize();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = note.width;
    const startHeight = note.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      onUpdate({
        width: Math.max(150, startWidth + deltaX),
        height: Math.max(100, startHeight + deltaY),
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className={`absolute rounded-lg shadow-lg transition-all cursor-move select-none ${
        isSelected ? "ring-2 ring-indigo-600 ring-offset-2 shadow-xl" : "hover:shadow-xl"
      } ${isEditedByOther ? "ring-2 ring-offset-2" : ""}`}
      style={{
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.height,
        backgroundColor: note.color,
        zIndex: note.z,
        borderColor: isEditedByOther ? otherUserColor : undefined,
      }}
      onMouseDown={handleMouseDown}
      onClick={onSelect}
    >
      {/* Drag Handle */}
      <div className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors">
        <GripVertical size={20} />
      </div>

      {/* Editing indicator */}
      {isEditedByOther && (
        <div
          className="absolute -top-2 -left-2 w-4 h-4 rounded-full animate-pulse"
          style={{ backgroundColor: otherUserColor }}
          title="Another user is editing this note"
        />
      )}

      {/* Content */}
      <div
        className="w-full h-full p-4 overflow-hidden"
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={note.text}
            onChange={handleTextChange}
            onBlur={handleBlur}
            className="w-full h-full bg-transparent border-none outline-none resize-none font-sans text-sm text-gray-800 leading-relaxed"
            style={{ backgroundColor: note.color }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="w-full h-full font-sans text-sm text-gray-800 leading-relaxed whitespace-pre-wrap overflow-auto">
            {note.text}
          </div>
        )}
      </div>

      {/* Resize Handle */}
      {isSelected && !isEditing && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-gray-400 rounded-br" />
        </div>
      )}
    </div>
  );
}
