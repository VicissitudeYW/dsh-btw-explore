import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mainContext, cardContext, generationContext } from '../lib/context.js';

const user = (seq, id, text) => ({ seq, type: 'user/message', data: { id, role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] } });
const assistant = (seq, turn, id, text) => ({ seq, type: 'assistant/message', data: { turn, message: { id, content: [{ type: 'text', text }, { type: 'reasoning', text: 'secret reasoning' }] } } });
const start = (seq, turn) => ({ seq, type: 'turn/start', data: { turn } });
const end = (seq, turn) => ({ seq, type: 'turn/end', data: { turn, reason: { kind: 'completed' } } });
const events = [start(0, 1), user(1, 'u1', 'first question'), assistant(2, 1, 'a1', 'first answer'), end(3, 1),
  start(4, 2), user(5, 'u2', 'second question'), assistant(6, 2, 'a2', 'second answer'), end(7, 2),
  start(8, 3), user(9, 'u3', 'busy question'), assistant(10, 3, 'a3', 'busy answer')];

const text = (messages) => messages.map((message) => message.text);

test('main context stops at the requested anchor and excludes runtime reminders', () => {
  const reminder = user(5.5, 'workspace-reminder', 'Host-only working directory context');
  reminder.data.source = { kind: 'runtime-context', form: 'snapshot' };
  const hostEvents = [...events.slice(0, 6), reminder, ...events.slice(6)];
  assert.deepEqual(text(mainContext(hostEvents, { turn: 1, messageId: 'a1', role: 'assistant' }).messages), ['first question', 'first answer']);
  assert.deepEqual(text(mainContext(hostEvents, { turn: 2, role: 'user' }).messages), ['first question', 'first answer', 'second question']);
  assert.deepEqual(text(mainContext(hostEvents, {}).messages), ['first question', 'first answer', 'second question', 'second answer']);
});

const parent = { id: 'p', seed: mainContext(events, { messageId: 'a1' }), turns: [
  { id: 'p1', status: 'done', question: 'parent 1', answer: 'parent answer 1' },
  { id: 'p2', status: 'failed', question: 'failed 2', answer: 'partial 2' },
  { id: 'p3', status: 'done', question: 'parent 3', answer: 'parent answer 3' },
] };

test('branch inherits through the exact source turn and child inherits only its source', () => {
  const branch = cardContext(parent, 'p1', 'branch');
  assert.deepEqual(text(branch.messages), ['first question', 'first answer', 'parent 1', 'parent answer 1']);
  assert.deepEqual(text(cardContext(parent, 'p3', 'branch').messages), ['first question', 'first answer', 'parent 1', 'parent answer 1', 'parent 3', 'parent answer 3']);
  assert.deepEqual(text(cardContext(parent, 'p3', 'child', 'selected words').messages), ['parent 3', 'selected words']);
  assert.throws(() => cardContext(parent, 'p2', 'branch'), /完成/);
  const local = [{ id: 'x1', question: 'local q', answer: 'local a', status: 'done' }, { id: 'x2', question: 'current q', answer: '', status: 'running' }];
  assert.deepEqual(text(generationContext(branch, local, 'x2').messages), [...text(branch.messages), 'local q', 'local a', 'current q']);
});

test('long context keeps the whole current question and reports truncation', () => {
  const long = ('前'.repeat(4000) + '🪴').repeat(7);
  const seed = mainContext([start(0, 1), user(1, 'a', long), assistant(2, 1, 'b', long), end(3, 1)], {});
  const current = '问'.repeat(8000);
  const result = generationContext(seed, [{ id: 'turn', status: 'running', question: current }], 'turn');
  assert.equal(result.messages.at(-1).text, current);
  assert.equal(result.truncated, true);
  assert.ok(result.messages.reduce((n, message) => n + message.text.length, 0) <= 24000);
});
