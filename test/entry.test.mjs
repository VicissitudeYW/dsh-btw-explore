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
const read = (file) => fs.readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8');
const source = [read('view'), 'ExploreView = mockExploreView;', read('drag'), read('pages'), read('navigation'), read('native'), read('entry')].join('\n');
const overlay = () => document.querySelector('[role="dialog"][aria-modal="true"]');

async function setup(t) {
  document.body.innerHTML = '<header id="header"><div id="entry"></div><div data-conversation-tabs><button role="tab">对话</button><button role="tab">探索</button></div></header><div id="detail"></div>';
  const slots = new Map();
  const disposers = [];
  let lastDraft;
  const plugin = Function('React', 'h', 'mockExploreView', 'EXPLORE_CSS', 'require', source)(
    React, React.createElement, (props) => {
      lastDraft = props.initialDraft;
      return props.onClosePage ? React.createElement('button', { onClick: props.onClosePage }, '返回主聊天') : null;
    }, '', () => { throw new Error('no markdown'); },
  );
  plugin.apply({
    get(name) {
      if (name === 'slots') return {
        inject: (_name, install) => install(),
        register: (options, Component) => { slots.set(options.name, { options, Component }); },
      };
      if (name === 'sessions') return { binding: () => undefined };
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
  return { slots, draft: () => lastDraft, navigations: () => navigations };
}

test('the tree is a conversation tab with no duplicate header or assistant action', async (t) => {
  const app = await setup(t);
  assert.equal(document.querySelector('#entry button'), null);
  assert.equal(app.slots.get('conversation.view').options.label, '探索');
  await act(async () => document.querySelector('[role="tab"] + [role="tab"]').click());
  assert.equal(app.navigations(), 1);
  assert.equal(overlay(), null);
  assert.equal(app.slots.has('conversation.chat.assistant-actions'), false);
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
  const action = [...surface.querySelectorAll('button')].find(button => button.textContent === '探索引用');
  assert.ok(action, 'explore remains available when quote claimed the keyed surface');
  assert.equal(surface.querySelector('button').textContent, '引用文本');
  await act(async () => action.click());
  assert.equal(app.navigations(), 0);
  const dialog = overlay();
  assert.ok(dialog);
  assert.equal(app.draft().quote, '讨论事务边界');
  assert.equal(app.draft().source.turn, 3);
  assert.equal(app.draft().source.role, 'assistant');
  assert.equal(document.getSelection().isCollapsed, true);
  await act(async () => dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  assert.equal(overlay(), null);
  const message = region.querySelector('[data-chat-turn]');
  assert.ok(document.activeElement === message);
  assert.equal(message.getAttribute('tabindex'), '-1', 'the message stays focusable until focus leaves');
  document.querySelector('[role="tab"]').focus();
  assert.equal(message.hasAttribute('tabindex'), false);
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
  region.querySelector('button').textContent = '探索引用';
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
  assert.deepEqual([...surface.querySelectorAll('button')].map((button) => button.textContent), ['引用文本', '探索引用', '从此轮分支']);
  await act(async () => [...surface.querySelectorAll('button')].at(-1).click());
  assert.equal(app.navigations(), 0);
  assert.equal(app.draft().relation, 'branch');
  assert.equal(app.draft().parentId, 'parent');
  assert.equal(app.draft().quote, '来自本轮的引用');
  assert.deepEqual(app.draft().source, { role: 'assistant', turn: 4 });
  assert.equal(document.getSelection().isCollapsed, true);
});
