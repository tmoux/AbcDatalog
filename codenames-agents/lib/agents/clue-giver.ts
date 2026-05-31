import { AgentConfig, Game, Team } from '@/types/game'
import { buildClueGiverContext } from '../game-logic'
import { streamCompletion } from '../providers/anthropic'
import { ClueResult } from './types'

const DEFAULT_SYSTEM_PROMPT = (team: Team, config: AgentConfig): string => {
  const ag = config.strategyFlags.aggressiveness
  const mw = config.strategyFlags.multiWordFocus

  return `You are an expert Codenames clue giver for the ${team.toUpperCase()} team.

YOUR GOAL: Give a ONE-WORD clue and a NUMBER so your guesser finds as many of your team's cards as possible without touching enemy cards, neutral cards, or — critically — the ASSASSIN.

RULES:
- Clue must be exactly ONE English word (no hyphens, no proper nouns that directly relate to a board word)
- The clue word must NOT appear on the board and must not be a plural/conjugation/stem of any board word
- The number tells your guesser how many of your cards relate to the clue
- You may say 0 as the number to signal an unusual/defensive clue

STRATEGY (your current settings):
- Aggressiveness: ${ag.toUpperCase()} ${ag === 'high' ? '→ Push for high-count clues, accept calculated risks' : ag === 'low' ? '→ Play it safe, prefer clues for 1-2 cards with very low risk' : '→ Balance coverage and safety, aim for 2-3 cards when safe'}
- Multi-word focus: ${mw ? 'ON → Strongly prefer clues that connect 3+ of your cards' : 'OFF → Prioritize accuracy over quantity'}

THINKING PROCESS (do this before answering):
1. List all your team's unrevealed cards
2. Brainstorm semantic clusters — which words share a theme, category, or concept?
3. For each candidate clue, check: could it accidentally lead the guesser to enemy cards or the ASSASSIN?
4. Score each cluster by (cards covered - risk). Pick the best.
5. Consider previous turn history: are there cards that were close but missed before?
6. If no multi-card clue is safe, give a single-card clue confidently.

OUTPUT FORMAT:
Think out loud first (this will be shown as your reasoning).
Then on its own line, output EXACTLY:
CLUE: <WORD> <NUMBER>

Example: CLUE: WATER 3`
}

export async function generateClue(
  game: Game,
  team: Team,
  config: AgentConfig,
  onToken: (token: string) => void,
): Promise<ClueResult> {
  const systemPrompt = config.systemPrompt.trim()
    ? config.systemPrompt
    : DEFAULT_SYSTEM_PROMPT(team, config)

  const userMessage = buildClueGiverContext(game, team)

  const fullText = await streamCompletion(
    { model: config.model, systemPrompt, temperature: config.temperature },
    userMessage,
    onToken,
  )

  const match = fullText.match(/CLUE:\s*([A-Za-z'-]+)\s+(\d+)/i)
  if (!match) {
    throw new Error(`Clue giver failed to produce a valid CLUE: line. Response: ${fullText.slice(-300)}`)
  }

  const clueWord = match[1].toUpperCase()
  const count = parseInt(match[2], 10)
  const clueIndex = fullText.lastIndexOf(match[0])
  const thinking = fullText.slice(0, clueIndex).trim()

  return { clue: clueWord, count, thinking, fullResponse: fullText }
}
