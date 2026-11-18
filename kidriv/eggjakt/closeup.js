// Nærbildet: vises når man leter i/under/bak noe, eller setter på / drikker kaffe.

const CU_W = 640, CU_H = 340;
const cuCanvas = document.getElementById('cuCanvas');
const cuc = cuCanvas.getContext('2d');
const cuEl = {
  root: document.getElementById('closeup'),
  title: document.getElementById('cuTitle'),
  text: document.getElementById('cuText'),
  buttons: document.getElementById('cuButtons'),
};

const CU = {
  open: false,
  kind: null,     // 'search' | 'brew' | 'drink'
  ob: null,
  t: 0,
  dur: 0.9,
  phase: null,    // 'ask' | 'moving' | 'revealed' | 'done'
  step: 0,
  timer: 0,
  hover: null,
  onClose: null,
  onMoved: null,
};

// Hva man gjør med de ulike tingene
const SEARCH_VERB = {
  desk: 'Dra ut skuffen',
  cabinet: 'Dra ut skuffen',
  shelf: 'Flytt bøkene',
  plant: 'Flytt potteplanten',
  box: 'Flytt esken',
  paper: 'Flytt papirbunken',
  coatrack: 'Flytt jakken',
  sofa: 'Løft sofaputen',
  printer: 'Åpne luka',
  fridge: 'Åpne kjøleskapet',
  counter: 'Åpne skapdørene',
};

// ---------- Åpne / lukke ----------
function cuOpen(kind, ob, title) {
  CU.open = true;
  CU.kind = kind;
  CU.ob = ob;
  CU.t = 0;
  CU.phase = 'ask';
  CU.step = 0;
  CU.timer = 0;
  CU.hover = null;
  CU.onClose = null;
  CU.onMoved = null;
  cuEl.title.textContent = title;
  cuEl.root.classList.remove('hidden');
  hideTooltip();
}

function cuClose() {
  if (!CU.open) return;
  if (CU.phase === 'moving') return; // vent til animasjonen er ferdig
  CU.open = false;
  cuEl.root.classList.add('hidden');
  const f = CU.onClose;
  CU.onClose = null;
  if (f) f();
}

function cuForceClose() {
  CU.open = false;
  CU.onClose = null;
  cuEl.root.classList.add('hidden');
}

function cuText(html) { cuEl.text.innerHTML = html; }

function cuButtons(list) {
  cuEl.buttons.innerHTML = '';
  for (const b of list) {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || '');
    el.textContent = b.label;
    el.addEventListener('click', () => { Sfx.play('click'); b.fn(); });
    cuEl.buttons.appendChild(el);
  }
  const first = cuEl.buttons.querySelector('button');
  if (first) setTimeout(() => first.focus(), 30);
}

// ---------- Leting ----------
function openSearch(ob) {
  const verb = SEARCH_VERB[ob.type] || 'Flytt på den';
  cuOpen('search', ob, ob.name);
  cuText(`Kan eggene være gjemt her? <b>${verb}</b> koster <b>10 energi</b>.`);
  cuButtons([
    { label: `${verb} (−10 ⚡)`, cls: 'primary', fn: startSearchMove },
    { label: 'Gå tilbake', fn: cuClose },
  ]);
}

function startSearchMove() {
  if (CU.phase !== 'ask') return;
  CU.ob.searched = true;
  G.moved++;
  Sfx.play('move');
  addEnergy(-10);
  if (G.state !== 'play') return;
  CU.phase = 'moving';
  CU.dur = 0.95;
  CU.onMoved = revealContent;
  cuText('…');
  cuButtons([]);
}

function revealContent() {
  const c = CU.ob.content;
  switch (c.kind) {
    case 'eggs':
      Sfx.play('win');
      cuText('<b>DER ER DE!</b> 🥚 En hel kartong med 24 egg – og alle er hele!');
      CU.onClose = () => winGame();
      cuButtons([{ label: 'Lever eggene i resepsjonen! 🥚', cls: 'good', fn: cuClose }]);
      break;
    case 'candy':
    case 'cake': {
      Sfx.play('pickup');
      cuText(`Du fant <b>${c.name}</b>! 😋 Spis nå eller ta med til senere.`);
      const take = () => addInventory(c);
      CU.onClose = take;
      cuButtons([
        { label: `Spis nå (+${c.energy} ⚡)`, cls: 'good', fn: () => { CU.onClose = () => eatFood(c); cuClose(); } },
        { label: 'Ta med', fn: cuClose },
      ]);
      break;
    }
    case 'goggles':
      Sfx.play('pickup');
      cuText('Du fant <b>databriller med varmesyn (IR)</b>! Med dem ser du gjennom ting: <b style="color:#1f9d4c">grønt lys</b> er noe bra, <b style="color:#d32f2f">rødt lys</b> er noe ekkelt. ' +
        'Trykk <kbd>I</kbd> eller klikk på brillene for å bruke dem – men batteriet varer ikke lenge.');
      CU.onClose = () => addInventory(c);
      cuButtons([{ label: 'Ta med brillene 🥽', cls: 'good', fn: cuClose }]);
      break;
    case 'trash':
      Sfx.play('yuck');
      addEnergy(-5);
      if (G.state !== 'play') return;
      cuText(`Æsj! Det var <b>${c.name}</b> (−5 ⚡). Det må kastes i en søppelbøtte – ` +
        'og det stinker så mye at du blir ekstra sliten så lenge du bærer på det.');
      CU.onClose = () => {
        G.carrying = c;
        toast('🤢 Du bærer på søppel. Finn en søppelbøtte (de blinker grønt)!');
      };
      cuButtons([{ label: 'Plukk opp 🤢', cls: 'primary', fn: cuClose }]);
      break;
    case 'note':
      Sfx.play('pickup');
      cuText('Det lå en gul lapp her. Kanskje et spor?');
      cuButtons([{ label: 'Ok', fn: cuClose }]);
      CU.onClose = () => toast('📝 ' + c.text, 6000);
      break;
    default:
      cuText(c.text);
      cuButtons([{ label: 'Lukk', fn: cuClose }]);
  }
}

// ---------- Kaffe ----------
const BREW_STEPS = [
  { id: 'filter', todo: 'Legg i et kaffefilter', hint: 'Først må du legge et filter i trakteren.' },
  { id: 'kaffe', todo: 'Fyll på kaffe', hint: 'Nå trengs det kaffe i filteret.' },
  { id: 'vann', todo: 'Hell i vann', hint: 'Trakteren trenger vann.' },
  { id: 'start', todo: 'Trykk på startknappen', hint: 'Alt er klart – trykk på den røde knappen!' },
];
const BREW_HOT = [
  { id: 'filter', label: 'Kaffefilter', x: 36, y: 186, w: 118, h: 86 },
  { id: 'kaffe', label: 'Kaffe', x: 436, y: 168, w: 82, h: 104 },
  { id: 'vann', label: 'Vann', x: 532, y: 140, w: 92, h: 132 },
  { id: 'start', label: 'Start', x: 345, y: 214, w: 42, h: 42 },
];

function coffeeInteract(ob) {
  const cf = G.coffee;
  if (cf.state === 'brewing') {
    toast(`☕ Kaffen traktes… ${Math.round(cf.progress * 100)} % ferdig.`);
    return;
  }
  if (cf.state === 'ready') return openDrink(ob);
  if (cf.brewsLeft <= 0) {
    Sfx.play('denied');
    toast('Kaffeboksen er tom! Noen har drukket opp all kaffen. 😩');
    return;
  }
  openBrew(ob);
}

function openBrew(ob) {
  cuOpen('brew', ob, 'Sett på kaffe ☕');
  updateBrewText();
  cuButtons([{ label: 'Avbryt', fn: cuClose }]);
}

function updateBrewText(extra) {
  const list = BREW_STEPS.map((s, i) => {
    if (i < CU.step) return `<span style="color:#2a8f57">✓ ${s.todo}</span>`;
    if (i === CU.step) return `<b>${i + 1}. ${s.todo}</b>`;
    return `<span style="color:#999">${i + 1}. ${s.todo}</span>`;
  }).join(' &nbsp;·&nbsp; ');
  cuText((extra ? extra + '<br>' : 'Klikk på tingene i riktig rekkefølge:<br>') + list);
}

function brewClick(id) {
  if (CU.phase !== 'ask') return;
  const want = BREW_STEPS[CU.step];
  if (id !== want.id) {
    Sfx.play('denied');
    updateBrewText(`<span style="color:#c0392b">Hmm… ${want.hint}</span>`);
    return;
  }
  CU.step++;
  Sfx.play(CU.step === 4 ? 'brew' : 'click');
  if (CU.step < 4) {
    updateBrewText();
    return;
  }
  // Ferdig – trakteren går
  G.coffee.state = 'brewing';
  G.coffee.progress = 0;
  G.coffee.brewsLeft--;
  CU.phase = 'done';
  CU.timer = 0;
  addEnergy(5);
  cuText('Trakteren putrer i gang! Bare lukten gir deg <b>+5 energi</b>. ' +
    'Kaffen er klar om ca. 20 sekunder – kom tilbake og drikk den.');
  cuButtons([{ label: 'Fortsett letingen', cls: 'good', fn: cuClose }]);
}

function openDrink(ob) {
  cuOpen('drink', ob, 'Kaffepause ☕');
  const cups = G.coffee.cups;
  cuText(`Det er <b>${cups}</b> ${cups === 1 ? 'kopp' : 'kopper'} igjen i kanna. En kopp gir <b>+20 energi</b>.`);
  cuButtons([
    { label: 'Hell opp og drikk (+20 ⚡)', cls: 'good', fn: startPour },
    { label: 'Ikke nå', fn: cuClose },
  ]);
}

function startPour() {
  if (CU.phase !== 'ask') return;
  CU.phase = 'moving';
  CU.dur = 1.7;
  Sfx.play('slurp');
  cuButtons([]);
  cuText('Glugg glugg glugg…');
  CU.onMoved = () => {
    const cf = G.coffee;
    cf.cups--;
    if (cf.cups <= 0) {
      cf.state = 'empty';
      cf.cups = 0;
    }
    addEnergy(20);
    Sfx.play('eat');
    const left = cf.state === 'empty'
      ? (cf.brewsLeft > 0 ? 'Kanna er tom – du kan sette på mer.' : 'Kanna er tom, og det er ikke mer kaffe igjen i boksen.')
      : `Det er ${cf.cups} ${cf.cups === 1 ? 'kopp' : 'kopper'} igjen.`;
    cuText(`Ahh! Varm, god kontorkaffe. <b>+20 energi</b>. ${left}`);
    cuButtons([{ label: 'Tilbake til jakten', cls: 'good', fn: cuClose }]);
  };
}

// ---------- Oppdatering ----------
function cuUpdate(dt) {
  if (!CU.open) return;
  CU.timer += dt;
  if (CU.phase === 'moving') {
    CU.t = Math.min(1, CU.t + dt / CU.dur);
    if (CU.t >= 1) {
      CU.phase = 'revealed';
      const f = CU.onMoved;
      CU.onMoved = null;
      if (f) f();
    }
  }
}

// ---------- Mus i nærbildet ----------
function cuPoint(e) {
  const r = cuCanvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * CU_W, y: (e.clientY - r.top) / r.height * CU_H };
}

function brewHit(p) {
  for (const h of BREW_HOT) {
    if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h;
  }
  return null;
}

cuCanvas.addEventListener('mousemove', (e) => {
  if (!CU.open || CU.kind !== 'brew' || CU.phase !== 'ask') { CU.hover = null; cuCanvas.style.cursor = 'default'; return; }
  const h = brewHit(cuPoint(e));
  CU.hover = h ? h.id : null;
  cuCanvas.style.cursor = h ? 'pointer' : 'default';
});

cuCanvas.addEventListener('click', (e) => {
  if (!CU.open) return;
  if (CU.kind === 'brew') {
    const h = brewHit(cuPoint(e));
    if (h) brewClick(h.id);
  } else if (CU.kind === 'search' && CU.phase === 'ask') {
    startSearchMove(); // man kan også klikke direkte på tingen
  }
});

// ================= TEGNING =================

const ROOM_BG = {
  boss: { wall: '#eadccb', floor: '#9a6a43' },
  kitchen: { wall: '#e3efea', floor: '#e2ded4' },
  meeting: { wall: '#e4e7f1', floor: '#c9a06e' },
  reception: { wall: '#f0e7d8', floor: '#d6cfc2' },
  open: { wall: '#e5e9ef', floor: '#9fb0bf' },
};

function cuBackground(c, roomKey) {
  const bg = ROOM_BG[roomKey] || ROOM_BG.open;
  c.fillStyle = bg.wall;
  c.fillRect(0, 0, CU_W, 250);
  c.fillStyle = 'rgba(0,0,0,0.04)';
  for (let x = 0; x < CU_W; x += 40) c.fillRect(x, 0, 20, 250);
  c.fillStyle = shade(bg.wall, -0.25);
  c.fillRect(0, 238, CU_W, 12);
  const g = c.createLinearGradient(0, 250, 0, CU_H);
  g.addColorStop(0, shade(bg.floor, -0.15));
  g.addColorStop(1, bg.floor);
  c.fillStyle = g;
  c.fillRect(0, 250, CU_W, CU_H - 250);
}

function renderCU(time, pxRatio) {
  if (!CU.open) return;
  const c = cuc;
  c.setTransform(pxRatio, 0, 0, pxRatio, 0, 0);
  c.clearRect(0, 0, CU_W, CU_H);
  if (CU.kind === 'search') drawSearchScene(c, time);
  else drawCoffeeScene(c, time);
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function drawSearchScene(c, time) {
  const ob = CU.ob;
  cuBackground(c, ob.room.key);
  const t = easeInOut(CU.t);
  const content = ob.content;
  const item = (cx, by, s) => {
    if (CU.t <= 0.02) return;
    c.save();
    c.globalAlpha = clamp01((CU.t - 0.12) / 0.45);
    if (CU.phase === 'revealed' && content.kind === 'eggs') {
      const gy = by - 70 * s;
      const g = c.createRadialGradient(cx, gy, 10, cx, gy, 200 * s + 40);
      g.addColorStop(0, 'rgba(255,240,150,0.9)');
      g.addColorStop(1, 'rgba(255,240,150,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(cx, gy, 200 * s + 40, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,230,120,0.35)';
      for (let i = 0; i < 12; i++) {
        const a = time * 0.6 + (i / 12) * Math.PI * 2;
        c.beginPath();
        c.moveTo(cx, gy);
        c.arc(cx, gy, 260 * s + 60, a, a + 0.12);
        c.closePath();
        c.fill();
      }
    }
    drawItemArt(c, content, cx, by, s, time);
    c.restore();
  };
  const scene = SCENES[ob.type] || SCENES.box;
  scene(c, t, item, ob, time);

  if (CU.phase === 'ask') {
    c.fillStyle = 'rgba(255,255,255,0.85)';
    rr(c, 236, 8, 168, 26, 13);
    c.fill();
    c.fillStyle = '#555';
    c.font = 'bold 13px "Trebuchet MS", sans-serif';
    c.textAlign = 'center';
    c.fillText('Klikk for å flytte', 320, 26);
    c.textAlign = 'left';
  }
}

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function floorShadow(c, cx, w, alpha = 0.25) {
  c.fillStyle = `rgba(0,0,0,${alpha})`;
  c.beginPath();
  c.ellipse(cx, 320, w / 2, 12, 0, 0, Math.PI * 2);
  c.fill();
}

function slideXform(c, t, px, py) {
  c.translate(px + t * 255, py - Math.sin(t * Math.PI) * 60);
  c.rotate(t * 0.18);
  c.translate(-px, -py);
}

function drawerFront(c, x, y, w, h, col, metal) {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 2;
  c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  c.fillStyle = metal ? '#e5e8eb' : '#cfd3d8';
  rr(c, x + w / 2 - 26, y + h * 0.4, 52, 9, 4);
  c.fill();
  if (metal) {
    c.fillStyle = '#fff';
    c.fillRect(x + w / 2 - 20, y + 10, 40, 14);
    c.strokeStyle = '#888';
    c.strokeRect(x + w / 2 - 20, y + 10, 40, 14);
  }
  c.lineWidth = 1;
}

function pulledDrawer(c, t, item, o) {
  // o: { cx, top, w, h, pull, s, body, inside, metal }
  const p = t * o.pull;
  const fw = o.w + 26 * t, fh = o.h + 12 * t;
  const fx = o.cx - fw / 2, fy = o.top + p;
  const x0 = o.cx - o.w / 2;
  c.save();
  c.beginPath();
  c.moveTo(x0, o.top);
  c.lineTo(x0 + o.w, o.top);
  c.lineTo(fx + fw, fy);
  c.lineTo(fx, fy);
  c.closePath();
  c.fillStyle = o.inside;
  c.fill();
  c.clip();
  // sidevegger i skuffen
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.fillRect(x0 - 20, o.top, 30, p + 10);
  c.fillRect(x0 + o.w - 10, o.top, 30, p + 10);
  item(o.cx, fy - 2, o.s);
  c.restore();
  drawerFront(c, fx, fy, fw, fh, o.body, o.metal);
}

function swingDoor(c, hx, y, w, h, t, col, dir, handle) {
  const a = t * Math.PI * 0.46;
  const ww = Math.max(2, w * Math.cos(a));
  const bulge = Math.sin(a) * 18;
  const fx = hx + dir * ww;
  c.beginPath();
  c.moveTo(hx, y);
  c.lineTo(fx, y - bulge);
  c.lineTo(fx, y + h + bulge);
  c.lineTo(hx, y + h);
  c.closePath();
  c.fillStyle = t > 0.55 ? shade(col, -0.1) : col;
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.3)';
  c.lineWidth = 2;
  c.stroke();
  c.lineWidth = 1;
  if (handle && ww > 20) {
    c.fillStyle = handle.color;
    const hxp = hx + dir * (ww - 18);
    c.fillRect(hxp - 3, y + h * handle.y - bulge * 0.3, 6, h * handle.h);
  }
}

function drawPlantBig(c, ob, time) {
  const leafA = ob.variant === 'herb' ? '#5cbf5f' : '#2f8a4a';
  const leafB = ob.variant === 'herb' ? '#43a047' : '#3fa35c';
  const sway = Math.sin(time * 1.5) * 3;
  if (ob.variant === 'palm') {
    c.strokeStyle = '#6b4a2a';
    c.lineWidth = 12;
    c.beginPath();
    c.moveTo(320, 200);
    c.lineTo(320 + sway, 70);
    c.stroke();
    c.strokeStyle = '#2f8f4e';
    c.lineWidth = 14;
    c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.5;
      c.beginPath();
      c.moveTo(320 + sway, 70);
      c.quadraticCurveTo(320 + sway + Math.cos(a) * 80, 70 + Math.sin(a) * 60 - 20,
        320 + sway + Math.cos(a) * 140, 70 + Math.sin(a) * 50 + 70);
      c.stroke();
    }
    c.lineCap = 'butt';
  } else {
    const leaves = ob.variant === 'tall'
      ? [[-60, 80, 46], [60, 70, 48], [0, 30, 46], [-40, 130, 40], [50, 140, 40], [0, 100, 44]]
      : [[-80, 150, 52], [80, 140, 52], [0, 90, 60], [-50, 90, 44], [55, 85, 44], [0, 160, 50]];
    c.strokeStyle = '#4c6b2a';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(320, 200);
    c.lineTo(320 + sway, 90);
    c.stroke();
    leaves.forEach(([lx, ly, r], i) => {
      c.fillStyle = i % 2 ? leafA : leafB;
      c.beginPath();
      c.ellipse(320 + lx + sway, ly, r, r * 0.75, i * 0.7, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.15)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(320 + lx + sway - r * 0.6, ly);
      c.lineTo(320 + lx + sway + r * 0.6, ly);
      c.stroke();
    });
  }
  c.lineWidth = 1;
  // potte
  const potCol = ob.variant === 'herb' ? '#e8e8e8' : '#c96f3b';
  c.fillStyle = potCol;
  c.beginPath();
  c.moveTo(200, 196);
  c.lineTo(440, 196);
  c.lineTo(410, 318);
  c.lineTo(230, 318);
  c.closePath();
  c.fill();
  c.fillStyle = shade(potCol, -0.15);
  c.fillRect(192, 186, 256, 24);
  c.fillStyle = '#5b3a24';
  c.beginPath();
  c.ellipse(320, 188, 120, 10, 0, 0, Math.PI * 2);
  c.fill();
}

const SCENES = {
  desk(c, t, item, ob) {
    const top = ob.boss ? '#7a4a2a' : '#d9b47f';
    const body = shade(top, -0.1);
    floorShadow(c, 320, 560, 0.2);
    c.fillStyle = '#5a5f68';
    c.fillRect(70, 88, 18, 232);
    c.fillStyle = body;
    c.fillRect(330, 88, 260, 232);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.strokeRect(330.5, 88.5, 259, 231);
    c.fillStyle = '#2b1d10';
    c.fillRect(350, 100, 220, 62);
    drawerFront(c, 350, 172, 220, 62, body);
    drawerFront(c, 350, 244, 220, 62, body);
    // bordplate med ting
    c.fillStyle = '#fff';
    rr(c, 470, 8, 36, 34, 4);
    c.fill();
    c.fillStyle = '#6b4226';
    c.fillRect(474, 12, 28, 6);
    c.fillStyle = '#fafafa';
    c.fillRect(120, 22, 120, 20);
    c.fillStyle = '#d0d0d0';
    c.fillRect(126, 26, 108, 3);
    c.fillStyle = top;
    c.fillRect(40, 42, 560, 34);
    c.fillStyle = shade(top, -0.22);
    c.fillRect(40, 76, 560, 12);
    pulledDrawer(c, t, item, { cx: 460, top: 100, w: 220, h: 62, pull: 112, s: 0.62, body, inside: '#c9a274' });
  },

  cabinet(c, t, item) {
    floorShadow(c, 320, 220, 0.22);
    c.fillStyle = '#aab1b8';
    c.fillRect(230, 20, 180, 300);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.strokeRect(230.5, 20.5, 179, 299);
    c.fillStyle = '#2f3438';
    c.fillRect(244, 32, 152, 86);
    drawerFront(c, 244, 128, 152, 86, '#b9c0c7', true);
    drawerFront(c, 244, 224, 152, 86, '#b9c0c7', true);
    pulledDrawer(c, t, item, { cx: 320, top: 32, w: 152, h: 86, pull: 128, s: 0.5, body: '#b9c0c7', inside: '#7d858c', metal: true });
  },

  shelf(c, t, item, ob) {
    floorShadow(c, 320, 400, 0.2);
    c.fillStyle = '#8d5d36';
    c.fillRect(130, 10, 380, 310);
    c.fillStyle = '#4a2e18';
    c.fillRect(142, 22, 356, 286);
    const rowBooks = (row, bottom, height) => {
      const fw = 348;
      row.forEach((b) => {
        const bw = b.w * fw;
        if (b.x * fw + bw > fw) return;
        const bh = height * b.h;
        c.fillStyle = b.c;
        c.fillRect(146 + b.x * fw, bottom - bh, bw, bh);
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(146 + b.x * fw + bw * 0.3, bottom - bh + 10, bw * 0.4, 4);
      });
    };
    rowBooks(ob.books[0], 108, 82);
    rowBooks(ob.books[2], 304, 88);
    c.fillStyle = '#8d5d36';
    c.fillRect(142, 108, 356, 10);
    c.fillRect(142, 206, 356, 10);
    item(320, 206, 0.5);
    c.save();
    slideXform(c, t, 320, 206);
    rowBooks(ob.books[1], 206, 84);
    c.restore();
  },

  plant(c, t, item, ob, time) {
    item(320, 318, 0.8);
    floorShadow(c, 320 + t * 255, 240, 0.25);
    c.save();
    slideXform(c, t, 320, 318);
    drawPlantBig(c, ob, time);
    c.restore();
  },

  box(c, t, item) {
    item(320, 318, 0.8);
    floorShadow(c, 320 + t * 255, 300, 0.25);
    c.save();
    slideXform(c, t, 320, 318);
    c.fillStyle = '#dfb67c';
    c.beginPath();
    c.moveTo(176, 118);
    c.lineTo(464, 118);
    c.lineTo(440, 78);
    c.lineTo(200, 78);
    c.closePath();
    c.fill();
    c.fillStyle = '#c7975b';
    c.fillRect(176, 118, 288, 200);
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 2;
    c.strokeRect(177, 119, 286, 198);
    c.fillStyle = '#efd9ae';
    c.fillRect(308, 78, 24, 240);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.font = 'bold 26px "Trebuchet MS", sans-serif';
    c.fillText('KONTOR', 196, 170);
    c.font = 'bold 22px sans-serif';
    c.fillText('↑↑', 400, 300);
    c.lineWidth = 1;
    c.restore();
  },

  paper(c, t, item) {
    item(320, 318, 0.8);
    floorShadow(c, 320 + t * 255, 280, 0.2);
    c.save();
    slideXform(c, t, 320, 318);
    for (let i = 0; i < 40; i++) {
      const y = 318 - i * 4.2;
      const off = Math.sin(i * 1.7) * 6;
      c.fillStyle = i % 2 ? '#fbfbf6' : '#efefe8';
      c.fillRect(180 + off, y - 4, 280, 4.2);
    }
    c.fillStyle = '#fbfbf6';
    c.fillRect(176, 136, 288, 12);
    c.fillStyle = '#2a2a2a';
    c.fillRect(300, 126, 40, 18);
    c.restore();
  },

  coatrack(c, t, item, ob) {
    c.fillStyle = '#3b3b3b';
    c.fillRect(314, 10, 12, 308);
    c.beginPath();
    c.ellipse(320, 318, 70, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(270, 28, 100, 8);
    item(320, 318, 0.8);
    c.save();
    slideXform(c, t, 320, 40);
    const col = ob.color;
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(290, 40);
    c.lineTo(350, 40);
    c.lineTo(440, 90);
    c.lineTo(450, 318);
    c.lineTo(190, 318);
    c.lineTo(200, 90);
    c.closePath();
    c.fill();
    c.strokeStyle = shade(col, -0.35);
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(320, 70);
    c.lineTo(320, 318);
    c.stroke();
    c.fillStyle = shade(col, -0.25);
    c.beginPath();
    c.moveTo(290, 40);
    c.lineTo(320, 110);
    c.lineTo(350, 40);
    c.closePath();
    c.fill();
    c.fillStyle = '#222';
    [130, 180, 230, 280].forEach((by) => {
      c.beginPath();
      c.arc(332, by, 5, 0, Math.PI * 2);
      c.fill();
    });
    c.strokeStyle = shade(col, -0.3);
    c.strokeRect(220, 220, 60, 40);
    c.strokeRect(360, 220, 60, 40);
    c.lineWidth = 1;
    c.restore();
  },

  sofa(c, t, item, ob) {
    const col = ob.color;
    floorShadow(c, 320, 560, 0.2);
    c.fillStyle = shade(col, 0.05);
    rr(c, 70, 80, 500, 140, 30);
    c.fill();
    c.fillStyle = shade(col, -0.1);
    c.fillRect(60, 200, 520, 70);
    c.fillStyle = shade(col, -0.3);
    c.fillRect(60, 262, 520, 50);
    c.fillStyle = '#3a2a1a';
    c.fillRect(80, 312, 14, 10);
    c.fillRect(546, 312, 14, 10);
    c.fillStyle = shade(col, 0.1);
    rr(c, 120, 140, 110, 122, 20);
    c.fill();
    rr(c, 410, 140, 110, 122, 20);
    c.fill();
    c.fillStyle = shade(col, -0.2);
    rr(c, 36, 150, 80, 162, 24);
    c.fill();
    rr(c, 524, 150, 80, 162, 24);
    c.fill();
    item(320, 262, 0.55);
    c.save();
    slideXform(c, t, 320, 200);
    c.fillStyle = shade(col, 0.18);
    rr(c, 228, 134, 184, 130, 24);
    c.fill();
    c.strokeStyle = shade(col, -0.1);
    c.setLineDash([6, 6]);
    c.lineWidth = 2;
    rr(c, 240, 146, 160, 106, 18);
    c.stroke();
    c.setLineDash([]);
    c.lineWidth = 1;
    c.restore();
  },

  printer(c, t, item) {
    floorShadow(c, 320, 320, 0.22);
    c.fillStyle = '#d9dce0';
    c.fillRect(170, 40, 300, 280);
    c.fillStyle = '#bfc3c9';
    c.fillRect(162, 30, 316, 44);
    c.fillStyle = '#9aa0a7';
    c.fillRect(170, 74, 300, 6);
    c.fillStyle = '#2d3136';
    rr(c, 372, 92, 86, 54, 6);
    c.fill();
    c.fillStyle = '#7fd67f';
    c.fillRect(378, 98, 74, 24);
    c.fillStyle = '#1d3d1d';
    c.font = 'bold 10px monospace';
    c.textAlign = 'center';
    c.fillText('PAPIRSTOPP', 415, 114);
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillRect(190, 100, 150, 40);
    c.fillStyle = '#ddd';
    c.fillRect(196, 108, 120, 3);
    c.fillRect(196, 116, 100, 3);
    c.fillStyle = '#3c3f44';
    c.fillRect(188, 172, 264, 138);
    c.fillStyle = '#23262a';
    c.fillRect(200, 180, 240, 14);
    item(320, 306, 0.55);
    swingDoor(c, 188, 170, 264, 140, t, '#cfd3d8', 1, { color: '#7d838a', y: 0.3, h: 0.35 });
  },

  fridge(c, t, item) {
    floorShadow(c, 320, 240, 0.2);
    c.fillStyle = '#e1e6e9';
    rr(c, 208, 8, 224, 314, 14);
    c.fill();
    c.fillStyle = '#f6f8f9';
    rr(c, 214, 14, 212, 86, 10);
    c.fill();
    c.fillStyle = '#9aa1a8';
    c.fillRect(400, 30, 8, 50);
    // innsiden
    const g = c.createLinearGradient(0, 108, 0, 312);
    g.addColorStop(0, '#fffbe3');
    g.addColorStop(1, '#dfeef3');
    c.fillStyle = g;
    c.fillRect(220, 108, 200, 204);
    c.fillStyle = '#cfe3ea';
    c.fillRect(220, 196, 200, 6);
    // melk og syltetøy
    c.fillStyle = '#fff';
    c.fillRect(236, 136, 36, 60);
    c.fillStyle = '#3d7ee0';
    c.fillRect(236, 150, 36, 18);
    c.fillStyle = '#b3243a';
    rr(c, 300, 160, 40, 36, 6);
    c.fill();
    c.fillStyle = '#f2e7c9';
    c.fillRect(300, 152, 40, 10);
    c.fillStyle = '#f4f1ea';
    c.beginPath();
    c.ellipse(385, 186, 22, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(363, 166, 44, 20);
    item(320, 308, 0.62);
    swingDoor(c, 214, 106, 212, 210, t, '#f6f8f9', 1, { color: '#9aa1a8', y: 0.08, h: 0.32 });
  },

  counter(c, t, item) {
    floorShadow(c, 320, 460, 0.2);
    // ting på benken
    c.fillStyle = '#c0c4c8';
    rr(c, 140, 62, 90, 44, 8);
    c.fill();
    c.fillStyle = '#333';
    c.fillRect(156, 62, 22, 6);
    c.fillRect(190, 62, 22, 6);
    c.fillStyle = '#e8d9b5';
    c.beginPath();
    c.ellipse(440, 98, 50, 12, 0, 0, Math.PI);
    c.fill();
    c.fillStyle = '#f4a83a';
    c.beginPath();
    c.arc(420, 92, 12, 0, Math.PI * 2);
    c.arc(446, 90, 12, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e7e3dc';
    c.fillRect(96, 104, 448, 24);
    c.fillStyle = '#a37b52';
    c.fillRect(104, 128, 432, 192);
    c.fillStyle = '#4a3420';
    c.fillRect(112, 136, 416, 176);
    c.fillStyle = '#6b4f33';
    c.fillRect(112, 222, 416, 6);
    // tallerkener
    for (let i = 0; i < 5; i++) {
      c.fillStyle = i % 2 ? '#f4f4f4' : '#e6e6e6';
      c.fillRect(130, 214 - i * 6, 80, 6);
    }
    c.fillStyle = '#d9534f';
    c.beginPath();
    c.ellipse(470, 210, 34, 12, 0, 0, Math.PI);
    c.fill();
    item(320, 308, 0.66);
    swingDoor(c, 112, 136, 208, 176, t, '#b58a5e', 1, { color: '#ddd', y: 0.1, h: 0.18 });
    swingDoor(c, 528, 136, 208, 176, t, '#b58a5e', -1, { color: '#ddd', y: 0.1, h: 0.18 });
  },
};

// ---------- Kaffescene ----------
function drawPot(c, cx, by, level, rot) {
  c.save();
  c.translate(cx, by);
  c.rotate(rot);
  // kaffe
  if (level > 0) {
    c.fillStyle = '#4a2810';
    const lh = 70 * level;
    c.fillRect(-38, -lh - 4, 76, lh);
  }
  c.fillStyle = 'rgba(210,235,250,0.45)';
  rr(c, -42, -88, 84, 88, 14);
  c.fill();
  c.strokeStyle = 'rgba(80,110,130,0.7)';
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = '#222';
  c.fillRect(-44, -96, 88, 12);
  c.beginPath();
  c.moveTo(42, -96);
  c.lineTo(58, -100);
  c.lineTo(42, -84);
  c.fill();
  c.strokeStyle = '#222';
  c.lineWidth = 8;
  c.beginPath();
  c.moveTo(-42, -76);
  c.quadraticCurveTo(-72, -60, -42, -24);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.4)';
  c.fillRect(-30, -76, 8, 56);
  c.restore();
  c.lineWidth = 1;
}

function drawCoffeeScene(c, time) {
  // flislagt vegg
  c.fillStyle = '#e8f0ec';
  c.fillRect(0, 0, CU_W, 270);
  c.strokeStyle = '#cddbd4';
  c.beginPath();
  for (let x = 0; x <= CU_W; x += 34) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, 270); }
  for (let y = 0; y <= 270; y += 34) { c.moveTo(0, y + 0.5); c.lineTo(CU_W, y + 0.5); }
  c.stroke();
  // benk
  c.fillStyle = '#e7e3dc';
  c.fillRect(0, 270, CU_W, 18);
  c.fillStyle = '#a37b52';
  c.fillRect(0, 288, CU_W, 52);
  c.fillStyle = 'rgba(0,0,0,0.12)';
  c.fillRect(0, 288, CU_W, 4);

  const brew = CU.kind === 'brew';
  const step = brew ? CU.step : 4;

  if (brew) {
    // filterpakke
    c.fillStyle = '#f5f2ea';
    c.fillRect(46, 206, 98, 66);
    c.fillStyle = '#8a5a2b';
    c.fillRect(46, 230, 98, 22);
    c.fillStyle = '#fff';
    c.font = 'bold 14px "Trebuchet MS", sans-serif';
    c.fillText('FILTER', 68, 246);
    if (step < 1) {
      c.fillStyle = '#efe2c8';
      c.beginPath();
      c.moveTo(66, 206);
      c.lineTo(124, 206);
      c.lineTo(104, 190);
      c.lineTo(86, 190);
      c.closePath();
      c.fill();
    }
    // kaffeboks
    c.fillStyle = '#c0392b';
    if (step < 2) c.fillRect(442, 176, 70, 14);
    c.fillStyle = 'rgba(220,235,245,0.55)';
    c.fillRect(446, 190, 62, 82);
    c.fillStyle = '#4a2810';
    c.fillRect(448, step >= 2 ? 236 : 204, 58, step >= 2 ? 34 : 66);
    c.fillStyle = '#fff';
    c.fillRect(452, 214, 50, 18);
    c.fillStyle = '#4a2810';
    c.font = 'bold 12px "Trebuchet MS", sans-serif';
    c.fillText('KAFFE', 458, 228);
    // vannkanne
    c.fillStyle = 'rgba(210,235,250,0.5)';
    c.beginPath();
    c.moveTo(546, 160);
    c.lineTo(606, 160);
    c.lineTo(612, 272);
    c.lineTo(540, 272);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(80,110,130,0.7)';
    c.lineWidth = 3;
    c.stroke();
    if (step < 3) {
      c.fillStyle = 'rgba(70,150,230,0.6)';
      c.fillRect(544, 190, 64, 80);
    }
    c.beginPath();
    c.moveTo(606, 176);
    c.quadraticCurveTo(634, 200, 608, 240);
    c.stroke();
    c.lineWidth = 1;
  } else {
    // kopp
    const fill = CU.phase === 'ask' ? 0 : clamp01((CU.t - 0.45) / 0.4);
    c.fillStyle = '#fff';
    rr(c, 466, 206, 70, 66, 10);
    c.fill();
    c.strokeStyle = '#ccc';
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = '#fff';
    c.lineWidth = 9;
    c.beginPath();
    c.arc(540, 236, 16, -Math.PI / 2, Math.PI / 2);
    c.stroke();
    c.lineWidth = 1;
    // kanten på koppen – innsiden blir brun når den fylles
    c.fillStyle = '#d9d9d9';
    c.beginPath();
    c.ellipse(501, 208, 33, 7, 0, 0, Math.PI * 2);
    c.fill();
    if (fill > 0) {
      c.fillStyle = `rgba(74,40,16,${0.25 + 0.75 * fill})`;
      c.beginPath();
      c.ellipse(501, 208.5, 29 * (0.6 + 0.4 * fill), 5.5 * (0.6 + 0.4 * fill), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#e74c3c';
    c.font = 'bold 13px "Trebuchet MS", sans-serif';
    c.fillText('JEG ♥', 480, 246);
    c.fillText('KAFFE', 478, 262);
    if (CU.phase === 'revealed') {
      for (let i = 0; i < 3; i++) {
        const p = (time * 0.7 + i / 3) % 1;
        c.fillStyle = `rgba(255,255,255,${0.7 * (1 - p)})`;
        c.beginPath();
        c.arc(490 + i * 12 + Math.sin(p * 6) * 5, 196 - p * 70, 7 + p * 8, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  // --- traktermaskinen ---
  c.fillStyle = '#2d2d2d';
  c.fillRect(206, 252, 198, 20);
  c.fillStyle = '#3b3b3b';
  c.fillRect(330, 50, 74, 204);
  // vanntank-vindu
  c.fillStyle = 'rgba(190,215,230,0.55)';
  c.fillRect(348, 120, 38, 84);
  const water = brew ? (step >= 3 ? (step >= 4 ? Math.max(0.1, 0.9 - G.coffee.progress) : 0.9) : 0) : 0.15;
  if (water > 0) {
    c.fillStyle = 'rgba(60,140,220,0.8)';
    c.fillRect(348, 204 - 84 * water, 38, 84 * water);
  }
  // hode
  c.fillStyle = '#2d2d2d';
  rr(c, 206, 50, 198, 62, 10);
  c.fill();
  if (brew && step >= 1) {
    // åpent lokk med filter
    c.fillStyle = '#4a4a4a';
    c.fillRect(214, 6, 186, 40);
    c.fillStyle = '#151515';
    c.beginPath();
    c.ellipse(272, 54, 58, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f4ebd8';
    c.beginPath();
    c.ellipse(272, 53, 50, 7, 0, 0, Math.PI * 2);
    c.fill();
    if (step >= 2) {
      c.fillStyle = '#4a2810';
      c.beginPath();
      c.ellipse(272, 54, 38, 5, 0, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    c.fillStyle = '#4a4a4a';
    rr(c, 212, 40, 186, 14, 6);
    c.fill();
  }
  // filterholder
  c.fillStyle = '#1f1f1f';
  c.beginPath();
  c.moveTo(228, 112);
  c.lineTo(316, 112);
  c.lineTo(296, 140);
  c.lineTo(248, 140);
  c.closePath();
  c.fill();
  // knapp
  const on = brew && step >= 4;
  c.fillStyle = on ? (Math.sin(time * 6) > 0 ? '#ff3b30' : '#ff6b5e') : '#7a1c1c';
  c.beginPath();
  c.arc(366, 235, 14, 0, Math.PI * 2);
  c.fill();
  if (on) {
    c.fillStyle = 'rgba(255,60,40,0.25)';
    c.beginPath();
    c.arc(366, 235, 22, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#ccc';
  c.font = 'bold 9px sans-serif';
  c.fillText('START', 352, 262);

  // kanne
  if (brew) {
    const lvl = on ? Math.min(0.85, CU.timer * 0.08) : 0;
    if (on) {
      c.fillStyle = '#4a2810';
      for (let i = 0; i < 3; i++) {
        const p = (time * 2 + i / 3) % 1;
        c.beginPath();
        c.ellipse(272, 144 + p * 60, 3, 5, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    drawPot(c, 272, 250, lvl, 0);
  } else {
    const cupsBefore = G.coffee.cups;
    const pourP = CU.phase === 'ask' ? 0 : CU.t;
    const move = clamp01(pourP / 0.35);
    const tilt = pourP < 0.85 ? clamp01((pourP - 0.3) / 0.15) : clamp01(1 - (pourP - 0.85) / 0.15);
    const back = clamp01((pourP - 0.85) / 0.15);
    const k = easeInOut(move) * (1 - easeInOut(back));
    const px = 272 + (410 - 272) * k;
    const py = 250 + (150 - 250) * k;
    const pourDone = clamp01((pourP - 0.4) / 0.45);
    const level = Math.max(0, (cupsBefore - (CU.phase === 'revealed' ? 0 : pourDone)) / 3);
    const rot = tilt * 1.05;
    if (tilt > 0.6 && pourP > 0.4 && pourP < 0.88) {
      // tuten på kanna (lokal 58,-100) etter rotasjon
      const sx = px + 58 * Math.cos(rot) + 100 * Math.sin(rot);
      const sy = py + 58 * Math.sin(rot) - 100 * Math.cos(rot);
      c.strokeStyle = '#4a2810';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(sx, sy);
      c.quadraticCurveTo(sx + 4, sy + 30, 502, 232);
      c.stroke();
      c.lineWidth = 1;
    }
    drawPot(c, px, py, level, rot);
  }

  // markering av klikkbare ting
  if (brew && CU.phase === 'ask') {
    for (const h of BREW_HOT) {
      const isNext = BREW_STEPS[CU.step] && BREW_STEPS[CU.step].id === h.id;
      if (CU.hover === h.id) {
        c.strokeStyle = '#ff8a3d';
        c.lineWidth = 3;
        rr(c, h.x - 4, h.y - 4, h.w + 8, h.h + 8, 10);
        c.stroke();
        c.lineWidth = 1;
      }
      if (h.id === 'start') continue; // knappen har egen tekst
      c.fillStyle = isNext ? '#ffd2a8' : '#fff';
      c.font = 'bold 13px "Trebuchet MS", sans-serif';
      c.textAlign = 'center';
      c.fillText(h.label, h.x + h.w / 2, 312);
      c.textAlign = 'left';
    }
  }
}
