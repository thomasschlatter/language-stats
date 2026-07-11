// Word-gloss "translation": for each word in a text, look up its translation
// into the target locale using the community dictionary graph. This is not
// fluent machine translation — it glosses the words the dictionary knows, and
// improves as users add and link more words.
import { getEntry, getLinkedWords } from './words.js';

const WORD_RE = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;

export function glossText({ fromLangId, toCode, text }) {
  const tokens = [];
  let known = 0;
  for (const m of String(text).matchAll(WORD_RE)) {
    const word = m[0];
    let translation = null;
    const entry = getEntry(fromLangId, word);
    if (entry) {
      const link = getLinkedWords(entry.id).find(
        (l) => l.type === 'translation' && l.language_code === toCode
      );
      if (link) { translation = link.text; known += 1; }
    }
    tokens.push({ word, translation });
  }
  return { tokens, known };
}
