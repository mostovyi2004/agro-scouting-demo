// ============================================================================
// Агроскаутинг demo UI
// ----------------------------------------------------------------------------
// Файл навмисно лишається без фреймворку: демо можна відкрити як простий
// статичний сайт. Для масштабування у великий проєкт нижче логіка розділена
// на секції: стан, рендеринг, бізнес-правила, експорт і утиліти.
// ============================================================================

// Єдиний runtime-стан форми.
// Його тримаємо в одному об'єкті, щоб усі модулі працювали з однаковими даними:
// - config: довідники та параметри з agro-config;
// - inspectionId: стабільний ID поточного звіту, не перегенеровується при експорті;
// - responses: відповіді агронома по кожному параметру;
// - photos: завантажені фото у форматі dataUrl для прев'ю й HTML-звіту.
const state = {
  config: null,
  inspectionId: createInspectionId(),
  responses: {},
  photos: [],
};

// Короткий helper для доступу до DOM-елементів за id.
const byId = (id) => document.getElementById(id);

// Створює стабільний ID звіту на поточну сесію заповнення.
// Важливо: цей ID не можна генерувати всередині collectInspection(),
// бо тоді JSON/CSV/HTML експорти одного звіту отримають різні ідентифікатори.
function createInspectionId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Захисний шар: якщо допоміжні файли не підвантажились через кеш/шлях/file://,
// форма все одно стартує і заповнює базові списки з agro-config.
// Резервні константи потрібні, якщо окремий файл agro-constants.js не завантажився.
// У нормальному сценарії використовуються window.AgroConstants, але fallback дозволяє
// формі хоча б стартувати і показати базову структуру.
const fallbackConstants = {
  FIELD_IDS: ["agronomist", "inspectionDate", "fieldName", "fieldArea", "cropSelect", "periodSelect", "finalRisk", "summaryComment"],
  WEED_GROUPS: ["Однодольні", "Дводольні", "Інвазивні / злісні"],
  SOWING_DEFECTS: ["Пропуски", "Дублікати", "Нерівна відстань", "Загущення", "Механічне пошкодження"],
  BLOCKING_STATES: ["state-bad", "state-excess"],
  fieldMap: {
    crop: "Культура",
    period: "Період",
    parameter: "Параметр",
    inputType: "Тип вводу",
    values: "Значення / пул",
    unit: "Одиниця / шкала",
    photo: "Фото/коментар",
    business: "Бізнес-сенс",
  },
  moistureScale: [
    "Гострий дефіцит продуктивної вологи",
    "Виражений дефіцит вологи",
    "Недостатнє вологозабезпечення",
    "Помірно знижене вологозабезпечення",
    "Нижня межа оптимального стану",
    "Оптимальне вологозабезпечення",
    "Верхня межа оптимального стану",
    "Надлишкове зволоження орного шару",
    "Перезволоження з ризиком анаеробних умов",
    "Сильне перезволоження / локальне підтоплення",
  ],
};

// Резервні бізнес-правила. Основні правила приходять з agro-rules.js.
// Тут функції максимально прості: вони потрібні не для точного агрономічного аналізу,
// а щоб UI не падав, якщо основний файл правил недоступний.
const fallbackRules = {
  clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
  defectDensityLabel: (value) => `${value} шт/пог. м`,
  defectValueToScore: (value) => Math.min(5, Math.max(1, Math.ceil(Number(value || 0)))),
  formatNumber: (value) => Number(value).toLocaleString("uk-UA", { maximumFractionDigits: 1 }),
  grainMoistureLabel: (value) => `${value}%`,
  grainMoistureState: () => "state-watch",
  heightLabel: (value) => `${value} см`,
  heightState: () => "state-watch",
  maturityUniformityLabel: (value) => String(value),
  maturityUniformityState: () => "state-watch",
  moistureState: (value) => (Number(value) >= 5 && Number(value) <= 7 ? "state-good" : "state-watch"),
  problemState: (value) => (Number(value) <= 1 ? "state-good" : Number(value) <= 2 ? "state-watch" : "state-bad"),
  rangeLabel: (value, _range, low, good, high) => (Number(value) < _range[0] ? low : Number(value) <= _range[1] ? good : high),
  rangeState: () => "state-watch",
  rootPowerLabel: (value) => String(value),
  rootPowerState: () => "state-watch",
  shootsLabel: (value) => `${value} шт/рослину`,
  shootsState: () => "state-watch",
  soilStructureLabel: (value) => String(value),
  soilStructureState: () => "state-watch",
  temperatureLabel: (value) => `${value} °C`,
  temperatureState: () => "state-watch",
  thresholdScoreText: (value) => `${value} - рівень проблеми`,
  uniformityLabel: (value) => String(value),
  uniformityState: () => "state-watch",
};

// Після підключення скриптів беремо реальні константи/правила з window.
// Якщо їх немає, перемикаємось на fallback-шар вище.
const constants = window.AgroConstants || fallbackConstants;
const rules = window.AgroRules || fallbackRules;

const { FIELD_IDS, WEED_GROUPS, SOWING_DEFECTS, BLOCKING_STATES, fieldMap: configuredFieldMap, moistureScale } = constants;
const {
  clamp,
  defectDensityLabel,
  defectValueToScore,
  formatNumber,
  grainMoistureLabel,
  grainMoistureState,
  heightLabel,
  heightState,
  maturityUniformityLabel,
  maturityUniformityState,
  moistureState,
  problemState,
  rangeLabel,
  rangeState,
  rootPowerLabel,
  rootPowerState,
  shootsLabel,
  shootsState,
  soilStructureLabel,
  soilStructureState,
  temperatureLabel,
  temperatureState,
  thresholdScoreText,
  uniformityLabel,
  uniformityState,
} = { ...fallbackRules, ...rules };

// Дата за замовчуванням для нового огляду.
const today = new Date().toISOString().slice(0, 10);

// Поточна мапа колонок Excel-конфіга. Вона може уточнюватись у resolveFieldMap(),
// якщо назви колонок у файлі відрізняються від очікуваних.
let fieldMap = configuredFieldMap;

// Головна точка входу додатка.
// Завантажує конфіг, налаштовує мапу колонок, виставляє дату,
// наповнює базові списки, підписує події та запускає перший рендер.
async function init() {
  state.config = window.AGRO_CONFIG || (await fetch("data/agro-config.json").then((response) => response.json()));
  fieldMap = resolveFieldMap(state.config, configuredFieldMap);
  byId("inspectionDate").value = today;
  fillBaseLists();
  bindEvents();
  renderAll();
}

// Узгоджує очікувані назви колонок із фактичними ключами першого рядка конфіга.
// Це захищає UI від дрібних змін у Excel-експорті: якщо точна назва не знайдена,
// беремо колонку за позицією. Тому при зміні структури Excel важливо перевірити
// перший рядок parameters у data/agro-config.json.
function resolveFieldMap(config, preferredMap) {
  const firstRow = config?.parameters?.[0] || {};
  const keys = Object.keys(firstRow);
  const fallbackByPosition = {
    crop: keys[0],
    period: keys[1],
    parameter: keys[2],
    inputType: keys[3],
    values: keys[5],
    unit: keys[6],
    photo: keys[8],
    business: keys[9],
  };

  // Захист від регресії: якщо назви колонок у винесеному словнику не збіглись
  // із фактичним Excel-конфігом, беремо ключі з першого рядка таблиці.
  return Object.fromEntries(
    Object.entries(preferredMap).map(([name, preferredKey]) => [
      name,
      Object.prototype.hasOwnProperty.call(firstRow, preferredKey) ? preferredKey : fallbackByPosition[name],
    ])
  );
}

// Підписує всі DOM-події форми.
// Більшість полів просто викликають renderAll(), бо будь-яка зміна може вплинути
// на статус, прогрес, валідацію і доступність експорту.
function bindEvents() {
  FIELD_IDS.forEach((id) => {
    byId(id).addEventListener("input", renderAll);
  });
  byId("cropSelect").addEventListener("change", () => {
    fillPeriods();
    state.responses = {};
    renderAll();
  });
  byId("periodSelect").addEventListener("change", () => {
    state.responses = {};
    renderAll();
  });
  byId("photoInput").addEventListener("change", handlePhotos);
  byId("exportHtml").addEventListener("click", exportHtmlReport);
  byId("exportJson").addEventListener("click", exportDbJson);
  byId("exportCsv").addEventListener("click", exportObservationsCsv);
  document.querySelectorAll("nav a").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll("nav a").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

// Заповнює базовий список культур і одразу підтягує періоди для першої культури.
function fillBaseLists() {
  fillSelect(byId("cropSelect"), unique(state.config.parameters.map((row) => row[fieldMap.crop])));
  fillPeriods();
}

// Перебудовує список періодів залежно від вибраної культури.
// Після зміни культури відповіді очищаються в bindEvents(), бо набір параметрів інший.
function fillPeriods() {
  const crop = byId("cropSelect").value;
  const periods = unique(state.config.parameters.filter((row) => row[fieldMap.crop] === crop).map((row) => row[fieldMap.period]));
  fillSelect(byId("periodSelect"), periods);
}

// Універсальне наповнення select-елемента.
// Перед вставкою очищає попередні option, щоб список не дублювався після зміни культури.
function fillSelect(select, values, placeholder = "") {
  select.innerHTML = "";
  values.forEach((value, index) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value || placeholder;
    option.disabled = index === 0 && value === "";
    select.append(option);
  });
}

// Центральний рендер форми.
// Його можна викликати після будь-якої зміни стану: функція синхронізує параметри,
// фото, звіт і прогрес. Якщо додавати новий великий блок UI, підключати його треба тут.
function renderAll() {
  // Єдиний вхід для оновлення UI після зміни даних форми.
  renderParameters();
  renderPhotos();
  renderReport();
  renderProgress();
}

// Рендерить список параметрів для активної пари "культура + період".
// Для кожного рядка конфіга створюється стабільний key, за яким зберігається відповідь.
function renderParameters() {
  const rows = activeRows();
  byId("parameterCount").textContent = rows.length;
  byId("parameterList").innerHTML = "";

  rows.forEach((row, index) => {
    const key = parameterKey(row, index);
    if (!state.responses[key]) state.responses[key] = defaultResponse(row);
    byId("parameterList").append(renderParameterCard(row, key));
  });

  if (!rows.length) {
    byId("parameterList").innerHTML = `<p class="hint">Для цієї комбінації культури й періоду параметрів не знайдено.</p>`;
  }
}

// Створює одну картку параметра: заголовок, бізнес-сенс і відповідний control.
// Конкретний control вибирається нижче в renderControls().
function renderParameterCard(row, key) {
  const card = document.createElement("article");
  card.className = "parameter-card";

  const head = document.createElement("div");
  head.className = "parameter-head";
  head.innerHTML = `
    <div>
      <h3>${escapeHtml(row[fieldMap.parameter])}</h3>
      <p class="hint">${escapeHtml(row[fieldMap.business] || "")}</p>
    </div>
    <span class="parameter-type">${escapeHtml(controlLabel(row))}</span>
  `;

  const body = document.createElement("div");
  body.className = "parameter-body";
  body.append(renderControls(row, key));

  card.append(head, body);
  return card;
}

// Диспетчер контролів параметра.
// Порядок перевірок важливий: спеціальні агрономічні параметри мають пріоритет
// над загальним типом вводу з Excel. Наприклад, "Волога" завжди отримує шкалу 1-10,
// навіть якщо в конфігу описано загальну шкалу.
function renderControls(row, key) {
  // Порядок важливий: спеціалізовані агрономічні параметри мають пріоритет
  // над загальним типом вводу з Excel.
  if (isPhenology(row)) return renderPhenologyControls(row, key);
  if (isMoisture(row)) return renderMoistureControls(row, key);
  if (isTemperature(row)) return renderTemperatureControls(row, key);
  if (isShoots(row)) return renderShootsControls(row, key);
  if (isGrainMoisture(row)) return renderNumericSliderControls(row, key);
  if (isMaturityUniformity(row)) return renderMaturityUniformityControls(row, key);
  if (isSowingDefects(row)) return renderSowingDefectControls(row, key);
  if (isWeed(row)) return renderWeedControls(row, key);
  if (isDisease(row)) return renderProblemPoolControls(row, key, "Хвороби", diseaseOptions());
  if (isPest(row)) return renderProblemPoolControls(row, key, "Шкідники", pestOptions());
  return renderGenericControls(row, key);
}

// Якщо старт додатка зірвався, показуємо зрозумілу помилку замість порожньої сторінки.
init().catch((error) => {
  document.body.innerHTML = `<main class="band" style="margin:32px"><h1>Не вдалося завантажити конфіг</h1><p>${escapeHtml(error.message)}</p></main>`;
});
