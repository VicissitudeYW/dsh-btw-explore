import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.invalid/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
const { createRoot } = await import('react-dom/client');
const read = (file) => fs.readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8');
const { ExploreView, ExplorePages, openExplorerPage, exploreRootDraft, exploreNodeLayout } = Function('React', 'h', `
  ${read('view')}
  ${read('navigation')}
  ${read('pages')}
  return { ExploreView, ExplorePages, openExplorerPage, exploreRootDraft, exploreNodeLayout };
`)(React, React.createElement);

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function makeCard(id = randomUUID(), extra = {}) {
  return {
    id, title: '根卡问题', saved: true, parentId: null, relation: 'root', anchorTurnId: null,
    source: { kind: 'main', turn: 7, role: 'assistant', messageId: 'm-7' },
    status: 'done', createdAt: 10, updatedAt: 20, turnCount: 1,
    context: { mode: 'main', messageCount: 2, truncated: false },
    turns: [{ id: randomUUID(), question: '根卡问题', answer: '阅读时选择一小段文字，即可围绕它继续探索。', status: 'done', createdAt: 10 }],
    ...extra,
  };
}

async function mount(t, { entry = null, initialCards = [], intercept = async () => undefined } = {}) {
  document.body.innerHTML = '<div id="root"></div>';
  window.localStorage.clear();
  const container = document.querySelector('#root');
  const root = createRoot(container);
  const cards = new Map(initialCards.map((card) => [card.id, structuredClone(card)]));
  const calls = [];
  const sessionId = randomUUID();
  let sourceJump;

  async function request(session, options) {
    const { cardId, action, body } = options;
    if (action) calls.push({ sessionId: session, action, body: structuredClone(body) });
    const replacement = await intercept(session, options, cards);
    if (replacement !== undefined) return replacement;
    if (!action) return structuredClone({
      cards: [...cards.values()].map(({ turns, context, ...metadata }) => metadata),
      card: cards.get(cardId) ?? null,
    });
    if (action === 'create') {
      const { cardId, turnId, relation, question, preview, quote, source, parentId = null, anchorTurnId = null } = body;
      if (!cards.has(cardId)) cards.set(cardId, makeCard(cardId, {
        title: question, saved: !preview, relation, parentId, anchorTurnId,
        source: relation === 'root' ? { kind: 'main', ...source, quote }
          : { kind: 'card', cardId: parentId, turnId: anchorTurnId, quote },
        turns: [{ id: turnId, question, answer: '作答内容', status: 'done', createdAt: 10 }],
      }));
      return { cardId, turnId };
    }
    const card = cards.get(body.cardId);
    if (action === 'save') card.saved = true;
    if (action === 'ask' && !card.turns.some((turn) => turn.id === body.turnId)) {
      card.turns.push({ id: body.turnId, question: body.question, answer: '继续作答', status: 'done', createdAt: 12 });
      card.turnCount += 1;
    }
    if (action === 'stop' || action === 'retry') {
      card.status = action === 'stop' ? 'cancelled' : 'done';
      const turn = card.turns.find((turn) => turn.id === body.turnId);
      turn.status = card.status;
      if (action === 'retry') turn.answer = '重试后的回答';
    }
    if (action === 'remove') cards.clear();
    return { cardId: body.cardId, turnId: body.turnId };
  }

  function render() {
    const h = React.createElement;
    root.render(h(React.Fragment, null,
      h(ExploreView, { sessionId, request, onChat: (source) => { sourceJump = source; } }),
      h(ExplorePages, { sessionId, request }),
    ));
  }
  function layers() { return [...container.querySelectorAll('.dsh-btw-page')]; }
  function surface() { return layers().at(-1) ?? container; }
  function button(label, scope = surface()) {
    return [...scope.querySelectorAll('button')].find((element) =>
      (element.querySelector('.dsh-btw-node-name') ?? element).textContent.trim() === label);
  }
  async function click(label) {
    const element = button(label);
    assert.ok(element, `按钮 ${label} 应可见`);
    assert.equal(element.disabled, false, `按钮 ${label} 应可用`);
    await act(async () => element.click());
  }
  async function fill(text) {
    const textarea = surface().querySelector('textarea');
    assert.ok(textarea, '应提供问题输入框');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, text);
    await act(async () => textarea.dispatchEvent(new window.Event('input', { bubbles: true })));
  }

  await act(async () => render());
  const openEntry = (next) => act(async () => openExplorerPage(sessionId, exploreRootDraft(next), null, 'chat'));
  if (entry) await openEntry(entry);
  t.after(async () => { await act(async () => root.unmount()); });
  return {
    container, cards, calls, button, click, fill, sessionId, layers, surface,
    text: () => surface().textContent,
    source: () => sourceJump,
    entry: openEntry,
    refresh: async () => {
      await act(async () => {
        window.dispatchEvent(new window.Event('focus'));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    },
  };
}

test('预览失败保留草稿并复用请求 ID，保存后续问并从首轮创建分支', async (t) => {
  const nativeSource = { turn: 7, messageId: 'm-7', role: 'assistant' };
  let failCreate = true;
  const view = await mount(t, {
    entry: { key: 'quote-entry', source: nativeSource, quote: '引用的原句' },
    intercept: async (_session, { action }) => {
      if (action === 'create' && failCreate) throw Error('连接中断，请重试');
    },
  });
  assert.equal(view.calls.length, 0, '挂载和打开引用不会调用生成接口');
  assert.match(view.text(), /引用的原句/);
  await view.fill('追问最初的内容');
  await view.click('生成预览');
  assert.match(view.text(), /连接中断，请重试/);
  assert.equal(view.surface().querySelector('textarea').value, '追问最初的内容');
  const firstAttempt = view.calls.at(-1).body;
  failCreate = false;
  await view.click('生成预览');
  const preview = view.calls.at(-1).body;
  assert.equal(preview.cardId, firstAttempt.cardId);
  assert.equal(preview.turnId, firstAttempt.turnId);
  assert.equal(preview.preview, true);
  assert.deepEqual(preview.source, nativeSource);
  assert.equal(preview.quote, '引用的原句');
  assert.equal(view.button('从此轮分支'), undefined, '预览不能作为父卡');
  await view.click('保存卡片');
  assert.equal(view.calls.at(-1).action, 'save');
  await view.fill('继续问第二个问题');
  await view.click('继续提问');
  assert.equal(view.calls.at(-1).body.cardId, preview.cardId);
  await view.click('从此轮分支');
  assert.equal(view.layers().length, 2);
  await view.fill('从首轮走另一条路');
  await view.click('创建卡片');
  const branch = view.calls.at(-1).body;
  assert.equal(branch.parentId, preview.cardId);
  assert.equal(branch.anchorTurnId, preview.turnId);
  assert.equal(branch.relation, 'branch');
  await view.click('返回上层');
  assert.equal(view.layers().length, 1);
  assert.match(view.text(), /继续作答/);
  await view.click('返回主聊天');
  assert.equal(view.layers().length, 0);
  assert.equal(view.source(), undefined, 'dismissing a page does not navigate to the chat tab');
});

test('圆点导航按纵向大纲排列，大量同级卡和深层子卡不会撑宽导航', () => {
  const parent = makeCard();
  const siblings = Array.from({ length: 30 }, () => makeCard(randomUUID(), { parentId: parent.id }));
  const nested = [];
  for (let index = 0; index < 30; index += 1) {
    nested.push(makeCard(randomUUID(), { parentId: nested.at(-1)?.id ?? siblings[0].id }));
  }
  const compact = exploreNodeLayout([parent, siblings[0]]);
  const full = exploreNodeLayout([parent, ...siblings, ...nested]);
  assert.equal(full.width, compact.width, '节点增加只能增加导航高度');
  assert.equal(new Set(full.nodes.map((node) => node.y)).size, full.nodes.length, '每个节点应独占一行');
  for (const node of full.nodes) {
    assert.ok(node.x >= 17 && node.x + 17 <= full.width, '圆点点击区应完整留在导航宽度内');
    if (node.parent) assert.ok(node.y > node.parent.y, '子卡位于来源卡下方');
  }
});

test('独立的圆点导航保持焦点，切换同级卡后回到父卡会还原草稿和阅读位置', async (t) => {
  const parent = makeCard();
  const child = makeCard(randomUUID(), { title: '第一个子卡', parentId: parent.id, relation: 'child' });
  const sibling = makeCard(randomUUID(), { title: '同级分支', parentId: parent.id, relation: 'branch' });
  const view = await mount(t, { initialCards: [parent, child, sibling], entry: { source: { turn: 7 } } });
  const navigation = view.container.querySelector('nav[aria-label="探索卡片关系导航"]');
  assert.ok(navigation);
  assert.ok(!navigation.closest('.dsh-btw-page'), '导航应在子卡外面');
  assert.ok(navigation.closest('[role="dialog"][aria-modal="true"]'), '屏幕阅读器应能在覆盖层中访问导航');
  const node = (title) => navigation.querySelector(`[aria-label="卡片节点 · ${title}"]`);
  const choose = async (title) => {
    const button = node(title);
    assert.ok(button, `找得到节点 ${title}`);
    await act(async () => { button.focus(); button.click(); });
    assert.equal(document.activeElement, button);
    assert.equal(button.getAttribute('aria-current'), 'page');
    assert.equal(view.surface().querySelector('h2').textContent, title);
  };
  await choose(parent.title);
  const parentPage = view.surface();
  await view.fill('父卡还没有发送的草稿');
  view.surface().querySelector('.dsh-btw-scroller').scrollTop = 61;
  await choose(child.title);
  assert.equal(view.layers()[0].hasAttribute('inert'), true);
  assert.equal(view.surface().hasAttribute('inert'), false);
  const map = navigation.querySelector('.dsh-btw-map-viewport');
  map.scrollTop = 44;
  await view.refresh();
  assert.equal(map.scrollTop, 44, '轮询不应打断正在浏览的导航位置');
  Object.defineProperty(map, 'clientHeight', { value: 36 });
  await act(async () => window.dispatchEvent(new window.Event('resize')));
  assert.equal(map.scrollTop, parseFloat(node(child.title).style.top) - 18, '窗口变化后当前圆点应回到可视范围');
  await choose(sibling.title);
  await act(async () => {
    node(child.title).click();
    node(sibling.title).click();
  });
  assert.equal(view.surface().querySelector('h2').textContent, sibling.title, '连续切换以最后点击为准');
  await choose(parent.title);
  assert.equal(view.surface(), parentPage, '导航应复用已挂载的父卡');
  assert.equal(view.surface().hasAttribute('inert'), false);
  assert.equal(view.surface().querySelector('textarea').value, '父卡还没有发送的草稿');
  assert.equal(view.surface().querySelector('.dsh-btw-scroller').scrollTop, 61);
});

test('选区建子卡保留原文、父卡和指定轮次，默认先预览', async (t) => {
  const card = makeCard();
  const view = await mount(t, { initialCards: [card] });
  const sourcePage = view.container.querySelector('.dsh-btw-scroller');
  sourcePage.scrollTop = 160;
  await view.fill('留在父卡的草稿');
  const text = view.container.querySelector('[data-btw-answer] .dsh-btw-plain-answer').firstChild;
  const range = document.createRange();
  range.setStart(text, 0);
  range.setEnd(text, 9);
  const quote = range.toString();
  await act(async () => {
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.dispatchEvent(new window.Event('selectionchange'));
  });
  await view.click('用选区建子卡');
  assert.equal(view.layers().length, 1);
  assert.match(view.text(), new RegExp(quote));
  await view.fill('详细解释这句话');
  await view.click('生成预览');
  assert.deepEqual(view.calls.at(-1).body, {
    cardId: view.calls.at(-1).body.cardId,
    turnId: view.calls.at(-1).body.turnId,
    relation: 'child', question: '详细解释这句话', preview: true,
    parentId: card.id, anchorTurnId: card.turns[0].id, quote,
  });
  await view.click('返回卡片树');
  assert.equal(view.container.querySelector('.dsh-btw-scroller'), sourcePage);
  assert.equal(sourcePage.scrollTop, 160);
  assert.equal(view.container.querySelector('textarea').value, '留在父卡的草稿');
  assert.ok(view.button('详细解释这句话'), 'generated preview is available in the tree');
});

test('重新打开运行中的卡片可停止，并对同一轮重试', async (t) => {
  const card = makeCard();
  card.status = 'running';
  card.turns[0].status = 'running';
  card.turns[0].answer = '已生成的开头';
  const view = await mount(t, { initialCards: [card] });
  assert.equal(view.calls.length, 0);
  assert.match(view.text(), /已生成的开头/);
  await view.click('停止生成');
  assert.deepEqual(view.calls.at(-1).body, { cardId: card.id, turnId: card.turns[0].id });
  assert.match(view.text(), /已停止生成/);
  await view.click('重试本轮');
  assert.equal(view.calls.at(-1).action, 'retry');
  assert.equal(view.calls.at(-1).body.turnId, card.turns[0].id);
  assert.match(view.text(), /重试后的回答/);
});

test('父卡被盖住时仍然接收新回答，返回后保持来源处的滚动位置', async (t) => {
  const card = makeCard();
  card.status = 'running';
  card.turns.push({ id: randomUUID(), question: '另一轮的问题', answer: '继续生成中', status: 'running' });
  const view = await mount(t, { initialCards: [card] });
  const scroller = view.surface().querySelector('.dsh-btw-scroller');
  let height = 560;
  Object.defineProperties(scroller, { clientHeight: { value: 400 }, scrollHeight: { get: () => height } });
  scroller.scrollTop = 160;
  await act(async () => scroller.dispatchEvent(new window.Event('scroll')));
  await view.click('新建子卡');
  height = 880;
  view.cards.get(card.id).turns[1].answer = '继续生成中：越来越长的回答';
  await view.refresh();
  assert.match(scroller.textContent, /越来越长的回答/);
  assert.equal(scroller.scrollTop, 160, 'background tokens do not advance the covered reader');
  await view.click('返回卡片树');
  assert.equal(scroller.scrollTop, 160);
});

test('创建子卡后父卡重新读取期间也能返回到触发按钮', async (t) => {
  const card = makeCard();
  const delayedParent = deferred();
  let readingParent = false;
  const view = await mount(t, {
    initialCards: [card],
    intercept: async (_session, { action, cardId }) => {
      if (!action && cardId === card.id && readingParent) await delayedParent.promise;
    },
  });
  const trigger = view.button('新建子卡');
  await view.click('新建子卡');
  await view.fill('父卡在子卡提交后重新读取');
  readingParent = true;
  await view.click('创建卡片');
  await view.click('返回卡片树');
  assert.ok(document.activeElement === trigger, 'focus returns to the child card button while the parent loads');
  await act(async () => delayedParent.resolve());
});

test('切换卡片后忽略迟到的旧详情响应', async (t) => {
  const a = makeCard(randomUUID(), { title: '卡片 A', updatedAt: 30 });
  const b = makeCard(randomUUID(), { title: '卡片 B' });
  const holdA = deferred();
  const view = await mount(t, {
    initialCards: [a, b],
    intercept: async (_session, { action, cardId }) => {
      if (!action && cardId === a.id) return holdA.promise;
    },
  });
  await view.click('卡片 B');
  assert.equal(view.container.querySelector('.dsh-btw-head-title h2').textContent, '卡片 B');
  await act(async () => holdA.resolve({ cards: [a, b], card: a }));
  assert.equal(view.container.querySelector('.dsh-btw-head-title h2').textContent, '卡片 B');
});

test('关闭待提交页面后迟到的创建结果进入树，不会替换新打开的子页', async (t) => {
  const submitted = deferred();
  let posted;
  const view = await mount(t, {
    entry: { key: 'old', quote: '旧引用' },
    intercept: async (_session, { action, body }) => {
      if (action === 'create') { posted = body; await submitted.promise; }
    },
  });
  await view.fill('旧引用的问题');
  await view.click('生成预览');
  await view.click('返回主聊天');
  assert.equal(view.layers().length, 0);
  await view.entry({ key: 'new', quote: '新引用' });
  await act(async () => submitted.resolve());
  assert.equal(view.surface().querySelector('.dsh-btw-head-title h2').textContent, '新建探索卡片');
  assert.match(view.text(), /新引用/);
  assert.doesNotMatch(view.text(), /旧引用/);
  assert.equal(view.surface().querySelector('textarea').value, '');
  await view.click('返回主聊天');
  assert.equal(view.cards.get(posted.cardId).saved, false);
  assert.ok(view.button('旧引用的问题'));
});

test('删除前检查全部后代状态并显示级联删除数量', async (t) => {
  const card = makeCard();
  const child = makeCard(randomUUID(), { parentId: card.id, relation: 'child', status: 'running', updatedAt: 12 });
  const view = await mount(t, { initialCards: [card, child] });
  await view.click('删除');
  assert.match(view.text(), /请先停止这一支中正在生成/);
  assert.equal(view.button('确认删除').disabled, true);
  view.cards.get(child.id).status = 'done';
  await view.refresh();
  assert.match(view.text(), /及其 1 张后代/);
  await view.click('确认删除');
  assert.equal(view.calls.at(-1).action, 'remove');
  assert.equal(view.calls.at(-1).body.cardId, card.id);
  assert.match(view.text(), /还没有探索卡片/);
});

test('续问响应丢失后保留问题，重试沿用原 turnId', async (t) => {
  let loseResponse = true;
  const card = makeCard();
  const view = await mount(t, {
    initialCards: [card],
    intercept: async (_session, { action }) => {
      if (action === 'ask' && loseResponse) throw Error('网络断开');
    },
  });
  await view.fill('需要保留的追问');
  await view.click('继续提问');
  const attempt = view.calls.at(-1).body;
  assert.equal(view.container.querySelector('textarea').value, '需要保留的追问');
  loseResponse = false;
  await view.click('继续提问');
  assert.deepEqual(view.calls.at(-1).body, attempt);
  assert.equal(view.container.querySelector('textarea').value, '');
});
