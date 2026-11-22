import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.invalid/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const source = fs.readFileSync(new URL('../src/view.js', import.meta.url), 'utf8');
const ExploreView = Function('React', 'h', `${source}\nreturn ExploreView;`)(React, React.createElement);

test('原生卡的外层控件保留返回、来源跳转和明确的移除确认', async (t) => {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.querySelector('#root'));
  const quote = '需要保留并可展开的来源原文。'.repeat(30);
  const parent = { id: 'parent', title: '来源卡片', saved: true, relation: 'root', parentId: null,
    nativeSessionId: 'native-parent', nativeReady: true, turns: [], status: 'done' };
  const card = { id: 'child', title: '当前探索问题', saved: true, relation: 'child', parentId: parent.id,
    nativeSessionId: 'native-child', nativeReady: true, turns: [], status: 'done',
    source: { kind: 'card', cardId: parent.id, quote } };
  const actions = [];
  const navigation = [];
  let closed = 0;
  const request = async (_sessionId, options) => {
    if (options.action) actions.push(options.action);
    return { cards: [parent, card], card, cardId: card.id };
  };
  const button = (name) => [...document.querySelectorAll('button')].find((element) =>
    (element.getAttribute('aria-label') ?? element.textContent.trim()) === name);
  const click = async (name) => {
    const element = button(name);
    assert.ok(element, `控件 ${name} 应可通过既有名称找到`);
    assert.equal(element.disabled, false);
    await act(async () => element.click());
  };

  await act(async () => root.render(React.createElement(ExploreView, {
    sessionId: 'owner', initialCardId: card.id, request,
    pageTitleId: 'card-heading', returnLabel: '返回上层', onClosePage: () => { closed += 1; },
    onNavigate: (trail) => navigation.push(trail.map((item) => item.id)),
    renderNative: () => React.createElement('section', { 'data-native-content': true }, '原生消息与输入'),
  })));
  t.after(async () => { await act(async () => root.unmount()); });

  assert.equal(document.querySelector('h1#card-heading').textContent, `${quote.slice(0, 40)}…`);
  assert.ok(document.querySelector('[data-native-content]'));
  assert.ok(document.querySelector('[data-btw-drag-handle]'));
  assert.doesNotMatch(document.body.textContent, /根卡|子卡|分支/);
  assert.equal(button('返回上层').getAttribute('title'), 'Esc');
  assert.ok(document.querySelector('nav[aria-label="卡片路径"]').textContent.includes(parent.title));
  assert.equal(document.querySelector('.dsh-btw-source-label').textContent, `来自 ${parent.title}`);
  const details = document.querySelector('.dsh-btw-quote-details');
  assert.equal(details.open, false);
  await act(async () => details.querySelector('summary').click());
  assert.equal(details.open, true);
  assert.equal(document.querySelector('.dsh-btw-quoted-full').textContent, quote);
  for (const icon of document.querySelectorAll('.dsh-btw-chrome-icon')) {
    assert.equal(icon.getAttribute('aria-hidden'), 'true', '装饰图标不应改写控件名称');
  }

  await click('返回来源');
  assert.deepEqual(navigation, [[parent.id]]);
  await click('从树中移除卡片和后代');
  assert.deepEqual(actions, [], '打开确认前后都不应直接移除');
  assert.match(document.querySelector('[role="status"]').textContent, /对话记录仍可在 DSH 会话列表中查看/);
  await click('取消');
  assert.equal(button('确认删除'), undefined);
  await click('从树中移除卡片和后代');
  await click('确认删除');
  assert.deepEqual(actions, ['remove']);
  assert.equal(closed, 1);
});
