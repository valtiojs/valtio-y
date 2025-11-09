import { useRef, useState, useEffect } from "react";
import { motion, type PanInfo } from "motion/react";
import type { AppState, StickyNote as StickyNoteType } from "../types";

interface StickyNoteProps {
  note: StickyNoteType; // The snapshot value (already reactive from root useSnapshot)
  noteId: string; // The note ID for mutations
  isSelected: boolean;
  onSelect: () => void;
  stateProxy: AppState;
}

export function StickyNote({
  note,
  noteId,
  isSelected,
  onSelect,
  stateProxy,
}: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Note: We don't need useSnapshot here since 'note' is already a snapshot value
  // from the root useSnapshot(proxy, { sync: true }) call in App.tsx

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at the end
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    // Don't auto-edit if clicking on buttons or during drag
    if (e.target instanceof HTMLButtonElement || isDragging) {
      return;
    }

    e.stopPropagation();

    // Select the note and enter edit mode immediately
    onSelect();
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Mutate via proxy since 'note' is a snapshot value (read-only)
    if (stateProxy.notes && noteId in stateProxy.notes) {
      stateProxy.notes[noteId].text = e.target.value;
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleDragStart = () => {
    setIsDragging(true);
    onSelect();
  };

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    setIsDragging(false);

    // Update the actual document with final position
    // Motion handles the smooth animation, we just store the result
    if (stateProxy.notes && noteId in stateProxy.notes) {
      stateProxy.notes[noteId].x = Math.max(0, note.x + info.offset.x);
      stateProxy.notes[noteId].y = Math.max(0, note.y + info.offset.y);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = note.width;
    const startHeight = note.height;

    let rafId: number | null = null;
    let lastMoveEvent: MouseEvent | null = null;

    const updateSize = () => {
      if (lastMoveEvent && stateProxy.notes && noteId in stateProxy.notes) {
        const deltaX = lastMoveEvent.clientX - startX;
        const deltaY = lastMoveEvent.clientY - startY;

        stateProxy.notes[noteId].width = Math.max(150, startWidth + deltaX);
        stateProxy.notes[noteId].height = Math.max(100, startHeight + deltaY);

        lastMoveEvent = null;
      }
      rafId = null;
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      lastMoveEvent = moveEvent;

      if (!rafId) {
        rafId = requestAnimationFrame(updateSize);
      }
    };

    const handleMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      // Final update to ensure size is accurate
      if (lastMoveEvent && stateProxy.notes && noteId in stateProxy.notes) {
        const deltaX = lastMoveEvent.clientX - startX;
        const deltaY = lastMoveEvent.clientY - startY;

        stateProxy.notes[noteId].width = Math.max(150, startWidth + deltaX);
        stateProxy.notes[noteId].height = Math.max(100, startHeight + deltaY);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <motion.div
      drag={!isEditing}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      whileHover={!isDragging ? { scale: 1.01 } : {}}
      // Motion controls x/y during drag via MotionValues for smooth animation
      // Document updates on drag end are automatically animated by Motion
      initial={{ x: note.x, y: note.y }}
      animate={{ x: note.x, y: note.y }}
      transition={{ type: "tween", duration: 0.1 }}
      className={`group absolute rounded-xl select-none transition-shadow ${
        isDragging ? "shadow-2xl" : ""
      } ${
        isSelected
          ? "ring-2 ring-indigo-500 ring-offset-4 shadow-2xl"
          : "shadow-lg hover:shadow-xl"
      }`}
      style={{
        width: note.width,
        height: note.height,
        backgroundColor: note.color,
        zIndex: note.z,
        boxShadow: isDragging
          ? "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
          : isSelected
            ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
            : "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Content */}
      <div
        className="w-full h-full p-4 overflow-hidden relative cursor-text"
        onClick={handleClick}
      >
        {/* Paper texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={note.text}
            onChange={handleTextChange}
            onBlur={handleBlur}
            placeholder="Type something..."
            className="w-full h-full bg-transparent border-none outline-none resize-none font-sans text-base text-gray-800 leading-relaxed relative z-10 placeholder:text-gray-400"
            style={{ backgroundColor: note.color }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="w-full h-full font-sans text-base text-gray-800 leading-relaxed whitespace-pre-wrap overflow-auto relative z-10">
            {note.text || (
              <span className="text-gray-400">Type something...</span>
            )}
          </div>
        )}
      </div>

      {/* Resize Handle */}
      {isSelected && !isEditing && (
        <div
          className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize group"
          onMouseDown={handleResizeMouseDown}
        >
          <div className="absolute bottom-2 right-2 opacity-40 group-hover:opacity-70 transition-opacity">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="10" cy="10" r="1.5" fill="currentColor" />
              <circle cx="10" cy="6" r="1.5" fill="currentColor" />
              <circle cx="6" cy="10" r="1.5" fill="currentColor" />
            </svg>
          </div>
        </div>
      )}
    </motion.div>
  );
}
