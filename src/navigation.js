const EXPLORE_NODE_STEP = 36;

function exploreNodeLayout(cards) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const children = new Map();
  for (const card of cards) {
    const parent = byId.has(card.parentId) ? card.parentId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(card);
  }
  const nodes = [];
  const visited = new Set();
  let lane = 0;
  let height = 0;
  function place(card, depth, parent) {
    const node = { card, depth, parent };
    nodes.push(node);
    height = Math.max(height, depth + 1);
    if (card) visited.add(card.id);
    const branches = (children.get(card?.id ?? null) ?? []).filter((item) => !visited.has(item.id));
    const firstLane = lane;
    for (const branch of branches) if (!visited.has(branch.id)) place(branch, depth + 1, node);
    if (firstLane === lane) lane += 1;
    node.x = ((firstLane + lane) / 2) * EXPLORE_NODE_STEP;
    node.y = (depth + 0.5) * EXPLORE_NODE_STEP;
  }
  place(null, 0, null);
  return { nodes, byId, width: lane * EXPLORE_NODE_STEP, height: height * EXPLORE_NODE_STEP };
}

function ExploreNavigation({ cards, activeId, onNavigate, returnLabel }) {
  const { nodes, byId, width, height } = React.useMemo(() => exploreNodeLayout(cards), [cards]);
  const viewport = React.useRef(null);
  const currentNode = nodes.find(({ card }) => (card?.id ?? null) === activeId);
  const { x: activeX, y: activeY } = currentNode ?? {};
  React.useLayoutEffect(() => {
    const area = viewport.current;
    if (!area || activeX === undefined) return;
    function keepCurrentInView() {
      area.scrollLeft = Math.max(0, activeX - area.clientWidth / 2);
      area.scrollTop = Math.max(0, activeY - area.clientHeight / 2);
    }
    keepCurrentInView();
    window.addEventListener('resize', keepCurrentInView);
    return () => window.removeEventListener('resize', keepCurrentInView);
  }, [activeId, activeX, activeY, width, height]);
  if (!cards.length) return null;
  const activePath = new Set();
  for (let node = currentNode; node; node = node.parent) activePath.add(node);

  return h('nav', { className: 'dsh-btw-map', 'aria-label': '探索卡片关系导航' },
    h('div', { className: 'dsh-btw-map-viewport', ref: viewport },
      h('div', { className: 'dsh-btw-map-graph', style: { width, height } },
        nodes.filter((node) => node.parent).map((node) => {
          const dx = node.x - node.parent.x;
          const dy = node.y - node.parent.y;
          return h('span', { key: node.card.id, className: 'dsh-btw-map-edge', 'aria-hidden': true,
            'data-btw-on-path': activePath.has(node) || undefined,
            style: { left: node.parent.x, top: node.parent.y, width: Math.hypot(dx, dy), transform: `rotate(${Math.atan2(dy, dx)}rad)` },
          });
        }),
        nodes.map((node) => {
          const name = node.card ? exploreTitle(node.card) : returnLabel;
          return h('button', { key: node.card?.id ?? 'home', type: 'button', className: 'dsh-btw-map-node',
            style: { left: node.x, top: node.y }, title: name, 'aria-label': `卡片节点 · ${name}`,
            'aria-current': node === currentNode ? 'page' : undefined,
            'data-btw-relation': node.card?.relation ?? 'home',
            onClick: (event) => {
              event.currentTarget.focus({ preventScroll: true });
              onNavigate(exploreTrail(node.card, byId));
            },
          }, h('span', { 'aria-hidden': true }));
        }),
      ),
    ),
  );
}
