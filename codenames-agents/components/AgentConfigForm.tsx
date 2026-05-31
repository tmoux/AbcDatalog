'use client'

import { AgentConfig } from '@/types/game'

interface Props {
  label: string
  teamColor: 'red' | 'blue'
  config: AgentConfig
  onChange: (config: AgentConfig) => void
}

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-8',
  'claude-haiku-4-5-20251001',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
]

export default function AgentConfigForm({ label, teamColor, config, onChange }: Props) {
  const border = teamColor === 'red' ? 'border-red-800' : 'border-blue-800'
  const header = teamColor === 'red' ? 'text-red-300' : 'text-blue-300'

  function update(partial: Partial<AgentConfig>) {
    onChange({ ...config, ...partial })
  }

  function updateFlag(key: keyof AgentConfig['strategyFlags'], value: unknown) {
    onChange({
      ...config,
      strategyFlags: { ...config.strategyFlags, [key]: value },
    })
  }

  return (
    <div className={`flex flex-col gap-3 p-4 rounded-xl border-2 ${border} bg-gray-900`}>
      <h3 className={`font-bold text-sm uppercase tracking-wider ${header}`}>{label}</h3>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Agent name</label>
        <input
          type="text"
          value={config.name}
          onChange={e => update({ name: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200
                     focus:outline-none focus:border-gray-500"
        />
      </div>

      {/* Model */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Model</label>
        <select
          value={config.model}
          onChange={e => update({ model: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200
                     focus:outline-none focus:border-gray-500"
        >
          {MODELS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
          <option value={config.model}>{config.model}</option>
        </select>
      </div>

      {/* Temperature */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between">
          <label className="text-xs text-gray-400">Temperature</label>
          <span className="text-xs text-gray-200">{config.temperature.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.temperature}
          onChange={e => update({ temperature: Number(e.target.value) })}
          className="accent-blue-500"
        />
      </div>

      {/* Strategy flags */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400">Strategy</label>

        <div className="flex flex-col gap-1.5 pl-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-300">Aggressiveness</span>
            <div className="flex gap-1">
              {(['low', 'medium', 'high'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => updateFlag('aggressiveness', level)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    config.strategyFlags.aggressiveness === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.strategyFlags.multiWordFocus}
              onChange={e => updateFlag('multiWordFocus', e.target.checked)}
              className="accent-blue-500"
            />
            Prefer high-count clues (3+ words)
          </label>

          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.strategyFlags.usePreviousClues}
              onChange={e => updateFlag('usePreviousClues', e.target.checked)}
              className="accent-blue-500"
            />
            Use previous clues for bonus guesses
          </label>
        </div>
      </div>

      {/* Custom system prompt */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">
          Custom system prompt{' '}
          <span className="text-gray-600">(leave blank for default)</span>
        </label>
        <textarea
          value={config.systemPrompt}
          onChange={e => update({ systemPrompt: e.target.value })}
          rows={4}
          placeholder="Override the default strategy prompt..."
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200
                     focus:outline-none focus:border-gray-500 resize-y font-mono"
        />
      </div>
    </div>
  )
}
