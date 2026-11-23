const exploreSidebarArea = '[data-sidebar-list-area]';
const exploreSidebarGroup = '[data-btw-sidebar-group]';
const exploreSidebarSuppressed = 'data-btw-sidebar-suppressed';
const exploreSidebarRefresh = 'dsh-btw-explore:sidebar-refresh';

function exploreSidebarProjection(list, workspaces, owned, view) {
  const sessions = [];
  if (view.groupBy === 'flat' || view.archivedFilter === 'only') return { sessions, hideUngrouped: false };
  const archived = new Set(workspaces.archivedSessionIds);
  const assigned = new Set(workspaces.items.flatMap((item) => item.sessionIds));
  let ordinaryUngrouped = false;
  for (const id of list.ids) {
    const session = list.byId[id];
    const current = (session?.retainedBy?.mainView ?? 0) > 0;
    if (!session || session.origin === 'subagent' || (session.blank && !current)) continue;
    const isArchived = archived.has(id);
    if (isArchived && view.archivedFilter !== 'show') continue;
    // Archived rows stay in DSH's list, where Restore remains available.
    if (owned.has(id) && !isArchived) sessions.push(session);
    else if (!assigned.has(id)) ordinaryUngrouped = true;
  }
  sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  return { sessions, hideUngrouped: !ordinaryUngrouped && sessions.length > 0 };
}

function markExploreSidebarRows(tree, projection) {
  const keys = new Set(projection.sessions.map(({ id }) => `session:${id}`));
  const marked = new Set();
  const looseHeader = tree.querySelector('[data-row-key="workspace:"]');
  const looseGroup = looseHeader?.parentElement;
  const hideGroup = projection.hideUngrouped && looseGroup && looseGroup !== tree;
  if (hideGroup) marked.add(looseGroup);
  for (const row of tree.querySelectorAll('[data-row-key^="session:"]')) {
    if (keys.has(row.dataset.rowKey) && !(hideGroup && looseGroup.contains(row))) marked.add(row);
  }
  for (const element of marked) element.setAttribute(exploreSidebarSuppressed, '');
  return () => { for (const element of marked) element.removeAttribute(exploreSidebarSuppressed); };
}

function findExploreSidebarTree() {
  for (const area of document.querySelectorAll(exploreSidebarArea)) {
    const tree = area.querySelector('[role="tree"]');
    if (tree?.querySelector('[data-row-key^="workspace:"]')) return tree;
  }
  return null;
}

function exploreWorkspaceView() {
  try { return JSON.parse(window.localStorage.getItem('dsh.workspace.view.v5')) ?? {}; }
  catch { return {}; }
}

function useExploreSidebarSnapshot(source) {
  const subscribe = React.useCallback((listener) => source.subscribe(listener), [source]);
  const snapshot = React.useCallback(() => source.getSnapshot(), [source]);
  return React.useSyncExternalStore(subscribe, snapshot);
}

function useExploreSidebarOwnership(ids) {
  const signature = JSON.stringify([...ids].sort());
  const [owned, setOwned] = React.useState(null);
  React.useEffect(() => {
    let live = true;
    let request;
    let poll;
    function refresh() {
      clearTimeout(poll);
      request?.abort();
      request = new AbortController();
      const { signal } = request;
      fetch(`${EXPLORE_PATH}?sidebar=1`, { credentials: 'same-origin', cache: 'no-store', signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Explore group unavailable');
          const { sessionIds } = await response.json();
          if (!Array.isArray(sessionIds) || sessionIds.some((id) => typeof id !== 'string')) throw new Error('Invalid Explore group');
          if (!live || signal.aborted) return;
          setOwned((previous) => previous?.size === sessionIds.length && sessionIds.every((id) => previous.has(id))
            ? previous : new Set(sessionIds));
        }).catch(() => { if (live && !signal.aborted) setOwned(null); })
        .finally(() => { if (live && !signal.aborted && !document.hidden) poll = setTimeout(refresh, 30000); });
    }
    const onVisible = () => { if (!document.hidden) refresh(); };
    window.addEventListener(exploreSidebarRefresh, refresh);
    document.addEventListener('visibilitychange', onVisible);
    refresh();
    return () => {
      live = false;
      request?.abort();
      clearTimeout(poll);
      window.removeEventListener(exploreSidebarRefresh, refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signature]);
  return owned;
}

function ExploreSidebarSection({ sessionList, workspaceList, openSession, FolderIcon, ChevronIcon }) {
  const list = useExploreSidebarSnapshot(sessionList);
  const workspaces = useExploreSidebarSnapshot(workspaceList);
  const owned = useExploreSidebarOwnership(list.ids);
  const [tree, setTree] = React.useState(null);
  const [viewKey, setViewKey] = React.useState('');
  const [expanded, setExpanded] = React.useState(false);
  const groupId = React.useId();
  const projection = React.useMemo(() => {
    const [groupBy, archivedFilter] = viewKey.split('/');
    return owned && exploreSidebarProjection(list, workspaces, owned, { groupBy, archivedFilter });
  }, [list, workspaces, owned, viewKey]);
  const active = Boolean(tree && projection?.sessions.length);

  React.useLayoutEffect(() => {
    let restore = () => {};
    const reconcile = () => {
      restore();
      restore = () => {};
      const nextTree = findExploreSidebarTree();
      setTree(nextTree);
      const { groupBy, archivedFilter } = exploreWorkspaceView();
      const key = `${groupBy ?? ''}/${archivedFilter ?? ''}`;
      setViewKey(key);
      // Never suppress original rows before their replacement is mounted.
      if (active && nextTree === tree && key === viewKey && tree.querySelector(exploreSidebarGroup)) {
        restore = markExploreSidebarRows(tree, projection);
      }
    };
    const observer = new MutationObserver((records) => {
      if (records.some(({ target, addedNodes, removedNodes }) => {
        if (target.nodeType !== 1 || target.closest(exploreSidebarGroup)) return false;
        if (target.closest(exploreSidebarArea)) return true;
        return [...addedNodes, ...removedNodes].some((node) => node.nodeType === 1
          && (node.matches(exploreSidebarArea) || node.querySelector(exploreSidebarArea)));
      })) reconcile();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', reconcile);
    reconcile();
    return () => { observer.disconnect(); window.removeEventListener('storage', reconcile); restore(); };
  }, [active, tree, projection, viewKey]);

  if (!active) return null;
  return explorerPortal(h('div', { 'data-btw-sidebar-group': '' },
    h('div', { role: 'treeitem', 'aria-expanded': expanded, 'aria-labelledby': `${groupId}-title` },
      h('button', { type: 'button', className: 'dsh-btw-sidebar-heading', 'aria-expanded': expanded,
        'aria-controls': groupId, onClick: () => setExpanded((open) => !open) },
      h('span', { className: 'dsh-btw-sidebar-group-icon', 'aria-hidden': true },
        FolderIcon && h(FolderIcon, { size: 16 }), ChevronIcon && h(ChevronIcon, { size: 16 })),
      h('span', { id: `${groupId}-title`, className: 'dsh-btw-sidebar-title' }, '旁路问答')),
      h('div', { id: groupId, role: 'group', hidden: !expanded }, expanded && projection.sessions.map((session) => {
        const selected = (session.retainedBy?.mainView ?? 0) > 0;
        const title = session.title?.trim() || '未命名对话';
        return h('div', { key: session.id, role: 'treeitem', 'aria-selected': selected },
          h('button', { type: 'button', className: 'dsh-btw-sidebar-session', title, onClick: () => openSession(session.id) },
            h('span', { className: 'dsh-btw-sidebar-title' }, title)));
      })))), tree);
}

function registerExploreSidebar(slots, ctx) {
  const sessionList = sessionsService.list;
  const workspaceList = ctx.get('workspaces')?.list;
  const workspace = ctx.get('uiWorkspace');
  if (!explorerPortal || !sessionList?.getSnapshot || !workspaceList?.getSnapshot || typeof workspace?.openSession !== 'function') return;
  let icons;
  try { icons = require('@deepseek-ai/dsh-client-ui-primitives'); } catch {}
  slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: `${EXPLORE_VIEW}/sidebar`,
    inject: () => ({ sessionList, workspaceList, openSession: (id) => workspace.openSession(id),
      FolderIcon: icons?.IconFolderCloseRegular, ChevronIcon: icons?.IconTriangleRightFillRegular }) }, ExploreSidebarSection));
}
