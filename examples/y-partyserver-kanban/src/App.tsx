import { useEffect, useMemo, useState } from 'react';
import { useSnapshot } from 'valtio';
import * as Y from 'yjs';
import { YPartyKitProvider } from 'y-partyserver/client';
import { bind } from 'valtio-y';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Column } from './components/Column';
import { Card } from './components/Card';
import { Plus, Users } from 'lucide-react';
import { proxy } from 'valtio';

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

interface KanbanState {
  columns: KanbanColumn[];
  cards: Record<string, KanbanCard>;
  presence: Record<string, { id: string; name: string; color: string; holdingCard?: string }>;
}

export function App() {
  const [state] = useState(() => {
    const ydoc = new Y.Doc();
    const provider = new YPartyKitProvider('localhost:8787', 'kanban-room', ydoc);

    const valtioState = proxy<KanbanState>({
      columns: [],
      cards: {},
      presence: {}
    });

    // Bind Yjs to Valtio
    bind(valtioState, ydoc.getMap('kanban'));

    // Initialize presence
    const clientId = provider.awareness?.clientID.toString() || 'anonymous';
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    if (provider.awareness) {
      provider.awareness.setLocalStateField('user', {
        id: clientId,
        name: `User ${clientId.slice(-4)}`,
        color
      });
    }

    return { valtioState, ydoc, provider };
  });

  const snap = useSnapshot(state.valtioState);
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Update presence when dragging
  useEffect(() => {
    if (state.provider.awareness) {
      const user = state.provider.awareness.getLocalState()?.user;
      if (user) {
        state.provider.awareness.setLocalStateField('user', {
          ...user,
          holdingCard: activeCard?.id
        });
      }
    }
  }, [activeCard, state.provider]);

  // Listen to presence changes
  useEffect(() => {
    if (!state.provider.awareness) return;

    const handleChange = () => {
      const states = state.provider.awareness!.getStates();
      const presenceMap: Record<string, any> = {};

      states.forEach((value, key) => {
        if (value.user && key !== state.provider.awareness!.clientID) {
          presenceMap[key] = value.user;
        }
      });

      state.valtioState.presence = presenceMap;
    };

    state.provider.awareness.on('change', handleChange);
    return () => {
      state.provider.awareness!.off('change', handleChange);
    };
  }, [state]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = snap.cards[active.id as string];
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeCard = state.valtioState.cards[active.id as string];
    if (!activeCard) return;

    // Check if dropped on a column or a card
    const overId = over.id as string;
    const overCard = state.valtioState.cards[overId];
    const overColumn = state.valtioState.columns.find(col => col.id === overId);

    if (overColumn) {
      // Dropped on a column
      activeCard.columnId = overColumn.id;
    } else if (overCard) {
      // Dropped on a card - move to that card's column
      activeCard.columnId = overCard.columnId;
    }
  };

  const addColumn = () => {
    if (!newColumnName.trim()) return;

    const newColumn: KanbanColumn = {
      id: `col-${Date.now()}`,
      title: newColumnName.trim()
    };

    state.valtioState.columns.push(newColumn);
    setNewColumnName('');
    setShowAddColumn(false);
  };

  const addCard = (columnId: string) => {
    const title = prompt('Card title:');
    if (!title) return;

    const description = prompt('Card description (optional):') || '';

    const newCard: KanbanCard = {
      id: `card-${Date.now()}`,
      columnId,
      title,
      description
    };

    state.valtioState.cards[newCard.id] = newCard;
  };

  const deleteCard = (cardId: string) => {
    delete state.valtioState.cards[cardId];
  };

  const deleteColumn = (columnId: string) => {
    // Delete all cards in this column
    Object.keys(state.valtioState.cards).forEach(cardId => {
      if (state.valtioState.cards[cardId].columnId === columnId) {
        delete state.valtioState.cards[cardId];
      }
    });

    // Delete the column
    const index = state.valtioState.columns.findIndex(col => col.id === columnId);
    if (index !== -1) {
      state.valtioState.columns.splice(index, 1);
    }
  };

  const getCardsForColumn = (columnId: string) => {
    return Object.values(snap.cards).filter(card => card.columnId === columnId);
  };

  const onlineUsers = Object.keys(snap.presence).length + 1; // +1 for current user

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Collaborative Kanban Board</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="w-4 h-4" />
          <span>{onlineUsers} online</span>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full">
            {snap.columns.map((column) => (
              <Column
                key={column.id}
                column={column}
                cards={getCardsForColumn(column.id)}
                onAddCard={() => addCard(column.id)}
                onDeleteCard={deleteCard}
                onDeleteColumn={() => deleteColumn(column.id)}
                presence={snap.presence}
              />
            ))}

            <div className="flex-shrink-0 w-80">
              {showAddColumn ? (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addColumn()}
                    placeholder="Column name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addColumn}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setShowAddColumn(false);
                        setNewColumnName('');
                      }}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddColumn(true)}
                  className="w-full h-full min-h-[200px] bg-white/50 hover:bg-white/80 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-all flex items-center justify-center text-gray-500 hover:text-gray-700"
                >
                  <Plus className="w-6 h-6 mr-2" />
                  Add Column
                </button>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeCard ? (
              <div className="bg-white rounded-lg p-4 shadow-lg border-2 border-blue-500 opacity-90">
                <h3 className="font-medium text-gray-800">{activeCard.title}</h3>
                {activeCard.description && (
                  <p className="text-sm text-gray-600 mt-1">{activeCard.description}</p>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
