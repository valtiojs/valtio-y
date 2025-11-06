interface SuitSelectorProps {
  onSelectSuit: (suit: 'hearts' | 'diamonds' | 'clubs' | 'spades') => void;
}

const suits = [
  { name: 'hearts' as const, symbol: '♥', color: 'bg-red-500 hover:bg-red-600' },
  { name: 'diamonds' as const, symbol: '♦', color: 'bg-red-500 hover:bg-red-600' },
  { name: 'clubs' as const, symbol: '♣', color: 'bg-gray-800 hover:bg-gray-900' },
  { name: 'spades' as const, symbol: '♠', color: 'bg-gray-800 hover:bg-gray-900' }
];

export function SuitSelector({ onSelectSuit }: SuitSelectorProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 shadow-2xl">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Choose a Suit
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {suits.map(suit => (
            <button
              key={suit.name}
              onClick={() => onSelectSuit(suit.name)}
              className={`w-32 h-32 ${suit.color} text-white rounded-xl text-6xl font-bold transition-transform hover:scale-110 shadow-lg`}
            >
              {suit.symbol}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
