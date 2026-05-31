import { NextRequest } from 'next/server'
import { getGame } from '@/lib/db'
import { getOrCreateRunner } from '@/lib/game-runner-store'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: gameId } = await params

  const game = getGame(gameId)
  if (!game) {
    return new Response('Game not found', { status: 404 })
  }

  const runnerState = getOrCreateRunner(gameId)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      function send(data: unknown) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Controller closed
        }
      }

      // Send current game state immediately on connect
      send({ type: 'game_state', gameId, data: { game } })

      const onEvent = (event: unknown) => send(event)
      runnerState.emitter.on('event', onEvent)

      req.signal.addEventListener('abort', () => {
        runnerState.emitter.off('event', onEvent)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
