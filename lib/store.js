import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class ExploreError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

const SCHEMA_VERSION = 4;
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
      if (version < 3) db.exec(`
        ALTER TABLE cards ADD COLUMN native_request TEXT;
        ALTER TABLE cards ADD COLUMN native_token TEXT;
        ALTER TABLE cards ADD COLUMN native_lease_until INTEGER;
        PRAGMA user_version = 3;
      `);
      if (version < 4) db.exec(`
        CREATE TABLE native_versions (
          native_session_id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          card_id TEXT NOT NULL,
          FOREIGN KEY(session_id, card_id) REFERENCES cards(session_id, id) ON DELETE CASCADE
        ) STRICT;
        CREATE INDEX native_versions_card ON native_versions(session_id, card_id);
        INSERT INTO native_versions SELECT native_session_id, session_id, id FROM cards WHERE native_session_id IS NOT NULL;
        PRAGMA user_version = 4;
      `);
    });
  } catch (error) {
    db.close();
    throw error;
  }

  const query = (sql) => db.prepare(sql);
  const card = query('SELECT * FROM cards WHERE session_id = ? AND id = ?');
  const quotedNative = query(`SELECT id FROM cards
    WHERE session_id = ? AND native_session_id IS NOT NULL AND native_request = ?
    ORDER BY native_ready DESC, created_at, id LIMIT 1`);
  const turns = query('SELECT * FROM turns WHERE session_id = ? AND card_id = ? ORDER BY ordinal');
  const newCard = query(`INSERT INTO cards
    (session_id, id, parent_id, relation, saved, title, source, anchor_turn_id, seed, created_at, updated_at, native_session_id, native_request)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const claimNative = query(`UPDATE cards SET native_token = ?, native_lease_until = ?
    WHERE session_id = ? AND id = ? AND native_session_id = ? AND native_ready = 0
    AND (native_token IS NULL OR native_lease_until < ?)`);
  const renewNative = query(`UPDATE cards SET native_lease_until = ?
    WHERE session_id = ? AND id = ? AND native_session_id = ? AND native_token = ? AND native_ready = 0 AND native_lease_until >= ?`);
  const markNativeReady = query(`UPDATE cards SET native_ready = 1, native_token = NULL, native_lease_until = NULL
    WHERE session_id = ? AND id = ? AND native_session_id = ? AND native_token = ? AND native_ready = 0 AND native_lease_until >= ?`);
  const releaseNative = query(`UPDATE cards SET native_token = NULL, native_lease_until = NULL
    WHERE session_id = ? AND id = ? AND native_session_id = ? AND native_token = ?`);
  const nativeSeed = query(`SELECT c.seed FROM native_versions v JOIN cards c ON c.session_id = v.session_id AND c.id = v.card_id
    WHERE v.native_session_id = ? AND c.native_ready = 1`);
  const nativeOwner = query('SELECT session_id, card_id FROM native_versions WHERE native_session_id = ?');
  const sidebarSessions = query(`SELECT v.native_session_id FROM native_versions v
    JOIN cards c ON c.session_id = v.session_id AND c.id = v.card_id WHERE c.native_ready = 1`);
  const registerNativeVersion = query('INSERT INTO native_versions (native_session_id, session_id, card_id) VALUES (?, ?, ?)');
  const selectNativeVersion = query(`UPDATE cards SET native_session_id = ?, updated_at = ?
    WHERE session_id = ? AND id = ? AND native_session_id = ? AND native_ready = 1`);
  const nativeTitle = query('UPDATE cards SET title = ?, updated_at = ? WHERE native_session_id = ? AND native_ready = 1');
  const nativeDescendants = query(`${DESCENDANTS} SELECT native_session_id FROM native_versions WHERE session_id = ?
    AND card_id IN (SELECT id FROM subtree)`);
  const title = query('SELECT COUNT(*) AS count FROM cards WHERE session_id = ?');
  const summaries = query(`SELECT c.id, c.parent_id, c.relation, c.saved, c.title, c.source, c.anchor_turn_id,
    c.created_at, c.updated_at, c.native_session_id, c.native_ready,
    (SELECT status FROM turns WHERE session_id = c.session_id AND card_id = c.id ORDER BY ordinal DESC LIMIT 1) AS status,
    (SELECT COUNT(*) FROM turns WHERE session_id = c.session_id AND card_id = c.id) AS turn_count
    FROM cards AS c WHERE c.session_id = ? AND (? = 0 OR c.saved = 1) ORDER BY c.created_at, c.id`);
  const latestAnswer = query(`SELECT substr(answer, 1, ?) AS answer FROM turns
    WHERE session_id = ? AND card_id = ? AND answer <> '' ORDER BY ordinal DESC LIMIT 1`);
  const insertTurn = query(`INSERT INTO turns (session_id, card_id, id, ordinal, question, status,
    created_at, token, lease_until) VALUES (?, ?, ?, ?, ?, 'running', ?, ?, ?)`);
  const retryTurn = query(`UPDATE turns SET status = 'running', answer = '', error = NULL, token = ?, lease_until = ?
    WHERE session_id = ? AND card_id = ? AND id = ?`);
  const saveCard = query('UPDATE cards SET saved = 1, updated_at = ? WHERE session_id = ? AND id = ?');
  const activeDescendant = query(`${DESCENDANTS} SELECT 1 FROM turns WHERE session_id = ? AND status = 'running'
    AND card_id IN (SELECT id FROM subtree) LIMIT 1`);
  const preparingDescendant = query(`${DESCENDANTS} SELECT 1 FROM cards WHERE session_id = ?
    AND id IN (SELECT id FROM subtree) AND native_token IS NOT NULL AND native_lease_until >= ? LIMIT 1`);
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
    return { ...projectCard(row), seed: JSON.parse(row.seed), nativeRequest: row.native_request ? JSON.parse(row.native_request) : null,
      turns: turns.all(sessionId, cardId).map(projectTurn) };
  }

  function readSummaries(sessionId, whiteboard = false) {
    return summaries.all(sessionId, Number(whiteboard)).map((row) => ({
      ...projectCard(row, whiteboard), status: row.status, turnCount: row.turn_count,
    }));
  }

  function readWhiteboard(sessionId, previewLimit) {
    return transaction(() => {
      const cards = readSummaries(sessionId, true);
      const answers = cards.filter((card) => !card.nativeSessionId)
        .map((card) => [card.id, latestAnswer.get(previewLimit + 1, sessionId, card.id)?.answer ?? '']);
      return { cards, answers };
    }, false);
  }

  function read(sessionId, cardId, now) {
    recover(sessionId, now);
    return transaction(() => {
      const cards = readSummaries(sessionId);
      const detail = cardId === undefined ? null : find(sessionId, cardId);
      if (detail === null) return { cards, card: null };
      const { seed, nativeRequest, ...values } = detail;
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
      value.nativeSessionId ?? null, value.nativeRequest ? JSON.stringify(value.nativeRequest) : null);
    if (value.nativeSessionId) registerNativeVersion.run(value.nativeSessionId, sessionId, value.id);
  }

  function start(sessionId, cardId, turn, leaseUntil) {
    insertTurn.run(sessionId, cardId, turn.id, turn.ordinal, turn.question, turn.now, turn.token, leaseUntil);
    touch.run(turn.now, sessionId, cardId);
  }

  function retry(sessionId, cardId, turnId, token, now, leaseUntil) {
    retryTurn.run(token, leaseUntil, sessionId, cardId, turnId);
    touch.run(now, sessionId, cardId);
  }

  function remove(sessionId, cardId, now = Date.now()) {
    if (preparingDescendant.get(cardId, sessionId, sessionId, now)) throw new ExploreError('此分支的对话仍在准备，请稍后重试移除。');
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
    transaction, find, read, readWhiteboard, recover, insert, start, retry, remove, stop, settle,
    findQuotedNative: (sessionId, spec) => {
      const match = quotedNative.get(sessionId, spec);
      return match ? find(sessionId, match.id) : null;
    },
    claimNative: (job, now, leaseUntil) => claimNative.run(job.token, leaseUntil,
      job.sessionId, job.cardId, job.nativeSessionId, now).changes === 1,
    renewNative: (job, now, leaseUntil) => renewNative.run(leaseUntil,
      job.sessionId, job.cardId, job.nativeSessionId, job.token, now).changes === 1,
    markNativeReady: (job, now) => markNativeReady.run(job.sessionId, job.cardId, job.nativeSessionId, job.token, now).changes === 1,
    releaseNative: (job) => releaseNative.run(job.sessionId, job.cardId, job.nativeSessionId, job.token).changes === 1,
    nativeSeed: (nativeSessionId) => nativeSeed.get(nativeSessionId)?.seed,
    sidebarSessions: () => sidebarSessions.all().map(({ native_session_id }) => native_session_id),
    nativeOwner: (nativeSessionId) => {
      const row = nativeOwner.get(nativeSessionId);
      return row ? { sessionId: row.session_id, cardId: row.card_id } : null;
    },
    registerNativeVersion: (sessionId, cardId, nativeSessionId) => registerNativeVersion.run(nativeSessionId, sessionId, cardId),
    selectNativeVersion: (sessionId, cardId, from, to, now) => selectNativeVersion.run(to, now, sessionId, cardId, from).changes === 1,
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
