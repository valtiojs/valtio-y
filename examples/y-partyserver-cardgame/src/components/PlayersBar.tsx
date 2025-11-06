import { Player } from "../y/selectors";

interface PlayersBarProps {
  players: Player[];
  handSizes: Map<string, number>;
  currentPlayerId: string | null;
  myPlayerId: string;
}

const AVATAR_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-purple-500",
  "bg-pink-500",
];

export function PlayersBar({
  players,
  handSizes,
  currentPlayerId,
  myPlayerId,
}: PlayersBarProps) {
  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex gap-4 overflow-x-auto">
          {players.map((player, index) => {
            const isCurrentTurn = currentPlayerId === player.id;
            const isMe = player.id === myPlayerId;
            const handSize = handSizes.get(player.id) || 0;

            return (
              <div
                key={player.id}
                className={`
                  flex items-center gap-3 px-4 py-2 rounded-lg transition-all
                  ${isCurrentTurn ? "bg-yellow-500/20 ring-2 ring-yellow-500" : "bg-gray-700"}
                  ${isMe ? "ring-2 ring-blue-500" : ""}
                `}
              >
                <div
                  className={`
                    w-10 h-10 rounded-full ${AVATAR_COLORS[index % AVATAR_COLORS.length]}
                    flex items-center justify-center text-white font-bold text-lg
                    ${isCurrentTurn ? "animate-pulse" : ""}
                  `}
                >
                  {player.name[0].toUpperCase()}
                </div>

                <div className="text-white">
                  <div className="font-medium flex items-center gap-2">
                    {player.name}
                    {isMe && (
                      <span className="text-xs bg-blue-500 px-2 py-0.5 rounded">
                        You
                      </span>
                    )}
                    {player.isHost && (
                      <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">
                        Host
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {handSize} card{handSize !== 1 ? "s" : ""}
                  </div>
                </div>

                {isCurrentTurn && (
                  <div className="text-yellow-500 text-2xl animate-bounce">
                    ⏰
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
