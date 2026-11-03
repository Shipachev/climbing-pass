// One gesture per pointer. Vertical movement remains native page scrolling.
export function swipeStatus(dx, dy, width) {
  const threshold = 90;
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.4) return null;
  return dx > 0 ? 'done' : 'skipped';
}
export function bindStageSwipes(root, onMark) {
  let gesture = null;
  let suppressClick = false;
  function reset() {
    if (!gesture) return;
    const { card, pointerId } = gesture;
    card.style.transform = '';
    card.classList.remove('is-swiping', 'swipe-done', 'swipe-skipped');
    if (card.hasPointerCapture(pointerId)) card.releasePointerCapture(pointerId);
    gesture = null;
  }
  root.addEventListener('pointerdown', (event) => {
    if (
      gesture ||
      !event.isPrimary ||
      event.button !== 0 ||
      globalThis.getSelection?.()?.toString()
    )
      return;
    const card = event.target.closest('[data-swipe]');
    if (
      !card ||
      event.target.closest('input, textarea, select, button, a, label, [contenteditable]')
    )
      return;
    gesture = {
      card,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      horizontal: false,
    };
  });
  root.addEventListener('pointermove', (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.x,
      dy = event.clientY - gesture.y;
    if (!gesture.horizontal) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) {
        reset();
        return;
      }
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      gesture.horizontal = true;
      gesture.card.setPointerCapture(event.pointerId);
      gesture.card.classList.add('is-swiping');
    }
    gesture.card.style.transform = `translateX(${Math.max(-90, Math.min(90, dx * 0.6))}px)`;
    gesture.card.classList.toggle('swipe-done', dx > 0);
    gesture.card.classList.toggle('swipe-skipped', dx < 0);
  });
  root.addEventListener('pointerup', (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const { card, x, y, horizontal } = gesture;
    const status = horizontal
      ? swipeStatus(event.clientX - x, event.clientY - y, card.offsetWidth)
      : null;
    suppressClick = horizontal;
    if (horizontal)
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    reset();
    if (status) onMark(card.dataset.visit, card.dataset.step, status);
  });
  root.addEventListener('pointercancel', reset);
  root.addEventListener('lostpointercapture', reset);
  root.addEventListener(
    'click',
    (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
      }
    },
    true,
  );
}
