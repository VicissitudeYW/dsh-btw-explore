import { ExploreError } from './store.js';

export const NATIVE_SESSION_PREFIX = 'session-btw-explore-';

// Use the same creation and preset path as DSH's new-chat button.
export async function prepareNativeSession(ctx, card, workspace) {
  const sessionId = card.nativeSessionId;
  let agent = ctx.agents.get(sessionId);
  if (!agent && typeof ctx.sessionController.resolveAgent === 'function') {
    // DSH's create() may mint a different session when a named conversation is
    // nonblank or owned elsewhere. Resolve the reserved identity first so a
    // recoverable reservation never produces an unrelated empty conversation.
    let resolved;
    try { resolved = await ctx.sessionController.resolveAgent(sessionId); }
    catch { throw new ExploreError('暂时无法恢复这张卡片的对话，请稍后重试。', 503); }
    if (resolved?.agent) {
      if (resolved.agent.id !== sessionId || resolved.agent.session?.id !== sessionId) {
        throw new ExploreError('恢复的对话与卡片不一致，请重新打开。');
      }
      agent = resolved.agent;
    } else if (resolved?.error?.code !== 'session/not-found') {
      const busy = ['session/writer-held', 'session/agent-busy'].includes(resolved?.error?.code);
      throw new ExploreError(busy ? '这张卡片的对话正在其他窗口使用，请稍后重试。'
        : '暂时无法恢复这张卡片的对话，请稍后重试。', busy ? 409 : 503);
    }
  }
  if (!agent) {
    const created = await ctx.sessionController.create({ sessionId, cwd: workspace.cwd, agentPreset: workspace.preset });
    if (created.sessionId !== sessionId) throw new ExploreError('无法恢复这张卡片的对话，请重新打开。');
    agent = ctx.agents.get(sessionId);
  }
  if (!agent) throw new ExploreError('对话尚未准备好，请重试。', 503);

  const selected = agent.model.current();
  if (workspace.model?.provider && workspace.model?.model
    && (selected?.provider !== workspace.model.provider || selected?.model !== workspace.model.model || selected?.reasoningEffort !== workspace.model.reasoningEffort)
    && !agent.session.snapshotEvents().some((event) => event.type === 'turn/start')) {
    agent.model.select(workspace.model);
  }
}
