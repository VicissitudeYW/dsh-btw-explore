const EXPLORE_NODE_STEP = 36;
const EXPLORE_MAP_WIDTH = 54;

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
  function place(card, depth, parent) {
    const node = { card, depth, parent,
      x: 18 + Math.min(depth, 2) * 9,
      y: (nodes.length + 0.5) * EXPLORE_NODE_STEP,
    };
    nodes.push(node);
    if (card) visited.add(card.id);
    const branches = (children.get(card?.id ?? null) ?? []).filter((item) => !visited.has(item.id));
    for (const branch of branches) if (!visited.has(branch.id)) place(branch, depth + 1, node);
  }
  place(null, 0, null);
  return { nodes, byId, width: EXPLORE_MAP_WIDTH, height: nodes.length * EXPLORE_NODE_STEP };
}

function ExploreNavigation({ cards, activeId, onNavigate, returnLabel }) {
  const { nodes, byId, width, height } = React.useMemo(() => exploreNodeLayout(cards), [cards]);
  const viewport = React.useRef(null);
  const [hovered, setHovered] = React.useState(null);
  const [focused, setFocused] = React.useState(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const hintId = React.useId();
  const currentNode = nodes.find(({ card }) => (card?.id ?? null) === activeId);
  const activeY = currentNode?.y;
  React.useLayoutEffect(() => {
    const area = viewport.current;
    if (!area || activeY === undefined) return;
    function keepCurrentInView() {
      area.scrollTop = Math.max(0, activeY - area.clientHeight / 2);
      setScrollTop(area.scrollTop);
    }
    keepCurrentInView();
    window.addEventListener('resize', keepCurrentInView);
    return () => window.removeEventListener('resize', keepCurrentInView);
  }, [activeId, activeY, height]);
  if (!cards.length) return null;
  const activePath = new Set();
  for (let node = currentNode; node; node = node.parent) activePath.add(node);
  const keyFor = (node) => node.card?.id ?? 'home';
  const hintNode = nodes.find((node) => keyFor(node) === (hovered ?? focused));
  const hintY = hintNode ? hintNode.y - scrollTop : 0;
  const hintVisible = hintNode && hintY >= 0 && hintY <= (viewport.current?.clientHeight || height);

  function moveFocus(event, index) {
    const target = event.key === 'ArrowDown' ? Math.min(nodes.length - 1, index + 1)
      : event.key === 'ArrowUp' ? Math.max(0, index - 1)
        : event.key === 'Home' ? 0 : event.key === 'End' ? nodes.length - 1 : null;
    if (target === null) return;
    event.preventDefault();
    setHovered(null);
    const buttons = event.currentTarget.parentElement.querySelectorAll('.dsh-btw-map-node');
    buttons[target]?.focus({ preventScroll: true });
    const area = viewport.current;
    const y = nodes[target].y;
    if (area && (y < area.scrollTop + 18 || y > area.scrollTop + area.clientHeight - 18)) {
      area.scrollTop = Math.max(0, y - area.clientHeight / 2);
      setScrollTop(area.scrollTop);
    }
  }

  return h('nav', { className: 'dsh-btw-map', 'aria-label': '探索卡片关系导航' },
    h('div', { className: 'dsh-btw-map-viewport', ref: viewport,
      onScroll: (event) => setScrollTop(event.currentTarget.scrollTop) },
      h('div', { className: 'dsh-btw-map-graph', style: { width, height } },
        h('svg', { className: 'dsh-btw-map-lines', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': true },
          nodes.filter((node) => node.parent).map((node) => {
            const radius = Math.min(4, node.x - node.parent.x);
            const path = radius ? `M ${node.parent.x} ${node.parent.y} V ${node.y - radius} Q ${node.parent.x} ${node.y} ${node.parent.x + radius} ${node.y} H ${node.x}`
              : `M ${node.x} ${node.parent.y} V ${node.y}`;
            return h('path', { key: node.card.id, d: path, 'data-btw-on-path': activePath.has(node) || undefined });
          }),
        ),
        currentNode && h('span', { className: 'dsh-btw-map-current', 'aria-hidden': true,
          style: { transform: `translate(${currentNode.x}px, ${currentNode.y}px)` } }),
        nodes.map((node, index) => {
          const name = node.card ? exploreTitle(node.card) : returnLabel;
          const key = keyFor(node);
          return h('button', { key, type: 'button', className: 'dsh-btw-map-node',
            style: { left: node.x, top: node.y }, 'aria-label': `卡片节点 · ${name}`,
            'aria-describedby': hintVisible && hintNode === node ? hintId : undefined,
            'aria-current': node === currentNode ? 'page' : undefined,
            'data-btw-relation': node.card?.relation ?? 'home',
            'data-btw-on-path': activePath.has(node) || undefined,
            onPointerEnter: (event) => { if (event.pointerType !== 'touch') setHovered(key); },
            onPointerLeave: () => setHovered(null),
            onFocus: () => setFocused(key),
            onBlur: () => setFocused(null),
            onKeyDown: (event) => moveFocus(event, index),
            onClick: (event) => {
              event.currentTarget.focus({ preventScroll: true });
              onNavigate(exploreTrail(node.card, byId));
            },
          }, h('span', { className: 'dsh-btw-map-halo', 'aria-hidden': true }),
          h('span', { className: 'dsh-btw-map-dot', 'aria-hidden': true }));
        }),
      ),
    ),
    hintVisible && h('div', { id: hintId, role: 'tooltip', className: 'dsh-btw-map-hint',
      style: { top: hintY } },
      h('span', { className: 'dsh-btw-map-hint-kind' }, hintNode.card ? EXPLORE_RELATIONS[hintNode.card.relation] : '返回'),
      h('span', { className: 'dsh-btw-map-hint-title' }, hintNode.card ? exploreTitle(hintNode.card) : returnLabel),
    ),
  );
}
