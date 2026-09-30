#!/usr/bin/env node
/*
 * Copyright 2026 Sevetech
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// minivim.js - a tiny vim clone with a built-in terminal pane, tuned for PowerShell.
// Zero dependencies. Usage: node minivim.js [file.ps1]

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const out = process.stdout;
const inp = process.stdin;

// ---------------------------------------------------------------- state
const S = {
  lines: [''], cy: 0, cx: 0, want: 0, top: 0, left: 0,
  mode: 'NORMAL', file: null, dirty: false, msg: '', cmd: '',
  count: '', op: null, opn: 1, pend: '',
  reg: { text: [], lw: false }, undo: [], redo: [],
  anchor: null, vline: false, search: '',
  errs: [], errI: -1, syn: null, // syn: null = auto by extension
};

const T = {
  open: false, focus: false, h: 10, lines: [], partial: false,
  input: '', cur: 0, cwd: process.cwd(), proc: null, hist: [], hi: 0,
  runStart: null,
};

// ---------------------------------------------------------------- helpers
const cur = () => S.lines[S.cy];
const firstNB = () => cur().search(/\S|$/);
const cls = (c) => (/\s/.test(c) ? 0 : /\w/.test(c) ? 1 : 2);
const shortCwd = () => path.basename(T.cwd) || T.cwd;

function clamp() {
  S.cy = Math.max(0, Math.min(S.lines.length - 1, S.cy));
  const max = S.mode === 'INSERT' ? cur().length : Math.max(0, cur().length - 1);
  S.cx = Math.max(0, Math.min(max, S.cx));
}

function snap() {
  S.undo.push({ l: S.lines.slice(), cy: S.cy, cx: S.cx });
  if (S.undo.length > 300) S.undo.shift();
  S.redo = [];
  S.dirty = true;
}

function restore(st) { S.lines = st.l; S.cy = st.cy; S.cx = st.cx; clamp(); S.want = S.cx; }

function undo(n) {
  for (let i = 0; i < n; i++) {
    const st = S.undo.pop();
    if (!st) { S.msg = 'Already at oldest change'; return; }
    S.redo.push({ l: S.lines.slice(), cy: S.cy, cx: S.cx });
    restore(st); S.dirty = true;
  }
}

function redo(n) {
  for (let i = 0; i < n; i++) {
    const st = S.redo.pop();
    if (!st) { S.msg = 'Already at newest change'; return; }
    S.undo.push({ l: S.lines.slice(), cy: S.cy, cx: S.cx });
    restore(st); S.dirty = true;
  }
}

function enterInsert() { S.mode = 'INSERT'; }

// ---------------------------------------------------------------- file io
function load(f) {
  S.file = f;
  try {
    const t = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\t/g, '  ');
    S.lines = t.split('\n');
    if (S.lines.length > 1 && S.lines[S.lines.length - 1] === '') S.lines.pop();
    S.msg = `"${f}" ${S.lines.length}L`;
  } catch {
    S.lines = ['']; S.msg = `"${f}" [New]`;
  }
  S.cy = S.cx = S.want = S.top = S.left = 0;
  S.dirty = false; S.undo = []; S.redo = [];
}

function save(f) {
  if (!f) { S.msg = 'No file name'; return false; }
  try {
    fs.writeFileSync(f, S.lines.join('\n') + '\n');
    S.file = f; S.dirty = false;
    S.msg = `"${f}" ${S.lines.length}L written`;
    return true;
  } catch (e) { S.msg = 'Write failed: ' + e.message; return false; }
}

// ---------------------------------------------------------------- buffers
// S always holds the active buffer; the others are stashed in B. Switching swaps these fields.
const BF = ['lines', 'cy', 'cx', 'want', 'top', 'left', 'file', 'dirty', 'undo', 'redo'];
const B = [{}];
let cb = 0, alt = -1;

const bufName = (i) => { const f = i === cb ? S.file : B[i].file; return f ? path.basename(f) : '[No Name]'; };
const bufDirty = (i) => (i === cb ? S.dirty : B[i].dirty);
const anyDirty = () => B.some((_, i) => bufDirty(i));
function bufStash() { for (const k of BF) B[cb][k] = S[k]; }
function bufGo(i) {
  if (i < 0 || i >= B.length || i === cb) return;
  bufStash(); alt = cb; cb = i;
  for (const k of BF) S[k] = B[i][k];
  S.mode = 'NORMAL'; S.op = null; S.count = ''; S.pend = '';
  clamp();
}
function resetBuf() {
  S.lines = ['']; S.cy = S.cx = S.want = S.top = S.left = 0;
  S.file = null; S.dirty = false; S.undo = []; S.redo = [];
}
function newBuf() { bufStash(); B.push({}); alt = cb; cb = B.length - 1; resetBuf(); S.mode = 'NORMAL'; }
function openFile(f) {
  const i = B.findIndex((b, j) => sameFile(j === cb ? S.file : b.file, f));
  if (i >= 0) { bufGo(i); return; }
  if (!S.file && !S.dirty && S.lines.length === 1 && S.lines[0] === '') { load(f); return; }
  newBuf(); load(f);
}
function bufDelete(force) {
  if (S.dirty && !force) { S.msg = 'No write since last change (add ! to override)'; return; }
  if (B.length === 1) { resetBuf(); return; }
  B.splice(cb, 1);
  if (alt === cb) alt = -1; else if (alt > cb) alt--;
  cb = Math.min(cb, B.length - 1);
  for (const k of BF) S[k] = B[cb][k];
  S.mode = 'NORMAL'; clamp();
}
function saveAll() {
  bufStash();
  let n = 0;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (!b.dirty) continue;
    if (!b.file) { S.msg = `Buffer ${i + 1} has no file name`; return false; }
    try { fs.writeFileSync(b.file, b.lines.join('\n') + '\n'); b.dirty = false; n++; }
    catch (e) { S.msg = 'Write failed: ' + e.message; return false; }
  }
  S.dirty = B[cb].dirty;
  S.msg = `${n} buffer(s) written`;
  return true;
}
function bufLine(C) {
  const items = B.map((_, i) => ({ t: ` ${i + 1}:${bufName(i)}${bufDirty(i) ? '+' : ''} `, cur: i === cb }));
  const width = (a, b) => items.slice(a, b + 1).reduce((n, it) => n + it.t.length, 0);
  let s = 0, used = 0, o = '';
  while (s < cb && width(s, cb) > C) s++;
  for (let i = s; i < items.length; i++) {
    if (used + items[i].t.length > C) break;
    used += items[i].t.length;
    o += (items[i].cur ? '\x1b[7m' : '\x1b[90m') + items[i].t + '\x1b[0m';
  }
  return o;
}

// ---------------------------------------------------------------- ranges and PowerShell filters
// Scripts started from minivim can read these to know what is being edited.
function menv() {
  return { ...process.env, MINIVIM_FILE: S.file ? path.resolve(S.file) : '', MINIVIM_LINE: String(S.cy + 1), MINIVIM_COL: String(S.cx + 1) };
}

function parseRange(c) {
  const last = S.lines.length - 1;
  const clampY = (n) => Math.max(0, Math.min(last, n));
  const addr = (s) => {
    if (s === '.') return S.cy;
    if (s === '$') return last;
    if (s === "'<") return S.vs ? clampY(S.vs.y1) : S.cy;
    if (s === "'>") return S.vs ? clampY(S.vs.y2) : S.cy;
    return clampY(parseInt(s, 10) - 1);
  };
  if (c[0] === '%') return { has: true, y1: 0, y2: last, rest: c.slice(1) };
  const m = /^('<|'>|\.|\$|\d+)(?:,('<|'>|\.|\$|\d+))?/.exec(c);
  if (!m) return { has: false, rest: c };
  const a = addr(m[1]), b = m[2] ? addr(m[2]) : a;
  return { has: true, y1: Math.min(a, b), y2: Math.max(a, b), rest: c.slice(m[0].length) };
}

// If the command does not mention $input itself, the range is piped into it.
const wrapIn = (cmd) => (/\$input\b/i.test(cmd) ? cmd : '$input | ' + cmd);

function runSync(cmd, input) {
  const ps = psExe();
  const opts = { input, cwd: T.cwd, env: menv(), encoding: 'utf8', timeout: 30000, maxBuffer: 64 * 1024 * 1024 };
  if (!ps) return spawnSync(cmd, { ...opts, shell: true });
  const enc = process.platform === 'win32'
    ? 'try{[Console]::InputEncoding=[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)}catch{};' : '';
  return spawnSync(ps, ['-NoLogo', '-NoProfile', ...EP, '-Command', enc + cmd], opts);
}

// Success only when the exit code is 0 and nothing was written to stderr.
function syncResult(r) {
  if (r.error) return { err: r.error.code === 'ETIMEDOUT' ? 'Timed out after 30 s' : r.error.message };
  const e = (r.stderr || '').trim();
  if (r.status !== 0 || e) return { err: e || `exit ${r.status}` };
  let t = (r.stdout || '').replace(/\r\n/g, '\n').replace(/\t/g, '  ');
  if (t.endsWith('\n')) t = t.slice(0, -1);
  return { lines: t === '' && !(r.stdout || '').length ? [] : t.split('\n') };
}

function showErr(err) {
  T.open = true;
  for (const l of err.split(/\r?\n/)) T.lines.push(l);
  S.msg = err.split(/\r?\n/)[0].slice(0, 200);
}

function filterRange(y1, y2, cmd) {
  if (!cmd) { S.msg = 'Usage: :[range]!command   ($input holds the lines)'; return; }
  S.msg = 'running...'; render();
  const res = syncResult(runSync(wrapIn(cmd), S.lines.slice(y1, y2 + 1).join('\n') + '\n'));
  if (res.err) { showErr(res.err); return; }
  snap();
  S.lines = S.lines.slice(0, y1).concat(res.lines, S.lines.slice(y2 + 1));
  if (!S.lines.length) S.lines = [''];
  S.cy = Math.min(y1, S.lines.length - 1); S.cx = 0; S.want = 0; clamp();
  S.msg = `${y2 - y1 + 1} line(s) filtered, ${res.lines.length} line(s) returned`;
}

// :[range]w !cmd - send lines to a command, show its output in the pane, leave the buffer alone.
function sendRange(y1, y2, cmd) {
  if (!cmd) { S.msg = 'Usage: :[range]w !command'; return; }
  S.msg = 'running...'; render();
  const res = syncResult(runSync(wrapIn(cmd), S.lines.slice(y1, y2 + 1).join('\n') + '\n'));
  if (res.err) { showErr(res.err); return; }
  T.open = true; T.partial = false;
  T.lines.push(`${shortCwd()}$ w !${cmd}`);
  for (const l of res.lines) T.lines.push(l);
  S.msg = `${res.lines.length} line(s) of output in the pane`;
}

function insertBelow(y, lines) {
  if (!lines.length) { S.msg = 'Nothing to insert'; return; }
  snap();
  S.lines = S.lines.slice(0, y + 1).concat(lines, S.lines.slice(y + 1));
  S.cy = y + 1; S.cx = firstNB(); clamp(); S.want = S.cx;
  S.msg = `${lines.length} line(s) inserted`;
}

// :r !cmd - insert command output below the cursor line (no stdin).
function readCmd(y, cmd) {
  if (!cmd) { S.msg = 'Usage: :r !command'; return; }
  S.msg = 'running...'; render();
  const res = syncResult(runSync(cmd, ''));
  if (res.err) { showErr(res.err); return; }
  insertBelow(y, res.lines);
}

function readFile(y, f) {
  if (!f) { S.msg = 'Usage: :r file'; return; }
  try { insertBelow(y, fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\t/g, '  ').replace(/\n$/, '').split('\n')); }
  catch (e) { S.msg = 'Cannot read ' + f; }
}

// ---------------------------------------------------------------- motions
function nextWord(y, x) {
  let l = S.lines[y];
  if (x < l.length) { const k = cls(l[x]); if (k) while (x < l.length && cls(l[x]) === k) x++; }
  for (;;) {
    while (x < l.length && cls(l[x]) === 0) x++;
    if (x < l.length) return [y, x];
    if (y >= S.lines.length - 1) return [y, l.length];
    y++; x = 0; l = S.lines[y];
    if (l.length === 0) return [y, 0];
  }
}

function prevWord(y, x) {
  for (;;) {
    if (x === 0) {
      if (y === 0) return [0, 0];
      y--; x = S.lines[y].length;
      if (x === 0) return [y, 0];
    }
    x--;
    const l = S.lines[y];
    if (cls(l[x]) === 0) continue;
    const k = cls(l[x]);
    while (x > 0 && cls(l[x - 1]) === k) x--;
    return [y, x];
  }
}

function endWord(y, x) {
  const L = S.lines; x++;
  for (;;) {
    const l = L[y];
    while (x < l.length && cls(l[x]) === 0) x++;
    if (x < l.length) break;
    if (y >= L.length - 1) return [y, Math.max(0, l.length - 1)];
    y++; x = 0;
  }
  const l = L[y], k = cls(l[x]);
  while (x + 1 < l.length && cls(l[x + 1]) === k) x++;
  return [y, x];
}

// returns {y, x, lw?, inc?, keep?} or null
function motion(k, n, raw) {
  const y = S.cy, x = S.cx, L = S.lines;
  switch (k) {
    case 'h': case 'LEFT': case 'BS': return { y, x: Math.max(0, x - n) };
    case 'l': case 'RIGHT': case ' ': return { y, x: Math.min(L[y].length, x + n) };
    case 'j': case 'DOWN': return { y: Math.min(L.length - 1, y + n), x: S.want, lw: true, keep: true };
    case 'k': case 'UP': return { y: Math.max(0, y - n), x: S.want, lw: true, keep: true };
    case 'C-d': return { y: Math.min(L.length - 1, y + 10), x: S.want, lw: true, keep: true };
    case 'C-u': return { y: Math.max(0, y - 10), x: S.want, lw: true, keep: true };
    case '0': case 'HOME': return { y, x: 0 };
    case '^': return { y, x: L[y].search(/\S|$/) };
    case '$': case 'END': return { y, x: Math.max(0, L[y].length - 1), inc: true };
    case 'w': { let p = [y, x]; for (let i = 0; i < n; i++) p = nextWord(p[0], p[1]); return { y: p[0], x: p[1] }; }
    case 'b': { let p = [y, x]; for (let i = 0; i < n; i++) p = prevWord(p[0], p[1]); return { y: p[0], x: p[1] }; }
    case 'e': { let p = [y, x]; for (let i = 0; i < n; i++) p = endWord(p[0], p[1]); return { y: p[0], x: p[1], inc: true }; }
    case 'G': { const ty = raw ? Math.min(L.length - 1, raw - 1) : L.length - 1; return { y: ty, x: L[ty].search(/\S|$/), lw: true }; }
    case 'gg': { const ty = raw ? Math.min(L.length - 1, raw - 1) : 0; return { y: ty, x: L[ty].search(/\S|$/), lw: true }; }
    case 'n': case 'N': return null;
    default: return null;
  }
}

function move(k, n, raw) {
  const m = motion(k, n, raw);
  if (!m) return false;
  S.cy = m.y; S.cx = m.keep ? S.want : m.x;
  clamp();
  if (!m.keep) S.want = S.cx;
  return true;
}

// ---------------------------------------------------------------- ranges / operators
function order(a, b) { return (a.y < b.y || (a.y === b.y && a.x <= b.x)) ? [a, b] : [b, a]; }

function getRange(a, b, lw, inc) {
  [a, b] = order(a, b);
  if (lw) return { y1: a.y, y2: b.y, lw: true };
  return { y1: a.y, x1: a.x, y2: b.y, x2: b.x + (inc ? 1 : 0) };
}

function extract(r) {
  const L = S.lines;
  if (r.lw) return L.slice(r.y1, r.y2 + 1);
  if (r.y1 === r.y2) return [L[r.y1].slice(r.x1, r.x2)];
  const o = [L[r.y1].slice(r.x1)];
  for (let i = r.y1 + 1; i < r.y2; i++) o.push(L[i]);
  o.push(L[r.y2].slice(0, r.x2));
  return o;
}

function doOp(op, r) {
  S.reg = { text: extract(r), lw: !!r.lw };
  if (op === 'y') {
    S.cy = r.y1; if (!r.lw) S.cx = r.x1;
    S.msg = S.reg.text.length > 2 ? `${S.reg.text.length} lines yanked` : '';
    clamp(); return;
  }
  snap();
  const L = S.lines;
  if (r.lw) {
    if (op === 'c') {
      L.splice(r.y1, r.y2 - r.y1 + 1, '');
      S.cy = r.y1; S.cx = 0;
    } else {
      L.splice(r.y1, r.y2 - r.y1 + 1);
      if (!L.length) L.push('');
      S.cy = Math.min(r.y1, L.length - 1); S.cx = firstNB();
    }
  } else {
    const tail = L[r.y2].slice(r.x2);
    L.splice(r.y1, r.y2 - r.y1 + 1, L[r.y1].slice(0, r.x1) + tail);
    S.cy = r.y1; S.cx = r.x1;
  }
  if (op === 'c') enterInsert();
  clamp(); S.want = S.cx;
}

function paste(after) {
  const r = S.reg;
  if (!r.text.length) return;
  snap();
  const L = S.lines;
  if (r.lw) {
    const at = after ? S.cy + 1 : S.cy;
    L.splice(at, 0, ...r.text);
    S.cy = at; S.cx = firstNB();
  } else {
    const l = L[S.cy];
    const at = after && l.length ? S.cx + 1 : S.cx;
    const head = l.slice(0, at), tail = l.slice(at);
    if (r.text.length === 1) {
      L[S.cy] = head + r.text[0] + tail;
      S.cx = at + r.text[0].length - 1;
    } else {
      const t = r.text;
      L.splice(S.cy, 1, head + t[0], ...t.slice(1, -1), t[t.length - 1] + tail);
      S.cy++; S.cx = 0;
    }
  }
  clamp(); S.want = S.cx;
}

// ---------------------------------------------------------------- search
function findNext(dir) {
  const p = S.search;
  if (!p) return;
  const L = S.lines, total = L.length;
  for (let i = 0; i <= total; i++) {
    const y = (((S.cy + dir * i) % total) + total) % total;
    const l = L[y];
    let x;
    if (dir > 0) x = l.indexOf(p, i === 0 ? S.cx + 1 : 0);
    else x = i === 0 ? (S.cx > 0 ? l.lastIndexOf(p, S.cx - 1) : -1) : l.lastIndexOf(p);
    if (x >= 0) { S.cy = y; S.cx = x; S.want = x; return; }
  }
  S.msg = 'Pattern not found: ' + p;
}

// ---------------------------------------------------------------- terminal pane
function feed(d) {
  const s = d.toString().replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r/g, '').replace(/\t/g, '    ');
  const endsNL = s.endsWith('\n');
  const parts = s.split('\n');
  if (endsNL) parts.pop();
  parts.forEach((p, i) => {
    if (i === 0 && T.partial) T.lines[T.lines.length - 1] += p;
    else T.lines.push(p);
  });
  if (parts.length) T.partial = !endsNL;
  if (T.lines.length > 2000) T.lines.splice(0, T.lines.length - 2000);
  render();
}

function killProc() {
  const p = T.proc;
  if (!p) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(p.pid), '/T', '/F']);
  else p.kill('SIGINT');
}

function termRun(cmd) {
  T.partial = false;
  T.lines.push(`${shortCwd()}$ ${cmd}`);
  if (!cmd.trim()) return;
  const m = cmd.trim().match(/^(?:cd|sl|set-location)(?:\s+(.*))?$/i);
  if (m) {
    const d = path.resolve(T.cwd, (m[1] || os.homedir()).replace(/^["']|["']$/g, ''));
    try { if (fs.statSync(d).isDirectory()) T.cwd = d; else T.lines.push('cd: not a directory'); }
    catch { T.lines.push('cd: no such directory'); }
    return;
  }
  if (cmd.trim() === 'clear' || cmd.trim() === 'cls') { T.lines = []; return; }
  const ps = psExe();
  const p = ps
    ? spawn(ps, ['-NoLogo', '-NoProfile', ...EP, '-Command', cmd], { cwd: T.cwd, env: menv() })
    : spawn(cmd, { shell: true, cwd: T.cwd, env: menv() });
  attach(p);
}

// PowerShell executable: pwsh (7+) preferred, then Windows PowerShell; '' when none is found.
const EP = process.platform === 'win32' ? ['-ExecutionPolicy', 'Bypass'] : [];
let PS = null;
function psExe() {
  if (PS !== null) return PS;
  PS = '';
  for (const e of ['pwsh', 'powershell']) {
    try {
      const r = spawnSync(e, ['-NoLogo', '-NoProfile', '-Command', '1'], { stdio: 'ignore', timeout: 10000 });
      if (r.status === 0) { PS = e; break; }
    } catch {}
  }
  return PS;
}

function attach(p, onDone) {
  T.proc = p;
  p.stdout.on('data', feed);
  p.stderr.on('data', feed);
  p.on('error', (e) => { T.lines.push('error: ' + e.message); T.proc = null; render(); });
  p.on('close', (code) => {
    if (code) T.lines.push(`[exit ${code}]`);
    T.partial = false; T.proc = null;
    scanErrors();
    render();
  });
}

function splitArgs(s) {
  return (s || '').match(/"[^"]*"|\S+/g)?.map((a) => a.replace(/^"|"$/g, '')) || [];
}

// Run the current buffer as a script. Saves first; output lands in the terminal pane.
function runFile(args) {
  if (!S.file) { S.msg = 'No file name (use :w name.ps1 first)'; return; }
  if (T.proc) { S.msg = 'A process is still running (focus the pane, Ctrl-C)'; return; }
  const ps = psExe();
  if (!ps) { S.msg = 'PowerShell (pwsh or powershell) not found on PATH'; return; }
  if (S.dirty && !save(S.file)) return;
  const abs = path.resolve(S.file);
  T.open = true; T.partial = false;
  T.lines.push(`${shortCwd()}$ run ${S.file}${args ? ' ' + args : ''}`);
  T.runStart = T.lines.length;
  S.errs = []; S.errI = -1;
  attach(spawn(ps, ['-NoLogo', '-NoProfile', ...EP, '-File', abs, ...splitArgs(args)], { cwd: T.cwd, env: menv() }));
}

// PowerShell reports locations as "At <file>:<line> char:<col>".
function scanErrors() {
  if (T.runStart == null) return;
  const re = /At (.+?):(\d+) char:(\d+)/;
  S.errs = [];
  for (const l of T.lines.slice(T.runStart)) {
    const m = re.exec(l);
    if (m) S.errs.push({ file: m[1], y: +m[2] - 1, x: +m[3] - 1 });
  }
  T.runStart = null; S.errI = -1;
  S.msg = S.errs.length ? `${S.errs.length} error location(s) - :cn / :cp to jump` : '';
}

function sameFile(a, b) {
  const n = (f) => (process.platform === 'win32' ? path.resolve(f).toLowerCase() : path.resolve(f));
  return !!a && !!b && n(a) === n(b);
}

function errJump(d) {
  if (!S.errs.length) { S.msg = 'No error locations'; return; }
  S.errI = (S.errI + d + S.errs.length) % S.errs.length;
  const e = S.errs[S.errI];
  if (!sameFile(e.file, S.file)) {
    if (!fs.existsSync(e.file)) { S.msg = 'Cannot open ' + e.file; return; }
    openFile(e.file);
  }
  S.cy = Math.min(e.y, S.lines.length - 1); S.cx = e.x;
  clamp(); S.want = S.cx;
  S.msg = `error ${S.errI + 1}/${S.errs.length}`;
}

function termKey(k) {
  switch (k) {
    case 'ESC': T.focus = false; return;
    case 'ENTER': {
      const c = T.input; T.input = ''; T.cur = 0;
      if (T.proc) { T.lines.push('> ' + c); try { T.proc.stdin.write(c + '\n'); } catch {} return; }
      if (c.trim()) T.hist.push(c);
      T.hi = T.hist.length;
      termRun(c); return;
    }
    case 'BS': if (T.cur > 0) { T.input = T.input.slice(0, T.cur - 1) + T.input.slice(T.cur); T.cur--; } return;
    case 'DEL': T.input = T.input.slice(0, T.cur) + T.input.slice(T.cur + 1); return;
    case 'LEFT': T.cur = Math.max(0, T.cur - 1); return;
    case 'RIGHT': T.cur = Math.min(T.input.length, T.cur + 1); return;
    case 'HOME': case 'C-a': T.cur = 0; return;
    case 'END': case 'C-e': T.cur = T.input.length; return;
    case 'UP': if (T.hi > 0) { T.hi--; T.input = T.hist[T.hi]; T.cur = T.input.length; } return;
    case 'DOWN':
      if (T.hi < T.hist.length - 1) { T.hi++; T.input = T.hist[T.hi]; }
      else { T.hi = T.hist.length; T.input = ''; }
      T.cur = T.input.length; return;
    case 'C-c': if (T.proc) killProc(); else { T.input = ''; T.cur = 0; } return;
    case 'C-l': T.lines = []; return;
    case 'C-u': T.input = T.input.slice(T.cur); T.cur = 0; return;
    case 'TAB': T.input = T.input.slice(0, T.cur) + '  ' + T.input.slice(T.cur); T.cur += 2; return;
    default:
      if (k.length >= 1 && !/^[A-Z]{2,}$/.test(k) && !k.startsWith('C-')) {
        T.input = T.input.slice(0, T.cur) + k + T.input.slice(T.cur); T.cur += k.length;
      }
  }
}

// ---------------------------------------------------------------- ex commands
function quit() { process.exit(0); }

function exCmd(c) {
  c = c.trim();
  if (!c) return;
  const rp = parseRange(c);
  c = rp.rest.trim();
  if (rp.has && !c) { S.cy = rp.y2; S.cx = firstNB(); clamp(); S.want = S.cx; return; }
  if (c[0] === '!') {
    const cmd = c.slice(1).trim();
    if (rp.has) { filterRange(rp.y1, rp.y2, cmd); return; }
    T.open = true; T.focus = true; termRun(cmd); return;
  }
  const [name, ...rest] = c.split(/\s+/);
  const arg = rest.join(' ');
  const y1 = rp.has ? rp.y1 : 0, y2 = rp.has ? rp.y2 : S.lines.length - 1;
  switch (name) {
    case 'w': case 'w!':
      if (arg.startsWith('!')) { sendRange(y1, y2, arg.slice(1).trim()); return; }
      save(arg || S.file); return;
    case 'wa': case 'wall': saveAll(); return;
    case 'r': case 'read':
      if (arg.startsWith('!')) readCmd(rp.has ? rp.y2 : S.cy, arg.slice(1).trim());
      else readFile(rp.has ? rp.y2 : S.cy, arg);
      return;
    case 'q': case 'qa': case 'qall':
      if (anyDirty()) { S.msg = 'No write since last change (add ! to override)'; return; }
      quit(); return;
    case 'q!': case 'qa!': quit(); return;
    case 'wq': case 'x':
      if (save(arg || S.file)) {
        if (anyDirty()) { S.msg = 'Other buffers have unsaved changes (:wqa saves all)'; return; }
        quit();
      }
      return;
    case 'wqa': case 'xa': if (saveAll()) quit(); return;
    case 'e': case 'edit':
      if (arg) openFile(arg); else S.msg = 'Usage: :e file';
      return;
    case 'e!': if (S.file) load(S.file); return;
    case 'enew': case 'new': newBuf(); return;
    case 'bn': case 'bnext': bufGo((cb + 1) % B.length); return;
    case 'bp': case 'bprev': case 'bN': bufGo((cb - 1 + B.length) % B.length); return;
    case 'b': case 'buffer': {
      let i = -1;
      if (arg === '#') i = alt;
      else if (/^\d+$/.test(arg)) i = parseInt(arg, 10) - 1;
      else if (arg) i = B.findIndex((_, j) => bufName(j).toLowerCase().includes(arg.toLowerCase()));
      if (i < 0 || i >= B.length) S.msg = 'No such buffer: ' + (arg || '(none)'); else bufGo(i);
      return;
    }
    case 'bd': case 'bdelete': bufDelete(false); return;
    case 'bd!': case 'bdelete!': bufDelete(true); return;
    case 'ls': case 'buffers': case 'files':
      S.msg = B.map((_, i) => `${i === cb ? '*' : ''}${i + 1}:${bufName(i)}${bufDirty(i) ? '+' : ''}`).join('  ');
      return;
    case 'term': case 'terminal':
      T.open = true; T.focus = true;
      if (arg) termRun(arg);
      return;
    case 'termclose': case 'tclose':
      T.open = false; T.focus = false; return;
    case 'run': runFile(arg); return;
    case 'cn': errJump(1); return;
    case 'cp': errJump(-1); return;
    case 'syntax': case 'syn': S.syn = arg === 'off' ? false : arg === 'on' ? true : null; return;
    case 'resize': {
      const n = parseInt(arg, 10);
      if (n > 2) T.h = n; return;
    }
    default:
      if (/^\d+$/.test(name)) { S.cy = Math.max(0, Math.min(S.lines.length - 1, parseInt(name, 10) - 1)); S.cx = firstNB(); clamp(); return; }
      S.msg = 'Not an editor command: ' + c;
  }
}

// ---------------------------------------------------------------- mode handlers
function normalKey(k) {
  if (S.pend === 'r') {
    S.pend = '';
    if (k.length === 1) {
      const l = cur();
      if (S.cx < l.length) { snap(); S.lines[S.cy] = l.slice(0, S.cx) + k + l.slice(S.cx + 1); }
    }
    S.count = ''; return;
  }
  if (S.pend === 'g') {
    S.pend = '';
    if (k === 'g') k = 'gg';
    else if (k === 't' || k === 'T') { S.op = null; S.count = ''; bufGo(k === 't' ? (cb + 1) % B.length : (cb - 1 + B.length) % B.length); return; }
    else { S.op = null; S.count = ''; return; }
  }
  if (k === 'ESC') { S.op = null; S.count = ''; S.pend = ''; return; }
  if (/^[1-9]$/.test(k) || (k === '0' && S.count)) { S.count += k; return; }
  const raw = S.count ? parseInt(S.count, 10) : 0;
  const n = raw || 1;
  if (k === 'g') { S.pend = 'g'; return; }

  if (S.op) {
    const op = S.op, tot = S.opn * n;
    S.op = null; S.count = '';
    if (k === op) {
      const y2 = Math.min(S.lines.length - 1, S.cy + tot - 1);
      doOp(op, { y1: S.cy, y2, lw: true }); return;
    }
    let m;
    if (op === 'c' && k === 'w' && cls(cur()[S.cx] || ' ')) {
      let p = [S.cy, S.cx];
      for (let i = 0; i < tot; i++) p = endWord(p[0], i === 0 ? p[1] - 1 : p[1]);
      m = { y: p[0], x: p[1], inc: true };
    } else m = motion(k, tot, raw);
    if (!m) return;
    doOp(op, getRange({ y: S.cy, x: S.cx }, m, m.lw, m.inc));
    return;
  }

  S.count = '';
  switch (k) {
    case 'i': snap(); enterInsert(); return;
    case 'a': snap(); if (cur().length) S.cx++; enterInsert(); return;
    case 'I': snap(); S.cx = firstNB(); enterInsert(); return;
    case 'A': snap(); S.cx = cur().length; enterInsert(); return;
    case 'o': case 'O': {
      snap();
      const ind = cur().match(/^\s*/)[0];
      const at = k === 'o' ? S.cy + 1 : S.cy;
      S.lines.splice(at, 0, ind); S.cy = at; S.cx = ind.length;
      enterInsert(); return;
    }
    case 'x': case 'DEL':
      if (cur().length) doOp('d', { y1: S.cy, x1: S.cx, y2: S.cy, x2: Math.min(cur().length, S.cx + n) });
      return;
    case 'X':
      if (S.cx > 0) doOp('d', { y1: S.cy, x1: Math.max(0, S.cx - n), y2: S.cy, x2: S.cx });
      return;
    case 'D': doOp('d', { y1: S.cy, x1: S.cx, y2: S.cy, x2: cur().length }); return;
    case 'C': doOp('c', { y1: S.cy, x1: S.cx, y2: S.cy, x2: cur().length }); return;
    case 's': doOp('c', { y1: S.cy, x1: S.cx, y2: S.cy, x2: Math.min(cur().length, S.cx + n) }); return;
    case 'S': doOp('c', { y1: S.cy, y2: Math.min(S.lines.length - 1, S.cy + n - 1), lw: true }); return;
    case 'Y': doOp('y', { y1: S.cy, y2: Math.min(S.lines.length - 1, S.cy + n - 1), lw: true }); return;
    case 'd': case 'y': case 'c': S.op = k; S.opn = n; return;
    case 'p': paste(true); return;
    case 'P': paste(false); return;
    case 'u': undo(n); return;
    case 'C-r': redo(n); return;
    case 'r': S.pend = 'r'; return;
    case 'J':
      if (S.cy < S.lines.length - 1) {
        snap();
        const a = cur().replace(/\s+$/, ''), b = S.lines[S.cy + 1].trimStart();
        S.cx = a.length;
        S.lines.splice(S.cy, 2, a + (b ? ' ' : '') + b);
        clamp();
      }
      return;
    case 'v': case 'V': S.mode = 'VISUAL'; S.vline = k === 'V'; S.anchor = { y: S.cy, x: S.cx }; return;
    case ':': S.mode = 'COMMAND'; S.cmd = ''; return;
    case '/': S.mode = 'SEARCH'; S.cmd = ''; return;
    case 'n': findNext(1); return;
    case 'N': findNext(-1); return;
    case 'C-c': S.msg = 'Type :q to quit'; return;
    default: move(k, n, raw);
  }
}

function insertKey(k) {
  const l = cur();
  switch (k) {
    case 'ESC': S.mode = 'NORMAL'; S.cx = Math.max(0, S.cx - 1); clamp(); S.want = S.cx; return;
    case 'ENTER': {
      const ind = l.match(/^\s*/)[0];
      S.lines.splice(S.cy, 1, l.slice(0, S.cx), ind + l.slice(S.cx));
      S.cy++; S.cx = ind.length; return;
    }
    case 'BS':
      if (S.cx > 0) { S.lines[S.cy] = l.slice(0, S.cx - 1) + l.slice(S.cx); S.cx--; }
      else if (S.cy > 0) {
        const p = S.lines[S.cy - 1];
        S.lines.splice(S.cy - 1, 2, p + l); S.cy--; S.cx = p.length;
      }
      return;
    case 'DEL':
      if (S.cx < l.length) S.lines[S.cy] = l.slice(0, S.cx) + l.slice(S.cx + 1);
      else if (S.cy < S.lines.length - 1) S.lines.splice(S.cy, 2, l + S.lines[S.cy + 1]);
      return;
    case 'TAB': S.lines[S.cy] = l.slice(0, S.cx) + '  ' + l.slice(S.cx); S.cx += 2; return;
    case 'LEFT': S.cx = Math.max(0, S.cx - 1); return;
    case 'RIGHT': S.cx = Math.min(l.length, S.cx + 1); return;
    case 'UP': S.cy = Math.max(0, S.cy - 1); clamp(); return;
    case 'DOWN': S.cy = Math.min(S.lines.length - 1, S.cy + 1); clamp(); return;
    case 'HOME': S.cx = 0; return;
    case 'END': S.cx = l.length; return;
    default:
      if (!/^[A-Z]{2,}$/.test(k) && !k.startsWith('C-')) {
        S.lines[S.cy] = l.slice(0, S.cx) + k + l.slice(S.cx); S.cx += k.length;
      }
  }
}

function visualKey(k) {
  if (S.pend === 'g') { S.pend = ''; if (k === 'g') k = 'gg'; else return; }
  if (k === 'ESC' || (k === 'v' && !S.vline) || (k === 'V' && S.vline)) { S.mode = 'NORMAL'; S.count = ''; return; }
  if (k === 'v') { S.vline = false; return; }
  if (k === 'V') { S.vline = true; return; }
  if (/^[1-9]$/.test(k) || (k === '0' && S.count)) { S.count += k; return; }
  if (k === 'g') { S.pend = 'g'; return; }
  const raw = S.count ? parseInt(S.count, 10) : 0;
  const n = raw || 1;
  S.count = '';
  if (k.length === 1 && 'dyxcDXY'.includes(k)) {
    const lw = S.vline || /[DXY]/.test(k);
    const r = getRange(S.anchor, { y: S.cy, x: S.cx }, lw, true);
    S.mode = 'NORMAL';
    doOp(k === 'x' || k === 'D' || k === 'X' ? 'd' : k.toLowerCase(), r);
    return;
  }
  if (k === 'o') {
    const t = { y: S.cy, x: S.cx };
    S.cy = S.anchor.y; S.cx = S.anchor.x; S.anchor = t; return;
  }
  if (k === ':') {
    const [a, b] = order(S.anchor, { y: S.cy, x: S.cx });
    S.vs = { y1: a.y, y2: b.y };
    S.mode = 'COMMAND'; S.cmd = "'<,'>"; return;
  }
  move(k, n, raw);
}

function cmdKey(k) {
  if (k === 'ESC' || (k === 'BS' && !S.cmd)) { S.mode = 'NORMAL'; S.cmd = ''; return; }
  if (k === 'BS') { S.cmd = S.cmd.slice(0, -1); return; }
  if (k === 'ENTER') {
    const c = S.cmd, m = S.mode;
    S.cmd = ''; S.mode = 'NORMAL';
    if (m === 'SEARCH') { if (c) S.search = c; findNext(1); } else exCmd(c);
    return;
  }
  if (k.length >= 1 && !/^[A-Z]{2,}$/.test(k) && !k.startsWith('C-')) S.cmd += k;
}

function onKey(k) {
  if (S.mode !== 'COMMAND' && S.mode !== 'SEARCH') S.msg = '';
  if (k === 'F5') { if (S.mode === 'INSERT') { S.mode = 'NORMAL'; clamp(); } runFile(''); return; }
  if (k === 'C-w') { if (T.open) T.focus = !T.focus; else S.msg = 'No terminal open (:term)'; return; }
  if (T.focus && T.open) return termKey(k);
  switch (S.mode) {
    case 'NORMAL': return normalKey(k);
    case 'INSERT': return insertKey(k);
    case 'VISUAL': return visualKey(k);
    default: return cmdKey(k);
  }
}

// ---------------------------------------------------------------- input parsing
function parseKeys(s) {
  const ks = [];
  const map = { A: 'UP', B: 'DOWN', C: 'RIGHT', D: 'LEFT', H: 'HOME', F: 'END', '3~': 'DEL', '1~': 'HOME', '4~': 'END', '7~': 'HOME', '8~': 'END', '15~': 'F5' };
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === '\x1b') {
      if (s[i + 1] === '[' || s[i + 1] === 'O') {
        let j = i + 2;
        while (j < s.length && !/[A-Za-z~]/.test(s[j])) j++;
        const seq = s.slice(i + 2, j + 1);
        i = j + 1;
        ks.push(map[seq] || 'UNKNOWN');
        continue;
      }
      ks.push('ESC'); i++; continue;
    }
    const code = c.charCodeAt(0);
    if (code === 13 || code === 10) ks.push('ENTER');
    else if (code === 127 || code === 8) ks.push('BS');
    else if (code === 9) ks.push('TAB');
    else if (code < 32) ks.push('C-' + String.fromCharCode(code + 96));
    else { const ch = String.fromCodePoint(s.codePointAt(i)); ks.push(ch); i += ch.length; continue; }
    i++;
  }
  return ks;
}

// ---------------------------------------------------------------- rendering
function inSel(y, x) {
  const [a, b] = order(S.anchor, { y: S.cy, x: S.cx });
  if (y < a.y || y > b.y) return false;
  if (S.vline) return true;
  if (y === a.y && x < a.x) return false;
  if (y === b.y && x > b.x) return false;
  return true;
}

const PS_KW = new Set(['if', 'elseif', 'else', 'foreach', 'for', 'while', 'do', 'until', 'switch', 'function', 'filter',
  'param', 'begin', 'process', 'end', 'return', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'trap', 'in',
  'class', 'enum', 'using', 'exit', 'workflow']);
const C_GRAY = '\x1b[90m', C_GREEN = '\x1b[32m', C_CYAN = '\x1b[36m', C_YELLOW = '\x1b[33m';
const C_MAGENTA = '\x1b[35m', C_BLUE = '\x1b[94m', C_RED = '\x1b[31m';

// Per-character colour codes for one PowerShell line; inBlock carries <# ... #> state across lines.
function psColors(line, inBlock) {
  const col = new Array(line.length).fill('');
  let i = 0;
  while (i < line.length) {
    if (inBlock) {
      const e = line.indexOf('#>', i);
      const to = e < 0 ? line.length : e + 2;
      col.fill(C_GRAY, i, to); i = to;
      if (e >= 0) inBlock = false;
      continue;
    }
    const c = line[i], rest = line.slice(i);
    if (c === '<' && line[i + 1] === '#') { col.fill(C_GRAY, i, i + 2); i += 2; inBlock = true; continue; }
    if (c === '#') { col.fill(C_GRAY, i); break; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < line.length) {
        if (c === '"' && line[j] === '`') { j += 2; continue; }
        if (line[j] === c) { if (c === "'" && line[j + 1] === "'") { j += 2; continue; } break; }
        j++;
      }
      col.fill(C_GREEN, i, Math.min(line.length, j + 1)); i = j + 1; continue;
    }
    if (c === '$') {
      const m = /^\$(?:\{[^}]*\}|[\w:?^$]+)/.exec(rest);
      if (m) { col.fill(C_CYAN, i, i + m[0].length); i += m[0].length; continue; }
    }
    if (/[A-Za-z]/.test(c) && (i === 0 || !/[\w\-$]/.test(line[i - 1]))) {
      let m = /^[A-Za-z]\w*(?:-[A-Za-z]\w*)+/.exec(rest);
      if (m) { col.fill(C_YELLOW, i, i + m[0].length); i += m[0].length; continue; }
      m = /^[A-Za-z]\w*/.exec(rest);
      if (PS_KW.has(m[0].toLowerCase())) col.fill(C_MAGENTA, i, i + m[0].length);
      i += m[0].length; continue;
    }
    if (c === '-' && /[A-Za-z]/.test(line[i + 1] || '') && (i === 0 || /[\s(]/.test(line[i - 1]))) {
      const m = /^-\w+/.exec(rest);
      col.fill(C_BLUE, i, i + m[0].length); i += m[0].length; continue;
    }
    if (/\d/.test(c) && !/\w/.test(line[i - 1] || '')) {
      const m = /^\d[\d.]*/.exec(rest);
      col.fill(C_RED, i, i + m[0].length); i += m[0].length; continue;
    }
    i++;
  }
  return { col, inBlock };
}

// Compose syntax colours with the visual-mode selection (inverse video).
function paint(y, seg, cols) {
  let o = '', prev = '';
  for (let j = 0; j < seg.length; j++) {
    const x = S.left + j;
    const code = (S.mode === 'VISUAL' && inSel(y, x) ? '\x1b[7m' : '') + (cols[x] || '');
    if (code !== prev) { o += '\x1b[0m' + code; prev = code; }
    o += seg[j];
  }
  return o + (prev ? '\x1b[0m' : '');
}

function render() {
  const R = out.rows || 24, C = out.columns || 80;
  const th = T.open ? Math.max(3, Math.min(T.h, R - 6)) : 0;
  const bl = B.length > 1 ? 1 : 0;
  const eh = Math.max(1, R - 2 - bl - (T.open ? th + 1 : 0));
  clamp();

  const gw = String(S.lines.length).length + 1;
  const tw = Math.max(1, C - gw);
  if (S.cy < S.top) S.top = S.cy;
  if (S.cy >= S.top + eh) S.top = S.cy - eh + 1;
  if (S.cx < S.left) S.left = S.cx;
  if (S.cx >= S.left + tw) S.left = S.cx - tw + 1;

  const rows = [];
  if (bl) rows.push(bufLine(C));
  const syn = S.syn === null ? /\.(ps1|psm1|psd1)$/i.test(S.file || '') : S.syn;
  let blk = false;
  if (syn && S.lines.length <= 5000) for (let y = 0; y < S.top; y++) blk = psColors(S.lines[y], blk).inBlock;
  for (let i = 0; i < eh; i++) {
    const y = S.top + i;
    if (y >= S.lines.length) { rows.push('\x1b[34m~\x1b[0m'); continue; }
    const num = String(y + 1).padStart(gw - 1) + ' ';
    const seg = S.lines[y].slice(S.left, S.left + tw);
    let cols = [];
    if (syn) { const r = psColors(S.lines[y], blk); cols = r.col; blk = r.inBlock; }
    rows.push('\x1b[90m' + num + '\x1b[0m' + paint(y, seg, cols));
  }

  let termCur = null;
  if (T.open) {
    const title = ` TERMINAL  ${T.cwd}${T.proc ? '  [running]' : ''}${T.focus ? '  (Esc: back to editor)' : '  (Ctrl-W: focus)'} `;
    rows.push('\x1b[7m' + (T.focus ? '\x1b[1m' : '') + title.slice(0, C).padEnd(C) + '\x1b[0m');
    const show = T.lines.slice(-(th - 1));
    while (show.length < th - 1) show.unshift('');
    for (const l of show) rows.push(l.slice(0, C));
    const prompt = T.proc ? '> ' : shortCwd() + '$ ';
    const full = prompt + T.input;
    const off = Math.max(0, prompt.length + T.cur - (C - 1));
    rows.push('\x1b[32m' + full.slice(off, off + C - 1).replace(prompt, '\x1b[32m' + prompt + '\x1b[0m') + '\x1b[0m');
    termCur = { r: eh + 1 + th + bl, c: prompt.length + T.cur - off + 1 };
  }

  const left = ` ${S.mode}${S.mode === 'VISUAL' && S.vline ? ' LINE' : ''}  [${cb + 1}/${B.length}] ${S.file || "[No Name]"}${S.dirty ? ' [+]' : ''}`;
  const right = `${S.count}${S.op || ''}  ${S.cy + 1}:${S.cx + 1}  ${Math.round(((S.cy + 1) / S.lines.length) * 100)}% `;
  rows.push('\x1b[7m' + (left + ' '.repeat(Math.max(1, C - left.length - right.length)) + right).slice(0, C) + '\x1b[0m');
  rows.push((S.mode === 'COMMAND' ? ':' + S.cmd : S.mode === 'SEARCH' ? '/' + S.cmd : S.msg).slice(0, C - 1));

  let cr, cc;
  if (T.focus && T.open) { cr = termCur.r; cc = termCur.c; }
  else if (S.mode === 'COMMAND' || S.mode === 'SEARCH') { cr = R; cc = Math.min(C, S.cmd.length + 2); }
  else { cr = S.cy - S.top + 1 + bl; cc = gw + S.cx - S.left + 1; }

  out.write('\x1b[?25l\x1b[H' + rows.map((r) => r + '\x1b[K').join('\r\n') + `\x1b[${cr};${Math.max(1, cc)}H\x1b[?25h`);
}

// ---------------------------------------------------------------- main
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try { if (T.proc) killProc(); } catch {}
  try { out.write('\x1b[0m\x1b[?25h\x1b[?1049l'); } catch {}
  try { inp.setRawMode(false); } catch {}
}

function start() {
  if (!inp.isTTY) { console.error('minivim needs an interactive terminal'); process.exit(1); }
  const files = process.argv.slice(2);
  if (files.length) { load(files[0]); for (const f of files.slice(1)) openFile(f); bufGo(0); }
  else S.msg = 'minivim - :q quit  :w save  F5/:run script  :%!cmd filter  :term  Ctrl-W focus';
  out.write('\x1b[?1049h');
  inp.setRawMode(true);
  inp.setEncoding('utf8');
  inp.resume();
  inp.on('data', (d) => {
    for (const k of parseKeys(d)) {
      try { onKey(k); } catch (e) { S.msg = 'Error: ' + e.message; }
    }
    render();
  });
  out.on('resize', render);
  process.on('exit', cleanup);
  process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });
  render();
}

start();
