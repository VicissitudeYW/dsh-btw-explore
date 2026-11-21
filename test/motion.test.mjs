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
const { createPortal } = await import('react-dom');
const read = (file) => fs.readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8');
const { ExploreView, ExplorePages, openExplorerPage, openSavedExplorerPage } = Function('React', 'h', `
  ${read('view')}
  ${read('navigation')}
  ${read('pages')}
  return { ExploreView, ExplorePages, openExplorerPage, openSavedExplorerPage };
`)(React, React.createElement);

function card(id, title, parentId = null) {
  return { id, title, parentId, relation: parentId ? 'child' : 'root', saved: true, status: 'done',
    createdAt: 10, updatedAt: 20, turnCount: 1, context: { messageCount: 2, truncated: false },
    turns: [{ id: `${id}-turn`, question: title, answer: `${title}的回答`, status: 'done' }] };
}

// JSDOM does not render WAAPI. This double controls only that missing browser
// boundary; page mounting, navigation, drafts, focus and effects are real React.
async function mount(t, { reduced = false, support = true, native = false, initialRead, nativeOpen, nativeDetails, inertAwareFocus = false } = {}) {
  document.body.innerHTML = '<main id="owner"><div data-conversation-scroll><article data-chat-flow-kind="assistant"><p id="quote">引用来源的完整正文</p><button id="opener">探索引用</button></article></div><div id="root"></div></main>';
  window.localStorage.clear();
  const root = createRoot(document.querySelector('#root'));
  const sessionId = randomUUID();
  const source = document.querySelector('#opener');
  const owner = document.querySelector('#owner');
  const cards = [card('parent', '父卡'), card('first', '第一个子卡', 'parent'), card('second', '第二个子卡', 'parent'), card('third', '第三个子卡', 'parent')]
    .map((item) => native ? { ...item, nativeSessionId: `native:${item.id}`, nativeReady: true } : item);
  const initialIds = new Set(cards.map((item) => item.id));
  const animations = [];
  const requests = [];
  const refusedFocus = [];
  const nativeMounts = [];
  function NativeSession({ cardId }) {
    React.useEffect(() => { nativeMounts.push(cardId); }, []);
    return React.createElement('section', { 'data-render-native': cardId }, React.createElement('textarea', { defaultValue: '' }));
  }
  const listeners = new Set();
  const media = { matches: reduced, addEventListener: (_name, listener) => listeners.add(listener),
    removeEventListener: (_name, listener) => listeners.delete(listener) };
  const priorAnimate = window.HTMLElement.prototype.animate;
  const priorMedia = window.matchMedia;
  const priorRect = window.HTMLElement.prototype.getBoundingClientRect;
  const priorFocus = window.HTMLElement.prototype.focus;
  if (inertAwareFocus) window.HTMLElement.prototype.focus = function (options) {
    if (this.closest('[inert]')) { refusedFocus.push(this); return; }
    priorFocus.call(this, options);
  };
  window.matchMedia = () => media;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    return this.classList.contains('dsh-btw-page')
      ? { left: 200, top: 80, right: 1040, bottom: 940, width: 840, height: 860 }
      : { left: 240, top: 200, right: 680, bottom: 240, width: 440, height: 40 };
  };
  if (!support) delete window.HTMLElement.prototype.animate;
  else window.HTMLElement.prototype.animate = function (frames, options) {
    let resolve;
    let reject;
    const finished = new Promise((done, fail) => { resolve = done; reject = fail; });
    const animation = { target: this, frames, options, finished, cancelled: false,
      finish() { resolve(animation); },
      cancel() { animation.cancelled = true; reject(new window.DOMException('cancelled', 'AbortError')); } };
    animations.push(animation);
    return animation;
  };
  async function request(_session, { cardId, action, body }) {
    if (action) {
      requests.push({ action, body });
      if (action === 'open-native') {
        await nativeOpen;
        const created = card(body.cardId, body.parentId ? '新子卡' : '新根卡', body.parentId);
        cards.push({ ...created, nativeSessionId: `native:${body.cardId}`, nativeReady: true });
      }
      return { cardId: body.cardId };
    }
    await initialRead;
    if (cardId && !initialIds.has(cardId)) await nativeDetails;
    return structuredClone({ cards: cards.map(({ turns, context, ...meta }) => meta), card: cards.find((item) => item.id === cardId) ?? null });
  }
  let mounted = true;
  const unmount = async () => {
    if (!mounted) return;
    mounted = false;
    await act(async () => root.unmount());
  };
  t.after(async () => {
    await unmount();
    if (priorAnimate) window.HTMLElement.prototype.animate = priorAnimate;
    else delete window.HTMLElement.prototype.animate;
    window.HTMLElement.prototype.getBoundingClientRect = priorRect;
    window.HTMLElement.prototype.focus = priorFocus;
    window.matchMedia = priorMedia;
    document.getSelection().removeAllRanges();
  });
  await act(async () => root.render(React.createElement(React.Fragment, null,
    React.createElement(ExploreView, { sessionId, request }),
    React.createElement(ExplorePages, { sessionId, request, portal: createPortal, ownerRef: { current: source },
      renderNative: native ? (item) => React.createElement(NativeSession, { cardId: item.id }) : undefined }),
  )));
  const top = () => document.querySelector('.dsh-btw-page[data-btw-top]');
  const overlay = () => document.querySelector('.dsh-btw-overlay');
  const settle = () => act(async () => { for (const animation of animations) animation.finish(); });
  const navigate = (title) => act(async () => {
    const button = document.querySelector(`.dsh-btw-map [aria-label="卡片节点 · ${title}"]`);
    assert.ok(button, `找得到节点 ${title}`);
    button.focus();
    button.click();
  });
  const close = () => act(async () => {
    const button = [...top().querySelectorAll('button')].find((item) => /^(返回上层|返回卡片树)$/.test(item.textContent.trim()));
    assert.ok(button);
    button.click();
  });
  return { source, owner, animations, nativeMounts, requests, refusedFocus, top, overlay, settle, navigate, close, unmount, listeners,
    open: (id = 'parent') => act(async () => openSavedExplorerPage(sessionId, id, source)),
    draft: (opener) => act(async () => openExplorerPage(sessionId, {
      key: 'child-draft', relation: 'child', parentId: 'parent', anchorTurnId: 'parent-turn', quote: '选中的来源', preview: true,
    }, opener)),
    rootDraft: () => act(async () => openExplorerPage(sessionId, { key: 'root-draft', relation: 'root', preview: true }, source)),
    reduce: () => act(async () => { media.matches = true; for (const listener of listeners) listener({ matches: true }); }),
  };
}

test('划词进入在清除选区后仍使用来源几何播放短距离展开', async (t) => {
  const app = await mount(t);
  const text = document.querySelector('#quote').firstChild;
  const range = document.createRange();
  range.selectNodeContents(text);
  range.getBoundingClientRect = () => ({ left: 610, top: 498, width: 20, height: 12, right: 630, bottom: 510 });
  document.getSelection().addRange(range);
  await app.draft(app.source);
  document.getSelection().removeAllRanges();
  const incoming = app.animations.find((animation) => animation.target === app.top());
  assert.ok(incoming, '实际页面节点必须播放WAAPI动画');
  assert.equal(app.top().dataset.btwMotion, 'enter');
  assert.equal(incoming.frames[0].translate, '0px -6px');
  assert.equal(Number(incoming.frames[0].scale), 0.985);
  assert.equal(incoming.frames.at(-1).translate, '0px 0px');
  assert.ok(incoming.options.duration >= 160 && incoming.options.duration <= 240);
  await app.settle();
  assert.equal(app.top().hasAttribute('data-btw-motion'), false);
  await app.close();
  await app.settle();
  await app.open();
  const distant = app.animations.findLast((animation) => animation.target === app.top());
  const [x, y] = distant.frames[0].translate.split(' ').map(parseFloat);
  assert.ok(Math.hypot(x, y) <= 24.001, '远处来源的二维位移总长度不可超过24px（容许浮点误差）');
});

test('同级切换播放相反水平位移，重复点击当前页不重播', async (t) => {
  const app = await mount(t);
  await app.open('first');
  await app.settle();
  const firstPage = app.top();
  const count = app.animations.length;
  await app.navigate('第一个子卡');
  assert.equal(app.top(), firstPage);
  assert.equal(app.animations.length, count);
  await app.navigate('第二个子卡');
  const next = app.animations.findLast((animation) => animation.target === app.top());
  assert.ok(next, '新目标必须实际启动动画');
  assert.equal(app.top().dataset.btwMotion, 'switch-next');
  assert.match(next.frames[0].translate, /^18px 0px$/);
  assert.equal(firstPage.isConnected, true, '离开的真实页面应保留至退出完成');
  assert.equal(firstPage.hasAttribute('inert'), true);
  assert.equal(firstPage.getAttribute('aria-hidden'), 'true');
  await app.settle();
  assert.equal(firstPage.isConnected, false);
  await app.navigate('第一个子卡');
  const previous = app.animations.findLast((animation) => animation.target === app.top());
  assert.equal(app.top().dataset.btwMotion, 'switch-prev');
  assert.equal(previous.frames[0].translate, '-18px 0px');
});

test('退出完成前保留真实页面和主界面inert，结束后还原来源焦点与滚动', async (t) => {
  const app = await mount(t);
  const scroller = app.source.closest('[data-conversation-scroll]');
  scroller.scrollTop = 91;
  app.source.focus();
  await app.open();
  await app.settle();
  const page = app.top();
  scroller.scrollTop = 190;
  await app.close();
  assert.ok(app.overlay(), '退出尚未结束时覆盖层不可立即卸载');
  assert.equal(page.isConnected, true);
  assert.equal(page.dataset.btwMotion, 'exit');
  assert.equal(page.hasAttribute('inert'), true);
  assert.equal(app.owner.hasAttribute('inert'), true);
  assert.equal(app.overlay().hasAttribute('inert'), true);
  const exit = app.animations.findLast((animation) => animation.target === page);
  assert.ok(exit.frames.at(-1).opacity < 0.1);
  assert.ok(exit.options.duration < 200);
  await app.settle();
  assert.equal(app.overlay(), null);
  assert.equal(app.owner.hasAttribute('inert'), false);
  assert.equal(document.activeElement, app.source);
  assert.equal(scroller.scrollTop, 91);
});

test('连续切换与迟到的动画完成不会覆盖最后目标', async (t) => {
  const app = await mount(t);
  await app.open('first');
  await app.settle();
  await app.navigate('第二个子卡');
  const superseded = app.animations.slice();
  await app.navigate('第三个子卡');
  const lastPage = app.top();
  await act(async () => { for (const animation of superseded) animation.finish(); });
  assert.equal(app.top(), lastPage);
  assert.equal(lastPage.querySelector('h2').textContent, '第三个子卡');
  assert.ok(lastPage.dataset.btwMotion, '过期完成回调不可提前结束当前动画');
  await app.settle();
  assert.equal(app.top(), lastPage);
  assert.equal(document.querySelectorAll('.dsh-btw-page[data-btw-leaving]').length, 0);
  assert.equal(document.querySelector('.dsh-btw-map [aria-current="page"]').getAttribute('aria-label'), '卡片节点 · 第三个子卡');
});

test('同一批次连续点击只挂载最终原生目标，不为未呈现的中间目标创建退出会话', async (t) => {
  const app = await mount(t, { native: true });
  await app.open('parent');
  await app.settle();
  const parentInput = app.top().querySelector('[data-render-native] textarea');
  parentInput.value = '原生编辑器未提交的草稿';
  await act(async () => {
    document.querySelector('.dsh-btw-map [aria-label="卡片节点 · 第二个子卡"]').click();
    document.querySelector('.dsh-btw-map [aria-label="卡片节点 · 第三个子卡"]').click();
  });
  assert.equal(app.top().querySelector('[data-render-native]').getAttribute('data-render-native'), 'third');
  assert.deepEqual(app.nativeMounts, ['parent', 'third'], '中间状态不可产生原生会话挂载副作用');
  await app.navigate('父卡');
  assert.equal(app.top().querySelector('[data-render-native] textarea'), parentInput);
  assert.equal(parentInput.value, '原生编辑器未提交的草稿');
  assert.equal(app.nativeMounts.filter((id) => id === 'parent').length, 1);
});

test('关闭退出被重新打开打断时旧完成回调不会移除新页面或还原旧焦点', async (t) => {
  const app = await mount(t);
  await app.open('first');
  await app.settle();
  await app.close();
  const retiring = app.animations.slice();
  await app.open('third');
  const lastPage = app.top();
  await act(async () => { for (const animation of retiring) animation.finish(); });
  assert.ok(app.overlay());
  assert.equal(app.top(), lastPage);
  assert.equal(lastPage.querySelector('h2').textContent, '第三个子卡');
  assert.equal(app.owner.hasAttribute('inert'), true);
  assert.notEqual(document.activeElement, app.source);
  assert.equal(lastPage.dataset.btwMotion, 'enter');
  await app.settle();
  assert.equal(app.top(), lastPage);
});

test('原生草稿关闭退场后迟到的初始读取不会再创建持久会话', async (t) => {
  let release;
  const initialRead = new Promise((resolve) => { release = resolve; });
  const app = await mount(t, { native: true, initialRead });
  await app.draft(app.source);
  assert.equal(app.requests.length, 0, '初始读取仍等待时尚未准备原生会话');
  const draft = app.top();
  await app.close();
  assert.equal(draft.isConnected, true, '保持退场DOM以播放关闭动画');
  assert.equal(app.overlay().hasAttribute('data-btw-closing'), true);
  await act(async () => release());
  assert.deepEqual(app.requests, [], '已关闭的草稿不可因迟到GET再触发open-native');
  await app.settle();
  assert.equal(app.overlay(), null);
});

test('退场期间重新打开会先解除覆盖层inert再聚焦新顶层', async (t) => {
  const app = await mount(t, { inertAwareFocus: true });
  await app.open('first');
  await app.settle();
  await app.close();
  assert.equal(app.overlay().hasAttribute('inert'), true);
  document.activeElement.blur();
  await app.open('first');
  assert.equal(app.overlay().hasAttribute('inert'), false);
  assert.equal(document.activeElement === app.top(), true, '真实浏览器不能聚焦inert祖先内的页面');
  assert.equal(app.refusedFocus.length, 0, '聚焦操作发生前必须已经解除inert');
});

for (const relation of ['child', 'root']) {
  test(`${relation}原生草稿等待绑定时当前环保留来源语义，绑定后再移动到真实节点`, async (t) => {
    let release;
    let releaseDetails;
    const nativeOpen = new Promise((resolve) => { release = resolve; });
    const nativeDetails = new Promise((resolve) => { releaseDetails = resolve; });
    const app = await mount(t, { native: true, nativeOpen, nativeDetails });
    await app.open();
    await app.settle();
    const currentNode = () => document.querySelector('.dsh-btw-map [aria-current="page"]');
    assert.equal(currentNode()?.getAttribute('aria-label'), '卡片节点 · 父卡');
    if (relation === 'child') await app.draft(app.source);
    else await app.rootDraft();
    if (relation === 'child') assert.equal(currentNode()?.getAttribute('aria-label'), '卡片节点 · 父卡', '未绑定子卡仍指向来源父卡');
    else assert.equal(currentNode() === null, true, '无父根草稿暂不显示当前环，不能冒充返回入口');
    assert.equal(app.requests.filter((request) => request.action === 'open-native').length, 1);
    await act(async () => release());
    if (relation === 'child') assert.equal(currentNode()?.getAttribute('aria-label'), '卡片节点 · 父卡', 'POST已绑定但cards仍等待刷新时父卡当前环必须连续保留');
    else assert.equal(currentNode() === null, true, 'POST已绑定但cards尚无节点时根草稿仍不显示当前环');
    await act(async () => releaseDetails());
    assert.equal(currentNode()?.getAttribute('aria-label'), `卡片节点 · ${relation === 'child' ? '新子卡' : '新根卡'}`);
  });
}

test('Esc尊重宿主菜单并且每次只退回一层', async (t) => {
  const app = await mount(t);
  await app.open();
  await app.settle();
  const parent = app.top();
  await app.draft(parent.querySelector('button'));
  const child = app.top();
  const menu = document.createElement('div');
  menu.setAttribute('role', 'menu');
  child.append(menu);
  await act(async () => menu.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  assert.equal(app.top(), child, '宿主菜单先处理Esc');
  menu.remove();
  await act(async () => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true })));
  assert.equal(app.top(), parent);
  await app.settle();
  assert.equal(app.top(), parent);
  assert.equal(document.querySelectorAll('.dsh-btw-page').length, 1);
});

test('子卡进入被返回打断时复用父卡并保留草稿与阅读位置', async (t) => {
  const app = await mount(t);
  await app.open();
  await app.settle();
  const parent = app.top();
  const input = parent.querySelector('textarea');
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, '父卡未提交草稿');
  await act(async () => input.dispatchEvent(new window.Event('input', { bubbles: true })));
  const scroller = parent.querySelector('.dsh-btw-scroller');
  scroller.scrollTop = 67;
  const opener = [...parent.querySelectorAll('button')].find((button) => button.textContent === '新建子卡');
  await app.draft(opener);
  const child = app.top();
  assert.equal(parent.hasAttribute('inert'), true);
  await app.close();
  assert.equal(app.top(), parent, '父卡继续使用原来的实例');
  assert.equal(parent.dataset.btwMotion, 'back');
  assert.equal(parent.querySelector('textarea'), input);
  assert.equal(input.value, '父卡未提交草稿');
  assert.equal(scroller.scrollTop, 67);
  assert.ok([...child.querySelectorAll('button')].some((button) => button.textContent === '返回上层'), '退场时保留原来的返回文案以免闪动');
  await app.settle();
  assert.equal(document.activeElement, opener);
  assert.equal(parent.hasAttribute('inert'), false);
  assert.equal(document.querySelectorAll('.dsh-btw-page').length, 1);
});

for (const mode of ['reduced', 'unsupported']) {
  test(`${mode}环境同步开关且不创建动画或遗留退出层`, async (t) => {
    const app = await mount(t, { reduced: mode === 'reduced', support: mode !== 'unsupported' });
    await app.open();
    assert.ok(app.top());
    await app.close();
    assert.equal(app.overlay(), null);
    assert.equal(app.animations.length, 0);
    assert.equal(app.owner.hasAttribute('inert'), false);
    assert.equal(document.activeElement, app.source);
  });
}

test('动画期间切换减少动态效果会立即收束退出并释放焦点锁', async (t) => {
  const app = await mount(t);
  await app.open();
  await app.settle();
  await app.close();
  assert.ok(app.overlay());
  await app.reduce();
  assert.equal(app.overlay(), null);
  assert.equal(app.owner.hasAttribute('inert'), false);
  assert.equal(document.activeElement, app.source);
  assert.equal(app.listeners.size, 0);
});

test('覆盖层卸载会取消未完成动画并释放主界面inert', async (t) => {
  const app = await mount(t);
  await app.open();
  const playing = app.animations.slice();
  assert.ok(playing.length);
  await app.unmount();
  assert.ok(playing.every((animation) => animation.cancelled));
  assert.equal(app.owner.hasAttribute('inert'), false);
  assert.equal(app.listeners.size, 0);
  await act(async () => { for (const animation of playing) animation.finish(); });
  assert.equal(app.overlay(), null);
});
