'use client'

import { Card, Team } from '@/types/game'

interface Props {
  board: Card[]
  lastGuessWord?: string
  currentTeam?: Team
}

const COLOR_CLASSES: Record<string, string> = {
  red: 'bg-red-600 border-red-400 text-white',
  blue: 'bg-blue-600 border-blue-400 text-white',
  neutral: 'bg-stone-500 border-stone-400 text-stone-100',
  assassin: 'bg-gray-900 border-gray-600 text-gray-100',
}

const REVEALED_CLASSES: Record<string, string> = {
  red: 'bg-red-900/60 border-red-800 text-red-300',
  blue: 'bg-blue-900/60 border-blue-800 text-blue-300',
  neutral: 'bg-stone-800/60 border-stone-700 text-stone-500',
  assassin: 'bg-gray-950/60 border-gray-800 text-gray-600',
}

export default function GameBoard({ board, lastGuessWord, currentTeam }: Props) {
  if (!board || board.length === 0) return null

  const rows: Card[][] = []
  for (let i = 0; i < 25; i += 5) {
    rows.push(board.slice(i, i + 5))
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-2">
          {row.map((card) => {
            const isLast = card.word === lastGuessWord
            const classes = card.revealed
              ? REVEALED_CLASSES[card.color]
              : COLOR_CLASSES[card.color]

            return (
              <div
                key={card.word}
                className={`
                  flex-1 h-16 flex items-center justify-center rounded-lg border-2
                  font-bold text-sm tracking-wider uppercase cursor-default select-none
                  transition-all duration-300
                  ${classes}
                  ${isLast ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-950 scale-105' : ''}
                  ${card.revealed ? 'opacity-50' : 'shadow-md'}
                `}
              >
                {card.color === 'assassin' && !card.revealed && (
                  <span className="mr-1 text-red-500">☠</span>
                )}
                {card.word}
              </div>
            )
          })}
        </div>
      ))}

      <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
        <span className="text-red-400 font-semibold">
          Red: {board.filter(c => c.color === 'red' && !c.revealed).length} left
        </span>
        {currentTeam && (
          <span className={currentTeam === 'red' ? 'text-red-300' : 'text-blue-300'}>
            {currentTeam.toUpperCase()} team&apos;s turn
          </span>
        )}
        <span className="text-blue-400 font-semibold">
          Blue: {board.filter(c => c.color === 'blue' && !c.revealed).length} left
        </span>
      </div>
    </div>
  )
}
