// Jakten på de forsvunne eggene – hovedløkke, styring og spilltilstand.

const VIEW_W = 960, VIEW_H = 600;
const MOVE_SPEED = 175;          // piksler per sekund
const REACH = 90;                // hvor nært man må stå for å klikke på noe
const DRAIN_INTERVAL = 10;       // −1 energi hvert 10. sekund
const TRASH_DRAIN_INTERVAL = 2;  // ekstra −1 hvert 2. sekund når man bærer søppel
const BREW_TIME = 20;            // sekunder
const IR_BATTERY = 30;           // sekunder varmesyn

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const stage = document.getElementById('stage');
const ui = {
  hud: document.getElementById('hud'),
  energyFill: document.getElementById('energyFill'),
  energyVal: document.getElementById('energyVal'),
  timer: document.getElementById('timer'),
  status: document.getElementById('status'),
  inventory: document.getElementById('inventory'),
  toast: document.getElementById('toast'),
  tooltip: document.getElementById('tooltip'),
  vignette: document.getElementById('vignette'),
  start: document.getElementById('screenStart'),
  pause: document.getElementById('screenPause'),
  end: document.getElementById('screenEnd'),
};

let G = null;
let pxRatio = 1;
let time = 0;
const keys = {};

// ---------- Skalering ----------
function resize() {
  const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  stage.style.setProperty('--s', s);
  pxRatio = s * (window.devicePixelRatio || 1);
  canvas.width = Math.round(VIEW_W * pxRatio);
  canvas.height = Math.round(VIEW_H * pxRatio);
  cuCanvas.width = Math.round(CU_W * pxRatio);
  cuCanvas.height = Math.round(CU_H * pxRatio);
}
window.addEventListener('resize', resize);
resize();

// ---------- Kollegaer og «Kontorkampen» (js/colleagues.js + js/fight.js) ----------
Colleagues.init({
  onBusyChange(busy) {
    // Taster som var holdt nede når samtalen/kampen startet, skal ikke «henge igjen».
    for (const k in keys) keys[k] = false;
    hideTooltip();
    if (busy) ui.toast.classList.remove('show');
  },
  onFightEnd(result) {
    // Vinner du Kontorkampen, får du full energi.
    if (result.outcome !== 'win' || !G || G.state !== 'play') return null;
    const missing = 100 - G.energy;
    if (missing > 0) addEnergy(missing);
    return 'Au … greit, greit. Jeg har ikke eggene, jeg lover! Her, ta energidrikken min. ⚡';
  },
});

// ---------- Nytt spill ----------
function newGame() {
  const objects = createWorld();
  const eggSpot = distributeContents(objects);
  G = {
    state: 'play',
    energy: 100,
    time: 0,
    drain: 0,
    trashDrain: 0,
    moved: 0,
    player: { x: SPAWN.x, y: SPAWN.y, dir: 'up', moving: false, walk: 0 },
    objects,
    eggSpot,
    inventory: [],
    carrying: null,
    coffee: { state: 'empty', progress: 0, cups: 0, brewsLeft: 2 },
    ir: { owned: false, active: false, battery: IR_BATTERY },
    cam: { x: 0, y: 0 },
    floats: [],
    hover: null,
    mouse: { x: -1, y: -1, inside: false },
    lastEnergy: -1,
  };
  centerCamera(true);
  cuForceClose();
  Colleagues.reset();
  renderInventory();
  ui.hud.classList.remove('hidden');
  ui.inventory.classList.remove('hidden');
  ui.start.classList.add('hidden');
  ui.end.classList.add('hidden');
  ui.pause.classList.add('hidden');
  toast('Bruk piltastene for å gå, og klikk på ting med musa for å lete. Lykke til! 🥚', 5000);
}

// ---------- Energi ----------
function addEnergy(n) {
  if (!G || G.state !== 'play') return;
  G.energy = Math.max(0, Math.min(100, G.energy + n));
  if (n !== 0) {
    addFloat((n > 0 ? '+' : '') + n + ' ⚡', n > 0 ? '#2ecc71' : '#ff5a4f');
    ui.energyVal.classList.remove('bump');
    void ui.energyVal.offsetWidth;
    ui.energyVal.classList.add('bump');
  }
  if (G.energy <= 0) loseGame();
}

function addFloat(text, color) {
  G.floats.push({ text, color, x: G.player.x, y: G.player.y - 70, life: 1.4 });
}

function eatFood(item) {
  Sfx.play('eat');
  addEnergy(item.energy);
  toast(`Nam! Du spiste ${item.name}.`);
}

// ---------- Inventar ----------
function addInventory(item) {
  if (item.kind === 'goggles') {
    G.ir.owned = true;
    G.ir.battery = IR_BATTERY;
    toast('🥽 Trykk I (eller klikk på brillene nederst) for varmesyn!', 4500);
  } else {
    toast(`${item.icon} ${item.short} lagt i lomma. Klikk på den nederst når du trenger energi.`);
  }
  G.inventory.push(item);
  renderInventory();
}

function renderInventory() {
  ui.inventory.innerHTML = '';
  if (!G) return;
  G.inventory.forEach((item, idx) => {
    const el = document.createElement('button');
    el.className = 'inv-item';
    if (item.kind === 'goggles') {
      if (G.ir.active) el.classList.add('active');
      el.title = 'Varmesyn av/på (I)';
      el.innerHTML = `${item.icon}<small>Databriller</small><span class="battery"><i style="width:${(G.ir.battery / IR_BATTERY) * 100}%"></i></span>`;
      el.addEventListener('click', () => toggleIR());
    } else {
      el.title = `Spis ${item.short.toLowerCase()} (+${item.energy} energi)`;
      el.innerHTML = `${item.icon}<small>+${item.energy}</small>`;
      el.addEventListener('click', () => {
        if (G.state !== 'play' || CU.open) return;
        G.inventory.splice(idx, 1);
        eatFood(item);
        renderInventory();
      });
    }
    ui.inventory.appendChild(el);
  });
}

function toggleIR() {
  if (!G || G.state !== 'play' || CU.open) return;
  if (!G.ir.owned) {
    toast('Du har ingen databriller ennå. Kanskje de ligger gjemt et sted?');
    return;
  }
  G.ir.active = !G.ir.active;
  Sfx.play('ir');
  if (G.ir.active) toast('🔥 Varmesyn på! Grønt lys = noe bra, rødt lys = søppel.');
  renderInventory();
}

// ---------- Meldinger ----------
let toastTimer = null;
function toast(msg, ms = 3200) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

// ---------- Hjelpefunksjoner ----------
function sortKey(o) { return o.sortY !== undefined ? o.sortY : o.y + o.h; }

function hitBox(o) {
  const b = screenBox(o);
  if (o.type === 'plant') {
    const extra = o.variant === 'palm' ? 60 : o.variant === 'herb' ? 14 : 50;
    b.y -= extra;
    b.h += extra;
    b.x -= 8;
    b.w += 16;
  }
  return b;
}

function isInteractive(o) {
  return o.searchable || o.info || o.bin || ['coffee', 'cake', 'candybowl'].includes(o.type);
}

function distToObject(o) {
  const p = G.player;
  const nx = Math.max(o.x, Math.min(p.x, o.x + o.w));
  const ny = Math.max(o.y, Math.min(p.y, o.y + o.h));
  return Math.hypot(p.x - nx, p.y - ny);
}

function inReach(o) { return distToObject(o) <= REACH; }

function collides(nx, ny) {
  const px = nx - 10, py = ny - 8, pw = 20, ph = 10;
  if (px < 20 || py < 20 || px + pw > WORLD.w - 20 || py + ph > WORLD.h - 20) return true;
  for (const o of G.objects) {
    if (!o.solid) continue;
    if (px < o.x + o.w && px + pw > o.x && py < o.y + o.h && py + ph > o.y) return true;
  }
  return !!Colleagues.collides(nx, ny, 10);
}

function centerCamera(snap) {
  const p = G.player;
  const tx = Math.max(0, Math.min(WORLD.w - VIEW_W, p.x - VIEW_W / 2));
  const ty = Math.max(-80, Math.min(WORLD.h - VIEW_H + 10, p.y - 30 - VIEW_H / 2));
  if (snap) {
    G.cam.x = tx;
    G.cam.y = ty;
  } else {
    G.cam.x += (tx - G.cam.x) * 0.12;
    G.cam.y += (ty - G.cam.y) * 0.12;
  }
}

// ---------- Interaksjon ----------
function interact(o) {
  if (!inReach(o)) {
    Sfx.play('denied');
    toast('Du må gå nærmere for å nå den.');
    return;
  }
  if (o.bin) {
    if (G.carrying) {
      Sfx.play('trash');
      toast(`🗑️ Du kastet ${G.carrying.name}. Ahh, mye bedre!`);
      G.carrying = null;
    } else {
      toast('En søppelbøtte. Den lukter litt, men eggene er ikke her.');
    }
    return;
  }
  if (o.type === 'coffee') return coffeeInteract(o);
  if (o.type === 'cake') {
    if (o.slices > 0) {
      o.slices--;
      Sfx.play('eat');
      addEnergy(15);
      toast(`🍰 Gratulerer med dagen, Gunnar! Du tok et kakestykke. ${o.slices ? `${o.slices} stykker igjen.` : 'Det var det siste!'}`);
    } else {
      toast('Bare smuler igjen… noen har spist opp hele kaka.');
    }
    return;
  }
  if (o.type === 'candybowl') {
    if (o.pieces > 0) {
      o.pieces--;
      Sfx.play('eat');
      addEnergy(6);
      toast(`🍬 Du tok en godtebit fra skåla. ${o.pieces ? `${o.pieces} igjen.` : 'Skåla er tom nå!'}`);
    } else {
      toast('Godteriskåla er tom. Typisk.');
    }
    return;
  }
  if (o.info) {
    Sfx.play('click');
    toast(o.info, 4500);
    return;
  }
  if (o.searchable) {
    if (o.searched) {
      toast('Du har allerede lett her.');
      return;
    }
    if (G.carrying) {
      Sfx.play('denied');
      toast('Du har hendene fulle av søppel! Kast det i en søppelbøtte først. 🤢');
      return;
    }
    Sfx.play('click');
    openSearch(o);
  }
}

// ---------- Input ----------
window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  if (Colleagues.isBusy()) return; // samtale eller kamp pågår
  keys[k] = true;
  if (!G) {
    if (k === 'Enter') ui.start.querySelector('button').click();
    return;
  }
  if (k === 'Escape' || k === 'p' || k === 'P') {
    if (CU.open) { if (k === 'Escape') cuClose(); return; }
    togglePause();
  } else if (k === 'i' || k === 'I') {
    toggleIR();
  }
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  if (G && G.state === 'play' && !CU.open && !Colleagues.isBusy()) togglePause();
});

function stagePoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * VIEW_W, y: (e.clientY - r.top) / r.height * VIEW_H };
}

canvas.addEventListener('mousemove', (e) => {
  if (!G) return;
  const p = stagePoint(e);
  G.mouse = { x: p.x, y: p.y, inside: true };
});
canvas.addEventListener('mouseleave', () => {
  if (G) G.mouse.inside = false;
  hideTooltip();
});
canvas.addEventListener('click', () => {
  if (!G || G.state !== 'play' || CU.open) return;
  Sfx.unlock();
  if (G.hover) {
    clickHintDone = true;
    interact(G.hover);
  }
});

function togglePause() {
  if (!G) return;
  if (G.state === 'play') {
    G.state = 'paused';
    ui.pause.classList.remove('hidden');
  } else if (G.state === 'paused') {
    G.state = 'play';
    ui.pause.classList.add('hidden');
  }
}

document.getElementById('startBtn').addEventListener('click', () => { Sfx.unlock(); Sfx.play('click'); newGame(); });
document.getElementById('againBtn').addEventListener('click', () => { Sfx.play('click'); newGame(); });
document.getElementById('resumeBtn').addEventListener('click', togglePause);

// ---------- Seier / tap ----------
function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function showEnd(won) {
  const spot = G.eggSpot;
  document.getElementById('endIcon').textContent = won ? '🥚🥚🥚🥚🥚🥚' : '😴';
  document.getElementById('endTitle').textContent = won ? 'Du fant eggene!' : 'Tom for energi…';
  document.getElementById('endText').innerHTML = won
    ? `Eggekartongen lå <b>${hidePhrase(spot)}</b> ${spot.room.where}. Resepsjonisten gir dem tilbake til Kåre, som er så glad at han spanderer eggerøre på hele kontoret!`
    : `Du sovnet under pulten, og Kåre fikk aldri eggene sine tilbake… De lå forresten <b>${hidePhrase(spot)}</b> ${spot.room.where}.`;
  document.getElementById('endStats').innerHTML =
    `<div><b>${fmtTime(G.time)}</b>tid</div><div><b>${G.energy}</b>energi igjen</div><div><b>${G.moved}</b>ting flyttet</div>`;
  ui.end.classList.remove('hidden');
  hideTooltip();
}

function winGame() {
  if (G.state !== 'play') return;
  G.state = 'won';
  G.ir.active = false;
  showEnd(true);
}

function loseGame() {
  if (G.state !== 'play') return;
  G.state = 'lost';
  G.ir.active = false;
  cuForceClose();
  Sfx.play('lose');
  setTimeout(() => showEnd(false), 900);
}

// ---------- Oppdatering ----------
function update(dt) {
  if (!G || G.state !== 'play') { Colleagues.hideBubble(); return; }
  // Hovedspillet står stille (også energitappet) mens man prater med eller slåss mot en kollega
  if (Colleagues.isBusy()) { G.hover = null; return; }
  G.time += dt;

  // Energitap over tid
  G.drain += dt;
  while (G.drain >= DRAIN_INTERVAL) {
    G.drain -= DRAIN_INTERVAL;
    G.energy = Math.max(0, G.energy - 1);
    if (G.energy <= 0) { loseGame(); return; }
  }
  if (G.carrying) {
    G.trashDrain += dt;
    while (G.trashDrain >= TRASH_DRAIN_INTERVAL) {
      G.trashDrain -= TRASH_DRAIN_INTERVAL;
      addEnergy(-1);
      if (G.state !== 'play') return;
    }
  } else {
    G.trashDrain = 0;
  }

  // Kaffe
  const cf = G.coffee;
  if (cf.state === 'brewing') {
    cf.progress += dt / BREW_TIME;
    if (cf.progress >= 1) {
      cf.state = 'ready';
      cf.progress = 1;
      cf.cups = 3;
      Sfx.play('ding');
      toast('☕ Ding! Kaffen er ferdig. Gå til kjøkkenet og drikk en kopp.', 4000);
    }
  }

  // Varmesyn
  if (G.ir.active) {
    G.ir.battery -= dt;
    if (G.ir.battery <= 0) {
      G.ir.battery = 0;
      G.ir.active = false;
      G.ir.owned = false;
      G.inventory = G.inventory.filter((i) => i.kind !== 'goggles');
      toast('🔋 Batteriet på databrillene er tomt.');
    }
    renderInventoryBattery();
  }

  cuUpdate(dt);

  // Bevegelse
  const p = G.player;
  let dx = 0, dy = 0;
  if (!CU.open) {
    if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) dx += 1;
    if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
    if (keys.ArrowDown || keys.s || keys.S) dy += 1;
  }
  p.moving = dx !== 0 || dy !== 0;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    const sp = MOVE_SPEED * (G.carrying ? 0.8 : 1) * (G.energy < 15 ? 0.75 : 1);
    const mx = (dx / len) * sp * dt, my = (dy / len) * sp * dt;
    if (!collides(p.x + mx, p.y)) p.x += mx;
    if (!collides(p.x, p.y + my)) p.y += my;
    p.walk += dt;
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx < 0 ? 'left' : 'right';
    else p.dir = dy < 0 ? 'up' : 'down';
  }
  centerCamera(false);

  // «Spør kollega»-boble når man står nær en kollega
  if (CU.open) Colleagues.hideBubble();
  else Colleagues.update(p, (x, y) => ({ x: x - Math.round(G.cam.x), y: y - Math.round(G.cam.y) }));

  // Flytende tall
  for (const f of G.floats) { f.life -= dt; f.y -= 28 * dt; }
  G.floats = G.floats.filter((f) => f.life > 0);

  updateHover();
}

function renderInventoryBattery() {
  const bar = ui.inventory.querySelector('.battery i');
  if (bar) bar.style.width = `${(G.ir.battery / IR_BATTERY) * 100}%`;
  if (!G.ir.owned) renderInventory();
}

function updateHover() {
  G.hover = null;
  if (!G.mouse.inside || CU.open) { hideTooltip(); canvas.style.cursor = 'default'; return; }
  const wx = G.mouse.x + G.cam.x, wy = G.mouse.y + G.cam.y;
  let best = null;
  for (const o of G.objects) {
    if (!isInteractive(o)) continue;
    const b = hitBox(o);
    if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
      if (!best || sortKey(o) > sortKey(best)) best = o;
    }
  }
  G.hover = best;
  canvas.style.cursor = best ? 'pointer' : 'default';
  if (best) showTooltip(best);
  else hideTooltip();
}

function tooltipSub(o) {
  if (o.bin) return G.carrying ? 'Klikk for å kaste søppelet' : 'Her kaster man søppel';
  if (o.type === 'coffee') {
    const cf = G.coffee;
    if (cf.state === 'brewing') return `Traktes… ${Math.round(cf.progress * 100)} %`;
    if (cf.state === 'ready') return `Drikk kaffe (+20 ⚡) – ${cf.cups} kopper igjen`;
    return cf.brewsLeft > 0 ? 'Sett på kaffe' : 'Tom for kaffe';
  }
  if (o.type === 'cake') return o.slices ? `Spis kake (+15 ⚡) – ${o.slices} igjen` : 'Bare smuler igjen';
  if (o.type === 'candybowl') return o.pieces ? `Ta godteri (+6 ⚡) – ${o.pieces} igjen` : 'Tom';
  if (o.info) return 'Klikk for å se nærmere';
  if (o.searched) return 'Allerede undersøkt';
  return 'Klikk for å lete (−10 ⚡)';
}

function showTooltip(o) {
  const far = !inReach(o) ? '<span class="sub far">Gå nærmere</span>' : '';
  ui.tooltip.innerHTML = `${o.name}<span class="sub">${tooltipSub(o)}</span>${far}`;
  ui.tooltip.style.display = 'block';
  let x = G.mouse.x + 16, y = G.mouse.y + 14;
  const w = ui.tooltip.offsetWidth, h = ui.tooltip.offsetHeight;
  if (x + w > VIEW_W - 6) x = G.mouse.x - w - 12;
  if (y + h > VIEW_H - 6) y = G.mouse.y - h - 10;
  ui.tooltip.style.left = x + 'px';
  ui.tooltip.style.top = y + 'px';
}

function hideTooltip() { ui.tooltip.style.display = 'none'; }

// ---------- Tegning ----------
function render() {
  ctx.setTransform(pxRatio, 0, 0, pxRatio, 0, 0);
  ctx.fillStyle = '#2a2d38';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (!G) {
    drawAttract();
    return;
  }
  const cam = { x: Math.round(G.cam.x), y: Math.round(G.cam.y) };
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawFloors(ctx);

  const list = G.objects.map((o) => ({ k: sortKey(o), o }));
  list.push({ k: G.player.y + 2, player: true });
  for (const col of Colleagues.list) list.push({ k: col.y, col });
  list.sort((a, b) => a.k - b.k);
  for (const it of list) {
    if (it.player) drawPlayer(ctx, G.player, time, G);
    else if (it.col) Colleagues.drawOne(ctx, it.col, time);
    else drawObject(ctx, it.o, time, G);
  }

  if (G.ir.active) drawIR(ctx, G, cam, time);

  // markering av ting under musa
  if (G.hover && G.state === 'play') {
    const b = hitBox(G.hover);
    const ok = inReach(G.hover);
    ctx.save();
    ctx.strokeStyle = ok ? '#ffd23f' : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    if (!ok) ctx.setLineDash([6, 5]);
    ctx.shadowColor = ok ? '#ffb300' : 'transparent';
    ctx.shadowBlur = ok ? 12 : 0;
    rr(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 8);
    ctx.stroke();
    ctx.restore();
  }

  if (!clickHintDone && G.state === 'play' && !CU.open && !Colleagues.isBusy()) drawClickHint(cam);

  // flytende tall
  ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = Math.min(1, f.life * 1.5);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.restore();

  renderCU(time, pxRatio);
  renderHUD();
}

// ---------- Klikkhjelp: vises til spilleren har klikket på en ting første gang ----------
let clickHintDone = false;

function clickHintTarget() {
  let best = null, bestD = Infinity;
  for (const o of G.objects) {
    if (!isInteractive(o) || o.searched) continue;
    const d = distToObject(o);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

function drawCursorIcon(c, x, y, s) {
  // klassisk musepeker med spissen i (x, y)
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, 26);
  c.lineTo(6.5, 20);
  c.lineTo(11, 30);
  c.lineTo(15.5, 28);
  c.lineTo(11, 18.5);
  c.lineTo(19, 18.5);
  c.closePath();
  c.fillStyle = '#fff';
  c.strokeStyle = '#1b1d24';
  c.lineWidth = 2;
  c.lineJoin = 'round';
  c.shadowColor = 'rgba(0,0,0,0.45)';
  c.shadowBlur = 6;
  c.shadowOffsetY = 2;
  c.fill();
  c.shadowColor = 'transparent';
  c.stroke();
  c.restore();
}

function drawClickHint(cam) {
  const o = clickHintTarget();
  if (!o) return;
  const b = hitBox(o);
  const near = inReach(o);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const cyc = time % 1.4;            // én «klikk»-syklus
  const press = cyc > 0.55 && cyc < 0.75;

  ctx.save();
  // pulserende ramme rundt tingen
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  ctx.strokeStyle = `rgba(255, 210, 63, ${0.55 + pulse * 0.45})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -time * 30;
  rr(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, 9);
  ctx.stroke();
  ctx.setLineDash([]);

  // klikkringer fra musepekerens spiss
  if (cyc > 0.6) {
    const k = (cyc - 0.6) / 0.8;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * (1 - k)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 6 + k * 26, 0, Math.PI * 2);
    ctx.stroke();
  }

  // musepeker som beveger seg inn og «klikker»
  const lift = cyc < 0.55 ? (1 - cyc / 0.55) * 14 : 0;
  drawCursorIcon(ctx, cx + lift * 0.6, cy + lift, press ? 0.9 : 1);

  // snakkeboble: tegnet musepeker + tekst, venstrejustert så teksten alltid starter inni boblen
  const text = near ? 'Klikk på tingen med musa!' : 'Gå hit og klikk på tingen med musa!';
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  const tw = Math.ceil(ctx.measureText(text).width);
  const padL = 14, iconW = 16, gap = 8, padR = 18;
  const bw = padL + iconW + gap + tw + padR, bh = 34;
  let bx = cx - bw / 2;
  bx = Math.max(cam.x + 8, Math.min(cam.x + VIEW_W - bw - 8, bx));
  let by = b.y - bh - 22 + Math.sin(time * 3) * 3;
  if (by < cam.y + 70) by = b.y + b.h + 44;   // under tingen hvis det er for lite plass over
  ctx.fillStyle = 'rgba(30, 33, 44, 0.92)';
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  rr(ctx, bx, by, bw, bh, 10);
  ctx.fill();
  ctx.stroke();
  drawCursorIcon(ctx, bx + padL + 1, by + 7, 0.62);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + padL + iconW + gap, by + bh / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

let attractWorld = null;
function drawAttract() {
  // Kontoret i bakgrunnen av startskjermen
  if (!attractWorld) attractWorld = createWorld();
  const camX = 320 + Math.sin(time * 0.1) * 300;
  ctx.save();
  ctx.translate(-camX, -260);
  drawFloors(ctx);
  const fake = { coffee: { state: 'empty', cups: 0 }, carrying: null };
  attractWorld.slice().sort((a, b) => sortKey(a) - sortKey(b)).forEach((o) => drawObject(ctx, o, time, fake));
  ctx.restore();
}

function renderHUD() {
  if (G.energy !== G.lastEnergy) {
    G.lastEnergy = G.energy;
    ui.energyVal.textContent = G.energy;
    ui.energyFill.style.width = G.energy + '%';
    ui.energyFill.className = G.energy > 50 ? '' : G.energy > 25 ? 'mid' : 'low';
    ui.vignette.style.opacity = G.energy < 30 ? ((30 - G.energy) / 30 * 0.9).toFixed(2) : 0;
  }
  ui.timer.textContent = '⏱ ' + fmtTime(G.time);
  const st = [];
  if (G.carrying) st.push('🤢 Bærer søppel');
  if (G.ir.active) st.push('🔥 Varmesyn');
  if (G.coffee.state === 'brewing') st.push(`☕ ${Math.round(G.coffee.progress * 100)} %`);
  if (G.coffee.state === 'ready') st.push('☕ Kaffen er klar!');
  const s = st.join(' · ');
  if (ui.status.textContent !== s) ui.status.textContent = s;
}

// ---------- Hovedløkke ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
