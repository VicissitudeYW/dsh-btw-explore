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

function exploreWhiteboardEdge(node) {
  const { parent, x, center } = node;
  const left = parent.x + parent.width;
  const elbow = (left + x) / 2;
  return `M ${left} ${parent.center} C ${elbow} ${parent.center} ${elbow} ${center} ${x} ${center}`;
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

function ExploreWhiteboard({ cards = EXPLORE_EMPTY_CARDS, previews, onOpen, onReturnChat, loading, error, onRetry }) {
  const layout = React.useMemo(() => exploreWhiteboardLayout(cards), [cards]);
  const viewport = React.useRef(null);
  const homeButton = React.useRef(null);
  const opened = React.useRef(false);
  const gesture = React.useRef(null);
  const position = (node) => ({ left: node.x, top: node.y, width: node.width, height: node.height });

  function locateHome() {
    const view = viewport.current;
    const button = homeButton.current;
    if (!view || !button) return;
    const visible = view.getBoundingClientRect();
    const target = button.getBoundingClientRect();
    view.scrollLeft = 0;
    view.scrollTop += (target.top + target.height / 2) - (visible.top + visible.height / 2);
  }

  React.useLayoutEffect(() => {
    if (!layout.nodes.length || opened.current) return;
    opened.current = true;
    locateHome();
  }, [layout.nodes.length]);

  function beginPan(event) {
    if (gesture.current || event.button !== 0 || event.pointerType !== 'mouse' || event.target.closest?.('button')) return;
    const view = event.currentTarget;
    if (view.scrollWidth <= view.clientWidth && view.scrollHeight <= view.clientHeight) return;
    try { view.setPointerCapture(event.pointerId); } catch { return; }
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: view.scrollLeft, top: view.scrollTop };
  }

  function pan(event) {
    const start = gesture.current;
    if (!start || event.pointerId !== start.id) return;
    const view = event.currentTarget;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.dragging && Math.hypot(dx, dy) < 4) return;
    if (!start.dragging) { start.dragging = true; view.setAttribute('data-btw-panning', ''); }
    view.scrollLeft = start.left - dx;
    view.scrollTop = start.top - dy;
  }

  function stopPan(event) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    event.currentTarget.removeAttribute('data-btw-panning');
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
      onPointerDown: beginPan, onPointerMove: pan, onPointerUp: stopPan, onPointerCancel: stopPan, onLostPointerCapture: stopPan },
      h('div', { className: 'dsh-btw-board-stage', style: { width: layout.width, height: layout.height } },
        h('svg', { className: 'dsh-btw-board-links', width: layout.width, height: layout.height, 'aria-hidden': true, focusable: false },
          layout.nodes.map((node) => h('path', { key: node.card.id, d: exploreWhiteboardEdge(node) }))),
        h('button', { ref: homeButton, type: 'button', 'data-btw-board-home': '', className: 'dsh-btw-board-home',
          style: position(layout.home), onClick: onReturnChat, title: '返回主聊天' }, exploreBoardIcon('chat'), '主聊天'),
        layout.nodes.map((node) => {
          const { card } = node;
          const quote = card.source?.quote?.trim();
          const title = (quote || '未引用原文').replace(/\s+/g, ' ');
          const preview = Object.hasOwn(previews ?? {}, card.id) ? previews[card.id]?.trim() : '';
          return h('button', { key: card.id, type: 'button', className: 'dsh-btw-board-card', style: position(node),
            title: title.length > 180 ? `${title.slice(0, 180)}…` : title, 'aria-haspopup': 'dialog', 'data-btw-board-card': card.id,
            onClick: (event) => onOpen(card, event.currentTarget),
          }, h('span', { className: 'dsh-btw-board-card-head' },
            h('span', { className: 'dsh-btw-board-quote' }, title), exploreBoardIcon('open')),
          h('span', { className: 'dsh-btw-board-preview' },
            preview || (card.status === 'running' ? '正在回答…' : '暂无回答')));
        }),
      ),
    ));
}
