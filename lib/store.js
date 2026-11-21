import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class ExploreError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

const SCHEMA_VERSION = 2;
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS cards (
    session_id TEXT NOT NULL,
    id TEXT NOT NULL,
    parent_id TEXT,
    relation TEXT NOT NULL CHECK(relation IN ('root', 'child', 'branch')),
    saved INTEGER NOT NULL CHECK(saved IN (0, 1)),
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    anchor_turn_id TEXT,
    seed TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(session_id, id),
    FOREIGN KEY(session_id, parent_id) REFERENCES cards(session_id, id) ON DELETE CASCADE
  ) STRICT;
  CREATE INDEX IF NOT EXISTS cards_children ON cards(session_id, parent_id);
  CREATE TABLE IF NOT EXISTS turns (
    session_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK(status IN ('running', 'done', 'failed', 'cancelled', 'interrupted')),
    provider TEXT,
    model TEXT,
    error TEXT,
    truncated INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    token TEXT,
    lease_until INTEGER,
    PRIMARY KEY(session_id, card_id, id),
    UNIQUE(session_id, card_id, ordinal),
    FOREIGN KEY(session_id, card_id) REFERENCES cards(session_id, id) ON DELETE CASCADE
  ) STRICT;
  CREATE UNIQUE INDEX IF NOT EXISTS turns_one_live ON turns(session_id, card_id) WHERE token IS NOT NULL;
`;

const DESCENDANTS = `WITH RECURSIVE subtree(id) AS (
  SELECT ? UNION ALL SELECT cards.id FROM cards JOIN subtree ON cards.parent_id = subtree.id WHERE cards.session_id = ?
)`;

function projectCard(row, withQuote = true) {
  const source = JSON.parse(row.source);
  if (!withQuote) delete source.quote;
  return {
    id: row.id, parentId: row.parent_id, relation: row.relation, saved: row.saved === 1,
    title: row.title, source, anchorTurnId: row.anchor_turn_id,
    ...(row.native_session_id ? { nativeSessionId: row.native_session_id, nativeReady: row.native_ready === 1 } : {}),
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function projectTurn(row) {
  return {
    id: row.id, question: row.question, answer: row.answer, status: row.status,
    provider: row.provider, model: row.model, error: row.error, createdAt: row.created_at,
    truncated: row.truncated === 1,
  };
}

export function createStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file, { timeout: 1200 });
  function transaction(run, write = true) {
    db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try {
      const result = run();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  try {
    db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL');
    transaction(() => {
      const version = db.prepare('PRAGMA user_version').get().user_version;
      if (version > SCHEMA_VERSION) throw new ExploreError('请更新 dsh-btw-explore 后再打开这些卡片。');
      if (version === 0) db.exec(SCHEMA);
      if (version < 2) db.exec(`
        ALTER TABLE cards ADD COLUMN native_session_id TEXT;
        ALTER TABLE cards ADD COLUMN native_ready INTEGER NOT NULL DEFAULT 0 CHECK(native_ready IN (0, 1));
        CREATE UNIQUE INDEX cards_native_session ON cards(native_session_id) WHERE native_session_id IS NOT NULL;
        PRAGMA user_version = 2;
      `);
    });
  } catch (error) {
    db.close();
    throw error;
  }

  const query = (sql) => db.prepare(sql);
  const card = query('SELECT * FROM cards WHERE session_id = ? AND id = ?');
  const turns = query('SELECT * FROM turns WHERE session_id = ? AND card_id = ? ORDER BY ordinal');
  const newCard = query(`INSERT INTO cards
    (session_id, id, parent_id, relation, saved, title, source, anchor_turn_id, seed, created_at, updated_at, native_session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const markNativeReady = query('UPDATE cards SET native_ready = 1 WHERE session_id = ? AND id = ?');
  const nativeSeed = query('SELECT seed FROM cards WHERE native_session_id = ? AND native_ready = 1');
  const nativeTitle = query('UPDATE cards SET title = ?, updated_at = ? WHERE native_session_id = ? AND native_ready = 1');
  const nativeDescendants = query(`${DESCENDANTS} SELECT native_session_id FROM cards WHERE session_id = ?
    AND id IN (SELECT id FROM subtree) AND native_session_id IS NOT NULL`);
  const title = query('SELECT COUNT(*) AS count FROM cards WHERE session_id = ?');
  const summaries = query(`SELECT c.id, c.parent_id, c.relation, c.saved, c.title, c.source, c.anchor_turn_id,
    c.created_at, c.updated_at, c.native_session_id, c.native_ready,
    (SELECT status FROM turns WHERE session_id = c.session_id AND card_id = c.id ORDER BY ordinal DESC LIMIT 1) AS status,
    (SELECT COUNT(*) FROM turns WHERE session_id = c.session_id AND card_id = c.id) AS turn_count
    FROM cards AS c WHERE c.session_id = ? ORDER BY c.created_at, c.id`);
  const insertTurn = query(`INSERT INTO turns (session_id, card_id, id, ordinal, question, status,
    created_at, token, lease_until) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)`);
  const retryTurn = query(`UPDATE turns SET status = 'running', answer = '', error = NULL, token = ?, lease_until = ?
    WHERE session_id = ? AND card_id = ? AND id = ?`);
  const saveCard = query('UPDATE cards SET saved = 1, updated_at = ? WHERE session_id = ? AND id = ?');
  const activeDescendant = query(`${DESCENDANTS} SELECT 1 FROM turns WHERE session_id = ? AND status = 'running'
    AND card_id IN (SELECT id FROM subtree) LIMIT 1`);
  const removeCard = query('DELETE FROM cards WHERE session_id = ? AND id = ?');
  const markCancelled = query(`UPDATE turns SET status = 'cancelled', token = NULL, lease_until = NULL, error = NULL
    WHERE session_id = ? AND card_id = ? AND id = ? AND status = 'running'`);
  const markModel = query(`UPDATE turns SET provider = ?, model = ?, truncated = ?
    WHERE session_id = ? AND card_id = ? AND id = ? AND token = ?`);
  const touch = query('UPDATE cards SET updated_at = ? WHERE session_id = ? AND id = ?');
  const checkpoint = query(`UPDATE turns SET answer = ?, lease_until = ?
    WHERE session_id = ? AND card_id = ? AND id = ? AND token = ? AND lease_until >= ?`);
  const finalize = query(`UPDATE turns SET answer = ?, status = ?, error = ?, token = NULL, lease_until = NULL
    WHERE session_id = ? AND card_id = ? AND id = ? AND token = ?`);
  const expireCheck = query(`SELECT 1 FROM turns WHERE session_id = ? AND status = 'running' AND lease_until < ? LIMIT 1`);
  const expire = query(`UPDATE turns SET status = 'interrupted', token = NULL, lease_until = NULL, error = NULL
    WHERE session_id = ? AND status = 'running' AND lease_until < ?`);

  function find(sessionId, cardId) {
    const row = card.get(sessionId, cardId);
    if (row === undefined) return null;
    return { ...projectCard(row), seed: JSON.parse(row.seed), turns: turns.all(sessionId, cardId).map(projectTurn) };
  }

  function read(sessionId, cardId, now) {
    recover(sessionId, now);
    return transaction(() => {
      const cards = summaries.all(sessionId).map((row) => ({
        ...projectCard(row, false), status: row.status, turnCount: row.turn_count,
      }));
      const detail = cardId === undefined ? null : find(sessionId, cardId);
      if (detail === null) return { cards, card: null };
      const { seed, ...values } = detail;
      const latest = detail.turns.at(-1);
      return { cards, card: {
        ...values, status: latest?.status ?? null, turnCount: detail.turns.length,
        context: { mode: seed.mode, messageCount: seed.messages.length, truncated: seed.truncated || Boolean(latest?.truncated) },
      } };
    }, false);
  }

  function recover(sessionId, now) {
    if (expireCheck.get(sessionId, now)) expire.run(sessionId, now);
  }

  function insert(sessionId, value) {
    newCard.run(sessionId, value.id, value.parentId, value.relation, Number(value.saved), value.title,
      JSON.stringify(value.source), value.anchorTurnId, JSON.stringify(value.seed), value.createdAt, value.createdAt,
      value.nativeSessionId ?? null);
  }

  function start(sessionId, cardId, turn, leaseUntil) {
    insertTurn.run(sessionId, cardId, turn.id, turn.ordinal, turn.question, turn.now, turn.token, leaseUntil);
    touch.run(turn.now, sessionId, cardId);
  }

  function retry(sessionId, cardId, turnId, token, now, leaseUntil) {
    retryTurn.run(token, leaseUntil, sessionId, cardId, turnId);
    touch.run(now, sessionId, cardId);
  }

  function remove(sessionId, cardId) {
    if (activeDescendant.get(cardId, sessionId, sessionId)) throw new ExploreError('请先停止此分支中正在生成的问答。');
    removeCard.run(sessionId, cardId);
  }

  function stop(sessionId, cardId, turnId, now) {
    const change = markCancelled.run(sessionId, cardId, turnId).changes === 1;
    if (change) touch.run(now, sessionId, cardId);
    return change;
  }

  function settle(job, status, error, now) {
    return transaction(() => {
      const changed = finalize.run(job.answer, status, error, job.sessionId, job.cardId, job.turnId, job.token).changes === 1;
      if (changed) touch.run(now, job.sessionId, job.cardId);
      return changed;
    });
  }

  return {
    transaction, find, read, recover, insert, start, retry, remove, stop, settle,
    markNativeReady: (sessionId, cardId) => markNativeReady.run(sessionId, cardId),
    nativeSeed: (nativeSessionId) => nativeSeed.get(nativeSessionId)?.seed,
    updateNativeTitle: (nativeSessionId, title, now) => nativeTitle.run(title, now, nativeSessionId),
    nativeDescendants: (sessionId, cardId) => nativeDescendants.all(cardId, sessionId, sessionId).map((row) => row.native_session_id),
    count: (sessionId) => title.get(sessionId).count,
    save: (sessionId, cardId, now) => saveCard.run(now, sessionId, cardId),
    setModel: (job, model, truncated) => markModel.run(model.provider, model.model, Number(truncated),
      job.sessionId, job.cardId, job.turnId, job.token).changes === 1,
    checkpoint: (job, now, leaseUntil) => checkpoint.run(job.answer, leaseUntil,
      job.sessionId, job.cardId, job.turnId, job.token, now).changes === 1,
    close: () => db.close(),
  };
}
