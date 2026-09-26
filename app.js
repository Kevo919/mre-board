/* MRE Work Board — vanilla JS single-page app. No build step, no dependencies.
   Data: data/workspace.json (tree, buckets, fields, people, saved views) + data/items.json (records).
   PUBLIC SITE: never store names, phone numbers, emails, amounts, or case/account numbers. */
(() => {
'use strict';
const TZ = 'America/Chicago';
const SCHEMA = 4; // v3: bots map, bucket isActive, item agent/taskUrl · v4: workspaces+assistants, Ideas buckets, cardType, metrics/coding fields, dependsOn/relatedTo, dashboards
const LS = { ws: 'mre.ws.v2', items: 'mre.items.v2', ui: 'mre.ui.v2', token: 'mre.gh.token', repo: 'mre.gh.repo', sync: 'mre.sync.v2', start: 'mre.startView', views: 'mre.views', theme: 'mre.theme', dash: 'mre.dash.v1' };
/* Built-in "Action type" card field (multi-select). Values live in item.fields.actionType as option ids. */
const AT = 'actionType';
const AT_ICONS = {
  wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.6 17.2a1.9 1.9 0 0 0 2.7 2.7l5.7-5.7a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.3-.5-.5-2.3z"/></svg>',
  envelope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a7.5 7 0 0 1-10.9 6.2L4 19.5l1.4-4.3A7 7 0 0 1 4.5 12 7.5 7 0 0 1 20 12z"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>',
  task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  bill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/></svg>',
};
const AT_FIELD = { id: AT, domainId: null, name: 'Action type', type: 'multi-select', builtin: true, order: 0.5, updatedAt: '2026-09-26T16:00:00-05:00',
  options: [{ id: 'physical', name: 'Physical', color: '#b45309', icon: 'wrench' }, { id: 'email', name: 'Email', color: '#4f46e5', icon: 'envelope' }, { id: 'sms', name: 'SMS', color: '#059669', icon: 'chat' }, { id: 'coding', name: 'Coding', color: '#9333ea', icon: 'code' }] };
/* v4 built-in fields (never deleted; KV can rename them / add select options). Metric + coding fields start EMPTY on every card. */
const BUILTIN_FIELDS = [
  { id: 'cardType', name: 'Card type', type: 'single-select', order: 0.4, options: [{ id: 'task', name: 'Task', color: '#475569', icon: 'task' }, { id: 'idea', name: 'Idea', color: '#eab308', icon: 'bulb' }, { id: 'coding', name: 'Coding task', color: '#9333ea', icon: 'code' }] },
  { id: 'tokensIn', name: 'Tokens in', type: 'number', group: 'metrics', order: 50 }, { id: 'tokensOut', name: 'Tokens out', type: 'number', group: 'metrics', order: 51 },
  { id: 'tokensTotal', name: 'Tokens total', type: 'number', group: 'metrics', order: 52, help: 'Blank = tokens in + out' }, { id: 'model', name: 'Model', type: 'text', group: 'metrics', order: 53 },
  { id: 'runs', name: 'Runs / attempts', type: 'number', group: 'metrics', order: 54 }, { id: 'durationMinutes', name: 'Duration (min)', type: 'number', group: 'metrics', order: 55 },
  { id: 'repo', name: 'Repo', type: 'text', group: 'coding', order: 60 }, { id: 'branch', name: 'Branch', type: 'text', group: 'coding', order: 61 }, { id: 'prUrl', name: 'PR / issue URL', type: 'url', group: 'coding', order: 62 },
  { id: 'agentTool', name: 'Agent tool', type: 'single-select', group: 'coding', order: 63, options: [{ id: 'cursor', name: 'Cursor', color: '#0f172a' }, { id: 'codex', name: 'Codex', color: '#10a37f' }, { id: 'claude', name: 'Claude', color: '#d97757' }, { id: 'chatgpt', name: 'ChatGPT', color: '#0f766e' }, { id: 'deepseek', name: 'DeepSeek', color: '#4d6bfe' }, { id: 'perplexity', name: 'Perplexity', color: '#1f8a99' }, { id: 'other', name: 'Other', color: '#64748b' }] },
  { id: 'ciStatus', name: 'CI status', type: 'single-select', group: 'coding', order: 64, options: [{ id: 'pending', name: 'Pending', color: '#d97706' }, { id: 'passing', name: 'Passing', color: '#16a34a' }, { id: 'failing', name: 'Failing', color: '#dc2626' }] },
].map((f) => ({ domainId: null, builtin: true, updatedAt: '2026-09-26T17:00:00-05:00', ...f }));
const FIELD_GROUPS = { metrics: 'Metrics', coding: 'Coding task' };
const GROK_ID = '7bffe639-ea47-4063-b8a3-73520f9a3f2a', TRIAGE_ID = '14250373-92c8-4cfa-b12a-4d8b58cc0dd5';
const GROK_ASSISTANT = () => ({ primary: { name: 'Grok Bot', agentId: GROK_ID }, bots: [GROK_ID] });
const DEFAULT_WORKSPACES = () => [
  { id: 'all', name: 'All workspaces', all: true, icon: '◎', color: '#475569', order: 0, assistant: GROK_ASSISTANT() },
  { id: 'w-mre', name: 'MRE', icon: '🏠', color: '#2563eb', order: 1, domainIds: ['d-re'], assistant: { primary: { name: 'MRE Triage', agentId: TRIAGE_ID }, bots: [TRIAGE_ID, '46c84c93-3489-486b-b331-16ab46f8ff98', '24dbc830-2ab6-4a64-81f8-ce513aad2c53', '1d1e9dc5-bdb7-411e-b490-7bb403e2d348', '62cbcc0d-ba22-4956-9857-05551978ce22'] } },
  { id: 'w-career', name: 'Career', icon: '💼', color: '#0d9488', order: 2, domainIds: ['d-career'], assistant: GROK_ASSISTANT() },
  { id: 'w-coding', name: 'Coding', icon: '⌨', color: '#9333ea', order: 3, domainIds: ['d-coding'], coding: true, assistant: GROK_ASSISTANT() },
  { id: 'w-personal', name: 'Personal', icon: '🌿', color: '#16a34a', order: 4, domainIds: ['d-personal', 'd-home'], assistant: GROK_ASSISTANT() },
].map((w) => ({ updatedAt: '2026-09-26T17:00:00-05:00', ...w }));
/* View registry: one entry per view = { id, name (label), ico, render(v, items), phone (can sit in the phone tab bar) }.
   Tabs, the phone bar/More menu, Start in and Settings › Views all read from this list. Add a view = add one entry. */
const VIEWS = [ // the four main views first; 'grid' keeps its internal id
  { id: 'kanban', name: 'Kanban', ico: '▥', render: renderKanban, phone: true },
  { id: 'dashboard', name: 'Dashboard', ico: '◔', render: renderDashboard, phone: true },
  { id: 'calendar', name: 'Calendar', ico: '▣', render: renderCalendar, phone: true },
  { id: 'grid', name: 'Spreadsheet', ico: '▦', render: renderGrid, phone: true },
  { id: 'timeline', name: 'Timeline', ico: '☰', render: renderTimeline, phone: true },
  { id: 'gallery', name: 'Gallery', ico: '▤', render: renderGallery, phone: true },
  { id: 'gantt', name: 'Gantt', ico: '▭', render: renderGantt, phone: true },
  { id: 'mindmap', name: 'Mind map', ico: '✺', render: renderMindmap, phone: true },
];
const FIELD_TYPES = [
  ['text', 'Text'], ['long-text', 'Long text'], ['number', 'Number'], ['date', 'Date'], ['single-select', 'Single select'],
  ['multi-select', 'Multi select'], ['checkbox', 'Checkbox'], ['person', 'Person / owner'], ['url', 'URL'],
];
const BOT_LINK = (id) => `grokbot://app/v1/sidebar?agent=${id}&tab=overview`;
const DEFAULT_BOTS = [
  ['14250373-92c8-4cfa-b12a-4d8b58cc0dd5', 'MRE Triage', 'Triage', '#7c3aed'],
  ['46c84c93-3489-486b-b331-16ab46f8ff98', 'MRE Leasing & Vacancies', 'Leasing', '#ea580c'],
  ['24dbc830-2ab6-4a64-81f8-ce513aad2c53', 'MRE Maintenance & Work Orders', 'Maintenance', '#0891b2'],
  ['1d1e9dc5-bdb7-411e-b490-7bb403e2d348', 'MRE Vendors', 'Vendors', '#16a34a'],
  ['62cbcc0d-ba22-4956-9857-05551978ce22', 'MRE Bills & Payments', 'Bills', '#ca8a04'],
  ['7bffe639-ea47-4063-b8a3-73520f9a3f2a', 'Grok Bot', 'Grok Bot', '#2563eb'],
].map(([id, name, short, color]) => ({ id, name, short, color, link: BOT_LINK(id) }));
const KV_COLOR = '#db2777';
const PALETTE = ['#2563eb', '#0891b2', '#0d9488', '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#9333ea', '#7c3aed', '#64748b'];

/* ---------------- small helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let late = null;
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv); }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'indeterminate') (late = late || {})[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  if (late) for (const [k, v] of Object.entries(late)) el[k] = v;
  return el;
}
const uid = (p = 'x') => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (o) => JSON.parse(JSON.stringify(o));
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''));
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms); }

/* ---------------- dates (America/Chicago) ---------------- */
const QS = new URLSearchParams(location.search);
function chicagoParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset' }).formatToParts(d).map((x) => [x.type, x.value]));
  const off = (p.timeZoneName || 'GMT-05:00').replace('GMT', '') || '+00:00';
  return { ...p, off: off === '' ? '+00:00' : off };
}
function nowISO() { const p = chicagoParts(); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${p.off}`; }
function todayStr() { if (QS.get('today')) return QS.get('today'); const p = chicagoParts(); return `${p.year}-${p.month}-${p.day}`; }
function dateOnly(iso) { if (!iso) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso; const d = new Date(iso); if (isNaN(d)) return null; const p = chicagoParts(d); return `${p.year}-${p.month}-${p.day}`; }
function dnum(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; }
function addDays(s, n) { const t = new Date((dnum(s) + n) * 864e5); return t.toISOString().slice(0, 10); }
function daysUntil(s) { return dnum(s) - dnum(todayStr()); }
function fmtDate(s, opts = { month: 'short', day: 'numeric' }) { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts }); }
function fmtStamp(iso) { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' CT'; }
function tsNum(iso) { const t = Date.parse(iso || ''); return isNaN(t) ? 0 : t; }
function resolveDateToken(v) { if (v === 'today') return todayStr(); const m = /^today([+-]\d+)$/.exec(v || ''); return m ? addDays(todayStr(), +m[1]) : v; }

/* ---------------- state ---------------- */
let WS = null;   // workspace doc
let IT = null;   // items doc
const DEFAULT_UI = { view: 'kanban', scope: 'all', search: '', quick: { domain: '', groups: [], section: '', status: '', owner: '', actionType: [], ideas: false },
  rules: [], sort: { key: 'due', dir: 1 }, groupBy: 'status', calMonth: null, calDay: null, colFilters: {}, collapsed: {}, showArchived: false, activeSaved: '', workspace: 'all', gridCols: {}, ganttZoom: 'week', ganttGroup: 'property', ganttColor: 'status', mmCollapsed: {}, mmLinksOnly: false };
let UI = loadUI();
function loadUI() { try { const u = Object.assign(clone(DEFAULT_UI), JSON.parse(localStorage.getItem(LS.ui) || '{}')); u.quick = Object.assign(clone(DEFAULT_UI.quick), u.quick || {}); if (QS.get('ws')) u.workspace = QS.get('ws'); return u; } catch { return clone(DEFAULT_UI); } }
function saveUI() { try { localStorage.setItem(LS.ui, JSON.stringify(UI)); } catch {} }
/* "Start in": per-device default view ('last' = reopen the last-used view, which UI.view already remembers). ?view= still wins. */
function getStartView() { try { const v = localStorage.getItem(LS.start); return v && (v === 'last' || VIEWS.some((x) => x.id === v)) ? v : 'last'; } catch { return 'last'; } }
function setStartView(v) { try { localStorage.setItem(LS.start, v); } catch {} }
const viewName = (id) => (VIEWS.find((v) => v.id === id) || { name: id }).name;
if (getStartView() !== 'last') UI.view = getStartView();
if (QS.get('view') && VIEWS.some((v) => v.id === QS.get('view'))) UI.view = QS.get('view');

/* ---------------- defaults & migration ---------------- */
function defaultBuckets(domainId, t) {
  const k = domainId.replace(/^d-/, '');
  return [ideasBucket(domainId, t), ...[['todo', 'To Do', '#64748b', false], ['inprogress', 'In Progress', '#2563eb', false], ['review', 'In Review', '#d97706', false], ['done', 'Done', '#16a34a', true]]
    .map(([id, name, color, isDone], i) => ({ id: `b-${k}-${id}-${Math.random().toString(36).slice(2, 5)}`, domainId, name, color, isDone, isActive: id === 'inprogress', order: i, updatedAt: t }))];
}
function ideasBucket(domainId, t = '2026-09-26T17:00:00-05:00') { return { id: `b-${domainId.replace(/^d-/, '')}-ideas`, domainId, name: 'Ideas', color: '#eab308', isDone: false, isActive: false, isIdea: true, icon: 'bulb', order: -1, updatedAt: t };
}
function emptyWorkspace() {
  const t = nowISO();
  const ws = { schemaVersion: SCHEMA, name: 'MRE Work Board', updated: t, nodes: [], buckets: [], fields: [
    { id: 'owner', domainId: null, name: 'Owner', type: 'person', order: 0, updatedAt: t },
    { id: 'priority', domainId: null, name: 'Priority', type: 'single-select', order: 1, updatedAt: t, options: [{ id: 'high', name: 'High', color: '#dc2626' }, { id: 'medium', name: 'Medium', color: '#d97706' }, { id: 'low', name: 'Low', color: '#64748b' }] },
    { id: 'notes', domainId: null, name: 'Notes', type: 'long-text', order: 2, updatedAt: t }],
    people: ['KV', 'Triage', 'Leasing', 'Maintenance', 'Vendors', 'Bills'], savedViews: [], deleted: [] };
  [['d-re', 'Real Estate', '#2563eb'], ['d-home', 'Home', '#0d9488'], ['d-personal', 'Personal', '#9333ea']].forEach(([id, name, color], i) => {
    ws.nodes.push({ id, parentId: null, type: 'domain', name, color, order: i, archived: false, updatedAt: t });
    ws.buckets.push(...defaultBuckets(id, t).map((b) => ({ ...b, id: b.id.replace(/-[a-z0-9]{3}$/, '') })));
  });
  return ws;
}
const V1_PROPS = { echo: ['Echo (Aurora)', '#0891b2'], plum: ['Plum (Aurora)', '#7c3aed'], college: ['College (Crystal Lake)', '#16a34a'], 'crown point': ['Crown Point (IN)', '#ea580c'], crown: ['Crown Point (IN)', '#ea580c'], mohawk: ['Mohawk (Park Forest)', '#db2777'], general: ['General', '#64748b'] };
/** Migrate any supported shape to {ws, items} at SCHEMA. Accepts: v2 split docs, combined export, or legacy v1 board.json {updated, cards}. */
function migrate(wsIn, itIn) {
  let ws = wsIn ? clone(wsIn) : null, it = itIn ? clone(itIn) : null;
  // combined export {workspace, items}
  if (ws && ws.workspace && ws.items) { it = ws.items; ws = ws.workspace; }
  // legacy v1: {updated, cards:[{id,title,column,property,unit,due,owner,note}]}
  const legacy = (ws && Array.isArray(ws.cards)) ? ws : (it && Array.isArray(it.cards)) ? it : null;
  if (legacy) {
    const base = (ws && ws.nodes) ? ws : emptyWorkspace(); const t = legacy.updated || nowISO();
    const find = (parentId, name) => base.nodes.find((n) => n.parentId === parentId && n.name.toLowerCase() === name.toLowerCase());
    const ensure = (parentId, type, name, color) => find(parentId, name) || (base.nodes.push({ id: uid('n'), parentId, type, name, color: color || null, order: base.nodes.length, archived: false, updatedAt: t }), base.nodes[base.nodes.length - 1]);
    const items = legacy.cards.map((c, i) => {
      const key = String(c.property || 'General').toLowerCase().replace(/\s*\(.*\)$/, '');
      const [pname, pcolor] = V1_PROPS[key] || [c.property || 'General', PALETTE[i % PALETTE.length]];
      const g = ensure('d-re', 'group', pname, pcolor);
      let node = ensure(g.id, 'section', 'Tasks');
      if (c.unit) { const u = ensure(g.id, 'section', 'Units'); node = ensure(u.id, 'section', /^unit/i.test(c.unit) ? c.unit : 'Unit ' + c.unit); }
      const b = base.buckets.filter((x) => x.domainId === 'd-re').find((x) => x.name.toLowerCase() === String(c.column || 'To Do').toLowerCase()) || base.buckets.find((x) => x.domainId === 'd-re');
      return normItem({ id: c.id || uid('i'), nodeId: node.id, status: b && b.id, title: c.title, due: c.due || null, fields: { owner: c.owner || undefined, notes: c.note || undefined },
        source: c.source || (c.owner && c.owner !== 'KV' ? c.owner : 'kv'), order: i, createdAt: c.created || t, updatedAt: c.updatedAt || t }, t);
    });
    const nws = normWS(base); items.forEach((x) => { if (!x.agent) x.agent = defaultAgentId(x, nws); });
    return { ws: nws, items: { schemaVersion: SCHEMA, updated: t, items, deleted: [] } };
  }
  ws = normWS(ws || emptyWorkspace());
  it = it || { items: [] };
  const t = it.updated || nowISO();
  const oldVer = it.schemaVersion || 1;
  it = { schemaVersion: SCHEMA, updated: t, items: (it.items || []).map((x) => normItem(x, t)), deleted: it.deleted || [] };
  if (oldVer < 3) it.items.forEach((x) => { if (!x.agent) x.agent = defaultAgentId(x, ws); }); // v2 → v3
  // future: if (ws.schemaVersion < 3) {...}
  return { ws, items: it };
}
function normWS(ws) {
  ws.schemaVersion = SCHEMA;
  for (const k of ['nodes', 'buckets', 'fields', 'savedViews', 'deleted']) if (!Array.isArray(ws[k])) ws[k] = [];
  if (!Array.isArray(ws.people)) ws.people = ['KV'];
  if (!Array.isArray(ws.bots) || !ws.bots.length) ws.bots = DEFAULT_BOTS.map((b) => ({ ...b, updatedAt: ws.updated || nowISO() }));
  ws.bots.forEach((b) => { if (!b.link) b.link = BOT_LINK(b.id); if (!b.color) { const d = DEFAULT_BOTS.find((x) => x.id === b.id); b.color = d ? d.color : '#64748b'; } });
  // v3: "In Progress" buckets are active (animated edge light) unless KV turned it off
  ws.buckets.forEach((b) => { if (b.isActive === undefined) b.isActive = /^in progress$/i.test(b.name); });
  ws.nodes.forEach((n) => { n.archived = !!n.archived; if (n.order == null) n.order = 0; });
  // built-in Action type field: always present, keeps KV's renames/colors, restores missing default options + icons
  ws.deleted = ws.deleted.filter((t) => !(t.kind === 'field' && t.id === AT));
  let atf = ws.fields.find((f) => f.id === AT);
  if (!atf) ws.fields.push(atf = JSON.parse(JSON.stringify(AT_FIELD)));
  atf.builtin = true; atf.type = 'multi-select'; if (!Array.isArray(atf.options)) atf.options = [];
  AT_FIELD.options.forEach((o) => { const x = atf.options.find((y) => y.id === o.id); if (!x) atf.options.push({ ...o }); else { if (!x.icon) x.icon = o.icon; if (!x.color) x.color = o.color; if (!x.name) x.name = o.name; } });
  // v4 built-in fields (card type, metrics, coding)
  BUILTIN_FIELDS.forEach((d) => { ws.deleted = ws.deleted.filter((t) => !(t.kind === 'field' && t.id === d.id)); let f = ws.fields.find((x) => x.id === d.id);
    if (!f) ws.fields.push(f = JSON.parse(JSON.stringify(d))); f.builtin = true; f.type = d.type; if (d.group) f.group = d.group; if (d.help) f.help = d.help;
    if (d.options) { if (!Array.isArray(f.options)) f.options = []; d.options.forEach((o) => { const x = f.options.find((y) => y.id === o.id); if (!x) f.options.push({ ...o }); else if (!x.icon && o.icon) x.icon = o.icon; }); } });
  // v4 workspaces (each linked to its assistant) — defaults if missing, 'all' always present
  if (!Array.isArray(ws.workspaces) || !ws.workspaces.length) ws.workspaces = DEFAULT_WORKSPACES();
  if (!ws.workspaces.some((w) => w.id === 'all')) ws.workspaces.unshift(DEFAULT_WORKSPACES()[0]);
  ws.workspaces.forEach((w) => { if (!w.all && !Array.isArray(w.domainIds)) w.domainIds = []; if (!w.assistant || !w.assistant.primary) w.assistant = GROK_ASSISTANT(); if (!Array.isArray(w.assistant.bots)) w.assistant.bots = w.assistant.primary.agentId ? [w.assistant.primary.agentId] : []; });
  if (!ws.dashboards || typeof ws.dashboards !== 'object') ws.dashboards = {};
  // every domain needs at least one bucket
  ws.nodes.filter((n) => n.type === 'domain').forEach((d) => { if (!ws.buckets.some((b) => b.domainId === d.id)) ws.buckets.push(...defaultBuckets(d.id, ws.updated || nowISO())); });
  // v4: every domain gets an Ideas bucket first (unless KV deleted it); cards are never moved
  ws.nodes.filter((n) => n.type === 'domain').forEach((d) => { const ib = ideasBucket(d.id); if (ws.buckets.some((b) => b.domainId === d.id && b.isIdea) || ws.deleted.some((t) => t.kind === 'bucket' && t.id === ib.id)) return; const mn = Math.min(0, ...ws.buckets.filter((b) => b.domainId === d.id).map((b) => b.order)); ib.order = mn - 1; ws.buckets.push(ib); });
  ws.bots.forEach((b) => { if (b.url && /^https:\/\/\S+$/i.test(b.url)) b.link = b.url; });
  return ws;
}
function normItem(x, t) {
  return { id: x.id || uid('i'), nodeId: x.nodeId || null, status: x.status || null, title: x.title || '(untitled)', fields: x.fields && typeof x.fields === 'object' ? JSON.parse(JSON.stringify(x.fields)) : {},
    start: x.start || null, due: x.due || null, checklist: Array.isArray(x.checklist) ? x.checklist : [], comments: Array.isArray(x.comments) ? x.comments : [],
    labels: Array.isArray(x.labels) ? x.labels : [], source: x.source || 'kv', lastEditedBy: x.lastEditedBy || x.source || 'kv',
    agent: x.agent || null, taskUrl: x.taskUrl || null, activity: Array.isArray(x.activity) ? x.activity : [],
    dependsOn: Array.isArray(x.dependsOn) ? x.dependsOn.filter((v) => typeof v === 'string' && v !== x.id) : [], relatedTo: Array.isArray(x.relatedTo) ? x.relatedTo.filter((v) => typeof v === 'string' && v !== x.id) : [],
    order: typeof x.order === 'number' ? x.order : 0, createdAt: x.createdAt || x.created || t, updatedAt: x.updatedAt || t };
}

/* ---------------- tree helpers ---------------- */
let IDX = null;
function reindex() {
  const byId = new Map(), kids = new Map();
  for (const n of WS.nodes) { byId.set(n.id, n); if (!kids.has(n.parentId)) kids.set(n.parentId, []); kids.get(n.parentId).push(n); }
  for (const arr of kids.values()) arr.sort(byOrder);
  IDX = { byId, kids };
}
const node = (id) => IDX.byId.get(id);
function children(pid, incArchived = UI.showArchived) { return (IDX.kids.get(pid) || []).filter((n) => incArchived || !n.archived); }
function ancestors(id) { const out = []; let n = node(id); const seen = new Set(); while (n && !seen.has(n.id)) { seen.add(n.id); out.unshift(n); n = node(n.parentId); } return out; }
function domainOf(id) { const a = ancestors(id); return a[0] && a[0].type === 'domain' ? a[0] : a[0] || null; }
function groupOf(id) { return ancestors(id).find((n) => n.type === 'group') || null; }
function isArchivedPath(id) { return ancestors(id).some((n) => n.archived); }
function subtree(id) { const out = new Set([id]); const walk = (p) => (IDX.kids.get(p) || []).forEach((c) => { out.add(c.id); walk(c.id); }); walk(id); return out; }
function nodeColor(id) { const a = ancestors(id); for (let i = a.length - 1; i >= 0; i--) if (a[i].color) return a[i].color; return '#64748b'; }
function pathLabel(id, from = 'group') { // path below the group (or below domain if no group)
  const a = ancestors(id); let i = a.findIndex((n) => n.type === 'group'); if (i < 0) i = 0;
  return a.slice(i + (from === 'group' ? 1 : 0)).map((n) => n.name).join(' › ');
}
function fullPath(id) { return ancestors(id).map((n) => n.name).join(' › '); }
function allDomains(inc = UI.showArchived) { return children(null, inc).filter((n) => n.type === 'domain'); }
function domains(inc = UI.showArchived) { const all = allDomains(inc); const s = WS && WS.workspaces ? wsDomainSet() : null; return s ? all.filter((d) => s.has(d.id)) : all; }
function scopeDomains() { if (UI.scope === 'all' || !node(UI.scope)) return domains(false).map((d) => d.id); const d = domainOf(UI.scope); return d ? [d.id] : []; }
function groupsIn(domIds) { const out = []; for (const d of domIds) for (const id of subtree(d)) { const n = node(id); if (n && n.type === 'group' && (UI.showArchived || !isArchivedPath(n.id))) out.push(n); } return out.sort((a, b) => ancestors(a.id).length - ancestors(b.id).length || byOrder(a, b)); }
function treeOrderIds(rootIds) { const out = []; const walk = (id) => { out.push(id); children(id).forEach((c) => walk(c.id)); }; rootIds.forEach(walk); return out; }

/* ---------------- buckets & fields ---------------- */
function bucketsOf(domId) { return WS.buckets.filter((b) => b.domainId === domId).sort(byOrder); }
function bucket(id) { return WS.buckets.find((b) => b.id === id); }
function defaultBucket(domId, idea = false) { const bs = bucketsOf(domId); return (idea ? bs.find((b) => b.isIdea) : bs.find((b) => !b.isIdea)) || bs[0] || null; }
function itemDomain(it) { const d = domainOf(it.nodeId); return d ? d.id : (domains(true)[0] || {}).id; }
function itemBucket(it) { const b = bucket(it.status); if (b && b.domainId === itemDomain(it)) return b; return defaultBucket(itemDomain(it), it.fields && it.fields.cardType === 'idea') || b || null; }
function isDone(it) { const b = itemBucket(it); return !!(b && b.isDone); }
function statusKey(it) { const b = itemBucket(it); return b ? b.name.toLowerCase() : ''; }
function fieldsFor(domIds) { return WS.fields.filter((f) => !f.domainId || domIds.includes(f.domainId)).sort(byOrder); }
function fieldDef(id) { return WS.fields.find((f) => f.id === id); }
function fieldOptions(f) { if (f.type === 'person') return WS.people.map((p) => ({ id: p, name: p, color: null })); return f.options || []; }
function optName(f, v) { const o = fieldOptions(f).find((o) => o.id === v || o.name === v); return o ? o.name : v; }
function optColor(f, v) { const o = fieldOptions(f).find((o) => o.id === v || o.name === v); return o && o.color; }
function atIcon(name) { const s = document.createElement('span'); s.className = 'at-ico'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = AT_ICONS[name] || ''; return s; }
const atValues = (it) => { const v = it && it.fields ? it.fields[AT] : null; return Array.isArray(v) ? v : v ? [v] : []; };
function atOptions() { const f = fieldDef(AT); return f ? f.options || [] : AT_FIELD.options; }
function actionChips(it, compact) {
  const opts = atOptions(); const vals = atValues(it).map((v) => opts.find((o) => o.id === v || o.name === v)).filter(Boolean); if (!vals.length) return null;
  return h('span', { class: 'at-chips' + (compact ? ' compact' : ''), title: 'Action type: ' + vals.map((o) => o.name).join(', ') },
    vals.map((o) => h('span', { class: 'at-chip', style: { '--atc': o.color || '#64748b' }, dataset: { at: o.id } }, atIcon(o.icon), h('span', { class: 'at-name' }, o.name))));
}
function fmtFieldVal(f, v) {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
  switch (f.type) {
    case 'checkbox': return v ? '✓' : '';
    case 'date': return fmtDate(v, { month: 'short', day: 'numeric', year: 'numeric' });
    case 'single-select': case 'person': return optName(f, v);
    case 'multi-select': return (Array.isArray(v) ? v : [v]).map((x) => optName(f, x)).join(', ');
    default: return String(v);
  }
}
/* ---------------- workspaces & assistants ---------------- */
function wsList() { return (WS.workspaces || []).slice().sort(byOrder); }
function curWS() { const l = WS.workspaces || []; return l.find((w) => w.id === UI.workspace) || l.find((w) => w.id === 'all') || { id: 'all', all: true, name: 'All workspaces', assistant: GROK_ASSISTANT() }; }
function wsDomainSet(w = curWS()) { return w.all ? null : new Set(w.domainIds || []); }
function workspaceOfDomain(domId) { return wsList().find((w) => !w.all && (w.domainIds || []).includes(domId)) || null; }
function workspaceOfItem(it) { return workspaceOfDomain(itemDomain(it)); }
function inCurWS(it) { const s = wsDomainSet(); return !s || s.has(itemDomain(it)); }
function isHttps(u) { return typeof u === 'string' && /^https:\/\/[^\s]+$/i.test(u.trim()); }
function hostName(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function assistantIsUrl(a) { return !!(a && a.primary && isHttps(a.primary.url)); }
function assistantLink(a) { if (!a || !a.primary) return BOT_LINK(GROK_ID); if (assistantIsUrl(a)) return a.primary.url.trim(); return BOT_LINK(a.primary.agentId || GROK_ID); }
function assistantShort(a) { const b = a.primary.agentId && WS.bots.find((x) => x.id === a.primary.agentId); return b ? (b.short || b.name) : a.primary.name; }
const ASSIST_NOTE = "Opens the assistant's chat in the Grok Bot app (needs the app on this device).";
function assistantNote(a) { return assistantIsUrl(a) ? `Opens ${hostName(a.primary.url)} in a new tab.` : ASSIST_NOTE; }
function wsBots(w = curWS()) { if (w.all) return WS.bots; const ids = new Set([...(w.assistant.bots || []), w.assistant.primary.agentId].filter(Boolean)); return WS.bots.filter((b) => ids.has(b.id)); }
function cardBot(it) {
  const b = botOf(it); if (b) return { bot: b, fallback: false, url: b.url && isHttps(b.url) ? b.url : null };
  const w = workspaceOfItem(it) || curWS(); const a = w.assistant; const pb = a.primary.agentId && WS.bots.find((x) => x.id === a.primary.agentId);
  return { bot: pb || { id: a.primary.agentId || '', name: a.primary.name, short: assistantShort(a) }, fallback: true, url: assistantIsUrl(a) ? assistantLink(a) : null, ws: w };
}
/* ---------------- bots (agent links) ---------------- */
function defaultAgentId(it, ws = WS) {
  const bots = (ws && ws.bots && ws.bots.length) ? ws.bots : DEFAULT_BOTS;
  const byShort = (s) => bots.find((b) => b.short && s && b.short.toLowerCase() === String(s).toLowerCase());
  const b = byShort(it.source) || byShort(it.fields && it.fields.owner) || byShort('Triage') || bots[0];
  return b ? b.id : null;
}
/* New cards default to their workspace's primary assistant; MRE keeps the owner/source → bot rule. null = fall back at render time. */
function wsDefaultAgent(it) { const w = workspaceOfItem(it); if (w && w.id !== 'w-mre') { const id = w.assistant && w.assistant.primary && w.assistant.primary.agentId; return id && WS.bots.some((b) => b.id === id) ? id : null; } return defaultAgentId(it); }
function botOf(it) { return it && it.agent ? WS.bots.find((b) => b.id === it.agent) || null : null; }
function validTaskUrl(u) { return typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u.trim()); }
function cardLink(it) { if (validTaskUrl(it.taskUrl)) return it.taskUrl.trim(); const c = cardBot(it); if (c.url) return c.url; return c.bot.link || (c.bot.id ? BOT_LINK(c.bot.id) : BOT_LINK(GROK_ID)); }
function isIdeaItem(it) { const b = itemBucket(it); return !!(b && b.isIdea) || (it.fields && it.fields.cardType === 'idea'); }
function isActiveItem(it) { const b = itemBucket(it); return !!(b && b.isActive && !b.isDone) && !isIdeaItem(it); }
function botChip(it) {
  const c = cardBot(it); const b = c.bot; const href = cardLink(it); if (!href) return null; const ext = validTaskUrl(it.taskUrl) || !!c.url;
  const tip = validTaskUrl(it.taskUrl) ? `Open task link (${b.name})` : c.url ? `Open ${b.name} (${hostName(c.url)})` : c.fallback ? `No bot set — open the workspace assistant, ${b.name} (Grok Bot app)` : `Open in ${b.name} — Grok Bot app`;
  return h('a', { class: 'bot-chip' + (c.fallback ? ' fallback' : ''), href, target: ext ? '_blank' : null, rel: ext ? 'noopener noreferrer' : null, 'data-tip': tip, 'aria-label': tip, dataset: { agent: b.id }, onClick: (e) => e.stopPropagation(), onPointerdown: (e) => e.stopPropagation(), onKeydown: (e) => e.stopPropagation() },
    h('span', { 'aria-hidden': 'true' }, '🤖'), b.short || b.name);
}
function statusOptionsUnion(domIds) { const seen = new Map(); for (const d of domIds) for (const b of bucketsOf(d)) { const k = b.name.toLowerCase(); if (!seen.has(k)) seen.set(k, b); } return [...seen.entries()].map(([k, b]) => ({ id: k, name: b.name, color: b.color })); }

/* ---------------- merge (same rules as merge.js) ---------------- */
function tombMap(list) { const m = new Map(); for (const t of list || []) { const k = (t.kind || 'item') + ':' + t.id; if (!m.has(k) || tsNum(t.at) > tsNum(m.get(k).at)) m.set(k, t); } return m; }
function mergeById(a, b, tombs, kind) {
  const m = new Map();
  for (const x of b || []) m.set(x.id, x);
  for (const x of a || []) { const y = m.get(x.id); if (!y || tsNum(x.updatedAt) >= tsNum(y.updatedAt)) m.set(x.id, x); }
  return [...m.values()].filter((x) => { const t = tombs.get(kind + ':' + x.id); return !t || tsNum(x.updatedAt) > tsNum(t.at); });
}
function mergeItemsDocs(l, r) {
  if (!l) return r; if (!r) return l;
  const deleted = [...tombMap([...(l.deleted || []), ...(r.deleted || [])]).values()];
  const tm = tombMap(deleted);
  const items = mergeById(l.items, r.items, tm, 'item');
  // activity is append-only: keep entries from both sides (dedupe by id) whichever version of the card wins
  const other = new Map([...(l.items || []), ...(r.items || [])].map((x) => [x.id, []]));
  for (const x of [...(l.items || []), ...(r.items || [])]) other.get(x.id).push(...(x.activity || []));
  const out = items.map((x) => { const all = other.get(x.id) || []; if (!all.length) return x; const m = new Map(); for (const e of all) if (e && e.id && !m.has(e.id)) m.set(e.id, e); const act = [...m.values()].sort((a, b) => tsNum(a.ts) - tsNum(b.ts)); return (act.length === (x.activity || []).length) ? x : { ...x, activity: act }; });
  return { schemaVersion: SCHEMA, updated: tsNum(l.updated) >= tsNum(r.updated) ? l.updated : r.updated, items: out, deleted };
}
function mergeWSDocs(l, r) {
  if (!l) return r; if (!r) return l;
  const deleted = [...tombMap([...(l.deleted || []), ...(r.deleted || [])]).values()];
  const tm = tombMap(deleted); const newer = tsNum(l.updated) >= tsNum(r.updated) ? l : r;
  const people = [...new Set([...(newer.people || []), ...(l.people || []), ...(r.people || [])])].filter((p) => !tm.has('person:' + p) || (newer.people || []).includes(p));
  return normWS({ ...newer, schemaVersion: SCHEMA, updated: newer.updated, deleted, people,
    nodes: mergeById(l.nodes, r.nodes, tm, 'node'), buckets: mergeById(l.buckets, r.buckets, tm, 'bucket'),
    fields: mergeById(l.fields, r.fields, tm, 'field'), savedViews: mergeById(l.savedViews, r.savedViews, tm, 'view'), bots: mergeById(l.bots, r.bots, tm, 'bot'),
    workspaces: mergeById(l.workspaces, r.workspaces, tm, 'workspace'), dashboards: mergeDash(l.dashboards, r.dashboards) });
}
function mergeDash(a, b) { const out = { ...(b || {}) }; for (const [k, v] of Object.entries(a || {})) if (!out[k] || tsNum(v.updatedAt) >= tsNum(out[k].updatedAt)) out[k] = v; return out;
}

/* ---------------- persistence & GitHub sync ---------------- */
let META = (() => { try { return JSON.parse(localStorage.getItem(LS.sync) || '{}'); } catch { return {}; } })();
function saveMeta() { try { localStorage.setItem(LS.sync, JSON.stringify(META)); } catch {} }
function saveLocal() { try { localStorage.setItem(LS.ws, JSON.stringify(WS)); localStorage.setItem(LS.items, JSON.stringify(IT)); } catch (e) { toast('Could not save to this device: ' + e.message); } }
function getToken() { try { return localStorage.getItem(LS.token) || ''; } catch { return ''; } }
function repoCfg() {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(LS.repo) || '{}'); } catch {}
  let owner = '', repo = '';
  if (/\.github\.io$/i.test(location.hostname)) { owner = location.hostname.split('.')[0]; repo = location.pathname.split('/').filter(Boolean)[0] || `${owner}.github.io`; }
  return { owner: saved.owner || owner, repo: saved.repo || repo || 'mre-board', branch: saved.branch || 'main' };
}
const PATHS = { ws: 'data/workspace.json', items: 'data/items.json' };
function b64encode(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); }
function b64decode(b64) { const bin = atob(b64.replace(/\s/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); }
async function ghFetch(path, opts = {}, token = getToken()) {
  const { owner, repo } = repoCfg(); if (!owner) throw new Error('Set the GitHub owner in Settings');
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, { cache: 'no-store', ...opts, headers });
}
/** GET a data file via the contents API. Returns {doc, sha} or null if missing. */
async function ghGetFile(p, token) {
  const { branch } = repoCfg();
  const r = await ghFetch(`/contents/${p}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, {}, token);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GitHub GET ${p}: ${r.status}`);
  const j = await r.json();
  let text = j.content ? b64decode(j.content) : null;
  if (text == null) { const r2 = await ghFetch(`/contents/${p}?ref=${encodeURIComponent(branch)}`, { headers: { Accept: 'application/vnd.github.raw+json' } }, token); text = await r2.text(); }
  return { doc: JSON.parse(text), sha: j.sha };
}
async function fetchJSON(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }
/** Load the freshest copy available: GitHub API (token or anonymous) → raw.githubusercontent → same-origin files. */
async function fetchRemote() {
  const { owner, repo, branch } = repoCfg(); const token = getToken();
  if (owner) {
    try {
      const [w, i] = await Promise.all([ghGetFile(PATHS.ws, token), ghGetFile(PATHS.items, token)]);
      if (w || i) return { ws: w && w.doc, items: i && i.doc, shaWs: w && w.sha, shaItems: i && i.sha, via: token ? 'api' : 'api-anon' };
      const legacy = await ghGetFile('board.json', token); if (legacy) return { ws: legacy.doc, items: null, via: 'legacy' };
    } catch (e) { console.warn('GitHub API load failed', e); if (token) { SYNC.error = e.message; } }
    try {
      const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`; const t = '?t=' + Date.now();
      const [w, i] = await Promise.all([fetchJSON(base + PATHS.ws + t), fetchJSON(base + PATHS.items + t)]);
      return { ws: w, items: i, via: 'raw' };
    } catch (e) { console.warn('raw load failed', e); }
  }
  try { const t = '?t=' + Date.now(); const [w, i] = await Promise.all([fetchJSON(PATHS.ws + t), fetchJSON(PATHS.items + t)]); return { ws: w, items: i, via: 'site' }; }
  catch (e) { try { return { ws: await fetchJSON('board.json?t=' + Date.now()), items: null, via: 'legacy-site' }; } catch { return null; } }
}
const SYNC = { state: 'local', error: '', timer: null, pushing: false, lastPull: 0 };
function setSync(state, err) {
  SYNC.state = state; if (err !== undefined) SYNC.error = err;
  const el = $('#syncStatus'); if (!el) return;
  const map = { local: ['Changes saved on this device only', 'Device only'], saved: ['Saved', 'Saved'], saving: ['Saving…', 'Saving…'], dirty: ['Not synced', 'Not synced'], error: ['Not synced', 'Not synced'] };
  const [long, short] = map[state] || map.local;
  el.className = 'sync ' + state; el.textContent = matchMedia('(max-width:860px)').matches ? short : long;
  el.title = state === 'error' ? 'Sync error: ' + SYNC.error : long;
}
function markDirty(kind) {
  const t = nowISO();
  if (kind === 'ws' || kind === 'both') { WS.updated = t; META.dirty_ws = true; }
  if (kind === 'items' || kind === 'both') { IT.updated = t; META.dirty_items = true; }
  saveLocal(); saveMeta(); scheduleSync();
}
function scheduleSync(delay = 3000) {
  if (!getToken()) { setSync('local'); return; }
  if (!META.dirty_ws && !META.dirty_items) { if (SYNC.state !== 'error') setSync('saved'); return; }
  setSync('dirty'); clearTimeout(SYNC.timer); SYNC.timer = setTimeout(pushNow, delay);
}
function applyRemote(kind, doc) {
  const m = migrate(kind === 'ws' ? doc : WS, kind === 'items' ? doc : IT);
  if (kind === 'ws') { WS = mergeWSDocs(WS, m.ws); reindex(); } else IT = mergeItemsDocs(IT, m.items);
  saveLocal();
}
async function putFile(kind) {
  const p = PATHS[kind];
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!META['sha_' + kind]) { const cur = await ghGetFile(p); if (cur) { META['sha_' + kind] = cur.sha; applyRemote(kind, cur.doc); } }
    META['dirty_' + kind] = false; saveMeta();
    const doc = kind === 'ws' ? WS : IT;
    const body = { message: `Update ${p} from MRE Work Board`, content: b64encode(JSON.stringify(doc, null, 2) + '\n'), branch: repoCfg().branch };
    if (META['sha_' + kind]) body.sha = META['sha_' + kind];
    const r = await ghFetch(`/contents/${p}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    if (r.ok) { const j = await r.json(); META['sha_' + kind] = j.content.sha; saveMeta(); return; }
    META['dirty_' + kind] = true; saveMeta();
    if (r.status === 409 || r.status === 422) { // sha changed on the server: re-fetch, merge by id/updatedAt, retry
      const cur = await ghGetFile(p); META['sha_' + kind] = cur ? cur.sha : null; if (cur) applyRemote(kind, cur.doc); continue;
    }
    let msg = ''; try { msg = (await r.json()).message; } catch {}
    throw new Error(`GitHub ${r.status}${msg ? ': ' + msg : ''}`);
  }
  throw new Error('Could not resolve a save conflict after several tries');
}
async function pushNow() {
  if (!getToken()) { setSync('local'); return; }
  if (SYNC.pushing) { scheduleSync(1500); return; }
  SYNC.pushing = true; setSync('saving');
  try {
    if (META.dirty_ws) await putFile('ws');
    if (META.dirty_items) await putFile('items');
    setSync('saved', ''); softRender();
  } catch (e) { console.error(e); setSync('error', e.message); }
  finally { SYNC.pushing = false; if (META.dirty_ws || META.dirty_items) { if (SYNC.state !== 'error') scheduleSync(); } }
}
async function pullNow(showToast) {
  SYNC.lastPull = Date.now();
  const r = await fetchRemote(); if (!r) { if (showToast) toast('Could not load the server copy'); return; }
  const m = migrate(r.ws, r.items);
  WS = mergeWSDocs(WS, m.ws); IT = mergeItemsDocs(IT, m.items); reindex();
  if (r.shaWs && !META.dirty_ws) META.sha_ws = r.shaWs; if (r.shaItems && !META.dirty_items) META.sha_items = r.shaItems;
  if (r.shaWs && META.dirty_ws) META.sha_ws = r.shaWs; if (r.shaItems && META.dirty_items) META.sha_items = r.shaItems; // merged locally; push will include server changes
  saveLocal(); saveMeta(); softRender(); if (showToast) toast('Loaded latest from ' + r.via);
  scheduleSync(800);
}

/* ---------------- field access, filters, sort ---------------- */
function mapType(t) { return ({ 'long-text': 'text', url: 'text', person: 'select', 'single-select': 'select', 'multi-select': 'multi' })[t] || t; }
function filterFieldDefs(domIds = scopeDomains()) {
  const secs = []; for (const d of domIds) for (const id of treeOrderIds([d])) { const n = node(id); if (n && n.type === 'section') secs.push({ id: n.id, name: (groupOf(n.id) ? groupOf(n.id).name + ' › ' : '') + pathLabel(n.id) }); }
  const defs = [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'status', label: 'Status', type: 'select', options: statusOptionsUnion(domIds) },
    { key: 'domain', label: 'Domain', type: 'select', options: domains().map((d) => ({ id: d.id, name: d.name, color: d.color })) },
    { key: 'group', label: 'Property / group', type: 'select', options: groupsIn(domIds).map((g) => ({ id: g.id, name: g.name, color: g.color })) },
    { key: 'section', label: 'Section', type: 'select', options: secs },
    { key: 'due', label: 'Due', type: 'date' },
    { key: 'start', label: 'Start', type: 'date' },
    ...fieldsFor(domIds).map((f) => ({ key: 'f:' + f.id, label: f.name, type: mapType(f.type), options: fieldOptions(f), field: f })),
    { key: 'agent', label: 'Bot', type: 'select', options: wsBots().map((b) => ({ id: b.id, name: b.name })) },
    { key: 'labels', label: 'Labels', type: 'multi', options: [...new Set(IT.items.flatMap((i) => i.labels))].map((l) => ({ id: l, name: l })) },
    { key: 'source', label: 'Source', type: 'select', options: [...new Set(['kv', ...WS.people, ...IT.items.map((i) => i.source)])].map((s) => ({ id: s, name: s })) },
    { key: 'createdAt', label: 'Created', type: 'date' },
    { key: 'updatedAt', label: 'Updated', type: 'date' },
  ];
  return defs;
}
function getVal(it, key) {
  switch (key) {
    case 'title': return it.title;
    case 'status': return statusKey(it);
    case 'domain': return itemDomain(it);
    case 'group': { const g = groupOf(it.nodeId); return g ? g.id : ''; }
    case 'section': { const n = node(it.nodeId); return n && n.type === 'section' ? n.id : ''; }
    case 'due': return it.due || '';
    case 'start': return it.start || '';
    case 'labels': return it.labels;
    case 'agent': return it.agent || '';
    case 'source': return it.source;
    case 'createdAt': return dateOnly(it.createdAt) || '';
    case 'updatedAt': return dateOnly(it.updatedAt) || '';
    default: if (key.startsWith('f:')) return it.fields[key.slice(2)]; return it[key];
  }
}
const OPS = {
  text: [['contains', 'contains'], ['equals', 'is'], ['empty', 'is empty'], ['notempty', 'is not empty']],
  number: [['eq', '='], ['lt', '<'], ['gt', '>'], ['empty', 'is empty'], ['notempty', 'is not empty']],
  date: [['on', 'is on'], ['before', 'is before'], ['after', 'is after'], ['empty', 'is empty'], ['notempty', 'is not empty']],
  select: [['anyof', 'is any of'], ['noneof', 'is none of'], ['empty', 'is empty'], ['notempty', 'is not empty']],
  multi: [['anyof', 'has any of'], ['noneof', 'has none of'], ['empty', 'is empty'], ['notempty', 'is not empty']],
  checkbox: [['checked', 'is checked'], ['unchecked', 'is not checked']],
};
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
function testRule(it, r, defs) {
  const def = defs.find((d) => d.key === r.field); if (!def) return true;
  let v = getVal(it, r.field); const val = r.value;
  switch (r.op) {
    case 'empty': return isEmpty(v);
    case 'notempty': return !isEmpty(v);
    case 'contains': { const s = def.field && def.options && def.options.length ? fmtFieldVal(def.field, v) : Array.isArray(v) ? v.join(' ') : String(v ?? ''); return s.toLowerCase().includes(String(val || '').toLowerCase()); }
    case 'equals': return String(v ?? '').toLowerCase() === String(val ?? '').toLowerCase();
    case 'eq': return v !== '' && v != null && Number(v) === Number(val);
    case 'lt': return v !== '' && v != null && Number(v) < Number(val);
    case 'gt': return v !== '' && v != null && Number(v) > Number(val);
    case 'on': return !!v && v === resolveDateToken(val);
    case 'before': return !!v && !!val && v < resolveDateToken(val);
    case 'after': return !!v && !!val && v > resolveDateToken(val);
    case 'anyof': case 'noneof': {
      const want = Array.isArray(val) ? val : val ? [val] : []; if (!want.length) return true;
      const have = Array.isArray(v) ? v : isEmpty(v) ? [] : [v];
      const norm = (x) => String(x).toLowerCase(); const hit = have.some((x) => want.map(norm).includes(norm(x)) || want.map(norm).includes(norm(def.field ? optName(def.field, x) : x)));
      return r.op === 'anyof' ? hit : !hit;
    }
    case 'checked': return !!v;
    case 'unchecked': return !v;
    default: return true;
  }
}
function searchText(it) {
  const f = it.fields || {}; const vals = Object.entries(f).map(([k, v]) => { const d = fieldDef(k); return d ? fmtFieldVal(d, v) : String(v); });
  const bot = botOf(it);
  return [it.title, ...vals, ...it.labels, fullPath(it.nodeId), bot ? bot.name : '', ...it.checklist.map((c) => c.text), ...it.comments.map((c) => c.text)].join(' ').toLowerCase();
}
function scopedItems() {
  const scoped = UI.scope !== 'all' && node(UI.scope) ? subtree(UI.scope) : null;
  const scopeArchived = scoped && isArchivedPath(UI.scope); const wsSet = wsDomainSet();
  return IT.items.filter((it) => {
    if (wsSet && !wsSet.has(itemDomain(it))) return false;
    if (scoped && !scoped.has(it.nodeId)) return false;
    if (!UI.showArchived && !scopeArchived && it.nodeId && node(it.nodeId) && isArchivedPath(it.nodeId)) return false;
    return true;
  });
}
function visibleItems(opts = {}) {
  const q = UI.quick, defs = filterFieldDefs(), s = UI.search.trim().toLowerCase();
  const secSet = q.section && node(q.section) ? subtree(q.section) : null;
  return scopedItems().filter((it) => {
    if (q.domain && itemDomain(it) !== q.domain) return false;
    if (q.groups && q.groups.length) { const g = groupOf(it.nodeId); if (!g || !q.groups.includes(g.id)) return false; }
    if (secSet && !secSet.has(it.nodeId)) return false;
    if (q.status && !opts.ignoreStatus && statusKey(it) !== q.status) return false;
    if (q.owner && (it.fields.owner || '') !== q.owner) return false;
    if (q.actionType && q.actionType.length && !atValues(it).some((v) => q.actionType.includes(v))) return false;
    if (q.ideas && !isIdeaItem(it)) return false;
    for (const r of UI.rules) if (!testRule(it, r, defs)) return false;
    if (s && !s.split(/\s+/).every((w) => searchText(it).includes(w))) return false;
    return true;
  });
}
function sortVal(it, key) {
  if (key === 'status') { const b = itemBucket(it); return b ? b.order : 99; }
  if (key === 'group') { const g = groupOf(it.nodeId); return g ? g.name.toLowerCase() : '~'; }
  if (key === 'section') return pathLabel(it.nodeId).toLowerCase();
  if (key === 'domain') { const d = domainOf(it.nodeId); return d ? d.order : 99; }
  if (key === 'createdAt' || key === 'updatedAt') return tsNum(it[key]);
  const v = getVal(it, key);
  if (key === 'f:' + AT) { const opts = atOptions(); const idx = atValues(it).map((x) => opts.findIndex((o) => o.id === x)).filter((i) => i >= 0); return idx.length ? idx.map((i) => String(i).padStart(2, '0')).join(',') : null; }
  if (key.startsWith('f:')) { const f = fieldDef(key.slice(2)); if (f && f.type === 'number') return v === '' || v == null ? null : Number(v); if (f) return fmtFieldVal(f, v).toLowerCase() || null; }
  if (Array.isArray(v)) return v.join(',').toLowerCase() || null;
  return v === '' || v == null ? null : String(v).toLowerCase();
}
function sortItems(list, sort = UI.sort) {
  const { key, dir } = sort || {}; if (!key) return list;
  return [...list].sort((a, b) => { const x = sortVal(a, key), y = sortVal(b, key); if (x == null && y == null) return (a.order - b.order); if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : a.order - b.order) * dir; });
}

/* ---------------- mutations ---------------- */
function getItem(id) { return IT.items.find((i) => i.id === id); }
function updateItem(id, patch = {}, fieldPatch = null, { render: doRender = true } = {}) {
  const it = getItem(id); if (!it) return;
  const before = clone({ status: it.status, nodeId: it.nodeId, due: it.due, start: it.start, title: it.title, agent: it.agent, taskUrl: it.taskUrl, labels: it.labels, checklist: it.checklist, comments: it.comments, fields: it.fields, dependsOn: it.dependsOn || [], relatedTo: it.relatedTo || [] });
  if (patch.nodeId && patch.nodeId !== it.nodeId) { const oldDom = itemDomain(it); Object.assign(it, { nodeId: patch.nodeId }); const nd = itemDomain(it); if (nd !== oldDom && !patch.status) { const ob = bucket(it.status); const nb = bucketsOf(nd).find((b) => ob && b.name.toLowerCase() === ob.name.toLowerCase()) || defaultBucket(nd, ob && ob.isIdea); it.status = nb ? nb.id : null; } }
  Object.assign(it, patch);
  if (fieldPatch) for (const [k, v] of Object.entries(fieldPatch)) { if (isEmpty(v) || v === false) delete it.fields[k]; else it.fields[k] = v; }
  it.updatedAt = nowISO(); it.lastEditedBy = 'kv';
  for (const action of describeChange(before, it, patch, fieldPatch)) logKV(it, action);
  markDirty('items'); if (doRender) render();
}
/* ---------------- activity log ---------------- */
function describeChange(b, it, patch, fp) {
  const out = [];
  if ('status' in patch && it.status !== b.status) { const bk = bucket(it.status); out.push('Moved to ' + (bk ? bk.name : 'another bucket')); }
  else if (it.status !== b.status) { const bk = bucket(it.status); if (bk) out.push('Moved to ' + bk.name); }
  if ('nodeId' in patch && it.nodeId !== b.nodeId) out.push('Moved to ' + (fullPath(it.nodeId).split(' › ').slice(1).join(' › ') || fullPath(it.nodeId)));
  if ('due' in patch && it.due !== b.due) out.push(!b.due ? `Added due date ${fmtDate(it.due)}` : !it.due ? 'Removed due date' : `Changed due date to ${fmtDate(it.due)}`);
  if ('start' in patch && it.start !== b.start) out.push(it.start ? `Set start date ${fmtDate(it.start)}` : 'Removed start date');
  if ('title' in patch && it.title !== b.title) out.push('Renamed card');
  if ('agent' in patch && it.agent !== b.agent) out.push('Assigned to ' + ((botOf(it) || {}).name || 'no bot'));
  if ('taskUrl' in patch && it.taskUrl !== b.taskUrl) out.push(it.taskUrl ? 'Added task link' : 'Removed task link');
  if ('labels' in patch && JSON.stringify(it.labels) !== JSON.stringify(b.labels)) out.push('Updated labels');
  if ('checklist' in patch) { const d0 = b.checklist.filter((c) => c.done).length, d1 = it.checklist.filter((c) => c.done).length;
    out.push(it.checklist.length > b.checklist.length ? 'Added a checklist item' : d1 > d0 ? 'Checked off a checklist item' : it.checklist.length < b.checklist.length ? 'Removed a checklist item' : 'Updated checklist'); }
  if ('comments' in patch && it.comments.length > b.comments.length) out.push('Added a comment');
  for (const [k, add, rm] of [['dependsOn', 'Added dependency: ', 'Removed dependency: '], ['relatedTo', 'Linked related card: ', 'Unlinked related card: ']]) if (k in patch) {
    const o = new Set(b[k] || []), n = new Set(it[k] || []); const t = (id) => { const x = getItem(id); return x ? '“' + x.title + '”' : id; };
    [...n].filter((x) => !o.has(x)).forEach((x) => out.push(add + t(x))); [...o].filter((x) => !n.has(x)).forEach((x) => out.push(rm + t(x))); }
  if (fp && AT in fp && JSON.stringify(b.fields[AT] ?? []) !== JSON.stringify(it.fields[AT] ?? [])) { const n = atValues(it).map((v) => (atOptions().find((o) => o.id === v) || { name: v }).name); out.push(n.length ? 'Set action type: ' + n.join(', ') : 'Cleared action type'); fp = { ...fp }; delete fp[AT]; }
  if (fp) { const names = Object.keys(fp).filter((k) => JSON.stringify(b.fields[k] ?? null) !== JSON.stringify(it.fields[k] ?? null)).map((k) => (fieldDef(k) || { name: k }).name); if (names.length) out.push('Updated ' + names.join(', ')); }
  return out;
}
function logKV(it, action) {
  const now = nowISO(); it.activity = it.activity || []; const last = it.activity[it.activity.length - 1];
  if (last && last.actor === 'kv' && last.action === action && tsNum(now) - tsNum(last.ts) < 120000) { last.ts = now; return; } // coalesce quick repeats
  it.activity.push({ id: uid('a'), ts: now, actor: 'kv', actorName: 'KV', action });
}
function actorInfo(e) {
  if (!e || e.actor === 'kv') return { name: 'KV', short: 'KV', color: KV_COLOR };
  const b = WS.bots.find((x) => x.id === e.actor); return b ? { name: b.name, short: b.short || b.name, color: b.color || '#64748b' } : { name: e.actorName || 'Bot', short: e.actorName || 'Bot', color: '#64748b' };
}
function fmtRel(iso) {
  const d = (Date.now() - tsNum(iso)) / 1000; if (!tsNum(iso)) return '';
  if (d < 45) return 'just now'; if (d < 3600) return Math.max(1, Math.round(d / 60)) + 'm ago'; if (d < 86400) return Math.round(d / 3600) + 'h ago';
  if (d < 86400 * 14) return Math.round(d / 86400) + 'd ago'; return fmtStamp(iso).replace(/,? \d+:\d+.*$/, '');
}
const latestActivity = (it) => (it.activity || []).reduce((m, e) => (!m || tsNum(e.ts) >= tsNum(m.ts) ? e : m), null);
function activityLine(it) {
  const e = latestActivity(it); if (!e) return null; const a = actorInfo(e);
  return h('div', { class: 'card-activity', title: `${a.name}: ${e.action} — ${fmtStamp(e.ts)}` },
    h('span', { class: 'act-chip', style: { '--bc': a.color } }, h('i', { class: 'dot', style: { background: a.color } }), a.short), h('span', { class: 'act-time' }, ' · ' + fmtRel(e.ts)), h('span', { class: 'act-text' }, ' — ' + e.action));
}
function createItem(data) {
  const t = nowISO();
  const it = normItem({ ...data, id: uid('kv'), source: 'kv', lastEditedBy: 'kv', createdAt: t, updatedAt: t, order: Math.max(0, ...IT.items.map((i) => i.order || 0)) + 1 }, t);
  if (!it.nodeId || !node(it.nodeId)) it.nodeId = defaultNodeId();
  if (it.agent && !WS.bots.some((b) => b.id === it.agent)) it.agent = null; if (!it.agent && data.agent === undefined) it.agent = wsDefaultAgent(it);
  if (!it.status || !bucket(it.status) || bucket(it.status).domainId !== itemDomain(it)) it.status = (defaultBucket(itemDomain(it), it.fields && it.fields.cardType === 'idea') || {}).id || null;
  if (bucket(it.status) && bucket(it.status).isIdea && !it.fields.cardType) it.fields.cardType = 'idea';
  it.activity = [{ id: uid('a'), ts: it.createdAt, actor: 'kv', actorName: 'KV', action: 'Created card' }];
  IT.items.push(it); markDirty('items'); render(); return it;
}
function deleteItem(id) { IT.items = IT.items.filter((i) => i.id !== id); IT.deleted = (IT.deleted || []).concat({ id, kind: 'item', at: nowISO() }); markDirty('items'); render(); }
function defaultNodeId() {
  const s = UI.scope !== 'all' && node(UI.scope) ? node(UI.scope) : null;
  if (s) { if (s.type === 'group') { const t = children(s.id).find((c) => c.name.toLowerCase() === 'tasks'); return t ? t.id : s.id; } return s.id; }
  if (UI.quick.groups && UI.quick.groups.length === 1) return defaultNodeIdFor(UI.quick.groups[0]);
  const d = domains()[0]; return d ? d.id : null;
}
function defaultNodeIdFor(gid) { const t = children(gid).find((c) => c.name.toLowerCase() === 'tasks'); return t ? t.id : gid; }
function wsTouch(o) { o.updatedAt = nowISO(); return o; }
function tomb(kind, id) { WS.deleted.push({ kind, id, at: nowISO() }); }
function wsChanged() { reindex(); markDirty('ws'); render(); }
function addNode(parentId, type, name, color) {
  const sibs = IDX.kids.get(parentId) || [];
  const n = wsTouch({ id: uid('n'), parentId, type, name: name.trim() || 'Untitled', color: color || null, order: sibs.length ? Math.max(...sibs.map((s) => s.order || 0)) + 1 : 0, archived: false });
  WS.nodes.push(n);
  if (type === 'domain') { WS.buckets.push(...defaultBuckets(n.id, n.updatedAt)); const w = curWS(); if (!w.all) { w.domainIds = [...(w.domainIds || []), n.id]; wsTouch(w); } }
  wsChanged(); return n;
}
function updateNode(id, patch) { const n = node(id); if (!n) return; Object.assign(n, patch); wsTouch(n); wsChanged(); }
function moveNode(id, dir) {
  const n = node(id); const sibs = (IDX.kids.get(n.parentId) || []).slice(); const i = sibs.indexOf(n), j = i + dir; if (j < 0 || j >= sibs.length) return;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]]; sibs.forEach((s, k) => { if (s.order !== k) { s.order = k; wsTouch(s); } }); wsChanged();
}
function reparentNode(id, newParent) {
  if (id === newParent || (newParent && subtree(id).has(newParent))) { toast("Can't move a node inside itself"); return; }
  const n = node(id); const sibs = IDX.kids.get(newParent) || [];
  n.parentId = newParent; n.order = sibs.length ? Math.max(...sibs.map((s) => s.order || 0)) + 1 : 0;
  if (!newParent) n.type = 'domain'; else if (n.type === 'domain') n.type = node(newParent).type === 'domain' ? 'group' : 'section';
  wsTouch(n); wsChanged();
}
function deleteNode(id) {
  const n = node(id); const ids = subtree(id); const affected = IT.items.filter((i) => ids.has(i.nodeId));
  if (!n.parentId && affected.length) { toast('Move or delete the items in this domain first (or archive it).'); return false; }
  if (affected.length) { affected.forEach((i) => { i.nodeId = n.parentId; i.updatedAt = nowISO(); i.lastEditedBy = 'kv'; }); markDirty('items'); }
  WS.nodes = WS.nodes.filter((x) => !ids.has(x.id)); ids.forEach((x) => tomb('node', x));
  if (!n.parentId) { WS.buckets.filter((b) => b.domainId === id).forEach((b) => tomb('bucket', b.id)); WS.buckets = WS.buckets.filter((b) => b.domainId !== id); }
  if (ids.has(UI.scope)) UI.scope = n.parentId || 'all';
  wsChanged(); return true;
}
function addBucket(domainId, name, color) {
  const bs = bucketsOf(domainId); const b = wsTouch({ id: uid('b'), domainId, name: name.trim() || 'New bucket', color: color || PALETTE[bs.length % PALETTE.length], isDone: false, isActive: false, order: bs.length ? Math.max(...bs.map((x) => x.order)) + 1 : 0 });
  WS.buckets.push(b); wsChanged(); return b;
}
function updateBucket(id, patch) { const b = bucket(id); Object.assign(b, patch); wsTouch(b); wsChanged(); }
function moveBucket(id, dir) { const b = bucket(id); const bs = bucketsOf(b.domainId); const i = bs.indexOf(b), j = i + dir; if (j < 0 || j >= bs.length) return; [bs[i], bs[j]] = [bs[j], bs[i]]; bs.forEach((x, k) => { if (x.order !== k) { x.order = k; wsTouch(x); } }); wsChanged(); }
function deleteBucket(id) {
  const b = bucket(id); const rest = bucketsOf(b.domainId).filter((x) => x.id !== id); if (!rest.length) { toast('A domain needs at least one bucket'); return false; }
  const moved = IT.items.filter((i) => i.status === id); const to = rest.find((x) => !x.isIdea) || rest[0]; moved.forEach((i) => { i.status = to.id; i.updatedAt = nowISO(); i.lastEditedBy = 'kv'; }); if (moved.length) markDirty('items');
  WS.buckets = WS.buckets.filter((x) => x.id !== id); tomb('bucket', id); wsChanged(); return true;
}
function addField(def) {
  const f = wsTouch({ id: uid('f'), domainId: def.domainId || null, name: def.name.trim() || 'Field', type: def.type, order: Math.max(0, ...WS.fields.map((x) => x.order || 0)) + 1 });
  if (['single-select', 'multi-select'].includes(def.type)) f.options = (def.options || []).map((o, i) => ({ id: uid('o'), name: o, color: PALETTE[i % PALETTE.length] }));
  WS.fields.push(f); wsChanged(); return f;
}
function updateField(id, patch) { const f = fieldDef(id); Object.assign(f, patch); wsTouch(f); wsChanged(); }
function setFieldOptionsFromText(f, text) {
  const names = text.split(',').map((s) => s.trim()).filter(Boolean); const old = f.options || [];
  f.options = names.map((n, i) => old.find((o) => o.name === n) || { id: uid('o'), name: n, color: PALETTE[(old.length + i) % PALETTE.length] });
  wsTouch(f); wsChanged();
}
function moveField(id, dir) { const fs = WS.fields.slice().sort(byOrder); const i = fs.findIndex((f) => f.id === id), j = i + dir; if (j < 0 || j >= fs.length) return; [fs[i], fs[j]] = [fs[j], fs[i]]; fs.forEach((x, k) => { if (x.order !== k) { x.order = k; wsTouch(x); } }); wsChanged(); }
function deleteField(id) { if (fieldDef(id) && fieldDef(id).builtin) { toast('Built-in fields can’t be deleted'); return; } if (id === AT) { toast('Action type is built in and can’t be deleted'); return; } WS.fields = WS.fields.filter((f) => f.id !== id); tomb('field', id); UI.rules = UI.rules.filter((r) => r.field !== 'f:' + id); if (UI.groupBy === 'f:' + id) UI.groupBy = 'status'; wsChanged(); }
function currentViewState() { return { view: UI.view, scope: UI.scope, search: UI.search, quick: clone(UI.quick), rules: clone(UI.rules), sort: clone(UI.sort), groupBy: UI.groupBy, colFilters: clone(UI.colFilters) }; }
function saveView(name) { const v = wsTouch({ id: uid('sv'), name: name.trim() || 'Saved view', ...currentViewState() }); WS.savedViews.push(v); UI.activeSaved = v.id; wsChanged(); return v; }
function applySaved(id) {
  const v = WS.savedViews.find((x) => x.id === id); if (!v) return;
  Object.assign(UI, { view: v.view || UI.view, scope: v.scope && (v.scope === 'all' || node(v.scope)) ? v.scope : 'all', search: v.search || '', quick: Object.assign(clone(DEFAULT_UI.quick), v.quick || {}), rules: clone(v.rules || []), sort: v.sort || UI.sort, groupBy: v.groupBy || 'status', colFilters: clone(v.colFilters || {}), activeSaved: id });
  render();
}
function deleteSaved(id) { WS.savedViews = WS.savedViews.filter((v) => v.id !== id); tomb('view', id); if (UI.activeSaved === id) UI.activeSaved = ''; wsChanged(); }

/* ---------------- menus & dialogs ---------------- */
function closeMenu() { const r = $('#menuRoot'); if (r.firstChild) { r.innerHTML = ''; if (closeMenu.ret) try { closeMenu.ret.focus(); } catch {} } }
function openMenu(anchor, entries) {
  closeMenu(); closeMenu.ret = anchor;
  const m = h('div', { class: 'menu', role: 'menu' }, entries.filter(Boolean).map((e) => e.sep ? h('div', { class: 'm-sep' }) : e.title ? h('div', { class: 'm-title' }, e.title) :
    h('button', { role: 'menuitem', class: e.danger ? 'danger' : null, onClick: (ev) => { ev.stopPropagation(); closeMenu(); e.onClick(); } }, e.icon ? h('span', { 'aria-hidden': 'true' }, e.icon) : null, e.label)));
  $('#menuRoot').append(m);
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let x = Math.min(r.left, innerWidth - mw - 8), y = r.bottom + 4; if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 4);
  m.style.left = Math.max(8, x) + 'px'; m.style.top = y + 'px';
  const btns = $$('button', m); if (btns[0]) btns[0].focus();
  m.addEventListener('keydown', (e) => { const i = btns.indexOf(document.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); } else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); closeMenu(); } });
  setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { closeMenu.ret = null; closeMenu(); } document.removeEventListener('pointerdown', off, true); }, true), 0);
}
const MODALS = [];
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && MODALS.length && !$('#menuRoot').firstChild && !e.defaultPrevented) { e.preventDefault(); MODALS[MODALS.length - 1](); } });
function openModal({ title, body, foot, cls = '', onClose, labelId }) {
  const ret = document.activeElement; const id = labelId || uid('mt');
  const back = h('div', { class: 'modal-back' });
  const close = () => { if (!back.isConnected) return; back.remove(); MODALS.splice(MODALS.indexOf(close), 1); if (onClose) onClose(); if (ret && ret.isConnected) try { ret.focus(); } catch {} };
  MODALS.push(close);
  const m = h('div', { class: 'modal ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': id },
    h('div', { class: 'm-head' }, h('h2', { id }, title), h('button', { class: 'icon-btn', 'aria-label': 'Close', onClick: close }, '✕')),
    h('div', { class: 'm-body' }, body), foot ? h('div', { class: 'm-foot' }, foot) : null);
  back.append(m); back.addEventListener('pointerdown', (e) => { if (e.target === back) back._down = true; }); back.addEventListener('click', (e) => { if (e.target === back && back._down) close(); back._down = false; });
  back.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { const f = $$('button,input,select,textarea,[tabindex="0"]', m).filter((x) => !x.disabled && x.offsetParent); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  });
  $('#modalRoot').append(back);
  setTimeout(() => { if (m.contains(document.activeElement)) return; const f = $('[autofocus]', m) || $('input,select,textarea', $('.m-body', m)) || $('button', m); if (f) f.focus(); }, 0);
  return { close, el: m, body: $('.m-body', m) };
}
function formDialog({ title, fields, ok = 'Save', danger }) {
  return new Promise((resolve) => {
    let done = false; const inputs = {};
    const body = h('form', { class: 'form-grid', onSubmit: (e) => { e.preventDefault(); submit(); } }, fields.map((f, i) => {
      let inp;
      if (f.type === 'select') inp = h('select', { name: f.name, value: f.value ?? '' }, f.options.map(([v, l]) => h('option', { value: v }, l)));
      else if (f.type === 'textarea') inp = h('textarea', { name: f.name, rows: 3, value: f.value ?? '' });
      else if (f.type === 'color') inp = h('input', { type: 'color', name: f.name, value: f.value || PALETTE[0] });
      else if (f.type === 'checkbox') inp = h('input', { type: 'checkbox', name: f.name, checked: !!f.value });
      else inp = h('input', { type: f.type || 'text', name: f.name, value: f.value ?? '', placeholder: f.placeholder || '', autofocus: i === 0 ? true : null, required: f.required ? true : null });
      inputs[f.name] = inp;
      return h('label', { class: 'fld' + (f.full !== false ? ' full' : '') }, h('span', null, f.label), inp, f.help ? h('small', { class: 'meta-line' }, f.help) : null);
    }), h('button', { type: 'submit', hidden: true }));
    const submit = () => { const out = {}; for (const [k, el] of Object.entries(inputs)) out[k] = el.type === 'checkbox' ? el.checked : el.value; done = true; md.close(); resolve(out); };
    const md = openModal({ title, body, cls: 'narrow', onClose: () => { if (!done) resolve(null); },
      foot: [h('span', { class: 'spacer' }), h('button', { class: 'btn', onClick: () => md.close() }, 'Cancel'), h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), 'data-ok': '1', onClick: submit }, ok)] });
  });
}
function confirmDialog(msg, ok = 'Delete') { return formDialogConfirm(msg, ok); }
function formDialogConfirm(msg, ok) {
  return new Promise((resolve) => { let done = false; const md = openModal({ title: 'Please confirm', body: h('p', null, msg), cls: 'narrow', onClose: () => { if (!done) resolve(false); },
    foot: [h('span', { class: 'spacer' }), h('button', { class: 'btn', onClick: () => md.close() }, 'Cancel'), h('button', { class: 'btn danger', 'data-ok': '1', onClick: () => { done = true; md.close(); resolve(true); } }, ok)] }); });
}

/* ---------------- chrome: sidebar, tabs, toolbar, chips, filters ---------------- */
function countIn(id) { const ids = subtree(id); return IT.items.filter((i) => ids.has(i.nodeId) && !isDone(i)).length; }
function renderTree() {
  const tree = $('#tree'); tree.innerHTML = '';
  const row = (n, depth) => {
    const kids = children(n.id); const collapsed = UI.collapsed[n.id];
    const li = h('li', { role: 'treeitem', 'aria-expanded': kids.length ? String(!collapsed) : null, 'aria-selected': String(UI.scope === n.id) },
      h('div', { class: 'trow' + (UI.scope === n.id ? ' sel' : '') + (n.archived ? ' archived' : ''), dataset: { node: n.id } },
        kids.length ? h('button', { class: 'twisty', 'aria-label': (collapsed ? 'Expand ' : 'Collapse ') + n.name, onClick: () => { UI.collapsed[n.id] = !collapsed; saveUI(); renderTree(); } }, collapsed ? '▸' : '▾') : h('span', { class: 'twisty' }),
        h('button', { class: 'tlink', onClick: () => setScope(n.id), title: fullPath(n.id) }, h('span', { class: 'dot', style: { background: nodeColor(n.id) } }), h('span', { class: 'tname' }, n.name), h('span', { class: 'tcount', 'aria-label': 'open items' }, countIn(n.id) || '')),
        h('button', { class: 'tmenu', 'aria-label': 'Options for ' + n.name, onClick: (e) => nodeMenu(e.currentTarget, n) }, '⋯')),
      kids.length && !collapsed ? h('ul', { role: 'group' }, kids.map((k) => row(k, depth + 1))) : null);
    return li;
  };
  const openAll = IT.items.filter((i) => inCurWS(i) && !isDone(i)).length;
  tree.append(h('ul', { role: 'tree', 'aria-label': 'Domains, groups and sections' },
    h('li', { role: 'treeitem', 'aria-selected': String(UI.scope === 'all') }, h('div', { class: 'trow' + (UI.scope === 'all' ? ' sel' : '') }, h('span', { class: 'twisty' }),
      h('button', { class: 'tlink', onClick: () => setScope('all') }, h('span', { class: 'dot', style: { background: 'var(--accent)' } }), h('span', { class: 'tname' }, 'All'), h('span', { class: 'tcount' }, openAll || '')))),
    domains().map((d) => row(d, 0))));
}
function setScope(id) { UI.scope = id; UI.quick.groups = []; UI.quick.section = ''; UI.activeSaved = ''; closeDrawer(); render(); }
function openDrawer() { $('#sidebar').classList.add('open'); $('#scrim').hidden = false; const f = $('.tlink', $('#sidebar')); if (f) f.focus(); }
function closeDrawer() { $('#sidebar').classList.remove('open'); $('#scrim').hidden = true; }
async function nodeDialog(title, n, parentId, type) {
  const r = await formDialog({ title, fields: [{ name: 'name', label: 'Name', value: n ? n.name : '', required: true }, { name: 'color', label: 'Color', type: 'color', value: n ? n.color || nodeColor(n.id) : (parentId ? nodeColor(parentId) : PALETTE[domains(true).length % PALETTE.length]) }], ok: n ? 'Save' : 'Add' });
  if (!r || !r.name.trim()) return null;
  if (n) { updateNode(n.id, { name: r.name.trim(), color: r.color }); return n; }
  return addNode(parentId, type, r.name, type === 'section' ? (r.color === nodeColor(parentId) ? null : r.color) : r.color);
}
function nodeMenu(anchor, n) {
  const sibs = IDX.kids.get(n.parentId) || []; const i = sibs.indexOf(n);
  openMenu(anchor, [
    { title: n.type },
    n.type === 'domain' ? { label: 'Add group / property', icon: '＋', onClick: () => nodeDialog('Add group to ' + n.name, null, n.id, 'group') } : null,
    { label: 'Add section', icon: '＋', onClick: () => nodeDialog('Add section to ' + n.name, null, n.id, 'section') },
    { label: 'Add card here', icon: '＋', onClick: () => openCard(null, { nodeId: n.type === 'group' ? defaultNodeIdFor(n.id) : n.id }) },
    { sep: 1 },
    { label: 'Rename / color…', icon: '✎', onClick: () => nodeDialog('Edit ' + n.name, n) },
    i > 0 ? { label: 'Move up', icon: '↑', onClick: () => moveNode(n.id, -1) } : null,
    i < sibs.length - 1 ? { label: 'Move down', icon: '↓', onClick: () => moveNode(n.id, 1) } : null,
    n.type !== 'domain' ? { label: 'Move to…', icon: '⇄', onClick: () => moveNodeDialog(n) } : null,
    { label: n.archived ? 'Unarchive' : 'Archive', icon: '🗄', onClick: () => updateNode(n.id, { archived: !n.archived }) },
    { label: 'Delete…', icon: '🗑', danger: true, onClick: async () => { const cnt = IT.items.filter((x) => subtree(n.id).has(x.nodeId)).length; if (await confirmDialog(`Delete "${n.name}" and everything nested under it?` + (cnt && n.parentId ? ` Its ${cnt} card(s) will move up to "${node(n.parentId).name}".` : ''))) deleteNode(n.id); } },
  ]);
}
async function moveNodeDialog(n) {
  const bad = subtree(n.id); const opts = treeOrderIds(domains().map((d) => d.id)).filter((id) => !bad.has(id)).map((id) => [id, '— '.repeat(ancestors(id).length - 1) + node(id).name]);
  const r = await formDialog({ title: `Move "${n.name}" under…`, fields: [{ name: 'p', label: 'New parent', type: 'select', value: n.parentId, options: opts }], ok: 'Move' });
  if (r) reparentNode(n.id, r.p);
}
function tabMenu(anchor, v) {
  const sv = getStartView(); const isDef = sv === v.id;
  openMenu(anchor, [{ title: v.name },
    isDef ? { label: 'Default view ✓ (use last-used instead)', icon: '★', onClick: () => { setStartView('last'); toast('Start in: last-used view'); renderTabs(); } }
      : { label: 'Set as default', icon: '☆', onClick: () => { setStartView(v.id); toast('Start in: ' + v.name); renderTabs(); } },
    { label: 'Start-in settings…', icon: '⚙', onClick: () => openSettings() }, { label: 'Show / hide / reorder views…', icon: '☰', onClick: () => openSettings('views') }]);
}
function renderTabs() {
  const nav = $('#viewTabs'); nav.innerHTML = ''; const sv = getStartView(); let list = visibleViews(); let overflow = [];
  if (!list.some((v) => v.id === UI.view)) { const cv = VIEWS.find((v) => v.id === UI.view); if (cv) list = [...list, cv]; }
  if (isPhone()) { const slots = Math.max(3, Math.floor((nav.clientWidth || innerWidth) / 64)); if (list.length > slots) { const keep = list.slice(0, slots - 1); const cur = list.find((v) => v.id === UI.view); if (cur && !keep.includes(cur)) keep[keep.length - 1] = cur; overflow = list.filter((v) => !keep.includes(v)); list = keep; } }
  nav.classList.toggle('has-more', !!overflow.length);
  list.forEach((v) => { const tab = h('button', { class: 'tab' + (sv === v.id ? ' is-default' : ''), role: 'tab', id: 'tab-' + v.id, 'aria-selected': String(UI.view === v.id), 'aria-controls': 'view', tabindex: UI.view === v.id ? '0' : '-1', dataset: { view: v.id }, title: sv === v.id ? v.name + ' (opens by default)' : null,
    onClick: () => { if (Date.now() - (tabMenu.lp || 0) < 600) return; UI.view = v.id; render(); },
    onContextmenu: (e) => { e.preventDefault(); tabMenu(e.currentTarget, v); },
    onKeydown: (e) => { const i = list.findIndex((x) => x.id === UI.view); let j = null; if (e.key === 'ArrowRight') j = (i + 1) % list.length; if (e.key === 'ArrowLeft') j = (i - 1 + list.length) % list.length; if (j != null) { e.preventDefault(); UI.view = list[j].id; render(); const t = $('#tab-' + UI.view); if (t) t.focus(); } } },
    h('span', { class: 'ico', 'aria-hidden': 'true' }, v.ico), h('span', { class: 'tab-label' }, v.name), sv === v.id ? h('span', { class: 'def-star', 'aria-label': '(default view)' }, '★') : null);
    let t = null; tab.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; clearTimeout(t); t = setTimeout(() => { tabMenu.lp = Date.now(); tabMenu(tab, v); }, 550); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => tab.addEventListener(ev, () => clearTimeout(t)));
    nav.append(tab);
    if (UI.view === v.id) nav.append(h('button', { class: 'tab-more', id: 'tabMore-' + v.id, 'aria-label': v.name + ' view options', 'aria-haspopup': 'menu', title: 'View options (Set as default)', onClick: (e) => tabMenu(e.currentTarget, v) }, '▾'));
  });
  if (overflow.length) nav.append(h('button', { class: 'tab tab-overflow', id: 'tab-more', 'aria-haspopup': 'menu', 'aria-label': 'More views', onClick: (e) => moreMenu(e.currentTarget, overflow) }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '⋯'), h('span', { class: 'tab-label' }, 'More')));
}
function activeFilterCount() { const q = UI.quick; return (q.ideas ? 1 : 0) + UI.rules.length + (q.domain ? 1 : 0) + (q.section ? 1 : 0) + (q.status ? 1 : 0) + (q.owner ? 1 : 0) + ((q.groups || []).length ? 1 : 0) + ((q.actionType || []).length ? 1 : 0); }
function groupByOptions() {
  const opts = [['status', 'Status'], ['group', 'Property / group'], ['section', 'Section'], ['agent', 'Bot']];
  fieldsFor(scopeDomains()).filter((f) => ['single-select', 'person'].includes(f.type) || f.id === AT).forEach((f) => opts.push(['f:' + f.id, f.name]));
  return opts;
}
function renderToolbar() {
  const tb = $('#toolbar'); tb.innerHTML = '';
  const search = h('input', { type: 'search', class: 'search', id: 'search', placeholder: 'Search cards…', 'aria-label': 'Search cards', value: UI.search });
  search.addEventListener('input', debounce(() => { UI.search = search.value; UI.activeSaved = ''; saveUI(); renderView(); renderFoot(); }, 150));
  const sv = h('select', { 'aria-label': 'Saved views', id: 'savedSel', value: UI.activeSaved || '', onChange: (e) => { if (e.target.value === '__save') { e.target.value = UI.activeSaved || ''; promptSaveView(); } else if (e.target.value === '__manage') { e.target.value = UI.activeSaved || ''; openManage('views'); } else if (e.target.value) applySaved(e.target.value); } },
    h('option', { value: '' }, 'Saved views…'), WS.savedViews.slice().sort((a, b) => a.name.localeCompare(b.name)).map((v) => h('option', { value: v.id }, v.name)), h('option', { value: '__save' }, '＋ Save current view…'), h('option', { value: '__manage' }, 'Manage saved views…'));
  const n = activeFilterCount();
  const fbtn = h('button', { class: 'btn', id: 'filtersBtn', 'aria-expanded': String(!$('#filterPanel').hidden), 'aria-controls': 'filterPanel', onClick: () => { const p = $('#filterPanel'); p.hidden = !p.hidden; fbtn.setAttribute('aria-expanded', String(!p.hidden)); if (!p.hidden) renderFilterPanel(); } }, '⚲ Filters', n ? h('span', { class: 'badge-count' }, n) : null);
  tb.append(search, fbtn, sv);
  if (UI.view === 'kanban') tb.append(h('label', { class: 'tb-label' }, 'Group ', h('select', { id: 'groupBySel', 'aria-label': 'Group kanban by', value: UI.groupBy, onChange: (e) => { UI.groupBy = e.target.value; render(); } }, groupByOptions().map(([v, l]) => h('option', { value: v }, l)))));
  if (UI.view === 'grid') tb.append(h('button', { class: 'btn', id: 'gridColsBtn', 'aria-haspopup': 'menu', onClick: (e) => gridColsMenu(e.currentTarget) }, '▥ Columns'));
  if (UI.view === 'gallery' || UI.view === 'grid') {
    const opts = [['due', 'Due'], ['title', 'Title'], ['status', 'Status'], ['group', 'Property'], ['updatedAt', 'Updated'], ['createdAt', 'Created'], ...fieldsFor(scopeDomains()).map((f) => ['f:' + f.id, f.name])];
    tb.append(h('label', { class: 'tb-label' }, 'Sort ', h('select', { 'aria-label': 'Sort by', value: UI.sort.key, onChange: (e) => { UI.sort = { key: e.target.value, dir: UI.sort.dir || 1 }; render(); } }, opts.map(([v, l]) => h('option', { value: v }, l)))),
      h('button', { class: 'icon-btn', 'aria-label': 'Toggle sort direction', title: 'Sort direction', onClick: () => { UI.sort.dir = -(UI.sort.dir || 1); render(); } }, UI.sort.dir < 0 ? '↓' : '↑'));
  }
  if (n || UI.search) tb.append(h('button', { class: 'btn ghost small', onClick: () => { UI.rules = []; UI.quick = clone(DEFAULT_UI.quick); UI.search = ''; UI.colFilters = {}; UI.activeSaved = ''; render(); } }, 'Clear'));
}
async function promptSaveView() {
  const r = await formDialog({ title: 'Save current view', fields: [{ name: 'name', label: 'View name', required: true, placeholder: 'e.g. Echo overdue' }], ok: 'Save view' });
  if (r && r.name.trim()) { saveView(r.name); toast('Saved view "' + r.name.trim() + '"'); }
}
function renderChips() {
  const c = $('#chips'); c.innerHTML = '';
  const doms = scopeDomains(); const groups = groupsIn(doms).filter((g) => UI.scope === 'all' || subtree(UI.scope).has(g.id) || ancestors(UI.scope).some((a) => a.id === g.id));
  const sel = UI.quick.groups || [];
  if (UI.scope === 'all' && domains().length > 1) {
    domains().forEach((d) => c.append(h('button', { class: 'chip', 'aria-pressed': String(UI.quick.domain === d.id), style: { '--chip': d.color }, onClick: () => { UI.quick.domain = UI.quick.domain === d.id ? '' : d.id; UI.quick.groups = []; UI.activeSaved = ''; render(); } }, h('span', { class: 'dot', style: { background: d.color } }), d.name)));
    c.append(h('span', { class: 'chip-sep', 'aria-hidden': 'true' }));
  }
  // action-type quick filters (show cards with ANY of the picked types)
  const atSel = UI.quick.actionType || [];
  atOptions().forEach((o) => c.append(h('button', { class: 'chip at-filter', 'aria-pressed': String(atSel.includes(o.id)), style: { '--chip': o.color }, dataset: { atFilter: o.id }, title: 'Show ' + o.name + ' cards',
    onClick: () => { const st = new Set(UI.quick.actionType || []); st.has(o.id) ? st.delete(o.id) : st.add(o.id); UI.quick.actionType = atOptions().map((x) => x.id).filter((x) => st.has(x)); UI.activeSaved = ''; render(); } }, h('span', { class: 'at-chip-ico', style: { color: o.color } }, atIcon(o.icon)), o.name)));
  c.append(h('button', { class: 'chip idea-filter', id: 'ideasChip', 'aria-pressed': String(!!UI.quick.ideas), style: { '--chip': '#eab308' }, title: 'Show only ideas', onClick: () => { UI.quick.ideas = !UI.quick.ideas; UI.activeSaved = ''; render(); } }, h('span', { class: 'at-chip-ico', style: { color: '#ca8a04' } }, atIcon('bulb')), 'Ideas'));
  const showGroups = groups.filter((g) => !UI.quick.domain || domainOf(g.id).id === UI.quick.domain);
  if (showGroups.length > 1) {
    c.append(h('span', { class: 'chip-sep', 'aria-hidden': 'true' }));
    c.append(h('button', { class: 'chip', 'aria-pressed': String(!sel.length), onClick: () => { UI.quick.groups = []; UI.activeSaved = ''; render(); } }, 'All properties'));
    showGroups.forEach((g) => c.append(h('button', { class: 'chip', 'aria-pressed': String(sel.includes(g.id)), style: { '--chip': g.color }, dataset: { group: g.id },
      onClick: () => { const s = new Set(sel); s.has(g.id) ? s.delete(g.id) : s.add(g.id); UI.quick.groups = [...s]; UI.activeSaved = ''; render(); } }, h('span', { class: 'dot', style: { background: g.color } }), g.name.replace(/\s*\(.*\)$/, ''))));
  }
  const q = UI.quick, defs = filterFieldDefs();
  const pill = (label, clear) => c.append(h('button', { class: 'chip', 'aria-pressed': 'true', title: 'Remove filter', onClick: () => { clear(); UI.activeSaved = ''; render(); } }, label, ' ✕'));
  if (q.status) pill('Status: ' + ((defs[1].options.find((o) => o.id === q.status) || {}).name || q.status), () => (q.status = ''));
  if (q.owner) pill('Owner: ' + q.owner, () => (q.owner = ''));
  if (q.section && node(q.section)) pill('Section: ' + pathLabel(q.section), () => (q.section = ''));
  UI.rules.forEach((r, i) => { const d = defs.find((x) => x.key === r.field); if (d) pill(`${d.label} ${(OPS[d.type].find((o) => o[0] === r.op) || [, r.op])[1]}${['empty', 'notempty', 'checked', 'unchecked'].includes(r.op) ? '' : ' ' + ruleValLabel(d, r.value)}`, () => UI.rules.splice(i, 1)); });
  c.hidden = !c.children.length;
}
function ruleValLabel(d, v) { if (Array.isArray(v)) return v.map((x) => ((d.options || []).find((o) => o.id === x) || { name: x }).name).join(', '); return String(v ?? ''); }
function renderFilterPanel() {
  const p = $('#filterPanel'); if (p.hidden) return; p.innerHTML = '';
  const defs = filterFieldDefs(); const q = UI.quick; const doms = scopeDomains();
  const qs = (label, key, options, id) => h('label', null, label, h('select', { id, value: q[key] || '', onChange: (e) => { q[key] = e.target.value; UI.activeSaved = ''; render(); } }, h('option', { value: '' }, 'Any'), options.map((o) => h('option', { value: o.id }, o.name))));
  p.append(h('div', { class: 'fp-grid' },
    UI.scope === 'all' ? qs('Domain', 'domain', domains().map((d) => ({ id: d.id, name: d.name })), 'qDomain') : null,
    qs('Section', 'section', defs.find((d) => d.key === 'section').options, 'qSection'),
    qs('Status', 'status', statusOptionsUnion(doms), 'qStatus'),
    qs('Owner', 'owner', WS.people.map((x) => ({ id: x, name: x })), 'qOwner')));
  p.append(h('div', { class: 'tb-label' }, 'Conditions (all must match)'));
  UI.rules.forEach((r, i) => {
    const d = defs.find((x) => x.key === r.field) || defs[0];
    const fieldSel = h('select', { 'aria-label': 'Field', class: 'rule-field', value: d.key, onChange: (e) => { const nd = defs.find((x) => x.key === e.target.value); UI.rules[i] = { field: nd.key, op: OPS[nd.type][0][0], value: nd.type === 'select' || nd.type === 'multi' ? [] : '' }; render(); } }, defs.map((x) => h('option', { value: x.key }, x.label)));
    const opSel = h('select', { 'aria-label': 'Operator', class: 'rule-op', value: r.op, onChange: (e) => { r.op = e.target.value; render(); } }, OPS[d.type].map(([v, l]) => h('option', { value: v }, l)));
    let valEl = null;
    if (!['empty', 'notempty', 'checked', 'unchecked'].includes(r.op)) {
      if (d.type === 'select' || d.type === 'multi') {
        const cur = Array.isArray(r.value) ? r.value : r.value ? [r.value] : [];
        valEl = h('select', { multiple: true, class: 'rule-val', 'aria-label': 'Values', size: Math.min(5, Math.max(2, d.options.length)), onChange: (e) => { r.value = [...e.target.selectedOptions].map((o) => o.value); UI.activeSaved = ''; saveUI(); renderView(); renderChips(); renderFoot(); } },
          d.options.map((o) => h('option', { value: o.id, selected: cur.includes(o.id) }, o.name)));
      } else {
        valEl = h('input', { class: 'rule-val', 'aria-label': 'Value', type: d.type === 'date' && r.value !== 'today' ? 'date' : d.type === 'number' ? 'number' : 'text', value: r.value ?? '', placeholder: d.type === 'date' ? 'YYYY-MM-DD or today' : 'value' });
        valEl.addEventListener('input', debounce(() => { r.value = valEl.value; UI.activeSaved = ''; saveUI(); renderView(); renderChips(); renderFoot(); }, 250));
        if (d.type === 'date') valEl = h('span', { class: 'rule' }, valEl, h('button', { class: 'btn small', type: 'button', onClick: () => { r.value = 'today'; render(); } }, 'Today'));
      }
    }
    p.append(h('div', { class: 'rule' }, h('span', { class: 'and' }, i ? 'AND' : 'Where'), fieldSel, opSel, valEl, h('button', { class: 'icon-btn', 'aria-label': 'Remove condition', onClick: () => { UI.rules.splice(i, 1); render(); } }, '✕')));
  });
  p.append(h('div', { class: 'rule' }, h('button', { class: 'btn small', id: 'addRuleBtn', onClick: () => { UI.rules.push({ field: 'title', op: 'contains', value: '' }); render(); } }, '＋ Add condition'),
    h('button', { class: 'btn small', onClick: promptSaveView }, 'Save as view…'),
    h('button', { class: 'btn small ghost', onClick: () => { UI.rules = []; UI.quick = clone(DEFAULT_UI.quick); UI.activeSaved = ''; render(); } }, 'Clear all'),
    h('button', { class: 'btn small ghost', onClick: () => { p.hidden = true; renderToolbar(); } }, 'Done')));
}
function renderFoot() {
  const upd = tsNum(IT.updated) >= tsNum(WS.updated) ? IT.updated : WS.updated;
  const vis = visibleItems().length, tot = scopedItems().length;
  $('#foot').textContent = `Last updated ${fmtStamp(upd)} · Showing ${vis} of ${tot} cards · Public page: don't store private info.`;
}
function renderHeader() {
  renderWsBar(); applyTheme();
  const s = UI.scope !== 'all' && node(UI.scope) ? fullPath(UI.scope) : 'All domains';
  const sv = WS.savedViews.find((v) => v.id === UI.activeSaved);
  $('#scopeLabel').textContent = s + (sv ? ' · ' + sv.name : '');
  $('#showArchived').checked = !!UI.showArchived;
  setSync(SYNC.state);
}
function render() {
  if (!WS) return;
  if (UI.scope !== 'all' && !node(UI.scope)) UI.scope = 'all';
  saveUI(); renderHeader(); renderTree(); renderTabs(); renderToolbar(); renderChips(); renderFilterPanel(); renderView(); renderFoot();
}
function softRender() {
  if (!WS) return;
  const a = document.activeElement; const editing = $('#modalRoot').firstChild || $('#menuRoot').firstChild || (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) || document.body.classList.contains('is-dragging');
  if (editing) { renderHeader(); renderFoot(); return; }
  render();
}

/* ---------------- shared card bits ---------------- */
function dueInfo(it) {
  if (!it.due) return null; const d = daysUntil(it.due); const done = isDone(it);
  const cls = done ? '' : d < 0 ? 'overdue' : d <= 7 ? 'soon' : '';
  const suffix = done ? '' : d < 0 ? ` · ${-d}d overdue` : d === 0 ? ' · today' : d === 1 ? ' · tomorrow' : '';
  return { cls, text: fmtDate(it.due) + suffix, d };
}
function dueBadge(it) { const i = dueInfo(it); return i ? h('span', { class: 'due ' + i.cls, title: 'Due ' + fmtDate(it.due, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }, '📅 ' + i.text) : null; }
function locChip(it) { const g = groupOf(it.nodeId); const d = domainOf(it.nodeId); const n = g || d; return n ? h('span', { class: 'prop', style: { '--pc': n.color || nodeColor(n.id) } }, n.name) : null; }
function statusPill(it) { const b = itemBucket(it); return b ? h('span', { class: 'pill', style: { '--pc': b.color } }, b.name) : null; }
function liveDot(it) { const b = itemBucket(it); return isActiveItem(it) ? h('span', { class: 'live-dot', style: { '--ac': b.color }, title: 'Actively being worked on', 'aria-label': 'active' }) : null; }
function priorityPill(it) { const f = fieldDef('priority'); const v = it.fields.priority; if (!f || !v) return null; return h('span', { class: 'pill', style: { '--pc': optColor(f, v) || '#64748b' } }, optName(f, v)); }
function cardEl(it) {
  const sec = pathLabel(it.nodeId); const cl = it.checklist; const doneN = cl.filter((c) => c.done).length;
  const act = isActiveItem(it); const bk = itemBucket(it);
  const idea = isIdeaItem(it);
  return h('article', { class: 'card' + (act ? ' is-active' : '') + (idea ? ' is-idea' : '') + (blockers(it).length && !isDone(it) ? ' is-blocked' : ''), style: act ? { '--ac': bk.color } : null, tabindex: '0', dataset: { id: it.id }, 'aria-roledescription': 'draggable card', 'aria-label': `${it.title}. ${groupOf(it.nodeId) ? groupOf(it.nodeId).name : ''} ${sec}. ${it.due ? 'Due ' + fmtDate(it.due) : ''}. Press Enter to open, Alt+arrow keys to move.` },
    h('div', { class: 'card-top' }, locChip(it), sec ? h('span', { class: 'card-sec' }, sec) : null),
    h('div', { class: 'card-title' }, it.title),
    it.fields.notes ? h('div', { class: 'card-note' }, it.fields.notes) : null,
    h('div', { class: 'card-meta' }, typeChip(it), actionChips(it), dueBadge(it), relChips(it), botChip(it), tokenChip(it), ciChip(it), it.fields.owner ? h('span', { class: 'owner', title: 'Owner' }, it.fields.owner) : null, priorityPill(it),
      cl.length ? h('span', { title: 'Checklist' }, `☑ ${doneN}/${cl.length}`) : null, it.comments.length ? h('span', { title: 'Comments' }, `💬 ${it.comments.length}`) : null,
      it.labels.map((l) => h('span', { class: 'label' }, l))),
    activityLine(it),
    h('button', { class: 'card-menu', 'aria-label': 'Card actions for ' + it.title, onClick: (e) => { e.stopPropagation(); cardMenu(e.currentTarget, it); } }, '⋯'));
}
function cardMenu(anchor, it) {
  const { cols } = kanbanColumns(visibleItems());
  openMenu(anchor, [
    { label: 'Open', icon: '↗', onClick: () => openCard(it.id) },
    { title: 'Move to ' + (groupByOptions().find((o) => o[0] === UI.groupBy) || ['', 'status'])[1].toLowerCase() },
    ...cols.filter((c) => c.key !== colKeyOf(it)).map((c) => ({ label: c.name, icon: '→', onClick: () => dropTo(it.id, c.key, c.items.filter((x) => x.id !== it.id).length) })),
    { sep: 1 },
    isIdeaItem(it) ? { label: 'Promote to task', icon: '⬆', onClick: () => promoteToTask(it.id) } : null,
    { label: 'Move to section…', icon: '⇄', onClick: () => moveItemDialog(it) },
    { label: 'Delete', icon: '🗑', danger: true, onClick: async () => { if (await confirmDialog(`Delete "${it.title}"?`)) deleteItem(it.id); } },
  ]);
}
function nodeOptions(rootIds = domains().map((d) => d.id), rel = false) { return treeOrderIds(rootIds).map((id) => [id, rel ? (pathLabel(id) || node(id).name) : fullPath(id)]); }
async function moveItemDialog(it) { const r = await formDialog({ title: 'Move card to…', fields: [{ name: 'n', label: 'Location', type: 'select', value: it.nodeId, options: nodeOptions() }], ok: 'Move' }); if (r) updateItem(it.id, { nodeId: r.n }); }

/* ---------------- Kanban ---------------- */
function colKeyOf(it, gb = UI.groupBy) {
  if (gb === 'status') return statusKey(it);
  if (gb === 'group') { const g = groupOf(it.nodeId); return g ? g.id : ''; }
  if (gb === 'section') return it.nodeId || '';
  if (gb === 'agent') return it.agent || '';
  if (gb === 'f:' + AT) { const v = atValues(it); return v[0] || ''; } // cards with several types sit under their first (primary) type
  if (gb.startsWith('f:')) { const f = fieldDef(gb.slice(2)); const v = it.fields[gb.slice(2)]; if (!f || isEmpty(v)) return ''; const o = fieldOptions(f).find((o) => o.id === v || o.name === v); return o ? o.id : ''; }
  return '';
}
function kanbanColumns(items) {
  let gb = UI.groupBy; if (!groupByOptions().some((o) => o[0] === gb)) gb = UI.groupBy = 'status';
  const doms = UI.quick.domain ? [UI.quick.domain] : scopeDomains(); let cols = [], single = doms.length === 1 ? doms[0] : null;
  if (gb === 'status') cols = single ? bucketsOf(single).map((b) => ({ key: b.name.toLowerCase(), name: b.name, color: b.color, bucket: b })) : statusOptionsUnion(doms).map((o) => ({ key: o.id, name: o.name, color: o.color }));
  else if (gb === 'group') cols = groupsIn(doms).filter((g) => UI.scope === 'all' || subtree(UI.scope).has(g.id) || ancestors(UI.scope).some((a) => a.id === g.id)).map((g) => ({ key: g.id, name: g.name, color: g.color }));
  else if (gb === 'section') {
    const roots = UI.scope !== 'all' && node(UI.scope) ? [UI.scope] : doms; const ids = treeOrderIds(roots).filter((id) => node(id).type === 'section');
    const used = new Set(items.map((i) => i.nodeId)); const show = ids.length <= 14 ? ids : ids.filter((id) => used.has(id));
    for (const id of used) if (id && node(id) && !show.includes(id)) show.push(id);
    cols = show.map((id) => ({ key: id, name: (groupOf(id) && !(UI.scope !== 'all' && groupOf(UI.scope)) ? groupOf(id).name.replace(/\s*\(.*\)$/, '') + ' › ' : '') + (pathLabel(id) || node(id).name), color: nodeColor(id) }));
  } else if (gb === 'agent') cols = wsBots().map((b, i) => ({ key: b.id, name: b.short || b.name, color: PALETTE[(i * 2) % PALETTE.length] }));
  else { const f = fieldDef(gb.slice(2)); const wb = new Set(wsBots().map((b) => (b.short || '').toLowerCase())), allShort = new Set(WS.bots.map((b) => (b.short || '').toLowerCase()));
    cols = fieldOptions(f).filter((o) => !(f.type === 'person' && !curWS().all && allShort.has(String(o.name).toLowerCase()) && !wb.has(String(o.name).toLowerCase()))).map((o, i) => ({ key: o.id, name: o.name, color: o.color || PALETTE[i % PALETTE.length] })); }
  const known = new Set(cols.map((c) => c.key));
  if (items.some((i) => !known.has(colKeyOf(i, gb)))) cols.push({ key: '', name: gb === 'status' ? 'Other status' : gb === 'agent' ? 'Other bots / none' : 'None', color: '#94a3b8', none: true });
  cols.forEach((c) => (c.items = items.filter((i) => (c.none ? !known.has(colKeyOf(i, gb)) : colKeyOf(i, gb) === c.key)).sort((a, b) => a.order - b.order || tsNum(a.createdAt) - tsNum(b.createdAt))));
  return { cols, single, gb };
}
function dropTo(id, key, index) {
  const it = getItem(id); if (!it) return; const { cols, gb } = kanbanColumns(visibleItems()); const col = cols.find((c) => c.key === key); if (!col || col.none) return;
  const others = col.items.filter((x) => x.id !== id); const prev = others[index - 1], next = others[index];
  const patch = { order: !prev && !next ? it.order : !prev ? next.order - 1 : !next ? prev.order + 1 : (prev.order + next.order) / 2 }; let fp = null;
  if (gb === 'status') { const b = bucketsOf(itemDomain(it)).find((x) => x.name.toLowerCase() === key); if (!b) { toast(`"${col.name}" isn't a bucket in ${domainOf(it.nodeId).name}`); return; } patch.status = b.id; }
  else if (gb === 'group') { if (groupOf(it.nodeId)?.id !== key) patch.nodeId = defaultNodeIdFor(key); }
  else if (gb === 'section') patch.nodeId = key;
  else if (gb === 'agent') patch.agent = key || null;
  else if (gb === 'f:' + AT) { const curV = atValues(it); if (curV[0] !== key) fp = { [AT]: [key, ...curV.slice(1).filter((x) => x !== key)] }; } // new primary type replaces the old one, extra types stay
  else fp = { [gb.slice(2)]: key || null };
  updateItem(id, patch, fp);
  requestAnimationFrame(() => { const el = $(`.card[data-id="${CSS.escape(id)}"]`); if (el && DND.keyboard) el.focus(); DND.keyboard = false; });
}
function renderKanban(v, items) {
  const { cols, single, gb } = kanbanColumns(items);
  const board = h('div', { class: 'board', role: 'list', 'aria-label': 'Kanban board' });
  cols.forEach((c, ci) => {
    const isIdeas = gb === 'status' && (c.bucket ? !!c.bucket.isIdea : c.key === 'ideas');
    if (isIdeas && (UI.ideasCol === 'closed' || (UI.ideasCol !== 'open' && !c.items.length))) {
      board.append(h('section', { class: 'col col-ideas collapsed', role: 'listitem', style: { '--cc': c.color }, dataset: { key: c.key }, 'aria-label': `${c.name}, ${c.items.length} cards (collapsed)` },
        h('button', { class: 'ideas-open', id: 'ideasOpen', 'aria-expanded': 'false', title: 'Show Ideas and capture one', onClick: () => { UI.ideasCol = 'open'; render(); requestAnimationFrame(() => { const n = $('#ideaQuick'); if (n) n.focus(); }); } }, atIcon('bulb'), h('span', { class: 'ideas-v' }, c.name), h('span', { class: 'count' }, c.items.length), h('span', { class: 'ideas-plus', 'aria-hidden': 'true' }, '＋')),
        h('div', { class: 'col-list', dataset: { key: c.key }, hidden: true })));
      return;
    }
    const presets = gb === 'status' ? (c.bucket ? { status: c.bucket.id } : {}) : gb === 'group' ? { nodeId: c.key && defaultNodeIdFor(c.key) } : gb === 'section' ? { nodeId: c.key } : gb === 'agent' ? { agent: c.key } : gb === 'f:' + AT ? { fields: { [AT]: c.key ? [c.key] : [] } } : { fields: { [gb.slice(2)]: c.key } };
    board.append(h('section', { class: 'col' + (isIdeas ? ' col-ideas' : ''), role: 'listitem', style: { '--cc': c.color }, dataset: { key: c.key }, 'aria-label': `${c.name}, ${c.items.length} cards` },
      h('div', { class: 'col-head' }, h('span', { class: 'dot', style: { background: c.color } }), h('span', null, c.name), h('span', { class: 'count' }, c.items.length),
        isIdeas ? h('button', { class: 'icon-btn ideas-close', 'aria-label': 'Collapse Ideas column', title: 'Collapse', onClick: () => { UI.ideasCol = 'closed'; render(); } }, '⟨') : null,
        c.bucket ? h('button', { class: 'icon-btn', 'aria-label': 'Bucket options for ' + c.name, onClick: (e) => bucketMenu(e.currentTarget, c.bucket) }, '⋯') : null),
      isIdeas ? ideaQuick(c) : null,
      h('div', { class: 'col-list', dataset: { key: c.key } }, c.items.map(cardEl)),
      c.none ? null : h('button', { class: 'col-add', onClick: () => openCard(null, presets) }, '＋ Add card')));
  });
  if (gb === 'status' && single) board.append(h('section', { class: 'col add-bucket' }, h('button', { class: 'btn', id: 'addBucketBtn', onClick: () => bucketDialog(single) }, '＋ Add bucket')));
  if (!cols.length) board.append(h('div', { class: 'empty' }, 'No columns yet.'));
  v.append(board);
  enableDnD(board);
}
function ideaQuick(c) {
  const inp = h('input', { type: 'text', id: 'ideaQuick', class: 'idea-quick', placeholder: '💡 Capture an idea…', 'aria-label': 'Add idea', enterkeyhint: 'done' });
  const go = () => { const v = inp.value.trim(); if (!v) return; const dom = c.bucket ? c.bucket.domainId : (UI.quick.domain || scopeDomains()[0]); const nid = UI.scope !== 'all' && node(UI.scope) && domainOf(UI.scope).id === dom ? UI.scope : defaultNodeIdIn(dom); addIdea(v, nid); requestAnimationFrame(() => { const n = $('#ideaQuick'); if (n) n.focus(); }); };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  return h('div', { class: 'idea-quick-row' }, inp, h('button', { class: 'btn small', type: 'button', 'aria-label': 'Add idea', onClick: go }, '＋'));
}
function defaultNodeIdIn(domId) { const cur = defaultNodeId(); if (cur && domainOf(cur) && domainOf(cur).id === domId) return cur; return domId; }
async function bucketDialog(domainId, b) {
  const r = await formDialog({ title: b ? 'Edit bucket' : 'Add bucket to ' + node(domainId).name, fields: [{ name: 'name', label: 'Name', value: b ? b.name : '', required: true }, { name: 'color', label: 'Color', type: 'color', value: b ? b.color : PALETTE[bucketsOf(domainId).length % PALETTE.length] }, { name: 'isDone', label: 'Counts as done (not overdue)', type: 'checkbox', value: b ? b.isDone : false }, { name: 'isActive', label: 'Active (animated): cards here get the moving edge light', type: 'checkbox', value: b ? !!b.isActive : false }], ok: b ? 'Save' : 'Add' });
  if (!r || !r.name.trim()) return; if (b) updateBucket(b.id, { name: r.name.trim(), color: r.color, isDone: r.isDone, isActive: r.isActive }); else { const nb = addBucket(domainId, r.name, r.color); if (r.isDone || r.isActive) updateBucket(nb.id, { isDone: r.isDone, isActive: r.isActive }); }
}
function bucketMenu(anchor, b) {
  const bs = bucketsOf(b.domainId); const i = bs.indexOf(b);
  openMenu(anchor, [{ label: 'Rename / color…', icon: '✎', onClick: () => bucketDialog(b.domainId, b) },
    i > 0 ? { label: 'Move left', icon: '←', onClick: () => moveBucket(b.id, -1) } : null, i < bs.length - 1 ? { label: 'Move right', icon: '→', onClick: () => moveBucket(b.id, 1) } : null,
    { label: 'Delete bucket…', icon: '🗑', danger: true, onClick: async () => { if (await confirmDialog(`Delete bucket "${b.name}"? Its cards move to "${bs.find((x) => x.id !== b.id)?.name}".`)) deleteBucket(b.id); } }]);
}

/* Drag & drop with Pointer Events: mouse drags after 5px, touch/pen after a 350ms long-press. */
const DND = { active: false, justDropped: 0, keyboard: false };
function enableDnD(board) {
  board.addEventListener('click', (e) => { if (e.target.closest('.card-menu')) return; const c = e.target.closest('.card'); if (!c) return; if (Date.now() - DND.justDropped < 120) { e.preventDefault(); return; } openCard(c.dataset.id); });
  board.addEventListener('contextmenu', (e) => { if (e.target.closest('.card') && (DND.pendingTouch || DND.active)) e.preventDefault(); });
  board.addEventListener('keydown', (e) => {
    const c = e.target.closest('.card'); if (!c || e.target !== c) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(c.dataset.id); return; }
    if (!e.altKey || !/^Arrow/.test(e.key)) return; e.preventDefault();
    const it = getItem(c.dataset.id); const { cols } = kanbanColumns(visibleItems()); const ci = cols.findIndex((x) => x.items.some((y) => y.id === it.id)); if (ci < 0) return;
    const col = cols[ci]; const idx = col.items.findIndex((y) => y.id === it.id); DND.keyboard = true;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { let j = ci + (e.key === 'ArrowLeft' ? -1 : 1); while (cols[j] && cols[j].none) j += e.key === 'ArrowLeft' ? -1 : 1; if (cols[j]) { dropTo(it.id, cols[j].key, Math.min(idx, cols[j].items.length)); toast('Moved to ' + cols[j].name, 1200); } }
    else { const j = idx + (e.key === 'ArrowUp' ? -1 : 1); if (j >= 0 && j < col.items.length) dropTo(it.id, col.key, j); }
  });
  board.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.card'); if (!card || e.target.closest('.card-menu') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const touch = e.pointerType !== 'mouse'; const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let ghost = null, ph = null, timer = null, last = { x: sx, y: sy }, raf = 0, offX = 0, offY = 0, target = null;
    const begin = () => {
      DND.active = true; DND.pendingTouch = false; const r = card.getBoundingClientRect(); offX = last.x - r.left; offY = last.y - r.top;
      ghost = card.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.style.width = r.width + 'px'; document.body.append(ghost);
      ph = h('div', { class: 'placeholder', style: { height: r.height + 'px' } }); card.after(ph); card.classList.add('drag-src');
      document.body.classList.add('is-dragging'); if (navigator.vibrate) try { navigator.vibrate(15); } catch {}
      try { card.releasePointerCapture && card.releasePointerCapture(pid); } catch {}
      move({ pointerId: pid, clientX: last.x, clientY: last.y, preventDefault() {} }); raf = requestAnimationFrame(autoScroll);
    };
    const place = () => {
      ghost.style.transform = `translate(${last.x - offX}px, ${last.y - offY}px)`;
      const el = document.elementFromPoint(last.x, last.y); const colEl = el && el.closest('.col:not(.add-bucket)'); const list = colEl && $('.col-list', colEl); if (!list) return;
      const cards = $$('.card:not(.drag-src)', list); let before = null;
      for (const c of cards) { const r = c.getBoundingClientRect(); if (last.y < r.top + r.height / 2) { before = c; break; } }
      if (before) { if (ph.nextSibling !== before) list.insertBefore(ph, before); } else if (ph.parentNode !== list || ph.nextSibling) list.append(ph);
      target = list;
    };
    const autoScroll = () => {
      if (!DND.active) return; const edge = 56; const br = board.getBoundingClientRect(); const L = Math.max(br.left, 0), R = Math.min(br.right, innerWidth);
      const speed = (d) => Math.max(3, Math.round(((edge - d) / edge) * 13));
      if (last.x < L + edge) board.scrollLeft -= speed(last.x - L); else if (last.x > R - edge) board.scrollLeft += speed(R - last.x);
      if (last.y < 70) window.scrollBy(0, -sp); else if (last.y > innerHeight - 70 - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h')) || 0)) window.scrollBy(0, sp);
      place(); raf = requestAnimationFrame(autoScroll);
    };
    const move = (ev) => {
      if (ev.pointerId !== pid) return; last = { x: ev.clientX, y: ev.clientY }; const dist = Math.hypot(last.x - sx, last.y - sy);
      if (!DND.active) { if (touch) { if (dist > 10) cleanup(); } else if (dist > 5) begin(); return; }
      ev.preventDefault(); place();
    };
    const blockTouch = (ev) => { if (DND.active) ev.preventDefault(); };
    const up = (ev) => {
      if (ev.pointerId !== pid) return;
      if (DND.active) {
        DND.justDropped = Date.now(); const list = ph.parentNode; const key = list && list.dataset.key;
        const idx = list ? $$('.card:not(.drag-src), .placeholder', list).indexOf(ph) : -1; const id = card.dataset.id;
        cleanup(); if (list && key != null && idx >= 0) dropTo(id, key, idx); else render();
      } else cleanup();
    };
    const cleanup = () => {
      clearTimeout(timer); cancelAnimationFrame(raf); DND.pendingTouch = false;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('touchmove', blockTouch);
      if (ghost) ghost.remove(); if (ph) ph.remove(); card.classList.remove('drag-src'); document.body.classList.remove('is-dragging'); DND.active = false; ghost = ph = null;
    };
    const cancel = (ev) => { if (ev.pointerId === pid) { cleanup(); } };
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', blockTouch, { passive: false });
    if (touch) { DND.pendingTouch = true; timer = setTimeout(begin, 350); }
  });
}

/* ---------------- Grid ---------------- */
function gridCols() { return gridColsAll().filter((c) => c.key === 'title' || !gridColHidden(c.key)); }
function gridColsAll() {
  return [{ key: 'title', label: 'Title', type: 'text' }, { key: 'status', label: 'Status', type: 'status' }, { key: 'group', label: 'Property', type: 'group' }, { key: 'section', label: 'Section', type: 'section' },
    { key: 'due', label: 'Due', type: 'date' }, { key: 'start', label: 'Start', type: 'date' },
    ...fieldsFor(scopeDomains()).map((f) => ({ key: 'f:' + f.id, label: f.name, type: f.type, field: f })),
    { key: 'agent', label: 'Bot', type: 'agent' }, { key: 'taskUrl', label: 'Task link', type: 'url' },
    { key: 'labels', label: 'Labels', type: 'labels' }, { key: 'source', label: 'Source', ro: true }, { key: 'updatedAt', label: 'Updated', ro: true }];
}
function cellText(it, c) {
  switch (c.key) {
    case 'title': return it.title; case 'status': { const b = itemBucket(it); return b ? b.name : ''; }
    case 'group': { const g = groupOf(it.nodeId); return g ? g.name : ''; } case 'section': return pathLabel(it.nodeId);
    case 'due': case 'start': return it[c.key] ? fmtDate(it[c.key], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    case 'agent': { const b = botOf(it); return b ? b.name : ''; } case 'taskUrl': return it.taskUrl || '';
    case 'labels': return it.labels.join(', '); case 'source': return it.source; case 'updatedAt': return fmtStamp(it.updatedAt).replace(/^\w+, /, '');
    default: return c.field ? fmtFieldVal(c.field, it.fields[c.field.id]) : '';
  }
}
const SELECT_COLS = new Set(['status', 'group', 'single-select', 'person', 'checkbox', 'agent']);
function renderGrid(v, items) {
  const cols = gridCols(); const cf = UI.colFilters || (UI.colFilters = {});
  let rows = items.filter((it) => cols.every((c) => { const f = cf[c.key]; if (!f) return true; const t = cellText(it, c).toLowerCase(); return SELECT_COLS.has(c.type) ? t === f.toLowerCase() || (f === '(empty)' && !t) : t.includes(f.toLowerCase()); }));
  rows = sortItems(rows);
  const thead = h('thead', null,
    h('tr', null, cols.map((c) => h('th', { scope: 'col', 'aria-sort': UI.sort.key === c.key ? (UI.sort.dir > 0 ? 'ascending' : 'descending') : 'none' },
      h('button', { class: 'th-btn', onClick: () => { UI.sort = UI.sort.key === c.key ? { key: c.key, dir: -UI.sort.dir } : { key: c.key, dir: 1 }; render(); } }, c.label, UI.sort.key === c.key ? (UI.sort.dir > 0 ? ' ▲' : ' ▼') : '')))),
    h('tr', { class: 'frow' }, cols.map((c) => {
      let inp;
      if (SELECT_COLS.has(c.type)) { const opts = [...new Set(items.map((it) => cellText(it, c)).filter(Boolean))].sort(); inp = h('select', { 'aria-label': 'Filter ' + c.label, value: cf[c.key] || '', onChange: (e) => { cf[c.key] = e.target.value; saveUI(); renderView(); renderFoot(); } }, h('option', { value: '' }, 'All'), opts.map((o) => h('option', { value: o }, o)), h('option', { value: '(empty)' }, '(empty)')); }
      else { inp = h('input', { type: 'text', 'aria-label': 'Filter ' + c.label, placeholder: 'Filter…', value: cf[c.key] || '', dataset: { fkey: c.key } }); inp.addEventListener('input', debounce(() => { cf[c.key] = inp.value; saveUI(); renderView(); const again = $(`.frow input[data-fkey="${c.key}"]`); if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); } }, 250)); }
      return h('th', null, inp);
    })));
  const tbody = h('tbody', null, rows.map((it) => h('tr', { dataset: { id: it.id } }, cols.map((c) => {
    const td = h('td', { class: 'c-' + c.key.replace('f:', '') + (c.field ? ' c-' + c.field.type : '') });
    const txt = cellText(it, c);
    let content;
    if (c.key === 'status') { const b = itemBucket(it); content = b ? h('span', { class: 'status-wrap' }, h('span', { class: 'pill', style: { '--pc': b.color } }, b.name), liveDot(it)) : ''; }
    else if (c.key === 'agent') { const b = botOf(it); content = b ? h('span', { class: 'bot-name' }, '🤖 ', b.short || b.name) : ''; }
    else if (c.key === 'group') { content = locChip(it) || ''; }
    else if (c.key === 'due') { content = dueBadge(it) || ''; }
    else if (c.field && c.field.id === AT) content = actionChips(it) || '';
    else if (c.field && c.field.type === 'checkbox') content = it.fields[c.field.id] ? '☑' : '☐';
    else if (c.field && c.field.type === 'url' && txt) content = h('a', { href: /^https?:/i.test(txt) ? txt : 'https://' + txt, target: '_blank', rel: 'noopener noreferrer', onClick: (e) => e.stopPropagation() }, txt);
    else content = txt;
    const btn = h('button', { class: 'cell' + (c.ro ? ' ro' : ''), dataset: { cell: it.id + '|' + c.key }, 'aria-label': `${c.label}: ${txt || 'empty'}${c.ro ? '' : ', press Enter to edit'}`, title: txt }, content);
    if (!c.ro) btn.addEventListener('click', () => (c.field && c.field.type === 'checkbox') ? updateItem(it.id, {}, { [c.field.id]: !it.fields[c.field.id] }) : startEdit(td, it, c));
    td.append(btn);
    if (c.key === 'title') td.append(h('button', { class: 'open-btn', 'aria-label': 'Open card ' + it.title, title: 'Open card', onClick: () => openCard(it.id) }, '↗'));
    return td;
  }))));
  const wrap = h('div', { class: 'grid-wrap' }, h('table', { class: 'grid', 'aria-label': 'Cards table', 'aria-rowcount': rows.length }, thead, tbody));
  v.append(wrap, h('div', { style: { 'margin-top': '10px' } }, h('button', { class: 'btn', onClick: () => openCard(null, {}) }, '＋ Add card'), rows.length ? null : h('span', { class: 'tb-label' }, '  No cards match.')));
}
function startEdit(td, it, c) {
  if (td.querySelector('input,select,textarea')) return;
  let el; const t = c.field ? c.field.type : c.key; let done = false;
  const commit = (val) => {
    if (done) return; done = true; const key = it.id + '|' + c.key;
    const fin = () => requestAnimationFrame(() => { const b = $(`[data-cell="${CSS.escape(key)}"]`); if (b) b.focus(); });
    if (c.key === 'title') { if (val.trim() && val !== it.title) updateItem(it.id, { title: val.trim() }); else renderView(); }
    else if (c.key === 'status') updateItem(it.id, { status: val });
    else if (c.key === 'group') { if (val && groupOf(it.nodeId)?.id !== val) updateItem(it.id, { nodeId: defaultNodeIdFor(val) }); else renderView(); }
    else if (c.key === 'section') { if (val && val !== it.nodeId) updateItem(it.id, { nodeId: val }); else renderView(); }
    else if (c.key === 'due' || c.key === 'start') { if ((val || null) !== it[c.key]) updateItem(it.id, { [c.key]: val || null }); else renderView(); }
    else if (c.key === 'labels') updateItem(it.id, { labels: val.split(',').map((s) => s.trim()).filter(Boolean) });
    else if (c.key === 'agent') { if ((val || null) !== it.agent) updateItem(it.id, { agent: val || null }); else renderView(); }
    else if (c.key === 'taskUrl') { const v = val.trim(); if (v && !validTaskUrl(v)) { toast('Task link must start with http:// or https://'); renderView(); } else if ((v || null) !== it.taskUrl) updateItem(it.id, { taskUrl: v || null }); else renderView(); }
    else if (c.field) { const f = c.field; let v = val; if (f.type === 'number') v = val === '' ? null : Number(val); if (JSON.stringify(v ?? null) !== JSON.stringify(it.fields[f.id] ?? null)) updateItem(it.id, {}, { [f.id]: v }); else renderView(); }
    fin();
  };
  const sel = (opts, cur) => h('select', { value: cur ?? '' }, opts.map(([v, l]) => h('option', { value: v }, l)));
  if (c.key === 'status') el = sel(bucketsOf(itemDomain(it)).map((b) => [b.id, b.name]), itemBucket(it)?.id);
  else if (c.key === 'agent') el = sel([['', '—'], ...WS.bots.map((b) => [b.id, b.name])], it.agent || '');
  else if (c.key === 'taskUrl') el = h('input', { type: 'url', value: it.taskUrl || '', placeholder: 'https://' });
  else if (c.key === 'group') el = sel([['', '—'], ...groupsIn([itemDomain(it)]).map((g) => [g.id, g.name])], groupOf(it.nodeId)?.id || '');
  else if (c.key === 'section') { const root = groupOf(it.nodeId) || domainOf(it.nodeId); el = sel(nodeOptions([root.id], true), it.nodeId); }
  else if (c.key === 'due' || c.key === 'start' || t === 'date') el = h('input', { type: 'date', value: c.field ? it.fields[c.field.id] || '' : it[c.key] || '' });
  else if (t === 'single-select' || t === 'person') el = sel([['', '—'], ...fieldOptions(c.field).map((o) => [o.id, o.name])], it.fields[c.field.id] || '');
  else if (t === 'multi-select') { const cur = it.fields[c.field.id] || []; el = h('select', { multiple: true, size: Math.min(6, fieldOptions(c.field).length || 2) }, fieldOptions(c.field).map((o) => h('option', { value: o.id, selected: cur.includes(o.id) }, o.name))); }
  else if (t === 'long-text') el = h('textarea', { rows: 3, value: it.fields[c.field.id] || '' });
  else if (c.key === 'labels') el = h('input', { type: 'text', value: it.labels.join(', '), placeholder: 'comma, separated' });
  else el = h('input', { type: t === 'number' ? 'number' : t === 'url' ? 'url' : 'text', value: c.key === 'title' ? it.title : (it.fields[c.field.id] ?? '') });
  el.setAttribute('aria-label', 'Edit ' + c.label);
  const getVal = () => el.multiple ? [...el.selectedOptions].map((o) => o.value) : el.value;
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { done = true; e.stopPropagation(); renderView(); requestAnimationFrame(() => { const b = $(`[data-cell="${CSS.escape(it.id + '|' + c.key)}"]`); if (b) b.focus(); }); } else if (e.key === 'Enter' && (el.tagName !== 'TEXTAREA' || e.ctrlKey || e.metaKey) && !el.multiple) { e.preventDefault(); commit(getVal()); } });
  if (el.tagName === 'SELECT' && !el.multiple) el.addEventListener('change', () => commit(getVal()));
  el.addEventListener('blur', () => setTimeout(() => commit(getVal()), 0));
  td.innerHTML = ''; td.append(el); el.focus(); if (el.select && el.tagName === 'INPUT' && el.type === 'text') el.select();
}

/* ---------------- Dashboard ---------------- */
function barsPanel(title, rows) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return h('div', { class: 'panel' }, h('h3', null, title), rows.length ? h('div', { class: 'bars', role: 'list' }, rows.map((r) => h('div', { class: 'bar-row', role: 'listitem', 'aria-label': `${r.name}: ${r.n}` },
    h('span', { style: { overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' } }, r.name), h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill', style: { width: (r.n / max) * 100 + '%', background: r.color || 'var(--accent)' } })), h('b', null, r.n)))) : h('div', { class: 'empty' }, 'Nothing here'));
}
function donut(rows, size = 140) {
  const total = rows.reduce((s, r) => s + r.n, 0) || 1; const R = 52, C = 2 * Math.PI * R; let off = 0; const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 140 140'); svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', rows.map((r) => `${r.name} ${r.n}`).join(', '));
  const bg = document.createElementNS(ns, 'circle'); Object.entries({ cx: 70, cy: 70, r: R, fill: 'none', stroke: 'var(--panel2)', 'stroke-width': 22 }).forEach(([k, v]) => bg.setAttribute(k, v)); svg.append(bg);
  rows.forEach((r) => { const c = document.createElementNS(ns, 'circle'); const len = (r.n / total) * C; Object.entries({ cx: 70, cy: 70, r: R, fill: 'none', stroke: r.color, 'stroke-width': 22, 'stroke-dasharray': `${len} ${C - len}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 70 70)' }).forEach(([k, v]) => c.setAttribute(k, v)); off += len; svg.append(c); });
  const t = document.createElementNS(ns, 'text'); Object.entries({ x: 70, y: 76, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: 'currentColor' }).forEach(([k, v]) => t.setAttribute(k, v)); t.textContent = rows.reduce((s, r) => s + r.n, 0); svg.append(t);
  return svg;
}
function itemList(list, empty) {
  return list.length ? h('ul', { class: 'list' }, list.map((it) => h('li', null, h('button', { onClick: () => openCard(it.id) }, dueBadge(it), locChip(it), h('span', null, it.title))))) : h('div', { class: 'empty' }, empty);
}
/* ---------------- Calendar ---------------- */
/* Calendar "Bills" chip (per device): only cards filed in a Bills section (any level), shown as bill due-date markers. */
const CAL_BILLS_KEY = 'mre.cal.bills';
function calBillsOn() { try { return localStorage.getItem(CAL_BILLS_KEY) === '1'; } catch { return false; } }
function isBillItem(it) { return ancestors(it.nodeId).some((n) => /^bills?$/i.test(String(n.name).trim())); }
function renderCalendar(v, items) {
  const billsOn = calBillsOn(); if (billsOn) items = items.filter(isBillItem);
  const month = UI.calMonth || todayStr().slice(0, 7); const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`; const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); const gridStart = addDays(first, -startDow);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate(); const weeks = Math.ceil((startDow + daysInMonth) / 7);
  const byDay = new Map(); items.filter((i) => i.due).forEach((i) => { if (!byDay.has(i.due)) byDay.set(i.due, []); byDay.get(i.due).push(i); });
  const shift = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); UI.calMonth = d.toISOString().slice(0, 7); UI.calDay = null; render(); };
  const narrow = matchMedia('(max-width: 700px)').matches;
  v.append(h('div', { class: 'cal-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Previous month', id: 'calPrev', onClick: () => shift(-1) }, '‹'),
    h('h2', { 'aria-live': 'polite' }, new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })),
    h('button', { class: 'icon-btn', 'aria-label': 'Next month', id: 'calNext', onClick: () => shift(1) }, '›'), h('button', { class: 'btn small', onClick: () => { UI.calMonth = null; UI.calDay = todayStr(); render(); } }, 'Today'),
    h('button', { class: 'chip cal-bills', id: 'calBills', 'aria-pressed': String(billsOn), style: { '--chip': '#ca8a04' }, title: billsOn ? 'Showing only cards in Bills sections — click to show everything' : 'Show only cards in Bills sections', onClick: () => { try { localStorage.setItem(CAL_BILLS_KEY, billsOn ? '0' : '1'); } catch {} UI.calDay = null; renderView(); } }, h('span', { class: 'at-chip-ico' }, atIcon('bill')), 'Bills'),
    billsOn ? h('span', { class: 'meta-line', id: 'calBillsNote' }, (() => { const end = addDays(gridStart, weeks * 7 - 1); const n = items.filter((i) => i.due && i.due >= gridStart && i.due <= end).length; return `${n} bill${n === 1 ? '' : 's'} due in view · Bills sections only`; })()) : null));
  const cal = h('div', { class: 'cal' + (narrow ? ' mini' : ''), role: 'grid', 'aria-label': 'Month' }, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => h('div', { class: 'dow', role: 'columnheader' }, narrow ? d[0] : d)));
  for (let k = 0; k < weeks * 7; k++) {
    const ds = addDays(gridStart, k); const list = (byDay.get(ds) || []).sort((a, b) => isDone(a) - isDone(b));
    const cls = 'day' + (ds.slice(0, 7) !== month ? ' other' : '') + (ds === todayStr() ? ' today' : '') + (UI.calDay === ds ? ' sel' : '');
    cal.append(h('button', { class: cls, role: 'gridcell', dataset: { day: ds }, 'aria-label': `${fmtDate(ds, { weekday: 'long', month: 'long', day: 'numeric' })}, ${list.length} cards`, onClick: () => { UI.calDay = UI.calDay === ds ? null : ds; renderView(); } },
      h('span', { class: 'dnum' }, Number(ds.slice(8))),
      narrow ? h('span', { class: 'dots' }, list.slice(0, 4).map((i) => billsOn ? h('i', { class: 'bill-dot', style: { '--pc': nodeColor(i.nodeId) } }, atIcon('bill')) : h('i', { style: { '--pc': nodeColor(i.nodeId) } }))) :
        [list.slice(0, 3).map((i) => h('span', { class: 'cal-pill' + (isDone(i) ? ' done' : '') + (billsOn ? ' bill' : ''), style: { '--pc': nodeColor(i.nodeId) }, title: billsOn ? 'Bill due: ' + i.title : null }, billsOn ? atIcon('bill') : null, i.title)), list.length > 3 ? h('span', { class: 'cal-more' }, `+${list.length - 3} more`) : null]));
  }
  v.append(cal);
  const panel = h('div', { class: 'day-panel' });
  if (UI.calDay) panel.append(h('div', { class: 'panel' }, h('h3', null, fmtDate(UI.calDay, { weekday: 'long', month: 'long', day: 'numeric' })), itemList(byDay.get(UI.calDay) || [], billsOn ? 'No bills due this day' : 'No cards due this day'), h('button', { class: 'btn small', style: { 'margin-top': '8px' }, onClick: () => openCard(null, { due: UI.calDay }) }, '＋ Add card on this day')));
  else if (narrow) {
    const gridEnd = addDays(gridStart, weeks * 7 - 1); const days = [...byDay.keys()].filter((d) => d >= gridStart && d <= gridEnd).sort();
    panel.append(h('div', { class: 'agenda' }, days.length ? days.map((d) => [h('h4', null, fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })), itemList(byDay.get(d), '')]) : h('div', { class: 'empty' }, billsOn ? 'No bills due this month' : 'No due dates this month')));
  }
  const nodue = items.filter((i) => !i.due && !isDone(i)).length;
  if (nodue) panel.append(h('p', { class: 'tl-note' }, `${nodue} open ${billsOn ? 'bill card(s)' : 'card(s)'} have no due date.`));
  v.append(panel);
}

/* ---------------- Timeline ---------------- */
function renderTimeline(v, items) {
  const withDue = items.filter((i) => i.due); const t0 = todayStr();
  const spans = withDue.map((i) => { let s = i.start || dateOnly(i.createdAt) || i.due; let e = i.due; if (s > e) [s, e] = [e, s]; return { it: i, s, e }; });
  let min = addDays(t0, -7), max = addDays(t0, 35); spans.forEach((x) => { if (x.s < min) min = addDays(x.s, -2); if (x.e > max) max = addDays(x.e, 5); });
  const days = dnum(max) - dnum(min) + 1; const narrow = matchMedia('(max-width: 700px)').matches; const dw = narrow ? 22 : 28; const lw = narrow ? 120 : 220;
  const W = days * dw; const x = (d) => (dnum(d) - dnum(min)) * dw;
  const tl = h('div', { class: 'tl', style: { '--tl-lw': lw + 'px', width: lw + W + 'px' } });
  const head = h('div', { class: 'tl-row tl-head' }, h('div', { class: 'tl-label' }, 'Property / card'), h('div', { class: 'tl-track', style: { width: W + 'px', height: '38px' } }, Array.from({ length: days }, (_, k) => { const d = addDays(min, k); const dow = new Date(dnum(d) * 864e5).getUTCDay();
    return [d.endsWith('-01') || k === 0 ? h('span', { class: 'tl-month', style: { left: k * dw + 'px' } }, fmtDate(d, { month: 'short', year: 'numeric' })) : null, h('span', { class: 'tl-day' + (dow === 0 || dow === 6 ? ' we' : ''), style: { left: k * dw + 'px', width: dw + 'px' } }, Number(d.slice(8)))]; })));
  tl.append(head);
  const groups = new Map(); spans.forEach((sp) => { const g = groupOf(sp.it.nodeId) || domainOf(sp.it.nodeId); const k = g ? g.id : ''; if (!groups.has(k)) groups.set(k, { g, rows: [] }); groups.get(k).rows.push(sp); });
  const ordered = [...groups.values()].sort((a, b) => (a.g ? treeOrderIds(domains(true).map((d) => d.id)).indexOf(a.g.id) : 1e9) - (b.g ? treeOrderIds(domains(true).map((d) => d.id)).indexOf(b.g.id) : 1e9));
  for (const { g, rows } of ordered) {
    tl.append(h('div', { class: 'tl-row tl-grp' }, h('div', { class: 'tl-label' }, h('span', { class: 'dot', style: { background: g ? nodeColor(g.id) : '#94a3b8', display: 'inline-block', 'margin-right': '6px' } }), g ? g.name : 'Unfiled'), h('div', { class: 'tl-track', style: { width: W + 'px' } })));
    rows.sort((a, b) => a.s.localeCompare(b.s) || a.e.localeCompare(b.e)).forEach(({ it, s, e }) => {
      const di = dueInfo(it);
      tl.append(h('div', { class: 'tl-row' }, h('div', { class: 'tl-label', title: it.title }, it.title), h('div', { class: 'tl-track', style: { width: W + 'px' } },
        h('button', { class: 'tl-bar' + (isDone(it) ? ' done' : '') + (di && di.cls === 'overdue' ? ' overdue' : ''), style: { left: x(s) + 'px', width: Math.max(dw, x(e) - x(s) + dw) + 'px', '--pc': nodeColor(it.nodeId) }, title: `${it.title}: ${fmtDate(s)} → ${fmtDate(e)}`, 'aria-label': `${it.title}, ${fmtDate(s)} to ${fmtDate(e)}`, onClick: () => openCard(it.id) }, it.title),
        (it.activity || []).map((a) => { const d = dateOnly(a.ts); if (!d || d < min || d > max) return null; const ai = actorInfo(a); return h('span', { class: 'tl-tick', style: { left: x(d) + dw / 2 + 'px', '--bc': ai.color }, title: `${ai.short}: ${a.action} — ${fmtStamp(a.ts)}` }); }))));
    });
  }
  tl.append(h('div', { class: 'tl-today', style: { left: lw + x(t0) + dw / 2 + 'px' }, 'aria-hidden': 'true' }));
  const wrap = h('div', { class: 'tl-wrap' }, tl);
  v.append(spans.length ? wrap : h('div', { class: 'empty' }, 'No cards with due dates in this view.'));
  const nd = items.length - withDue.length;
  v.append(h('p', { class: 'tl-note' }, `Bars run from Start (or the created date) to Due. Dots under a bar = activity. Red line = today.${nd ? ` ${nd} card(s) without a due date aren't shown.` : ''}`));
  requestAnimationFrame(() => { if (TL_SCROLL.set) return; wrap.scrollLeft = Math.max(0, x(t0) - dw * 5); TL_SCROLL.set = true; });
}
const TL_SCROLL = { set: false };

/* ---------------- Gallery ---------------- */
function renderGallery(v, items) {
  const list = sortItems(items); const doms = scopeDomains(); const flds = fieldsFor(doms).filter((f) => !['notes', 'owner', 'priority', AT].includes(f.id));
  v.append(list.length ? h('div', { class: 'gallery' }, list.map((it) => h('div', { class: 'gcard' + (isActiveItem(it) ? ' is-active' : ''), role: 'button', tabindex: '0', 'aria-label': 'Open card ' + it.title, style: { '--pc': nodeColor(it.nodeId), '--ac': (itemBucket(it) || {}).color || 'var(--accent)' }, dataset: { id: it.id }, onClick: () => openCard(it.id), onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openCard(it.id); } } },
    h('div', { class: 'band' }), h('div', { class: 'gbody' },
      h('div', { class: 'card-top' }, locChip(it), statusPill(it)),
      h('div', { class: 'gtitle' }, it.title), pathLabel(it.nodeId) ? h('div', { class: 'kv' }, pathLabel(it.nodeId)) : null,
      it.fields.notes ? h('div', { class: 'card-note' }, it.fields.notes) : null,
      h('div', { class: 'card-meta' }, actionChips(it), dueBadge(it), botChip(it), it.fields.owner ? h('span', { class: 'owner' }, it.fields.owner) : null, priorityPill(it), it.checklist.length ? h('span', null, `☑ ${it.checklist.filter((c) => c.done).length}/${it.checklist.length}`) : null),
      flds.filter((f) => !isEmpty(it.fields[f.id])).slice(0, 4).map((f) => h('div', { class: 'kv' }, f.name + ': ', h('b', null, fmtFieldVal(f, it.fields[f.id])))), activityLine(it)))))
    : h('div', { class: 'empty' }, 'No cards match.'));
  v.append(h('div', { style: { 'margin-top': '12px' } }, h('button', { class: 'btn', onClick: () => openCard(null, {}) }, '＋ Add card')));
}

function renderView() {
  const v = $('#view'); const keep = {}; ['.board', '.grid-wrap', '.tl-wrap', '.gantt-wrap'].forEach((s) => { const el = $(s, v); if (el) keep[s] = [el.scrollLeft, el.scrollTop]; });
  if (!keep['.tl-wrap']) TL_SCROLL.set = false;
  const wy = scrollY; v.innerHTML = ''; v.setAttribute('aria-labelledby', 'tab-' + UI.view);
  const items = visibleItems();
  (VIEWS.find((x) => x.id === UI.view) || VIEWS[0]).render(v, items);
  for (const [s, [l, t]] of Object.entries(keep)) { const el = $(s, v); if (el) { el.scrollLeft = l; el.scrollTop = t; if (s === '.tl-wrap') TL_SCROLL.set = true; } }
  if (Math.abs(scrollY - wy) > 1) scrollTo(0, wy);
}

/* ---------------- Card modal ---------------- */
const PRIVACY_RE = [/\$\s?\d/, /\b\d{3}[\s.)-]*\d{3}[\s.-]\d{4}\b/, /[\w.+-]+@[\w-]+\.[\w.]+/, /\b\d{2,4}[-\s]?[A-Z]{1,3}\d{0,2}[-\s]?\d{3,}\b/];
function privacyWarn(text) { if (text && PRIVACY_RE.some((r) => r.test(text))) toast('⚠ Public page: this looks like a phone number, email, amount, or case number. Please remove it.', 5000); }
function fieldEditor(f, value, onChange) {
  const id = uid('fe');
  let el;
  switch (f.type) {
    case 'long-text': el = h('textarea', { id, rows: 3, value: value || '' }); el.addEventListener('change', () => { privacyWarn(el.value); onChange(el.value.trim() || null); }); break;
    case 'number': el = h('input', { id, type: 'number', value: value ?? '' }); el.addEventListener('change', () => onChange(el.value === '' ? null : Number(el.value))); break;
    case 'date': el = h('input', { id, type: 'date', value: value || '' }); el.addEventListener('change', () => onChange(el.value || null)); break;
    case 'checkbox': el = h('input', { id, type: 'checkbox', checked: !!value }); el.addEventListener('change', () => onChange(el.checked)); return h('label', { class: 'fld' }, h('span', null, f.name), h('span', null, el, ' Yes'));
    case 'single-select': case 'person': el = h('select', { id, value: value || '' }, h('option', { value: '' }, '—'), fieldOptions(f).map((o) => h('option', { value: o.id }, o.name))); el.addEventListener('change', () => onChange(el.value || null)); break;
    case 'multi-select': { const cur = new Set(Array.isArray(value) ? value : []); el = h('div', { id, class: 'chips', style: { padding: '0', 'flex-wrap': 'wrap' }, role: 'group', 'aria-label': f.name },
      fieldOptions(f).map((o) => h('button', { type: 'button', class: 'chip', style: { '--chip': o.color || 'var(--accent)' }, dataset: { opt: o.id }, 'aria-pressed': String(cur.has(o.id)), onClick: (e) => { cur.has(o.id) ? cur.delete(o.id) : cur.add(o.id); e.currentTarget.setAttribute('aria-pressed', String(cur.has(o.id))); onChange(f.id === AT ? fieldOptions(f).map((x) => x.id).filter((x) => cur.has(x)) : [...cur]); } }, o.icon ? atIcon(o.icon) : null, o.name)));
      if (!fieldOptions(f).length) el.append(h('span', { class: 'meta-line' }, 'No options yet — add them in Manage › Fields.')); break; }
    case 'url': el = h('input', { id, type: 'url', value: value || '', placeholder: 'https://' }); el.addEventListener('change', () => onChange(el.value.trim() || null)); break;
    default: el = h('input', { id, type: 'text', value: value ?? '' }); el.addEventListener('change', () => { privacyWarn(el.value); onChange(el.value.trim() || null); });
  }
  return h('label', { class: 'fld' + (f.type === 'long-text' || f.type === 'multi-select' ? ' full' : ''), for: id }, h('span', null, f.name), el);
}
function openCard(id, presets = {}) {
  const existing = id ? getItem(id) : null; if (id && !existing) return;
  const draft = existing ? null : { title: '', nodeId: presets.nodeId || defaultNodeId(), status: presets.status || null, due: presets.due || null, start: null, fields: { ...(presets.fields || {}) }, labels: [], checklist: [], comments: [], agent: presets.agent || null, taskUrl: null, source: 'kv' };
  if (draft) { for (const k of Object.keys(draft.fields)) if (isEmpty(draft.fields[k])) delete draft.fields[k]; if (!draft.fields.owner && WS.people.includes('KV')) draft.fields.owner = 'KV'; if (!draft.agent) draft.agent = wsDefaultAgent(draft); if (draft.status && bucket(draft.status) && bucket(draft.status).isIdea && !draft.fields.cardType) draft.fields.cardType = 'idea'; }
  const cur = () => existing ? getItem(id) : draft;
  const set = (patch, fp) => {
    if (existing) { updateItem(id, patch, fp); const box = md && $('#cm-activity', md.body), it = cur(); if (box && it) box.replaceWith(activitySection(it)); }
    else { Object.assign(draft, patch); if (fp) for (const [k, v] of Object.entries(fp)) { if (isEmpty(v) || v === false) delete draft.fields[k]; else draft.fields[k] = v; } }
  };
  let md; let showAllAct = false;
  const activitySection = (it) => {
    const all = (it.activity || []).map((e, i) => [e, i]).sort((a, b) => tsNum(b[0].ts) - tsNum(a[0].ts) || b[1] - a[1]).map((x) => x[0]); const shown = showAllAct ? all : all.slice(0, 3);
    return h('div', { class: 'fld full activity', id: 'cm-activity' }, h('span', null, `Activity (${all.length})`),
      all.length ? h('ol', { class: 'act-list', 'aria-label': 'Activity, newest first' }, shown.map((e) => { const a = actorInfo(e);
        return h('li', { class: 'act-item', style: { '--bc': a.color } }, h('i', { class: 'act-dot', 'aria-hidden': 'true' }),
          h('div', null, h('div', null, h('b', { class: 'act-name' }, a.name), ' ', e.action), h('time', { datetime: e.ts, class: 'meta-line' }, fmtStamp(e.ts) + ' · ' + fmtRel(e.ts)))); }))
        : h('div', { class: 'meta-line' }, 'No activity yet.'),
      all.length > 3 ? h('button', { class: 'btn small', type: 'button', id: 'cm-act-toggle', 'aria-expanded': String(showAllAct), 'aria-controls': 'cm-activity', onClick: () => { showAllAct = !showAllAct; rebuild('#cm-act-toggle'); } }, showAllAct ? 'Show less' : `Show all (${all.length})`) : null);
  };
  const build = () => {
    const it = cur(); if (!it) { md && md.close(); return; }
    const dom = domainOf(it.nodeId); const domId = dom ? dom.id : (domains()[0] || allDomains()[0]).id; const bs = bucketsOf(domId);
    if (!it.status || !bs.some((b) => b.id === it.status)) { if (existing) it.status = (bs.find((b) => bucket(it.status) && b.name === bucket(it.status).name) || defaultBucket(domId, it.fields && it.fields.cardType === 'idea') || {}).id; else draft.status = (defaultBucket(domId, draft.fields.cardType === 'idea') || {}).id; }
    const title = h('input', { class: 'title-input', 'aria-label': 'Title', placeholder: 'Card title (no names or numbers)', value: it.title, autofocus: true });
    title.addEventListener('change', () => { privacyWarn(title.value); if (existing) { if (title.value.trim()) set({ title: title.value.trim() }); } else draft.title = title.value; });
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !existing) { e.preventDefault(); draft.title = title.value; create(); } });
    const loc = h('select', { id: 'cm-loc', value: it.nodeId }, nodeOptions((it.nodeId && !domains().some((d) => d.id === itemDomain(it)) ? allDomains() : domains()).map((d) => d.id)).map(([v, l]) => h('option', { value: v }, l)));
    loc.addEventListener('change', () => { set({ nodeId: loc.value }); rebuild(); });
    const st = h('select', { id: 'cm-status', value: it.status }, bs.map((b) => h('option', { value: b.id }, b.name)));
    st.addEventListener('change', () => set({ status: st.value }));
    const dateIn = (k) => { const el = h('input', { type: 'date', id: 'cm-' + k, value: it[k] || '' }); el.addEventListener('change', () => set({ [k]: el.value || null })); return el; };
    const labels = h('input', { type: 'text', id: 'cm-labels', value: it.labels.join(', '), placeholder: 'comma, separated' });
    labels.addEventListener('change', () => set({ labels: labels.value.split(',').map((s) => s.trim()).filter(Boolean) }));
    const cl = h('ul', { class: 'check-list' }, it.checklist.map((c, i) => {
      const txt = h('input', { type: 'text', value: c.text, 'aria-label': 'Checklist item' }); txt.addEventListener('change', () => { const l = clone(cur().checklist); l[i].text = txt.value; set({ checklist: l }); });
      return h('li', { class: c.done ? 'done' : '' }, h('input', { type: 'checkbox', checked: !!c.done, 'aria-label': 'Done: ' + c.text, onChange: (e) => { const l = clone(cur().checklist); l[i].done = e.target.checked; set({ checklist: l }); rebuild(); } }), txt,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove checklist item', onClick: () => { const l = clone(cur().checklist); l.splice(i, 1); set({ checklist: l }); rebuild(); } }, '✕'));
    }));
    const clAdd = h('input', { type: 'text', placeholder: 'Add checklist item…', 'aria-label': 'New checklist item', id: 'cm-cl-add' });
    const addCl = () => { if (!clAdd.value.trim()) return; privacyWarn(clAdd.value); set({ checklist: [...cur().checklist, { text: clAdd.value.trim(), done: false }] }); rebuild('#cm-cl-add'); };
    clAdd.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCl(); } });
    const cmIn = h('textarea', { rows: 2, placeholder: 'Add a comment…', 'aria-label': 'New comment', id: 'cm-comment' });
    const agentSel = h('select', { id: 'cm-agent', value: it.agent || '' }, h('option', { value: '' }, '— none —'), WS.bots.map((b) => h('option', { value: b.id }, b.name)));
    agentSel.addEventListener('change', () => { set({ agent: agentSel.value || null }); rebuild('#cm-agent'); });
    const taskUrl = h('input', { type: 'url', id: 'cm-taskurl', value: it.taskUrl || '', placeholder: 'https://… (optional)' });
    taskUrl.addEventListener('change', () => { const v = taskUrl.value.trim(); if (v && !validTaskUrl(v)) { toast('Task link must start with http:// or https://'); return; } privacyWarn(v); set({ taskUrl: v || null }); rebuild(); });
    const cb = cardBot(it); const bot = cb.bot; const href = cardLink(it); const usesUrl = validTaskUrl(it.taskUrl); const ext = usesUrl || !!cb.url;
    const openBtn = h('a', { class: 'btn primary open-bot', id: 'cm-open-bot', href, target: ext ? '_blank' : null, rel: ext ? 'noopener noreferrer' : null, dataset: { fallback: cb.fallback ? '1' : '' } }, '🤖 ', usesUrl ? `Open task link${bot ? ' (' + (bot.short || bot.name) + ')' : ''}` : `Open in ${bot.name}`);
    const body = h('div', null,
      h('div', { class: 'notice' }, 'Public page: don’t store names, phone numbers, emails, amounts, or case/account numbers.'),
      h('div', { class: 'form-grid' },
        h('div', { class: 'full' }, title),
        h('label', { class: 'fld full', for: 'cm-loc' }, h('span', null, 'Location (domain › group › section)'), loc),
        h('label', { class: 'fld', for: 'cm-status' }, h('span', null, 'Status'), st),
        h('label', { class: 'fld', for: 'cm-labels' }, h('span', null, 'Labels'), labels),
        h('div', { class: 'bot-box full' },
          h('div', { class: 'form-grid' }, h('label', { class: 'fld', for: 'cm-agent' }, h('span', null, 'Bot (agent)'), agentSel), h('label', { class: 'fld', for: 'cm-taskurl' }, h('span', null, 'Task link (optional, used instead of the bot link)'), taskUrl)),
          h('div', { class: 'bot-open' }, openBtn, h('small', { class: 'meta-line', id: 'cm-bot-note' }, usesUrl ? 'Opens the task link in a new tab.' : cb.url ? `Opens ${hostName(cb.url)} in a new tab.` : 'Opens the bot\'s chat in the Grok Bot app (needs the app on this device).' + (cb.fallback ? ' No bot set, so this is the workspace assistant.' : '')))),
        h('label', { class: 'fld', for: 'cm-start' }, h('span', null, 'Start'), dateIn('start')),
        h('label', { class: 'fld', for: 'cm-due' }, h('span', null, 'Due'), dateIn('due')),
        fieldsFor([domId]).filter((f) => !GROUP_IDS.has(f.id)).map((f) => fieldEditor(f, it.fields[f.id], (v) => set({}, { [f.id]: v }))),
        linksSection(it, set, () => rebuild(), !!existing),
        groupSection('metrics', it, domId, set), groupSection('coding', it, domId, set),
        h('div', { class: 'fld full' }, h('span', null, `Checklist ${it.checklist.length ? `(${it.checklist.filter((c) => c.done).length}/${it.checklist.length})` : ''}`), cl, h('div', { class: 'rule' }, clAdd, h('button', { class: 'btn small', type: 'button', onClick: addCl }, 'Add'))),
        h('div', { class: 'fld full' }, h('span', null, `Comments (${it.comments.length})`), it.comments.map((c) => h('div', { class: 'comment' }, h('small', null, fmtStamp(c.at) + (c.by ? ' · ' + c.by : '')), c.text)), cmIn,
          h('div', null, h('button', { class: 'btn small', type: 'button', id: 'cm-comment-btn', onClick: () => { if (!cmIn.value.trim()) return; privacyWarn(cmIn.value); set({ comments: [...cur().comments, { text: cmIn.value.trim(), at: nowISO(), by: 'KV' }] }); rebuild('#cm-comment'); } }, 'Comment'))),
        activitySection(it),
        existing ? h('div', { class: 'meta-line full' }, `Source: ${it.source} · Created ${fmtStamp(it.createdAt)} · Updated ${fmtStamp(it.updatedAt)} · id ${it.id}`) : null));
    return body;
  };
  const rebuild = (focusSel) => { const b = md.body; const st = b.scrollTop; b.innerHTML = ''; b.append(build()); b.scrollTop = st; if (focusSel) { const f = $(focusSel, b); if (f) f.focus(); } };
  const create = () => { const t = ($('.title-input', md.el).value || draft.title || '').trim(); if (!t) { toast('Give the card a title'); $('.title-input', md.el).focus(); return; } draft.title = t; const it = createItem(draft); md.close(); toast('Card added'); requestAnimationFrame(() => { const el = $(`[data-id="${CSS.escape(it.id)}"]`); if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }); };
  md = openModal({ title: existing ? 'Card' : 'New card', body: build(), cls: '',
    foot: existing ? [h('button', { class: 'btn danger', onClick: async () => { if (await confirmDialog(`Delete "${cur().title}"?`)) { md.close(); deleteItem(id); } } }, 'Delete'), h('span', { class: 'spacer' }), isIdeaItem(existing) ? h('button', { class: 'btn', id: 'cm-promote', onClick: () => { md.close(); promoteToTask(id); } }, '⬆ Promote to task') : null, h('button', { class: 'btn primary', onClick: () => md.close() }, 'Done')]
      : [h('span', { class: 'spacer' }), h('button', { class: 'btn', onClick: () => md.close() }, 'Cancel'), h('button', { class: 'btn primary', id: 'cm-create', onClick: create }, 'Create card')] });
}

/* ---------------- Settings ---------------- */
function openSettings(section) {
  const cfg = repoCfg(); const tok = getToken();
  const owner = h('input', { type: 'text', id: 'set-owner', value: cfg.owner, placeholder: 'GitHub username' });
  const repo = h('input', { type: 'text', id: 'set-repo', value: cfg.repo });
  const branch = h('input', { type: 'text', id: 'set-branch', value: cfg.branch });
  const token = h('input', { type: 'password', id: 'set-token', value: tok, placeholder: 'github_pat_…', autocomplete: 'off' });
  const status = h('div', { class: 'meta-line', role: 'status' }, tok ? `Token saved on this device. Sync: ${SYNC.state}${SYNC.error ? ' — ' + SYNC.error : ''}` : 'No token: changes are saved on this device only.');
  const saveCfg = () => { localStorage.setItem(LS.repo, JSON.stringify({ owner: owner.value.trim(), repo: repo.value.trim() || 'mre-board', branch: branch.value.trim() || 'main' })); if (token.value.trim()) localStorage.setItem(LS.token, token.value.trim()); else localStorage.removeItem(LS.token); };
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onChange: async (e) => { const f = e.target.files[0]; if (!f) return; try { importJSON(JSON.parse(await f.text())); toast('Imported and merged'); } catch (err) { toast('Import failed: ' + err.message); } } });
  const body = h('div', null,
    h('div', { class: 'notice', id: 'publicNotice' }, h('b', null, 'Public page: don’t store private info. '), 'This board is published on a public GitHub Pages site. Use property + unit + a short task only — no tenant or applicant names, phone numbers, emails, dollar amounts, or case/account numbers.'),
    h('h3', null, 'Start in'),
    h('div', { class: 'form-grid' }, h('label', { class: 'fld', for: 'startViewSel' }, h('span', null, 'View that opens by default on this device'),
      h('select', { id: 'startViewSel', value: getStartView(), onChange: (e) => { setStartView(e.target.value); renderTabs(); toast('Start in: ' + (e.target.value === 'last' ? 'last-used view' : viewName(e.target.value))); } },
        orderedViews().map((v) => h('option', { value: v.id }, v.name)), h('option', { value: 'last' }, 'Last-used view (remember where I left off)'))),
      h('p', { class: 'meta-line', id: 'startViewNote' }, `Saved on this device only. Last used: ${viewName(UI.view)}. Tip: right-click or long-press a view tab (or its ▾) → Set as default.`)),
    h('h3', null, 'Theme'),
    h('div', { class: 'form-grid' }, h('label', { class: 'fld', for: 'themeSel' }, h('span', null, 'Appearance on this device'),
      h('select', { id: 'themeSel', value: getTheme(), onChange: (e) => setTheme(e.target.value) }, h('option', { value: 'light' }, '☀ Light'), h('option', { value: 'dark' }, '☾ Dark'), h('option', { value: 'auto' }, '◐ Auto — follow system'))),
      h('p', { class: 'meta-line' }, 'Also on the header’s sun/moon button.')),
    h('h3', { id: 'viewsHead' }, 'Views'), h('p', { class: 'meta-line' }, 'Show, hide and reorder the view tabs on this device.'), viewsSettingsSection(),
    h('h3', null, 'GitHub sync'),
    h('div', { class: 'form-grid' },
      h('label', { class: 'fld' }, h('span', null, 'Owner'), owner), h('label', { class: 'fld' }, h('span', null, 'Repository'), repo),
      h('label', { class: 'fld' }, h('span', null, 'Branch'), branch),
      h('label', { class: 'fld full' }, h('span', null, 'Fine-grained personal access token (stored only in this browser)'), token,
        h('small', { class: 'meta-line' }, 'github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Repository access: Only select repositories → mre-board. Permissions → Repository → Contents: Read and write.')),
      h('div', { class: 'full rule' },
        h('button', { class: 'btn primary', id: 'set-save', onClick: async () => { saveCfg(); status.textContent = 'Saved. Syncing…'; META.sha_ws = META.sha_items = null; saveMeta(); try { await pullNow(false); META.dirty_ws = META.dirty_items = META.dirty_ws || META.dirty_items; await pushNow(); status.textContent = getToken() ? `Sync: ${SYNC.state}${SYNC.error ? ' — ' + SYNC.error : ''}` : 'Saved. No token: device-only mode.'; } catch (e) { status.textContent = 'Error: ' + e.message; } } }, 'Save & sync'),
        h('button', { class: 'btn', onClick: async () => { saveCfg(); status.textContent = 'Testing…'; try { const r = await ghFetch(''); const j = await r.json(); if (!r.ok) throw new Error(j.message || r.status); status.textContent = `OK: ${j.full_name} — push access: ${j.permissions ? j.permissions.push : 'unknown'}`; } catch (e) { status.textContent = 'Test failed: ' + e.message; } } }, 'Test connection'),
        h('button', { class: 'btn danger', onClick: () => { localStorage.removeItem(LS.token); token.value = ''; setSync('local'); status.textContent = 'Token removed from this device.'; } }, 'Forget token')),
      h('div', { class: 'full' }, status)),
    h('h3', null, 'Data'),
    h('div', { class: 'rule' },
      h('button', { class: 'btn', id: 'exportBtn', onClick: exportJSON }, 'Export JSON'), h('button', { class: 'btn', onClick: () => file.click() }, 'Import JSON…'), file,
      h('button', { class: 'btn', onClick: () => pullNow(true) }, 'Reload from server'),
      h('button', { class: 'btn danger', onClick: async () => { if (await confirmDialog('Discard this device’s copy (including unsynced changes) and reload from the server?', 'Reset')) { [LS.ws, LS.items, LS.sync].forEach((k) => localStorage.removeItem(k)); location.reload(); } } }, 'Reset this device')),
    h('p', { class: 'meta-line' }, 'Keyboard: / search · n new card · Alt+←/→ move a focused card between columns · Alt+↑/↓ reorder · Esc close.'));
  const md = openModal({ title: 'Settings', body, cls: 'wide' });
  if (section === 'views') requestAnimationFrame(() => { const hd = $('#viewsHead', md.el); if (hd) hd.scrollIntoView({ block: 'start' }); const f = $('.vs-show', md.el); if (f) f.focus(); });
}
function exportJSON() {
  const blob = new Blob([JSON.stringify({ schemaVersion: SCHEMA, exportedAt: nowISO(), workspace: WS, items: IT }, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `mre-board-${todayStr()}.json` }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function importJSON(data) {
  let wsIn = null, itIn = null;
  if (data.workspace || data.cards) wsIn = data; else if (data.nodes) wsIn = data; else if (data.items) itIn = data; else throw new Error('Unrecognized file');
  const m = migrate(wsIn || WS, itIn || (data.workspace ? null : IT));
  if (wsIn) WS = mergeWSDocs(WS, m.ws); IT = mergeItemsDocs(IT, m.items); reindex(); markDirty('both'); render();
}

/* ---------------- Manage (structure, buckets, fields, people, saved views) ---------------- */
function openManage(tab = 'structure') {
  let cur = tab; let domSel = scopeDomains()[0] || (domains()[0] || {}).id;
  const md = openModal({ title: 'Manage workspace', body: h('div'), cls: 'wide', onClose: () => render() });
  const refresh = () => { const st = md.body.scrollTop; md.body.innerHTML = ''; md.body.append(content()); md.body.scrollTop = st; };
  const act = (fn) => (...a) => { const r = fn(...a); Promise.resolve(r).then(refresh); };
  const content = () => {
    const tabs = h('div', { class: 'subtabs', role: 'tablist' }, [['workspaces', 'Workspaces'], ['assistants', 'Assistants'], ['structure', 'Domains & sections'], ['buckets', 'Buckets'], ['fields', 'Fields'], ['people', 'Owners'], ['views', 'Saved views']].map(([k, l]) => h('button', { class: 'btn small', role: 'tab', 'aria-selected': String(cur === k), dataset: { mtab: k }, onClick: () => { cur = k; refresh(); } }, l)));
    const box = h('div', null, tabs);
    const domPicker = () => h('label', { class: 'tb-label' }, 'Domain ', h('select', { id: 'mg-dom', value: domSel, onChange: (e) => { domSel = e.target.value; refresh(); } }, domains(true).map((d) => h('option', { value: d.id }, d.name))));
    if (cur === 'workspaces') manageWorkspacesTab(box, act);
    else if (cur === 'assistants') manageAssistantsTab(box, act);
    else if (cur === 'structure') {
      box.append(h('p', { class: 'meta-line' }, 'Domains contain groups (for Real Estate: properties), and groups contain sections that can nest (e.g. Units › Unit A).'),
        h('div', { class: 'rule' }, h('button', { class: 'btn small primary', id: 'mg-add-domain', onClick: act(() => nodeDialog('Add domain', null, null, 'domain')) }, '＋ Domain')));
      treeOrderIds(domains(true).map((d) => d.id)).forEach((id) => {
        const n = node(id); const depth = ancestors(id).length - 1;
        const name = h('input', { type: 'text', value: n.name, 'aria-label': 'Name', dataset: { nodeName: n.id } }); name.addEventListener('change', act(() => name.value.trim() && updateNode(n.id, { name: name.value.trim() })));
        const color = h('input', { type: 'color', value: n.color || nodeColor(n.id), 'aria-label': 'Color' }); color.addEventListener('change', act(() => updateNode(n.id, { color: color.value })));
        box.append(h('div', { class: 'mrow' + (n.archived ? ' archived' : ''), dataset: { mnode: n.id } }, h('span', { class: 'indent', style: { width: depth * 18 + 'px' } }), h('span', { class: 'type-tag' }, n.type), color, name,
          h('button', { class: 'icon-btn', 'aria-label': 'Move up', onClick: act(() => moveNode(n.id, -1)) }, '↑'), h('button', { class: 'icon-btn', 'aria-label': 'Move down', onClick: act(() => moveNode(n.id, 1)) }, '↓'),
          n.type === 'domain' ? h('button', { class: 'btn small', onClick: act(() => nodeDialog('Add group to ' + n.name, null, n.id, 'group')) }, '＋ Group') : null,
          h('button', { class: 'btn small', onClick: act(() => nodeDialog('Add section to ' + n.name, null, n.id, 'section')) }, '＋ Section'),
          n.type !== 'domain' ? h('button', { class: 'btn small', onClick: act(() => moveNodeDialog(n)) }, 'Move') : null,
          h('button', { class: 'btn small', onClick: act(() => updateNode(n.id, { archived: !n.archived })) }, n.archived ? 'Unarchive' : 'Archive'),
          h('button', { class: 'btn small danger', 'aria-label': 'Delete ' + n.name, onClick: act(async () => { if (await confirmDialog(`Delete "${n.name}" and everything under it? Cards move to the parent.`)) deleteNode(n.id); }) }, '🗑')));
      });
    } else if (cur === 'buckets') {
      box.append(domPicker(), h('p', { class: 'meta-line' }, 'Buckets are the status columns for this domain. Mark the finished bucket(s) as “done” so they are not counted as overdue, and “Active (animated)” for buckets whose cards are being worked on right now (they get a moving edge light).'));
      bucketsOf(domSel).forEach((b) => {
        const name = h('input', { type: 'text', value: b.name, 'aria-label': 'Bucket name' }); name.addEventListener('change', act(() => name.value.trim() && updateBucket(b.id, { name: name.value.trim() })));
        const color = h('input', { type: 'color', value: b.color, 'aria-label': 'Bucket color' }); color.addEventListener('change', act(() => updateBucket(b.id, { color: color.value })));
        box.append(h('div', { class: 'mrow', dataset: { mbucket: b.id } }, color, name, h('label', { class: 'small-check' }, h('input', { type: 'checkbox', checked: !!b.isDone, onChange: act((e) => updateBucket(b.id, { isDone: e.target.checked })) }), 'done'),
          h('label', { class: 'small-check', title: 'Cards in this bucket get the animated edge light' }, h('input', { type: 'checkbox', class: 'mg-active', checked: !!b.isActive, onChange: act((e) => updateBucket(b.id, { isActive: e.target.checked })) }), 'Active (animated)'),
          h('button', { class: 'icon-btn', 'aria-label': 'Move up', onClick: act(() => moveBucket(b.id, -1)) }, '↑'), h('button', { class: 'icon-btn', 'aria-label': 'Move down', onClick: act(() => moveBucket(b.id, 1)) }, '↓'),
          h('button', { class: 'btn small danger', 'aria-label': 'Delete bucket ' + b.name, onClick: act(async () => { if (await confirmDialog(`Delete bucket "${b.name}"? Cards move to the first remaining bucket.`)) deleteBucket(b.id); }) }, '🗑')));
      });
      const nn = h('input', { type: 'text', placeholder: 'New bucket name', id: 'mg-new-bucket' });
      box.append(h('div', { class: 'mrow' }, nn, h('button', { class: 'btn small primary', id: 'mg-add-bucket', onClick: act(() => { if (nn.value.trim()) addBucket(domSel, nn.value); }) }, '＋ Add bucket')));
    } else if (cur === 'fields') {
      box.append(h('p', { class: 'meta-line' }, 'Custom fields appear automatically in the grid, filters, card editor, and gallery. “All domains” fields apply everywhere.'));
      WS.fields.slice().sort(byOrder).forEach((f) => {
        if (f.builtin && f.id !== AT) { const addOpt = ['single-select', 'multi-select'].includes(f.type) ? h('input', { type: 'text', class: 'mg-add-opt', dataset: { field: f.id }, placeholder: 'Add option…', 'aria-label': 'Add option to ' + f.name, style: { width: '10em' } }) : null;
          if (addOpt) addOpt.addEventListener('keydown', (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const v = addOpt.value.trim(); if (!v) return; if ((f.options || []).some((o) => o.name.toLowerCase() === v.toLowerCase())) return toast('Already an option');
            f.options = [...(f.options || []), { id: v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid('o'), name: v, color: PALETTE[(f.options || []).length % PALETTE.length] }]; wsTouch(f); wsChanged(); toast('Added “' + v + '” to ' + f.name); act(() => {})(); });
          const nm = h('input', { type: 'text', value: f.name, 'aria-label': 'Field name', style: { width: '11em' } }); nm.addEventListener('change', act(() => nm.value.trim() && updateField(f.id, { name: nm.value.trim() })));
          box.append(h('div', { class: 'mrow', dataset: { mfield: f.id } }, nm, h('span', { class: 'type-tag' }, 'built in · ' + (FIELD_GROUPS[f.group] || f.type)), (f.options || []).length ? h('span', { class: 'meta-line', style: { flex: '1' } }, f.options.map((o) => o.name).join(', ')) : h('span', { style: { flex: '1' } }), addOpt,
            h('button', { class: 'icon-btn', 'aria-label': 'Move up', onClick: act(() => moveField(f.id, -1)) }, '↑'), h('button', { class: 'icon-btn', 'aria-label': 'Move down', onClick: act(() => moveField(f.id, 1)) }, '↓'))); return; }
        if (f.builtin) { box.append(h('div', { class: 'mrow', dataset: { mfield: f.id } }, h('span', { style: { flex: '1' } }, h('b', null, f.name), ' — built in (multi-select): ', actionChips({ fields: { [AT]: (f.options || []).map((o) => o.id) } })),
          h('button', { class: 'icon-btn', 'aria-label': 'Move up', onClick: act(() => moveField(f.id, -1)) }, '↑'), h('button', { class: 'icon-btn', 'aria-label': 'Move down', onClick: act(() => moveField(f.id, 1)) }, '↓'))); return; }
        const name = h('input', { type: 'text', value: f.name, 'aria-label': 'Field name' }); name.addEventListener('change', act(() => name.value.trim() && updateField(f.id, { name: name.value.trim() })));
        const type = h('select', { 'aria-label': 'Field type', value: f.type, onChange: act((e) => updateField(f.id, { type: e.target.value, options: f.options || [] })) }, FIELD_TYPES.map(([v, l]) => h('option', { value: v }, l)));
        const scope = h('select', { 'aria-label': 'Applies to', value: f.domainId || '', onChange: act((e) => updateField(f.id, { domainId: e.target.value || null })) }, h('option', { value: '' }, 'All domains'), domains(true).map((d) => h('option', { value: d.id }, d.name)));
        const opts = ['single-select', 'multi-select'].includes(f.type) ? h('input', { type: 'text', value: (f.options || []).map((o) => o.name).join(', '), placeholder: 'Options, comma separated', 'aria-label': 'Options' }) : null;
        if (opts) opts.addEventListener('change', act(() => setFieldOptionsFromText(f, opts.value)));
        box.append(h('div', { class: 'mrow', dataset: { mfield: f.id } }, name, type, scope, opts, f.type === 'person' ? h('span', { class: 'meta-line' }, 'Options = Owners tab') : null,
          h('button', { class: 'icon-btn', 'aria-label': 'Move up', onClick: act(() => moveField(f.id, -1)) }, '↑'), h('button', { class: 'icon-btn', 'aria-label': 'Move down', onClick: act(() => moveField(f.id, 1)) }, '↓'),
          h('button', { class: 'btn small danger', 'aria-label': 'Delete field ' + f.name, onClick: act(async () => { if (await confirmDialog(`Delete field "${f.name}"? Existing values are hidden.`)) deleteField(f.id); }) }, '🗑')));
      });
      const nn = h('input', { type: 'text', placeholder: 'New field name', id: 'mg-field-name' });
      const nt = h('select', { id: 'mg-field-type', 'aria-label': 'New field type' }, FIELD_TYPES.map(([v, l]) => h('option', { value: v }, l)));
      const ns = h('select', { id: 'mg-field-scope', 'aria-label': 'New field applies to' }, h('option', { value: '' }, 'All domains'), domains(true).map((d) => h('option', { value: d.id }, d.name)));
      const no = h('input', { type: 'text', placeholder: 'Options (for selects), comma separated', id: 'mg-field-opts' });
      box.append(h('h3', null, 'Add a field'), h('div', { class: 'mrow' }, nn, nt, ns, no, h('button', { class: 'btn small primary', id: 'mg-add-field', onClick: act(() => { if (!nn.value.trim()) return toast('Name the field'); addField({ name: nn.value, type: nt.value, domainId: ns.value || null, options: no.value.split(',').map((s) => s.trim()).filter(Boolean) }); toast('Field added'); }) }, '＋ Add field')));
    } else if (cur === 'people') {
      box.append(h('p', { class: 'meta-line' }, 'Owners used by Person fields. Use roles or bot names, not people’s names.'));
      WS.people.forEach((p) => box.append(h('div', { class: 'mrow' }, h('span', { style: { flex: '1' } }, p), h('button', { class: 'btn small danger', onClick: act(() => { WS.people = WS.people.filter((x) => x !== p); tomb('person', p); wsChanged(); }) }, 'Remove'))));
      const np = h('input', { type: 'text', placeholder: 'e.g. Handyman' });
      box.append(h('div', { class: 'mrow' }, np, h('button', { class: 'btn small primary', onClick: act(() => { const v = np.value.trim(); if (v && !WS.people.includes(v)) { WS.people.push(v); WS.deleted = WS.deleted.filter((t) => !(t.kind === 'person' && t.id === v)); wsChanged(); } }) }, '＋ Add owner')));
    } else if (cur === 'views') {
      if (!WS.savedViews.length) box.append(h('p', { class: 'empty' }, 'No saved views yet. Set up filters, then “Save current view…”.'));
      WS.savedViews.forEach((sv) => {
        const name = h('input', { type: 'text', value: sv.name, 'aria-label': 'View name' }); name.addEventListener('change', act(() => { sv.name = name.value.trim() || sv.name; wsTouch(sv); wsChanged(); }));
        box.append(h('div', { class: 'mrow', dataset: { mview: sv.id } }, name, h('span', { class: 'type-tag' }, sv.view), h('button', { class: 'btn small', onClick: () => { md.close(); applySaved(sv.id); } }, 'Apply'),
          h('button', { class: 'btn small danger', onClick: act(async () => { if (await confirmDialog(`Delete saved view "${sv.name}"?`)) deleteSaved(sv.id); }) }, '🗑')));
      });
      box.append(h('div', { class: 'rule' }, h('button', { class: 'btn small primary', onClick: act(() => promptSaveView()) }, '＋ Save current view…')));
    }
    return box;
  };
  refresh();
}

/* ================= v4: workspace switcher + assistants, theme, header menus ================= */
function placeMenu(m, anchor) {
  $('#menuRoot').append(m);
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let x = Math.min(r.left, innerWidth - mw - 8), y = r.bottom + 4; if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 4);
  m.style.left = Math.max(8, x) + 'px'; m.style.top = y + 'px';
  const btns = $$('button, a[href]', m); if (btns[0]) btns[0].focus();
  m.addEventListener('keydown', (e) => { const i = btns.indexOf(document.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length].focus(); } else if (e.key === 'Escape') { e.preventDefault(); closeMenu(); } });
  setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!m.contains(ev.target)) { closeMenu.ret = null; closeMenu(); } document.removeEventListener('pointerdown', off, true); }, true), 0);
}
function chatLinkAttrs(a, extra = {}) { const url = assistantIsUrl(a); return { href: assistantLink(a), target: url ? '_blank' : null, rel: url ? 'noopener noreferrer' : null, title: assistantNote(a), dataset: { agent: a.primary.agentId || '', url: url ? '1' : '' }, ...extra }; }
function renderWsBar() {
  const bar = $('#wsBar'); if (!bar || !WS.workspaces) return; bar.innerHTML = ''; const w = curWS(); const a = w.assistant;
  bar.append(h('button', { class: 'ws-switch', id: 'wsSwitch', type: 'button', 'aria-haspopup': 'menu', title: 'Switch workspace', 'aria-label': `Workspace: ${w.name}. Switch workspace`, style: { '--wc': w.color || 'var(--accent)' }, onClick: (e) => openWsMenu(e.currentTarget) },
    h('span', { class: 'ws-ico', 'aria-hidden': 'true' }, w.icon || '◎'), h('span', { class: 'ws-name' }, w.name), h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾')),
    h('a', chatLinkAttrs(a, { class: 'btn ws-chat', id: 'wsChat', 'aria-label': `Chat with ${a.primary.name}` }), atIcon('chat'), h('span', { class: 'full-name' }, 'Chat with ' + a.primary.name), h('span', { class: 'short-name' }, assistantShort(a))));
}
function switchWorkspace(id) {
  if (!WS.workspaces.some((w) => w.id === id)) return; UI.workspace = id; UI.scope = 'all'; UI.quick = clone(DEFAULT_UI.quick); UI.activeSaved = '';
  if (UI.groupBy !== 'status' && !groupByOptions().some((o) => o[0] === UI.groupBy)) UI.groupBy = 'status'; render(); toast('Workspace: ' + curWS().name, 1400);
}
function openWsMenu(anchor) {
  closeMenu(); closeMenu.ret = anchor; const cur = curWS();
  const m = h('div', { class: 'menu ws-menu', role: 'menu', 'aria-label': 'Workspaces' }, h('div', { class: 'm-title' }, 'Workspaces'),
    wsList().map((w) => { const a = w.assistant; return h('div', { class: 'ws-item' + (w.id === cur.id ? ' sel' : ''), dataset: { ws: w.id } },
      h('button', { role: 'menuitemradio', 'aria-checked': String(w.id === cur.id), class: 'ws-pick', onClick: () => { closeMenu(); switchWorkspace(w.id); } },
        h('span', { class: 'ws-ico', style: { background: `color-mix(in srgb, ${w.color || '#64748b'} 18%, transparent)` } }, w.icon || '◎'), h('span', { class: 'ws-txt' }, h('b', null, w.name), h('small', null, a.primary.name))),
      h('a', chatLinkAttrs(a, { class: 'ws-chat-mini', role: 'menuitem', 'aria-label': `Chat with ${a.primary.name} (${w.name})`, onClick: () => closeMenu() }), atIcon('chat'))); }),
    h('div', { class: 'm-sep' }),
    h('button', { role: 'menuitem', id: 'wsNewBtn', onClick: () => { closeMenu(); newWorkspaceDialog(); } }, h('span', { 'aria-hidden': 'true' }, '＋'), 'New workspace'),
    h('button', { role: 'menuitem', id: 'wsManageBtn', onClick: () => { closeMenu(); openManage('workspaces'); } }, h('span', { 'aria-hidden': 'true' }, '⚙'), 'Manage workspaces'),
    h('div', { class: 'm-note' }, ASSIST_NOTE));
  placeMenu(m, anchor);
}
/* Assistant wiring widget (required step for new/managed workspaces). Defaults to Grok Bot. */
function assistantPicker(a0 = GROK_ASSISTANT(), onChange) {
  const a = clone(a0); const botFor = (id) => WS.bots.find((b) => b.id === id);
  const curVal = a.primary.url && !(a.primary.agentId && botFor(a.primary.agentId)) ? '__url' : (a.primary.agentId && botFor(a.primary.agentId) ? a.primary.agentId : GROK_ID);
  const sel = h('select', { class: 'as-sel', 'aria-label': 'Assistant', required: true, value: curVal }, WS.bots.map((b) => h('option', { value: b.id }, b.name + (b.url ? ' (link)' : ''))), h('option', { value: '__url' }, 'Custom URL…'));
  const url = h('input', { type: 'url', class: 'as-url', 'aria-label': 'Assistant URL', placeholder: 'https://… (e.g. Codex, CoWork, Perplexity)', value: curVal === '__url' ? a.primary.url || '' : '' });
  const note = h('small', { class: 'meta-line as-note' });
  const bots = h('div', { class: 'as-bots' }, WS.bots.map((b) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', value: b.id, checked: (a.bots || []).includes(b.id) || b.id === a.primary.agentId }), ' ', b.short || b.name)));
  const read = () => { let primary; if (sel.value === '__url') { const u = url.value.trim(); primary = { name: hostName(u) || 'Custom assistant', url: u }; } else { const b = botFor(sel.value); primary = { name: b.name, agentId: b.id }; if (b.url) primary.url = b.url; }
    const ids = [...bots.querySelectorAll('input:checked')].map((i) => i.value); if (primary.agentId && !ids.includes(primary.agentId)) ids.unshift(primary.agentId); return { primary, bots: ids }; };
  const valid = () => sel.value !== '__url' || isHttps(url.value);
  const upd = () => { url.hidden = sel.value !== '__url'; const r = read(); note.textContent = sel.value === '__url' ? (isHttps(url.value) ? `Opens ${hostName(url.value)} in a new tab.` : 'Enter an https:// link.') : assistantNote(r); url.setAttribute('aria-invalid', String(!valid())); };
  sel.addEventListener('change', () => { if (sel.value !== '__url') { const cb = bots.querySelector(`input[value="${CSS.escape(sel.value)}"]`); if (cb) cb.checked = true; } upd(); onChange && valid() && onChange(read()); });
  url.addEventListener('input', upd); url.addEventListener('change', () => { upd(); onChange && valid() && onChange(read()); });
  bots.addEventListener('change', () => onChange && valid() && onChange(read()));
  upd();
  const el = h('div', { class: 'as-picker' }, h('label', { class: 'fld full' }, h('span', null, 'Assistant (required)'), sel), url, note, h('div', { class: 'fld full' }, h('span', null, 'Bots in this workspace (bot filters and Group by Bot)'), bots));
  el.read = read; el.valid = valid; return el;
}
function newWorkspaceDialog() {
  const name = h('input', { type: 'text', id: 'nw-name', required: true, placeholder: 'e.g. Side projects', autofocus: true });
  const icon = h('input', { type: 'text', id: 'nw-icon', maxlength: 3, placeholder: '★', style: { width: '5em' } });
  const color = h('input', { type: 'color', id: 'nw-color', value: PALETTE[(WS.workspaces.length * 3) % PALETTE.length] });
  const picker = assistantPicker(GROK_ASSISTANT()); const err = h('div', { class: 'form-err', role: 'alert', id: 'nw-err' });
  const create = () => {
    const n = name.value.trim(); if (!n) { err.textContent = 'Name the workspace.'; name.focus(); return; }
    if (!picker.valid()) { err.textContent = 'Wire an assistant: pick a bot, or enter an https:// link.'; $('.as-url', picker).focus(); return; }
    const t = nowISO(); const d = { id: uid('d'), parentId: null, type: 'domain', name: n, color: color.value, order: allDomains(true).length, archived: false, updatedAt: t };
    WS.nodes.push(d); WS.buckets.push(...defaultBuckets(d.id, t));
    const w = { id: uid('w'), name: n, icon: icon.value.trim() || n[0].toUpperCase(), color: color.value, order: Math.max(0, ...WS.workspaces.map((x) => x.order || 0)) + 1, domainIds: [d.id], assistant: picker.read(), updatedAt: t };
    WS.workspaces.push(w); UI.workspace = w.id; UI.scope = 'all'; UI.quick = clone(DEFAULT_UI.quick); md.close(); wsChanged(); toast(`Workspace "${n}" wired to ${w.assistant.primary.name}`);
  };
  const md = openModal({ title: 'New workspace', cls: 'narrow', body: h('form', { class: 'form-grid', id: 'nw-form', onSubmit: (e) => { e.preventDefault(); create(); } },
    h('label', { class: 'fld full' }, h('span', null, 'Name'), name), h('label', { class: 'fld' }, h('span', null, 'Icon'), icon), h('label', { class: 'fld' }, h('span', null, 'Color'), color),
    h('div', { class: 'full step' }, h('h3', null, 'Step 2 · Wire its assistant'), picker), err, h('button', { type: 'submit', hidden: true })),
    foot: [h('span', { class: 'spacer' }), h('button', { class: 'btn', onClick: () => md.close() }, 'Cancel'), h('button', { class: 'btn primary', id: 'nw-create', onClick: create }, 'Create workspace')] });
}
function manageWorkspacesTab(box, act) {
  box.append(h('p', { class: 'meta-line' }, 'Each workspace is a mode: it shows its own domains and is wired to an assistant (the header “Chat with …” button). ' + ASSIST_NOTE));
  wsList().forEach((w) => {
    const name = h('input', { type: 'text', value: w.name, 'aria-label': 'Workspace name', disabled: w.all ? true : null }); name.addEventListener('change', act(() => { if (name.value.trim()) { w.name = name.value.trim(); wsTouch(w); wsChanged(); } }));
    const icon = h('input', { type: 'text', value: w.icon || '', maxlength: 3, 'aria-label': 'Icon', style: { width: '4em' } }); icon.addEventListener('change', act(() => { w.icon = icon.value.trim(); wsTouch(w); wsChanged(); }));
    const doms = w.all ? h('span', { class: 'meta-line' }, 'Shows every domain') : h('div', { class: 'as-bots' }, allDomains(true).map((d) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: (w.domainIds || []).includes(d.id), onChange: act((e) => { w.domainIds = e.target.checked ? [...new Set([...(w.domainIds || []), d.id])] : (w.domainIds || []).filter((x) => x !== d.id); wsTouch(w); wsChanged(); }) }), ' ', d.name)));
    const picker = assistantPicker(w.assistant, (a) => { w.assistant = a; wsTouch(w); markDirty('ws'); renderWsBar(); });
    box.append(h('div', { class: 'ws-card', dataset: { mws: w.id } }, h('div', { class: 'mrow' }, icon, name, w.all ? null : h('button', { class: 'btn small danger', 'aria-label': 'Delete workspace ' + w.name, onClick: act(async () => { if (await confirmDialog(`Delete workspace "${w.name}"? Its domains and cards stay (visible under All workspaces).`)) { WS.workspaces = WS.workspaces.filter((x) => x.id !== w.id); tomb('workspace', w.id); if (UI.workspace === w.id) UI.workspace = 'all'; wsChanged(); } }) }, '🗑')),
      h('div', { class: 'fld full' }, h('span', null, 'Domains'), doms), picker));
  });
  box.append(h('div', { class: 'rule' }, h('button', { class: 'btn small primary', id: 'mg-new-ws', onClick: () => newWorkspaceDialog() }, '＋ New workspace')));
}
function manageAssistantsTab(box, act) {
  box.append(h('p', { class: 'meta-line' }, 'Known assistants (the bots map). Add a Grok Bot bot by its agent id, or an external tool (Codex, CoWork, Perplexity…) by its https link. ' + ASSIST_NOTE));
  const builtin = new Set(DEFAULT_BOTS.map((b) => b.id));
  WS.bots.forEach((b) => {
    const name = h('input', { type: 'text', value: b.name, 'aria-label': 'Assistant name' }); name.addEventListener('change', act(() => { if (name.value.trim()) { b.name = name.value.trim(); wsTouch(b); wsChanged(); } }));
    const short = h('input', { type: 'text', value: b.short || '', 'aria-label': 'Short name', style: { width: '8em' } }); short.addEventListener('change', act(() => { b.short = short.value.trim() || b.name; wsTouch(b); wsChanged(); }));
    const color = h('input', { type: 'color', value: b.color || '#64748b', 'aria-label': 'Color' }); color.addEventListener('change', act(() => { b.color = color.value; wsTouch(b); wsChanged(); }));
    box.append(h('div', { class: 'mrow', dataset: { mbot: b.id } }, h('i', { class: 'dot', style: { background: b.color } }), name, short, color, h('code', { class: 'meta-line', title: b.url || b.id }, b.url ? hostName(b.url) : b.id.slice(0, 8) + '…'),
      builtin.has(b.id) ? null : h('button', { class: 'btn small danger', 'aria-label': 'Remove ' + b.name, onClick: act(async () => { if (await confirmDialog(`Remove assistant "${b.name}"? Cards and workspaces using it fall back to Grok Bot.`)) { WS.bots = WS.bots.filter((x) => x.id !== b.id); tomb('bot', b.id); wsChanged(); } }) }, '🗑')));
  });
  const nn = h('input', { type: 'text', id: 'mg-bot-name', placeholder: 'Name, e.g. Codex' }); const nid = h('input', { type: 'text', id: 'mg-bot-id', placeholder: 'Grok Bot agent id or https:// URL' });
  box.append(h('h3', null, 'Add an assistant'), h('div', { class: 'mrow' }, nn, nid, h('button', { class: 'btn small primary', id: 'mg-add-bot', onClick: () => {
    const n = nn.value.trim(), v = nid.value.trim(); if (!n) return toast('Name the assistant');
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); if (!isId && !isHttps(v)) return toast('Enter a Grok Bot agent id (uuid) or an https:// link');
    if (isId && WS.bots.some((b) => b.id === v.toLowerCase())) return toast('That agent is already listed');
    const b = wsTouch(isId ? { id: v.toLowerCase(), name: n, short: n, color: PALETTE[WS.bots.length % PALETTE.length], link: BOT_LINK(v.toLowerCase()) } : { id: uid('ext'), name: n, short: n, color: PALETTE[WS.bots.length % PALETTE.length], url: v, link: v });
    WS.bots.push(b); WS.deleted = WS.deleted.filter((t) => !(t.kind === 'bot' && t.id === b.id)); wsChanged(); toast('Added ' + n); act(() => {})();
  } }, '＋ Add')));
}
/* ---------- theme (light / dark / auto), per device ---------- */
function getTheme() { try { const t = localStorage.getItem(LS.theme); return ['light', 'dark', 'auto'].includes(t) ? t : 'auto'; } catch { return 'auto'; } }
function effectiveTheme() { const t = getTheme(); return t === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t; }
function applyTheme() {
  const t = getTheme(); const root = document.documentElement; if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
  const b = $('#themeBtn'); if (b) { b.innerHTML = ''; b.append(atIcon(t === 'auto' ? 'auto' : t === 'dark' ? 'moon' : 'sun')); const lbl = { light: 'Light', dark: 'Dark', auto: 'Auto (follows system)' }[t]; b.setAttribute('aria-label', 'Theme: ' + lbl + '. Change theme'); b.title = 'Theme: ' + lbl; b.dataset.theme = t; }
}
function setTheme(t) { try { localStorage.setItem(LS.theme, t); } catch {} applyTheme(); if (['dashboard', 'gantt', 'mindmap'].includes(UI.view)) renderView(); }
function themeMenu(anchor) { const t = getTheme(); openMenu(anchor, [{ title: 'Theme (this device)' }, ...[['light', '☀', 'Light'], ['dark', '☾', 'Dark'], ['auto', '◐', 'Auto — follow system']].map(([k, i, l]) => ({ label: l + (t === k ? ' ✓' : ''), icon: i, onClick: () => setTheme(k) }))]); }
function addMenu(anchor) {
  openMenu(anchor, [{ label: 'New card', icon: '＋', onClick: () => openCard(null, {}) }, { label: 'Add idea', icon: '💡', onClick: () => quickIdeaDialog() },
    { sep: 1 }, { label: 'New workspace', icon: '◎', onClick: () => newWorkspaceDialog() }]);
}
/* ================= v4 A: view registry prefs (per device) ================= */
function viewPrefs() { try { const p = JSON.parse(localStorage.getItem(LS.views) || 'null'); return p && typeof p === 'object' ? { order: Array.isArray(p.order) ? p.order : [], hidden: Array.isArray(p.hidden) ? p.hidden : [] } : { order: [], hidden: [] }; } catch { return { order: [], hidden: [] }; } }
function saveViewPrefs(p) { try { localStorage.setItem(LS.views, JSON.stringify(p)); } catch {} }
function orderedViews() { const p = viewPrefs(); const rank = (id) => { const i = p.order.indexOf(id); return i < 0 ? 1000 + VIEWS.findIndex((v) => v.id === id) : i; }; return VIEWS.slice().sort((a, b) => rank(a.id) - rank(b.id)); }
function visibleViews() { const hid = new Set(viewPrefs().hidden); const l = orderedViews().filter((v) => !hid.has(v.id)); return l.length ? l : [VIEWS[0]]; }
function isPhone() { return matchMedia('(max-width: 860px)').matches; }
function viewsSettingsSection() {
  const box = h('div', { id: 'viewsSettings', class: 'views-set' });
  const draw = () => { box.innerHTML = ''; const p = viewPrefs(); const list = orderedViews(); const hid = new Set(p.hidden);
    list.forEach((v, i) => box.append(h('div', { class: 'mrow vs-row', dataset: { vrow: v.id } },
      h('label', { class: 'chk', style: { flex: '1' } }, h('input', { type: 'checkbox', class: 'vs-show', checked: !hid.has(v.id), 'aria-label': 'Show ' + v.name, onChange: (e) => { const q = viewPrefs(); q.order = orderedViews().map((x) => x.id); q.hidden = e.target.checked ? q.hidden.filter((x) => x !== v.id) : [...new Set([...q.hidden, v.id])]; if (VIEWS.length - q.hidden.length < 1) { e.target.checked = true; return toast('Keep at least one view'); } saveViewPrefs(q); draw(); renderTabs(); } }), ' ', h('span', { 'aria-hidden': 'true' }, v.ico + ' '), v.name),
      h('button', { class: 'icon-btn vs-up', 'aria-label': 'Move ' + v.name + ' up', disabled: i === 0 ? true : null, onClick: () => { const q = viewPrefs(); const o = orderedViews().map((x) => x.id); [o[i - 1], o[i]] = [o[i], o[i - 1]]; q.order = o; saveViewPrefs(q); draw(); renderTabs(); box.querySelectorAll('.vs-up')[i - 1]?.focus(); } }, '↑'),
      h('button', { class: 'icon-btn vs-down', 'aria-label': 'Move ' + v.name + ' down', disabled: i === list.length - 1 ? true : null, onClick: () => { const q = viewPrefs(); const o = orderedViews().map((x) => x.id); [o[i + 1], o[i]] = [o[i], o[i + 1]]; q.order = o; saveViewPrefs(q); draw(); renderTabs(); box.querySelectorAll('.vs-down')[i + 1]?.focus(); } }, '↓'))));
    box.append(h('div', { class: 'rule' }, h('button', { class: 'btn small', id: 'vs-reset', onClick: () => { try { localStorage.removeItem(LS.views); } catch {} draw(); renderTabs(); } }, 'Reset views'), h('span', { class: 'meta-line' }, 'This device only. On phones, views that don’t fit go under “More”.')));
  };
  draw(); return box;
}
function moreMenu(anchor, list) {
  openMenu(anchor, [{ title: 'More views' }, ...list.map((v) => ({ label: v.name + (UI.view === v.id ? ' ✓' : ''), icon: v.ico, onClick: () => { UI.view = v.id; render(); } })), { sep: 1 }, { label: 'Views settings…', icon: '⚙', onClick: () => openSettings('views') }]);
}
/* ================= v4 B: relationships ================= */
const relIds = (it, k) => (Array.isArray(it[k]) ? it[k] : []).filter((x) => x && x !== it.id);
function blockers(it) { return relIds(it, 'dependsOn').map(getItem).filter((d) => d && !isDone(d)); }
function relChips(it) {
  const dep = relIds(it, 'dependsOn').filter(getItem), rel = relIds(it, 'relatedTo').filter(getItem), bl = blockers(it); if (!dep.length && !rel.length) return null;
  return h('span', { class: 'rel-chips' }, bl.length ? h('span', { class: 'blocked-badge', title: 'Blocked by: ' + bl.map((b) => b.title).join('; ') }, '⛔ Blocked') : null,
    dep.length ? h('span', { class: 'rel-chip', title: 'Depends on: ' + dep.map((d) => getItem(d).title).join('; ') }, '⛓ ' + dep.length) : null,
    rel.length ? h('span', { class: 'rel-chip', title: 'Related: ' + rel.map((d) => getItem(d).title).join('; ') }, '🔗 ' + rel.length) : null);
}
function cardPicker({ title, exclude = [], onPick }) {
  const q = h('input', { type: 'search', id: 'cp-q', placeholder: 'Search every workspace…', 'aria-label': 'Search cards', autofocus: true });
  const list = h('ul', { class: 'list cp-list', role: 'listbox', 'aria-label': 'Cards' });
  const ex = new Set(exclude);
  const draw = () => { list.innerHTML = ''; const s = q.value.trim().toLowerCase(); const rows = IT.items.filter((x) => !ex.has(x.id) && (!s || searchText(x).includes(s))).sort((a, b) => a.title.localeCompare(b.title)).slice(0, 60);
    rows.forEach((x) => { const w = workspaceOfItem(x); list.append(h('li', null, h('button', { role: 'option', class: 'cp-opt', dataset: { id: x.id }, onClick: () => { md.close(); onPick(x.id); } }, statusPill(x), h('span', null, x.title), h('small', { class: 'meta-line' }, (w ? w.name + ' · ' : '') + (groupOf(x.nodeId) || domainOf(x.nodeId) || { name: '' }).name)))); });
    if (!rows.length) list.append(h('li', { class: 'empty' }, 'No matching cards')); };
  q.addEventListener('input', draw); q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const b = $('.cp-opt', list); if (b) b.click(); } });
  draw(); const md = openModal({ title, cls: 'narrow', body: h('div', null, q, list) }); return md;
}
function linksSection(it, set, rebuild, existing) {
  const row = (k, label, hint) => { const ids = relIds(it, k);
    return h('div', { class: 'fld full links-row', dataset: { rel: k } }, h('span', null, label),
      h('div', { class: 'rel-list' }, ids.map((rid) => { const o = getItem(rid); const blocked = k === 'dependsOn' && o && !isDone(o);
        return h('span', { class: 'rel-item' + (blocked ? ' is-blocking' : ''), dataset: { rid } }, o ? h('button', { type: 'button', class: 'linkish', onClick: () => openCard(rid) }, (blocked ? '⛔ ' : '') + o.title) : h('span', { class: 'meta-line' }, 'Missing card'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove link', onClick: () => { set({ [k]: relIds(it, k).filter((x) => x !== rid) }); rebuild(); } }, '✕')); }),
        h('button', { type: 'button', class: 'btn small rel-add', dataset: { relAdd: k }, onClick: () => cardPicker({ title: 'Link a card — ' + label, exclude: [it.id, ...ids], onPick: (pid) => { set({ [k]: [...relIds(it, k), pid] }); rebuild(); } }) }, '＋ ' + hint))); };
  return h('div', { class: 'fld full links', id: 'cm-links' }, h('span', null, 'Links'), row('dependsOn', 'Blocked by (depends on)', 'Add dependency'), row('relatedTo', 'Related', 'Add related'),
    existing && blockers(it).length ? h('div', { class: 'meta-line blocked-note' }, '⛔ Blocked until the cards above are Done.') : null);
}
/* ================= v4 I: Ideas ================= */
function ideaBucketOf(domId) { return bucketsOf(domId).find((b) => b.isIdea) || null; }
function firstTaskBucket(domId) { return bucketsOf(domId).find((b) => !b.isIdea && !b.isDone) || bucketsOf(domId).find((b) => !b.isIdea) || null; }
function addIdea(title, nodeId = defaultNodeId()) {
  title = (title || '').trim(); if (!title) return null; privacyWarn(title); const d = domainOf(nodeId); const b = d && ideaBucketOf(d.id);
  const it = createItem({ title, nodeId, status: b ? b.id : null, due: null, start: null, fields: { cardType: 'idea' }, labels: [], checklist: [], comments: [], agent: null, taskUrl: null, source: 'kv' }); toast('Idea captured 💡'); return it;
}
function quickIdeaDialog() {
  formDialog({ title: '💡 Add idea', fields: [{ name: 'title', label: 'Idea', required: true, placeholder: 'Short idea (no names or numbers)' }, { name: 'n', label: 'Where', type: 'select', value: defaultNodeId(), options: nodeOptions() }], ok: 'Add idea' }).then((r) => { if (r && r.title.trim()) addIdea(r.title, r.n); });
}
function promoteToTask(id) {
  const it = getItem(id); if (!it) return; const b = firstTaskBucket(itemDomain(it)); if (!b) return toast('No task bucket in this domain');
  it.status = b.id; if (it.fields.cardType !== 'coding') delete it.fields.cardType; it.updatedAt = nowISO(); it.lastEditedBy = 'kv';
  logKV(it, 'Promoted to task — moved to ' + b.name); markDirty('items'); render(); toast('Promoted to ' + b.name);
}
/* ================= v4 E: metrics + coding ================= */
const METRIC_IDS = ['tokensIn', 'tokensOut', 'tokensTotal', 'model', 'runs', 'durationMinutes'], CODING_IDS = ['repo', 'branch', 'prUrl', 'agentTool', 'ciStatus'];
const GROUP_IDS = new Set([...METRIC_IDS, ...CODING_IDS]);
function num(v) { const n = Number(v); return isFinite(n) && v !== '' && v != null ? n : 0; }
function tokTotal(it) { const f = it.fields || {}; if (f.tokensTotal != null && f.tokensTotal !== '') return num(f.tokensTotal); return num(f.tokensIn) + num(f.tokensOut); }
function fmtTok(n) { return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(n)); }
function tokenChip(it) { const t = tokTotal(it); return t ? h('span', { class: 'tok-chip', title: `Tokens: ${t.toLocaleString()}${it.fields.model ? ' · ' + it.fields.model : ''}${it.fields.runs ? ' · ' + it.fields.runs + ' runs' : ''}` }, fmtTok(t) + ' tok') : null; }
function ciChip(it) { const v = it.fields && it.fields.ciStatus; const f = fieldDef('ciStatus'); if (!v || !f) return null; return h('span', { class: 'ci-chip', style: { '--pc': optColor(f, v) || '#64748b' }, dataset: { ci: v } }, { passing: '✓ ', failing: '✕ ', pending: '● ' }[v] || '', 'CI ' + optName(f, v)); }
function typeChip(it) { const v = it.fields && it.fields.cardType; if (!v || v === 'task') return null; const f = fieldDef('cardType'); const o = f && (f.options || []).find((x) => x.id === v); if (!o) return null; return h('span', { class: 'type-chip', style: { '--atc': o.color || '#64748b' } }, atIcon(o.icon || 'task'), o.name); }
function groupSection(gid, it, domId, set) {
  const ids = gid === 'metrics' ? METRIC_IDS : CODING_IDS; const defs = ids.map(fieldDef).filter(Boolean); if (!defs.length) return null;
  const hasVal = defs.some((f) => !isEmpty(it.fields[f.id])); const open = hasVal || (gid === 'coding' && (curWS().coding || (workspaceOfItem(it) || {}).coding || it.fields.cardType === 'coding'));
  const d = h('details', { class: 'fld full fgroup', id: 'cm-grp-' + gid, open: open ? true : null }, h('summary', null, FIELD_GROUPS[gid] + (gid === 'metrics' && tokTotal(it) ? ` · ${fmtTok(tokTotal(it))} tok` : '')),
    h('div', { class: 'form-grid' }, defs.map((f) => { const el = fieldEditor(f, it.fields[f.id], (v) => set({}, { [f.id]: v })); if (f.id === 'tokensTotal' && isEmpty(it.fields.tokensTotal) && tokTotal(it)) { const inp = $('input', el); if (inp) inp.placeholder = 'auto: ' + tokTotal(it); } if (f.help) el.append(h('small', { class: 'meta-line' }, f.help)); return el; })));
  return d;
}
/* Spreadsheet column visibility, per workspace (metrics/coding hidden by default; coding shown in the Coding workspace). */
function gridHiddenDefault(key) { const id = key.startsWith('f:') ? key.slice(2) : ''; if (METRIC_IDS.includes(id)) return true; if (CODING_IDS.includes(id)) return !curWS().coding; return false; }
function gridColHidden(key) { const m = (UI.gridCols || {})[curWS().id] || {}; return key in m ? !!m[key] : gridHiddenDefault(key); }
function setGridColHidden(key, hid) { UI.gridCols = UI.gridCols || {}; const m = UI.gridCols[curWS().id] = UI.gridCols[curWS().id] || {}; m[key] = hid; saveUI(); }
function gridColsMenu(anchor) {
  const all = gridColsAll().filter((c) => c.key !== 'title');
  closeMenu(); closeMenu.ret = anchor;
  const m = h('div', { class: 'menu cols-menu', role: 'menu', 'aria-label': 'Columns' }, h('div', { class: 'm-title' }, 'Columns (' + curWS().name + ')'),
    all.map((c) => h('label', { class: 'chk m-chk' }, h('input', { type: 'checkbox', dataset: { col: c.key }, checked: !gridColHidden(c.key), onChange: (e) => { setGridColHidden(c.key, !e.target.checked); renderView(); } }), ' ', c.label, GROUP_IDS.has(c.key.slice(2)) ? h('small', { class: 'meta-line' }, ' · ' + FIELD_GROUPS[METRIC_IDS.includes(c.key.slice(2)) ? 'metrics' : 'coding']) : null)),
    h('div', { class: 'm-sep' }), h('button', { role: 'menuitem', onClick: () => { if (UI.gridCols) delete UI.gridCols[curWS().id]; saveUI(); closeMenu(); renderView(); } }, 'Reset columns'));
  placeMenu(m, anchor);
}
/* ================= v4 C: Gantt ================= */
const SVGNS = 'http://www.w3.org/2000/svg';
function S(tag, attrs = {}, ...kids) { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) { if (k === 'class') el.setAttribute('class', v); else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v); else el.setAttribute(k, v); } kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(String(c)))); return el; }
const G_ZOOM = { day: 36, week: 12, month: 4 };
function staleColor(it) { if (isIdeaItem(it) || isDone(it)) return null; const d = (Date.now() - tsNum(it.updatedAt)) / 864e5; return d < 3 ? '#16a34a' : d < 7 ? '#d97706' : d < 14 ? '#ea580c' : '#dc2626'; }
function ganttGroupKey(it, g) {
  if (g === 'workspace') { const w = workspaceOfItem(it); return w ? [w.id, w.name, w.color] : ['', 'No workspace', '#94a3b8']; }
  if (g === 'section') { return it.nodeId && node(it.nodeId) ? [it.nodeId, fullPath(it.nodeId).split(' › ').slice(1).join(' › ') || fullPath(it.nodeId), nodeColor(it.nodeId)] : ['', 'No section', '#94a3b8']; }
  const n = groupOf(it.nodeId) || domainOf(it.nodeId); return n ? [n.id, n.name, n.color || nodeColor(n.id)] : ['', 'None', '#94a3b8'];
}
function renderGantt(v, items) {
  const zoom = G_ZOOM[UI.ganttZoom] ? UI.ganttZoom : (UI.ganttZoom = 'week'); const pd = G_ZOOM[zoom]; const grp = UI.ganttGroup || 'property'; const colorBy = UI.ganttColor || 'status';
  const dated = items.filter((i) => i.start || i.due), undated = items.length - dated.length; const t0 = todayStr();
  const ctl = h('div', { class: 'gantt-ctl' },
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Zoom' }, Object.keys(G_ZOOM).map((z) => h('button', { class: 'btn small', 'aria-pressed': String(zoom === z), dataset: { zoom: z }, onClick: () => { UI.ganttZoom = z; saveUI(); renderView(); } }, z[0].toUpperCase() + z.slice(1)))),
    h('label', { class: 'tb-label' }, 'Rows ', h('select', { id: 'ganttGroup', value: grp, onChange: (e) => { UI.ganttGroup = e.target.value; saveUI(); renderView(); } }, [['workspace', 'Workspace'], ['property', 'Property'], ['section', 'Section']].map(([a, b]) => h('option', { value: a }, b)))),
    h('label', { class: 'tb-label' }, 'Color ', h('select', { id: 'ganttColor', value: colorBy, onChange: (e) => { UI.ganttColor = e.target.value; saveUI(); renderView(); } }, h('option', { value: 'status' }, 'Status'), h('option', { value: 'stale' }, 'Staleness'))),
    h('button', { class: 'btn small', id: 'ganttToday', onClick: () => { const w = $('.gantt-wrap', v); const tl = $('.g-today', v); if (w && tl) w.scrollLeft = Math.max(0, parseFloat(tl.style.left) - w.clientWidth / 3); } }, 'Today'),
    h('span', { class: 'meta-line' }, `${dated.length} scheduled${undated ? ` · ${undated} without dates (not shown)` : ''} · drag a bar to move, drag its ends to resize`),
    colorBy === 'stale' ? h('span', { class: 'legend g-legend' }, [['#16a34a', '<3d'], ['#d97706', '<7d'], ['#ea580c', '<14d'], ['#dc2626', '14d+']].map(([c, l]) => h('span', null, h('i', { class: 'dot', style: { background: c } }), l + ' since update'))) : null);
  v.append(ctl);
  if (!dated.length) { v.append(h('div', { class: 'empty' }, 'No cards with start or due dates in this view.')); return; }
  const span = (i) => { const a = i.start || i.due, b = i.due || i.start; return a <= b ? [a, b] : [b, a]; };
  let min = addDays(t0, -7), max = addDays(t0, 21); dated.forEach((i) => { const [a, b] = span(i); if (a < addDays(min, 3)) min = addDays(a, -3); if (b > addDays(max, -7)) max = addDays(b, 7); });
  if (zoom === 'month') { min = min.slice(0, 8) + '01'; }
  const days = dnum(max) - dnum(min) + 1, W = days * pd, RH = 34, labelW = isPhone() ? 132 : 240; const x = (d) => (dnum(d) - dnum(min)) * pd;
  const groups = new Map(); dated.slice().sort((a, b) => span(a)[0].localeCompare(span(b)[0])).forEach((i) => { const [k, n, c] = ganttGroupKey(i, grp); if (!groups.has(k)) groups.set(k, { name: n, color: c, items: [] }); groups.get(k).items.push(i); });
  // header: months + ticks
  const head = h('div', { class: 'g-head', style: { width: W + 'px' } });
  for (let d = min; d <= max; d = addDays(d, 1)) { const day = +d.slice(8); const dow = new Date(dnum(d) * 864e5).getUTCDay();
    if (day === 1 || d === min) head.append(h('span', { class: 'g-month', style: { left: x(d) + 'px' } }, fmtDate(d, { month: 'short', year: 'numeric' })));
    if (zoom === 'day' || (zoom === 'week' && dow === 1) || (zoom === 'month' && (day === 1 || day === 15))) head.append(h('span', { class: 'g-tick' + (dow === 0 || dow === 6 ? ' we' : ''), style: { left: x(d) + 'px' } }, zoom === 'day' ? String(day) : fmtDate(d))); }
  const body = h('div', { class: 'g-body' }); const pos = new Map(); let row = 0;
  const colorOf = (i) => { if (colorBy === 'stale') return staleColor(i) || (isDone(i) ? '#94a3b8' : (itemBucket(i) || {}).color || '#64748b'); const b = itemBucket(i); return b ? b.color : '#64748b'; };
  for (const [, g] of groups) {
    body.append(h('div', { class: 'g-row g-grp', style: { height: RH + 'px' } }, h('div', { class: 'g-label', style: { width: labelW + 'px' } }, h('i', { class: 'dot', style: { background: g.color } }), h('b', null, g.name), h('span', { class: 'count' }, g.items.length)), h('div', { class: 'g-track', style: { width: W + 'px' } }))); row++;
    g.items.forEach((i) => {
      const [a, b] = span(i); const ms = !i.start && i.due; const c = colorOf(i); const bl = blockers(i).length;
      const bar = ms ? h('div', { class: 'g-ms', tabindex: '0', role: 'button', style: { left: x(a) + pd / 2 - 9 + 'px', '--gc': c }, dataset: { id: i.id }, 'aria-label': `${i.title}: milestone due ${fmtDate(a)}. Arrow keys move a day.`, title: `${i.title} — due ${fmtDate(a)}` })
        : h('div', { class: 'g-bar' + (isActiveItem(i) ? ' is-active' : '') + (isDone(i) ? ' done' : ''), tabindex: '0', role: 'button', style: { left: x(a) + 'px', width: Math.max(pd, x(b) - x(a) + pd) + 'px', '--gc': c }, dataset: { id: i.id }, 'aria-label': `${i.title}: ${fmtDate(a)} to ${fmtDate(b)}. Arrow keys move a day, Shift+arrows change the due date.`, title: `${i.title} — ${fmtDate(a)} → ${fmtDate(b)}` },
          h('span', { class: 'g-h g-h-l', 'aria-hidden': 'true' }), h('span', { class: 'g-bar-txt' }, (bl ? '⛔ ' : '') + i.title), h('span', { class: 'g-h g-h-r', 'aria-hidden': 'true' }));
      pos.set(i.id, { row, x1: x(a) + (ms ? pd / 2 - 9 : 0), x2: ms ? x(a) + pd / 2 + 9 : x(a) + Math.max(pd, x(b) - x(a) + pd), ms });
      body.append(h('div', { class: 'g-row', style: { height: RH + 'px' }, dataset: { row: i.id } }, h('div', { class: 'g-label', style: { width: labelW + 'px' } }, h('button', { class: 'linkish g-title', onClick: () => openCard(i.id), title: i.title }, i.title), isIdeaItem(i) ? atIcon('bulb') : null), h('div', { class: 'g-track', style: { width: W + 'px' } }, bar))); row++;
    });
  }
  // overlay: today line + dependency arrows
  const H = row * RH; const ov = S('svg', { class: 'g-arrows', width: W, height: H, style: `left:${labelW}px;top:0`, 'aria-hidden': 'true' },
    S('defs', {}, S('marker', { id: 'g-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, S('path', { d: 'M0 0L10 5L0 10z', class: 'g-arrow-head' }))));
  dated.forEach((i) => relIds(i, 'dependsOn').forEach((d) => { const A = pos.get(d), B = pos.get(i.id); if (!A || !B) return; const y1 = A.row * RH + RH / 2, y2 = B.row * RH + RH / 2, x1 = A.x2, x2 = B.x1; const mx = Math.max(x1 + 10, Math.min(x2 - 10, x1 + 14));
    ov.append(S('path', { class: 'g-dep' + (isDone(getItem(d)) ? '' : ' open'), d: `M${x1} ${y1} H${mx} V${y2} H${x2}`, 'marker-end': 'url(#g-arrow)' })); }));
  const inner = h('div', { class: 'gantt', style: { width: labelW + W + 'px', '--lw': labelW + 'px' } },
    h('div', { class: 'g-row g-headrow' }, h('div', { class: 'g-label g-corner', style: { width: labelW + 'px' } }, { workspace: 'Workspace', property: 'Property', section: 'Section' }[grp] + ' / card'), head),
    h('div', { class: 'g-bodywrap' }, body, ov, t0 >= min && t0 <= max ? h('div', { class: 'g-today', style: { left: labelW + x(t0) + pd / 2 + 'px', height: H + 'px' }, title: 'Today' }) : null));
  const wrap = h('div', { class: 'gantt-wrap', role: 'region', 'aria-label': 'Gantt chart', tabindex: '0' }, inner); v.append(wrap);
  if (!renderGantt.scrolled) requestAnimationFrame(() => { const tl = $('.g-today', wrap); if (tl && !wrap.scrollLeft) wrap.scrollLeft = Math.max(0, parseFloat(tl.style.left) - labelW - wrap.clientWidth / 4); });
  ganttDrag(wrap, pd);
}
function ganttDrag(wrap, pd) {
  let st = null;
  const shift = (it, mode, dd) => { const p = {}; if (mode === 'move') { if (it.start) p.start = addDays(it.start, dd); if (it.due) p.due = addDays(it.due, dd); }
    else if (mode === 'l') { const ns = addDays(it.start || it.due, dd); p.start = it.due && ns > it.due ? it.due : ns; } else { const nd = addDays(it.due || it.start, dd); p.due = it.start && nd < it.start ? it.start : nd; } return p; };
  wrap.addEventListener('pointerdown', (e) => { const el = e.target.closest('.g-bar, .g-ms'); if (!el || e.button > 0) return; const it = getItem(el.dataset.id); if (!it) return;
    const mode = e.target.classList.contains('g-h-l') ? 'l' : e.target.classList.contains('g-h-r') ? 'r' : 'move';
    st = { el, it, mode, x0: e.clientX, left: parseFloat(el.style.left), width: parseFloat(el.style.width) || 0, dd: 0, pid: e.pointerId, moved: false, touch: e.pointerType !== 'mouse', t0: Date.now() };
    if (!st.touch) { el.setPointerCapture(e.pointerId); e.preventDefault(); } });
  wrap.addEventListener('pointermove', (e) => { if (!st || e.pointerId !== st.pid) return; const dx = e.clientX - st.x0;
    if (st.touch && !st.moved) { if (Date.now() - st.t0 < 300) { if (Math.abs(dx) > 8) st = null; return; } st.el.setPointerCapture(e.pointerId); }
    if (!st.moved && Math.abs(dx) < 4) return; st.moved = true; st.el.classList.add('dragging'); document.body.classList.add('is-dragging'); const dd = Math.round(dx / pd); st.dd = dd;
    if (st.mode === 'move') st.el.style.left = st.left + dd * pd + 'px'; else if (st.mode === 'l') { const nl = Math.min(st.left + dd * pd, st.left + st.width - pd); st.el.style.left = nl + 'px'; st.el.style.width = st.width - (nl - st.left) + 'px'; } else st.el.style.width = Math.max(pd, st.width + dd * pd) + 'px';
    e.preventDefault(); });
  const end = (e) => { if (!st || (e && e.pointerId !== st.pid)) return; const s0 = st; st = null; document.body.classList.remove('is-dragging');
    if (!s0.moved) { if (e && e.type === 'pointerup') openCard(s0.it.id); return; }
    renderGantt.scrolled = true; if (s0.dd) updateItem(s0.it.id, shift(s0.it, s0.mode, s0.dd)); else renderView(); renderGantt.scrolled = false; };
  wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', (e) => { if (st) { st = null; document.body.classList.remove('is-dragging'); renderView(); } });
  wrap.addEventListener('keydown', (e) => { const el = e.target.closest('.g-bar, .g-ms'); if (!el) return; const it = getItem(el.dataset.id);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(it.id); return; }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); const dd = e.key === 'ArrowLeft' ? -1 : 1;
    updateItem(it.id, shift(it, e.shiftKey ? 'r' : 'move', dd)); requestAnimationFrame(() => { const b = $(`.gantt-wrap [data-id="${CSS.escape(it.id)}"]`); if (b) b.focus(); }); });
}
/* ================= v4 D: Mind map ================= */
const MM = { k: 1, x: 0, y: 0, fitted: '' };
function mmCurve(A, B, tree) { if (!tree) return `M${A.x} ${A.y} Q0 0 ${B.x} ${B.y}`; const bx = Math.max(A.x, B.x) + 260 + Math.abs(A.y - B.y) * 0.15; return `M${A.x} ${A.y} C${bx} ${A.y} ${bx} ${B.y} ${B.x} ${B.y}`; }
function mmTree(items) {
  const w = curWS(); const linked = new Set(); IT.items.forEach((i) => { const d = relIds(i, 'dependsOn'), r = relIds(i, 'relatedTo'); if (d.length || r.length) { linked.add(i.id); d.forEach((x) => linked.add(x)); r.forEach((x) => linked.add(x)); } });
  const show = UI.mmLinksOnly ? items.filter((i) => linked.has(i.id)) : items; const byNode = new Map(); show.forEach((i) => { const k = i.nodeId || ''; if (!byNode.has(k)) byNode.set(k, []); byNode.get(k).push(i); });
  const build = (n) => { const kids = children(n.id).map(build).filter(Boolean); const cards = (byNode.get(n.id) || []).map((i) => ({ key: 'c:' + i.id, type: 'card', name: i.title, item: i, color: (itemBucket(i) || {}).color || '#64748b', kids: [] }));
    if (!kids.length && !cards.length) return null; return { key: 'n:' + n.id, type: n.type, name: n.name.replace(/\s*\(.*\)$/, ''), color: n.color || nodeColor(n.id), kids: [...kids, ...cards] }; };
  const doms = UI.quick.domain ? domains().filter((d) => d.id === UI.quick.domain) : UI.scope !== 'all' && node(UI.scope) ? [node(UI.scope)] : domains();
  return { key: 'root', type: 'root', name: w.name, color: w.color || '#475569', kids: doms.map(build).filter(Boolean), count: show.length };
}
function renderMindmap(v, items) {
  const tree = mmTree(items); const col = UI.mmCollapsed || (UI.mmCollapsed = {});
  // radial layout: leaves spread evenly around the circle; parents sit at the mean angle of their children
  let leaves = 0; const walk = (n, d) => { n.depth = d; n.open = n.type === 'root' || !col[n.key]; if (!n.kids.length || !n.open) { n.leaf = leaves++; return; } n.kids.forEach((k) => walk(k, d + 1)); }; walk(tree, 0);
  const tree_ = UI.mmLayout !== 'radial';
  if (tree_) { const place = (n) => { n.x = n.depth * (isPhone() ? 150 : 200); if (n.leaf != null && (!n.kids.length || !n.open)) n.y = n.leaf * 30; else { n.kids.forEach(place); n.y = (n.kids[0].y + n.kids[n.kids.length - 1].y) / 2; } n.a = 0; }; place(tree); }
  else { const R = [0, 170, 300, 410, 510, 600]; const place = (n) => { if (n.leaf != null && (!n.kids.length || !n.open)) n.a = (n.leaf / Math.max(1, leaves)) * Math.PI * 2 - Math.PI / 2; else { n.kids.forEach(place); n.a = (n.kids[0].a + n.kids[n.kids.length - 1].a) / 2; } const r = R[Math.min(n.depth, R.length - 1)] + Math.max(0, n.depth - 5) * 90; n.x = n.depth ? Math.cos(n.a) * r : 0; n.y = n.depth ? Math.sin(n.a) * r : 0; }; place(tree); }
  const nodes = []; const flat = (n) => { nodes.push(n); if (n.open) n.kids.forEach(flat); }; flat(tree); const pos = new Map(nodes.filter((n) => n.item).map((n) => [n.item.id, n]));
  const g = S('g', { class: 'mm-g' });
  const edges = S('g', { class: 'mm-edges' }), rels = S('g', { class: 'mm-rels' }), ng = S('g', { class: 'mm-nodes' });
  nodes.forEach((n) => { if (n.open) n.kids.forEach((k) => edges.append(S('path', { class: 'mm-edge', d: tree_ ? `M${n.x} ${n.y} C${(n.x + k.x) / 2} ${n.y} ${(n.x + k.x) / 2} ${k.y} ${k.x} ${k.y}` : `M${n.x} ${n.y} L${k.x} ${k.y}`, style: `stroke:${k.color}` }))); });
  nodes.filter((n) => n.item).forEach((n) => { relIds(n.item, 'dependsOn').forEach((d) => { const A = pos.get(d); if (A) rels.append(S('path', { class: 'mm-dep', d: mmCurve(A, n, tree_), 'marker-end': 'url(#mm-arrow)' }, S('title', {}, `${n.item.title} depends on ${A.item.title}`))); });
    relIds(n.item, 'relatedTo').forEach((d) => { const A = pos.get(d); if (A && (d > n.item.id || !relIds(A.item, 'relatedTo').includes(n.item.id))) rels.append(S('path', { class: 'mm-rel', d: mmCurve(A, n, tree_) }, S('title', {}, `${n.item.title} ↔ ${A.item.title}`))); }); });
  nodes.forEach((n) => { const right = tree_ ? true : Math.cos(n.a || 0) >= -0.01; const isCard = n.type === 'card'; const rr = n.type === 'root' ? 34 : n.type === 'domain' ? 16 : isCard ? 6 : 10;
    const hasKids = n.kids.length && n.type !== 'root'; const label = n.name.length > (isCard ? 30 : 24) ? n.name.slice(0, isCard ? 29 : 23) + '…' : n.name;
    const cnt = (x) => x.type === 'card' ? 1 : x.kids.reduce((a, k) => a + cnt(k), 0);
    const el = S('g', { class: `mm-node t-${n.type}` + (isCard && isActiveItem(n.item) ? ' is-active' : '') + (isCard && blockers(n.item).length ? ' blocked' : '') + (!n.open ? ' collapsed' : ''), transform: `translate(${n.x} ${n.y})`, tabindex: '0', role: 'button', 'data-key': n.key, 'aria-label': isCard ? `Card: ${n.name}. Open.` : `${n.name}: ${cnt(n)} cards. ${hasKids ? (n.open ? 'Collapse' : 'Expand') : ''}` },
      S('circle', { r: rr, style: `fill:${n.type === 'root' ? n.color : isCard ? n.color : 'var(--panel)'};stroke:${n.color}` }),
      n.type === 'root' ? S('text', { class: 'mm-root-t', 'text-anchor': 'middle', dy: '0.35em' }, label.length > 12 ? label.slice(0, 11) + '…' : label)
        : S('text', { class: 'mm-t', x: right ? rr + 6 : -rr - 6, dy: '0.35em', 'text-anchor': right ? 'start' : 'end' }, label + (!n.open && hasKids ? ` (+${cnt(n)})` : '')),
      hasKids && !isCard ? S('text', { class: 'mm-pm', 'text-anchor': 'middle', dy: '0.35em' }, n.open ? '−' : '+') : null,
      S('title', {}, isCard ? `${n.name} — ${(itemBucket(n.item) || {}).name || ''}` : `${n.name} (${cnt(n)} cards)`));
    el.addEventListener('click', (e) => { if (MM.dragged) return; e.stopPropagation(); if (isCard) openCard(n.item.id); else if (hasKids) { col[n.key] = n.open; if (!n.open) delete col[n.key]; saveUI(); renderView(); } });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.dispatchEvent(new MouseEvent('click')); requestAnimationFrame(() => { const f = $(`.mm-node[data-key="${CSS.escape(n.key)}"]`); if (f) f.focus(); }); } });
    ng.append(el); });
  g.append(edges, rels, ng);
  const svg = S('svg', { class: 'mm-svg', role: 'group', 'aria-label': `Mind map of ${tree.name}: ${tree.count} cards` }, S('defs', {}, S('marker', { id: 'mm-arrow', viewBox: '0 0 10 10', refX: 16, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse' }, S('path', { d: 'M0 0L10 5L0 10z', class: 'mm-arrow-head' }))), g);
  const apply = () => g.setAttribute('transform', `translate(${MM.x} ${MM.y}) scale(${MM.k})`);
  const fit = () => { const r = svg.getBoundingClientRect(); const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y); const bw = Math.max(...xs) - Math.min(...xs) + 380, bh = Math.max(...ys) - Math.min(...ys) + 80; MM.k = Math.min(1.4, Math.max(0.2, Math.min(r.width / bw, r.height / bh))); MM.x = r.width / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * MM.k; MM.y = r.height / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * MM.k; apply(); };
  const zoomAt = (f, cx, cy) => { const k = Math.min(3, Math.max(0.15, MM.k * f)); MM.x = cx - (cx - MM.x) * (k / MM.k); MM.y = cy - (cy - MM.y) * (k / MM.k); MM.k = k; apply(); };
  const ctl = h('div', { class: 'mm-ctl' },
    h('button', { class: 'btn small', id: 'mmZoomIn', 'aria-label': 'Zoom in', onClick: () => { const r = svg.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); } }, '＋'),
    h('button', { class: 'btn small', id: 'mmZoomOut', 'aria-label': 'Zoom out', onClick: () => { const r = svg.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); } }, '−'),
    h('button', { class: 'btn small', id: 'mmFit', onClick: fit }, 'Fit'),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Layout' }, [['tree', 'Tree'], ['radial', 'Radial']].map(([k, l]) => h('button', { class: 'btn small', dataset: { mmLayout: k }, 'aria-pressed': String((UI.mmLayout || 'tree') === k), onClick: () => { UI.mmLayout = k; saveUI(); MM.fitted = ''; renderView(); } }, l))),
    h('button', { class: 'btn small', id: 'mmExpand', onClick: () => { UI.mmCollapsed = {}; saveUI(); MM.fitted = ''; renderView(); } }, 'Expand all'),
    h('button', { class: 'btn small', id: 'mmCollapse', onClick: () => { UI.mmCollapsed = {}; tree.kids.forEach((k) => (UI.mmCollapsed[k.key] = true)); saveUI(); MM.fitted = ''; renderView(); } }, 'Collapse all'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'mmLinksOnly', checked: !!UI.mmLinksOnly, onChange: (e) => { UI.mmLinksOnly = e.target.checked; saveUI(); MM.fitted = ''; renderView(); } }), ' Only cards with relationships'),
    h('span', { class: 'legend' }, h('span', null, h('i', { class: 'mm-lg dep' }), 'depends on'), h('span', null, h('i', { class: 'mm-lg rel' }), 'related')));
  const wrap = h('div', { class: 'mm-wrap' }, svg); v.append(ctl, wrap);
  if (!tree.kids.length) wrap.append(h('div', { class: 'empty mm-empty' }, UI.mmLinksOnly ? 'No cards with relationships here. Add “Blocked by” or “Related” links in a card.' : 'No cards in this view.'));
  const sig = curWS().id + '|' + leaves + '|' + UI.mmLinksOnly + '|' + (UI.mmLayout || 'tree'); requestAnimationFrame(() => { if (MM.fitted !== sig) { MM.fitted = sig; fit(); } else apply(); });
  // pan / wheel zoom / pinch
  const pts = new Map(); let pan = null, pinch = null;
  svg.addEventListener('wheel', (e) => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  svg.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); MM.dragged = false;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: MM.k }; pan = null; } else pan = { x: e.clientX, y: e.clientY, ox: MM.x, oy: MM.y }; });
  svg.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const r = svg.getBoundingClientRect();
    if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); zoomAt((pinch.k * d / pinch.d) / MM.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); MM.dragged = true; return; }
    if (pan) { const dx = e.clientX - pan.x, dy = e.clientY - pan.y; if (!MM.dragged && Math.hypot(dx, dy) < 5) return; if (!MM.dragged) { MM.dragged = true; try { svg.setPointerCapture(e.pointerId); } catch {} } MM.x = pan.ox + dx; MM.y = pan.oy + dy; apply(); } });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) { pan = null; setTimeout(() => (MM.dragged = false), 0); } };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
}
/* ================= v4 F+G: freeform dashboard + chart widgets ================= */
const DCOLS = 24, DROW = 12; // fine grid: 24 columns × 12px rows
const W_TYPES = [['kpi', 'Number (KPI)'], ['bar', 'Bar'], ['stacked-bar', 'Stacked bar'], ['line', 'Line'], ['area', 'Area'], ['stacked-area', 'Stacked area'], ['donut', 'Donut'], ['pie', 'Pie'], ['list', 'Card list'], ['mini-kanban', 'Mini kanban'], ['tokens', 'Tokens (by workspace / bot)']];
const W_LISTS = [['overdue', 'Overdue'], ['week', 'Due in 7 days'], ['stale', 'Stale in progress (7d+ without update)'], ['ideas', 'Ideas'], ['blocked', 'Blocked'], ['all', 'All cards in source']];
const W_KPIS = [['open', 'Open cards'], ['overdue', 'Overdue'], ['week', 'Due in 7 days'], ['done', 'Done'], ['active', 'In progress (active)'], ['ideas', 'Ideas'], ['measure', 'Measure over source']];
function groupByChoices() {
  return [['status', 'Status'], ['property', 'Property / group'], ['section', 'Section'], ['agent', 'Owner bot'], ['owner', 'Owner'], ['actionType', 'Action type'], ['workspace', 'Workspace'], ['cardType', 'Card type'], ['dueWeek', 'Due week'], ['dueMonth', 'Due month'], ['createdWeek', 'Created week'],
    ...WS.fields.filter((f) => f.type === 'single-select' && !['cardType'].includes(f.id)).sort(byOrder).map((f) => ['f:' + f.id, f.name])];
}
function numericFields() { return [['tokensTotal', 'Tokens total (auto)'], ...WS.fields.filter((f) => f.type === 'number' && f.id !== 'tokensTotal').sort(byOrder).map((f) => [f.id, f.name])]; }
const wk = (d) => { const dow = (new Date(dnum(d) * 864e5).getUTCDay() + 6) % 7; return addDays(d, -dow); };
function gKey(it, by) {
  const none = ['', 'None', '#94a3b8'];
  switch (by) {
    case 'status': { const b = itemBucket(it); return b ? [b.name.toLowerCase(), b.name, b.color, b.order] : none; }
    case 'property': { const n = groupOf(it.nodeId) || domainOf(it.nodeId); return n ? [n.id, n.name.replace(/\s*\(.*\)$/, ''), n.color || nodeColor(n.id)] : none; }
    case 'section': return it.nodeId && node(it.nodeId) ? [it.nodeId, pathLabel(it.nodeId) || node(it.nodeId).name, nodeColor(it.nodeId)] : none;
    case 'agent': { const c = cardBot(it); return [c.bot.id || c.bot.name, c.bot.short || c.bot.name, (WS.bots.find((b) => b.id === c.bot.id) || {}).color || '#64748b']; }
    case 'owner': return it.fields.owner ? [it.fields.owner, it.fields.owner, null] : ['', 'Unassigned', '#94a3b8'];
    case 'actionType': { const v = atValues(it)[0]; const o = atOptions().find((x) => x.id === v); return o ? [o.id, o.name, o.color] : ['', 'No type', '#94a3b8']; }
    case 'workspace': { const w = workspaceOfItem(it); return w ? [w.id, w.name, w.color] : ['', 'No workspace', '#94a3b8']; }
    case 'cardType': { const v = isIdeaItem(it) ? 'idea' : it.fields.cardType || 'task'; const f = fieldDef('cardType'); const o = f && f.options.find((x) => x.id === v); return [v, o ? o.name : v, o && o.color]; }
    case 'dueWeek': return it.due ? [wk(it.due), 'Wk ' + fmtDate(wk(it.due)), null] : ['~', 'No due date', '#94a3b8'];
    case 'dueMonth': return it.due ? [it.due.slice(0, 7), fmtDate(it.due.slice(0, 7) + '-01', { month: 'short', year: '2-digit' }), null] : ['~', 'No due date', '#94a3b8'];
    case 'createdWeek': { const d = dateOnly(it.createdAt); return d ? [wk(d), 'Wk ' + fmtDate(wk(d)), null] : none; }
    default: if (by && by.startsWith('f:')) { const f = fieldDef(by.slice(2)); const v = it.fields[by.slice(2)]; const o = f && fieldOptions(f).find((x) => x.id === v || x.name === v); return o ? [o.id, o.name, o.color] : none; } return ['all', 'All', null];
  }
}
function measureVal(list, m) { if (!m || m === 'count') return list.length; const [op, fid] = m.split(':'); const vals = list.map((it) => (fid === 'tokensTotal' ? tokTotal(it) : num(it.fields[fid]))); const sum = vals.reduce((a, b) => a + b, 0); if (op === 'avg') { const n = list.filter((it) => (fid === 'tokensTotal' ? tokTotal(it) : it.fields[fid] != null && it.fields[fid] !== '')).length; return n ? sum / n : 0; } return sum; }
function measureLabel(m) { if (!m || m === 'count') return 'Cards'; const [op, fid] = m.split(':'); return (op === 'avg' ? 'Avg ' : 'Sum of ') + ((numericFields().find((x) => x[0] === fid) || [, fid])[1]); }
function withSaved(svId, fn) { const sv = WS.savedViews.find((x) => x.id === svId); if (!sv) return fn(); const keep = { scope: UI.scope, search: UI.search, quick: UI.quick, rules: UI.rules }; Object.assign(UI, { scope: sv.scope && (sv.scope === 'all' || node(sv.scope)) ? sv.scope : 'all', search: sv.search || '', quick: Object.assign(clone(DEFAULT_UI.quick), sv.quick || {}), rules: clone(sv.rules || []) }); try { return fn(); } finally { Object.assign(UI, keep); } }
function widgetItems(cfg, items) {
  let list = cfg.source && cfg.source !== 'filters' ? withSaved(cfg.source, () => visibleItems()) : items;
  const r = cfg.range || 'all'; if (r !== 'all') { const df = cfg.dateField || 'due'; const t = todayStr(); let a = null, b = null;
    if (r === 'past30') [a, b] = [addDays(t, -30), t]; else if (r === 'past90') [a, b] = [addDays(t, -90), t]; else if (r === 'next30') [a, b] = [t, addDays(t, 30)]; else if (r === 'thisMonth') [a, b] = [t.slice(0, 8) + '01', addDays(addDays(t.slice(0, 8) + '28', 4).slice(0, 8) + '01', -1)]; else if (r === 'custom') [a, b] = [cfg.from || '0000-01-01', cfg.to || '9999-12-31'];
    list = list.filter((it) => { const d = dateOnly(it[df]); return d && d >= a && d <= b; }); }
  return list;
}
function seriesData(cfg, list) {
  const by = cfg.groupBy || 'status', st = cfg.stackBy || ''; const cats = new Map(), sers = new Map(); const cell = new Map();
  if (by === 'status') { const doms = scopeDomains(); statusOptionsUnion(doms).forEach((o, i) => cats.set(o.id, { key: o.id, name: o.name, color: o.color, ord: i })); }
  list.forEach((it) => { const [k, n, c, o] = gKey(it, by); if (!cats.has(k)) cats.set(k, { key: k, name: n, color: c, ord: o }); const [sk, sn, sc] = st ? gKey(it, st) : ['v', measureLabel(cfg.measure), null]; if (!sers.has(sk)) sers.set(sk, { key: sk, name: sn, color: sc }); const ck = k + '\u0000' + sk; if (!cell.has(ck)) cell.set(ck, []); cell.get(ck).push(it); });
  let cl = [...cats.values()]; const timeish = /Week|Month/.test(by);
  const tot = (c) => [...sers.keys()].reduce((a, sk) => a + measureVal(cell.get(c.key + '\u0000' + sk) || [], cfg.measure), 0);
  if (timeish) cl.sort((a, b) => String(a.key).localeCompare(String(b.key))); else if (by !== 'status') cl.sort((a, b) => tot(b) - tot(a) || String(a.name).localeCompare(String(b.name)));
  if (by === 'status') cl = cl.filter((c) => tot(c) > 0 || c.ord != null);
  const pal = (i) => PALETTE[(i * 5) % PALETTE.length]; const useOwn = (cfg.colors || 'auto') === 'auto';
  cl.forEach((c, i) => { if (!useOwn || !c.color) c.color = cfg.colors === 'mono' ? cfg.color || 'var(--accent)' : pal(i); });
  const sl = [...sers.values()]; sl.forEach((s0, i) => { if (!useOwn || !s0.color) s0.color = st ? pal(i + 2) : cfg.colors === 'mono' ? cfg.color || '#2563eb' : null; });
  return { cats: cl.slice(0, cfg.limit || 30), sers: sl, val: (c, sk) => measureVal(cell.get(c.key + '\u0000' + sk) || [], cfg.measure), items: (c, sk) => cell.get(c.key + '\u0000' + sk) || [] };
}
function tokenRows(by, items) {
  const m = new Map(); const add = (k, n, c, v) => { if (!v) return; const e = m.get(k) || { name: n, color: c, n: 0 }; e.n += v; m.set(k, e); };
  items.forEach((it) => { const logged = (it.activity || []).filter((e) => e.tokens && num(e.tokens.total || (num(e.tokens.in) + num(e.tokens.out))));
    if (by === 'workspace') { const w = workspaceOfItem(it); add(w ? w.id : '', w ? w.name : 'No workspace', w ? w.color : '#94a3b8', tokTotal(it)); return; }
    let sumLogged = 0; logged.forEach((e) => { const v = num(e.tokens.total) || num(e.tokens.in) + num(e.tokens.out); sumLogged += v; const a = actorInfo(e); add(e.actor || 'kv', a.short, a.color, v); });
    const rest = tokTotal(it) - sumLogged; if (rest > 0) { const c = cardBot(it); add(c.bot.id || c.bot.name, c.bot.short || c.bot.name, (WS.bots.find((b) => b.id === c.bot.id) || {}).color || '#64748b', rest); } });
  return [...m.values()].sort((a, b) => b.n - a.n);
}
function defaultWidgets() {
  const W = (type, x, y, w, hh, cfg) => ({ id: 'w-' + type + '-' + x + '-' + y, type, x, y, w, h: hh, cfg });
  return [W('kpi', 0, 0, 6, 8, { title: 'Open cards', metric: 'open' }), W('kpi', 6, 0, 6, 8, { title: 'Overdue', metric: 'overdue', color: '#dc2626' }), W('kpi', 12, 0, 6, 8, { title: 'Due in 7 days', metric: 'week', color: '#d97706' }), W('kpi', 18, 0, 6, 8, { title: 'Done', metric: 'done', color: '#16a34a' }),
    W('list', 0, 8, 12, 22, { title: 'Overdue', list: 'overdue' }), W('list', 12, 8, 12, 22, { title: 'Due this week', list: 'week' }),
    W('tokens', 0, 30, 12, 20, { title: 'Tokens by bot', by: 'bot' }), W('list', 12, 30, 12, 20, { title: 'Stale in progress', list: 'stale' }),
    W('bar', 0, 50, 12, 22, { title: 'By status', groupBy: 'status', measure: 'count' }), W('donut', 12, 50, 12, 22, { title: 'Open cards by owner bot', groupBy: 'agent', measure: 'count', openOnly: true }),
    W('tokens', 0, 72, 12, 20, { title: 'Tokens by workspace', by: 'workspace' }), W('list', 12, 72, 12, 20, { title: '💡 Ideas', list: 'ideas' }),
    W('bar', 0, 92, 24, 22, { title: 'By property / group', groupBy: 'property', measure: 'count' })];
}
function dashStore() { try { const d = JSON.parse(localStorage.getItem(LS.dash) || '{}'); return { layouts: d.layouts || {}, device: d.device || {} }; } catch { return { layouts: {}, device: {} }; } }
function dashSaveStore(d) { try { localStorage.setItem(LS.dash, JSON.stringify(d)); } catch {} }
function dashMode() { return dashStore().device[curWS().id] ? 'device' : 'shared'; }
function getWidgets() { const id = curWS().id; const d = dashStore(); if (d.device[id] && d.layouts[id]) return clone(d.layouts[id].widgets); const sh = (WS.dashboards || {})[id]; return sh && Array.isArray(sh.widgets) && sh.widgets.length ? clone(sh.widgets) : defaultWidgets(); }
function saveWidgets(list) { const id = curWS().id; const t = nowISO(); if (dashMode() === 'device') { const d = dashStore(); d.layouts[id] = { widgets: list, updatedAt: t }; dashSaveStore(d); } else { WS.dashboards = WS.dashboards || {}; WS.dashboards[id] = { widgets: list, updatedAt: t }; WS.updated = t; markDirty('ws'); } }
/* chart tooltip */
function tipOn(el, text) { el.addEventListener('pointerenter', (e) => showTip(e, text)); el.addEventListener('pointermove', (e) => showTip(e, text)); el.addEventListener('pointerleave', hideTip); el.setAttribute('aria-label', text); }
function showTip(e, text) { let t = $('#chartTip'); if (!t) { t = h('div', { id: 'chartTip', class: 'chart-tip', role: 'tooltip' }); document.body.append(t); } t.textContent = text; t.hidden = false; const x = Math.min(innerWidth - t.offsetWidth - 8, e.clientX + 12), y = Math.max(8, e.clientY - t.offsetHeight - 10); t.style.left = x + 'px'; t.style.top = y + 'px'; }
function hideTip() { const t = $('#chartTip'); if (t) t.hidden = true; }
const fmtN = (n) => (Math.abs(n) >= 1000 ? fmtTok(n) : Number.isInteger(n) ? String(n) : n.toFixed(1));
function legendEl(rows) { return h('div', { class: 'legend w-legend' }, rows.map((r) => h('span', null, h('i', { class: 'dot', style: { background: r.color } }), r.name + (r.n != null ? ' — ' + fmtN(r.n) : '')))); }
function chartBars(el, d, stacked, W, H) {
  const cats = d.cats, sers = d.sers; if (!cats.length) return el.append(h('div', { class: 'empty' }, 'No data'));
  const lw = Math.min(140, Math.max(60, W * 0.32)), bw = W - lw - 40; const rows = cats.map((c) => sers.map((s0) => d.val(c, s0.key)));
  const max = Math.max(1, ...rows.map((r) => (stacked ? r.reduce((a, b) => a + b, 0) : Math.max(...r)))); const rh = Math.max(16, Math.min(30, (H - (sers.length > 1 ? 26 : 6)) / cats.length)); const svgH = rh * cats.length + 4;
  const svg = S('svg', { class: 'chart', width: W, height: svgH, viewBox: `0 0 ${W} ${svgH}`, role: 'img', 'aria-label': cats.map((c, i) => `${c.name}: ${fmtN(rows[i].reduce((a, b) => a + b, 0))}`).join(', ') });
  cats.forEach((c, i) => { const y = i * rh + 2; svg.append(S('text', { class: 'ch-lbl', x: lw - 6, y: y + rh / 2, dy: '0.35em', 'text-anchor': 'end' }, c.name.length > 20 ? c.name.slice(0, 19) + '…' : c.name));
    let x0 = lw; const bh = stacked || sers.length === 1 ? rh - 6 : (rh - 6) / sers.length;
    sers.forEach((s0, j) => { const v = rows[i][j]; if (!v) return; const w = (v / max) * bw; const r = S('rect', { class: 'ch-bar', x: x0, y: stacked || sers.length === 1 ? y + 3 : y + 3 + j * bh, width: Math.max(1, w), height: Math.max(2, bh), rx: 3, style: `fill:${sers.length > 1 ? s0.color : c.color}` }); tipOn(r, `${c.name}${sers.length > 1 ? ' · ' + s0.name : ''}: ${fmtN(v)}`); svg.append(r); if (stacked) x0 += w; });
    const tot = stacked ? rows[i].reduce((a, b) => a + b, 0) : Math.max(...rows[i]); svg.append(S('text', { class: 'ch-val', x: lw + (tot / max) * bw + 4, y: y + rh / 2, dy: '0.35em' }, fmtN(tot))); });
  el.append(svg); if (sers.length > 1) el.append(legendEl(sers));
}
function chartLines(el, d, area, stacked, W, H) {
  const cats = d.cats, sers = d.sers; if (!cats.length) return el.append(h('div', { class: 'empty' }, 'No data'));
  const pad = { l: 34, r: 10, t: 8, b: 28 }; const ch = Math.max(60, H - (sers.length > 1 ? 30 : 4)); const iw = W - pad.l - pad.r, ih = ch - pad.t - pad.b;
  const vals = sers.map((s0) => cats.map((c) => d.val(c, s0.key))); const acc = cats.map(() => 0); const stacks = vals.map((row) => row.map((v, i) => { const lo = stacked ? acc[i] : 0; const hi = lo + v; if (stacked) acc[i] = hi; return [lo, hi]; }));
  const max = Math.max(1, ...stacks.flat().map((p) => p[1])); const X = (i) => pad.l + (cats.length === 1 ? iw / 2 : (i / (cats.length - 1)) * iw), Y = (v) => pad.t + ih - (v / max) * ih;
  const svg = S('svg', { class: 'chart', width: W, height: ch, viewBox: `0 0 ${W} ${ch}`, role: 'img', 'aria-label': sers.map((s0, j) => `${s0.name}: ` + cats.map((c, i) => `${c.name} ${fmtN(vals[j][i])}`).join(', ')).join('; ') });
  [0, 0.5, 1].forEach((f) => { const y = Y(max * f); svg.append(S('line', { class: 'ch-grid', x1: pad.l, x2: W - pad.r, y1: y, y2: y }), S('text', { class: 'ch-axis', x: pad.l - 4, y, dy: '0.35em', 'text-anchor': 'end' }, fmtN(max * f))); });
  const step = Math.ceil(cats.length / Math.max(1, Math.floor(iw / 56))); cats.forEach((c, i) => { if (i % step === 0) svg.append(S('text', { class: 'ch-axis', x: X(i), y: ch - 8, 'text-anchor': 'middle' }, c.name.length > 10 ? c.name.slice(0, 9) + '…' : c.name)); });
  sers.forEach((s0, j) => { const col = s0.color || PALETTE[(j * 5) % PALETTE.length]; const top = stacks[j].map((p, i) => `${X(i)},${Y(p[1])}`); const bot = stacks[j].map((p, i) => `${X(i)},${Y(p[0])}`).reverse();
    if (area) svg.append(S('polygon', { class: 'ch-area', points: [...top, ...bot].join(' '), style: `fill:${col}` }));
    svg.append(S('polyline', { class: 'ch-line', points: top.join(' '), style: `stroke:${col}` }));
    stacks[j].forEach((p, i) => { const c = S('circle', { class: 'ch-pt', cx: X(i), cy: Y(p[1]), r: 3.5, style: `fill:${col}` }); tipOn(c, `${cats[i].name}${sers.length > 1 ? ' · ' + s0.name : ''}: ${fmtN(vals[j][i])}`); svg.append(c); }); });
  el.append(svg); if (sers.length > 1) el.append(legendEl(sers.map((s0, j) => ({ ...s0, color: s0.color || PALETTE[(j * 5) % PALETTE.length] }))));
}
function chartDonut(el, d, pie, W, H) {
  const rows = d.cats.map((c) => ({ name: c.name, color: c.color, n: d.sers.reduce((a, s0) => a + d.val(c, s0.key), 0) })).filter((r) => r.n > 0); if (!rows.length) return el.append(h('div', { class: 'empty' }, 'No data'));
  const size = Math.max(80, Math.min(H - 8, W * 0.5, 220)); const R = size / 2 - 4, r0 = pie ? 0 : R * 0.58; const tot = rows.reduce((a, r) => a + r.n, 0); let a0 = -Math.PI / 2;
  const svg = S('svg', { class: 'chart', width: size, height: size, viewBox: `${-size / 2} ${-size / 2} ${size} ${size}`, role: 'img', 'aria-label': rows.map((r) => `${r.name} ${fmtN(r.n)}`).join(', ') });
  rows.forEach((r) => { const a1 = a0 + (r.n / tot) * Math.PI * 2; const big = a1 - a0 > Math.PI ? 1 : 0; const p = (a, rr) => `${Math.cos(a) * rr} ${Math.sin(a) * rr}`;
    const dd = rows.length === 1 ? (pie ? `M${-R} 0A${R} ${R} 0 1 1 ${R} 0A${R} ${R} 0 1 1 ${-R} 0Z` : `M${-R} 0A${R} ${R} 0 1 1 ${R} 0A${R} ${R} 0 1 1 ${-R} 0ZM${-r0} 0A${r0} ${r0} 0 1 0 ${r0} 0A${r0} ${r0} 0 1 0 ${-r0} 0Z`)
      : pie ? `M0 0L${p(a0, R)}A${R} ${R} 0 ${big} 1 ${p(a1, R)}Z` : `M${p(a0, R)}A${R} ${R} 0 ${big} 1 ${p(a1, R)}L${p(a1, r0)}A${r0} ${r0} 0 ${big} 0 ${p(a0, r0)}Z`;
    const path = S('path', { class: 'ch-slice', d: dd, style: `fill:${r.color}`, 'fill-rule': 'evenodd' }); tipOn(path, `${r.name}: ${fmtN(r.n)} (${Math.round((r.n / tot) * 100)}%)`); svg.append(path); a0 = a1; });
  if (!pie) svg.append(S('text', { class: 'ch-center', 'text-anchor': 'middle', dy: '0.35em' }, fmtN(tot)));
  el.append(h('div', { class: 'donut-wrap' }, svg, legendEl(rows)));
}
function widgetBody(w, items, el) {
  const cfg = w.cfg || {}; const W = Math.max(120, el.clientWidth - 4), H = Math.max(60, el.clientHeight - 4); el.innerHTML = '';
  let list = widgetItems(cfg, items); if (cfg.openOnly) list = list.filter((i) => !isDone(i));
  const open = list.filter((i) => !isDone(i) && !isIdeaItem(i));
  switch (w.type) {
    case 'kpi': { const m = cfg.metric || 'open'; const val = m === 'open' ? open.length : m === 'overdue' ? open.filter((i) => i.due && daysUntil(i.due) < 0).length : m === 'week' ? open.filter((i) => i.due && daysUntil(i.due) >= 0 && daysUntil(i.due) <= 7).length : m === 'done' ? list.filter(isDone).length : m === 'active' ? list.filter(isActiveItem).length : m === 'ideas' ? list.filter(isIdeaItem).length : measureVal(list, cfg.measure);
      el.append(h('div', { class: 'kpi', style: cfg.color ? { '--kc': cfg.color } : null }, h('b', null, fmtN(val)), (() => { const lb = m === 'measure' ? measureLabel(cfg.measure) : (W_KPIS.find((x) => x[0] === m) || [, ''])[1]; return lb && lb !== cfg.title ? h('span', null, lb) : null; })())); break; }
    case 'list': { const k = cfg.list || 'overdue'; let l = k === 'overdue' ? open.filter((i) => i.due && daysUntil(i.due) < 0) : k === 'week' ? open.filter((i) => i.due && daysUntil(i.due) >= 0 && daysUntil(i.due) <= 7) : k === 'stale' ? list.filter((i) => isActiveItem(i) && (Date.now() - tsNum(i.updatedAt)) / 864e5 >= 7) : k === 'ideas' ? list.filter(isIdeaItem) : k === 'blocked' ? list.filter((i) => blockers(i).length && !isDone(i)) : list;
      l = sortItems(l, k === 'stale' ? { key: 'updatedAt', dir: 1 } : { key: 'due', dir: 1 });
      el.append(itemList(l, { overdue: 'Nothing overdue 🎉', week: 'Nothing due in the next 7 days', stale: 'Nothing stale 🎉', ideas: 'No ideas yet — capture one with “Add idea”.', blocked: 'Nothing blocked', all: 'No cards' }[k])); break; }
    case 'mini-kanban': { const cols = statusOptionsUnion(scopeDomains()); el.append(h('div', { class: 'mini-kb' }, cols.map((c) => { const l = list.filter((i) => statusKey(i) === c.id); return h('div', { class: 'mk-col', style: { '--cc': c.color } }, h('div', { class: 'mk-head' }, h('i', { class: 'dot', style: { background: c.color } }), c.name, h('span', { class: 'count' }, l.length)), l.slice(0, 12).map((i) => h('button', { class: 'mk-card' + (isActiveItem(i) ? ' is-active' : ''), onClick: () => openCard(i.id), title: i.title }, i.title))); }))); break; }
    case 'tokens': { const rows = tokenRows(cfg.by === 'workspace' ? 'workspace' : 'bot', list); if (!rows.length) { el.append(h('div', { class: 'empty no-data' }, 'No data yet'), h('p', { class: 'meta-line' }, 'Token totals appear when bots log runs (log-activity --tokens-in/--tokens-out) or you fill Metrics on a card.')); break; }
      chartBars(el, { cats: rows.map((r) => ({ key: r.name, name: r.name, color: r.color })), sers: [{ key: 'v', name: 'Tokens' }], val: (c) => (rows.find((r) => r.name === c.key) || { n: 0 }).n }, false, W, H); break; }
    case 'bar': case 'stacked-bar': chartBars(el, seriesData({ ...cfg, stackBy: w.type === 'stacked-bar' ? cfg.stackBy || 'status' : cfg.stackBy }, list), w.type === 'stacked-bar', W, H); break;
    case 'line': case 'area': case 'stacked-area': chartLines(el, seriesData({ ...cfg, stackBy: w.type === 'stacked-area' ? cfg.stackBy || 'status' : cfg.stackBy, groupBy: cfg.groupBy || 'dueWeek' }, list), w.type !== 'line', w.type === 'stacked-area', W, H); break;
    case 'donut': case 'pie': chartDonut(el, seriesData({ ...cfg, stackBy: '' }, list), w.type === 'pie', W, H); break;
    default: el.append(h('div', { class: 'empty' }, 'Unknown widget'));
  }
}
const DASH = { snap: true, reorder: false };
function renderDashboard(v, items) {
  const phone = isPhone(); let widgets = getWidgets(); const mode = dashMode(); try { DASH.snap = localStorage.getItem('mre.dash.snap') !== '0'; } catch {}
  const commit = (list) => { widgets = list; saveWidgets(list); };
  const bar = h('div', { class: 'dash-bar' },
    h('button', { class: 'btn small primary', id: 'addWidgetBtn', onClick: () => widgetDialog(null, (nw) => { const maxY = Math.max(0, ...widgets.map((x) => x.y + x.h)); nw.x = 0; nw.y = maxY; commit([...widgets, nw]); renderView(); }) }, '＋ Add widget'),
    phone ? h('button', { class: 'btn small', id: 'dashReorder', 'aria-pressed': String(DASH.reorder), onClick: () => { DASH.reorder = !DASH.reorder; renderView(); } }, DASH.reorder ? 'Done reordering' : '⇅ Reorder')
      : h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'dashSnap', checked: DASH.snap, onChange: (e) => { DASH.snap = e.target.checked; try { localStorage.setItem('mre.dash.snap', DASH.snap ? '1' : '0'); } catch {} } }), ' Snap to grid'),
    h('label', { class: 'chk', title: 'Keep a separate layout on this device instead of the synced one' }, h('input', { type: 'checkbox', id: 'dashDevice', checked: mode === 'device', onChange: (e) => { const d = dashStore(); const id = curWS().id; if (e.target.checked) { d.device[id] = true; d.layouts[id] = { widgets: getWidgets(), updatedAt: nowISO() }; } else delete d.device[id]; dashSaveStore(d); renderView(); } }), ' This device only'),
    h('button', { class: 'btn small ghost', id: 'dashReset', onClick: async () => { if (!(await confirmDialog(mode === 'device' ? 'Reset this device’s dashboard layout to the default?' : `Reset the ${curWS().name} dashboard to the default layout (synced)?`, 'Reset'))) return; if (mode === 'device') { const d = dashStore(); d.layouts[curWS().id] = { widgets: defaultWidgets(), updatedAt: nowISO() }; dashSaveStore(d); } else saveWidgets(defaultWidgets()); renderView(); } }, 'Reset layout'),
    h('span', { class: 'meta-line' }, (mode === 'device' ? 'Layout: this device' : 'Layout: synced for ' + curWS().name) + (phone ? '' : ' · drag a widget’s title bar to move it, its corner to resize')));
  const sorted = widgets.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const canvas = h('div', { class: 'dash-canvas' + (phone ? ' phone' : ''), role: 'list', 'aria-label': 'Dashboard widgets' });
  const H = Math.max(...widgets.map((w) => w.y + w.h), 10) * DROW + 16; if (!phone) canvas.style.height = H + 'px';
  const bodies = [];
  (phone ? sorted : widgets).forEach((w, idx) => {
    const body = h('div', { class: 'w-body' });
    const el = h('section', { class: 'widget', role: 'listitem', dataset: { wid: w.id, wtype: w.type }, 'aria-label': (w.cfg && w.cfg.title) || w.type, style: phone ? { height: Math.max(150, w.h * DROW) + 'px' } : { left: (w.x / DCOLS) * 100 + '%', top: w.y * DROW + 'px', width: (w.w / DCOLS) * 100 + '%', height: w.h * DROW + 'px' } },
      h('div', { class: 'w-head' }, h('h3', null, (w.cfg && w.cfg.title) || (W_TYPES.find((t) => t[0] === w.type) || [, w.type])[1]),
        phone && DASH.reorder ? [h('button', { class: 'icon-btn w-up', 'aria-label': 'Move up', disabled: idx === 0 ? true : null, onClick: () => { const o = sorted[idx - 1]; [o.x, w.x] = [w.x, o.x]; [o.y, w.y] = [w.y, o.y]; commit(widgets); renderView(); } }, '↑'), h('button', { class: 'icon-btn w-down', 'aria-label': 'Move down', disabled: idx === sorted.length - 1 ? true : null, onClick: () => { const o = sorted[idx + 1]; [o.x, w.x] = [w.x, o.x]; [o.y, w.y] = [w.y, o.y]; commit(widgets); renderView(); } }, '↓')] : null,
        h('button', { class: 'icon-btn w-cfg', 'aria-label': 'Configure widget', title: 'Configure', onClick: () => widgetDialog(w, (nw) => { commit(widgets.map((x) => (x.id === w.id ? nw : x))); renderView(); }) }, '⚙'),
        h('button', { class: 'icon-btn w-dup', 'aria-label': 'Duplicate widget', title: 'Duplicate', onClick: () => { const c = clone(w); c.id = uid('w'); c.x = Math.min(DCOLS - c.w, c.x + 1); c.y = c.y + 2; commit([...widgets, c]); renderView(); } }, atIcon('copy')),
        h('button', { class: 'icon-btn w-del', 'aria-label': 'Remove widget', title: 'Remove', onClick: async () => { if (await confirmDialog(`Remove the “${(w.cfg && w.cfg.title) || w.type}” widget?`, 'Remove')) { commit(widgets.filter((x) => x.id !== w.id)); renderView(); } } }, '✕')),
      body, phone ? null : h('div', { class: 'w-resize', 'aria-hidden': 'true', title: 'Resize' }));
    canvas.append(el); bodies.push([w, body]);
  });
  v.append(bar, h('div', { class: 'dash-scroll' }, canvas));
  const draw = () => bodies.forEach(([w, b]) => { if (b.isConnected) widgetBody(w, items, b); });
  requestAnimationFrame(draw);
  if (window.ResizeObserver) { const ro = new ResizeObserver(debounce(() => { if (!canvas.isConnected) return ro.disconnect(); draw(); }, 120)); ro.observe(canvas); }
  if (!phone) dashDrag(canvas, () => widgets, commit);
}
function dashDrag(canvas, get, commit) {
  let st = null;
  canvas.addEventListener('pointerdown', (e) => { const el = e.target.closest('.widget'); if (!el || e.button > 0 || e.target.closest('button')) return; const rs = e.target.closest('.w-resize'); if (!rs && !e.target.closest('.w-head')) return;
    const w = get().find((x) => x.id === el.dataset.wid); if (!w) return; const cw = canvas.clientWidth / DCOLS; st = { el, w, rs: !!rs, x0: e.clientX, y0: e.clientY, cw, o: { ...w }, moved: false, pid: e.pointerId }; el.setPointerCapture(e.pointerId); e.preventDefault(); });
  canvas.addEventListener('pointermove', (e) => { if (!st || e.pointerId !== st.pid) return; const dx = (e.clientX - st.x0) / st.cw, dy = (e.clientY - st.y0) / DROW; if (!st.moved && Math.abs(e.clientX - st.x0) + Math.abs(e.clientY - st.y0) < 4) return;
    st.moved = true; st.el.classList.add('dragging'); const r = (n) => (DASH.snap ? Math.round(n) : Math.round(n * 100) / 100); const w = st.w;
    if (st.rs) { w.w = Math.max(3, Math.min(DCOLS - w.x, r(st.o.w + dx))); w.h = Math.max(5, r(st.o.h + dy)); st.el.style.width = (w.w / DCOLS) * 100 + '%'; st.el.style.height = w.h * DROW + 'px'; }
    else { w.x = Math.max(0, Math.min(DCOLS - w.w, r(st.o.x + dx))); w.y = Math.max(0, r(st.o.y + dy)); st.el.style.left = (w.x / DCOLS) * 100 + '%'; st.el.style.top = w.y * DROW + 'px'; }
    const H = Math.max(...get().map((x) => x.y + x.h), 10) * DROW + 16; if (H > canvas.clientHeight) canvas.style.height = H + 'px'; });
  const end = (e) => { if (!st || e.pointerId !== st.pid) return; const s0 = st; st = null; s0.el.classList.remove('dragging'); if (s0.moved) { commit(get()); renderView(); } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', (e) => { if (!e.altKey) return; const el = e.target.closest('.widget'); if (!el) return; const w = get().find((x) => x.id === el.dataset.wid); if (!w) return; const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k) return; e.preventDefault();
    if (e.shiftKey) { w.w = Math.max(3, Math.min(DCOLS - w.x, w.w + k[0])); w.h = Math.max(5, w.h + k[1] * 2); } else { w.x = Math.max(0, Math.min(DCOLS - w.w, w.x + k[0])); w.y = Math.max(0, w.y + k[1] * 2); } commit(get()); renderView(); requestAnimationFrame(() => { const f = $(`.widget[data-wid="${CSS.escape(w.id)}"] .w-cfg`); if (f) f.focus(); }); });
}
function widgetDialog(w0, onSave) {
  const w = w0 ? clone(w0) : { id: uid('w'), type: 'bar', x: 0, y: 0, w: 12, h: 22, cfg: { title: '', groupBy: 'status', measure: 'count' } }; const c = w.cfg = w.cfg || {};
  const sel = (id, val, opts) => h('select', { id, value: val ?? '' }, opts.map(([a, b]) => h('option', { value: a }, b)));
  const type = sel('wd-type', w.type, W_TYPES), title = h('input', { type: 'text', id: 'wd-title', value: c.title || '', placeholder: 'Widget title' });
  const source = sel('wd-source', c.source || 'filters', [['filters', 'Current filters'], ...WS.savedViews.map((sv) => [sv.id, 'Saved view: ' + sv.name])]);
  const gb = sel('wd-group', c.groupBy || 'status', groupByChoices()), stack = sel('wd-stack', c.stackBy || '', [['', '— none —'], ...groupByChoices()]);
  const meas = sel('wd-measure', c.measure || 'count', [['count', 'Count of cards'], ...numericFields().flatMap(([id, n]) => [['sum:' + id, 'Sum of ' + n], ['avg:' + id, 'Average ' + n]])]);
  const df = sel('wd-datefield', c.dateField || 'due', [['due', 'Due date'], ['start', 'Start date'], ['createdAt', 'Created'], ['updatedAt', 'Updated']]);
  const range = sel('wd-range', c.range || 'all', [['all', 'All time'], ['past30', 'Past 30 days'], ['past90', 'Past 90 days'], ['next30', 'Next 30 days'], ['thisMonth', 'This month'], ['custom', 'Custom…']]);
  const from = h('input', { type: 'date', id: 'wd-from', value: c.from || '' }), to = h('input', { type: 'date', id: 'wd-to', value: c.to || '' });
  const colors = sel('wd-colors', c.colors || 'auto', [['auto', 'Category colors (status, bot, property…)'], ['palette', 'Theme palette'], ['mono', 'Single color']]); const color = h('input', { type: 'color', id: 'wd-color', value: c.color || '#2563eb' });
  const kpi = sel('wd-kpi', c.metric || 'open', W_KPIS), list = sel('wd-list', c.list || 'overdue', W_LISTS), tby = sel('wd-tby', c.by || 'bot', [['bot', 'By bot'], ['workspace', 'By workspace']]);
  const openOnly = h('input', { type: 'checkbox', id: 'wd-open', checked: !!c.openOnly });
  const F = (label, el, show) => h('label', { class: 'fld', dataset: { show } }, h('span', null, label), el);
  const body = h('form', { class: 'form-grid', onSubmit: (e) => { e.preventDefault(); save(); } }, F('Type', type, 'all'), F('Title', title, 'all'), F('Source', source, 'all'),
    F('Group by (x axis / slices)', gb, 'chart'), F('Stack / split by', stack, 'stackable'), F('Measure', meas, 'measure'), F('KPI', kpi, 'kpi'), F('List', list, 'list'), F('Tokens', tby, 'tokens'),
    F('Date field for range', df, 'all'), F('Date range', range, 'all'), F('From', from, 'custom'), F('To', to, 'custom'), F('Colors', colors, 'chart'), F('Color', color, 'color'), h('label', { class: 'fld', dataset: { show: 'all' } }, h('span', null, 'Only open cards'), h('span', null, openOnly, ' Yes')), h('button', { type: 'submit', hidden: true }));
  const upd = () => { const t = type.value; const chart = ['bar', 'stacked-bar', 'line', 'area', 'stacked-area', 'donut', 'pie'].includes(t);
    $$('[data-show]', body).forEach((f) => { const s0 = f.dataset.show; f.hidden = !(s0 === 'all' || (s0 === 'chart' && chart) || (s0 === 'stackable' && chart && !['donut', 'pie'].includes(t)) || (s0 === 'measure' && (chart || (t === 'kpi' && kpi.value === 'measure'))) || s0 === t || (s0 === 'custom' && range.value === 'custom') || (s0 === 'color' && (t === 'kpi' || colors.value === 'mono'))); }); };
  [type, kpi, range, colors].forEach((x) => x.addEventListener('change', upd)); upd();
  const save = () => { w.type = type.value; Object.assign(c, { title: title.value.trim(), source: source.value, groupBy: gb.value, stackBy: stack.value, measure: meas.value, dateField: df.value, range: range.value, from: from.value, to: to.value, colors: colors.value, color: color.value, metric: kpi.value, list: list.value, by: tby.value, openOnly: openOnly.checked });
    if (!c.title) c.title = w.type === 'kpi' ? (W_KPIS.find((k) => k[0] === c.metric) || [, 'KPI'])[1] : w.type === 'list' ? (W_LISTS.find((k) => k[0] === c.list) || [, 'Cards'])[1] : w.type === 'tokens' ? 'Tokens ' + (c.by === 'workspace' ? 'by workspace' : 'by bot') : `${(W_TYPES.find((k) => k[0] === w.type) || [, ''])[1]} — ${(groupByChoices().find((k) => k[0] === c.groupBy) || [, ''])[1]}`;
    if (!w0 && w.type === 'kpi') { w.w = 6; w.h = 8; } md.close(); onSave(w); };
  const md = openModal({ title: w0 ? 'Configure widget' : 'Add widget', body, cls: 'narrow', foot: [h('span', { class: 'spacer' }), h('button', { class: 'btn', onClick: () => md.close() }, 'Cancel'), h('button', { class: 'btn primary', id: 'wd-save', onClick: save }, w0 ? 'Save' : 'Add widget')] });
}

/* ---------------- init ---------------- */
function wire() {
  $('#menuBtn').addEventListener('click', openDrawer); $('#sbClose').addEventListener('click', closeDrawer); $('#scrim').addEventListener('click', closeDrawer);
  $('#addCardBtn').addEventListener('click', () => openCard(null, {}));
  const am = $('#addMenuBtn'); if (am) am.addEventListener('click', (e) => addMenu(e.currentTarget));
  const tb = $('#themeBtn'); if (tb) { tb.addEventListener('click', () => { const order = ['light', 'dark', 'auto']; setTheme(order[(order.indexOf(getTheme()) + 1) % 3]); toast('Theme: ' + { light: 'Light', dark: 'Dark', auto: 'Auto (system)' }[getTheme()], 1200); }); tb.addEventListener('contextmenu', (e) => { e.preventDefault(); themeMenu(tb); }); }
  applyTheme(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (getTheme() === 'auto' && WS && ['dashboard', 'gantt', 'mindmap'].includes(UI.view)) renderView(); });
  addEventListener('resize', debounce(() => { if (WS && isPhone()) renderTabs(); }, 150));
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#manageBtn').addEventListener('click', () => { closeDrawer(); openManage('structure'); });
  $('#addDomainBtn').addEventListener('click', () => nodeDialog('Add domain', null, null, 'domain'));
  $('#showArchived').addEventListener('change', (e) => { UI.showArchived = e.target.checked; render(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) closeDrawer();
    if ($('#modalRoot').firstChild || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); } else if (e.key === 'n') { e.preventDefault(); openCard(null, {}); } else if (e.key === 'i') { e.preventDefault(); quickIdeaDialog(); }
  });
  matchMedia('(max-width: 700px)').addEventListener('change', () => renderView());
  matchMedia('(max-width: 860px)').addEventListener('change', () => { setSync(SYNC.state); closeDrawer(); if (WS) { renderTabs(); if (UI.view === 'dashboard' || UI.view === 'gantt') renderView(); } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && WS && Date.now() - SYNC.lastPull > 60000) pullNow(false).catch(() => {}); });
}
async function init() {
  wire();
  let lw = null, li = null; try { lw = JSON.parse(localStorage.getItem(LS.ws) || 'null'); li = JSON.parse(localStorage.getItem(LS.items) || 'null'); } catch {}
  if (lw || li) { const m = migrate(lw, li); WS = m.ws; IT = m.items; reindex(); render(); }
  else $('#view').append(h('div', { class: 'empty' }, 'Loading…'));
  let r = null; try { r = await fetchRemote(); } catch (e) { console.warn(e); }
  SYNC.lastPull = Date.now();
  if (r) {
    const m = migrate(r.ws, r.items);
    if (WS) { WS = mergeWSDocs(WS, m.ws); IT = mergeItemsDocs(IT, m.items); } else { WS = m.ws; IT = m.items; }
    if (r.shaWs) META.sha_ws = r.shaWs; if (r.shaItems) META.sha_items = r.shaItems;
    if (/legacy/.test(r.via)) { META.dirty_ws = META.dirty_items = true; }
    saveMeta();
  } else if (!WS) { const m = migrate(null, null); WS = m.ws; IT = m.items; toast('Could not load board data; starting empty.'); }
  reindex(); saveLocal(); render(); scheduleSync(1000);
  window.MRE = { get ws() { return WS; }, get items() { return IT; }, get ui() { return UI; }, migrate, mergeItemsDocs, updateItem, mergeWSDocs, render, setSync, curWS, switchWorkspace, assistantLink, cardBot, cardLink, visibleViews, getWidgets, defaultWidgets, tokTotal, blockers, isIdeaItem, promoteToTask, addIdea, getTheme, setTheme, get sync() { return { ...SYNC, meta: META }; } };
}
init();
})();
