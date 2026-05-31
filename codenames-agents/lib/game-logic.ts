import { Card, CardColor, Team, Game, TurnEntry } from '@/types/game'
import { WORDS } from './words'

export function createBoard(): Card[] {
  const shuffled = [...WORDS].sort(() => Math.random() - 0.5).slice(0, 25)

  const colors: CardColor[] = [
    ...Array(9).fill('red'),
    ...Array(8).fill('blue'),
    ...Array(7).fill('neutral'),
    'assassin',
  ]

  const shuffledColors = [...colors].sort(() => Math.random() - 0.5)

  return shuffled.map((word, i) => ({
    word,
    color: shuffledColors[i],
    revealed: false,
  }))
}

export function applyGuess(board: Card[], word: string): { board: Card[]; color: CardColor } {
  const upper = word.toUpperCase()
  const newBoard = board.map(card =>
    card.word.toUpperCase() === upper ? { ...card, revealed: true } : card
  )
  const card = board.find(c => c.word.toUpperCase() === upper)
  return { board: newBoard, color: card?.color ?? 'neutral' }
}

export function checkWin(board: Card[]): Team | null {
  const redLeft = board.filter(c => c.color === 'red' && !c.revealed).length
  const blueLeft = board.filter(c => c.color === 'blue' && !c.revealed).length
  if (redLeft === 0) return 'red'
  if (blueLeft === 0) return 'blue'
  return null
}

export function getScore(board: Card[]): { red: number; blue: number } {
  return {
    red: board.filter(c => c.color === 'red' && c.revealed).length,
    blue: board.filter(c => c.color === 'blue' && c.revealed).length,
  }
}

export function getTotalCards(board: Card[]): { red: number; blue: number } {
  return {
    red: board.filter(c => c.color === 'red').length,
    blue: board.filter(c => c.color === 'blue').length,
  }
}

export function buildClueGiverContext(game: Game, team: Team): string {
  const enemyColor: CardColor = team === 'red' ? 'blue' : 'red'

  const myCards = game.board.filter(c => c.color === team)
  const enemyCards = game.board.filter(c => c.color === enemyColor)
  const neutralCards = game.board.filter(c => c.color === 'neutral')
  const assassin = game.board.find(c => c.color === 'assassin')

  const lines: string[] = [
    `=== CODENAMES BOARD ===`,
    ``,
    `YOUR TEAM (${team.toUpperCase()}) — ${myCards.filter(c => !c.revealed).length} cards remaining:`,
    ...myCards.map(c => `  ${c.word}${c.revealed ? ' [REVEALED]' : ' ← find this'}`),
    ``,
    `ENEMY TEAM (${enemyColor.toUpperCase()}) — AVOID these ${enemyCards.filter(c => !c.revealed).length} unrevealed cards:`,
    ...enemyCards.map(c => `  ${c.word}${c.revealed ? ' [REVEALED]' : ''}`),
    ``,
    `NEUTRAL CARDS — avoid:`,
    ...neutralCards.map(c => `  ${c.word}${c.revealed ? ' [REVEALED]' : ''}`),
    ``,
    `⚠ ASSASSIN (instant loss if guessed): ${assassin?.word ?? '?'}${assassin?.revealed ? ' [REVEALED]' : ''}`,
  ]

  const clueTurns = game.turns.filter(t => t.phase === 'clue')
  if (clueTurns.length > 0) {
    lines.push(``, `=== PREVIOUS CLUES (all teams) ===`)
    for (const t of clueTurns) {
      const guesses = game.turns.filter(g => g.phase === 'guess' && g.turnNumber === t.turnNumber && g.team === t.team)
      const guessStr = guesses.map(g => `${g.action}(${g.result})`).join(', ')
      lines.push(`  Turn ${t.turnNumber} ${t.team.toUpperCase()} clue: ${t.action} → guesses: ${guessStr || 'none'}`)
    }
  }

  return lines.join('\n')
}

export function buildGuesserContext(game: Game, team: Team, clue: string, count: number): string {
  const enemyColor: Team = team === 'red' ? 'blue' : 'red'

  const myCardsLeft = game.board.filter(c => c.color === team && !c.revealed).length
  const enemyCardsLeft = game.board.filter(c => c.color === enemyColor && !c.revealed).length

  const unrevealed = game.board.filter(c => !c.revealed)
  const revealed = game.board.filter(c => c.revealed)

  const lines: string[] = [
    `=== CODENAMES BOARD (you cannot see card colors) ===`,
    ``,
    `UNREVEALED words (your valid choices):`,
    ...unrevealed.map(c => `  ${c.word}`),
    ``,
    `ALREADY REVEALED (do NOT guess these):`,
    ...revealed.map(c => `  ${c.word} [${c.color.toUpperCase()}]`),
    ``,
    `Your team: ${team.toUpperCase()} (${myCardsLeft} cards left to find)`,
    `Opponent: ${enemyColor.toUpperCase()} (${enemyCardsLeft} cards left to find)`,
    ``,
    `=== CURRENT CLUE ===`,
    `Clue word: "${clue}" for ${count} card(s)`,
    `You may guess up to ${count + 1} words total (${count} for the clue + 1 bonus).`,
  ]

  const myPastClues = game.turns.filter(t => t.phase === 'clue' && t.team === team)
  if (myPastClues.length > 0) {
    lines.push(``, `=== YOUR TEAM'S PAST CLUES ===`)
    for (const t of myPastClues) {
      const pastGuesses = game.turns.filter(
        g => g.phase === 'guess' && g.turnNumber === t.turnNumber && g.team === team
      )
      const guessStr = pastGuesses.map(g => `${g.action}(${g.result})`).join(', ')
      lines.push(`  "${t.action}" → guessed: ${guessStr || 'none'}`)
    }
    lines.push(`Note: unrevealed words from past clues may still be guessable as a bonus guess.`)
  }

  return lines.join('\n')
}

export function formatTurnHistory(turns: TurnEntry[]): string {
  const lines: string[] = []
  let currentTurn = -1

  for (const t of turns) {
    if (t.phase === 'clue') {
      if (currentTurn !== t.turnNumber) {
        lines.push(`--- Turn ${t.turnNumber} (${t.team.toUpperCase()}) ---`)
        currentTurn = t.turnNumber
      }
      lines.push(`  Clue: ${t.action}`)
    } else {
      lines.push(`  Guess: ${t.action} → ${t.result ?? '?'}`)
    }
  }

  return lines.join('\n')
}
