# SU templates — proto roles, backgrounds and agent-authored decor

## Фоны для `--theme dark|light`

Для CREATE с темой фон наследуется через `proto`; добавлять фоновую картинку
на страницу не нужно. Выбирайте proto по содержанию и описанию ниже.
Логотип и decor агент добавляет самостоятельно отдельными элементами.

### Тёмная тема (`--theme dark`)

| Роль | Описание | proto |
|---|---|---|
| cover | Зелёно-голубое свечение слева снизу; правая часть свободна для крупного заголовка. | 1 |
| content | Мягкое свечение слева; центр и правая часть — для основного контента. | 22–28, 32, 34–43, 50–53 |
| two-columns | Свечение справа; левая колонка — текст, правая — hero/визуал. | 33 |
| divider | Холодное свечение справа сверху; центр свободен для короткого названия раздела. | 18–21 |
| closing | Свечение снизу; верх и центр — для финального тезиса и CTA. | 56 |
| chart | Широкое свечение сверху; нижняя часть приглушена для charts и data. | 47–49 |
| table | Свечение сверху слева; ровная нижняя область для таблиц. | 44–46 |
| quote | Мягкое свечение сверху; минимум визуального шума для цитаты. | 30, 31 |
| accent | Свечение слева сверху; для showcase и акцентных карточек. | 2, 3 |

### Светлая тема (`--theme light`)

| Роль | Описание | proto |
|---|---|---|
| cover | Зелёно-жёлтое свечение слева; правая часть — для заголовка. | 1 |
| content | Холодное свечение справа сверху; центр и нижняя часть — для контента. | 23–29, 33, 34, 37–44, 51–53 |
| two-columns | Свечение слева; правая часть нейтральна для визуала. | 35, 36 |
| divider | Свечение слева снизу; центр — для короткого названия раздела. | 18–22 |
| closing | Холодное свечение слева снизу; верх и центр — для CTA. | 57 |
| chart | Широкое свечение сверху; нижняя часть — для charts и data. | 48–50 |
| table | Мягкое холодное свечение справа сверху; для таблиц. | 45–47 |
| quote | Мягкое свечение справа сверху; для цитаты и короткого тезиса. | 31, 32 |
| accent | Широкое свечение сверху; для showcase и акцентных карточек. | 2, 3 |

Машинное соответствие `proto → роль → файл`: `../backgrounds/backgrounds.json`.

## Proto roles

| proto | dark | light |
|---|---|---|
| 1 | cover | cover |
| 2 | content showcase | content showcase |
| 3 | content showcase | content showcase |
| 18 | divider cover | divider cover |
| 19 | divider cover | divider cover |
| 20 | content | divider cover |
| 21 | content | divider cover |
| 22 | content | divider cover |
| 23 | content | content |
| 24 | content | content |
| 25 | content | content |
| 26 | content | content |
| 27 | content | content |
| 28 | content | content |
| 29 | — | content |
| 30 | content quote | — |
| 31 | content quote | content quote |
| 32 | — | content quote |
| 33 | content photo | content |
| 34 | content | content |
| 35 | content | content photo |
| 36 | content | content photo |
| 37 | content | content |
| 38 | content | content |
| 39 | content | content |
| 40 | content | content |
| 41 | content | content |
| 42 | content | content |
| 43 | content | content |
| 44 | table | content cards-4 |
| 45 | table (dark background) | table |
| 46 | table | table |
| 47 | content | table |
| 48 | chart | chart |
| 49 | chart | chart |
| 50 | chart | chart |
| 51 | content stat | content stat |
| 52 | content stat | content stat |
| 53 | content | content |
| 56 | content closing | — |
| 57 | — | content closing |

## Цвета и шрифты

### Тёмная тема (`--theme dark`)

- Fonts: SB Sans Text Light ×316, SB Sans Display Semibold ×217,
  SB Sans Display ×180, SB Sans Text ×110, SB Sans Display Light ×82,
  SB Sans Text Semibold ×16, SBSansDisplay-Light ×7.
- Font sizes: 14 ×307, 12 ×115, 18 ×105, 36 ×101, 11 ×88, 8 ×42,
  10 ×30, 48 ×29, 16 ×24, 28 ×17, 20 ×12, 9 ×10.
- Text colors: #FFFFFF ×778, #62ECFF ×36, #56FF71 ×33, #000000 ×16,
  #BFBFBF ×15, #333F48 ×5, #FF3256 ×5, #000333 ×2.
- Shape fills: #000000 ×334, #FFFFFF ×255, #FFFFFF26 ×14, #56FF71 ×13,
  #62ECFF ×4, #FFFFFF21 ×4, #1032A1 ×1, #0882FF ×1, #ADFFC6 ×1,
  #BAFFFB ×1, #FF3256 ×1, #50FA38 ×1.
- Gradients: 359.9° #5BFC1F→#0FDEF7; 45° #F1F3FF33→#FFFFFF0D;
  45° #F1F3FF33→#FFFFFF00; ?° #A0E72019→#4BE87B29→#42E3B447→#7AC0FF4F;
  210° #F1F3FF33→#FFFFFF00; ?° #64E9E900→#64E9E9; 230° #56FF71→#56FF71;
  ?° #64E9E900→#64E9E9; 175° #56FF71→#000000; 175° #62ECFF→#000000;
  175° #1532A1→#000000; 290° #FFFFFF26→#FFFFFF33.
- Theme: dk1 #000000, lt1 #FFFFFF, dk2 #0D0658, lt2 #ED692B,
  accent1 #00ADEE, accent2 #20BA71, accent3 #A0E720, accent4 #2F97AD,
  accent5 #64E9E9, accent6 #FAED00, hlink #33AC8B, folHlink #00A523.
- clrMap: bg1→lt1, tx1→dk1, bg2→lt2, tx2→dk2.
- Theme fonts: major SB Sans Display, minor SB Sans Text; embedded: yes.

### Светлая тема (`--theme light`)

- Fonts: SB Sans Text Light ×315, SB Sans Display Semibold ×226,
  SB Sans Display ×175, SB Sans Text ×102, SB Sans Display Light ×82,
  SB Sans Text Semibold ×22, SBSansDisplay-Light ×7, Calibri ×2.
- Font sizes: 14 ×306, 12 ×115, 36 ×108, 18 ×107, 11 ×88, 8 ×35,
  48 ×31, 10 ×30, 16 ×24, 28 ×17, 20 ×12, 9 ×10.
- Text colors: #2A3238 ×734, #323E48 ×55, #000000 ×40, #01E0FF ×19,
  #56FF71 ×19, #FFFFFF ×8, #62ECFF ×7, #333F48 ×5, #FF3256 ×5, #000333 ×2.
- Shape fills: #000000 ×593, #52F46C26 ×11, #01E0FF1A ×8, #FFFFFF ×6,
  #01E0FF ×6, #56FF71 ×4, #62ECFF ×4, #01E0FF26 ×4, #2A3238 ×3,
  #2A323812 ×3, #00E0FF ×1, #283438 ×1.
- Gradients: 359.9° #5BFC1F→#0FDEF7;
  ?° #A0E72019→#4BE87B29→#42E3B447→#7AC0FF4F; ?° #FFFFFF→#FFFFFF00;
  ?° #9DFFBB→#FFFFFF; ?° #55FF7000→#01E0FF; 230° #56FF71→#56FF71;
  175° #56FF71→#FFFFFF; 175° #62ECFF→#FFFFFF; 175° #FF3256→#FFFFFF;
  290° #FFFFFF26→#FFFFFF33.
- Theme: dk1 #000000, lt1 #FFFFFF, dk2 #283438, lt2 #FFFFFF,
  accent1 #56FF71, accent2 #5CFF8D, accent3 #00E0FF, accent4 #61ECFF,
  accent5 #55FF70, accent6 #5CFF8D, hlink #0563C1, folHlink #954F72.
- clrMap: bg1→lt1, tx1→dk1, bg2→lt2, tx2→dk2.
- Theme fonts: major Calibri Light, minor Calibri; embedded: no.

## Типовые слайды — эталоны стиля и размещения декора

Реальная геометрия шаблона (dark-примеры и отдельные светлые cover/closing;
цвета и фон берите из описания вашей темы выше). Это эталоны
СТИЛЯ и размещения декора: контент — ваш; композицию можно адаптировать
под контент (check подтвердит вместимость), но позиции декора держите
как здесь. Копия 1:1 с чужими текстами — плохо; повторное размещение — норма.
Номера proto — из таблицы вашей темы (порядок типов совпадает). Примеры
предназначены для самостоятельного размещения агентом и не наследуются через
`--theme`.

Правила декора, видимые в примерах:
- логотип SberUser всегда левый верхний угол — декор и текст его не перекрывают;
- кольцо/тор (`decor/blobs/…`) — в углу, обрезано краем; на обложке и финале — крупное;
- блобы/свечения — по краям и углам, полупрозрачные, не за текстом и не в центре;
- крупные 3D-объекты (звезда, сердца, робот) — только обложка/разделители/финал, правая половина;
- пиктограммы — только в мелких бейджах слева от текста (32–64px), одним стилем на слайд;
- мелкие акценты (точки/звёздочки) — 1–3 шт рядом с крупным декором;
- файлы каталога — всегда декор, никогда не главный визуал слайда.

### proto 1 — cover — заголовок слева, крупная 3D-иллюстрация справа
```json
{"pageType": "cover", "proto": 1,
 "elements": [
  {"type": "image", "src": "decor/blobs/image23.png", "bounds": [407, -749, 1387, 1387], "bleed": true, "rotation": 203.38},
  {"type": "text", "id": "5-t", "bounds": [84, 321, 526, 182], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 60, "b": true, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "6-t", "bounds": [88, 535, 134, 68], "paragraphs": [{"runs": [{"text": "2026", "sz": 36, "font": "SB Sans Display Light", "color": "#FFFFFF"}]}]},
  {"type": "image", "src": "decor/other/image25.png", "bounds": [820, 127, 74, 77], "rotation": 111.57}
 ]}
```

### proto 18 — divider — фирменный тор со звездой, правая половина
```json
{"pageType": "divider", "proto": 18,
 "elements": [
  {"type": "text", "id": "6-t", "bounds": [44, 386, 546, 151], "anchor": "ctr", "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 48, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "image", "src": "decor/illustrations/image180.png", "bounds": [640, 109, 775, 720], "bleed": true}
 ]}
```

### proto 21 — divider, минимальный — один 3D-акцент в правом нижнем углу
```json
{"pageType": "divider", "proto": 21,
 "elements": [
  {"type": "text", "id": "2", "bounds": [44, 386, 546, 151], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 48, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]}
 ]}
```

### proto 22 — content — текст слева + нумерованная карточка 01–04 справа
```json
{"pageType": "content", "proto": 22,
 "elements": [
  {"type": "image", "src": "decor/blobs/image23.png", "bounds": [719, -777, 1296, 1296], "bleed": true, "rotation": 207.85},
  {"type": "text", "id": "2-t", "bounds": [45, 83, 682, 68], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 36, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "3-t", "bounds": [48, 151, 403, 68], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Display", "color": "#FFFFFF"}]}]},
  {"type": "shape", "id": "12", "shape": "roundRect", "adjustments": [8165], "bounds": [740, 129, 482, 514], "fill": {"gradient": {"angle": 45, "stops": [[0, "#F1F3FF33"], [1, "#FFFFFF00"]]}}},
  {"type": "text", "id": "4-t", "bounds": [878, 161, 308, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}], "spcAft": 3}]},
  {"type": "text", "id": "8", "bounds": [774, 161, 149, 83], "paragraphs": [{"runs": [{"text": "01", "sz": 48, "font": "SB Sans Display Semibold", "color": {"angle": 359.9, "stops": [[0, "#5BFC1F"], [1, "#0FDEF7"]]}}]}]},
  {"type": "text", "id": "5-t", "bounds": [879, 281, 308, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "9", "bounds": [774, 281, 154, 83], "paragraphs": [{"runs": [{"text": "02", "sz": 48, "font": "SB Sans Display Semibold", "color": {"angle": 359.9, "stops": [[0, "#5BFC1F"], [1, "#0FDEF7"]]}}]}]},
  {"type": "text", "id": "6-t", "bounds": [878, 400, 323, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}], "spcAft": 3}]},
  {"type": "text", "id": "10", "bounds": [774, 400, 159, 83], "paragraphs": [{"runs": [{"text": "03", "sz": 48, "font": "SB Sans Display Semibold", "color": {"angle": 359.9, "stops": [[0, "#5BFC1F"], [1, "#0FDEF7"]]}}]}]},
  {"type": "text", "id": "7-t", "bounds": [878, 520, 310, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}], "spcAft": 3}]},
  {"type": "text", "id": "11", "bounds": [774, 520, 159, 83], "paragraphs": [{"runs": [{"text": "04", "sz": 48, "font": "SB Sans Display Semibold", "color": {"angle": 359.9, "stops": [[0, "#5BFC1F"], [1, "#0FDEF7"]]}}]}]},
  {"type": "text", "id": "13-t", "bounds": [58, 244, 537, 349], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text", "color": "#FFFFFF"}]}, {"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text", "color": "#FFFFFF"}]}]},
  {"type": "image", "src": "decor/blobs/image184.png", "bounds": [575, 521, 310, 310], "bleed": true, "rotation": 26.49}
 ]}
```

### proto 24 — content — икон-лист 2×3 с пиктограммами
```json
{"pageType": "content", "proto": 24,
 "elements": [
  {"type": "text", "id": "4-t", "bounds": [168, 281, 341, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "5-t", "bounds": [168, 394, 300, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "6-t", "bounds": [168, 512, 300, 55], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "7-t", "bounds": [45, 83, 682, 68], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 36, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "8-t", "bounds": [48, 151, 403, 68], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Display", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "14-t", "bounds": [727, 280, 300, 55], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "15-t", "bounds": [727, 394, 300, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "16-t", "bounds": [727, 511, 314, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text", "color": "#FFFFFF"}]}]}
 ]}
```

### proto 30 — content — главная мысль / цитата крупно
```json
{"pageType": "content", "proto": 30,
 "elements": [
  {"type": "text", "id": "4", "bounds": [273, 346, 1016, 126], "bleed": true, "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 72, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "5", "bounds": [146, 243, 820, 122], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 72, "font": "SB Sans Display Semibold", "color": {"angle": 359.9, "stops": [[0, "#5BFC1F"], [1, "#0FDEF7"]]}}]}]}
 ]}
```

### proto 33 — content — текст слева + фото справа со скруглением
```json
{"pageType": "content", "proto": 33,
 "elements": [
  {"type": "text", "id": "2-t", "bounds": [45, 83, 682, 68], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 36, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "6-t", "bounds": [48, 151, 403, 68], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Display", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "7-t", "bounds": [49, 251, 509, 145], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Display", "color": "#FFFFFF"}]}]}
 ]}
```

### proto 41 — content — три тёмные карточки с 3D-иконками
```json
{"pageType": "content", "proto": 41,
 "elements": [
  {"type": "text", "id": "3-t", "bounds": [45, 83, 819, 68], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 36, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "7-t", "bounds": [48, 151, 403, 68], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Display", "color": "#FFFFFF"}]}]},
  {"type": "shape", "id": "2", "shape": "roundRect", "adjustments": [12004], "bounds": [46, 250, 372, 348], "fill": {"gradient": {"angle": 210, "stops": [[0, "#F1F3FF33"], [1, "#FFFFFF00"]]}}},
  {"type": "shape", "id": "11", "shape": "roundRect", "adjustments": [11431], "bounds": [456, 250, 370, 348], "fill": {"gradient": {"angle": 210, "stops": [[0, "#F1F3FF33"], [1, "#FFFFFF00"]]}}},
  {"type": "shape", "id": "12", "shape": "roundRect", "adjustments": [11717], "bounds": [864, 250, 370, 348], "fill": {"gradient": {"angle": 210, "stops": [[0, "#F1F3FF33"], [1, "#FFFFFF00"]]}}},
  {"type": "text", "id": "13", "bounds": [72, 454, 334, 95], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "14", "bounds": [485, 454, 334, 95], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "15", "bounds": [890, 454, 334, 95], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]}
 ]}
```

### proto 26 — data — три больших %
```json
{"pageType": "content", "proto": 26,
 "elements": [
  {"type": "text", "id": "2-t", "bounds": [45, 83, 663, 68], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 36, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "4-t", "bounds": [115, 415, 317, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "7", "bounds": [113, 293, 241, 134], "paragraphs": [{"runs": [{"text": "70%", "sz": 80, "font": "SB Sans Display Semibold", "color": {"angle": 359.9, "stops": [[0, "#5BFC1F"], [1, "#0FDEF7"]]}}]}]},
  {"type": "text", "id": "8", "bounds": [497, 293, 272, 134], "paragraphs": [{"runs": [{"text": "55", "sz": 80, "font": "SB Sans Display Semibold", "color": {"angle": 359.9, "stops": [[0, "#5BFC1F"], [1, "#0FDEF7"]]}}]}]},
  {"type": "text", "id": "9", "bounds": [881, 293, 239, 134], "paragraphs": [{"runs": [{"text": "21", "sz": 80, "font": "SB Sans Display Semibold", "color": {"angle": 359.9, "stops": [[0, "#5BFC1F"], [1, "#0FDEF7"]]}}]}]},
  {"type": "text", "id": "11-t", "bounds": [48, 151, 403, 68], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Display", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "12-t", "bounds": [507, 415, 317, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "13-t", "bounds": [889, 415, 317, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]},
  {"type": "image", "src": "decor/blobs/image188.png", "bounds": [-656, 237, 1296, 1296], "bleed": true, "rotation": 30.04},
  {"type": "image", "src": "decor/blobs/image189.png", "bounds": [604, -737, 1296, 1296], "bleed": true, "rotation": 209.28}
 ]}
```

### proto 27 — data — цветные большие числа (негатив/нейтрально/позитив)
```json
{"pageType": "content", "proto": 27,
 "elements": [
  {"type": "text", "id": "2-t", "bounds": [45, 83, 663, 68], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 36, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "4-t", "bounds": [909, 415, 317, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "7", "bounds": [907, 293, 241, 134], "paragraphs": [{"runs": [{"text": "99%", "sz": 80, "font": "SB Sans Display Semibold", "color": "#56FF71"}]}]},
  {"type": "text", "id": "11-t", "bounds": [48, 151, 582, 39], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Display", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "8", "bounds": [481, 293, 272, 134], "paragraphs": [{"runs": [{"text": "5", "sz": 80, "font": "SB Sans Display Semibold", "color": "#62ECFF"}]}]},
  {"type": "text", "id": "12-t", "bounds": [490, 415, 317, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "9", "bounds": [55, 293, 239, 134], "paragraphs": [{"runs": [{"text": "10%", "sz": 80, "font": "SB Sans Display Semibold", "color": "#FF3256"}]}]},
  {"type": "text", "id": "13-t", "bounds": [62, 415, 317, 78], "paragraphs": [{"runs": [{"text": "Текст", "sz": 14, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]}
 ]}
```

### proto 56 — closing — благодарность + 3D-сердца справа
```json
{"pageType": "closing", "proto": 56,
 "elements": [
  {"type": "image", "src": "decor/blobs/image23.png", "bounds": [417, -557, 1296, 1296], "bleed": true, "rotation": 209.28},
  {"type": "image", "src": "decor/icons3d/image243.png", "bounds": [618, 414, 312, 272], "rotation": 343.35},
  {"type": "image", "src": "decor/icons3d/image244.png", "bounds": [783, 211, 375, 327], "rotation": 12.44},
  {"type": "text", "id": "2-t", "bounds": [45, 118, 435, 151], "anchor": "ctr", "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 48, "font": "SB Sans Display Semibold", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "3-t", "bounds": [48, 274, 251, 39], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Text Light", "color": "#FFFFFF"}]}]},
  {"type": "shape", "id": "6", "shape": "roundRect", "adjustments": [8165], "bounds": [58, 448, 290, 214], "fill": {"gradient": {"angle": 45, "stops": [[0, "#F1F3FF33"], [1, "#FFFFFF00"]]}}},
  {"type": "text", "id": "7-t", "bounds": [71, 513, 339, 61], "paragraphs": [{"runs": [{"text": "Текст", "sz": 16, "font": "SB Sans Text", "color": "#FFFFFF"}]}]},
  {"type": "text", "id": "11-t", "bounds": [71, 597, 90, 39], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Text Light", "color": "#56FF71"}]}]},
  {"type": "text", "id": "12-t", "bounds": [241, 597, 90, 39], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Text Light", "color": "#56FF71"}]}]},
  {"type": "image", "src": "decor/other/image25.png", "bounds": [598, 186, 74, 77], "rotation": 111.57}
 ]}
```

## Светлая тема: cover и closing

### proto 1 — cover, светлый фон и текст `#2A3238`
```json
{"pageType": "cover", "proto": 1,
 "elements": [
  {"type": "image", "src": "decor/blobs/image23.png", "bounds": [627, -154, 803, 804], "bleed": true},
  {"type": "text", "id": "5-t", "bounds": [84, 321, 526, 182], "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 60, "b": true, "font": "SB Sans Display Semibold", "color": "#2A3238"}]}]},
  {"type": "text", "id": "6-t", "bounds": [88, 535, 134, 68], "paragraphs": [{"runs": [{"text": "2026", "sz": 36, "font": "SB Sans Display Light", "color": "#2A3238"}]}]},
  {"type": "image", "src": "decor/illustrations/image180.png", "bounds": [680, 214, 722, 643], "bleed": true},
  {"type": "image", "src": "decor/other/image25.png", "bounds": [1114, 73, 74, 77], "rotation": 111.57}
 ]}
```

### proto 57 — closing, светлый фон и текст `#2A3238`
```json
{"pageType": "closing", "proto": 57,
 "elements": [
  {"type": "image", "src": "decor/blobs/image23.png", "bounds": [674, -254, 803, 804], "bleed": true},
  {"type": "image", "src": "decor/icons3d/image243.png", "bounds": [618, 414, 312, 272], "rotation": 343.35},
  {"type": "image", "src": "decor/icons3d/image244.png", "bounds": [783, 211, 375, 327], "rotation": 12.44},
  {"type": "text", "id": "6-t", "bounds": [45, 118, 435, 151], "anchor": "ctr", "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 48, "font": "SB Sans Display Semibold", "color": "#2A3238"}]}]},
  {"type": "text", "id": "7-t", "bounds": [48, 274, 251, 39], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Text Light", "color": "#2A3238"}]}]},
  {"type": "shape", "id": "11", "shape": "roundRect", "adjustments": [8165], "bounds": [58, 448, 290, 214], "fill": {"solid": "#2A323812"}},
  {"type": "text", "id": "12-t", "bounds": [71, 513, 339, 61], "paragraphs": [{"runs": [{"text": "Текст", "sz": 16, "font": "SB Sans Text", "color": "#2A3238"}]}]},
  {"type": "text", "id": "15-t", "bounds": [71, 597, 90, 39], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Text Light", "color": "#01E0FF"}]}]},
  {"type": "text", "id": "16-t", "bounds": [241, 597, 90, 39], "paragraphs": [{"runs": [{"text": "Текст", "sz": 18, "font": "SB Sans Text Light", "color": "#01E0FF"}]}]},
  {"type": "image", "src": "decor/other/image25.png", "bounds": [598, 186, 74, 77], "rotation": 111.57}
 ]}
```

## Styles and agent-authored decor

Fonts, text styles and empty layout placeholders come from the selected proto.
The agent creates logos and visual examples explicitly. For semantic SVG markers
and 3D/hero visuals use assets from `decor/CATALOG.md` when useful, or assets
supplied by the user or created by the agent.
