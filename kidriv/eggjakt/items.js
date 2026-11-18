// Tegninger av gjenstander i nærbildet. Origo = midt nederst på gjenstanden.

function drawItemArt(c, content, cx, by, s, time) {
  if (!content) return;
  c.save();
  c.translate(cx, by);
  c.scale(s, s);
  const art = ITEM_ART[content.art];
  if (art) art(c, content, time || 0);
  c.restore();
}

function stinkLines(c, x0, y0, n, time) {
  c.strokeStyle = 'rgba(110,160,40,0.85)';
  c.lineWidth = 4;
  c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const sx = x0 + i * 26;
    const off = (time * 30 + i * 9) % 20;
    c.beginPath();
    c.moveTo(sx, y0 - off);
    c.bezierCurveTo(sx + 10, y0 - 12 - off, sx - 10, y0 - 22 - off, sx, y0 - 34 - off);
    c.stroke();
  }
  c.lineCap = 'butt';
  c.lineWidth = 1;
}

const ITEM_ART = {
  eggs(c) {
    // lokk som står åpent bak
    c.fillStyle = '#b5ab98';
    rr(c, -124, -168, 248, 62, 10);
    c.fill();
    c.fillStyle = '#fff';
    c.font = 'bold 20px "Trebuchet MS", sans-serif';
    c.textAlign = 'center';
    c.fillText('24 EGG', 0, -136);
    c.font = '12px "Trebuchet MS", sans-serif';
    c.fillText('FRITTGÅENDE HØNER', 0, -118);
    // kartong
    c.fillStyle = '#d6cdbb';
    rr(c, -126, -112, 252, 112, 10);
    c.fill();
    c.strokeStyle = '#a99f8b';
    c.lineWidth = 2;
    c.stroke();
    const cols = 6, rows = 4, cw = 40, ch = 25;
    const sx = -cw * cols / 2 + cw / 2;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const ex = sx + k * cw, ey = -98 + r * ch + 10;
        c.fillStyle = '#b9af9b';
        c.beginPath();
        c.ellipse(ex, ey + 3, 17, 11, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = (r + k) % 3 === 0 ? '#f7ecdc' : '#ecd2ae';
        c.beginPath();
        c.ellipse(ex, ey, 15, 11, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.ellipse(ex - 5, ey - 4, 4, 3, -0.5, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.fillStyle = '#c3b9a5';
    c.fillRect(-126, -10, 252, 10);
    c.textAlign = 'left';
  },

  bar(c) {
    c.rotate(-0.12);
    c.fillStyle = '#5a2e14';
    rr(c, -80, -46, 160, 46, 4);
    c.fill();
    c.fillStyle = '#6d3a1c';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) c.fillRect(20 + i * 19, -42 + j * 20, 16, 17);
    c.fillStyle = '#c62f3a';
    c.fillRect(-80, -48, 95, 50);
    c.fillStyle = '#d9d9d9';
    c.fillRect(10, -48, 8, 50);
    c.fillStyle = '#fff';
    c.font = 'bold 20px "Trebuchet MS", sans-serif';
    c.fillText('SJOKO', -72, -16);
  },

  bag(c) {
    c.fillStyle = '#e84393';
    c.beginPath();
    c.moveTo(-60, -110);
    c.lineTo(60, -110);
    c.lineTo(66, 0);
    c.lineTo(-66, 0);
    c.closePath();
    c.fill();
    c.fillStyle = '#c2185b';
    c.fillRect(-62, -118, 124, 12);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    rr(c, -40, -80, 80, 60, 10);
    c.fill();
    const cols = ['#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#3498db'];
    for (let i = 0; i < 12; i++) {
      c.fillStyle = cols[i % cols.length];
      c.beginPath();
      c.arc(-28 + (i % 4) * 19, -66 + Math.floor(i / 4) * 17, 7, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#fff';
    c.font = 'bold 15px "Trebuchet MS", sans-serif';
    c.textAlign = 'center';
    c.fillText('SMÅGODT', 0, -88);
    c.textAlign = 'left';
  },

  lolli(c) {
    c.fillStyle = '#f5f0e6';
    c.fillRect(-4, -70, 8, 70);
    c.fillStyle = '#ff5fa2';
    c.beginPath();
    c.arc(0, -110, 44, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fff';
    c.lineWidth = 7;
    c.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.2) {
      const r = a * 2.2;
      c.lineTo(Math.cos(a) * r, -110 + Math.sin(a) * r);
    }
    c.stroke();
    c.lineWidth = 1;
  },

  muffin(c) {
    c.fillStyle = '#4fa3e0';
    c.beginPath();
    c.moveTo(-50, -60);
    c.lineTo(50, -60);
    c.lineTo(38, 0);
    c.lineTo(-38, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 3;
    for (let i = -40; i <= 40; i += 12) {
      c.beginPath();
      c.moveTo(i, -58);
      c.lineTo(i * 0.78, -2);
      c.stroke();
    }
    c.fillStyle = '#6b3a1e';
    c.beginPath();
    c.arc(0, -64, 56, Math.PI, 0);
    c.fill();
    c.fillStyle = '#3d1f0e';
    [[-30, -80], [-5, -98], [20, -84], [35, -70], [-20, -100], [5, -76]].forEach(([px, py]) => c.fillRect(px, py, 8, 6));
    c.lineWidth = 1;
  },

  goggles(c) {
    c.strokeStyle = '#222';
    c.lineWidth = 9;
    c.beginPath();
    c.moveTo(-96, -56);
    c.quadraticCurveTo(0, -140, 96, -56);
    c.stroke();
    c.fillStyle = '#3a3d44';
    rr(c, -98, -86, 196, 66, 22);
    c.fill();
    const lens = (lx) => {
      const g = c.createLinearGradient(lx - 40, -78, lx + 40, -30);
      g.addColorStop(0, '#ff8a65');
      g.addColorStop(1, '#c62828');
      c.fillStyle = g;
      rr(c, lx - 40, -78, 80, 50, 16);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fillRect(lx - 28, -70, 20, 6);
    };
    lens(-48);
    lens(48);
    c.fillStyle = '#3a3d44';
    c.fillRect(-10, -60, 20, 30);
    c.fillStyle = '#4cff6a';
    c.beginPath();
    c.arc(80, -80, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.font = 'bold 14px sans-serif';
    c.fillText('IR', -8, -12);
    c.lineWidth = 1;
  },

  banana(c, _, time) {
    c.fillStyle = '#f2d43a';
    c.strokeStyle = '#b8960f';
    c.lineWidth = 2;
    [[-0.9, 70], [0, 60], [0.9, 70]].forEach(([a, len]) => {
      c.save();
      c.rotate(a);
      c.beginPath();
      c.moveTo(-12, -20);
      c.quadraticCurveTo(-26, -len * 0.6, -6, -len);
      c.quadraticCurveTo(14, -len * 0.6, 12, -20);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#6b4f1d';
      c.fillRect(-4, -len * 0.5, 5, 5);
      c.fillRect(2, -len * 0.75, 4, 4);
      c.fillStyle = '#f2d43a';
      c.restore();
    });
    c.fillStyle = '#7a5a20';
    c.beginPath();
    c.ellipse(0, -14, 16, 12, 0, 0, Math.PI * 2);
    c.fill();
    stinkLines(c, -26, -90, 3, time);
  },

  pizza(c, _, time) {
    c.fillStyle = '#d8913e';
    c.beginPath();
    c.moveTo(-90, -20);
    c.lineTo(90, -20);
    c.lineTo(0, 0 - 2);
    c.closePath();
    c.fill();
    c.fillStyle = '#f2c94c';
    c.beginPath();
    c.moveTo(-96, -40);
    c.lineTo(96, -40);
    c.lineTo(0, 0);
    c.closePath();
    c.fill();
    c.fillStyle = '#c0703a';
    rr(c, -100, -54, 200, 18, 9);
    c.fill();
    c.fillStyle = '#b3261e';
    [[-40, -30], [30, -30], [0, -16]].forEach(([px, py]) => {
      c.beginPath();
      c.ellipse(px, py, 11, 6, 0, 0, Math.PI * 2);
      c.fill();
    });
    c.fillStyle = '#5f9e3a';
    [[-60, -36], [12, -34], [44, -26], [-14, -22]].forEach(([px, py]) => {
      c.beginPath();
      c.arc(px, py, 6, 0, Math.PI * 2);
      c.fill();
    });
    stinkLines(c, -26, -64, 3, time);
  },

  sock(c, _, time) {
    c.fillStyle = '#9da3a8';
    c.beginPath();
    c.moveTo(-30, -130);
    c.lineTo(20, -130);
    c.lineTo(20, -50);
    c.quadraticCurveTo(80, -50, 80, -22);
    c.quadraticCurveTo(80, 0, 40, 0);
    c.lineTo(-10, 0);
    c.quadraticCurveTo(-30, 0, -30, -30);
    c.closePath();
    c.fill();
    c.fillStyle = '#7d8388';
    c.fillRect(-30, -130, 50, 16);
    c.fillStyle = '#6e5a3c';
    c.beginPath();
    c.arc(50, -20, 10, 0, Math.PI * 2);
    c.fill();
    stinkLines(c, -40, -140, 4, time);
  },

  filter(c, _, time) {
    c.fillStyle = '#efe2c8';
    c.beginPath();
    c.moveTo(-70, -110);
    c.lineTo(70, -110);
    c.lineTo(24, 0);
    c.lineTo(-24, 0);
    c.closePath();
    c.fill();
    c.strokeStyle = '#c8b48d';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = '#4a2c14';
    c.beginPath();
    c.ellipse(0, -100, 64, 10, 0, 0, Math.PI * 2);
    c.fill();
    stinkLines(c, -26, -124, 3, time);
  },

  note(c, content) {
    c.rotate(-0.04);
    c.fillStyle = 'rgba(0,0,0,0.15)';
    c.fillRect(-122, -176, 250, 178);
    c.fillStyle = '#fff176';
    c.fillRect(-126, -180, 250, 178);
    c.fillStyle = '#f9e04b';
    c.fillRect(-126, -180, 250, 22);
    c.fillStyle = '#2b2b6b';
    c.font = 'italic 17px "Comic Sans MS", "Segoe Print", cursive';
    const words = content.text.split(' ');
    let line = '';
    let ly = -134;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width > 222) {
        c.fillText(line, -114, ly);
        line = w;
        ly += 24;
      } else line = test;
    }
    c.fillText(line, -114, ly);
  },

  dust(c) {
    c.fillStyle = 'rgba(150,150,150,0.8)';
    [[-40, -20, 22], [-10, -30, 26], [24, -22, 20], [44, -12, 14], [-60, -10, 12]].forEach(([px, py, r]) => {
      c.beginPath();
      c.arc(px, py, r, 0, Math.PI * 2);
      c.fill();
    });
    c.fillStyle = '#222';
    c.beginPath();
    c.ellipse(70, -8, 7, 5, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#222';
    c.beginPath();
    c.moveTo(66, -12); c.lineTo(62, -18);
    c.moveTo(74, -12); c.lineTo(78, -18);
    c.stroke();
  },

  clip(c) {
    c.strokeStyle = '#a7b0b8';
    c.lineWidth = 6;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-50, -14);
    c.lineTo(40, -14);
    c.arc(40, -30, 16, Math.PI / 2, -Math.PI / 2, true);
    c.lineTo(-40, -46);
    c.arc(-40, -34, 12, -Math.PI / 2, Math.PI / 2, true);
    c.lineTo(30, -22);
    c.stroke();
    c.lineCap = 'butt';
    c.lineWidth = 1;
  },

  coin(c) {
    c.fillStyle = '#b8902a';
    c.beginPath();
    c.ellipse(0, -16, 46, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e6c04f';
    c.beginPath();
    c.ellipse(0, -22, 46, 16, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#9c7a1f';
    c.font = 'bold 18px sans-serif';
    c.textAlign = 'center';
    c.fillText('10', 0, -16);
    c.textAlign = 'left';
  },

  pen(c) {
    c.rotate(-0.2);
    c.fillStyle = '#2f5fbf';
    rr(c, -90, -24, 160, 18, 8);
    c.fill();
    c.fillStyle = '#ddd';
    c.beginPath();
    c.moveTo(70, -24);
    c.lineTo(96, -15);
    c.lineTo(70, -6);
    c.fill();
    c.fillStyle = '#1d3d80';
    c.fillRect(-70, -30, 40, 6);
  },
};
