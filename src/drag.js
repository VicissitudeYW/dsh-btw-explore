function installExplorerDeckDrag(overlay) {
  const foreground = '.dsh-btw-page[data-btw-top]';
  const interactive = '[data-chat-flow-kind], [data-btw-turn], [data-composer-seat], [data-composer-card], '
    + 'a, button, input, select, textarea, label, details, [contenteditable], [draggable="true"], '
    + '[role="button"], [role="checkbox"], [role="menu"], [role="listbox"], [role="slider"], [role="tab"]';
  const padding = 8;
  let x = 0;
  let y = 0;
  let gesture;

  function move(frame, nextX, nextY) {
    const box = frame.getBoundingClientRect();
    const viewport = overlay.getBoundingClientRect();
    if (!box.width || !box.height || !viewport.width || !viewport.height) return;
    const rail = overlay.querySelector('.dsh-btw-map')?.getBoundingClientRect();
    const left = Math.max(viewport.left, rail?.right ?? viewport.left) + padding;
    const dxMin = left - (box.left - x);
    const dxMax = viewport.right - padding - (box.right - x);
    const dyMin = viewport.top + padding - (box.top - y);
    const dyMax = viewport.bottom - padding - (box.bottom - y);
    // At very small sizes the layout itself fits more tightly than this margin.
    const clamp = (value, min, max) => min > max ? 0 : Math.max(min, Math.min(value, max));
    const clampedX = clamp(nextX, dxMin, dxMax);
    const clampedY = clamp(nextY, dyMin, dyMax);
    if (clampedX !== x) overlay.style.setProperty('--btw-drag-x', `${clampedX}px`);
    if (clampedY !== y) overlay.style.setProperty('--btw-drag-y', `${clampedY}px`);
    x = clampedX;
    y = clampedY;
  }

  function end(event) {
    if (!gesture || (event && event.pointerId !== gesture.id)) return;
    const { id } = gesture;
    gesture = undefined;
    overlay.removeAttribute('data-btw-dragging');
    if (overlay.hasPointerCapture?.(id)) overlay.releasePointerCapture(id);
  }

  function begin(event) {
    if (gesture || event.defaultPrevented || event.button !== 0 || event.isPrimary === false) return;
    const target = event.target;
    const frame = target.closest?.(foreground);
    if (!frame || frame.hasAttribute('data-btw-motion') || target.closest(interactive)) return;
    try { overlay.setPointerCapture(event.pointerId); } catch { return; }
    event.preventDefault();
    gesture = { frame, id: event.pointerId, x, y, startX: event.clientX, startY: event.clientY };
    overlay.setAttribute('data-btw-dragging', '');
  }

  function update(event) {
    if (event.pointerId !== gesture?.id) return;
    if (overlay.querySelector(foreground) !== gesture.frame || gesture.frame.hasAttribute('data-btw-motion')) {
      end();
      return;
    }
    move(gesture.frame, gesture.x + event.clientX - gesture.startX, gesture.y + event.clientY - gesture.startY);
  }

  function reconcile() {
    const frame = overlay.querySelector(foreground);
    if (gesture && (frame !== gesture.frame || frame?.hasAttribute('data-btw-motion'))) end();
    if (frame && !frame.hasAttribute('data-btw-motion-surface') && (x || y)) move(frame, x, y);
  }

  const onResize = () => { end(); reconcile(); };
  const onBlur = () => end();
  const events = { pointerdown: begin, pointermove: update, pointerup: end, pointercancel: end, lostpointercapture: end };
  for (const [name, callback] of Object.entries(events)) overlay.addEventListener(name, callback);
  window.addEventListener('resize', onResize);
  window.addEventListener('blur', onBlur);
  return { reconcile, dispose() {
    end();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('blur', onBlur);
    for (const [name, callback] of Object.entries(events)) overlay.removeEventListener(name, callback);
    overlay.style.removeProperty('--btw-drag-x');
    overlay.style.removeProperty('--btw-drag-y');
  } };
}

function useExplorerDeckLayout(overlay, owner, visible, sessionId) {
  const drag = React.useRef(null);
  React.useLayoutEffect(() => {
    const layer = overlay.current;
    if (!visible || !layer) return;
    // The portal covers the entire window, but its header owner sits in the conversation column.
    const header = owner?.current?.closest('header');
    const shell = (header?.closest('[data-slot="conversation.header"]') ?? header)?.parentElement;
    let composer;
    const observer = header && window.ResizeObserver ? new window.ResizeObserver(measure) : null;
    function measure() {
      if (!header) return;
      const bounds = header.getBoundingClientRect();
      const viewport = layer.getBoundingClientRect();
      if (!bounds.width || !viewport.width) return;
      layer.style.setProperty('--btw-chat-left', `${Math.max(0, bounds.left - viewport.left)}px`);
      layer.style.setProperty('--btw-chat-right', `${Math.max(0, viewport.right - bounds.right)}px`);
      if (!composer?.isConnected) {
        if (composer) observer?.unobserve(composer);
        const chat = [...(shell?.querySelectorAll('[data-conversation-content][data-conversation-session]') ?? [])]
          .find((region) => region.dataset.conversationSession === sessionId);
        composer = chat?.querySelector('[data-composer-card]');
        if (composer) observer?.observe(composer);
      }
      const composerWidth = composer?.offsetWidth;
      layer.toggleAttribute('data-btw-composer-width', Boolean(composerWidth));
      if (composerWidth) layer.style.setProperty('--btw-main-composer-width', `${composerWidth}px`);
      else layer.style.removeProperty('--btw-main-composer-width');
      drag.current?.reconcile();
    }
    measure();
    drag.current = installExplorerDeckDrag(layer);
    observer?.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      drag.current.dispose();
      drag.current = null;
    };
  }, [overlay, owner, visible, sessionId]);
  React.useLayoutEffect(() => { drag.current?.reconcile(); });
}
