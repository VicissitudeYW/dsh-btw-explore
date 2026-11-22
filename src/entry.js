const EXPLORE_PATH = '/api/dsh-btw-explore';
const EXPLORE_VIEW = 'dsh-btw-explore';
const explorerViewOpeners = new Map();
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

function chatSelection() {
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const element = (node) => node?.nodeType === 1 ? node : node?.parentElement;
  const start = element(selection.anchorNode);
  const end = element(selection.focusNode);
  const rowSelector = '[data-chat-flow-kind="assistant-step"], [data-chat-flow-kind="assistant"], [data-chat-flow-kind="user"]';
  const skipped = 'input, textarea, button, [contenteditable="true"], [inert], [aria-hidden="true"]';
  const row = start?.closest(rowSelector);
  if (!row || end?.closest(rowSelector) !== row || start.closest(skipped) || end.closest(skipped)) return null;
  const region = row.closest('[data-conversation-session]');
  if (!region) return null;
  const native = region.closest('[data-btw-native-card]');
  if (native && !native.closest('.dsh-btw-page[data-btw-top]:not([data-btw-leaving])')) return null;
  const turn = row.getAttribute('data-chat-turn');
  const quote = selection.toString().trim().slice(0, EXPLORE_QUOTE_LIMIT);
  if (!quote || turn === null || !/^\d+$/.test(turn) || !Number.isSafeInteger(Number(turn))) return null;
  return { source: { role: row.dataset.chatFlowKind === 'user' ? 'user' : 'assistant', turn: Number(turn) }, row, region, native, quote };
}

function openChatSelection({ source, row, region, native, quote }, action) {
  const relation = action === 'branch' ? 'branch' : 'child';
  const explain = action === 'explain';
  if (native) {
    const parentId = native.dataset.btwNativeCard;
    openExplorerPage(native.dataset.btwRootSession, {
      key: `${relation}:${parentId}:${source.turn}`, relation, parentId, source, quote, explain,
    }, row);
  } else {
    openExplorerPage(region.dataset.conversationSession, { ...exploreRootDraft({ source, quote }), explain }, row, 'chat');
  }
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
  React.useLayoutEffect(() => {
    if (typeof openView !== 'function') return;
    explorerViewOpeners.set(sessionId, openView);
    return () => {
      if (explorerViewOpeners.get(sessionId) === openView) explorerViewOpeners.delete(sessionId);
    };
  }, [sessionId, openView]);
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

// Text interactions are first-claim keyed surfaces in rc.5. If native quotes
// claimed the selection, append our action alongside it without replacing it.
function supplementSelection(sessionId) {
  let added;
  let surface;
  let queued = false;
  let disposed = false;
  const remove = () => {
    added?.remove();
    added = surface = undefined;
  };
  const sync = () => {
    queued = false;
    if (disposed) return;
    const selected = chatSelection();
    const { region, native } = selected ?? {};
    const isOwned = native ? native.dataset.btwRootSession === sessionId : region?.dataset.conversationSession === sessionId;
    const next = isOwned ? region.querySelector('[data-text-interaction-surface][aria-hidden="false"]') : null;
    if (next === surface && added?.isConnected && !next.querySelector('[data-dsh-btw-selection="native"]')) return;
    remove();
    if (!next || next.querySelector('[data-dsh-btw-selection]')) return;
    surface = next;
    added = document.createElement('span');
    added.className = 'dsh-btw-selection-actions';
    added.dataset.dshBtwSelection = 'supplement';
    for (const [action, label] of exploreSelectionActions(Boolean(native))) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dsh-btw-selection-button';
      button.textContent = label;
      button.setAttribute('aria-haspopup', 'dialog');
      button.addEventListener('pointerdown', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        const current = chatSelection();
        if (current?.region === region && current.native === native) {
          openChatSelection(current, action);
          document.getSelection()?.removeAllRanges();
        }
        remove();
      });
      added.append(button);
    }
    surface.appendChild(added);
  };
  const schedule = () => {
    if (!queued && !disposed) { queued = true; queueMicrotask(sync); }
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-hidden', 'inert', 'data-btw-top'] });
  document.addEventListener('selectionchange', schedule);
  schedule();
  return () => {
    disposed = true;
    observer.disconnect();
    document.removeEventListener('selectionchange', schedule);
    remove();
  };
}

function ExplorerHost({ sessionId, renderFactorySlot }) {
  const owner = React.useRef(null);
  const returnToChat = React.useCallback(() => explorerViewOpeners.get(sessionId)?.('chat'), [sessionId]);
  React.useEffect(() => supplementSelection(sessionId), [sessionId]);
  return h(React.Fragment, null,
    h('span', { ref: owner, hidden: true, style: { display: 'none' } }),
    explorerPortal && h(ExploreChatNavigation, { key: `chat-map:${sessionId}`, sessionId,
      ownerRef: owner, request: explorerRequest, portal: explorerPortal }),
    h(ExplorePages, { key: sessionId, sessionId, request: explorerRequest, Markdown: ExplorerMarkdown,
      portal: explorerPortal, ownerRef: owner, onReturnChat: returnToChat,
      renderNative: typeof renderFactorySlot !== 'function' ? undefined : (card, ownerSessionId) =>
        renderFactorySlot(EXPLORE_NATIVE_FACTORY, { ownerSessionId, cardId: card.id, nativeSessionId: card.nativeSessionId }),
    }),
  );
}

function AskSelection({ sessionId, useSession, readText, dismiss, clearSelection }) {
  const resolvedSessionId = typeof useSession === 'function' ? useSession((session) => session.sessionId) : sessionId;
  const selected = chatSelection();
  if (!selected || selected.region.dataset.conversationSession !== resolvedSessionId || !readText?.()?.trim()) return null;
  return h('span', { className: 'dsh-btw-selection-actions', 'data-dsh-btw-selection': 'native' },
    exploreSelectionActions(Boolean(selected.native)).map(([action, label]) => h('button', { key: action, type: 'button',
      className: 'dsh-btw-selection-button', 'aria-haspopup': 'dialog', onPointerDown: (event) => event.preventDefault(), onClick: () => {
        const current = chatSelection();
        if (current?.region === selected.region && current.native === selected.native) {
          openChatSelection(current, action);
          clearSelection?.();
        }
        dismiss?.();
      },
    }, label)));
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
    }, ExplorerHost));
    ctx.effect(() => conversationService.interactions.register({
      id: EXPLORE_VIEW,
      onInteraction(request) {
        if (!request.hasSelection || !request.readText()?.trim() || !chatSelection()) return;
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
