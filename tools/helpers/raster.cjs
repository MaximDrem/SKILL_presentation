// raster.cjs — чисто-JS растровый слой: decode (png/jpg/gif/bmp), PNG encode,
// Pillow-точный resize (pilresample), convert("RGB"), композитинг, подписи,
// SVG rasterizer (polygon fill evenodd XOR), PIL-совместимый 1x1 average.
'use strict';
const fs = require("fs");
const path = require("path");
const { PNG } = require("../../vendor/pngjs");
const jpeg = require("../../vendor/jpeg-js");
const { resize } = require("./pilresample.cjs");
const { parseSvg } = require("./builder/svgshape.cjs");

// --- decode → {width, height, data: RGBA u8, mode} ---
function decodeImage(buf, ext) {
  ext = ext.toLowerCase();
  if (ext === "png") {
    let b = Buffer.from(buf);
    // Pillow/прочие писатели иногда оставляют хвост после IEND — обрезаем
    const iend = b.indexOf(Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]));
    if (iend >= 0 && iend + 8 < b.length) b = b.slice(0, iend + 8);
    const p = PNG.sync.read(b);
    return { width: p.width, height: p.height, data: Buffer.from(p.data), mode: "RGBA" };
  }
  if (ext === "jpg" || ext === "jpeg") {
    const j = jpeg.decode(Buffer.from(buf), { maxMemoryUsageInMB: 512 });
    return { width: j.width, height: j.height, data: Buffer.from(j.data), mode: "RGBA" };
  }
  if (ext === "bmp") {
    return decodeBmp(buf);
  }
  if (ext === "gif") {
    return decodeGif(buf);
  }
  throw new Error(`decodeImage: ${ext} не поддерживается`);
}

function decodeImageFile(p) {
  return decodeImage(fs.readFileSync(p), path.extname(p).slice(1));
}

// --- BMP (24/32-bit, без сжатия) ---
function decodeBmp(buf) {
  const data = Buffer.from(buf);
  const off = data.readUInt32LE(10);
  const w = data.readInt32LE(18);
  const hRaw = data.readInt32LE(22);
  const h = Math.abs(hRaw);
  const topDown = hRaw < 0;
  const bpp = data.readUInt16LE(28);
  const out = Buffer.alloc(w * h * 4);
  const rowSize = Math.floor((bpp * w + 31) / 32) * 4;
  for (let y = 0; y < h; y++) {
    const srcY = topDown ? y : h - 1 - y;
    for (let x = 0; x < w; x++) {
      const so = off + srcY * rowSize + x * (bpp / 8);
      const doff = (y * w + x) * 4;
      out[doff] = data[so + 2];     // R
      out[doff + 1] = data[so + 1]; // G
      out[doff + 2] = data[so];     // B
      out[doff + 3] = bpp === 32 ? data[so + 3] : 255;
    }
  }
  return { width: w, height: h, data: out, mode: "RGBA" };
}

// --- GIF (minimal LZW) ---
function decodeGif(buf) {
  const d = Buffer.from(buf);
  const w = d.readUInt16LE(6), h = d.readUInt16LE(8);
  const packed = d[10];
  const gctFlag = packed & 0x80;
  const gctSize = 2 << (packed & 7);
  let pos = 13;
  let gct = null;
  if (gctFlag) {
    gct = d.slice(pos, pos + gctSize * 3);
    pos += gctSize * 3;
  }
  // первый image descriptor
  while (d[pos] === 0x21) { // extension
    pos += 2 + d[pos + 1] + 1;
    // пропустить sub-blocks
    while (d[pos] !== 0) pos += 1 + d[pos];
    pos += 1;
  }
  if (d[pos] !== 0x2c) throw new Error("gif: no image descriptor");
  const ix = d.readUInt16LE(pos + 1), iy = d.readUInt16LE(pos + 3);
  const iw = d.readUInt16LE(pos + 5), ih = d.readUInt16LE(pos + 7);
  const ipacked = d[pos + 9];
  pos += 10;
  let ct = gct;
  if (ipacked & 0x80) {
    const sz = 2 << (ipacked & 7);
    ct = d.slice(pos, pos + sz * 3);
    pos += sz * 3;
  }
  if (!ct) throw new Error("gif: no color table");
  const minCode = d[pos];
  pos++;
  // собрать sub-blocks
  const chunks = [];
  while (d[pos] !== 0) {
    chunks.push(d.slice(pos + 1, pos + 1 + d[pos]));
    pos += 1 + d[pos];
  }
  const data = Buffer.concat(chunks);
  const idx = gifLzwDecode(data, minCode, iw * ih);
  const out = Buffer.alloc(w * h * 4);
  const transparent = -1; // (без GCE разбора — достаточно для decor thumbs)
  for (let y = 0; y < ih && iy + y < h; y++) {
    for (let x = 0; x < iw && ix + x < w; x++) {
      const ci = idx[y * iw + x];
      const o = ((iy + y) * w + (ix + x)) * 4;
      out[o] = ct[ci * 3];
      out[o + 1] = ct[ci * 3 + 1];
      out[o + 2] = ct[ci * 3 + 2];
      out[o + 3] = ci === transparent ? 0 : 255;
    }
  }
  return { width: w, height: h, data: out, mode: "RGBA" };
}

function gifLzwDecode(data, minCode, expected) {
  const clearCode = 1 << minCode;
  const eoiCode = clearCode + 1;
  let codeSize = minCode + 1;
  let dict = [];
  const out = [];
  let bitPos = 0;
  const readCode = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = data[bitPos >> 3];
      if (byte === undefined) return -1;
      code |= ((byte >> (bitPos & 7)) & 1) << i;
      bitPos++;
    }
    return code;
  };
  const resetDict = () => {
    dict = [];
    for (let i = 0; i < clearCode; i++) dict.push([i]);
    dict.push([]);
    dict.push([]);
  };
  resetDict();
  let prev = null;
  while (out.length < expected) {
    const code = readCode();
    if (code < 0 || code === eoiCode) break;
    if (code === clearCode) {
      resetDict();
      codeSize = minCode + 1;
      prev = null;
      continue;
    }
    let entry;
    if (code < dict.length && dict[code].length) {
      entry = dict[code];
    } else {
      entry = [...prev, prev[0]];
    }
    out.push(...entry);
    if (prev) {
      dict.push([...prev, entry[0]]);
      if (dict.length === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  return out.slice(0, expected);
}

// --- convert("RGB"): Pillow — RGBA→RGB отбрасывает альфу (каналы как есть) ---
function convertRGB(img) {
  const { width, height, data } = img;
  const out = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    out[i * 3] = data[i * 4];
    out[i * 3 + 1] = data[i * 4 + 1];
    out[i * 3 + 2] = data[i * 4 + 2];
  }
  return { width, height, data: out, channels: 3 };
}

// Pillow: im.convert("RGB").resize((1,1)).getpixel((0,0)) — default BICUBIC
function averageRgb(pathOrBuf, ext) {
  const buf = Buffer.isBuffer(pathOrBuf) ? pathOrBuf : fs.readFileSync(pathOrBuf);
  const realExt = ext || (typeof pathOrBuf === "string" ? path.extname(pathOrBuf).slice(1) : "png");
  const img = decodeImage(buf, realExt);
  const rgb = convertRGB(img);
  const one = resize(rgb.data, rgb.width, rgb.height, 1, 1, 3, "bicubic");
  return [one[0], one[1], one[2]];
}

// --- PNG encode ---
function encodePng(img) {
  let data = img.data;
  if (data.length === img.width * img.height * 3) {
    const rgba = Buffer.alloc(img.width * img.height * 4);
    for (let i = 0; i < img.width * img.height; i++) {
      rgba[i * 4] = data[i * 3];
      rgba[i * 4 + 1] = data[i * 3 + 1];
      rgba[i * 4 + 2] = data[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    data = rgba;
  }
  const p = new PNG({ width: img.width, height: img.height });
  p.data = Buffer.from(data);
  return PNG.sync.write(p);
}

// --- композитинг over (src over dst) ---
function compositeOver(dst, src, dx, dy) {
  const dw = dst.width, dh = dst.height;
  for (let y = 0; y < src.height; y++) {
    const yy = dy + y;
    if (yy < 0 || yy >= dh) continue;
    for (let x = 0; x < src.width; x++) {
      const xx = dx + x;
      if (xx < 0 || xx >= dw) continue;
      const so = (y * src.width + x) * 4;
      const doff = (yy * dw + xx) * 4;
      const sa = src.data[so + 3] / 255;
      for (const c of [0, 1, 2]) {
        const s = src.data[so + c], dd = dst.data[doff + c];
        const da = dst.data[doff + 3] / 255;
        // Pillow alpha_composite: out = src + dst*(1-sa) по альфа-взвешенной схеме
        const oa = sa + da * (1 - sa);
        dst.data[doff + c] = oa === 0 ? 0 : Math.min(255, Math.max(0, Math.round((s * sa + dd * da * (1 - sa)) / oa)));
      }
      const sa2 = src.data[so + 3], da2 = dst.data[doff + 3];
      dst.data[doff + 3] = Math.min(255, sa2 + Math.round(da2 * (255 - sa2) / 255));
    }
  }
}

module.exports = {
  decodeImage, decodeImageFile, convertRGB, averageRgb, encodePng, compositeOver,
};

// --- ImageStat: mean/stddev по каналам (PIL ImageStat.Stat — population) ---
function imageStat(img, x0, y0, x1, y1) {
  const { width, data } = img;
  const channels = img.channels || 4;
  const n = (x1 - x0) * (y1 - y0);
  const sum = [0, 0, 0, 0];
  const sum2 = [0, 0, 0, 0];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * width + x) * channels;
      for (let c = 0; c < Math.min(channels, 3); c++) {
        const v = data[o + c];
        sum[c] += v;
        sum2[c] += v * v;
      }
    }
  }
  const mean = sum.map((s) => s / n);
  const stddev = sum2.map((s2, c) => {
    const v = s2 / n - mean[c] * mean[c];
    return Math.sqrt(Math.abs(v));
  });
  return { mean, stddev };
}

function crop(img, x0, y0, x1, y1) {
  const channels = img.channels || 4;
  const w = x1 - x0, h = y1 - y0;
  const out = Buffer.alloc(w * h * channels);
  for (let y = 0; y < h; y++) {
    img.data.copy(out, y * w * channels, (y0 + y) * img.width * channels + x0 * channels, (y0 + y) * img.width * channels + x1 * channels);
  }
  return { width: w, height: h, data: out, channels };
}

// PIL thumbnail: точная геометрия (aspect + round_aspect), пиксели — resample.
function thumbnailSize(w, h, maxW, maxH) {
  let x = Math.floor(maxW), y = Math.floor(maxH);
  if (x >= w && y >= h) return [w, h];
  const aspect = w / h;
  const roundAspect = (number, key) => {
    const fl = Math.floor(number), ce = Math.ceil(number);
    const pick = Math.abs(key(fl)) <= Math.abs(key(ce)) ? fl : ce;
    return Math.max(pick, 1);
  };
  if (x / y >= aspect) {
    x = roundAspect(y * aspect, (n) => Math.abs(aspect - n / y));
  } else {
    y = roundAspect(x / aspect, (n) => (n === 0 ? 0 : Math.abs(aspect - x / n)));
  }
  return [x, y];
}

// paste src в dst в позиции (dx,dy); если mask — альфа-бленд (PIL paste с mask)
function paste(dst, src, dx, dy, useMask) {
  const dc = dst.channels || 4, sc = src.channels || 4;
  for (let y = 0; y < src.height; y++) {
    const yy = dy + y;
    if (yy < 0 || yy >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const xx = dx + x;
      if (xx < 0 || xx >= dst.width) continue;
      const so = (y * src.width + x) * sc;
      const doff = (yy * dst.width + xx) * dc;
      if (useMask && sc === 4) {
        const a = src.data[so + 3] / 255;
        for (let c = 0; c < Math.min(3, dc); c++) {
          dst.data[doff + c] = Math.round(src.data[so + c] * a + dst.data[doff + c] * (1 - a));
        }
        if (dc === 4) {
          dst.data[doff + 3] = Math.min(255, src.data[so + 3] + Math.round(dst.data[doff + 3] * (1 - a)));
        }
      } else {
        for (let c = 0; c < dc; c++) dst.data[doff + c] = src.data[so + (sc === 4 && c === 3 ? 3 : c)];
      }
    }
  }
}

function newImage(w, h, rgb, channels = 3) {
  const data = Buffer.alloc(w * h * channels);
  for (let i = 0; i < w * h; i++) {
    data[i * channels] = rgb[0];
    data[i * channels + 1] = rgb[1];
    data[i * channels + 2] = rgb[2];
    if (channels === 4) data[i * channels + 3] = rgb.length > 3 ? rgb[3] : 255;
  }
  return { width: w, height: h, data, channels };
}

function rectOutline(img, x0, y0, x1, y1, rgb, widthPx = 1) {
  for (let b = 0; b < widthPx; b++) {
    for (let x = x0 + b; x <= x1 - b; x++) {
      setPx(img, x, y0 + b, rgb);
      setPx(img, x, y1 - b, rgb);
    }
    for (let y = y0 + b; y <= y1 - b; y++) {
      setPx(img, x0 + b, y, rgb);
      setPx(img, x1 - b, y, rgb);
    }
  }
}

function rectFill(img, x0, y0, x1, y1, rgb) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setPx(img, x, y, rgb);
}

function setPx(img, x, y, rgb) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const o = (y * img.width + x) * (img.channels || 4);
  img.data[o] = rgb[0];
  img.data[o + 1] = rgb[1];
  img.data[o + 2] = rgb[2];
  if ((img.channels || 4) === 4 && rgb.length > 3) img.data[o + 3] = rgb[3];
}

const { textWidth, drawText } = require("./font5x7.cjs");

// --- decor_thumbs ---
function decorThumbs(files, dstDir, { gridCols = 4, gridRows = 4, cell = 400 } = {}) {
  const dst = dstDir;
  for (const old of fs.readdirSync(dst).filter((f) => /^decor-thumbs(-\d+)?\.png$/.test(f))) {
    fs.unlinkSync(path.join(dst, old));
  }
  const per = gridCols * gridRows;
  const PAD = 12, LABEL_H = 32;
  const names = [];
  for (let g = 0; g < files.length; g += per) {
    const batch = files.slice(g, g + per);
    const rows = Math.ceil(batch.length / gridCols);
    const W = gridCols * cell + (gridCols + 1) * PAD;
    const H = rows * (cell + LABEL_H) + (rows + 1) * PAD;
    const canvas = newImage(W, H, [205, 205, 205], 3);
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      let p, label;
      if (Array.isArray(item)) [p, label] = item;
      else [p, label] = [item, null];
      const cx = PAD + (i % gridCols) * (cell + PAD);
      const cy = PAD + Math.floor(i / gridCols) * (cell + LABEL_H + PAD);
      const text = label || path.basename(String(p));
      try {
        let im = Buffer.isBuffer(p) || (p && p.data) ? p : decodeImageFile(p);
        if (im.channels !== 4 || im.data.length !== im.width * im.height * 4) {
          // привести к RGBA
          const src = im.channels === 3 ? im : null;
          if (src) {
            const rgba = newImage(src.width, src.height, [0, 0, 0, 255], 4);
            for (let j = 0; j < src.width * src.height; j++) {
              rgba.data[j * 4] = src.data[j * 3];
              rgba.data[j * 4 + 1] = src.data[j * 3 + 1];
              rgba.data[j * 4 + 2] = src.data[j * 3 + 2];
              rgba.data[j * 4 + 3] = 255;
            }
            im = rgba;
          }
        }
        const [tw, th] = thumbnailSize(im.width, im.height, cell - 8, cell - 8);
        if (tw !== im.width || th !== im.height) {
          im = { width: tw, height: th, data: resize(im.data, im.width, im.height, tw, th, 4, "bicubic"), channels: 4 };
        }
        const tile = newImage(cell, cell, [205, 205, 205, 255], 4);
        paste(tile, im, Math.floor((cell - tw) / 2), Math.floor((cell - th) / 2), true);
        // tile.convert("RGB") → paste
        const tileRgb = convertRGB(tile);
        paste(canvas, { ...tileRgb, channels: 3 }, cx, cy, false);
      } catch {
        rectOutline(canvas, cx, cy, cx + cell, cy + cell, [150, 150, 150]);
      }
      const twTxt = textWidth(text, 2);
      const bw = Math.trunc(twTxt) + 16;
      rectFill(canvas, cx, cy, cx + bw, cy + 26, [255, 255, 255]);
      rectOutline(canvas, cx, cy, cx + bw, cy + 26, [60, 60, 60]);
      drawText(canvas, cx + 8, cy + 5, text, [0, 0, 0], 2);
      rectOutline(canvas, cx, cy, cx + cell, cy + cell + LABEL_H, [90, 90, 90], 2);
      rectFill(canvas, cx, cy + cell, cx + cell, cy + cell + LABEL_H, [232, 232, 232]);
      rectOutline(canvas, cx, cy + cell, cx + cell, cy + cell + LABEL_H, [90, 90, 90]);
      drawText(canvas, cx + Math.max(2, Math.floor((cell - twTxt) / 2)), cy + cell + 6, text, [20, 20, 20], 2);
    }
    const name = g === 0 && g + per >= files.length ? "decor-thumbs.png" : `decor-thumbs-${Math.floor(g / per) + 1}.png`;
    fs.writeFileSync(path.join(dst, name), encodePng({ width: canvas.width, height: canvas.height, data: canvas.data }));
    names.push(name);
  }
  return names;
}

// --- crop_viewport_strips ---
function cropViewportStrips(shots, px = 8) {
  let fixed = 0;
  for (const p of shots) {
    let im;
    try {
      im = decodeImageFile(p);
    } catch {
      continue;
    }
    const rgb = convertRGB(im);
    const w = rgb.width, h = rgb.height;
    const right = crop(rgb, w - px, 0, w, h - px);
    const bottom = crop(rgb, 0, h - px, w - px, h);
    const flat = (region, lo = 120, hi = 255) => {
      const st = imageStat(region, 0, 0, region.width, region.height);
      return st.stddev.slice(0, 3).every((s) => s < 6) && st.mean.slice(0, 3).every((m) => lo < m && m <= hi);
    };
    const nw = flat(right) ? w - px : w;
    const nh = flat(bottom) ? h - px : h;
    if (nw !== w || nh !== h) {
      const cropped = crop(rgb, 0, 0, nw, nh);
      const rgba = newImage(nw, nh, [0, 0, 0, 255], 4);
      for (let i = 0; i < nw * nh; i++) {
        rgba.data[i * 4] = cropped.data[i * 3];
        rgba.data[i * 4 + 1] = cropped.data[i * 3 + 1];
        rgba.data[i * 4 + 2] = cropped.data[i * 3 + 2];
        rgba.data[i * 4 + 3] = 255;
      }
      fs.writeFileSync(p, encodePng(rgba));
      fixed += 1;
    }
  }
  return fixed;
}

// --- thumbs_from_shots ---
function thumbsFromShots(shots, dstDir, { gridCols = 4, gridRows = 4, tileW = 480, prefix = "thumbs" } = {}) {
  for (const old of fs.readdirSync(dstDir).filter((f) => f.startsWith(prefix) && f.endsWith(".png"))) {
    fs.unlinkSync(path.join(dstDir, old));
  }
  const COLS = gridCols, ROWS = gridRows, TW = tileW, PAD = 20, BORDER = 2;
  const per = COLS * ROWS;
  const files = [];
  for (let g = 0; g < shots.length; g += per) {
    const batch = shots.slice(g, g + per);
    const first = decodeImageFile(batch[0]);
    const TH = Math.round(TW * first.height / first.width);
    const LABEL_H = 34;
    const rowH = LABEL_H + TH;
    const rows = Math.ceil(batch.length / COLS);
    const W = COLS * TW + (COLS + 1) * PAD;
    const H = rows * rowH + (rows + 1) * PAD;
    const canvas = newImage(W, H, [255, 255, 255], 3);
    for (let i = 0; i < batch.length; i++) {
      let img = convertRGB(decodeImageFile(batch[i]));
      const [nw, nh] = thumbnailSize(img.width, img.height, TW, TH);
      if (nw !== img.width || nh !== img.height) {
        img = { width: nw, height: nh, data: resize(img.data, img.width, img.height, nw, nh, 3, "box"), channels: 3 };
      }
      const col = i % COLS, row = Math.floor(i / COLS);
      const x0 = col * TW + (col + 1) * PAD;
      const y0 = row * rowH + (row + 1) * PAD;
      const label = path.basename(batch[i]).replace(/\.[^.]+$/, "");
      const tw = textWidth(label, 2);
      drawText(canvas, x0 + Math.max(0, Math.floor((TW - tw) / 2)), y0 + 10, label, [0, 0, 0], 2);
      const ty = y0 + LABEL_H, tx = x0 + Math.floor((TW - img.width) / 2);
      paste(canvas, img, tx, ty, false);
      for (let bb = 0; bb < BORDER; bb++) {
        rectOutline(canvas, tx - 1 - bb, ty - 1 - bb, tx + img.width + bb, ty + img.height + bb, [128, 128, 128]);
      }
    }
    const name = shots.length <= per ? `${prefix}.png` : `${prefix}-${Math.floor(g / per) + 1}.png`;
    fs.writeFileSync(path.join(dstDir, name), encodePng({ width: canvas.width, height: canvas.height, data: canvas.data }));
    files.push(name);
  }
  return files;
}

// --- rasterize_svg: SVG path → RGBA (порт render.py::rasterize_svg) ---
const SVG_ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function _sampleCubic(p0, p1, p2, p3, n = 24) {
  const pts = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    pts.push([
      mt ** 3 * p0[0] + 3 * mt ** 2 * t * p1[0] + 3 * mt * t ** 2 * p2[0] + t ** 3 * p3[0],
      mt ** 3 * p0[1] + 3 * mt ** 2 * t * p1[1] + 3 * mt * t ** 2 * p2[1] + t ** 3 * p3[1],
    ]);
  }
  return pts;
}

function _fillPolygon(mask, w, h, pts, scale, vx, vy) {
  // scanline even-odd-ish заливка (PIL polygon: even-odd по правилу точности точек)
  const q = pts.map(([x, y]) => [(x - vx) * scale, (y - vy) * scale]);
  if (q.length < 3) return;
  const n = q.length;
  for (let y = 0; y < h; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = q[i];
      const [x2, y2] = q[(i + 1) % n];
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) {
        xs.push(x1 + (yc - y1) / (y2 - y1) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.max(0, Math.ceil(xs[i] - 0.5));
      const xb = Math.min(w - 1, Math.floor(xs[i + 1] - 0.5));
      for (let x = xa; x <= xb; x++) mask[y * w + x] ^= 1;
    }
  }
}

function rasterizeSvg(svgPath, px = 160) {
  const text = fs.readFileSync(svgPath, "utf8");
  const { parseXml, docRoot } = require("./xml.cjs");
  const { El } = require("./xml.cjs");
  const root = docRoot(parseXml(text));
  const vbAttr = root.attrs.get("viewBox") || "0 0 100 100";
  const vb = vbAttr.trim().split(/[\s,]+/).map(parseFloat);
  const [vx, vy, vw, vh] = vb.slice(0, 4);
  const scale = px / Math.max(vw, vh);
  const W = Math.max(1, Math.round(vw * scale)), H = Math.max(1, Math.round(vh * scale));
  const img = newImage(W, H, [0, 0, 0, 0], 4);
  // css .class{fill:#hex}
  const css = {};
  for (const n of root.iter()) {
    if (!(n instanceof El)) continue;
    if (n.local === "style") {
      const txt = n.children.filter((c) => typeof c === "string").join("");
      for (const m of txt.matchAll(/\.([\w-]+)\s*\{[^}]*?fill\s*:\s*(#[0-9A-Fa-f]{3,8})/g)) {
        css[m[1]] = m[2];
      }
    }
  }
  const hexToRgba = (fill) => {
    const h = fill.replace("#", "");
    const v = h.length <= 4 ? [...h].map((c) => parseInt(c + c, 16)) : [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2) || "ff", 16));
    return [v[0], v[1], v[2], h.length === 8 ? v[3] : h.length === 4 ? v[3] : 255];
  };
  for (const p of root.iter()) {
    if (!(p instanceof El) || p.local !== "path") continue;
    const d = p.attrs.get("d") || "";
    const fill = p.attrs.get("fill") || css[p.attrs.get("class") || ""] || "#000000";
    if (fill === "none") continue;
    const rgba = hexToRgba(fill);
    const toks = d.match(/[MLHVCSQTAZmlhvcsqtaz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    let i = 0, cur = [0, 0], start = [0, 0];
    let subs = [], pts = [], prevCtrl = null, cmd = null;
    const num = () => parseFloat(toks[i++]);
    while (i < toks.length) {
      const t = toks[i];
      if (/^[MLHVCSQTAZmlhvcsqtaz]$/.test(t)) {
        cmd = t;
        i++;
      }
      if (cmd === null) { i++; continue; }
      const rel = cmd === cmd.toLowerCase();
      const C = cmd.toUpperCase();
      if (C === "Z") {
        pts.push(start);
        subs.push(pts);
        pts = [];
        cmd = null;
        continue;
      }
      const nn = SVG_ARITY[C];
      if (i + nn > toks.length) break;
      const vals = [];
      for (let j = 0; j < nn; j++) vals.push(num());
      if (C === "M") {
        let [x, y] = vals;
        if (rel) { x += cur[0]; y += cur[1]; }
        if (pts.length) subs.push(pts);
        cur = [x, y]; start = [x, y];
        pts = [[x, y]];
        cmd = rel ? "l" : "L";
        continue;
      }
      if (C === "L") {
        let [x, y] = vals;
        if (rel) { x += cur[0]; y += cur[1]; }
        cur = [x, y]; pts.push(cur);
      } else if (C === "H") {
        const x = vals[0] + (rel ? cur[0] : 0);
        cur = [x, cur[1]]; pts.push(cur);
      } else if (C === "V") {
        const y = vals[0] + (rel ? cur[1] : 0);
        cur = [cur[0], y]; pts.push(cur);
      } else if (C === "C") {
        let [x1, y1, x2, y2, x, y] = vals;
        if (rel) { x1 += cur[0]; y1 += cur[1]; x2 += cur[0]; y2 += cur[1]; x += cur[0]; y += cur[1]; }
        pts.push(..._sampleCubic(cur, [x1, y1], [x2, y2], [x, y]));
        prevCtrl = [x2, y2];
        cur = [x, y];
      } else if (C === "S") {
        let [x2, y2, x, y] = vals;
        if (rel) { x2 += cur[0]; y2 += cur[1]; x += cur[0]; y += cur[1]; }
        const [x1, y1] = prevCtrl ? [2 * cur[0] - prevCtrl[0], 2 * cur[1] - prevCtrl[1]] : cur;
        pts.push(..._sampleCubic(cur, [x1, y1], [x2, y2], [x, y]));
        prevCtrl = [x2, y2];
        cur = [x, y];
      } else if (C === "Q" || C === "T") {
        let x1, y1, x, y;
        if (C === "Q") {
          [x1, y1, x, y] = vals;
          if (rel) { x1 += cur[0]; y1 += cur[1]; x += cur[0]; y += cur[1]; }
          prevCtrl = [x1, y1];
        } else {
          [x, y] = vals;
          if (rel) { x += cur[0]; y += cur[1]; }
          [x1, y1] = prevCtrl ? [2 * cur[0] - prevCtrl[0], 2 * cur[1] - prevCtrl[1]] : cur;
          prevCtrl = [x1, y1];
        }
        const mx = (cur[0] + 2 * x1) / 3, my = (cur[1] + 2 * y1) / 3;
        const cx = (x + 2 * x1) / 3, cy = (y + 2 * y1) / 3;
        pts.push(..._sampleCubic(cur, [mx, my], [cx, cy], [x, y]));
        cur = [x, y];
      } else if (C === "A") {
        let x = vals[5], y = vals[6];
        if (rel) { x += cur[0]; y += cur[1]; }
        pts.push([x, y]);
        cur = [x, y];
      }
      prevCtrl = ["C", "S", "Q", "T"].includes(C) ? prevCtrl : null;
    }
    if (pts.length) subs.push(pts);
    const mask = new Uint8Array(W * H);
    for (const sp of subs) _fillPolygon(mask, W, H, sp, scale, vx, vy);
    if (mask.some((v) => v)) {
      for (let j = 0; j < W * H; j++) {
        if (mask[j]) {
          const o = j * 4;
          const sa = rgba[3] / 255;
          img.data[o] = Math.round(rgba[0] * sa + img.data[o] * (1 - sa));
          img.data[o + 1] = Math.round(rgba[1] * sa + img.data[o + 1] * (1 - sa));
          img.data[o + 2] = Math.round(rgba[2] * sa + img.data[o + 2] * (1 - sa));
          img.data[o + 3] = Math.min(255, rgba[3] + Math.round(img.data[o + 3] * (1 - sa)));
        }
      }
    }
  }
  return img;
}

module.exports = Object.assign(module.exports, {
  imageStat, crop, thumbnailSize, paste, newImage, decorThumbs, cropViewportStrips,
  thumbsFromShots, rasterizeSvg, rectFill, rectOutline, setPx,
});
