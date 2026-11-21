const EXPLORE_QUESTION_LIMIT = 8000;
const EXPLORE_QUOTE_LIMIT = 4000;
const EXPLORE_EMPTY_CARDS = [];
const exploreChangeListeners = new Map();
const EXPLORE_RELATIONS = { root: '根卡', child: '子卡', branch: '分支' };
const EXPLORE_TURN_ERRORS = {
  failed: '回答未完成，可以重试本轮。',
  cancelled: '已停止生成。',
  interrupted: '生成已中断，可以重试本轮。',
};

function exploreTitle(card) {
  return card?.title?.trim() || '未命名卡片';
}

function exploreTrail(card, byId) {
  const trail = [];
  const visited = new Set();
  for (let node = card; node && !visited.has(node.id); node = byId.get(node.parentId)) {
    trail.push(node);
    visited.add(node.id);
  }
  return trail.reverse();
}

function explorePreferences(sessionId) {
  try {
    const prefs = JSON.parse(window.localStorage.getItem(`dsh-btw-explore:view:${sessionId}`));
    return {
      selected: typeof prefs?.selected === 'string' ? prefs.selected : null,
      collapsed: new Set(Array.isArray(prefs?.collapsed) ? prefs.collapsed : []),
    };
  } catch {
    return { selected: null, collapsed: new Set() };
  }
}

function exploreRootDraft(entry) {
  const quote = (entry?.quote || '').trim().slice(0, EXPLORE_QUOTE_LIMIT);
  return { key: 'root', relation: 'root', source: entry?.source, quote, preview: Boolean(quote) };
}

function exploreButton(label, props = {}, tone = '') {
  return h('button', { type: 'button', className: `dsh-btw-button${tone ? ` dsh-btw-${tone}` : ''}`, ...props }, label);
}

function isCoveredExploreReader(element) {
  const page = element.closest('.dsh-btw-page');
  return page ? !page.hasAttribute('data-btw-top') : Boolean(document.querySelector('.dsh-btw-overlay'));
}

// The client build supplies the renderer's React instance, including the Markdown renderer.
function ExploreView({ sessionId, initialDraft = null, initialCardId, onBindCard, onReadCards, onNavigate, onChat, onClosePage,
  pageTitleId, returnLabel, request, Markdown, renderNative, nativeCards = Boolean(renderNative) }) {
  const { useEffect, useLayoutEffect, useMemo, useRef, useState } = React;
  const isPage = Boolean(onClosePage);
  const preferences = useMemo(() => isPage ? null : explorePreferences(sessionId), [sessionId, isPage]);
  const [selectedId, setSelectedId] = useState(initialCardId ?? preferences?.selected ?? null);
  const [collapsed, setCollapsed] = useState(() => preferences?.collapsed ?? new Set());
  const [composer, setComposer] = useState(initialDraft);
  const [drafts, setDrafts] = useState(() => new Map());
  const [reading, setReading] = useState(null);
  const [readError, setReadError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [pending, setPending] = useState('');
  const [reload, setReload] = useState(0);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [quoteSelection, setQuoteSelection] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const currentId = useRef(selectedId);
  const currentComposer = useRef(composer);
  const active = useRef(false);
  const mutation = useRef(null);
  const attempts = useRef(new Map());
  const nativeDraftId = useRef(null);
  const readRevision = useRef(0);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const scroll = useRef({ key: null, anchor: null, follow: true, explicitFollow: null, positions: new Map() });

  const cards = reading?.data.cards ?? EXPLORE_EMPTY_CARDS;
  const card = reading?.data.card?.id === selectedId ? reading.data.card : null;
  const { byId, children, roots } = useMemo(() => {
    const index = new Map(cards.map((item) => [item.id, item]));
    const subtrees = new Map();
    const top = [];
    for (const item of cards) {
      if (!index.has(item.parentId)) {
        top.push(item);
        continue;
      }
      if (!subtrees.has(item.parentId)) subtrees.set(item.parentId, []);
      subtrees.get(item.parentId).push(item);
    }
    return { byId: index, children: subtrees, roots: top };
  }, [cards]);
  const trail = exploreTrail(card, byId);
  const rootSource = (composer?.parentId ? exploreTrail(byId.get(composer.parentId), byId)[0] : trail[0])?.source;
  const lastTurn = card?.turns.at(-1);
  const draftKey = composer?.key ?? (card ? `ask:${card.id}` : null);
  const question = drafts.get(draftKey) ?? '';
  const bodyKey = composer ? `draft:${composer.key}` : card?.id ?? null;
  const refreshing = reading?.revision !== reload;
  const blocked = Boolean(pending) || refreshing;
  const preparingNative = Boolean(isPage && composer && renderNative);
  const readyToPrepare = preparingNative && !refreshing;

  function updateSelected(id) {
    currentId.current = id;
    setSelectedId(id);
  }

  function updateComposer(draft) {
    currentComposer.current = draft;
    setComposer(draft);
  }

  function refresh() {
    setReadError('');
    readRevision.current += 1;
    setReload(readRevision.current);
  }

  function selectCard(id, turnId = null) {
    updateComposer(null);
    setOperationError('');
    setConfirmRemove(null);
    setQuoteSelection(null);
    setMobileTreeOpen(false);
    setAnchor(turnId ? { cardId: id, turnId } : null);
    updateSelected(id);
    onBindCard?.(id);
    const parents = exploreTrail(byId.get(id), byId).slice(0, -1);
    if (parents.some((parent) => collapsed.has(parent.id))) {
      setCollapsed((previous) => {
        const next = new Set(previous);
        for (const parent of parents) next.delete(parent.id);
        return next;
      });
    }
  }

  function navigateTo(id) {
    if (!id) { onNavigate([]); return; }
    const trail = exploreTrail(byId.get(id), byId);
    if (trail.length) onNavigate(trail);
  }

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (!sessionId) return undefined;
    let listeners = exploreChangeListeners.get(sessionId);
    if (!listeners) exploreChangeListeners.set(sessionId, listeners = new Set());
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
      if (!listeners.size) exploreChangeListeners.delete(sessionId);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || isPage) return;
    try {
      window.localStorage.setItem(`dsh-btw-explore:view:${sessionId}`, JSON.stringify({
        selected: selectedId,
        collapsed: [...collapsed],
      }));
    } catch {
      // A disabled storage area does not prevent reading or creating cards.
    }
  }, [sessionId, selectedId, collapsed, isPage]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const controller = new AbortController();
    let timer;
    let hadRunningCards = false;
    const outdated = () => controller.signal.aborted || currentId.current !== selectedId || readRevision.current !== reload;

    async function load() {
      try {
        const data = await request(sessionId, { cardId: selectedId ?? undefined, signal: controller.signal });
        if (outdated()) return;
        setReading({ data, revision: reload, cardId: selectedId });
        onReadCards?.(data.cards);
        setReadError('');
        if (!isPage && !data.card && data.cards.length) {
          const mostRecent = data.cards.reduce((a, b) => a.updatedAt >= b.updatedAt ? a : b);
          updateSelected(mostRecent.id);
          return;
        }
        if (!isPage && !data.card && selectedId) {
          updateSelected(null);
          return;
        }
        hadRunningCards = isPage ? data.card?.status === 'running' || Boolean(data.card?.nativeSessionId)
          : data.cards.some((item) => item.status === 'running');
        if (hadRunningCards) timer = setTimeout(load, document.hidden ? 2500 : data.card?.nativeSessionId ? 1800 : 700);
      } catch {
        if (outdated()) return;
        setReadError('无法加载探索卡片。');
        if (hadRunningCards) timer = setTimeout(load, 2200);
      }
    }

    load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [sessionId, selectedId, reload, request, isPage, onReadCards]);

  useEffect(() => {
    if (composer?.key) inputRef.current?.focus({ preventScroll: true });
  }, [composer?.key]);

  useEffect(() => {
    if (readyToPrepare && !nativeDraftId.current) prepareNative();
  }, [readyToPrepare]);

  useEffect(() => {
    if (!card?.saved || composer) return undefined;
    const onSelection = () => {
      const selection = window.getSelection();
      const scope = bodyRef.current;
      function answerFor(node) {
        const element = node?.nodeType === 1 ? node : node?.parentElement;
        return element?.closest('[data-btw-answer]');
      }
      const start = answerFor(selection?.anchorNode);
      const end = answerFor(selection?.focusNode);
      const quote = selection?.toString().trim().slice(0, EXPLORE_QUOTE_LIMIT);
      const next = quote && start === end && scope?.contains(start)
        ? { cardId: card.id, turnId: start.dataset.btwAnswer, quote } : null;
      setQuoteSelection((previous) => previous?.cardId === next?.cardId && previous?.turnId === next?.turnId
        && previous?.quote === next?.quote ? previous : next);
    };
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, [card?.id, card?.saved, composer]);

  function rememberScroll() {
    const element = bodyRef.current;
    if (!element || !bodyKey || scroll.current.key !== bodyKey) return;
    scroll.current.follow = element.scrollHeight - element.clientHeight - element.scrollTop < 64;
    scroll.current.positions.set(bodyKey, element.scrollTop);
  }

  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element || !bodyKey) return;
    const state = scroll.current;
    const switched = state.key !== bodyKey;
    const scrollToTurn = anchor?.cardId === bodyKey && anchor !== state.anchor;
    state.key = bodyKey;
    if (scrollToTurn) {
      const turn = [...element.querySelectorAll('[data-btw-turn]')].find((item) => item.dataset.btwTurn === anchor.turnId);
      if (turn) {
        element.scrollTop += turn.getBoundingClientRect().top - element.getBoundingClientRect().top - 12;
        turn.focus({ preventScroll: true });
      }
      state.anchor = anchor;
    } else if (state.explicitFollow === bodyKey) {
      element.scrollTop = element.scrollHeight;
      state.explicitFollow = null;
    } else if (switched) {
      element.scrollTop = state.positions.get(bodyKey) ?? 0;
    } else if (state.follow && !composer && !isCoveredExploreReader(element)) {
      element.scrollTop = element.scrollHeight;
    }
    rememberScroll();
  }, [bodyKey, anchor, lastTurn?.id, lastTurn?.answer, lastTurn?.status]);

  async function mutate(action, body, onSuccess) {
    if (!sessionId || mutation.current || blocked) return;
    const token = {};
    mutation.current = token;
    setPending(action);
    setOperationError('');
    try {
      const result = await request(sessionId, { action, body });
      if (!active.current || mutation.current !== token) return;
      onSuccess?.(result);
    } catch (error) {
      if (!active.current || mutation.current !== token) return;
      setOperationError(typeof error?.message === 'string' && error.message.trim()
        ? error.message.slice(0, 240) : '操作没有完成，请重试。');
    } finally {
      if (mutation.current === token) {
        mutation.current = null;
        if (active.current) setPending('');
        // A dismissed page can still finish creating a card on the host.
        for (const update of exploreChangeListeners.get(sessionId) ?? []) update();
      }
    }
  }

  function writeDraft(value) {
    if (!draftKey) return;
    setDrafts((previous) => {
      const next = new Map(previous);
      if (value) next.set(draftKey, value.slice(0, EXPLORE_QUESTION_LIMIT));
      else next.delete(draftKey);
      return next;
    });
  }

  function startDraft(draft) {
    updateComposer(draft);
    setMobileTreeOpen(false);
    setConfirmRemove(null);
    setOperationError('');
    setQuoteSelection(null);
  }

  function startRoot(event) {
    const draft = exploreRootDraft(null);
    if (nativeCards) openExplorerPage(sessionId, draft, event.currentTarget);
    else startDraft(draft);
  }

  function prepareNative() {
    const draft = currentComposer.current;
    const id = nativeDraftId.current ??= crypto.randomUUID();
    const body = draft ? { cardId: id, relation: draft.relation, source: draft.source,
      quote: draft.quote, parentId: draft.parentId, anchorTurnId: draft.anchorTurnId } : { cardId: selectedId };
    void mutate('open-native', body, (result) => selectCard(result.cardId));
  }

  function startFromTurn(relation, turn, turnNumber, opener, quote = '') {
    if (!card?.saved || turn.status !== 'done') return;
    window.getSelection()?.removeAllRanges();
    openExplorerPage(sessionId, {
      key: `${relation}:${card.id}:${turn.id}`,
      relation,
      parentId: card.id,
      anchorTurnId: turn.id,
      anchorQuestion: turn.question,
      turnNumber,
      quote,
      preview: Boolean(quote),
    }, opener);
  }

  function submit(event) {
    event.preventDefault();
    const text = question.trim();
    if (!text || blocked || mutation.current) return;
    if (composer) {
      if (composer.parentId && !byId.get(composer.parentId)?.saved) {
        setOperationError('来源卡片已不可用，可以复制问题后新建一张根卡。');
        return;
      }
      const { relation, parentId, anchorTurnId, source, quote, preview } = composer;
      const body = { relation, question: text, preview };
      if (parentId) Object.assign(body, { parentId, anchorTurnId });
      if (source) body.source = source;
      if (quote) body.quote = quote;
      const attempt = reuseAttempt('create', body);
      const submittedComposer = composer;
      mutate('create', attempt, (result) => {
        attempts.current.delete(`create:${draftKey}`);
        writeDraft('');
        if (currentComposer.current !== submittedComposer) return;
        scroll.current.explicitFollow = result.cardId;
        selectCard(result.cardId);
        if (parentId) toggleNode(parentId, false);
      });
    } else if (card?.saved && lastTurn?.status === 'done') {
      const attempt = reuseAttempt('ask', { cardId: card.id, question: text });
      mutate('ask', attempt, () => {
        attempts.current.delete(`ask:${draftKey}`);
        writeDraft('');
        if (currentId.current === card.id) scroll.current.explicitFollow = card.id;
      });
    }
  }

  function reuseAttempt(action, body) {
    const key = `${action}:${draftKey}`;
    const signature = JSON.stringify(body);
    const previous = attempts.current.get(key);
    if (previous?.signature === signature) return previous.body;
    const next = { ...body, turnId: crypto.randomUUID() };
    if (action === 'create') next.cardId = crypto.randomUUID();
    attempts.current.set(key, { signature, body: next });
    return next;
  }

  function toggleNode(id, forceClosed) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (forceClosed ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function gotoChat() {
    const source = composer?.relation === 'root' ? { ...composer.source, quote: composer.quote } : rootSource;
    onChat(source && (source.messageId || source.turn != null || source.quote) ? {
      ...(source.turn == null ? {} : { turn: source.turn }),
      ...(source.messageId ? { messageId: source.messageId } : {}),
      ...(source.role ? { role: source.role } : {}),
      ...(source.quote ? { quote: source.quote } : {}),
    } : null);
  }

  function renderNodes(items, depth = 0) {
    return h('ul', { className: depth ? 'dsh-btw-children' : 'dsh-btw-roots' }, items.map((item) => {
      const descendants = children.get(item.id);
      const hasChildren = Boolean(descendants?.length);
      const open = !collapsed.has(item.id);
      const chosen = !composer && selectedId === item.id;
      const name = exploreTitle(item);
      return h('li', { key: item.id, className: 'dsh-btw-node' },
        h('div', { className: `dsh-btw-node-line${chosen ? ' is-current' : ''}` },
          hasChildren ? h('button', {
            type: 'button', className: `dsh-btw-fold${open ? ' is-open' : ''}`,
            'aria-label': `${open ? '折叠' : '展开'} ${name}`, 'aria-expanded': open,
            onClick: () => toggleNode(item.id),
          }) : h('span', { className: 'dsh-btw-fold-space' }),
          h('button', {
            type: 'button', className: 'dsh-btw-node-link', 'aria-current': chosen ? 'page' : undefined,
            onClick: (event) => {
              selectCard(item.id);
              if (item.nativeSessionId) openSavedExplorerPage(sessionId, item.id, event.currentTarget);
            },
            title: `${name} · ${EXPLORE_RELATIONS[item.relation] ?? '卡片'}`,
          },
          h('span', { className: `dsh-btw-node-mark dsh-btw-mark-${item.relation}`, 'aria-hidden': true }),
          h('span', { className: 'dsh-btw-node-name' }, name),
          !item.saved && h('span', { className: 'dsh-btw-node-status' }, '预览'),
          item.status === 'running' && h('span', { className: 'dsh-btw-working-dot', role: 'img', 'aria-label': '正在生成' }),
          item.status in EXPLORE_TURN_ERRORS && h('span', { className: 'dsh-btw-incomplete-dot', role: 'img', 'aria-label': '尚未完成', title: '尚未完成' }),
          ),
        ),
        hasChildren && open && renderNodes(descendants, depth + 1),
      );
    }));
  }

  function sourceBlock(source, parentId, turnId, anchorQuestion, turnNumber) {
    const quote = source?.quote;
    const parent = byId.get(parentId);
    const mainAnchor = source?.role || source?.turn != null || source?.messageId;
    if (!quote && !parent && !mainAnchor) return null;
    const label = parent ? `来自 ${exploreTitle(parent)}${turnNumber ? ` · 第 ${turnNumber} 轮` : turnId ? ' · 指定轮次' : ''}`
      : source?.role === 'user' ? '来自主聊天的提问' : source?.role === 'assistant' ? '来自主聊天的回答' : '来自主聊天';
    const excerpt = quote || anchorQuestion;
    return h('div', { className: 'dsh-btw-source' },
      h('div', { className: 'dsh-btw-source-head' },
        h('span', { className: 'dsh-btw-source-label' }, label),
        parent && (isPage
          ? exploreButton('返回来源', { onClick: () => onNavigate ? navigateTo(parent.id) : onClosePage() }, 'quiet')
          : exploreButton('查看来源', { onClick: () => selectCard(parent.id, turnId) }, 'quiet')),
      ),
      excerpt && h('blockquote', { className: 'dsh-btw-quoted' },
        excerpt.length <= 240 ? excerpt : h('details', null,
          h('summary', null, `${excerpt.slice(0, 160)}…`),
          h('div', { className: 'dsh-btw-quoted-full' }, excerpt),
        )),
    );
  }

  function renderTurn(turn, index) {
    const running = turn.status === 'running';
    const selectedQuote = quoteSelection?.cardId === card.id && quoteSelection.turnId === turn.id
      ? quoteSelection.quote : '';
    return h('article', { className: 'dsh-btw-turn', key: turn.id, 'data-btw-turn': turn.id, tabIndex: -1 },
      h('h3', { className: 'dsh-btw-turn-label' }, `第 ${index + 1} 轮`),
      h('p', { className: 'dsh-btw-question' }, turn.question),
      turn.answer && h('div', { className: 'dsh-btw-answer', 'data-btw-answer': turn.id },
        Markdown ? h(Markdown, { text: turn.answer, labels: {}, streaming: running, variant: 'body' })
          : h('div', { className: 'dsh-btw-plain-answer' }, turn.answer),
      ),
      (running || turn.status in EXPLORE_TURN_ERRORS) && h('div', { className: 'dsh-btw-turn-state' },
        h('span', { role: 'status' }, running ? '正在生成…' : (turn.error || EXPLORE_TURN_ERRORS[turn.status])),
        running ? exploreButton('停止生成', {
          disabled: blocked, onClick: () => mutate('stop', { cardId: card.id, turnId: turn.id }),
        }) : index === card.turns.length - 1 && exploreButton('重试本轮', {
          disabled: blocked, onClick: () => mutate('retry', { cardId: card.id, turnId: turn.id }, () => {
            if (currentId.current === card.id) scroll.current.explicitFollow = card.id;
          }),
        }),
      ),
      card.saved && turn.status === 'done' && h('div', { className: 'dsh-btw-turn-actions' },
        exploreButton(selectedQuote ? '用选区建子卡' : '新建子卡', {
          disabled: Boolean(pending),
          'aria-haspopup': 'dialog',
          onMouseDown: (event) => { if (selectedQuote && event.button === 0) event.preventDefault(); },
          onClick: (event) => startFromTurn('child', turn, index + 1, event.currentTarget, selectedQuote),
        }, selectedQuote ? 'highlight' : 'quiet'),
        exploreButton('从此轮分支', { disabled: Boolean(pending), 'aria-haspopup': 'dialog',
          onClick: (event) => startFromTurn('branch', turn, index + 1, event.currentTarget),
        }, 'quiet'),
      ),
    );
  }

  const promptAllowed = !preparingNative && !card?.nativeSessionId && Boolean(composer || (card?.saved && lastTurn?.status === 'done'));
  const title = composer ? ({ root: '新建探索卡片', child: '新建子卡', branch: '新建分支' })[composer.relation]
    : card ? exploreTitle(card) : '探索';
  const sourceParentId = card?.source?.cardId || card?.parentId;
  const sourceTurnId = card?.source?.turnId || card?.anchorTurnId;
  const removal = { count: 0, running: card?.status === 'running', hasNativeSession: Boolean(card?.nativeSessionId) };
  if (card && confirmRemove === card.id) {
    const unchecked = [...(children.get(card.id) ?? [])];
    const checked = new Set([card.id]);
    while (unchecked.length) {
      const descendant = unchecked.pop();
      if (checked.has(descendant.id)) continue;
      checked.add(descendant.id);
      removal.count += 1;
      removal.running ||= descendant.status === 'running';
      removal.hasNativeSession ||= Boolean(descendant.nativeSessionId);
      unchecked.push(...(children.get(descendant.id) ?? []));
    }
  }

  function removeSelected() {
    mutate('remove', { cardId: card.id }, () => {
      if (currentId.current !== card.id) return;
      if (onClosePage) onClosePage();
      else if (!currentComposer.current) selectCard(card.parentId);
      else updateSelected(card.parentId);
    });
  }

  return h('div', { className: isPage ? 'dsh-btw-explore dsh-btw-explore-page' : 'dsh-btw-explore' },
    h('div', { className: 'dsh-btw-layout' },
      !isPage && h('aside', { className: `dsh-btw-sidebar${mobileTreeOpen ? ' is-mobile-open' : ''}` },
        h('div', { className: 'dsh-btw-side-head' },
          h('h2', { className: 'dsh-btw-side-title' }, '卡片树'),
          h('button', {
            type: 'button', className: 'dsh-btw-mobile-tree-button', 'aria-expanded': mobileTreeOpen,
            onClick: () => setMobileTreeOpen((value) => !value),
          }, '卡片树', h('span', { className: `dsh-btw-chevron${mobileTreeOpen ? ' is-open' : ''}`, 'aria-hidden': true })),
          h('span', { className: 'dsh-btw-card-count', 'aria-label': `${cards.length} 张卡片` }, cards.length),
          exploreButton('新建', { 'aria-label': '新建探索卡片', disabled: !sessionId, onClick: startRoot }, 'quiet'),
        ),
        h('nav', { className: 'dsh-btw-tree', 'aria-label': '探索卡片树' },
          roots.length ? renderNodes(roots) : h('p', { className: 'dsh-btw-tree-empty' },
            readError ? '卡片树未加载' : reading ? '这里还没有卡片' : '正在加载…'),
        ),
      ),
      h('section', { className: 'dsh-btw-main', 'aria-label': '探索对话' },
        h('header', { className: 'dsh-btw-head' },
          h('div', { className: 'dsh-btw-head-path' },
            h('nav', { className: 'dsh-btw-crumbs', 'aria-label': '卡片路径' },
              h('span', null, returnLabel === '返回主聊天' ? '主聊天 / 探索' : '探索'),
              (composer ? exploreTrail(byId.get(composer.parentId), byId) : trail.slice(0, -1)).map((parent) =>
                h('span', { className: 'dsh-btw-crumb', key: parent.id },
                  h('span', { className: 'dsh-btw-crumb-divider', 'aria-hidden': true }),
                  isPage ? h('span', { title: exploreTitle(parent) }, exploreTitle(parent))
                    : exploreButton(exploreTitle(parent), { onClick: () => selectCard(parent.id), title: exploreTitle(parent) }, 'quiet'),
                )),
            ),
            isPage ? exploreButton(returnLabel, { onClick: onClosePage, title: 'Esc' }, 'quiet')
              : onChat && exploreButton('回到主聊天', { onClick: gotoChat }, 'quiet'),
          ),
          h('div', { className: 'dsh-btw-head-title' },
            h('h2', { id: pageTitleId, title }, title),
            !composer && card?.saved && exploreButton(card.nativeSessionId ? '移除' : '删除', {
              disabled: blocked || card.status === 'running',
              'aria-label': card.nativeSessionId ? '从树中移除卡片和后代' : '删除卡片和后代',
              onClick: () => setConfirmRemove(card.id),
            }, 'quiet'),
          ),
          !composer && card && h('p', { className: 'dsh-btw-card-meta' },
            [EXPLORE_RELATIONS[card.relation], card.nativeSessionId ? null : `${card.turnCount} 轮问答`,
              card.context?.truncated ? '引用上下文已截取' : null].filter(Boolean).join(' · ')),
        ),
        readError && h('div', { className: 'dsh-btw-banner dsh-btw-error', role: 'alert' },
          h('span', null, readError), exploreButton('重新加载', { onClick: refresh })),
        operationError && h('div', { className: 'dsh-btw-banner dsh-btw-error', role: 'alert' }, operationError),
        !composer && card && confirmRemove === card.id && h('div', { className: 'dsh-btw-banner' },
          h('span', { role: 'status' }, removal.running ? '请先停止这一支中正在生成的回答。'
            : `${removal.count ? `从树中移除这张卡及其 ${removal.count} 张后代？` : '从树中移除这张卡片？'}${
              removal.hasNativeSession ? ' 已发送的原生聊天仍可在 DSH 会话列表中打开。' : ''}`),
          h('div', { className: 'dsh-btw-inline-actions' },
            exploreButton('取消', { onClick: () => setConfirmRemove(null) }, 'quiet'),
            exploreButton('确认删除', { onClick: removeSelected, disabled: blocked || removal.running }, 'danger'),
          )),
        !composer && card && !card.saved && h('div', { className: 'dsh-btw-banner dsh-btw-preview' },
          h('span', null, card.turns[0]?.status === 'done' ? '保存后可继续提问，也可以创建子卡。' : '预览 · 首轮回答完成后可保存。'),
          h('div', { className: 'dsh-btw-inline-actions' },
            confirmRemove !== card.id && exploreButton('丢弃', {
              disabled: blocked || card.status === 'running', onClick: () => setConfirmRemove(card.id),
            }, 'quiet'),
            exploreButton('保存卡片', { disabled: blocked || card.turns[0]?.status !== 'done', onClick: () => mutate('save', { cardId: card.id }) }, 'primary'),
          )),
        card?.nativeSessionId && isPage && renderNative ? h(React.Fragment, null,
          h('div', { className: 'dsh-btw-native-source' }, sourceBlock(card.source, sourceParentId, sourceTurnId)),
          card.nativeReady ? renderNative(card, sessionId)
            : h('div', { className: 'dsh-btw-banner' }, '卡片还未完成初始化。',
              exploreButton('打开原生对话', { disabled: blocked, onClick: prepareNative })),
        ) : h('div', { className: 'dsh-btw-scroller', ref: bodyRef, onScroll: rememberScroll },
          h('div', { className: 'dsh-btw-read-column' },
            composer ? h(React.Fragment, null,
              sourceBlock({ ...composer.source, quote: composer.quote }, composer.parentId, composer.anchorTurnId, composer.anchorQuestion, composer.turnNumber),
              preparingNative ? operationError
                ? exploreButton('重试打开', { disabled: blocked, onClick: prepareNative })
                : h('p', { className: 'dsh-btw-start-copy', role: 'status' }, '正在准备原生对话…')
                : h('p', { className: 'dsh-btw-start-copy' }, composer.relation === 'branch'
                ? '从选定轮次接着问，后续问答会记录在这条分支。'
                : composer.relation === 'child' ? '围绕选定的回答提一个新问题。'
                  : composer.quote ? '可以围绕引用追问细节、例子或相关概念。' : '提出一个想在探索里单独讨论的问题。'),
            ) : card ? h(React.Fragment, null,
              sourceBlock(card.source, sourceParentId, sourceTurnId),
              card.nativeSessionId && exploreButton('打开原生对话', { onClick: (event) => openSavedExplorerPage(sessionId, card.id, event.currentTarget) }, 'primary'),
              card.turns.map(renderTurn),
            ) : h('div', { className: 'dsh-btw-empty' },
              isPage && selectedId && reading?.cardId === selectedId && !readError ? h('p', { role: 'status' }, '这张卡片已移除。')
                : !sessionId ? h('p', null, '打开一个聊天后即可开始探索。')
                : !readError && (!reading || selectedId) ? h('p', { role: 'status' }, '正在加载卡片…')
                  : !readError && h(React.Fragment, null, h('h3', null, '还没有探索卡片'),
                    h('p', null, '在主聊天选中文字，或在这里提一个新问题。'),
                    exploreButton('新建探索卡片', { onClick: startRoot }, 'primary'),
                  ),
            ),
          ),
        ),
        promptAllowed && h('div', { className: 'dsh-btw-compose-wrap' },
          h('form', { className: 'dsh-btw-compose', onSubmit: submit },
            h('textarea', {
              ref: inputRef, rows: 2, maxLength: EXPLORE_QUESTION_LIMIT, value: question,
              disabled: pending === 'create' || pending === 'ask',
              'aria-label': composer ? '探索问题' : '继续提问',
              placeholder: composer ? '输入你的问题…' : '在这张卡片里继续提问…',
              onChange: (event) => writeDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) submit(event);
              },
            }),
            h('div', { className: 'dsh-btw-compose-actions' },
              composer ? h('label', { className: 'dsh-btw-preview-toggle' },
                h('input', {
                  type: 'checkbox', checked: composer.preview, disabled: pending === 'create',
                  onChange: (event) => updateComposer({ ...composer, preview: event.target.checked }),
                }), '先预览',
              ) : h('span', { className: 'dsh-btw-shortcut' }, 'Ctrl / ⌘ + Enter'),
              h('div', { className: 'dsh-btw-inline-actions' },
                composer && exploreButton('取消', { disabled: pending === 'create', onClick: () => {
                  if (onClosePage) onClosePage();
                  else {
                    updateComposer(null);
                    setOperationError('');
                  }
                } }, 'quiet'),
                exploreButton(pending === 'create' || pending === 'ask' ? '正在提交…'
                  : composer ? composer.preview ? '生成预览' : '创建卡片' : '继续提问', {
                  type: 'submit', disabled: blocked || !question.trim() || !sessionId,
                }, 'primary'),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
