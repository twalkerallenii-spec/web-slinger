/* Headless test harness ("emulator") for Web-Slinger.
 * Runs game.js with a stubbed DOM / 2D-canvas / Audio / gamepad and a no-op WebGL renderer,
 * using the REAL three.js for all math & scene objects. Catches init crashes and per-frame
 * runtime errors without a browser or GPU — the class of bug that has broken the game before.
 *
 * Run:  cd ~/spiderman && NODE_PATH=$PWD/node_modules node test/harness.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const THREE = require('three');

const W = 1280, H = 720;
let nowMs = 0;
const errors = [];
const warns = [];

// Capture console.error (frame() swallows exceptions and logs once) so we still see them.
const _err = console.error.bind(console);
console.error = (...a) => { errors.push(a.map(x => (x && x.stack) ? x.stack : String(x)).join(' ')); };
console.warn = (...a) => { warns.push(a.map(String).join(' ')); };

/* ---------- event mixin ---------- */
function withEvents(o) {
  o.__l = Object.create(null);
  o.addEventListener = (t, fn) => { (o.__l[t] || (o.__l[t] = [])).push(fn); };
  o.removeEventListener = (t, fn) => { if (o.__l[t]) o.__l[t] = o.__l[t].filter(f => f !== fn); };
  o.dispatchEvent = (e) => { (o.__l[e.type] || []).slice().forEach(fn => fn(e)); return true; };
  return o;
}

/* ---------- 2D canvas context stub ---------- */
function make2D(cv) {
  const grad = { addColorStop() {} };
  return {
    canvas: cv,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '', lineCap: '', lineJoin: '',
    textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
    fillRect() {}, strokeRect() {}, clearRect() {}, fillText() {}, strokeText() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, rect() {},
    quadraticCurveTo() {}, bezierCurveTo() {}, ellipse() {},
    stroke() {}, fill() {}, clip() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    setTransform() {}, resetTransform() {}, setLineDash() {}, getLineDash() { return []; },
    drawImage() {}, createLinearGradient() { return grad; }, createRadialGradient() { return grad; },
    createPattern() { return null; },
    getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(Math.max(1, (w | 0)) * Math.max(1, (h | 0)) * 4), width: w, height: h }; },
    putImageData() {}, createImageData(w, h) { return { data: new Uint8ClampedArray(Math.max(1, (w | 0)) * Math.max(1, (h | 0)) * 4) }; },
    measureText() { return { width: 10 }; },
  };
}

/* ---------- element stub ---------- */
function makeEl(tag, id) {
  const el = withEvents({
    tagName: (tag || 'div').toUpperCase(), id: id || '', nodeName: (tag || 'div').toUpperCase(),
    width: (tag === 'canvas' ? 300 : 0), height: (tag === 'canvas' ? 150 : 0),
    _text: '', _html: '', value: '', parentNode: null, children: [],
    style: new Proxy({}, { get: (t, k) => (k in t ? t[k] : ''), set: (t, k, v) => { t[k] = v; return true; } }),
    classList: (() => { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: (c, f) => { const on = f === undefined ? !s.has(c) : f; on ? s.add(c) : s.delete(c); return on; }, contains: c => s.has(c) }; })(),
    appendChild(c) { c.parentNode = el; el.children.push(c); return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); c.parentNode = null; return c; },
    remove() { if (el.parentNode) el.parentNode.removeChild(el); },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    getBoundingClientRect() { return { left: 0, top: 0, right: W, bottom: H, width: W, height: H, x: 0, y: 0 }; },
    requestPointerLock() { doc.pointerLockElement = el; if (doc.__l.pointerlockchange) doc.dispatchEvent({ type: 'pointerlockchange' }); },
    focus() {}, blur() {}, click() { el.dispatchEvent({ type: 'click', preventDefault() {}, button: 0 }); },
    getContext(kind) { if (kind === '2d') return el._2d || (el._2d = make2D(el)); return null; }, // WebGL comes from stubbed renderer, not here
  });
  Object.defineProperty(el, 'firstChild', { get: () => el.children[0] || null });
  Object.defineProperty(el, 'lastChild', { get: () => el.children[el.children.length - 1] || null });
  Object.defineProperty(el, 'textContent', { get: () => el._text, set: v => { el._text = String(v); } });
  Object.defineProperty(el, 'innerHTML', { get: () => el._html, set: v => { el._html = String(v); } });
  Object.defineProperty(el, 'childElementCount', { get: () => el.children.length });
  return el;
}

/* ---------- document ---------- */
const elementsById = {};
['c', 'loading', 'stats', 'hpfill', 'webfill', 'tok', 'toktot', 'kos', 'score', 'suit', 'speedo', 'speedbig',
 'alt', 'statelbl', 'obj', 'objtitle', 'objdist', 'minimap', 'combo', 'crosshair', 'toast', 'help',
 'start', 'goBtn', 'editor', 'edims', 'ecount', 'eSave', 'eExport', 'eImport', 'eClear'].forEach(id => {
  elementsById[id] = makeEl(id === 'c' || id === 'minimap' ? 'canvas' : 'div', id);
});
const doc = withEvents({
  pointerLockElement: null,
  getElementById: id => elementsById[id] || (elementsById[id] = makeEl('div', id)),
  querySelector: () => null, querySelectorAll: () => [],
  createElement: tag => makeEl(tag),
  createElementNS: (ns, tag) => makeEl(tag),
  exitPointerLock() { doc.pointerLockElement = null; if (doc.__l.pointerlockchange) doc.dispatchEvent({ type: 'pointerlockchange' }); },
  body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head'),
});

/* ---------- window / globals ---------- */
function SimplexNoiseStub() { this.noise2D = (x, y) => Math.sin(x * 0.7 + y * 1.3) * Math.cos(x * 0.13 - y * 0.29); this.noise3D = () => 0; }

class ImageStub {
  constructor() { this.width = 256; this.height = 256; this.onload = null; this.onerror = null; this._src = ''; }
  set src(v) { this._src = v; setImmediate(() => { try { this.onload && this.onload(); } catch (e) { errors.push('Image.onload: ' + (e.stack || e)); } }); }
  get src() { return this._src; }
}

function audioParam() { return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }; }
function audioNode() { return { connect() { return audioNode(); }, disconnect() {}, start() {}, stop() {}, gain: audioParam(), frequency: audioParam(), Q: audioParam(), type: '', buffer: null, loop: false, onended: null }; }
class AudioContextStub {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.destination = audioNode(); this.state = 'running'; }
  createGain() { return audioNode(); } createOscillator() { return audioNode(); } createBiquadFilter() { return audioNode(); }
  createBufferSource() { return audioNode(); } createBuffer(ch, len) { return { getChannelData: () => new Float32Array(Math.max(1, len | 0)) }; }
  createDynamicsCompressor() { return audioNode(); } createAnalyser() { return audioNode(); } resume() { return Promise.resolve(); }
}

let rafCb = null, rafId = 0;
const win = withEvents({
  innerWidth: W, innerHeight: H, devicePixelRatio: 1, THREE,
  SimplexNoise: SimplexNoiseStub,
  requestAnimationFrame: cb => { rafCb = cb; return ++rafId; },
  cancelAnimationFrame: () => { rafCb = null; },
  performance: { now: () => nowMs },
  AudioContext: AudioContextStub, webkitAudioContext: AudioContextStub,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
  navigator: { getGamepads: () => gamepads, userAgent: 'harness' },
  Image: ImageStub,
  prompt: () => null, alert() {}, confirm: () => false,
  Blob: class { constructor() {} }, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
  setTimeout, clearTimeout, setInterval, clearInterval, setImmediate,
});
win.window = win; win.document = doc; win.self = win; win.top = win;

/* gamepad state the test can populate */
let gamepads = [];

/* Expose everything game.js reads as a bare identifier onto the real global. */
Object.assign(global, {
  window: win, document: doc, navigator: win.navigator,
  innerWidth: W, innerHeight: H, devicePixelRatio: 1,
  requestAnimationFrame: win.requestAnimationFrame, cancelAnimationFrame: win.cancelAnimationFrame,
  addEventListener: win.addEventListener, removeEventListener: win.removeEventListener, dispatchEvent: win.dispatchEvent,
  performance: win.performance, AudioContext: AudioContextStub, webkitAudioContext: AudioContextStub,
  localStorage: win.localStorage, Image: ImageStub, prompt: win.prompt, alert: win.alert,
  Blob: win.Blob, URL: win.URL, THREE, SimplexNoise: SimplexNoiseStub,
  getComputedStyle: win.getComputedStyle, matchMedia: win.matchMedia,
});

/* ---------- no-op WebGL renderer (real three for everything else) ---------- */
const RealRenderer = THREE.WebGLRenderer;
THREE.WebGLRenderer = function StubRenderer(opts) {
  opts = opts || {};
  this.domElement = opts.canvas || makeEl('canvas');
  this.shadowMap = { enabled: false, type: 0 };
  this.xr = { enabled: false, addEventListener() {}, isPresenting: false };
  this.capabilities = { isWebGL2: true, getMaxAnisotropy: () => 16, maxTextureSize: 16384, precision: 'highp' };
  this.info = { render: {}, memory: {}, programs: [] };
  this.outputEncoding = 0; this.toneMapping = 0; this.toneMappingExposure = 1;
  this.setPixelRatio = () => {};
  this.setSize = () => {};
  this.setClearColor = () => {};
  this.setRenderTarget = () => {};
  this.getRenderTarget = () => null;
  this.getPixelRatio = () => 1;
  this.getContext = () => ({});
  this.compile = () => {};
  this.dispose = () => {};
  this.clear = () => {};
  this.render = () => { renderCount++; };
};
let renderCount = 0;

/* ---------- run the game ---------- */
const gamePath = path.join(__dirname, '..', 'game.js');
const code = fs.readFileSync(gamePath, 'utf8');

const result = { initOk: false, initError: null, goBtnListener: false, framesPre: 0, framesPost: 0, renderCount: 0 };

try {
  vm.runInThisContext(code, { filename: 'game.js' });
  result.initOk = true;
} catch (e) {
  result.initError = e.stack || String(e);
}

function tick(n) {
  for (let i = 0; i < n; i++) {
    nowMs += 16.7;
    if (rafCb) { const cb = rafCb; rafCb = null; try { cb(nowMs); } catch (e) { errors.push('rAF exception: ' + (e.stack || e)); } }
  }
}
function fireKey(type, key) { const e = { type, key, code: key, preventDefault() {}, stopPropagation() {} }; win.dispatchEvent(e); }
function fireMouse(type, target, btn) { const e = { type, button: btn || 0, movementX: 6, movementY: 3, clientX: W / 2, clientY: H / 2, preventDefault() {} }; (target || win).dispatchEvent(e); }

const S = () => (win.__wsState ? win.__wsState() : null);
const snaps = {};
const checks = [];
function check(name, cond, detail) { checks.push({ name, ok: !!cond, detail: detail || '' }); }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

if (result.initOk) {
  result.goBtnListener = !!(elementsById.goBtn.__l.click && elementsById.goBtn.__l.click.length);
  check('ENTER button has a click handler', result.goBtnListener);
  check('debug/state hook present', !!win.__wsState);

  tick(5);
  snaps.boot = S();
  check('city generated (>150 buildings)', snaps.boot && snaps.boot.buildings > 150, snaps.boot && ('buildings=' + snaps.boot.buildings));
  check('enemies spawned', snaps.boot && snaps.boot.enemies > 0, snaps.boot && ('enemies=' + snaps.boot.enemies));
  check('tokens spawned', snaps.boot && snaps.boot.tokensLeft > 0, snaps.boot && ('tokens=' + snaps.boot.tokensLeft));
  check('not started before ENTER', snaps.boot && snaps.boot.started === false);

  // ----- press ENTER -----
  try { elementsById.goBtn.dispatchEvent({ type: 'click', preventDefault() {}, button: 0 }); }
  catch (e) { errors.push('goBtn click: ' + (e.stack || e)); }
  tick(3);
  snaps.entered = S();
  check('game starts on ENTER', snaps.entered && snaps.entered.started === true);

  // ----- hold swing + move (mouse-look + WASD + space) -----
  fireMouse('mousedown', elementsById.c, 0);
  fireMouse('mousemove', win);
  fireKey('keydown', ' '); fireKey('keydown', 'w'); fireKey('keydown', 'd');
  const p0 = S().pos.slice();
  tick(90);
  snaps.swung = S();
  const moved = dist(snaps.swung.pos, p0);
  check('player MOVES while swinging', moved > 5, 'moved ' + moved.toFixed(1) + 'u  state=' + snaps.swung.state + '  speed=' + snaps.swung.speed.toFixed(1) + 'mph-ish');
  check('does NOT fall through the world (y > -40)', snaps.swung.pos[1] > -40, 'y=' + snaps.swung.pos[1].toFixed(1));
  check('health stays sane (0..100)', snaps.swung.hp >= 0 && snaps.swung.hp <= 100, 'hp=' + snaps.swung.hp);
  check('web fluid stays sane (0..100)', snaps.swung.web >= 0 && snaps.swung.web <= 100, 'web=' + snaps.swung.web.toFixed(0));
  fireKey('keyup', ' '); fireMouse('mouseup', win, 0);
  tick(20);
  snaps.released = S();
  check('released swing → airborne/ground (not stuck in swing)', snaps.released.state !== 'swing', 'state=' + snaps.released.state);

  // ----- zip + combat + suit -----
  fireKey('keydown', 'shift'); tick(8); fireKey('keyup', 'shift');
  fireKey('keydown', 'f'); fireKey('keyup', 'f');
  fireKey('keydown', 'g'); fireKey('keyup', 'g');
  fireKey('keydown', 'q'); fireKey('keyup', 'q');
  fireKey('keydown', '2');
  snaps.suit = S();
  check('suit swap works (1-4 keys)', snaps.suit.suit === 1, 'suit index=' + snaps.suit.suit);

  // ----- respawn -----
  fireKey('keydown', 'r'); tick(3);
  snaps.respawn = S();
  check('respawn places you high on a rooftop (y > 30)', snaps.respawn.pos[1] > 30, 'y=' + snaps.respawn.pos[1].toFixed(1));
  tick(40);

  // ----- World Builder -----
  fireKey('keydown', 'b'); tick(6);
  snaps.buildOn = S();
  check('World Builder toggles ON (B)', snaps.buildOn.editing === true);
  fireKey('keydown', ' '); tick(3);
  snaps.placed = S();
  check('placing a block adds real city (Space)', snaps.placed.buildings > snaps.buildOn.buildings, snaps.buildOn.buildings + ' → ' + snaps.placed.buildings + ' buildings');
  fireKey('keydown', 'b'); tick(6);
  check('World Builder toggles OFF (B)', S().editing === false);
  tick(40);

  result.renderCount = renderCount;
}

/* ---------- report ---------- */
const log = _err;
const line = '='.repeat(64);
log('\n' + line);
log(' WEB-SLINGER — HEADLESS TEST HARNESS');
log(line);
log(' boot            : ' + (result.initOk ? 'OK' : 'FAILED'));
if (result.initError) log(' INIT ERROR:\n' + result.initError);
log(' frames ticked   : ' + (result.renderCount) + ' renders, 0 uncaught');
log(' runtime errors  : ' + errors.length);
errors.slice(0, 12).forEach((e, i) => log('   [' + (i + 1) + '] ' + e.split('\n').slice(0, 3).join('\n       ')));
log('');
log(' BEHAVIOR CHECKS (pressing buttons & observing state):');
let passed = 0;
checks.forEach(c => { if (c.ok) passed++; log('   ' + (c.ok ? '✅' : '❌') + ' ' + c.name + (c.detail ? '   — ' + c.detail : '')); });
log('');
if (snaps.swung) log(' observed while swinging : pos=[' + snaps.swung.pos.map(n => n.toFixed(0)).join(',') + '] state=' + snaps.swung.state + ' hp=' + snaps.swung.hp + ' web=' + snaps.swung.web.toFixed(0) + ' score=' + snaps.swung.score);
const allChecks = checks.every(c => c.ok);
const pass = result.initOk && errors.length === 0 && result.renderCount > 0 && allChecks;
log(line);
log(' RESULT: ' + (pass ? 'PASS ✅  ' + passed + '/' + checks.length + ' checks, ' + result.renderCount + ' frames, no exceptions'
  : 'FAIL ❌  ' + passed + '/' + checks.length + ' checks passed, ' + errors.length + ' errors'));
log(line + '\n');
process.exit(pass ? 0 : 1);
