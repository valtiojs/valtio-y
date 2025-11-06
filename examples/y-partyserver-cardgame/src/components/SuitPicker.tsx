interface SuitPickerProps {
  onSelectSuit: (suit: string) => void;
  onCancel: () => void;
}

const SUITS = [
  { symbol: "♠", name: "Spades", color: "text-black" },
  { symbol: "♥", name: "Hearts", color: "text-red-600" },
  { symbol: "♦", name: "Diamonds", color: "text-red-600" },
  { symbol: "♣", name: "Clubs", color: "text-black" },
];

export function SuitPicker({ onSelectSuit, onCancel }: SuitPickerProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Choose a Suit
        </h2>
        <p className="text-gray-400 text-center mb-6">
          Select which suit you want to force
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {SUITS.map((suit) => (
            <button
              key={suit.symbol}
              onClick={() => onSelectSuit(suit.symbol)}
              className={`
                p-6 rounded-xl bg-white hover:bg-gray-100 transition-all
                transform hover:scale-105 active:scale-95
                border-4 border-transparent hover:border-blue-500
                ${suit.color}
              `}
            >
              <div className="text-7xl mb-2 text-center">{suit.symbol}</div>
              <div className="text-sm font-medium text-gray-700 text-center">
                {suit.name}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
