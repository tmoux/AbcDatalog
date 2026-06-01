import { EventEmitter } from 'events'
import { Game, Team, TurnEntry, GuessResult } from '@/types/game'
import { generateClue } from './clue-giver'
import { generateGuesses } from './guesser'
import { applyGuess, checkWin } from '../game-logic'
import { updateGame, insertTurn, getGame } from '../db'

function emit(emitter: EventEmitter, gameId: string, type: string, data: Record<string, unknown>) {
  emitter.emit('event', { type, gameId, data })
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export async function executeTurn(game: Game, emitter: EventEmitter): Promise<Game> {
  const team = game.currentTeam
  const clueGiverConfig = team === 'red' ? game.redClueGiver : game.blueClueGiver
  const guesserConfig = team === 'red' ? game.redGuesser : game.blueGuesser

  emit(emitter, game.id, 'status', {
    team,
    role: 'clue-giver',
    agentName: clueGiverConfig.name,
    phase: 'thinking',
  })

  let clueThinkingText = ''
  const { clue, count, thinking: clueThinking } = await generateClue(
    game,
    team,
    clueGiverConfig,
    token => {
      clueThinkingText += token
      emit(emitter, game.id, 'thinking_token', { team, role: 'clue-giver', token })
    },
  )
  void clueThinkingText

  const clueTurn: TurnEntry = {
    id: crypto.randomUUID(),
    gameId: game.id,
    turnNumber: game.turnNumber,
    team,
    phase: 'clue',
    agentName: clueGiverConfig.name,
    thinking: clueThinking,
    action: `${clue} ${count}`,
    result: null,
    boardSnapshot: JSON.parse(JSON.stringify(game.board)),
    timestamp: Date.now(),
  }

  game = { ...game, turns: [...game.turns, clueTurn] }
  insertTurn(clueTurn)
  emit(emitter, game.id, 'clue', { team, clue, count, agentName: clueGiverConfig.name })

  await sleep(500)

  emit(emitter, game.id, 'status', {
    team,
    role: 'guesser',
    agentName: guesserConfig.name,
    phase: 'thinking',
  })

  let guesserThinkingText = ''
  const { guesses, thinking: guesserThinking } = await generateGuesses(
    game,
    team,
    guesserConfig,
    clue,
    count,
    token => {
      guesserThinkingText += token
      emit(emitter, game.id, 'thinking_token', { team, role: 'guesser', token })
    },
  )
  void guesserThinkingText

  let updatedBoard = [...game.board]

  for (const guessWord of guesses) {
    const cardOnBoard = updatedBoard.find(
      c => c.word.toUpperCase() === guessWord && !c.revealed
    )

    if (!cardOnBoard) {
      const invalidTurn: TurnEntry = {
        id: crypto.randomUUID(),
        gameId: game.id,
        turnNumber: game.turnNumber,
        team,
        phase: 'guess',
        agentName: guesserConfig.name,
        thinking: guesserThinking,
        action: guessWord,
        result: 'wrong',
        boardSnapshot: JSON.parse(JSON.stringify(updatedBoard)),
        timestamp: Date.now(),
      }
      game = { ...game, turns: [...game.turns, invalidTurn], board: updatedBoard }
      insertTurn(invalidTurn)
      emit(emitter, game.id, 'guess', { team, word: guessWord, result: 'wrong', reason: 'invalid' })
      break
    }

    const { board: newBoard, color } = applyGuess(updatedBoard, guessWord)
    updatedBoard = newBoard

    let result: GuessResult
    if (color === team) {
      result = 'correct'
    } else if (color === 'assassin') {
      result = 'assassin'
    } else if (color === 'neutral') {
      result = 'neutral'
    } else {
      result = 'wrong'
    }

    const guessTurn: TurnEntry = {
      id: crypto.randomUUID(),
      gameId: game.id,
      turnNumber: game.turnNumber,
      team,
      phase: 'guess',
      agentName: guesserConfig.name,
      thinking: guesserThinking,
      action: guessWord,
      result,
      boardSnapshot: JSON.parse(JSON.stringify(updatedBoard)),
      timestamp: Date.now(),
    }
    game = { ...game, board: updatedBoard, turns: [...game.turns, guessTurn] }
    insertTurn(guessTurn)

    emit(emitter, game.id, 'guess', { team, word: guessWord, result, color })

    const winner = checkWin(updatedBoard)
    if (winner) {
      game = { ...game, status: 'finished', winner, finishedAt: Date.now() }
      updateGame(game)
      emit(emitter, game.id, 'game_state', { game })
      emit(emitter, game.id, 'game_over', { winner, reason: 'all_found' })
      return game
    }

    if (result === 'assassin') {
      const winningTeam: Team = team === 'red' ? 'blue' : 'red'
      game = { ...game, status: 'finished', winner: winningTeam, finishedAt: Date.now() }
      updateGame(game)
      emit(emitter, game.id, 'game_state', { game })
      emit(emitter, game.id, 'game_over', { winner: winningTeam, reason: 'assassin' })
      return game
    }

    if (result !== 'correct') {
      break
    }

    await sleep(300)
  }

  const nextTeam: Team = team === 'red' ? 'blue' : 'red'
  // Re-read DB status so an external pause set during the LLM call isn't overwritten
  const latestStatus = getGame(game.id)?.status
  game = {
    ...game,
    board: updatedBoard,
    currentTeam: nextTeam,
    turnNumber: game.turnNumber + 1,
    status: latestStatus === 'paused' ? 'paused' : 'running',
  }

  updateGame(game)
  emit(emitter, game.id, 'turn_end', { team, nextTeam })
  emit(emitter, game.id, 'game_state', { game })

  return game
}
