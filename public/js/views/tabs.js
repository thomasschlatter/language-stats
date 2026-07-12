// Shared "Words | Tips" tab strip used by the language views.
import { el } from '../dom.js';

export function languageTabs(langCode, active) {
  const tab = (key, label, href) =>
    el('a', { href, class: active === key ? 'active' : '' }, label);
  return el('div', { class: 'tabs' }, [
    tab('cards', 'Cards', `#/lang/${langCode}`),
    tab('tips', 'Tips', `#/lang/${langCode}/tips`),
    tab('progress', 'Progress', `#/lang/${langCode}/progress`),
  ]);
}
