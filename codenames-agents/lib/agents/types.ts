import { AgentConfig, Team, Game } from '@/types/game'

export interface ClueResult {
  clue: string
  count: number
  thinking: string
  fullResponse: string
}

export interface GuessResult {
  guesses: string[]
  thinking: string
  fullResponse: string
}

export interface AgentCallContext {
  game: Game
  team: Team
  config: AgentConfig
  onToken: (token: string) => void
}
