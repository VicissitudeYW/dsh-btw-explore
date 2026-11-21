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
const source = [read('view'), 'ExploreView = mockExploreView;', read('pages'), read('navigation'), read('native'), read('entry')].join('\n');
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

test('header selects the tree; assistant entry opens a child page without switching tabs', async (t) => {
  const app = await setup(t);
  await act(async () => document.querySelector('#entry button').click());
  assert.equal(app.navigations(), 1);
  assert.equal(overlay(), null);
  const assistant = app.slots.get('conversation.chat.assistant-actions');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  t.after(async () => { await act(async () => root.unmount()); });
  await act(async () => root.render(React.createElement(assistant.Component, { sessionId: 'session-1', messageId: 'message-1' })));
  const opener = container.querySelector('button');
  await act(async () => opener.click());
  assert.equal(app.navigations(), 1, 'message action leaves the current view active');
  assert.ok(overlay());
  assert.equal(app.draft().source.messageId, 'message-1');
  await act(async () => overlay().querySelector('button').click());
  assert.equal(overlay(), null);
  assert.equal(document.activeElement, opener);
});

test('opening the tree selects the exploration item in the same header overflow menu', async (t) => {
  await setup(t);
  const tabs = document.querySelector('[data-conversation-tabs]');
  tabs.querySelector('[role="tab"] + [role="tab"]').remove();
  const anchor = document.createElement('span');
  anchor.style.setProperty('anchor-name', '--fixture-header');
  anchor.innerHTML = '<button aria-haspopup="menu" aria-expanded="false">更多会话视图</button>';
  tabs.after(anchor);
  const other = document.createElement('div');
  other.innerHTML = '<div role="menu" style="position-anchor: --other-header"><button role="menuitem">探索</button></div>';
  document.body.append(other);
  other.querySelector('button').addEventListener('click', () => assert.fail('another menu was selected'));
  let navigated = false;
  anchor.querySelector('button').addEventListener('click', () => {
    queueMicrotask(() => {
      const menu = document.createElement('div');
      menu.setAttribute('role', 'menu');
      menu.style.setProperty('position-anchor', '--fixture-header');
      menu.innerHTML = '<button role="menuitem">探索</button>';
      menu.querySelector('button').addEventListener('click', () => { navigated = true; });
      document.body.append(menu);
    });
  });
  await act(async () => document.querySelector('#entry button').click());
  assert.equal(navigated, true);
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
  document.querySelector('#entry button').focus();
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
