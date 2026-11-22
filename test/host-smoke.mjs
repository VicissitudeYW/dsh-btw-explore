/**
 * Actual DSH web-host smoke test, isolated from every real profile and provider.
 *
 * node test/host-smoke.mjs [--serve] [--fixture-only] [--package=path-to-tgz] [--toolbar] [--toolbar-package=path-to-tgz]
 * DSH_DESKTOP_ROOT may point at a different installed Desktop directory.
 * DSH_TOOLBAR_ROOT may point at a complete dsh-message-toolbar checkout.
 * Every run creates its own temporary home, workspace, logs and provider.
 * --serve leaves only this test's services running for a browser check; Enter
 * exits through cleanup, and Ctrl+C also stops them. The browser must use the
 * printed authenticated test URL.
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
const toolbarArchive = [...args].find((arg) => arg.startsWith('--toolbar-package='))?.slice('--toolbar-package='.length);
const withToolbar = args.has('--toolbar') || Boolean(toolbarArchive);
const archive = [...args].find((arg) => arg.startsWith('--package='))?.slice('--package='.length);
const requests = [];
const mainQuestion = '天空为什么是蓝色的？';
const question = '蓝光为什么更容易被散射？';
const followQuestion = '那紫光为什么没有让天空变成紫色？';
const branchQuestion = '夕阳为什么常常是红色的？';
const firstNativeQuestion = '日落时的光经过了更厚的大气吗？';
const childQuestion = '“瑞利散射”是什么意思？';
const explanationQuestion = '请结合原对话，用两三句话解释我选中的内容。只解释文字，不调用工具。';
const explanationAnswer = '这段话是说蓝光的波长比红光短，因此它更容易被空气分子散射。';
const quote = '瑞利散射';
const showcaseAnswers = new Map([
  [mainQuestion, '太阳光看起来是白色的，其实包含多种颜色。光进入大气后，空气分子会把它散射到各个方向。\n\n蓝光的波长较短，比红光更容易被散射。因此，白天从天空各处进入眼睛的光里，蓝光更突出，我们便看到了蓝天。'],
  [question, '这与光的波长有关。对远小于光波长的空气分子来说，瑞利散射的强度与波长的四次方成反比。\n\n蓝光的波长比红光短，所以更容易改变传播方向，散布到天空各处。'],
  [followQuestion, '紫光确实更容易被散射，但太阳光中的紫光较少，人眼对紫光也不如对蓝光敏感。\n\n综合太阳光谱、大气散射和人眼的颜色感知，白天的天空通常呈现蓝色。'],
  [branchQuestion, '日落时，太阳光斜穿大气，走过的路程比正午更长。短波长的蓝光在途中被散射得更多，抵达眼睛的直射光便以红、橙等颜色为主。\n\n空气中的尘埃和小水滴也会影响晚霞的颜色。'],
  [firstNativeQuestion, '是的，更准确地说，是光在大气中走过的路程更长。\n\n正午时，阳光近乎竖直穿过大气；日落时，阳光沿较倾斜的方向进入。瑞利散射使蓝光在这段更长的路途中更容易离开原来的方向，剩下的直射光就偏红了。'],
  [childQuestion, '瑞利散射是光被远小于自身波长的微小粒子散射的现象，空气中的氮气和氧气分子就是例子。\n\n它对短波长的光更强：波长减半时，散射强度约变成原来的 16 倍。这能帮助解释白天的蓝天和日落时偏红的太阳。'],
  [explanationQuestion, explanationAnswer],
]);
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
      const prompt = body.messages?.findLast((message) => message.role === 'user' && showcaseAnswers.has(message.content));
      const answer = showcaseAnswers.get(prompt?.content) ?? showcaseAnswers.get(mainQuestion);
      for (let offset = 0; offset < answer.length; offset += 32) {
        if (res.destroyed) return;
        send({ content: answer.slice(offset, offset + 32) });
        await pause(120);
      }
      send({}, 'stop');
      res.write(`data: ${JSON.stringify({ ...base, choices: [], usage: { prompt_tokens: 10, completion_tokens: 16, total_tokens: 26 } })}\n\n`);
      res.end('data: [DONE]\n\n');
      entry.completed = true;
    } catch (error) {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: error.message } }));
    } finally {
      // Keep GUI requests on disk while --serve is running, even if a terminal
      // termination later prevents the process cleanup handler from completing.
      fs.writeFileSync(path.join(temp, 'provider-requests.json'), `${JSON.stringify(requests, null, 2)}\n`);
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
  if (toolbarArchive) {
    const packagePath = path.resolve(toolbarArchive);
    assert.ok(fs.statSync(packagePath).isFile(), `Toolbar package is not a file: ${packagePath}`);
    await childCommand(['plugin', '--profile', 'btw-smoke', 'add', `file:${packagePath.replaceAll('\\', '/')}`, '--offline'], 'toolbar-package-install.log');
    pass('DSH plugin command installed the toolbar release archive in the isolated profile', path.basename(packagePath));
  } else if (withToolbar) {
    const toolbarRoot = path.resolve(process.env.DSH_TOOLBAR_ROOT ?? path.join(project, '../dsh-message-toolbar'));
    assert.ok(fs.existsSync(path.join(toolbarRoot, 'cordis.patch.yml')), `Message toolbar bundle missing: ${toolbarRoot}`);
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
            name: 本地模型
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
    assert.ok(result.includes('太阳光') && result.includes('[DONE]'));
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
    await rpc('session/prompt', { sessionId, requestId: randomUUID(), mode: 'queue', content: [{ type: 'text', text: mainQuestion }] });
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
    assert.equal(turn.answer, showcaseAnswers.get(question));
    const sideRequest = requests.slice(count).find((entry) => entry.accepted && entry.completed);
    assert.ok(sideRequest, 'Side card must reach the actual model adapter and local HTTP provider');
    const sideMessages = sideRequest.messages.map(({ role, content }) => ({ role, content }));
    assert.equal(sideMessages.some(({ content }) => String(content).includes(mainQuestion)), true);
    assert.equal(sideMessages.some(({ content }) => String(content).includes('<system-reminder>')), false);
    pass('side card fake model streaming completed');
    pass('side request contains chat text and excludes host runtime reminders');
    await json('/api/dsh-btw-explore', { action: 'save', sessionId, cardId });
    const followTurnId = `turn-${randomUUID()}`;
    await json('/api/dsh-btw-explore', { action: 'ask', sessionId, cardId, turnId: followTurnId, question: followQuestion });
    const saved = await poll(() => json(query), (value) => value.card?.turns.some((turn) => turn.id === followTurnId && turn.status !== 'running'), 'card follow-up completion');
    assert.equal(saved.card.saved, true);
    assert.equal(saved.card.turns.at(-1).status, 'done');

    const branchId = `card-${randomUUID()}`;
    const branchTurnId = `turn-${randomUUID()}`;
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
    const { call: nativeCall, snapshot: nativeSnapshot } = await nativePrompt(nativeCard.nativeSessionId, firstNativeQuestion);
    assert.ok(JSON.stringify(nativeCall.messages).includes(question));
    assert.ok(!JSON.stringify(nativeCall.messages).includes(followQuestion));
    assert.ok(JSON.stringify(nativeSnapshot).includes(showcaseAnswers.get(firstNativeQuestion).split('\n')[0]));
    pass('native composer RPC uses only the designated source prefix and opens without generating');

    const explainQuote = '蓝光的波长较短';
    const explainSpec = { sessionId, source: { turn: 1, role: 'assistant' }, quote: explainQuote };
    const explanation = await json('/api/dsh-btw-explore', { ...explainSpec, action: 'explain-native', cardId: randomUUID() });
    const explanationAddress = { kind: 'session', sessionId: explanation.nativeSessionId };
    const explainCall = await poll(async () => requests.find((entry) => entry.completed
      && entry.messages?.some((part) => part.role === 'user' && part.content === explanationQuestion)), Boolean, 'automatic explanation provider call');
    assert.ok(JSON.stringify(explainCall.messages).includes(explainQuote));
    const explanationSnapshot = await poll(() => rpc('session/events', { address: explanationAddress, maxMessages: 100 }),
      (value) => JSON.stringify(value).includes(explanationAnswer) && JSON.stringify(value).includes('turn/end'), 'automatic native explanation');
    for (const action of ['open-native', 'explain-native']) {
      assert.deepEqual(await json('/api/dsh-btw-explore', { ...explainSpec, action, cardId: randomUUID() }), explanation);
    }
    const explanationQuery = `/api/dsh-btw-explore?sessionId=${sessionId}&cardId=${explanation.cardId}`;
    assert.equal((await json(explanationQuery)).card.title, explainQuote);
    const board = await json(`/api/dsh-btw-explore?sessionId=${sessionId}&previews=1`);
    assert.equal(board.cards.find((card) => card.id === explanation.cardId)?.source?.quote, explainQuote);
    assert.equal(board.previews[explanation.cardId], explanationAnswer);
    assert.deepEqual(await rpc('session/events', { address: explanationAddress, maxMessages: 100 }), explanationSnapshot);
    pass('Explain sends a real first native turn with the quote; Explore and Explain reuse the same card');

    const childId = `card-${randomUUID()}`;
    const child = await json('/api/dsh-btw-explore', { action: 'open-native', sessionId, cardId: childId,
      relation: 'child', parentId: nativeCardId, source: { turn: 1, role: 'assistant' }, quote });
    const { call: nativeChildCall, snapshot: childSnapshot } = await nativePrompt(child.nativeSessionId, childQuestion);
    const childInput = JSON.stringify(nativeChildCall.messages);
    assert.ok(childInput.includes(firstNativeQuestion) && childInput.includes(quote));
    assert.ok(!childInput.includes(question), 'A native child only sees its anchor, not the inherited prefix');
    assert.ok(JSON.stringify(childSnapshot).includes(showcaseAnswers.get(childQuestion).split('\n')[0]));
    pass('native card can spawn a quoted child with only the anchor context');
    let selectedVersion;
    if (withToolbar) {
      const editedCardId = `card-${randomUUID()}`;
      const editable = await json('/api/dsh-btw-explore', { action: 'open-native', sessionId, cardId: editedCardId,
        relation: 'root', source: { turn: 1, role: 'assistant' }, quote: '蓝光的波长较短' });
      await nativePrompt(editable.nativeSessionId, '编辑联动验证：解释蓝光的散射。');
      const marker = 'HOST_EDIT_034：编辑后的回答已经保存。';
      const edited = await json('/message-toolbar', { action: 'context-branch', sessionId: editable.nativeSessionId,
        turn: 1, operation: 'edit-answer', text: marker });
      const rebound = await json('/api/dsh-btw-explore', { action: 'select-native-version', sessionId, cardId: editedCardId,
        fromSessionId: editable.nativeSessionId, toSessionId: edited.sessionId });
      assert.equal(rebound.nativeSessionId, edited.sessionId);
      await json('/message-toolbar', { action: 'focus', sessionId: edited.sessionId, token: edited.navigationToken });
      const { call: editedFollow } = await nativePrompt(edited.sessionId, '编辑后的补充记录是什么？');
      assert.ok(JSON.stringify(editedFollow.messages).includes(marker), 'Follow-up must use the saved answer');
      assert.ok(JSON.stringify(editedFollow.messages).includes('蓝光的波长较短'), 'Edited version must retain the original source snapshot');
      pass('toolbar edit binds the same native card and its real follow-up includes both the edit and source');

      const retryQuestion = '重新生成验证：继续解释短波长的散射。';
      const retryStart = requests.length;
      const retried = await json('/message-toolbar', { action: 'context-branch', sessionId: edited.sessionId,
        turn: 2, operation: 'retry', text: retryQuestion });
      const retryCall = await poll(async () => requests.slice(retryStart).find((entry) => entry.completed
        && entry.messages?.some((part) => String(part.content).includes(retryQuestion))), Boolean, 'native toolbar regeneration');
      assert.ok(JSON.stringify(retryCall.messages).includes('蓝光的波长较短'), 'A regeneration must receive its source before the client rebinds');
      await json('/api/dsh-btw-explore', { action: 'select-native-version', sessionId, cardId: editedCardId,
        fromSessionId: edited.sessionId, toSessionId: retried.sessionId });
      await json('/message-toolbar', { action: 'focus', sessionId: retried.sessionId, token: retried.navigationToken });
      pass('toolbar regeneration first request keeps the source before navigation completes');
      selectedVersion = { cardId: editedCardId, originalSessionId: editable.nativeSessionId,
        editedSessionId: edited.sessionId, nativeSessionId: retried.sessionId, marker };
      evidence.nativeVersion = selectedVersion;
    }
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
    assert.deepEqual(await json('/api/dsh-btw-explore', { ...explainSpec, action: 'explain-native', cardId: randomUUID() }), explanation);
    assert.deepEqual(await rpc('session/events', { address: explanationAddress, maxMessages: 100 }), explanationSnapshot);
    pass('reopening an explained quote after restart does not send again');
    assert.deepEqual(await rpc('session/events', { address, maxMessages: 100 }), before);
    pass('main native history unchanged after restart');
    if (selectedVersion) {
      const restoredVersion = await json(`/api/dsh-btw-explore?sessionId=${sessionId}&cardId=${selectedVersion.cardId}`);
      assert.equal(restoredVersion.card.nativeSessionId, selectedVersion.nativeSessionId);
      const { call } = await nativePrompt(selectedVersion.nativeSessionId, '重启后再继续解释这段引用。');
      assert.ok(JSON.stringify(call.messages).includes('蓝光的波长较短'));
      assert.ok(JSON.stringify(call.messages).includes(selectedVersion.marker));
      assert.deepEqual(await rpc('session/events', { address, maxMessages: 100 }), before);
      pass('selected native version and its source context survive host restart without changing main history');
    }
    evidence.cardId = cardId;
    if (serve) {
      console.log(`Browser verification URL: ${authenticatedUrl}`);
      console.log(`Main native session: ${sessionId}`);
      console.log(`Saved side card: ${cardId}`);
      console.log('Only isolated test services remain running. Press Enter to finish verification and clean up; Ctrl+C also stops them.');
      fs.writeFileSync(path.join(temp, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
      process.stdin.resume();
      await once(process.stdin, 'data');
      process.stdin.pause();
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
