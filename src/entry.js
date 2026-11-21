const EXPLORE_PATH = '/api/dsh-btw-explore';
const EXPLORE_VIEW = 'dsh-btw-explore';
let sessionsService;
let conversationService;

async function explorerRequest(sessionId, options = {}) {
  const { action, body, cardId, signal } = options;
  let url = EXPLORE_PATH;
  const init = { credentials: 'same-origin', cache: 'no-store', signal };
  if (action) {
    init.method = 'POST';
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify({ ...body, sessionId, action });
  } else {
    const query = new URLSearchParams({ sessionId });
    if (cardId) query.set('cardId', cardId);
    url += `?${query}`;
  }
  const response = await fetch(url, init);
  let result;
  try { result = await response.json(); }
  catch { throw new Error('探索服务暂不可用，请重新连接 DSH。'); }
  if (!response.ok) throw new Error(result.error || '探索请求失败，请稍后重试。');
  return result;
}

function mainSelectionOrigin() {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return {};
  const element = (node) => node?.nodeType === 1 ? node : node?.parentElement;
  const start = element(selection.anchorNode);
  const end = element(selection.focusNode);
  const row = start?.closest('[data-chat-flow-kind="assistant-step"], [data-chat-flow-kind="assistant"], [data-chat-flow-kind="user"]');
  if (!row || !end || !row.contains(end)) return {};
  const source = { role: row.getAttribute('data-chat-flow-kind') === 'user' ? 'user' : 'assistant' };
  const turn = row.getAttribute('data-chat-turn');
  if (turn !== null && /^\d+$/.test(turn) && Number.isSafeInteger(Number(turn))) source.turn = Number(turn);
  return { source, row };
}

function openFromChat(sessionId, { source, quote, opener }) {
  openExplorerPage(sessionId, exploreRootDraft({ source, quote }), opener, 'chat');
}

function openNativeChild(owner, relation, source, opener, quote = '') {
  openExplorerPage(owner.ownerSessionId, {
    key: `${relation}:${owner.cardId}:${source.messageId ?? source.turn}`,
    relation, parentId: owner.cardId, source, quote: quote.trim().slice(0, EXPLORE_QUOTE_LIMIT),
  }, opener);
}

let NativeMarkdown;
let explorerPortal;
try { NativeMarkdown = require('@deepseek-ai/dsh-client-ui-primitives').MarkdownText; } catch {}
try { explorerPortal = require('react-dom').createPortal; } catch {}

class ExploreMarkdownBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? h('div', { style: { whiteSpace: 'pre-wrap' } }, this.props.text) : this.props.children;
  }
}

function ExplorerMarkdown(props) {
  if (!NativeMarkdown) return h('div', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, props.text);
  return h(ExploreMarkdownBoundary, { text: props.text }, h(NativeMarkdown, {
    ...props, variant: 'body', labels: { code: { copyLabel: '复制', copiedLabel: '已复制' }, footnotes: '脚注' },
  }));
}

function NativeExplorer({ sessionId, openView, renderFactorySlot }) {
  const [notice, setNotice] = React.useState('');
  const onChat = (source) => {
    if (typeof openView !== 'function') { setNotice('请从会话上方切换到聊天。'); return; }
    const turn = source?.turn;
    const scroll = () => {
      if (!Number.isSafeInteger(turn)) return;
      const row = document.querySelector(`[data-chat-turn="${turn}"][data-chat-flow-kind]`);
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    if (Number.isSafeInteger(source?.boundarySeq)) {
      void sessionsService?.binding(sessionId)?.session?.loadThrough(source.boundarySeq).catch(() => {});
    }
    openView('chat');
    setTimeout(scroll, 150);
  };
  return h(React.Fragment, null,
    notice ? h('div', { role: 'status', className: 'dsh-btw-error' }, notice) : null,
    h(ExploreView, { key: sessionId, sessionId, onChat, request: explorerRequest, Markdown: ExplorerMarkdown,
      nativeCards: typeof renderFactorySlot === 'function' }));
}

// rc.5's utility slot has no shell store actions. Select its resident tab,
// letting the shell perform its own view activation and persistence.
function activateExplorerTab(button) {
  const tabs = button?.closest('header')?.querySelector('[data-conversation-tabs]');
  if (!tabs) return;
  const isExplore = (element) => element.textContent.trim() === '探索';
  const tab = [...tabs.querySelectorAll('[role="tab"]')].find(isExplore);
  if (tab) { tab.click(); return; }

  // When space is limited, the same view is offered by the header's portal menu.
  const more = tabs.parentElement.querySelector('button[aria-haspopup="menu"]');
  const anchor = more?.parentElement.style.getPropertyValue('anchor-name');
  if (!anchor) return;
  const findItem = () => {
    const menu = [...document.querySelectorAll('[role="menu"]')]
      .find((element) => element.style.getPropertyValue('position-anchor') === anchor);
    return [...menu?.querySelectorAll('[role="menuitem"]') ?? []].find(isExplore);
  };
  const existing = findItem();
  if (existing) { existing.click(); return; }
  const cleanup = () => {
    observer.disconnect();
    clearTimeout(timeout);
  };
  const observer = new MutationObserver(() => {
    if (!more.isConnected) { cleanup(); return; }
    const item = findItem();
    if (item) { cleanup(); item.click(); }
  });
  const timeout = setTimeout(cleanup, 750);
  observer.observe(document.body, { childList: true, subtree: true });
  if (more.getAttribute('aria-expanded') !== 'true') more.click();
}

// Text interactions are first-claim keyed surfaces in rc.5. If native quotes
// claimed the selection, append our action alongside it without replacing it.
function supplementSelection(sessionId) {
  let added;
  let surface;
  let queued = false;
  let disposed = false;
  const remove = () => {
    added?.remove();
    surface?.classList.remove('dsh-btw-selection-surface');
    added = surface = undefined;
  };
  const sync = () => {
    queued = false;
    if (disposed) return;
    const selection = document.getSelection();
    const anchor = selection?.anchorNode;
    const element = anchor?.nodeType === 1 ? anchor : anchor?.parentElement;
    const region = element?.closest('[data-conversation-session]');
    const native = region?.closest('[data-btw-native-card]');
    const isOwned = native ? native.dataset.btwRootSession === sessionId : region?.dataset.conversationSession === sessionId;
    const next = isOwned && !selection?.isCollapsed
      ? region.querySelector('[data-text-interaction-surface][aria-hidden="false"]') : null;
    if (next === surface && added?.isConnected && !next.querySelector('[data-dsh-btw-selection="native"]')) return;
    remove();
    if (!next || next.querySelector('[data-dsh-btw-selection]') || !selection?.toString().trim()) return;
    surface = next;
    added = document.createElement('button');
    added.type = 'button';
    added.className = 'dsh-btw-entry';
    added.dataset.dshBtwSelection = 'supplement';
    added.textContent = '探索引用';
    added.setAttribute('aria-haspopup', 'dialog');
    added.addEventListener('pointerdown', (event) => event.preventDefault());
    added.addEventListener('mousedown', (event) => event.preventDefault());
    added.addEventListener('click', () => {
      const quote = document.getSelection()?.toString().trim();
      if (quote) {
        const { source, row } = mainSelectionOrigin();
        if (native && source) openNativeChild({ ownerSessionId: sessionId, cardId: native.dataset.btwNativeCard }, 'child', source, row ?? region, quote);
        else if (!native) openFromChat(sessionId, { source, quote, opener: row ?? region });
      }
      document.getSelection()?.removeAllRanges();
      remove();
    });
    surface.classList.add('dsh-btw-selection-surface');
    surface.appendChild(added);
  };
  const schedule = () => {
    if (!queued && !disposed) { queued = true; queueMicrotask(sync); }
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
  document.addEventListener('selectionchange', schedule);
  schedule();
  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener('selectionchange', schedule);
    remove();
  };
}

function ExplorerEntry({ sessionId, renderFactorySlot }) {
  const button = React.useRef(null);
  React.useEffect(() => supplementSelection(sessionId), [sessionId]);
  return h(React.Fragment, null,
    h('button', { ref: button, type: 'button', className: 'dsh-btw-entry', title: '打开旁路卡片树', onClick: () => activateExplorerTab(button.current) }, '探索'),
    h(ExplorePages, { key: sessionId, sessionId, request: explorerRequest, Markdown: ExplorerMarkdown,
      portal: explorerPortal, ownerRef: button,
      renderNative: typeof renderFactorySlot !== 'function' ? undefined : (card, ownerSessionId) =>
        renderFactorySlot(EXPLORE_NATIVE_FACTORY, { ownerSessionId, cardId: card.id, nativeSessionId: card.nativeSessionId }),
    }),
  );
}

function AskFromMessage({ sessionId, messageId, useChat }) {
  const owner = React.useContext(ExploreCardContext);
  let source = {};
  if (typeof useChat === 'function') {
    source = useChat((snapshot) => {
      for (const turn of snapshot?.timeline?.turns?.values?.() ?? []) {
        if (turn.data?.get('turn-tail')?.closing?.finalNode?.messageId === messageId) return { turn: turn.turn, messageId, role: 'assistant' };
      }
      return { messageId, role: 'assistant' };
    });
  } else if (messageId) source = { messageId, role: 'assistant' };
  if (owner) return h('span', { className: 'dsh-btw-native-actions' },
    ['child', 'branch'].map((relation) => h('button', { key: relation, type: 'button', className: 'dsh-btw-entry', 'aria-haspopup': 'dialog',
      onClick: (event) => openNativeChild(owner, relation, source, event.currentTarget),
    }, relation === 'child' ? '新建子卡' : '从此轮分支')),
  );
  return h('button', { type: 'button', className: 'dsh-btw-entry', title: '从这条回答探索', 'aria-haspopup': 'dialog',
    onClick: (event) => openFromChat(sessionId, { source, opener: event.currentTarget }),
  }, '探索');
}

function AskSelection({ sessionId, useSession, readText, dismiss, clearSelection }) {
  const owner = React.useContext(ExploreCardContext);
  const resolvedSessionId = typeof useSession === 'function' ? useSession((session) => session.sessionId) : sessionId;
  return h('button', { type: 'button', className: 'dsh-btw-entry', 'data-dsh-btw-selection': 'native', 'aria-haspopup': 'dialog', onPointerDown: (event) => event.preventDefault(), onClick: (event) => {
    const text = readText?.();
    if (text?.trim()) {
      const { source, row } = mainSelectionOrigin();
      const opener = row ?? event.currentTarget.closest('[data-conversation-session]');
      if (owner && source) openNativeChild(owner, 'child', source, opener, text);
      else if (!owner) openFromChat(resolvedSessionId ?? sessionId, { source, quote: text, opener });
    }
    clearSelection?.();
    dismiss?.();
  } }, '探索引用');
}

return {
  inject: ['slots', 'sessions', 'uiConversation'],
  apply(ctx) {
    const slots = ctx.get('slots');
    sessionsService = ctx.get('sessions');
    conversationService = ctx.get('uiConversation');
    if (!slots || !sessionsService || !conversationService) throw new Error('[dsh-btw-explore] 缺少 DSH 会话 UI，请检查插件依赖。');
    if (typeof slots.registerFactory === 'function') registerExploreNative(slots);
    ctx.effect(() => {
      const style = document.createElement('style');
      style.dataset.plugin = EXPLORE_VIEW;
      style.textContent = EXPLORE_CSS;
      document.head.appendChild(style);
      return () => style.remove();
    });
    slots.inject('conversation.view', () => slots.register({
      name: 'conversation.view', id: EXPLORE_VIEW, order: 16, label: '探索',
      inject: (sessionId) => ({ sessionId }),
    }, NativeExplorer));
    slots.inject('conversation.session.header.utilities', () => slots.register({
      name: 'conversation.session.header.utilities', id: EXPLORE_VIEW, order: 20,
      inject: (sessionId) => ({ sessionId }),
    }, ExplorerEntry));
    slots.inject('conversation.chat.assistant-actions', () => slots.register({
      name: 'conversation.chat.assistant-actions', id: EXPLORE_VIEW, order: 35,
      inject: (sessionId) => ({ sessionId }),
    }, AskFromMessage));
    ctx.effect(() => conversationService.interactions.register({
      id: EXPLORE_VIEW,
      onInteraction(request) {
        if (!request.hasSelection || !request.readText()?.trim()) return;
        if (request.trigger === 'selection' && conversationService.interactions.getSnapshot?.().includes('quote')) return;
        request.open();
      },
    }));
    slots.inject('conversation.chat.text-interaction', () => slots.register({
      name: 'conversation.chat.text-interaction', key: EXPLORE_VIEW, id: EXPLORE_VIEW,
      inject: (sessionId) => ({ sessionId }),
    }, AskSelection));
  },
};
