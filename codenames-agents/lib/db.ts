import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { Game, GameSummary, TurnEntry } from '@/types/game'

const DATA_DIR = path.join(process.cwd(), 'data')
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const DB_PATH = path.join(DATA_DIR, 'codenames.db')

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined
}

function getDb(): Database.Database {
  if (!global.__db) {
    global.__db = new Database(DB_PATH)
    global.__db.pragma('journal_mode = WAL')
    initSchema(global.__db)
  }
  return global.__db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      winner TEXT,
      config_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      finished_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS turns (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      turn_number INTEGER NOT NULL,
      team TEXT NOT NULL,
      phase TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      thinking TEXT NOT NULL,
      action TEXT NOT NULL,
      result TEXT,
      board_snapshot TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (game_id) REFERENCES games(id)
    );

    CREATE INDEX IF NOT EXISTS idx_turns_game ON turns(game_id, turn_number);
  `)
}

export function createGame(game: Game): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO games (id, status, winner, config_json, created_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    game.id,
    game.status,
    game.winner,
    JSON.stringify(game),
    game.createdAt,
    game.finishedAt,
  )
}

export function updateGame(game: Game): void {
  const db = getDb()
  db.prepare(`
    UPDATE games SET status = ?, winner = ?, config_json = ?, finished_at = ?
    WHERE id = ?
  `).run(game.status, game.winner, JSON.stringify(game), game.finishedAt, game.id)
}

export function getGame(id: string): Game | null {
  const db = getDb()
  const row = db.prepare('SELECT config_json FROM games WHERE id = ?').get(id) as
    | { config_json: string }
    | undefined
  if (!row) return null
  return JSON.parse(row.config_json) as Game
}

export function listGames(): GameSummary[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT g.id, g.status, g.winner, g.config_json, g.created_at, g.finished_at,
           COUNT(t.id) as turn_count
    FROM games g
    LEFT JOIN turns t ON t.game_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at DESC
    LIMIT 50
  `).all() as Array<{
    id: string
    status: string
    winner: string | null
    config_json: string
    created_at: number
    finished_at: number | null
    turn_count: number
  }>

  return rows.map(row => {
    const config = JSON.parse(row.config_json) as Game
    return {
      id: row.id,
      status: row.status as Game['status'],
      winner: row.winner as Game['winner'],
      redClueGiverName: config.redClueGiver.name,
      blueClueGiverName: config.blueClueGiver.name,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
      turnCount: row.turn_count,
    }
  })
}

export function insertTurn(turn: TurnEntry): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO turns
      (id, game_id, turn_number, team, phase, agent_name, thinking, action, result, board_snapshot, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    turn.id,
    turn.gameId,
    turn.turnNumber,
    turn.team,
    turn.phase,
    turn.agentName,
    turn.thinking,
    turn.action,
    turn.result,
    JSON.stringify(turn.boardSnapshot),
    turn.timestamp,
  )
}

export function getTurns(gameId: string): TurnEntry[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM turns WHERE game_id = ? ORDER BY turn_number ASC, timestamp ASC'
  ).all(gameId) as Array<{
    id: string
    game_id: string
    turn_number: number
    team: string
    phase: string
    agent_name: string
    thinking: string
    action: string
    result: string | null
    board_snapshot: string
    timestamp: number
  }>

  return rows.map(r => ({
    id: r.id,
    gameId: r.game_id,
    turnNumber: r.turn_number,
    team: r.team as TurnEntry['team'],
    phase: r.phase as TurnEntry['phase'],
    agentName: r.agent_name,
    thinking: r.thinking,
    action: r.action,
    result: r.result as TurnEntry['result'],
    boardSnapshot: JSON.parse(r.board_snapshot),
    timestamp: r.timestamp,
  }))
}
