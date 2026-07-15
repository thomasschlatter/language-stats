// Optional cloud LLM (Anthropic Messages API). Used when ANTHROPIC_API_KEY is
// set — for the Foxy bot, the help assistant, and conversation practice — with
// the small local model as a fallback. Never throws to callers that guard on
// llmAvailable(); errors bubble so the caller can fall back.
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.LLM_MODEL || 'claude-haiku-4-5-20251001';

export function llmAvailable() { return !!KEY; }

export async function llmChat({ system, messages, maxTokens = 300, temperature = 0.7 }) {
  if (!KEY) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature, system, messages }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || []).map((c) => c.text || '').join('').trim();
}
