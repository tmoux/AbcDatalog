import { EventEmitter } from 'events'

export interface RunnerState {
  emitter: EventEmitter
  loopRunning: boolean
  paused: boolean
}

declare global {
  // eslint-disable-next-line no-var
  var __gameRunners: Map<string, RunnerState> | undefined
}

const runners: Map<string, RunnerState> = (global.__gameRunners ??= new Map())

export function getOrCreateRunner(gameId: string): RunnerState {
  if (!runners.has(gameId)) {
    const emitter = new EventEmitter()
    emitter.setMaxListeners(100)
    runners.set(gameId, { emitter, loopRunning: false, paused: false })
  }
  return runners.get(gameId)!
}

export function getRunner(gameId: string): RunnerState | undefined {
  return runners.get(gameId)
}

export function pauseRunner(gameId: string): void {
  const r = runners.get(gameId)
  if (r) r.paused = true
}

export function resumeRunner(gameId: string): void {
  const r = runners.get(gameId)
  if (r) r.paused = false
}
