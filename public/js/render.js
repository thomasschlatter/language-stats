// The core idea of the whole site: render ANY prose so that every word becomes
// a language-tagged, clickable element — conceptually:
//
//     <span class="w" data-lang="de-DE">ich</span>
//     <span class="w" data-lang="de-DE">heiße</span> ...
//
// Clicking a word resolves to its translation in the reader's NATIVE locale
// (chosen in the top-bar options) and navigates there. Non-word characters
// (spaces, punctuation) are preserved as plain text.

import { api } from './api.js';
import { store } from './store.js';
import { el } from './dom.js';
import { navigate } from './router.js';

// A "word" = a run of Unicode letters/marks, allowing internal ' and -.
const WORD_RE = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;

// Turn text (all in locale `langCode`) into a document fragment of word links
// interleaved with the original separators.
export function renderText(text, langCode) {
  const frag = document.createDocumentFragment();
  if (!text) return frag;

  let last = 0;
  for (const m of text.matchAll(WORD_RE)) {
    const start = m.index;
    if (start > last) frag.append(document.createTextNode(text.slice(last, start)));
    frag.append(wordEl(m[0], langCode));
    last = start + m[0].length;
  }
  if (last < text.length) frag.append(document.createTextNode(text.slice(last)));
  return frag;
}

// Make an ENTIRE subtree clickable: walk every text node and replace it with
// language-tagged word links. This is what makes "the whole website clickable"
// — intro text, headings, hints, definitions, everything — without each view
// having to wrap its own strings. Already-tokenized words (.w) and real
// interactive controls are skipped so buttons/nav/inputs keep working.
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'A', 'SELECT', 'OPTION', 'TEXTAREA', 'INPUT']);

export function tokenizeTree(root, defaultLang = 'en-US') {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !/[\p{L}]/u.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      for (let p = node.parentElement; p && p !== root.parentNode; p = p.parentElement) {
        if (p.classList?.contains('w')) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.hasAttribute?.('data-no-tokenize')) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);
  for (const node of targets) {
    const lang = nearestLang(node.parentElement, root) || defaultLang;
    node.parentNode.replaceChild(renderText(node.nodeValue, lang), node);
  }
}

// Nearest ancestor lang / data-lang, so a block written in one locale tags all
// its words with that locale.
function nearestLang(elm, root) {
  for (let p = elm; p && p !== root.parentNode; p = p.parentElement) {
    const l = p.getAttribute?.('lang') || p.getAttribute?.('data-lang');
    if (l) return l;
  }
  return null;
}

// A single clickable, language-tagged word.
export function wordEl(word, langCode) {
  return el(
    'span',
    {
      class: 'w',
      'data-lang': langCode,
      lang: langCode,
      title: `${word} · ${langCode}`,
      onclick: () => goToTranslation(word, langCode),
    },
    word
  );
}

// Resolve a click to the right destination and navigate there.
async function goToTranslation(word, fromLang) {
  const native = store.nativeLang;
  try {
    const { target } = await api.resolve(word, fromLang, native);
    navigate(`#/w/${encodeURIComponent(target.languageCode)}/${encodeURIComponent(target.text)}`);
  } catch {
    // Fall back to the word's own page if resolution fails.
    navigate(`#/w/${encodeURIComponent(fromLang)}/${encodeURIComponent(word)}`);
  }
}
