import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, User } from 'lucide-react';

interface KanbanCard {
  id: string;
  columnId: string;
  title: string;
  description: string;
}

interface CardProps {
  card: KanbanCard;
  onDelete: () => void;
  userHolding?: { id: string; name: string; color: string };
}

export function Card({ card, onDelete, userHolding }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow group ${
        userHolding ? 'ring-2' : ''
      }`}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <button
            {...listeners}
            className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing mt-0.5"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <h3 className="font-medium text-gray-800 text-sm">{card.title}</h3>
            {card.description && (
              <p className="text-xs text-gray-600 mt-1">{card.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {userHolding && (
        <div
          className="flex items-center gap-1 mt-2 text-xs font-medium"
          style={{ color: userHolding.color }}
        >
          <User className="w-3 h-3" />
          <span>{userHolding.name} is moving this card</span>
        </div>
      )}
    </div>
  );
}
