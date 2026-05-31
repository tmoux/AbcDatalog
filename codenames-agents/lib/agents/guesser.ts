import { AgentConfig, Game, Team } from '@/types/game'
import { buildGuesserContext } from '../game-logic'
import { streamCompletion } from '../providers/anthropic'
import { GuessResult } from './types'

const DEFAULT_SYSTEM_PROMPT = (team: Team, config: AgentConfig): string => {
  const usePrev = config.strategyFlags.usePreviousClues
  const ag = config.strategyFlags.aggressiveness

  return `You are an expert Codenames guesser for the ${team.toUpperCase()} team.

YOUR GOAL: Given a one-word clue and a number, identify which unrevealed board words your clue giver intended. Maximize correct guesses while avoiding wrong cards — especially the ASSASSIN (instant loss).

RULES:
- You can guess UP TO (number + 1) words total this turn
- Only guess words that are currently unrevealed on the board
- Output each guess as: GUESS: <WORD>
- When you want to stop (or after your last guess), output: PASS
- Guessing a neutral card or enemy card ends your turn; guessing the ASSASSIN ends the game

STRATEGY (your current settings):
- Aggressiveness: ${ag.toUpperCase()} ${ag === 'high' ? '→ Lean into uncertain guesses, use the full number+1 allowance' : ag === 'low' ? '→ Stop early if in doubt, never guess on low confidence' : '→ Use standard confidence threshold, stop if unsure'}
${usePrev ? `- Previous-clue recall: ON → After the main clue's cards, check past clues for unrevealed cards you can now confidently identify\n  (Use your +1 bonus guess for a high-confidence past-clue card)` : '- Previous-clue recall: OFF → Focus only on the current clue, do not use the bonus guess'}

THINKING PROCESS (do this before answering):
1. Consider all unrevealed words on the board
2. Rank them by semantic similarity/connection to the clue word
3. Identify your top candidates for the clue's intended cards
4. For each candidate: what's the chance it's an enemy card or the ASSASSIN?
5. Decide your stopping point based on confidence and aggressiveness setting
${usePrev ? '6. Review past clues: is there an unrevealed card you are now very sure of? If yes, use it as your bonus guess.' : ''}

OUTPUT FORMAT:
Think out loud first. Then list your guesses in confidence order, followed by PASS:

GUESS: WORD1
GUESS: WORD2
PASS`
}

export async function generateGuesses(
  game: Game,
  team: Team,
  config: AgentConfig,
  clue: string,
  count: number,
  onToken: (token: string) => void,
): Promise<GuessResult> {
  const systemPrompt = config.systemPrompt.trim()
    ? config.systemPrompt
    : DEFAULT_SYSTEM_PROMPT(team, config)

  const userMessage = buildGuesserContext(game, team, clue, count)

  const fullText = await streamCompletion(
    { model: config.model, systemPrompt, temperature: config.temperature },
    userMessage,
    onToken,
  )

  const guessMatches = [...fullText.matchAll(/GUESS:\s*([A-Za-z'-]+)/gi)]
  const rawGuesses = guessMatches.map(m => m[1].toUpperCase())

  // Limit to count+1
  const guesses = rawGuesses.slice(0, count + 1)

  const firstGuessIndex = guessMatches.length > 0
    ? fullText.indexOf(guessMatches[0][0])
    : fullText.length
  const thinking = fullText.slice(0, firstGuessIndex).trim()

  return { guesses, thinking, fullResponse: fullText }
}
