import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExplorer } from '../lib/service.js';
import { createStore } from '../lib/store.js';

async function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-explore-version-'));
  const database = join(directory, 'cards.sqlite');
  const sourceEvents = [
    { type: 'turn/start', seq: 0, data: { turn: 1 } },
    { type: 'user/message', seq: 1, data: { id: 'source-question', source: { kind: 'user' }, content: [{ type: 'text', text: 'the sky-source reference' }] } },
    { type: 'turn/end', seq: 2, data: { turn: 1, reason: { kind: 'completed' } } },
  ];
  const sourceBefore = structuredClone(sourceEvents);
  const sessions = new Map();
  const agents = new Map();
  const model = { current: () => ({ provider: 'fixture', model: 'local' }) };
  function session(id, parentSession, cwd = directory, { marker = true, events } = {}) {
    const ownEvents = events ?? (parentSession && marker ? [{ type: 'message-toolbar/version', seq: 0, data: {
      sessionId: id, schemaVersion: 2, effect: { operation: 'edit-answer' },
      inverse: { kind: 'restore-version', sessionId: parentSession },
    } }] : []);
    const value = { id, header: { id, cwd, ...(parentSession ? { parentSession } : {}) },
      snapshotEvents: () => id === 'main' ? sourceEvents : ownEvents };
    sessions.set(id, value);
    agents.set(id, { session: value, model });
    return value;
  }
  session('main');
  const ctx = {
    sessions: { get: (id) => sessions.get(id) },
    agents: { get: (id) => agents.get(id) },
    sessionQuery: { async observeSession(id) { const result = sessions.get(id); if (!result) throw new Error('missing'); return result; } },
    sessionController: { async create({ sessionId }) { session(sessionId); return { sessionId }; } },
  };
  const apps = [];
  const open = () => { const app = createExplorer(ctx, { database }); apps.push(app); return app; };
  t.after(() => { for (const app of apps) app.close(); rmSync(directory, { recursive: true, force: true }); });
  const app = open();
  const cardId = 'card-edited';
  const original = (await app.mutate('main', { action: 'open-native', cardId, relation: 'root' })).nativeSessionId;
  const bind = (fromSessionId, toSessionId, extra = {}) => app.mutate('main', { action: 'select-native-version', cardId, fromSessionId, toSessionId, ...extra });
  return { app, open, session, original, cardId, bind, database, directory, sourceEvents, sourceBefore,
    setStatus: (id, value) => { agents.get(id).status = value; } };
}

test('selecting an edited native version persists the same card and preserves its source context', async (t) => {
  const f = await fixture(t);
  f.session('session-edited', f.original);
  const result = await f.bind(f.original, 'session-edited');
  assert.equal(result.cardId, f.cardId);
  assert.equal(result.nativeSessionId, 'session-edited');
  assert.equal(f.app.read('main', f.cardId).card.nativeSessionId, 'session-edited');
  assert.match(f.app.nativeContext('session-edited'), /the sky-source reference/);
  assert.match(f.app.nativeContext(f.original), /the sky-source reference/, 'the previous version still owns the same source snapshot');
  assert.deepEqual(f.sourceEvents, f.sourceBefore);
  f.app.close();
  const reopened = f.open();
  assert.equal(reopened.read('main', f.cardId).card.nativeSessionId, 'session-edited');
  assert.match(reopened.nativeContext('session-edited'), /the sky-source reference/);
});

test('native version selection rejects unrelated sessions and a changed workspace', async (t) => {
  const f = await fixture(t);
  f.session('session-unrelated');
  f.session('session-other-workspace', f.original, join(f.directory, 'other'));
  await assert.rejects(f.bind(f.original, 'session-unrelated'), /版本|来源|分支/);
  await assert.rejects(f.bind(f.original, 'session-other-workspace'), /工作目录|工作区/);
  assert.equal(f.app.read('main', f.cardId).card.nativeSessionId, f.original);
  assert.equal(f.app.nativeContext('session-unrelated'), '');
  assert.equal(f.app.nativeContext('session-other-workspace'), '');
});

test('a delayed version selection cannot replace a newer choice and known versions remain selectable', async (t) => {
  const f = await fixture(t);
  f.session('session-edited', f.original);
  f.session('session-late', f.original);
  await f.bind(f.original, 'session-edited');
  await f.bind(f.original, 'session-edited'); // A lost acknowledgement may be retried.
  await assert.rejects(f.bind(f.original, 'session-late'), (error) => error.status === 409);
  assert.equal(f.app.read('main', f.cardId).card.nativeSessionId, 'session-edited');
  await f.bind('session-edited', f.original);
  assert.equal(f.app.read('main', f.cardId).card.nativeSessionId, f.original);
  assert.match(f.app.nativeContext('session-edited'), /the sky-source reference/);
});

test('a raw native fork and inherited version marker cannot claim a card source', async (t) => {
  const f = await fixture(t);
  f.session('raw-fork', f.original, f.directory, { marker: false });
  f.session('copied-marker', f.original, f.directory, { events: [{ type: 'message-toolbar/version', seq: 0, data: {
    sessionId: 'someone-else', schemaVersion: 2, inverse: { kind: 'restore-version', sessionId: f.original },
  } }] });
  await assert.rejects(f.bind(f.original, 'raw-fork'), /版本|来源|分支/);
  await assert.rejects(f.bind(f.original, 'copied-marker'), /版本|来源|分支/);
  assert.equal(f.app.nativeContext('raw-fork'), '');
});

test('a chain of edited versions keeps its source and removal clears every version alias', async (t) => {
  const f = await fixture(t);
  f.session('edit-one', f.original);
  f.session('edit-two', 'edit-one');
  await f.bind(f.original, 'edit-two');
  assert.match(f.app.nativeContext('edit-one'), /the sky-source reference/);
  assert.match(f.app.nativeContext('edit-two'), /the sky-source reference/);
  await f.app.mutate('main', { action: 'remove', cardId: f.cardId });
  assert.equal(f.app.nativeContext(f.original), '');
  assert.equal(f.app.nativeContext('edit-two'), '');
});

test('removal still protects a running original version after switching the selected version', async (t) => {
  const f = await fixture(t);
  f.session('edit-one', f.original);
  await f.bind(f.original, 'edit-one');
  // The original agent may still be stopping when the foreground version changes.
  f.app.close();
  const app = f.open();
  // fixture agents and sessions are shared by both explorer instances.
  f.setStatus(f.original, 'running');
  await assert.rejects(app.mutate('main', { action: 'remove', cardId: f.cardId }), /先停止/);
  assert.equal(app.read('main', f.cardId).card.nativeSessionId, 'edit-one');
});

test('a native regeneration inherits its source before client navigation returns', async (t) => {
  const f = await fixture(t);
  f.session('retry-running', f.original);
  await f.app.adoptNativeVersionForStep('retry-running');
  assert.match(f.app.nativeContext('retry-running'), /the sky-source reference/);
  assert.equal(f.app.read('main', f.cardId).card.nativeSessionId, f.original, 'preparing context does not navigate the reader');
  await f.bind(f.original, 'retry-running');
  assert.equal(f.app.read('main', f.cardId).card.nativeSessionId, 'retry-running');
});

test('a delayed pre-step adoption cannot attach an old version to a rebuilt card', async (t) => {
  const f = await fixture(t);
  const edited = f.session('edit-old-incarnation', f.original);
  const replacementId = 'session-btw-explore-replacement';
  const replacement = createStore(f.database);
  let scheduled = false;
  let rebuilt = false;
  let rebuildError;
  Object.defineProperty(edited.header, 'cwd', { get() {
    if (!scheduled) {
      scheduled = true;
      // Model a second host committing removal and recreation after the last
      // awaited version validation, before this pre-step's adoption transaction.
      queueMicrotask(() => {
        try {
          replacement.transaction(() => {
            replacement.remove('main', f.cardId);
            replacement.insert('main', { id: f.cardId, nativeSessionId: replacementId, parentId: null, relation: 'root',
              saved: true, title: 'replacement', source: { kind: 'main' }, anchorTurnId: null, createdAt: Date.now(),
              seed: { mode: 'main', messages: [{ role: 'user', text: 'replacement-card-private-context' }], truncated: false } });
            const now = Date.now();
            const job = { sessionId: 'main', cardId: f.cardId, nativeSessionId: replacementId, token: 'replacement-preparation' };
            assert.equal(replacement.claimNative(job, now, now + 20_000), true);
            assert.equal(replacement.markNativeReady(job, now), true);
          });
          rebuilt = true;
        } catch (error) { rebuildError = error; }
      });
    }
    return f.directory;
  } });
  try {
    await f.app.adoptNativeVersionForStep('edit-old-incarnation');
    assert.ifError(rebuildError);
    assert.equal(rebuilt, true);
    assert.equal(f.app.read('main', f.cardId).card.nativeSessionId, replacementId);
    assert.match(f.app.nativeContext(replacementId), /replacement-card-private-context/);
    assert.equal(f.app.nativeContext('edit-old-incarnation'), '', 'an old model step must never inherit the replacement card seed');
    assert.equal(f.app.nativeContext(f.original), '');
  } finally { replacement.close(); }
});

test('an ordinary toolbar conversation with an unavailable ancestor does not block a model step', async (t) => {
  const f = await fixture(t);
  f.session('ordinary-toolbar-edit', 'unavailable-ordinary-parent');
  await f.app.adoptNativeVersionForStep('ordinary-toolbar-edit');
  assert.equal(f.app.nativeContext('ordinary-toolbar-edit'), '');
  assert.equal(f.app.read('main', f.cardId).card.nativeSessionId, f.original);
});

test('pre-step source validation remains strict after reaching a known card version', async (t) => {
  const f = await fixture(t);
  f.session('edited-in-another-workspace', f.original, join(f.directory, 'other'));
  await assert.rejects(f.app.adoptNativeVersionForStep('edited-in-another-workspace'), /工作目录|工作区/);
  assert.equal(f.app.nativeContext('edited-in-another-workspace'), '');
});
