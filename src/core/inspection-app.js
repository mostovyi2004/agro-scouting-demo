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
  activeStep: "base",
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
// Резервні константи потрібні, якщо файл src/config/inspection-constants.js не завантажився.
// У нормальному сценарії використовуються window.AgroConstants, але fallback дозволяє
// формі хоча б стартувати і показати базову структуру.
const { fallbackConstants, fallbackRules } = window.AgroRuntimeFallbacks;

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

// Порядок кроків майстра. ID мають збігатися з section[id] та data-step у навігації.
// Користувач переходить між кроками через саму лінію етапів, без окремих кнопок.
const WIZARD_STEPS = ["base", "parameters", "photos", "report"];

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
  byId("stepBack").addEventListener("click", goToPreviousStep);
  byId("stepNext").addEventListener("click", goToNextStep);
  document.querySelectorAll("[data-step]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetStep = link.dataset.step;
      if (!canOpenStep(targetStep)) return;
      setActiveStep(targetStep);
    });
  });
}

// Заповнює базовий список культур і одразу підтягує періоди для першої культури.
function fillBaseLists() {
  fillSelect(byId("cropSelect"), window.AgroReferences.crops.list(state.config, fieldMap));
  fillPeriods();
}

// Перебудовує список періодів залежно від вибраної культури.
// Після зміни культури відповіді очищаються в bindEvents(), бо набір параметрів інший.
function fillPeriods() {
  const crop = byId("cropSelect").value;
  const periods = window.AgroReferences.crops.periodsForCrop(state.config, fieldMap, crop);
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

// Активує один крок майстра і прибирає з екрану решту секцій.
// Скрол до верху потрібен після кліку по нижній мобільній навігації.
function setActiveStep(step) {
  if (!WIZARD_STEPS.includes(step)) return;
  state.activeStep = step;
  renderWizard();
  document.querySelector(".content")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Велика кнопка "Назад": веде на попередній крок, якщо він існує.
function goToPreviousStep() {
  const index = WIZARD_STEPS.indexOf(state.activeStep);
  if (index <= 0) return;
  setActiveStep(WIZARD_STEPS[index - 1]);
}

// Велика кнопка "Далі": веде на наступний розблокований крок.
// Якщо поточний крок ще не заповнений, кнопка лишається вимкненою в renderWizard().
function goToNextStep() {
  const index = WIZARD_STEPS.indexOf(state.activeStep);
  const nextStep = WIZARD_STEPS[index + 1];
  if (!nextStep || !canOpenStep(nextStep)) return;
  setActiveStep(nextStep);
}

// Крок можна відкрити, якщо він уже доступний за послідовністю заповнення.
// Назад завжди можна перейти, вперед - тільки до першого ще неготового етапу.
function canOpenStep(step) {
  return WIZARD_STEPS.indexOf(step) <= maxOpenStepIndex();
}

// Рахує найдальший доступний крок. Це робить форму послідовною без кнопок:
// користувач заповнює поточний блок, а наступний пункт лінії стає активним.
function maxOpenStepIndex() {
  const completion = wizardCompletion();
  let index = 0;
  for (let i = 0; i < WIZARD_STEPS.length - 1; i += 1) {
    if (!completion[WIZARD_STEPS[i]]) break;
    index = i + 1;
  }
  return index;
}

// Оновлює видимість секцій, aria-стани та класи лінії кроків.
// Якщо дані змінилися і поточний крок став недоступним, форма м'яко повертає
// користувача на найдальший дозволений крок.
function renderWizard() {
  const maxIndex = maxOpenStepIndex();
  const activeIndex = WIZARD_STEPS.indexOf(state.activeStep);
  if (activeIndex > maxIndex) state.activeStep = WIZARD_STEPS[maxIndex];
  const currentIndex = WIZARD_STEPS.indexOf(state.activeStep);

  document.querySelectorAll(".band").forEach((section) => {
    const isActive = section.id === state.activeStep;
    section.hidden = !isActive;
    section.classList.toggle("is-active", isActive);
  });

  document.querySelectorAll("[data-step]").forEach((link) => {
    const step = link.dataset.step;
    const stepIndex = WIZARD_STEPS.indexOf(step);
    const isActive = step === state.activeStep;
    const isOpen = stepIndex <= maxIndex;
    link.classList.toggle("active", isActive);
    link.classList.toggle("is-complete", stepIndex < maxIndex);
    link.classList.toggle("is-locked", !isOpen);
    link.setAttribute("aria-current", isActive ? "step" : "false");
    link.setAttribute("aria-disabled", isOpen ? "false" : "true");
  });

  const backButton = byId("stepBack");
  const nextButton = byId("stepNext");
  const nextStep = WIZARD_STEPS[currentIndex + 1];
  backButton.disabled = currentIndex === 0;
  nextButton.disabled = !nextStep || !canOpenStep(nextStep);
  nextButton.textContent = currentIndex === WIZARD_STEPS.length - 1 ? "Готово" : "Далі";
}

// Визначає готовність кожного кроку окремо. Це не замінює validate(), а лише
// керує послідовністю майстра і розблокуванням пунктів навігації.
function wizardCompletion() {
  const data = collectInspection();
  const baseDone = Boolean(
    data.inspection.agronomist &&
      data.inspection.date &&
      data.inspection.field &&
      data.inspection.area &&
      data.inspection.crop &&
      data.inspection.period
  );
  const observations = data.observations;
  const parametersDone =
    observations.length > 0 &&
    observations.every(observationIsComplete);
  const photosDone = state.photos.length >= requiredPhotoCount(data);
  return {
    base: baseDone,
    parameters: parametersDone,
    photos: photosDone,
    report: Boolean(data.inspection.operation_risk && data.inspection.summary_comment),
  };
}

// Перевіряє, чи observation не блокує перехід далі.
// Для проблемних блоків порожня відповідь є змістовною: це означає
// "не виявлено", а не "агроном забув заповнити". Тому шкідники, хвороби,
// бур'яни, дефекти сівби й чекбокс-параметри можуть бути завершені без вибору.
function observationIsComplete(item) {
  return observationHasValue(item) || observationAllowsEmptyValue(item);
}

// Реальна введена відповідь: число, вибір, статус або текстовий розподіл.
function observationHasValue(item) {
  return Boolean(item.score > 0 || item.numeric_value || item.choices.length || item.status || item.distribution);
}

// Порожнє значення дозволене там, де агрономічно нормальний сценарій - "немає".
// Цю логіку тримаємо окремо, щоб майбутні необов'язкові параметри додавались
// явно, без випадкового послаблення всіх полів форми.
function observationAllowsEmptyValue(item) {
  const type = String(item.input_type || "").toLowerCase();
  const parameter = String(item.parameter || "").toLowerCase();
  return (
    type.includes("пул + слайдер") ||
    type.includes("групи + слайдер") ||
    type.includes("дефекти + слайдери") ||
    type.includes("чекбокс") ||
    parameter.includes("хвороб") ||
    parameter.includes("шкідник") ||
    parameter.includes("забур") ||
    parameter.includes("бур'ян") ||
    parameter.includes("бур’ян") ||
    (parameter.includes("пропуски") && parameter.includes("дублікати"))
  );
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
