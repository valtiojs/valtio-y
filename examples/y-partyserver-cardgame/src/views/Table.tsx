import { Card as CardType } from "../y/selectors";

interface TableProps {
  topCard: CardType | null;
  deckSize: number;
  forcedSuit: string | null;
  currentPlayerName: string | null;
}

export function Table({
  topCard,
  deckSize,
  forcedSuit,
  currentPlayerName,
}: TableProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-green-800 to-green-900 p-8">
      <div className="flex items-center gap-12">
        {/* Deck */}
        <div className="relative">
          <div className="w-32 h-44 rounded-lg border-4 border-blue-900 bg-blue-800 shadow-2xl flex items-center justify-center">
            <div className="text-center text-white">
              <div className="text-5xl mb-2">🂠</div>
              <div className="font-bold text-xl">{deckSize}</div>
              <div className="text-xs opacity-75">cards</div>
            </div>
          </div>
          <div className="absolute -top-1 -left-1 w-32 h-44 rounded-lg border-4 border-blue-900 bg-blue-800 -z-10" />
          <div className="absolute -top-2 -left-2 w-32 h-44 rounded-lg border-4 border-blue-900 bg-blue-800 -z-20" />
        </div>

        {/* Arrow */}
        <div className="text-6xl text-yellow-400 animate-pulse">→</div>

        {/* Discard Pile */}
        <div className="relative">
          {topCard ? (
            <div
              className={`
              w-32 h-44 rounded-lg border-4 bg-white shadow-2xl flex flex-col items-center justify-center
              font-bold transform hover:scale-105 transition-transform
              ${topCard.suit === "♥" || topCard.suit === "♦" ? "text-red-600 border-red-600" : "text-black border-black"}
            `}
            >
              <div className="text-5xl">{topCard.rank}</div>
              <div className="text-6xl">{topCard.suit}</div>
            </div>
          ) : (
            <div className="w-32 h-44 rounded-lg border-4 border-dashed border-gray-600 bg-green-700/50 flex items-center justify-center">
              <div className="text-gray-400 text-center">
                <div className="text-4xl mb-2">🃏</div>
                <div className="text-xs">Discard</div>
              </div>
            </div>
          )}

          {forcedSuit && (
            <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-yellow-500 border-4 border-white shadow-lg flex items-center justify-center text-3xl animate-bounce">
              {forcedSuit}
            </div>
          )}
        </div>
      </div>

      {/* Current Turn Indicator */}
      {currentPlayerName && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-black px-6 py-3 rounded-full font-bold shadow-lg animate-pulse">
          {currentPlayerName}'s Turn
        </div>
      )}
    </div>
  );
}
