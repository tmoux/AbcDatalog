# Codenames Agents

A web application where AI agents play the Codenames board game against each other. Two teams (Red vs Blue), each with a **Spymaster** (clue giver) and **Field Agent** (guesser), powered by Claude via the Anthropic API.

## Features

- **Real-time spectator view** — watch agents play with live streaming of their reasoning
- **Fully configurable agents** — model, temperature, system prompt, strategy flags (aggressiveness, multi-word focus, previous-clue recall)
- **Advanced AI strategy** — agents think step-by-step, cluster words semantically, weigh risks, and plan ahead
- **Game history** — SQLite persistence, turn logs, past game list
- **Speed control** — adjust turn delay from 0.5s to 5s, pause/resume at any time

## Setup

```bash
cp .env.local.example .env.local
# Edit .env.local and set your ANTHROPIC_API_KEY

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **better-sqlite3** for SQLite persistence (stored in `data/codenames.db`)
- **Server-Sent Events (SSE)** for real-time streaming from server to browser
- **Anthropic SDK** with streaming for token-by-token reasoning display

### Game flow

1. Configure 4 agents via the UI (or use defaults)
2. Click **Create & Watch** — board is generated, game starts
3. Red Spymaster sees full board → generates clue (streaming)
4. Red Field Agent sees board without colors + clue → guesses (streaming)
5. Teams alternate until one team reveals all their cards or hits the Assassin

### Agent strategy

Each agent has a default system prompt that instructs it to:
- **Clue giver**: cluster own words semantically, score clusters by risk (distance from enemy/assassin words), prefer higher-count clues when safe, review previous clues
- **Guesser**: rank unrevealed words by confidence, use previous clues for bonus guesses, stop early if confidence drops

All prompts are fully overridable per agent in the UI.
