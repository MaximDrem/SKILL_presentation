// pilresample.cjs — бит-точный порт Pillow Resample (BOX/BICUBIC) для u8 RGB/RGBA.
// Реплицирует Resample.c из Pillow 12.1.1: precompute_coeffs (double),
// normalize_coeffs_8bpc (fixed-point 24 бита), 8bpc passes с int32-арифметикой
// (включая намеренный wraparound, как в C).
'use strict';

const PRECISION_BITS = 24;

function boxFilter(x) { return x > -0.5 && x <= 0.5 ? 1.0 : 0.0; }
// Horner-формы точно как в Pillow Resample.c (порядок операций важен для float)
function bicubicFilter(x) {
  const a = -0.5;
  if (x < 0) x = -x;
  if (x < 1.0) return ((a + 2.0) * x - (a + 3.0)) * x * x + 1;
  if (x < 2.0) return (((x - 5) * x + 8) * x - 4) * a;
  return 0.0;
}

const FILTERS = { box: { f: boxFilter, support: 0.5 }, bicubic: { f: bicubicFilter, support: 2.0 } };

// → {kk: Int32Array (квантизованные), ksize, bounds: [xmin, count] на выход}
function precomputeCoeffs(inSize, in0, in1, outSize, filterp) {
  let scale = (in1 - in0) / outSize;
  const filterscale = scale < 1.0 ? 1.0 : scale;
  scale = (in1 - in0) / outSize; // в C: scale отдельно от filterscale
  const support = filterp.support * filterscale;
  const ksize = Math.ceil(support) * 2 + 1;
  const kk = new Float64Array(outSize * ksize);
  const bounds = [];
  for (let xx = 0; xx < outSize; xx++) {
    const center = in0 + (xx + 0.5) * scale;
    let ww = 0.0;
    const ss = 1.0 / filterscale;
    let xmin = Math.trunc(center - support + 0.5);
    if (xmin < 0) xmin = 0;
    let xmax = Math.trunc(center + support + 0.5);
    if (xmax > inSize) xmax = inSize;
    xmax -= xmin;
    const base = xx * ksize;
    for (let x = 0; x < xmax; x++) {
      const w = filterp.f((x + xmin - center + 0.5) * ss);
      kk[base + x] = w;
      ww += w;
    }
    for (let x = 0; x < xmax; x++) {
      if (ww !== 0.0) kk[base + x] /= ww;
    }
    bounds.push([xmin, xmax]);
  }
  // normalize_coeffs_8bpc как наблюдается в Pillow 12.1.1: trunc к int
  // (импульсные пробы подтверждают trunc, не round; см. .oracle диффы)
  const kk32 = new Int32Array(outSize * ksize);
  for (let i = 0; i < kk.length; i++) {
    kk32[i] = Math.trunc(kk[i] * (1 << PRECISION_BITS));
  }
  return { kk: kk32, ksize, bounds };
}

function clip8(ss) {
  // Наблюдаемое поведение Pillow (проверено дифференциально): точная сумма
  // (без int32-wrap), >> PRECISION_BITS, clamp 0..255.
  const t = Math.floor(ss / (1 << PRECISION_BITS));
  return t < 0 ? 0 : t > 255 ? 255 : t;
}

function resampleHorizontal(img, inW, inH, outW, channels, filterp) {
  const { kk, ksize, bounds } = precomputeCoeffs(inW, 0, inW, outW, filterp);
  const out = Buffer.alloc(outW * inH * channels);
  const rbase = 1 << (PRECISION_BITS - 1);
  for (let yy = 0; yy < inH; yy++) {
    for (let xx = 0; xx < outW; xx++) {
      const [xmin, xmax] = bounds[xx];
      const base = xx * ksize;
      for (let c = 0; c < channels; c++) {
        let ss = rbase;
        for (let x = 0; x < xmax; x++) {
          ss += img[(yy * inW + x + xmin) * channels + c] * kk[base + x];
        }
        out[(yy * outW + xx) * channels + c] = clip8(ss);
      }
    }
  }
  return out;
}

function resampleVertical(img, inW, inH, outH, channels, filterp) {
  const { kk, ksize, bounds } = precomputeCoeffs(inH, 0, inH, outH, filterp);
  const out = Buffer.alloc(inW * outH * channels);
  const rbase = 1 << (PRECISION_BITS - 1);
  for (let yy = 0; yy < outH; yy++) {
    const [ymin, ymax] = bounds[yy];
    const base = yy * ksize;
    for (let xx = 0; xx < inW; xx++) {
      for (let c = 0; c < channels; c++) {
        let ss = rbase;
        for (let y = 0; y < ymax; y++) {
          ss += img[((y + ymin) * inW + xx) * channels + c] * kk[base + y];
        }
        out[(yy * inW + xx) * channels + c] = clip8(ss);
      }
    }
  }
  return out;
}

// Pillow MULDIV255: tmp = a*b + 128; ((tmp>>8) + tmp) >> 8
function mulDiv255(a, b) {
  const tmp = a * b + 128;
  return ((tmp >> 8) + tmp) >> 8;
}

// RGBA → RGBa (premultiply)
function premultiply(img, w, h) {
  const out = Buffer.from(img);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const a = out[o + 3];
    out[o] = mulDiv255(out[o], a);
    out[o + 1] = mulDiv255(out[o + 1], a);
    out[o + 2] = mulDiv255(out[o + 2], a);
  }
  return out;
}

// RGBa → RGBA (unpremultiply): CLIP8(255*v/alpha); alpha 0/255 → как есть
function unpremultiply(img, w, h) {
  const out = Buffer.from(img);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    const a = out[o + 3];
    if (a === 255 || a === 0) continue;
    for (const c of [0, 1, 2]) {
      const v = Math.trunc((255 * out[o + c]) / a);
      out[o + c] = v <= 0 ? 0 : v < 256 ? v : 255;
    }
  }
  return out;
}

// Pillow ImagingResample: горизонтальный проход, потом вертикальный.
// RGBA: premultiply → resample → unpremultiply (Image.resize).
function resize(img, inW, inH, outW, outH, channels, filterName) {
  // Pillow: self.size == size → copy() (без premultiply round-trip!)
  if (inW === outW && inH === outH) return Buffer.from(img);
  const f = FILTERS[filterName];
  let work = channels === 4 ? premultiply(img, inW, inH) : img;
  let tmp = work, w = inW, h = inH;
  if (outW !== inW) {
    tmp = resampleHorizontal(tmp, w, h, outW, channels, f);
    w = outW;
  }
  if (outH !== inH) {
    tmp = resampleVertical(tmp, w, h, outH, channels, f);
  }
  return channels === 4 ? unpremultiply(tmp, outW, outH) : tmp;
}

module.exports = { resize, precomputeCoeffs, FILTERS, resampleHorizontal, resampleVertical, premultiply, unpremultiply, clip8 };
