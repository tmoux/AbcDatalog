'use client'

import { useRef, useEffect, useState } from 'react'
import { TurnEntry } from '@/types/game'

interface Props {
  turns: TurnEntry[]
  autoScroll?: boolean
}

function ThinkingBlock({ thinking, label }: { thinking: string; label: string }) {
  const [open, setOpen] = useState(false)
  if (!thinking) return null
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        {label} reasoning
      </button>
      {open && (
        <pre className="mt-1.5 p-2 bg-gray-950 border border-gray-800 rounded text-xs text-gray-400
                        font-mono leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-48">
          {thinking}
        </pre>
      )}
    </div>
  )
}

export default function GameHistory({ turns, autoScroll = true }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [turns.length, autoScroll])

  if (turns.length === 0) {
    return (
      <div className="text-center text-gray-600 text-sm py-4">
        No moves yet. Start the game to begin.
      </div>
    )
  }

  const groups: Map<number, TurnEntry[]> = new Map()
  for (const t of turns) {
    if (!groups.has(t.turnNumber)) groups.set(t.turnNumber, [])
    groups.get(t.turnNumber)!.push(t)
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto max-h-96 pr-1">
      {[...groups.entries()].map(([turnNum, entries]) => {
        const clue = entries.find(e => e.phase === 'clue')
        const guesses = entries.filter(e => e.phase === 'guess')
        const team = clue?.team ?? guesses[0]?.team ?? 'red'
        const guesserThinking = guesses.find(g => g.thinking)?.thinking ?? ''

        return (
          <div
            key={turnNum}
            className={`rounded-lg border p-3 ${
              team === 'red'
                ? 'border-red-900 bg-red-950/30'
                : 'border-blue-900 bg-blue-950/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${team === 'red' ? 'bg-red-500' : 'bg-blue-500'}`} />
              <span className={`text-xs font-bold uppercase ${team === 'red' ? 'text-red-400' : 'text-blue-400'}`}>
                Turn {turnNum} — {team}
              </span>
            </div>

            {clue && (
              <>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-xs text-gray-500">Clue:</span>
                  <span className={`text-base font-black ${team === 'red' ? 'text-red-300' : 'text-blue-300'}`}>
                    {clue.action}
                  </span>
                  <span className="text-xs text-gray-500">by {clue.agentName}</span>
                </div>
                <ThinkingBlock thinking={clue.thinking} label="Spymaster" />
              </>
            )}

            {guesses.length > 0 && (
              <>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {guesses.map((g, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        g.result === 'correct' ? 'bg-green-900/60 text-green-300 border border-green-800' :
                        g.result === 'assassin' ? 'bg-red-900/80 text-red-200 border border-red-700' :
                        g.result === 'neutral' ? 'bg-stone-800 text-stone-300 border border-stone-700' :
                        g.result === 'wrong' ? 'bg-orange-900/60 text-orange-300 border border-orange-800' :
                        'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {g.action}
                      {g.result && ` ·${g.result === 'correct' ? ' ✓' : g.result === 'assassin' ? ' ☠' : g.result === 'neutral' ? ' –' : ' ✗'}`}
                    </span>
                  ))}
                </div>
                <ThinkingBlock thinking={guesserThinking} label="Field agent" />
              </>
            )}
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
