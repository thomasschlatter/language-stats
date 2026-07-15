// Render a chat/DM/group message body. Plain text is tokenized (clickable words)
// as usual, but Groupifier group links (#/g/<code> invite links, or #/groups/<id>)
// are turned into a recognizable "Join group" button so shared groups stand out.
import { el } from './dom.js';
import { renderText } from './render.js';

// Matches an optional absolute URL prefix followed by our group hash routes.
const GROUP_LINK = /(?:https?:\/\/[^\s]*)?#\/(g\/[A-Za-z0-9_-]+|groups\/\d+)/g;

export function renderMessageBody(text, lang) {
  const s = String(text || '');
  GROUP_LINK.lastIndex = 0;
  if (!GROUP_LINK.test(s)) return renderText(s, lang); // fast path: no group links

  GROUP_LINK.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let last = 0;
  let m;
  while ((m = GROUP_LINK.exec(s))) {
    if (m.index > last) frag.append(renderText(s.slice(last, m.index), lang));
    frag.append(groupButton(`#/${m[1]}`));
    last = m.index + m[0].length;
  }
  if (last < s.length) frag.append(renderText(s.slice(last), lang));
  return frag;
}

function groupButton(hash) {
  const isInvite = hash.startsWith('#/g/');
  const btn = el('button', { class: 'group-link-btn', title: 'Groupifier group' }, isInvite ? '👥 Join group' : '👥 Open group');
  btn.addEventListener('click', () => { window.location.hash = hash; });
  return btn;
}
