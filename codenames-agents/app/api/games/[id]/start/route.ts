import { NextRequest, NextResponse } from 'next/server'
import { getGame, updateGame } from '@/lib/db'
import { getOrCreateRunner, resumeRunner } from '@/lib/game-runner-store'
import { executeTurn } from '@/lib/agents/runner'

async function runGameLoop(gameId: string): Promise<void> {
  const runnerState = getOrCreateRunner(gameId)
  if (runnerState.loopRunning) return
  runnerState.loopRunning = true

  try {
    while (true) {
      // Wait while paused
      while (runnerState.paused) {
        await new Promise(r => setTimeout(r, 200))
      }

      const game = getGame(gameId)
      // Only exit the loop when the game is finished, not when paused
      if (!game || game.status === 'finished') break

      const updatedGame = await executeTurn(game, runnerState.emitter)
      if (updatedGame.status === 'finished') break

      // Wait between turns (re-read in case speed was changed)
      const fresh = getGame(gameId)
      const delay = fresh?.speedMs ?? 2000
      await new Promise(r => setTimeout(r, delay))
    }
  } catch (err) {
    console.error(`[game-loop] ${gameId}:`, err)
    const runner = getOrCreateRunner(gameId)
    runner.emitter.emit('event', {
      type: 'error',
      gameId,
      data: { message: String(err) },
    })
    const game = getGame(gameId)
    if (game && game.status === 'running') {
      updateGame({ ...game, status: 'paused' })
      runner.emitter.emit('event', {
        type: 'game_state',
        gameId,
        data: { game: { ...game, status: 'paused' } },
      })
    }
  } finally {
    runnerState.loopRunning = false
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const game = getGame(id)

  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (game.status === 'finished') {
    return NextResponse.json({ error: 'Game already finished' }, { status: 400 })
  }

  resumeRunner(id)
  const updatedGame = { ...game, status: 'running' as const }
  updateGame(updatedGame)

  const runnerState = getOrCreateRunner(id)
  runnerState.emitter.emit('event', {
    type: 'game_state',
    gameId: id,
    data: { game: updatedGame },
  })

  runGameLoop(id)

  return NextResponse.json({ success: true })
}
