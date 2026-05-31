'use client'

import { Team, Game, SSEEvent } from '@/types/game'
import ReasoningStream from './ReasoningStream'

interface Props {
  team: Team
  game: Game
  streamingRole: 'clue-giver' | 'guesser' | null
  streamingText: string
  lastClue: string | null
  isActive: boolean
}

export default function TeamPanel({
  team,
  game,
  streamingRole,
  streamingText,
  lastClue,
  isActive,
}: Props) {
  const clueGiver = team === 'red' ? game.redClueGiver : game.blueClueGiver
  const guesser = team === 'red' ? game.redGuesser : game.blueGuesser
  const board = game.board

  const total = board.filter(c => c.color === team).length
  const found = board.filter(c => c.color === team && c.revealed).length
  const remaining = total - found

  const teamColor = team === 'red'
    ? 'border-red-700 bg-red-950/40'
    : 'border-blue-700 bg-blue-950/40'
  const teamText = team === 'red' ? 'text-red-300' : 'text-blue-300'
  const teamBadge = team === 'red' ? 'bg-red-600' : 'bg-blue-600'

  const lastTurns = game.turns.filter(t => t.team === team).slice(-6)

  return (
    <div className={`flex flex-col gap-3 rounded-xl border-2 p-4 ${teamColor} ${isActive ? 'shadow-lg' : 'opacity-80'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${teamBadge}`} />
          <span className={`font-bold text-sm uppercase tracking-widest ${teamText}`}>
            {team} team
          </span>
          {isActive && (
            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded font-semibold animate-pulse">
              ACTIVE
            </span>
          )}
        </div>
        <div className={`text-2xl font-black ${teamText}`}>
          {found}/{total}
        </div>
      </div>

      {/* Score bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${teamBadge}`}
          style={{ width: `${(found / total) * 100}%` }}
        />
      </div>
      <p className={`text-xs ${teamText} opacity-70`}>{remaining} card{remaining !== 1 ? 's' : ''} remaining</p>

      {/* Agents */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Spymaster', config: clueGiver, role: 'clue-giver' as const },
          { label: 'Field Agent', config: guesser, role: 'guesser' as const },
        ].map(({ label, config, role }) => (
          <div
            key={role}
            className={`rounded-lg p-2 border text-xs ${
              streamingRole === role && isActive
                ? 'border-yellow-500/50 bg-yellow-950/30'
                : 'border-gray-700 bg-gray-900/50'
            }`}
          >
            <div className="font-semibold text-gray-300">{label}</div>
            <div className="text-gray-500 truncate">{config.name}</div>
            <div className="text-gray-600 truncate">{config.model}</div>
            {streamingRole === role && isActive && (
              <div className="text-yellow-400 text-xs mt-1 font-semibold">● thinking...</div>
            )}
          </div>
        ))}
      </div>

      {/* Last clue */}
      {lastClue && (
        <div className="rounded-lg bg-gray-900 border border-gray-700 p-2">
          <div className="text-xs text-gray-500 uppercase font-semibold mb-1">Last clue</div>
          <div className={`text-lg font-black ${teamText}`}>{lastClue}</div>
        </div>
      )}

      {/* Live reasoning stream */}
      {isActive && (
        <ReasoningStream
          text={streamingText}
          isStreaming={streamingRole !== null}
          label={streamingRole === 'clue-giver' ? 'Spymaster thinking' : 'Field agent thinking'}
        />
      )}

      {/* Recent turns */}
      {lastTurns.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-gray-500 uppercase font-semibold">Recent moves</div>
          <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
            {lastTurns.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {t.phase === 'clue' ? (
                  <span className={`font-bold ${teamText}`}>Clue: {t.action}</span>
                ) : (
                  <span className={`
                    px-1 rounded
                    ${t.result === 'correct' ? 'bg-green-900/50 text-green-300' : ''}
                    ${t.result === 'assassin' ? 'bg-red-900/80 text-red-200' : ''}
                    ${t.result === 'neutral' || t.result === 'wrong' ? 'bg-orange-900/50 text-orange-300' : ''}
                    ${!t.result ? 'text-gray-400' : ''}
                  `}>
                    {t.action} {t.result ? `(${t.result})` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export type { SSEEvent }
