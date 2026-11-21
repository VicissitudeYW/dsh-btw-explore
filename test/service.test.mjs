import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createExplorer } from '../lib/service.js';

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
