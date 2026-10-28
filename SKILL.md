---
name: presentation
description: Create new PowerPoint presentations from scratch or restyle an attached pptx into new content. Use when the user asks to make a presentation, slides, or deck, when a .pptx/.potx file is attached to such a request (style is inherited from it), or to copy the style of an existing one. Triggers include «сделай презентацию», «сделай слайды/деку», «подготовь питч/презентацию по…», «перенеси контент в новый дизайн», «в стиле этого шаблона/файла», «сделай в стиле нашего шаблона», «переделай презентацию», "make a presentation", "slides about X", "copy this deck's style". Builds a real, fully editable .pptx via bundled node tools — no pip, no npm, nothing to install.
previewDescription: Работа с презентациями
---

# Presentation

**Version 4.0.0** — CJS/PptxGenJS production path (vendored pptxgenjs@4.0.1), no bundled Python.

Build real `.pptx` files. You author slides as JSON page-specs; the bundled
tools validate, assemble, render and engine-verify the result.

All work happens in your working directory and only through this skill's
tools: never write to `/tmp`, never write pptx XML by hand, never generate
decks with external programs.

## Choose the workflow

| Request | Workflow | Read next |
|---|---|---|
| Make a presentation about X | CREATE | `references/create.md` |
| A .pptx is attached AND the task is to make slides | CLONE | `references/clone.md` |
| Same style as this attached deck / copy this deck | CLONE | `references/clone.md` |
| Change something in this deck | EDIT — not supported; offer CREATE/CLONE | `references/edit.md` |

An attached .pptx decides for CLONE whenever the task is creating slides —
the style is inherited from the attachment. CREATE from an attachment only
when the user explicitly says it is a content-only source («возьми оттуда
только текст/данные»).

Page-spec grammar (element types, fields, limits): `references/spec.md`.

## Commands

Absolute paths, quoted. Cyrillic and spaces in paths are fine. CJS helpers
run only via the bundled Node runtime in Electron Node-mode
(ELECTRON_RUN_AS_NODE=1 $GIGATOOL_NODE) — never system node, never npm install
at runtime.

```bash
SKILL="$HOME/.wsc/config/skills/presentation"  # or $OPENCODE_BASE_DIR/config/skills/presentation

# Check pages without building — the fix loop (cheap, text-only)
# CREATE with the SU look: add --theme dark (or light) to BOTH check and
# build — nothing is inherited without it. CREATE with the user's own
# style: no --theme at all (then every page needs its own `background`).
ELECTRON_RUN_AS_NODE=1 "$GIGATOOL_NODE" "$SKILL/tools/deck.cjs" check "<projectDir>" [--theme dark|light]

# Build a deck: validate → assemble → render → engine verify, ONE final call
ELECTRON_RUN_AS_NODE=1 "$GIGATOOL_NODE" "$SKILL/tools/deck.cjs" build "<projectDir>" --out "<abs>/deck.pptx" [--theme dark|light]
```

Workflow-specific flags and commands are in your workflow file.

Errors come as `{error, failures[], suggestion}` — follow the suggestion's
recovery command. **One build reports every failure of every page at once**
(`failures[]` is complete, not first-error): read the whole list and fix all
entries in one edit round, then rebuild. `failures[]` entries are prefixed
`[HARD]` and give the exact requirement — `увеличьте h до ≥Npx` and/or
`уменьшите sz до ≤Npt` (for width: `увеличьте w до ≥Npx`); apply the number as
given instead of guessing. Never retry a call with identical arguments: the
runtime blocks repeated calls and ends the turn.
Build FAILS when text clearly overflows its box (calibrated estimate,
thresholds in spec.md §5) — fix the flagged boxes to the stated h/w/sz and
rebuild; do not fight it with `autofit: "spAutoFit"` (forbidden — it grows
the box over neighbours). Overlaps (text over text, text over image) are
`[HARD]`, never WARN. Advisory WARNs are of two kinds, the marker says which:
- «(нужно исправить)» — `WARN text-fit` «впритык по высоте» и `WARN qa`
  (aspect/upscale картинок): будущие render-дефекты — примените
  напечатанное число в том же раунде правок.
- «(править не обязательно)» — всё остальное (qa contrast/alpha/gradient,
  width-tight, overlap image×image): косметика, не трогайте, если не
  правите этот элемент и так.
The plan's defaults never grow a box into a neighbour (the checker looks
at sibling boxes) — apply them as printed.

## Rules

- After a context compaction, find your place by `ls` of the project
  folder and the workflow's step list.
- **Create a dedicated project folder per deck, inside your working
  directory** — `<deck-slug>/` holding `pages/`, `media/` and the output
  `.pptx`. Never put `pages/` or `media/` directly into the working
  directory root. Never write to `/tmp` or anywhere else outside the
  working directory. Slug = the transliterated topic in one word — do
  not brainstorm names.
- **Never explore the environment** (fonts, packages, OS, binaries,
  paths outside your Working directory) — the skill bundles everything
  it needs; a genuinely missing tool comes back as an error envelope,
  never as something to probe for. `$GIGATOOL_NODE` and `$SKILL` are
  pre-set by the runtime — use them literally, never probe or derive
  their values.
- **One action per reply.** Write one `pages/slide-NN.json` per reply,
  then the next — no idle replies in between. (If a page you believe
  written is missing, `check` will name it — trust the tool, not memory.)
- **Step budget.** ~45 replies: intake ≤10, authoring one page per reply,
  check+fix ≤6, build+review ≤2.
- **The user's brief outranks every hint in this skill** — if a rule
  here conflicts with an explicit requirement from the user, follow the
  requirement.
- **Read images only with the `read_image` tool** (path + prompt) —
  never with text-file readers (`read` on an image errors and burns a
  step).
- **Modify `pages/*.json` only by whole-file `write`** — never with
  scripts (node/sed/jq fixers), never with exact-string `edit`
  patching (JSON whitespace mismatches make it fail and burn extra
  read/edit replies), never in `/tmp`. Mass identical fixes are rare; if
  one is needed, `failures[]` reports it once with the exact fix per page.
- **Keep reasoning short.** Do not re-derive validator numbers (apply the
  stated h/w/sz as given), do not compare layout options at length, do
  not plan twice. One decision = one action. A fix round's reasoning is
  the copied `plan[]` list and nothing else; `plan.md` is ≤15 lines.
- **Fix loop = `check`, not `build`.** After authoring, iterate
  `deck.cjs check` until zero `[HARD]` (it is instant and adds nothing to
  context). Run full `build` (render + verify) **once**, at the end.
  Fix protocol — follow it literally, no deliberation:
  1. Read the `plan[]` list in the error envelope (also printed as the
     `HARD ×N` block): each entry names its page, element and default fix
     (`slide-03.json title: h→130px`). Copy it as a list, no analysis.
  2. Apply them — rewrite each flagged page whole with `write`, one page
     per reply, in the plan's order (never `edit` — see the write-only
     rule above). Rewrite ONLY the pages listed in `plan[]` plus pages
     whose WARNs carry «(нужно исправить)» — a page without either is NOT
     touched at all.
  3. Re-run `check` once. Done. If after 3 check iterations the HARD
     count has not decreased, you deviated from the plan: apply the plan
     values EXACTLY as printed (no adjustments, no alternatives) and
     re-run `check`. Still failing after that — apply the alternative
     from the full failure message once. `build` runs only at zero HARD —
     it validates the same input and fails on the same list; if HARD
     persists beyond these iterations, stop the loop and report the
     blocker to the user in one line instead of retrying.
  Forbidden during fixes: re-deriving validator numbers, re-reading the
  atlas, redesigning a page's composition, weighing alternative fixes,
  piping tool output through `grep`/`head` (it cuts `plan[]` and
  `suggestion` — read the raw output), retrying an identical call (the
  runtime's anti-loop guard blocks it and ends the turn — if `check` got
  blocked, run `build`: it validates the same input and returns the same
  list on failure).
  The stated default keeps typography; the alternative in the full
  failure message exists only for cases where the default cannot fit the
  canvas. If the plan says «сократите … до ≤N символов» — shorten to the
  stated ≤N chars, keeping the phrase grammatical.
- Facts live in files — re-read them only when recovering after context
  compaction; inside a check→fix iteration no re-reading is needed.
- Reference images as `media/<file>` relative to the project root.
- A horizontal timeline (steps on a rail) is only for genuinely
  SEQUENTIAL content whose markers are of one kind (stages, phases or
  time points). Mixed markers («Утро, Задача, Встреча, Вечер» — time of
  day next to activities) or non-ordered theses on a timeline are a
  defect — use cards instead.
- Every page gets a `proto` — explicit or auto-mapped by build. Only the
  proto's background is ever inherited, and only in CLONE or in CREATE
  with `--theme` (nothing else: no texts, no icons, no card shapes);
  CREATE without `--theme` inherits nothing.

## After build: the verify lines

The build's render step prints verify lines about YOUR deck. Read them
and act mechanically:

- `OUT OF BOUNDS` on an element with `bleed: true` — intentional design,
  ignore.
- `TEXT CLIPPED` → the named element's `h` ×1.2, rounded up (if that
  leaves the canvas — `sz` −2pt instead).
- `TEXT OVERLAP` → never grow a box (growing creates the overlap): `sz`
  −2pt on the named element, or move the upper box UP by the printed
  overlap height.
- `LOW CONTRAST` → text color becomes the background's antonym
  (`#FFFFFF` on dark, `#1A1A1A` on light).

Fix the named page (whole-file `write`) and rebuild; ≤2 rounds. Zero
actionable lines → done. A defect that still remains goes to the
delivery exceptions (one line) — no more rebuilds. The build prints the
slide-number → `slide-NN.json` mapping.

## Delivery message

Deliver exactly this, nothing more:

```
Готово: <тема презентации> — <N> слайдов: <1 строка о содержании>.
Файл: <абсолютный путь .pptx>
```

If the run is blocked before a successful build (guard, render, errors
you could not clear), deliver ONE line instead: what is done + what
blocks the delivery (`Не доставлено: <причина одной строкой>; страницы
готовы: N из M`). Never offer the user shell commands and never ask what
to do next.

The final message is for the user, not a work log. Forbidden in it:
internal names and paths (`image32`, `slide-NN.json`, `pages/`,
`media/`, contact sheets); tool output (`WARN`/`HARD`/verify lines and
review counts — they are for you, already handled); lists of what was not
done or transferred; excuses and improvement suggestions; process
narration (unpacked/built/reviewed); rebuild instructions.

Exception: a defect that REMAINS in the delivered file (validation
failure, missing image, unreadable slide) or undelivered content from
the user's brief — one short line per item,
max 3, phrased as user-relevant facts ("на слайде 4 фото заменено
иконкой: генерация недоступна"). Excluded decor/content files and
remaining WARNs are NOT exceptions — never mention them. Everything you
fixed or handled is not mentioned at all.