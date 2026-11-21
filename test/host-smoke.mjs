/**
 * Actual DSH web-host smoke test, isolated from every real profile and provider.
 *
 * node test/host-smoke.mjs [--serve] [--fixture-only] [--package=path-to-tgz] [--toolbar]
 * DSH_DESKTOP_ROOT may point at a different installed Desktop directory.
 * Every run creates its own temporary home, workspace, logs and provider.
 * --serve leaves only this test's services running for a browser check; Ctrl+C
 * stops them. The browser must use the printed authenticated test URL.
 * This verifies native host mounting, APIs and persistence. UI verification
 * is a separate browser check.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktop = process.env.DSH_DESKTOP_ROOT ?? 'D:/AI Tools/DeepSeek Harness';
const executable = path.join(desktop, process.platform === 'win32' ? 'DeepSeek Harness.exe' : 'DeepSeek Harness');
const cli = path.join(desktop, 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-btw-host-smoke-'));
const home = path.join(temp, 'home');
const workspace = path.join(temp, 'workspace');
const agents = path.join(temp, 'agents');
for (const dir of [home, workspace, agents]) fs.mkdirSync(dir, { recursive: true });

const args = new Set(process.argv.slice(2));
const serve = args.has('--serve');
const fixtureOnly = args.has('--fixture-only');
const withToolbar = args.has('--toolbar');
const archive = [...args].find((arg) => arg.startsWith('--package='))?.slice('--package='.length);
const requests = [];
let host;
let provider;
let hostRun = 0;
let origin;
let cookie;
let authenticatedUrl;
let shuttingDown = false;
const evidence = { temp, executable, cli, checks: [], providerRequests: requests };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function pass(name, detail) {
  evidence.checks.push({ name, detail });
  console.log(`PASS ${name}${detail === undefined ? '' : `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

function cleanEnvironment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN|SECRET|CREDENTIAL|PROXY)/i.test(key)
      || /^(?:DSH|DEEPSEEK|OPENAI|ANTHROPIC|GOOGLE|GEMINI|AZURE|AWS|AGENTS)_/.test(key)) delete env[key];
  }
  Object.assign(env, {
    ELECTRON_RUN_AS_NODE: '1', DSH_HOME: home, AGENTS_HOME: agents,
    HOME: home, USERPROFILE: home, APPDATA: path.join(home, 'appdata'),
    LOCALAPPDATA: path.join(home, 'localappdata'), XDG_CONFIG_HOME: path.join(home, 'config'),
    XDG_DATA_HOME: path.join(home, 'data'), XDG_CACHE_HOME: path.join(home, 'cache'),
    DSH_TELEMETRY_MODE: 'OFF', DSH_BTW_SMOKE_KEY: 'local-test-not-a-real-key',
    NODE_OPTIONS: `--require=${JSON.stringify(path.join(temp, 'loopback-only.cjs'))}`,
  });
  return env;
}

// Defense in depth: even optional host services cannot send traffic off-machine.
fs.writeFileSync(path.join(temp, 'loopback-only.cjs'), `
const net = require('node:net');
const originalConnect = net.Socket.prototype.connect;
const local = (host) => host === undefined || host === 'localhost' || host === '::1'
  || host === '[::1]' || host === '0:0:0:0:0:0:0:1' || /^127\\.\\d+\\.\\d+\\.\\d+$/.test(host);
net.Socket.prototype.connect = function(...args) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  const host = typeof options === 'object' && options !== null ? options.host : typeof args[1] === 'string' ? args[1] : undefined;
  if (!local(host)) throw new Error('Smoke harness blocked non-loopback socket: ' + host);
  return originalConnect.apply(this, args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!local(url.hostname)) return Promise.reject(new Error('Smoke harness blocked non-loopback fetch: ' + url.origin));
  return originalFetch(input, options);
};
`);

async function startProvider() {
  provider = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      const entry = { method: req.method, path: req.url, model: body?.model, stream: body?.stream,
        messages: body?.messages, at: new Date().toISOString() };
      requests.push(entry);
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ object: 'list', data: [{ id: 'smoke-model', object: 'model', owned_by: 'local-smoke' }] }));
        return;
      }
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        res.writeHead(404); res.end('local smoke provider: not found'); return;
      }
      assert.equal(req.headers.authorization, 'Bearer local-test-not-a-real-key');
      assert.equal(body.model, 'smoke-model');
      assert.equal(body.stream, true);
      entry.accepted = true;
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const id = `chatcmpl-${randomUUID()}`;
      const base = { id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'smoke-model' };
      const send = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      send({ role: 'assistant', content: '' });
      for (const text of ['本地烟测回答：', '这是一段', '分块返回的', '旁路解释。']) {
        if (res.destroyed) return;
        send({ content: text });
        await pause(120);
      }
      send({}, 'stop');
      res.write(`data: ${JSON.stringify({ ...base, choices: [], usage: { prompt_tokens: 10, completion_tokens: 16, total_tokens: 26 } })}\n\n`);
      res.end('data: [DONE]\n\n');
      entry.completed = true;
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: error.message } }));
    }
  });
  provider.listen(0, '127.0.0.1');
  await once(provider, 'listening');
  return `http://127.0.0.1:${provider.address().port}/v1`;
}

async function childCommand(commandArgs, logName) {
  const child = spawn(executable, ['--expose-internals', cli, ...commandArgs], {
    env: cleanEnvironment(), cwd: workspace, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const result = await Promise.race([
    once(child, 'exit').then(([code]) => ({ code })),
    once(child, 'error').then(([error]) => ({ error })),
    pause(30000).then(() => ({ timeout: true })),
  ]);
  fs.writeFileSync(path.join(temp, logName), output);
  if (result.timeout) child.kill();
  assert.equal(result.code, 0, `DSH command failed ${JSON.stringify(result)}\n${output.slice(-6000)}`);
  return output;
}

async function prepareProfile(baseURL) {
  assert.ok(fs.existsSync(executable), `Installed DSH Desktop executable missing: ${executable}`);
  const version = (await childCommand(['--version'], 'version.log')).trim();
  assert.equal(version, '0.2.2-rc.5', 'This integration fixture pins the inspected host version');
  pass('installed DSH version', version);
  await childCommand(['btw-smoke', '--from-default-profile', 'web', '--dump-config'], 'composed-default-config.yml');
  const profile = path.join(home, 'profiles', 'btw-smoke');
  if (archive) {
    const packagePath = path.resolve(archive);
    assert.ok(fs.statSync(packagePath).isFile(), `Package is not a file: ${packagePath}`);
    await childCommand(['plugin', '--profile', 'btw-smoke', 'add', `file:${packagePath.replaceAll('\\', '/')}`, '--offline'], 'package-install.log');
    pass('DSH plugin command installed the release archive in the isolated profile', path.basename(packagePath));
  } else {
    const manifestPath = path.join(profile, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.dependencies['dsh-btw-explore'] = `link:${project.replaceAll('\\', '/')}`;
    manifest.dsh.profile.bundles.push('dsh-btw-explore');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    fs.mkdirSync(path.join(profile, 'node_modules'), { recursive: true });
    fs.symlinkSync(project, path.join(profile, 'node_modules', 'dsh-btw-explore'), process.platform === 'win32' ? 'junction' : 'dir');
  }
  if (withToolbar) {
    const toolbarRoot = path.resolve(project, '../dsh-message-toolbar');
    const manifestPath = path.join(profile, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.dependencies['dsh-message-toolbar'] = `link:${toolbarRoot.replaceAll('\\', '/')}`;
    manifest.dsh.profile.bundles.push('dsh-message-toolbar');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    fs.symlinkSync(toolbarRoot, path.join(profile, 'node_modules', 'dsh-message-toolbar'), process.platform === 'win32' ? 'junction' : 'dir');
  }
  fs.writeFileSync(path.join(profile, 'cordis.patch.yml'), `
- id: session-title-llm
  disabled: true
- id: session-telemetry-otel
  disabled: true
- id: product-analytics
  disabled: true
- id: desktop-product-telemetry
  disabled: true
- id: llm-deepseek
  disabled: true
- id: llm-deepseek-account
  disabled: true
- id: agent-default-model
  config:
    provider: btw-smoke
    model: smoke-model
- id: llm-pi-ai
  config:
    providers:
      btw-smoke:
        apiKeyEnv: DSH_BTW_SMOKE_KEY
        api: openai-completions
        baseURL: ${JSON.stringify(baseURL)}
        defaultContextWindow: 65536
        defaultMaxTokens: 8192
        defaultInput: [text]
        models:
          - id: smoke-model
            name: Local smoke model
            reasoningEfforts: false
`);
  await childCommand(['--profile', 'btw-smoke', '--dump-config'], 'composed-smoke-config.yml');
}

async function startHost() {
  hostRun += 1;
  let output = '';
  const log = fs.createWriteStream(path.join(temp, `host-${hostRun}.log`));
  const child = spawn(executable, ['--expose-internals', cli, '--profile', 'btw-smoke', '--host', '127.0.0.1', '--port', '0', '--no-open'], {
    env: cleanEnvironment(), cwd: workspace, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  host = child;
  const record = (chunk) => { output += chunk; log.write(chunk); };
  child.stdout.on('data', record); child.stderr.on('data', record);
  child.once('exit', () => log.end());
  child.once('error', (error) => { output += error.stack; });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const urls = output.replace(/\u001b\[[\d;]*m/g, '').match(/http:\/\/127\.0\.0\.1:\d+\/[^\s\u001b]*/g) ?? [];
    authenticatedUrl = urls.find((candidate) => new URL(candidate).search.length > 0);
    if (authenticatedUrl) {
      origin = new URL(authenticatedUrl).origin;
      try {
        const response = await fetch(authenticatedUrl, { redirect: 'manual', signal: AbortSignal.timeout(1500) });
        const setCookies = response.headers.getSetCookie();
        if (response.status === 303 && setCookies.length > 0) {
          cookie = setCookies.map((value) => value.split(';')[0]).join('; ');
          return;
        }
      } catch {}
    }
    if (child.exitCode !== null) throw new Error(`DSH host exited (${child.exitCode}):\n${output.slice(-11000)}`);
    await pause(100);
  }
  throw new Error(`DSH host never printed an authenticated URL. Log: ${path.join(temp, `host-${hostRun}.log`)}\n${output.slice(-11000)}`);
}

async function stopHost() {
  const child = host;
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  if (!child) return;
  if (exited()) { host = undefined; return; }
  // Subscribe before sending the signal, then reuse the same settlement. On
  // Windows a signal exit leaves exitCode null and sets signalCode instead;
  // waiting for a second exit event after that would never complete.
  const exit = once(child, 'exit');
  const wait = async (milliseconds) => {
    let timer;
    try {
      await Promise.race([exit, new Promise((resolve) => { timer = setTimeout(resolve, milliseconds); })]);
    } finally { clearTimeout(timer); }
  };
  // Windows signals terminate only our spawned test-host PID; no taskkill/tree
  // enumeration, real Desktop restart, or process-by-name selection is used.
  child.kill('SIGTERM');
  await wait(5000);
  if (!exited()) { child.kill('SIGKILL'); await wait(5000); }
  assert.ok(exited(), `Owned smoke host PID ${child.pid} did not exit after termination`);
  if (host === child) host = undefined;
}

async function json(urlPath, body) {
  const response = await fetch(`${origin}${urlPath}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { cookie, origin, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  assert.equal(response.status, 200, `${urlPath} HTTP ${response.status}: ${text.slice(0, 2000)}`);
  try { return JSON.parse(text); } catch { throw new Error(`${urlPath} returned non-JSON: ${text.slice(0, 2000)}`); }
}

async function rpc(method, request) {
  const response = await json(`/api/${method}`, { type: 'client-request', rpcId: randomUUID(), method, payload: { args: { request } } });
  assert.equal(response.type, 'server-response');
  assert.equal(response.result.ok, true, `${method}: ${JSON.stringify(response.result)}`);
  return response.result.value;
}

async function poll(run, predicate, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await run();
    if (predicate(value)) return value;
    await pause(100);
  }
  throw new Error(`${label} timed out. Last value: ${JSON.stringify(value).slice(0, 4000)}`);
}

async function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;
  await stopHost();
  if (provider) {
    provider.closeAllConnections();
    await new Promise((resolve) => provider.close(resolve));
  }
  fs.writeFileSync(path.join(temp, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}
process.once('SIGINT', () => { void cleanup().then(() => process.exit(130)); });
process.once('SIGTERM', () => { void cleanup().then(() => process.exit(143)); });

try {
  console.log(`Smoke temporary directory: ${temp}`);
  const baseURL = await startProvider();
  if (fixtureOnly) {
    const response = await fetch(`${baseURL}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer local-test-not-a-real-key' }, body: JSON.stringify({ model: 'smoke-model', stream: true, messages: [{ role: 'user', content: 'local fixture self-check' }] }) });
    assert.equal(response.status, 200);
    const result = await response.text();
    assert.ok(result.includes('本地烟测回答：') && result.includes('[DONE]'));
    pass('local fake OpenAI streaming fixture');
  } else {
    assert.ok(fs.existsSync(path.join(project, 'lib/index.js')), 'Build/finish the plugin host entry before the integration smoke');
    assert.ok(fs.existsSync(path.join(project, 'lib/client.js')), 'Build the plugin client before the integration smoke');
    await prepareProfile(baseURL);
    await startHost();
    pass('isolated real web host boot and browser cookie authentication', origin);
    const index = await fetch(`${origin}/`, { headers: { cookie }, signal: AbortSignal.timeout(10000) });
    const html = await index.text();
    assert.equal(index.status, 200);
    assert.ok(html.includes('dsh-btw-explore'), 'Plugin must be in the actual host browser-module roster');
    if (withToolbar) assert.ok(html.includes('dsh-message-toolbar'), 'The fixture must also load the message toolbar');
    pass('plugin in real browser-module bootstrap');

    const created = await rpc('session/create', { cwd: workspace, agentPreset: 'minimal' });
    assert.equal(typeof created.sessionId, 'string');
    const sessionId = created.sessionId;
    evidence.sessionId = sessionId;
    pass('native session create API', sessionId);
    await rpc('session/prompt', { sessionId, requestId: randomUUID(), mode: 'queue', content: [{ type: 'text', text: '主聊天烟测问题：请给出简短说明。' }] });
    const address = { kind: 'session', sessionId };
    const before = await poll(() => rpc('session/events', { address, maxMessages: 100 }),
      (value) => JSON.stringify(value).includes('"turn/end"'), 'main fake-provider turn');
    assert.ok(requests.some((entry) => entry.accepted && entry.completed), 'Actual model adapter must complete a local HTTP SSE request');
    pass('real host fake model streaming for main session');

    const initial = await json(`/api/dsh-btw-explore?sessionId=${encodeURIComponent(sessionId)}`);
    assert.deepEqual(initial.cards, []);
    pass('plugin exact /api/dsh-btw-explore GET route');
    const denied = await fetch(`${origin}/api/dsh-btw-explore?sessionId=${encodeURIComponent(sessionId)}`);
    assert.equal(denied.status, 401, 'Exact plugin fetch route must inherit native browser authentication');
    pass('plugin route requires native owner cookie');

    const cardId = `card-${randomUUID()}`;
    const turnId = `turn-${randomUUID()}`;
    const question = '独立旁路烟测问题：请解释主聊天中的说明。';
    const count = requests.length;
    const pending = await json('/api/dsh-btw-explore', { action: 'create', sessionId, cardId, turnId, relation: 'root', question, preview: true });
    const query = `/api/dsh-btw-explore?sessionId=${encodeURIComponent(sessionId)}&cardId=${encodeURIComponent(cardId)}`;
    assert.deepEqual(pending, { cardId, turnId }, 'Mutation acknowledges the durable card and turn identities');
    const running = await json(query);
    assert.ok(running.card?.turns.some((turn) => turn.id === turnId && turn.status === 'running'), `Acknowledged side turn must be durably running: ${JSON.stringify(running)}`);
    pass('side card durably running after acknowledgement');
    const completed = await poll(() => json(query), (value) => value.card?.turns.some((turn) => turn.id === turnId && turn.status !== 'running'), 'side card model completion');
    const turn = completed.card.turns.find((value) => value.id === turnId);
    assert.equal(turn.status, 'done', JSON.stringify(turn));
    assert.ok(turn.answer.includes('本地烟测回答：'));
    const sideRequest = requests.slice(count).find((entry) => entry.accepted && entry.completed);
    assert.ok(sideRequest, 'Side card must reach the actual model adapter and local HTTP provider');
    const sideMessages = sideRequest.messages.map(({ role, content }) => ({ role, content }));
    assert.equal(sideMessages.some(({ content }) => String(content).includes('主聊天烟测问题')), true);
    assert.equal(sideMessages.some(({ content }) => String(content).includes('<system-reminder>')), false);
    pass('side card fake model streaming completed');
    pass('side request contains chat text and excludes host runtime reminders');
    await json('/api/dsh-btw-explore', { action: 'save', sessionId, cardId });
    const followQuestion = '续问烟测问题：继续解释上下文。';
    const followTurnId = `turn-${randomUUID()}`;
    await json('/api/dsh-btw-explore', { action: 'ask', sessionId, cardId, turnId: followTurnId, question: followQuestion });
    const saved = await poll(() => json(query), (value) => value.card?.turns.some((turn) => turn.id === followTurnId && turn.status !== 'running'), 'card follow-up completion');
    assert.equal(saved.card.saved, true);
    assert.equal(saved.card.turns.at(-1).status, 'done');

    const branchId = `card-${randomUUID()}`;
    const branchTurnId = `turn-${randomUUID()}`;
    const branchQuestion = '分支烟测问题：从第一轮继续。';
    await json('/api/dsh-btw-explore', { action: 'create', sessionId, cardId: branchId, turnId: branchTurnId,
      relation: 'branch', parentId: cardId, anchorTurnId: turnId, question: branchQuestion });
    const branchQuery = `/api/dsh-btw-explore?sessionId=${encodeURIComponent(sessionId)}&cardId=${encodeURIComponent(branchId)}`;
    const branch = await poll(() => json(branchQuery), (value) => value.card?.turns[0]?.status !== 'running' && value.card, 'branch completion');
    assert.equal(branch.card.turns[0].status, 'done');
    const branchRequest = requests.find((entry) => entry.completed && entry.messages?.at(-1)?.content === branchQuestion);
    assert.ok(branchRequest, 'Branch must reach the local model provider');
    assert.equal(branchRequest.messages.some(({ content }) => String(content).includes(question)), true);
    assert.equal(branchRequest.messages.some(({ content }) => String(content).includes(followQuestion)), false);
    pass('branch model request inherits the designated turn and excludes the later follow-up');

    const nativeCardId = `card-${randomUUID()}`;
    const nativeSpec = { action: 'open-native', sessionId, cardId: nativeCardId,
      relation: 'branch', parentId: cardId, anchorTurnId: turnId };
    const beforeOpen = requests.length;
    const nativeCard = await json('/api/dsh-btw-explore', nativeSpec);
    assert.notEqual(nativeCard.nativeSessionId, sessionId);
    assert.deepEqual(await json('/api/dsh-btw-explore', nativeSpec), nativeCard);
    assert.equal(requests.length, beforeOpen, 'Opening an empty native card must not call the model');
    const nativeAddress = { kind: 'session', sessionId: nativeCard.nativeSessionId };
    async function nativePrompt(target, text) {
      const address = { kind: 'session', sessionId: target };
      const start = requests.length;
      await rpc('session/prompt', { sessionId: target, requestId: randomUUID(), mode: 'queue', content: [{ type: 'text', text }] });
      const call = await poll(async () => requests.slice(start).find((entry) => entry.completed
        && entry.messages?.some((part) => String(part.content).includes(text))), Boolean, 'native card model completion');
      const snapshot = await poll(() => rpc('session/events', { address, maxMessages: 100 }),
        (value) => JSON.stringify(value).includes(text) && JSON.stringify(value).includes('turn/end'), 'native card durable reply');
      return { call, snapshot };
    }
    const firstNativeQuestion = '原生子卡首问，仅在自己的分支里。';
    const { call: nativeCall, snapshot: nativeSnapshot } = await nativePrompt(nativeCard.nativeSessionId, firstNativeQuestion);
    assert.ok(JSON.stringify(nativeCall.messages).includes(question));
    assert.ok(!JSON.stringify(nativeCall.messages).includes(followQuestion));
    pass('native composer RPC uses only the designated source prefix and opens without generating');

    const childId = `card-${randomUUID()}`;
    const child = await json('/api/dsh-btw-explore', { action: 'open-native', sessionId, cardId: childId,
      relation: 'child', parentId: nativeCardId, source: { turn: 1, role: 'assistant' }, quote: '分块返回' });
    const { call: nativeChildCall } = await nativePrompt(child.nativeSessionId, '请解释选中的三个字。');
    const childInput = JSON.stringify(nativeChildCall.messages);
    assert.ok(childInput.includes(firstNativeQuestion) && childInput.includes('分块返回'));
    assert.ok(!childInput.includes(question), 'A native child only sees its anchor, not the inherited prefix');
    pass('native card can spawn a quoted child with only the anchor context');
    const after = await rpc('session/events', { address, maxMessages: 100 });
    assert.deepEqual(after, before, 'Independent side questions must not append any main-session events');
    pass('main session event snapshot unchanged after exploration, follow-up and branch');
    await stopHost();
    await startHost();
    const restored = await json(query);
    assert.deepEqual(restored.card, saved.card);
    assert.deepEqual((await json(branchQuery)).card, branch.card);
    pass('saved card, follow-up and branch survive actual host process restart');
    const nativeRestored = await json(`/api/dsh-btw-explore?sessionId=${sessionId}&cardId=${nativeCardId}`);
    assert.equal(nativeRestored.card.nativeSessionId, nativeCard.nativeSessionId);
    assert.deepEqual(await rpc('session/events', { address: nativeAddress, maxMessages: 100 }), nativeSnapshot);
    pass('native card binding and host transcript survive restart');
    assert.deepEqual(await rpc('session/events', { address, maxMessages: 100 }), before);
    pass('main native history unchanged after restart');
    evidence.cardId = cardId;
    if (serve) {
      console.log(`Browser verification URL: ${authenticatedUrl}`);
      console.log(`Main native session: ${sessionId}`);
      console.log(`Saved side card: ${cardId}`);
      console.log('Only isolated test services remain running. Ctrl+C stops them.');
      fs.writeFileSync(path.join(temp, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
      await new Promise(() => {});
    }
  }
} catch (error) {
  evidence.failure = error.stack;
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await cleanup();
  console.log(`Smoke evidence retained: ${path.join(temp, 'evidence.json')}`);
}
