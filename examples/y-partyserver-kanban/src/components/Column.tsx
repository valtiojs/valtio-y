import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card } from './Card';
import { Plus, Trash2 } from 'lucide-react';

interface KanbanCard {
  id: string;
  columnId: string;
  title: string;
  description: string;
}

interface KanbanColumn {
  id: string;
  title: string;
}

interface ColumnProps {
  column: KanbanColumn;
  cards: KanbanCard[];
  onAddCard: () => void;
  onDeleteCard: (cardId: string) => void;
  onDeleteColumn: () => void;
  presence: Record<string, { id: string; name: string; color: string; holdingCard?: string }>;
}

export function Column({ column, cards, onAddCard, onDeleteCard, onDeleteColumn, presence }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  const cardIds = cards.map(card => card.id);

  return (
    <div className="flex-shrink-0 w-80 flex flex-col bg-gray-100 rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-800">{column.title}</h2>
          <span className="bg-gray-300 text-gray-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {cards.length}
          </span>
        </div>
        <button
          onClick={onDeleteColumn}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title="Delete column"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]"
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => {
            const userHolding = Object.values(presence).find(
              user => user.holdingCard === card.id
            );

            return (
              <Card
                key={card.id}
                card={card}
                onDelete={() => onDeleteCard(card.id)}
                userHolding={userHolding}
              />
            );
          })}
        </SortableContext>
      </div>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onAddCard}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-md border border-gray-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Card
        </button>
      </div>
    </div>
  );
}
