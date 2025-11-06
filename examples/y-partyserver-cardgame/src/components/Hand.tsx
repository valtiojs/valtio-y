import { Card as CardType } from "../y/selectors";

interface HandProps {
  cards: CardType[];
  legalCards: Set<string>;
  isMyTurn: boolean;
  onPlayCard: (cardId: string) => void;
  onDraw: () => void;
  onPass: () => void;
}

export function Hand({
  cards,
  legalCards,
  isMyTurn,
  onPlayCard,
  onDraw,
  onPass,
}: HandProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-gray-800/95 border-t border-gray-700 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-white font-medium">
            Your Hand ({cards.length})
          </div>
          {isMyTurn && (
            <div className="flex gap-2">
              <button
                onClick={onDraw}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Draw Card
              </button>
              <button
                onClick={onPass}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Pass
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {cards.map((card) => {
            const isLegal = legalCards.has(card.id);
            const canPlay = isMyTurn && isLegal;

            return (
              <button
                key={card.id}
                onClick={() => canPlay && onPlayCard(card.id)}
                disabled={!canPlay}
                className={`
                  flex-shrink-0 w-20 h-28 rounded-lg border-2 flex flex-col items-center justify-center
                  font-bold text-2xl transition-all transform hover:scale-105
                  ${
                    canPlay
                      ? "border-green-500 bg-white cursor-pointer hover:shadow-lg hover:shadow-green-500/50"
                      : isLegal
                        ? "border-yellow-500 bg-white opacity-60"
                        : "border-gray-400 bg-gray-100 opacity-40 cursor-not-allowed"
                  }
                  ${card.suit === "♥" || card.suit === "♦" ? "text-red-600" : "text-black"}
                `}
              >
                <div>{card.rank}</div>
                <div className="text-3xl">{card.suit}</div>
              </button>
            );
          })}
        </div>

        {!isMyTurn && (
          <div className="text-center text-gray-400 text-sm mt-2">
            Waiting for your turn...
          </div>
        )}
      </div>
    </div>
  );
}
