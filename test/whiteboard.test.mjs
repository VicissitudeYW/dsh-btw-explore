import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const read = (file) => fs.readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8');
const { exploreWhiteboardLayout, ExploreWhiteboard } = Function('React', 'h', `
  ${read('view')}
  ${read('whiteboard')}
  return { exploreWhiteboardLayout, ExploreWhiteboard };
`)(React, React.createElement);

test('the whiteboard lays out complete subtrees left to right and keeps siblings apart', () => {
  const cards = [
    { id: 'one' }, { id: 'two' },
    { id: 'branch', parentId: 'one', relation: 'branch' }, { id: 'child', parentId: 'one', relation: 'child' },
    { id: 'deep', parentId: 'child' }, { id: 'other-child', parentId: 'two' },
  ];
  const layout = exploreWhiteboardLayout(cards);
  const node = (id) => layout.nodes.find((item) => item.card?.id === id);
  const one = node('one');
  const two = node('two');
  const branch = node('branch');
  const child = node('child');
  const other = node('other-child');
  assert.ok(one.x >= layout.home.x + layout.home.width);
  assert.equal(two.x, one.x);
  assert.ok(branch.x >= one.x + one.width);
  assert.equal(child.x, branch.x);
  assert.equal(branch.parent, one);
  assert.equal(node('deep').parent, child);
  assert.ok(node('deep').x >= child.x + child.width);
  assert.ok(child.y >= branch.y + branch.height);
  assert.ok(other.y >= child.y + child.height);
  assert.ok(layout.width >= node('deep').x + node('deep').width);
  assert.ok(layout.height >= other.y + other.height);
});

test('orphaned and cyclic sources leave all cards reachable in the whiteboard', () => {
  const layout = exploreWhiteboardLayout([
    { id: 'orphan', parentId: 'missing' }, { id: 'loop', parentId: 'loop' },
    { id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }, { id: 'leaf', parentId: 'b' },
  ]);
  assert.deepEqual(layout.nodes.map((node) => node.card.id).sort(), ['a', 'b', 'leaf', 'loop', 'orphan']);
  for (const node of layout.nodes) {
    assert.ok(node.parent.x < node.x, 'every source is on the left, including recovered cycles');
    let source = node;
    while (source.parent) source = source.parent;
    assert.equal(source, layout.home);
  }
});

test('whiteboard cards display the selected text and the model preview, and open the original card', async (t) => {
  const card = { id: 'quoted', title: '这里不显示用户的问题', source: { quote: '所选文字' }, nativeSessionId: 'native' };
  const unquoted = { id: 'old-card', title: '旧卡标题', parentId: 'quoted' };
  const root = createRoot(document.querySelector('#root'));
  t.after(() => act(async () => root.unmount()));
  const opened = [];
  let returned = false;
  await act(async () => root.render(React.createElement(ExploreWhiteboard, {
    cards: [card, unquoted], previews: { quoted: '模型回答的开头', 'old-card': '另一段模型回答' },
    onOpen: (...args) => opened.push(args), onReturnChat() { returned = true; },
  })));
  const node = document.querySelector('[data-btw-board-card="quoted"]');
  assert.equal(node.tagName, 'BUTTON');
  assert.equal(node.getAttribute('aria-haspopup'), 'dialog');
  assert.match(node.textContent, /所选文字/);
  assert.match(node.textContent, /模型回答的开头/);
  assert.doesNotMatch(node.textContent, /用户的问题/);
  assert.match(document.querySelector('[data-btw-board-card="old-card"]').textContent, /另一段模型回答/);
  assert.equal(document.querySelectorAll('.dsh-btw-board-links path').length, 2);
  await act(async () => node.click());
  assert.deepEqual(opened, [[card, node]]);
  await act(async () => document.querySelector('[data-btw-board-home]').click());
  assert.equal(returned, true);
});

test('mouse gestures pan an overflowing board from blank space without activating a card', async (t) => {
  const root = createRoot(document.querySelector('#root'));
  t.after(() => act(async () => root.unmount()));
  let opens = 0;
  await act(async () => root.render(React.createElement(ExploreWhiteboard, {
    cards: [{ id: 'first' }], onOpen() { opens++; },
  })));
  const view = document.querySelector('.dsh-btw-board-viewport');
  const card = document.querySelector('[data-btw-board-card="first"]');
  Object.defineProperties(view, { scrollWidth: { value: 560 }, clientWidth: { value: 280 } });
  view.setPointerCapture = () => {};
  function pointer(target, type, x, y, pointerType = 'mouse') {
    target.dispatchEvent(new window.PointerEvent(type, { bubbles: true, pointerId: 3, pointerType, clientX: x, clientY: y, button: 0 }));
  }
  pointer(card, 'pointerdown', 110, 120);
  pointer(view, 'pointermove', 60, 70);
  assert.equal(view.scrollLeft, 0, 'starting on a card leaves its button behavior intact');
  pointer(view, 'pointerdown', 130, 120, 'touch');
  pointer(view, 'pointermove', 60, 80, 'touch');
  assert.equal(view.scrollLeft, 0, 'touch keeps native scrolling');
  pointer(view, 'pointerdown', 130, 120);
  pointer(view, 'pointermove', 60, 80);
  assert.equal(view.scrollLeft, 70);
  assert.equal(view.scrollTop, 40);
  assert.equal(view.hasAttribute('data-btw-panning'), true);
  pointer(view, 'pointercancel', 60, 80);
  assert.equal(view.hasAttribute('data-btw-panning'), false);
  pointer(view, 'pointermove', 10, 20);
  assert.equal(view.scrollLeft, 70);
  assert.equal(opens, 0);
});
