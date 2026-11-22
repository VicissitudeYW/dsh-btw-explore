function exploreWhiteboardLayout(cards) {
  const padding = 20;
  const cardWidth = 216;
  const cardHeight = 120;
  const columnGap = 60;
  const rowGap = 24;
  const home = { card: null, parent: null, children: [], width: 104, height: 48, x: padding };
  const byId = new Map();
  for (const card of cards) {
    if (!byId.has(card.id)) byId.set(card.id, { card, children: [], width: cardWidth, height: cardHeight });
  }

  // Cut one edge per source cycle so old or incomplete data remains browsable.
  const resolved = new Set();
  for (const start of byId.values()) {
    const chain = new Set();
    for (let node = start; node !== home && !resolved.has(node); node = node.parent) {
      chain.add(node);
      const source = byId.get(node.card.parentId);
      node.parent = source && !chain.has(source) ? source : home;
    }
    for (const node of chain) resolved.add(node);
  }
  for (const node of byId.values()) node.parent.children.push(node);

  const nodes = [];
  const stack = [home];
  let right = home.x + home.width;
  let leaf = 0;
  while (stack.length) {
    const node = stack.pop();
    if (node !== home) {
      nodes.push(node);
      node.x = node.parent.x + node.parent.width + (node.parent === home ? 28 : columnGap);
      right = Math.max(right, node.x + node.width);
    }
    if (!node.children.length) node.center = padding + cardHeight / 2 + leaf++ * (cardHeight + rowGap);
    for (let index = node.children.length - 1; index >= 0; index--) stack.push(node.children[index]);
  }
  for (const node of [...nodes].reverse().concat(home)) {
    if (node.children.length) node.center = (node.children[0].center + node.children.at(-1).center) / 2;
    node.y = node.center - node.height / 2;
  }
  return { nodes, home, width: right + padding, height: 2 * padding + cardHeight + Math.max(0, leaf - 1) * (cardHeight + rowGap) };
}

const exploreNodeId = (node) => node.card?.id ?? '';

function exploreWhiteboardEdge(node, point) {
  const child = point(node);
  const parent = point(node.parent);
  const fromY = parent.y + node.parent.height / 2;
  const toY = child.y + node.height / 2;
  const right = child.x + node.width / 2 >= parent.x + node.parent.width / 2;
  const fromX = parent.x + (right ? node.parent.width : 0);
  const toX = child.x + (right ? 0 : node.width);
  const elbow = (fromX + toX) / 2;
  return `M ${fromX} ${fromY} C ${elbow} ${fromY} ${elbow} ${toY} ${toX} ${toY}`;
}

function exploreBoardPositions(key) {
  try {
    const entries = JSON.parse(window.localStorage.getItem(key));
    if (Array.isArray(entries)) return new Map(entries.filter((entry) => Array.isArray(entry) && typeof entry[0] === 'string'
      && Number.isFinite(entry[1]?.x) && Number.isFinite(entry[1]?.y)));
  } catch {}
  return new Map();
}

function exploreBoardIcon(name) {
  const paths = {
    center: 'M5 9V5h4 M15 5h4v4 M19 15v4h-4 M9 19H5v-4 M12 9v6 M9 12h6',
    chat: 'M6 5h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 3v-3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z M8 9h8 M8 13h5',
    open: 'M8 16l8-8 M8 8h8v8',
  };
  return h('svg', { viewBox: '0 0 24 24', width: 17, height: 17, fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[name] }));
}

const ExploreBoardPreview = React.memo(function ExploreBoardPreview({ Markdown, preview, running }) {
  return h('div', { className: 'dsh-btw-board-preview', inert: true }, preview
    ? Markdown ? h(Markdown, { text: preview, streaming: running }) : preview
    : running ? '正在回答…' : '暂无回答');
});

function ExploreWhiteboard({ sessionId, cards = EXPLORE_EMPTY_CARDS, previews, Markdown, onOpen, onReturnChat, loading, error, onRetry }) {
  const layout = React.useMemo(() => exploreWhiteboardLayout(cards), [cards]);
  const storageKey = sessionId ? `dsh-btw-explore:board:${sessionId}` : null;
  const [positions, setPositions] = React.useState(() => storageKey ? exploreBoardPositions(storageKey) : new Map());
  const [dragged, setDragged] = React.useState(null);
  const viewport = React.useRef(null);
  const stage = React.useRef(null);
  const opened = React.useRef(false);
  const camera = React.useRef({ x: 0, y: 0 });
  const gesture = React.useRef(null);
  const suppressClick = React.useRef(false);
  const point = (node) => dragged?.key === exploreNodeId(node) ? dragged : positions.get(exploreNodeId(node)) ?? node;
  const position = (node) => ({ left: point(node).x, top: point(node).y, width: node.width, height: node.height,
    zIndex: dragged?.key === exploreNodeId(node) ? 2 : undefined });

  function moveCamera(x, y) {
    camera.current = { x, y };
    stage.current.style.translate = `${x}px ${y}px`;
    viewport.current.style.backgroundPosition = `${x % 18}px ${y % 18}px`;
  }

  function locateHome() {
    const { x, y } = point(layout.home);
    const height = viewport.current.clientHeight;
    moveCamera(layout.home.x - x, height ? Math.round((height - layout.home.height) / 2 - y) : 0);
  }

  React.useLayoutEffect(() => {
    if (!layout.nodes.length || opened.current) return;
    opened.current = true;
    locateHome();
  }, [layout.nodes.length]);

  React.useEffect(() => {
    const view = viewport.current;
    function wheel(event) {
      if (event.ctrlKey || event.metaKey || gesture.current) return;
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.clientHeight : 1;
      const horizontal = event.shiftKey && !event.deltaX;
      moveCamera(camera.current.x - (horizontal ? event.deltaY : event.deltaX) * scale,
        camera.current.y - (horizontal ? 0 : event.deltaY) * scale);
    }
    view.addEventListener('wheel', wheel, { passive: false });
    return () => view.removeEventListener('wheel', wheel);
  }, []);

  function beginDrag(event) {
    if (gesture.current || event.button !== 0 || event.isPrimary === false) return;
    suppressClick.current = false;
    const button = event.target.closest?.('button');
    const key = button?.dataset.btwBoardCard ?? (button?.hasAttribute('data-btw-board-home') ? '' : null);
    const node = key === '' ? layout.home : key === null ? null : layout.nodes.find(({ card }) => card.id === key);
    if (button && !node) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, key,
      origin: node ? point(node) : camera.current };
  }

  function moveDrag(event) {
    const start = gesture.current;
    if (!start || event.pointerId !== start.id) return;
    const view = event.currentTarget;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.dragging && Math.hypot(dx, dy) < 4) return;
    if (!start.dragging) {
      try { view.setPointerCapture(event.pointerId); } catch { return; }
      start.dragging = true;
      view.setAttribute('data-btw-panning', '');
    }
    const x = start.origin.x + dx;
    const y = start.origin.y + dy;
    if (start.key === null) moveCamera(x, y);
    else setDragged(start.point = { key: start.key, x, y });
  }

  function endDrag(event) {
    const start = gesture.current;
    if (start?.id !== event.pointerId) return;
    gesture.current = null;
    event.currentTarget.removeAttribute('data-btw-panning');
    if (!start.dragging) return;
    suppressClick.current = true;
    if (!start.point) return;
    if (event.type === 'pointerup') {
      const { key, x, y } = start.point;
      const next = new Map([layout.home, ...layout.nodes]
        .map(exploreNodeId).filter((id) => positions.has(id)).map((id) => [id, positions.get(id)]));
      next.set(key, { x, y });
      setPositions(next);
      if (storageKey) {
        try { window.localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      }
    }
    setDragged(null);
  }

  function keepFocusVisible(event) {
    const button = event.target;
    if (!button.matches?.('button:focus-visible')) return;
    const view = viewport.current.getBoundingClientRect();
    const target = button.getBoundingClientRect();
    const reveal = (start, end, min, max) => start < min + 8 ? min + 8 - start : end > max - 8 ? max - 8 - end : 0;
    moveCamera(camera.current.x + reveal(target.left, target.right, view.left, view.right),
      camera.current.y + reveal(target.top, target.bottom, view.top, view.bottom));
  }

  const status = error ? h('div', { role: 'alert', className: 'dsh-btw-board-state' },
    h('span', null, error), onRetry && exploreButton('重试', { onClick: onRetry }))
    : loading && !cards.length ? h('p', { role: 'status', className: 'dsh-btw-board-state' }, '正在加载卡片…')
      : !cards.length ? h('p', { className: 'dsh-btw-board-state' }, '还没有探索卡片') : null;

  return h('section', { className: 'dsh-btw-explore dsh-btw-whiteboard', 'aria-label': '卡片树', 'aria-busy': loading || undefined },
    h('div', { className: 'dsh-btw-board-bar' },
      h('h2', null, '卡片树'), h('span', { className: 'dsh-btw-board-count' }, `${layout.nodes.length} 张卡片`),
      h('button', { type: 'button', className: 'dsh-btw-button dsh-btw-quiet dsh-btw-board-locate', 'aria-label': '定位主聊天',
        title: '定位主聊天', onClick: locateHome }, exploreBoardIcon('center')),
    ),
    status,
    h('div', { ref: viewport, className: 'dsh-btw-board-viewport', tabIndex: 0, role: 'region', 'aria-label': '探索白板',
      onPointerDown: beginDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag,
      onLostPointerCapture: endDrag, onPointerLeave: (event) => { if (!gesture.current?.dragging) endDrag(event); },
      onFocus: keepFocusVisible, onDragStart: (event) => event.preventDefault(),
      onClickCapture: (event) => {
        if (!event.detail || !suppressClick.current) return;
        suppressClick.current = false;
        event.stopPropagation();
      },
      onKeyDown: (event) => {
        if (event.target !== event.currentTarget) return;
        const offset = { ArrowLeft: [56, 0], ArrowRight: [-56, 0], ArrowUp: [0, 56], ArrowDown: [0, -56] }[event.key];
        if (!offset) return;
        event.preventDefault();
        moveCamera(camera.current.x + offset[0], camera.current.y + offset[1]);
      },
    },
      h('div', { ref: stage, className: 'dsh-btw-board-stage', style: { width: layout.width, height: layout.height } },
        h('svg', { className: 'dsh-btw-board-links', width: layout.width, height: layout.height, 'aria-hidden': true, focusable: false },
          layout.nodes.map((node) => h('path', { key: node.card.id, d: exploreWhiteboardEdge(node, point) }))),
        h('button', { type: 'button', 'data-btw-board-home': '', className: 'dsh-btw-board-home',
          style: position(layout.home), onClick: onReturnChat, title: '返回主聊天' }, exploreBoardIcon('chat'), '主聊天'),
        layout.nodes.map((node) => {
          const { card } = node;
          const quote = card.source?.quote?.trim();
          const title = (quote || '未引用原文').replace(/\s+/g, ' ');
          const preview = Object.hasOwn(previews ?? {}, card.id) ? previews[card.id]?.trim() : '';
          return h('div', { key: card.id, className: 'dsh-btw-board-card', style: position(node) },
            h('span', { className: 'dsh-btw-board-card-head', 'aria-hidden': true },
              h('span', { className: 'dsh-btw-board-quote' }, title), exploreBoardIcon('open')),
            h(ExploreBoardPreview, { Markdown, preview, running: card.status === 'running' }),
            h('button', { type: 'button', className: 'dsh-btw-board-open',
              title: title.length > 180 ? `${title.slice(0, 180)}…` : title, 'aria-label': title,
              'aria-haspopup': 'dialog', 'data-btw-board-card': card.id, onClick: (event) => onOpen(card, event.currentTarget),
            }));
        }),
      ),
    ));
}
