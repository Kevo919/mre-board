#!/usr/bin/env node
/* Encrypt the private finance JSON for the public MRE Work Board (Finance view).
   Usage: MRE_FINANCE_PASSWORD=... node encrypt-finance.js [input] [output]
     input   default /workspace/mre-bills/finance-data.json  (plaintext; never commit it)
     output  default ./finance.enc.json                      (safe to publish)
   Crypto: PBKDF2-SHA256 (600000 iterations, random 16-byte salt) → AES-GCM-256 (random 12-byte IV).
   Output: {"v":1,"kdf":"PBKDF2-SHA256","iter":600000,"salt":b64,"iv":b64,"ct":b64} — ct includes the GCM tag.
   Node 18+, no dependencies. The password is read only from MRE_FINANCE_PASSWORD and is never printed. */
'use strict';
const { webcrypto } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ITER = 600000;
const DEFAULT_IN = '/workspace/mre-bills/finance-data.json';
const DEFAULT_OUT = './finance.enc.json';

function fail(msg) { process.stderr.write('encrypt-finance: ' + msg + '\n'); process.exit(1); }

async function encrypt(plaintext, password) {
  const { subtle } = webcrypto;
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)));
  const b64 = (u) => Buffer.from(u).toString('base64');
  return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}

async function main() {
  const password = process.env.MRE_FINANCE_PASSWORD;
  if (!password) fail('MRE_FINANCE_PASSWORD is not set. Run: MRE_FINANCE_PASSWORD=\'your password\' node encrypt-finance.js [input] [output]');
  const input = process.argv[2] || DEFAULT_IN;
  const output = process.argv[3] || DEFAULT_OUT;
  let raw;
  try { raw = fs.readFileSync(input, 'utf8'); } catch (e) { fail(`cannot read input ${input} (${e.code || 'error'})`); }
  let doc;
  try { doc = JSON.parse(raw); } catch { fail(`input ${input} is not valid JSON`); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) fail('input must be a JSON object');
  const env = await encrypt(JSON.stringify(doc), password);
  fs.writeFileSync(output, JSON.stringify(env) + '\n');
  process.stdout.write(`encrypt-finance: wrote ${path.resolve(output)} (PBKDF2-SHA256 x${ITER}, AES-GCM-256)\n`);
}

if (require.main === module) main().catch((e) => fail(e && e.message ? e.message : 'failed'));
module.exports = { encrypt, ITER };
