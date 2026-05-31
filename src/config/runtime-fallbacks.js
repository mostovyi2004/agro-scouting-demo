// Runtime fallback-??? ??? ?????????? ??????? ?????.
// ??????? ????????? ? ??????? ?????? ? inspection-constants.js ?? agronomy-rules.js.
// ??? ???? ???????? ?? ????????????? ??????, ??? ????? ?? ?????? ????????,
// ???? ???? ?? ?????????? ???????? ?? ????????????.
(function () {
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

// Резервні бізнес-правила. Основні правила приходять з src/domain/agronomy-rules.js.
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

window.AgroRuntimeFallbacks = { fallbackConstants, fallbackRules };
})();
