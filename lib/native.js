import { ExploreError } from './store.js';

export const NATIVE_SESSION_PREFIX = 'session-btw-explore-';

// Use the same creation and preset path as DSH's new-chat button.
export async function prepareNativeSession(ctx, card, workspace) {
  const sessionId = card.nativeSessionId;
  let agent = ctx.agents.get(sessionId);
  if (!agent) {
    const created = await ctx.sessionController.create({ sessionId, cwd: workspace.cwd, agentPreset: workspace.preset });
    if (created.sessionId !== sessionId) throw new ExploreError('DSH 无法恢复这张卡片的原生会话。');
    agent = ctx.agents.get(sessionId);
  }
  if (!agent) throw new ExploreError('原生会话尚未就绪，请重试。', 503);

  const selected = agent.model.current();
  if (workspace.model?.provider && workspace.model?.model
    && (selected?.provider !== workspace.model.provider || selected?.model !== workspace.model.model || selected?.reasoningEffort !== workspace.model.reasoningEffort)
    && !agent.session.snapshotEvents().some((event) => event.type === 'turn/start')) {
    agent.model.select(workspace.model);
  }
}
