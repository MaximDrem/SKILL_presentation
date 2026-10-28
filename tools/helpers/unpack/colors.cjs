// colors.cjs — цвета/заливки unpack (порт unpack/colors.py v3.2.1).
'use strict';
const { _jsRound, _num, attrsOf, first, kidOf, kidsOf, r1, r2, tagOf } = require("./ooxml.cjs");

function hexToRgb(h) {
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(rgb) {
  const c = (v) => Math.max(0, Math.min(255, _jsRound(v))).toString(16).padStart(2, "0");
  return (c(rgb[0]) + c(rgb[1]) + c(rgb[2])).toUpperCase();
}

function rgbToHsl(rgb) {
  const [r, g, b] = rgb.map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(hsl) {
  const [h, s, l] = hsl;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t); // oracle v3.2.1: без ×6 (colorsys-вариант в SKILL_WORK)
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}

function _modOf(colorNode, tag) {
  const m = kidOf(colorNode, "a:" + tag);
  const v = m !== null ? attrsOf(m).val : undefined;
  return v !== undefined && v !== null ? parseFloat(v) / 100000 : null;
}

function applyColorMods(hexv, colorNode) {
  let [h, s, l] = rgbToHsl(hexToRgb(hexv));
  const lumMod = _modOf(colorNode, "lumMod");
  const lumOff = _modOf(colorNode, "lumOff");
  const shade = _modOf(colorNode, "shade");
  const tint = _modOf(colorNode, "tint");
  if (lumMod !== null) l *= lumMod;
  if (lumOff !== null) l += lumOff;
  if (shade !== null) l *= shade;
  if (tint !== null) l = l * tint + (1 - tint);
  l = Math.max(0, Math.min(1, l));
  if (lumMod !== null || lumOff !== null || shade !== null || tint !== null) {
    return rgbToHex(hslToRgb([h, s, l]));
  }
  return hexv;
}

const PRST_CLR = (() => {
  const toks = ("aliceBlue F0F8FF antiqueWhite FAEBD7 aqua 00FFFF aquamarine 7FFFD4 azure F0FFFF beige F5F5DC " +
    "bisque FFE4C4 black 000000 blanchedAlmond FFEBCD blue 0000FF blueViolet 8A2BE2 brown A52A2A " +
    "burlyWood DEB887 cadetBlue 5F9EA0 chartreuse 7FFF00 chocolate D2691E coral FF7F50 cornflowerBlue 6495ED " +
    "cornsilk FFF8DC crimson DC143C cyan 00FFFF darkBlue 00008B darkCyan 008B8B darkGoldenrod B8860B " +
    "darkGray A9A9A9 darkGreen 006400 darkKhaki BDB76B darkMagenta 8B008B darkOliveGreen 556B2F " +
    "darkOrange FF8C00 darkOrchid 9932CC darkRed 8B0000 darkSalmon E9967A darkSeaGreen 8FBC8F " +
    "darkSlateBlue 483D8B darkSlateGray 2F4F4F darkTurquoise 00CED1 darkViolet 9400D3 deepPink FF1493 " +
    "deepSkyBlue 00BFFF dimGray 696969 dodgerBlue 1E90FF firebrick B22222 floralWhite FFFAF0 forestGreen 228B22 " +
    "fuchsia FF00FF gainsboro DCDCDC ghostWhite F8F8FF gold FFD700 goldenrod DAA520 gray 808080 green 008000 " +
    "greenYellow ADFF2F honeydew F0FFF0 hotPink FF69B4 indianRed CD5C5C indigo 4B0082 ivory FFFFF0 khaki F0E68C " +
    "lavender E6E6FA lavenderBlush FFF0F5 lawnGreen 7CFC00 lemonChiffon FFFACD lightBlue ADD8E6 lightCoral F08080 " +
    "lightCyan E0FFFF lightGoldenrodYellow FAFAD2 lightGray D3D3D3 lightGreen 90EE90 lightPink FFB6C1 " +
    "lightSalmon FFA07A lightSeaGreen 20B2AA lightSkyBlue 87CEFA lightSlateGray 778899 lightSteelBlue B0C4DE " +
    "lightYellow FFFFE0 lime 00FF00 limeGreen 32CD32 linen FAF0E6 magenta FF00FF maroon 800000 " +
    "mediumAquamarine 66CDAA mediumBlue 0000CD mediumOrchid BA55D3 mediumPurple 9370DB mediumSeaGreen 3CB371 " +
    "mediumSlateBlue 7B68EE mediumSpringGreen 00FA9A mediumTurquoise 48D1CC mediumVioletRed C71585 " +
    "midnightBlue 191970 mintCream F5FFFA mistyRose FFE4E1 moccasin FFE4B5 navajoWhite FFDEAD navy 000080 " +
    "oldLace FDF5E6 olive 808000 oliveDrab 6B8E23 orange FFA500 orangeRed FF4500 orchid DA70D6 " +
    "paleGoldenrod EEE8AA paleGreen 98FB98 paleTurquoise AFEEEE paleVioletRed DB7093 papayaWhip FFEFD5 " +
    "peachPuff FFDAB9 peru CD853F pink FFC0CB plum DDA0DD powderBlue B0E0E6 purple 800080 red FF0000 " +
    "rosyBrown BC8F8F royalBlue 4169E1 saddleBrown 8B4513 salmon FA8072 sandyBrown F4A460 seaGreen 2E8B57 " +
    "seaShell FFF5EE sienna A0522D silver C0C0C0 skyBlue 87CEEB slateBlue 6A5ACD slateGray 708090 snow FFFAFA " +
    "springGreen 00FF7F steelBlue 4682B4 tan D2B48C teal 008080 thistle D8BFD8 tomato FF6347 turquoise 40E0D0 " +
    "violet EE82EE wheat F5DEB3 white FFFFFF whiteSmoke F5F5F5 yellow FFFF00 yellowGreen 9ACD32").split(/\s+/);
  const out = {};
  for (let i = 0; i < toks.length; i += 2) out[toks[i].toLowerCase()] = toks[i + 1];
  return out;
})();

function parseColor(fillNode, clrMap, theme) {
  const colorNode = first(kidOf(fillNode, "a:srgbClr"), kidOf(fillNode, "a:schemeClr"),
                          kidOf(fillNode, "a:sysClr"), kidOf(fillNode, "a:prstClr"));
  if (colorNode === null) return null;
  const tag = tagOf(colorNode);
  const a = attrsOf(colorNode);
  const alphaN = kidOf(colorNode, "a:alpha");
  const alphaV = alphaN !== null ? attrsOf(alphaN).val : undefined;
  const alpha = alphaV !== undefined && alphaV !== null ? parseFloat(alphaV) / 100000 : 1;
  let hexv = null;
  let ref = null;
  if (tag === "a:srgbClr") {
    const v = a.val || "";
    if (/^[0-9A-Fa-f]{6}$/.test(v)) hexv = v.toUpperCase();
  } else if (tag === "a:sysClr") {
    const v = a.lastClr || "";
    if (/^[0-9A-Fa-f]{6}$/.test(v)) hexv = v.toUpperCase();
  } else if (tag === "a:schemeClr") {
    ref = a.val;
    const t = theme[(clrMap[ref] !== undefined ? clrMap[ref] : ref)];
    if (t) hexv = t;
  } else if (tag === "a:prstClr") {
    hexv = PRST_CLR[(a.val || "").toLowerCase()];
    if (!hexv) return { prst: a.val };
  }
  if (!hexv) return ref ? { scheme: ref } : null;
  hexv = applyColorMods(hexv, colorNode);
  const aHex = alpha >= 1 ? "" : _jsRound(alpha * 255).toString(16).padStart(2, "0").toUpperCase();
  const out = { hex: "#" + hexv + aHex };
  if (ref) out.scheme = ref;
  return out;
}

function parseGradXml(gradFillNode, clrMap, theme) {
  const gsLst = kidOf(gradFillNode, "a:gsLst");
  const stops = kidsOf(gsLst, "a:gs").map((gs) => ({
    pos: parseFloat(attrsOf(gs).pos ?? 0) / 100000,
    color: parseColor(gs, clrMap, theme),
  }));
  const lin = kidOf(gradFillNode, "a:lin");
  const ang = lin !== null ? attrsOf(lin).ang : undefined;
  return { angle: ang !== undefined && ang !== null ? r2(parseFloat(ang) / 60000) : null, stops };
}

function parseShadow(spPrNode, clrMap, theme, k) {
  const effectLst = kidOf(spPrNode, "a:effectLst");
  const m = effectLst !== null ? kidOf(effectLst, "a:outerShdw") : null;
  if (m === null) return null;
  const a = attrsOf(m);
  const blur = a.blurRad !== undefined && a.blurRad !== null ? r1(parseFloat(a.blurRad) * k) : 0;
  const dist = a.dist !== undefined && a.dist !== null ? r1(parseFloat(a.dist) * k) : 0;
  const dir_ = a.dir !== undefined && a.dir !== null ? r2(parseFloat(a.dir) / 60000) : 0;
  const c = parseColor(m, clrMap, theme);
  const out = { blur, dist, dir: dir_ };
  if (c && c.hex) out.color = c.hex;
  out.token = blur <= 24 && dist <= 6 ? "soft" : "lift";
  return out;
}

function parseLn(spPrNode, clrMap, theme) {
  const m = kidOf(spPrNode, "a:ln");
  if (m === null) return null;
  const a = attrsOf(m);
  const solid = kidOf(m, "a:solidFill");
  const c = solid !== null ? parseColor(solid, clrMap, theme) : null;
  if (!a.w && !c) return null;
  const out = {};
  if (a.w) out.w = r1(parseFloat(a.w) / 9525);
  if (c && c.hex) out.color = c.hex;
  return out;
}

function geoFacts(b) {
  if (!b) return {};
  const [x, y, w, h] = b;
  const out = {};
  if (x < -0.5 || y < -0.5 || x + w > 1280.5 || y + h > 720.5) out.bleed = true;
  out.coverage = _num(_jsRound((w * h) / (1280 * 720) * 1000) / 1000);
  return out;
}

function parseFill(spPrNode, clrMap, theme) {
  const grad = kidOf(spPrNode, "a:gradFill");
  const solid = kidOf(spPrNode, "a:solidFill");
  const blip = kidOf(spPrNode, "a:blipFill");
  if (grad !== null) return { gradient: parseGradXml(grad, clrMap, theme) };
  if (solid !== null) {
    const c = parseColor(solid, clrMap, theme);
    if (c) {
      const out = { solid: c.hex || c.scheme };
      if (c.scheme) out.scheme = c.scheme;
      return out;
    }
    return null;
  }
  if (blip !== null) {
    const b = kidOf(blip, "a:blip");
    const embed = b !== null ? attrsOf(b)["r:embed"] : undefined;
    return { blip: embed || null };
  }
  if (kidOf(spPrNode, "a:noFill") !== null) return { none: true };
  return null;
}

module.exports = {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb, applyColorMods, PRST_CLR,
  parseColor, parseGradXml, parseShadow, parseLn, geoFacts, parseFill,
};
