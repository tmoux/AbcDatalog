'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Game, SSEEvent, Team } from '@/types/game'
import GameBoard from '@/components/GameBoard'
import TeamPanel from '@/components/TeamPanel'
import GameControls from '@/components/GameControls'
import GameHistory from '@/components/GameHistory'

interface LiveState {
  game: Game | null
  streamingTeam: Team | null
  streamingRole: 'clue-giver' | 'guesser' | null
  redStreamText: string
  blueStreamText: string
  lastRedClue: string | null
  lastBlueClue: string | null
  lastGuessWord: string | null
  error: string | null
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [state, setState] = useState<LiveState>({
    game: null,
    streamingTeam: null,
    streamingRole: null,
    redStreamText: '',
    blueStreamText: '',
    lastRedClue: null,
    lastBlueClue: null,
    lastGuessWord: null,
    error: null,
  })

  const sseRef = useRef<EventSource | null>(null)
  const [connected, setConnected] = useState(false)

  const connectSSE = useCallback(() => {
    if (sseRef.current) sseRef.current.close()

    const es = new EventSource(`/api/games/${id}/stream`)
    sseRef.current = es
    setConnected(false)

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as SSEEvent
        handleSSEEvent(event)
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      setConnected(false)
      setTimeout(() => {
        if (sseRef.current === es) connectSSE()
      }, 2000)
    }
  }, [id])

  function handleSSEEvent(event: SSEEvent) {
    const { type, data } = event

    setState(prev => {
      switch (type) {
        case 'game_state': {
          const game = data.game as Game
          const lastRed = game.turns
            .filter(t => t.team === 'red' && t.phase === 'clue')
            .slice(-1)[0]?.action ?? null
          const lastBlue = game.turns
            .filter(t => t.team === 'blue' && t.phase === 'clue')
            .slice(-1)[0]?.action ?? null
          return {
            ...prev,
            game,
            lastRedClue: lastRed,
            lastBlueClue: lastBlue,
          }
        }

        case 'status': {
          const team = data.team as Team
          const role = data.role as 'clue-giver' | 'guesser'
          return {
            ...prev,
            streamingTeam: team,
            streamingRole: role,
            redStreamText: team === 'red' ? '' : prev.redStreamText,
            blueStreamText: team === 'blue' ? '' : prev.blueStreamText,
          }
        }

        case 'thinking_token': {
          const team = data.team as Team
          const token = data.token as string
          if (team === 'red') {
            return { ...prev, redStreamText: prev.redStreamText + token }
          } else {
            return { ...prev, blueStreamText: prev.blueStreamText + token }
          }
        }

        case 'clue': {
          const team = data.team as Team
          const clueStr = `${data.clue} ${data.count}`
          return {
            ...prev,
            streamingRole: 'guesser',
            lastRedClue: team === 'red' ? clueStr : prev.lastRedClue,
            lastBlueClue: team === 'blue' ? clueStr : prev.lastBlueClue,
          }
        }

        case 'guess': {
          return {
            ...prev,
            lastGuessWord: data.word as string,
          }
        }

        case 'turn_end': {
          return {
            ...prev,
            streamingTeam: null,
            streamingRole: null,
            lastGuessWord: null,
          }
        }

        case 'game_over': {
          return {
            ...prev,
            streamingTeam: null,
            streamingRole: null,
          }
        }

        case 'error': {
          return { ...prev, error: data.message as string }
        }

        default:
          return prev
      }
    })
  }

  useEffect(() => {
    connectSSE()
    return () => {
      sseRef.current?.close()
    }
  }, [connectSSE])

  async function handleStart() {
    await fetch(`/api/games/${id}/start`, { method: 'POST' })
  }

  async function handlePause() {
    await fetch(`/api/games/${id}/pause`, { method: 'POST' })
  }

  async function handleSpeedChange(ms: number) {
    await fetch(`/api/games/${id}/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speedMs: ms }),
    })
    setState(prev =>
      prev.game ? { ...prev, game: { ...prev.game!, speedMs: ms } } : prev
    )
  }

  const { game, streamingTeam, streamingRole, redStreamText, blueStreamText,
          lastRedClue, lastBlueClue, lastGuessWord, error } = state

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 mb-2">
            {connected ? 'Loading game...' : 'Connecting...'}
          </div>
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-gray-400 hover:text-white text-sm transition-colors"
            >
              ← Home
            </button>
            <h1 className="text-base font-bold text-white">
              Codenames <span className="text-blue-400">Agents</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {!connected && (
              <span className="text-xs text-yellow-400 animate-pulse">Reconnecting...</span>
            )}
            {game.winner && (
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                game.winner === 'red'
                  ? 'bg-red-800/60 text-red-200'
                  : 'bg-blue-800/60 text-blue-200'
              }`}>
                🏆 {game.winner.toUpperCase()} WINS!
              </span>
            )}
            <span className="text-xs text-gray-500">
              Turn {game.turnNumber}
            </span>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-700 px-4 py-2 text-sm text-red-300 text-center">
          Error: {error}
          <button
            onClick={() => setState(p => ({ ...p, error: null }))}
            className="ml-3 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-[280px_1fr_280px] gap-4">

        {/* Left: Red team */}
        <div className="flex flex-col gap-4">
          <TeamPanel
            team="red"
            game={game}
            streamingRole={streamingTeam === 'red' ? streamingRole : null}
            streamingText={redStreamText}
            lastClue={lastRedClue}
            isActive={game.currentTeam === 'red' || streamingTeam === 'red'}
          />
        </div>

        {/* Center: Board + controls + history */}
        <div className="flex flex-col gap-4">
          <GameBoard
            board={game.board}
            lastGuessWord={lastGuessWord ?? undefined}
            currentTeam={game.status === 'finished' ? undefined : game.currentTeam}
          />

          <GameControls
            status={game.status}
            speedMs={game.speedMs}
            onStart={handleStart}
            onPause={handlePause}
            onSpeedChange={handleSpeedChange}
          />

          <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Turn History</h3>
            <GameHistory turns={game.turns} autoScroll={game.status !== 'finished'} />
          </div>
        </div>

        {/* Right: Blue team */}
        <div className="flex flex-col gap-4">
          <TeamPanel
            team="blue"
            game={game}
            streamingRole={streamingTeam === 'blue' ? streamingRole : null}
            streamingText={blueStreamText}
            lastClue={lastBlueClue}
            isActive={game.currentTeam === 'blue' || streamingTeam === 'blue'}
          />
        </div>
      </div>
    </div>
  )
}
