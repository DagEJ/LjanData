// Sidespill: «Kontorkampen» – et forenklet slåssespill sett fra siden (à la klassiske arkade-fightere).
// Selvstendig modul: lager sitt eget overlegg inni #stage (eller <body>), sin egen canvas og egen løkke.
//
// Bruk:
//   Fight.start({
//     opponent: { name: 'Kari', look: { shirt, pants, hair, skin, shoes, hairStyle } },
//     player:   { name: 'Du',   look: { ... } },          // valgfri
//     onEnd(result) { ... }   // { outcome: 'win'|'lose'|'draw'|'forfeit', rounds: {player, opponent} }
//   });
//
// Taster:  A rett slag · S kraftslag · D uppercut · W spark (flygende; feiespark når du dukker, hoppespark i lufta)
//          ← → gå (hold bakover = blokker) · ↑ hopp · ↓ dukk · Esc pause

const Fight = (() => {
  const W = 960, H = 600;
  const GROUND = 520;
  const STEP = 1 / 60;
  const SCALE = 1.35;
  const GRAV = 0.8;
  const BODY_HALF = 22;
  const MIN_X = 60, MAX_X = W - 60;
  const ROUND_TIME = 60;
  const WINS_NEEDED = 2;
  const MAX_ROUNDS = 5;
  const BUFFER = 7; // antall bilder et tastetrykk huskes (input-buffer)

  const L = { thigh: 30, shin: 30, torso: 40, neck: 6, head: 13, upper: 21, fore: 21 };

  const PLAYER_LOOK = { shirt: '#ef6c2f', pants: '#2f3a56', hair: '#5a3825', skin: '#f1c27d', shoes: '#222', hairStyle: 'short' };

  // ---------- Poser ----------
  // Vinkler måles fra «rett ned», positiv = framover (mot motstanderen). lean = torsoens helning framover.
  const STANCE = { lean: 0.12, fl1: 0.45, fl2: 0.1, bl1: -0.45, bl2: -0.3, fa1: 0.5, fa2: 2.75, ba1: 0.3, ba2: 2.6 };
  const CROUCH = { lean: 0.45, fl1: 1.25, fl2: -0.6, bl1: 0.6, bl2: -1.3, fa1: 0.7, fa2: 2.65, ba1: 0.4, ba2: 2.5 };
  const P = (base, o) => Object.assign({}, base, o);
  const POSES = {
    stance: STANCE,
    crouch: CROUCH,
    jump: P(STANCE, { lean: 0.05, fl1: 1.1, fl2: -0.5, bl1: 0.4, bl2: -1.1, fa1: 1.0, fa2: 2.9, ba1: 0.7, ba2: 2.8 }),
    block: P(STANCE, { lean: -0.12, fa1: 1.25, fa2: 2.95, ba1: 1.05, ba2: 3.0 }),
    crouchBlock: P(CROUCH, { lean: 0.25, fa1: 1.3, fa2: 2.95, ba1: 1.1, ba2: 3.0 }),
    hit: P(STANCE, { lean: -0.5, fa1: 0.9, fa2: 0.4, ba1: -0.5, ba2: 0.2 }),
    crouchHit: P(CROUCH, { lean: 0.0, fa1: 0.9, fa2: 0.4, ba1: -0.5, ba2: 0.2 }),
    down: { lean: 0, fl1: 0.05, fl2: 0.05, bl1: -0.05, bl2: -0.05, fa1: 2.7, fa2: 2.9, ba1: 2.4, ba2: 2.6 },
    getup: P(CROUCH, { lean: 0.6 }),
    win: P(STANCE, { lean: -0.05, fl1: 0.2, fl2: 0.05, bl1: -0.2, bl2: -0.1, fa1: 2.85, fa2: 3.1, ba1: 2.6, ba2: 3.0 }),
    point: P(STANCE, { lean: 0.15, fa1: 1.55, fa2: 1.6 }),
    taunt: P(STANCE, { lean: -0.05, fa1: 0.4, fa2: 0.2, ba1: 0.5, ba2: 2.9 }),
    relaxed: { lean: 0.02, fl1: 0.12, fl2: 0.02, bl1: -0.12, bl2: -0.02, fa1: 0.25, fa2: 0.2, ba1: -0.15, ba2: -0.1 },
    shrug: { lean: -0.04, fl1: 0.12, fl2: 0.02, bl1: -0.12, bl2: -0.02, fa1: 0.5, fa2: 1.9, ba1: -0.35, ba2: 1.2 },
    // angrep: windup -> strike
    jabW: P(STANCE, { fa1: 0.8, fa2: 2.3 }),
    jabS: P(STANCE, { lean: 0.28, fl1: 0.6, fa1: 1.52, fa2: 1.55 }),
    crossW: P(STANCE, { lean: -0.05, ba1: 0.05, ba2: 2.2 }),
    crossS: P(STANCE, { lean: 0.42, bl1: -0.65, bl2: -0.6, fa1: 0.35, fa2: 2.4, ba1: 1.55, ba2: 1.55 }),
    upperW: P(STANCE, { lean: 0.4, fl1: 0.95, fl2: -0.45, bl1: -0.2, bl2: -0.9, ba1: 0.15, ba2: 0.9 }),
    upperS: P(STANCE, { lean: -0.12, fl1: 0.3, fl2: 0.0, ba1: 2.45, ba2: 3.0 }),
    lowkW: P(STANCE, { lean: -0.05, fl1: 0.95, fl2: -0.35, bl1: -0.15, bl2: -0.15 }),
    lowkS: P(STANCE, { lean: -0.28, fl1: 1.25, fl2: 1.45, bl1: -0.1, bl2: -0.1 }),
    highkW: P(STANCE, { lean: -0.2, fl1: 1.6, fl2: 0.2, bl1: -0.08, bl2: -0.08 }),
    highkS: P(STANCE, { lean: -0.45, fl1: 2.15, fl2: 2.15, bl1: -0.05, bl2: -0.05, fa1: 0.9, fa2: 2.9, ba1: -0.3, ba2: 0.4 }),
    flyW: P(STANCE, { lean: 0.1, fl1: 1.2, fl2: -0.6, bl1: 0.6, bl2: -1.2, fa1: 1.0, fa2: 2.8 }),
    flyS: P(STANCE, { lean: -0.38, fl1: 1.8, fl2: 1.8, bl1: 0.7, bl2: -1.3, fa1: 0.6, fa2: 2.6, ba1: -0.6, ba2: 0.0 }),
    cpunchW: P(CROUCH, { fa1: 0.9, fa2: 2.2 }),
    cpunchS: P(CROUCH, { lean: 0.6, fa1: 1.6, fa2: 1.6 }),
    sweepW: P(CROUCH, { lean: 0.55, fl1: 1.1, fl2: 0.2 }),
    sweepS: { lean: 0.65, fl1: 1.55, fl2: 1.6, bl1: 0.9, bl2: -1.6, fa1: 0.25, fa2: 0.3, ba1: 0.1, ba2: 0.2 },
    airkW: P(STANCE, { lean: 0.05, fl1: 1.1, fl2: -0.6, bl1: 0.4, bl2: -1.1 }),
    airkS: P(STANCE, { lean: -0.25, fl1: 1.45, fl2: 1.25, bl1: 0.5, bl2: -1.2, fa1: 1.0, fa2: 2.8, ba1: -0.4, ba2: 0.3 }),
  };
  const POSE_KEYS = Object.keys(STANCE);

  // ---------- Angrep ----------
  // level: high (bommer på dukkende), mid, low (bommer på hoppende, må blokkes dukkende), overhead (må blokkes stående)
  const ATTACKS = {
    jab: { name: 'Rett slag', w: 'jabW', s: 'jabS', tip: 'fh', start: 5, active: 3, rec: 9, dmg: 5, level: 'high', stun: 13, push: 4, step: 1.2 },
    cross: { name: 'Kraftslag', w: 'crossW', s: 'crossS', tip: 'bh', start: 9, active: 4, rec: 15, dmg: 9, level: 'high', stun: 17, push: 6, step: 2 },
    upper: { name: 'Uppercut', w: 'upperW', s: 'upperS', tip: 'bh', start: 11, active: 4, rec: 20, dmg: 13, level: 'mid', stun: 22, push: 8, step: 1.5, knock: true },
    lowkick: { name: 'Lavt spark', w: 'lowkW', s: 'lowkS', tip: 'ff', start: 7, active: 4, rec: 14, dmg: 8, level: 'low', stun: 15, push: 5, step: 0.8 },
    highkick: { name: 'Høyt spark', w: 'highkW', s: 'highkS', tip: 'ff', start: 12, active: 5, rec: 20, dmg: 14, level: 'high', stun: 20, push: 10, step: 0.8 },
    flykick: { name: 'Flygende spark', w: 'flyW', s: 'flyS', tip: 'ff', start: 9, active: 12, rec: 14, dmg: 15, level: 'mid', stun: 22, push: 10, hop: { vz: 9, vx: 6 }, knock: true },
    cpunch: { name: 'Lavt slag', w: 'cpunchW', s: 'cpunchS', tip: 'fh', start: 5, active: 3, rec: 10, dmg: 5, level: 'low', stun: 12, push: 3, crouch: true },
    sweep: { name: 'Feiespark', w: 'sweepW', s: 'sweepS', tip: 'ff', start: 9, active: 5, rec: 22, dmg: 9, level: 'low', stun: 20, push: 4, crouch: true, knock: true },
    airkick: { name: 'Hoppespark', w: 'airkW', s: 'airkS', tip: 'ff', start: 4, active: 99, rec: 6, dmg: 10, level: 'overhead', stun: 18, push: 6, air: true },
  };
  const KEY_ATTACK = { KeyA: 'jab', KeyS: 'cross', KeyD: 'upper', KeyW: 'flykick' };
  const PUNCHES = new Set(['jab', 'cross', 'upper']);

  // ---------- Lyd (WebAudio, ingen filer) ----------
  let ac = null;
  function actx() {
    if (typeof Sfx !== 'undefined' && Sfx.muted) return null;
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type = 'sine', vol = 0.1, slide = 0, delay = 0) {
    const a = actx(); if (!a) return;
    const t0 = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(dur, vol = 0.1, freq = 800, delay = 0, q = 1) {
    const a = actx(); if (!a) return;
    const t0 = a.currentTime + delay;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(a.destination);
    src.start(t0);
  }
  const sfx = {
    whoosh: () => noise(0.12, 0.05, 1800, 0, 0.7),
    hit: (big) => { noise(big ? 0.22 : 0.14, big ? 0.32 : 0.22, big ? 260 : 420); tone(big ? 90 : 140, 0.15, 'square', 0.08, -40); },
    block: () => { tone(900, 0.05, 'square', 0.05); noise(0.06, 0.08, 2500); },
    land: () => noise(0.08, 0.06, 200),
    thud: () => { noise(0.35, 0.3, 120); tone(70, 0.3, 'sine', 0.15, -30); },
    bell: () => { tone(880, 0.9, 'sine', 0.1); tone(1320, 0.7, 'sine', 0.05); },
    ko: () => [330, 262, 196, 131].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.07, 0, i * 0.16)),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, 'triangle', 0.1, 0, i * 0.12)),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.06, 0, i * 0.25)),
    talk: () => tone(500 + Math.random() * 200, 0.04, 'square', 0.025),
  };

  // ---------- Skjelett ----------
  function skeleton(p) {
    const legY = (a1, a2) => Math.cos(a1) * L.thigh + Math.cos(a2) * L.shin;
    const hipH = Math.max(legY(p.fl1, p.fl2), legY(p.bl1, p.bl2), 8);
    const hip = { x: 0, y: -hipH };
    const pt = (j, a, len) => ({ x: j.x + Math.sin(a) * len, y: j.y + Math.cos(a) * len });
    const fk = pt(hip, p.fl1, L.thigh), ff = pt(fk, p.fl2, L.shin);
    const bk = pt(hip, p.bl1, L.thigh), bf = pt(bk, p.bl2, L.shin);
    const sh = { x: hip.x + Math.sin(p.lean) * L.torso, y: hip.y - Math.cos(p.lean) * L.torso };
    const nl = L.neck + L.head;
    const head = { x: sh.x + Math.sin(p.lean * 0.7) * nl, y: sh.y - Math.cos(p.lean * 0.7) * nl };
    const fe = pt(sh, p.fa1, L.upper), fh = pt(fe, p.fa2, L.fore);
    const be = pt(sh, p.ba1, L.upper), bh = pt(be, p.ba2, L.fore);
    return { hip, fk, ff, bk, bf, sh, head, fe, fh, be, bh };
  }

  function lerpPose(a, b, t) {
    const o = {};
    for (const k of POSE_KEYS) o[k] = a[k] + (b[k] - a[k]) * t;
    return o;
  }
  const ease = (t) => t * t * (3 - 2 * t);

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  }

  // Tegner en figur i lokale koordinater (føtter i origo, ansikt mot høyre).
  function drawFigure(c, pose, look, opts = {}) {
    const s = skeleton(pose);
    const limb = (a, b, w, col) => {
      c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    };
    const shoe = (k, f, col) => {
      const ang = Math.atan2(f.y - k.y, f.x - k.x) - Math.PI / 2;
      c.save(); c.translate(f.x, f.y); c.rotate(ang);
      c.fillStyle = col;
      c.beginPath(); c.ellipse(4, 0, 9, 5, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    };
    const fist = (p, col) => { c.fillStyle = col; c.beginPath(); c.arc(p.x, p.y, 5.5, 0, Math.PI * 2); c.fill(); };
    const dark = (col) => shade(col, -0.28);

    // bakre arm og bein
    limb(s.hip, s.bk, 13, dark(look.pants));
    limb(s.bk, s.bf, 11, dark(look.pants));
    shoe(s.bk, s.bf, dark(look.shoes));
    limb(s.sh, s.be, 10, dark(look.shirt));
    limb(s.be, s.bh, 9, dark(look.skin));
    fist(s.bh, dark(look.skin));

    // overkropp
    limb(s.hip, s.sh, 24, look.shirt);
    c.fillStyle = look.pants;
    c.beginPath(); c.arc(s.hip.x, s.hip.y, 10, 0, Math.PI * 2); c.fill();
    // belte
    c.strokeStyle = '#1d1d22'; c.lineWidth = 4; c.lineCap = 'butt';
    const tx = Math.sin(pose.lean), ty = -Math.cos(pose.lean);
    const bx = s.hip.x + tx * 6, by = s.hip.y + ty * 6;
    c.beginPath(); c.moveTo(bx - ty * 12, by + tx * 12); c.lineTo(bx + ty * 12, by - tx * 12); c.stroke();
    // slips / ID-kort
    if (look.tie) {
      c.strokeStyle = look.tie; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(s.sh.x + 6, s.sh.y + 4); c.lineTo(s.sh.x + 6 - tx * 18 + 4, s.sh.y + 4 - ty * 18); c.stroke();
    } else {
      c.fillStyle = '#fff';
      c.save(); c.translate(s.sh.x + 4 + -ty * 3, s.sh.y + 14); c.rotate(pose.lean);
      c.fillRect(2, 0, 6, 8); c.fillStyle = '#3a6ea5'; c.fillRect(2, 0, 6, 2);
      c.restore();
    }

    // hode
    const h = s.head;
    c.fillStyle = look.skin;
    c.beginPath(); c.arc(h.x, h.y, L.head, 0, Math.PI * 2); c.fill();
    c.fillStyle = look.hair;
    c.beginPath();
    if (look.hairStyle === 'bald') {
      c.arc(h.x - 2, h.y, L.head + 0.5, Math.PI * 0.75, Math.PI * 1.05);
      c.lineTo(h.x - 2, h.y);
    } else {
      c.arc(h.x - 1, h.y - 1, L.head + 1, Math.PI * 0.95, Math.PI * 1.95);
      c.lineTo(h.x + 4, h.y - 6);
      c.lineTo(h.x - 8, h.y + 2);
    }
    c.fill();
    if (look.hairStyle === 'long') {
      c.beginPath(); c.ellipse(h.x - 9, h.y + 8, 6, 14, 0.2, 0, Math.PI * 2); c.fill();
    } else if (look.hairStyle === 'bun') {
      c.beginPath(); c.arc(h.x - 12, h.y - 9, 6, 0, Math.PI * 2); c.fill();
    }
    // ansikt
    c.fillStyle = '#2b2b2b';
    const ko = opts.face === 'ko';
    if (ko) {
      c.strokeStyle = '#2b2b2b'; c.lineWidth = 1.6; c.lineCap = 'round';
      c.beginPath(); c.moveTo(h.x + 4, h.y - 4); c.lineTo(h.x + 8, h.y); c.moveTo(h.x + 8, h.y - 4); c.lineTo(h.x + 4, h.y); c.stroke();
    } else if (opts.face === 'hurt') {
      c.fillRect(h.x + 4, h.y - 2, 4, 1.6);
    } else {
      c.fillRect(h.x + 5, h.y - 4, 2.6, 4);
      // øyenbryn – sint når man slåss
      c.fillRect(h.x + 3, h.y - 7, 6, 1.6);
    }
    if (look.glasses) {
      c.strokeStyle = '#222'; c.lineWidth = 1.4;
      c.strokeRect(h.x + 2, h.y - 5, 8, 6);
      c.beginPath(); c.moveTo(h.x + 2, h.y - 3); c.lineTo(h.x - 6, h.y - 4); c.stroke();
    }
    c.fillStyle = opts.face === 'win' ? '#7a2a2a' : '#5b3a2a';
    if (opts.face === 'win' || opts.face === 'talk') {
      c.beginPath(); c.ellipse(h.x + 8, h.y + 5, 2.6, opts.face === 'talk' ? 2.4 : 2, 0, 0, Math.PI * 2); c.fill();
    } else {
      c.fillRect(h.x + 5, h.y + 5, 5, 1.6);
    }
    // øre
    c.fillStyle = shade(look.skin, -0.12);
    c.beginPath(); c.arc(h.x - 3, h.y + 1, 3, 0, Math.PI * 2); c.fill();

    // fremre bein og arm
    limb(s.hip, s.fk, 13, look.pants);
    limb(s.fk, s.ff, 11, look.pants);
    shoe(s.fk, s.ff, look.shoes);
    limb(s.sh, s.fe, 10, look.shirt);
    limb(s.fe, s.fh, 9, look.skin);
    fist(s.fh, look.skin);

    return s;
  }

  // ---------- Kjempere ----------
  function makeFighter(name, look, x, facing, isAI) {
    return {
      name, look, isAI,
      x, z: 0, vx: 0, vz: 0, facing,
      hp: 100, shownHp: 100,
      state: 'idle', timer: 0, frame: 0,
      attack: null, attackKey: null, hasHit: false,
      crouching: false, blocking: false,
      walkPhase: 0, rot: 0,
      pose: Object.assign({}, STANCE),
      flash: 0, combo: 0,
      input: { left: false, right: false, up: false, down: false },
      buffer: null, bufferT: 0,
      ai: { think: 0, hold: null, holdT: 0, cool: 40 },
      speech: null,
    };
  }

  const grounded = (f) => f.z <= 0 && f.vz === 0;
  const neutral = (f) => ['idle', 'walk', 'crouch'].includes(f.state);

  function startAttack(f, key) {
    let k = key;
    if (!grounded(f)) k = 'airkick';
    else if (f.input.down) k = PUNCHES.has(key) ? 'cpunch' : 'sweep';
    const a = ATTACKS[k];
    f.state = 'attack';
    f.attack = a;
    f.attackKey = k;
    f.frame = 0;
    f.hasHit = false;
    f.crouching = !!a.crouch;
    f.blocking = false;
    if (a.hop) { f.vz = a.hop.vz; f.z = 0.01; f.vx = f.facing * a.hop.vx; }
    if (!a.air) f.vx = f.facing * (a.step || 0);
    sfx.whoosh();
  }

  function targetPose(f, time) {
    switch (f.state) {
      case 'idle': {
        const b = Math.sin(time * 4 + (f.isAI ? 1 : 0));
        return P(STANCE, { fl1: STANCE.fl1 + b * 0.04, bl1: STANCE.bl1 - b * 0.04, fa2: STANCE.fa2 + b * 0.05 });
      }
      case 'walk': {
        const s = Math.sin(f.walkPhase), c2 = Math.cos(f.walkPhase);
        const base = f.blocking ? POSES.block : STANCE;
        return P(base, { fl1: 0.45 + s * 0.3, fl2: 0.1 - Math.max(0, c2) * 0.4, bl1: -0.45 - s * 0.3, bl2: -0.3 - Math.max(0, -c2) * 0.4 });
      }
      case 'crouch': return f.blocking ? POSES.crouchBlock : CROUCH;
      case 'jump': return POSES.jump;
      case 'block': return f.crouching ? POSES.crouchBlock : POSES.block;
      case 'hit': return f.crouching ? POSES.crouchHit : POSES.hit;
      case 'down': case 'ko': return POSES.down;
      case 'getup': return POSES.getup;
      case 'win': {
        const b = Math.sin(time * 6) * 0.15;
        return P(POSES.win, { fa1: POSES.win.fa1 + b, ba1: POSES.win.ba1 - b });
      }
      case 'point': return POSES.point;
      case 'taunt': return POSES.taunt;
      case 'attack': {
        const a = f.attack, fr = f.frame;
        const W0 = POSES[a.w], S0 = POSES[a.s];
        const base = a.crouch ? CROUCH : a.air ? POSES.jump : STANCE;
        if (fr < a.start) {
          const t = fr / a.start;
          return t < 0.55 ? lerpPose(base, W0, ease(t / 0.55)) : lerpPose(W0, S0, ease((t - 0.55) / 0.45));
        }
        if (fr < a.start + a.active) return S0;
        return lerpPose(S0, base, ease(Math.min(1, (fr - a.start - a.active) / a.rec)));
      }
      default: return STANCE;
    }
  }

  // ---------- Overlegg / DOM ----------
  let root = null, canvas = null, ctx = null, panel = null, help = null;
  let bg = null;
  let running = false, raf = 0, last = 0, acc = 0;
  let M = null; // kampens tilstand
  const keys = {};

  function buildDom() {
    if (root) return;
    const host = document.getElementById('stage') || document.body;
    root = document.createElement('div');
    root.id = 'fightOverlay';
    root.className = 'hidden';
    root.innerHTML = `
      <canvas id="fightCanvas" width="${W}" height="${H}"></canvas>
      <div class="fight-help">
        <span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> slag</span>
        <span><kbd>W</kbd> spark</span>
        <span><kbd>↑</kbd> hopp</span>
        <span><kbd>↓</kbd> dukk</span>
        <span><kbd>←</kbd><kbd>→</kbd> gå · hold bakover = blokk</span>
        <span><kbd>Esc</kbd> pause</span>
      </div>
      <div class="fight-panel hidden">
        <div class="fight-card">
          <h2 class="fp-title"></h2>
          <p class="fp-text"></p>
          <div class="fp-buttons"></div>
        </div>
      </div>`;
    host.appendChild(root);
    canvas = root.querySelector('canvas');
    ctx = canvas.getContext('2d');
    panel = root.querySelector('.fight-panel');
    help = root.querySelector('.fight-help');

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  }

  const GAME_KEYS = new Set(['KeyA', 'KeyS', 'KeyD', 'KeyW', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'KeyM', 'KeyI']);
  function onKey(e) {
    if (!running) return;
    // Kampen «eier» tastaturet mens den pågår – hovedspillet skal ikke få med seg noe.
    const isGameKey = GAME_KEYS.has(e.code);
    if (isGameKey) e.preventDefault();
    e.stopImmediatePropagation();
    if (e.type === 'keyup') { keys[e.code] = false; return; }
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'Escape') { togglePause(); return; }
    if (M && M.paused) return;
    if (KEY_ATTACK[e.code] && M && M.player) {
      M.player.buffer = KEY_ATTACK[e.code];
      M.player.bufferT = BUFFER;
    }
  }

  function showPanel(title, text, buttons) {
    panel.querySelector('.fp-title').textContent = title;
    panel.querySelector('.fp-text').textContent = text;
    const box = panel.querySelector('.fp-buttons');
    box.innerHTML = '';
    for (const b of buttons) {
      const el = document.createElement('button');
      el.className = 'fight-btn' + (b.secondary ? ' secondary' : '');
      el.textContent = b.label;
      el.addEventListener('click', b.onClick);
      box.appendChild(el);
    }
    panel.classList.remove('hidden');
    const first = box.querySelector('button');
    if (first) first.focus();
  }
  function hidePanel() { panel.classList.add('hidden'); }

  function togglePause() {
    if (!M || M.phase === 'over') return;
    M.paused = !M.paused;
    if (M.paused) {
      showPanel('Pause', 'Pust med magen. Eggene er der fortsatt.', [
        { label: 'Fortsett', onClick: () => togglePause() },
        { label: 'Gi opp kampen', secondary: true, onClick: () => finish('forfeit') },
      ]);
    } else {
      hidePanel();
      last = performance.now();
    }
  }

  // ---------- Bakgrunn ----------
  let ratio = 1;
  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = Math.round(W * ratio); bg.height = Math.round(H * ratio);
    bg.ratio = ratio;
    const c = bg.getContext('2d');
    c.scale(ratio, ratio);
    // vegg
    const wg = c.createLinearGradient(0, 0, 0, 440);
    wg.addColorStop(0, '#c9ced8'); wg.addColorStop(1, '#e3e2dc');
    c.fillStyle = wg; c.fillRect(0, 0, W, 440);
    // tak og lysrør
    c.fillStyle = '#eef0f3'; c.fillRect(0, 0, W, 34);
    c.fillStyle = '#b8bdc6'; c.fillRect(0, 34, W, 4);
    for (let x = 60; x < W; x += 230) {
      c.fillStyle = '#fffbe6'; c.fillRect(x, 12, 140, 10);
      const lg = c.createLinearGradient(0, 22, 0, 200);
      lg.addColorStop(0, 'rgba(255,250,220,0.35)'); lg.addColorStop(1, 'rgba(255,250,220,0)');
      c.fillStyle = lg;
      c.beginPath(); c.moveTo(x, 22); c.lineTo(x + 140, 22); c.lineTo(x + 190, 200); c.lineTo(x - 50, 200); c.closePath(); c.fill();
    }
    // vinduer med byutsikt i skumring
    for (const wx of [40, 520]) {
      const ww = 400, wy = 70, wh = 200;
      c.fillStyle = '#5b6573'; c.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      const sky = c.createLinearGradient(0, wy, 0, wy + wh);
      sky.addColorStop(0, '#2c3e6b'); sky.addColorStop(0.6, '#d9786a'); sky.addColorStop(1, '#f2b880');
      c.fillStyle = sky; c.fillRect(wx, wy, ww, wh);
      let seed = wx + 7;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let bx = wx; bx < wx + ww; bx += 26 + rnd() * 20) {
        const bw = 24 + rnd() * 30, bh = 40 + rnd() * 120;
        c.fillStyle = '#273049'; c.fillRect(bx, wy + wh - bh, bw, bh);
        c.fillStyle = 'rgba(255,220,130,0.8)';
        for (let yy = wy + wh - bh + 6; yy < wy + wh - 6; yy += 12)
          for (let xx = bx + 4; xx < bx + bw - 6; xx += 9) if (rnd() > 0.55) c.fillRect(xx, yy, 4, 5);
      }
      c.fillStyle = '#5b6573';
      c.fillRect(wx + ww / 2 - 3, wy, 6, wh);
      c.fillRect(wx, wy + wh / 2 - 2, ww, 4);
      c.fillStyle = '#d7d9de'; c.fillRect(wx - 10, wy + wh + 6, ww + 20, 8);
    }
    // tavle
    c.fillStyle = '#9aa1ab'; c.fillRect(398, 300, 164, 104);
    c.fillStyle = '#fbfbf7'; c.fillRect(402, 304, 156, 96);
    c.fillStyle = '#c0392b'; c.font = 'bold 15px "Trebuchet MS", sans-serif'; c.textAlign = 'center';
    c.fillText('HAR NOEN SETT', 480, 336);
    c.fillText('EGGENE MINE?!', 480, 356);
    c.fillStyle = '#2c3e50'; c.font = '13px "Trebuchet MS", sans-serif';
    c.fillText('– hilsen Kåre', 480, 384);
    c.textAlign = 'left';
    // gulvlist
    c.fillStyle = '#8b8f99'; c.fillRect(0, 432, W, 10);
    // gulv
    const fg = c.createLinearGradient(0, 442, 0, H);
    fg.addColorStop(0, '#7f8fa0'); fg.addColorStop(1, '#5d6b7a');
    c.fillStyle = fg; c.fillRect(0, 442, W, H - 442);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
    for (let i = -20; i <= 20; i++) {
      c.beginPath(); c.moveTo(W / 2 + i * 50, 442); c.lineTo(W / 2 + i * 120, H); c.stroke();
    }
    for (const y of [460, 485, 520, 565]) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // bakgrunnsmøbler: skrivebord med skjermer, vannkjøler, plante
    const desk = (x) => {
      c.fillStyle = '#b08155'; c.fillRect(x, 392, 150, 10);
      c.fillStyle = '#8a6240'; c.fillRect(x + 6, 402, 8, 34); c.fillRect(x + 136, 402, 8, 34);
      c.fillStyle = '#2b2f3a'; c.fillRect(x + 40, 340, 70, 46);
      c.fillStyle = '#5fa8d3'; c.fillRect(x + 44, 344, 62, 38);
      c.fillStyle = '#2b2f3a'; c.fillRect(x + 70, 386, 10, 6);
      c.fillStyle = '#e8e2d0'; c.fillRect(x + 116, 382, 18, 10);
    };
    desk(110); desk(700);
    // vannkjøler
    c.fillStyle = '#e8eef3'; c.fillRect(612, 360, 40, 76);
    c.fillStyle = 'rgba(120,190,240,0.75)'; c.beginPath(); c.ellipse(632, 340, 18, 24, 0, 0, Math.PI * 2); c.fill();
    // plante
    c.fillStyle = '#a0522d'; c.fillRect(890, 400, 36, 36);
    c.fillStyle = '#3f8f4f';
    for (let i = 0; i < 7; i++) { c.beginPath(); c.ellipse(908 + Math.cos(i) * 14, 380 - Math.sin(i * 1.7) * 18, 9, 20, i, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#a0522d'; c.fillRect(30, 400, 36, 36);
    c.fillStyle = '#4b9a5a';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(48 + Math.sin(i * 2) * 12, 382 - i * 6, 8, 18, i * 0.9, 0, Math.PI * 2); c.fill(); }
  }

  // Tilskuere (kollegaer som heier i bakgrunnen)
  const CROWD = [
    { x: 260, shirt: '#8e44ad', hair: '#2c1b10', skin: '#e0ac69', ph: 0 },
    { x: 330, shirt: '#16a085', hair: '#d9a441', skin: '#f1c27d', ph: 1.2 },
    { x: 760, shirt: '#c0392b', hair: '#111', skin: '#8d5524', ph: 2.1 },
    { x: 840, shirt: '#2980b9', hair: '#7a4b2a', skin: '#f5d0a9', ph: 0.6 },
  ];
  function drawCrowd(c, time) {
    const ex = M ? M.excite : 0;
    for (const p of CROWD) {
      const jump = Math.max(0, Math.sin(time * (4 + ex * 6) + p.ph)) * (2 + ex * 10);
      const y = 438 - jump;
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.beginPath(); c.ellipse(p.x, 440, 16, 4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = shade(p.shirt, -0.15);
      c.fillRect(p.x - 13, y - 48, 26, 40);
      c.fillStyle = '#3b3f4c'; c.fillRect(p.x - 11, y - 10, 22, 10);
      // armer opp når det er spennende
      c.strokeStyle = shade(p.shirt, -0.15); c.lineWidth = 7; c.lineCap = 'round';
      const up = ex > 0.3 ? -1 : 0.3;
      c.beginPath();
      c.moveTo(p.x - 12, y - 44); c.lineTo(p.x - 20, y - 44 + up * 20);
      c.moveTo(p.x + 12, y - 44); c.lineTo(p.x + 20, y - 44 + up * 20);
      c.stroke();
      c.fillStyle = p.skin; c.beginPath(); c.arc(p.x, y - 60, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.hair; c.beginPath(); c.arc(p.x, y - 63, 11.5, Math.PI, Math.PI * 2); c.fill();
    }
  }

  // ---------- Partikler ----------
  function spark(x, y, dir, big, blocked) {
    const n = blocked ? 8 : big ? 18 : 12;
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 2.4 + (dir > 0 ? 0 : Math.PI);
      const sp = 2 + Math.random() * (big ? 8 : 5);
      M.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: 18 + Math.random() * 10, max: 28, col: blocked ? '#9fd3ff' : (Math.random() < 0.5 ? '#fff3a0' : '#ffb347') });
    }
    M.rings.push({ x, y, r: 6, life: 10, col: blocked ? 'rgba(160,210,255,' : 'rgba(255,240,170,' });
  }

  // ---------- Kampflyt ----------
  function newMatch(opts) {
    const pl = opts.player || {};
    const op = opts.opponent || {};
    M = {
      opts,
      phase: 'intro', t: 0, time: 0,
      round: 1, wins: { p: 0, o: 0 },
      clock: ROUND_TIME,
      player: makeFighter(pl.name || 'Du', Object.assign({}, PLAYER_LOOK, pl.look || {}), 300, 1, false),
      opp: makeFighter(op.name || 'Kollega', Object.assign({}, PLAYER_LOOK, { shirt: '#3a6ea5', hair: '#222' }, op.look || {}), 660, -1, true),
      parts: [], rings: [], banner: null, shake: 0, hitstop: 0, slow: 1, slowT: 0,
      excite: 0, paused: false, result: null, comboText: null,
    };
    M.player.state = 'point';
    M.opp.state = 'taunt';
  }

  function resetRound() {
    const p = M.player, o = M.opp;
    for (const [f, x, fc] of [[p, 300, 1], [o, 660, -1]]) {
      Object.assign(f, { x, z: 0, vx: 0, vz: 0, facing: fc, hp: 100, shownHp: 100, state: 'idle', timer: 0, frame: 0, attack: null, crouching: false, blocking: false, rot: 0, combo: 0, buffer: null, bufferT: 0 });
      f.ai = { think: 0, hold: null, holdT: 0, cool: 50 };
    }
    M.clock = ROUND_TIME;
    M.parts.length = 0;
    M.rings.length = 0;
  }

  function setBanner(text, dur, opt = {}) {
    M.banner = { text, t: 0, dur, color: opt.color || '#ffd23f', small: opt.small };
  }

  function canAct() { return M.phase === 'fight'; }

  // ---------- Kunstig intelligens ----------
  function aiInput(f, opp) {
    const ai = f.ai;
    const inp = { left: false, right: false, up: false, down: false };
    const fwd = f.facing === 1 ? 'right' : 'left';
    const back = f.facing === 1 ? 'left' : 'right';
    const dist = Math.abs(opp.x - f.x);
    const lvl = Math.min(1, 0.55 + 0.15 * (M.round - 1));

    if (ai.holdT > 0) {
      ai.holdT--;
      for (const k of ai.hold) inp[k] = true;
      return inp;
    }
    ai.cool = Math.max(0, ai.cool - 1);

    // reager på angrep
    const oppAtk = opp.state === 'attack' && opp.frame < opp.attack.start + Math.min(opp.attack.active, 6);
    if (oppAtk && dist < 170 && f.state !== 'attack') {
      if (!ai.reacted) {
        ai.reacted = true;
        if (Math.random() < 0.2 + lvl * 0.3) {
          const lv = opp.attack.level;
          if (lv === 'high' && Math.random() < 0.5) { ai.hold = ['down']; ai.holdT = 16; }
          else if (lv === 'low') { ai.hold = ['down', back]; ai.holdT = 18; }
          else { ai.hold = [back]; ai.holdT = 18; }
          return aiInput(f, opp);
        }
      }
    } else ai.reacted = false;

    if (!neutral(f)) return inp;

    if (ai.think > 0) { ai.think--; if (ai.cur) for (const k of ai.cur) inp[k] = true; return inp; }
    ai.cur = null;
    ai.think = 6 + Math.floor(Math.random() * 10);

    if (dist > 150) {
      if (Math.random() < 0.05) { ai.hold = ['up', fwd]; ai.holdT = 4; ai.airAttack = true; return aiInput(f, opp); }
      ai.cur = [fwd];
      return inp;
    }
    if (ai.cool > 0) {
      const r = Math.random();
      if (r < 0.22) ai.cur = [back];
      else if (r < 0.55) ai.cur = [fwd];
      else if (r < 0.62 && dist > 110) { ai.hold = ['up', fwd]; ai.holdT = 4; ai.airAttack = true; }
      return inp;
    }
    // velg angrep
    let pool;
    if (opp.crouching) pool = dist < 100 ? ['lowkick', 'sweep', 'cpunch', 'upper'] : ['lowkick', 'sweep', 'flykick'];
    else if (dist < 95) pool = ['jab', 'jab', 'cross', 'upper', 'lowkick', 'cpunch'];
    else pool = ['highkick', 'lowkick', 'flykick', 'cross', 'sweep'];
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick === 'sweep' || pick === 'cpunch') { inp.down = true; pick = pick === 'sweep' ? 'lowkick' : 'jab'; f.input.down = true; }
    f.buffer = pick; f.bufferT = 2;
    ai.cool = Math.floor((72 - lvl * 35) + Math.random() * 40);
    return inp;
  }

  // ---------- Oppdatering ----------
  function updateFighter(f, opp) {
    // input
    if (canAct()) {
      if (f.isAI) {
        f.input = aiInput(f, opp);
        if (f.ai.airAttack && !grounded(f) && f.state === 'jump' && f.vz < 3) { f.buffer = 'jab'; f.bufferT = 2; f.ai.airAttack = false; }
      } else {
        f.input = { left: !!keys.ArrowLeft, right: !!keys.ArrowRight, up: !!keys.ArrowUp, down: !!keys.ArrowDown };
      }
    } else {
      f.input = { left: false, right: false, up: false, down: false };
      if (M.phase !== 'fight') f.buffer = null;
    }
    if (f.bufferT > 0) f.bufferT--; else f.buffer = null;

    const inp = f.input;
    const fwdHeld = f.facing === 1 ? inp.right : inp.left;
    const backHeld = f.facing === 1 ? inp.left : inp.right;

    // fysikk i lufta
    const wasAir = f.z > 0;
    if (f.z > 0 || f.vz !== 0) {
      f.z += f.vz;
      f.vz -= GRAV;
      if (f.z <= 0) {
        f.z = 0; f.vz = 0;
        if (wasAir) onLand(f);
      }
    }
    f.x += f.vx;
    if (grounded(f)) f.vx *= 0.78;
    if (Math.abs(f.vx) < 0.05) f.vx = 0;

    f.timer++;
    if (f.flash > 0) f.flash--;

    switch (f.state) {
      case 'idle': case 'walk': case 'crouch': {
        if (opp.x !== f.x && grounded(f)) f.facing = opp.x > f.x ? 1 : -1;
        if (f.buffer && canAct()) { startAttack(f, f.buffer); f.buffer = null; break; }
        if (!canAct()) { f.state = M.phase === 'over' ? f.state : 'idle'; break; }
        if (inp.up) {
          f.state = 'jump';
          f.vz = 14; f.z = 0.01;
          f.vx = fwdHeld ? f.facing * 4 : backHeld ? -f.facing * 3.5 : 0;
          f.crouching = false; f.blocking = false;
          break;
        }
        if (inp.down) {
          f.state = 'crouch'; f.crouching = true; f.blocking = backHeld;
          break;
        }
        f.crouching = false;
        if (backHeld) {
          f.state = 'walk'; f.blocking = true;
          f.x -= f.facing * 2.6; f.walkPhase -= 0.22;
        } else if (fwdHeld) {
          f.state = 'walk'; f.blocking = false;
          f.x += f.facing * 3.2; f.walkPhase += 0.25;
        } else {
          f.state = 'idle'; f.blocking = false;
        }
        break;
      }
      case 'jump': {
        if (f.buffer && canAct()) { startAttack(f, f.buffer); f.buffer = null; }
        break;
      }
      case 'attack': {
        f.frame++;
        const a = f.attack;
        const activeStart = a.start, activeEnd = a.start + a.active;
        if (f.frame >= activeStart && f.frame < activeEnd && !f.hasHit) tryHit(f, opp);
        if (a.air) {
          if (grounded(f) && f.frame > 2) { f.state = 'idle'; f.attack = null; }
        } else if (f.frame >= a.start + a.active + a.rec && grounded(f)) {
          f.state = f.input.down || a.crouch ? 'crouch' : 'idle';
          f.crouching = f.state === 'crouch';
          f.attack = null;
        }
        break;
      }
      case 'hit': case 'block': {
        if (f.timer >= f.stun) {
          f.state = f.crouching ? 'crouch' : 'idle';
          opp.combo = 0; // kombo-telleren til angriperen nullstilles når offeret er fri
        }
        break;
      }
      case 'down': {
        if (f.rot > -Math.PI / 2) f.rot = Math.max(-Math.PI / 2, f.rot - 0.16);
        if (grounded(f) && f.timer > 55 && f.hp > 0) { f.state = 'getup'; f.timer = 0; }
        break;
      }
      case 'getup': {
        f.rot = Math.min(0, f.rot + 0.12);
        if (f.timer > 16) { f.state = 'idle'; f.rot = 0; f.crouching = false; opp.combo = 0; }
        break;
      }
      case 'ko': {
        if (f.rot > -Math.PI / 2) f.rot = Math.max(-Math.PI / 2, f.rot - 0.12);
        break;
      }
      default: break;
    }
    f.x = Math.max(MIN_X, Math.min(MAX_X, f.x));
    // HP-bar som henger etter
    if (f.shownHp > f.hp) f.shownHp = Math.max(f.hp, f.shownHp - 0.6);
  }

  function onLand(f) {
    sfx.land();
    if (f.state === 'jump') f.state = 'idle';
    if (f.state === 'attack' && f.attack.air) { f.state = 'idle'; f.attack = null; f.frame = 0; }
    if (f.state === 'down' || f.state === 'ko') { f.vx *= 0.3; sfx.thud(); M.shake = Math.max(M.shake, 8); f.timer = Math.min(f.timer, 20); }
  }

  function tryHit(att, vic) {
    const a = att.attack;
    if (M.phase !== 'fight') return;
    if (['down', 'getup', 'ko'].includes(vic.state)) return;
    const sk = skeleton(POSES[a.s]);
    const tip = sk[a.tip];
    const front = att.facing * (vic.x - att.x);
    if (front < -10) return;
    const reach = tip.x * SCALE + 10;
    if (front - BODY_HALF > reach) return;

    // høyde
    const tipH = att.z + (-tip.y) * SCALE;
    const vicGround = grounded(vic);
    if (vicGround) {
      if (a.level === 'high' && vic.crouching) return; // dukket unna
    } else {
      if (a.level === 'low') return; // hoppet over
      const top = vic.z + 175;
      if (tipH + 10 < vic.z || tipH - 10 > top) return;
    }
    if (att.z > 0 && vicGround) {
      const top = vic.crouching ? 120 : 175;
      if (tipH - 10 > top) return;
    }

    att.hasHit = true;
    const hx = att.x + att.facing * (tip.x * SCALE - 4);
    const hy = GROUND - tipH;

    // blokk?
    const canBlock = vicGround && vic.blocking && (neutral(vic) || vic.state === 'block');
    let blocked = false;
    if (canBlock) {
      if (vic.crouching) blocked = a.level === 'low' || a.level === 'mid';
      else blocked = a.level === 'high' || a.level === 'mid' || a.level === 'overhead';
    }

    if (blocked) {
      const chip = Math.ceil(a.dmg * 0.15);
      vic.hp = Math.max(1, vic.hp - chip);
      vic.state = 'block'; vic.timer = 0; vic.stun = Math.round(a.stun * 0.6);
      vic.vx = att.facing * a.push * 0.9;
      M.hitstop = 3;
      spark(hx, hy, -att.facing, false, true);
      sfx.block();
      att.combo = 0;
    } else {
      const scale = Math.max(0.5, 1 - att.combo * 0.12);
      const dmg = Math.max(1, Math.round(a.dmg * scale));
      vic.hp = Math.max(0, vic.hp - dmg);
      vic.flash = 6;
      att.combo++;
      if (att.combo >= 2) M.comboText = { who: att, n: att.combo, t: 0 };
      const big = a.dmg >= 12;
      M.hitstop = big ? 7 : 5;
      M.shake = Math.max(M.shake, big ? 10 : 5);
      M.excite = Math.min(1, M.excite + 0.35);
      spark(hx, hy, -att.facing, big, false);
      sfx.hit(big);
      if (vic.hp <= 0) {
        vic.state = 'ko'; vic.timer = 0;
        vic.vx = att.facing * 7; vic.vz = 7; vic.z = Math.max(vic.z, 0.01);
        vic.crouching = false;
        return;
      }
      if (a.knock || !vicGround) {
        vic.state = 'down'; vic.timer = 0;
        vic.vx = att.facing * 6; vic.vz = 6; vic.z = Math.max(vic.z, 0.01);
        vic.crouching = false;
      } else {
        vic.state = 'hit'; vic.timer = 0; vic.stun = a.stun;
        vic.vx = att.facing * a.push;
      }
      if (vic.attack && vic.state !== 'attack') vic.attack = null;
    }
    // ved veggen dyttes angriperen tilbake i stedet
    if ((vic.x <= MIN_X + 2 && att.facing < 0) || (vic.x >= MAX_X - 2 && att.facing > 0)) {
      att.vx = -att.facing * a.push * 0.8;
    }
  }

  function separate(a, b) {
    const minD = 64;
    const dz = Math.abs(a.z - b.z);
    if (dz > 70) return;
    const dx = b.x - a.x;
    if (Math.abs(dx) < minD) {
      const push = (minD - Math.abs(dx)) / 2;
      const s = dx === 0 ? (a.facing > 0 ? 1 : -1) : Math.sign(dx);
      a.x -= s * push; b.x += s * push;
      for (const f of [a, b]) f.x = Math.max(MIN_X, Math.min(MAX_X, f.x));
      // hvis en står fast i veggen, dytt den andre
      if (Math.abs(b.x - a.x) < minD) {
        if (a.x <= MIN_X || a.x >= MAX_X) b.x = a.x + s * minD; else a.x = b.x - s * minD;
      }
    }
  }

  function stepMatch() {
    M.t += STEP;
    M.time += STEP;
    if (M.banner) { M.banner.t += STEP; if (M.banner.t > M.banner.dur) M.banner = null; }
    if (M.comboText) { M.comboText.t += STEP; if (M.comboText.t > 1.2) M.comboText = null; }
    M.excite = Math.max(0, M.excite - 0.004);
    if (M.shake > 0) M.shake *= 0.85;
    if (M.shake < 0.3) M.shake = 0;

    const p = M.player, o = M.opp;

    switch (M.phase) {
      case 'intro': {
        if (M.t < 2.6) p.speech = { text: 'Du kan ikke gjemme eggene for alltid!', t: M.t };
        else p.speech = null;
        if (M.t >= 2.6 && M.t < 5.2) o.speech = { text: 'Jeg vet du har eggene!', t: M.t - 2.6 };
        else o.speech = null;
        if (M.t >= 5.4) { p.state = 'idle'; o.state = 'idle'; M.phase = 'roundStart'; M.t = 0; setBanner('RUNDE 1', 1.3); sfx.bell(); }
        break;
      }
      case 'roundStart': {
        if (M.t >= 1.3 && M.t - STEP < 1.3) setBanner('FIGHT!', 0.9, { color: '#ff5a3c' });
        if (M.t >= 1.6) { M.phase = 'fight'; M.t = 0; }
        break;
      }
      case 'fight': {
        M.clock = Math.max(0, M.clock - STEP);
        if (p.hp <= 0 || o.hp <= 0) {
          M.phase = 'ko'; M.t = 0; M.slow = 0.35; M.slowT = 1.1;
          setBanner('K.O.!', 2.2, { color: '#ff3b30' });
          sfx.ko();
          M.excite = 1;
        } else if (M.clock <= 0) {
          M.phase = 'ko'; M.t = 0;
          setBanner('TIDEN ER UTE!', 2.2);
          sfx.bell();
        }
        break;
      }
      case 'ko': {
        if (M.t > 2.4) endRound();
        break;
      }
      case 'roundEnd': {
        if (M.t > 1.8) {
          if (M.wins.p >= WINS_NEEDED || M.wins.o >= WINS_NEEDED || M.round >= MAX_ROUNDS) {
            matchOver();
          } else {
            M.round++;
            resetRound();
            M.phase = 'roundStart'; M.t = 0;
            setBanner(M.round >= MAX_ROUNDS || (M.wins.p === 1 && M.wins.o === 1) ? 'SISTE RUNDE' : 'RUNDE ' + M.round, 1.3);
            sfx.bell();
          }
        }
        break;
      }
      case 'over': break;
      default: break;
    }

    if (M.hitstop > 0) { M.hitstop--; } else {
      updateFighter(p, o);
      updateFighter(o, p);
      separate(p, o);
    }

    // partikler
    for (const q of M.parts) { q.x += q.vx; q.y += q.vy; q.vy += 0.3; q.vx *= 0.94; q.life--; }
    M.parts = M.parts.filter((q) => q.life > 0);
    for (const r of M.rings) { r.r += 4; r.life--; }
    M.rings = M.rings.filter((r) => r.life > 0);
  }

  function endRound() {
    const p = M.player, o = M.opp;
    let winner = null;
    if (p.hp > o.hp) winner = p; else if (o.hp > p.hp) winner = o;
    if (winner === p) M.wins.p++; else if (winner === o) M.wins.o++;
    M.phase = 'roundEnd'; M.t = 0;
    if (winner) {
      winner.state = 'win'; winner.attack = null;
      setBanner(winner === p ? 'DU VANT RUNDEN' : `${o.name.toUpperCase()} VANT RUNDEN`, 1.8, { small: true, color: winner === p ? '#7CFC9A' : '#ff8a7a' });
    } else {
      setBanner('UAVGJORT', 1.8, { small: true });
    }
  }

  function matchOver() {
    const p = M.player, o = M.opp;
    let outcome = 'draw';
    if (M.wins.p > M.wins.o) outcome = 'win'; else if (M.wins.o > M.wins.p) outcome = 'lose';
    M.phase = 'over'; M.t = 0;
    if (outcome === 'win') {
      p.state = 'win'; sfx.win();
      setBanner('DU VANT!', 99, { color: '#7CFC9A' });
      o.speech = { text: 'Au! Ok, ok … jeg har ikke eggene!', t: 0 };
    } else if (outcome === 'lose') {
      o.state = 'win'; sfx.lose();
      setBanner('DU TAPTE!', 99, { color: '#ff6b5a' });
      o.speech = { text: 'Ha! Og eggene fant du heller ikke.', t: 0 };
    } else {
      setBanner('UAVGJORT', 99);
      o.speech = { text: 'Omkamp en annen dag!', t: 0 };
    }
    setTimeout(() => {
      if (!running) return;
      const txt = outcome === 'win'
        ? `Du slo ${o.name} ${M.wins.p}–${M.wins.o}. Men eggene? Fortsatt borte.`
        : outcome === 'lose'
          ? `${o.name} vant ${M.wins.o}–${M.wins.p}. Kanskje du trenger en kopp kaffe?`
          : `Det endte ${M.wins.p}–${M.wins.o}. Ingen vinner i dag.`;
      showPanel(outcome === 'win' ? '🏆 Seier!' : outcome === 'lose' ? '🤕 Tap' : '🤝 Uavgjort', txt, [
        { label: 'Tilbake til kontoret', onClick: () => finish(outcome) },
      ]);
    }, 1900);
  }

  // ---------- Tegning ----------
  function drawFighter(c, f) {
    const sx = f.x, sy = GROUND - f.z;
    // skygge
    const sh = Math.max(0.35, 1 - f.z / 200);
    c.fillStyle = `rgba(0,0,0,${0.25 * sh})`;
    c.beginPath(); c.ellipse(f.x, GROUND + 2, 34 * sh, 7 * sh, 0, 0, Math.PI * 2); c.fill();

    c.save();
    c.translate(sx, sy);
    if (f.rot) {
      c.translate(0, -10 * Math.abs(f.rot) / (Math.PI / 2));
      c.rotate(f.rot * f.facing);
    }
    c.scale(SCALE * f.facing, SCALE);
    let face = null;
    if (f.state === 'ko') face = 'ko';
    else if (f.state === 'hit' || f.state === 'down') face = 'hurt';
    else if (f.state === 'win') face = 'win';
    else if (f.speech) face = (Math.floor(M.time * 10) % 2) ? 'talk' : null;
    // treff-glimt: figuren tegnes med lysere farger noen bilder
    let look = f.look;
    if (f.flash > 0) {
      const amt = 0.35 + f.flash * 0.08;
      look = {};
      for (const k in f.look) look[k] = typeof f.look[k] === 'string' && f.look[k][0] === '#' ? shade(f.look[k], amt) : f.look[k];
    }
    drawFigure(c, f.pose, look, { face });
    c.restore();
  }

  function wrapText(c, text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawSpeech(c, f) {
    if (!f.speech) return;
    const full = f.speech.text;
    const n = Math.min(full.length, Math.floor(f.speech.t * 32));
    if (n > (f._lastN || 0) && n < full.length && n % 3 === 0) sfx.talk();
    f._lastN = n;
    const text = full.slice(0, Math.max(1, n));
    c.font = 'bold 19px "Trebuchet MS", sans-serif';
    const lines = wrapText(c, full, 240);
    const shown = wrapText(c, text, 240);
    const w = Math.max(...lines.map((l) => c.measureText(l).width)) + 32;
    const h = lines.length * 24 + 22;
    const headY = GROUND - f.z - 185;
    let x = f.x - w / 2 + (f.facing > 0 ? 40 : -40);
    x = Math.max(12, Math.min(W - w - 12, x));
    const y = headY - h - 18;
    const pop = Math.min(1, f.speech.t * 6);
    c.save();
    c.translate(f.x, headY);
    c.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
    c.translate(-f.x, -headY);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    roundRect(c, x + 4, y + 5, w, h, 16); c.fill();
    c.fillStyle = '#fff';
    c.strokeStyle = '#23262f'; c.lineWidth = 3;
    roundRect(c, x, y, w, h, 16); c.fill(); c.stroke();
    // hale
    c.beginPath();
    c.moveTo(f.x - 10, y + h - 2); c.lineTo(f.x + 4 * f.facing, headY + 4); c.lineTo(f.x + 12, y + h - 2);
    c.fillStyle = '#fff'; c.fill();
    c.beginPath();
    c.moveTo(f.x - 10, y + h); c.lineTo(f.x + 4 * f.facing, headY + 4); c.lineTo(f.x + 12, y + h);
    c.stroke();
    c.fillStyle = '#fff'; c.fillRect(f.x - 9, y + h - 4, 20, 4);
    c.fillStyle = '#23262f';
    c.textBaseline = 'top';
    shown.forEach((l, i) => c.fillText(l, x + 16, y + 12 + i * 24));
    c.textBaseline = 'alphabetic';
    c.restore();
  }

  function drawHud(c) {
    const p = M.player, o = M.opp;
    const bw = 360, bh = 26, top = 26;
    const bar = (x, f, flip) => {
      c.fillStyle = 'rgba(20,22,30,0.85)';
      roundRect(c, x - 4, top - 4, bw + 8, bh + 8, 8); c.fill();
      c.fillStyle = '#5a1e1e'; c.fillRect(x, top, bw, bh);
      const sw = bw * f.shownHp / 100, hw = bw * f.hp / 100;
      c.fillStyle = '#fff1c4';
      if (flip) c.fillRect(x + bw - sw, top, sw, bh); else c.fillRect(x, top, sw, bh);
      const g = c.createLinearGradient(0, top, 0, top + bh);
      const low = f.hp < 30;
      g.addColorStop(0, low ? '#ff7b5a' : '#ffe066'); g.addColorStop(1, low ? '#d63a1c' : '#f4a020');
      c.fillStyle = g;
      if (flip) c.fillRect(x + bw - hw, top, hw, bh); else c.fillRect(x, top, hw, bh);
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(x, top + 2, bw, 5);
      // navn
      c.font = 'bold 18px "Trebuchet MS", sans-serif';
      c.fillStyle = '#fff';
      c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 4;
      c.textAlign = flip ? 'right' : 'left';
      const nx = flip ? x + bw : x;
      c.strokeText(f.name.toUpperCase(), nx, top + bh + 24);
      c.fillText(f.name.toUpperCase(), nx, top + bh + 24);
      // rundeseire
      const wins = flip ? M.wins.o : M.wins.p;
      for (let i = 0; i < WINS_NEEDED; i++) {
        const cx = flip ? x + bw - 130 - i * 22 : x + 130 + i * 22;
        c.beginPath(); c.arc(cx, top + bh + 18, 7, 0, Math.PI * 2);
        c.fillStyle = i < wins ? '#ffd23f' : 'rgba(0,0,0,0.45)'; c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
      }
      c.textAlign = 'left';
    };
    bar(24, p, false);
    bar(W - 24 - bw, o, true);
    // klokke
    c.fillStyle = 'rgba(20,22,30,0.9)';
    roundRect(c, W / 2 - 38, 14, 76, 50, 10); c.fill();
    c.font = 'bold 34px "Trebuchet MS", sans-serif';
    c.textAlign = 'center';
    c.fillStyle = M.clock < 10 && M.phase === 'fight' ? '#ff6b5a' : '#fff';
    c.fillText(String(Math.ceil(M.clock)), W / 2, 52);
    c.textAlign = 'left';
  }

  function drawBanner(c) {
    const b = M.banner;
    if (!b) return;
    const t = b.t;
    const pop = Math.min(1, t * 5);
    const fade = b.dur < 50 ? Math.min(1, (b.dur - t) * 4) : 1;
    const s = (b.small ? 0.65 : 1) * (1.8 - 0.8 * ease(pop));
    c.save();
    c.globalAlpha = Math.max(0, fade) * pop;
    c.translate(W / 2, 250);
    c.scale(s, s);
    c.font = 'italic 900 78px "Trebuchet MS", Impact, sans-serif';
    c.textAlign = 'center';
    c.lineJoin = 'round';
    c.strokeStyle = '#1a1a22'; c.lineWidth = 14;
    c.strokeText(b.text, 0, 0);
    const g = c.createLinearGradient(0, -60, 0, 10);
    g.addColorStop(0, '#fff'); g.addColorStop(0.45, b.color); g.addColorStop(1, shade(b.color, -0.35));
    c.fillStyle = g;
    c.fillText(b.text, 0, 0);
    c.restore();
  }

  function render() {
    const c = ctx;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.save();
    if (M.shake) c.translate((Math.random() - 0.5) * M.shake, (Math.random() - 0.5) * M.shake);
    c.drawImage(bg, 0, 0, W, H);
    drawCrowd(c, M.time);

    // jevn overgang til målpose
    for (const f of [M.player, M.opp]) {
      const tp = targetPose(f, M.time);
      const k = f.state === 'attack' ? 0.75 : 0.35;
      for (const key of POSE_KEYS) f.pose[key] += (tp[key] - f.pose[key]) * k;
    }
    // den som angriper tegnes øverst
    const order = M.opp.state === 'attack' ? [M.player, M.opp] : [M.opp, M.player];
    for (const f of order) drawFighter(c, f);

    for (const r of M.rings) {
      c.strokeStyle = r.col + (r.life / 10) + ')'; c.lineWidth = 4;
      c.beginPath(); c.arc(r.x, r.y, r.r, 0, Math.PI * 2); c.stroke();
    }
    for (const q of M.parts) {
      c.globalAlpha = q.life / q.max;
      c.fillStyle = q.col;
      c.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
    c.globalAlpha = 1;
    c.restore();

    drawHud(c);
    if (M.comboText) {
      const ct = M.comboText;
      const left = ct.who === M.player;
      c.save();
      c.globalAlpha = Math.min(1, (1.2 - ct.t) * 3);
      c.font = 'italic 900 34px "Trebuchet MS", sans-serif';
      c.textAlign = left ? 'left' : 'right';
      c.strokeStyle = '#1a1a22'; c.lineWidth = 7; c.lineJoin = 'round';
      const tx = left ? 30 : W - 30;
      c.strokeText(`${ct.n} TREFF!`, tx, 140);
      c.fillStyle = '#ffd23f';
      c.fillText(`${ct.n} TREFF!`, tx, 140);
      c.restore();
    }
    drawSpeech(c, M.player);
    drawSpeech(c, M.opp);
    drawBanner(c);

    if (M.paused) {
      c.fillStyle = 'rgba(10,12,20,0.5)';
      c.fillRect(0, 0, W, H);
    }
  }

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!M.paused) {
      if (M.slowT > 0) { M.slowT -= dt; if (M.slowT <= 0) M.slow = 1; }
      acc += dt * M.slow;
      while (acc >= STEP) { stepMatch(); acc -= STEP; }
    }
    render();
  }

  function finish(outcome) {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    for (const k in keys) keys[k] = false;
    hidePanel();
    root.classList.add('hidden');
    const result = { outcome, rounds: { player: M.wins.p, opponent: M.wins.o }, opponent: M.opp.name };
    const cb = M.opts.onEnd;
    M = null;
    if (typeof cb === 'function') cb(result);
  }

  // ---------- Offentlig API ----------
  function start(opts = {}) {
    buildDom();
    // skarp tegning på retina/skalert skjerm (samme prinsipp som hovedspillet)
    const host = root.parentElement;
    const sc = host && host.id === 'stage' ? host.getBoundingClientRect().width / W : 1;
    ratio = Math.max(1, Math.min(3, (sc || 1) * (window.devicePixelRatio || 1)));
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
    if (!bg || bg.ratio !== ratio) buildBackground();
    newMatch(opts);
    hidePanel();
    root.classList.remove('hidden');
    running = true;
    acc = 0;
    last = performance.now();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  // Liten portrett-tegner som andre moduler (dialogen) kan bruke.
  function drawPortrait(c, look, opts = {}) {
    const w = opts.w || c.canvas.width, h = opts.h || c.canvas.height;
    c.clearRect(0, 0, w, h);
    c.save();
    const sc = opts.scale || 1.6;
    c.translate(w / 2 + (opts.offsetX || 0), h + (opts.offsetY || 70));
    c.scale(sc * (opts.facing || 1), sc);
    drawFigure(c, POSES[opts.pose || 'stance'] || STANCE, Object.assign({}, PLAYER_LOOK, look || {}), { face: opts.face || null });
    c.restore();
  }

  return {
    start,
    isActive: () => running,
    drawPortrait,
    PLAYER_LOOK,
    // eksponert for testing
    _internals: { skeleton, POSES, ATTACKS, state: () => M },
  };
})();
