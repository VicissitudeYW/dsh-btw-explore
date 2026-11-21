const EXPLORE_NATIVE_FACTORY = 'dsh-btw-explore/native';
const EXPLORE_NATIVE_CONTENT = 'dsh-btw-explore.native.content';
const ExploreCardContext = React.createContext(null);

function ExploreFixedChat({ renderSlot }) {
  return renderSlot('conversation.session', { view: 'chat' });
}

function ExploreNativeContent({ renderFactorySlot }) {
  return renderFactorySlot('conversation.content', { variant: 'embedded', phase: 'active', hero: false }, {
    slots: { views: ExploreFixedChat },
  });
}

function ExploreNativeMount({ ownerSessionId, cardId, nativeSessionId, SessionProvider, renderSlot }) {
  const [reference, setReference] = React.useState(null);
  const [error, setError] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    const controller = new AbortController();
    let retained;
    setReference(null);
    setError(false);
    const retain = () => sessionsService.retain(nativeSessionId, { source: 'btwExplore', signal: controller.signal });
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
        setReference(retained);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void open();
    return () => { controller.abort(); retained?.release(); };
  }, [nativeSessionId, revision]);

  if (error) return h('div', { className: 'dsh-btw-banner dsh-btw-error', role: 'alert' },
    '无法打开对话，请重试。', exploreButton('重试', { onClick: () => setRevision((value) => value + 1) }));
  if (!reference) return h('p', { className: 'dsh-btw-native-status', role: 'status' }, '正在打开对话…');
  return h('div', { className: 'dsh-btw-native', 'data-btw-native-card': cardId, 'data-btw-root-session': ownerSessionId },
    h(ExploreCardContext.Provider, { value: { ownerSessionId, cardId } },
      h(SessionProvider, { session: reference }, renderSlot(EXPLORE_NATIVE_CONTENT, {}))),
  );
}

function registerExploreNative(slots) {
  slots.registerFactory({ name: EXPLORE_NATIVE_FACTORY, scope: 'session',
    children: { [EXPLORE_NATIVE_CONTENT]: { kind: 'single', scope: 'session' } },
  }, ExploreNativeMount);
  slots.inject(EXPLORE_NATIVE_CONTENT, () => slots.register({ name: EXPLORE_NATIVE_CONTENT }, ExploreNativeContent));
}
