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
const { ExploreNavigation } = Function('React', 'h', `${read('view')}\n${read('navigation')}\nreturn { ExploreNavigation };`)(React, React.createElement);

test('圆点聚焦与悬停显示标题，方向键浏览节点后点击才切换卡片', async (t) => {
  const cards = [
    { id: 'parent', title: '天空为什么是蓝色的？', parentId: null, relation: 'root' },
    { id: 'child', title: '瑞利散射是什么？', parentId: 'parent', relation: 'child' },
  ];
  const moves = [];
  const root = createRoot(document.querySelector('#root'));
  t.after(async () => { await act(async () => root.unmount()); });
  const render = async (activeId) => act(async () => root.render(React.createElement(ExploreNavigation, {
    cards, activeId, returnLabel: '返回主聊天', onNavigate: (trail) => moves.push(trail.map((card) => card.id)),
  })));
  await render('parent');
  const nodes = [...document.querySelectorAll('.dsh-btw-map-node')];
  await act(async () => nodes[2].dispatchEvent(new window.MouseEvent('pointerover', { bubbles: true })));
  assert.match(document.querySelector('[role="tooltip"]').textContent, /瑞利散射是什么/);
  await act(async () => nodes[2].dispatchEvent(new window.MouseEvent('pointerout', { bubbles: true })));
  assert.equal(document.querySelector('[role="tooltip"]'), null, '指针离开后不应遗留标题浮层');
  await act(async () => nodes[1].focus());
  assert.match(document.querySelector('[role="tooltip"]').textContent, /天空为什么是蓝色/);
  await act(async () => nodes[1].dispatchEvent(new window.MouseEvent('pointerover', { bubbles: true })));
  await act(async () => nodes[1].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
  assert.equal(document.activeElement, nodes[2]);
  assert.match(document.querySelector('[role="tooltip"]').textContent, /瑞利散射是什么/, '键盘浏览应更新标题提示，即使鼠标仍停在上一个节点');
  assert.equal(moves.length, 0, '浏览节点时不会意外切换或发送问题');
  await act(async () => nodes[2].click());
  assert.deepEqual(moves, [['parent', 'child']]);
  await render('child');
  assert.equal(document.querySelector('[aria-current="page"]'), nodes[2]);
  assert.equal(nodes[1].hasAttribute('data-btw-on-path'), true, '当前卡片的祖先路径应可见');
  assert.equal(document.querySelectorAll('.dsh-btw-map-current').length, 1, '当前点使用唯一的移动标记');
});
