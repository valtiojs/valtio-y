import { User, Crown } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  hand: string[];
  connected: boolean;
}

interface PlayerListProps {
  players: Player[];
  currentPlayerId?: string;
  myPlayerId: string;
}

export function PlayerList({ players, currentPlayerId, myPlayerId }: PlayerListProps) {
  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Players</h3>
      <div className="space-y-2">
        {players
          .filter(p => p.connected)
          .map(player => (
            <div
              key={player.id}
              className={`p-3 rounded-lg ${
                player.id === currentPlayerId
                  ? 'bg-yellow-500 text-black font-bold'
                  : 'bg-teal-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {player.id === currentPlayerId && <Crown className="w-4 h-4" />}
                <User className="w-4 h-4" />
                <span className="text-sm">
                  {player.name}
                  {player.id === myPlayerId && ' (You)'}
                </span>
              </div>
              <div className="text-xs opacity-80">
                {player.hand.length} {player.hand.length === 1 ? 'card' : 'cards'}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
