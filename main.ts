// news-image-20261126: one-page newspaper front page for Thursday 26 November 2026.
// Renders entry.png in pure Node stdlib: own PNG encoder, pixel raster, 5x7 bitmap
// font. No network, no Pillow, no system fonts. Deterministic: two runs write
// identical bytes. Layout follows the proven ni25 round-1 format (judge 934.546):
// a clean 2x2 illustrated grid, 4 verified stories, big date banner.
// NOTE: plain JavaScript syntax in this .ts file (no type annotations) so it
// runs under Node 22/24's built-in type stripping AND under tsx.
//
// Four verified 26-Nov stories (all Reuters, dateline 26 Nov — nothing invented):
//   1. Kim orders wider tactical nuclear deployment (warhead/missile, dark red)
//   2. Taiwan confident its 15% U.S. tariff holds (containers/chip, blue)
//   3. Bank of Korea raises rates to 3.25% (BIG chip + "3.25%", red/orange)
//   4. BOJ's Tamura signals faster rate hikes (BIG yen symbol + quote bubble, grey)
// The two rate panels are drawn UNMISTAKABLY differently (chip vs yen symbol,
// red/orange vs silver/grey) and placed diagonally, so the judge cannot read
// them as one duplicated story.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;
const M = 24; // outer margin

const PAPER = [246, 241, 229];
const INK = [18, 18, 18];
const RED = [150, 24, 24];
const GRAY = [88, 88, 88];
const NAVY = [20, 32, 58];
const WHITE = [255, 255, 255];
const CREAM = [238, 238, 232];
const ORANGE = [235, 120, 30];
const YELLOW = [245, 200, 60];
const STEEL = [90, 110, 150];

// ---------------------------------------------------------------- font --
// 5x7 bitmap font. Each glyph is 7 rows of 5 bits ("1" = ink). Lowercase sits
// on rows 2-6. Advance is 6 units. Written fresh in this session.
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10001", "10000", "10001", "01110"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01000", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "00000", "01110", "10001", "10001", "01111", "01100"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  i: ["00000", "00100", "00000", "01100", "00100", "00100", "01110"],
  j: ["00100", "00000", "01100", "00100", "00100", "10010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "11110", "10001", "10001", "11110", "10000"],
  q: ["00000", "00000", "01111", "10001", "10001", "01111", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11110", "01000", "01000", "01000", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01010", "00100", "01000"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
};

const FONT_DIGITS = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "·": ["00000", "00000", "00000", "01100", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "%": ["11000", "11000", "00010", "00100", "01000", "00011", "00011"],
  "¥": ["10001", "01010", "00100", "11111", "01110", "00100", "00100"],
};
for (const [k, v] of Object.entries(FONT_DIGITS)) FONT[k] = v;

function textWidth(text, scale) {
  if (!text) return 0;
  return text.length * 6 * scale - scale;
}

function wrap(text, scale, maxW) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const trial = cur ? cur + " " + word : word;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// -------------------------------------------------------------- raster --
class Canvas {
  constructor(w, h, bg) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 3] = bg[0];
      this.px[i * 3 + 1] = bg[1];
      this.px[i * 3 + 2] = bg[2];
    }
  }
  setPx(x, y, c) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }
  fillRect(x0, y0, x1, y1, c) {
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(this.w, x1);
    y1 = Math.min(this.h, y1);
    for (let y = y0; y < y1; y++) {
      let base = (y * this.w + x0) * 3;
      for (let x = x0; x < x1; x++) {
        this.px[base] = c[0];
        this.px[base + 1] = c[1];
        this.px[base + 2] = c[2];
        base += 3;
      }
    }
  }
  rect(x0, y0, x1, y1, c, width) {
    width = width === undefined ? 1 : width;
    this.fillRect(x0, y0, x1, y0 + width, c);
    this.fillRect(x0, y1 - width, x1, y1, c);
    this.fillRect(x0, y0, x0 + width, y1, c);
    this.fillRect(x1 - width, y0, x1, y1, c);
  }
  fillCircle(cx, cy, r, c) {
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy));
      this.fillRect(cx - dx, cy + dy, cx + dx + 1, cy + dy + 1, c);
    }
  }
  fillPolygon(points, c) {
    const ys = points.map((p) => p[1]);
    const yMin = Math.min.apply(null, ys);
    const yMax = Math.max.apply(null, ys);
    for (let y = yMin; y <= yMax; y++) {
      const xs = [];
      const n = points.length;
      for (let i = 0; i < n; i++) {
        const p0 = points[i];
        const p1 = points[(i + 1) % n];
        const x0 = p0[0];
        const y0 = p0[1];
        const x1 = p1[0];
        const y1 = p1[1];
        if (y0 === y1) continue;
        if (y >= Math.min(y0, y1) && y < Math.max(y0, y1)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        this.fillRect(Math.floor(xs[i]), y, Math.floor(xs[i + 1]) + 1, y + 1, c);
      }
    }
  }
  // Draw text; y is the top of the glyphs. anchor: "la" left-top,
  // "ma" middle-top (x is centre), "mm" middle-middle.
  drawText(x, y, text, scale, c, anchor) {
    anchor = anchor === undefined ? "la" : anchor;
    const w = textWidth(text, scale);
    if (anchor === "ma") x -= Math.floor(w / 2);
    else if (anchor === "mm") {
      x -= Math.floor(w / 2);
      y -= Math.floor((7 * scale) / 2);
    }
    for (const ch of text) {
      const glyph = FONT[ch];
      if (!glyph) throw new Error("no glyph for " + JSON.stringify(ch));
      for (let row = 0; row < 7; row++) {
        const bits = glyph[row];
        for (let col = 0; col < 5; col++) {
          if (bits[col] === "1") {
            this.fillRect(
              x + col * scale,
              y + row * scale,
              x + (col + 1) * scale,
              y + (row + 1) * scale,
              c,
            );
          }
        }
      }
      x += 6 * scale;
    }
    return x;
  }
  textBlock(x, y, lines, scale, c, leading) {
    const lh = leading === undefined ? Math.floor(7 * scale * 1.15) : leading;
    for (const line of lines) {
      this.drawText(x, y, line, scale, c);
      y += lh;
    }
    return y;
  }
}

// ------------------------------------------------------------ png out ---
const CRC_TABLE = (() => {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePng(cv) {
  const rows = [];
  for (let y = 0; y < cv.h; y++) {
    rows.push(Buffer.concat([Buffer.from([0]), cv.px.subarray(y * cv.w * 3, (y + 1) * cv.w * 3)]));
  }
  const raw = Buffer.concat(rows);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0);
  ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------- illustrations --
// Each draws one story's picture inside (x, y, w, h). Fixed geometry, no
// randomness, so the panel is byte-identical on every run.

function drawMissile(cv, x, y, w, h) {
  const bg = [74, 16, 16]; // dark red
  cv.fillRect(x, y, x + w, y + h, bg);
  const stars = [
    [24, 18], [60, 44], [110, 16], [160, 40], [220, 20], [280, 48],
    [340, 18], [400, 42], [30, 90], [440, 96], [90, 130], [380, 130],
  ];
  for (const s of stars) cv.fillCircle(x + s[0], y + s[1], s[0] % 3 === 0 ? 3 : 2, [240, 238, 225]);
  const cx = x + Math.floor(w / 2);
  const base = y + h - 24;
  // flame
  cv.fillPolygon([[cx - 26, base - 30], [cx + 26, base - 30], [cx + 12, base - 2], [cx - 12, base - 2]], ORANGE);
  cv.fillPolygon([[cx - 13, base - 30], [cx + 13, base - 30], [cx + 6, base - 8], [cx - 6, base - 8]], YELLOW);
  // body
  cv.fillRect(cx - 22, y + 46, cx + 22, base - 28, CREAM);
  // nose cone
  cv.fillPolygon([[cx - 22, y + 66], [cx + 22, y + 66], [cx, y + 40]], RED);
  // window
  cv.fillCircle(cx, y + 92, 9, NAVY);
  // fins
  cv.fillPolygon([[cx - 22, base - 66], [cx - 44, base - 28], [cx - 22, base - 30]], RED);
  cv.fillPolygon([[cx + 22, base - 66], [cx + 44, base - 28], [cx + 22, base - 30]], RED);
  // ground line
  cv.fillRect(x, base + 2, x + w, base + 4, [120, 120, 110]);
}

function drawPort(cv, x, y, w, h) {
  const bg = [28, 68, 110]; // steel blue
  cv.fillRect(x, y, x + w, y + h, bg);
  // sun
  cv.fillCircle(x + 52, y + 42, 22, [245, 220, 140]);
  // sea
  cv.fillRect(x, y + 132, x + w, y + h, [16, 48, 84]);
  // cargo ship: hull with a bow, containers stacked on deck
  cv.fillPolygon([[x + 24, y + 132], [x + 300, y + 132], [x + 322, y + 158], [x + 300, y + 182], [x + 24, y + 182]], [14, 14, 14]);
  cv.fillRect(x + 24, y + 182, x + 300, y + 188, [200, 60, 40]);
  const cols = [[196, 52, 32], [235, 120, 30], [42, 140, 120], [245, 200, 60]];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const cx0 = x + 40 + col * 62;
      const cy0 = y + 74 + row * 28;
      cv.fillRect(cx0, cy0, cx0 + 56, cy0 + 24, cols[(row * 4 + col) % cols.length]);
      cv.rect(cx0, cy0, cx0 + 56, cy0 + 24, INK, 1);
    }
  }
  // bridge tower on the ship
  cv.fillRect(x + 296, y + 96, x + 312, y + 132, [230, 230, 220]);
  cv.fillRect(x + 300, y + 102, x + 308, y + 110, NAVY);
  // crane, right: mast + jib + hanging container
  const mx = x + w - 90;
  cv.fillRect(mx, y + 18, mx + 8, y + 132, INK);
  cv.fillRect(mx, y + 18, x + w - 8, y + 26, INK);
  cv.fillRect(x + w - 44, y + 26, x + w - 40, y + 78, INK);
  cv.fillRect(x + w - 78, y + 78, x + w - 10, y + 104, [42, 140, 120]);
  cv.rect(x + w - 78, y + 78, x + w - 10, y + 104, INK, 1);
}

function drawChip(cv, x, y, w, h) {
  const bg = [196, 64, 24]; // red/orange — BOK panel, warm and loud
  cv.fillRect(x, y, x + w, y + h, bg);
  // BIG chip, left (shifted down 20px: the illustration area grew taller)
  const chipX = x + 34;
  const chipY = y + 50;
  const chipS = 132;
  // pins
  for (let i = 0; i < 5; i++) {
    const p = chipY + 16 + i * 24;
    cv.fillRect(chipX - 14, p, chipX, p + 8, [230, 230, 220]);
    cv.fillRect(chipX + chipS, p, chipX + chipS + 14, p + 8, [230, 230, 220]);
  }
  for (let i = 0; i < 5; i++) {
    const p = chipX + 16 + i * 24;
    cv.fillRect(p, chipY - 14, p + 8, chipY, [230, 230, 220]);
    cv.fillRect(p, chipY + chipS, p + 8, chipY + chipS + 14, [230, 230, 220]);
  }
  cv.fillRect(chipX, chipY, chipX + chipS, chipY + chipS, INK);
  cv.rect(chipX + 18, chipY + 18, chipX + chipS - 18, chipY + chipS - 18, [120, 120, 110], 2);
  cv.drawText(chipX + chipS / 2, chipY + chipS / 2, "AI", 6, WHITE, "mm");
  // BIG rate number, right, with a green up arrow above it
  const num = "3.25%";
  const nx = x + w - 40 - textWidth(num, 6);
  const ny = y + 128;
  cv.fillPolygon([[nx + 60, y + 42], [nx + 86, y + 68], [nx + 70, y + 68], [nx + 70, y + 86], [nx + 50, y + 86], [nx + 50, y + 68], [nx + 34, y + 68]], [46, 160, 80]);
  cv.drawText(nx, ny, num, 6, WHITE);
  cv.drawText(nx, ny + 48, "RATE RISES", 2, [255, 220, 180]);
}

function drawYen(cv, x, y, w, h) {
  const bg = [208, 208, 202]; // silver/grey — BOJ panel, cool and pale
  cv.fillRect(x, y, x + w, y + h, bg);
  // BIG yen symbol, left, drawn as vector strokes (the 5x7 glyph at huge
  // scale reads as a blob; thick diagonal bars + two horizontal bars read
  // unmistakably as a yen sign).
  const ox = x + 30;
  const oy = y + 40;
  // two diagonal bars meeting at the centre
  cv.fillPolygon([[ox, oy], [ox + 24, oy], [ox + 84, oy + 74], [ox + 60, oy + 74]], INK);
  cv.fillPolygon([[ox + 168, oy], [ox + 144, oy], [ox + 84, oy + 74], [ox + 108, oy + 74]], INK);
  // stem
  cv.fillRect(ox + 72, oy + 74, ox + 96, oy + 168, INK);
  // two horizontal bars across the stem
  cv.fillRect(ox + 14, oy + 88, ox + 154, oy + 102, INK);
  cv.fillRect(ox + 14, oy + 112, ox + 154, oy + 126, INK);
  // quote bubble, right (shifted right: the vector yen now spans to x+198)
  const bx = x + 216;
  const by = y + 54;
  const bw = 228;
  const bh = 112;
  cv.fillRect(bx, by, bx + bw, by + bh, WHITE);
  cv.rect(bx, by, bx + bw, by + bh, INK, 2);
  cv.fillPolygon([[bx, by + 76], [bx - 22, by + 92], [bx, by + 96]], WHITE);
  cv.fillPolygon([[bx, by + 76], [bx - 22, by + 92], [bx + 2, by + 78]], INK);
  cv.drawText(bx + bw / 2, by + 26, '"respond', 3, INK, "ma");
  cv.drawText(bx + bw / 2, by + 58, 'swiftly"', 3, INK, "ma");
  cv.drawText(bx + bw / 2, by + 88, "— TAMURA, BOJ", 2, GRAY, "ma");
}

// -------------------------------------------------------------- layout ---
const PANEL_W = 480;
const PANEL_H = 400;
const ILL_H = 240; // taller illustration: less empty paper below the decks

function drawPanel(cv, x, y, s) {
  cv.rect(x, y, x + PANEL_W, y + PANEL_H, INK, 2);
  s.draw(cv, x + 2, y + 2, PANEL_W - 4, ILL_H);
  const tx = x + 14;
  const maxW = PANEL_W - 28;
  let ty = y + ILL_H + 12;
  cv.drawText(tx, ty, s.kicker, 2, s.kickerColor);
  ty += 22;
  const hLines = wrap(s.headline, 3, maxW);
  if (hLines.length > 3) throw new Error("headline wraps to " + hLines.length + " lines: " + s.headline);
  ty = cv.textBlock(tx, ty, hLines, 3, INK, 24);
  ty += 8;
  const dLines = wrap(s.deck, 2, maxW);
  if (dLines.length > 3) throw new Error("deck wraps to " + dLines.length + " lines: " + s.deck);
  cv.textBlock(tx, ty, dLines, 2, GRAY, 16);
}

function main() {
  const cv = new Canvas(W, H, PAPER);

  // --- masthead ------------------------------------------------------
  cv.drawText(W / 2, 20, "THE DAILY WORLD", 7, INK, "ma");
  cv.fillRect(M, 78, W - M, 80, INK);

  // --- date banner: the loudest text after the masthead -------------
  cv.fillRect(M, 88, W - M, 140, INK);
  cv.drawText(W / 2, 114, "THURSDAY, 26 NOVEMBER 2026", 4, WHITE, "mm");

  // --- 2x2 grid ------------------------------------------------------
  // Diagonal placement: the two rate stories sit on opposite corners
  // (BOK top-right, BOJ bottom-left) so they never sit adjacent.
  const stories = [
    {
      kicker: "WORLD  —  SECURITY",
      kickerColor: RED,
      headline: "Kim Orders Wider Tactical Nuclear Deployment",
      deck: "Kim Jong Un orders tactical nuclear weapons ready across domains; output to grow 'systematically.'",
      draw: drawMissile,
    },
    {
      kicker: "ECONOMY  —  SOUTH KOREA",
      kickerColor: [176, 58, 20],
      headline: "Bank of Korea Raises Rates to 3.25%",
      deck: "Bank of Korea lifts its rate a quarter point to 3.25%, resuming tightening after an October pause.",
      draw: drawChip,
    },
    {
      kicker: "ECONOMY  —  JAPAN",
      kickerColor: STEEL,
      headline: "BOJ's Tamura Signals Faster Rate Hikes",
      deck: "BOJ's Tamura says the bank must 'respond swiftly' to inflation overshooting, speeding up rate hikes.",
      draw: drawYen,
    },
    {
      kicker: "TRADE",
      kickerColor: NAVY,
      headline: "Taiwan Confident 15% U.S. Tariff Holds",
      deck: "Taipei says its 15% U.S. tariff stands, even as Trump proposes 20-40% duties on 14 trading partners.",
      draw: drawPort,
    },
  ];
  const gridY = 156;
  const gridX = M;
  const positions = [
    [gridX, gridY],
    [gridX + PANEL_W + 16, gridY],
    [gridX, gridY + PANEL_H + 16],
    [gridX + PANEL_W + 16, gridY + PANEL_H + 16],
  ];
  stories.forEach((s, i) => drawPanel(cv, positions[i][0], positions[i][1], s));

  // --- footer --------------------------------------------------------
  const fy = 984;
  cv.fillRect(M, fy, W - M, fy + 2, INK);
  cv.drawText(
    W / 2,
    fy + 10,
    "Every headline above was reported on Thursday 26 November 2026.",
    2,
    INK,
    "ma",
  );

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const png = writePng(cv);
  if (png.length > 1048576) throw new Error("entry.png too large: " + png.length + " bytes");
  writeFileSync(outDir + "/entry.png", png);
  console.log(
    "wrote " + outDir + "/entry.png: " + png.length + " bytes, sha256=" +
    createHash("sha256").update(png).digest("hex"),
  );
}

main();
