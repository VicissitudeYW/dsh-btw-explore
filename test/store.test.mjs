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
  assert.throws(() => createStore(future), /请更新 dsh-btw-explore/);
  const check = new DatabaseSync(future);
  assert.equal(check.prepare('SELECT note FROM evidence').get().note, 'preserve');
  check.close();
  const damaged = file(t);
  writeFileSync(damaged, 'unreadable database');
  assert.throws(() => createStore(damaged));
  assert.equal(readFileSync(damaged, 'utf8'), 'unreadable database');
});

test('the 0.3.3 database upgrades without changing native bindings or a live legacy writer', (t) => {
  const database = file(t);
  const old = new DatabaseSync(database);
  old.exec(`CREATE TABLE cards (
    session_id TEXT NOT NULL, id TEXT NOT NULL, parent_id TEXT, relation TEXT NOT NULL, saved INTEGER NOT NULL,
    title TEXT NOT NULL, source TEXT NOT NULL, anchor_turn_id TEXT, seed TEXT NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, native_session_id TEXT, native_ready INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(session_id, id), FOREIGN KEY(session_id, parent_id) REFERENCES cards(session_id, id) ON DELETE CASCADE
  ) STRICT;
  CREATE UNIQUE INDEX cards_native_session ON cards(native_session_id) WHERE native_session_id IS NOT NULL;
  CREATE TABLE turns (
    session_id TEXT NOT NULL, card_id TEXT NOT NULL, id TEXT NOT NULL, ordinal INTEGER NOT NULL, question TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, provider TEXT, model TEXT, error TEXT,
    truncated INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, token TEXT, lease_until INTEGER,
    PRIMARY KEY(session_id, card_id, id), UNIQUE(session_id, card_id, ordinal),
    FOREIGN KEY(session_id, card_id) REFERENCES cards(session_id, id) ON DELETE CASCADE
  ) STRICT;
  CREATE UNIQUE INDEX turns_one_live ON turns(session_id, card_id) WHERE token IS NOT NULL;
  PRAGMA user_version = 2;`);
  const seed = JSON.stringify({ mode: 'main', messages: [{ role: 'user', text: 'fixed source' }], truncated: false });
  const insert = old.prepare(`INSERT INTO cards (session_id, id, relation, saved, title, source, seed,
    created_at, updated_at, native_session_id, native_ready) VALUES ('session', ?, 'root', 1, 'preserve', ?, ?, 1, 1, ?, ?)`);
  insert.run('native-ready', '{"kind":"main","quote":"selection"}', seed, 'session-btw-explore-ready', 1);
  insert.run('native-unready', '{"kind":"main"}', seed, 'session-btw-explore-unready', 0);
  insert.run('legacy', '{"kind":"main"}', seed, null, 0);
  old.exec(`INSERT INTO turns (session_id, card_id, id, ordinal, question, answer, status, created_at, token, lease_until)
    VALUES ('session', 'legacy', 'turn', 0, 'question', 'partial', 'running', 1, 'live-writer', 100)`);
  old.close();

  const store = createStore(database);
  try {
    assert.equal(store.read('session', 'native-ready', 50).card.nativeSessionId, 'session-btw-explore-ready');
    assert.equal(store.read('session', 'native-ready', 50).card.source.quote, 'selection');
    assert.equal(store.nativeSeed('session-btw-explore-ready'), seed);
    assert.equal(store.read('session', 'native-unready', 50).card.nativeReady, false);
    assert.equal(store.read('session', 'legacy', 50).card.status, 'running');
    const job = { sessionId: 'session', cardId: 'legacy', turnId: 'turn', token: 'live-writer', answer: 'continued' };
    assert.equal(store.checkpoint(job, 50, 200), true);
    assert.equal(store.settle(job, 'done', null, 51), true);
    assert.equal(store.read('session', 'legacy', 51).card.turns[0].answer, 'continued');
    store.remove('session', 'native-unready', 51);
    assert.equal(store.find('session', 'native-unready'), null);
  } finally { store.close(); }
});
