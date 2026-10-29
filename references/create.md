# CREATE — presentation from scratch

No reference deck. The pipeline splits in two at step 1 — decide ONCE and
never revisit:

**Style determination (mandatory, one line of reasoning, written into
plan.md).** Did the user name their own style or palette? **"Светлая" or
"тёмная" alone is NOT a custom style** — that is the SU template's
light/dark variant. Default (brief silent): SU, dark.

- **SU path** → `--theme dark` (or `--theme light` when light is asked),
  on BOTH `check` and `build`.
- **From-scratch path** (own style) → NO `--theme` anywhere: the deck
  builds on an empty package (nothing inherited), every page carries its
  own explicit `background`.

This file is a cookbook: execute the numbered steps in order and insert
nothing between them. Creativity exists only in step 4 (the plan) and
step 5 (page texts and layout) — every other step is mechanical.

Your Working directory is in your environment block — ALL work happens
inside it, with absolute paths. **Forbidden during the whole run:**
exploring the environment (fonts, packages, OS, binaries); reading files
beyond the step-2 list; re-reading anything; opening decor FILES (catalog
descriptions are final); reasoning about the style (palettes/fonts are
copied from the atlas or the brief, not interpreted).

## Steps

1. **Intake.** If the brief carries goal, audience, slide count, density
   and style — start at step 2. Then the style determination (above).

2. **Read — one call per reply, in this order.**
   Always:
   1. `references/spec.md` — the JSON contract.
   Then by path:
   - **SU path:**
     2. `templates/default-ref/slides.md` — WHOLE: proto roles, backgrounds,
        inherited text styles and JSON decor-placement examples. The
        template supplies backgrounds and text styles; add any logo or
        decor explicitly as page elements only when semantically needed;
     3. `templates/default-ref/decor/CATALOG.md` — WHOLE: the full
        decor inventory with descriptions.
   - **From-scratch path:**
     2. `templates/default-ref/decor/CATALOG.md` — WHOLE (icon/decor
        inventory; files are style-neutral accents);
     3. `references/recipes.md` — example compositions (NOT obligations —
        examples of density and geometry; adapt freely).
   Nothing else in the atlases exists for you.

3. **Folder + plan — one bash + one write:**
   `mkdir -p "<deck>/pages" "<deck>/media"`, then `write "<deck>/plan.md"`
   — one line per slide: `N. <layout family> — «title»` (SU path adds the
   proto number: `N. <layout> — proto <N> — «title»`) plus the style
   decision from step 1. The plan IS the design pass — think in the plan's
   format, never design in reasoning first. Frozen after writing: check
   fixes change geometry, never the plan.

4. **Media — one bash:** `cp` the decor files named in plan.md into
   `<deck>/media/` (from `templates/default-ref/decor/` — shared by both
   themes). Generated photos via
   `gigachat_image` (`{prompt, file_name?}` → JPEG ~1024px in the cwd →
   move into `media/`): **at most 3 per deck**, and only when the brief
   explicitly needs photos (e.g. people/team); on failure replace the slot
   with a decor/3D icon or change the composition. Every visual slot gets
   a real image — a placeholder box or text like "Фото" / "Место для фото"
   is a defect. Every image keeps its source aspect and never upscales
   past its native px (CATALOG.md lists them) — a small file is an icon
   slot, not the main visual.

5. **Author pages from plan.md** — one `<deck>/pages/slide-NN.json`
   `write` per reply, back to back (SKILL.md Rules).
   - SU path: geometry and decor placement follow «## Типовые слайды»
     examples; texts/colors — yours (palette from «## Цвета и фоны»). Set
     `"proto": <N>` from the plan on every page.
   - From-scratch: compose freely per recipes.md examples (they are not
     obligations); explicit `background` on EVERY page; no `proto` needed.
   **Titles and theses come verbatim from the user's brief** — synonyms
   and rewordings are forbidden.

6. **Fix loop:** `ELECTRON_RUN_AS_NODE=1 "$GIGATOOL_NODE" … deck.cjs check "<deck>" [--theme …]`
   → apply every `plan[]` entry by rewriting whole pages with `write`
   (protocol: SKILL.md Rules) → re-check. Until zero HARD.

7. **Build once:** `ELECTRON_RUN_AS_NODE=1 "$GIGATOOL_NODE" … deck.cjs build "<deck>" --out "<abs>/<deck>.pptx" [--theme …]`
   — the `--theme` decision from step 1 applies to both commands,
   never mixed.

8. **Review + deliver** — protocols: SKILL.md («After build: the verify
   lines», «Delivery message»). Code only.
