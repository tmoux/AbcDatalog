import { NextRequest, NextResponse } from 'next/server'
import { getGame, updateGame } from '@/lib/db'
import { pauseRunner, getOrCreateRunner } from '@/lib/game-runner-store'

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

  pauseRunner(id)
  const updatedGame = { ...game, status: 'paused' as const }
  updateGame(updatedGame)

  const runner = getOrCreateRunner(id)
  runner.emitter.emit('event', {
    type: 'game_state',
    gameId: id,
    data: { game: updatedGame },
  })

  return NextResponse.json({ success: true })
}
