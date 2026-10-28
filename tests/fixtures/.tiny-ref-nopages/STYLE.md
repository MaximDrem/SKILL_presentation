# STYLE.md — tiny-clone.pptx — 5 slides, canvas 1280×720

This is the ONLY text file to read for style/layout. Read it whole — and author.
Every other file and folder in this atlas is machine data for the build —
there is nothing else to read.

## Contents

| # | type | layout | first text | els | T/C |
|---|---|---|---|---|---|
| 1 | cover | slideLayout7 | Крошечный эталон | 3 | — |
| 2 | divider | slideLayout7 | Пункты и ссылки | 4 | — |
| 3 | table | slideLayout7 |  | 1 | T |
| 4 | chart | slideLayout7 |  | 2 | C |
| 5 | closing | slideLayout7 | в группе | 3 | — |

## Style

- Fonts: Calibri ×14, SB Sans Display ×1
- Font sizes: 13 ×7, 16 ×5, 54 ×1, 28 ×1, 14 ×1
- Text colors: #000000 ×12, #FFFFFF ×2, #1A5BD7 ×1
- Shape fills: #2FE7C466 ×1
- Theme: dk1 #000000 lt1 #FFFFFF dk2 #1F497D lt2 #EEECE1 accent1 #4F81BD accent2 #C0504D accent3 #9BBB59 accent4 #8064A2 accent5 #4BACC6 accent6 #F79646 hlink #0000FF folHlink #800080
- clrMap: bg1→lt1 tx1→dk1 bg2→lt2 tx2→dk2
- Theme fonts: major Calibri, minor Calibri; embedded: no

## Layout patterns (geometry variants per background archetype — adapt,
don't copy 1:1: keep bounds logic, replace texts/colors with your content)

### «theme» — pattern from slide 2 (4 els)
- shape rect [60,60,700,60]
- text [60,60,700,60] 28.0pt b Calibri #000000 «Пункты и ссылки»
- shape rect [60,160,700,300]
- text [60,160,700,300] 16.0pt Calibri #000000 «первый пунктвторой жирны»

### «image1.png» — pattern from slide 1 (3 els)
- image image1.png [0,0,1280,720]
- shape rect [60,280,1160,120]
- text [60,280,1160,120] 54.0pt b SB Sans Display #FFFFFF «Крошечный эталон»

### «gradient» — pattern from slide 5 (3 els)
- shape roundRect [60,240,120,60] fill #2FE7C466
- text [180,300,120,60] 14.0pt Calibri #000000 «в группе»
- image image2.png [900,300,300,200]

## Media (2): background 1 · decor 0 · content 1 · unrenderable 0

Class: **background** — page background (p:bg or full-bleed, use only as background); **decor** — has alpha (can overlay); **content** — opaque non-background; **unrenderable** — svg/wmf/emf/wdp. Files are `media/<name>` bit-for-bit; the table below carries class, px size and where-used.

## Archetypes

- image1.png: slide 1
- theme: slides 2, 3, 4
- gradient: slide 5

## Decor (reusable media — pick by description; class decor = alpha/overlay, content = opaque photo)

| file | class | px | used on |
|---|---|---|---|
| image2.png | content | 400×300 | 5 |
