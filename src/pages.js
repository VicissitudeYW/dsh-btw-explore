const explorerPageHosts = new Map();

function explorerPageOrigin(opener) {
  const source = opener?.closest('[data-btw-turn], [data-chat-flow-kind]');
  const scroller = opener?.closest('.dsh-btw-scroller, [data-conversation-scroll]');
  const selection = document.getSelection();
  let rect;
  if (selection && !selection.isCollapsed && selection.rangeCount === 1) {
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if ((source ?? opener)?.contains(container)) rect = range.getBoundingClientRect?.();
  }
  rect ??= opener?.getBoundingClientRect?.();
  const motionSource = rect && [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
    && (rect.width > 0 || rect.height > 0)
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  return { source, scroller, scrollTop: scroller?.scrollTop, motionSource };
}

function openExplorerPage(sessionId, draft, opener, origin = 'card') {
  const open = explorerPageHosts.get(sessionId);
  if (!open) return;
  open({ key: crypto.randomUUID(), draft, opener, origin, ...explorerPageOrigin(opener) });
}

function openSavedExplorerPage(sessionId, cardId, opener) {
  explorerPageHosts.get(sessionId)?.({ key: crypto.randomUUID(), cardId, opener, origin: 'card', ...explorerPageOrigin(opener) });
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

function ExplorerPage({ sessionId, page, isTop, isLeaving, motion, motionSurface, isNested, titleId, homeLabel, request, Markdown, renderNative,
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
    'data-btw-leaving': isLeaving ? '' : undefined,
    'data-btw-motion': motion,
    'data-btw-motion-surface': motionSurface,
    'aria-hidden': isLeaving ? true : undefined,
  }, h('div', { className: 'dsh-btw-page-content' }, h(ExploreView, {
    sessionId, request, Markdown, renderNative,
    isPageClosing: isLeaving,
    initialDraft: page.draft,
    initialCardId: page.draft ? null : page.cardId,
    onBindCard: (id) => bindCard(page.key, id),
    onReadCards: reportCards,
    onNavigate: navigate,
    onClosePage: close,
    pageTitleId: isTop ? titleId : undefined,
    returnLabel: isNested ? '返回上层' : homeLabel,
  })));
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
    motionSource: index ? null : source.motionSource,
  }));
  return [...kept, ...next];
}

function explorerMotionAvailable() {
  return typeof document.documentElement.animate === 'function'
    && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function transitionExplorerPages(previous, next, kind, restore, committedPages, returnToChat = false) {
  if (next === previous.pages) return previous;
  // A quick return can reclaim the still-mounted outgoing page and its editor.
  const pages = next.map((page) => previous.leaving.find((leaving) => page.cardId && leaving.cardId === page.cardId) ?? page);
  const animated = explorerMotionAvailable();
  // State updaters may be batched: an intermediate target that never reached the
  // DOM must not be mounted merely to play an exit (or retain a native session).
  const outgoing = [previous.pages.at(-1), ...previous.leaving].find((page) => page
    && committedPages.has(page.key) && !pages.some((nextPage) => nextPage.key === page.key));
  const leaving = animated && outgoing ? [{ ...outgoing,
    leavingNested: previous.pages.includes(outgoing) ? previous.pages.indexOf(outgoing) > 0 : outgoing.leavingNested }] : [];
  return { pages, leaving, revision: previous.revision + 1, restore, returnToChat,
    homeOrigin: pages[0]?.origin ?? previous.homeOrigin,
    motion: animated ? { kind, incomingKey: pages.at(-1)?.key,
      frame: kind === 'exit' || (kind === 'enter' && committedPages.size === 0) } : null };
}

function explorerNavigationMotion(previous, next, graph) {
  const from = previous.at(-1);
  const to = next.at(-1);
  if (!to) return 'exit';
  const node = (id) => id ? graph.nodes.find((item) => item.card?.id === id) : undefined;
  const fromNode = node(from.cardId);
  const toNode = node(to.cardId);
  const depth = (page, current) => {
    if (current) return current.depth;
    const parent = node(page.draft?.parentId);
    return (parent?.depth ?? 0) + (parent && page.draft.relation === 'branch' ? 0 : 1);
  };
  const delta = depth(to, toNode) - depth(from, fromNode);
  if (delta) return delta > 0 ? 'forward' : 'back';
  return (toNode?.x ?? 0) < (fromNode?.x ?? 0) ? 'switch-prev' : 'switch-next';
}

function explorerPageKeyframes(element, page, kind, frame) {
  if (!frame && kind !== 'enter') {
    const x = kind === 'switch-next' ? 12 : kind === 'switch-prev' ? -12 : 0;
    const y = kind === 'back' ? -10 : kind === 'forward' ? 10 : 0;
    return { frames: [{ opacity: .88, translate: `${x}px ${y}px` }, { opacity: 1, translate: '0px 0px' }], duration: 180 };
  }
  const bounds = element.getBoundingClientRect();
  const dx = page.motionSource ? page.motionSource.x - bounds.left - bounds.width / 2 : 0;
  const dy = page.motionSource ? page.motionSource.y - bounds.top - bounds.height / 2 : 12;
  const ratio = Math.min(1, 24 / (Math.hypot(dx, dy) || 1));
  const sourceX = dx * ratio;
  const sourceY = dy * ratio;
  if (!frame) {
    return { frames: [{ opacity: .88, translate: `${sourceX}px ${sourceY}px` }, { opacity: 1, translate: '0px 0px' }], duration: 210 };
  }
  element.style.setProperty('--btw-motion-origin-x', `${bounds.width && page.motionSource
    ? Math.max(0, Math.min(100, (page.motionSource.x - bounds.left) / bounds.width * 100)) : 50}%`);
  element.style.setProperty('--btw-motion-origin-y', `${bounds.height && page.motionSource
    ? Math.max(0, Math.min(100, (page.motionSource.y - bounds.top) / bounds.height * 100)) : 50}%`);
  const leaving = kind === 'exit';
  const rest = { opacity: 1, translate: '0px 0px', scale: '1' };
  const displaced = { opacity: leaving ? 0 : 0.68, translate: `${sourceX}px ${sourceY}px`, scale: '0.985' };
  return { frames: leaving ? [rest, displaced] : [displaced, rest],
    duration: leaving ? 150 : 210 };
}

// This lives in the session header, so opening a page never replaces the chat or tree view.
function ExplorePages({ sessionId, request, Markdown, renderNative, portal, ownerRef, onReturnChat }) {
  const [deck, setDeck] = React.useState({ pages: [], leaving: [], revision: 0, motion: null, restore: null });
  const { pages, leaving, motion } = deck;
  const [cards, setCards] = React.useState(EXPLORE_EMPTY_CARDS);
  const graph = React.useMemo(() => exploreNodeLayout(cards), [cards]);
  const overlay = React.useRef(null);
  const committedPages = React.useRef(new Set());
  const focusedPage = React.useRef(null);
  const restoredRevision = React.useRef(-1);
  const titleId = React.useId();
  React.useLayoutEffect(() => {
    const open = (page) => setDeck((previous) => transitionExplorerPages(previous, [...previous.pages, page], 'enter', null, committedPages.current));
    explorerPageHosts.set(sessionId, open);
    return () => {
      if (explorerPageHosts.get(sessionId) === open) explorerPageHosts.delete(sessionId);
    };
  }, [sessionId]);
  React.useLayoutEffect(() => {
    committedPages.current = new Set([...leaving, ...pages].map((page) => page.key));
  }, [pages, leaving]);

  const opened = pages.length > 0;
  const visible = opened || leaving.length > 0;
  useExplorerDeckDrag(overlay, visible);
  React.useLayoutEffect(() => {
    if (!visible || !portal) return;
    let owner = ownerRef.current;
    if (!owner) return;
    while (owner.parentElement && owner.parentElement !== document.body) owner = owner.parentElement;
    if (owner === document.body) return;
    const prior = owner.hasAttribute('inert');
    owner.setAttribute('inert', '');
    return () => { if (!prior) owner.removeAttribute('inert'); };
  }, [visible, portal, ownerRef]);
  React.useLayoutEffect(() => {
    overlay.current?.toggleAttribute('inert', !opened);
    const top = pages.at(-1);
    if (focusedPage.current !== top?.key) {
      focusedPage.current = top?.key;
      const navigation = overlay.current?.querySelector('.dsh-btw-map');
      // Child layout effects run first. Focus here, after a closing overlay has
      // shed inert, so a quick reopen works in browsers that enforce inert.
      if (top && !navigation?.contains(document.activeElement)) {
        overlay.current?.querySelector('.dsh-btw-page[data-btw-top]')?.focus({ preventScroll: true });
      }
    }
    if (!visible && deck.returnToChat && restoredRevision.current !== deck.revision) {
      restoredRevision.current = deck.revision;
      onReturnChat?.();
    } else if (deck.restore && (opened || !visible) && restoredRevision.current !== deck.revision) {
      restoredRevision.current = deck.revision;
      restoreExplorerPage(deck.restore);
    }
  }, [deck, opened, visible, onReturnChat]);
  React.useLayoutEffect(() => {
    if (!visible) setCards(EXPLORE_EMPTY_CARDS);
  }, [visible]);

  React.useLayoutEffect(() => {
    if (!motion) return;
    const revision = deck.revision;
    const animations = [];
    let disposed = false;
    let settled = false;
    let timeout;
    function finish() {
      if (disposed || settled) return;
      settled = true;
      setDeck((current) => current.revision === revision ? { ...current, leaving: [], motion: null } : current);
    }
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    function reduceMotion(event) { if (event.matches) finish(); }
    if (!explorerMotionAvailable()) { finish(); return; }
    try {
      const exiting = motion.kind === 'exit';
      const frame = overlay.current?.querySelector(exiting ? '.dsh-btw-page[data-btw-leaving]' : '.dsh-btw-page[data-btw-top]');
      const element = motion.frame ? frame : frame?.querySelector('.dsh-btw-page-content');
      const page = exiting ? leaving[0] : pages.at(-1);
      if (element && page) {
        const { frames, duration } = explorerPageKeyframes(element, page, motion.kind, motion.frame);
        animations.push(element.animate(frames, { duration, fill: 'both',
          easing: exiting ? 'cubic-bezier(.4, 0, 1, 1)' : 'cubic-bezier(.16, 1, .3, 1)' }));
      }
    } catch { finish(); }
    media?.addEventListener?.('change', reduceMotion);
    // finished rejects on cancel; a stale animation can never settle a new deck.
    Promise.allSettled(animations.map((animation) => animation.finished)).then(finish);
    // A browser or suspended timeline must not leave the foreground inert forever.
    timeout = setTimeout(finish, (motion.kind === 'enter' ? 210 : 180) + 80);
    return () => {
      disposed = true;
      clearTimeout(timeout);
      media?.removeEventListener?.('change', reduceMotion);
      for (const animation of animations) animation.cancel();
    };
  }, [deck.revision, motion]);

  function dismiss(key) {
    setDeck((previous) => previous.pages.at(-1)?.key !== key ? previous
      : transitionExplorerPages(previous, previous.pages.slice(0, -1), previous.pages.length > 1 ? 'back' : 'exit', previous.pages.at(-1), committedPages.current));
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
    setDeck((previous) => ({ ...previous,
      pages: previous.pages.map((page) => page.key === key ? { ...page, cardId } : page),
      leaving: previous.leaving.map((page) => page.key === key ? { ...page, cardId } : page),
    }));
  }

  function navigate(trail, fromMap = false) {
    setDeck((previous) => {
      if (!previous.pages.length) return previous;
      const next = switchExplorerPages(previous.pages, trail);
      const existing = previous.pages.findIndex((page) => page.cardId === trail.at(-1)?.id);
      const returnToChat = fromMap && !trail.length && previous.homeOrigin !== 'chat' && typeof onReturnChat === 'function';
      const restore = returnToChat ? null
        : !trail.length ? previous.pages[0] : !fromMap && existing >= 0 ? previous.pages[existing + 1] : null;
      return transitionExplorerPages(previous, next, explorerNavigationMotion(previous.pages, next, graph), restore, committedPages.current, returnToChat);
    });
  }

  if (!visible) return null;
  const homeLabel = deck.homeOrigin === 'chat' ? '返回主聊天' : '返回卡片树';
  const top = pages.at(-1);
  // Binding the new ID can precede the refreshed graph. Keep the source marker
  // until its destination exists, rather than losing the ring for one frame.
  const activeId = !opened ? null : top.draft && !cards.some((card) => card.id === top.cardId)
    ? top.draft.parentId : top.cardId;
  const stack = h('div', {
    ref: overlay,
    className: 'dsh-btw-overlay', role: 'dialog', 'aria-modal': true,
    'aria-labelledby': opened ? titleId : undefined, 'aria-label': opened ? undefined : homeLabel,
    'data-btw-motion': motion?.kind, 'data-btw-closing': !opened ? '' : undefined,
    'data-btw-has-map': cards.length ? '' : undefined,
    style: cards.length ? { '--btw-map-content-width': `${graph.fitWidth}px` } : undefined,
  },
    [...leaving, ...pages].map((page) => {
      const isLeaving = leaving.includes(page);
      const animated = isLeaving ? motion?.kind === 'exit' : page.key === motion?.incomingKey;
      return h(ExplorerPage, {
        key: page.key, sessionId, page, isTop: page === pages.at(-1), isLeaving,
        motion: animated ? motion.kind : undefined,
        motionSurface: animated ? (motion.frame ? 'frame' : 'content') : undefined,
        isNested: isLeaving ? page.leavingNested : pages.indexOf(page) > 0, titleId, homeLabel,
        request, Markdown, renderNative, dismiss, bindCard, navigate, onReadCards: setCards,
      });
    }),
    h(ExploreNavigation, { graph, activeId, returnLabel: '返回主聊天',
      onNavigate: (trail) => navigate(trail, true) }),
  );
  return portal ? portal(stack, document.body) : stack;
}
