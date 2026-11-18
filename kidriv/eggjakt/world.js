// Kontorkartet: rom, gulv, vegger og alle ting som står der.
// Koordinater er "gulvkoordinater" (sett ovenfra). Høyde (z) tegnes oppover på skjermen
// slik at vi får et skrått ovenfra-perspektiv.

const WORLD = { w: 1600, h: 1120 };
const SPAWN = { x: 640, y: 1050 };
const WALL_Z_BACK = 74; // bakvegg med vinduer
const WALL_Z = 24;      // øvrige vegger er "kuttet" lave så man ser inn i rommene

const ROOMS = [
  { key: 'boss', name: 'Sjefens kontor', where: 'på sjefens kontor', x: 20, y: 20, w: 380, h: 380 },
  { key: 'kitchen', name: 'Kjøkken', where: 'på kjøkkenet', x: 1060, y: 20, w: 520, h: 520 },
  { key: 'meeting', name: 'Møterom', where: 'på møterommet', x: 1060, y: 560, w: 520, h: 540 },
  { key: 'reception', name: 'Resepsjon', where: 'i resepsjonen', x: 20, y: 800, w: 400, h: 300 },
];
const OPEN_OFFICE = { key: 'open', name: 'Kontorlandskap', where: 'i kontorlandskapet' };

function roomAt(x, y) {
  for (const r of ROOMS) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return OPEN_OFFICE;
}

// Flate ting på gulvet (tepper, matter) – tegnes sammen med gulvet.
const RUGS = [
  { x: 60, y: 140, w: 300, h: 200, color: '#7b3f3f', border: '#a65b5b' },     // sjefens teppe
  { x: 490, y: 610, w: 280, h: 190, color: '#4f7b6a', border: '#6c9c89' },    // sofakrok
  { x: 560, y: 1050, w: 160, h: 50, color: '#4b4f5c', border: '#5f6473' },    // dørmatte
  { x: 1150, y: 690, w: 340, h: 180, color: '#5c6d9c', border: '#7a8cbd' },   // møterom
];

// Små pseudo-tilfeldige tall som er like hver gang (for bøker osv.)
function seeded(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function createWorld() {
  const objs = [];
  let id = 0;
  const add = (type, name, x, y, w, h, z, extra = {}) => {
    const o = Object.assign({ id: id++, type, name, x, y, w, h, z, elev: 0, solid: true }, extra);
    objs.push(o);
    return o;
  };
  const S = { searchable: true };
  const wall = (x, y, w, h, extra = {}) => add('wall', 'Vegg', x, y, w, h, extra.z || WALL_Z, extra);

  // --- Vegger ---
  wall(0, 0, WORLD.w, 20, { z: WALL_Z_BACK, back: true });
  wall(0, WORLD.h - 20, WORLD.w, 20);
  wall(0, 0, 20, WORLD.h);
  wall(WORLD.w - 20, 0, 20, WORLD.h);
  // Sjefens kontor
  wall(400, 20, 20, 380);
  wall(20, 400, 140, 20);
  wall(260, 400, 160, 20);
  // Kjøkken / møterom
  wall(1040, 20, 20, 220);
  wall(1040, 340, 20, 420);
  wall(1040, 860, 20, 240);
  wall(1060, 540, 520, 20);

  // --- Sjefens kontor ---
  add('shelf', 'Bokhylle', 40, 22, 150, 34, 92, { ...S, books: makeBooks(1) });
  add('safe', 'Safe', 320, 24, 56, 44, 54, {
    info: 'Safen er låst. Sjefen sier det bare ligger gamle budsjetter der inne.',
  });
  add('chair', 'Kontorstol', 234, 120, 42, 38, 20, { back: 'n', color: '#2f2f35' });
  add('desk', 'Sjefens skrivebord', 170, 168, 170, 70, 32, { ...S, seat: 'n', boss: true });
  add('plant', 'Gummiplante', 36, 320, 46, 46, 22, { ...S, variant: 'bush' });

  // --- Kontorlandskap: skrivebord ---
  const deskRow = (y, seat, names) => {
    const xs = [470, 600, 800];
    names.forEach((n, i) => {
      const x = xs[i];
      const chairY = seat === 'n' ? y - 44 : y + 66;
      add('chair', 'Kontorstol', x + 40, chairY, 42, 38, 20, { back: seat === 'n' ? 'n' : 's' });
      add('desk', n, x, y, 120, 60, 30, { ...S, seat });
    });
  };
  deskRow(110, 'n', ['Karis skrivebord', 'Oles skrivebord', "Jonas' skrivebord"]);
  deskRow(300, 's', ['Pers skrivebord', 'Lises skrivebord', 'Noras skrivebord']);

  add('printer', 'Kopimaskin', 930, 470, 80, 54, 42, S);
  add('paper', 'Papirbunke', 830, 486, 58, 40, 16, S);
  add('box', 'Pappeske', 40, 440, 64, 52, 38, S);
  add('box', 'Liten pappeske', 112, 452, 50, 44, 30, S);
  add('coatrack', 'Knagg med jakke', 340, 446, 36, 36, 76, { ...S, color: '#3a6ea5' });
  add('plant', 'Palme', 980, 30, 46, 46, 24, { ...S, variant: 'palm' });
  add('bin', 'Søppelbøtte', 740, 520, 30, 30, 28, { bin: true });
  // Sofakrok
  add('sofa', 'Sofa', 520, 630, 170, 60, 36, { ...S, color: '#3d7ea6' });
  add('table', 'Sofabord', 560, 722, 90, 46, 18, {});
  add('plant', 'Monstera', 720, 650, 46, 46, 22, { ...S, variant: 'bush' });
  add('cabinet', 'Arkivskap', 880, 880, 76, 48, 64, S);
  add('box', 'Flytteeske', 460, 990, 74, 58, 40, S);

  // --- Resepsjon ---
  add('chair', 'Kontorstol', 200, 852, 42, 38, 20, { back: 'n', color: '#7a2f2f' });
  add('recdesk', 'Resepsjonsdisk', 110, 900, 220, 52, 40, {
    info: 'Resepsjonsdisken. Lapp fra resepsjonisten: «Kåre har mistet eggene sine – si fra hit hvis du finner dem!»',
  });
  add('candybowl', 'Godteriskål', 196, 906, 46, 32, 12, { elev: 40, solid: false, sortY: 952.5, pieces: 3 });
  add('coatrack', 'Knagg med frakk', 40, 1040, 36, 36, 76, { ...S, color: '#8a5a2b' });
  add('plant', 'Fikus', 340, 1040, 46, 46, 22, { ...S, variant: 'tall' });

  // --- Kjøkken ---
  add('counter', 'Kjøkkenskap', 1090, 22, 300, 62, 40, S);
  add('coffee', 'Kaffetrakter', 1130, 30, 52, 40, 46, { elev: 40, solid: false, sortY: 84.5 });
  add('fridge', 'Kjøleskap', 1410, 22, 74, 68, 100, S);
  add('plant', 'Basilikum', 1512, 30, 40, 40, 18, { ...S, variant: 'herb' });
  add('chair', 'Stol', 1215, 212, 42, 36, 20, { back: 'n', color: '#c0583a' });
  add('chair', 'Stol', 1305, 212, 42, 36, 20, { back: 'n', color: '#c0583a' });
  add('table', 'Lunsjbord', 1190, 250, 190, 84, 28, {});
  add('chair', 'Stol', 1215, 340, 42, 36, 20, { back: 's', color: '#c0583a' });
  add('chair', 'Stol', 1305, 340, 42, 36, 20, { back: 's', color: '#c0583a' });
  add('bin', 'Søppelbøtte', 1530, 480, 30, 30, 28, { bin: true });

  // --- Møterom ---
  add('whiteboard', 'Tavle', 1180, 560, 220, 16, 76, {
    info: 'På tavla står det med store bokstaver: «HAR NOEN SETT EGGENE MINE?! 24 stk.» – hilsen Kåre',
  });
  add('sofa', 'Sofa', 1430, 596, 130, 58, 36, { ...S, color: '#9c4f7a', name: 'Lilla sofa' });
  [1200, 1270, 1340, 1410].forEach((x) => {
    add('chair', 'Stol', x, 676, 40, 36, 20, { back: 'n', color: '#3a3f4a' });
  });
  add('table', 'Møtebord', 1180, 720, 280, 110, 28, {});
  add('cake', 'Bursdagskake', 1286, 748, 66, 50, 18, { elev: 28, solid: false, sortY: 830.5, slices: 4 });
  [1200, 1270, 1340, 1410].forEach((x) => {
    add('chair', 'Stol', x, 838, 40, 36, 20, { back: 's', color: '#3a3f4a' });
  });
  add('plant', 'Yucca', 1090, 1040, 46, 46, 24, { ...S, variant: 'palm' });
  add('box', 'Eske med julepynt', 1390, 1030, 72, 56, 36, S);
  add('bin', 'Søppelbøtte', 1536, 1060, 30, 30, 28, { bin: true });

  // Rommet hver ting står i
  for (const o of objs) o.room = roomAt(o.x + o.w / 2, o.y + o.h / 2);
  return objs;
}

function makeBooks(seed) {
  const rnd = seeded(seed);
  const colors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#f39c12', '#16a085', '#d35400', '#2c3e50', '#e8d8b0'];
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    let x = 0;
    while (x < 1) {
      const w = 0.04 + rnd() * 0.05;
      row.push({ x, w, h: 0.6 + rnd() * 0.35, c: colors[Math.floor(rnd() * colors.length)] });
      x += w + 0.008;
    }
    rows.push(row);
  }
  return rows;
}

// Naturlig norsk for "hvor lå eggene?"
const HIDE_PHRASE = {
  'Bokhylle': 'bak bøkene i bokhylla',
  'Sjefens skrivebord': 'i skuffen på sjefens skrivebord',
  'Gummiplante': 'under gummiplanten',
  'Kopimaskin': 'inni kopimaskinen',
  'Papirbunke': 'under papirbunken',
  'Pappeske': 'under pappesken',
  'Liten pappeske': 'under den lille pappesken',
  'Knagg med jakke': 'under jakka på knaggen',
  'Knagg med frakk': 'under frakken på knaggen',
  'Palme': 'under palmen',
  'Sofa': 'under sofaputen',
  'Lilla sofa': 'under puta i den lilla sofaen',
  'Monstera': 'under monsteraen',
  'Arkivskap': 'i arkivskapet',
  'Flytteeske': 'under flytteesken',
  'Fikus': 'under fikusen',
  'Kjøkkenskap': 'i kjøkkenskapet',
  'Kjøleskap': 'i kjøleskapet',
  'Basilikum': 'under basilikumpotta',
  'Yucca': 'under yuccapalmen',
  'Eske med julepynt': 'under esken med julepynt',
};
function hidePhrase(o) {
  if (HIDE_PHRASE[o.name]) return HIDE_PHRASE[o.name];
  if (o.type === 'desk') return `i skuffen på ${o.name}`;
  return `i ${o.name.toLowerCase()}`;
}

// ----- Innhold: hva skjuler seg bak/under/inni tingene? -----
const CANDY = [
  { kind: 'candy', name: 'en sjokoladeplate', short: 'Sjokolade', icon: '🍫', energy: 12, art: 'bar' },
  { kind: 'candy', name: 'en pose smågodt', short: 'Smågodt', icon: '🍬', energy: 12, art: 'bag' },
  { kind: 'candy', name: 'en kjærlighet på pinne', short: 'Slikkepinne', icon: '🍭', energy: 10, art: 'lolli' },
];
const MUFFIN = { kind: 'cake', name: 'en sjokolademuffins', short: 'Muffins', icon: '🧁', energy: 15, art: 'muffin' };
const TRASH = [
  { kind: 'trash', name: 'et gammelt bananskall', art: 'banana' },
  { kind: 'trash', name: 'en mugne pizzabit', art: 'pizza' },
  { kind: 'trash', name: 'en svett, gammel sokk', art: 'sock' },
  { kind: 'trash', name: 'et brukt kaffefilter', art: 'filter' },
];
const EMPTY = [
  { kind: 'empty', text: 'Bare støv og en død flue. Ingen egg her.', art: 'dust' },
  { kind: 'empty', text: 'En binders. Spennende… men ingen egg.', art: 'clip' },
  { kind: 'empty', text: 'En tikroning! Dessverre ikke egg.', art: 'coin' },
  { kind: 'empty', text: 'En penn som ikke virker. Ingen egg her.', art: 'pen' },
  { kind: 'empty', text: 'Ingenting. Bare en hårstrikk og litt lo.', art: 'dust' },
];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function distributeContents(objs) {
  const spots = shuffle(objs.filter((o) => o.searchable));
  // Eggene skal ikke ligge rett ved startpunktet
  const eggIdx = spots.findIndex((o) => Math.hypot(o.x + o.w / 2 - SPAWN.x, o.y + o.h / 2 - SPAWN.y) > 450);
  const eggSpot = spots.splice(eggIdx, 1)[0];
  eggSpot.content = { kind: 'eggs', art: 'eggs' };

  const gogglesSpot = spots.pop();
  gogglesSpot.content = { kind: 'goggles', name: 'et par databriller med varmesyn', short: 'Databriller', icon: '🥽', art: 'goggles' };

  const list = [
    ...CANDY.map((c) => ({ ...c })),
    { ...MUFFIN },
    ...TRASH.map((t) => ({ ...t })),
    {
      kind: 'note', art: 'note',
      text: `«Så Kåre rote rundt ${eggSpot.room.where} med en eggekartong i går kveld…» – Anonym`,
    },
    {
      kind: 'note', art: 'note',
      text: `«Har noen sett databrillene mine? Sist hadde jeg dem ${gogglesSpot.room.where}.» – IT-Ivar`,
    },
  ];
  for (const c of list) {
    const spot = spots.pop();
    if (spot) spot.content = c;
  }
  let e = 0;
  for (const spot of spots) spot.content = { ...EMPTY[e++ % EMPTY.length] };
  return eggSpot;
}
