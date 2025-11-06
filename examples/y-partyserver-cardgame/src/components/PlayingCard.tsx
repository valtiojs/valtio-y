interface Card {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  rank: string;
  id: string;
}

interface PlayingCardProps {
  card: Card;
  faceUp?: boolean;
}

const suitSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const suitColors = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-black',
  spades: 'text-black'
};

export function PlayingCard({ card, faceUp = true }: PlayingCardProps) {
  if (!faceUp) {
    return (
      <div className="w-24 h-32 bg-blue-900 border-2 border-blue-700 rounded-lg shadow-lg" />
    );
  }

  return (
    <div className="w-24 h-32 bg-white rounded-lg shadow-lg border-2 border-gray-300 p-2 flex flex-col">
      <div className={`text-xl font-bold ${suitColors[card.suit]}`}>
        {card.rank}
      </div>
      <div className={`flex-1 flex items-center justify-center text-5xl ${suitColors[card.suit]}`}>
        {suitSymbols[card.suit]}
      </div>
      <div className={`text-xl font-bold text-right ${suitColors[card.suit]} rotate-180`}>
        {card.rank}
      </div>
    </div>
  );
}
