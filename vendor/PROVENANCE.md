# vendor/ provenance

Все third-party зависимости — vendored копии официальных пакетов с лицензиями.
Полные версии/хэши: VERSIONS.json. Runtime npm/node_modules отсутствуют:
PptxGenJS и все его runtime-transitives упакованы в один self-contained
`pptxgenjs.bundle.cjs` (module registry; generator — `.oracle/bundle-pptxgenjs.cjs`).

## Production runtime

| Путь | Происхождение | Лицензия |
|---|---|---|
| `pptxgenjs.bundle.cjs` | `pptxgenjs@4.0.1` (official `dist/pptxgen.cjs.js` CJS entry) — production element/chart model; в bundle включён весь runtime require-closure: `jszip@3.10.2`, `image-size@1.2.1`, `lie@3.3.0`, `immediate@3.0.6`, `pako@1.0.11`, `queue@6.0.2`, `readable-stream@2.3.8`, `setimmediate@1.0.5`, `core-util-is@1.0.3`, `inherits@2.0.4`, `isarray@1.0.0`, `process-nextick-args@2.0.1`, `safe-buffer@5.1.2`, `string_decoder@1.1.1`, `util-deprecate@1.0.2` | MIT (jszip: MIT OR GPL-3.0-or-later; pako: MIT AND Zlib; inherits: ISC) |
| `pptxgenjs.bundle.cjs` (module `sizeof/`) | shim-alias `sizeof` → `image-size` (pptxgenjs dist ссылается на историческое имя модуля) | MIT (как у image-size) |
| `fflate/` | `fflate@0.8.3` (`esm/` + `lib/node.cjs` + `lib/browser.cjs`, official layout) — ZIP read/write skill core | MIT |
| `pngjs/` | `pngjs@7.0.0` — PNG decode/encode (thumbs, размеры) | MIT |
| `jpeg-js/` | `jpeg-js@0.4.4` — JPEG decode | BSD-3-Clause |

sha1 (media dedup) — `node:crypto`, отдельный пакет не требуется.

## Data parity (не код)

| Путь | Происхождение | Лицензия |
|---|---|---|
| `python-pptx/` | `pptx/templates/default.pptx` из python-pptx 1.0.2 — blank-create базовый пакет (данные для parity) | MIT |
| `xlsx-templates/` | Фиксированные части embedded workbook, снятые с вывода XlsxWriter 3.2.9 (python-pptx chart data) — шаблонные байты для bit-parity | BSD-2-Clause (XlsxWriter) |

Переменные части workbook (sheet1.xml/sharedStrings.xml) генерируются кодом
`tools/helpers/builder/xlsxwrite.cjs` (XlsxWriter-compatible normalizer, см. §6
плана v4); неизменные части — из `xlsx-templates/`. XlsxWriter license notice:
vendor/xlsx-templates/LICENSE.XlsxWriter (BSD-2-Clause © John McNamara).

PptxGenJS license notice: MIT © PptxGenJS contributors (header bundle).
Полные notices/copyrights PptxGenJS и всех bundled transitives: `THIRD_PARTY_NOTICES`.

## Regeneration

`.oracle/vendor.mjs`: официальные tarballs → extraction (чистый каталог на пакет)
→ ESM rewriting для fflate, официальные layouts для CJS closure pptxgenjs.
`.oracle/bundle-pptxgenjs.cjs`: `vendor/node_modules` (dev-time) →
`vendor/pptxgenjs.bundle.cjs` с provenance header. После успешного bundle smoke
`vendor/node_modules` удаляется; production runtime его не использует.
