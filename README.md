# Агроінспектування

Статичний вебдодаток для створення агрономічного інспектування поля. Додаток працює без збірки, без npm-залежностей і може відкриватися як звичайний HTML-файл або через локальний HTTP-сервер.

## Що робить додаток

- Завантажує конфіг агроскаутингу з `data/agro-config.js` або `data/agro-config.json`.
- Дає агроному форму для заповнення базових даних інспекції.
- Показує параметри залежно від вибраної культури та періоду.
- Підбирає відповідний тип вводу: слайдер, чекбокси, select, пул хвороб/шкідників, блок бур'янів, блок дефектів сівби.
- Рахує статус звіту: зелений, жовтий, помаранчевий, червоний.
- Вимагає фото перед експортом: мінімум 2 фото + 1 фото за кожну сильну проблему.
- Експортує HTML-звіт, JSON для БД/API та CSV спостережень.

## Запуск

Найпростіший варіант:

```text
Відкрити index.html у браузері
```

Рекомендований варіант для розробки:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Після цього відкрити:

```text
http://127.0.0.1:8765/index.html
```

Якщо системного Python немає, можна використати будь-який локальний статичний сервер.

## Архітектура

Проєкт побудований як статичний додаток із глобальними browser-скриптами. Порядок підключення в `index.html` важливий: нижчі шари мають бути підключені раніше за верхні.

```text
index.html
  data/agro-config.js
  src/config/*
  src/domain/agronomy-rules.js
  src/reports/inspection-html-report.js
  src/references/*
  src/domain/inspection-domain.js
  src/ui/parameter-controls.js
  src/services/inspection-reporting.js
  src/core/inspection-app.js
```

## Структура файлів

```text
data/
  agro-config.json           Повний JSON-конфіг, згенерований з Excel.
  agro-config.js             Той самий конфіг як window.AGRO_CONFIG для запуску без fetch.

src/config/
  inspection-constants.js    Стабільні константи форми: id полів, групи бур'янів, назви колонок.
  runtime-fallbacks.js       Страхувальний fallback, якщо основні константи або правила не завантажились.

src/domain/
  agronomy-rules.js          Чисті агрономічні правила: labels, states, пороги, форматування.
  inspection-domain.js       Доменна логіка форми: класифікація параметрів, slider specs, score/state.

src/references/
  crop-reference.js          Довідник культур, періодів і параметрів для вибраної культури.
  disease-reference.js       Довідник хвороб за культурою.
  pest-reference.js          Довідник шкідників за культурою.
  weed-reference.js          Довідник інвазивних/злісних бур'янів.
  phase-reference.js         Довідник фенологічних фаз.

src/ui/
  parameter-controls.js      DOM-контроли параметрів: слайдери, чекбокси, select, фото.

src/services/
  inspection-reporting.js    Збір payload, валідація, прогрес, статуси, експорт HTML/JSON/CSV.

src/reports/
  inspection-html-report.js  HTML-шаблон експортованого звіту.

styles.css                   Візуальний стиль додатка.
index.html                   HTML-оболонка та порядок підключення скриптів.
```

## Потік даних

1. `src/core/inspection-app.js` створює `state` і запускає `init()`.
2. `init()` бере `window.AGRO_CONFIG`, визначає `fieldMap`, наповнює списки культур/періодів і викликає `renderAll()`.
3. `src/references/*` повертають довідникові значення для культур, фаз, хвороб, шкідників і бур'янів.
4. `src/domain/inspection-domain.js` вирішує, який тип контролу потрібен кожному параметру.
5. `src/ui/parameter-controls.js` будує DOM і записує відповіді в `state.responses`.
6. `src/services/inspection-reporting.js` збирає нормалізований payload через `collectInspection()`.
7. Експорт використовує той самий payload, тому HTML/JSON/CSV мають однаковий `inspection_id`.

## Головні об'єкти

`state` у `src/core/inspection-app.js`:

- `config` - активний конфіг із `data/agro-config.js`.
- `inspectionId` - стабільний ID поточного звіту.
- `responses` - відповіді по параметрах.
- `photos` - фото, прочитані як `dataUrl`.

`inspection` у payload:

- `inspection_id`
- `agronomist`
- `date`
- `field`
- `area`
- `crop`
- `period`
- `operation_risk`
- `summary_comment`
- `summary_status` під час JSON-експорту

`observation` у payload:

- `parameter`
- `input_type`
- `score`
- `score_label`
- `score_state`
- `numeric_value`
- `unit`
- `choices`
- `weed_scores`
- `defect_values`
- `status`
- `distribution`
- `photo_rule`
- `business_meaning`

## Як додати нову культуру

1. Додати культуру в Excel/конфіг і перегенерувати `data/agro-config.json` та `data/agro-config.js`.
2. Перевірити, що культура з'явилась у `parameters`, `phases`, `diseases`, `pests`, `weeds`.
3. Якщо для культури потрібні власні діапазони висоти, густоти, вологості зерна або глибини висіву, додати їх у відповідний spec у `src/domain/inspection-domain.js`.
4. Запустити перевірки з розділу "Quality checklist".

## Як додати новий тип параметра

1. Додати рядок у конфіг.
2. Якщо достатньо select/checkbox/універсального слайдера, змін у коді може не бути.
3. Якщо потрібен спеціальний control:
   - додати класифікатор `is...()` у `src/domain/inspection-domain.js`;
   - додати spec або score/state логіку;
   - додати renderer у `src/ui/parameter-controls.js`;
   - підключити renderer у `renderControls()` у `src/core/inspection-app.js`.

## Як працюють довідники

Довідники в `src/references` є окремим шаром доступу до конфіга. Це зроблено для масштабування:

- UI не читає `config.diseases` або `config.pests` напряму.
- Доменна логіка просить готові списки через `window.AgroReferences`.
- Якщо структура Excel-довідника зміниться, найчастіше треба правити один reference-файл, а не всю форму.

## Валідація й експорт

Експорт блокується, якщо `validate()` повертає хоча б один alert рівня `danger`.

Обов'язкові умови:

- заповнений агроном;
- дата;
- поле;
- площа;
- підсумковий ризик;
- короткий висновок;
- достатня кількість фото.

Правило фото:

```text
requiredPhotoCount = 2 + кількість observation зі state-bad або state-excess
```

## Quality checklist

Після будь-якого рефакторингу запускати:

```powershell
& 'C:\Users\pcmys\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check src\config\runtime-fallbacks.js
& 'C:\Users\pcmys\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check src\config\inspection-constants.js
& 'C:\Users\pcmys\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check src\domain\agronomy-rules.js
& 'C:\Users\pcmys\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check src\domain\inspection-domain.js
& 'C:\Users\pcmys\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check src\ui\parameter-controls.js
& 'C:\Users\pcmys\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check src\services\inspection-reporting.js
& 'C:\Users\pcmys\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check src\reports\inspection-html-report.js
```

Також перевірити:

- усі `<script src="...">` у `index.html` існують;
- `window.AGRO_CONFIG`, `window.AgroConstants`, `window.AgroRules`, `window.AgroReport`, `window.AgroReferences` створюються;
- у JSON/CSV/HTML одного звіту однаковий `inspection_id`;
- експорт недоступний, поки форма не заповнена і фото не додані.

## Архітектурні правила для майбутньої розробки

- Не додавати бізнес-правила в UI-файл.
- Не читати `config.diseases`, `config.pests`, `config.weeds`, `config.phases` напряму з UI.
- Нові довідники додавати в `src/references`.
- Нові агрономічні пороги додавати в `src/domain`.
- Нові DOM-контроли додавати в `src/ui`.
- Нові формати експорту додавати в `src/services` або `src/reports`.
- `inspection_id` має створюватися один раз на сесію заповнення.

