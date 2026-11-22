import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createExplorer } from '../lib/service.js';
import { createStore } from '../lib/store.js';

async function waitFor(callback) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const value = callback();
    if (value) return value;
    await delay(10);
  }
  throw new Error('Timed out waiting for a card turn');
}

function harness(t, stream) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-explore-test-'));
  const database = join(directory, 'test.sqlite');
  const events = [{ type: 'turn/start', seq: 0, data: { turn: 1 } },
    { type: 'user/message', seq: 1, data: { id: 'u1', source: { kind: 'user' }, content: [{ type: 'text', text: 'main' }] } },
    { type: 'turn/end', seq: 2, data: { turn: 1, reason: { kind: 'completed' } } }];
  const inputs = [];
  const ctx = {
    sessions: { get: (id) => ['session-a', 'session-b'].includes(id) ? { snapshotEvents: () => events } : undefined },
    sessionQuery: { async observeSession() { throw new Error('missing'); } },
    agents: { get: () => ({ model: { current: () => ({ provider: 'fixture', model: 'sample' }) } }) },
    llm: { stream: (options) => {
      inputs.push(options);
      return stream(options);
    } },
  };
  const apps = [];
  const open = (options) => {
    const app = createExplorer(ctx, { database, ...options });
    apps.push(app);
    return app;
  };
  t.after(() => {
    for (const app of apps) app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { app: open(), open, events, inputs };
}

const request = (app, action, body, sessionId = 'session-a') => app.mutate(sessionId, { action, ...body });
const detail = (app, id) => app.read('session-a', id).card;
const done = (app, cardId) => waitFor(() => detail(app, cardId)?.status === 'done' && detail(app, cardId));
const newCard = (fields = {}) => ({ cardId: randomUUID(), turnId: randomUUID(), question: 'first Q', relation: 'root', ...fields });

test('preview, saved tree, bounded branches and transcript survive reopening', async (t) => {
  const { app, open, inputs, events } = harness(t, async function* (options) {
    yield { type: 'text-delta', text: `answer to ${options.messages.at(-1).content[0].text}` };
    yield { type: 'finish', reason: { kind: 'stop' } };
  });
  const parent = newCard({ preview: true });
  await request(app, 'create', parent);
  assert.equal((await done(app, parent.cardId)).saved, false);
  await request(app, 'create', parent);
  await request(app, 'save', parent);
  assert.equal(detail(app, parent.cardId).saved, true);

  const next = { cardId: parent.cardId, turnId: randomUUID(), question: 'later Q' };
  await request(app, 'ask', next);
  await done(app, parent.cardId);
  const branch = newCard({ relation: 'branch', parentId: parent.cardId, anchorTurnId: parent.turnId, question: 'branch Q' });
  await request(app, 'create', branch);
  await done(app, branch.cardId);
  assert.deepEqual(inputs[2].messages.map(({ content }) => content[0].text), ['main', 'first Q', 'answer to first Q', 'branch Q']);
  assert.equal(inputs[2].tools, undefined);
  assert.deepEqual(inputs[2].messages[2].source, { kind: 'model', provider: 'fixture', model: 'sample' });
  assert.equal(inputs[2].messages[2].id.length > 0, true);
  assert.deepEqual(inputs[2].messages[0].source, { kind: 'user' });
  assert.equal(events.length, 3);
  assert.deepEqual(app.read('session-b', branch.cardId), { cards: [], card: null });
  await assert.rejects(request(app, 'remove', branch, 'session-b'), /不存在/);

  app.close();
  const reopened = open();
  assert.equal(detail(reopened, parent.cardId).turns.length, 2);
  assert.equal(detail(reopened, branch.cardId).parentId, parent.cardId);
  await request(reopened, 'remove', parent);
  assert.deepEqual(reopened.read('session-a', branch.cardId), { cards: [], card: null });
});

test('a stale source message cannot silently become a quote-only card', async (t) => {
  const { app } = harness(t, async function* () { yield { type: 'finish', reason: { kind: 'stop' } }; });
  const card = newCard({ source: { kind: 'main', messageId: 'deleted', role: 'assistant' }, quote: 'reference' });
  await assert.rejects(request(app, 'create', card), /来源已无法定位/);
  assert.equal(app.read('session-a').cards.length, 0);
});

test('aborted and incomplete streams cannot settle as completed and the last turn can retry', async (t) => {
  let calls = 0;
  const { app, open } = harness(t, async function* ({ signal }) {
    const count = ++calls;
    yield { type: 'text-delta', text: 'partial' };
    if (count === 1) await delay(20000, null, { signal });
    if (count === 2) return;
    yield { type: 'finish', reason: { kind: 'stop' } };
  });
  const card = newCard();
  await request(app, 'create', card);
  await waitFor(() => detail(app, card.cardId).turns[0].answer === 'partial');
  const otherWindow = open();
  await request(otherWindow, 'stop', card);
  assert.equal(detail(app, card.cardId).status, 'cancelled');
  await request(otherWindow, 'retry', card);
  await waitFor(() => detail(app, card.cardId).status === 'failed');
  await request(otherWindow, 'retry', card);
  assert.equal((await done(app, card.cardId)).turnCount, 1);
});

test('opening another host retains a live writer and restarting after interruption can continue', async (t) => {
  const { app, open } = harness(t, async function* ({ signal }) {
    yield { type: 'text-delta', text: 'checkpoint' };
    await delay(20000, null, { signal });
  });
  const card = newCard();
  await request(app, 'create', card);
  await waitFor(() => detail(app, card.cardId).turns[0].answer === 'checkpoint');
  const otherHost = open();
  assert.equal(detail(otherHost, card.cardId).status, 'running');
  await assert.rejects(request(otherHost, 'ask', { ...card, turnId: randomUUID() }), /进行中/);
  app.close();
  assert.equal(detail(otherHost, card.cardId).status, 'interrupted');
  assert.equal(detail(otherHost, card.cardId).turns[0].answer, 'checkpoint');
});

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

function nativeHarness(t, { beforeCreate = async () => {}, resolveAgent, prompt, clock } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-explore-native-'));
  const database = join(directory, 'test.sqlite');
  const events = [{ type: 'turn/start', seq: 0, data: { turn: 1 } },
    { type: 'user/message', seq: 1, data: { id: 'u1', source: { kind: 'user' }, content: [{ type: 'text', text: 'source question' }] } },
    { type: 'turn/end', seq: 2, data: { turn: 1, reason: { kind: 'completed' } } }];
  const sessions = new Map([['session-a', { header: { cwd: directory }, snapshotEvents: () => events }]]);
  const model = { current: () => ({ provider: 'fixture', model: 'sample' }), select: () => {} };
  const agents = new Map([['session-a', { model }]]);
  const creates = [];
  const apps = [];
  const ctx = {
    sessions, agents,
    sessionQuery: { async observeSession() { throw new Error('missing'); } },
    sessionController: { prompt, ...(resolveAgent ? { resolveAgent: (id) => resolveAgent(id, { sessions, agents }) } : {}), async create(options) {
      creates.push(options);
      await beforeCreate(options, creates.length);
      if (!agents.has(options.sessionId)) {
        const session = { snapshotEvents: () => [] };
        sessions.set(options.sessionId, session);
        agents.set(options.sessionId, { session, model, status: 'idle' });
      }
      return { sessionId: options.sessionId };
    } },
    llm: { async* stream() { assert.fail('Opening a native card must not call the model'); } },
  };
  const open = () => {
    const app = createExplorer(ctx, { database, ...(clock ? { clock } : {}) });
    apps.push(app);
    return app;
  };
  t.after(() => {
    for (const app of apps) app.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { app: open(), open, database, sessions, agents, creates };
}

test('explaining an empty quote card submits one native first turn, even across concurrent opens', async (t) => {
  const entered = deferred();
  const finish = deferred();
  const submissions = [];
  const { app, sessions, creates } = nativeHarness(t, { async prompt(input) {
    submissions.push(input);
    entered.resolve();
    await finish.promise;
    sessions.get(input.sessionId).snapshotEvents = () => [{ type: 'turn/start' }];
    return { accepted: true };
  } });
  const quote = { relation: 'root', source: { turn: 1, role: 'user' }, quote: 'source question' };
  const card = await request(app, 'open-native', { ...quote, cardId: 'manual-quote' });
  assert.equal(submissions.length, 0);
  const result = request(app, 'explain-native', { ...quote, cardId: 'explain-quote' });
  // Surface a missing action without waiting indefinitely for the prompt fixture.
  await Promise.race([result, entered.promise]);
  const concurrent = request(app, 'explain-native', { ...quote, cardId: 'explain-quote-again' });
  await new Promise(setImmediate);
  finish.resolve();
  assert.deepEqual(await Promise.all([result, concurrent]), [card, card]);
  assert.deepEqual(await request(app, 'explain-native', { ...quote, cardId: 'reopen-explained' }), card);
  assert.equal(creates.length, 1);
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].sessionId, card.nativeSessionId);
  assert.equal(submissions[0].mode, 'queue');
  assert.match(submissions[0].content[0].text, /解释.*选中的内容/);
  assert.match(app.nativeContext(card.nativeSessionId), /source question/);
});

test('explain opens a quote card with an existing user turn without adding a prompt', async (t) => {
  const { app, sessions } = nativeHarness(t, { prompt() { assert.fail('must not send to a nonempty conversation'); } });
  const quote = { relation: 'root', source: { turn: 1, role: 'user' }, quote: 'source question' };
  const card = await request(app, 'open-native', { ...quote, cardId: 'answered-quote' });
  sessions.get(card.nativeSessionId).snapshotEvents = () => [{ type: 'user/message', data: { source: { kind: 'user' } } }];
  assert.deepEqual(await request(app, 'explain-native', { ...quote, cardId: 'reopen-answered' }), card);
});

test('failed explanation admission can retry the same native card and prompt identity', async (t) => {
  const submissions = [];
  const { app, creates } = nativeHarness(t, { async prompt(input) {
    submissions.push(input);
    if (submissions.length === 1) throw new Error('fixture rejection');
    return { accepted: true };
  } });
  const quote = { cardId: 'retry-explanation', source: { turn: 1, role: 'user' }, quote: 'source question' };
  await assert.rejects(request(app, 'explain-native', quote), (error) => error.status === 503);
  const card = await request(app, 'explain-native', quote);
  assert.equal(creates.length, 1);
  assert.equal(submissions.length, 2);
  assert.deepEqual(submissions[0], submissions[1]);
  assert.equal(submissions[1].sessionId, card.nativeSessionId);
});

test('native preparation blocks removal from another explorer until a durable open is acknowledged', async (t) => {
  const entered = deferred();
  const finish = deferred();
  const { app, open, sessions } = nativeHarness(t, { beforeCreate: async () => { entered.resolve(); await finish.promise; } });
  const other = open();
  const body = { cardId: 'preparing', relation: 'root' };
  const opening = request(app, 'open-native', body);
  try {
    await entered.promise;
    assert.equal(detail(other, body.cardId).nativeReady, false);
    await assert.rejects(request(other, 'remove', body), (error) => error.status === 409 && /准备/.test(error.message));
    finish.resolve();
    const ack = await opening;
    assert.equal(detail(other, body.cardId).nativeSessionId, ack.nativeSessionId);
    assert.equal(detail(other, body.cardId).nativeReady, true);
    await request(other, 'remove', body);
    assert.equal(detail(other, body.cardId), null);
    assert.equal(sessions.has(ack.nativeSessionId), true, 'Removing a card must retain its DSH conversation');
  } finally {
    finish.resolve();
    await opening.catch(() => {});
  }
});

test('reopening a ready native card rechecks removal before its deferred operation starts', async (t) => {
  const { app, open } = nativeHarness(t);
  const other = open();
  const body = { cardId: 'removed-before-open', relation: 'root' };
  await request(app, 'open-native', body);
  const reopening = request(app, 'open-native', { cardId: body.cardId });
  await request(other, 'remove', body);
  await assert.rejects(reopening, (error) => error.status === 404);
});

test('closing an explorer before a deferred native reopen cannot return success', async (t) => {
  const { app } = nativeHarness(t);
  const body = { cardId: 'closed-before-open', relation: 'root' };
  await request(app, 'open-native', body);
  const reopening = request(app, 'open-native', { cardId: body.cardId });
  app.close();
  await assert.rejects(reopening, /已卸载/);
});

test('concurrent explorers retry one new native card without a unique error or duplicate session creation', async (t) => {
  const entered = deferred();
  const finish = deferred();
  const { app, open, creates } = nativeHarness(t, { beforeCreate: async () => { entered.resolve(); await finish.promise; } });
  const other = open();
  const body = { cardId: 'same-new-card', relation: 'root', quote: 'fixed selection' };
  const opening = request(app, 'open-native', body);
  const second = request(other, 'open-native', body);
  try {
    await entered.promise;
    await assert.rejects(second, (error) => error.status === 409 && /准备.*重试/.test(error.message));
    assert.equal(creates.length, 1);
    finish.resolve();
    const ack = await opening;
    assert.deepEqual(await request(other, 'open-native', body), ack);
    assert.equal(creates.length, 1);
    assert.equal(app.read('session-a').cards.length, 1);
    assert.match(app.nativeContext(ack.nativeSessionId), /fixed selection/);
  } finally {
    finish.resolve();
    await Promise.allSettled([opening, second]);
  }
});

test('reselecting the same anchored quote reopens its card across requests and plugin instances', async (t) => {
  const { app, open, creates } = nativeHarness(t);
  const selection = { relation: 'root', source: { turn: 1, role: 'user' }, quote: 'source' };
  const [first, concurrent] = await Promise.all([
    request(app, 'open-native', { ...selection, cardId: 'first-quote' }),
    request(app, 'open-native', { ...selection, cardId: 'concurrent-quote' }),
  ]);
  assert.deepEqual(concurrent, first);

  const other = open();
  assert.deepEqual(await request(other, 'open-native', { ...selection, quote: ' source ', cardId: 'after-reopen' }), first);
  assert.equal(creates.length, 1);
  assert.deepEqual(other.read('session-a').cards.map((item) => item.id), [first.cardId]);

  const distinct = await request(other, 'open-native', { ...selection, source: { messageId: 'u1', role: 'user' }, cardId: 'different-anchor' });
  assert.notEqual(distinct.cardId, first.cardId);
  await request(other, 'remove', { cardId: first.cardId });
  const replacement = await request(other, 'open-native', { ...selection, cardId: 'new-after-removal' });
  assert.notEqual(replacement.nativeSessionId, first.nativeSessionId);
});

test('native card retries cannot silently replace a concurrent request with a different source', async (t) => {
  const entered = deferred();
  const finish = deferred();
  const { app, open } = nativeHarness(t, { beforeCreate: async () => { entered.resolve(); await finish.promise; } });
  const other = open();
  const body = { cardId: 'source-conflict', relation: 'root', quote: 'first selection', source: { turn: 1, role: 'user' } };
  const opening = request(app, 'open-native', body);
  const second = request(other, 'open-native', { ...body, quote: 'different selection' });
  try {
    await entered.promise;
    await assert.rejects(second, (error) => error.status === 409 && /来源.*冲突/.test(error.message));
    finish.resolve();
    const ack = await opening;
    await assert.rejects(request(other, 'open-native', { ...body, source: { turn: 1, role: 'assistant' } }),
      (error) => error.status === 409 && /来源.*冲突/.test(error.message));
    assert.deepEqual(await request(other, 'open-native', { cardId: body.cardId }), ack);
    assert.equal(detail(other, body.cardId).source.quote, 'first selection');
  } finally {
    finish.resolve();
    await Promise.allSettled([opening, second]);
  }
});

test('same-instance native deduplication rejects conflicting in-flight source requests', async (t) => {
  const finish = deferred();
  const { app, creates } = nativeHarness(t, { beforeCreate: () => finish.promise });
  const body = { cardId: 'local-source-conflict', relation: 'root', quote: 'original selection' };
  const opening = request(app, 'open-native', body);
  const conflict = request(app, 'open-native', { ...body, quote: 'other selection' });
  const conflictCheck = assert.rejects(conflict, (error) => error.status === 409 && /来源.*冲突/.test(error.message));
  finish.resolve();
  await Promise.all([opening, conflictCheck]);
  assert.equal(creates.length, 1);
});

test('expired native preparation can be taken over and its old token cannot acknowledge or ready the card', async (t) => {
  let now = 1;
  const entered = [deferred(), deferred()];
  const finish = [deferred(), deferred()];
  const { app, open, creates } = nativeHarness(t, { clock: () => now, beforeCreate: async (_options, count) => {
    entered[count - 1].resolve();
    await finish[count - 1].promise;
  } });
  const other = open();
  const body = { cardId: 'expired-preparation', relation: 'root' };
  const first = request(app, 'open-native', body);
  let second;
  try {
    await entered[0].promise;
    now = 30_000;
    second = request(other, 'open-native', body);
    await entered[1].promise;
    finish[0].resolve();
    await assert.rejects(first, (error) => error.status === 409 && /准备.*重试/.test(error.message));
    assert.equal(detail(other, body.cardId).nativeReady, false);
    await assert.rejects(request(app, 'remove', body), (error) => error.status === 409 && /准备/.test(error.message));
    finish[1].resolve();
    const ack = await second;
    assert.equal(detail(other, body.cardId).nativeReady, true);
    assert.equal(creates[0].sessionId, creates[1].sessionId, 'Takeover must keep the durable session identity');
    assert.deepEqual(await request(app, 'open-native', { cardId: body.cardId }), ack);
  } finally {
    finish.forEach((gate) => gate.resolve());
    await Promise.allSettled([first, second]);
  }
});

test('an expired preparation that finishes after removal returns missing and retains its native conversation', async (t) => {
  let now = 1;
  const entered = deferred();
  const finish = deferred();
  const { app, open, sessions, creates } = nativeHarness(t, {
    clock: () => now, beforeCreate: async () => { entered.resolve(); await finish.promise; },
  });
  const other = open();
  const body = { cardId: 'removed-expired-preparation', relation: 'root' };
  const opening = request(app, 'open-native', body);
  try {
    await entered.promise;
    now = 30_000;
    await request(other, 'remove', body);
    finish.resolve();
    await assert.rejects(opening, (error) => error.status === 404);
    assert.equal(detail(other, body.cardId), null);
    assert.equal(sessions.has(creates[0].sessionId), true);
  } finally {
    finish.resolve();
    await opening.catch(() => {});
  }
});

test('a live native preparation renews its lease while session creation is delayed', async (t) => {
  let now = 1;
  const entered = deferred();
  const finish = deferred();
  const { app, open } = nativeHarness(t, {
    clock: () => now, beforeCreate: async () => { entered.resolve(); await finish.promise; },
  });
  const other = open();
  const body = { cardId: 'renewed-preparation', relation: 'root' };
  const opening = request(app, 'open-native', body);
  try {
    await entered.promise;
    now = 10_000;
    await delay(850);
    now = 25_000;
    await assert.rejects(request(other, 'remove', body), (error) => error.status === 409 && /准备/.test(error.message));
    finish.resolve();
    await opening;
    assert.equal(detail(other, body.cardId).nativeReady, true);
  } finally {
    finish.resolve();
    await opening.catch(() => {});
  }
});

test('failed native preparation releases its claim for retry or removal without deleting conversations', async (t) => {
  let shouldFail = true;
  const { app, open, sessions, creates } = nativeHarness(t, { beforeCreate: async () => {
    if (shouldFail) throw new Error('fixture create failed');
  } });
  const other = open();
  const retry = { cardId: 'failed-retry', relation: 'root' };
  const remove = { cardId: 'failed-remove', relation: 'root' };
  await assert.rejects(request(app, 'open-native', retry), /fixture create failed/);
  assert.equal(detail(app, retry.cardId).nativeReady, false);
  await assert.rejects(request(app, 'open-native', remove), /fixture create failed/);
  await request(other, 'remove', remove);
  assert.equal(detail(other, remove.cardId), null);
  shouldFail = false;
  const ack = await request(other, 'open-native', { cardId: retry.cardId });
  assert.equal(ack.nativeSessionId, creates[0].sessionId);
  assert.equal(detail(app, retry.cardId).nativeReady, true);
  await request(app, 'remove', retry);
  assert.equal(sessions.has(ack.nativeSessionId), true);
});

test('native recovery resumes a persisted reserved session instead of invoking the controller mint fallback', async (t) => {
  const nativeSessionId = 'session-btw-explore-persisted';
  const { app, database, creates } = nativeHarness(t, { resolveAgent: async (id, { sessions, agents }) => {
    assert.equal(id, nativeSessionId);
    const session = { id, snapshotEvents: () => [{ type: 'turn/start', seq: 0, data: { turn: 1 } }] };
    const agent = { id, session, model: { current: () => ({ provider: 'fixture', model: 'sample' }), select() {} } };
    sessions.set(id, session);
    agents.set(id, agent);
    return { agent };
  } });
  const store = createStore(database);
  try {
    store.insert('session-a', { id: 'recover-persisted', nativeSessionId, parentId: null, relation: 'root', saved: true,
      title: 'preserve', source: { kind: 'main' }, anchorTurnId: null,
      seed: { mode: 'main', messages: [{ role: 'user', text: 'frozen source' }], truncated: false }, createdAt: 1 });
  } finally { store.close(); }
  assert.deepEqual(await request(app, 'open-native', { cardId: 'recover-persisted' }), { cardId: 'recover-persisted', nativeSessionId });
  assert.equal(creates.length, 0, 'Creating an existing nonblank session would mint an unnecessary conversation in DSH');
  assert.equal(detail(app, 'recover-persisted').nativeReady, true);
  assert.match(app.nativeContext(nativeSessionId), /frozen source/);
});

test('a writer-held reserved native session is retryable without creating an unrelated conversation', async (t) => {
  let held = true;
  const { app, open, creates } = nativeHarness(t, { resolveAgent: async () => ({ error: {
    code: held ? 'session/writer-held' : 'session/not-found', message: 'fixture resolver status',
  } }) });
  const other = open();
  const body = { cardId: 'writer-held-native', relation: 'root' };
  await assert.rejects(request(app, 'open-native', body), (error) => error.status === 409 && /重试/.test(error.message));
  assert.equal(creates.length, 0);
  assert.equal(detail(other, body.cardId).nativeReady, false);
  held = false;
  await request(other, 'open-native', { cardId: body.cardId });
  assert.equal(creates.length, 1, 'Only an explicit not-found result may proceed to creation');
  assert.equal(detail(other, body.cardId).nativeReady, true);
});

test('unexpected native resolver errors and mismatched resumed identities never mark the card ready', async (t) => {
  let mismatch = false;
  const { app, open, creates } = nativeHarness(t, { resolveAgent: async () => mismatch
    ? { agent: { id: 'other-session', session: { id: 'other-session' } } }
    : { error: { code: 'gateway/internal', message: 'fixture resolver failed' } } });
  const other = open();
  const body = { cardId: 'invalid-native-resolution', relation: 'root' };
  await assert.rejects(request(app, 'open-native', body), (error) => error.status === 503);
  mismatch = true;
  await assert.rejects(request(other, 'open-native', { cardId: body.cardId }), (error) => error.status === 409);
  assert.equal(creates.length, 0);
  assert.equal(detail(other, body.cardId).nativeReady, false);
  await request(other, 'remove', body);
  assert.equal(detail(other, body.cardId), null);
});

test('concurrent native opens at capacity only create a session for the card that fits', async (t) => {
  const { app, open, database, creates } = nativeHarness(t);
  const store = createStore(database);
  try {
    store.transaction(() => {
      for (let index = 0; index < 499; index++) {
        store.insert('session-a', { id: `existing-${index}`, parentId: null, relation: 'root', saved: true, title: 'existing',
          source: { kind: 'main' }, anchorTurnId: null, seed: { mode: 'main', messages: [], truncated: false }, createdAt: index });
      }
    });
  } finally { store.close(); }
  const other = open();
  const body = { cardId: 'last-slot', relation: 'root' };
  const outcomes = await Promise.allSettled([
    request(app, 'open-native', body),
    request(other, 'open-native', { cardId: 'over-capacity', relation: 'root' }),
  ]);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.match(outcomes.find(({ status }) => status === 'rejected').reason.message, /500/);
  assert.equal(app.read('session-a').cards.length, 500);
  assert.equal(creates.length, 1);
  assert.equal(detail(app, 'over-capacity'), null);
  assert.deepEqual(await request(other, 'open-native', body), outcomes[0].value, 'An existing card still reopens at capacity');
});
