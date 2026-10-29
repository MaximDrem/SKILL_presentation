# STYLE.md — elements-all.pptx — 2 slides, canvas 1280×720

This is the ONLY text file to read for style/layout. Read it whole — and author.
Every other file and folder in this atlas is machine data for the build —
there is nothing else to read.

## Contents

| # | type | layout | first text | els | T/C |
|---|---|---|---|---|---|
| 1 | cover | slideLayout7 |  | 11 | — |
| 2 | table | slideLayout7 | пункт один пункт два градиентный текст | 18 | T |

## Style

- Fonts: SB Sans Text ×7, Calibri ×3
- Font sizes: 12 ×7, 16 ×2, 20 ×1
- Text colors: #000000 ×8, #FFFFFF ×1
- Shape fills: #2FE7C499 ×11, #1D254D ×11, #1A1A1A ×3
- Theme: dk1 #000000 lt1 #FFFFFF dk2 #1F497D lt2 #EEECE1 accent1 #4F81BD accent2 #C0504D accent3 #9BBB59 accent4 #8064A2 accent5 #4BACC6 accent6 #F79646 hlink #0000FF folHlink #800080
- clrMap: bg1→lt1 tx1→dk1 bg2→lt2 tx2→dk2
- Theme fonts: major Calibri, minor Calibri; embedded: no

## Layout patterns (geometry variants per background archetype — adapt,
don't copy 1:1: keep bounds logic, replace texts/colors with your content)

### «solid #FFFFFF» — pattern from slide 1 (11 els)
- shape rect [40,40,180,110] fill #2FE7C499 line w3.3
- shape roundRect [240,40,180,110] adj25000.0 fill #1D254D
- shape ellipse [440,40,180,110] fill #2FE7C499
- shape triangle [640,40,180,110] fill #1D254D
- shape rtTriangle [840,40,180,110] fill #2FE7C499
- shape parallelogram [1040,40,180,110] fill #1D254D line w3.3
- shape trapezoid [40,170,180,110] fill #2FE7C499
- shape diamond [240,170,180,110] fill #1D254D
- shape pentagon [440,170,180,110] fill #2FE7C499
- shape hexagon [640,170,180,110] fill #1D254D
- shape heptagon [840,170,180,110] fill #2FE7C499 line w3.3

## Примеры слайдов — эталоны стиля этого референса

Реальные шрифты/цвета/геометрия. Контент — ваш; композиция адаптируется
под контент (check подтвердит вместимость), 1:1 с чужими текстами — плохо.

### proto 1 — solid #FFFFFF
```json
{"pageType": "content", "proto": 1,
 "elements": [
  {"type": "shape", "id": "2", "shape": "rect", "bounds": [40, 40, 180, 110], "fill": {"solid": "#2FE7C499"}, "line": {"w": 3.3, "color": "#F59E0B"}, "shadow": {"blur": 20, "dist": 4, "dir": 90, "color": "#0B0F1438", "token": "soft"}, "rotation": 15},
  {"type": "shape", "id": "3", "shape": "roundRect", "adjustments": [25000], "bounds": [240, 40, 180, 110], "fill": {"solid": "#1D254D"}},
  {"type": "shape", "id": "4", "shape": "ellipse", "bounds": [440, 40, 180, 110], "fill": {"solid": "#2FE7C499"}},
  {"type": "shape", "id": "5", "shape": "triangle", "bounds": [640, 40, 180, 110], "fill": {"solid": "#1D254D"}, "rotation": 15},
  {"type": "shape", "id": "6", "shape": "rtTriangle", "bounds": [840, 40, 180, 110], "fill": {"solid": "#2FE7C499"}},
  {"type": "shape", "id": "7", "shape": "parallelogram", "bounds": [1040, 40, 180, 110], "fill": {"solid": "#1D254D"}, "line": {"w": 3.3, "color": "#F59E0B"}},
  {"type": "shape", "id": "8", "shape": "trapezoid", "bounds": [40, 170, 180, 110], "fill": {"solid": "#2FE7C499"}, "rotation": 15},
  {"type": "shape", "id": "9", "shape": "diamond", "bounds": [240, 170, 180, 110], "fill": {"solid": "#1D254D"}, "shadow": {"blur": 20, "dist": 4, "dir": 90, "color": "#0B0F1438", "token": "soft"}},
  {"type": "shape", "id": "10", "shape": "pentagon", "bounds": [440, 170, 180, 110], "fill": {"solid": "#2FE7C499"}},
  {"type": "shape", "id": "11", "shape": "hexagon", "bounds": [640, 170, 180, 110], "fill": {"solid": "#1D254D"}, "rotation": 15},
  {"type": "shape", "id": "12", "shape": "heptagon", "bounds": [840, 170, 180, 110], "fill": {"solid": "#2FE7C499"}, "line": {"w": 3.3, "color": "#F59E0B"}}
 ]}
```

## Media (1): background 0 · decor 0 · content 1 · unrenderable 0

Class: **background** — page background (p:bg or full-bleed, use only as background); **decor** — has alpha (can overlay); **content** — opaque non-background; **unrenderable** — svg/wmf/emf/wdp. Files are `media/<name>` bit-for-bit; the table below carries class, px size and where-used.

## Archetypes

- solid #FFFFFF: slides 1, 2

## Decor (reusable media — pick by description; class decor = alpha/overlay, content = opaque photo)

| file | class | px | used on |
|---|---|---|---|
| image1.png | content | 400×300 | 2 |
