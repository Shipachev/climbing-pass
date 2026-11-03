import { confirmSheet } from './ui.js';
import { openLocal, enqueue, rebase, canLogout } from './data/local.js';
import { Sync, api } from './data/sync.js';
import { changes } from './data/graph.js';
import { bindStageSwipes } from './swipe.js';
import { stageTypes, stageType } from './stages.js';
import { clone, uid, now, today } from './store.js';
import {
  active,
  archive,
  finished,
  visitsFor,
  addPass,
  addVisit,
  deleteVisit,
  newestVisits,
} from './passes.js';
import { latest, draft, publish } from './programs.js';
import { start, mark, finish, progress, previousWorkout, lastCompletedAt } from './workouts.js';
const root = document.querySelector('#app');
let state,
  storageError = false,
  repository,
  sync,
  user,
  record;
let releaseVersion = '3.0.0';
let tasks = Promise.resolve();
let expandedStep = null,
  historyFilter = 'all';
const historyPositions = new Map();
const e = (x) =>
  String(x ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const fmt = (d) =>
  d
    ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';
const time = (d) =>
  `${fmt(d)} ${new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
const names = { home: 'Главная', training: 'Программы', history: 'История', settings: 'Настройки' };
const symbols = { home: 'home', training: 'list_alt', history: 'history', settings: 'settings' };
const button = (text, action, cls = 'secondary') =>
  `<button class="${cls}" data-action="${action}">${text}</button>`;
const iconNames = {
  skipped: 'skip_next',
  pending: 'radio_button_unchecked',
  pass: 'confirmation_number',
  back: 'arrow_back',
  edit: 'edit',
  history: 'history',
  archive: 'archive',
  restore: 'unarchive',
  visits: 'how_to_reg',
  play: 'play_arrow',
  finish: 'check',
  reopen: 'repeat',
  delete: 'delete',
};
const svgIcon = (name) =>
  `<span class="cp-icon" aria-hidden="true">${iconNames[name] || name}</span>`;
const iconButton = (label, action, icon, accent = false) =>
  `<button class="icon-button${accent ? ' icon-accent' : ''}" data-action="${action}" aria-label="${e(label)}" title="${e(label)}">${svgIcon(icon)}</button>`;
const field = (label, key, value, type = 'text') =>
  `<label>${e(label)}<input type="${type}" data-field="${key}" value="${e(value)}"></label>`;
const area = (label, key, value) =>
  `<label>${e(label)}<textarea data-field="${key}">${e(value)}</textarea></label>`;
function toast(msg, error = false) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), error ? 9000 : 2500);
}
async function mutate(fn, rerender = true, options = {}) {
  const work = async () => {
    try {
      if (!repository) throw Error('Сначала войдите в аккаунт');
      let result;
      await navigator.locks.request(`climbpass-${user.id}`, async () => {
        record = await repository.read();
        const next = clone(record.state);
        if (!options.mode) archive(next);
        result = fn(next);
        record = await repository.write(enqueue(record, next, options));
        state = record.state;
      });
      storageError = false;
      if (rerender) render();
      channel?.postMessage('changed');
      sync.status = 'Сохранено на устройстве · ожидает отправки';
      sync.run();
      return { ok: true, result };
    } catch (err) {
      storageError = true;
      toast(`Не сохранено: ${err.message}. Введённый текст оставлен на экране.`, true);
      return { ok: false };
    }
  };
  const pending = tasks.then(work);
  tasks = pending.then(() => {});
  return pending;
}
let channel;
function route() {
  return location.hash.slice(1).split('/');
}
function go(path) {
  location.hash = path;
}
function summary(w) {
  const p = progress(w);
  return `Выполнено ${p.done} из ${p.total} · Пропущено ${p.skipped} · Не выполнено ${p.pending}`;
}
function visitRows(visits) {
  return (
    newestVisits(visits)
      .map((v) => {
        const p = state.passes.find((p) => p.id === v.passId),
          w = v.workout;
        return `<button class="visit-link" data-action="visit/${v.id}"><strong>${fmt(v.date)} <span class="badge">${p.total === 1 ? 'Абонемент на 1 посещение' : 'Абонемент'}${p.status === 'archived' ? ' · завершён' : ''}</span></strong>${w ? `<span>${e(w.content.title)}</span><span class="muted">${w.status === 'active' ? 'Идёт' : 'Завершена'} · ${summary(w)}</span>` : '<span class="muted">Без тренировки · Открыть посещение</span>'}</button>`;
      })
      .join('') || '<p class="muted">Посещений пока нет.</p>'
  );
}
function history() {
  const visits = newestVisits(state.visits),
    trained = visits.filter(
      (v) => v.workout && (historyFilter === 'all' || v.workout.status === historyFilter),
    ),
    without = visits.filter((v) => !v.workout);
  const metric = (icon, value, label, cls = '') =>
    `<span class="history-metric ${cls}" title="${e(label)}" aria-label="${e(label)}">${svgIcon(icon)}${value}</span>`;
  let month = '';
  const workouts = trained
    .map((v) => {
      const group = v.date.slice(0, 7),
        heading =
          group !== month
            ? `<h2 class="history-month">${new Date(v.date + 'T12:00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h2>`
            : '';
      month = group;
      const w = v.workout,
        p = progress(w),
        completed = w.status === 'completed';
      return `${heading}<a class="card history-workout" href="#visit/${v.id}" aria-label="${e(w.content.title)} · ${fmt(v.date)} · ${completed ? 'Завершена' : 'В процессе'} · Выполнено ${p.done} из ${p.total}"><div class="history-row"><time datetime="${v.date}">${fmt(v.date)}</time><span class="history-state ${completed ? 'is-completed' : 'is-active'}" title="${completed ? 'Завершена' : 'В процессе'}">${svgIcon(completed ? 'finish' : 'history')}</span></div><h2>${e(w.content.title)}</h2><div class="history-metrics">${metric('finish', `${p.done}/${p.total}`, `Выполнено ${p.done} из ${p.total}`, 'metric-done')}</div></a>`;
    })
    .join('');
  return `<div class="segments" role="group" aria-label="Фильтр занятий">${[
    ['all', 'Все'],
    ['completed', 'Завершены'],
    ['active', 'Идёт'],
  ]
    .map(
      ([id, label]) =>
        `<button data-action="filter/${id}" aria-pressed="${historyFilter === id}">${label}</button>`,
    )
    .join(
      '',
    )}</div>${workouts || '<section class="card"><p class="muted">Для выбранного фильтра занятий пока нет</p></section>'}${without.length ? `<details class="card history-extra"><summary>${svgIcon('visits')}<span>Без тренировки</span><span class="history-count">${without.length}</span></summary>${without.map((v) => `<a class="history-plain-row" href="#visit/${v.id}"><time datetime="${v.date}">${fmt(v.date)}</time>${svgIcon('visits')}</a>`).join('')}</details>` : ''}${
    state.passes.length
      ? `<details class="card history-extra"><summary>${svgIcon('pass')}<span>Абонементы</span><span class="history-count">${state.passes.length}</span></summary>${state.passes
          .slice()
          .sort((a, b) => b.start.localeCompare(a.start))
          .map(
            (p) =>
              `<div class="history-pass-row"><div><time>${fmt(p.start)} — ${fmt(p.end)}</time></div><div class="history-metrics">${metric('visits', `${visitsFor(state, p.id).length}/${p.total}`, `Посещений ${visitsFor(state, p.id).length} из ${p.total}`)}${metric(p.status === 'active' ? 'pass' : 'archive', '', p.status === 'active' ? 'Действующий абонемент' : 'Завершённый абонемент')}</div></div>`,
          )
          .join('')}</details>`
      : ''
  }`;
}
function passForm(p) {
  const end = new Date();
  end.setDate(end.getDate() + 30);
  const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return `<section class="card"><h2>${p ? 'Редактировать' : 'Новый'} абонемент</h2><form id="pass-form">${field('Дата начала', 'start', p?.start || today(), 'date')}${field('Дата окончания', 'end', p?.end || endDate, 'date')}<label>Количество посещений<select data-field="total" required>${p && ![1, 4, 8].includes(p.total) ? '<option value="" selected disabled>Выберите количество</option>' : ''}${[1, 4, 8].map((n) => `<option value="${n}" ${(p?.total ?? 8) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label><div class="actions"><button class="primary" type="submit">${p ? 'Сохранить' : 'Добавить абонемент'}</button>${button('Отмена', 'home')}</div></form></section>`;
}
function segments(w) {
  return `<div class="progress-segments" aria-label="${e(summary(w))}">${Object.values(w.marks)
    .map((m) => `<span class="segment-${m.status}"></span>`)
    .join('')}</div>`;
}
function home() {
  const currentPass = active(state),
    p = currentPass && !finished(state, currentPass) ? currentPass : null,
    pending = newestVisits(state.visits.filter((v) => v.workout?.status === 'active')),
    recent = pending[0];
  const membership = p
    ? `<section class="membership-strip"><div><strong>Осталось ${p.total - visitsFor(state, p.id).length} из ${p.total} посещений</strong><p class="muted">До ${fmt(p.end)}${p.start > today() ? ' · ещё не начался' : ''}</p></div>${iconButton('Изменить абонемент', 'edit-pass', 'edit')}</section>`
    : `<section class="card"><p>${currentPass ? (currentPass.end < today() ? 'Срок абонемента истёк' : 'Посещения абонемента закончились') : 'Действующего абонемента нет'}</p>${passForm()}</section>`;
  const hero = recent
    ? (() => {
        const w = recent.workout,
          pr = progress(w),
          next = w.content.sections
            .flatMap((s) => s.steps)
            .find((t) => w.marks[t.id].status === 'pending');
        return `<section class="pass-card active-training"><div class="eyebrow">Активная тренировка</div><h1>${e(w.content.title)}</h1><div class="hero-stat">${pr.done}<span> / ${pr.total}</span></div><p>Выполнено ${pr.done} из ${pr.total} этапов</p>${segments(w)}${next ? `<p class="hero-next"><span>Сейчас</span>${e(next.title)}</p>` : '<p>Все этапы отмечены. Можно завершить занятие.</p>'}<div class="pass-actions">${button('Продолжить тренировку', `visit/${recent.id}`, 'primary')}</div></section>`;
      })()
    : p
      ? `<section class="pass-card"><div class="section-head"><div><div class="pass-title">Абонемент</div><div class="pass-dates">До ${fmt(p.end)}</div></div>${iconButton('Изменить абонемент', 'edit-pass', 'edit')}</div><div class="pass-visits">${p.total - visitsFor(state, p.id).length}</div><div class="pass-label">осталось посещений из ${p.total}</div><p>${p.start > today() ? 'Абонемент начнётся ' + fmt(p.start) : 'Отметка спишет один проход. Начало тренировки повторно его не спишет.'}</p>${p.start <= today() ? `<div class="pass-actions">${button('Отметить посещение', 'add-visit', 'primary')}</div>` : ''}</section>`
      : '';
  return `${hero}${recent || !p ? membership : ''}${pending.length > 1 ? `<section class="card"><h3>Другие незавершённые занятия</h3>${visitRows(pending.slice(1))}</section>` : ''}<section class="card"><div class="section-head"><h3>Последние посещения</h3>${button('Все', 'history')}</div>${visitRows(newestVisits(state.visits).slice(0, 5))}</section>`;
}
function content(c, w, visitId) {
  const previous = w && w.status === 'active' ? previousWorkout(state, visitId) : null;
  const steps = c.sections.flatMap((section) => section.steps.map((step) => ({ step, section })));
  if (w && expandedStep === null && progress(w).pending)
    expandedStep = steps.find(({ step }) => w.marks[step.id].status === 'pending')?.step.id;
  return `<p class="text">${e(c.goal)}</p><div class="badge">План: ${e(c.duration || '—')} мин</div>${c.notes ? `<div class="notice text">${e(c.notes)}</div>` : ''}${c.sections
    .map(
      (section) =>
        `<section class="workout-section"><div class="section-band">${e(section.title)} <span>${e(section.duration)}</span></div>${section.steps
          .map((t) => {
            const m = w?.marks[t.id],
              read = w?.status === 'completed',
              hasNote = stageType(t, section) === 'training',
              previousNote = hasNote ? previous?.workout.marks[t.id]?.note : null;
            const index = steps.findIndex((x) => x.step.id === t.id),
              open = !w || expandedStep === t.id;
            const status = m
              ? { pending: open ? 'Сейчас' : 'Не отмечен', done: 'Выполнен', skipped: 'Пропущен' }[
                  m.status
                ]
              : stageTypes[stageType(t, section)];
            return `<div class="swipe-shell"><article class="stage stage-card ${m ? `stage-${m.status}` : ''} ${open ? 'is-open' : ''}" ${m ? `data-step="${t.id}" data-visit="${visitId}"` : ''} ${m && !read && open ? 'data-swipe="true"' : ''}>
   <button class="step-heading" data-action="expand/${t.id}" aria-expanded="${open}"><span class="step-number">${index + 1}</span><span><strong>${e(t.title)}</strong><span class="muted">${e([t.duration, t.volume].filter(Boolean).join(' · '))}</span></span><span class="step-status">${status}</span></button>
   ${
     open
       ? `<div class="step-body"><div class="eyebrow">${stageTypes[stageType(t, section)]} · ${index + 1} из ${steps.length}</div>${t.optional ? '<p class="muted">Необязательный этап</p>' : ''}<p class="text">${e(t.instructions)}</p>
   ${m ? (read ? (m.note ? `<p class="text">Заметка: ${e(m.note)}</p>` : '') : `${hasNote ? `${previousNote?.trim() ? `<aside class="previous-note"><div class="muted">С прошлой тренировки · ${fmt(previous.date)}</div><p class="text">${e(previousNote)}</p></aside>` : ''}<label>Личная заметка<textarea data-note="${t.id}" data-visit="${visitId}" placeholder="Что получилось, что попробовать…">${e(m.note)}</textarea></label>` : ''}<div class="actions">${m.status === 'pending' ? `${button('Пропустить', `mark/${visitId}/${t.id}/skipped`)}${button('Выполнено', `mark/${visitId}/${t.id}/done`, 'primary')}` : `${button('Снять отметку', `mark/${visitId}/${t.id}/pending`)}${button('Следующий этап', `next/${visitId}/${t.id}`, 'primary')}`}</div>`) : ''}</div>`
       : ''
   }
  </article></div>`;
          })
          .join('')}</section>`,
    )
    .join('')}`;
}
function nextPending(w, stepId) {
  const ids = w.content.sections.flatMap((s) => s.steps.map((t) => t.id));
  const at = ids.indexOf(stepId);
  return (
    [...ids.slice(at + 1), ...ids.slice(0, at + 1)].find(
      (id) => w.marks[id].status === 'pending',
    ) || ''
  );
}
async function setStageStatus(visitId, stepId, status) {
  await tasks;
  const current = state.visits.find((v) => v.id === visitId)?.workout?.marks[stepId];
  if (storageError) {
    toast('Не сохранено. Повторите сохранение заметки перед отметкой', true);
    return;
  }
  if (current?.status === status && status !== 'pending') status = 'pending';
  const r = await mutate((s) => mark(s, visitId, stepId, status), false);
  if (r.ok) {
    expandedStep = nextPending(state.visits.find((v) => v.id === visitId).workout, stepId);
    render();
  }
  updateSaved(r.ok);
}
bindStageSwipes(root, setStageStatus);
function catalog(selectVisit) {
  const ps = state.programs;
  return (
    ps
      .filter((p) => !selectVisit || !p.archived)
      .map((p, i) => {
        const v = latest(state, p.id),
          completedAt = lastCompletedAt(state, p.id);
        const dateText = completedAt ? new Date(completedAt).toLocaleDateString('ru-RU') : '—';
        const label = completedAt
          ? `Последнее завершение: ${dateText}`
          : 'Завершённых тренировок пока нет';
        return `<a class="card program-card" href="#program/${p.id}${selectVisit ? `/${selectVisit}` : ''}"><span class="badge">${p.archived ? 'В архиве' : `${v.content.duration || '—'} минут · ${v.content.sections.length} разделов · ${v.content.sections.flatMap((s) => s.steps).length} этапов · Версия ${v.number}`}</span><div class="eyebrow">Программа ${String(i + 1).padStart(2, '0')}</div><h2>${e(v.content.title)}</h2><p class="muted">${e(v.content.goal)}</p><div class="program-last-completed" title="${e(label)}" aria-label="${e(label)}">${svgIcon('finish')}${completedAt ? `<time datetime="${e(completedAt)}">${e(dateText)}</time>` : '<span>—</span>'}</div></a>`;
      })
      .join('') ||
    '<section class="card">Все программы в архиве. Восстановите программу в каталоге.</section>'
  );
}
function program(id, visitId) {
  const p = state.programs.find((p) => p.id === id);
  if (!p) return '<p>Программа не найдена</p>';
  const v = latest(state, id);
  return `${visitId ? button('Начать тренировку', `start/${visitId}/${id}`, 'primary start-workout') : ''}<section class="card"><div class="program-toolbar">${iconButton('Назад', visitId ? `choose/${visitId}` : 'training', 'back')}<div class="icon-actions">${visitId ? '' : `${iconButton('Редактировать', `editor/${id}`, 'edit')}${iconButton('История версий', `versions/${id}`, 'history')}${iconButton(p.archived ? 'Восстановить из архива' : 'Архивировать', `archive-program/${id}`, p.archived ? 'restore' : 'archive')}${iconButton('К посещениям', 'home', 'visits')}`}</div></div><h1>${e(v.content.title)}</h1><p class="muted">Версия ${v.number} · ${fmt(v.savedAt)}${p.archived ? ' · В архиве' : ''}</p>${content(v.content)}</section>`;
}
function visit(id) {
  const v = state.visits.find((v) => v.id === id);
  if (!v) return '<section class="card">Посещение не найдено</section>';
  const w = v.workout,
    p = state.passes.find((p) => p.id === v.passId);
  return `<section class="card"><div class="program-toolbar">${iconButton('К посещениям', 'history', 'back')}${iconButton('Удалить посещение', `delete-visit/${id}`, 'delete')}</div><div class="eyebrow">${p.total === 1 ? 'Абонемент на 1 посещение' : 'Посещение по абонементу'}</div><h1>${fmt(v.date)}</h1>${w ? `<h2>${e(w.content.title)}</h2><p class="muted">Версия ${w.versionNumber} · ${w.status === 'active' ? 'В процессе' : 'Завершена'}</p><p class="muted">Начало: ${time(w.startedAt)}${w.completedAt ? `<br>Завершение: ${time(w.completedAt)}<br>Интервал между началом и завершением включает перерывы.` : ''}</p>${segments(w)}<progress class="sr-only" id="workout-progress" aria-label="Прогресс тренировки" aria-valuetext="Выполнено ${progress(w).done} из ${progress(w).total}" max="${progress(w).total}" value="${progress(w).done}"></progress><p class="saved" id="save-status">Сохранено на устройстве</p>${content(w.content, w, id)}<div class="actions">${w.status === 'active' ? (expandedStep === '' ? button('Завершить тренировку', `finish/${id}`, 'primary') : '') : iconButton('Возобновить тренировку', `reopen/${id}`, 'reopen', true)}</div>` : `<p class="muted">Посещение зарегистрировано. Можно выбрать тренировку или оставить его без программы.</p>${button('Начать по программе', `choose/${id}`, 'primary')}`}</section>`;
}
function editor(id) {
  const d = state.drafts.find((d) => d.programId === id);
  if (!d) return '';
  const c = d.content;
  return `<section class="card">${button('Закрыть', `program/${id}`)}<p class="saved" id="save-status">Черновик сохранён</p><form id="editor-form" data-program="${id}">${field('Название', 'title', c.title)}${area('Цель', 'goal', c.goal)}${field('Плановая продолжительность, минуты', 'duration', c.duration, 'number')}${area('Общие и технические примечания', 'notes', c.notes)}${c.sections
    .map(
      (s, si) =>
        `<div class="editor-section">${field('Название раздела', `sections.${si}.title`, s.title)}${field('Продолжительность раздела', `sections.${si}.duration`, s.duration)}<div class="actions">${button('Поднять раздел', `move-section/${id}/${si}/-1`)}${button('Опустить раздел', `move-section/${id}/${si}/1`)}${button('Удалить раздел', `remove-section/${id}/${si}`)}</div>${s.steps
          .map(
            (t, ti) =>
              `<div class="stage">${field('Название этапа', `sections.${si}.steps.${ti}.title`, t.title)}<label>Тип этапа<select data-field="sections.${si}.steps.${ti}.type">${Object.entries(
                stageTypes,
              )
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${stageType(t, s) === value ? 'selected' : ''}>${label}</option>`,
                )
                .join(
                  '',
                )}</select></label>${field('Продолжительность', `sections.${si}.steps.${ti}.duration`, t.duration)}${field('Объём', `sections.${si}.steps.${ti}.volume`, t.volume)}${area('Инструкции и технические подсказки', `sections.${si}.steps.${ti}.instructions`, t.instructions)}<label><input type="checkbox" data-field="sections.${si}.steps.${ti}.optional" ${t.optional ? 'checked' : ''}> Необязательный этап</label><div class="actions">${button('Поднять этап', `move-step/${id}/${si}/${ti}/-1`)}${button('Опустить этап', `move-step/${id}/${si}/${ti}/1`)}${button('Удалить этап', `remove-step/${id}/${si}/${ti}`)}</div></div>`,
          )
          .join('')}${button('Добавить этап', `add-step/${id}/${si}`)}</div>`,
    )
    .join(
      '',
    )}<div class="actions">${button('Сбросить черновик', `reset-draft/${id}`)}${button('Добавить раздел', `add-section/${id}`)}${button('Сохранить новую версию', `publish/${id}`, 'primary')}</div></form></section>`;
}
function versions(id) {
  return `<section class="card">${button('Закрыть', `program/${id}`)}${state.versions
    .filter((v) => v.programId === id)
    .slice()
    .reverse()
    .map(
      (v) =>
        `<div class="stage"><h3>Версия ${v.number} · ${fmt(v.savedAt)}</h3><p>${e(v.content.title)}</p><div class="actions">${button('Посмотреть', `version/${v.id}`)}${button('Восстановить как новую', `restore/${v.id}`)}</div></div>`,
    )
    .join('')}</section>`;
}
function settings() {
  return `${accountSettings()}<section class="card"><h3>Хранение данных</h3><p>История хранится в вашем аккаунте. На устройстве есть локальная копия для работы без сети; изменения отправляются на сервер автоматически.</p><p class="muted">Перенос прежней истории и резервное копирование выполняются при обслуживании сервера.</p></section><section class="card"><h3>Установка на телефон</h3><p class="muted">iPhone: Safari → «Поделиться» → «На экран Домой». Android: меню Chrome → «Установить приложение».</p><p class="muted">После первоначальной настройки история доступна без интернета.</p><p class="muted">ClimbPass · ${e(releaseVersion)}</p></section>`;
}
function render() {
  if (!state) return;
  if (record && !record.initialized) {
    root.innerHTML =
      '<main><section class="card"><h1>Первоначальная настройка</h1><p>Для загрузки истории аккаунта требуется сеть. Локальные исходные данные сохранены.</p>' +
      button('Повторить загрузку', 'retry-login') +
      '</section></main>';
    return;
  }
  const [screen, a, b] = route();
  let html;
  try {
    switch (screen) {
      case 'programs':
      case 'training':
        html = catalog();
        break;
      case 'history':
        html = history();
        break;
      case 'settings':
        html = settings();
        break;
      case 'migration':
        html = settings();
        break;
      case 'conflicts':
        html = conflictsScreen();
        break;
      case 'program':
        html = program(a, b);
        break;
      case 'choose':
        html = state.visits.some((v) => v.id === a)
          ? catalog(a)
          : '<p>Сначала зарегистрируйте посещение.</p>';
        break;
      case 'visit':
        html = visit(a);
        break;
      case 'editor':
        if (!state.drafts.some((d) => d.programId === a)) {
          mutate((s) => draft(s, a));
          return;
        }
        html = editor(a);
        break;
      case 'versions':
        html = versions(a);
        break;
      case 'version': {
        const v = state.versions.find((v) => v.id === a);
        html = v
          ? `<section class="card">${button('История версий', `versions/${v.programId}`)}<h1>${e(v.content.title)}</h1><p>Версия ${v.number} · ${fmt(v.savedAt)}</p>${content(v.content)}</section>`
          : 'Версия не найдена';
        break;
      }
      case 'edit-pass':
        html = passForm(active(state));
        break;
      default:
        html = home();
    }
  } catch (err) {
    html = `<p class="error">${e(err.message)}</p>`;
  }
  const current = ['program', 'editor', 'versions', 'version'].includes(screen)
    ? 'training'
    : ['visit', 'choose'].includes(screen)
      ? 'history'
      : names[screen]
        ? screen
        : 'home';
  const workout = screen === 'visit' ? state.visits.find((v) => v.id === a)?.workout : null;
  root.classList.toggle('workout-screen', !!workout);
  root.innerHTML = `<header class="topbar">${workout ? `${iconButton('Назад к истории', 'history', 'back')}<span class="wordmark">Занятие</span>${workout.status === 'active' ? button('Завершить', `finish/${a}`, 'top-finish') : ''}` : '<a class="wordmark" href="#home">ClimbPass</a>'}<a class="sync-status" href="#${record?.conflicts.length ? 'conflicts' : 'settings'}" aria-live="polite">${e(sync?.status || 'Сохранено на устройстве')}</a></header><main>${storageError ? '<p class="error" role="alert">Последние изменения не сохранены. Проверьте свободное место и повторите ввод.</p>' : ''}${html}</main><nav ${workout ? 'hidden' : ''} class="bottom-nav" aria-label="Основная навигация">${Object.entries(
    names,
  )
    .map(
      ([key, label]) =>
        `<button class="nav-item ${current === key ? 'active' : ''}" data-action="${key}" ${current === key ? 'aria-current="page"' : ''}><span class="cp-icon" aria-hidden="true">${symbols[key]}</span>${label}</button>`,
    )
    .join('')}</nav>`;
  root.querySelectorAll('button').forEach((b) => (b.type = 'button'));
  root.querySelector('#pass-form button.primary')?.setAttribute('type', 'submit');
}
function updateSaved(ok) {
  const el = document.querySelector('#save-status');
  if (el) {
    el.textContent = ok ? 'Сохранено на устройстве' : 'Ошибка: изменения не сохранены';
    el.className = ok ? 'saved' : 'error';
    document.querySelector('#retry-save')?.remove();
    if (!ok) {
      const retry = document.createElement('button');
      retry.id = 'retry-save';
      retry.className = 'secondary';
      retry.dataset.action = 'retry-save';
      retry.textContent = 'Повторить сохранение';
      el.after(retry);
    }
  }
}
root.addEventListener('input', async (ev) => {
  const el = ev.target;
  if (el.dataset.note) {
    const note = el.value;
    const r = await mutate(
      (s) => mark(s, el.dataset.visit, el.dataset.note, undefined, note),
      false,
    );
    updateSaved(r.ok);
  }
  const form = el.closest('#editor-form');
  if (form && el.dataset.field) {
    const path = el.dataset.field.split('.'),
      value =
        el.type === 'checkbox'
          ? el.checked
          : el.dataset.field === 'duration'
            ? el.value === ''
              ? ''
              : Number(el.value)
            : el.value;
    const r = await mutate((s) => {
      const d = draft(s, form.dataset.program);
      let obj = d.content;
      for (const k of path.slice(0, -1)) obj = obj[k];
      obj[path.at(-1)] = value;
      d.updatedAt = now();
    }, false);
    updateSaved(r.ok);
  }
});
root.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (ev.target.id !== 'pass-form') return;
  const value = (k) => ev.target.querySelector(`[data-field="${k}"]`).value;
  const startDate = value('start'),
    end = value('end'),
    total = Number(value('total'));
  if (route()[0] === 'edit-pass') {
    const pass = active(state);
    if (
      pass &&
      (end < today() || visitsFor(state, pass.id).length >= total) &&
      !(await confirmSheet('Абонемент будет завершён. Сохранить?'))
    )
      return;
  }
  const r = await mutate((s) => {
    if (route()[0] === 'edit-pass') {
      const p = active(s);
      if (!p) throw Error('Абонемент не найден');
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
        !end ||
        end < startDate ||
        ![1, 4, 8].includes(total) ||
        total < visitsFor(s, p.id).length
      )
        throw Error('Проверьте даты и лимит посещений');
      Object.assign(p, { start: startDate, end, total });
      archive(s);
    } else addPass(s, startDate, end, total);
  });
  if (r.ok) go('home');
});
root.addEventListener('click', async (ev) => {
  const target = ev.target.closest('[data-action]');
  if (!target) return;
  ev.preventDefault();
  const [action, a, b, c, d] = target.dataset.action.split('/');
  try {
    await tasks;
    if (storageError && action !== 'retry-save')
      throw Error('Не сохранено. Повторите сохранение перед переходом');
    if (
      [
        'home',
        'migration',
        'conflicts',
        'history',
        'training',
        'settings',
        'program',
        'choose',
        'visit',
        'editor',
        'versions',
        'version',
        'edit-pass',
      ].includes(action)
    ) {
      await tasks;
      if (storageError) {
        toast('Не сохранено. Повторите сохранение перед переходом', true);
        return;
      }
      go(target.dataset.action);
      return;
    }
    if (await accountAction(action, a)) return;
    if (action === 'filter') {
      historyFilter = a;
      render();
      return;
    }
    if (action === 'expand') {
      await tasks;
      if (storageError) return;
      expandedStep = expandedStep === a ? '' : a;
      render();
      return;
    }
    if (action === 'mark') {
      await setStageStatus(a, b, c);
      return;
    }
    if (action === 'next') {
      expandedStep = nextPending(state.visits.find((v) => v.id === a).workout, b);
      render();
      return;
    }
    if (action === 'add-visit') {
      const p = active(state);
      if (!p) return;
      if (
        visitsFor(state, p.id).some((v) => v.date === today()) &&
        !(await confirmSheet('Сегодня уже есть посещение. Добавить ещё одно?'))
      )
        return;
      const r = await mutate((s) => addVisit(s, p.id));
      if (r.ok) go(`visit/${r.result.id}`);
    }

    if (action === 'start') {
      const r = await mutate((s) => start(s, a, b));
      if (r.ok) go(`visit/${a}`);
    }
    if (action === 'finish') {
      const w = state.visits.find((v) => v.id === a)?.workout;
      if (!w) return;
      const p = progress(w);
      if (
        await confirmSheet(
          `Завершить тренировку? Не отмечено этапов: ${p.pending}. Выполнено: ${p.done}, пропущено: ${p.skipped}.`,
          { showClose: false },
        )
      )
        await mutate((s) => finish(s, a));
    }
    if (action === 'reopen') mutate((s) => finish(s, a, true));
    if (action === 'delete-visit') {
      const v = state.visits.find((v) => v.id === a);
      if (
        await confirmSheet(
          v.workout
            ? 'Удалить посещение вместе с тренировкой? Все отметки и заметки этой тренировки будут потеряны.'
            : 'Удалить посещение?',
        )
      ) {
        const r = await mutate((s) => deleteVisit(s, a));
        if (r.ok) go('history');
      }
    }
    if (action === 'archive-program')
      mutate((s) => {
        const p = s.programs.find((p) => p.id === a);
        p.archived = !p.archived;
      });
    if (action === 'restore') {
      const v = state.versions.find((v) => v.id === a);
      if (
        await confirmSheet(
          `Восстановить версию ${v.number} как новую? Текущий черновик будет заменён, старые версии сохранятся.`,
        )
      ) {
        const r = await mutate((s) => publish(s, v.programId, v.content));
        if (r.ok) go(`versions/${v.programId}`);
      }
    }
    if (action === 'reset-draft') {
      if (await confirmSheet('Удалить черновик и вернуться к последней опубликованной версии?'))
        await mutate((s) => {
          s.drafts = s.drafts.filter((d) => d.programId !== a);
          draft(s, a);
        });
      return;
    }
    if (action === 'publish') {
      if (storageError)
        throw Error('Сначала сохраните черновик: повторите ввод после устранения ошибки хранения');
      const r = await mutate((s) => publish(s, a, draft(s, a).content));
      if (r.ok) {
        toast('Новая версия сохранена');
        go(`program/${a}`);
      }
    }
    if (
      [
        'add-section',
        'remove-section',
        'move-section',
        'add-step',
        'remove-step',
        'move-step',
      ].includes(action)
    ) {
      if (action.startsWith('remove') && !(await confirmSheet('Удалить из черновика?'))) return;
      mutate((s) => {
        const dr = draft(s, a),
          ss = dr.content.sections;
        const move = (list, i, delta) => {
          const j = i + delta;
          if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
        };
        if (action === 'add-section')
          ss.push({ id: uid(), title: 'Новый раздел', duration: '', steps: [] });
        if (action === 'remove-section') ss.splice(+b, 1);
        if (action === 'move-section') move(ss, +b, +c);
        if (action === 'add-step')
          ss[+b].steps.push({
            id: uid(),
            title: 'Новый этап',
            duration: '',
            volume: '',
            instructions: '',
            optional: false,
            type: 'training',
          });
        if (action === 'remove-step') ss[+b].steps.splice(+c, 1);
        if (action === 'move-step') move(ss[+b].steps, +c, +d);
        dr.updatedAt = now();
      });
    }
  } catch (err) {
    toast(err.message, true);
  }
});
function accountSettings() {
  return `<section class="card"><h2>Аккаунт и синхронизация</h2><p>${e(user?.email)}</p><p aria-live="polite">${e(sync?.status || 'Нет сети')}</p>${sync?.error ? `<p class="error">${e(sync.error)}</p>` : ''}<p>Ожидает отправки: ${record?.outbox.length || 0}. Конфликтов: ${record?.conflicts.length || 0}.</p><div class="actions">${button('Синхронизировать', 'sync', 'primary')}${button('Войти через Google', 'login')}${button('Выйти из аккаунта', 'logout')}${button('Разрешить конфликты', 'conflicts')}</div></section>`;
}
function presentConflict(value) {
  if (value === null || value === undefined) return '<p>Запись отсутствует</p>';
  if (typeof value !== 'object')
    return `<span class="text">${e(value === true ? 'Да' : value === false ? 'Нет' : value)}</span>`;
  const labels = {
    item: 'Запись',
    title: 'Название',
    goal: 'Цель',
    notes: 'Примечания',
    note: 'Заметка',
    status: 'Статус',
    start: 'Начало',
    end: 'Окончание',
    total: 'Лимит посещений',
    date: 'Дата',
    content: 'Содержание',
    sections: 'Разделы',
    steps: 'Этапы',
    instructions: 'Инструкция',
    duration: 'Продолжительность',
    volume: 'Объём',
    optional: 'Необязательный',
    type: 'Тип этапа',
    number: 'Версия',
    savedAt: 'Сохранено',
    updatedAt: 'Обновлено',
    startedAt: 'Начало занятия',
    completedAt: 'Завершение',
    archived: 'В архиве',
    marks: 'Результаты',
  };
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i + 1), v])
    : Object.entries(value).filter(([k]) => k !== 'order' && !k.endsWith('Id') && k !== 'id');
  return `<dl>${entries.map(([k, v]) => `<dt>${e(labels[k] || k)}</dt><dd>${presentConflict(v)}</dd>`).join('')}</dl>`;
}
function conflictsScreen() {
  const differences = changes(record.confirmed, record.state);
  return `<section class="card"><h1>Конфликты синхронизации</h1>${record.conflicts.length ? `<p>Обе редакции и ожидающие изменения сохранены на устройстве. Выберите редакцию для синхронизации.</p>${record.conflicts.map((c) => `<p class="error">${e(c.reason)}</p>`).join('')}${differences.map((change) => `<div class="conflict-columns"><section><h2>На устройстве</h2>${presentConflict(change.after?.item ?? change.after)}</section><section><h2>На сервере</h2>${presentConflict(change.before?.item ?? change.before)}</section></div>`).join('')}<p>Выбор применяется ко всей ожидающей ветке. Предыдущие редакции сохранятся на этом устройстве.</p><div class="actions">${button('Сохранить редакцию устройства', 'resolve-local', 'primary')}${button('Принять серверную историю', 'resolve-server')}</div>` : '<p>Конфликтов нет.</p>'}</section>`;
}
function loginScreen(reason = '') {
  state = undefined;
  root.innerHTML = `<main><section class="card login"><div class="wordmark">ClimbPass</div><h1>Ваши тренировки на всех устройствах</h1><p>Войдите через Google. Первый вход требует сети и разрешённого доступа. После настройки история и тренировки доступны офлайн.</p>${reason ? `<p class="error" role="alert">${e(reason)}</p>` : ''}${button('Войти через Google', 'login', 'google-login')}${button('Повторить проверку входа', 'retry-login')}</section></main>`;
}
async function boot() {
  sync?.stop();
  repository?.close();
  root.innerHTML = '<main><p role="status">Открываем локальную историю…</p></main>';
  try {
    if (!navigator.locks)
      throw Error(
        'Браузер не поддерживает безопасную работу с несколькими вкладками. Обновите браузер.',
      );
    let session;
    try {
      session = await api('/api/session');
      localStorage.setItem('climbpass-account', JSON.stringify(session.user));
    } catch (err) {
      const cached = localStorage.getItem('climbpass-account');
      // A known expired session retains offline access. A new account is selected
      // only after a successful server session check.
      if (cached && (err.status === 401 || err.status === 403 || !navigator.onLine || !err.status))
        session = { user: JSON.parse(cached), offline: true };
      else throw err;
    }
    user = session.user;
    repository = await openLocal(user.id, () =>
      toast('Закройте другие вкладки ClimbPass для обновления локальной базы', true),
    );
    record = await repository.read();
    state = record.state;
    sync = new Sync(repository, user, async () => {
      const next = await repository.read();
      record = next;
      const changed = JSON.stringify(state) !== JSON.stringify(next.state);
      state = next.state;
      const editing = document.activeElement?.matches('textarea,input,select');
      if (changed && !editing && !storageError) render();
      document.querySelectorAll('.sync-status').forEach((el) => {
        el.textContent = sync.status;
        el.href = record.conflicts.length ? '#conflicts' : '#settings';
      });
    });
    channel?.close();
    channel = new BroadcastChannel(`climbpass-${user.id}`);
    channel.onmessage = async () => {
      await tasks;
      record = await repository.read();
      state = record.state;
      if (!document.activeElement?.matches('textarea,input,select') && !storageError) render();
    };
    window.addEventListener('online', () => sync.run());
    window.addEventListener('offline', () => {
      sync.status = 'Нет сети';
      document.querySelectorAll('.sync-status').forEach((el) => (el.textContent = sync.status));
    });
    if (session.offline) sync.status = navigator.onLine ? 'Нужно войти' : 'Нет сети';
    render();
    await sync.run();
    record = await repository.read();
    state = record.state;
    render();
    const error = location.hash.startsWith('#login/') ? location.hash.split('/')[1] : null;
    if (error)
      toast(
        error === 'denied'
          ? 'Доступ к этому аккаунту не разрешён'
          : error === 'setup'
            ? 'Google OAuth ещё не настроен'
            : 'Не удалось войти. Повторите вход',
        true,
      );
  } catch (err) {
    loginScreen(err.message);
  }
}
async function accountAction(action) {
  if (action === 'login') {
    await tasks;
    if (storageError) throw Error('Сначала сохраните введённый текст');
    if (repository) {
      record = await repository.read();
      if (!canLogout(record)) {
        if (
          !(await confirmSheet(
            'Открыть вход в аккаунт? Неотправленные изменения останутся на этом устройстве в текущем аккаунте и отправятся после повторного входа в него.',
          ))
        )
          return true;
      }
    }
    localStorage.removeItem('climbpass-account');
    location.href = '/auth/google';
    return true;
  }
  if (action === 'retry-save') {
    const notes = [...root.querySelectorAll('[data-note]')].map((el) => ({
      visit: el.dataset.visit,
      step: el.dataset.note,
      value: el.value,
    }));
    const form = root.querySelector('#editor-form'),
      fields = form
        ? [...form.querySelectorAll('[data-field]')].map((el) => ({
            path: el.dataset.field.split('.'),
            value:
              el.type === 'checkbox'
                ? el.checked
                : el.dataset.field === 'duration'
                  ? el.value === ''
                    ? ''
                    : Number(el.value)
                  : el.value,
          }))
        : [];
    const r = await mutate((s) => {
      for (const note of notes) mark(s, note.visit, note.step, undefined, note.value);
      if (form) {
        const d = draft(s, form.dataset.program);
        for (const field of fields) {
          let obj = d.content;
          for (const k of field.path.slice(0, -1)) obj = obj[k];
          obj[field.path.at(-1)] = field.value;
        }
        d.updatedAt = now();
      }
    }, false);
    updateSaved(r.ok);
    return true;
  }
  if (action === 'retry-login') {
    await boot();
    return true;
  }
  if (action === 'sync') {
    await tasks;
    await sync.run();
    render();
    return true;
  }
  if (action === 'logout') {
    await tasks;
    await sync.run();
    record = await repository.read();
    if (!canLogout(record)) {
      if (
        !(await confirmSheet(
          'Есть неотправленные изменения. Они останутся на этом устройстве в текущем аккаунте. Выйти без отправки? Не очищайте данные браузера до синхронизации.',
        ))
      )
        return true;
    } else if (
      !(await confirmSheet(
        'Выйти из аккаунта? Локальная копия останется на этом устройстве и откроется только после входа в тот же аккаунт.',
      ))
    )
      return true;
    try {
      const auth = await api('/api/session');
      if (auth.user.id === user.id)
        await api('/api/logout', {
          method: 'POST',
          headers: { 'X-CSRF-Token': auth.csrf },
          body: '{}',
        });
    } catch (err) {
      if (![401, 403].includes(err.status)) throw err;
    }
    sync.stop();
    repository.close();
    channel?.close();
    localStorage.removeItem('climbpass-account');
    state = undefined;
    user = null;
    record = null;
    loginScreen();
    return true;
  }
  if (action === 'resolve-local' || action === 'resolve-server') {
    if (
      !(await confirmSheet(
        action === 'resolve-local'
          ? 'Заменить облачную историю всей локальной редакцией? При новых серверных изменениях проверка повторится.'
          : 'Принять серверную историю и убрать все ожидающие операции из рабочей очереди? Обе редакции останутся сохранены на этом устройстве.',
      ))
    )
      return true;
    await sync.locked(async () => {
      record = await repository.read();
      const branch = clone(record.state);
      const current = await api('/api/sync');
      if (current.cursor !== record.cursor) {
        record = await repository.write({
          ...rebase(record, current),
          conflicts: record.conflicts,
        });
        state = record.state;
        toast(
          'Серверная история снова изменилась. Сравните обновлённые редакции перед выбором',
          true,
        );
        return;
      }
      let next = {
        ...record,
        state: current.state,
        confirmed: current.state,
        revisions: current.revisions,
        localRevisions: current.revisions,
        cursor: current.cursor,
        outbox: [],
        conflicts: [],
        resolutions: [
          ...(record.resolutions || []),
          {
            resolvedAt: now(),
            choice: action,
            state: clone(record.state),
            confirmed: clone(record.confirmed),
            outbox: clone(record.outbox),
            conflicts: clone(record.conflicts),
          },
        ],
      };
      if (action === 'resolve-local') {
        const text = JSON.stringify(branch),
          hash = [
            ...new Uint8Array(
              await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
            ),
          ]
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        next = enqueue(next, branch, {
          mode: 'restore',
          expectedCursor: current.cursor,
          sourceHash: hash,
        });
      }
      record = await repository.write(next);
      state = record.state;
    });
    render();
    sync.run();
    return true;
  }
  return false;
}

let lastRoute = location.hash;
window.addEventListener('hashchange', async () => {
  await tasks;
  if (storageError) {
    history.replaceState(null, '', lastRoute);
    toast('Не сохранено. Повторите сохранение перед переходом', true);
    return;
  }
  if (lastRoute === '#history') historyPositions.set(historyFilter, window.scrollY);
  if (!location.hash.startsWith('#visit/')) expandedStep = null;
  lastRoute = location.hash;
  render();
  window.scrollTo(0, location.hash === '#history' ? historyPositions.get(historyFilter) || 0 : 0);
});
window.addEventListener('beforeunload', (ev) => {
  if (storageError) {
    ev.preventDefault();
    ev.returnValue = '';
  }
});
if (window.visualViewport) {
  const viewport = window.visualViewport;
  const resize = () => {
    const offset = Math.max(0, innerHeight - viewport.height - viewport.offsetTop);
    document.body.classList.toggle('keyboard-open', offset > 150);
    document.documentElement.style.setProperty(
      '--keyboard-offset',
      `${offset > 150 ? offset : 0}px`,
    );
  };
  viewport.addEventListener('resize', resize);
  viewport.addEventListener('scroll', resize);
}
window.addEventListener('focus', () => sync?.run());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) sync?.run();
});
try {
  releaseVersion = (
    await (
      await fetch('./release.json', { cache: 'no-store', signal: AbortSignal.timeout(2000) })
    ).json()
  ).version;
} catch {}
await boot();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js')
    .then((r) => r.update())
    .catch(() => toast('Офлайн-версия пока недоступна', true));
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !storageError) location.reload();
    hadController = true;
  });
}
