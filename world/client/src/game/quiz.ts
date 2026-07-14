import { STARTER } from './starterWords'

// Shared quiz loader for all word games. Tries the player's real deck cards via
// the API; if they have too few (or aren't signed in), falls back to bundled
// starter vocabulary so the games are always playable. Starter items carry no
// card id, so they don't touch the SRS schedule.
export type QuizItem = { id?: number; front: string; answer: string; choices: string[]; frontChoices?: string[] }

const shuffle = <T>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildItems(words: { front: string; answer: string }[], n: number): QuizItem[] {
  const backs = [...new Set(words.map((w) => w.answer))]
  const fronts = [...new Set(words.map((w) => w.front))]
  return shuffle([...words]).slice(0, n).map((w) => ({
    front: w.front,
    answer: w.answer,
    choices: shuffle([w.answer, ...shuffle(backs.filter((b) => b !== w.answer)).slice(0, 3)]),
    frontChoices: shuffle([w.front, ...shuffle(fronts.filter((f) => f !== w.front)).slice(0, 3)]),
  }))
}

export async function loadQuiz(lang: string, n: number): Promise<{ items: QuizItem[]; starter: boolean }> {
  try {
    const res = await fetch(`/api/flashcards/quiz?lang=${encodeURIComponent(lang)}&n=${n}`, { credentials: 'same-origin' })
    if (res.ok) {
      const items = ((await res.json()).items || []) as QuizItem[]
      if (items.length >= 1) return { items, starter: false }
    }
  } catch { /* fall through to starter vocabulary */ }

  const words = STARTER[lang] || STARTER[lang.split('-')[0]] || []
  if (words.length >= 4) return { items: buildItems(words, n), starter: true }
  return { items: [], starter: false }
}
