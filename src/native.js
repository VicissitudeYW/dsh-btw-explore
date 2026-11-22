const EXPLORE_NATIVE_FACTORY = 'dsh-btw-explore/native';
const EXPLORE_NATIVE_CONTENT = 'dsh-btw-explore.native.content';

async function explainWithNativeSession(nativeSessionId, signal) {
  const retain = () => sessionsService.retain(nativeSessionId, { source: 'btwExplore', signal });
  let retained;
  try {
    try { retained = retain(); }
    catch {
      signal?.throwIfAborted();
      await sessionsService.refresh();
      retained = retain();
    }
    const { session } = await retained.ready;
    signal?.throwIfAborted();
    const state = session.getSnapshot();
    if (session.sessionId !== nativeSessionId || state.openState !== 'open' || state.removed) {
      throw new Error('无法打开子卡的对话，请重试。');
    }
    if (state.blank !== true || state.running || state.awaitingFirstTurn || state.pendingSubmissions?.length) return;
    // Same host receipt as the current backend, even across renderer and host upgrades.
    const result = await session.prompt([{ type: 'text', text: EXPLORE_EXPLANATION_QUESTION }], 'queue', signal,
      `btw-explore:explain:${nativeSessionId}`);
    if (!result?.ok) throw new Error('暂时无法发起解释，请重试。');
  } finally { retained?.release(); }
}

function ExploreFixedChat({ renderSlot }) {
  return renderSlot('conversation.session', { view: 'chat' });
}

function ExploreNativeContent({ renderFactorySlot }) {
  return renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false }, {
    slots: { views: ExploreFixedChat },
  });
}

function ExploreNativeMount({ ownerSessionId, cardId, nativeSessionId, SessionProvider, renderSlot }) {
  const frame = React.useRef(null);
  const selected = React.useRef(nativeSessionId);
  const navigation = React.useRef(null);
  const mounted = React.useRef(false);
  const [selectedSessionId, setSelectedSessionId] = React.useState(nativeSessionId);
  const [reference, setReference] = React.useState(null);
  const [error, setError] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  const navigationError = () => new Error('卡片已关闭或切换，请重新打开后查看这个版本。');
  const interactive = () => {
    const element = frame.current;
    const page = element?.closest('.dsh-btw-page');
    return mounted.current && element?.isConnected && page?.hasAttribute('data-btw-top')
      && !page.hasAttribute('data-btw-leaving') && !element.closest('[inert], [aria-hidden="true"]');
  };
  function rejectNavigation(job, error) {
    if (navigation.current === job) navigation.current = null;
    job?.reject(error);
  }
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (navigation.current) rejectNavigation(navigation.current, navigationError());
    };
  }, [ownerSessionId, cardId]);
  React.useEffect(() => {
    if (selected.current === nativeSessionId) return;
    if (navigation.current && navigation.current.target !== nativeSessionId) rejectNavigation(navigation.current, navigationError());
    selected.current = nativeSessionId;
    setSelectedSessionId(nativeSessionId);
  }, [nativeSessionId]);
  React.useEffect(() => {
    const onVersion = (event) => {
      const detail = event.detail;
      if (detail?.version !== 1 || detail.sourceSessionId !== selected.current || !interactive()
        || typeof detail.targetSessionId !== 'string' || typeof detail.claim !== 'function') return;
      const source = selected.current;
      const target = detail.targetSessionId;
      detail.claim(() => {
        if (!interactive() || selected.current !== source) return Promise.reject(navigationError());
        if (navigation.current) return Promise.reject(new Error('正在切换回答，请稍后重试。'));
        return new Promise((resolve, reject) => {
          const job = { source, target, resolve, reject };
          navigation.current = job;
          void (async () => {
            const result = await explorerRequest(ownerSessionId, { action: 'select-native-version',
              body: { cardId, fromSessionId: source, toSessionId: target } });
            if (result.cardId !== cardId || result.nativeSessionId !== target) throw new Error('无法确认卡片的对话版本，请重新打开。');
            // A completed save is durable even if its card was closed while
            // waiting. Other views must refresh, but no late result may reopen it.
            for (const update of exploreChangeListeners.get(ownerSessionId) ?? []) update();
            if (navigation.current !== job || !interactive() || selected.current !== source) throw navigationError();
            selected.current = target;
            setSelectedSessionId(target);
          })().catch((error) => rejectNavigation(job, error));
        });
      });
    };
    window.addEventListener('dsh-message-toolbar:open-version', onVersion);
    return () => window.removeEventListener('dsh-message-toolbar:open-version', onVersion);
  }, [ownerSessionId, cardId]);

  React.useEffect(() => {
    const controller = new AbortController();
    let retained;
    setReference(null);
    setError(false);
    const retain = () => sessionsService.retain(selectedSessionId, { source: 'btwExplore', signal: controller.signal });
    async function open() {
      try {
        try { retained = retain(); }
        catch {
          await sessionsService.refresh();
          if (controller.signal.aborted) return;
          retained = retain();
        }
        const binding = await retained.ready;
        if (controller.signal.aborted) return;
        if (binding.session.getSnapshot().openState === 'error') throw new Error('DSH session open failed');
        if (navigation.current?.target === selectedSessionId && !interactive()) throw navigationError();
        setReference({ id: selectedSessionId, retained });
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          if (navigation.current?.target === selectedSessionId) rejectNavigation(navigation.current, new Error('无法打开这个对话版本，请重试。'));
        }
      }
    }
    void open();
    return () => { controller.abort(); retained?.release(); };
  }, [selectedSessionId, revision]);
  React.useEffect(() => {
    const job = navigation.current;
    if (job && reference?.id === job.target) {
      if (!interactive()) { rejectNavigation(job, navigationError()); return; }
      navigation.current = null;
      job.resolve();
    }
  }, [reference]);

  return h('div', { ref: frame, className: 'dsh-btw-native', 'data-btw-native-card': cardId, 'data-btw-root-session': ownerSessionId },
    error ? h('div', { className: 'dsh-btw-banner dsh-btw-error', role: 'alert' },
      '无法打开对话，请重试。', exploreButton('重试', { onClick: () => setRevision((value) => value + 1) }))
      : reference?.id === selectedSessionId ? h(SessionProvider, { session: reference.retained }, renderSlot(EXPLORE_NATIVE_CONTENT, {}))
        : h('p', { className: 'dsh-btw-native-status', role: 'status' }, '正在打开对话…'),
  );
}

function registerExploreNative(slots) {
  slots.registerFactory({ name: EXPLORE_NATIVE_FACTORY, scope: 'session',
    children: { [EXPLORE_NATIVE_CONTENT]: { kind: 'single', scope: 'session' } },
  }, ExploreNativeMount);
  slots.inject(EXPLORE_NATIVE_CONTENT, () => slots.register({ name: EXPLORE_NATIVE_CONTENT }, ExploreNativeContent));
}
