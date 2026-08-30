/* =========================================================================
   TIME — 24-hour life-state tracker
   Data model: an ordered list of "change points". Each change point is
   {id, time (ms epoch), state}. The segment between two consecutive change
   points has the state of the earlier one. The very last change point
   describes the still-ongoing (active) state. Because segments are always
   derived from adjacent change points, there can never be a gap or an
   overlap — Rules 1/2/11 are true by construction, not by validation.
   ========================================================================= */

const STORE_KEY = 'time_app_data_v1';

const ICONS = {
  Evolution: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/></svg>',
  Exercise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7v10"/><path d="M4 9v6"/><path d="M18 7v10"/><path d="M20 9v6"/><path d="M6 12h12"/></svg>',
  Relax: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5"/><path d="M4 18h16"/><path d="M4 14V9a2 2 0 0 1 2-2h2v5"/><path d="M16 12V7h2a2 2 0 0 1 2 2v5"/></svg>',
  Sleep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.5A8.5 8.5 0 1 1 11.5 3a6.5 6.5 0 0 0 9.5 9.5z"/></svg>',
  Relationship: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 8.6c0 4.4-8.8 10.4-8.8 10.4S3.2 13 3.2 8.6a4.6 4.6 0 0 1 8.8-1.8 4.6 4.6 0 0 1 8.8 1.8z"/></svg>',
  Work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>'
};

// Fixed order used everywhere: grid, chips, stats bars.
const STATES = [
  { key: 'Evolution',    css: '--c-evolution' },
  { key: 'Exercise',     css: '--c-exercise' },
  { key: 'Relax',        css: '--c-relax' },
  { key: 'Sleep',        css: '--c-sleep' },
  { key: 'Relationship', css: '--c-relationship' },
  { key: 'Work',         css: '--c-work' },
];
const STATE_KEYS = STATES.map(s => s.key);

function stateColor(key){
  return getComputedStyle(document.documentElement).getPropertyValue(STATES.find(s=>s.key===key).css).trim();
}

/* --------------------------- persistence --------------------------- */

function loadStore(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return { changePoints: [] };
    const parsed = JSON.parse(raw);
    if(!Array.isArray(parsed.changePoints)) return { changePoints: [] };
    return parsed;
  }catch(e){
    console.error('Failed to load TIME data', e);
    return { changePoints: [] };
  }
}
function saveStore(){
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

let store = loadStore();
let idCounter = 0;
function genId(){ idCounter += 1; return `${Date.now()}_${idCounter}`; }

/* ------------------------------ core logic ------------------------------ */

// Rule 3 / 4 / 5 / 7: click new state = end previous + start new, using
// timestamps; clicking the already-active state is a no-op.
function switchState(newState){
  const cps = store.changePoints;
  const last = cps[cps.length - 1];
  if(last && last.state === newState) return false; // Rule 4
  cps.push({ id: genId(), time: Date.now(), state: newState });
  saveStore();
  return true;
}

function hasStarted(){ return store.changePoints.length > 0; }

// All segments (state, start, end) derived from change points, including
// the still-open final one, clipped to "now".
function getAllSegments(nowMs){
  const cps = store.changePoints;
  const segs = [];
  for(let i = 0; i < cps.length - 1; i++){
    segs.push({
      state: cps[i].state,
      start: cps[i].time,
      end: cps[i+1].time,
      changeIndexStart: i,
      changeIndexEnd: i + 1,
      ongoing: false,
    });
  }
  if(cps.length > 0){
    const lastIdx = cps.length - 1;
    segs.push({
      state: cps[lastIdx].state,
      start: cps[lastIdx].time,
      end: nowMs,
      changeIndexStart: lastIdx,
      changeIndexEnd: null,
      ongoing: true,
    });
  }
  return segs;
}

function pad2(n){ return String(n).padStart(2, '0'); }

function dateKeyFromDate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function todayKey(){ return dateKeyFromDate(new Date()); }
function shiftDateKey(key, delta){
  const [y,m,d] = key.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() + delta);
  return dateKeyFromDate(dt);
}
function dayBounds(key){
  const [y,m,d] = key.split('-').map(Number);
  const start = new Date(y, m-1, d, 0,0,0,0).getTime();
  const end = start + 86400000;
  return { start, end };
}
function isToday(key){ return key === todayKey(); }
function isFutureDay(key){ return dayBounds(key).start > Date.now(); }

// Rule 6/9: clip the full timeline to one calendar day for stats/history.
function getDaySegments(dateKey){
  const { start, end } = dayBounds(dateKey);
  const nowMs = Date.now();
  const rangeEnd = Math.min(end, nowMs);
  if(rangeEnd <= start) return [];
  const all = getAllSegments(nowMs);
  return all
    .filter(s => s.start < end && s.end > start)
    .map(s => ({
      ...s,
      clipStart: Math.max(s.start, start),
      clipEnd: Math.min(s.end, rangeEnd),
    }))
    .filter(s => s.clipEnd > s.clipStart)
    .sort((a,b) => a.clipStart - b.clipStart);
}

function getDailyTotals(dateKey){
  const totals = {};
  STATE_KEYS.forEach(k => totals[k] = 0);
  let coveredMs = 0;
  getDaySegments(dateKey).forEach(seg => {
    const dur = seg.clipEnd - seg.clipStart;
    totals[seg.state] = (totals[seg.state] || 0) + dur;
    coveredMs += dur;
  });
  return { totals, coveredMs };
}

/* ------------------------------ formatting ------------------------------ */

function formatHMS(ms){
  const total = Math.max(0, Math.floor(ms/1000));
  const hh = Math.floor(total/3600);
  const mm = Math.floor((total%3600)/60);
  const ss = total%60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}
function formatHM(ms){
  const totalMin = Math.round(ms/60000);
  const hh = Math.floor(totalMin/60);
  const mm = totalMin%60;
  if(hh === 0) return `${mm}m`;
  return `${hh}h ${mm}m`;
}
function formatClock(ms){
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function formatClockSec(ms){
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function formatClockEdge(ms, dayEndMs){
  return ms === dayEndMs ? '24:00' : formatClock(ms);
}
function formatDateLabel(dateKey){
  const [y,m,d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const base = `${m}/${d} (${weekday})`;
  if(isToday(dateKey)) return `${base} · Today`;
  if(dateKey === shiftDateKey(todayKey(), -1)) return `${base} · Yesterday`;
  return base;
}

/* -------------------------------- toast -------------------------------- */
let toastTimer = null;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.add('hidden'), 2200);
}

/* ------------------------------- rendering ------------------------------- */

let currentPage = 'now';
let historyDateKey = todayKey();
let statsDateKey = todayKey();
let tickCount = 0;

const nowButtons = {}; // state -> {btn, durationEl}

function buildStateButton(key, { onboard=false } = {}){
  const btn = document.createElement('button');
  btn.className = 'state-btn';
  btn.dataset.state = key;
  btn.innerHTML = `
    <span class="icon">${ICONS[key]}</span>
    <span class="label">${key}</span>
    <span class="duration"></span>
  `;
  btn.addEventListener('click', () => {
    const changed = switchState(key);
    if(onboard){
      enterMainApp();
    }else if(changed){
      updateNowUI();
      if(currentPage === 'history' && isToday(historyDateKey)) renderHistory();
    }
  });
  return btn;
}

function buildOnboardingGrid(){
  const grid = document.getElementById('onboardingGrid');
  grid.innerHTML = '';
  STATES.forEach(s => grid.appendChild(buildStateButton(s.key, { onboard: true })));
}

function buildNowGrid(){
  const grid = document.getElementById('nowGrid');
  grid.innerHTML = '';
  STATES.forEach(s => {
    const btn = buildStateButton(s.key);
    grid.appendChild(btn);
    nowButtons[s.key] = { btn, durationEl: btn.querySelector('.duration') };
  });
}

function updateNowUI(){
  const cps = store.changePoints;
  if(cps.length === 0) return;
  const last = cps[cps.length - 1];
  const now = Date.now();
  const dur = now - last.time;

  document.getElementById('activeStateName').textContent = last.state;
  document.getElementById('activeTimer').textContent = formatHMS(dur);

  STATE_KEYS.forEach(key => {
    const { btn, durationEl } = nowButtons[key];
    const active = key === last.state;
    btn.classList.toggle('active', active);
    durationEl.textContent = active ? formatHMS(dur) : '';
  });
}

/* --------------------------------- history --------------------------------- */

function renderHistory(){
  document.getElementById('histDateBtn').textContent = formatDateLabel(historyDateKey);
  document.getElementById('histDateInput').value = historyDateKey;
  document.getElementById('histNext').disabled = isToday(historyDateKey);

  const list = document.getElementById('historyList');
  const segs = getDaySegments(historyDateKey);
  const { end: dayEnd } = dayBounds(historyDateKey);

  if(segs.length === 0){
    list.innerHTML = `<div class="empty-state">這一天還沒有任何時間紀錄。</div>`;
    return;
  }

  list.innerHTML = '';
  segs.forEach(seg => {
    const row = document.createElement('div');
    row.className = 'segment-row';
    const startsInDay = seg.clipStart === seg.start;
    const endsInDay = !seg.ongoing && seg.clipEnd === seg.end;
    const continuesNote = [];
    if(!startsInDay) continuesNote.push('接續前一天');
    if(!endsInDay && !seg.ongoing) continuesNote.push('延續至隔天');

    row.innerHTML = `
      <div class="segment-bar" style="background:${stateColor(seg.state)}"></div>
      <div class="segment-main">
        <div class="segment-state">${seg.state}${seg.ongoing && isToday(historyDateKey) ? '<span class="segment-ongoing-tag">NOW</span>' : ''}</div>
        <div class="segment-time">${formatClockEdge(seg.clipStart, dayEnd)}–${formatClockEdge(seg.clipEnd, dayEnd)}</div>
        ${continuesNote.length ? `<div class="continuation-note">${continuesNote.join(' · ')}</div>` : ''}
      </div>
      <div class="segment-dur">${formatHM(seg.clipEnd - seg.clipStart)}</div>
    `;
    row.addEventListener('click', () => openEditModal(seg));
    list.appendChild(row);
  });
}

/* --------------------------------- stats --------------------------------- */

function renderStats(){
  document.getElementById('statsDateBtn').textContent = formatDateLabel(statsDateKey);
  document.getElementById('statsDateInput').value = statsDateKey;
  document.getElementById('statsNext').disabled = isToday(statsDateKey);

  const body = document.getElementById('statsBody');
  const complete = !isToday(statsDateKey) && !isFutureDay(statsDateKey);
  const { totals, coveredMs } = getDailyTotals(statsDateKey);
  const pct = (ms) => coveredMs > 0 ? (ms / 86400000 * 100) : 0;

  let html = '';
  if(isToday(statsDateKey)){
    html += `<div class="stats-banner">今天尚未結束——正式統計會在 00:00 結算後產生。以下為即時預覽（非正式，加總不會是 100%）。</div>`;
  }

  const totalLabel = complete ? '24:00:00 · 100%' : `${formatHMS(coveredMs)} 已記錄`;
  html += `<div class="stats-total"><div class="big">${totalLabel.split(' · ')[0]}</div><div class="small">${complete ? '一天已完整結算' : (totalLabel.split(' · ')[1]||'進行中')}</div></div>`;

  STATES.forEach(s => {
    const ms = totals[s.key] || 0;
    const p = pct(ms);
    html += `
      <div class="bar-row">
        <div class="bar-row-head">
          <span class="bar-row-name" style="color:${stateColor(s.key)}">${s.key}</span>
          <span class="bar-row-meta">${formatHM(ms)} · ${p.toFixed(1)}%</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${p}%;background:${stateColor(s.key)}"></div></div>
      </div>
    `;
  });

  body.innerHTML = html;
}

/* ------------------------------ edit modal ------------------------------ */

let editCtx = null; // the segment currently being edited

function combineDateTime(dateKey, hhmmss){
  const [y,m,d] = dateKey.split('-').map(Number);
  const [hh,mm,ss] = hhmmss.split(':').map(Number);
  return new Date(y, m-1, d, hh, mm, ss||0, 0).getTime();
}
function timeInputValue(ms){
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function buildChipRow(container, selectedKey, onSelect){
  container.innerHTML = '';
  let current = selectedKey;
  STATES.forEach(s => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (s.key === selectedKey ? ' selected' : '');
    chip.textContent = s.key;
    chip.style.borderColor = stateColor(s.key);
    if(s.key === selectedKey){ chip.style.background = stateColor(s.key); }
    chip.addEventListener('click', () => {
      current = s.key;
      [...container.children].forEach(c => {
        const k = c.textContent;
        const sel = k === current;
        c.classList.toggle('selected', sel);
        c.style.background = sel ? stateColor(k) : '';
      });
      onSelect(current);
    });
    container.appendChild(chip);
  });
  return () => current;
}

function openEditModal(seg){
  editCtx = seg;
  let selectedState = seg.state;
  const getSelectedState = buildChipRow(document.getElementById('editStateChips'), seg.state, (v)=> selectedState = v);
  editCtx._getSelectedState = getSelectedState;

  const startInput = document.getElementById('editStart');
  const endInput = document.getElementById('editEnd');
  const hint = document.getElementById('editHint');
  const err = document.getElementById('editError');
  err.classList.add('hidden');

  const startEditable = seg.clipStart === seg.start;
  const endEditable = !seg.ongoing && seg.clipEnd === seg.end;

  startInput.value = timeInputValue(seg.clipStart);
  startInput.disabled = !startEditable;
  endInput.value = seg.ongoing ? '' : timeInputValue(seg.clipEnd);
  endInput.disabled = !endEditable;
  endInput.placeholder = seg.ongoing ? '進行中' : '';

  const notes = [];
  if(!startEditable) notes.push('開始時間屬於前一天，請至前一天編輯');
  if(seg.ongoing) notes.push('此狀態仍在進行中，結束時間無法編輯');
  else if(!endEditable) notes.push('結束時間延續到隔天，請至隔天編輯');
  hint.textContent = notes.join('；');

  document.getElementById('editSplitBtn').classList.toggle('hidden', false);
  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal(){
  document.getElementById('editModal').classList.add('hidden');
  editCtx = null;
}

function saveEditModal(){
  const seg = editCtx;
  const err = document.getElementById('editError');
  err.classList.add('hidden');
  const newState = editCtx._getSelectedState();
  const startInput = document.getElementById('editStart');
  const endInput = document.getElementById('editEnd');
  const cps = store.changePoints;

  const startIdx = seg.changeIndexStart;
  const endIdx = seg.changeIndexEnd;

  let newStartMs = cps[startIdx].time;
  if(!startInput.disabled){
    newStartMs = combineDateTime(historyDateKey, startInput.value);
    const lowerBound = startIdx > 0 ? cps[startIdx-1].time : -Infinity;
    const upperBound = cps[startIdx+1] ? cps[startIdx+1].time : Infinity;
    if(!(newStartMs > lowerBound && newStartMs < upperBound)){
      err.textContent = '開始時間必須介於前後區段之間。';
      err.classList.remove('hidden');
      return;
    }
  }

  let newEndMs = null;
  if(endIdx !== null && !endInput.disabled){
    newEndMs = combineDateTime(historyDateKey, endInput.value);
    const lowerBound = newStartMs;
    const upperBound = cps[endIdx+1] ? cps[endIdx+1].time : Date.now() + 1;
    if(!(newEndMs > lowerBound && newEndMs < upperBound)){
      err.textContent = '結束時間必須晚於開始時間，且早於下一段。';
      err.classList.remove('hidden');
      return;
    }
  }

  cps[startIdx].state = newState;
  cps[startIdx].time = newStartMs;
  if(newEndMs !== null) cps[endIdx].time = newEndMs;

  mergeAdjacentSameState();
  saveStore();
  closeEditModal();
  toast('已儲存');
  renderHistory();
  if(currentPage === 'stats') renderStats();
  updateNowUI();
}

// If an edit causes two consecutive change points to carry the same state,
// collapse them into one so History doesn't show a false split.
function mergeAdjacentSameState(){
  const cps = store.changePoints;
  for(let i = cps.length - 2; i >= 0; i--){
    if(cps[i].state === cps[i+1].state) cps.splice(i+1, 1);
  }
}

/* ------------------------------ split modal ------------------------------ */

function openSplitModal(){
  const seg = editCtx;
  if(!seg) return;
  document.getElementById('editModal').classList.add('hidden');
  const err = document.getElementById('splitError');
  err.classList.add('hidden');
  document.getElementById('splitTime').value = '';
  buildChipRow(document.getElementById('splitStateChips'), seg.state, ()=>{});
  document.getElementById('splitModal').dataset.state = seg.state;
  document.getElementById('splitModal').classList.remove('hidden');
}

function closeSplitModal(reopenEdit){
  document.getElementById('splitModal').classList.add('hidden');
  if(reopenEdit && editCtx) document.getElementById('editModal').classList.remove('hidden');
}

function saveSplit(){
  const seg = editCtx;
  const err = document.getElementById('splitError');
  err.classList.add('hidden');
  const timeVal = document.getElementById('splitTime').value;
  if(!timeVal){
    err.textContent = '請輸入切割時間點。';
    err.classList.remove('hidden');
    return;
  }
  const chipContainer = document.getElementById('splitStateChips');
  const selectedChip = [...chipContainer.children].find(c => c.classList.contains('selected'));
  const secondState = selectedChip ? selectedChip.textContent : seg.state;

  const splitMs = combineDateTime(historyDateKey, timeVal);
  if(!(splitMs > seg.clipStart && splitMs < seg.clipEnd)){
    err.textContent = '切割時間必須介於此區段的開始與結束之間。';
    err.classList.remove('hidden');
    return;
  }

  store.changePoints.splice(seg.changeIndexStart + 1, 0, {
    id: genId(), time: splitMs, state: secondState,
  });
  saveStore();
  closeSplitModal(false);
  closeEditModal();
  toast('已切割區段');
  renderHistory();
  if(currentPage === 'stats') renderStats();
  updateNowUI();
}

/* -------------------------------- routing -------------------------------- */

function switchPage(name){
  currentPage = name;
  ['now','history','stats'].forEach(p => {
    document.getElementById(`page-${p}`).classList.toggle('hidden', p !== name);
  });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  if(name === 'now') updateNowUI();
  if(name === 'history') renderHistory();
  if(name === 'stats') renderStats();
}

function enterMainApp(){
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('tabbar').classList.remove('hidden');
  document.querySelectorAll('#app .page').forEach(p => {}); // no-op, keeps structure clear
  switchPage('now');
}

/* -------------------------------- wiring -------------------------------- */

function wireHistoryNav(){
  document.getElementById('histPrev').addEventListener('click', () => {
    historyDateKey = shiftDateKey(historyDateKey, -1);
    renderHistory();
  });
  document.getElementById('histNext').addEventListener('click', () => {
    if(isToday(historyDateKey)) return;
    historyDateKey = shiftDateKey(historyDateKey, 1);
    renderHistory();
  });
  const dateInput = document.getElementById('histDateInput');
  document.getElementById('histDateBtn').addEventListener('click', () => {
    if(dateInput.showPicker){ try{ dateInput.showPicker(); }catch(e){ dateInput.click(); } }
    else dateInput.click();
  });
  dateInput.addEventListener('change', () => {
    if(dateInput.value) historyDateKey = dateInput.value;
    renderHistory();
  });
}

function wireStatsNav(){
  document.getElementById('statsPrev').addEventListener('click', () => {
    statsDateKey = shiftDateKey(statsDateKey, -1);
    renderStats();
  });
  document.getElementById('statsNext').addEventListener('click', () => {
    if(isToday(statsDateKey)) return;
    statsDateKey = shiftDateKey(statsDateKey, 1);
    renderStats();
  });
  const dateInput = document.getElementById('statsDateInput');
  document.getElementById('statsDateBtn').addEventListener('click', () => {
    if(dateInput.showPicker){ try{ dateInput.showPicker(); }catch(e){ dateInput.click(); } }
    else dateInput.click();
  });
  dateInput.addEventListener('change', () => {
    if(dateInput.value) statsDateKey = dateInput.value;
    renderStats();
  });
}

function wireTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });
}

function wireModals(){
  document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);
  document.getElementById('editSaveBtn').addEventListener('click', saveEditModal);
  document.getElementById('editSplitBtn').addEventListener('click', openSplitModal);
  document.getElementById('splitCancelBtn').addEventListener('click', () => closeSplitModal(true));
  document.getElementById('splitSaveBtn').addEventListener('click', saveSplit);
}

function registerServiceWorker(){
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
    });
  }
}

function tick(){
  tickCount += 1;
  if(currentPage === 'now'){
    updateNowUI();
  }else if(currentPage === 'history' && isToday(historyDateKey) && tickCount % 5 === 0){
    renderHistory();
  }
}

function init(){
  buildOnboardingGrid();
  buildNowGrid();
  wireHistoryNav();
  wireStatsNav();
  wireTabs();
  wireModals();
  registerServiceWorker();

  if(hasStarted()){
    document.getElementById('onboarding').classList.add('hidden');
    document.getElementById('tabbar').classList.remove('hidden');
    switchPage('now');
  }else{
    document.getElementById('onboarding').classList.remove('hidden');
  }

  setInterval(tick, 1000);
}

document.addEventListener('DOMContentLoaded', init);
