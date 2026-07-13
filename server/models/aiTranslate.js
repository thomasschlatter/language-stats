// Local AI translation using transformers.js + small OPUS-MT models.
//
// Real (fluent) sentence translation, run entirely on this machine — no Python,
// no external API. Models are lazy-loaded per language pair on first use
// (the first request for a pair downloads ~150MB, then it's cached), so the
// server starts instantly and only pays the cost when translation is used.
//
// Not every language pair has an OPUS-MT model; unavailable pairs reject and
// the caller falls back to the dictionary word-gloss.

let transformersPromise = null;
const pipes = new Map(); // "de-en" -> Promise<pipeline>

async function getPipeline(fromBase, toBase) {
  const key = `${fromBase}-${toBase}`;
  if (!pipes.has(key)) {
    const load = (async () => {
      if (!transformersPromise) transformersPromise = import('@huggingface/transformers');
      const { pipeline } = await transformersPromise;
      return pipeline('translation', `Xenova/opus-mt-${fromBase}-${toBase}`);
    })();
    // If loading fails (e.g. no model for this pair), don't cache the failure.
    load.catch(() => pipes.delete(key));
    pipes.set(key, load);
  }
  return pipes.get(key);
}

export async function aiTranslate({ fromBase, toBase, text }) {
  if (fromBase === toBase) return { translation: text, model: null };
  const pipe = await getPipeline(fromBase, toBase);
  const out = await pipe(text, { max_new_tokens: 512 });
  return {
    translation: out[0].translation_text,
    model: `opus-mt-${fromBase}-${toBase}`,
  };
}

// Translate many strings in one pipeline call (much faster than one-by-one) —
// used to translate a whole article's segments at once.
export async function aiTranslateBatch({ fromBase, toBase, texts }) {
  if (!texts.length) return [];
  if (fromBase === toBase) return texts.slice();
  const pipe = await getPipeline(fromBase, toBase);
  const out = await pipe(texts, { max_new_tokens: 512 });
  const arr = Array.isArray(out) ? out : [out];
  return arr.map((o) => o.translation_text);
}

// Whether a pair is already loaded (so the frontend can warn about first-load).
export function isPairReady(fromBase, toBase) {
  return pipes.has(`${fromBase}-${toBase}`);
}
