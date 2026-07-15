// Body layout classes for the fixed, non-page-scrolling routes (chat, messages,
// world, community). Reconciled on EVERY route render — not just hashchange — so
// an `overflow: hidden` class can never get stuck across SPA navigation.
export function syncBodyClasses(hash = window.location.hash || '') {
  // Real DM threads + the messages list use the fixed layout — but the Foxy help
  // page (#/dm/Foxy or #/dm/Groupifier) is a normal, scrollable page.
  const isMsg = hash.startsWith('#/messages')
    || (hash.startsWith('#/dm/') && !/^#\/dm\/(foxy|groupifier)$/i.test(hash));
  const b = document.body.classList;
  b.toggle('in-world', hash.startsWith('#/world'));
  b.toggle('in-community', hash.startsWith('#/community'));
  b.toggle('in-chat', hash.startsWith('#/chat'));
  b.toggle('in-msg', isMsg);
}
