# Examples — свободная композиция без шаблона SU (CREATE без --theme)

Дека собирается на пустом пакете: фон, палитра, шрифты и декор — полностью
ваши, из брифа пользователя. Этот файл — ПРИМЕРЫ, а не обязательства:
геометрию, формы, цвета и шрифты меняйте под стиль задачи; примеры лишь
дают проверенную вместимость (limits) и уровень плотности. `check`
подтверждает вместимость — не считайте в уме.

Дефолты, если бриф молчит: шрифт SB Sans Text / SB Sans Display; фон белый
или тёмный по смыслу темы; один акцентный цвет + нейтральные. Канвас
1280×720, поля 60px, заголовки 28–32pt bold, тело 14–16pt, между
блоками ≥16px. Линия = тонкий `rect` (h=2). Скругления: `adjustments`
6000/25000/50000. Тени: none|soft|lift.

## Палитра ходов — чем может быть страница

- Текст: sz/b/i/color/font на каждом run; align l/ctr/r; anchor t/ctr/b;
  spcBef/spcAft; буллеты `bullet: "char"`.
- Фигуры: 21 пресет (rect, roundRect, ellipse, arrows, chevron, pie, donut,
  star5… — spec.md §4) в любых ролях: карточки, табы, маркеры, рамки,
  стрелки потока, ленты-полосы, скобки-боксы.
- Заливки: solid (hex + alpha), градиент (2–4 стопа, angle), none.
- Картинки: srcRect-кроп (пропорции не менять), тень, opacity, flip.
- Таблицы и нативные чарты (bar/line/pie/doughnut) с явными цветами серий.

## Что под какой контент

| Контент | Пример ниже | Не надо |
|---|---|---|
| Титул | cover-left или cover-hero | — |
| 3–4 параллельных тезиса | cards-tabs | timeline (нет порядка) |
| Метрики/числа | stat-rail | карточки (тонут) |
| Процесс/этапы по порядку | steps-flow | карточки |
| История с визуалом | two-columns | — |
| Ключевая мысль/цитата | quote-editorial | — |
| Финал | closing-cta | — |

## cover-left — титул, редакционная подача (тёмный)

```json
{
  "pageType": "cover",
  "background": {"type": "solid", "color": "#101828"},
  "elements": [
    {"type": "shape", "id": "rule", "shape": "rect", "bounds": [90, 250, 72, 4], "fill": {"solid": "#F2C14E"}},
    {"type": "text", "id": "title", "bounds": [88, 280, 900, 100],
     "paragraphs": [{"runs": [{"text": "Название презентации", "sz": 44, "b": true, "color": "#FFFFFF"}]}]},
    {"type": "text", "id": "sub", "bounds": [90, 400, 700, 40],
     "paragraphs": [{"runs": [{"text": "Подзаголовок — одна строка", "sz": 18, "color": "#98A2B3"}]}]}
  ]
}
```
Limits: title ≤ 40, sub ≤ 60. Маркер — короткая полоса, не круг.

## cover-hero — титул с крупной цифрой (светлый)

```json
{
  "pageType": "cover",
  "background": {"type": "solid", "color": "#F7F6F2"},
  "elements": [
    {"type": "text", "id": "kicker", "bounds": [90, 120, 700, 30],
     "paragraphs": [{"runs": [{"text": "КОНТЕКСТ", "sz": 13, "b": true, "color": "#7A6C5D"}]}]},
    {"type": "text", "id": "title", "bounds": [88, 160, 950, 90],
     "paragraphs": [{"runs": [{"text": "Тема", "sz": 40, "b": true, "color": "#1B1B1B"}]}]},
    {"type": "text", "id": "hero", "bounds": [86, 300, 700, 160],
     "paragraphs": [{"runs": [{"text": "−38%", "sz": 96, "b": true, "color": "#B85042"}]}]},
    {"type": "text", "id": "hero-lab", "bounds": [90, 480, 640, 60],
     "paragraphs": [{"runs": [{"text": "подпись к цифре", "sz": 16, "color": "#4A4A4A"}]}]}
  ]
}
```
Limits: hero ≤ 6 chars при 96pt; между hero и подписью ≥20px.

## cards-tabs — три карточки с квадратными табами (нейтральный светлый)

```json
{
  "pageType": "content",
  "background": {"type": "solid", "color": "#FFFFFF"},
  "elements": [
    {"type": "text", "id": "title", "bounds": [60, 104, 1100, 56],
     "paragraphs": [{"runs": [{"text": "Заголовок слайда", "sz": 28, "b": true, "color": "#14213D"}]}]},
    {"type": "shape", "id": "card1", "shape": "roundRect", "adjustments": [6000], "bounds": [60, 210, 360, 380], "fill": {"solid": "#F1F4F8"}, "line": {"w": 1, "color": "#D8DEE9"}},
    {"type": "shape", "id": "tab1", "shape": "roundRect", "adjustments": [0], "bounds": [84, 238, 56, 56], "fill": {"solid": "#1F6FEB"}},
    {"type": "text", "id": "tab1-n", "bounds": [84, 238, 56, 56], "anchor": "ctr",
     "paragraphs": [{"align": "ctr", "runs": [{"text": "01", "sz": 20, "b": true, "color": "#FFFFFF"}]}]},
    {"type": "text", "id": "c1-title", "bounds": [84, 318, 312, 68],
     "paragraphs": [{"runs": [{"text": "Тезис", "sz": 18, "b": true, "color": "#14213D"}]}]},
    {"type": "text", "id": "c1-body", "bounds": [84, 394, 312, 150],
     "paragraphs": [{"runs": [{"text": "Пояснение в две-три спокойные строки.", "sz": 14, "color": "#3E4C63"}]}]}
  ]
}
```
Остальные карточки: x = 460 / 860, те же y/w/h. Limits: cN-title ≤ 27,
cN-body ≤ 28/line (≤5 строк). Табы — квадратные; форма таба произвольна
(квадрат/сквош/рамка), но одна на всю деку.

## stat-rail — числа с боковой рейкой (тёмный «премиум»)

```json
{
  "pageType": "content",
  "background": {"type": "solid", "color": "#0E0F13"},
  "elements": [
    {"type": "text", "id": "title", "bounds": [60, 104, 1100, 56],
     "paragraphs": [{"runs": [{"text": "Итоги", "sz": 28, "b": true, "color": "#F5F5F5"}]}]},
    {"type": "shape", "id": "rail", "shape": "rect", "bounds": [60, 220, 4, 360], "fill": {"solid": "#C9A227"}},
    {"type": "text", "id": "n1", "bounds": [96, 230, 300, 90],
     "paragraphs": [{"runs": [{"text": "2.4×", "sz": 56, "b": true, "color": "#C9A227"}]}]},
    {"type": "text", "id": "n1-lab", "bounds": [96, 336, 300, 56],
     "paragraphs": [{"runs": [{"text": "подпись метрики", "sz": 14, "color": "#9AA0A8"}]}]},
    {"type": "text", "id": "n2", "bounds": [460, 230, 300, 90],
     "paragraphs": [{"runs": [{"text": "118", "sz": 56, "b": true, "color": "#F5F5F5"}]}]},
    {"type": "text", "id": "n2-lab", "bounds": [460, 336, 300, 56],
     "paragraphs": [{"runs": [{"text": "подпись", "sz": 14, "color": "#9AA0A8"}]}]}
  ]
}
```
Третья метрика: x = 824. Limits: число ≤ 7 chars при 56pt; рельс — тонкая
вертикальная полоса слева от первой метрики.

## steps-flow — этапы со стрелками-chevron (светлый)

```json
{
  "pageType": "content",
  "background": {"type": "solid", "color": "#FBFBFD"},
  "elements": [
    {"type": "text", "id": "title", "bounds": [60, 104, 1100, 56],
     "paragraphs": [{"runs": [{"text": "Этапы", "sz": 28, "b": true, "color": "#22223B"}]}]},
    {"type": "shape", "id": "st1", "shape": "chevron", "bounds": [80, 300, 260, 90], "fill": {"solid": "#4353FF"}},
    {"type": "text", "id": "st1-t", "bounds": [96, 300, 220, 90], "anchor": "ctr",
     "paragraphs": [{"align": "ctr", "runs": [{"text": "Шаг первый", "sz": 16, "b": true, "color": "#FFFFFF"}]}]},
    {"type": "shape", "id": "st2", "shape": "chevron", "bounds": [380, 300, 260, 90], "fill": {"solid": "#6C7BFF"}},
    {"type": "text", "id": "st2-t", "bounds": [396, 300, 220, 90], "anchor": "ctr",
     "paragraphs": [{"align": "ctr", "runs": [{"text": "Шаг второй", "sz": 16, "b": true, "color": "#FFFFFF"}]}]}
  ]
}
```
Дальше: x = 680 / 980, цвета той же линейки светлее. Limits: ≤ 14 chars
на шаг при 16pt; подписи под шевронами при необходимости (y=410, 12pt).

## two-columns — текст слева, визуал справа

```json
{
  "pageType": "content",
  "background": {"type": "solid", "color": "#FFFFFF"},
  "elements": [
    {"type": "text", "id": "title", "bounds": [60, 104, 1100, 56],
     "paragraphs": [{"runs": [{"text": "Заголовок", "sz": 28, "b": true, "color": "#101828"}]}]},
    {"type": "text", "id": "lead", "bounds": [60, 210, 560, 130],
     "paragraphs": [{"runs": [{"text": "Лид — два-три предложения.", "sz": 16, "color": "#475467"}]}]},
    {"type": "text", "id": "bullets", "bounds": [60, 370, 560, 220],
     "paragraphs": [
       {"bullet": "char", "bulletChar": "•", "runs": [{"text": "Первое", "sz": 14, "color": "#101828"}], "spcAft": 10},
       {"bullet": "char", "bulletChar": "•", "runs": [{"text": "Второе", "sz": 14, "color": "#101828"}], "spcAft": 10}
     ]},
    {"type": "image", "id": "visual", "src": "media/visual.png", "bounds": [680, 190, 540, 380], "shadow": "soft"}
  ]
}
```
Limits: lead ≤ 38/line (≤4 строки), буллет ≤ 38/line (≤2 строки на пункт).

## quote-editorial — цитата с крупной кавычкой-фигурой

```json
{
  "pageType": "content",
  "background": {"type": "solid", "color": "#F7F6F2"},
  "elements": [
    {"type": "text", "id": "mark", "bounds": [80, 140, 140, 170],
     "paragraphs": [{"runs": [{"text": "«", "sz": 96, "b": true, "color": "#B85042"}]}]},
    {"type": "text", "id": "quote", "bounds": [240, 290, 860, 130],
     "paragraphs": [{"runs": [{"text": "Ключевая мысль деки одной фразой", "sz": 30, "i": true, "color": "#1B1B1B"}]}]},
    {"type": "text", "id": "who", "bounds": [240, 450, 860, 30],
     "paragraphs": [{"runs": [{"text": "— Источник", "sz": 14, "color": "#7A6C5D"}]}]}
  ]
}
```
Limits: цитата ≤ 38/line (≤2 строки при 30pt).

## closing-cta — финал с кнопкой-пилюлей

```json
{
  "pageType": "closing",
  "background": {"type": "solid", "color": "#101828"},
  "elements": [
    {"type": "text", "id": "title", "bounds": [90, 280, 1100, 90],
     "paragraphs": [{"runs": [{"text": "Следующий шаг", "sz": 36, "b": true, "color": "#FFFFFF"}]}]},
    {"type": "shape", "id": "cta", "shape": "roundRect", "adjustments": [50000], "bounds": [90, 420, 260, 56], "fill": {"solid": "#F2C14E"}},
    {"type": "text", "id": "cta-t", "bounds": [90, 420, 260, 56], "anchor": "ctr",
     "paragraphs": [{"align": "ctr", "runs": [{"text": "Написать нам", "sz": 16, "b": true, "color": "#101828"}]}]}
  ]
}
```

## Правила комбинирования

- Один пример = один слайд; два примера на одном слайде не смешивать.
- Свободно менять: тексты, цвета, шрифты, формы маркеров/табов, геометрию
  (вместимость подтвердит check). Не менять: отступы-поля 60px и зазоры ≥16px.
- Таблица/чарт на контентном слайде: bounds [60, 190, 1160, 420] под заголовком.
- Иконки из `decor/CATALOG.md` — только слоты 32–64px, никогда не главный
  визуал; главный визуал — фото пользователя или gigachat_image (≤3 на деку).
