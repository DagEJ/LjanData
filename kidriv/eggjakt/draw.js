// Tegning av kartet i skrått ovenfra-perspektiv.
// En ting med fotavtrykk (x, y, w, h) og høyde z tegnes med toppflate forskjøvet z piksler
// opp, og en frontflate under. elev = hvor høyt over gulvet tingen står (f.eks. på en benk).

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

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

function box(c, x, y, w, h, z, top, front, elev = 0, stroke = 'rgba(0,0,0,0.28)') {
  const ty = y - z - elev;
  c.fillStyle = front;
  c.fillRect(x, y + h - z - elev, w, z);
  c.fillStyle = top;
  c.fillRect(x, ty, w, h);
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, ty + 0.5, w - 1, h + z - 1);
    c.beginPath();
    c.moveTo(x, y + h - z - elev + 0.5);
    c.lineTo(x + w, y + h - z - elev + 0.5);
    c.stroke();
  }
}

function dropShadow(c, x, y, w, h, elev = 0) {
  if (elev) return;
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.fillRect(x + 5, y + 5, w, h);
}

// Skjermboks (for klikk og markering)
function screenBox(o) {
  return { x: o.x, y: o.y - o.z - o.elev, w: o.w, h: o.h + o.z };
}

// ---------- Gulv ----------
function drawFloors(c) {
  // Kontorlandskap: teppefliser
  c.fillStyle = '#a3b3c2';
  c.fillRect(0, 0, WORLD.w, WORLD.h);
  c.strokeStyle = 'rgba(255,255,255,0.08)';
  c.lineWidth = 1;
  c.beginPath();
  for (let x = 0; x <= WORLD.w; x += 50) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, WORLD.h); }
  for (let y = 0; y <= WORLD.h; y += 50) { c.moveTo(0, y + 0.5); c.lineTo(WORLD.w, y + 0.5); }
  c.stroke();

  for (const r of ROOMS) {
    c.save();
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    if (r.key === 'kitchen') {
      for (let y = r.y; y < r.y + r.h; y += 40) {
        for (let x = r.x; x < r.x + r.w; x += 40) {
          c.fillStyle = ((x - r.x) / 40 + (y - r.y) / 40) % 2 === 0 ? '#ece8df' : '#d1ccc0';
          c.fillRect(x, y, 40, 40);
        }
      }
    } else if (r.key === 'boss' || r.key === 'meeting') {
      const base = r.key === 'boss' ? '#9a6a43' : '#c9a06e';
      c.fillStyle = base;
      c.fillRect(r.x, r.y, r.w, r.h);
      let row = 0;
      for (let y = r.y; y < r.y + r.h; y += 18, row++) {
        c.fillStyle = row % 2 ? shade(base, -0.06) : shade(base, 0.04);
        c.fillRect(r.x, y, r.w, 18);
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.fillRect(r.x, y, r.w, 1);
        const off = (row * 67) % 130;
        for (let x = r.x + off; x < r.x + r.w; x += 130) c.fillRect(x, y, 1, 18);
      }
    } else if (r.key === 'reception') {
      c.fillStyle = '#ddd6ca';
      c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = 'rgba(0,0,0,0.08)';
      c.beginPath();
      for (let x = r.x; x <= r.x + r.w; x += 80) { c.moveTo(x + 0.5, r.y); c.lineTo(x + 0.5, r.y + r.h); }
      for (let y = r.y; y <= r.y + r.h; y += 80) { c.moveTo(r.x, y + 0.5); c.lineTo(r.x + r.w, y + 0.5); }
      c.stroke();
    }
    c.restore();
  }

  for (const g of RUGS) {
    c.fillStyle = 'rgba(0,0,0,0.12)';
    c.fillRect(g.x + 3, g.y + 3, g.w, g.h);
    c.fillStyle = g.border;
    c.fillRect(g.x, g.y, g.w, g.h);
    c.fillStyle = g.color;
    c.fillRect(g.x + 8, g.y + 8, g.w - 16, g.h - 16);
  }

  // Romnavn på gulvet
  c.font = 'bold 22px "Trebuchet MS", sans-serif';
  c.textAlign = 'center';
  c.fillStyle = 'rgba(0,0,0,0.13)';
  c.fillText('SJEFEN', 210, 385);
  c.fillText('KJØKKEN', 1310, 520);
  c.fillText('MØTEROM', 1310, 640);
  c.fillText('RESEPSJON', 220, 1085);
  c.fillText('KONTORLANDSKAP', 730, 250);
  c.textAlign = 'left';
}

// ---------- Ting ----------
function drawObject(c, o, time, game) {
  const { x, y, w, h, z } = o;
  const cx = x + w / 2;
  switch (o.type) {
    case 'wall': {
      if (o.back) {
        box(c, x, y, w, h, z, '#6b7480', '#e4e1da', 0, null);
        // vinduer
        for (let wx = 70; wx < w - 60; wx += 190) {
          const wy = y + h - z + 10;
          c.fillStyle = '#5b6573';
          c.fillRect(x + wx - 3, wy - 3, 96, 46);
          const grd = c.createLinearGradient(0, wy, 0, wy + 40);
          grd.addColorStop(0, '#bfe3ff');
          grd.addColorStop(1, '#e9f6ff');
          c.fillStyle = grd;
          c.fillRect(x + wx, wy, 90, 40);
          c.fillStyle = '#5b6573';
          c.fillRect(x + wx + 44, wy, 2, 40);
          c.fillStyle = 'rgba(255,255,255,0.6)';
          c.fillRect(x + wx + 8, wy + 6, 4, 26);
        }
        c.fillStyle = '#b9b2a5';
        c.fillRect(x, y + h - 6, w, 6); // fotlist
      } else {
        box(c, x, y, w, h, z, '#5d6672', '#aeb5bd', 0, 'rgba(0,0,0,0.25)');
      }
      break;
    }
    case 'desk': {
      dropShadow(c, x, y, w, h);
      const top = o.boss ? '#7a4a2a' : '#d9b47f';
      const edge = shade(top, -0.2);
      // bein
      c.fillStyle = '#5a5f68';
      c.fillRect(x + 4, y + h - z, 6, z);
      c.fillRect(x + w - 10, y + h - z, 6, z);
      c.fillRect(x + 4, y - z + 6, 5, z - 6);
      // skuffeseksjon
      const pw = 42;
      c.fillStyle = shade(top, -0.12);
      c.fillRect(x + w - pw - 6, y + h - z + 6, pw, z - 6);
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.strokeRect(x + w - pw - 5.5, y + h - z + 6.5, pw - 1, z - 7);
      c.fillStyle = '#d0d0d0';
      c.fillRect(x + w - pw / 2 - 12, y + h - z + 13, 12, 3);
      c.beginPath();
      c.moveTo(x + w - pw - 6, y + h - z + 20.5);
      c.lineTo(x + w - 6, y + h - z + 20.5);
      c.stroke();
      // bordplate
      c.fillStyle = top;
      c.fillRect(x, y - z, w, h);
      c.fillStyle = edge;
      c.fillRect(x, y + h - z, w, 6);
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      c.strokeRect(x + 0.5, y - z + 0.5, w - 1, h + 5);
      // skjerm og tastatur
      const mw = 46;
      const mx = cx - mw / 2;
      if (o.seat === 's') {
        c.fillStyle = '#ddd';
        c.fillRect(cx - 22, y + h - z - 20, 44, 10); // tastatur
        box(c, mx, y + 8, mw, 5, 30, '#2a2d33', '#1c1f24', z);
        const sy = y + 13 - 30 - z;
        c.fillStyle = '#3fa0e0';
        c.fillRect(mx + 3, sy + 3, mw - 6, 22);
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(mx + 6, sy + 6, 14, 3);
        c.fillRect(mx + 6, sy + 11, 24, 3);
      } else {
        c.fillStyle = '#ddd';
        c.fillRect(cx - 22, y + 8 - z, 44, 10);
        box(c, mx, y + h - 16, mw, 5, 30, '#2a2d33', '#4a4f57', z);
      }
      // kaffekopp
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(x + 14, y + h / 2 - z, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#6b4226';
      c.beginPath();
      c.arc(x + 14, y + h / 2 - z, 4, 0, Math.PI * 2);
      c.fill();
      if (o.boss) {
        c.fillStyle = '#c9a227';
        c.fillRect(x + w - 40, y + 10 - z, 30, 8); // navneskilt
      }
      break;
    }
    case 'chair': {
      const col = o.color || '#2d4f7c';
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.beginPath();
      c.ellipse(cx + 3, y + h - 6, w / 2, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3d3d3d';
      c.fillRect(cx - 2, y + h - 18, 4, 14);
      c.fillRect(cx - 14, y + h - 6, 28, 3);
      if (o.back === 'n') box(c, x + 4, y + 2, w - 8, 7, 24, shade(col, 0.1), shade(col, -0.15), 16);
      box(c, x + 3, y + 8, w - 6, h - 14, 6, shade(col, 0.15), shade(col, -0.2), 14);
      if (o.back === 's') box(c, x + 4, y + h - 12, w - 8, 7, 24, shade(col, 0.1), shade(col, -0.15), 16);
      break;
    }
    case 'plant': {
      const potX = x + w * 0.18, potW = w * 0.64, potY = y + h * 0.3, potH = h * 0.55;
      const potZ = o.variant === 'herb' ? 14 : 20;
      dropShadow(c, potX, potY, potW, potH);
      box(c, potX, potY, potW, potH, potZ, '#5b3a24', o.variant === 'herb' ? '#e8e8e8' : '#c96f3b');
      const topY = potY - potZ + potH / 2;
      const sway = Math.sin(time * 1.3 + o.id) * 1.5;
      if (o.variant === 'palm') {
        c.strokeStyle = '#6b4a2a';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(cx, topY);
        c.lineTo(cx + sway, topY - 44);
        c.stroke();
        c.strokeStyle = '#2f8f4e';
        c.lineWidth = 5;
        c.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.48;
          c.beginPath();
          c.moveTo(cx + sway, topY - 44);
          c.quadraticCurveTo(cx + sway + Math.cos(a) * 22, topY - 44 + Math.sin(a) * 22 - 6,
            cx + sway + Math.cos(a) * 34, topY - 44 + Math.sin(a) * 26 + 12);
          c.stroke();
        }
        c.lineCap = 'butt';
      } else if (o.variant === 'tall') {
        c.strokeStyle = '#6b4a2a';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(cx, topY);
        c.lineTo(cx + sway, topY - 40);
        c.stroke();
        const leaves = [[-12, -50, 13], [10, -54, 14], [0, -66, 13], [-8, -38, 10], [12, -36, 10], [2, -48, 12]];
        leaves.forEach(([lx, ly, r], i) => {
          c.fillStyle = i % 2 ? '#3c9a55' : '#2e7d45';
          c.beginPath();
          c.arc(cx + lx + sway, topY + ly, r, 0, Math.PI * 2);
          c.fill();
        });
      } else if (o.variant === 'herb') {
        [[-8, -8, 8], [6, -10, 8], [0, -16, 8], [-2, -6, 7]].forEach(([lx, ly, r], i) => {
          c.fillStyle = i % 2 ? '#5cbf5f' : '#43a047';
          c.beginPath();
          c.arc(cx + lx + sway * 0.5, topY + ly, r, 0, Math.PI * 2);
          c.fill();
        });
      } else {
        const leaves = [[-14, -14, 14], [14, -16, 14], [0, -28, 15], [-10, -32, 11], [12, -30, 11], [0, -12, 12]];
        leaves.forEach(([lx, ly, r], i) => {
          c.fillStyle = i % 2 ? '#3a9b52' : '#2b7a40';
          c.beginPath();
          c.ellipse(cx + lx + sway, topY + ly, r, r * 0.8, i, 0, Math.PI * 2);
          c.fill();
        });
      }
      break;
    }
    case 'box': {
      dropShadow(c, x, y, w, h);
      box(c, x, y, w, h, z, '#dfb67c', '#c7975b');
      c.fillStyle = '#efd9ae';
      c.fillRect(cx - 4, y - z, 8, h);
      c.fillRect(cx - 4, y + h - z, 8, z);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.font = 'bold 9px sans-serif';
      c.fillText('↑↑', x + 6, y + h - z + 14);
      break;
    }
    case 'paper': {
      dropShadow(c, x, y, w, h);
      box(c, x, y, w, h, z, '#fbfbf7', '#eeeee6');
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 3; i < z; i += 3) c.fillRect(x, y + h - z + i, w, 1);
      c.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < 4; i++) c.fillRect(x + 8, y - z + 8 + i * 7, w - 16 - i * 6, 2);
      break;
    }
    case 'printer': {
      dropShadow(c, x, y, w, h);
      box(c, x, y, w, h, z, '#d9dce0', '#bfc3c9');
      c.fillStyle = '#8f959d';
      c.fillRect(x + 6, y - z + 4, w - 12, h * 0.45);
      c.fillStyle = '#7fd67f';
      c.fillRect(x + w - 24, y - z + h * 0.6, 14, 8);
      c.fillStyle = '#fff';
      c.fillRect(x + 12, y - z + h * 0.62, 30, 14);
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.strokeRect(x + 6.5, y + h - z + 6.5, w - 13, z - 14);
      c.fillStyle = '#666';
      c.fillRect(cx - 10, y + h - z + 10, 20, 3);
      break;
    }
    case 'shelf': {
      box(c, x, y, w, h, z, '#6e4528', '#8d5d36');
      const fx = x + 5, fw = w - 10, fy = y + h - z + 5, fh = z - 10;
      c.fillStyle = '#4a2e18';
      c.fillRect(fx, fy, fw, fh);
      const rowH = fh / 3;
      o.books.forEach((row, ri) => {
        const by = fy + ri * rowH;
        row.forEach((b) => {
          const bw = b.w * fw;
          if (b.x * fw + bw > fw) return;
          c.fillStyle = b.c;
          c.fillRect(fx + b.x * fw, by + rowH * (1 - b.h * 0.9), bw, rowH * b.h * 0.9);
        });
        c.fillStyle = '#8d5d36';
        c.fillRect(fx, by + rowH - 2, fw, 3);
      });
      break;
    }
    case 'coatrack': {
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.beginPath();
      c.ellipse(cx + 3, y + h / 2 + 3, 15, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3b3b3b';
      c.beginPath();
      c.ellipse(cx, y + h / 2, 13, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillRect(cx - 2, y + h / 2 - z, 4, z);
      c.fillRect(cx - 12, y + h / 2 - z + 4, 24, 3);
      // jakke
      const jy = y + h / 2 - z + 6;
      c.fillStyle = o.color;
      c.beginPath();
      c.moveTo(cx - 6, jy);
      c.lineTo(cx + 6, jy);
      c.lineTo(cx + 15, jy + 12);
      c.lineTo(cx + 14, jy + 46);
      c.lineTo(cx - 14, jy + 46);
      c.lineTo(cx - 15, jy + 12);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.stroke();
      c.strokeStyle = shade(o.color, -0.35);
      c.beginPath();
      c.moveTo(cx, jy + 4);
      c.lineTo(cx, jy + 46);
      c.stroke();
      c.fillStyle = shade(o.color, -0.25);
      c.beginPath();
      c.moveTo(cx - 6, jy);
      c.lineTo(cx, jy + 14);
      c.lineTo(cx + 6, jy);
      c.fill();
      break;
    }
    case 'bin': {
      dropShadow(c, x, y, w, h);
      box(c, x, y, w, h, z, '#4c5056', '#666b72');
      c.fillStyle = '#26282c';
      c.fillRect(x + 4, y - z + 4, w - 8, h - 8);
      c.fillStyle = 'rgba(255,255,255,0.15)';
      for (let i = 6; i < w; i += 7) c.fillRect(x + i, y + h - z + 3, 2, z - 6);
      if (game && game.carrying) {
        const b = Math.sin(time * 6) * 4;
        c.fillStyle = '#3cb371';
        c.beginPath();
        c.moveTo(cx - 8, y - z - 26 + b);
        c.lineTo(cx + 8, y - z - 26 + b);
        c.lineTo(cx, y - z - 12 + b);
        c.fill();
      }
      break;
    }
    case 'counter': {
      dropShadow(c, x, y, w, h);
      box(c, x, y, w, h, z, '#e7e3dc', '#a37b52');
      const doors = 5;
      const dw = w / doors;
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < doors; i++) {
        c.strokeRect(x + i * dw + 3.5, y + h - z + 6.5, dw - 7, z - 10);
        c.fillStyle = '#ddd';
        c.fillRect(x + i * dw + (i % 2 ? 7 : dw - 11), y + h - z + 12, 3, 10);
      }
      // vask
      c.fillStyle = '#b8bec5';
      c.fillRect(x + w - 90, y - z + 10, 60, 36);
      c.fillStyle = '#8c939b';
      c.fillRect(x + w - 85, y - z + 15, 50, 26);
      c.fillStyle = '#ccc';
      c.fillRect(x + w - 62, y - z + 4, 4, 12);
      break;
    }
    case 'coffee': {
      const cf = game ? game.coffee : { state: 'empty', cups: 0 };
      const e = o.elev;
      box(c, x, y, w, h, z, '#2d2d2d', '#3b3b3b', e);
      const fy = y + h - z - e; // frontflatens topp
      // glasskanne
      c.fillStyle = 'rgba(200,230,255,0.55)';
      c.fillRect(x + 10, fy + 20, w - 20, z - 24);
      let level = 0;
      if (cf.state === 'brewing') level = cf.progress;
      if (cf.state === 'ready') level = cf.cups / 3;
      if (level > 0) {
        const lh = (z - 26) * level;
        c.fillStyle = '#5a3417';
        c.fillRect(x + 11, fy + z - 5 - lh, w - 22, lh);
      }
      c.fillStyle = cf.state === 'brewing' ? (Math.sin(time * 8) > 0 ? '#ff3b30' : '#a51d16') : '#551';
      c.beginPath();
      c.arc(x + w - 8, fy + 8, 3, 0, Math.PI * 2);
      c.fill();
      if (cf.state === 'brewing' || cf.state === 'ready') {
        for (let i = 0; i < 3; i++) {
          const p = (time * 0.6 + i / 3) % 1;
          c.fillStyle = `rgba(255,255,255,${0.5 * (1 - p)})`;
          c.beginPath();
          c.arc(cx + Math.sin(p * 6 + i) * 6, y - z - e - p * 40, 5 + p * 6, 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
    case 'fridge': {
      dropShadow(c, x, y, w, h);
      box(c, x, y, w, h, z, '#e9edf0', '#f6f8f9');
      const fy = y + h - z;
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      c.beginPath();
      c.moveTo(x, fy + z * 0.32 + 0.5);
      c.lineTo(x + w, fy + z * 0.32 + 0.5);
      c.stroke();
      c.fillStyle = '#9aa1a8';
      c.fillRect(x + w - 12, fy + 8, 4, 18);
      c.fillRect(x + w - 12, fy + z * 0.32 + 8, 4, 30);
      [['#e74c3c', 12, 44], ['#f1c40f', 30, 56], ['#3498db', 18, 70]].forEach(([col, mx, my]) => {
        c.fillStyle = col;
        c.fillRect(x + mx, fy + my, 8, 8);
      });
      c.fillStyle = '#fff59d';
      c.fillRect(x + 34, fy + 40, 14, 14);
      break;
    }
    case 'table': {
      dropShadow(c, x, y, w, h);
      const top = o.name === 'Møtebord' ? '#f2efe8' : (o.name === 'Lunsjbord' ? '#c88b5a' : '#7c5a3e');
      c.fillStyle = '#4c4f55';
      c.fillRect(x + 6, y + h - z, 6, z);
      c.fillRect(x + w - 12, y + h - z, 6, z);
      c.fillRect(x + 8, y - z + 8, 5, z - 6);
      c.fillRect(x + w - 13, y - z + 8, 5, z - 6);
      c.fillStyle = top;
      c.fillRect(x, y - z, w, h);
      c.fillStyle = shade(top, -0.25);
      c.fillRect(x, y + h - z, w, 5);
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      c.strokeRect(x + 0.5, y - z + 0.5, w - 1, h + 4);
      if (o.name === 'Møtebord') {
        // papirer og vannglass
        c.fillStyle = '#fff';
        [[20, 14], [w - 50, 60], [60, 66], [w - 90, 12]].forEach(([px, py]) => c.fillRect(x + px, y - z + py, 22, 28));
      }
      break;
    }
    case 'cake': {
      const e = o.elev;
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(cx, y + h / 2 - e, w / 2 + 6, h / 2 + 4, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ccc';
      c.stroke();
      const pw = w / 2 - 3, ph = h / 2 - 3;
      const pieces = [[0, 0], [1, 0], [0, 1], [1, 1]];
      pieces.forEach(([px, py], i) => {
        if (i >= o.slices) return;
        const bx = x + 2 + px * (pw + 2), by = y + 2 + py * (ph + 2);
        box(c, bx, by, pw, ph, z, '#fff8f0', '#f4a6b8', e, 'rgba(0,0,0,0.15)');
        c.fillStyle = '#e8456b';
        c.beginPath();
        c.arc(bx + pw / 2, by + ph / 2 - z - e, 4, 0, Math.PI * 2);
        c.fill();
        // lys
        c.fillStyle = ['#4aa3df', '#f1c40f', '#9b59b6', '#2ecc71'][i];
        c.fillRect(bx + pw / 2 + 6, by + ph / 2 - z - e - 14, 3, 12);
        c.fillStyle = Math.sin(time * 15 + i) > 0 ? '#ffb300' : '#ff7b00';
        c.beginPath();
        c.ellipse(bx + pw / 2 + 7.5, by + ph / 2 - z - e - 17, 2.5, 4, 0, 0, Math.PI * 2);
        c.fill();
      });
      if (o.slices === 0) {
        c.fillStyle = '#e9b8c4';
        for (let i = 0; i < 8; i++) c.fillRect(x + 10 + (i * 37) % (w - 16), y + 8 + (i * 23) % (h - 14) - e, 3, 3);
      }
      break;
    }
    case 'candybowl': {
      const e = o.elev;
      const by = y + h / 2 - e;
      c.fillStyle = '#9ed0ff';
      c.beginPath();
      c.ellipse(cx, by, w / 2, h / 2, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#6fa8dc';
      c.beginPath();
      c.ellipse(cx, by + 4, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI);
      c.fill();
      const cols = ['#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22'];
      for (let i = 0; i < o.pieces * 3; i++) {
        c.fillStyle = cols[i % cols.length];
        c.beginPath();
        c.arc(cx - 12 + (i * 7) % 26, by - 4 + ((i * 5) % 9) - 2, 4, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'sofa': {
      dropShadow(c, x, y, w, h);
      const col = o.color;
      box(c, x, y, w, h * 0.38, 40, shade(col, 0.1), shade(col, -0.15));
      box(c, x, y + h * 0.3, w, h * 0.7, 18, shade(col, 0.15), shade(col, -0.25));
      const n = Math.max(2, Math.round((w - 28) / 50));
      const cw = (w - 28) / n;
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let i = 1; i < n; i++) {
        c.beginPath();
        c.moveTo(x + 14 + i * cw + 0.5, y + h * 0.3 - 18);
        c.lineTo(x + 14 + i * cw + 0.5, y + h - 18);
        c.stroke();
      }
      box(c, x, y, 14, h, 28, shade(col, 0.05), shade(col, -0.3));
      box(c, x + w - 14, y, 14, h, 28, shade(col, 0.05), shade(col, -0.3));
      break;
    }
    case 'safe': {
      dropShadow(c, x, y, w, h);
      box(c, x, y, w, h, z, '#555b62', '#41464c');
      const fy = y + h - z;
      c.strokeStyle = '#2a2d31';
      c.strokeRect(x + 5.5, fy + 5.5, w - 11, z - 11);
      c.fillStyle = '#b8bec6';
      c.beginPath();
      c.arc(cx, fy + z / 2, 8, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#41464c';
      c.fillRect(cx - 1, fy + z / 2 - 7, 2, 7);
      break;
    }
    case 'whiteboard': {
      box(c, x, y, w, h, z, '#9aa3ad', '#fdfdfd');
      const fy = y + h - z;
      c.strokeStyle = '#9aa3ad';
      c.lineWidth = 3;
      c.strokeRect(x + 1.5, fy + 1.5, w - 3, z - 3);
      c.lineWidth = 1;
      c.fillStyle = '#d32f2f';
      c.font = 'bold 15px "Comic Sans MS", "Trebuchet MS", sans-serif';
      c.fillText('HAR NOEN SETT', x + 18, fy + 26);
      c.fillText('EGGENE MINE?!', x + 30, fy + 46);
      c.fillStyle = '#1e5bb8';
      c.font = '14px "Comic Sans MS", sans-serif';
      c.fillText('🥚 = ?', x + 150, fy + 62);
      break;
    }
    case 'cabinet': {
      dropShadow(c, x, y, w, h);
      box(c, x, y, w, h, z, '#8f979f', '#b2b9c0');
      const fy = y + h - z;
      const dh = (z - 6) / 3;
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = 'rgba(0,0,0,0.35)';
        c.strokeRect(x + 4.5, fy + 3.5 + i * dh, w - 9, dh - 3);
        c.fillStyle = '#e2e5e8';
        c.fillRect(cx - 9, fy + 8 + i * dh, 18, 3);
      }
      break;
    }
    case 'recdesk': {
      dropShadow(c, x, y, w, h);
      box(c, x, y, w, h, z, '#ece7de', '#4f7486');
      const fy = y + h - z;
      c.fillStyle = '#f2c14e';
      c.fillRect(x, fy + 8, w, 4);
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.font = 'bold 13px "Trebuchet MS", sans-serif';
      c.textAlign = 'center';
      c.fillText('RESEPSJON', cx, fy + 30);
      c.textAlign = 'left';
      // telefon
      c.fillStyle = '#333';
      c.fillRect(x + 20, y - z + 10, 18, 12);
      break;
    }
  }

  if (o.searchable && o.searched) {
    const sb = screenBox(o);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.arc(sb.x + sb.w - 4, sb.y + 2, 8, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6a6f78';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(sb.x + sb.w - 8, sb.y + 2);
    c.lineTo(sb.x + sb.w - 5, sb.y + 5);
    c.lineTo(sb.x + sb.w, sb.y - 2);
    c.stroke();
    c.lineWidth = 1;
  }
}

// ---------- Spilleren ----------
function drawPlayer(c, p, time, game) {
  const x = Math.round(p.x), y = Math.round(p.y);
  const step = p.moving ? Math.sin(p.walk * 12) : 0;
  const bob = p.moving ? Math.abs(Math.sin(p.walk * 12)) * 2 : Math.sin(time * 2) * 0.6;
  const tired = game.energy < 25;

  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.beginPath();
  c.ellipse(x, y, 14, 5, 0, 0, Math.PI * 2);
  c.fill();

  // bein
  c.fillStyle = '#2f3a56';
  if (p.dir === 'left' || p.dir === 'right') {
    c.fillRect(x - 4 + step * 5, y - 16, 6, 16);
    c.fillRect(x - 3 - step * 5, y - 16, 6, 16);
  } else {
    c.fillRect(x - 8, y - 16 - Math.max(0, step) * 3, 6, 16);
    c.fillRect(x + 2, y - 16 - Math.max(0, -step) * 3, 6, 16);
  }
  c.fillStyle = '#222';
  c.fillRect(x - 9, y - 3, 8, 3);
  c.fillRect(x + 1, y - 3, 8, 3);

  const by = y - 16 - bob;
  // kropp
  c.fillStyle = '#ef6c2f';
  rr(c, x - 11, by - 22, 22, 24, 6);
  c.fill();
  c.fillStyle = '#d65a20';
  c.fillRect(x - 11, by - 3, 22, 4);
  // ID-kort
  if (p.dir === 'down') {
    c.fillStyle = '#fff';
    c.fillRect(x + 2, by - 14, 6, 8);
    c.fillStyle = '#3a6ea5';
    c.fillRect(x + 2, by - 14, 6, 2);
  }
  // armer
  c.fillStyle = '#ef6c2f';
  const armSwing = p.moving ? step * 4 : 0;
  if (p.dir !== 'left') c.fillRect(x + 10, by - 20 - armSwing, 5, 16);
  if (p.dir !== 'right') c.fillRect(x - 15, by - 20 + armSwing, 5, 16);
  c.fillStyle = '#f1c27d';
  if (p.dir !== 'left') c.fillRect(x + 10, by - 5 - armSwing, 5, 4);
  if (p.dir !== 'right') c.fillRect(x - 15, by - 5 + armSwing, 5, 4);

  // hode
  const hy = by - 32 + (tired ? 2 : 0);
  c.fillStyle = '#f1c27d';
  c.beginPath();
  c.arc(x, hy, 11, 0, Math.PI * 2);
  c.fill();
  // hår
  c.fillStyle = '#5a3825';
  c.beginPath();
  if (p.dir === 'up') {
    c.arc(x, hy, 11.5, 0, Math.PI * 2);
  } else {
    c.arc(x, hy - 2, 11.5, Math.PI * 1.05, Math.PI * 1.95);
    c.lineTo(x + 11, hy - 1);
    c.lineTo(x - 11, hy - 1);
  }
  c.fill();
  // ansikt
  if (p.dir !== 'up') {
    c.fillStyle = '#2b2b2b';
    const ex = p.dir === 'left' ? -5 : p.dir === 'right' ? 5 : 0;
    if (tired) {
      c.fillRect(x - 5 + ex - 1, hy + 2, 4, 1.5);
      c.fillRect(x + 3 + ex - 1, hy + 2, 4, 1.5);
    } else {
      if (p.dir === 'down' || p.dir === 'right') c.fillRect(x + 3 + ex - (p.dir === 'right' ? 0 : 0), hy, 2.5, 3.5);
      if (p.dir === 'down' || p.dir === 'left') c.fillRect(x - 5 + ex, hy, 2.5, 3.5);
    }
    if (game.ir.active) {
      c.fillStyle = 'rgba(255,60,40,0.9)';
      const vx = p.dir === 'left' ? x - 12 : p.dir === 'right' ? x - 2 : x - 9;
      c.fillRect(vx, hy - 2, p.dir === 'down' ? 18 : 14, 6);
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillRect(vx + 2, hy - 1, 4, 1.5);
    }
  }

  // søppel man bærer på
  if (game.carrying) {
    const tx = x + (p.dir === 'left' ? -16 : 16);
    const ty = by - 4;
    c.fillStyle = '#2d6b3a';
    c.beginPath();
    c.ellipse(tx, ty, 9, 10, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1f4f2a';
    c.fillRect(tx - 3, ty - 13, 6, 5);
    // stank
    c.strokeStyle = 'rgba(120,170,60,0.8)';
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const sx = tx - 8 + i * 8;
      const sy = ty - 18 - ((time * 20 + i * 7) % 16);
      c.beginPath();
      c.moveTo(sx, sy);
      c.quadraticCurveTo(sx + 4, sy - 4, sx, sy - 8);
      c.stroke();
    }
    c.lineWidth = 1;
  }

  if (tired && Math.sin(time * 1.5) > 0.6) {
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = 'bold 14px sans-serif';
    c.fillText('z', x + 12, hy - 14);
    c.font = 'bold 10px sans-serif';
    c.fillText('z', x + 20, hy - 22);
  }
}

// ---------- Varmesyn ----------
function drawIR(c, game, cam, time) {
  c.save();
  c.fillStyle = 'rgba(14, 0, 48, 0.8)';
  c.fillRect(cam.x - 10, cam.y - 10, VIEW_W + 20, VIEW_H + 20);
  c.globalCompositeOperation = 'lighter';
  const glow = (gx, gy, r, inner, outer) => {
    const g = c.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, inner);
    g.addColorStop(0.45, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(gx, gy, r, 0, Math.PI * 2);
    c.fill();
  };
  const pulse = 0.85 + Math.sin(time * 5) * 0.15;
  for (const o of game.objects) {
    if (!o.searchable || o.searched || !o.content) continue;
    const gx = o.x + o.w / 2, gy = o.y + o.h / 2 - o.z / 2;
    const k = o.content.kind;
    // grønt = noe bra, rødt = noe dårlig
    if (k === 'eggs') {
      glow(gx, gy, 80 * pulse, 'rgba(200,255,210,1)', 'rgba(40,220,90,0.7)');
      glow(gx, gy, 34, 'rgba(235,255,240,1)', 'rgba(90,255,140,0.9)');
    } else if (k === 'candy' || k === 'cake') {
      glow(gx, gy, 34, 'rgba(120,255,140,0.7)', 'rgba(30,170,70,0.4)');
    } else if (k === 'trash') {
      glow(gx, gy, 34, 'rgba(255,90,70,0.75)', 'rgba(200,20,20,0.45)');
    }
  }
  if (game.coffee.state !== 'empty') {
    const m = game.objects.find((o) => o.type === 'coffee');
    glow(m.x + m.w / 2, m.y - m.elev - 20, 50, 'rgba(120,255,140,0.85)', 'rgba(30,170,70,0.45)');
  }
  const cake = game.objects.find((o) => o.type === 'cake');
  if (cake && cake.slices > 0) glow(cake.x + cake.w / 2, cake.y - cake.elev, 26, 'rgba(120,255,140,0.6)', 'rgba(30,170,70,0.3)');
  // spilleren selv: nøytralt hvitblått, så det ikke forveksles med grønt/rødt
  glow(game.player.x, game.player.y - 28, 46, 'rgba(230,240,255,0.9)', 'rgba(110,140,255,0.5)');
  c.globalCompositeOperation = 'source-over';
  // skannelinjer
  c.fillStyle = 'rgba(0,0,0,0.18)';
  for (let sy = Math.floor(cam.y / 4) * 4; sy < cam.y + VIEW_H; sy += 4) c.fillRect(cam.x, sy, VIEW_W, 1);
  c.restore();
}
