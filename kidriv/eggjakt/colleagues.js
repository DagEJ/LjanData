// Kollegaer i kontorlandskapet + samtalen som kan ende i «Kontorkampen» (js/fight.js).
//
// Integrasjon i hovedspillet (se SIDESPILL.md):
//   Colleagues.init({ onBusyChange, onFightEnd });   // én gang ved oppstart
//   Colleagues.update(player, toScreen);             // hver frame (player = {x, y}, toScreen(x,y) -> {x,y} i #stage-piksler)
//   Colleagues.drawOne(c, col, time)                 // tegn i dybdesortert rekkefølge (sortY = col.y)
//   Colleagues.collides(x, y, r)                     // for kollisjon med spilleren
//   Colleagues.isBusy()                              // true under samtale/kamp -> sett hovedspillet på pause

const Colleagues = (() => {
  const TALK_RANGE = 72;

  const LIST = [
    { id: 'kari', name: 'Kari', x: 540, y: 248, dir: 'down',
      look: { shirt: '#2e8b6e', pants: '#3b3b4a', hair: '#d9a441', skin: '#f1c27d', shoes: '#3a2a20', hairStyle: 'long' } },
    { id: 'jonas', name: 'Jonas', x: 880, y: 248, dir: 'down',
      look: { shirt: '#f2f2f2', pants: '#2b2b33', hair: '#1b1410', skin: '#c68642', shoes: '#111', hairStyle: 'short', glasses: true, tie: '#c0392b' } },
    { id: 'per', name: 'Per', x: 965, y: 625, dir: 'left',
      look: { shirt: '#e0b341', pants: '#4a4a4a', hair: '#9a9a9a', skin: '#f1c27d', shoes: '#222', hairStyle: 'bald' } },
    { id: 'lise', name: 'Lise', x: 805, y: 795, dir: 'down',
      look: { shirt: '#9c4f7a', pants: '#2f3a56', hair: '#7a2e1f', skin: '#f5d0a9', shoes: '#222', hairStyle: 'bun' } },
  ];
  for (const c of LIST) { c.sortY = c.y; c.home = { dir: c.dir }; }

  let opts = {};
  let stage = null, bubble = null, overlay = null;
  let near = null;
  let busy = false;
  let dialogToken = 0;
  let inDialog = false;

  // ---------- Hjelpere ----------
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  function setBusy(v) {
    if (busy === v) return;
    busy = v;
    if (typeof opts.onBusyChange === 'function') opts.onBusyChange(v);
  }
  function playerLook() {
    const base = (typeof Fight !== 'undefined' && Fight.PLAYER_LOOK) || {};
    return Object.assign({}, base, typeof opts.getPlayerLook === 'function' ? opts.getPlayerLook() : {});
  }

  // ---------- Tegning ovenfra (samme stil som spilleren i draw.js) ----------
  function drawOne(c, col, time) {
    const x = Math.round(col.x), y = Math.round(col.y);
    const L = col.look;
    const dir = col.dir || 'down';
    const breathe = Math.sin(time * 2 + col.x * 0.01) * 0.8;

    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath(); c.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2); c.fill();

    // bein
    c.fillStyle = L.pants;
    if (dir === 'left' || dir === 'right') {
      c.fillRect(x - 4, y - 16, 6, 16);
      c.fillRect(x - 2, y - 16, 6, 16);
    } else {
      c.fillRect(x - 8, y - 16, 6, 16);
      c.fillRect(x + 2, y - 16, 6, 16);
    }
    c.fillStyle = L.shoes || '#222';
    c.fillRect(x - 9, y - 3, 8, 3);
    c.fillRect(x + 1, y - 3, 8, 3);

    const by = y - 16 - breathe;
    c.fillStyle = L.shirt;
    rr(c, x - 11, by - 22, 22, 24, 6); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(x - 11, by - 3, 22, 4);
    if (dir === 'down' && L.tie) {
      c.fillStyle = L.tie;
      c.fillRect(x - 1.5, by - 20, 3, 13);
    } else if (dir === 'down') {
      c.fillStyle = '#fff'; c.fillRect(x + 2, by - 14, 6, 8);
      c.fillStyle = '#3a6ea5'; c.fillRect(x + 2, by - 14, 6, 2);
    }
    // armer (kaffekopp i den ene hånda)
    c.fillStyle = L.shirt;
    if (dir !== 'left') c.fillRect(x + 10, by - 20, 5, 16);
    if (dir !== 'right') c.fillRect(x - 15, by - 20, 5, 16);
    c.fillStyle = L.skin;
    if (dir !== 'left') c.fillRect(x + 10, by - 5, 5, 4);
    if (dir !== 'right') c.fillRect(x - 15, by - 5, 5, 4);
    if (dir !== 'left') {
      c.fillStyle = '#fff'; c.fillRect(x + 12, by - 10, 8, 9);
      c.fillStyle = '#6b3e1f'; c.fillRect(x + 13, by - 10, 6, 2);
    }

    // hode
    const hy = by - 32;
    c.fillStyle = L.skin;
    c.beginPath(); c.arc(x, hy, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = L.hair;
    c.beginPath();
    if (L.hairStyle === 'bald') {
      if (dir !== 'down') { c.arc(x, hy + 2, 11.5, Math.PI * 0.1, Math.PI * 0.9); }
      else { c.rect(x - 11.5, hy - 2, 3, 7); c.rect(x + 8.5, hy - 2, 3, 7); }
    } else if (dir === 'up') {
      c.arc(x, hy, 11.5, 0, Math.PI * 2);
    } else {
      c.arc(x, hy - 2, 11.5, Math.PI * 1.05, Math.PI * 1.95);
      c.lineTo(x + 11, hy - 1);
      c.lineTo(x - 11, hy - 1);
    }
    c.fill();
    if (L.hairStyle === 'long' && dir !== 'up') {
      c.fillRect(x - 12, hy - 2, 4, 16);
      c.fillRect(x + 8, hy - 2, 4, 16);
    }
    if (L.hairStyle === 'bun') {
      c.beginPath(); c.arc(x, hy - 13, 5, 0, Math.PI * 2); c.fill();
    }
    if (dir !== 'up') {
      c.fillStyle = '#2b2b2b';
      const ex = dir === 'left' ? -5 : dir === 'right' ? 5 : 0;
      if (dir === 'down' || dir === 'right') c.fillRect(x + 3 + ex, hy, 2.5, 3.5);
      if (dir === 'down' || dir === 'left') c.fillRect(x - 5 + ex, hy, 2.5, 3.5);
      if (L.glasses) {
        c.strokeStyle = '#222'; c.lineWidth = 1.2;
        if (dir === 'down') { c.strokeRect(x - 7, hy - 1, 6, 5); c.strokeRect(x + 1.5, hy - 1, 6, 5); }
        else c.strokeRect(x - 3 + ex, hy - 1, 7, 5);
      }
    }

    // navneskilt når spilleren er i nærheten
    if (col === near && !busy) {
      c.font = 'bold 12px "Trebuchet MS", sans-serif';
      c.textAlign = 'center';
      const tw = c.measureText(col.name).width + 12;
      c.fillStyle = 'rgba(35,38,47,0.85)';
      rr(c, x - tw / 2, y + 6, tw, 17, 8); c.fill();
      c.fillStyle = '#fff';
      c.fillText(col.name, x, y + 19);
      c.textAlign = 'left';
    }
  }

  function draw(c, time) {
    for (const col of LIST) drawOne(c, col, time);
  }

  function collides(x, y, r = 12) {
    for (const col of LIST) {
      if (Math.abs(x - col.x) < r + 12 && Math.abs(y - col.y) < 8 + r * 0.6) return col;
    }
    return null;
  }

  // ---------- DOM ----------
  function buildDom() {
    if (bubble) return;
    stage = document.getElementById('stage') || document.body;

    bubble = document.createElement('div');
    bubble.className = 'col-bubble hidden';
    bubble.innerHTML = '<div class="cb-dots"><i></i><i></i><i></i></div><button type="button" class="cb-btn">Spør kollega</button>';
    bubble.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      if (near && !busy) startDialog(near);
    });
    bubble.addEventListener('mousedown', (e) => e.stopPropagation());
    stage.appendChild(bubble);

    overlay = document.createElement('div');
    overlay.id = 'talkOverlay';
    overlay.className = 'hidden';
    overlay.innerHTML = `
      <div class="talk-scene">
        <div class="talk-side left">
          <div class="talk-say hidden"></div>
          <canvas width="220" height="230"></canvas>
          <div class="talk-name">Du</div>
        </div>
        <div class="talk-side right">
          <div class="talk-say hidden"></div>
          <canvas width="220" height="230"></canvas>
          <div class="talk-name"></div>
        </div>
      </div>
      <div class="talk-choices"></div>`;
    overlay.addEventListener('mousedown', (e) => e.stopPropagation());
    overlay.addEventListener('click', (e) => e.stopPropagation());
    stage.appendChild(overlay);

    window.addEventListener('keydown', (e) => {
      if (!inDialog) return;
      // Hovedspillet skal ikke reagere på taster mens vi prater
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'KeyI', 'KeyM', 'KeyP', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      if (e.code === 'Escape') endDialog();
    }, true);
  }

  // ---------- Hovedløkke ----------
  function update(player, toScreen) {
    if (!bubble) buildDom();
    let best = null, bestD = TALK_RANGE;
    for (const col of LIST) {
      const d = Math.hypot(player.x - col.x, (player.y - col.y) * 1.2);
      // kollegaen snur seg mot spilleren når hen er i nærheten
      if (d < 160 && !busy) {
        const dx = player.x - col.x, dy = player.y - col.y;
        col.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      } else if (!busy) {
        col.dir = col.home.dir;
      }
      if (d < bestD) { best = col; bestD = d; }
    }
    near = best;
    if (near && !busy) {
      const p = toScreen ? toScreen(near.x, near.y - 64) : { x: near.x, y: near.y - 64 };
      bubble.style.left = Math.round(p.x) + 'px';
      bubble.style.top = Math.round(p.y) + 'px';
      if (bubble.classList.contains('hidden')) {
        bubble.classList.remove('hidden');
        bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      }
    } else {
      bubble.classList.add('hidden');
    }
  }

  // ---------- Samtale ----------
  const sides = () => ({
    me: overlay.querySelector('.talk-side.left'),
    them: overlay.querySelector('.talk-side.right'),
  });

  function portrait(sideEl, look, facing, opts2 = {}) {
    const cv = sideEl.querySelector('canvas');
    const c = cv.getContext('2d');
    // skarp tegning på retina/skalert skjerm
    const r = Math.max(1, Math.min(3, (stage.getBoundingClientRect().width / 960 || 1) * (window.devicePixelRatio || 1)));
    const pw = Math.round(220 * r), ph = Math.round(230 * r);
    if (cv.width !== pw) { cv.width = pw; cv.height = ph; }
    c.setTransform(r, 0, 0, r, 0, 0);
    if (typeof Fight !== 'undefined' && Fight.drawPortrait) {
      Fight.drawPortrait(c, look, Object.assign({ facing, scale: 1.75, offsetY: 6, pose: 'relaxed', w: 220, h: 230 }, opts2));
    }
  }

  async function say(token, who, text, col) {
    const s = sides();
    const sideEl = who === 'me' ? s.me : s.them;
    const other = who === 'me' ? s.them : s.me;
    other.querySelector('.talk-say').classList.add('dim');
    const box = sideEl.querySelector('.talk-say');
    box.classList.remove('hidden', 'dim');
    box.textContent = '';
    const look = who === 'me' ? playerLook() : col.look;
    const facing = who === 'me' ? 1 : -1;
    const pose = who === 'me' ? 'relaxed' : (text.includes('?') ? 'shrug' : 'relaxed');
    for (let i = 1; i <= text.length; i++) {
      if (token !== dialogToken) return false;
      box.textContent = text.slice(0, i);
      if (i % 2 === 0) portrait(sideEl, look, facing, { face: i % 4 === 0 ? 'talk' : null, pose });
      if (i % 3 === 0 && typeof Sfx !== 'undefined') Sfx.play('click');
      await sleep(28);
    }
    portrait(sideEl, look, facing, { pose });
    return token === dialogToken;
  }

  function choose(token, options) {
    const box = overlay.querySelector('.talk-choices');
    box.innerHTML = '';
    return new Promise((resolve) => {
      for (const o of options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'talk-btn' + (o.cls ? ' ' + o.cls : '');
        b.textContent = o.label;
        b.addEventListener('click', () => {
          if (typeof Sfx !== 'undefined') Sfx.play('click');
          box.innerHTML = '';
          resolve(token === dialogToken ? o.value : null);
        });
        box.appendChild(b);
      }
    });
  }

  function openOverlay(col) {
    const s = sides();
    for (const el of overlay.querySelectorAll('.talk-say')) { el.classList.add('hidden'); el.textContent = ''; }
    overlay.querySelector('.talk-choices').innerHTML = '';
    s.them.querySelector('.talk-name').textContent = col.name;
    portrait(s.me, playerLook(), 1);
    portrait(s.them, col.look, -1);
    overlay.classList.remove('hidden');
    inDialog = true;
  }
  function closeOverlay() {
    overlay.classList.add('hidden');
    inDialog = false;
  }

  function endDialog() {
    dialogToken++;
    closeOverlay();
    setBusy(false);
  }

  async function startDialog(col) {
    const token = ++dialogToken;
    setBusy(true);
    bubble.classList.add('hidden');
    openOverlay(col);
    if (!await say(token, 'me', 'Har du tatt de forsvunne eggene?', col)) return;
    await sleep(450);
    if (!await say(token, 'them', 'Nei, jeg tror du har tatt dem?', col)) return;
    const choice = await choose(token, [
      { label: 'Takk kollega for prat', value: 'thanks' },
      { label: '👊 Fight', value: 'fight', cls: 'fight' },
    ]);
    if (!choice) return;

    if (choice === 'thanks') {
      if (!await say(token, 'me', 'Takk for praten!', col)) return;
      await sleep(1300);
      if (token === dialogToken) endDialog();
      return;
    }

    // Fight!
    closeOverlay();
    if (typeof Fight === 'undefined') { endDialog(); return; }
    Fight.start({
      opponent: { name: col.name, look: col.look },
      player: { name: 'Du', look: playerLook() },
      onEnd: async (result) => {
        if (token !== dialogToken) return;
        let line = null;
        if (typeof opts.onFightEnd === 'function') {
          try { line = opts.onFightEnd(result, col); } catch (e) { console.error(e); }
        }
        if (typeof line !== 'string') {
          line = result.outcome === 'win' ? 'Au … greit, greit. Jeg har ikke eggene, jeg lover!'
            : result.outcome === 'lose' ? 'Kom tilbake når du har fått i deg litt kaffe.'
              : result.outcome === 'forfeit' ? 'Ga du opp? Typisk eggetyv.'
                : 'Uavgjort. Vi tar en omkamp ved kaffemaskinen.';
        }
        openOverlay(col);
        if (!await say(token, 'them', line, col)) return;
        const ok = await choose(token, [{ label: 'Tilbake til jakten', value: 'ok' }]);
        if (ok) endDialog();
      },
    });
  }

  return {
    list: LIST,
    init(o = {}) { opts = o; buildDom(); },
    update,
    draw,
    drawOne,
    collides,
    isBusy: () => busy || (typeof Fight !== 'undefined' && Fight.isActive()),
    hideBubble() { near = null; if (bubble) bubble.classList.add('hidden'); },
    // Lukker alt (f.eks. ved «Spill igjen»)
    reset() { dialogToken++; if (overlay) closeOverlay(); if (bubble) bubble.classList.add('hidden'); setBusy(false); for (const c of LIST) c.dir = c.home.dir; },
  };
})();
