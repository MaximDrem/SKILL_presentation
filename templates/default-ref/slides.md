# slides.md — шаблоны SU 2026 (dark + light), canvas 1280×720

The bundled templates are the official Sber design system by the SberUser
department (SU 2026). This atlas is SHARED by both themes — the only
difference is which `--theme dark|light` flag you pass to check/build and
which colors/backgrounds you take (see «## Цвета и фоны»).

The atlas holds only the proto slides listed below — build rejects any proto
outside the table of YOUR theme. Compose slides by the canonical examples in
«## Типовые слайды» below (see create.md). Decor files live in the shared
`decor/` library (full list: `decor/CATALOG.md`).

The «logo» column marks the SberUser brand-logo zone on the background
(x,y of the top-left corner, ~150×24px): never place text or elements there.

## Contents — Тёмная тема (--theme dark)

| # | type | logo | T/C |
|---|---|---|---|
| 1 | cover |  |  |
| 2 | showcase-palette |  |  |
| 3 | showcase-type |  |  |
| 18 | divider |  |  |
| 19 | divider |  |  |
| 20 | divider |  |  |
| 21 | divider | [89,74] |  |
| 22 | text |  |  |
| 23 | text |  |  |
| 24 | text |  |  |
| 25 | text |  |  |
| 26 | data |  |  |
| 27 | data | [52,32] |  |
| 28 | data |  |  |
| 30 | quote | [52,32] |  |
| 31 | quote | [52,32] |  |
| 32 | text | [52,32] |  |
| 33 | photo | [52,32] |  |
| 34 | text | [52,32] |  |
| 35 | text | [52,32] |  |
| 36 | section | [52,32] |  |
| 37 | text | [52,32] |  |
| 38 | text | [52,32] |  |
| 39 | team | [52,32] |  |
| 40 | cards-3 | [52,32] |  |
| 41 | cards-3 | [52,32] |  |
| 42 | cards-4 | [52,32] |  |
| 43 | cards-4 | [52,32] |  |
| 44 | table |  | T |
| 45 | table |  | T |
| 46 | table |  | T |
| 47 | chart |  | C |
| 48 | chart | [52,32] | C |
| 49 | chart | [52,32] | C |
| 50 | stat |  |  |
| 51 | stat | [52,32] |  |
| 52 | stat | [52,32] |  |
| 53 | meme |  |  |
| 56 | closing |  |  |

## Contents — Светлая тема (--theme light)

| # | type | logo | T/C |
|---|---|---|---|
| 1 | cover | [89,74] |  |
| 2 | showcase-palette | [51,31] |  |
| 3 | showcase-type | [51,31] |  |
| 18 | divider | [51,31] |  |
| 19 | divider | [51,31] |  |
| 20 | divider | [51,31] |  |
| 21 | divider | [51,31] |  |
| 22 | divider | [51,31] |  |
| 23 | text | [51,31] |  |
| 24 | text | [51,31] |  |
| 25 | text | [51,31] |  |
| 26 | text | [51,31] |  |
| 27 | data | [51,31] |  |
| 28 | data | [51,31] |  |
| 29 | data | [51,31] |  |
| 31 | quote | [51,31] |  |
| 32 | quote | [51,31] |  |
| 33 | text | [51,31] |  |
| 34 | text | [51,31] |  |
| 35 | photo | [51,31] |  |
| 36 | photo | [51,31] |  |
| 37 | section | [51,31] |  |
| 38 | text | [51,31] |  |
| 39 | text | [51,31] |  |
| 40 | team | [51,31] |  |
| 41 | cards-3 | [51,31] |  |
| 42 | cards-3 | [51,31] |  |
| 43 | cards-4 | [51,31] |  |
| 44 | cards-4 | [51,31] |  |
| 45 | table | [51,31] | T |
| 46 | table | [51,31] | T |
| 47 | table | [51,31] | T |
| 48 | chart | [51,31] | C |
| 49 | chart | [51,31] | C |
| 50 | chart | [51,31] | C |
| 51 | stat | [51,31] |  |
| 52 | stat | [51,31] |  |
| 53 | stat | [51,31] |  |
| 57 | closing | [51,31] |  |

## Цвета и фоны

### Тёмная тема (--theme dark)

- Fonts: SB Sans Text Light ×316, SB Sans Display Semibold ×217, SB Sans Display ×180, SB Sans Text ×110, SB Sans Display Light ×82, SB Sans Text Semibold ×16, SBSansDisplay-Light ×7
- Font sizes: 14 ×307, 12 ×115, 18 ×105, 36 ×101, 11 ×88, 8 ×42, 10 ×30, 48 ×29, 16 ×24, 28 ×17, 20 ×12, 9 ×10
- Text colors: #FFFFFF ×778, #62ECFF ×36, #56FF71 ×33, #000000 ×16, #BFBFBF ×15, #333F48 ×5, #FF3256 ×5, #000333 ×2
- Shape fills: #000000 ×334, #FFFFFF ×255, #FFFFFF26 ×14, #56FF71 ×13, #62ECFF ×4, #FFFFFF21 ×4, #1032A1 ×1, #0882FF ×1, #ADFFC6 ×1, #BAFFFB ×1, #FF3256 ×1, #50FA38 ×1
- Gradients: 359.9° #5BFC1F→#0FDEF7; 45° #F1F3FF33→#FFFFFF0D; 45° #F1F3FF33→#FFFFFF00; ?° #A0E72019→#4BE87B29→#42E3B447→#7AC0FF4F; 210° #F1F3FF33→#FFFFFF00; ?° #64E9E900→#64E9E9; 230° #56FF71→#56FF71; ?° #64E9E900→#64E9E9; 175° #56FF71→#000000; 175° #62ECFF→#000000; 175° #1532A1→#000000; 290° #FFFFFF26→#FFFFFF33
- Theme: dk1 #000000 lt1 #FFFFFF dk2 #0D0658 lt2 #ED692B accent1 #00ADEE accent2 #20BA71 accent3 #A0E720 accent4 #2F97AD accent5 #64E9E9 accent6 #FAED00 hlink #33AC8B folHlink #00A523
- clrMap: bg1→lt1 tx1→dk1 bg2→lt2 tx2→dk2
- Theme fonts: major SB Sans Display, minor SB Sans Text; embedded: yes

Фоны прототипов (унаследованный фон; явный `background` страницы его
перекрывает):

| proto | фон |
|---|---|
| 1 | dark gradient, teal glow left, neon green wave right edge, black top |
| 2 | dark gradient, soft teal glow center-bottom, black top |
| 3 | dark gradient, soft teal glow center-bottom, black top |
| 18 | teal gradient left, green glow right, dark bottom, evenly lit |
| 19 | dark background, blue glow bottom-left, green glow bottom-right |
| 20 | dark gradient, teal glow bottom-left, faint green right edge |
| 21 | near-black center, cyan glow top-right, green glow bottom-right corner |
| 22 | mostly black, faint green streak left edge, dark everywhere |
| 23 | dark gradient, green vertical glow right edge, black left |
| 24 | dark gradient, soft teal glow center-bottom, black top |
| 25 | near-black center, cyan glow top-right, green glow bottom-right corner |
| 26 | black background, neon green wave bottom-right corner |
| 27 | black background, soft cyan glow top-right edge |
| 28 | dark gradient, soft teal glow center-left, black edges |
| 30 | black background, bright cyan glow top-left and right edges |
| 31 | black background, thin cyan vertical streak right edge |
| 32 | teal gradient left, bright cyan-white glow right edge |
| 33 | dark gradient, bright cyan-blue glow top-left corner, black bottom-right |
| 34 | teal gradient left, bright cyan-white glow right edge |
| 35 | dark gradient, bright cyan-blue glow top-left corner, black bottom-right |
| 36 | black background, soft cyan glow top-right edge |
| 37 | black background, soft cyan glow top-right edge |
| 38 | black background, soft cyan glow top-right edge |
| 39 | black background, soft cyan glow top-right edge |
| 40 | black background, soft cyan glow top-right edge |
| 41 | mostly black, small cyan glow bottom-right corner |
| 42 | black background, soft cyan glow top-right edge |
| 43 | mostly black, small cyan glow bottom-right corner |
| 44 | dark gradient, soft teal glow center-bottom, black top |
| 45 | dark gradient, soft teal glow center-bottom, black top |
| 46 | dark gradient, soft teal glow center-bottom, black top |
| 47 | dark gradient, soft teal glow center-bottom, black top |
| 48 | mostly black, small cyan glow bottom-right corner |
| 49 | black background, soft cyan glow top-right edge |
| 50 | dark gradient, green vertical glow right edge, black left |
| 51 | black background, soft cyan glow top-right edge |
| 52 | black background, faint cyan glow right edge |
| 53 | dark gradient, soft teal glow center-left, black edges |
| 56 | near-black center, cyan glow top-right, green glow bottom-right corner |

Зона логотипа SberUser (x,y левого верхнего угла, ~150×24px) —
не ставить туда текст и декор: proto 21: [89,74], 27: [52,32], 30: [52,32], 31: [52,32], 32: [52,32], 33: [52,32], 34: [52,32], 35: [52,32], 36: [52,32], 37: [52,32], 38: [52,32], 39: [52,32], 40: [52,32], 41: [52,32], 42: [52,32], 43: [52,32], 48: [52,32], 49: [52,32], 51: [52,32], 52: [52,32].

### Светлая тема (--theme light)

- Fonts: SB Sans Text Light ×315, SB Sans Display Semibold ×226, SB Sans Display ×175, SB Sans Text ×102, SB Sans Display Light ×82, SB Sans Text Semibold ×22, SBSansDisplay-Light ×7, Calibri ×2
- Font sizes: 14 ×306, 12 ×115, 36 ×108, 18 ×107, 11 ×88, 8 ×35, 48 ×31, 10 ×30, 16 ×24, 28 ×17, 20 ×12, 9 ×10
- Text colors: #2A3238 ×734, #323E48 ×55, #000000 ×40, #01E0FF ×19, #56FF71 ×19, #FFFFFF ×8, #62ECFF ×7, #333F48 ×5, #FF3256 ×5, #000333 ×2
- Shape fills: #000000 ×593, #52F46C26 ×11, #01E0FF1A ×8, #FFFFFF ×6, #01E0FF ×6, #56FF71 ×4, #62ECFF ×4, #01E0FF26 ×4, #2A3238 ×3, #2A323812 ×3, #00E0FF ×1, #283438 ×1
- Gradients: 359.9° #5BFC1F→#0FDEF7; ?° #A0E72019→#4BE87B29→#42E3B447→#7AC0FF4F; ?° #FFFFFF→#FFFFFF00; ?° #9DFFBB→#FFFFFF; ?° #55FF7000→#01E0FF; 230° #56FF71→#56FF71; 175° #56FF71→#FFFFFF; 175° #62ECFF→#FFFFFF; 175° #FF3256→#FFFFFF; 290° #FFFFFF26→#FFFFFF33
- Theme: dk1 #000000 lt1 #FFFFFF dk2 #283438 lt2 #FFFFFF accent1 #56FF71 accent2 #5CFF8D accent3 #00E0FF accent4 #61ECFF accent5 #55FF70 accent6 #5CFF8D hlink #0563C1 folHlink #954F72
- clrMap: bg1→lt1 tx1→dk1 bg2→lt2 tx2→dk2
- Theme fonts: major Calibri Light, minor Calibri; embedded: no

Фоны прототипов (унаследованный фон; явный `background` страницы его
перекрывает):

| proto | фон |
|---|---|
| 1 | cyan top-left corner, green glow right side, white center |
| 2 | white background, green patch top-left, cyan streak right edge |
| 3 | plain white, very faint gray tint at top |
| 18 | white with cyan wave top-left, 3D star cluster right |
| 19 | pale white-cyan, 3D green-blue stars on right side |
| 20 | pale cyan, 3D hand holding green phone bottom-right |
| 21 | white center, green tint top-left, cyan right edge |
| 22 | white background, cyan left edge, green hint bottom-right |
| 23 | white background, cyan glow along left edge |
| 24 | white background, green streak top-left, cyan hint right |
| 25 | white background, green streak top-left, cyan hint right |
| 26 | white background, green streak top-left, cyan hint right |
| 27 | white background, green glow top edge and bottom center |
| 28 | white background, green glow top edge and bottom center |
| 29 | white background, cyan patches top-left and bottom-right |
| 31 | white background, green patch top-left, cyan streak right edge |
| 32 | green gradient wash left fading to white right |
| 33 | white center, cyan glow top-left, green tint right edge |
| 34 | cyan top-left corner, green glow right side, white center |
| 35 | white background, green glow top-right and bottom-right |
| 36 | mostly white, pale cyan wash top and left |
| 37 | mostly white, faint green wash along top edge |
| 38 | white background, cyan patches top-left and bottom-right |
| 39 | white background, green glow top edge and bottom center |
| 40 | white center, green tint top-left, cyan right edge |
| 41 | mostly white, faint green wash along top edge |
| 42 | white background, cyan patches top-left and top-right |
| 43 | mostly white, pale cyan wash top and left |
| 44 | white background, green glow top-right and bottom-right |
| 45 | mostly white, faint green wash along top edge |
| 46 | mostly white, faint green wash along top edge |
| 47 | mostly white, faint green wash along top edge |
| 48 | mostly white, faint green wash along top edge |
| 49 | plain white background |
| 50 | mostly white, faint green wash along top edge |
| 51 | mostly white, faint green wash along top edge |
| 52 | mostly white, faint green wash along top edge |
| 53 | mostly white, faint green wash along top edge |
| 57 | white background, cyan left edge, green hint bottom-right |

Зона логотипа SberUser (x,y левого верхнего угла, ~150×24px) —
не ставить туда текст и декор: proto 1: [89,74], 2: [51,31], 3: [51,31], 18: [51,31], 19: [51,31], 20: [51,31], 21: [51,31], 22: [51,31], 23: [51,31], 24: [51,31], 25: [51,31], 26: [51,31], 27: [51,31], 28: [51,31], 29: [51,31], 31: [51,31], 32: [51,31], 33: [51,31], 34: [51,31], 35: [51,31], 36: [51,31], 37: [51,31], 38: [51,31], 39: [51,31], 40: [51,31], 41: [51,31], 42: [51,31], 43: [51,31], 44: [51,31], 45: [51,31], 46: [51,31], 47: [51,31], 48: [51,31], 49: [51,31], 50: [51,31], 51: [51,31], 52: [51,31], 53: [51,31], 57: [51,31].

## Decor

Decor is sorted by family in `decor/` — full list with px sizes and
descriptions: `decor/CATALOG.md`. Pictograms: `decor/pictograms/picto-*.svg`
(native vector shapes; build recolors them to the background's antonym).
