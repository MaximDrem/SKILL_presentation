# CLONE — new deck in the style of an attached reference

The user attached a deck and wants new content in the same style. The new
deck is assembled on the reference package — its masters, layouts, theme
and media are inherited, never re-described and never regenerated. The
reference file is read-only.

This file is a cookbook: execute the numbered steps in order and insert
nothing between them. Creativity exists only in step 4 (the plan) and
step 6 (page texts and layout) — every other step is mechanical.

Your Working directory is in your environment block — ALL work happens
inside it, with absolute paths. **Forbidden during the whole run:**
exploring the environment (fonts, packages, OS, binaries — the skill
bundles everything it needs); reading files beyond the step-2 intake
list; re-reading anything; "repairing"/"renaming" files with bash;
reasoning about the style (colors/fonts/sizes are copied, not
interpreted).

## Steps

1. **Unpack the reference — one bash, inside your Working directory:**
   `ELECTRON_RUN_AS_NODE=1 "$GIGATOOL_NODE" "$SKILL/tools/deck.cjs" unpack "<ref.pptx>" --out "<name>-ref"`
   Engine verify-issues it may print (OUT OF BOUNDS, TEXT CLIPPED, …)
   describe the ORIGINAL deck — never act on them, never "fix" the
   reference. The output ends with a numbered intake list = step 2.

2. **Intake — exactly the files the unpack output listed, one call per
   reply, in the listed order** (if a call failed or you skipped one,
   re-issue that single call next; describe only content you actually
   saw):
   1. `read <name>-ref/STYLE.md` — palette/typography to copy literally;
      layout patterns per background archetype (geometry variants —
      a pattern already fits its own text: copy its box proportions
      (h per line at its sz), never squeeze them);
      «## Contents» with a per-slide `type` column; «## Decor» digest.
      Canvas is ALWAYS **1280×720**, including the STYLE.md patterns —
      never rescale or "convert" coordinates.
   2. only if the intake list contains `thumbs-*.png` (unpack ran with
      renders): `read_image` on each — extract exactly two words:
      `rounding=sharp|round` (drives shape `adjustments`: 6000 | 25000)
      and `mood=photo|vector` (drives illustration choices). If unsure or
      absent: `rounding=round`, `mood=photo`.
   3. `read_image` on each `decor-thumbs*.png` sheet, fixed prompt:
      «перечисли ВСЕ плитки без пропусков (слева направо, построчно):
      имя файла (подпись ПОД фото, в общей с ним рамке) — короткое
      описание — класс `decor` (нейтральное украшение: фигуры, блобы,
      стекло, текстуры, универсальные иконки) или `content` (скриншот,
      график/диаграмма, человек, визитка/карточка с человеком или
      контактами, продуктовое фото, чужой логотип, QR —
      несёт чужой контент)». Doubtful tile → `content` (excluded).
      Your sheet classification decides WHETHER a file may be copied;
      the machine class in «## Decor» only says HOW it renders. Conflict
      or doubt → excluded, noted in plan.md, no deliberation.
   Nothing else in the atlas exists for you — the rest is machine data
   for the build. **Only `decor`-class files may be copied** (spec.md
   «Уместность декора»).

3. **Project folder — one bash:** `mkdir -p "<deck>/pages" "<deck>/media"`
   (`<deck>` = short topic slug, inside your Working directory).

4. **`write "<deck>/plan.md"` — the plan IS the design pass.** Think in
   the plan's format; never design in reasoning first, never re-plan
   later. One line per slide: its proto (from the «## Contents» `type`
   column — one cover, one main content archetype, 1–2 accent protos),
   its title, its theses from the user's content, its decor files (from
   step 2's enumeration). For every visual specify its role:
   `hero | semantic-marker | background-decor`. 3D is allowed only as a
   semantically relevant hero; SVG pictograms only as semantic markers for
   a thesis/card/step. Repeated card grids must not mix these roles or
   replace one semantic SVG marker with a 3D illustration. Do not depict
   the same concept in both 3D and SVG on one slide. Template:

   ```
   # План: <тема> — N слайдов, стиль «<имя референса>»
   # Стиль: rounding=round, mood=photo. Исключены (content): image27.png
   # Роли: 3D только hero; SVG только semantic-marker; одна семья внутри сетки.
   # Декор — только акценты/фон, никогда не главный визуал слайда.
   1. cover — proto 1 (титульный референса). Заголовок «…», подзаголовок
      «…»; расположение по паттерну обложки; decor: image5.png.
   2..N-1. content — proto 25 (основная раскладка референса). Заголовок
      «…»; тезисы из ТЗ пользователя; геометрия по паттерну «…», НЕ 1:1 —
      координаты отличаются от паттерна ≥40px по x или y, или иная сетка
      колонок (композиция — что где лежит — та же); decor: image22.png
      на слайдах 3 и 5.
   N. closing — proto 34 (финальный референса). Призыв «…»; расположение
      как в референсе (вместимость подтвердит check).
   ```

5. **Copy decor — one bash:** `cp "<name>-ref/media/<f1>" "<name>-ref/media/<f2>" … "<deck>/media/"`
   — every file named in plan.md, in one command. Do not generate images.
   If the plan needs a visual that exists neither in the reference media
   nor among the bundled pictograms
   (`templates/default-ref/decor/pictograms/picto-*.svg` —
   style-neutral UI icons, icon slots only, never the slide's main
   visual), compose it from icons/shapes or use the first decor file of
   the same archetype from plan.md — never leave an empty placeholder
   slot.
   **Reference decor (blobs, rings, icons) is accents and background
   elements — NEVER the dominant visual of a slide.** CLONE generates no
   photos: when the plan wants a "hero" visual, build it from
   text/shapes/a chart, not from a decor picture.

6. **Author pages strictly from plan.md** — one `<deck>/pages/slide-NN.json`
   `write` per reply, back to back (SKILL.md Rules). Grammar: `spec.md` —
   the only file to open beyond this one. Set `"proto": <N>` from the
   plan on every page — build inherits ONLY the proto's background
   (spec.md §2). **Do not set `background` on clone pages.** Copied media
   keep the source proportions and scale: downscale to the slot is fine,
   never distort the aspect, never upscale past the file's native px
   (the «## Media» table lists them) — a small file is an icon slot, not
   the slide's main visual.
   **Titles and theses come verbatim from the user's brief** — synonyms
   and rewordings are forbidden (the brief's «Масштабируемость» stays
   «Масштабируемость»). Text budget: Russian runs ~15–20% wider than
   English — give copied boxes ~20% extra height or plan shorter wording;
   most clone text-fit failures come from long Russian text in compact
   reference boxes.

7. **Fix loop:** `ELECTRON_RUN_AS_NODE=1 "$GIGATOOL_NODE" … deck.cjs check "<deck>" --template "<ref.pptx>" --ref "<name>-ref"`
   → apply every `plan[]` entry by rewriting whole pages with `write`
   (protocol: SKILL.md Rules) → re-check. Until zero HARD. If a proto is
   rejected (degraded / not in atlas), its failure message names the
   default replacement — apply it. If check/build reports a stale atlas,
   run the printed recovery command.

8. **Build once:** `ELECTRON_RUN_AS_NODE=1 "$GIGATOOL_NODE" … deck.cjs build "<deck>" --template "<ref.pptx>" --ref "<name>-ref" --out "<abs>/<deck>.pptx"`

9. **Review + deliver** — protocols: SKILL.md («After build: the verify lines»,
   «Delivery message»). Code only.
