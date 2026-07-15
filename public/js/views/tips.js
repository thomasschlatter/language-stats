// Tips view: community language-learning advice. Tip bodies are markdown-based
// (the same small markup as articles: # headings, - lists, {{locale|word}}),
// so every word is clickable and any list can be turned into a flashcard deck.
// Authors can edit their own tips.

import { api } from '../api.js';
import { store } from '../store.js';
import { el, clear, openModal } from '../dom.js';
import { renderText, tokenizeTree } from '../render.js';
import { parseArticle } from '../articleMarkup.js';
import { attachDeckButtons, attachAnkiButtons } from './listToDeck.js';
import { voteButton } from './voteButton.js';
import { navigate } from '../router.js';
import { toast } from '../toast.js';

// A tip's own page (a "card" in the unified list links here). Same layout as an
// article: title, vote, author-only edit, markdown body with clickable words and
// list→deck buttons.
export async function renderTip(id) {
  const view = clear(document.getElementById('view'));
  view.append(el('p', { class: 'muted' }, 'Loading…'));

  let tip;
  try {
    tip = (await api.tip(id)).tip;
  } catch (ex) {
    clear(view).append(el('p', { class: 'error' }, ex.message));
    return;
  }

  clear(view);
  const bodyLang = tip.body_lang || store.nativeLang;
  const canEdit = store.user && store.user.id === tip.user_id;
  const language = store.languages.find((l) => l.code === tip.language_code);

  const container = el('article', { class: 'article', lang: bodyLang }, [
    el('a', { href: `#/lang/${encodeURIComponent(tip.language_code)}`, class: 'muted back' }, `← ${tip.language_name}`),
    el('div', { class: 'article-head' }, [
      el('h1', {}, renderText(tip.title, bodyLang)),
      el('div', { class: 'row', style: 'gap:0.5rem; align-items:center' }, [
        canEdit ? el('button', { class: 'btn small secondary', onclick: () => openTipEditor(language, () => renderTip(id), tip) }, 'Edit') : null,
        canEdit ? el('button', {
          class: 'btn small danger',
          onclick: async () => {
            if (!confirm('Delete this tip? This cannot be undone.')) return;
            try { await api.deleteTip(id); toast('Tip deleted.', 'success'); navigate(`#/lang/${encodeURIComponent(tip.language_code)}/tips`); }
            catch (ex) { toast(ex.message || 'Could not delete.', 'error'); }
          },
        }, 'Delete') : null,
        voteButton(tip, api.voteTip),
      ]),
    ]),
    el('div', { class: 'article-meta' }, `by @${tip.author} · about ${tip.language_name} · written in ${bodyLang}`),
    el('div', { class: 'article-body tip-body', lang: bodyLang }, parseArticle(tip.body, bodyLang)),
  ]);
  view.append(container);

  tokenizeTree(container);
  attachDeckButtons(container, tip.language_code, tip.title);
  attachAnkiButtons(container, tip.language_code, tip.title);
}

// Create (tip omitted) or edit (tip given) a tip. Markdown-aware.
// Lazy-load the vendored EasyMDE markdown editor (once, on first tip edit).
let easyMdePromise = null;
function loadEasyMDE() {
  if (window.EasyMDE) return Promise.resolve(window.EasyMDE);
  if (easyMdePromise) return easyMdePromise;
  easyMdePromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/vendor/easymde/easymde.min.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = '/vendor/easymde/easymde.min.js';
    s.onload = () => resolve(window.EasyMDE);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return easyMdePromise;
}

export function openTipEditor(language, onDone, tip = null) {
  const editing = !!tip;
  const err = el('div', { class: 'error' });
  const title = el('input', { type: 'text', placeholder: 'short title', value: tip?.title || '' });
  const body = el('textarea', {
    rows: '10',
    placeholder: 'Share your trick for learning…\n\nMarkdown: # heading, "- " for bullet lists, blank line = new paragraph.\nTip: any list can be turned into a flashcard deck.',
  });
  body.value = tip?.body || '';
  let editor = null;
  const getBody = () => (editor ? editor.value() : body.value);

  // Draft auto-save so a user can continue later — the whole tip (title, body,
  // languages) is stored on every change and restored when the editor reopens.
  const draftId = editing ? `edit-${tip.id}` : `new-${language.code}`;
  const DRAFT_KEY = `gf_tipdraft_${draftId}`;
  let savedDraft = null;
  try { savedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { /* ignore */ }
  if (savedDraft) {
    if (savedDraft.title) title.value = savedDraft.title;
    if (savedDraft.body) body.value = savedDraft.body; // EasyMDE reads the textarea
  }
  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        title: title.value, body: getBody(),
        writtenFor: writtenFor?.value, writtenIn: writtenIn?.value, ts: Date.now(),
      }));
    } catch { /* ignore */ }
  };
  const clearDraft = () => localStorage.removeItem(DRAFT_KEY);
  // Restore body/html scroll and exit fullscreen when leaving the editor (a
  // torn-down EasyMDE fullscreen otherwise leaves the page scroll-locked).
  const cleanup = () => {
    try { editor?.codemirror.setOption('fullScreen', false); } catch { /* ignore */ }
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  };
  title.addEventListener('input', saveDraft);
  // "Written for" = the language the tip is ABOUT (defaults to the current
  // page's language). Only offered on create — updating which language a tip
  // belongs to isn't supported.
  const writtenFor = el('select', {},
    store.languages.map((l) =>
      el('option', { value: l.code, selected: l.code === language.code ? '' : null }, l.name))
  );
  // "Written in" = the language the prose is written in (defaults to native).
  const writtenIn = el('select', {},
    store.languages.map((l) => {
      const selected = l.code === (tip?.body_lang || store.nativeLang);
      return el('option', { value: l.code, selected: selected ? '' : null }, l.name);
    })
  );
  // Restore the draft's languages + keep the draft updated on change.
  if (savedDraft?.writtenFor) writtenFor.value = savedDraft.writtenFor;
  if (savedDraft?.writtenIn) writtenIn.value = savedDraft.writtenIn;
  writtenIn.addEventListener('change', saveDraft);
  // Heading follows the "written for" language.
  const langNameOf = (code) => store.languages.find((l) => l.code === code)?.name || language.name;
  const headingEl = el('h1', {}, editing ? 'Edit tip' : `Share a ${langNameOf(writtenFor.value)} tip`);
  if (!editing) {
    writtenFor.addEventListener('change', () => {
      headingEl.textContent = `Share a ${langNameOf(writtenFor.value)} tip`;
      saveDraft();
    });
  }

  const form = el('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      // Validate up front with a visible toast (rather than a silent 400).
      if (!title.value.trim()) { toast('Please add a title.'); return; }
      if (!getBody().trim()) { toast('Please write your tip before posting.'); return; }
      try {
        if (editing) {
          await api.updateTip(tip.id, {
            title: title.value,
            body: getBody(),
            bodyLanguageCode: writtenIn.value,
          });
          clearDraft(); cleanup();
          close();
          onDone();
        } else {
          await api.createTip({
            languageCode: writtenFor.value,
            bodyLanguageCode: writtenIn.value,
            title: title.value,
            body: getBody(),
          });
          clearDraft(); cleanup();
          close();
          // If the tip is about another language, jump to that language's tips.
          if (writtenFor.value !== language.code) navigate(`#/lang/${writtenFor.value}/tips`);
          else onDone();
        }
      } catch (ex) {
        err.textContent = ex.message;
        toast(ex.message || 'Could not save the tip.', 'error');
      }
    },
  }, [
    // Header bar with the actions at the TOP — above the editor and above
    // EasyMDE's fixed side-by-side preview, so they never overlap the editor.
    el('div', { class: 'tip-editor-bar' }, [
      headingEl,
      el('div', { class: 'tip-editor-bar-actions' }, [
        el('button', { class: 'btn small secondary', type: 'button', onclick: () => { cleanup(); onDone(); } }, 'Cancel'),
        el('button', { class: 'btn small', type: 'submit' }, editing ? 'Save changes' : 'Post tip'),
      ]),
    ]),
    // Title + language pickers ABOVE the editor.
    el('div', { class: 'tip-editor-top' }, [
      el('label', {}, 'Title'), title,
      ...(editing ? [] : [el('label', {}, 'Written for (the language this tip is about)'), writtenFor]),
      el('label', {}, 'Written in (the language you’re writing in)'), writtenIn,
    ]),
    el('label', {}, 'Your tip (markdown)'),
    body,
    el('div', { class: 'muted', style: 'font-size:0.78rem; margin-top:0.3rem' },
      'Use "- " for bullet lists and "# " for headings. Readers can turn any list into a flashcard deck.'),
    err,
  ]);

  // Full-page editor (not a modal) — room for a side-by-side preview.
  const view = clear(document.getElementById('view'));
  view.append(el('div', { class: 'tip-editor-page' }, [form]));
  const close = () => {}; // leaving is handled by onDone()/navigate after submit

  // Upgrade the textarea into a contained markdown editor. We do NOT auto-enable
  // side-by-side (EasyMDE's side-by-side is fullscreen and hides the page) — the
  // toolbar has Preview + Side-by-side buttons the user can toggle. autosave lets
  // a user close and continue the draft later. Falls back to the plain textarea.
  loadEasyMDE().then((EasyMDE) => {
    editor = new EasyMDE({
      element: body,
      spellChecker: false,
      status: false,
      autofocus: false,
      autoDownloadFontAwesome: true,
      placeholder: 'Share your trick for learning…',
      toolbar: ['bold', 'italic', 'heading', '|', 'unordered-list', 'ordered-list', 'quote', '|', {
        name: 'anki',
        title: 'Anki list — becomes an add-to-deck flashcard list',
        className: 'fa fa-clone',
        action: (ed) => {
          const cm = ed.codemirror;
          cm.replaceSelection('\n[anki: My deck]\n- word — meaning\n- another — meaning\n');
          cm.focus();
        },
      }, '|', 'preview', 'guide'],
    });
    // Save the draft on every keystroke so it can be picked up later.
    editor.codemirror.on('change', saveDraft);
  }).catch(() => { /* keep the plain textarea */ });
}
