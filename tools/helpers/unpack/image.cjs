// image.cjs — размер/альфа растровых заголовков (порт unpack/image.py v3.2.1).
'use strict';

const u32be = (b, o) => b.readUInt32BE(o);
const u16be = (b, o) => b.readUInt16BE(o);
const u16le = (b, o) => b.readUInt16LE(o);
const u32le = (b, o) => b.readUInt32LE(o);
const ascii = (b, o, n) => b.toString("ascii", o, o + n);

function imageInfo(buf, ext) {
  try {
    if (ext === "png" && buf.length > 33 && u32be(buf, 0) === 0x89504e47) {
      const ctype = buf[25];
      let trns = false;
      let o = 8;
      while (o + 12 <= buf.length) {
        const ln = u32be(buf, o);
        const typ = ascii(buf, o + 4, 4);
        if (typ === "tRNS") { trns = true; break; }
        if (typ === "IDAT") break;
        o += 12 + ln;
      }
      return { format: "png", width: u32be(buf, 16), height: u32be(buf, 20), alpha: [4, 6].includes(ctype) || trns };
    }
    if ((ext === "jpg" || ext === "jpeg") && buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let o = 2;
      while (o + 9 < buf.length) {
        if (buf[o] !== 0xff) { o += 1; continue; }
        const marker = buf[o + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { format: "jpeg", width: u16be(buf, o + 7), height: u16be(buf, o + 5), alpha: false };
        }
        o += 2 + u16be(buf, o + 2);
      }
      return { format: "jpeg", width: null, height: null, alpha: false };
    }
    if (ext === "gif" && buf.length > 13 && ascii(buf, 0, 3) === "GIF") {
      let alpha = false;
      let o = 13;
      while (o + 6 < buf.length) {
        if (buf[o] === 0x21 && buf[o + 1] === 0xf9 && buf[o + 2] === 0x04) {
          alpha = !!(buf[o + 3] & 1);
          break;
        }
        if (buf[o] === 0x2c) break;
        o += 1;
      }
      return { format: "gif", width: u16le(buf, 6), height: u16le(buf, 8), alpha };
    }
    if (ext === "webp" && buf.length > 30 && ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 4) === "WEBP") {
      const fourcc = ascii(buf, 12, 4);
      if (fourcc === "VP8X") {
        return { format: "webp", width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
                 height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)), alpha: !!(buf[20] & 0x10) };
      }
      if (fourcc === "VP8L" && buf[20] === 0x2f) {
        const bits = u32le(buf, 21);
        return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, alpha: !!((bits >> 28) & 1) };
      }
      if (fourcc === "VP8 " && buf.length > 30) {
        return { format: "webp", width: u16le(buf, 26) & 0x3fff, height: u16le(buf, 28) & 0x3fff, alpha: false };
      }
      return { format: "webp", width: null, height: null, alpha: false };
    }
    if (ext === "bmp" && buf.length > 30 && ascii(buf, 0, 2) === "BM") {
      return { format: "bmp", width: buf.readInt32LE(18), height: Math.abs(buf.readInt32LE(22)), alpha: u16le(buf, 28) === 32 };
    }
    if (ext === "svg") {
      const s = buf.toString("utf8", 0, 4096);
      const w = /\bwidth="([\d.]+)/.exec(s);
      const h = /\bheight="([\d.]+)/.exec(s);
      const vb = /viewBox="([\d.\s-]+)"/.exec(s);
      let width = w ? parseFloat(w[1]) : null;
      let height = h ? parseFloat(h[1]) : null;
      if ((!width || !height) && vb) {
        const p = vb[1].trim().split(/[\s,]+/);
        width = width || parseFloat(p[2]);
        height = height || parseFloat(p[3]);
      }
      return { format: "svg", width, height, alpha: true };
    }
  } catch {
    // fallthrough
  }
  return { format: ext, width: null, height: null, alpha: false };
}

module.exports = { imageInfo };
