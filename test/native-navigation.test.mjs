import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://test.invalid/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const source = fs.readFileSync(new URL('../src/native.js', import.meta.url), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

async function fixture(t) {
  document.body.innerHTML = '<div class="dsh-btw-page" data-btw-top><div id="root"></div></div>';
  const calls = [], releases = [], notifications = [];
  const retainReady = new Map();
  let mutation = async () => ({ cardId: 'card', nativeSessionId: 'edited' });
  const sessions = {
    refresh: async () => {},
    retain(id) {
      calls.push(['retain', id]);
      return { id, ready: retainReady.get(id)?.promise ?? Promise.resolve({ session: { getSnapshot: () => ({ openState: 'open' }) } }),
        release() { releases.push(id); } };
    },
  };
  const Mount = Function('React', 'h', 'sessionsService', 'explorerRequest', 'exploreChangeListeners', 'exploreButton',
    source + '\nreturn ExploreNativeMount;')(React, React.createElement, sessions,
    async (owner, options) => { calls.push(['request', owner, options]); return mutation(); },
    new Map([['main', new Set([() => notifications.push('refresh')])]]),
    (label, props) => React.createElement('button', props, label));
  const Provider = ({ session, children }) => React.createElement('div', { 'data-session': session.id }, children);
  const root = createRoot(document.querySelector('#root'));
  const render = async (nativeSessionId = 'original') => act(async () => root.render(React.createElement(Mount, {
    ownerSessionId: 'main', cardId: 'card', nativeSessionId, SessionProvider: Provider,
    renderSlot: () => React.createElement('p', null, 'Native chat and composer'),
  })));
  await render();
  let mounted = true;
  const unmount = async () => { if (mounted) { mounted = false; await act(async () => root.unmount()); } };
  t.after(unmount);
  function navigate(sourceSessionId = 'original', targetSessionId = 'edited') {
    let handler, accepting = true;
    const detail = { version: 1, sourceSessionId, targetSessionId, claim(candidate) {
      if (!accepting || handler) return false;
      handler = candidate;
      return true;
    } };
    window.dispatchEvent(new window.CustomEvent('dsh-message-toolbar:open-version', { detail }));
    accepting = false;
    return handler;
  }
  return { calls, releases, notifications, retainReady, render, unmount, navigate,
    setMutation: (next) => { mutation = next; }, current: () => document.querySelector('[data-session]')?.dataset.session };
}

test('embedded version navigation saves the card then retains the target without replacing the page', async (t) => {
  const f = await fixture(t);
  const ready = deferred();
  f.retainReady.set('edited', ready);
  const handler = f.navigate();
  assert.equal(typeof handler, 'function');
  let settled = false, completion;
  await act(async () => { completion = handler().then(() => { settled = true; }); });
  assert.equal(settled, false, 'the toolbar must wait for native target readiness');
  assert.deepEqual(f.calls.find(([kind]) => kind === 'request').slice(1), ['main', {
    action: 'select-native-version', body: { cardId: 'card', fromSessionId: 'original', toSessionId: 'edited' },
  }]);
  await act(async () => ready.resolve({ session: { getSnapshot: () => ({ openState: 'open' }) } }));
  await completion;
  assert.equal(f.current(), 'edited');
  assert.ok(document.querySelector('.dsh-btw-page[data-btw-top]'));
  assert.ok(f.releases.includes('original'));
  assert.equal(f.notifications.length, 1);
  await f.render('edited');
  assert.equal(f.current(), 'edited');
});

test('a rejected binding keeps the original native chat and lets the toolbar report the error', async (t) => {
  const f = await fixture(t);
  f.setMutation(async () => { throw new Error('version conflict'); });
  const handler = f.navigate();
  assert.equal(typeof handler, 'function');
  await act(async () => assert.rejects(handler(), /version conflict/));
  assert.equal(f.current(), 'original');
  assert.equal(f.calls.some(([kind, id]) => kind === 'retain' && id === 'edited'), false);
});

test('covered, leaving and unrelated native cards never claim foreground version navigation', async (t) => {
  const f = await fixture(t);
  assert.equal(f.navigate('different-card'), undefined);
  const page = document.querySelector('.dsh-btw-page');
  page.removeAttribute('data-btw-top');
  page.setAttribute('inert', '');
  assert.equal(f.navigate(), undefined);
  page.setAttribute('data-btw-top', '');
  page.removeAttribute('inert');
  page.setAttribute('data-btw-leaving', '');
  assert.equal(f.navigate(), undefined);
});

test('closing a card during its binding request rejects the late navigation and still refreshes the saved tree', async (t) => {
  const f = await fixture(t);
  const pending = deferred();
  f.setMutation(() => pending.promise);
  const handler = f.navigate();
  assert.equal(typeof handler, 'function');
  let completion;
  await act(async () => { completion = handler(); });
  const rejected = assert.rejects(completion, /关闭|切换|打开/);
  await f.unmount();
  await act(async () => pending.resolve({ cardId: 'card', nativeSessionId: 'edited' }));
  await rejected;
  assert.equal(f.calls.some(([kind, id]) => kind === 'retain' && id === 'edited'), false);
  assert.equal(f.notifications.length, 1);
});

test('a target that becomes ready after its card is covered cannot mount a hidden native composer', async (t) => {
  const f = await fixture(t);
  const ready = deferred();
  f.retainReady.set('edited', ready);
  let completion;
  await act(async () => { completion = f.navigate()(); });
  const rejected = assert.rejects(completion, /关闭|切换|打开/);
  const page = document.querySelector('.dsh-btw-page');
  page.removeAttribute('data-btw-top');
  page.setAttribute('inert', '');
  await act(async () => ready.resolve({ session: { getSnapshot: () => ({ openState: 'open' }) } }));
  await rejected;
  assert.notEqual(f.current(), 'edited', 'the native composer would otherwise focus and archive versions from under another card');
});
