export const MAX_QUESTION = 8000;
export const MAX_QUOTE = 4000;
export const MAX_ANSWER = 64000;
const HISTORY_LIMIT = 24000;
const BLOCK_LIMIT = 10000;
const INTERNAL_USER_SOURCES = new Set(['agent', 'developer', 'runtime-context']);

const cell = (role, text) => ({ role, text });
const cellsForTurn = (turn) => [cell('user', turn.question), cell('assistant', turn.answer)];

export function clipText(text, limit) {
  if (text.length <= limit) return text;
  let end = limit - 2;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end--;
  return `${text.slice(0, end)}\n…`;
}

function bounded(messages, alreadyTruncated = false, limit = HISTORY_LIMIT) {
  const kept = [];
  let length = 0;
  let truncated = alreadyTruncated;
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    const text = clipText(message.text, BLOCK_LIMIT);
    if (length + text.length > limit) {
      truncated = true;
      break;
    }
    kept.unshift(cell(message.role, text));
    length += text.length;
    truncated ||= text !== message.text;
  }
  if (kept[0]?.role === 'assistant') {
    kept.shift();
    truncated = true;
  }
  return { messages: kept, truncated };
}

export function messageText(message) {
  if (!Array.isArray(message?.content)) return '';
  return message.content.filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text).join('\n').trim();
}

// Main-session content is read as plain text. Tool calls, attachments, system
// events and reasoning blocks do not enter the independent request.
function textHistory(events) {
  const rows = [];
  const completed = new Set();
  let openTurn;
  for (const { type, data, seq } of events) {
    if (type === 'turn/start') openTurn = data?.turn;
    else if (type === 'turn/end') {
      if (data?.reason?.kind === 'completed') completed.add(data.turn);
      openTurn = undefined;
    } else if (type === 'user/message' || type === 'assistant/message') {
      const role = type === 'user/message' ? 'user' : 'assistant';
      const message = role === 'user' ? data : data?.message;
      if (role === 'user' && INTERNAL_USER_SOURCES.has(message?.source?.kind)) continue;
      const text = messageText(message);
      if (text) rows.push({ seq, turn: role === 'user' ? openTurn : (data?.turn ?? openTurn), id: message?.id, role, text });
    }
  }
  return { rows, completed };
}

function sourcePoint(rows, anchor) {
  const sameRow = (row) => (anchor.role === undefined || row.role === anchor.role)
    && (anchor.turn === undefined || row.turn === anchor.turn);
  return anchor.messageId
    ? rows.findLast((row) => sameRow(row) && row.id === anchor.messageId)
    : rows.findLast(sameRow);
}

export function mainContext(events, anchor = {}, quote = '') {
  const { rows, completed } = textHistory(events);
  const wanted = anchor.messageId || Number.isSafeInteger(anchor.turn);
  const point = wanted ? sourcePoint(rows, anchor) : undefined;
  const selected = wanted
    ? point === undefined ? [] : rows.filter((row) => row.seq <= point.seq && (completed.has(row.turn) || row.turn === point.turn))
    : rows.filter((row) => completed.has(row.turn));
  const messages = selected.map(({ role, text }) => cell(role, text));
  if (quote) messages.push(cell('user', `引用：\n${quote}`));
  return { mode: 'main', ...bounded(messages), boundarySeq: point?.seq ?? selected.at(-1)?.seq ?? null };
}

// A native branch uses the card's own completed text and its original fixed
// context. The injected runtime-context event is already excluded by textHistory.
export function nativeCardContext(events, anchor, relation, quote, seed) {
  const { rows, completed } = textHistory(events);
  const point = sourcePoint(rows, anchor);
  if (!point || !completed.has(point.turn)) return null;
  const message = (row) => cell(row.role, row.text);
  if (relation === 'branch') {
    const prefix = rows.filter((row) => completed.has(row.turn) && row.seq <= point.seq).map(message);
    return { mode: 'branch', ...bounded([...seed.messages, ...prefix], seed.truncated) };
  }
  const question = rows.findLast((row) => row.turn === point.turn && row.role === 'user' && row.seq <= point.seq);
  if (!question) return null;
  const context = [message(question)];
  if (point.role === 'assistant') context.push(cell('assistant', quote || point.text));
  else if (quote) context[0] = cell('user', quote);
  return { mode: 'quote', ...bounded(context) };
}

export function cardContext(parent, anchorTurnId, relation, quote = '') {
  const index = parent.turns.findIndex((turn) => turn.id === anchorTurnId);
  const target = parent.turns[index];
  if (target?.status !== 'done') throw new Error('请从一轮已完成的问答建立卡片。');
  if (relation === 'child') {
    const messages = [cell('user', target.question), cell('assistant', quote || target.answer)];
    return { mode: 'quote', ...bounded(messages) };
  }
  const inherited = parent.turns.slice(0, index + 1).filter((turn) => turn.status === 'done').flatMap(cellsForTurn);
  return { mode: 'branch', ...bounded([...parent.seed.messages, ...inherited], parent.seed.truncated) };
}

export function generationContext(seed, turns, turnId) {
  const index = turns.findIndex((turn) => turn.id === turnId);
  const { question } = turns[index];
  const prior = turns.slice(0, index).filter((turn) => turn.status === 'done').flatMap(cellsForTurn);
  const history = bounded([...seed.messages, ...prior], seed.truncated, HISTORY_LIMIT - question.length);
  return { ...history, messages: [...history.messages, cell('user', question)] };
}
