'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AgentConfig, GameSummary } from '@/types/game'
import AgentConfigForm from '@/components/AgentConfigForm'

function defaultAgent(name: string, role: 'clue-giver' | 'guesser'): AgentConfig {
  return {
    name,
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    systemPrompt: '',
    temperature: role === 'clue-giver' ? 0.7 : 0.4,
    strategyFlags: {
      aggressiveness: 'medium',
      multiWordFocus: true,
      usePreviousClues: true,
    },
  }
}

export default function HomePage() {
  const router = useRouter()
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [showConfig, setShowConfig] = useState(false)

  const [redClueGiver, setRedClueGiver] = useState<AgentConfig>(() =>
    defaultAgent('Red Spymaster', 'clue-giver')
  )
  const [redGuesser, setRedGuesser] = useState<AgentConfig>(() =>
    defaultAgent('Red Field Agent', 'guesser')
  )
  const [blueClueGiver, setBlueClueGiver] = useState<AgentConfig>(() =>
    defaultAgent('Blue Spymaster', 'clue-giver')
  )
  const [blueGuesser, setBlueGuesser] = useState<AgentConfig>(() =>
    defaultAgent('Blue Field Agent', 'guesser')
  )
  const [speedMs, setSpeedMs] = useState(2000)
  const [creating, setCreating] = useState(false)

  const loadGames = useCallback(async () => {
    const res = await fetch('/api/games')
    if (res.ok) setGames(await res.json())
  }, [])

  useEffect(() => {
    loadGames()
  }, [loadGames])

  async function createGame() {
    setCreating(true)
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redClueGiver, redGuesser, blueClueGiver, blueGuesser, speedMs }),
      })
      if (!res.ok) throw new Error('Failed to create game')
      const { id } = await res.json()
      router.push(`/games/${id}`)
    } catch (e) {
      alert(String(e))
      setCreating(false)
    }
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString()
  }

  function formatDuration(created: number, finished: number | null) {
    if (!finished) return 'In progress'
    const s = Math.round((finished - created) / 1000)
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              Codenames <span className="text-blue-400">Agents</span>
            </h1>
            <p className="text-xs text-gray-500">AI vs AI Codenames — spectator mode</p>
          </div>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            {showConfig ? '✕ Cancel' : '+ New Game'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Game config */}
        {showConfig && (
          <section className="mb-8 p-6 bg-gray-900 rounded-2xl border border-gray-700">
            <h2 className="text-lg font-bold mb-6 text-white">Configure New Game</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <AgentConfigForm
                label="Red Spymaster (clue giver)"
                teamColor="red"
                config={redClueGiver}
                onChange={setRedClueGiver}
              />
              <AgentConfigForm
                label="Red Field Agent (guesser)"
                teamColor="red"
                config={redGuesser}
                onChange={setRedGuesser}
              />
              <AgentConfigForm
                label="Blue Spymaster (clue giver)"
                teamColor="blue"
                config={blueClueGiver}
                onChange={setBlueClueGiver}
              />
              <AgentConfigForm
                label="Blue Field Agent (guesser)"
                teamColor="blue"
                config={blueGuesser}
                onChange={setBlueGuesser}
              />
            </div>

            <div className="flex items-center gap-6 mb-6">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Initial turn delay</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={500}
                    value={speedMs}
                    onChange={e => setSpeedMs(Number(e.target.value))}
                    className="w-32 accent-blue-500"
                  />
                  <span className="text-sm text-gray-200 w-12">{speedMs / 1000}s</span>
                </div>
              </div>
            </div>

            <button
              onClick={createGame}
              disabled={creating}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white
                         rounded-lg font-bold text-sm transition-colors shadow-md"
            >
              {creating ? 'Creating...' : '▶ Create & Watch'}
            </button>
          </section>
        )}

        {/* Games list */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Game History</h2>
            <button onClick={loadGames} className="text-xs text-gray-500 hover:text-gray-300">
              ↻ Refresh
            </button>
          </div>

          {games.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <div className="text-4xl mb-3">🕵️</div>
              <p className="text-sm">No games yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {games.map(game => (
                <a
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800
                             rounded-xl hover:border-gray-600 hover:bg-gray-800/80 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      game.status === 'running' ? 'bg-green-400 animate-pulse' :
                      game.status === 'paused' ? 'bg-yellow-400' :
                      game.status === 'finished' ? 'bg-gray-500' :
                      'bg-gray-600'
                    }`} />
                    <div>
                      <div className="font-semibold text-sm text-gray-200 group-hover:text-white">
                        {game.redClueGiverName} <span className="text-red-400">Red</span>
                        {' '} vs <span className="text-blue-400">Blue</span> {game.blueClueGiverName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(game.createdAt)} · {game.turnCount} moves ·{' '}
                        {formatDuration(game.createdAt, game.finishedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {game.winner && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        game.winner === 'red'
                          ? 'bg-red-900/60 text-red-300'
                          : 'bg-blue-900/60 text-blue-300'
                      }`}>
                        {game.winner.toUpperCase()} wins
                      </span>
                    )}
                    {!game.winner && game.status !== 'finished' && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        game.status === 'running'
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {game.status}
                      </span>
                    )}
                    <span className="text-gray-600 group-hover:text-gray-400 text-sm">→</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
