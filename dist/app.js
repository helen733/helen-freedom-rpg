import { createState, stats, setTaskDone, advanceDay, validateState } from './state.js';

const KEY = 'helen-freedom-rpg-v1';
const $ = id => document.getElementById(id);
let state = createState(), selectedDay = 0, blockedSave = false, pendingImport, installPrompt, toastTimer, persistedRaw = null;
try {
  const raw = localStorage.getItem(KEY);
  if (raw !== null) state = validateState(JSON.parse(raw));
  persistedRaw = raw;
} catch {
  blockedSave = true;
  warning('原存档无法读取，已保留原数据。当前显示临时进度；请先导出存档，或恢复一份有效备份。');
}
selectedDay = state.currentDay;

function warning(message) { $('storage-warning').textContent = message; $('storage-warning').hidden = false; }
function acceptExternalSave(raw) {
  state = raw === null ? createState() : validateState(JSON.parse(raw));
  persistedRaw = raw;
  selectedDay = Math.min(selectedDay, state.currentDay);
  render();
}
function save(replace = false) {
  if (blockedSave) return false;
  try {
    const latest = localStorage.getItem(KEY);
    if (!replace && latest !== persistedRaw) {
      acceptExternalSave(latest);
      toast('另一窗口刚更新了进度，已同步。请重新进行这次操作。');
      return false;
    }
    const raw = JSON.stringify(state);
    localStorage.setItem(KEY, raw);
    persistedRaw = raw;
    $('save-status').textContent = '进度已保存在这台设备 · V0.1';
    $('storage-warning').hidden = true;
    return true;
  } catch {
    warning('浏览器未能保存进度。请允许网站存储，并及时导出存档，避免关闭页面后丢失。');
    $('save-status').textContent = '当前进度尚未保存，请导出存档';
    return false;
  }
}
function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}
function message(title, body, button = '继续我的冒险') {
  $('dialog-title').textContent = title;
  $('dialog-message').textContent = body;
  $('dialog-close').textContent = button;
  if (!$('message-dialog').open) $('message-dialog').showModal();
}
function renderSummary() {
  const s = stats(state);
  const done = state.days[selectedDay].filter(t => t.done).length;
  $('level').textContent = `Lv.${s.level} ${['新手破解者', '行动破解者', '规律探索者', '策略实践者', '自由开拓者'][Math.min(s.level - 1, 4)]}`;
  $('xp-label').textContent = `${s.xp} / 100 XP`;
  $('xp-bar').value = s.xp;
  $('reward-progress').textContent = `${s.completedDays} / 7`;
  $('reward-bar').value = s.completedDays;
  $('chapter-progress').textContent = `${s.completedDays} / 7 天完成`;
  document.querySelector('.quest-status').textContent = s.completedDays === 7 ? '已通关' : '进行中';
  $('reward-lock').textContent = state.rewardClaimed ? '已领取' : s.canClaim ? '已解锁' : '未解锁';
  $('claim-reward').disabled = !s.canClaim;
  $('claim-reward').textContent = state.rewardClaimed ? '已领取 · 把奖励留给自己' : s.canClaim ? '开启青铜宝箱' : '完成挑战后开启';
  $('day-title').textContent = `Day ${selectedDay + 1}`;
  $('today-count').textContent = `${done} / 3 完成`;
  const next = $('next-day');
  if (selectedDay < state.currentDay) {
    next.disabled = false; next.textContent = `回到 Day ${state.currentDay + 1} →`;
  } else {
    next.disabled = done < 3 || selectedDay === 6;
    next.textContent = selectedDay === 6 ? (s.completedDays === 7 ? '7 天挑战已通关 ✓' : '最后一关，继续行动') : done === 3 ? `开启 Day ${selectedDay + 2} →` : '完成今日任务 →';
  }
  $('day-hint').textContent = s.completedDays === 7 ? '你完成了一次真实的行动旅程。去开启宝箱吧。' : done === 3 ? '这一关完成了。按自己的节奏，准备好再前进。' : '不必一次做到最好，先完成一小步。';
  renderDays();
}
function renderDays() {
  $('days').replaceChildren(...state.days.map((day, i) => {
    const button = document.createElement('button');
    button.className = `day${day.every(t => t.done) ? ' is-complete' : ''}`;
    button.textContent = day.every(t => t.done) ? `D${i + 1} ✓` : `D${i + 1}`;
    button.setAttribute('aria-label', `Day ${i + 1}${day.every(t => t.done) ? '，已完成' : i > state.currentDay ? '，未解锁' : ''}`);
    if (i === selectedDay) button.setAttribute('aria-current', 'step');
    button.disabled = i > state.currentDay;
    button.addEventListener('click', () => { selectedDay = i; render(); });
    return button;
  }));
}
function fitTextarea(input) { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; }
function renderTasks() {
  $('tasks').replaceChildren(...state.days[selectedDay].map((task, i) => {
    const row = document.createElement('div');
    row.className = `task${task.done ? ' done' : ''}`;
    const wrap = document.createElement('label'); wrap.className = 'check-wrap';
    const check = document.createElement('input'); check.type = 'checkbox'; check.className = 'task-check'; check.checked = task.done;
    check.setAttribute('aria-label', `任务 ${i + 1}：${task.done ? '已完成，点击撤销' : '未完成，点击完成'}`);
    wrap.append(check);
    const editor = document.createElement('div'); editor.className = 'task-editor';
    const label = document.createElement('label'); label.className = 'task-label'; label.textContent = `任务 ${String(i + 1).padStart(2, '0')} · 可编辑`; label.htmlFor = `task-${i}`;
    const input = document.createElement('textarea'); input.id = `task-${i}`; input.rows = 1; input.maxLength = 160; input.value = task.text;
    input.placeholder = ['写下一个今天要验证的想法…', '写下一个能接触真实需求的行动…', '写下一个推动成交的小步骤…'][i];
    const xp = document.createElement('span'); xp.className = 'task-xp'; xp.textContent = task.done ? '✓ 20 XP' : '+20 XP';
    input.addEventListener('input', () => {
      task.text = input.value;
      if (!task.text.trim()) { task.done = false; check.checked = false; }
      row.classList.toggle('done', task.done);
      xp.textContent = task.done ? '✓ 20 XP' : '+20 XP';
      check.setAttribute('aria-label', `任务 ${i + 1}：${task.done ? '已完成，点击撤销' : '未完成，点击完成'}`);
      fitTextarea(input); save(); renderSummary();
    });
    check.addEventListener('change', () => {
      const before = stats(state).level;
      if (!setTaskDone(state, selectedDay, i, check.checked)) { check.checked = false; toast('先写下一项具体任务，再完成它。'); input.focus(); return; }
      const completed = check.checked;
      if (!save()) { render(); return; }
      render();
      // Keep keyboard focus on the checkbox after refreshing its label and state.
      $('tasks').querySelectorAll('input')[i].focus({ preventScroll: true });
      if (stats(state).level > before) message(`升级啦 · Lv.${stats(state).level}`, '恭喜，你完成了一次现实世界破解。\n每一次行动，都在帮你找回掌控感。');
      else toast(completed ? '+20 XP · 一次真实行动，已记下。' : '已撤销完成，对应经验已扣回。');
    });
    editor.append(label, input); row.append(wrap, editor, xp); return row;
  }));
  $('tasks').querySelectorAll('textarea').forEach(fitTextarea);
}
function render() { renderSummary(); renderTasks(); }
$('next-day').addEventListener('click', () => {
  if (selectedDay < state.currentDay) selectedDay = state.currentDay;
  else if (advanceDay(state)) { selectedDay = state.currentDay; save(); }
  render(); $('daily-title').scrollIntoView({ block: 'start' });
});
$('claim-reward').addEventListener('click', () => {
  if (!stats(state).canClaim) return;
  state.rewardClaimed = true;
  if (!save()) { renderSummary(); return; }
  renderSummary();
  message('青铜宝箱已开启', '7 天挑战完成！\n给自己安排 500 元自由奖励基金。\n这份奖励由你自行预留和使用，纪念这次真实的通关。', '收下这份成就');
});
$('dialog-close').addEventListener('click', () => $('message-dialog').close());
$('export').addEventListener('click', () => {
  let data = JSON.stringify(state, null, 2);
  if (blockedSave) { try { data = localStorage.getItem(KEY) || data; } catch {} }
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `海伦自由人生-存档-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast('存档已导出，请保存在安全的位置。');
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 100000) throw new Error('存档文件过大');
    pendingImport = validateState(JSON.parse(await file.text()));
    $('restore-dialog').showModal();
  } catch { message('这份存档无法恢复', '请选择本应用导出的有效 JSON 存档。当前进度未改变。', '知道了'); }
  event.target.value = '';
});
$('restore-cancel').addEventListener('click', () => { pendingImport = null; $('restore-dialog').close(); });
$('restore-confirm').addEventListener('click', () => {
  if (!pendingImport) return;
  state = pendingImport; pendingImport = null; selectedDay = state.currentDay; blockedSave = false;
  const saved = save(true); render(); $('restore-dialog').close(); toast(saved ? '存档已恢复。欢迎回来。' : '已载入存档，但浏览器未能保存，请保留备份。');
});
window.addEventListener('storage', event => {
  if ((event.key !== KEY && event.key !== null) || blockedSave) return;
  try {
    const latest = localStorage.getItem(KEY);
    if (latest === persistedRaw) return;
    acceptExternalSave(latest);
    toast('另一窗口已更新进度，已同步。');
  } catch {
    blockedSave = true;
    warning('另一窗口的存档无法读取，已暂停自动保存。请导出原始存档或恢复有效备份。');
    $('save-status').textContent = '自动保存已暂停 · 原存档已保留';
  }
});
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
$('install').addEventListener('click', async () => {
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) { toast('你已经在桌面应用中啦。'); return; }
  if (installPrompt) { await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; return; }
  message('把冒险放到手机桌面', 'iPhone：用 Safari 打开，点“分享”→“添加到主屏幕”。\n安卓：打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。\n\n安装与离线功能需要 HTTPS 地址；局域网 HTTP 地址仅支持在线预览。', '知道了');
});
render();
if (blockedSave) $('save-status').textContent = '当前为临时进度 · 原存档已保留';
if ('serviceWorker' in navigator && window.isSecureContext && /^https?:$/.test(location.protocol)) {
  $('pwa-status').hidden = false;
  $('pwa-status').textContent = '正在准备离线使用…';
  const markOfflineReady = () => { $('pwa-status').textContent = '离线已就绪 · 数据保存在本机'; };
  const reportPwaFailure = reason => {
    $('pwa-status').textContent = '离线尚未就绪，请联网重试';
    const detail = `离线资源加载失败：请检查 sw.js、manifest.webmanifest 和 icons/ 是否完整上传。当前页面仍可在线使用。详情：${reason}`;
    if (window.helenLoadCheck) window.helenLoadCheck.report('PWA', detail);
    else toast(detail);
  };
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
    const watchInstallation = () => {
      const worker = registration.installing;
      if (!worker) return;
      const checkState = () => {
        if (worker.state === 'activated') {
          worker.removeEventListener('statechange', checkState);
          markOfflineReady();
        }
        if (worker.state === 'redundant') {
          reportPwaFailure(registration.active ? '离线缓存更新失败，已有离线版本暂时保留。' : '离线缓存安装失败，部分资源缺失或浏览器拒绝缓存。');
        }
      };
      worker.addEventListener('statechange', checkState);
      checkState();
    };
    registration.addEventListener('updatefound', watchInstallation);
    watchInstallation();
    if (registration.active) markOfflineReady();
    if (!registration.installing && !registration.waiting && !registration.active) reportPwaFailure('离线缓存安装未完成。');
  }).catch(error => reportPwaFailure(error.message));
}
