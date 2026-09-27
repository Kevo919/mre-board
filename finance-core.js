/* MRE Work Board — pure helpers for the Bills and Finance views (no DOM). Loaded by index.html as window.MREFinance and
   by the Node tests via require(). Bills helpers only read public card fields; Finance helpers only ever see data after
   it has been decrypted in memory from finance.enc.json. Nothing here stores or logs plaintext. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MREFinance = api;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* ---------------- dates (plain YYYY-MM-DD strings, no time zone math) ---------------- */
const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
function dnum(s) { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; }
function addDays(s, n) { return new Date((dnum(s) + n) * 864e5).toISOString().slice(0, 10); }
function daysBetween(from, to) { return isDay(from) && isDay(to) ? dnum(to) - dnum(from) : null; }

/* ---------------- Bills (public: no amounts) ---------------- */
const PROPERTIES = ['Echo', 'Plum', 'College', 'Crown Point', 'Mohawk', 'General'];
const BILL_TYPES = ['mortgage', 'utility', 'waste', 'card', 'insurance', 'other'];
const AUTOPAY = ['yes', 'no', 'unknown'];
const BILL_STATUSES = ['upcoming', 'paid', 'overdue', 'disputed'];
const URGENT_DAYS = 3; // same rule as the calendar Bills control

/** "Echo (Aurora)" / "crown" / "CROWN POINT" → "Crown Point"; '' when it isn't one of the six properties. */
function propKey(name) {
  const t = String(name || '').toLowerCase().replace(/\s*\(.*\)\s*$/, '').trim();
  if (!t) return '';
  return PROPERTIES.find((p) => p.toLowerCase() === t) || (/^crown\b/.test(t) ? 'Crown Point' : '');
}
function guessProp(text) {
  const t = String(text || '').toLowerCase();
  return PROPERTIES.find((p) => new RegExp('\\b' + p.toLowerCase().replace(' ', '[\\s-]') + '\\b').test(t)) || '';
}
function autopayOf(v) {
  if (v === true) return 'yes'; if (v === false) return 'no';
  const t = String(v == null ? '' : v).trim().toLowerCase();
  return /^(yes|on|true|enabled?)$/.test(t) ? 'yes' : /^(no|off|false|disabled?|manual)$/.test(t) ? 'no' : 'unknown';
}
function typeOf(v, text) {
  const t = String(v || '').toLowerCase();
  if (BILL_TYPES.includes(t)) return t;
  if (/^(utilities|electric|gas|water|sewer|internet)$/.test(t)) return 'utility';
  if (/^(creditcard|credit card|credit-card|cards?)$/.test(t)) return 'card';
  const s = String(text || '').toLowerCase();
  if (!t && s) {
    if (/mortgage|servicing|\bloan\b/.test(s)) return 'mortgage';
    if (/\b(waste|trash|garbage|refuse|recycling)\b/.test(s)) return 'waste';
    if (/insurance/.test(s)) return 'insurance';
    if (/\bcard\b|discover|\bamex\b|visa|mastercard/.test(s)) return 'card';
    if (/electric|\bgas\b|water|sewer|internet|utility|comed|nicor|xfinity/.test(s)) return 'utility';
  }
  return 'other';
}

/** Best-effort bill fields from free-text notes/title, for cards filed before the structured bill fields existed. */
function parseBillNotes(it) {
  const f = it.fields || {}; const notes = String(f.notes || ''); const title = String(it.title || ''); const all = title + ' ' + notes;
  const ap = /autopay\s*(?:is\s*)?[:=-]?\s*(on|off|yes|no|unknown|enabled|disabled)/i.exec(all);
  const iso = /\b(?:due|next due)[^.\n]*?(\d{4}-\d{2}-\d{2})/i.exec(notes);
  const company = title.replace(/\s*\((?:date unknown|[^)]*)\)\s*/gi, ' ').replace(/\s+(?:payment\s+)?due\b.*$/i, '').trim();
  const dueDate = isDay(it.due) ? it.due : iso ? iso[1] : '';
  const gapHit = /(missing statement|not in email|no statements?|unconfirmed|unknown|unmapped)/i.exec(all);
  return {
    company: company || title, type: typeOf('', all), autopay: ap ? autopayOf(ap[1]) : 'unknown', dueDate,
    estimated: /\bestimated?\b/i.test(notes), gap: !!gapHit || !dueDate, gapReason: gapHit ? gapHit[1].toLowerCase() : !dueDate ? 'no due date' : '',
    status: /\b(disputed?|in dispute)\b/i.test(all) ? 'disputed' : /\boverdue|past due\b/i.test(all) ? 'overdue' : /\bpaid\b/i.test(notes) ? 'paid' : 'upcoming',
  };
}

/**
 * Normalize one bill card. ctx = { today: 'YYYY-MM-DD', property?: group name, done?: bool }.
 * Missing structured string fields (dueDate, gapReason, …) mean '' — the publisher drops empty strings.
 */
function billInfo(it, ctx = {}) {
  const today = ctx.today; const f = (it && it.fields) || {};
  const structured = ['billCompany', 'billType', 'autopay', 'dueDate', 'billStatus', 'gap', 'estimated', 'gapReason'].some((k) => k in f);
  const p = structured ? {
    company: String(f.billCompany || '').trim() || String(it.title || ''), type: typeOf(f.billType, it.title), autopay: autopayOf(f.autopay),
    dueDate: isDay(f.dueDate) ? f.dueDate : '', estimated: f.estimated === true || f.estimated === 'true', gap: f.gap === true || f.gap === 'true',
    gapReason: String(f.gapReason || ''), status: BILL_STATUSES.includes(String(f.billStatus || '').toLowerCase()) ? String(f.billStatus).toLowerCase() : 'upcoming',
  } : parseBillNotes(it || {});
  if (!structured && ctx.done && p.status === 'upcoming') p.status = 'paid';
  const property = propKey(ctx.property) || guessProp(ctx.property) || guessProp((it && it.title) + ' ' + (f.notes || '')) || 'General';
  const days = p.dueDate && isDay(today) ? daysBetween(today, p.dueDate) : null;
  const open = p.status !== 'paid';
  const overdue = open && (p.status === 'overdue' || (days != null && days < 0));
  const urgent = open && (overdue || (days != null && days <= URGENT_DAYS));
  const hasGap = p.gap || !p.dueDate;
  const gapReason = p.gapReason || (!p.dueDate ? 'no due date' : '');
  return { id: it && it.id, title: (it && it.title) || '', ...p, gapReason, property, days, open, overdue, urgent, hasGap, structured };
}
function countdownLabel(b) {
  if (b.status === 'paid') return 'Paid';
  if (b.days == null) return b.status === 'overdue' ? 'Overdue' : 'No due date';
  if (b.days < 0) return `${-b.days}d overdue`;
  if (b.days === 0) return 'Due today';
  if (b.days === 1) return 'Tomorrow';
  return `${b.days} days`;
}
/** Due-date order; bills with no due date go last, then by company. */
function sortBills(list) {
  return list.slice().sort((a, b) => (a.dueDate ? 0 : 1) - (b.dueDate ? 0 : 1) || (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0) || a.company.localeCompare(b.company));
}
const BILL_TILES = [
  ['overdue', 'Overdue', (b) => b.overdue],
  ['due7', 'Due in 7 days', (b) => b.open && b.days != null && b.days >= 0 && b.days <= 7],
  ['due14', 'Due in 14 days', (b) => b.open && b.days != null && b.days >= 0 && b.days <= 14],
  ['ap-yes', 'Autopay on', (b) => b.autopay === 'yes'],
  ['ap-no', 'Autopay off', (b) => b.autopay === 'no'],
  ['ap-unknown', 'Autopay unknown', (b) => b.autopay === 'unknown'],
  ['gaps', 'Gaps', (b) => b.hasGap],
];
function billTileCounts(list) { const out = {}; BILL_TILES.forEach(([k, , fn]) => { out[k] = list.filter(fn).length; }); return out; }
function tileTest(key) { const t = BILL_TILES.find((x) => x[0] === key); return t ? t[2] : () => true; }

/* ---------------- Finance (only ever runs on decrypted, in-memory data) ---------------- */
/** number | currency string (dollar sign, thousands commas, "(x)" = negative) | null → number or null (null = unknown). */
function parseAmount(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim(); if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /^\$\s*-/.test(s);
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return s.replace(/[^0-9]/g, '') === '' || !Number.isFinite(n) ? null : neg ? -n : n;
}
const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
/** flags: 'estimated' | 'a, b' | ['a'] | '' | null → string[] */
function asList(v) {
  if (Array.isArray(v)) return v.flatMap(asList);
  if (v == null || v === false) return [];
  return String(v).split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}
const CYCLE_FACTOR = { monthly: 1, bimonthly: 1 / 2, 'bi-monthly': 1 / 2, quarterly: 1 / 3, semiannual: 1 / 6, 'semi-annual': 1 / 6, annual: 1 / 12, annually: 1 / 12, yearly: 1 / 12 };
function cycleFactor(c) { const k = String(c || '').trim().toLowerCase(); return k in CYCLE_FACTOR ? CYCLE_FACTOR[k] : 1; }
const CATEGORIES = ['Mortgage', 'Utilities', 'Waste', 'Insurance', 'Cards', 'Other'];
function categoryOf(type) { return { mortgage: 'Mortgage', utility: 'Utilities', waste: 'Waste', insurance: 'Insurance', card: 'Cards' }[type] || 'Other'; }
const monthOf = (s) => (typeof s === 'string' && /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : '');

function normFinBill(b) {
  const status = String(b.status || '').toLowerCase();
  return {
    property: propKey(b.property) || String(b.property || '').trim() || 'General', company: String(b.company || b.name || '').trim() || 'Unnamed bill',
    type: typeOf(b.type, b.company), amount: parseAmount(b.amount), amountNote: String(b.amountNote || ''), dueDate: isDay(b.dueDate) ? b.dueDate : '',
    cycle: String(b.cycle || '').toLowerCase(), autopay: autopayOf(b.autopay), status: BILL_STATUSES.includes(status) ? status : 'upcoming', flags: asList(b.flags),
  };
}
function normCard(c) {
  return { name: String(c.name || 'Card'), statementBalance: parseAmount(c.statementBalance), minimumDue: parseAmount(c.minimumDue), dueDate: isDay(c.dueDate) ? c.dueDate : '', autopay: autopayOf(c.autopay), asOf: c.asOf || '' };
}
const sum = (xs) => xs.reduce((s, x) => s + (x || 0), 0);

/** Everything the Finance view shows, computed from decrypted data. today = 'YYYY-MM-DD'. */
function financeSummary(data, today) {
  const d = data && typeof data === 'object' ? data : {};
  const bills = arr(d.bills).map(normFinBill);
  const cards = arr(d.creditCards).map(normCard);
  const balances = arr(d.bankBalances).map((b) => ({ account: String(b.account || ''), available: parseAmount(b.available != null ? b.available : b.balance), at: String(b.at || ''), t: Date.parse(b.at || '') }))
    .filter((b) => b.available != null && !isNaN(b.t)).sort((a, b) => a.t - b.t);
  const checkingOnly = balances.filter((b) => /checking/i.test(b.account));
  const checkingSeries = checkingOnly.length ? checkingOnly : balances;
  const latest = checkingSeries.length ? checkingSeries[checkingSeries.length - 1] : null;
  const days = (s) => (s ? daysBetween(today, s) : null);
  const payable = (b) => b.status !== 'paid' && b.status !== 'disputed';

  const cashDue = (n) => {
    const bl = bills.filter((b) => payable(b) && b.dueDate && days(b.dueDate) <= n);
    const cl = cards.filter((c) => c.dueDate && days(c.dueDate) >= 0 && days(c.dueDate) <= n && (c.minimumDue || 0) > 0);
    return { total: sum(bl.map((b) => b.amount)) + sum(cl.map((c) => c.minimumDue)), unknown: bl.filter((b) => b.amount == null).length, bills: bl.length, cards: cl.length };
  };
  const due7 = cashDue(7), due30 = cashDue(30);
  const checking = latest ? latest.available : null;

  const month = today.slice(0, 7);
  const receipts = arr(d.rentReceipts).map((r) => ({ property: propKey(r.property) || String(r.property || 'General'), unit: String(r.unit || ''), amount: parseAmount(r.amount), lease: parseAmount(r.lease_rent),
    received: isDay(r.date_received) ? r.date_received : '', appliesTo: monthOf(r.applies_to) || monthOf(r.date_received), bad: /return|bounce|fail|revers|reject/i.test(String(r.status || '')) }));
  const good = receipts.filter((r) => !r.bad);
  const rentThisMonth = sum(good.filter((r) => monthOf(r.received) === month).map((r) => r.amount));

  const weeks = Array.from({ length: 8 }, (_, k) => ({ start: addDays(today, k * 7), end: addDays(today, k * 7 + 6), byProp: {} }));
  bills.filter((b) => payable(b) && b.dueDate && b.amount != null).forEach((b) => {
    const dd = days(b.dueDate); if (dd < 0 || dd > 55) return; const w = weeks[Math.floor(dd / 7)]; w.byProp[b.property] = (w.byProp[b.property] || 0) + b.amount;
  });
  const monthlyByProp = {}; const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  bills.filter((b) => b.amount != null).forEach((b) => { const m = b.amount * cycleFactor(b.cycle); monthlyByProp[b.property] = (monthlyByProp[b.property] || 0) + m; byCategory[categoryOf(b.type)] += m; });
  byCategory.Cards += sum(cards.map((c) => c.minimumDue));
  if (!byCategory.Other) delete byCategory.Other;

  const leaseByUnit = new Map();
  receipts.slice().sort((a, b) => (a.received < b.received ? -1 : 1)).forEach((r) => { if (r.lease != null) leaseByUnit.set(r.property + '|' + r.unit, { property: r.property, lease: r.lease }); });
  const rentByProp = {};
  const slot = (p) => (rentByProp[p] = rentByProp[p] || { received: 0, expected: 0 });
  leaseByUnit.forEach((v) => { slot(v.property).expected += v.lease; });
  good.filter((r) => r.appliesTo === month).forEach((r) => { slot(r.property).received += r.amount || 0; });

  return {
    asOf: d.asOf || '', today, month, bills, cards, balances, checkingSeries, latest, checking,
    cashDue7: due7.total, cashDue30: due30.total, due7, due30,
    gap7: checking == null ? null : due7.total - checking, shortfall: checking != null && due7.total > checking,
    cardStatementTotal: sum(cards.map((c) => c.statementBalance)), cardsUnknown: cards.filter((c) => c.statementBalance == null).length,
    rentThisMonth, weeks, monthlyByProp, byCategory, rentByProp, notes: asList(d.notes),
  };
}

/* ---------------- crypto: PBKDF2-SHA256 (600k) → AES-GCM-256, matching encrypt-finance.js ---------------- */
const KDF = 'PBKDF2-SHA256', ITERATIONS = 600000;
const subtle = () => { const s = globalThis.crypto && globalThis.crypto.subtle; if (!s) throw new Error('This browser has no WebCrypto (needs HTTPS).'); return s; };
function b64(bytes) { const u = new Uint8Array(bytes); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s) { const bin = atob(String(s || '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function checkEnvelope(env) {
  if (!env || env.v !== 1 || env.kdf !== KDF) throw new Error('Unsupported finance file format');
  const iter = env.iter; if (!Number.isInteger(iter) || iter < 1 || iter > 1e7) throw new Error('Bad iteration count in finance file');
  const salt = unb64(env.salt), iv = unb64(env.iv), ct = unb64(env.ct);
  if (salt.length !== 16 || iv.length !== 12 || ct.length < 17) throw new Error('Corrupt finance file');
  return { iter, salt, iv, ct };
}
async function deriveKey(password, salt, iter, extractable = false) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, extractable, ['decrypt']);
}
class WrongPassword extends Error { constructor() { super('Wrong password'); this.name = 'WrongPassword'; } }
async function decryptWithKey(key, env) {
  const { iv, ct } = checkEnvelope(env);
  let pt; try { pt = await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct); } catch { throw new WrongPassword(); }
  return JSON.parse(new TextDecoder().decode(pt));
}
/** → { data, key }. Throws WrongPassword on a bad password (AES-GCM auth tag mismatch). */
async function unlock(env, password, { extractable = false } = {}) {
  const { iter, salt } = checkEnvelope(env);
  const key = await deriveKey(password, salt, iter, extractable);
  return { data: await decryptWithKey(key, env), key };
}
async function exportKey(key) { return b64(await subtle().exportKey('raw', key)); }
async function importKey(rawB64) { return subtle().importKey('raw', unb64(rawB64), { name: 'AES-GCM' }, false, ['decrypt']); }

return {
  PROPERTIES, BILL_TYPES, AUTOPAY, BILL_STATUSES, URGENT_DAYS, BILL_TILES, CATEGORIES,
  isDay, addDays, daysBetween, propKey, billInfo, parseBillNotes, countdownLabel, sortBills, billTileCounts, tileTest,
  parseAmount, asList, cycleFactor, categoryOf, financeSummary,
  KDF, ITERATIONS, b64, unb64, checkEnvelope, deriveKey, decryptWithKey, unlock, exportKey, importKey, WrongPassword,
};
});
