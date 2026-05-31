// ============================================================================
// Агрономічні правила, підписи та стани
// ----------------------------------------------------------------------------
// Функції в цьому файлі по можливості чисті: отримують число/параметри й
// повертають текст або стан. Це спрощує тестування і перенесення у великий
// застосунок, де UI може бути React/Vue/etc.
// ============================================================================

(function () {

function formatNumber(value) {
  return Number(value).toLocaleString("uk-UA", { maximumFractionDigits: 1 });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function thresholdScoreText(value) {
  const score = Number(value || 1);
  const labels = {
    1: "1 - нижче порогу, тільки фіксація",
    2: "2 - наближення до порогу, потрібен контроль",
    3: "3 - перевищений економічний поріг шкодочинності",
    4: "4 - високий рівень шкодочинності",
    5: "5 - критичний рівень, термінова дія",
  };
  return labels[score] || String(value);
}

function defectDensityLabel(value) {
  const v = Number(value || 0);
  if (v < 1) return "поодинокий дефект";
  if (v < 2) return "нижче порогу, потрібен контроль";
  if (v < 4) return "перевищений економічний поріг шкодочинності";
  if (v < 7) return "високий рівень втрат густоти";
  return "критичний дефект сівби";
}

function defectValueToScore(value) {
  const v = Number(value || 0);
  if (v <= 0) return 0;
  if (v < 1) return 1;
  if (v < 2) return 2;
  if (v < 4) return 3;
  if (v < 7) return 4;
  return 5;
}

function uniformityLabel(value) {
  const score = Number(value || 0);
  const labels = [
    "0 - оцінка відсутня",
    "1 - дуже нерівномірно",
    "2 - нерівномірно",
    "3 - помірна рівномірність",
    "4 - добра рівномірність",
    "5 - вирівняний стан",
  ];
  return labels[score] || String(value);
}

function uniformityState(value) {
  const score = Number(value || 0);
  if (score >= 4) return "state-good";
  if (score === 3) return "state-watch";
  return "state-bad";
}

function maturityUniformityLabel(value) {
  const score = Number(value || 0);
  const labels = [
    "0 - стиглість не оцінена",
    "1 - різко неоднорідна стиглість",
    "2 - значна строкатість стиглості",
    "3 - помірна неоднорідність, потрібен контроль",
    "4 - переважно вирівняна стиглість",
    "5 - однорідна стиглість, готовність прогнозована",
  ];
  return labels[score] || String(value);
}

function maturityUniformityState(value) {
  const score = Number(value || 0);
  if (score >= 4) return "state-good";
  if (score === 3) return "state-watch";
  return "state-bad";
}

function soilStructureLabel(value) {
  const score = Number(value || 0);
  const labels = [
    "0 - структура непридатна для якісної роботи",
    "1 - критичне ущільнення / кірка / грудкуватість",
    "2 - виражені структурні обмеження",
    "3 - задовільна структура, потрібен контроль",
    "4 - добра посівна структура",
    "5 - оптимальна дрібногрудкувата структура",
  ];
  return labels[score] || String(value);
}

function soilStructureState(value) {
  const score = Number(value || 0);
  if (score >= 4) return "state-good";
  if (score === 3) return "state-watch";
  return score <= 1 ? "state-bad" : "state-watch";
}

function rootPowerLabel(value) {
  const score = Number(value || 0);
  const labels = [
    "0 - коренева система майже не сформована",
    "1 - слабкий корінь, високий ризик перезимівлі",
    "2 - недостатній розвиток кореня",
    "3 - середня потужність, потрібен контроль весною",
    "4 - добре сформована коренева система",
    "5 - дуже потужний корінь, високий потенціал старту",
  ];
  return labels[score] || String(value);
}

function rootPowerState(value) {
  const score = Number(value || 0);
  if (score >= 4) return "state-good";
  if (score === 3) return "state-watch";
  return "state-bad";
}

function problemState(value) {
  const score = Number(value || 0);
  if (score <= 1) return "state-good";
  if (score <= 2) return "state-watch";
  return score >= 5 ? "state-excess" : "state-bad";
}

function rangeLabel(value, goodRange, lowLabel, goodLabel, highLabel) {
  const v = Number(value);
  if (v < goodRange[0]) return lowLabel;
  if (v <= goodRange[1]) return goodLabel;
  return highLabel;
}

function rangeState(value, goodRange) {
  const v = Number(value);
  if (v >= goodRange[0] && v <= goodRange[1]) return "state-good";
  const lowDistance = Math.abs(v - goodRange[0]);
  const highDistance = Math.abs(v - goodRange[1]);
  const tolerance = Math.max((goodRange[1] - goodRange[0]) * 0.75, 1);
  if (v < goodRange[0]) return lowDistance <= tolerance ? "state-watch" : "state-bad";
  return highDistance <= tolerance ? "state-watch" : "state-excess";
}

function heightLabel(value, spec) {
  const v = Number(value);
  if (v === 0) return "рослини відсутні або не оцінені";
  if (v < spec.good[0]) return "нижче очікуваного розвитку";
  if (v <= spec.good[1]) return "у робочому діапазоні розвитку";
  if (v <= spec.high) return "верхня межа розвитку";
  return "ризик переростання / вилягання";
}

function heightState(value, spec) {
  const v = Number(value);
  if (v === 0) return "state-bad";
  if (v >= spec.good[0] && v <= spec.good[1]) return "state-good";
  if (v <= spec.high) return "state-watch";
  return "state-excess";
}

function grainMoistureLabel(value, spec) {
  const v = Number(value);
  if (v < spec.ready[0]) return "нижче цільової вологості, ризик втрат/осипання";
  if (v <= spec.ready[1]) return "цільова вологість для збирання";
  if (v <= spec.ready[1] + 4) return "підвищена вологість, потрібен контроль сушіння";
  return "висока вологість, збирання економічно ризикове";
}

function grainMoistureState(value, spec) {
  const v = Number(value);
  if (v >= spec.ready[0] && v <= spec.ready[1]) return "state-good";
  if (v < spec.ready[0] || v <= spec.ready[1] + 4) return "state-watch";
  return "state-bad";
}

function moistureState(value) {
  const score = Number(value);
  if (score >= 5 && score <= 7) return "state-good";
  if (score === 4 || score === 8) return "state-watch";
  if (score <= 3) return "state-bad";
  return "state-excess";
}

function temperatureLabel(value) {
  if (value < 6) return "холодний грунт, високий ризик затримки проростання";
  if (value < 8) return "нижня межа допустимого прогрівання";
  if (value <= 12) return "оптимальний інтервал для старту сівби";
  if (value <= 16) return "теплий грунт, сприятливий режим";
  return "ризик швидкого пересихання посівного шару";
}

function temperatureState(value) {
  if (value < 6) return "state-bad";
  if (value > 18) return "state-excess";
  if (value < 8 || value > 16) return "state-watch";
  return "state-good";
}

function shootsLabel(value) {
  if (value < 1) return "критично слабке кущення";
  if (value < 2) return "недостатній розвиток";
  if (value <= 4) return "оптимальний розвиток";
  if (value <= 6) return "підвищене кущення";
  return "надмірне кущення, ризик конкуренції";
}

function shootsState(value) {
  if (value < 1) return "state-bad";
  if (value < 2 || value > 6) return value > 6 ? "state-excess" : "state-watch";
  return value <= 4 ? "state-good" : "state-watch";
}

window.AgroRules = {
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
};

})();
