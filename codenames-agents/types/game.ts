export type CardColor = 'red' | 'blue' | 'neutral' | 'assassin'
export type Team = 'red' | 'blue'
export type GameStatus = 'setup' | 'running' | 'paused' | 'finished'
export type TurnPhase = 'clue' | 'guess'
export type GuessResult = 'correct' | 'wrong' | 'neutral' | 'assassin'

export interface Card {
  word: string
  color: CardColor
  revealed: boolean
}

export interface StrategyFlags {
  aggressiveness: 'low' | 'medium' | 'high'
  multiWordFocus: boolean
  usePreviousClues: boolean
}

export interface AgentConfig {
  name: string
  model: string
  provider: 'anthropic'
  systemPrompt: string
  temperature: number
  strategyFlags: StrategyFlags
}

export interface TurnEntry {
  id: string
  gameId: string
  turnNumber: number
  team: Team
  phase: TurnPhase
  agentName: string
  thinking: string
  action: string
  result: GuessResult | null
  boardSnapshot: Card[]
  timestamp: number
}

export interface Game {
  id: string
  status: GameStatus
  winner: Team | null
  board: Card[]
  currentTeam: Team
  turnNumber: number
  speedMs: number
  redClueGiver: AgentConfig
  redGuesser: AgentConfig
  blueClueGiver: AgentConfig
  blueGuesser: AgentConfig
  turns: TurnEntry[]
  createdAt: number
  finishedAt: number | null
}

export interface GameSummary {
  id: string
  status: GameStatus
  winner: Team | null
  redClueGiverName: string
  blueClueGiverName: string
  createdAt: number
  finishedAt: number | null
  turnCount: number
}

export interface SSEEvent {
  type:
    | 'thinking_token'
    | 'clue'
    | 'guess'
    | 'turn_end'
    | 'game_state'
    | 'game_over'
    | 'error'
    | 'status'
  gameId: string
  data: Record<string, unknown>
}
