const explorerPageHosts = new Map();

function openExplorerPage(sessionId, draft, opener, origin = 'card') {
  const open = explorerPageHosts.get(sessionId);
  if (!open) return;
  const source = opener?.closest('[data-btw-turn], [data-chat-flow-kind]');
  const scroller = opener?.closest('.dsh-btw-scroller, [data-conversation-scroll]');
  open({ key: crypto.randomUUID(), draft, opener, origin, source, scroller, scrollTop: scroller?.scrollTop });
}

function openSavedExplorerPage(sessionId, cardId, opener) {
  explorerPageHosts.get(sessionId)?.({ key: crypto.randomUUID(), cardId, opener, origin: 'card' });
}

function restoreExplorerFocus(element) {
  if (!element?.isConnected) return false;
  // A selection action disappears after it is clicked, so return focus to the message.
  const needsTabIndex = element.tabIndex < 0 && !element.hasAttribute('tabindex');
  if (needsTabIndex) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  const focused = document.activeElement === element;
  if (needsTabIndex) {
    const release = () => {
      if (element.getAttribute('tabindex') === '-1') element.removeAttribute('tabindex');
    };
    if (focused) element.addEventListener('blur', release, { once: true });
    else release();
  }
  return focused;
}

function restoreExplorerPage(page) {
  if (!restoreExplorerFocus(page.opener)) restoreExplorerFocus(page.source);
  if (page.scroller?.isConnected) page.scroller.scrollTop = page.scrollTop;
}

function ExplorerPage({ sessionId, page, isTop, isNested, titleId, homeLabel, request, Markdown, renderNative,
  dismiss, bindCard, navigate, onReadCards }) {
  const frame = React.useRef(null);
  const reportCards = React.useCallback((cards) => {
    // Covered pages keep reading, but the foreground page owns the shared graph.
    if (frame.current?.hasAttribute('data-btw-top')) onReadCards(cards);
  }, [onReadCards]);
  // DSH's renderer may not forward React's inert prop to the DOM.
  React.useLayoutEffect(() => {
    const element = frame.current;
    element.toggleAttribute('inert', !isTop);
    const navigation = element.parentElement.querySelector('.dsh-btw-map');
    if (isTop && !navigation?.contains(document.activeElement)) element.focus({ preventScroll: true });
  }, [isTop]);

  function close() {
    if (!isTop) return;
    dismiss(page.key);
  }

  return h('div', {
    ref: frame,
    tabIndex: -1,
    className: 'dsh-btw-page',
    'data-btw-top': isTop ? '' : undefined,
  }, h(ExploreView, {
    sessionId, request, Markdown, renderNative,
    initialDraft: page.draft,
    initialCardId: page.draft ? null : page.cardId,
    onBindCard: (id) => bindCard(page.key, id),
    onReadCards: reportCards,
    onNavigate: navigate,
    onClosePage: close,
    pageTitleId: isTop ? titleId : undefined,
    returnLabel: isNested ? '返回上层' : homeLabel,
  }));
}

function switchExplorerPages(pages, trail) {
  if (!pages.length || !trail.length) return [];
  const existing = pages.findIndex((page) => page.cardId === trail.at(-1).id);
  if (existing >= 0) return existing === pages.length - 1 ? pages : pages.slice(0, existing + 1);

  // Reuse the deepest shared page so it keeps its editor and scroll position.
  let commonPage = -1;
  let commonNode = -1;
  for (let i = pages.length - 1; i >= 0; i--) {
    const j = trail.findIndex((node) => node.id === pages[i].cardId);
    if (j >= 0) { commonPage = i; commonNode = j; break; }
  }
  const kept = pages.slice(0, commonPage + 1);
  const base = pages[0];
  const source = commonPage < 0 ? base : pages.at(-1);
  const next = trail.slice(commonNode + 1).map((node, index) => ({
    key: node.id, cardId: node.id,
    origin: kept.length || index ? 'card' : base.origin,
    opener: index ? null : source.opener,
    source: index ? null : source.source,
    scroller: index ? null : source.scroller,
    scrollTop: index ? null : source.scrollTop,
  }));
  return [...kept, ...next];
}

// This lives in the session header, so opening a page never replaces the chat or tree view.
function ExplorePages({ sessionId, request, Markdown, renderNative, portal, ownerRef }) {
  const [pages, setPages] = React.useState([]);
  const [cards, setCards] = React.useState(EXPLORE_EMPTY_CARDS);
  const restore = React.useRef(null);
  const titleId = React.useId();
  React.useLayoutEffect(() => {
    const open = (page) => setPages((previous) => [...previous, page]);
    explorerPageHosts.set(sessionId, open);
    return () => {
      if (explorerPageHosts.get(sessionId) === open) explorerPageHosts.delete(sessionId);
    };
  }, [sessionId]);

  const opened = pages.length > 0;
  React.useLayoutEffect(() => {
    if (!opened || !portal) return;
    let owner = ownerRef.current;
    if (!owner) return;
    while (owner.parentElement && owner.parentElement !== document.body) owner = owner.parentElement;
    if (owner === document.body) return;
    const prior = owner.hasAttribute('inert');
    owner.setAttribute('inert', '');
    return () => { if (!prior) owner.removeAttribute('inert'); };
  }, [opened, portal, ownerRef]);
  React.useLayoutEffect(() => {
    if (restore.current) restoreExplorerPage(restore.current);
    restore.current = null;
  }, [pages]);
  React.useLayoutEffect(() => {
    if (!opened) setCards(EXPLORE_EMPTY_CARDS);
  }, [opened]);

  function dismiss(key) {
    if (pages.at(-1)?.key !== key) return;
    restore.current = pages.at(-1);
    setPages(pages.slice(0, -1));
  }

  React.useEffect(() => {
    if (!opened) return;
    function keydown(event) {
      if (event.defaultPrevented || event.isComposing || event.key !== 'Escape') return;
      // Host menus and attachment previews own Escape while they are open.
      if (document.querySelector(':popover-open, dialog[open]')
        || event.target?.closest?.('[role="menu"], [role="listbox"]')) return;
      event.preventDefault();
      dismiss(pages.at(-1).key);
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [pages]);

  function bindCard(key, cardId) {
    setPages((previous) => previous.map((page) => page.key === key ? { ...page, cardId } : page));
  }

  function navigate(trail, fromMap = false) {
    if (!trail.length) {
      restore.current = pages[0];
    } else if (!fromMap) {
      const existing = pages.findIndex((page) => page.cardId === trail.at(-1).id);
      if (existing >= 0) restore.current = pages[existing + 1];
    }
    setPages((previous) => switchExplorerPages(previous, trail));
  }

  if (!opened) return null;
  const homeLabel = pages[0].origin === 'chat' ? '返回主聊天' : '返回卡片树';
  const stack = h('div', {
    className: 'dsh-btw-overlay', role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId,
    'data-btw-has-map': cards.length ? '' : undefined,
  },
    pages.map((page, index) => h(ExplorerPage, {
      key: page.key, sessionId, page, isTop: index === pages.length - 1, isNested: index > 0, titleId, homeLabel,
      request, Markdown, renderNative, dismiss, bindCard, navigate, onReadCards: setCards,
    })),
    h(ExploreNavigation, { cards, activeId: pages.at(-1).cardId ?? null, returnLabel: homeLabel,
      onNavigate: (trail) => navigate(trail, true) }),
  );
  return portal ? portal(stack, document.body) : stack;
}
