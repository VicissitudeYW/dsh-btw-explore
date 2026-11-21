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

function ExplorerPage({ sessionId, page, isTop, isNested, homeLabel, request, Markdown, renderNative, dismiss, bindCard, navigate }) {
  const dialog = React.useRef(null);
  const titleId = React.useId();
  // DSH's renderer may not forward React's inert prop to the DOM.
  React.useLayoutEffect(() => { dialog.current.toggleAttribute('inert', !isTop); }, [isTop]);
  React.useLayoutEffect(() => { dialog.current.focus({ preventScroll: true }); }, []);

  function close() {
    if (!isTop) return;
    dismiss(page.key);
  }

  return h('dialog', {
    ref: dialog,
    open: true,
    tabIndex: -1,
    className: 'dsh-btw-page',
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': titleId,
    'data-btw-top': isTop ? '' : undefined,
    'data-btw-nested': isNested ? '' : undefined,
    onCancel(event) {
      event.preventDefault();
      close();
    },
  }, h(ExploreView, {
    sessionId, request, Markdown, renderNative,
    initialDraft: page.draft,
    initialCardId: page.draft ? null : page.cardId,
    onBindCard: (id) => bindCard(page.key, id),
    onNavigate: navigate,
    onClosePage: close,
    pageTitleId: titleId,
    returnLabel: isNested ? '返回上层' : homeLabel,
    homeLabel,
  }));
}

// This lives in the session header, so opening a page never replaces the chat or tree view.
function ExplorePages({ sessionId, request, Markdown, renderNative, portal, ownerRef }) {
  const [pages, setPages] = React.useState([]);
  const restore = React.useRef(null);
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
      if (document.querySelector(':popover-open, dialog[open]:not(.dsh-btw-page)')
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

  function navigate(trail) {
    if (!trail.length) {
      restore.current = pages[0];
      setPages([]);
      return;
    }
    const existing = pages.findIndex((page) => page.cardId === trail.at(-1).id);
    if (existing >= 0) {
      if (existing === pages.length - 1) return;
      restore.current = pages[existing + 1];
      setPages(pages.slice(0, existing + 1));
      return;
    }
    // Reuse the deepest shared page so it keeps its editor and scroll position.
    let commonPage = -1;
    let commonNode = -1;
    for (let i = pages.length - 1; i >= 0; i--) {
      const j = trail.findIndex((node) => node.id === pages[i].cardId);
      if (j >= 0) { commonPage = i; commonNode = j; break; }
    }
    const current = pages.at(-1);
    const kept = pages.slice(0, commonPage + 1);
    const base = pages[0];
    const next = trail.slice(commonNode + 1).map((node, i) => ({
      key: crypto.randomUUID(), cardId: node.id,
      origin: kept.length || i ? 'card' : base.origin,
      opener: i ? null : (commonPage < 0 ? base.opener : current.opener),
      source: i ? null : (commonPage < 0 ? base.source : current.source),
      scroller: i ? null : (commonPage < 0 ? base.scroller : current.scroller),
      scrollTop: i ? null : (commonPage < 0 ? base.scrollTop : current.scrollTop),
    }));
    setPages([...kept, ...next]);
  }

  if (!opened) return null;
  const homeLabel = pages[0].origin === 'chat' ? '返回主聊天' : '返回卡片树';
  const stack = h('div', { className: 'dsh-btw-overlay' },
    pages.map((page, index) => h(ExplorerPage, {
      key: page.key, sessionId, page, isTop: index === pages.length - 1, isNested: index > 0, homeLabel,
      request, Markdown, renderNative, dismiss, bindCard, navigate,
    })),
  );
  return portal ? portal(stack, document.body) : stack;
}
