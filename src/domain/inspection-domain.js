// Доменний шар форми.
// Тут немає прямого рендерингу UI, окрім мінімального доступу до активних select.
// Основна відповідальність файла: зрозуміти, що означає рядок Excel-конфіга,
// який control йому потрібен, як рахувати підпис/стан і як підготувати дані
// для звіту та експорту.

// Повертає тільки ті параметри, які належать до вибраної культури й періоду.
// Це головний фільтр, від якого залежить список карток у секції "Параметри".
function activeRows() {
  return window.AgroReferences.crops.parametersForSelection(
    state.config,
    fieldMap,
    byId("cropSelect").value,
    byId("periodSelect").value
  );
}

// Формує початкову відповідь для параметра.
// Для проблемних параметрів score = 0 означає "ще нічого не вибрано".
// Для параметрів зі слайдером ставимо робоче дефолтне значення, щоб UI одразу
// мав зрозумілий стан і підпис. При цьому прогрес усе одно рахується окремо.
function defaultResponse(row) {
  // Для проблемних блоків дефолт 0 означає "агроном ще нічого не вибрав".
  // У робочому інтерфейсі це значення не показується як варіант.
  const spec = sliderSpec(row);
  const numericSpec = numericSliderSpec(row);
  const value = isWeed(row) || isDisease(row) || isPest(row) || isSowingDefects(row) ? 0 : isPhenology(row) ? 1 : isMoisture(row) ? 6 : isTemperature(row) ? 10 : isShoots(row) ? 3 : isMaturityUniformity(row) ? 3 : numericSpec ? numericSpec.defaultValue : spec ? spec.defaultValue : 0;
  return {
    score: value,
    numeric: spec?.numeric || numericSpec ? value : "",
    choices: defaultChoices(row, value),
    invasiveSpecies: [],
    flags: { invasive: false },
    weedScores: {},
    defectValues: {},
    status: "",
    distribution: "",
  };
}

// Визначає, чи має параметр універсальний або числовий слайдер.
// Спочатку перевіряються спеціалізовані типи, потім numericSliderSpec(),
// і лише після цього загальна шкала з Excel. Якщо повертається null,
// renderGenericControls() використає select/checkbox логіку.
function sliderSpec(row) {
  // Центральна фабрика слайдерів. Нові параметри краще додавати тут або в
  // numericSliderSpec(), а не розкидати умови по рендер-функціях.
  const inputType = row[fieldMap.inputType].toLowerCase();
  const unit = String(row[fieldMap.unit] || "").toLowerCase();
  if (isTemperature(row)) {
    return { label: "Температура на глибині сівби", min: 0, max: 20, step: 0.5, defaultValue: 10, numeric: true, text: (v) => `${formatNumber(v)} °C - ${temperatureLabel(v)}`, state: temperatureState };
  }
  if (isShoots(row)) {
    return { label: "Кількість пагонів на рослину", min: 0, max: 10, step: 0.5, defaultValue: 3, numeric: true, text: (v) => `${formatNumber(v)} шт/рослину - ${shootsLabel(v)}`, state: shootsState };
  }
  const numericSpec = numericSliderSpec(row);
  if (numericSpec) return numericSpec;
  if (inputType.includes("шкала") || inputType.includes("слайдер") || inputType.includes("бал") || unit.includes("бал 0")) {
    return scoreSliderSpec(row);
  }
  return null;
}

// Людський підпис типу контролу для бейджа у картці параметра.
// Цей текст не впливає на логіку, але допомагає агроному бачити,
// який саме спосіб вводу застосовано.
function controlLabel(row) {
  if (isPhenology(row)) return "Слайдер фаз";
  if (isMoisture(row)) return "Слайдер 1-10";
  if (isTemperature(row)) return "Слайдер 0-20 °C";
  if (isShoots(row)) return "Слайдер 0-10";
  if (isGrainMoisture(row)) return "Слайдер вологості";
  if (isMaturityUniformity(row)) return "Слайдер 0-5";
  if (isSowingDefects(row)) return "Дефекти + слайдери";
  if (numericSliderSpec(row)) return "Слайдер з одиницями";
  if (isWeed(row)) return "Групи + слайдер";
  if (isDisease(row) || isPest(row)) return "Пул + слайдер";
  return row[fieldMap.inputType];
}

// Перетворює внутрішній score/choices у текст для звіту.
// Важливо тримати це окремо від render-коду: однаковий label використовується
// у прев'ю, HTML-звіті, JSON і CSV.
function scoreLabel(row, response) {
  if (isDisease(row) || isPest(row)) return response.choices?.length ? thresholdScoreText(Number(response.score || 1)) : "";
  if (isPhenology(row)) return cleanPhaseLabel(phaseOptions()[Number(response.score || 1) - 1] || "");
  if (isMoisture(row)) return moistureScale[Number(response.score || 6) - 1];
  if (isMaturityUniformity(row)) return maturityUniformityLabel(Number(response.score || 0));
  const spec = sliderSpec(row);
  if (spec) return spec.text(Number(response.score || 0));
  return response.status || "";
}

// Повертає CSS/business state для параметра: state-good, state-watch,
// state-bad або state-excess. Саме цей state далі впливає на статус звіту
// і на вимогу додаткових фото для сильних проблем.
function scoreState(row, response) {
  const score = Number(response.score || 0);
  if (isDisease(row) || isPest(row)) return response.choices?.length ? problemState(score) : "state-good";
  if (isWeed(row) || isSowingDefects(row)) return score > 0 ? problemState(score) : "state-good";
  if (isPhenology(row)) return "state-good";
  if (isMoisture(row)) return moistureState(score || 6);
  if (isMaturityUniformity(row)) return maturityUniformityState(score);
  const spec = sliderSpec(row);
  return spec?.state ? spec.state(score) : "state-good";
}

// Стабільний ключ відповіді в state.responses.
// index додано навмисно: у конфігу можуть повторюватись назви параметрів
// у межах культури/періоду, тому лише назва не гарантує унікальність.
function parameterKey(row, index) {
  return `${row[fieldMap.crop]}|${row[fieldMap.period]}|${index}|${row[fieldMap.parameter]}`;
}

// Нижче йдуть класифікатори параметрів.
// Вони читають назву параметра з конфіга і вирішують, чи потрібна спеціальна логіка.
// Якщо назви в Excel суттєво зміняться, ці функції треба перевірити першими.

// Волога посівного шару: окрема шкала 1-10, не плутати з вологістю зерна.
function isMoisture(row) {
  const name = row[fieldMap.parameter].toLowerCase();
  return (name.includes("волога") || name.includes("вологозабезпеч")) && !isGrainMoisture(row);
}

// Структура поверхні/грунту: оцінка 0-5 з окремими агрономічними підписами.
function isSoilStructure(row) {
  const name = row[fieldMap.parameter].toLowerCase();
  return name.includes("структура поверхні") || name.includes("структура ґрунту");
}

// Вологість зерна перед збором: числовий слайдер у відсотках.
function isGrainMoisture(row) {
  return row[fieldMap.parameter].toLowerCase().includes("вологість зерна");
}

// Фенологічна фаза: слайдер вибирає фазу зі списку phases для культури.
function isPhenology(row) {
  return row[fieldMap.parameter].toLowerCase().includes("фенологічна фаза");
}

// Температура на глибині сівби: числовий слайдер із порогами.
function isTemperature(row) {
  return row[fieldMap.parameter].toLowerCase().includes("температура");
}

// Кількість пагонів на рослину: числовий слайдер для оцінки кущення.
function isShoots(row) {
  const name = row[fieldMap.parameter].toLowerCase();
  return name.includes("кількість пагонів") || name.includes("пагони");
}

// Однорідність стиглості: шкала 0-5 для передзбиральної оцінки.
function isMaturityUniformity(row) {
  return row[fieldMap.parameter].toLowerCase().includes("однорідність стиглості");
}

// Пропуски/дублікати: чекбокси дефектів + слайдер щільності дефекту.
function isSowingDefects(row) {
  const name = row[fieldMap.parameter].toLowerCase();
  return name.includes("пропуски") && name.includes("дублікати");
}

// Забур'яненість: групи бур'янів, score по кожній групі та інвазивні види.
function isWeed(row) {
  return row[fieldMap.parameter].toLowerCase().includes("забур");
}

// Хвороби: вибір із пулу хвороб для активної культури.
function isDisease(row) {
  return row[fieldMap.parameter].toLowerCase().includes("хвороб");
}

// Шкідники: вибір із пулу шкідників для активної культури.
function isPest(row) {
  return row[fieldMap.parameter].toLowerCase().includes("шкідник");
}

// Швидка перевірка, чи параметр має слайдер.
// Використовується при нормалізації observation, зокрема для unit.
function hasSlider(row) {
  return Boolean(isPhenology(row) || isMoisture(row) || sliderSpec(row) || numericSliderSpec(row) || isMaturityUniformity(row));
}

// Повертає список фаз розвитку для вибраної культури.
// Сортування іде за номером з конфіга, щоб слайдер рухався в правильній послідовності.
function phaseOptions() {
  const crop = byId("cropSelect").value;
  return window.AgroReferences.phases.labelsForCrop(state.config, fieldMap, crop);
}

// Скорочує довгий label фази до першої читабельної частини.
// Прибирає уточнення в дужках і альтернативи після "/".
function cleanPhaseLabel(label) {
  return String(label || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)[0] || "";
}

// Пул хвороб для активної культури.
function diseaseOptions() {
  return window.AgroReferences.diseases.namesForCrop(state.config, fieldMap, byId("cropSelect").value);
}

// Пул шкідників для активної культури.
function pestOptions() {
  return window.AgroReferences.pests.namesForCrop(state.config, fieldMap, byId("cropSelect").value);
}

// Дістає короткий список інвазивних/злісних бур'янів для активної культури.
// У конфігу це текстове поле, тому після вибірки воно ще розбивається splitChoices().
function invasiveWeedOptions() {
  return window.AgroReferences.weeds.invasiveSpeciesForCrop(state.config, fieldMap, byId("cropSelect").value);
}

// Розбиває текстовий список із Excel на чисті варіанти вибору.
// Підтримує коми, крапки з комою і переноси рядків. Фільтр < 90 символів
// відсікає довгі пояснювальні фрази, які не мають ставати option.
function splitChoices(text) {
  return unique(
    String(text || "")
      .replace(/^\d+\s*групи:\s*/i, "")
      .split(/;|,|\n/)
      .map((item) => item.replace(/^\d+\s*/, "").trim())
      .filter((item) => item && item.length < 90)
  );
}

// Початковий choices для параметра.
// Для проблемних блоків він порожній, а для слайдерів синхронізується
// з дефолтним score, щоб звіт мав читабельний label.
function defaultChoices(row, value) {
  if (isWeed(row) || isDisease(row) || isPest(row) || isSowingDefects(row)) return [];
  if (isPhenology(row)) return [cleanPhaseLabel(phaseOptions()[Number(value) - 1] || "")].filter(Boolean);
  if (isMoisture(row)) return [moistureScale[Number(value) - 1]];
  if (isMaturityUniformity(row)) return [maturityUniformityLabel(value)];
  const spec = numericSliderSpec(row) || sliderSpec(row);
  return spec ? [spec.text(Number(value))] : [];
}

// Специфікація загальної шкали 0-5 або 1-5.
// Тут живуть параметри, де score не є фізичною одиницею, а оцінкою стану.
function scoreSliderSpec(row) {
  const name = row[fieldMap.parameter].toLowerCase();
  if (isSoilStructure(row)) {
    return { label: "Якість структури ґрунту", min: 0, max: 5, step: 1, defaultValue: 3, numeric: false, text: soilStructureLabel, state: soilStructureState };
  }
  if (name.includes("потужність кореню")) {
    return { label: "Потужність кореневої системи", min: 0, max: 5, step: 1, defaultValue: 3, numeric: false, text: rootPowerLabel, state: rootPowerState };
  }
  if (row[fieldMap.parameter].toLowerCase().includes("рівномірність")) {
    return { label: "Рівномірність стану", min: 0, max: 5, step: 1, defaultValue: 3, numeric: false, text: uniformityLabel, state: uniformityState };
  }
  return { label: "Оцінка стану", min: 1, max: 5, step: 1, defaultValue: 1, numeric: false, text: thresholdScoreText, state: problemState };
}

// Фабрика числових слайдерів із реальними одиницями виміру.
// Кожен if нижче прив'язує назву параметра з Excel до конкретної агрономічної шкали.
function numericSliderSpec(row) {
  const crop = byId("cropSelect")?.value || row[fieldMap.crop];
  const name = row[fieldMap.parameter].toLowerCase();

  if (name.includes("вологість зерна")) return grainMoistureSpec(crop);
  if (name.includes("висота рослини")) return heightSpec(crop);
  if (name.includes("густота стояння")) return densitySpec(crop);
  if (name.includes("реальна глибина висіву")) return sowingDepthSpec(crop);
  if (name.includes("глибина залягання вузла кущення")) return tilleringNodeDepthSpec();
  if (name.includes("глибина залягання точки росту")) return growthPointDepthSpec();
  if (name.includes("кількість листів")) return leafCountSpec();
  if (name.includes("ширина кореневої шийки")) return rootNeckSpec();
  return null;
}

// Висота рослини: межі залежать від культури, тому specs зберігається тут.
function heightSpec(crop) {
  const specs = {
    "Кукурудза": { max: 320, good: [80, 260], high: 280 },
    "Соняшник": { max: 250, good: [50, 210], high: 220 },
    "Соя": { max: 120, good: [20, 90], high: 100 },
    "Пшениця озима": { max: 130, good: [15, 105], high: 115 },
    "Ріпак озимий": { max: 180, good: [20, 150], high: 160 },
  };
  const s = specs[crop] || { max: 200, good: [20, 140], high: 160 };
  return {
    label: "Висота рослини",
    min: 0,
    max: s.max,
    step: 1,
    defaultValue: Math.round(s.good[0]),
    numeric: true,
    text: (v) => `${formatNumber(v)} см - ${heightLabel(v, s)}`,
    state: (v) => heightState(v, s),
  };
}

// Вологість зерна: цільові діапазони різні для культур.
function grainMoistureSpec(crop) {
  const specs = {
    "Кукурудза": { min: 10, max: 35, ready: [13, 14], defaultValue: 14 },
    "Соняшник": { min: 5, max: 16, ready: [7, 8], defaultValue: 8 },
    "Соя": { min: 8, max: 22, ready: [11, 12], defaultValue: 12 },
    "Пшениця озима": { min: 8, max: 22, ready: [13, 14], defaultValue: 14 },
    "Ріпак озимий": { min: 5, max: 16, ready: [7, 8], defaultValue: 8 },
  };
  const s = specs[crop] || { min: 8, max: 30, ready: [12, 14], defaultValue: 14 };
  return {
    label: "Вологість зерна",
    min: s.min,
    max: s.max,
    step: 0.5,
    defaultValue: s.defaultValue,
    numeric: true,
    text: (v) => `${formatNumber(v)} % - ${grainMoistureLabel(v, s)}`,
    state: (v) => grainMoistureState(v, s),
  };
}

// Густота стояння: діапазон і одиниця залежать від культури.
function densitySpec(crop) {
  const specs = {
    "Кукурудза": { min: 20, max: 110, good: [55, 85], unit: "тис. рослин/га", defaultValue: 70 },
    "Соняшник": { min: 20, max: 90, good: [45, 65], unit: "тис. рослин/га", defaultValue: 55 },
    "Соя": { min: 150, max: 900, good: [350, 650], unit: "тис. рослин/га", defaultValue: 500 },
    "Пшениця озима": { min: 150, max: 700, good: [350, 550], unit: "рослин/м²", defaultValue: 450 },
    "Ріпак озимий": { min: 10, max: 90, good: [30, 55], unit: "рослин/м²", defaultValue: 40 },
  };
  const s = specs[crop] || { min: 0, max: 500, good: [100, 300], unit: "од.", defaultValue: 200 };
  return {
    label: "Густота стояння",
    min: s.min,
    max: s.max,
    step: crop === "Соя" || crop === "Пшениця озима" ? 10 : 1,
    defaultValue: s.defaultValue,
    numeric: true,
    text: (v) => `${formatNumber(v)} ${s.unit} - ${rangeLabel(v, s.good, "зріджений посів", "оптимальна густота", "надмірне загущення")}`,
    state: (v) => rangeState(v, s.good),
  };
}

// Фактична глибина висіву: культура визначає допустимий технологічний інтервал.
function sowingDepthSpec(crop) {
  const specs = {
    "Кукурудза": { min: 2, max: 10, good: [4, 6], defaultValue: 5 },
    "Соняшник": { min: 2, max: 8, good: [4, 6], defaultValue: 5 },
    "Соя": { min: 2, max: 7, good: [3, 5], defaultValue: 4 },
    "Пшениця озима": { min: 1, max: 8, good: [3, 5], defaultValue: 4 },
    "Ріпак озимий": { min: 0.5, max: 5, good: [1.5, 3], defaultValue: 2 },
  };
  const s = specs[crop] || { min: 1, max: 8, good: [3, 5], defaultValue: 4 };
  return {
    label: "Фактична глибина висіву",
    min: s.min,
    max: s.max,
    step: 0.5,
    defaultValue: s.defaultValue,
    numeric: true,
    text: (v) => `${formatNumber(v)} см - ${rangeLabel(v, s.good, "мілке загортання", "у технологічному інтервалі", "надмірне заглиблення")}`,
    state: (v) => rangeState(v, s.good),
  };
}

// Глибина вузла кущення для озимих культур.
function tilleringNodeDepthSpec() {
  return {
    label: "Глибина залягання вузла кущення",
    min: 0,
    max: 6,
    step: 0.5,
    defaultValue: 2.5,
    numeric: true,
    text: (v) => `${formatNumber(v)} см - ${rangeLabel(v, [2, 3.5], "занадто мілко", "оптимальна глибина", "надмірне заглиблення")}`,
    state: (v) => rangeState(v, [2, 3.5]),
  };
}

// Глибина точки росту: використовується для оцінки ризиків витягування/пошкодження.
function growthPointDepthSpec() {
  return {
    label: "Глибина залягання точки росту",
    min: 0,
    max: 5,
    step: 0.5,
    defaultValue: 1.5,
    numeric: true,
    text: (v) => `${formatNumber(v)} см - ${rangeLabel(v, [1, 2.5], "точка росту надто високо", "оптимальне розміщення", "ризик витягування")}`,
    state: (v) => rangeState(v, [1, 2.5]),
  };
}

// Кількість листків ріпаку перед перезимівлею.
function leafCountSpec() {
  return {
    label: "Кількість листків ріпаку",
    min: 0,
    max: 12,
    step: 1,
    defaultValue: 6,
    numeric: true,
    text: (v) => `${formatNumber(v)} шт/рослину - ${rangeLabel(v, [6, 8], "недорозвинена розетка", "оптимальна розетка", "переросла розетка")}`,
    state: (v) => rangeState(v, [6, 8]),
  };
}

// Ширина кореневої шийки ріпаку: важливий показник готовності до перезимівлі.
function rootNeckSpec() {
  return {
    label: "Ширина кореневої шийки",
    min: 0,
    max: 20,
    step: 0.5,
    defaultValue: 8,
    numeric: true,
    text: (v) => `${formatNumber(v)} мм - ${rangeLabel(v, [8, 12], "недостатньо розвинена шийка", "оптимальна шийка", "надмірне переростання")}`,
    state: (v) => rangeState(v, [8, 12]),
  };
}

// Повертає унікальні непорожні значення, зберігаючи початковий порядок.
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

// Створює тимчасовий Blob і запускає завантаження файлу в браузері.
// Після click URL одразу відкликається, щоб не лишати зайві objectURL.
function download(filename, content, type) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Чистить текст для використання в імені файлу експорту.
function safeFilePart(value) {
  return String(value).trim().replace(/[^\wа-яіїєґ-]+/gi, "-").replace(/^-|-$/g, "") || "field";
}

// Екранує значення для CSV: лапки дублюються, клітинка завжди у подвійних лапках.
function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

// Мінімальне HTML-екранування для вставки користувацького/конфігураційного тексту.
// Усі innerHTML-вставки мають проходити через цю функцію, якщо значення не створене нами.
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
