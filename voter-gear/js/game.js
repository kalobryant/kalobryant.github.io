'use strict';
/* ===== VOTER GEAR: engine, gameplay, rendering ===== */
const W = 256, H = 224, TS = 16, HUD = 32, PH = 192;
const cv = document.getElementById('screen');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const DIRV = [[0, 1], [0, -1], [-1, 0], [1, 0]]; // down, up, left, right
const WALK = [0, 1, 0, 2];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const SOLID = new Set('#bvTB=FPCxSE'.split(''));
const SIGHT = new Set('#bvBSE'.split(''));

/* ---------- input ---------- */
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'a', KeyJ: 'a', Space: 'a', KeyX: 'b', KeyK: 'b', KeyC: 'radio', KeyL: 'radio', Enter: 'start', Escape: 'start', KeyM: 'mute' };
const Keys = { down: {}, pressed: {} };
function press(k) { if (!Keys.down[k]) Keys.pressed[k] = true; Keys.down[k] = true; Sound.init(); }
function release(k) { Keys.down[k] = false; }
addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); if (e.repeat) return; press(k); });
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) release(k); });
addEventListener('blur', () => { Keys.down = {}; });
const P = k => !!Keys.pressed[k], D = k => !!Keys.down[k];

/* ---------- timers / scripts ---------- */
let waiters = [];
const wait = s => new Promise(r => waiters.push({ t: s, r }));
function tickWaiters(dt) {
  const done = [];
  waiters = waiters.filter(w => { w.t -= dt; if (w.t <= 0) { done.push(w.r); return false; } return true; });
  done.forEach(r => r());
}
function runScript(fn) {
  const g = G; g.busy++;
  Promise.resolve().then(fn).catch(e => console.error(e)).finally(() => { g.busy = Math.max(0, g.busy - 1); });
}

/* ---------- dialog ---------- */
let Dlg = { active: false };
function wrapText(text, max) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      if (!line) line = w; else if ((line + ' ' + w).length <= max) line += ' ' + w; else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
function openDlg(name, text, choices, resolve) {
  const lines = wrapText(String(text).toUpperCase(), 38), pages = [];
  for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
  Dlg = { active: true, name: (name || '').toUpperCase(), pages, page: 0, shown: 0, choices, sel: 0, resolve, blipT: 0 };
}
const say = (name, text) => new Promise(r => openDlg(name, text, null, r));
const choose = (name, text, choices) => new Promise(r => openDlg(name, text, choices, r));
function updateDlg(dt) {
  const pg = Dlg.pages[Dlg.page], total = pg.join('').length;
  if (Dlg.shown < total) {
    Dlg.shown = Math.min(total, Dlg.shown + dt * 75);
    Dlg.blipT -= dt; if (Dlg.blipT <= 0) { Sound.sfx('blip'); Dlg.blipT = 0.06; }
    if (P('a') || P('start')) Dlg.shown = total;
    return;
  }
  const last = Dlg.page === Dlg.pages.length - 1;
  if (last && Dlg.choices) {
    const n = Dlg.choices.length;
    if (P('left') || P('up')) { Dlg.sel = (Dlg.sel + n - 1) % n; Sound.sfx('select'); }
    if (P('right') || P('down')) { Dlg.sel = (Dlg.sel + 1) % n; Sound.sfx('select'); }
    if (P('a') || P('start')) closeDlg(Dlg.sel);
    return;
  }
  if (P('a') || P('start')) { if (!last) { Dlg.page++; Dlg.shown = 0; } else closeDlg(); }
}
function closeDlg(v) { const r = Dlg.resolve; Dlg = { active: false }; Sound.sfx('select'); if (r) r(v); }

/* ---------- state ---------- */
let G = newGame();
G.mode = 'title';
function newGame() {
  return { mode: 'play', clock: 0, time: 0, room: 0, R: null, map: null, roomCanvas: null, ents: [], pickups: [], player: null,
    inv: { phone: 1 }, eq: 'phone', patience: 20, maxPat: 20, helped: new Set(), caught: 0, flags: {}, taken: {},
    busy: 0, movers: [], floats: [], rings: [], projs: [], fade: 0, fadeAnim: null, radio: null, card: null,
    bumpCD: 0, phoneT: 0, fountainCD: 0, hurtFlash: 0, entry: { room: 0, x: 0, y: 0 },
    ballot: null, scanner: null, go: null, pause: null, endFx: null };
}
function makePlayer() { return { isPlayer: true, x: 0, y: 0, dir: 1, anim: 0, moving: false, hidden: false, coffeeT: 0, earplugs: false, emote: null, emoteT: 0 }; }

/* ---------- geometry helpers ---------- */
const feet = e => ({ x: e.x + 3, y: e.y + 8, w: 10, h: 7 });
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const overlapsPlayer = e => overlap(feet(e), feet(G.player));
function tileAt(c, r) { if (r < 0 || r >= 12 || c < 0 || c >= 16) return '.'; return G.map[r][c]; }
const tileAtPx = (x, y) => tileAt(Math.floor(x / TS), Math.floor(y / TS));
function boxHitsTiles(b) {
  return [[b.x, b.y], [b.x + b.w - 1, b.y], [b.x, b.y + b.h - 1], [b.x + b.w - 1, b.y + b.h - 1]].some(([x, y]) => SOLID.has(tileAtPx(x, y)));
}
const entAtBox = (b, ignore) => G.ents.find(e => e !== ignore && e.solid !== false && overlap(b, feet(e)));
function dirToPoint(e, x, y) { const dx = x - (e.x + 8), dy = y - (e.y + 10); return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0); }
function faceEach(e, p) { e.dir = dirToPoint(e, p.x + 8, p.y + 10); p.dir = dirToPoint(p, e.x + 8, e.y + 10); }

function canSee(e, range, half) {
  const p = G.player;
  if (p.hidden) return false;
  const ex = e.x + 8, ey = e.y + 8, px = p.x + 8, py = p.y + 10;
  const dx = px - ex, dy = py - ey, d = Math.hypot(dx, dy);
  if (d > range) return false;
  if (d < 10) return true;
  const [fx, fy] = DIRV[e.dir];
  if ((dx * fx + dy * fy) / d < Math.cos(half)) return false;
  const n = Math.ceil(d / 4);
  for (let i = 1; i < n; i++) if (SIGHT.has(tileAtPx(ex + dx * i / n, ey + dy * i / n))) return false;
  return true;
}
const visionCheck = e => { const c = TYPES[e.type].cone; return canSee(e, c.range, c.half); };

/* ---------- movement ---------- */
function stepToward(e, tx, ty, step, collide = true) {
  const dx = tx - e.x, dy = ty - e.y;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) { e.x = tx; e.y = ty; return true; }
  let mx = 0, my = 0;
  if (Math.abs(dx) >= 0.5) { mx = Math.sign(dx) * Math.min(step, Math.abs(dx)); e.dir = dx < 0 ? 2 : 3; }
  else { my = Math.sign(dy) * Math.min(step, Math.abs(dy)); e.dir = dy < 0 ? 1 : 0; }
  e.x += mx; e.y += my;
  if (collide && overlapsPlayer(e)) { e.x -= mx; e.y -= my; return false; }
  e.moving = true; e.anim += step / 5;
  return false;
}
function followPath(e, dt, speed) {
  if (e.waitT > 0) { e.waitT -= dt; if (e.waitT <= 0) e.pi = (e.pi + 1) % e.path.length; return; }
  const wp = e.path[e.pi];
  if (stepToward(e, wp.x * TS, wp.y * TS, speed * dt)) { if (wp.face != null) e.dir = wp.face; e.waitT = wp.wait || 0.01; }
}
const walkTo = (e, tx, ty, speed = 40) => new Promise(r => G.movers.push({ e, tx, ty, speed, r }));
function updateMovers(dt) {
  G.movers = G.movers.filter(m => {
    if (stepToward(m.e, m.tx, m.ty, m.speed * dt, false)) { m.e.moving = false; m.r(); return false; }
    return true;
  });
}
function tryShift(p, dx, dy) { p.x += dx; p.y += dy; if (boxHitsTiles(feet(p)) || entAtBox(feet(p))) { p.x -= dx; p.y -= dy; } }
function nudge(p, mx, my) { // slide around corners so 16px gaps are easy to enter
  const b = feet(p);
  if (mx) {
    const lx = mx > 0 ? b.x + b.w : b.x - 1;
    const tf = !SOLID.has(tileAtPx(lx, b.y)), bf = !SOLID.has(tileAtPx(lx, b.y + b.h - 1));
    if (tf && !bf) tryShift(p, 0, -1); else if (bf && !tf) tryShift(p, 0, 1);
  }
  if (my) {
    const ly = my > 0 ? b.y + b.h : b.y - 1;
    const lf = !SOLID.has(tileAtPx(b.x, ly)), rf = !SOLID.has(tileAtPx(b.x + b.w - 1, ly));
    if (lf && !rf) tryShift(p, -1, 0); else if (rf && !lf) tryShift(p, 1, 0);
  }
}
function movePlayer(mx, my) {
  const p = G.player;
  for (const [ax, ay] of [[mx, 0], [0, my]]) {
    if (!ax && !ay) continue;
    p.x += ax; p.y += ay;
    const hit = boxHitsTiles(feet(p));
    const ent = !hit && entAtBox(feet(p));
    if (hit || ent) {
      p.x -= ax; p.y -= ay;
      if (ent) onBump(ent);
      else if (!(mx && my)) nudge(p, ax, ay);
    }
  }
}
function onBump(e) {
  if (e.type !== 'wander' || G.bumpCD > 0) return;
  G.bumpCD = 1.2; hurt(1); Sound.sfx('bump'); e.emote = '!'; e.emoteT = 0.6;
}

/* ---------- patience / rank ---------- */
function floatText(x, y, text, col) { G.floats.push({ x, y, text, col, t: 1 }); }
function hurt(n) { G.patience = Math.max(0, G.patience - n); G.hurtFlash = 0.5; floatText(G.player.x + 8, G.player.y - 4, '-' + n, '#f85838'); }
function heal(n) { G.patience = Math.min(G.maxPat, G.patience + n); floatText(G.player.x + 8, G.player.y - 4, '+' + n, '#58f858'); }
function helped(id) {
  if (G.helped.has(id)) return;
  G.helped.add(id); Sound.sfx('help');
  floatText(G.player.x + 8, G.player.y - 12, 'RANK UP!', '#f8d800');
}

/* ---------- rooms ---------- */
function spawn(s) {
  const T = TYPES[s.t];
  const e = Object.assign({}, s, { type: s.t, x: s.x * TS, y: s.y * TS, dir: s.dir ?? 0, anim: 0, t: rnd(0, 2), pi: 0, waitT: 0, cd: 0,
    emote: null, emoteT: 0, lookT: 0, moving: false, pal: s.pal || T.pal, wd: -1 });
  if (s.flag && G.flags[s.flag]) return T.helpedSpawn ? T.helpedSpawn(e) : null;
  if (T.init) T.init(e);
  return e;
}
function loadRoom(id, pos) {
  const R = ROOMS[id];
  G.room = id; G.R = R; G.map = R.map; G.roomCanvas = SPR.roomCanvas(R);
  G.ents = []; G.projs = []; G.rings = []; G.floats = []; G.movers = [];
  for (const s of R.ents) { const e = spawn(s); if (e) G.ents.push(e); }
  G.pickups = R.pickups.filter(p => !G.taken[p.id]).map(p => Object.assign({}, p, { x: p.x * TS, y: p.y * TS }));
  const p = G.player; p.x = pos.x; p.y = pos.y;
  G.entry = { room: id, x: pos.x, y: pos.y };
  if (R.call && !G.flags['visit' + id]) { G.flags['visit' + id] = true; runScript(() => radio(callFor(id))); }
}
function changeRoom(id, x, y) { runScript(async () => { await fadeTo(1, 0.15); loadRoom(id, { x, y }); await fadeTo(0, 0.15); }); }
function callFor(id) {
  if (id === 1) return [
    [HL, "THAT'S THE LINE FOR DISTRICT 3. YOU'RE DISTRICT 7. YOU JUST NEED TO GET PAST IT."],
    [HL, "CUTTING THROUGH THE TAPED AREA IS FASTER. BUT IF A MONITOR SEES YOU IN THERE, IT'S BACK OF THE LINE."],
    G.inv.screen ? [HL, "THAT'S WHAT THE PRIVACY SCREEN IS FOR. HOLD IT UP AND NOBODY WILL NOTICE YOU."]
                 : [HL, 'THERE WAS A SPARE PRIVACY SCREEN BACK IN THE LOBBY. NOBODY QUESTIONS A WALKING PRIVACY SCREEN.'],
    ['VOTER', 'I FEEL LIKE PEOPLE WOULD QUESTION THAT.'],
    [HL, "YOU'D BE SURPRISED."]
  ];
  if (id === 2) return CALLS.room2;
  const c = CALLS.room3.slice();
  if (!G.flags.voted) c.push([HL, "...WAIT. YOUR BALLOT'S STILL BLANK. GO BACK TO BOOTH 4 FIRST."]);
  return c;
}

/* ---------- fades, cards, radio ---------- */
const fadeTo = (to, dur) => new Promise(r => { G.fadeAnim = { from: G.fade, to, t: 0, dur, r }; });
async function radio(lines) {
  G.radio = { t: 0 }; Sound.sfx('ring');
  await wait(0.9);
  for (const [who, text] of lines) await say(who, text);
  G.radio = null;
}
function hotlineTip() {
  const f = G.flags, L = [];
  if (G.room === 0) {
    if (!G.taken.screen) L.push([HL, "THERE'S A SPARE PRIVACY SCREEN IN THE CORNER. GRAB IT. NOBODY QUESTIONS A WALKING PRIVACY SCREEN."]);
    else if (f.voted && G.inv.pen) L.push([HL, "YOU'VE STILL GOT THE POLL WORKER'S PEN. JUST SAYING."]);
    else L.push([HL, 'THE LINE ROOM IS EAST. YOUR BOOTH IS PAST IT.']);
  } else if (G.room === 1) {
    if (!f.kid1) L.push([HL, "THAT KID'S CRYING DRAINS YOUR PATIENCE AND MAKES THE MONITOR LOOK YOUR WAY. A JUICE BOX MIGHT DO IT."]);
    L.push([HL, "TWO WAYS ACROSS: CUT THROUGH THE TAPED LINE WHEN THE MONITOR ISN'T LOOKING, OR TAKE THE BOTTOM PATH."]);
    if (!f.hangry) L.push([HL, 'THE BOTTOM PATH IS BLOCKED BY SOMEONE HANGRY. FOOD SOLVES THAT.']);
  } else if (G.room === 2) {
    if (!f.undecided) L.push([HL, "BOOTH 4 IS BLOCKED BY SOMEONE WHO DIDN'T READ AHEAD. A SAMPLE BALLOT WOULD HELP THEM."]);
    else if (!f.voted) L.push([HL, 'BOOTH 4 IS OPEN. STAND IN FRONT OF IT AND PRESS Z.']);
    else L.push([HL, "NOW GET THAT BALLOT TO THE SCANNER. IT'S EAST."]);
    if (f.voted && G.inv.pen) L.push([HL, "...AND YOU STILL HAVE THE POLL WORKER'S PEN. THE LOBBY IS BACK WEST."]);
    L.push([HL, 'REMEMBER: NO PHONES WHERE A MONITOR CAN SEE YOU IN HERE.']);
  } else {
    if (!f.voted) L.push([HL, "YOU CAN'T SCAN A BLANK BALLOT. GO BACK TO BOOTH 4."]);
    else L.push([HL, "THE SCANNER IS AT THE TOP OF THE ROOM. STAY OUT OF THE COLLECTORS' LINE OF SIGHT."]);
    if (!f.kid2) L.push([HL, 'THAT KID WOULD PROBABLY LOVE A STICKER.']);
  }
  if (G.patience < 8) L.push([HL, "YOUR PATIENCE IS RUNNING LOW. THERE'S A WATER FOUNTAIN IN THE LINE ROOM."]);
  L.push(['VOTER', 'COPY.']);
  return L;
}

/* ---------- items ---------- */
const owned = () => USABLE.filter(i => G.inv[i] > 0);
function currentItem() { if (G.eq && G.inv[G.eq] > 0) return G.eq; const o = owned(); return o[0] || null; }
function fixEquip() { if (!(G.inv[G.eq] > 0)) G.eq = owned()[0] || null; }
function cycleItem() { const o = owned(); if (!o.length) return; G.eq = o[(o.indexOf(currentItem()) + 1) % o.length]; Sound.sfx('select'); }
function collect(pk) {
  pk.got = true; G.taken[pk.id] = true;
  G.inv[pk.item] = (G.inv[pk.item] || 0) + pk.n;
  if (USABLE.includes(pk.item)) G.eq = pk.item;
  Sound.sfx('pickup');
  const it = ITEMS[pk.item];
  runScript(() => say('', 'GOT: ' + it.name + (pk.n > 1 ? ' X' + pk.n : '') + '. ' + it.desc));
}
function useItem(item) {
  const p = G.player;
  if (!item) return;
  switch (item) {
    case 'screen': p.hidden = true; Sound.sfx('select'); floatText(p.x + 8, p.y - 4, 'HIDDEN', '#58d8f8'); break;
    case 'phone': runScript(async () => { G.phoneT = 2.5; await say('', pick(PHONE_LINES)); await phoneCheck(); }); break;
    case 'sticker': {
      G.inv.sticker--; fixEquip();
      const [fx, fy] = DIRV[p.dir];
      G.projs.push({ x: p.x + 8, y: p.y + 10, vx: fx * 110, vy: fy * 110, t: 0.45, T: 0.45 });
      Sound.sfx('toss'); break;
    }
    case 'coffee':
      G.inv.coffee--; fixEquip(); p.coffeeT = 7; heal(3); Sound.sfx('gulp');
      runScript(() => say('', 'YOU CHUG THE COFFEE. EVERYTHING FEELS FAST NOW. (MONITORS CALL THAT RUNNING.)'));
      break;
    case 'earplugs': p.earplugs = !p.earplugs; Sound.sfx('select'); floatText(p.x + 8, p.y - 4, p.earplugs ? 'PLUGS IN' : 'PLUGS OUT', '#f8b858'); break;
    case 'sample': runScript(() => say('', SAMPLE_TEXT)); break;
    default: runScript(() => say('', 'SAVE IT FOR SOMEONE WHO NEEDS IT.'));
  }
}
async function giveItem(e, item) { G.inv[item]--; fixEquip(); faceEach(e, G.player); await TYPES[e.type].onGive(e, item); }
function noise(x, y) {
  G.rings.push({ x, y, r: 2, max: 30, col: '#fcfcfc' });
  Sound.sfx('blip');
  for (const e of G.ents) {
    const d = Math.hypot(e.x + 8 - x, e.y + 10 - y);
    if (e.type === 'kid' && !e.calm && d < 24) { runScript(() => calmKid(e, 'sticker')); continue; }
    if (['monitor', 'talker', 'collector', 'wander', 'queue'].includes(e.type) && d < 96) {
      e.dir = dirToPoint(e, x, y); e.lookT = 3; e.emote = '?'; e.emoteT = 1;
    }
  }
}

/* ---------- rules ---------- */
function violation() {
  const p = G.player;
  if (p.hidden) return null;
  if (tileAtPx(p.x + 8, p.y + 12) === 'L') return 'line';
  if (p.coffeeT > 0 && p.moving) return 'run';
  if (G.R.phoneRule && G.phoneT > 0) return 'phone';
  return null;
}
async function phoneCheck() {
  if (!G.R.phoneRule) return false;
  const m = G.ents.find(m => m.type === 'monitor' && visionCheck(m));
  if (m) { await caught(m, 'phone'); return true; }
  return false;
}
async function caught(e, reason) {
  const p = G.player;
  faceEach(e, p); e.emote = '!'; e.emoteT = 1.2; Sound.sfx('alert');
  await wait(0.8);
  await say('ELECTION MONITOR', CAUGHT_LINES[reason]);
  Sound.sfx('caught');
  await fadeTo(1, 0.35);
  G.caught++; G.patience = Math.max(0, G.patience - 3); p.coffeeT = 0; G.phoneT = 0; p.hidden = false;
  loadRoom(1, { x: 4, y: 5 * TS }); p.dir = 3;
  await fadeTo(0, 0.35);
  await say('', 'BACK OF THE LINE. -3 PATIENCE.');
}

/* ---------- NPC behaviour ---------- */
function monitorUpdate(e, dt) {
  e.moving = false;
  if (e.lookT > 0) e.lookT -= dt; else followPath(e, dt, 40);
  if (visionCheck(e)) { const v = violation(); if (v) runScript(() => caught(e, v)); }
}
function talkerUpdate(e, dt) {
  e.moving = false;
  if (e.cd > 0) e.cd -= dt;
  if (e.lookT > 0) e.lookT -= dt; else followPath(e, dt, 28);
  if (e.cd <= 0 && visionCheck(e)) runScript(() => smallTalk(e, false));
}
function collectorUpdate(e, dt) {
  e.moving = false;
  if (e.cd > 0) e.cd -= dt;
  if (e.lookT > 0) e.lookT -= dt; else followPath(e, dt, 34);
  if (e.cd <= 0 && visionCheck(e)) runScript(() => lecture(e));
}
function wanderUpdate(e, dt) {
  e.moving = false;
  if (e.lookT > 0) { e.lookT -= dt; return; }
  e.t -= dt;
  if (e.t <= 0) { e.t = rnd(0.8, 2.4); e.wd = Math.random() < 0.4 ? -1 : Math.floor(Math.random() * 4); }
  if (e.wd < 0) return;
  const [dx, dy] = DIRV[e.wd], step = 20 * dt, ox = e.x, oy = e.y;
  e.dir = e.wd; e.x += dx * step; e.y += dy * step;
  const a = e.area;
  const out = e.x < a[0] * TS || e.y < a[1] * TS || e.x > a[2] * TS || e.y > a[3] * TS;
  const hitP = overlapsPlayer(e);
  if (out || hitP || boxHitsTiles(feet(e)) || entAtBox(feet(e), e)) { e.x = ox; e.y = oy; e.t = 0; if (hitP) onBump(e); }
  else { e.moving = true; e.anim += step / 5; }
}
function kidUpdate(e, dt) {
  e.anim += dt * 4;
  if (e.calm) return;
  e.cryT = (e.cryT ?? 1) - dt;
  if (e.cryT > 0) return;
  e.cryT = 2.2;
  G.rings.push({ x: e.x + 8, y: e.y + 10, r: 3, max: 52, col: '#58c8f8' });
  const p = G.player, d = Math.hypot(p.x - e.x, p.y - e.y);
  if (d < 120) Sound.sfx('cry');
  if (d < 52) {
    if (!p.earplugs) hurt(1);
    for (const m of G.ents) if (m.type === 'monitor') { m.dir = dirToPoint(m, p.x + 8, p.y + 10); m.lookT = 2.5; m.emote = '?'; m.emoteT = 1; }
  }
}

async function smallTalk(e, byPlayer) {
  const p = G.player;
  faceEach(e, p);
  if (byPlayer && e.cd > 0) { await say(e.name, "ANYWAY! WE'LL CATCH UP LATER!"); return; }
  if (!byPlayer) { e.emote = '!'; e.emoteT = 0.8; Sound.sfx('alert'); await wait(0.5); }
  const L = e.lines;
  await say(e.name, L[0]); hurt(1);
  const c = await choose(e.name, L[1], ['KEEP LISTENING', 'FAKE A CALL']);
  if (c === 1) {
    G.phoneT = 2;
    await say('VOTER', "OH! SORRY, I HAVE TO TAKE THIS. ...HELLO? YES. EXTREMELY IMPORTANT.");
    e.cd = 8; e.emote = '...'; e.emoteT = 1.5;
    await phoneCheck();
    return;
  }
  hurt(1);
  await say(e.name, L[2]); hurt(1);
  e.cd = 8; e.emote = '$'; e.emoteT = 1.5;
}
async function lecture(e) {
  const p = G.player;
  faceEach(e, p); e.emote = '!'; e.emoteT = 0.8; Sound.sfx('alert');
  await wait(0.4);
  for (const l of e.lines) { await say(e.name, l); hurt(1); }
  const [dx, dy] = DIRV[e.dir];
  for (let i = 0; i < 20; i++) { const ox = p.x, oy = p.y; p.x += dx; p.y += dy; if (boxHitsTiles(feet(p)) || entAtBox(feet(p))) { p.x = ox; p.y = oy; break; } }
  e.cd = 6;
}
async function kidTalk(e) {
  if (e.calm) { await say('KID', e.hint); return; }
  await say('KID', 'WAAAAAAAH!');
  await say('', '(A JUICE BOX OR A STICKER MIGHT CALM THEM DOWN.)');
}
async function calmKid(e, item) {
  if (e.calm) return;
  e.calm = true; G.flags[e.flag] = true; e.emote = '$'; e.emoteT = 2; helped(e.flag);
  await say('KID', item === 'juice' ? '*SLURRRRP* ...HEE HEE!' : "A STICKER! I VOTED! ...I DIDN'T VOTE.");
  await say('KID', e.hint);
}
async function hangryTalk(e) {
  if (e.calm) { await say('VOTER', 'MUCH BETTER. GO VOTE, FRIEND.'); return; }
  await say('HANGRY VOTER', 'HRRRMMM. I SKIPPED LUNCH TO BE HERE. NOBODY GETS PAST ME UNTIL I FEEL BETTER.');
  await say('', '(THEY LOOK HUNGRY. REALLY HUNGRY.)');
}
async function hangryGive(e, item) {
  e.calm = true; G.flags.hangry = true; e.emote = '$'; e.emoteT = 2; helped('hangry');
  await say('HANGRY VOTER', item === 'granola' ? '*CRUNCH* OH, THANK GOODNESS. I WAS ABOUT TO START SHARING MY OPINIONS OUT LOUD.'
                                               : "*SLURP* OH, THAT'S THE GOOD STUFF. SORRY I GROWLED AT YOU.");
  const dest = G.player.x < e.x ? { x: 12, y: 10 } : { x: 4, y: 10 };
  G.flags.hangryPos = dest;
  await walkTo(e, dest.x * TS, dest.y * TS, 40);
  e.dir = 1;
}
async function undecidedTalk() {
  await say('UNDECIDED VOTER', "HMMMM... MEASURE B. WHAT EVEN IS A CROSSWALK? I CAN'T VOTE UNTIL I KNOW.");
  await say('', '(MAYBE THEY NEED A SAMPLE BALLOT.)');
}
async function undecidedGive(e) {
  e.leaving = true; G.flags.undecided = true; e.emote = '$'; e.emoteT = 1.5; helped('undecided');
  await say('UNDECIDED VOTER', "OH! IT'S ALL EXPLAINED RIGHT HERE! THE CROSSWALK IS FOR... CROSSING!");
  await say('UNDECIDED VOTER', "THANK YOU! I'LL USE A DIFFERENT BOOTH. BOOTH 4 GIVES ME BAD VIBES.");
  await walkTo(e, e.x, 5 * TS, 40);
  await walkTo(e, -20, 5 * TS, 50);
  G.ents = G.ents.filter(x => x !== e);
}
async function pollTalk() {
  if (G.flags.penReturned) { await say('POLL WORKER', 'THANK YOU FOR VOTING! ...AND FOR THE PEN.'); return; }
  if (G.flags.voted && G.inv.pen) {
    const c = await choose('POLL WORKER', 'OH, YOU VOTED! WONDERFUL. ...SO. ABOUT MY PEN.', ['GIVE IT BACK', 'WHAT PEN?']);
    if (c === 0) { G.inv.pen = 0; G.flags.penReturned = true; helped('pen'); await say('POLL WORKER', "MY PEN! I'VE BEEN SIGNING PEOPLE IN WITH A CRAYON FOR AN HOUR."); }
    else await say('POLL WORKER', "...I'M WATCHING YOU.");
    return;
  }
  await say('POLL WORKER', 'BOOTH 4 IS PAST THE LINE ROOM, THEN EAST. ...HAVE YOU SEEN MY PEN?');
}

const TYPES = {
  poll: { pal: 'poll', update() {}, talk: pollTalk },
  queue: { init(e) { e.baseDir = e.dir; }, update(e, dt) { if (e.lookT > 0) { e.lookT -= dt; if (e.lookT <= 0) e.dir = e.baseDir; } },
           talk: e => say('VOTER', pick(e.booth ? BOOTH_LINES : CROWD_LINES)) },
  wander: { update: wanderUpdate, talk: () => say('VOTER', pick(WANDER_LINES)) },
  monitor: { pal: 'monitor', cone: { range: 88, half: 0.42, col: '248,232,96' }, update: monitorUpdate, talk: () => say('ELECTION MONITOR', pick(MONITOR_LINES)) },
  talker: { cone: { range: 56, half: 0.6, col: '248,120,232' }, update: talkerUpdate, talk: e => smallTalk(e, true) },
  collector: { pal: 'collector', cone: { range: 56, half: 0.55, col: '120,200,248' }, update: collectorUpdate, talk: () => say('BALLOT COLLECTOR', pick(COLLECTOR_TALK)) },
  kid: { update: kidUpdate, talk: kidTalk, accepts: ['juice', 'sticker'], onGive: calmKid, helpedSpawn: e => { e.calm = true; return e; } },
  hangry: { pal: 'hangry',
    update(e, dt) { if (!e.calm) { e.grrT = (e.grrT || 0) - dt; if (e.grrT <= 0) { e.grrT = 3; e.emote = '#'; e.emoteT = 1; } } },
    talk: hangryTalk, accepts: ['granola', 'coffee'], onGive: hangryGive,
    helpedSpawn: e => { const p = G.flags.hangryPos || { x: 4, y: 10 }; e.x = p.x * TS; e.y = p.y * TS; e.calm = true; e.dir = 1; return e; } },
  undecided: { pal: 'undecided',
    update(e, dt) { if (!e.leaving) { e.thinkT = (e.thinkT || 0) - dt; if (e.thinkT <= 0) { e.thinkT = 2.5; e.emote = '...'; e.emoteT = 1.2; } } },
    talk: undecidedTalk, accepts: ['sample'], onGive: undecidedGive, helpedSpawn: () => null }
};

/* ---------- interaction ---------- */
function interact() {
  const p = G.player;
  if (p.hidden) { p.hidden = false; Sound.sfx('select'); floatText(p.x + 8, p.y - 4, 'SCREEN DOWN', '#bcbcbc'); return; }
  const [fx, fy] = DIRV[p.dir];
  const px = p.x + 8 + fx * 14, py = p.y + 12 + fy * 14;
  const item = currentItem();
  const e = G.ents.find(e => { const b = feet(e); return px >= b.x - 3 && px < b.x + b.w + 3 && py >= b.y - 3 && py < b.y + b.h + 3; });
  if (e) {
    const T = TYPES[e.type];
    if (item && T.accepts && !e.calm && !e.leaving && T.accepts.includes(item)) { runScript(() => giveItem(e, item)); return; }
    if (T.talk) {
      if (e.type !== 'queue' && e.type !== 'poll') e.dir = dirToPoint(e, p.x + 8, p.y + 10);
      runScript(() => T.talk(e, item));
      return;
    }
  }
  const t = tileAtPx(px, py);
  if ('FBSET'.includes(t)) { runScript(() => tileInteract(t, Math.floor(px / TS))); return; }
  useItem(item);
}
async function tileInteract(t, col) {
  if (t === 'F') {
    if (G.fountainCD > 0) { await say('', "YOU'RE NOT THIRSTY. YOU'RE JUST STALLING."); return; }
    G.fountainCD = 12; Sound.sfx('gulp'); heal(8);
    await say('', 'GLUG GLUG GLUG. THE WATER TASTES LIKE A GYM. +8 PATIENCE.');
    return;
  }
  if (t === 'B') return boothInteract(col);
  if (t === 'S') return scannerInteract();
  if (t === 'E') { await say('', G.flags.voted ? 'NOT YET. YOUR BALLOT STILL NEEDS TO GO THROUGH THE SCANNER.' : "THE EXIT. YOU CAN'T LEAVE. YOU HAVEN'T VOTED YET!"); return; }
  if (t === 'T') { if (G.ents.some(e => e.type === 'poll')) await pollTalk(); }
}
async function boothInteract(col) {
  const n = G.R.booths && G.R.booths[col];
  if (!n) return;
  if (n !== 4) { await say('', n === 6 ? 'BOOTH 6 IS FOR DISTRICT 2. YOUR CARD SAYS DISTRICT 7.' : 'BOOTH ' + n + ' IS TAKEN.'); return; }
  if (G.flags.voted) { await say('', 'YOU ALREADY VOTED. ONE BALLOT PER VOTER.'); return; }
  const c = await choose('', 'BOOTH 4. STEP IN AND MARK YOUR BALLOT?', ['YES', 'NOT YET']);
  if (c !== 0) return;
  const picks = await new Promise(r => { G.mode = 'ballot'; G.ballot = { row: 0, opt: [0, 0, 0], picks: [null, null, null], resolve: r }; });
  G.flags.voted = true;
  Sound.sfx('pickup');
  const blanks = picks.filter(x => x === null).length;
  await say('', 'BALLOT MARKED.' + (blanks ? ' YOU LEFT ' + blanks + ' CONTEST' + (blanks > 1 ? 'S' : '') + " BLANK. THAT'S ALLOWED. THE REST STILL COUNTS." : ''));
  await say('', "NOW FEED IT TO THE SCANNER. IT'S IN THE NEXT ROOM, EAST.");
}
function updateBallot() {
  const b = G.ballot, n = BALLOT.length;
  if (P('up')) { b.row = (b.row + n) % (n + 1); Sound.sfx('select'); }
  if (P('down')) { b.row = (b.row + 1) % (n + 1); Sound.sfx('select'); }
  if (b.row < n) {
    if (P('left')) { b.opt[b.row] = 0; Sound.sfx('blip'); }
    if (P('right')) { b.opt[b.row] = 1; Sound.sfx('blip'); }
    if (P('a')) { b.picks[b.row] = b.picks[b.row] === b.opt[b.row] ? null : b.opt[b.row]; Sound.sfx('scribble'); }
  } else if (P('a') || P('start')) {
    G.mode = 'play'; G.ballot = null; b.resolve(b.picks);
  }
}
async function scannerInteract() {
  if (G.flags.scanned) return;
  if (!G.flags.voted) { await say('', 'THE SCANNER BLINKS AT YOUR BLANK BALLOT. MARK IT IN BOOTH 4 FIRST.'); return; }
  await radio(CALLS.jam);
  const ok = await new Promise(r => { G.mode = 'scanner'; G.scanner = { hits: 0, pos: 0, dir: 1, zx: rnd(20, 90), zw: 24, msg: '', msgT: 0, flash: 0, done: 0, resolve: r }; });
  if (!ok) return; // out of patience: the game-over check takes it from here
  G.flags.scanned = true;
  await endingSequence();
}
function updateScanner(dt) {
  const s = G.scanner;
  if (s.done) { s.done -= dt; if (s.done <= 0) { G.mode = 'play'; G.scanner = null; s.resolve(true); } return; }
  if (s.msgT > 0) s.msgT -= dt;
  if (s.flash > 0) s.flash -= dt;
  s.pos += s.dir * (70 + s.hits * 45) * dt;
  if (s.pos >= 128) { s.pos = 128; s.dir = -1; }
  if (s.pos <= 0) { s.pos = 0; s.dir = 1; }
  if (!P('a')) return;
  if (s.pos >= s.zx && s.pos <= s.zx + s.zw) {
    s.hits++; s.flash = 0.4; Sound.sfx('accept');
    s.msg = s.hits >= 3 ? 'BALLOT ACCEPTED!' : 'WHIRRR... GOOD FEED! (' + s.hits + '/3)'; s.msgT = 1.4;
    if (s.hits >= 3) { s.done = 1.4; Sound.sfx('whirr'); }
    else { s.zw = Math.max(10, 24 - s.hits * 6); s.zx = rnd(4, 124 - s.zw); }
  } else {
    Sound.sfx('reject'); hurt(1); s.msg = 'BZZT! REJECTED. PLEASE REINSERT.'; s.msgT = 1.4;
    if (G.patience <= 0) { G.mode = 'play'; G.scanner = null; s.resolve(false); }
  }
}
async function endingSequence() {
  const p = G.player;
  p.dir = 0; p.hidden = false; G.inv.ballot = 0; Sound.stop();
  G.endFx = { y: p.y - 60, landed: false };
  await wait(1.3);
  G.endFx.landed = true; Sound.sfx('fanfare'); p.emote = '$'; p.emoteT = 2;
  await wait(1.2);
  G.card = { lines: ['MISSION', 'COMPLETE'] };
  await wait(2.6);
  G.card = null;
  await radio(CALLS.end);
  G.mode = 'ending'; Sound.play('title');
}

/* ---------- flow ---------- */
function startGame() {
  waiters = []; Dlg = { active: false };
  G = newGame(); G.mode = 'play'; G.player = makePlayer();
  loadRoom(0, { x: 5 * TS, y: 3 * TS });
  G.player.dir = 1; G.fade = 1;
  Sound.play('sneak');
  runScript(intro);
}
async function intro() {
  await fadeTo(0, 0.6);
  const pw = G.ents.find(e => e.type === 'poll');
  await wait(0.4);
  pw.emote = '!'; pw.emoteT = 0.6;
  await say('POLL WORKER', 'NEXT! NAME AND DISTRICT?');
  await say('VOTER', 'DISTRICT 7.');
  await say('POLL WORKER', 'DISTRICT 7... DISTRICT 7... THERE YOU ARE. SIGN HERE, PLEASE.');
  G.player.emote = '...'; G.player.emoteT = 1.4; Sound.sfx('scribble');
  await wait(1.4);
  G.inv.ballot = 1; G.inv.card = 1; G.inv.sample = 2; Sound.sfx('pickup');
  await say('POLL WORKER', "HERE'S YOUR BALLOT, YOUR DISTRICT CARD, AND A COUPLE OF SAMPLE BALLOTS. YOU'RE IN BOOTH 4.");
  G.inv.sticker = 3; Sound.sfx('pickup');
  await say('POLL WORKER', 'OH, AND TAKE SOME "I VOTED" STICKERS. FOR AFTER. NOT NOW. AFTER.');
  await say('POLL WORKER', "AND I'LL NEED THAT PEN BACK.");
  await say('VOTER', '...');
  G.inv.pen = 1;
  await say('', 'YOU POCKET THE PEN.');
  pw.emote = '?'; pw.emoteT = 1;
  await say('POLL WORKER', '...NEXT!');
  G.card = { lines: ['OPERATION', 'ELECTION DAY'] };
  await wait(2.4);
  G.card = null;
  await radio(CALLS.intro);
  G.eq = 'phone';
}
function toTitle() { waiters = []; Dlg = { active: false }; G = newGame(); G.mode = 'title'; Sound.play('title'); }
function gameOver() { G.mode = 'gameover'; G.go = { sel: 0 }; Sound.stop(); Sound.sfx('caught'); }
function updateGameOver() {
  const go = G.go;
  if (P('up') || P('down')) { go.sel = 1 - go.sel; Sound.sfx('select'); }
  if (P('a') || P('start')) {
    if (go.sel === 0) {
      G.patience = G.maxPat; G.mode = 'play'; G.player.hidden = false; G.player.coffeeT = 0;
      loadRoom(G.entry.room, { x: G.entry.x, y: G.entry.y });
      Sound.play('sneak');
    } else toTitle();
  }
}
function openPause() { G.mode = 'pause'; G.pause = { sel: Math.max(0, owned().indexOf(currentItem())) }; Sound.sfx('select'); }
function updatePause() {
  const list = owned(), ps = G.pause;
  if (list.length) {
    if (P('up')) { ps.sel = (ps.sel + list.length - 1) % list.length; Sound.sfx('blip'); }
    if (P('down')) { ps.sel = (ps.sel + 1) % list.length; Sound.sfx('blip'); }
    if (P('a')) { G.eq = list[ps.sel]; Sound.sfx('select'); }
  }
  if (P('start') || P('b')) { G.mode = 'play'; G.pause = null; }
}

/* ---------- update ---------- */
function updateFx(dt) {
  if (G.fadeAnim) {
    const a = G.fadeAnim; a.t += dt;
    G.fade = a.from + (a.to - a.from) * Math.min(1, a.t / a.dur);
    if (a.t >= a.dur) { G.fadeAnim = null; a.r(); }
  }
  if (G.hurtFlash > 0) G.hurtFlash -= dt;
  G.floats = G.floats.filter(f => { f.t -= dt; f.y -= 14 * dt; return f.t > 0; });
  G.rings = G.rings.filter(r => { r.r += 60 * dt; return r.r < r.max; });
  for (const e of G.player ? [...G.ents, G.player] : G.ents) if (e.emoteT > 0) { e.emoteT -= dt; if (e.emoteT <= 0) e.emote = null; }
  if (G.endFx && !G.endFx.landed) G.endFx.y = Math.min(G.player.y + 2, G.endFx.y + 50 * dt);
}
function updatePlayer(dt) {
  const p = G.player;
  p.moving = false;
  if (p.coffeeT > 0) p.coffeeT -= dt;
  const dx = (D('right') ? 1 : 0) - (D('left') ? 1 : 0), dy = (D('down') ? 1 : 0) - (D('up') ? 1 : 0);
  if (dx || dy) {
    if (dx && dy) {
      const horiz = p.dir === 2 || p.dir === 3;
      if (horiz && (dx < 0) !== (p.dir === 2)) p.dir = dx < 0 ? 2 : 3;
      if (!horiz && (dy < 0) !== (p.dir === 1)) p.dir = dy < 0 ? 1 : 0;
    } else if (dx) p.dir = dx < 0 ? 2 : 3; else p.dir = dy < 0 ? 1 : 0;
    let sp = 62 * (p.hidden ? 0.45 : 1) * (p.coffeeT > 0 ? 1.7 : 1);
    if (dx && dy) sp *= 0.7071;
    const ox = p.x, oy = p.y;
    movePlayer(dx * sp * dt, dy * sp * dt);
    const dist = Math.hypot(p.x - ox, p.y - oy);
    if (dist > 0) { p.moving = true; p.anim += dist / 5; }
  }
  const cx = p.x + 8;
  if (cx < 0 && G.R.exits.left != null) changeRoom(G.R.exits.left, W - 18, p.y);
  else if (cx > W && G.R.exits.right != null) changeRoom(G.R.exits.right, 2, p.y);
}
function update(dt) {
  G.clock += dt;
  if (P('mute')) Sound.toggleMute();
  tickWaiters(dt);
  if (G.mode === 'title') { if (P('start') || P('a')) startGame(); return; }
  if (G.mode === 'ending') { if (P('start')) toTitle(); return; }
  if (G.mode === 'gameover') { updateGameOver(); return; }
  if (G.mode === 'pause') { updatePause(); return; }
  updateMovers(dt); updateFx(dt);
  if (Dlg.active) { updateDlg(dt); return; }
  if (G.mode === 'ballot') { updateBallot(); return; }
  if (G.mode === 'scanner') { updateScanner(dt); return; }
  if (G.busy > 0) return;
  if (G.patience <= 0) { gameOver(); return; }
  G.time += dt;
  if (G.bumpCD > 0) G.bumpCD -= dt;
  if (G.phoneT > 0) G.phoneT -= dt;
  if (G.fountainCD > 0) G.fountainCD -= dt;
  if (P('start')) { openPause(); return; }
  if (P('radio')) { runScript(() => radio(hotlineTip())); return; }
  if (P('b')) cycleItem();
  updatePlayer(dt);
  if (G.busy) return;
  if (P('a')) { interact(); if (G.busy) return; }
  for (const e of G.ents) { TYPES[e.type].update(e, dt); if (G.busy) return; }
  const p = G.player;
  for (const pk of G.pickups) if (!pk.got && overlap(feet(p), { x: pk.x + 2, y: pk.y + 2, w: 12, h: 12 })) { collect(pk); break; }
  G.pickups = G.pickups.filter(pk => !pk.got);
  G.projs = G.projs.filter(s => {
    s.t -= dt;
    const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
    if (SOLID.has(tileAtPx(nx, ny))) s.t = 0; else { s.x = nx; s.y = ny; }
    if (s.t <= 0) { noise(s.x, s.y); return false; }
    return true;
  });
}

/* ---------- rendering ---------- */
const R_ = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
function pixelCircle(cx, cy, r, col) {
  ctx.fillStyle = col;
  const n = Math.max(12, Math.floor(r * 2.5));
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1); }
}
function frameBox(x, y, w, h, border) { R_(x, y, w, h, '#000'); R_(x + 1, y + 1, w - 2, 1, border); R_(x + 1, y + h - 2, w - 2, 1, border); R_(x + 1, y + 1, 1, h - 2, border); R_(x + w - 2, y + 1, 1, h - 2, border); }

function drawHUD() {
  R_(0, 0, W, HUD, '#000');
  drawText(ctx, 'PATIENCE', 6, 3, '#fcfcfc');
  for (let i = 0; i < G.maxPat; i++) {
    let col = '#383838';
    if (i < G.patience) col = G.patience > 10 ? '#38d838' : G.patience > 5 ? '#f8d800' : '#f83800';
    if (G.hurtFlash > 0 && i < G.patience && Math.floor(G.clock * 20) % 2) col = '#fcfcfc';
    R_(58 + i * 4, 3, 3, 7, col);
  }
  drawText(ctx, 'RANK', 150, 3, '#fcfcfc');
  for (let i = 0; i < 5; i++) ctx.drawImage(SPR.star(i < G.helped.size), 180 + i * 10, 3);
  drawText(ctx, 'ITEM', 6, 14, '#fcfcfc');
  R_(34, 12, 12, 12, '#7c7c7c'); R_(35, 13, 10, 10, '#000');
  const it = currentItem();
  if (it) {
    ctx.drawImage(SPR.icon(ITEMS[it].icon), 36, 14);
    drawText(ctx, ITEMS[it].name + (ITEMS[it].count ? ' X' + G.inv[it] : ''), 50, 14, '#fcfcfc');
  }
  const p = G.player;
  const st = p.hidden ? ['HIDDEN', '#58d8f8'] : p.coffeeT > 0 ? ['RUNNING', '#f89838'] : p.earplugs ? ['PLUGS IN', '#f8b858'] : null;
  if (st) drawTextR(ctx, st[0], 250, 14, st[1]);
  drawText(ctx, 'AREA: ' + G.R.name, 6, 24, '#7c7c7c');
  if (G.inv.ballot) drawTextR(ctx, G.flags.voted ? 'BALLOT: MARKED' : 'BALLOT: BLANK', 250, 24, G.flags.voted ? '#58f858' : '#bcbcbc');
}
function drawCone(e, c) {
  const ex = e.x + 8, ey = e.y + 8, base = Math.atan2(DIRV[e.dir][1], DIRV[e.dir][0]);
  ctx.beginPath(); ctx.moveTo(ex, ey);
  for (let i = -6; i <= 6; i++) {
    const a = base + c.half * i / 6;
    let d = 0;
    while (d < c.range) { d += 4; if (SIGHT.has(tileAtPx(ex + Math.cos(a) * d, ey + Math.sin(a) * d))) break; }
    ctx.lineTo(ex + Math.cos(a) * d, ey + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(' + c.col + ',0.2)'; ctx.fill();
}
function drawEmote(e) {
  const bx = Math.round(e.x) + 3, by = Math.round(e.y) - (e.type === 'kid' ? 6 : 12);
  R_(bx - 1, by - 1, 11, 11, '#000'); R_(bx, by, 9, 9, '#fcfcfc'); R_(bx + 3, by + 10, 3, 1, '#000');
  if (e.emote === '...') { [1, 4, 7].forEach(dx => R_(bx + dx, by + 6, 1, 1, '#000')); return; }
  drawText(ctx, e.emote, bx + 2, by + 1, { '!': '#d82800', '?': '#2858e8', '$': '#c838a8', '#': '#d82800' }[e.emote] || '#000');
}
function drawEnt(e) {
  const x = Math.round(e.x), y = Math.round(e.y);
  R_(x + 4, y + 14, 8, 2, 'rgba(0,0,0,0.25)');
  const fr = e.moving ? WALK[Math.floor(e.anim) % 4] : 0;
  if (e.isPlayer) {
    if (G.hurtFlash > 0 && Math.floor(G.hurtFlash * 20) % 2) return;
    if (e.hidden) ctx.drawImage(SPR.screen(e.moving ? Math.floor(e.anim) % 2 : 0), x, y);
    else ctx.drawImage(SPR.person(PAL.player, e.dir, fr), x, y);
    if (G.endFx && G.endFx.landed) { R_(x + 7, y + 9, 3, 2, '#fcfcfc'); R_(x + 8, y + 9, 1, 1, '#d82800'); }
    return;
  }
  if (e.type === 'kid') { ctx.drawImage(SPR.kid(PAL[e.pal], !e.calm, Math.floor(e.anim) % 2), x, y); return; }
  ctx.drawImage(SPR.person(PAL[e.pal], e.dir, fr), x, y);
}
function renderWorld() {
  ctx.save(); ctx.translate(0, HUD);
  ctx.drawImage(G.roomCanvas, 0, 0);
  if (G.R.booths) for (const col in G.R.booths) drawText(ctx, String(G.R.booths[col]), col * TS + 6, TS + 3, G.R.booths[col] === 4 ? '#d82800' : '#000');
  for (const pk of G.pickups) {
    const bob = Math.round(Math.sin(G.clock * 4 + pk.x) * 1.5), ix = pk.x + 4, iy = pk.y + 4 + bob;
    R_(pk.x + 4, pk.y + 13, 8, 2, 'rgba(0,0,0,0.25)');
    if (Math.floor(G.clock * 3) % 2) { R_(ix - 2, iy - 2, 12, 1, '#fcfcfc'); R_(ix - 2, iy + 9, 12, 1, '#fcfcfc'); R_(ix - 2, iy - 2, 1, 12, '#fcfcfc'); R_(ix + 9, iy - 2, 1, 12, '#fcfcfc'); }
    ctx.drawImage(SPR.icon(ITEMS[pk.item].icon), ix, iy);
  }
  for (const e of G.ents) { const c = TYPES[e.type].cone; if (c && !(e.cd > 0)) drawCone(e, c); }
  for (const r of G.rings) pixelCircle(r.x, r.y, r.r, r.col);
  const list = G.ents.concat([G.player]).sort((a, b) => a.y - b.y);
  for (const e of list) drawEnt(e);
  for (const s of G.projs) { const h = Math.sin((1 - s.t / s.T) * Math.PI) * 8; R_(Math.round(s.x) - 1, Math.round(s.y - h) - 1, 3, 3, '#fcfcfc'); R_(Math.round(s.x), Math.round(s.y - h), 1, 1, '#d82800'); }
  for (const e of list) if (e.emote) drawEmote(e);
  if (G.endFx && !G.endFx.landed) ctx.drawImage(SPR.icon('sticker'), Math.round(G.player.x + 4), Math.round(G.endFx.y));
  for (const f of G.floats) drawText(ctx, f.text, Math.round(f.x - textWidth(f.text) / 2), Math.round(f.y), f.col);
  ctx.restore();
}
function renderDlg(radioMode) {
  const x = 6, y = radioMode ? 150 : H - 58, w = 244, h = 52;
  frameBox(x, y, w, h, '#fcfcfc');
  if (Dlg.name) drawText(ctx, Dlg.name, x + 6, y + 5, '#f8d800');
  const pg = Dlg.pages[Dlg.page];
  let left = Math.floor(Dlg.shown);
  pg.forEach((l, i) => { drawText(ctx, l.slice(0, Math.max(0, left)), x + 6, y + 15 + i * 9, '#fcfcfc'); left -= l.length; });
  const full = Dlg.shown >= pg.join('').length, last = Dlg.page === Dlg.pages.length - 1;
  if (full && last && Dlg.choices) {
    let cx = x + 16;
    Dlg.choices.forEach((c, i) => {
      if (i === Dlg.sel) drawText(ctx, '>', cx - 8, y + 42, '#f8d800');
      drawText(ctx, c, cx, y + 42, i === Dlg.sel ? '#f8d800' : '#7c7c7c');
      cx += textWidth(c) + 22;
    });
  } else if (full && Math.floor(G.clock * 3) % 2) { R_(x + w - 13, y + h - 9, 5, 1, '#fcfcfc'); R_(x + w - 12, y + h - 8, 3, 1, '#fcfcfc'); R_(x + w - 11, y + h - 7, 1, 1, '#fcfcfc'); }
}
function renderRadio() {
  R_(0, 0, W, H, '#04101c');
  for (let yy = 0; yy < H; yy += 2) R_(0, yy, W, 1, 'rgba(0,0,0,0.3)');
  drawTextC(ctx, 'HOTLINE', 10, '#58f898');
  const speaking = Dlg.active ? Dlg.name : '';
  const typing = Dlg.active && Dlg.shown < Dlg.pages[Dlg.page].join('').length;
  const mouth = typing && Math.floor(G.clock * 10) % 2 === 0;
  [[16, 'hotline', HL], [176, 'voter', 'VOTER']].forEach(([x, kind, name]) => {
    const on = speaking === name;
    R_(x - 2, 28, 68, 68, on ? '#58f898' : '#2c5c44'); R_(x, 30, 64, 64, '#000');
    ctx.drawImage(SPR.portrait(kind, on && mouth), x, 30, 64, 64);
    drawText(ctx, name, x + 32 - Math.round(textWidth(name) / 2), 100, on ? '#58f898' : '#2c5c44');
  });
  const lit = Math.floor(G.clock * 4) % 6;
  for (let i = 0; i < 5; i++) { const bh = 4 + i * 3; R_(110 + i * 8, 70 - bh, 5, bh, i < lit ? '#58f898' : '#1c3c2c'); }
  drawTextC(ctx, 'EXT. 4-VOTE', 80, '#58f898');
  if (!Dlg.active && Math.floor(G.clock * 3) % 2) drawTextC(ctx, 'INCOMING CALL', 126, '#f8d800');
}
function renderCard() {
  const n = G.card.lines.length;
  R_(0, 84, W, n * 20 + 16, '#000');
  G.card.lines.forEach((l, i) => drawTextC(ctx, l, 92 + i * 20, i === 0 ? '#fcfcfc' : '#f8d800', 2));
}
function renderBallot() {
  const b = G.ballot, n = BALLOT.length, x0 = 16, y0 = HUD + 4, w = 224, h = 184;
  R_(x0 - 2, y0 - 2, w + 4, h + 4, '#000'); R_(x0, y0, w, h, '#f8f0d8');
  drawText(ctx, 'OFFICIAL BALLOT', x0 + (w - textWidth('OFFICIAL BALLOT')) / 2, y0 + 5, '#000');
  drawText(ctx, 'DISTRICT 7 - BOOTH 4', x0 + (w - textWidth('DISTRICT 7 - BOOTH 4')) / 2, y0 + 15, '#7c7c7c');
  R_(x0 + 6, y0 + 25, w - 12, 1, '#000');
  const blink = Math.floor(G.clock * 4) % 2;
  let y = y0 + 31;
  BALLOT.forEach((c, i) => {
    const lines = wrapText(c.q, 34);
    lines.forEach((l, j) => drawText(ctx, l, x0 + 8, y + j * 9, '#000'));
    y += lines.length * 9 + 3;
    c.opts.forEach((o, k) => {
      const ox = x0 + 18 + k * 100;
      R_(ox, y + 1, 7, 5, '#000');
      if (b.picks[i] !== k) R_(ox + 1, y + 2, 5, 3, '#f8f0d8');
      drawText(ctx, o, ox + 11, y, '#000');
      if (b.row === i && b.opt[i] === k && blink) drawText(ctx, '>', ox - 8, y, '#d82800');
    });
    y += 14;
  });
  const dy = y0 + h - 32, label = '[ DONE VOTING ]';
  drawText(ctx, label, x0 + (w - textWidth(label)) / 2, dy, b.row === n ? '#d82800' : '#000');
  if (b.row === n && blink) drawText(ctx, '>', x0 + (w - textWidth(label)) / 2 - 10, dy, '#d82800');
  drawText(ctx, 'ARROWS: CHOOSE  Z: MARK  BLANKS OK', x0 + 8, y0 + h - 14, '#7c7c7c');
}
function renderScanner() {
  const s = G.scanner;
  R_(0, HUD, W, PH, 'rgba(0,0,0,0.7)');
  frameBox(24, 46, 208, 160, '#fcfcfc');
  drawTextC(ctx, s.hits >= 3 ? 'SCANNER FIXED' : 'SCANNER JAMMED', 54, s.hits >= 3 ? '#58f858' : (Math.floor(G.clock * 3) % 2 ? '#f83800' : '#f8d800'));
  R_(72, 72, 112, 44, '#303840'); R_(72, 72, 112, 8, '#586068'); R_(84, 88, 88, 4, '#000');
  R_(166, 102, 6, 6, s.flash > 0 ? '#38f838' : '#f83800');
  R_(78, 102, 29, 9, '#f0f0f0'); drawText(ctx, 'VOTE', 81, 103, '#2858e8');
  const paperH = Math.max(0, 26 - s.hits * 9);
  if (paperH) { R_(114, 92, 40, paperH, '#f8f0d8'); R_(118, 96, 4, 3, '#000'); R_(118, 101, 4, 3, '#000'); }
  R_(64, 134, 128, 8, '#383838'); R_(64 + s.zx, 134, s.zw, 8, '#38d838');
  R_(64 + Math.round(s.pos) - 1, 130, 3, 16, '#fcfcfc');
  drawTextC(ctx, 'FEEDS: ' + s.hits + '/3', 152, '#fcfcfc');
  if (s.msgT > 0) drawTextC(ctx, s.msg, 168, s.msg.startsWith('BZZT') ? '#f85838' : '#58f858');
  drawTextC(ctx, 'PRESS Z IN THE GREEN', 188, '#7c7c7c');
}
function renderPause() {
  frameBox(8, HUD + 4, 240, 184, '#fcfcfc');
  drawTextC(ctx, 'PAUSED', HUD + 10, '#f8d800');
  drawText(ctx, 'ITEMS', 18, HUD + 24, '#7c7c7c');
  const list = owned();
  list.forEach((it, i) => {
    const y = HUD + 36 + i * 12;
    if (i === G.pause.sel) drawText(ctx, '>', 14, y, '#f8d800');
    ctx.drawImage(SPR.icon(ITEMS[it].icon), 22, y - 1);
    drawText(ctx, ITEMS[it].name + (ITEMS[it].count ? ' X' + G.inv[it] : '') + (it === currentItem() ? ' *' : ''), 34, y, i === G.pause.sel ? '#fcfcfc' : '#bcbcbc');
  });
  drawText(ctx, 'EQUIPMENT', 156, HUD + 24, '#7c7c7c');
  let ey = HUD + 36;
  for (const it of ['card', 'pen', 'ballot']) {
    if (!G.inv[it]) continue;
    ctx.drawImage(SPR.icon(ITEMS[it].icon), 156, ey - 1);
    drawText(ctx, it === 'card' ? 'CARD' : it === 'ballot' ? (G.flags.voted ? 'BALLOT (X)' : 'BALLOT') : 'PEN', 168, ey, '#bcbcbc');
    ey += 12;
  }
  const sel = list[G.pause.sel];
  if (sel) wrapText(ITEMS[sel].desc, 37).slice(0, 3).forEach((l, i) => drawText(ctx, l, 16, HUD + 140 + i * 9, '#fcfcfc'));
  drawTextC(ctx, 'Z: EQUIP   ENTER: RESUME   M: MUTE', HUD + 174, '#7c7c7c');
}
function renderTitle() {
  for (let i = 0; i < 40; i++) { const sx = (i * 73) % W, sy = (i * 41 + Math.floor(G.clock * 6)) % H; R_(sx, sy, 1, 1, i % 3 ? '#283040' : '#485878'); }
  const lg = SPR.logo();
  ctx.drawImage(lg, Math.round((W - lg.width) / 2), 22);
  drawTextC(ctx, 'TACTICAL CIVIC ACTION', 100, '#f8d800');
  const fr = WALK[Math.floor(G.clock * 6) % 4];
  ctx.drawImage(SPR.person(PAL.player, 3, fr), 92, 118, 32, 32);
  ctx.drawImage(SPR.screen(Math.floor(G.clock * 3) % 2), 132, 118, 32, 32);
  if (Math.floor(G.clock * 2) % 2 === 0) drawTextC(ctx, 'PRESS ENTER', 166, '#fcfcfc');
  drawTextC(ctx, 'A PARODY. NOT AFFILIATED WITH KONAMI.', 196, '#7c7c7c');
  drawTextC(ctx, 'M: MUTE', 208, '#545454');
}
function renderGameOver() {
  drawTextC(ctx, 'YOU WENT HOME', 60, '#f83800', 2);
  drawTextC(ctx, 'WITHOUT VOTING.', 82, '#f83800', 2);
  drawTextC(ctx, 'YOUR PATIENCE RAN OUT.', 114, '#bcbcbc');
  ['CONTINUE', 'QUIT TO TITLE'].forEach((o, i) => {
    const y = 144 + i * 14, on = G.go.sel === i;
    drawTextC(ctx, o, y, on ? '#f8d800' : '#7c7c7c');
    if (on) drawText(ctx, '>', Math.round((W - textWidth(o)) / 2) - 10, y, '#f8d800');
  });
}
function renderEnding() {
  drawTextC(ctx, 'MISSION COMPLETE', 20, '#f8d800', 2);
  const t = Math.floor(G.time), mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
  const rows = [['PEOPLE HELPED', G.helped.size + '/5'], ['SENT TO BACK OF LINE', String(G.caught)], ['TIME', mm + ':' + ss]];
  rows.forEach(([k, v], i) => { const y = 56 + i * 14; drawText(ctx, k, 36, y, '#fcfcfc'); drawTextR(ctx, v, 220, y, '#fcfcfc'); });
  for (let i = 0; i < 5; i++) ctx.drawImage(SPR.star(i < G.helped.size), 104 + i * 10, 108);
  const n = G.helped.size;
  drawTextC(ctx, 'CIVIC RANK: ' + (n >= 5 ? 'CIVIC HERO' : n >= 3 ? 'GOOD NEIGHBOR' : n >= 1 ? 'CONSTITUENT' : 'BYSTANDER'), 122, '#58f898');
  if (G.inv.pen) { drawTextC(ctx, 'P.S. YOU STILL HAVE', 148, '#bcbcbc'); drawTextC(ctx, "THE POLL WORKER'S PEN.", 158, '#bcbcbc'); }
  else drawTextC(ctx, 'THE POLL WORKER GOT THEIR PEN BACK.', 152, '#bcbcbc');
  drawTextC(ctx, 'THANKS FOR PLAYING', 182, '#fcfcfc');
  if (Math.floor(G.clock * 2) % 2 === 0) drawTextC(ctx, 'PRESS ENTER', 200, '#7c7c7c');
}
function render() {
  R_(0, 0, W, H, '#000');
  if (G.mode === 'title') renderTitle();
  else if (G.mode === 'ending') renderEnding();
  else if (G.mode === 'gameover') renderGameOver();
  else if (G.radio) { renderRadio(); if (Dlg.active) renderDlg(true); }
  else {
    drawHUD(); renderWorld();
    if (G.mode === 'ballot' && G.ballot) renderBallot();
    if (G.mode === 'scanner' && G.scanner) renderScanner();
    if (G.mode === 'pause') renderPause();
    if (G.card) renderCard();
    if (Dlg.active) renderDlg(false);
  }
  if (G.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + Math.ceil(G.fade * 4) / 4 + ')'; ctx.fillRect(0, 0, W, H); }
  if (Sound.muted) drawTextR(ctx, 'MUTE', 252, H - 9, '#545454');
}

/* ---------- loop ---------- */
let last = performance.now(), acc = 0;
const STEP = 1 / 60;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000); last = now;
  while (acc >= STEP) { update(STEP); Keys.pressed = {}; acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
Sound.play('title');
requestAnimationFrame(frame);

/* ---------- layout + touch controls ---------- */
const touchEl = document.getElementById('touch');
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) {
  touchEl.hidden = false;
  touchEl.querySelectorAll('button[data-k]').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', e => { e.preventDefault(); press(k); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => release(k)));
  });
}
function fit() {
  const availH = innerHeight - (touchEl.hidden ? 48 : 200);
  let s = Math.min(innerWidth / W, availH / H);
  if (s >= 2) s = Math.floor(s);
  s = Math.max(0.5, s);
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
}
addEventListener('resize', fit);
fit();
