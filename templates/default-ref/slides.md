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

## Styles and agent-authored decor

Fonts, text styles and empty layout placeholders come from the selected proto.
The agent creates logos and visual examples explicitly. For semantic SVG markers
use only `decor/CATALOG.md`; for 3D/hero visuals use assets supplied by the user
or created by the agent.
