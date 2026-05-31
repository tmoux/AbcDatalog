import { NextRequest, NextResponse } from 'next/server'
import { getGame, updateGame } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const speedMs = Number(body.speedMs)

  if (!speedMs || speedMs < 200 || speedMs > 10000) {
    return NextResponse.json({ error: 'speedMs must be between 200 and 10000' }, { status: 400 })
  }

  const game = getGame(id)
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  updateGame({ ...game, speedMs })
  return NextResponse.json({ success: true })
}
