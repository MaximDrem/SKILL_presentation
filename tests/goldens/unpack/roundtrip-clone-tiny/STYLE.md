# STYLE.md — clone-tiny.pptx — 2 slides, canvas 1280×720

This is the ONLY text file to read for style/layout. Read it whole — and author.
Every other file and folder in this atlas is machine data for the build —
there is nothing else to read.

## Contents

| # | type | layout | first text | els | T/C |
|---|---|---|---|---|---|
| 1 | cover | slideLayout7 | Клон эталона | 3 | — |
| 2 | table | slideLayout7 |  | 1 | T |

## Style

- Fonts: Calibri ×5
- Font sizes: 14 ×4, 54 ×1
- Text colors: #000000 ×4, #FFFFFF ×1
- Shape fills: —
- Theme: dk1 #000000 lt1 #FFFFFF dk2 #1F497D lt2 #EEECE1 accent1 #4F81BD accent2 #C0504D accent3 #9BBB59 accent4 #8064A2 accent5 #4BACC6 accent6 #F79646 hlink #0000FF folHlink #800080
- clrMap: bg1→lt1 tx1→dk1 bg2→lt2 tx2→dk2
- Theme fonts: major Calibri, minor Calibri; embedded: no

## Layout patterns (geometry variants per background archetype — adapt,
don't copy 1:1: keep bounds logic, replace texts/colors with your content)

### «image1.png» — pattern from slide 1 (3 els)
- image image1.png [0,0,1280,720]
- shape rect [60,280,1160,120]
- text [60,280,1160,120] 54.0pt b Calibri #FFFFFF «Клон эталона»

### «theme» — pattern from slide 2 (1 els)
- table [60,100,700,240]

## Media (1): background 1 · decor 0 · content 0 · unrenderable 0

Class: **background** — page background (p:bg or full-bleed, use only as background); **decor** — has alpha (can overlay); **content** — opaque non-background; **unrenderable** — svg/wmf/emf/wdp. Files are `media/<name>` bit-for-bit; the table below carries class, px size and where-used.

## Archetypes

- image1.png: slide 1
- theme: slide 2
