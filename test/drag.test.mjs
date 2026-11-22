import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM(`<div class="dsh-btw-overlay"><div class="dsh-btw-map"></div>
  <div class="dsh-btw-page" data-btw-top><header><span data-btw-drag-handle></span><h1>Title</h1></header>
    <section><p data-chat-flow-kind="assistant">Text</p><div data-composer-card><div contenteditable="true"></div></div></section>
    <button>Return</button></div></div>`);
const document = window.document;
const overlay = document.querySelector('.dsh-btw-overlay');
const card = document.querySelector('.dsh-btw-page');
const handle = document.querySelector('[data-btw-drag-handle]');
const bounds = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });
const read = (axis) => parseFloat(overlay.style.getPropertyValue(`--btw-drag-${axis}`)) || 0;
const send = (target, type, x, y, pointerId = 1) => {
  const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  target.dispatchEvent(event);
};

test('card chrome and empty space move the foreground without intercepting the chat or controls', () => {
  const source = readFileSync(new URL('../src/drag.js', import.meta.url), 'utf8');
  const install = Function('window', `${source}\nreturn installExplorerDeckDrag;`)(window);
  let width = 1000;
  overlay.getBoundingClientRect = () => bounds(0, 0, width, 800);
  card.getBoundingClientRect = () => bounds(250 + read('x'), 50 + read('y'), 900 + read('x'), 750 + read('y'));
  overlay.querySelector('.dsh-btw-map').getBoundingClientRect = () => bounds(20, 160, 200, 640);
  overlay.setPointerCapture = () => {};
  const drag = install(overlay);

  for (const selector of ['p', 'button', '[data-composer-card]', '[contenteditable]']) {
    const control = card.querySelector(selector);
    send(control, 'pointerdown', 300, 100);
    send(overlay, 'pointermove', 360, 120);
    send(overlay, 'pointerup', 360, 120);
    assert.equal(read('x'), 0, `${selector} must remain interactive`);
  }
  send(card.querySelector('h1'), 'pointerdown', 300, 70);
  send(overlay, 'pointermove', 360, 90, 2);
  assert.equal(read('x'), 0, 'another pointer cannot move the deck');
  send(overlay, 'pointermove', 360, 90);
  assert.deepEqual([read('x'), read('y')], [60, 20]);
  send(overlay, 'pointermove', -100, 950);
  assert.deepEqual([read('x'), read('y')], [-42, 42]);
  send(overlay, 'lostpointercapture', -100, 950);
  send(overlay, 'pointermove', 500, 70);
  assert.equal(read('x'), -42, 'capture loss ends the gesture');
  send(card.querySelector('section'), 'pointerdown', 230, 100);
  send(overlay, 'pointermove', 450, 100);
  assert.equal(read('x'), 92);
  width = 940;
  drag.reconcile();
  assert.equal(read('x'), 32, 'resize moves the deck back inside the viewport');
  send(handle, 'pointerup', 450, 100);
  drag.dispose();
  assert.equal(read('x'), 0);
  assert.equal(overlay.hasAttribute('data-btw-dragging'), false);
});
