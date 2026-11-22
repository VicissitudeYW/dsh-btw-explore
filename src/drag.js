function installExplorerDeckDrag(overlay) {
  const foreground = '.dsh-btw-page[data-btw-top]';
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
    if (gesture || event.button !== 0 || event.isPrimary === false) return;
    const handle = event.target.closest?.('[data-btw-drag-handle]');
    const frame = handle?.closest(foreground);
    if (!frame || frame.hasAttribute('data-btw-motion')) return;
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

function useExplorerDeckDrag(overlay, visible) {
  const drag = React.useRef(null);
  React.useLayoutEffect(() => {
    if (!visible || !overlay.current) return;
    drag.current = installExplorerDeckDrag(overlay.current);
    return () => { drag.current.dispose(); drag.current = null; };
  }, [overlay, visible]);
  React.useLayoutEffect(() => { drag.current?.reconcile(); });
}
