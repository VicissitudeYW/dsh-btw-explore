import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const { window } = new JSDOM(`<div class="dsh-btw-overlay"><div class="dsh-btw-map"></div>
  <div class="dsh-btw-page" data-btw-top><span data-btw-drag-handle></span><p>Text</p></div></div>`);
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

test('only the foreground handle can move a card within the viewport and left rail', () => {
  const source = readFileSync(new URL('../src/drag.js', import.meta.url), 'utf8');
  const install = Function('window', `${source}\nreturn installExplorerDeckDrag;`)(window);
  let width = 1000;
  overlay.getBoundingClientRect = () => bounds(0, 0, width, 800);
  card.getBoundingClientRect = () => bounds(250 + read('x'), 50 + read('y'), 900 + read('x'), 750 + read('y'));
  overlay.querySelector('.dsh-btw-map').getBoundingClientRect = () => bounds(20, 160, 200, 640);
  overlay.setPointerCapture = () => {};
  const drag = install(overlay);

  send(card.querySelector('p'), 'pointerdown', 300, 100);
  send(overlay, 'pointermove', 360, 120);
  assert.equal(read('x'), 0, 'text selection must not move the deck');
  send(handle, 'pointerdown', 300, 70);
  send(overlay, 'pointermove', 360, 90, 2);
  assert.equal(read('x'), 0, 'another pointer cannot move the deck');
  send(overlay, 'pointermove', 360, 90);
  assert.deepEqual([read('x'), read('y')], [60, 20]);
  send(overlay, 'pointermove', -100, 950);
  assert.deepEqual([read('x'), read('y')], [-42, 42]);
  send(overlay, 'lostpointercapture', -100, 950);
  send(overlay, 'pointermove', 500, 70);
  assert.equal(read('x'), -42, 'capture loss ends the gesture');
  send(handle, 'pointerdown', 230, 100);
  send(overlay, 'pointermove', 450, 100);
  assert.equal(read('x'), 92);
  width = 940;
  drag.reconcile();
  assert.equal(read('x'), 32, 'resize moves the deck back inside the viewport');
  drag.dispose();
  assert.equal(read('x'), 0);
  assert.equal(overlay.hasAttribute('data-btw-dragging'), false);
});
