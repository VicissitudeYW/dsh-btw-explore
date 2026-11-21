import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/store.js';

function file(t, beforeCleanup = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-explore-store-'));
  t.after(() => {
    beforeCleanup();
    rmSync(dir, { recursive: true, force: true });
  });
  return join(dir, 'cards.sqlite');
}

test('expired writer lease recovers partial output and rejects its stale checkpoint', (t) => {
  let store;
  store = createStore(file(t, () => store?.close()));
  store.transaction(() => {
    store.insert('session', { id: 'c', parentId: null, relation: 'root', saved: true, title: 'title',
      source: { kind: 'main' }, anchorTurnId: null, seed: { mode: 'main', messages: [], truncated: false }, createdAt: 1 });
    store.start('session', 'c', { id: 't', ordinal: 0, question: 'question', now: 1, token: 'old' }, 100);
  });
  const job = { sessionId: 'session', cardId: 'c', turnId: 't', token: 'old', answer: 'partial' };
  assert.equal(store.checkpoint(job, 30, 100), true);
  assert.equal(store.read('session', 'c', 101).card.status, 'interrupted');
  assert.equal(store.checkpoint({ ...job, answer: 'late' }, 102, 200), false);
  store.retry('session', 'c', 't', 'new', 103, 200);
  assert.equal(store.settle({ ...job, answer: 'stale' }, 'done', null, 104), false);
  assert.equal(store.read('session', 'c', 104).card.turns[0].answer, '');
});

test('future and damaged databases are rejected without overwriting data', (t) => {
  const future = file(t);
  const db = new DatabaseSync(future);
  db.exec('PRAGMA user_version = 999; CREATE TABLE evidence(note TEXT); INSERT INTO evidence VALUES (\'preserve\')');
  db.close();
  assert.throws(() => createStore(future), /更高版本/);
  const check = new DatabaseSync(future);
  assert.equal(check.prepare('SELECT note FROM evidence').get().note, 'preserve');
  check.close();
  const damaged = file(t);
  writeFileSync(damaged, 'unreadable database');
  assert.throws(() => createStore(damaged));
  assert.equal(readFileSync(damaged, 'utf8'), 'unreadable database');
});
