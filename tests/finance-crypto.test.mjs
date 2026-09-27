// Run: node --test tests/
// Fixtures are made-up round numbers; currency strings are built with Intl so no dollar text lives in this public file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MF = require(join(ROOT, 'finance-core.js'));
const { encrypt } = require(join(ROOT, 'encrypt-finance.js'));
const usd = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const PASSWORD = 'unit-test-password';

const FIXTURE = {
  asOf: '2026-09-27T09:00:00-05:00',
  bills: [
    { property: 'Echo', company: 'Lender A', type: 'mortgage', amount: 1000, dueDate: '2026-10-01', cycle: 'monthly', autopay: 'no', status: 'upcoming', flags: '' },
    { property: 'Plum', company: 'Water B', type: 'utility', amount: usd(90), dueDate: '2026-09-25', cycle: 'bimonthly', autopay: 'unknown', status: 'upcoming', flags: ['estimated'] },
    { property: 'Crown Point', company: 'Waste C', type: 'waste', amount: null, dueDate: '', cycle: 'quarterly', status: 'upcoming', flags: 'missing statement' },
    { property: 'General', company: 'Insurer D', type: 'insurance', amount: 1200, dueDate: '2026-10-15', cycle: 'annual', autopay: 'yes', status: 'paid' },
  ],
  creditCards: [{ name: 'Card E', statementBalance: usd(500), minimumDue: 25, dueDate: '2026-10-20' }],
  bankBalances: [
    { account: 'Checking', available: 2000, at: '2026-09-20T08:00:00-05:00' },
    { account: 'Checking', available: 800, at: '2026-09-26T18:00:00-05:00' },
    { account: 'Savings', available: 9000, at: '2026-09-27T08:00:00-05:00' },
  ],
  rentReceipts: [
    { date_received: '2026-09-02', property: 'Plum', unit: '1', amount: usd(1500), applies_to: '2026-09', lease_rent: usd(1500), status: 'received' },
    { date_received: '2026-08-03', property: 'Echo', unit: '2', amount: usd(1200), applies_to: '2026-08', lease_rent: usd(1250), status: 'received' },
  ],
};

test('encrypt-finance output decrypts in the browser code (round trip)', async () => {
  const env = await encrypt(JSON.stringify(FIXTURE), PASSWORD);
  assert.equal(env.v, 1); assert.equal(env.kdf, 'PBKDF2-SHA256'); assert.equal(env.iter, 600000);
  assert.equal(Buffer.from(env.salt, 'base64').length, 16); assert.equal(Buffer.from(env.iv, 'base64').length, 12);
  assert.ok(!JSON.stringify(env).includes('Lender A'), 'ciphertext must not contain plaintext');
  const { data, key } = await MF.unlock(env, PASSWORD, { extractable: true });
  assert.deepEqual(data, FIXTURE);
  const again = await MF.decryptWithKey(await MF.importKey(await MF.exportKey(key)), env);
  assert.deepEqual(again, FIXTURE, 'remembered (exported raw) key also decrypts');
});

test('wrong password fails with WrongPassword', async () => {
  const env = await encrypt(JSON.stringify(FIXTURE), PASSWORD);
  await assert.rejects(MF.unlock(env, 'not-it'), (e) => e instanceof MF.WrongPassword && e.message === 'Wrong password');
  const tampered = { ...env, ct: Buffer.from(Buffer.from(env.ct, 'base64').map((b, i) => (i === 0 ? b ^ 1 : b))).toString('base64') };
  await assert.rejects(MF.unlock(tampered, PASSWORD), MF.WrongPassword);
  await assert.rejects(MF.unlock({ ...env, v: 2 }, PASSWORD), /Unsupported/);
});

test('CLI: requires MRE_FINANCE_PASSWORD, never prints password or plaintext, output decrypts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mre-fin-'));
  try {
    const input = join(dir, 'finance-data.json'), output = join(dir, 'finance.enc.json');
    writeFileSync(input, JSON.stringify(FIXTURE));
    const env0 = { ...process.env }; delete env0.MRE_FINANCE_PASSWORD;
    const miss = spawnSync(process.execPath, [join(ROOT, 'encrypt-finance.js'), input, output], { env: env0, encoding: 'utf8' });
    assert.notEqual(miss.status, 0); assert.match(miss.stderr, /MRE_FINANCE_PASSWORD is not set/);
    const out = execFileSync(process.execPath, [join(ROOT, 'encrypt-finance.js'), input, output], { env: { ...env0, MRE_FINANCE_PASSWORD: PASSWORD }, encoding: 'utf8' });
    assert.ok(!out.includes(PASSWORD) && !out.includes('Lender A'));
    const env = JSON.parse(readFileSync(output, 'utf8'));
    assert.deepEqual(Object.keys(env), ['v', 'kdf', 'iter', 'salt', 'iv', 'ct']);
    assert.deepEqual((await MF.unlock(env, PASSWORD)).data, FIXTURE);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('committed finance.enc.json is ciphertext in the expected format', () => {
  const env = JSON.parse(readFileSync(join(ROOT, 'finance.enc.json'), 'utf8'));
  assert.doesNotThrow(() => MF.checkEnvelope(env)); assert.equal(env.iter, 600000);
});

const bill = (fields, extra = {}) => ({ id: 'bill-x', title: 'Example bill due', fields: { owner: 'Bills', ...fields }, ...extra });
test('Bills: missing dueDate / gapReason are treated as empty, sort last, count as gaps', () => {
  const b = MF.billInfo(bill({ billCompany: 'LRS', billType: 'waste', autopay: 'unknown', estimated: false, gap: true, billStatus: 'upcoming' }), { today: '2026-09-27', property: 'College (Crystal Lake)' });
  assert.equal(b.dueDate, ''); assert.equal(b.days, null); assert.equal(b.property, 'College');
  assert.equal(b.hasGap, true); assert.equal(b.gapReason, 'no due date'); assert.equal(b.urgent, false);
  assert.equal(MF.countdownLabel(b), 'No due date');
  const dated = MF.billInfo(bill({ billCompany: 'A', dueDate: '2026-12-01', gap: false }), { today: '2026-09-27' });
  assert.equal(dated.hasGap, false); assert.equal(dated.gapReason, '');
  assert.deepEqual(MF.sortBills([b, dated]).map((x) => x.company), ['A', 'LRS']);
});

test('Bills: overdue, within 3 days (red), and later', () => {
  const today = '2026-09-27';
  const at = (dueDate, billStatus = 'upcoming') => MF.billInfo(bill({ billCompany: 'X', dueDate, billStatus }), { today });
  const over = at('2026-09-25');
  assert.equal(over.days, -2); assert.equal(over.overdue, true); assert.equal(over.urgent, true); assert.equal(MF.countdownLabel(over), '2d overdue');
  assert.equal(at('2026-09-27').urgent, true); assert.equal(MF.countdownLabel(at('2026-09-27')), 'Due today');
  assert.equal(MF.countdownLabel(at('2026-09-28')), 'Tomorrow');
  const three = at('2026-09-30'); assert.equal(three.days, 3); assert.equal(three.urgent, true); assert.equal(three.overdue, false);
  const four = at('2026-10-01'); assert.equal(four.urgent, false); assert.equal(MF.countdownLabel(four), '4 days');
  const paid = at('2026-09-20', 'paid'); assert.equal(paid.overdue, false); assert.equal(paid.urgent, false); assert.equal(MF.countdownLabel(paid), 'Paid');
  assert.equal(at('', 'overdue').overdue, true, 'billStatus overdue counts even without a date');
  const counts = MF.billTileCounts([over, three, four, at('2026-10-09'), at('')]);
  assert.deepEqual([counts.overdue, counts.due7, counts.due14, counts.gaps], [1, 2, 3, 1]);
});

test('Bills: falls back to parsing notes when structured fields are missing', () => {
  const b = MF.billInfo({ id: 'bill-y', title: 'Nicor Gas due', due: '2026-10-02', fields: { notes: 'Autopay: off. Due date estimated from last cycle.' } }, { today: '2026-09-27', property: 'Mohawk (Park Forest)' });
  assert.equal(b.structured, false); assert.equal(b.company, 'Nicor Gas'); assert.equal(b.type, 'utility');
  assert.equal(b.autopay, 'no'); assert.equal(b.dueDate, '2026-10-02'); assert.equal(b.estimated, true); assert.equal(b.days, 5);
});

test('Bills: real items.json bill cards parse without errors', () => {
  const items = JSON.parse(readFileSync(join(ROOT, 'data/items.json'), 'utf8')).items.filter((x) => x.id.startsWith('bill-'));
  assert.ok(items.length >= 20);
  const rows = MF.sortBills(items.map((it) => MF.billInfo(it, { today: '2026-09-27' })));
  const firstUndated = rows.findIndex((r) => !r.dueDate);
  assert.ok(firstUndated > 0 && rows.slice(firstUndated).every((r) => !r.dueDate), 'undated bills are all at the end');
  rows.forEach((r) => { assert.ok(MF.BILL_TYPES.includes(r.type)); assert.ok(MF.AUTOPAY.includes(r.autopay)); assert.equal(typeof r.gapReason, 'string'); });
});

test('Finance: amounts, flags and summary tiles are parsed defensively', () => {
  assert.equal(MF.parseAmount(usd(1234.56)), 1234.56); assert.equal(MF.parseAmount(12.5), 12.5);
  assert.equal(MF.parseAmount(null), null); assert.equal(MF.parseAmount(''), null); assert.equal(MF.parseAmount('n/a'), null); assert.equal(MF.parseAmount('(' + usd(5) + ')'), -5);
  assert.deepEqual(MF.asList('a, b'), ['a', 'b']); assert.deepEqual(MF.asList(['a']), ['a']); assert.deepEqual(MF.asList(''), []);
  assert.equal(MF.cycleFactor('bimonthly'), 1 / 2); assert.equal(MF.cycleFactor('quarterly'), 1 / 3); assert.equal(MF.cycleFactor('annual'), 1 / 12);

  const s = MF.financeSummary(FIXTURE, '2026-09-27');
  assert.equal(s.cashDue7, 1090, 'upcoming + overdue unpaid bills in 7 days; paid and unknown amounts excluded');
  assert.equal(s.cashDue30, 1115, 'adds card minimums due within 30 days');
  assert.equal(s.checking, 800, 'latest checking entry by at (savings ignored)');
  assert.equal(s.shortfall, true); assert.equal(s.gap7, 290);
  assert.equal(s.cardStatementTotal, 500); assert.equal(s.rentThisMonth, 1500);
  assert.equal(s.monthlyByProp.Plum, 45); assert.equal(s.monthlyByProp.General, 100);
  assert.equal(s.byCategory.Cards, 25);
  assert.deepEqual(s.rentByProp.Echo, { received: 0, expected: 1250 });
  assert.equal(s.weeks.length, 8); assert.equal(s.weeks[0].byProp.Echo, 1000);

  const empty = MF.financeSummary({ bills: [], creditCards: null, bankBalances: 'x' }, '2026-09-27');
  assert.equal(empty.checking, null); assert.equal(empty.cashDue7, 0); assert.equal(empty.shortfall, false);
});
