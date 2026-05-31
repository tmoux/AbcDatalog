'use client'

import { GameStatus } from '@/types/game'

interface Props {
  status: GameStatus
  speedMs: number
  onStart: () => void
  onPause: () => void
  onSpeedChange: (ms: number) => void
}

const SPEED_STEPS = [500, 1000, 2000, 3000, 5000]
const SPEED_LABELS: Record<number, string> = {
  500: '0.5s',
  1000: '1s',
  2000: '2s',
  3000: '3s',
  5000: '5s',
}

export default function GameControls({ status, speedMs, onStart, onPause, onSpeedChange }: Props) {
  const closestStep = SPEED_STEPS.reduce((prev, curr) =>
    Math.abs(curr - speedMs) < Math.abs(prev - speedMs) ? curr : prev
  )
  const speedIndex = SPEED_STEPS.indexOf(closestStep)

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-xl border border-gray-700">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-300">Game Controls</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
          status === 'running' ? 'bg-green-900 text-green-300' :
          status === 'paused' ? 'bg-yellow-900 text-yellow-300' :
          status === 'finished' ? 'bg-gray-700 text-gray-300' :
          'bg-gray-800 text-gray-400'
        }`}>
          {status}
        </span>
      </div>

      {/* Play / Pause buttons */}
      <div className="flex gap-2">
        {status !== 'running' && status !== 'finished' && (
          <button
            onClick={onStart}
            className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-sm
                       transition-colors shadow-md"
          >
            {status === 'setup' ? '▶ Start' : '▶ Resume'}
          </button>
        )}

        {status === 'running' && (
          <button
            onClick={onPause}
            className="flex-1 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-sm
                       transition-colors shadow-md"
          >
            ⏸ Pause
          </button>
        )}

        {status === 'finished' && (
          <div className="flex-1 py-2 text-center text-gray-400 text-sm font-semibold">
            Game over
          </div>
        )}
      </div>

      {/* Speed control */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs text-gray-400">
          <span>Turn delay</span>
          <span className="text-gray-200 font-semibold">{SPEED_LABELS[closestStep]}</span>
        </div>
        <input
          type="range"
          min={0}
          max={SPEED_STEPS.length - 1}
          step={1}
          value={speedIndex}
          onChange={e => onSpeedChange(SPEED_STEPS[Number(e.target.value)])}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-600">
          <span>Fast</span>
          <span>Slow</span>
        </div>
      </div>
    </div>
  )
}
