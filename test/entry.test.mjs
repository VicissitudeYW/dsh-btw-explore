import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.invalid/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { createPortal } = await import('react-dom');
const read = (file) => fs.readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8');
const source = [read('view'), 'ExploreView = mockExploreView;', read('drag'), read('pages'), read('navigation'), read('native'), read('entry')].join('\n');
const overlay = () => document.querySelector('[role="dialog"][aria-modal="true"]');

async function setup(t, { cards, portal, fetchRequest, sessionService } = {}) {
  document.body.innerHTML = '<div id="shell"><div data-slot="conversation.header"><header id="header"><div id="entry"></div><div data-conversation-tabs><button role="tab">对话</button><button role="tab">探索</button></div></header></div></div><div id="detail"></div>';
  const slots = new Map();
  const disposers = [];
  let lastDraft;
  let openedCard;
  let request;
  const reads = [];
  const plugin = Function('React', 'h', 'mockExploreView', 'EXPLORE_CSS', 'require', 'fetch', source)(
    React, React.createElement, (props) => {
      request = props.request;
      lastDraft = props.initialDraft;
      if (props.onClosePage) openedCard = props.initialCardId;
      return props.onClosePage ? React.createElement('button', { onClick: props.onClosePage }, '返回主聊天') : null;
    }, '', (id) => {
      if (id === 'react-dom' && portal) return { createPortal };
      throw new Error('module unavailable');
    }, async (path, options) => {
      reads.push(new URL(path, 'https://test.invalid').searchParams.get('sessionId'));
      if (fetchRequest && options.method === 'POST') return fetchRequest(JSON.parse(options.body));
      return { ok: true, json: async () => ({ cards: cards ?? [] }) };
    },
  );
  plugin.apply({
    get(name) {
      if (name === 'slots') return {
        inject: (_name, install) => install(),
        register: (options, Component) => { slots.set(options.name, { options, Component }); },
      };
      if (name === 'sessions') return sessionService ?? { binding: () => undefined };
      if (name === 'uiConversation') return { interactions: { register: () => () => {} }, binding: () => ({ activate() {} }) };
    },
    effect(install) { const dispose = install(); if (dispose) disposers.push(dispose); },
  });
  const root = createRoot(document.querySelector('#entry'));
  const detail = createRoot(document.querySelector('#detail'));
  const headerEntry = slots.get('conversation.session.header.utilities');
  const view = slots.get('conversation.view');
  await act(async () => {
    root.render(React.createElement(headerEntry.Component, headerEntry.options.inject('session-1')));
    detail.render(React.createElement(view.Component, { sessionId: 'session-1' }));
  });
  t.after(async () => {
    await act(async () => { root.unmount(); detail.unmount(); });
    for (const dispose of disposers.reverse()) dispose();
    document.getSelection().removeAllRanges();
  });
  let navigations = 0;
  document.querySelector('[role="tab"] + [role="tab"]').addEventListener('click', () => navigations++);
  return { slots, draft: () => lastDraft, navigations: () => navigations, openedCard: () => openedCard, reads,
    request: (...args) => request(...args) };
}

test('Explain uses the same native card when the running host does not recognize explain-native', async (t) => {
  const card = { cardId: 'retained-card', nativeSessionId: 'session-btw-explore-retained' };
  const body = { cardId: 'requested-card', relation: 'root', source: { turn: 1, role: 'assistant' }, quote: 'Hermite 矩阵' };
  const posts = [];
  const prompts = [];
  let blank = true;
  let released = 0;
  const app = await setup(t, {
    async fetchRequest(post) {
      posts.push(post);
      return post.action === 'explain-native'
        ? { ok: false, status: 400, json: async () => ({ error: '未知卡片操作。' }) }
        : { ok: true, status: 200, json: async () => card };
    },
    sessionService: { retain(nativeSessionId) {
      const session = {
        sessionId: nativeSessionId, getSnapshot: () => ({ openState: 'open', blank }),
        async prompt(content, mode, _signal, requestId) {
          prompts.push({ nativeSessionId, content, mode, requestId });
          blank = false;
          return { ok: true, value: { accepted: true } };
        },
      };
      return { ready: Promise.resolve({ session }), release() { released++; } };
    } },
  });
  const explain = () => app.request('session-1', { action: 'explain-native', body });
  assert.deepEqual(await explain(), card);
  assert.deepEqual(await explain(), card);
  assert.deepEqual(posts, ['explain-native', 'open-native', 'explain-native', 'open-native']
    .map((action) => ({ ...body, sessionId: 'session-1', action })));
  assert.equal(prompts.length, 1, 'an existing native reply must not trigger a second explanation');
  assert.equal(prompts[0].nativeSessionId, card.nativeSessionId);
  assert.equal(prompts[0].mode, 'queue');
  assert.match(prompts[0].content[0].text, /解释.*选中的内容/);
  assert.equal(prompts[0].requestId, 'btw-explore:explain:session-btw-explore-retained');
  assert.equal(released, 2);
});

test('Explain never falls back after a failed or successful request to a current host', async (t) => {
  const card = { cardId: 'ready-card', nativeSessionId: 'session-ready' };
  const options = { action: 'explain-native', body: { cardId: card.cardId, quote: 'quote' } };
  const actions = [];
  let status = 503;
  const app = await setup(t, { async fetchRequest(post) {
    actions.push(post.action);
    return { ok: status === 200, status, json: async () => status === 200 ? card : { error: '暂时无法发起解释，请重试。' } };
  } });
  await assert.rejects(app.request('session-1', options), /暂时无法发起解释/);
  status = 200;
  assert.deepEqual(await app.request('session-1', options), card);
  assert.deepEqual(actions, ['explain-native', 'explain-native']);
});

test('the tree is a conversation tab with no duplicate header or assistant action', async (t) => {
  const app = await setup(t);
  assert.equal(document.querySelector('#entry button'), null);
  assert.equal(app.slots.get('conversation.view').options.label, '探索');
  await act(async () => document.querySelector('[role="tab"] + [role="tab"]').click());
  assert.equal(app.navigations(), 1);
  assert.equal(overlay(), null);
  assert.equal(app.slots.has('conversation.chat.assistant-actions'), false);
});

test('main chat left edge reveals a saved card without an open dialog', async (t) => {
  const app = await setup(t, { portal: true, cards: [{ id: 'saved', title: '既有卡片', relation: 'root' }] });
  const mainMap = () => document.querySelector('.dsh-btw-chat-map');
  const main = document.createElement('div');
  main.dataset.conversationContent = '';
  main.dataset.conversationSession = 'other-session';
  main.innerHTML = '<div data-chat-flow></div>';
  main.getBoundingClientRect = () => ({ left: 300, right: 1300, top: 75, bottom: 800, width: 1000, height: 725 });
  await act(async () => document.querySelector('#shell').append(main));
  assert.equal(mainMap(), null);
  assert.deepEqual(app.reads, []);

  await act(async () => { main.dataset.conversationSession = 'session-1'; });
  const map = mainMap();
  assert.ok(map, 'saved nodes are mounted in the main chat even without a dialog');
  assert.equal(map.closest('[data-conversation-content]'), main);
  assert.deepEqual(app.reads, ['session-1']);
  assert.equal(overlay(), null);
  const move = (x, y) => window.dispatchEvent(new window.PointerEvent('pointermove', { pointerType: 'mouse', clientX: x, clientY: y }));
  map.getBoundingClientRect = () => ({ left: 306, right: 430, top: 340, bottom: 540 });
  move(291, 480);
  assert.equal(map.hasAttribute('data-btw-near'), false, 'sidebar is outside the reveal edge');
  move(310, 218);
  assert.equal(map.hasAttribute('data-btw-near'), true, 'main chat edge reveals the map beyond the vertical bounds of the map itself');
  move(409, 480);
  assert.equal(map.hasAttribute('data-btw-near'), true, 'pointer can move from the edge to the nodes');
  move(700, 480);
  assert.equal(map.hasAttribute('data-btw-near'), false);

  move(310, 480);
  const saved = map.querySelector('button[data-btw-node-key="saved"]');
  await act(async () => saved.click());
  assert.ok(overlay());
  assert.equal(app.openedCard(), 'saved');
  assert.ok(main.closest('[inert]'), 'the dialog suppresses the original chat rail');
  await act(async () => overlay().querySelector('button').click());
  assert.equal(overlay(), null);
  assert.equal(document.activeElement, saved, 'the saved node remains connected for focus restoration');

  await act(async () => main.querySelector('[data-chat-flow]').remove());
  assert.equal(mainMap(), null, 'an inactive native chat has no main rail');
});

test('selection action coexists with an earlier native quote handler and preserves the source', async (t) => {
  const app = await setup(t);
  const region = document.createElement('div');
  region.dataset.conversationSession = 'session-1';
  region.innerHTML = '<div data-chat-flow-kind="assistant-step" data-chat-turn="3"><p>讨论事务边界</p></div><div data-text-interaction-surface aria-hidden="false"><button>引用文本</button></div>';
  document.body.append(region);
  const range = document.createRange();
  range.selectNodeContents(region.querySelector('p'));
  document.getSelection().addRange(range);
  await act(async () => document.dispatchEvent(new window.Event('selectionchange')));
  const surface = region.querySelector('[data-text-interaction-surface]');
  const action = [...surface.querySelectorAll('button')].find(button => button.textContent === '探索');
  assert.ok(action, 'explore remains available when quote claimed the keyed surface');
  assert.equal(surface.querySelector('button').textContent, '引用文本');
  await act(async () => action.click());
  assert.equal(app.navigations(), 0);
  const dialog = overlay();
  assert.ok(dialog);
  assert.equal(app.draft().quote, '讨论事务边界');
  assert.equal(app.draft().source.turn, 3);
  assert.equal(app.draft().source.role, 'assistant');
  assert.equal(Boolean(app.draft().explain), false);
  assert.equal(document.getSelection().isCollapsed, true);
  await act(async () => dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  assert.equal(overlay(), null);
  const message = region.querySelector('[data-chat-turn]');
  assert.ok(document.activeElement === message);
  assert.equal(message.getAttribute('tabindex'), '-1', 'the message stays focusable until focus leaves');
  document.querySelector('[role="tab"]').focus();
  assert.equal(message.hasAttribute('tabindex'), false);

  await act(async () => {
    document.getSelection().removeAllRanges();
    document.getSelection().addRange(range);
    document.dispatchEvent(new window.Event('selectionchange'));
  });
  const explain = [...surface.querySelectorAll('button')].find(button => button.textContent === '解释');
  assert.ok(explain);
  await act(async () => explain.click());
  assert.ok(overlay());
  assert.equal(app.draft().quote, '讨论事务边界');
  assert.equal(app.draft().source.turn, 3);
  assert.equal(app.draft().explain, true);
});

test('selection supplementation ignores other sessions and never duplicates a native exploration action', async (t) => {
  await setup(t);
  const region = document.createElement('div');
  region.dataset.conversationSession = 'session-other';
  region.innerHTML = '<div data-chat-flow-kind="user" data-chat-turn="0"><p>别的会话</p></div><div data-text-interaction-surface aria-hidden="false"><button>引用文本</button></div>';
  document.body.append(region);
  const range = document.createRange();
  range.selectNodeContents(region.querySelector('p'));
  document.getSelection().addRange(range);
  await act(async () => document.dispatchEvent(new window.Event('selectionchange')));
  assert.equal(region.querySelectorAll('button').length, 1);
  region.dataset.conversationSession = 'session-1';
  region.querySelector('button').textContent = '探索';
  region.querySelector('button').dataset.dshBtwSelection = 'native';
  await act(async () => document.dispatchEvent(new window.Event('selectionchange')));
  assert.equal(region.querySelectorAll('button').length, 1);
});

test('划词菜单只从单条消息打开原生卡；子卡可用同一段文字新建分支', async (t) => {
  const app = await setup(t);
  const frame = document.createElement('section');
  frame.className = 'dsh-btw-page';
  frame.dataset.btwTop = '';
  frame.innerHTML = `<div data-btw-root-session="session-1" data-btw-native-card="parent">
    <div data-conversation-session="native-1">
      <div data-chat-flow-kind="assistant-step" data-chat-turn="4"><p>来自本轮的引用</p></div>
      <div data-chat-flow-kind="user" data-chat-turn="5"><p>下一轮</p></div>
      <div data-text-interaction-surface aria-hidden="false"><button>引用文本</button></div>
    </div>
  </div>`;
  document.body.append(frame);
  const surface = frame.querySelector('[data-text-interaction-surface]');
  const paragraphs = frame.querySelectorAll('p');
  const select = async (end) => {
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild, 0);
    range.setEnd(end.firstChild, end.textContent.length);
    await act(async () => {
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(range);
      document.dispatchEvent(new window.Event('selectionchange'));
    });
  };
  await select(paragraphs[1]);
  assert.equal(surface.querySelectorAll('button').length, 1, '跨消息选区不挂探索操作');
  await select(paragraphs[0]);
  assert.deepEqual([...surface.querySelectorAll('button')].map((button) => button.textContent), ['引用文本', '解释', '探索', '从此轮分支']);
  await act(async () => [...surface.querySelectorAll('button')].at(-1).click());
  assert.equal(app.navigations(), 0);
  assert.equal(app.draft().relation, 'branch');
  assert.equal(app.draft().parentId, 'parent');
  assert.equal(app.draft().quote, '来自本轮的引用');
  assert.deepEqual(app.draft().source, { role: 'assistant', turn: 4 });
  assert.equal(document.getSelection().isCollapsed, true);
});
