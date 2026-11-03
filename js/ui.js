const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function confirmSheet(message, { showClose = true } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'bottom-sheet';
    const titleId = `confirm-${crypto.randomUUID()}`;
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.innerHTML = `<form method="dialog"><header><h2 id="${titleId}">Подтверждение действия</h2>${showClose ? '<button class="icon-button" value="cancel" aria-label="Закрыть">Закрыть</button>' : ''}</header><p class="text">${escape(message)}</p><div class="actions"><button class="secondary" value="cancel" autofocus>Отменить</button><button class="primary" value="confirm">Подтвердить</button></div></form>`;
    dialog.addEventListener(
      'close',
      () => {
        const result = dialog.returnValue === 'confirm';
        dialog.remove();
        resolve(result);
      },
      { once: true },
    );
    document.body.append(dialog);
    dialog.showModal();
  });
}
