'use strict';
/* All art is drawn in code: 16x16 people, tiles, 8x8 item icons, 32x32 radio portraits. */
const SPR = (() => {
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; };
  const cache = {};

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round((n >> 16 & 255) * f)), g = Math.min(255, Math.round((n >> 8 & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function outline(c, col) {
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const d = g.getImageData(0, 0, w, h).data;
    const a = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    g.fillStyle = col || '#000000';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) g.fillRect(x, y, 1, 1);
    return c;
  }
  function flip(c) { const [n, g] = mk(c.width, c.height); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return n; }

  /* ---------- people ---------- */
  function drawPerson(g, dir, f, p) {
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const { skin, hair, shirt, pants, shoes } = p;
    const sd = shade(shirt, 0.72), eye = '#101010';
    if (dir === 3) { // facing right (left is a mirror)
      R(5, 1, 6, 1, hair); R(4, 2, 7, 2, hair); R(4, 4, 2, p.long ? 5 : 3, hair);
      R(6, 4, 5, 4, skin); R(11, 5, 1, 2, skin); R(6, 4, 4, 1, hair);
      if (p.glasses) { R(8, 5, 3, 1, '#202020'); R(9, 6, 1, 1, eye); } else R(9, 5, 1, 2, eye);
      if (p.brow) R(8, 4, 3, 1, '#101010');
      R(5, 8, 6, 4, shirt);
      if (p.vest) R(5, 8, 3, 4, p.vest);
      if (p.zip) R(9, 8, 2, 1, '#f0f0f0');
      if (f === 0) { R(6, 12, 4, 3, pants); R(6, 15, 5, 1, shoes); }
      else if (f === 1) { R(8, 12, 2, 3, pants); R(8, 15, 3, 1, shoes); R(5, 12, 2, 2, pants); R(4, 14, 3, 1, shoes); }
      else { R(5, 12, 2, 3, pants); R(5, 15, 3, 1, shoes); R(8, 12, 2, 2, pants); R(8, 14, 3, 1, shoes); }
      const ax = f === 1 ? 8 : f === 2 ? 6 : 7;
      if (p.prop === 'clipboard') { R(9, 9, 3, 4, '#a86828'); R(10, 10, 1, 2, '#f0f0f0'); R(8, 9, 2, 3, sd); R(9, 11, 1, 1, skin); }
      else if (p.prop === 'box') { R(8, 9, 6, 4, '#f0f0f0'); R(9, 9, 4, 1, '#303030'); R(7, 9, 2, 2, sd); }
      else { R(ax, 8, 2, 3, sd); R(ax, 11, 2, 1, skin); }
      return;
    }
    R(5, 1, 6, 1, hair);
    if (dir === 1) { R(4, 2, 8, 6, hair); if (p.long) R(4, 8, 8, 1, hair); }
    else {
      R(4, 2, 8, 2, hair); R(4, 4, 8, 4, skin);
      R(4, 4, 1, p.long ? 5 : 1, hair); R(11, 4, 1, p.long ? 5 : 1, hair);
      if (p.glasses) { R(5, 5, 3, 2, '#202020'); R(8, 5, 3, 2, '#202020'); R(6, 5, 1, 1, '#b0e0f8'); R(9, 5, 1, 1, '#b0e0f8'); }
      else { R(6, 5, 1, 2, eye); R(9, 5, 1, 2, eye); }
      if (p.brow) { R(5, 4, 2, 1, '#101010'); R(9, 4, 2, 1, '#101010'); }
    }
    R(4, 8, 8, 4, shirt);
    if (p.vest) { if (dir === 1) R(4, 8, 8, 4, p.vest); else { R(4, 8, 2, 4, p.vest); R(10, 8, 2, 4, p.vest); } }
    if (p.zip && dir === 0) { R(6, 8, 4, 1, '#f0f0f0'); R(7, 9, 1, 3, sd); }
    const la = f === 1 ? -1 : 0, ra = f === 2 ? -1 : 0;
    R(3, 8, 1, 3, sd); R(12, 8, 1, 3, sd); R(3, 11 + la, 1, 1, skin); R(12, 11 + ra, 1, 1, skin);
    R(5, 12, 6, 1, pants);
    if (f === 1) { R(5, 13, 2, 1, pants); R(5, 14, 2, 1, shoes); R(9, 13, 2, 2, pants); R(9, 15, 2, 1, shoes); }
    else if (f === 2) { R(5, 13, 2, 2, pants); R(5, 15, 2, 1, shoes); R(9, 13, 2, 1, pants); R(9, 14, 2, 1, shoes); }
    else { R(5, 13, 2, 2, pants); R(9, 13, 2, 2, pants); R(5, 15, 2, 1, shoes); R(9, 15, 2, 1, shoes); }
    if (dir === 0) {
      if (p.prop === 'clipboard') { R(11, 9, 3, 4, '#a86828'); R(12, 10, 1, 2, '#f0f0f0'); }
      if (p.prop === 'box') { R(4, 9, 8, 4, '#f0f0f0'); R(5, 9, 6, 1, '#303030'); R(6, 11, 4, 1, '#2858e8'); }
    }
  }
  function person(p, dir, f) {
    const key = 'p' + p.id + dir + f;
    if (cache[key]) return cache[key];
    let c;
    if (dir === 2) c = flip(person(p, 3, f));
    else { const [cc, g] = mk(16, 16); drawPerson(g, dir, f, p); c = outline(cc); }
    return (cache[key] = c);
  }

  function kid(p, crying, f) {
    const key = 'k' + p.id + (crying ? 1 : 0) + f;
    if (cache[key]) return cache[key];
    const [c, g] = mk(16, 16);
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const yo = crying && f ? 1 : 0;
    R(5, 5 + yo, 6, 1, p.hair); R(4, 6 + yo, 8, 2, p.hair);
    R(4, 8 + yo, 8, 3, p.skin); R(4, 8 + yo, 1, 1, p.hair); R(11, 8 + yo, 1, 1, p.hair);
    if (crying) {
      R(5, 9 + yo, 2, 1, '#101010'); R(9, 9 + yo, 2, 1, '#101010'); R(7, 10 + yo, 2, 1, '#801818');
      R(5, 10 + yo, 1, 1, '#38b8f8'); R(10, 10 + yo, 1, 1, '#38b8f8');
      if (f) { R(4, 11 + yo, 1, 1, '#38b8f8'); R(11, 11 + yo, 1, 1, '#38b8f8'); }
    } else { R(6, 9, 1, 1, '#101010'); R(9, 9, 1, 1, '#101010'); R(7, 10, 2, 1, '#c83030'); }
    R(5, 11 + yo, 6, 3 - yo, p.shirt);
    if (crying) { R(3, 7 + yo, 1, 3, p.shirt); R(12, 7 + yo, 1, 3, p.shirt); R(3, 6 + yo, 1, 1, p.skin); R(12, 6 + yo, 1, 1, p.skin); }
    else { R(4, 11, 1, 2, p.shirt); R(11, 11, 1, 2, p.shirt); R(4, 13, 1, 1, p.skin); R(11, 13, 1, 1, p.skin); }
    R(6, 14, 1, 1, p.pants); R(9, 14, 1, 1, p.pants); R(5, 15, 2, 1, p.shoes); R(9, 15, 2, 1, p.shoes);
    return (cache[key] = outline(c));
  }

  /* The privacy screen: a tri-fold booth divider with the voter's feet sticking out. */
  function screen(f) {
    const key = 'scr' + f;
    if (cache[key]) return cache[key];
    const [c, g] = mk(16, 16);
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    R(1, 3, 3, 11, '#a8a8b0'); R(12, 3, 3, 11, '#a8a8b0');
    R(4, 1, 8, 13, '#e4e4ea'); R(4, 1, 8, 3, '#2848c8');
    R(5, 2, 1, 1, '#fcfcfc'); R(7, 2, 1, 1, '#fcfcfc'); R(10, 2, 1, 1, '#fcfcfc');
    [[5, 8], [6, 9], [7, 8], [8, 7], [9, 6], [10, 5]].forEach(([x, y]) => R(x, y, 1, 1, '#2848c8'));
    if (f) { R(5, 14, 2, 2, '#e8e8e8'); R(9, 15, 2, 1, '#e8e8e8'); }
    else { R(5, 15, 2, 1, '#e8e8e8'); R(9, 14, 2, 2, '#e8e8e8'); }
    return (cache[key] = outline(c));
  }

  /* ---------- 8x8 icons ---------- */
  const AP = { K: '#000000', W: '#fcfcfc', L: '#bcbcbc', G: '#7c7c7c', D: '#3c3c3c', Y: '#f8d800', N: '#a86020', T: '#e0b070',
    O: '#f87800', R: '#d82800', B: '#2858e8', C: '#58d8f8', E: '#38b838', P: '#f878b8', S: '#f0b080' };
  function art(rows) {
    const [c, g] = mk(rows[0].length, rows.length);
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (AP[ch]) { g.fillStyle = AP[ch]; g.fillRect(x, y, 1, 1); } }));
    return c;
  }
  const ICON_ART = {
    phone:   ['..KKKK..', '..KCCK..', '..KCCK..', '..KCCK..', '..KCCK..', '..KKKK..', '..KWKK..', '..KKKK..'],
    screen:  ['LBBBBBBL', 'LBWBWBBL', 'LWWWWWWL', 'LWWWBWWL', 'LWBWBWWL', 'LWWBWWWL', 'LGGGGGGL', 'K......K'],
    sticker: ['..LLLL..', '.LWWWWL.', 'LWRWRRWL', 'LWWWWWWL', 'LWBBBBWL', 'LWWWWWWL', '.LWWWWL.', '..LLLL..'],
    juice:   ['....K...', '....K...', 'OOOOOO..', 'OWWWWO..', 'OWEEWO..', 'OWEEWO..', 'OWWWWO..', 'OOOOOO..'],
    granola: ['........', '........', 'YYYYYYYY', 'YNNTNTNY', 'YTNNTNNY', 'YYYYYYYY', '........', '........'],
    sample:  ['WWWWWW..', 'WKKKWW..', 'WWWWWW..', 'WKWKKW..', 'WWWWWW..', 'WKWKKW..', 'WWWWWW..', '........'],
    coffee:  ['..W.W...', '.W.W....', 'LLLLLL..', 'LNNNNLL.', 'LNNNNL.L', 'LNNNNLL.', '.LLLL...', '........'],
    earplugs:['........', '.OO.....', 'OOOO....', 'OOOO.OO.', '.OO.OOOO', '....OOOO', '.....OO.', '........'],
    pen:     ['.......K', '......KK', '.....BK.', '....BB..', '...BB...', '..BB....', '.WB.....', 'K.......'],
    card:    ['........', 'WWWWWWWW', 'WBBBBBBW', 'WWWWWWWW', 'WSSWKKWW', 'WSSWWWWW', 'WWWWWWWW', '........'],
    ballot:  ['WWWWWW..', 'WKWLLW..', 'WWWWWW..', 'WKWLLW..', 'WWWWWW..', 'WKWLLW..', 'WWWWWW..', '........']
  };
  function icon(name) { const k = 'i' + name; return cache[k] || (cache[k] = art(ICON_ART[name])); }
  function star(on) {
    const k = 'star' + on;
    if (cache[k]) return cache[k];
    const rows = ['...Y...', '...Y...', 'YYYYYYY', '.YYYYY.', '..YYY..', '.YY.YY.', 'Y.....Y'];
    return (cache[k] = art(on ? rows : rows.map(r => r.replace(/Y/g, 'D'))));
  }

  /* ---------- tiles ---------- */
  function roomCanvas(Rm) {
    const [c, g] = mk(256, 192);
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const at = (cc, rr) => (rr < 0 || rr >= 12 || cc < 0 || cc >= 16) ? '#' : Rm.map[rr][cc];
    function cap(x, y) { R(x, y, 16, 16, '#34384a'); R(x + 1, y + 1, 14, 14, '#44485c'); }
    function face(x, y, ch, cc) {
      R(x, y, 16, 16, '#b4b8c8');
      R(x, y + 5, 16, 1, '#8c90a0'); R(x, y + 10, 16, 1, '#8c90a0');
      R(x + 7, y, 1, 5, '#8c90a0'); R(x + 3, y + 5, 1, 5, '#8c90a0'); R(x + 11, y + 5, 1, 5, '#8c90a0'); R(x + 7, y + 10, 1, 4, '#8c90a0');
      R(x, y, 16, 2, '#686c80'); R(x, y + 14, 16, 2, '#404458');
      if (ch === 'b') {
        R(x, y + 3, 16, 1, '#303030');
        const cols = ['#d82800', '#fcfcfc', '#2858e8'];
        for (let i = 0; i < 3; i++) { const bx = x + 1 + i * 5, col = cols[(cc + i) % 3]; R(bx, y + 4, 4, 1, col); R(bx + 1, y + 5, 2, 1, col); R(bx + 1, y + 6, 2, 1, col); R(bx + 1, y + 7, 1, 1, col); }
      }
      if (ch === 'v') {
        R(x + 2, y + 2, 12, 11, '#202020'); R(x + 3, y + 3, 10, 9, '#fcfcfc');
        R(x + 5, y + 8, 6, 3, '#2858e8'); R(x + 6, y + 8, 4, 1, '#202020');
        [[5, 5], [6, 6], [7, 5], [8, 4], [9, 3]].forEach(([dx, dy]) => R(x + dx, y + dy + 1, 1, 1, '#38a838'));
      }
    }
    function floor(x, y, cc, r) {
      if (Rm.floor === 'wood') {
        R(x, y, 16, 16, '#c0803c');
        for (let k = 0; k < 4; k++) {
          R(x, y + k * 4, 16, 1, '#d09450'); R(x, y + k * 4 + 3, 16, 1, '#98602c');
          R(x + ((k + r + cc) % 2 ? 4 : 12), y + k * 4, 1, 3, '#98602c');
        }
      } else {
        for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++)
          R(x + qx * 8, y + qy * 8, 8, 8, ((cc * 2 + qx) + (r * 2 + qy)) % 2 ? '#c8c4b0' : '#b4b09c');
      }
    }
    for (let r = 0; r < 12; r++) for (let cc = 0; cc < 16; cc++) {
      const ch = at(cc, r), x = cc * 16, y = r * 16;
      if (ch === '#' || ch === 'b' || ch === 'v') {
        const below = at(cc, r + 1);
        if (r + 1 < 12 && !'#bvE'.includes(below)) face(x, y, ch, cc); else cap(x, y);
        continue;
      }
      if (ch === 'E') {
        cap(x, y); R(x + 1, y + 2, 14, 14, '#805828'); R(x + 3, y + 4, 10, 6, '#a8d8f8'); R(x + 3, y + 4, 10, 1, '#e8f8f8');
        R(cc % 2 ? x + 1 : x + 13, y + 11, 2, 2, '#d8b040');
        continue;
      }
      floor(x, y, cc, r);
      switch (ch) {
        case 'L':
          g.fillStyle = 'rgba(248,216,0,0.13)'; g.fillRect(x, y, 16, 16);
          if (at(cc - 1, r) === '.') R(x, y, 2, 16, '#e8c000');
          if (at(cc + 1, r) === '.') R(x + 14, y, 2, 16, '#e8c000');
          if (at(cc, r - 1) === '.') R(x, y, 16, 2, '#e8c000');
          if (at(cc, r + 1) === '.') R(x, y + 14, 16, 2, '#e8c000');
          break;
        case '=':
          if (at(cc, r - 1) === '=' || at(cc, r - 1) === '#') R(x + 7, y, 2, 8, '#b01828');
          if (at(cc, r + 1) === '=') R(x + 7, y + 8, 2, 8, '#b01828');
          R(x + 5, y + 12, 6, 2, '#806000'); R(x + 6, y + 6, 4, 6, '#c89800'); R(x + 6, y + 5, 4, 2, '#f8d860'); R(x + 6, y + 7, 1, 4, '#f8e080');
          break;
        case 'T':
          R(x, y + 1, 16, 11, '#b06c30'); R(x, y + 1, 16, 1, '#d08848'); R(x, y + 12, 16, 3, '#704418');
          if (cc % 2) { R(x + 3, y + 3, 6, 5, '#fcfcfc'); R(x + 4, y + 4, 4, 1, '#7c7c7c'); R(x + 4, y + 6, 3, 1, '#7c7c7c'); }
          else { R(x + 5, y + 3, 8, 6, '#2858e8'); R(x + 6, y + 4, 6, 4, '#fcfcfc'); }
          break;
        case 'B':
          R(x + 1, y + 13, 1, 3, '#303030'); R(x + 14, y + 13, 1, 3, '#303030');
          R(x, y + 1, 2, 12, '#c8c8d0'); R(x + 14, y + 1, 2, 12, '#c8c8d0');
          R(x + 2, y, 12, 10, '#ececf0'); R(x + 2, y, 12, 2, '#2848c8');
          R(x + 1, y + 10, 14, 3, '#7c808c'); R(x + 1, y + 10, 14, 1, '#a0a4b0');
          break;
        case 'S':
          R(x, y, 16, 15, '#303840'); R(x, y, 16, 4, '#586068'); R(x, y + 6, 16, 2, '#000000');
          if (cc % 2 === 1) { R(x + 3, y + 10, 3, 3, '#38f838'); } else { R(x + 6, y + 10, 8, 3, '#f0f0f0'); }
          break;
        case 'F':
          R(x + 2, y + 3, 12, 9, '#a8b0b8'); R(x + 4, y + 5, 8, 4, '#6890b0'); R(x + 7, y + 4, 2, 1, '#606870'); R(x + 5, y + 12, 6, 3, '#707880');
          break;
        case 'P':
          R(x + 4, y + 10, 8, 5, '#a85020'); R(x + 3, y + 9, 10, 2, '#c86830');
          R(x + 3, y + 2, 10, 8, '#38a838'); R(x + 1, y + 4, 4, 4, '#289028'); R(x + 11, y + 4, 4, 4, '#289028'); R(x + 6, y, 4, 4, '#48c848');
          break;
        case 'C':
          R(x + 3, y + 2, 10, 4, '#707880'); R(x + 3, y + 7, 10, 5, '#9098a0'); R(x + 3, y + 12, 1, 3, '#404850'); R(x + 12, y + 12, 1, 3, '#404850');
          break;
        case 'x':
          R(x + 4, y + 4, 8, 11, '#506070'); R(x + 3, y + 3, 10, 2, '#708090'); R(x + 6, y + 6, 1, 7, '#405060'); R(x + 9, y + 6, 1, 7, '#405060');
          break;
      }
    }
    // EXIT label over the front doors
    for (let r = 0; r < 12; r++) { const col = Rm.map[r].indexOf('E'); if (col >= 0) { drawText(g, 'EXIT', col * 16 + 4, r * 16 + 5, '#f83800'); break; } }
    // outline every solid prop so it reads like NES art
    return c;
  }

  /* ---------- radio portraits (32x32) ---------- */
  function portrait(kind, open) {
    const key = 'por' + kind + (open ? 1 : 0);
    if (cache[key]) return cache[key];
    const [c, g] = mk(32, 32);
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const P = kind === 'hotline'
      ? { bg: '#203858', skin: '#a86030', hair: '#181818', shirt: '#9040b8', headset: true, curly: true }
      : { bg: '#203820', skin: '#f0b080', hair: '#5a3010', shirt: '#20a040', collar: true };
    R(0, 0, 32, 32, P.bg);
    R(3, 27, 26, 5, P.shirt);
    if (P.collar) { R(11, 27, 10, 2, '#f0f0f0'); R(15, 28, 2, 4, '#106020'); }
    R(12, 22, 8, 5, shade(P.skin, 0.82));
    R(8, 7, 16, 16, P.skin); R(10, 23, 12, 1, P.skin);
    R(6, 13, 2, 5, P.skin); R(24, 13, 2, 5, P.skin);
    if (P.curly) { R(6, 2, 20, 8, P.hair); R(5, 5, 3, 9, P.hair); R(24, 5, 3, 9, P.hair); R(7, 1, 4, 2, P.hair); R(14, 0, 5, 2, P.hair); R(21, 1, 4, 2, P.hair); }
    else { R(7, 3, 18, 6, P.hair); R(6, 5, 3, 7, P.hair); R(23, 5, 3, 6, P.hair); R(9, 9, 7, 2, P.hair); }
    R(10, 12, 4, 1, P.hair); R(18, 12, 4, 1, P.hair);
    R(10, 14, 4, 3, '#fcfcfc'); R(18, 14, 4, 3, '#fcfcfc'); R(12, 14, 2, 3, '#000'); R(20, 14, 2, 3, '#000');
    R(15, 16, 2, 4, shade(P.skin, 0.8));
    if (open) { R(13, 20, 6, 3, '#601818'); R(14, 20, 4, 1, '#fcfcfc'); } else R(13, 21, 6, 1, '#802828');
    if (P.headset) { R(6, 2, 20, 2, '#505860'); R(4, 12, 3, 7, '#303840'); R(7, 18, 1, 4, '#303840'); R(7, 21, 6, 1, '#303840'); R(13, 20, 2, 2, '#f83800'); }
    return (cache[key] = c);
  }

  /* ---------- title logo ---------- */
  function logo() {
    if (cache.logo) return cache.logo;
    const [c, g] = mk(140, 72);
    drawText(g, 'VOTER', (140 - textWidth('VOTER', 4)) / 2, 4, '#fff', 4);
    drawText(g, 'GEAR', (140 - textWidth('GEAR', 4)) / 2, 38, '#fff', 4);
    g.globalCompositeOperation = 'source-atop';
    for (const top of [4, 38]) { g.fillStyle = '#fcfcfc'; g.fillRect(0, top, 140, 14); g.fillStyle = '#b8c4d8'; g.fillRect(0, top + 14, 140, 7); g.fillStyle = '#7484a0'; g.fillRect(0, top + 21, 140, 8); }
    g.globalCompositeOperation = 'source-over';
    outline(c, '#000000'); outline(c, '#2c3858');
    return (cache.logo = c);
  }

  return { shade, person, kid, screen, icon, star, roomCanvas, portrait, logo };
})();
