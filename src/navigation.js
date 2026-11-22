const EXPLORE_NODE_STEP = 38;
const EXPLORE_LAYER_STEP = 72;
const EXPLORE_MAP_PADDING = 24;
const EXPLORE_MAP_X_MARGIN = 18 + 10; // Node hit radius plus the horizontal fade.
const EXPLORE_MAP_Y_MARGIN = 18 + 20;

function exploreNodeLayout(cards) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const home = { card: null, depth: 0, parent: null };
  const nodes = [home, ...[...byId.values()].map((card) => ({ card, parent: null, depth: 0 }))];
  const nodeById = new Map(nodes.slice(1).map((node) => [node.card.id, node]));
  const resolved = new Set();
  const visiting = new Set();
  function resolve(node) {
    if (resolved.has(node)) return node;
    if (visiting.has(node)) return home;
    visiting.add(node);
    const source = nodeById.get(node.card.parentId);
    node.parent = source ? resolve(source) : home;
    node.depth = node.parent.depth + (node.card.relation === 'branch' && node.parent.card ? 0 : 1);
    visiting.delete(node);
    resolved.add(node);
    return node;
  }
  for (const node of nodes.slice(1)) resolve(node);

  const rows = new Map();
  const branches = new Map();
  for (const node of nodes) {
    if (!rows.has(node.depth)) rows.set(node.depth, []);
    if (node.parent?.depth === node.depth) {
      if (!branches.has(node.parent)) branches.set(node.parent, []);
      branches.get(node.parent).push(node);
    }
  }
  function append(node) {
    for (const branch of branches.get(node) ?? []) append(branch);
    rows.get(node.depth).push(node);
  }
  const depth = Math.max(...rows.keys());
  for (let level = 0; level <= depth; level += 1) {
    const parentOrder = new Map((rows.get(level - 1) ?? []).map((node, index) => [node, index]));
    const starts = nodes.filter((node) => node.depth === level && node.parent?.depth !== level);
    starts.sort((a, b) => (parentOrder.get(a.parent) ?? 0) - (parentOrder.get(b.parent) ?? 0));
    for (const node of starts) append(node);
  }
  const width = EXPLORE_MAP_PADDING * 2 + (Math.max(...[...rows.values()].map((row) => row.length)) - 1) * EXPLORE_NODE_STEP;
  const height = EXPLORE_MAP_PADDING * 2 + depth * EXPLORE_LAYER_STEP;
  for (const [level, row] of rows) {
    row.forEach((node, index) => {
      node.x = (width - (row.length - 1) * EXPLORE_NODE_STEP) / 2 + index * EXPLORE_NODE_STEP;
      node.y = EXPLORE_MAP_PADDING + level * EXPLORE_LAYER_STEP;
    });
  }
  const fitWidth = width + 2 * (EXPLORE_MAP_X_MARGIN - EXPLORE_MAP_PADDING);
  return { nodes, byId, width, height, fitWidth };
}

function exploreEdge(node) {
  const source = node.parent;
  const radius = source.card ? 12 : 14;
  if (node.depth !== source.depth) {
    const fromY = source.y + radius;
    const toY = node.y - 12;
    const middle = (fromY + toY) / 2;
    return { x1: source.x, y1: fromY, x2: node.x, y2: toY,
      d: `M ${source.x} ${fromY} C ${source.x} ${middle} ${node.x} ${middle} ${node.x} ${toY}` };
  }
  const direction = Math.sign(node.x - source.x);
  const fromX = source.x + direction * radius;
  const toX = node.x - direction * 12;
  const distance = Math.abs(node.x - source.x);
  if (distance > EXPLORE_NODE_STEP) {
    const fromY = source.y - radius;
    const toY = node.y - 12;
    const lane = source.y - 28;
    const shoulder = direction * 24;
    return { x1: source.x, y1: fromY, x2: node.x, y2: toY,
      d: `M ${source.x} ${fromY} C ${source.x} ${lane} ${source.x + shoulder / 2} ${lane} ${source.x + shoulder} ${lane}`
        + ` C ${source.x + shoulder} ${lane} ${node.x - shoulder} ${lane} ${node.x - shoulder} ${lane}`
        + ` C ${node.x - shoulder / 2} ${lane} ${node.x} ${lane} ${node.x} ${toY}` };
  }
  return { x1: fromX, y1: source.y, x2: toX, y2: node.y,
    d: `M ${fromX} ${source.y} C ${fromX + direction * 6} ${source.y} ${toX - direction * 6} ${node.y} ${toX} ${node.y}` };
}

function ExploreNavigation({ graph, activeId, onNavigate, returnLabel }) {
  const { nodes, byId, width, height, fitWidth } = graph;
  const hasCards = nodes.length > 1;
  const viewport = React.useRef(null);
  const stage = React.useRef(null);
  const buttons = React.useRef(new Map());
  const layout = React.useRef(null);
  const drag = React.useRef(null);
  const suppressClick = React.useRef(false);
  const updateViewport = React.useRef(null);
  const [hovered, setHovered] = React.useState(null);
  const [focused, setFocused] = React.useState(null);
  const [tabKey, setTabKey] = React.useState(null);
  const [dragging, setDragging] = React.useState(false);
  const [view, setView] = React.useState({ left: 0, top: 0, width: 0, height: 0, padX: 0, padY: 0 });
  const hintId = React.useId();
  const keyFor = (node) => node.card?.id ?? 'home';
  const currentNode = activeId === null ? nodes[0] : nodes.find((node) => node.card && node.card.id === activeId);
  const rovingKey = nodes.some((node) => keyFor(node) === tabKey) ? tabKey : keyFor(currentNode ?? nodes[0]);

  function readScroll() {
    const area = viewport.current;
    if (!area) return;
    const metrics = layout.current?.metrics ?? view;
    const next = { ...metrics, left: area.scrollLeft, top: area.scrollTop };
    if (layout.current) layout.current.metrics = next;
    setView((previous) => Object.keys(next).every((key) => next[key] === previous[key]) ? previous : next);
  }

  function scrollTo(left, top, metrics = layout.current?.metrics) {
    const area = viewport.current;
    if (!area || !metrics) return;
    area.scrollLeft = Math.max(0, Math.min(left, layout.current.width + metrics.padX * 2 - metrics.width));
    area.scrollTop = Math.max(0, Math.min(top, layout.current.height + metrics.padY * 2 - metrics.height));
    readScroll();
  }

  function bringIntoView(node, center = false) {
    const area = viewport.current;
    const metrics = layout.current?.metrics;
    if (!area || !metrics) return;
    const x = node.x + metrics.padX;
    const y = node.y + metrics.padY;
    const moveX = !metrics.fitsX && (center || x - EXPLORE_MAP_X_MARGIN < area.scrollLeft
      || x + EXPLORE_MAP_X_MARGIN > area.scrollLeft + metrics.width);
    const moveY = !metrics.fitsY && (center || y - EXPLORE_MAP_Y_MARGIN < area.scrollTop
      || y + EXPLORE_MAP_Y_MARGIN > area.scrollTop + metrics.height);
    if (moveX || moveY) scrollTo(moveX ? x - metrics.width / 2 : area.scrollLeft,
      moveY ? y - metrics.height / 2 : area.scrollTop);
  }

  function finishDrag(event) {
    const state = drag.current;
    if (!state || (event?.pointerId !== undefined && event.pointerId !== state.id)) return;
    drag.current = null;
    setDragging(false);
    if (state.moved) suppressClick.current = true;
    if (state.capture.hasPointerCapture?.(state.id)) state.capture.releasePointerCapture(state.id);
  }

  updateViewport.current = (forceCenter = false) => {
    const area = viewport.current;
    const surface = stage.current;
    if (!area || !surface) { layout.current = null; return; }
    const previous = layout.current;
    const fitsX = area.clientWidth >= fitWidth;
    const fitsY = area.clientHeight >= height + 2 * (EXPLORE_MAP_Y_MARGIN - EXPLORE_MAP_PADDING);
    const metrics = { width: area.clientWidth, height: area.clientHeight, fitsX, fitsY,
      padX: fitsX ? (area.clientWidth - width) / 2 : Math.max(0, area.clientWidth / 2 - EXPLORE_MAP_PADDING),
      padY: fitsY ? (area.clientHeight - height) / 2 : Math.max(0, area.clientHeight / 2 - EXPLORE_MAP_PADDING),
      left: area.scrollLeft, top: area.scrollTop };
    surface.style.paddingLeft = surface.style.paddingRight = `${metrics.padX}px`;
    surface.style.paddingTop = surface.style.paddingBottom = `${metrics.padY}px`;
    const resized = previous && (metrics.width !== previous.metrics.width || metrics.height !== previous.metrics.height);
    const dataChanged = previous && previous.nodes !== nodes;
    const switched = previous && previous.activeId !== activeId;
    const appeared = currentNode && !previous?.currentNode;
    layout.current = { nodes, currentNode, activeId, metrics, width, height };
    if (!previous || switched || (resized && !dataChanged) || forceCenter || appeared) {
      finishDrag();
      const target = currentNode ?? (!previous ? nodes[0] : null);
      if (target) bringIntoView(target, true);
      if (switched && !area.contains(document.activeElement)) setTabKey(keyFor(currentNode ?? nodes[0]));
    } else if (dataChanged) {
      const focusKey = area.contains(document.activeElement) ? document.activeElement.dataset.btwNodeKey : null;
      const surviving = new Map(nodes.map((node) => [keyFor(node), node]));
      const visible = previous.nodes.filter((node) => {
        const x = node.x + previous.metrics.padX - previous.metrics.left;
        const y = node.y + previous.metrics.padY - previous.metrics.top;
        return surviving.has(keyFor(node)) && x + 18 > 0 && x - 18 < previous.metrics.width
          && y + 18 > 0 && y - 18 < previous.metrics.height;
      });
      const distanceFromCenter = (node) => Math.hypot(
        node.x + previous.metrics.padX - previous.metrics.left - previous.metrics.width / 2,
        node.y + previous.metrics.padY - previous.metrics.top - previous.metrics.height / 2);
      const fullyVisible = (node) => {
        const x = node.x + previous.metrics.padX - previous.metrics.left;
        const y = node.y + previous.metrics.padY - previous.metrics.top;
        return x >= 18 && x <= previous.metrics.width - 18 && y >= 18 && y <= previous.metrics.height - 18;
      };
      const oldAnchor = visible.find((node) => keyFor(node) === focusKey)
        ?? visible.find((node) => node === previous.currentNode)
        ?? visible.sort((a, b) => Number(fullyVisible(b)) - Number(fullyVisible(a)) || distanceFromCenter(a) - distanceFromCenter(b))[0]
        ?? previous.nodes.filter((node) => surviving.has(keyFor(node))).sort((a, b) => distanceFromCenter(a) - distanceFromCenter(b))[0];
      const newAnchor = oldAnchor && surviving.get(keyFor(oldAnchor));
      const paddingX = metrics.padX - previous.metrics.padX;
      const paddingY = metrics.padY - previous.metrics.padY;
      if (newAnchor && (newAnchor.x !== oldAnchor.x || newAnchor.y !== oldAnchor.y || paddingX || paddingY)) {
        finishDrag();
        scrollTo(previous.metrics.left + newAnchor.x - oldAnchor.x + paddingX,
          previous.metrics.top + newAnchor.y - oldAnchor.y + paddingY, metrics);
      }
    }
    if (fitsX && area.scrollLeft !== 0) area.scrollLeft = 0;
    if (fitsY && area.scrollTop !== 0) area.scrollTop = 0;
    readScroll();
    if (focused && !nodes.some((node) => keyFor(node) === focused) && document.activeElement === document.body) {
      let target = previous?.nodes.find((node) => keyFor(node) === focused)?.parent;
      while (target && !nodes.some((node) => keyFor(node) === keyFor(target))) target = target.parent;
      buttons.current.get(keyFor(target ?? currentNode ?? nodes[0]))?.focus({ preventScroll: true });
    }
  };

  React.useLayoutEffect(() => { updateViewport.current(); }, [nodes, activeId]);
  React.useLayoutEffect(() => {
    const area = viewport.current;
    if (!area) return;
    const resize = () => updateViewport.current(true);
    const observer = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(() => updateViewport.current()) : null;
    observer?.observe(area);
    const wheel = (event) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area.clientHeight : 1;
      const x = event.shiftKey ? event.deltaX || event.deltaY : event.deltaX;
      const y = event.shiftKey ? 0 : event.deltaY;
      scrollTo(area.scrollLeft + x * scale, area.scrollTop + y * scale);
    };
    // React wheel listeners are passive; handle native scrolling once so Shift
    // and vertical wheels share the same two-axis viewport without a double move.
    area.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('resize', resize);
    window.addEventListener('blur', finishDrag);
    return () => {
      observer?.disconnect();
      area.removeEventListener('wheel', wheel);
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', finishDrag);
      finishDrag();
    };
  }, [hasCards]);
  if (!hasCards) return null;
  const activePath = new Set();
  for (let node = currentNode; node && !activePath.has(node); node = node.parent) activePath.add(node);
  const edges = nodes.filter((node) => node.parent).map((node, index) => ({ node, ...exploreEdge(node), id: `${hintId}-edge-${index}` }));
  const hintNode = nodes.find((node) => keyFor(node) === (hovered ?? focused));
  const hintX = hintNode ? hintNode.x + view.padX - view.left : 0;
  const hintY = hintNode ? hintNode.y + view.padY - view.top : 0;
  const hintVisible = !dragging && hintNode && hintX >= 0 && hintX <= view.width && hintY >= 0 && hintY <= view.height;

  function moveFocus(event, node) {
    let target;
    if (event.key === 'Home') target = nodes[0];
    else if (event.key === 'End') target = [...nodes].sort((a, b) => b.depth - a.depth || b.x - a.x)[0];
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const row = nodes.filter((item) => item.depth === node.depth).sort((a, b) => a.x - b.x);
      target = row[row.indexOf(node) + (event.key === 'ArrowLeft' ? -1 : 1)] ?? node;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (event.key === 'ArrowUp') {
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (parent.depth < node.depth) { target = parent; break; }
        }
      }
      const candidates = event.key === 'ArrowDown'
        ? nodes.filter((item) => item.parent === node && item.depth > node.depth) : [];
      const nearby = candidates.length ? candidates : nodes.filter((item) => event.key === 'ArrowDown' ? item.depth > node.depth : item.depth < node.depth);
      target ??= nearby.sort((a, b) => Math.abs(a.depth - node.depth) - Math.abs(b.depth - node.depth)
        || Math.abs(a.x - node.x) - Math.abs(b.x - node.x) || a.x - b.x)[0] ?? node;
    } else return;
    event.preventDefault();
    setHovered(null);
    setTabKey(keyFor(target));
    buttons.current.get(keyFor(target))?.focus({ preventScroll: true });
    bringIntoView(target);
  }

  return h('nav', { className: 'dsh-btw-map', 'aria-label': '探索卡片关系导航',
    style: { '--btw-map-content-height': `${height + 48}px` } },
    h('div', { className: 'dsh-btw-map-viewport', ref: viewport, 'data-btw-dragging': dragging || undefined,
      onScroll: readScroll,
      onPointerDown: (event) => {
        if (drag.current || event.isPrimary === false || event.button !== 0) return;
        suppressClick.current = false;
        const capture = event.target.closest('.dsh-btw-map-node') ?? event.currentTarget;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
          left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moved: false, capture };
        capture.setPointerCapture?.(event.pointerId);
      },
      onPointerMove: (event) => {
        const state = drag.current;
        if (!state || state.id !== event.pointerId) return;
        const dx = event.clientX - state.x;
        const dy = event.clientY - state.y;
        if (!state.moved && Math.hypot(dx, dy) < 5) return;
        state.moved = true;
        event.preventDefault();
        setDragging(true);
        setHovered(null);
        scrollTo(state.left - dx, state.top - dy);
      },
      onPointerUp: finishDrag, onPointerCancel: finishDrag, onLostPointerCapture: finishDrag,
      onClickCapture: (event) => {
        if (!suppressClick.current || event.detail === 0) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      } },
      h('div', { className: 'dsh-btw-map-stage', ref: stage, style: { width } },
        h('div', { className: 'dsh-btw-map-graph', style: { width, height } },
          h('svg', { className: 'dsh-btw-map-lines', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': true },
            h('defs', null, edges.map((edge) => h('linearGradient', { key: edge.id, id: edge.id,
              gradientUnits: 'userSpaceOnUse', x1: edge.x1, y1: edge.y1, x2: edge.x2, y2: edge.y2,
              style: { color: activePath.has(edge.node) ? 'var(--btw-ink)' : 'var(--btw-muted)' } },
              h('stop', { offset: '0%', stopColor: 'currentColor', stopOpacity: activePath.has(edge.node) ? 1 : .8 }),
              h('stop', { offset: '100%', stopColor: 'currentColor', stopOpacity: activePath.has(edge.node) ? .35 : .18 }),
            ))),
            edges.map((edge) => h('path', { key: edge.node.card.id, d: edge.d, style: { stroke: `url(#${edge.id})` },
              'data-btw-node-key': keyFor(edge.node), 'data-btw-on-path': activePath.has(edge.node) || undefined })),
          ),
          currentNode && h('span', { className: 'dsh-btw-map-current', 'aria-hidden': true,
            style: { transform: `translate(${currentNode.x}px, ${currentNode.y}px)` } }),
          nodes.map((node) => {
            const name = node.card ? exploreTitle(node.card) : returnLabel;
            const key = keyFor(node);
            return h('button', { key, type: 'button', className: 'dsh-btw-map-node', tabIndex: key === rovingKey ? 0 : -1,
              ref: (button) => { if (button) buttons.current.set(key, button); else buttons.current.delete(key); },
              style: { left: node.x, top: node.y }, 'aria-label': `卡片节点 · ${name}`,
              'aria-describedby': hintVisible && hintNode === node ? hintId : undefined,
              'aria-current': node === currentNode ? 'page' : undefined,
              'data-btw-node-key': key, 'data-btw-depth': node.depth,
              'data-btw-relation': node.card?.relation ?? 'home', 'data-btw-on-path': activePath.has(node) || undefined,
              onPointerEnter: (event) => { if (event.pointerType !== 'touch' && !drag.current?.moved) setHovered(key); },
              onPointerLeave: () => setHovered(null),
              onFocus: () => { setHovered(null); setFocused(key); setTabKey(key); if (!drag.current) bringIntoView(node); },
              onBlur: () => setFocused(null),
              onKeyDown: (event) => moveFocus(event, node),
              onClick: (event) => {
                event.currentTarget.focus({ preventScroll: true });
                onNavigate(exploreTrail(node.card, byId));
              },
            }, h('span', { className: 'dsh-btw-map-halo', 'aria-hidden': true }),
            h('span', { className: 'dsh-btw-map-dot', 'aria-hidden': true }));
          }),
        ),
      ),
    ),
    hintVisible && h('div', { id: hintId, role: 'tooltip', className: 'dsh-btw-map-hint', style: { '--btw-map-hint-y': `${hintY}px` } },
      h('span', { className: 'dsh-btw-map-hint-title' }, hintNode.card ? exploreTitle(hintNode.card) : returnLabel),
    ),
  );
}
