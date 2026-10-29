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

## Типовые слайды — эталоны стиля и размещения декора

Реальная геометрия шаблона (общая для обеих тем — примеры собраны на
dark; цвета и фон берите из описания вашей темы выше). Это эталоны
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

## Styles and agent-authored decor

Fonts, text styles and empty layout placeholders come from the selected proto.
The agent creates logos and visual examples explicitly. For semantic SVG markers
and 3D/hero visuals use assets from `decor/CATALOG.md` when useful, or assets
supplied by the user or created by the agent.
