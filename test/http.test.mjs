import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHandler } from '../lib/index.js';

test('Fetch handler validates JSON and body bounds before mutation', async () => {
  const received = [];
  const handler = createHandler({
    read(sessionId, cardId) { received.push([sessionId, cardId]); return { cards: [], card: null }; },
    mutate(sessionId, body) { received.push(body); return { cardId: body.cardId }; },
  });
  const url = 'http://localhost/api/dsh-btw-explore';
  const response = await handler(new Request(`${url}?sessionId=s&cardId=c`));
  assert.deepEqual(await response.json(), { cards: [], card: null });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(received.pop(), ['s', 'c']);
  assert.equal((await handler(new Request(url, { method: 'POST', body: '{}' }))).status, 415);
  assert.equal((await handler(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }))).status, 400);
  assert.equal((await handler(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '"bad"' }))).status, 400);
  assert.equal((await handler(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(65537) }))).status, 413);
  assert.equal(received.length, 0);
  assert.equal((await handler(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'save', sessionId: 's', cardId: 'c' }) }))).status, 200);
});
