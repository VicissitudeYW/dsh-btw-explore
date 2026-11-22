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
const read = (name) => fs.readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8');
const { ExploreNavigation, exploreNodeLayout } = Function('React', 'h', `${read('view')}\n${read('navigation')}\nreturn { ExploreNavigation, exploreNodeLayout };`)(React, React.createElement);

let viewportSize = { width: 144, height: 200 };
Object.defineProperties(window.HTMLElement.prototype, {
  clientWidth: { configurable: true, get() { return this.classList.contains('dsh-btw-map-viewport') ? viewportSize.width : 0; } },
  clientHeight: { configurable: true, get() { return this.classList.contains('dsh-btw-map-viewport') ? viewportSize.height : 0; } },
});

const card = (id, extra = {}) => ({ id, title: id, parentId: null, relation: 'root', ...extra });

async function mount(t, cards, activeId, size = { width: 144, height: 200 }) {
  document.body.innerHTML = '<div id="root"></div>';
  viewportSize = size;
  const moves = [];
  const root = createRoot(document.querySelector('#root'));
  t.after(async () => { await act(async () => root.unmount()); });
  let graph = exploreNodeLayout(cards);
  const render = async (nextCards = cards, nextActive = activeId) => {
    if (nextCards !== cards) graph = exploreNodeLayout(nextCards);
    cards = nextCards;
    activeId = nextActive;
    await act(async () => root.render(React.createElement(ExploreNavigation, {
      graph, activeId, returnLabel: '返回主聊天', onNavigate: (trail) => moves.push(trail.map((item) => item.id)),
    })));
  };
  await render();
  return {
    render, moves,
    node: (id) => document.querySelector(`.dsh-btw-map-node[data-btw-node-key="${id}"]`)
      ?? document.querySelector(`[aria-label="卡片节点 · ${id === 'home' ? '返回主聊天' : id}"]`),
    area: document.querySelector('.dsh-btw-map-viewport'),
    stage: () => document.querySelector('.dsh-btw-map-stage'),
  };
}

async function key(node, value) {
  await act(async () => node.dispatchEvent(new window.KeyboardEvent('keydown', { key: value, bubbles: true })));
}

async function pointer(target, type, properties = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, Object.fromEntries(Object.entries({
    pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: 80, clientY: 100, ...properties,
  }).map(([name, value]) => [name, { value }])));
  await act(async () => target.dispatchEvent(event));
  return event;
}

const position = (view, id) => ({
  x: parseFloat(view.node(id).style.left) + (parseFloat(view.stage()?.style.paddingLeft) || 0) - view.area.scrollLeft,
  y: parseFloat(view.node(id).style.top) + (parseFloat(view.stage()?.style.paddingTop) || 0) - view.area.scrollTop,
});

test('同层四点可以放下时，打开或切到两端都不会裁掉另一端', async (t) => {
  const cards = ['left', 'middle-left', 'middle-right', 'right'].map((id) => card(id));
  const view = await mount(t, cards, 'middle-left', { width: 170, height: 200 });
  const assertVisible = () => {
    for (const { id } of cards) {
      const { x } = position(view, id);
      assert.ok(x - 18 >= 10 && x + 18 <= viewportSize.width - 10,
        `${id} 的点击区和焦点环应完整显示（中心 x=${x}）`);
    }
  };
  assertVisible();
  for (const id of ['right', 'left']) {
    await act(async () => view.node(id).click());
    await view.render(cards, id);
    assertVisible();
  }
  assert.deepEqual(view.moves, [['right'], ['left']]);
  await act(async () => view.area.dispatchEvent(new window.WheelEvent('wheel', { deltaX: 500, bubbles: true, cancelable: true })));
  assertVisible();
  viewportSize.width = 72;
  await act(async () => window.dispatchEvent(new window.Event('resize')));
  await act(async () => view.node('left').focus());
  await key(view.node('left'), 'End');
  assert.equal(document.activeElement, view.node('right'));
  assert.equal(position(view, 'right').x, 36, '窄屏仍能浏览到最右圆点');
  viewportSize.width = 170;
  await act(async () => window.dispatchEvent(new window.Event('resize')));
  assertVisible();
});

test('悬停和空间方向键显示标题，只保留一个 Tab 入口且浏览不会切卡', async (t) => {
  const cards = [card('parent', { turnCount: 3 }), card('child', { parentId: 'parent', relation: 'child' })];
  const view = await mount(t, cards, 'parent');
  await act(async () => view.node('child').dispatchEvent(new window.MouseEvent('pointerover', { bubbles: true })));
  assert.match(document.querySelector('[role="tooltip"]').textContent, /child/);
  assert.doesNotMatch(document.querySelector('[role="tooltip"]').textContent, /轮问答/, '未知问答数不能编造');
  await act(async () => view.node('child').dispatchEvent(new window.MouseEvent('pointerout', { bubbles: true })));
  assert.equal(document.querySelector('[role="tooltip"]'), null);
  await act(async () => view.node('parent').focus());
  assert.match(document.querySelector('[role="tooltip"]').textContent, /3 轮问答/);
  await act(async () => view.node('parent').dispatchEvent(new window.MouseEvent('pointerover', { bubbles: true })));
  await key(view.node('parent'), 'ArrowUp');
  assert.ok(document.activeElement === view.node('child'), '子卡在上方，向上浏览应进入子卡');
  assert.match(document.querySelector('[role="tooltip"]').textContent, /child/, '键盘提示优先于旧的悬停节点');
  assert.equal(document.querySelectorAll('.dsh-btw-map-node[tabindex="0"]').length, 1);
  assert.equal(view.node('child').tabIndex, 0);
  assert.deepEqual(view.moves, [], '方向键只浏览焦点');
  await act(async () => view.node('child').click());
  assert.deepEqual(view.moves, [['parent', 'child']]);
  await view.render(cards, 'child');
  assert.ok(document.querySelector('[aria-current="page"]') === view.node('child'));
  assert.equal(view.node('parent').hasAttribute('data-btw-on-path'), true);
  assert.equal(document.querySelectorAll('.dsh-btw-map-current').length, 1);
});

test('左右浏览同层，向下返回空间来源，Home 和 End 可抵达图的两端', async (t) => {
  const view = await mount(t, [card('parent'), card('branch', { parentId: 'parent', relation: 'branch' }),
    card('child', { parentId: 'parent', relation: 'child' }), card('other')], 'parent');
  await act(async () => view.node('parent').focus());
  await key(view.node('parent'), 'ArrowLeft');
  assert.ok(document.activeElement === view.node('branch'));
  await key(view.node('branch'), 'ArrowRight');
  assert.ok(document.activeElement === view.node('parent'));
  await key(view.node('parent'), 'ArrowUp');
  assert.ok(document.activeElement === view.node('child'));
  await key(view.node('child'), 'ArrowDown');
  assert.ok(document.activeElement === view.node('parent'));
  await key(view.node('parent'), 'Home');
  assert.ok(document.activeElement === view.node('home'));
  await key(view.node('home'), 'End');
  assert.ok(document.activeElement === view.node('child'));
  assert.deepEqual(view.moves, []);
});

test('键盘重新进入导航时，焦点提示覆盖鼠标遗留的悬停节点', async (t) => {
  const view = await mount(t, [card('parent'), card('child', { parentId: 'parent', relation: 'child' })], 'parent');
  await act(async () => view.node('child').dispatchEvent(new window.MouseEvent('pointerover', { bubbles: true })));
  await act(async () => view.node('parent').focus());
  assert.match(document.querySelector('[role="tooltip"]').textContent, /parent/);
  assert.doesNotMatch(document.querySelector('[role="tooltip"]').textContent, /child/);
});

test('原生对话卡不把旁侧元数据的零轮当成实际问答数', async (t) => {
  const view = await mount(t, [card('native', { nativeSessionId: 'native-session', turnCount: 0 })], 'native');
  await act(async () => view.node('native').focus());
  assert.match(document.querySelector('[role="tooltip"]').textContent, /native/);
  assert.doesNotMatch(document.querySelector('[role="tooltip"]').textContent, /轮问答/);
});

test('后台移除正在浏览的节点时焦点回到存活来源，已移到输入框时不抢焦点', async (t) => {
  const cards = [card('parent'), card('child', { parentId: 'parent', relation: 'child' })];
  const view = await mount(t, cards, 'parent');
  await act(async () => view.node('child').focus());
  await view.render([cards[0]], 'parent');
  assert.ok(document.activeElement === view.node('parent'), '删除节点后仍可继续用方向键浏览');
  assert.equal(view.node('parent').tabIndex, 0);
  assert.deepEqual(view.moves, [], '焦点回退不应打开卡片');
  await view.render(cards, 'parent');
  await act(async () => view.node('child').focus());
  const input = document.createElement('input');
  document.body.append(input);
  await act(async () => input.focus());
  await view.render([cards[0]], 'parent');
  assert.ok(document.activeElement === input, '用户已离开导航时不能夺回焦点');
});

test('手动平移到非当前层后，后台扩宽该层保持可见节点的位置', async (t) => {
  const cards = [card('parent'), ...Array.from({ length: 30 }, (_, index) =>
    card(`child-${index}`, { parentId: 'parent', relation: 'child' }))];
  const view = await mount(t, cards, 'parent');
  viewportSize.width = 72;
  await act(async () => window.dispatchEvent(new window.Event('resize')));
  await act(async () => {
    view.area.scrollLeft = 0;
    view.area.scrollTop = 0;
    view.area.dispatchEvent(new window.Event('scroll'));
  });
  const before = position(view, 'child-0');
  assert.deepEqual(before, { x: 36, y: 100 });
  assert.ok(position(view, 'parent').x > viewportSize.width, '当前卡已经不在用户浏览区域');
  await view.render([...cards, card('child-30', { parentId: 'parent', relation: 'child' })], 'parent');
  assert.deepEqual(position(view, 'child-0'), before, '视野外的当前卡不应成为平移补偿的锚点');
});

test('undefined 来源不误标 home，只有明确 null 才表示返回主聊天', async (t) => {
  const view = await mount(t, [card('parent')], undefined);
  assert.equal(document.querySelector('[aria-current]'), null);
  assert.equal(document.querySelector('.dsh-btw-map-current'), null);
  await view.render([card('parent')], null);
  assert.ok(document.querySelector('[aria-current="page"]') === view.node('home'));
  await view.render([card('parent')], 'missing');
  assert.equal(document.querySelector('[aria-current]'), null);
});

test('连线从圆周边缘接入，分支用同层曲线且路径保持来源关系', async (t) => {
  const view = await mount(t, [card('parent'), card('child', { parentId: 'parent', relation: 'child' }),
    card('branch', { parentId: 'parent', relation: 'branch' })], 'branch');
  const paths = [...document.querySelectorAll('.dsh-btw-map-lines path')];
  assert.equal(paths.length, 3);
  for (const path of paths) {
    assert.match(path.getAttribute('d'), /^M [-\d.]+ [-\d.]+ C /, '正式导航使用 cubic Bezier 连线');
  }
  const branchLine = paths.find((path) => path.getAttribute('data-btw-node-key') === 'branch');
  assert.ok(branchLine);
  const coordinates = branchLine.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.equal(coordinates[1], parseFloat(view.node('branch').style.top));
  assert.equal(coordinates.at(-1), coordinates[1], '相邻同层分支沿同一水平层连接');
  assert.notEqual(coordinates[0], parseFloat(view.node('parent').style.left), '连线不应从圆心穿出');
  await act(async () => view.node('branch').click());
  assert.deepEqual(view.moves, [['parent', 'branch']], '同层布局不能丢失来源卡片');
});

test('跨过同层节点的分支连线从下方绕行，保留中间36px点击区的可辨边界', async (t) => {
  const view = await mount(t, [card('parent'), ...Array.from({ length: 8 }, (_, index) =>
    card(`branch-${index}`, { parentId: 'parent', relation: 'branch' }))], 'parent');
  const path = document.querySelector('path[data-btw-node-key="branch-0"]');
  const commands = [...path.getAttribute('d').matchAll(/([MC])\s+([\d. -]+)/g)];
  let [x, y] = commands[0][2].trim().split(/\s+/).map(Number);
  const baseline = parseFloat(view.node('parent').style.top);
  const obstacles = Array.from({ length: 7 }, (_, index) => ({
    x: parseFloat(view.node(`branch-${index + 1}`).style.left), y: baseline,
  }));
  assert.ok(y >= baseline, '绕行应在本层下方，避免进入上方子卡连线');
  for (const command of commands.slice(1)) {
    const [cx1, cy1, cx2, cy2, endX, endY] = command[2].trim().split(/\s+/).map(Number);
    for (let step = 0; step <= 100; step += 1) {
      const t = step / 100;
      const pointX = (1 - t) ** 3 * x + 3 * (1 - t) ** 2 * t * cx1 + 3 * (1 - t) * t ** 2 * cx2 + t ** 3 * endX;
      const pointY = (1 - t) ** 3 * y + 3 * (1 - t) ** 2 * t * cy1 + 3 * (1 - t) * t ** 2 * cy2 + t ** 3 * endY;
      assert.ok(pointY >= baseline, '跨项连线保持在本层下方');
      for (const obstacle of obstacles) assert.ok(Math.hypot(pointX - obstacle.x, pointY - obstacle.y) >= 18,
        '曲线不能穿过中间节点的36px点击区');
    }
    x = endX;
    y = endY;
  }
});

test('切卡与 resize 居中，普通刷新和无关增删保留当前浏览锚', async (t) => {
  const cards = [card('parent'), ...Array.from({ length: 8 }, (_, index) => card(`child-${index}`, { parentId: 'parent', relation: 'child' }))];
  const view = await mount(t, cards, 'parent');
  assert.deepEqual(position(view, 'parent'), { x: 72, y: 100 });
  assert.equal(parseFloat(view.stage().style.paddingLeft), 48);
  assert.equal(parseFloat(view.stage().style.paddingTop), 76);
  view.area.scrollLeft = 100;
  view.area.scrollTop = 31;
  await act(async () => view.area.dispatchEvent(new window.Event('scroll')));
  const anchor = position(view, 'parent');
  await view.render(cards.map((item) => ({ ...item, updatedAt: 25 })), 'parent');
  assert.deepEqual(position(view, 'parent'), anchor, '轮询不能把正在浏览的图抢回当前点');
  await view.render([...cards, card('added', { parentId: 'parent', relation: 'child' })], 'parent');
  assert.deepEqual(position(view, 'parent'), anchor, '画布变宽时当前节点的屏幕位置应保留');
  await view.render(cards.slice(0, -1), 'parent');
  assert.deepEqual(position(view, 'parent'), anchor);
  await view.render(cards, 'child-7');
  assert.deepEqual(position(view, 'child-7'), { x: 72, y: 100 });
  viewportSize = { width: 72, height: 260 };
  await act(async () => window.dispatchEvent(new window.Event('resize')));
  assert.deepEqual(position(view, 'child-7'), { x: 36, y: 130 });
});

test('刷新优先保留键盘正在浏览的节点位置，宽树全部节点都能进入可视区', async (t) => {
  const cards = [card('parent'), ...Array.from({ length: 30 }, (_, index) => card(`child-${index}`, { parentId: 'parent', relation: 'child' }))];
  const view = await mount(t, cards, 'parent');
  await act(async () => view.node('parent').focus());
  await key(view.node('parent'), 'End');
  assert.ok(document.activeElement === view.node('child-29'));
  assert.deepEqual(position(view, 'child-29'), { x: 72, y: 100 });
  const anchor = position(view, 'child-29');
  await view.render([...cards, card('added', { parentId: 'parent', relation: 'child' })], 'parent');
  assert.ok(document.activeElement === view.node('child-29'));
  assert.deepEqual(position(view, 'child-29'), anchor);
  for (let index = 29; index > 0; index -= 1) await key(view.node(`child-${index}`), 'ArrowLeft');
  assert.ok(document.activeElement === view.node('child-0'));
  const first = position(view, 'child-0');
  assert.ok(first.x >= 18 && first.x <= 126 && first.y >= 18 && first.y <= 182, '最左侧节点点击区完整可见');
  assert.deepEqual(view.moves, []);
});

test('后台增加深层卡改变视口高度时保留锚点，并补偿实际 padding 的变化', async (t) => {
  const cards = [card('parent'), card('child', { parentId: 'parent', relation: 'child' })];
  const view = await mount(t, cards, 'parent');
  viewportSize = { width: 144, height: 240 };
  await act(async () => window.dispatchEvent(new window.Event('resize')));
  view.area.scrollTop = 45;
  await act(async () => view.area.dispatchEvent(new window.Event('scroll')));
  const anchor = position(view, 'parent');
  viewportSize = { width: 144, height: 312 };
  await view.render([...cards, card('deep', { parentId: 'child', relation: 'child' })], 'parent');
  assert.deepEqual(position(view, 'parent'), anchor, '数据使容器变高时不能强制把当前点抢回中间');
  viewportSize = { width: 144, height: 240 };
  await view.render(cards, 'parent');
  assert.deepEqual(position(view, 'parent'), anchor, '缩回原高度同样补偿 padding 差值');
});

test('删卡后无法保留越界锚点时使用真实画布边界夹取', async (t) => {
  const cards = [card('parent'), ...Array.from({ length: 5 }, (_, index) => card(`child-${index}`, { parentId: 'parent', relation: 'child' }))];
  const view = await mount(t, cards, 'parent');
  view.area.scrollLeft = 17;
  await act(async () => view.area.dispatchEvent(new window.Event('scroll')));
  await view.render(cards.slice(0, -1), 'parent');
  assert.equal(view.area.scrollLeft, 0, '画布缩窄时不能滚到负偏移以勉强保留原锚点');
  await act(async () => view.area.dispatchEvent(new window.WheelEvent('wheel', { deltaX: 10000, bubbles: true, cancelable: true })));
  assert.equal(view.area.scrollLeft, 114, '滚轮边界依据更新后的超宽画布，而不是初次挂载宽度');
});

test('滚轮支持双轴与 Shift 横向浏览，拖动画布超过阈值后不误切卡', async (t) => {
  const cards = [card('parent'), ...Array.from({ length: 10 }, (_, index) => card(`child-${index}`, { parentId: 'parent', relation: 'child' }))];
  const view = await mount(t, cards, 'parent');
  const initial = { left: view.area.scrollLeft, top: view.area.scrollTop };
  const wheel = new window.WheelEvent('wheel', { deltaY: 20, bubbles: true, cancelable: true });
  await act(async () => view.area.dispatchEvent(wheel));
  assert.equal(wheel.defaultPrevented, true, '非 passive 原生监听阻止浏览器重复滚动');
  assert.equal(view.area.scrollLeft, initial.left);
  assert.equal(view.area.scrollTop, initial.top + 20);
  await act(async () => view.area.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 25, shiftKey: true, bubbles: true, cancelable: true })));
  assert.equal(view.area.scrollLeft, initial.left + 25);
  const beforeDrag = { left: view.area.scrollLeft, top: view.area.scrollTop };
  await pointer(view.node('parent'), 'pointerdown');
  await pointer(view.area, 'pointermove', { clientX: 77, clientY: 99 });
  assert.equal(view.area.hasAttribute('data-btw-dragging'), false, '小于5px保留正常点击');
  await pointer(view.area, 'pointermove', { clientX: 50, clientY: 80 });
  assert.equal(view.area.hasAttribute('data-btw-dragging'), true);
  assert.equal(view.area.scrollLeft, beforeDrag.left + 30);
  assert.equal(view.area.scrollTop, beforeDrag.top + 20);
  await pointer(view.area, 'pointerup', { clientX: 50, clientY: 80 });
  assert.equal(view.area.hasAttribute('data-btw-dragging'), false);
  await act(async () => view.node('parent').dispatchEvent(new window.MouseEvent('click', { detail: 1, bubbles: true, cancelable: true })));
  assert.deepEqual(view.moves, [], '拖动末尾的浏览器 click 必须被拦截');
  await pointer(view.node('parent'), 'pointerdown');
  await pointer(view.node('parent'), 'pointerup');
  await act(async () => view.node('parent').dispatchEvent(new window.MouseEvent('click', { detail: 1, bubbles: true })));
  assert.deepEqual(view.moves, [['parent']], '新的轻点仍然正常切卡');
});

test('触屏拖动忽略第二根手指，取消和丢失捕获后都能恢复点击', async (t) => {
  const view = await mount(t, [card('parent'), ...Array.from({ length: 8 }, (_, index) => card(`child-${index}`, { parentId: 'parent', relation: 'child' }))], 'parent');
  await pointer(view.node('parent'), 'pointerdown', { pointerType: 'touch' });
  await pointer(view.area, 'pointermove', { pointerType: 'touch', clientX: 50 });
  assert.equal(view.area.hasAttribute('data-btw-dragging'), true);
  const left = view.area.scrollLeft;
  await pointer(view.area, 'pointerdown', { pointerType: 'touch', pointerId: 2, isPrimary: false });
  await pointer(view.area, 'pointermove', { pointerType: 'touch', pointerId: 2, clientX: 5 });
  assert.equal(view.area.scrollLeft, left, '额外触点不能改写当前拖动坐标');
  await pointer(view.area, 'pointerup', { pointerType: 'touch', pointerId: 2 });
  assert.equal(view.area.hasAttribute('data-btw-dragging'), true, '第二根手指抬起不能提前结束首根手指的拖动');
  await pointer(view.area, 'pointercancel', { pointerType: 'touch' });
  assert.equal(view.area.hasAttribute('data-btw-dragging'), false);
  await pointer(view.node('parent'), 'pointerdown');
  await pointer(view.area, 'pointermove', { clientX: 60 });
  await pointer(view.area, 'lostpointercapture');
  assert.equal(view.area.hasAttribute('data-btw-dragging'), false);
  await act(async () => view.node('parent').click());
  assert.deepEqual(view.moves, [['parent']], '取消拖动后键盘或程序化激活不应被吞掉');
});

test('从裁切的节点起拖时默认鼠标聚焦不会先移动视野', async (t) => {
  const view = await mount(t, [card('parent'), ...Array.from({ length: 30 }, (_, index) =>
    card(`child-${index}`, { parentId: 'parent', relation: 'child' }))], 'parent');
  view.area.scrollLeft = 550;
  view.area.scrollTop = 0;
  await act(async () => view.area.dispatchEvent(new window.Event('scroll')));
  assert.equal(position(view, 'child-13').x, 16, '节点只露出部分点击区');
  await pointer(view.node('child-13'), 'pointerdown');
  await act(async () => view.node('child-13').focus());
  assert.equal(view.area.scrollLeft, 550, '鼠标按下触发的默认聚焦不能改变拖动起点');
  await pointer(view.area, 'pointermove', { clientX: 70 });
  assert.equal(view.area.scrollLeft, 560, '实际只平移指针经过的10px');
  await pointer(view.area, 'pointerup', { clientX: 70 });
  assert.deepEqual(view.moves, []);
});
