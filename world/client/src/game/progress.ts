// Solo word-game progression: a ladder of levels, each a small task tied to a
// specific game. Progress persists in localStorage. The menu shows the current
// task; finishing a game that satisfies it advances you to the next level.

export type GameId = 'shooter' | 'memory' | 'wordfall'

export interface GameResult {
  game: GameId
  score: number
  bestStreak: number
  pairs?: number // memory: pairs matched
  won: boolean
}

export interface Level {
  id: number
  title: string
  game: GameId
  goal: string
  check: (r: GameResult) => boolean
}

export const LEVELS: Level[] = [
  { id: 1, title: 'First shots', game: 'shooter', goal: 'Score 5 in Shooter', check: (r) => r.game === 'shooter' && r.score >= 5 },
  { id: 2, title: 'Memory warm-up', game: 'memory', goal: 'Match 4 pairs in Memory', check: (r) => r.game === 'memory' && (r.pairs || 0) >= 4 },
  { id: 3, title: 'On a roll', game: 'shooter', goal: 'Reach a 5-answer streak', check: (r) => r.game === 'shooter' && r.bestStreak >= 5 },
  { id: 4, title: 'Sharpshooter', game: 'shooter', goal: 'Score 15 in Shooter', check: (r) => r.game === 'shooter' && r.score >= 15 },
  { id: 5, title: 'Memory master', game: 'memory', goal: 'Match a full 8-pair board', check: (r) => r.game === 'memory' && (r.pairs || 0) >= 8 },
  { id: 6, title: 'Quick hands', game: 'wordfall', goal: 'Catch 6 in Word Fall', check: (r) => r.game === 'wordfall' && r.score >= 6 },
  { id: 7, title: 'Word warrior', game: 'shooter', goal: 'Score 25 in Shooter', check: (r) => r.game === 'shooter' && r.score >= 25 },
  { id: 8, title: 'Falling star', game: 'wordfall', goal: 'Catch 12 in Word Fall', check: (r) => r.game === 'wordfall' && r.score >= 12 },
]

const KEY = 'game-progress'

export function completedLevel(): number {
  try { return Number(localStorage.getItem(KEY)) || 0 } catch { return 0 }
}

export function currentLevel(): Level | undefined {
  return LEVELS.find((l) => l.id === completedLevel() + 1)
}

export function allDone(): boolean {
  return completedLevel() >= LEVELS.length
}

/** Record a finished game; advance if it satisfied the current level's task. */
export function recordResult(r: GameResult): { advanced: boolean; level?: Level } {
  const cur = currentLevel()
  if (cur && cur.check(r)) {
    try { localStorage.setItem(KEY, String(cur.id)) } catch { /* ignore */ }
    return { advanced: true, level: cur }
  }
  return { advanced: false }
}
