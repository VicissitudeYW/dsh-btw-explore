import { homedir } from 'node:os';
import { join } from 'node:path';
import { createExplorer } from './service.js';
import { ExploreError } from './store.js';

export const name = 'dsh-btw-explore';
export const inject = ['sessions', 'sessionQuery', 'agents', 'llm', 'connection', 'sessionController', 'systemPrompt'];
export const PATH = '/api/dsh-btw-explore';
const BODY_LIMIT = 64 * 1024;

function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
}

export function createHandler(explorer) {
  return async function fetch(request) {
    try {
      const url = new URL(request.url);
      if (request.method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        if (url.searchParams.get('previews') === '1') return json(await explorer.readWhiteboard(sessionId, request.signal));
        return json(explorer.read(sessionId, url.searchParams.get('cardId') ?? undefined));
      }
      if (request.method !== 'POST') return json({ error: '不支持此请求。' }, 405);
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return json({ error: '内容格式有误，请刷新后重试。' }, 415);
      if (Number(request.headers.get('content-length')) > BODY_LIMIT) return json({ error: '内容过长，请缩短后重试。' }, 413);
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.byteLength > BODY_LIMIT) return json({ error: '内容过长，请缩短后重试。' }, 413);
      let body;
      try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { return json({ error: '内容格式有误，请刷新后重试。' }, 400); }
      if (body === null || typeof body !== 'object' || Array.isArray(body)) return json({ error: '请求无效。' }, 400);
      return json(await explorer.mutate(body.sessionId, body));
    } catch (error) {
      if (error instanceof ExploreError) return json({ error: error.message }, error.status);
      console.error('[dsh-btw-explore] Card request failed.', error);
      return json({ error: '无法读取或保存探索数据，请检查 DSH 日志和存储空间。' }, 500);
    }
  };
}

export function apply(ctx) {
  const database = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'btw-explore', 'cards.sqlite');
  // Connection owns the browser/shell authentication, trust and owner fence.
  // The same Fetch registry works in Desktop without a physical HTTP server.
  let explorer;
  const instance = () => (explorer ??= createExplorer(ctx, { database }));
  const handler = createHandler({
    read(...args) { return instance().read(...args); },
    readWhiteboard(...args) { return instance().readWhiteboard(...args); },
    mutate(...args) { return instance().mutate(...args); },
  });
  ctx.connection.fetch.register({ path: PATH, methods: ['GET', 'POST'], requestBody: 'buffered', fetch: handler });
  ctx.systemPrompt.context({ name: 'dsh-btw-explore:source', order: 900, interpolate: false, required: true,
    text: ({ agent }) => agent?.id ? instance().nativeContext(agent.id) : '' });
  // Toolbar regeneration can start the new native turn before its client
  // navigation response. DSH refreshes required prompt contexts after this
  // awaited hook, so that first request receives the same source snapshot.
  ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    await instance().adoptNativeVersionForStep(agent.id);
    signal?.throwIfAborted();
    return next();
  });
  ctx.on('session/event', (session, event) => explorer?.observeNativeMessage(session, event));
  ctx.effect(() => () => explorer?.close(), 'btw-explore: preserve interrupted turns and close database');
}
