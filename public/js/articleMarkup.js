// A small, safe markup language for article/card bodies. It is NOT raw HTML —
// it produces a fixed set of elements, so user-authored cards can't inject
// scripts. Every text run stays plain until the global tokenizer makes its
// words clickable.
//
// Block syntax (line-based):
//   # Heading
//   - bullet item
//   [coverage]                  -> interactive "% of conversation" widget
//   [gender-stats]              -> POS + noun-gender-by-ending analysis widget
//   (blank line)                -> paragraph break
//   anything else               -> paragraph text
//
// Inline syntax:
//   {{de-DE|der Tisch}}         -> a run of text tagged with a locale, so
//                                  German inside an English article is
//                                  recognised (and clickable) as German.

import { el } from './dom.js';

export function parseArticle(src, defaultLang) {
  const lines = String(src).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push(el('p', { class: 'article-p' }, inline(para.join(' '))));
      para = [];
    }
  };
  const flushList = () => {
    if (list) { blocks.push(list); list = null; }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { flushPara(); flushList(); continue; }

    if (line === '[coverage]') {
      flushPara(); flushList();
      blocks.push(el('div', { class: 'coverage-mount' }));
      continue;
    }
    if (line === '[gender-stats]') {
      flushPara(); flushList();
      blocks.push(el('div', { class: 'gender-mount' }));
      continue;
    }
    if (line.startsWith('# ')) {
      flushPara(); flushList();
      blocks.push(el('h2', { class: 'article-h' }, inline(line.slice(2))));
      continue;
    }
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (line.startsWith('- ') || line.startsWith('* ') || ordered) {
      flushPara();
      const tag = ordered ? 'ol' : 'ul';
      // start a fresh list if none open or the bullet type changed
      if (!list || list.tagName.toLowerCase() !== tag) {
        flushList();
        list = el(tag, { class: ordered ? 'article-ol' : 'article-ul' });
      }
      const itemText = ordered ? ordered[1] : line.slice(2);
      list.append(el('li', {}, inline(itemText)));
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();

  // Wrap so the default locale applies to all un-tagged text.
  return el('div', { lang: defaultLang }, blocks);
}

// Turn inline {{locale|text}} runs into language-tagged spans; the rest stays
// plain text (tokenized later under the block's default locale).
function inline(text) {
  const nodes = [];
  const re = /\{\{([^|}]+)\|([^}]*)\}\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(document.createTextNode(text.slice(last, m.index)));
    nodes.push(el('span', { lang: m[1].trim() }, m[2]));
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(document.createTextNode(text.slice(last)));
  return nodes;
}
