// consts.cjs — константы DSL и маппинги (порт consts.py v3.2.1).
'use strict';

const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
const PLACEHOLDER_RE = /XX\s*%|\blorem\b|\bTBD\b|\{\{/i;
const EMOJI_RE = /[¶←-⇿⌀-➿⬀-⯿️\u{1f000}-\u{1faff}]/u;
const PHOTO_STUB_RE = /^\s*(фото(графия)?|место для фото|скриншот|изображение|картинка|photo|image|screenshot|picture)\s*[.…]?\s*$/i;
const UNRENDERABLE = new Set(["svg", "wmf", "emf", "wdp", "jxr", "tif", "tiff"]);
const IMG_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
const BUILD_SHAPES = new Set(["rect", "roundRect", "ellipse", "triangle", "rtTriangle", "parallelogram", "trapezoid", "diamond", "pentagon", "hexagon", "heptagon", "octagon", "star5", "star6", "chevron", "homePlate", "rightArrow", "leftArrow", "upArrow", "downArrow", "pie", "donut"]);
// DSL shape name == OOXML prst (MSO_SHAPE.* в python-порте — те же токены)
const SHAPE_MAP = Object.fromEntries([...BUILD_SHAPES].map((s) => [s, s]));
const SHADOW_TOKENS = {
  soft: { blurRad: 190500, dist: 38100, dir: 5400000, color: "0B0F14", alpha: 22000 },
  lift: { blurRad: 285750, dist: 63500, dir: 5400000, color: "0B0F14", alpha: 30000 },
};
const ALIGN_MAP = { l: "l", ctr: "ctr", r: "r", just: "just" }; // OOXML algn values
const ANCHOR_MAP = { t: "t", ctr: "ctr", b: "b" }; // OOXML anchor values
const CHART_KINDS = { bar: "bar", line: "line", pie: "pie", doughnut: "doughnut" };
const DECOR_NAMES = new Set(["wordmark"]);

module.exports = {
  HEX_RE, PLACEHOLDER_RE, EMOJI_RE, PHOTO_STUB_RE, UNRENDERABLE, IMG_EXT,
  BUILD_SHAPES, SHAPE_MAP, SHADOW_TOKENS, ALIGN_MAP, ANCHOR_MAP, CHART_KINDS, DECOR_NAMES,
};
