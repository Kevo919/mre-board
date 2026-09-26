/* MRE Work Board — vanilla JS single-page app. No build step, no dependencies.
   Data: data/workspace.json (tree, buckets, fields, people, saved views) + data/items.json (records).
   PUBLIC SITE: never store names, phone numbers, emails, amounts, or case/account numbers. */
(() => {
'use strict';
const TZ = 'America/Chicago';
const SCHEMA = 3; // v3: bots map, bucket isActive, item agent/taskUrl
const LS = { ws: 'mre.ws.v2', items: 'mre.items.v2', ui: 'mre.ui.v2', token: 'mre.gh.token', repo: 'mre.gh.repo', sync: 'mre.sync.v2' };
const VIEWS = [
  { id: 'kanban', name: 'Kanban', ico: '▥' },
  { id: 'grid', name: 'Grid', ico: '▦' },
  { id: 'dashboard', name: 'Dashboard', ico: '◔' },
  { id: 'calendar', name: 'Calendar', ico: '▣' },
  { id: 'timeline', name: 'Timeline', ico: '☰' },
  { id: 'gallery', name: 'Gallery', ico: '▤' },
];
const FIELD_TYPES = [
  ['text', 'Text'], ['long-text', 'Long text'], ['number', 'Number'], ['date', 'Date'], ['single-select', 'Single select'],
  ['multi-select', 'Multi select'], ['checkbox', 'Checkbox'], ['person', 'Person / owner'], ['url', 'URL'],
];
const BOT_LINK = (id) => `grokbot://app/v1/sidebar?agent=${id}&tab=overview`;
const DEFAULT_BOTS = [
  ['14250373-92c8-4cfa-b12a-4d8b58cc0dd5', 'MRE Triage', 'Triage'],
  ['46c84c93-3489-486b-b331-16ab46f8ff98', 'MRE Leasing & Vacancies', 'Leasing'],
  ['24dbc830-2ab6-4a64-81f8-ce513aad2c53', 'MRE Maintenance & Work Orders', 'Maintenance'],
  ['1d1e9dc5-bdb7-411e-b490-7bb403e2d348', 'MRE Vendors', 'Vendors'],
  ['62cbcc0d-ba22-4956-9857-05551978ce22', 'MRE Bills & Payments', 'Bills'],
  ['7bffe639-ea47-4063-b8a3-73520f9a3f2a', 'Grok Bot', 'Grok Bot'],
].map(([id, name, short]) => ({ id, name, short, link: BOT_LINK(id) }));
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
const DEFAULT_UI = { view: 'kanban', scope: 'all', search: '', quick: { domain: '', groups: [], section: '', status: '', owner: '' },
  rules: [], sort: { key: 'due', dir: 1 }, groupBy: 'status', calMonth: null, calDay: null, colFilters: {}, collapsed: {}, showArchived: false, activeSaved: '' };
let UI = loadUI();
function loadUI() { try { return Object.assign(clone(DEFAULT_UI), JSON.parse(localStorage.getItem(LS.ui) || '{}')); } catch { return clone(DEFAULT_UI); } }
function saveUI() { try { localStorage.setItem(LS.ui, JSON.stringify(UI)); } catch {} }
if (QS.get('view') && VIEWS.some((v) => v.id === QS.get('view'))) UI.view = QS.get('view');

/* ---------------- defaults & migration ---------------- */
function defaultBuckets(domainId, t) {
  const k = domainId.replace(/^d-/, '');
  return [['todo', 'To Do', '#64748b', false], ['inprogress', 'In Progress', '#2563eb', false], ['review', 'In Review', '#d97706', false], ['done', 'Done', '#16a34a', true]]
    .map(([id, name, color, isDone], i) => ({ id: `b-${k}-${id}-${Math.random().toString(36).slice(2, 5)}`, domainId, name, color, isDone, isActive: id === 'inprogress', order: i, updatedAt: t }));
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
  ws.bots.forEach((b) => { if (!b.link) b.link = BOT_LINK(b.id); });
  // v3: "In Progress" buckets are active (animated edge light) unless KV turned it off
  ws.buckets.forEach((b) => { if (b.isActive === undefined) b.isActive = /^in progress$/i.test(b.name); });
  ws.nodes.forEach((n) => { n.archived = !!n.archived; if (n.order == null) n.order = 0; });
  // every domain needs at least one bucket
  ws.nodes.filter((n) => n.type === 'domain').forEach((d) => { if (!ws.buckets.some((b) => b.domainId === d.id)) ws.buckets.push(...defaultBuckets(d.id, ws.updated || nowISO())); });
  return ws;
}
function normItem(x, t) {
  return { id: x.id || uid('i'), nodeId: x.nodeId || null, status: x.status || null, title: x.title || '(untitled)', fields: x.fields && typeof x.fields === 'object' ? JSON.parse(JSON.stringify(x.fields)) : {},
    start: x.start || null, due: x.due || null, checklist: Array.isArray(x.checklist) ? x.checklist : [], comments: Array.isArray(x.comments) ? x.comments : [],
    labels: Array.isArray(x.labels) ? x.labels : [], source: x.source || 'kv', lastEditedBy: x.lastEditedBy || x.source || 'kv',
    agent: x.agent || null, taskUrl: x.taskUrl || null,
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
function domains(inc = UI.showArchived) { return children(null, inc).filter((n) => n.type === 'domain'); }
function scopeDomains() { if (UI.scope === 'all' || !node(UI.scope)) return domains(false).map((d) => d.id); const d = domainOf(UI.scope); return d ? [d.id] : []; }
function groupsIn(domIds) { const out = []; for (const d of domIds) for (const id of subtree(d)) { const n = node(id); if (n && n.type === 'group' && (UI.showArchived || !isArchivedPath(n.id))) out.push(n); } return out.sort((a, b) => ancestors(a.id).length - ancestors(b.id).length || byOrder(a, b)); }
function treeOrderIds(rootIds) { const out = []; const walk = (id) => { out.push(id); children(id).forEach((c) => walk(c.id)); }; rootIds.forEach(walk); return out; }

/* ---------------- buckets & fields ---------------- */
function bucketsOf(domId) { return WS.buckets.filter((b) => b.domainId === domId).sort(byOrder); }
function bucket(id) { return WS.buckets.find((b) => b.id === id); }
function itemDomain(it) { const d = domainOf(it.nodeId); return d ? d.id : (domains(true)[0] || {}).id; }
function itemBucket(it) { const b = bucket(it.status); if (b && b.domainId === itemDomain(it)) return b; return bucketsOf(itemDomain(it))[0] || b || null; }
function isDone(it) { const b = itemBucket(it); return !!(b && b.isDone); }
function statusKey(it) { const b = itemBucket(it); return b ? b.name.toLowerCase() : ''; }
function fieldsFor(domIds) { return WS.fields.filter((f) => !f.domainId || domIds.includes(f.domainId)).sort(byOrder); }
function fieldDef(id) { return WS.fields.find((f) => f.id === id); }
function fieldOptions(f) { if (f.type === 'person') return WS.people.map((p) => ({ id: p, name: p, color: null })); return f.options || []; }
function optName(f, v) { const o = fieldOptions(f).find((o) => o.id === v || o.name === v); return o ? o.name : v; }
function optColor(f, v) { const o = fieldOptions(f).find((o) => o.id === v || o.name === v); return o && o.color; }
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
/* ---------------- bots (agent links) ---------------- */
function defaultAgentId(it, ws = WS) {
  const bots = (ws && ws.bots && ws.bots.length) ? ws.bots : DEFAULT_BOTS;
  const byShort = (s) => bots.find((b) => b.short && s && b.short.toLowerCase() === String(s).toLowerCase());
  const b = byShort(it.source) || byShort(it.fields && it.fields.owner) || byShort('Triage') || bots[0];
  return b ? b.id : null;
}
function botOf(it) { return it && it.agent ? WS.bots.find((b) => b.id === it.agent) || null : null; }
function validTaskUrl(u) { return typeof u === 'string' && /^https?:\/\/[^\s]+$/i.test(u.trim()); }
function cardLink(it) { if (validTaskUrl(it.taskUrl)) return it.taskUrl.trim(); const b = botOf(it); return b ? b.link || BOT_LINK(b.id) : null; }
function isActiveItem(it) { const b = itemBucket(it); return !!(b && b.isActive && !b.isDone); }
function botChip(it) {
  const b = botOf(it); const href = cardLink(it); if (!b || !href) return null;
  const tip = validTaskUrl(it.taskUrl) ? `Open task link (${b.name})` : `Open in ${b.name} — Grok Bot app`;
  return h('a', { class: 'bot-chip', href, 'data-tip': tip, 'aria-label': tip, dataset: { agent: b.id }, onClick: (e) => e.stopPropagation(), onPointerdown: (e) => e.stopPropagation(), onKeydown: (e) => e.stopPropagation() },
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
  return { schemaVersion: SCHEMA, updated: tsNum(l.updated) >= tsNum(r.updated) ? l.updated : r.updated, items: mergeById(l.items, r.items, tm, 'item'), deleted };
}
function mergeWSDocs(l, r) {
  if (!l) return r; if (!r) return l;
  const deleted = [...tombMap([...(l.deleted || []), ...(r.deleted || [])]).values()];
  const tm = tombMap(deleted); const newer = tsNum(l.updated) >= tsNum(r.updated) ? l : r;
  const people = [...new Set([...(newer.people || []), ...(l.people || []), ...(r.people || [])])].filter((p) => !tm.has('person:' + p) || (newer.people || []).includes(p));
  return normWS({ ...newer, schemaVersion: SCHEMA, updated: newer.updated, deleted, people,
    nodes: mergeById(l.nodes, r.nodes, tm, 'node'), buckets: mergeById(l.buckets, r.buckets, tm, 'bucket'),
    fields: mergeById(l.fields, r.fields, tm, 'field'), savedViews: mergeById(l.savedViews, r.savedViews, tm, 'view'), bots: mergeById(l.bots, r.bots, tm, 'bot') });
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
    { key: 'agent', label: 'Bot', type: 'select', options: WS.bots.map((b) => ({ id: b.id, name: b.name })) },
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
  const scopeArchived = scoped && isArchivedPath(UI.scope);
  return IT.items.filter((it) => {
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
  if (patch.nodeId && patch.nodeId !== it.nodeId) { const oldDom = itemDomain(it); Object.assign(it, { nodeId: patch.nodeId }); const nd = itemDomain(it); if (nd !== oldDom && !patch.status) { const ob = bucket(it.status); const nb = bucketsOf(nd).find((b) => ob && b.name.toLowerCase() === ob.name.toLowerCase()) || bucketsOf(nd)[0]; it.status = nb ? nb.id : null; } }
  Object.assign(it, patch);
  if (fieldPatch) for (const [k, v] of Object.entries(fieldPatch)) { if (isEmpty(v) || v === false) delete it.fields[k]; else it.fields[k] = v; }
  it.updatedAt = nowISO(); it.lastEditedBy = 'kv';
  markDirty('items'); if (doRender) render();
}
function createItem(data) {
  const t = nowISO();
  const it = normItem({ ...data, id: uid('kv'), source: 'kv', lastEditedBy: 'kv', createdAt: t, updatedAt: t, order: Math.max(0, ...IT.items.map((i) => i.order || 0)) + 1 }, t);
  if (!it.nodeId || !node(it.nodeId)) it.nodeId = defaultNodeId();
  if (!it.agent || !WS.bots.some((b) => b.id === it.agent)) it.agent = defaultAgentId(it);
  if (!it.status || !bucket(it.status) || bucket(it.status).domainId !== itemDomain(it)) it.status = (bucketsOf(itemDomain(it))[0] || {}).id || null;
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
  if (type === 'domain') WS.buckets.push(...defaultBuckets(n.id, n.updatedAt));
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
  const moved = IT.items.filter((i) => i.status === id); moved.forEach((i) => { i.status = rest[0].id; i.updatedAt = nowISO(); i.lastEditedBy = 'kv'; }); if (moved.length) markDirty('items');
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
function deleteField(id) { WS.fields = WS.fields.filter((f) => f.id !== id); tomb('field', id); UI.rules = UI.rules.filter((r) => r.field !== 'f:' + id); if (UI.groupBy === 'f:' + id) UI.groupBy = 'status'; wsChanged(); }
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
  const openAll = IT.items.filter((i) => !isDone(i)).length;
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
function renderTabs() {
  const nav = $('#viewTabs'); nav.innerHTML = '';
  VIEWS.forEach((v) => nav.append(h('button', { class: 'tab', role: 'tab', id: 'tab-' + v.id, 'aria-selected': String(UI.view === v.id), 'aria-controls': 'view', tabindex: UI.view === v.id ? '0' : '-1', dataset: { view: v.id },
    onClick: () => { UI.view = v.id; render(); },
    onKeydown: (e) => { const i = VIEWS.findIndex((x) => x.id === UI.view); let j = null; if (e.key === 'ArrowRight') j = (i + 1) % VIEWS.length; if (e.key === 'ArrowLeft') j = (i - 1 + VIEWS.length) % VIEWS.length; if (j != null) { e.preventDefault(); UI.view = VIEWS[j].id; render(); $('#tab-' + UI.view).focus(); } } },
    h('span', { class: 'ico', 'aria-hidden': 'true' }, v.ico), h('span', null, v.name))));
}
function activeFilterCount() { const q = UI.quick; return UI.rules.length + (q.domain ? 1 : 0) + (q.section ? 1 : 0) + (q.status ? 1 : 0) + (q.owner ? 1 : 0) + ((q.groups || []).length ? 1 : 0); }
function groupByOptions() {
  const opts = [['status', 'Status'], ['group', 'Property / group'], ['section', 'Section'], ['agent', 'Bot']];
  fieldsFor(scopeDomains()).filter((f) => ['single-select', 'person'].includes(f.type)).forEach((f) => opts.push(['f:' + f.id, f.name]));
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
    if (groups.length) c.append(h('span', { class: 'chip-sep', 'aria-hidden': 'true' }));
  }
  const showGroups = groups.filter((g) => !UI.quick.domain || domainOf(g.id).id === UI.quick.domain);
  if (showGroups.length > 1) {
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
  return h('article', { class: 'card' + (act ? ' is-active' : ''), style: act ? { '--ac': bk.color } : null, tabindex: '0', dataset: { id: it.id }, 'aria-roledescription': 'draggable card', 'aria-label': `${it.title}. ${groupOf(it.nodeId) ? groupOf(it.nodeId).name : ''} ${sec}. ${it.due ? 'Due ' + fmtDate(it.due) : ''}. Press Enter to open, Alt+arrow keys to move.` },
    h('div', { class: 'card-top' }, locChip(it), sec ? h('span', { class: 'card-sec' }, sec) : null),
    h('div', { class: 'card-title' }, it.title),
    it.fields.notes ? h('div', { class: 'card-note' }, it.fields.notes) : null,
    h('div', { class: 'card-meta' }, dueBadge(it), botChip(it), it.fields.owner ? h('span', { class: 'owner', title: 'Owner' }, it.fields.owner) : null, priorityPill(it),
      cl.length ? h('span', { title: 'Checklist' }, `☑ ${doneN}/${cl.length}`) : null, it.comments.length ? h('span', { title: 'Comments' }, `💬 ${it.comments.length}`) : null,
      it.labels.map((l) => h('span', { class: 'label' }, l))),
    h('button', { class: 'card-menu', 'aria-label': 'Card actions for ' + it.title, onClick: (e) => { e.stopPropagation(); cardMenu(e.currentTarget, it); } }, '⋯'));
}
function cardMenu(anchor, it) {
  const { cols } = kanbanColumns(visibleItems());
  openMenu(anchor, [
    { label: 'Open', icon: '↗', onClick: () => openCard(it.id) },
    { title: 'Move to ' + (groupByOptions().find((o) => o[0] === UI.groupBy) || ['', 'status'])[1].toLowerCase() },
    ...cols.filter((c) => c.key !== colKeyOf(it)).map((c) => ({ label: c.name, icon: '→', onClick: () => dropTo(it.id, c.key, c.items.filter((x) => x.id !== it.id).length) })),
    { sep: 1 },
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
  } else if (gb === 'agent') cols = WS.bots.map((b, i) => ({ key: b.id, name: b.short || b.name, color: PALETTE[(i * 2) % PALETTE.length] }));
  else { const f = fieldDef(gb.slice(2)); cols = fieldOptions(f).map((o, i) => ({ key: o.id, name: o.name, color: o.color || PALETTE[i % PALETTE.length] })); }
  const known = new Set(cols.map((c) => c.key));
  if (items.some((i) => !known.has(colKeyOf(i, gb)))) cols.push({ key: '', name: gb === 'status' ? 'Other status' : 'None', color: '#94a3b8', none: true });
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
  else fp = { [gb.slice(2)]: key || null };
  updateItem(id, patch, fp);
  requestAnimationFrame(() => { const el = $(`.card[data-id="${CSS.escape(id)}"]`); if (el && DND.keyboard) el.focus(); DND.keyboard = false; });
}
function renderKanban(v, items) {
  const { cols, single, gb } = kanbanColumns(items);
  const board = h('div', { class: 'board', role: 'list', 'aria-label': 'Kanban board' });
  cols.forEach((c, ci) => {
    const presets = gb === 'status' ? (c.bucket ? { status: c.bucket.id } : {}) : gb === 'group' ? { nodeId: c.key && defaultNodeIdFor(c.key) } : gb === 'section' ? { nodeId: c.key } : gb === 'agent' ? { agent: c.key } : { fields: { [gb.slice(2)]: c.key } };
    board.append(h('section', { class: 'col', role: 'listitem', style: { '--cc': c.color }, dataset: { key: c.key }, 'aria-label': `${c.name}, ${c.items.length} cards` },
      h('div', { class: 'col-head' }, h('span', { class: 'dot', style: { background: c.color } }), h('span', null, c.name), h('span', { class: 'count' }, c.items.length),
        c.bucket ? h('button', { class: 'icon-btn', 'aria-label': 'Bucket options for ' + c.name, onClick: (e) => bucketMenu(e.currentTarget, c.bucket) }, '⋯') : null),
      h('div', { class: 'col-list', dataset: { key: c.key } }, c.items.map(cardEl)),
      c.none ? null : h('button', { class: 'col-add', onClick: () => openCard(null, presets) }, '＋ Add card')));
  });
  if (gb === 'status' && single) board.append(h('section', { class: 'col add-bucket' }, h('button', { class: 'btn', id: 'addBucketBtn', onClick: () => bucketDialog(single) }, '＋ Add bucket')));
  if (!cols.length) board.append(h('div', { class: 'empty' }, 'No columns yet.'));
  v.append(board);
  enableDnD(board);
}
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
function gridCols() {
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
function renderDashboard(v, items) {
  const open = items.filter((i) => !isDone(i));
  const overdue = sortItems(open.filter((i) => i.due && daysUntil(i.due) < 0), { key: 'due', dir: 1 });
  const week = sortItems(open.filter((i) => i.due && daysUntil(i.due) >= 0 && daysUntil(i.due) <= 7), { key: 'due', dir: 1 });
  const doms = scopeDomains();
  const byStatus = statusOptionsUnion(doms).map((o) => ({ name: o.name, color: o.color, n: items.filter((i) => statusKey(i) === o.id).length }));
  const gmap = new Map(); items.forEach((i) => { const g = groupOf(i.nodeId) || domainOf(i.nodeId); if (!g) return; const e = gmap.get(g.id) || { name: g.name, color: g.color || nodeColor(g.id), n: 0 }; e.n++; gmap.set(g.id, e); });
  const byGroup = [...gmap.values()].sort((a, b) => b.n - a.n);
  const omap = new Map(); open.forEach((i) => { const o = i.fields.owner || 'Unassigned'; omap.set(o, (omap.get(o) || 0) + 1); });
  const OC = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#db2777', '#ca8a04', '#64748b', '#dc2626', '#65a30d', '#7c3aed', '#0d9488'];
  const byOwner = [...omap.entries()].sort((a, b) => b[1] - a[1]).map(([name, n], k) => ({ name, n, color: OC[k % OC.length] }));
  v.append(h('div', { class: 'dash' },
    h('div', { class: 'tiles' }, h('div', { class: 'tile' }, h('b', null, open.length), h('span', null, 'Open cards')), h('div', { class: 'tile t-danger' }, h('b', null, overdue.length), h('span', null, 'Overdue')),
      h('div', { class: 'tile t-warn' }, h('b', null, week.length), h('span', null, 'Due in 7 days')), h('div', { class: 'tile t-ok' }, h('b', null, items.length - open.length), h('span', null, 'Done'))),
    barsPanel('By status', byStatus), barsPanel('By property / group', byGroup),
    h('div', { class: 'panel' }, h('h3', null, 'Open cards by owner'), byOwner.length ? h('div', { class: 'donut-wrap' }, donut(byOwner), h('div', { class: 'legend' }, byOwner.map((r) => h('span', null, h('i', { class: 'dot', style: { background: r.color } }), `${r.name} — ${r.n}`)))) : h('div', { class: 'empty' }, 'No open cards')),
    h('div', { class: 'panel' }, h('h3', null, `Overdue (${overdue.length})`), itemList(overdue, 'Nothing overdue 🎉')),
    h('div', { class: 'panel' }, h('h3', null, `Due this week (${week.length})`), itemList(week, 'Nothing due in the next 7 days'))));
}

/* ---------------- Calendar ---------------- */
function renderCalendar(v, items) {
  const month = UI.calMonth || todayStr().slice(0, 7); const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`; const startDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); const gridStart = addDays(first, -startDow);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate(); const weeks = Math.ceil((startDow + daysInMonth) / 7);
  const byDay = new Map(); items.filter((i) => i.due).forEach((i) => { if (!byDay.has(i.due)) byDay.set(i.due, []); byDay.get(i.due).push(i); });
  const shift = (n) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); UI.calMonth = d.toISOString().slice(0, 7); UI.calDay = null; render(); };
  const narrow = matchMedia('(max-width: 700px)').matches;
  v.append(h('div', { class: 'cal-head' }, h('button', { class: 'icon-btn', 'aria-label': 'Previous month', id: 'calPrev', onClick: () => shift(-1) }, '‹'),
    h('h2', { 'aria-live': 'polite' }, new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })),
    h('button', { class: 'icon-btn', 'aria-label': 'Next month', id: 'calNext', onClick: () => shift(1) }, '›'), h('button', { class: 'btn small', onClick: () => { UI.calMonth = null; UI.calDay = todayStr(); render(); } }, 'Today')));
  const cal = h('div', { class: 'cal' + (narrow ? ' mini' : ''), role: 'grid', 'aria-label': 'Month' }, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => h('div', { class: 'dow', role: 'columnheader' }, narrow ? d[0] : d)));
  for (let k = 0; k < weeks * 7; k++) {
    const ds = addDays(gridStart, k); const list = (byDay.get(ds) || []).sort((a, b) => isDone(a) - isDone(b));
    const cls = 'day' + (ds.slice(0, 7) !== month ? ' other' : '') + (ds === todayStr() ? ' today' : '') + (UI.calDay === ds ? ' sel' : '');
    cal.append(h('button', { class: cls, role: 'gridcell', dataset: { day: ds }, 'aria-label': `${fmtDate(ds, { weekday: 'long', month: 'long', day: 'numeric' })}, ${list.length} cards`, onClick: () => { UI.calDay = UI.calDay === ds ? null : ds; renderView(); } },
      h('span', { class: 'dnum' }, Number(ds.slice(8))),
      narrow ? h('span', { class: 'dots' }, list.slice(0, 4).map((i) => h('i', { style: { '--pc': nodeColor(i.nodeId) } }))) :
        [list.slice(0, 3).map((i) => h('span', { class: 'cal-pill' + (isDone(i) ? ' done' : ''), style: { '--pc': nodeColor(i.nodeId) } }, i.title)), list.length > 3 ? h('span', { class: 'cal-more' }, `+${list.length - 3} more`) : null]));
  }
  v.append(cal);
  const panel = h('div', { class: 'day-panel' });
  if (UI.calDay) panel.append(h('div', { class: 'panel' }, h('h3', null, fmtDate(UI.calDay, { weekday: 'long', month: 'long', day: 'numeric' })), itemList(byDay.get(UI.calDay) || [], 'No cards due this day'), h('button', { class: 'btn small', style: { 'margin-top': '8px' }, onClick: () => openCard(null, { due: UI.calDay }) }, '＋ Add card on this day')));
  else if (narrow) {
    const gridEnd = addDays(gridStart, weeks * 7 - 1); const days = [...byDay.keys()].filter((d) => d >= gridStart && d <= gridEnd).sort();
    panel.append(h('div', { class: 'agenda' }, days.length ? days.map((d) => [h('h4', null, fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })), itemList(byDay.get(d), '')]) : h('div', { class: 'empty' }, 'No due dates this month')));
  }
  const nodue = items.filter((i) => !i.due && !isDone(i)).length;
  if (nodue) panel.append(h('p', { class: 'tl-note' }, `${nodue} open card(s) have no due date.`));
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
        h('button', { class: 'tl-bar' + (isDone(it) ? ' done' : '') + (di && di.cls === 'overdue' ? ' overdue' : ''), style: { left: x(s) + 'px', width: Math.max(dw, x(e) - x(s) + dw) + 'px', '--pc': nodeColor(it.nodeId) }, title: `${it.title}: ${fmtDate(s)} → ${fmtDate(e)}`, 'aria-label': `${it.title}, ${fmtDate(s)} to ${fmtDate(e)}`, onClick: () => openCard(it.id) }, it.title))));
    });
  }
  tl.append(h('div', { class: 'tl-today', style: { left: lw + x(t0) + dw / 2 + 'px' }, 'aria-hidden': 'true' }));
  const wrap = h('div', { class: 'tl-wrap' }, tl);
  v.append(spans.length ? wrap : h('div', { class: 'empty' }, 'No cards with due dates in this view.'));
  const nd = items.length - withDue.length;
  v.append(h('p', { class: 'tl-note' }, `Bars run from Start (or the created date) to Due. Red line = today.${nd ? ` ${nd} card(s) without a due date aren't shown.` : ''}`));
  requestAnimationFrame(() => { if (TL_SCROLL.set) return; wrap.scrollLeft = Math.max(0, x(t0) - dw * 5); TL_SCROLL.set = true; });
}
const TL_SCROLL = { set: false };

/* ---------------- Gallery ---------------- */
function renderGallery(v, items) {
  const list = sortItems(items); const doms = scopeDomains(); const flds = fieldsFor(doms).filter((f) => !['notes', 'owner', 'priority'].includes(f.id));
  v.append(list.length ? h('div', { class: 'gallery' }, list.map((it) => h('div', { class: 'gcard' + (isActiveItem(it) ? ' is-active' : ''), role: 'button', tabindex: '0', 'aria-label': 'Open card ' + it.title, style: { '--pc': nodeColor(it.nodeId), '--ac': (itemBucket(it) || {}).color || 'var(--accent)' }, dataset: { id: it.id }, onClick: () => openCard(it.id), onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openCard(it.id); } } },
    h('div', { class: 'band' }), h('div', { class: 'gbody' },
      h('div', { class: 'card-top' }, locChip(it), statusPill(it)),
      h('div', { class: 'gtitle' }, it.title), pathLabel(it.nodeId) ? h('div', { class: 'kv' }, pathLabel(it.nodeId)) : null,
      it.fields.notes ? h('div', { class: 'card-note' }, it.fields.notes) : null,
      h('div', { class: 'card-meta' }, dueBadge(it), botChip(it), it.fields.owner ? h('span', { class: 'owner' }, it.fields.owner) : null, priorityPill(it), it.checklist.length ? h('span', null, `☑ ${it.checklist.filter((c) => c.done).length}/${it.checklist.length}`) : null),
      flds.filter((f) => !isEmpty(it.fields[f.id])).slice(0, 4).map((f) => h('div', { class: 'kv' }, f.name + ': ', h('b', null, fmtFieldVal(f, it.fields[f.id]))))))))
    : h('div', { class: 'empty' }, 'No cards match.'));
  v.append(h('div', { style: { 'margin-top': '12px' } }, h('button', { class: 'btn', onClick: () => openCard(null, {}) }, '＋ Add card')));
}

function renderView() {
  const v = $('#view'); const keep = {}; ['.board', '.grid-wrap', '.tl-wrap'].forEach((s) => { const el = $(s, v); if (el) keep[s] = [el.scrollLeft, el.scrollTop]; });
  if (!keep['.tl-wrap']) TL_SCROLL.set = false;
  const wy = scrollY; v.innerHTML = ''; v.setAttribute('aria-labelledby', 'tab-' + UI.view);
  const items = visibleItems();
  ({ kanban: renderKanban, grid: renderGrid, dashboard: renderDashboard, calendar: renderCalendar, timeline: renderTimeline, gallery: renderGallery })[UI.view](v, items);
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
      fieldOptions(f).map((o) => h('button', { type: 'button', class: 'chip', style: { '--chip': o.color || 'var(--accent)' }, 'aria-pressed': String(cur.has(o.id)), onClick: (e) => { cur.has(o.id) ? cur.delete(o.id) : cur.add(o.id); e.currentTarget.setAttribute('aria-pressed', String(cur.has(o.id))); onChange([...cur]); } }, o.name)));
      if (!fieldOptions(f).length) el.append(h('span', { class: 'meta-line' }, 'No options yet — add them in Manage › Fields.')); break; }
    case 'url': el = h('input', { id, type: 'url', value: value || '', placeholder: 'https://' }); el.addEventListener('change', () => onChange(el.value.trim() || null)); break;
    default: el = h('input', { id, type: 'text', value: value ?? '' }); el.addEventListener('change', () => { privacyWarn(el.value); onChange(el.value.trim() || null); });
  }
  return h('label', { class: 'fld' + (f.type === 'long-text' || f.type === 'multi-select' ? ' full' : ''), for: id }, h('span', null, f.name), el);
}
function openCard(id, presets = {}) {
  const existing = id ? getItem(id) : null; if (id && !existing) return;
  const draft = existing ? null : { title: '', nodeId: presets.nodeId || defaultNodeId(), status: presets.status || null, due: presets.due || null, start: null, fields: { ...(presets.fields || {}) }, labels: [], checklist: [], comments: [], agent: presets.agent || null, taskUrl: null, source: 'kv' };
  if (draft) { for (const k of Object.keys(draft.fields)) if (isEmpty(draft.fields[k])) delete draft.fields[k]; if (!draft.fields.owner && WS.people.includes('KV')) draft.fields.owner = 'KV'; if (!draft.agent) draft.agent = defaultAgentId(draft); }
  const cur = () => existing ? getItem(id) : draft;
  const set = (patch, fp) => {
    if (existing) { updateItem(id, patch, fp); }
    else { Object.assign(draft, patch); if (fp) for (const [k, v] of Object.entries(fp)) { if (isEmpty(v) || v === false) delete draft.fields[k]; else draft.fields[k] = v; } }
  };
  let md;
  const build = () => {
    const it = cur(); if (!it) { md && md.close(); return; }
    const dom = domainOf(it.nodeId); const domId = dom ? dom.id : domains()[0].id; const bs = bucketsOf(domId);
    if (!it.status || !bs.some((b) => b.id === it.status)) { if (existing) it.status = (bs.find((b) => bucket(it.status) && b.name === bucket(it.status).name) || bs[0] || {}).id; else draft.status = (bs[0] || {}).id; }
    const title = h('input', { class: 'title-input', 'aria-label': 'Title', placeholder: 'Card title (no names or numbers)', value: it.title, autofocus: true });
    title.addEventListener('change', () => { privacyWarn(title.value); if (existing) { if (title.value.trim()) set({ title: title.value.trim() }); } else draft.title = title.value; });
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !existing) { e.preventDefault(); draft.title = title.value; create(); } });
    const loc = h('select', { id: 'cm-loc', value: it.nodeId }, nodeOptions().map(([v, l]) => h('option', { value: v }, l)));
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
    const bot = botOf(it); const href = cardLink(it); const usesUrl = validTaskUrl(it.taskUrl);
    const openBtn = href ? h('a', { class: 'btn primary open-bot', id: 'cm-open-bot', href, target: usesUrl ? '_blank' : null, rel: usesUrl ? 'noopener noreferrer' : null }, '🤖 ', usesUrl ? `Open task link${bot ? ' (' + bot.short + ')' : ''}` : `Open in ${bot.name}`) : h('span', { class: 'meta-line' }, 'Pick a bot to get an “Open in bot” link.');
    const body = h('div', null,
      h('div', { class: 'notice' }, 'Public page: don’t store names, phone numbers, emails, amounts, or case/account numbers.'),
      h('div', { class: 'form-grid' },
        h('div', { class: 'full' }, title),
        h('label', { class: 'fld full', for: 'cm-loc' }, h('span', null, 'Location (domain › group › section)'), loc),
        h('label', { class: 'fld', for: 'cm-status' }, h('span', null, 'Status'), st),
        h('label', { class: 'fld', for: 'cm-labels' }, h('span', null, 'Labels'), labels),
        h('div', { class: 'bot-box full' },
          h('div', { class: 'form-grid' }, h('label', { class: 'fld', for: 'cm-agent' }, h('span', null, 'Bot (agent)'), agentSel), h('label', { class: 'fld', for: 'cm-taskurl' }, h('span', null, 'Task link (optional, used instead of the bot link)'), taskUrl)),
          h('div', { class: 'bot-open' }, openBtn, h('small', { class: 'meta-line', id: 'cm-bot-note' }, usesUrl ? 'Opens the task link in a new tab.' : 'Opens the bot\'s chat in the Grok Bot app (needs the app on this device).'))),
        h('label', { class: 'fld', for: 'cm-start' }, h('span', null, 'Start'), dateIn('start')),
        h('label', { class: 'fld', for: 'cm-due' }, h('span', null, 'Due'), dateIn('due')),
        fieldsFor([domId]).map((f) => fieldEditor(f, it.fields[f.id], (v) => set({}, { [f.id]: v }))),
        h('div', { class: 'fld full' }, h('span', null, `Checklist ${it.checklist.length ? `(${it.checklist.filter((c) => c.done).length}/${it.checklist.length})` : ''}`), cl, h('div', { class: 'rule' }, clAdd, h('button', { class: 'btn small', type: 'button', onClick: addCl }, 'Add'))),
        h('div', { class: 'fld full' }, h('span', null, `Comments (${it.comments.length})`), it.comments.map((c) => h('div', { class: 'comment' }, h('small', null, fmtStamp(c.at) + (c.by ? ' · ' + c.by : '')), c.text)), cmIn,
          h('div', null, h('button', { class: 'btn small', type: 'button', id: 'cm-comment-btn', onClick: () => { if (!cmIn.value.trim()) return; privacyWarn(cmIn.value); set({ comments: [...cur().comments, { text: cmIn.value.trim(), at: nowISO(), by: 'KV' }] }); rebuild('#cm-comment'); } }, 'Comment'))),
        existing ? h('div', { class: 'meta-line full' }, `Source: ${it.source} · Created ${fmtStamp(it.createdAt)} · Updated ${fmtStamp(it.updatedAt)} · id ${it.id}`) : null));
    return body;
  };
  const rebuild = (focusSel) => { const b = md.body; const st = b.scrollTop; b.innerHTML = ''; b.append(build()); b.scrollTop = st; if (focusSel) { const f = $(focusSel, b); if (f) f.focus(); } };
  const create = () => { const t = ($('.title-input', md.el).value || draft.title || '').trim(); if (!t) { toast('Give the card a title'); $('.title-input', md.el).focus(); return; } draft.title = t; const it = createItem(draft); md.close(); toast('Card added'); requestAnimationFrame(() => { const el = $(`[data-id="${CSS.escape(it.id)}"]`); if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }); };
  md = openModal({ title: existing ? 'Card' : 'New card', body: build(), cls: '',
    foot: existing ? [h('button', { class: 'btn danger', onClick: async () => { if (await confirmDialog(`Delete "${cur().title}"?`)) { md.close(); deleteItem(id); } } }, 'Delete'), h('span', { class: 'spacer' }), h('button', { class: 'btn primary', onClick: () => md.close() }, 'Done')]
      : [h('span', { class: 'spacer' }), h('button', { class: 'btn', onClick: () => md.close() }, 'Cancel'), h('button', { class: 'btn primary', id: 'cm-create', onClick: create }, 'Create card')] });
}

/* ---------------- Settings ---------------- */
function openSettings() {
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
  openModal({ title: 'Settings', body, cls: 'wide' });
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
    const tabs = h('div', { class: 'subtabs', role: 'tablist' }, [['structure', 'Domains & sections'], ['buckets', 'Buckets'], ['fields', 'Fields'], ['people', 'Owners'], ['views', 'Saved views']].map(([k, l]) => h('button', { class: 'btn small', role: 'tab', 'aria-selected': String(cur === k), dataset: { mtab: k }, onClick: () => { cur = k; refresh(); } }, l)));
    const box = h('div', null, tabs);
    const domPicker = () => h('label', { class: 'tb-label' }, 'Domain ', h('select', { id: 'mg-dom', value: domSel, onChange: (e) => { domSel = e.target.value; refresh(); } }, domains(true).map((d) => h('option', { value: d.id }, d.name))));
    if (cur === 'structure') {
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

/* ---------------- init ---------------- */
function wire() {
  $('#menuBtn').addEventListener('click', openDrawer); $('#sbClose').addEventListener('click', closeDrawer); $('#scrim').addEventListener('click', closeDrawer);
  $('#addCardBtn').addEventListener('click', () => openCard(null, {}));
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#manageBtn').addEventListener('click', () => { closeDrawer(); openManage('structure'); });
  $('#addDomainBtn').addEventListener('click', () => nodeDialog('Add domain', null, null, 'domain'));
  $('#showArchived').addEventListener('change', (e) => { UI.showArchived = e.target.checked; render(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#sidebar').classList.contains('open')) closeDrawer();
    if ($('#modalRoot').firstChild || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); } else if (e.key === 'n') { e.preventDefault(); openCard(null, {}); }
  });
  matchMedia('(max-width: 700px)').addEventListener('change', () => renderView());
  matchMedia('(max-width: 860px)').addEventListener('change', () => { setSync(SYNC.state); closeDrawer(); });
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
  window.MRE = { get ws() { return WS; }, get items() { return IT; }, migrate, mergeItemsDocs, mergeWSDocs, render, setSync, get sync() { return { ...SYNC, meta: META }; } };
}
init();
})();
