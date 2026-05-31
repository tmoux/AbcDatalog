import { NextRequest, NextResponse } from 'next/server'
import { createGame, listGames } from '@/lib/db'
import { createBoard } from '@/lib/game-logic'
import { Game, AgentConfig } from '@/types/game'

const DEFAULT_CLUE_GIVER_PROMPT = ''
const DEFAULT_GUESSER_PROMPT = ''

function defaultAgent(name: string, role: 'clue-giver' | 'guesser'): AgentConfig {
  return {
    name,
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    systemPrompt: role === 'clue-giver' ? DEFAULT_CLUE_GIVER_PROMPT : DEFAULT_GUESSER_PROMPT,
    temperature: role === 'clue-giver' ? 0.7 : 0.4,
    strategyFlags: {
      aggressiveness: 'medium',
      multiWordFocus: true,
      usePreviousClues: true,
    },
  }
}

export async function GET() {
  const games = listGames()
  return NextResponse.json(games)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))

  const game: Game = {
    id: crypto.randomUUID(),
    status: 'setup',
    winner: null,
    board: createBoard(),
    currentTeam: 'red',
    turnNumber: 1,
    speedMs: body.speedMs ?? 2000,
    redClueGiver: body.redClueGiver ?? defaultAgent('Red Spymaster', 'clue-giver'),
    redGuesser: body.redGuesser ?? defaultAgent('Red Field Agent', 'guesser'),
    blueClueGiver: body.blueClueGiver ?? defaultAgent('Blue Spymaster', 'clue-giver'),
    blueGuesser: body.blueGuesser ?? defaultAgent('Blue Field Agent', 'guesser'),
    turns: [],
    createdAt: Date.now(),
    finishedAt: null,
  }

  createGame(game)
  return NextResponse.json({ id: game.id }, { status: 201 })
}
