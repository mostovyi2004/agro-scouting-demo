// Прев'ю звіту, валідація, прогрес і експорт.
// Цей файл є "контрактним" шаром між UI та майбутнім API/БД:
// collectInspection() збирає нормалізований payload, а експортні функції
// використовують саме його, щоб HTML/JSON/CSV мали однакові дані.

// Оновлює праву/нижню частину фінального звіту у формі.
// Тут також оновлюється доступність кнопок експорту, бо вона залежить від alerts.
function renderReport() {
  const data = collectInspection();
  const alerts = validate(data);
  const status = calculateStatus(data, alerts);
  updateExportButtons(alerts);
  byId("summaryStatus").textContent = status;
  byId("summaryStatus").style.color = status === "Зелений" ? "var(--ok)" : status === "Жовтий" ? "var(--warn)" : "var(--danger)";
  byId("alerts").innerHTML = alerts.map((item) => `<div class="alert ${item.level === "danger" ? "danger" : ""}">${escapeHtml(item.text)}</div>`).join("");
  byId("reportPreview").innerHTML = [
    ["Агроном", data.inspection.agronomist || "-"],
    ["Дата", data.inspection.date || "-"],
    ["Поле", `${data.inspection.field || "-"}${data.inspection.area ? `, ${data.inspection.area} га` : ""}`],
    ["Культура", data.inspection.crop],
    ["Період", data.inspection.period],
    ["Ризики", data.inspection.operation_risk || "-"],
    ["Статус", status],
    ["Фото", `${state.photos.length} / ${requiredPhotoCount(data)}`],
    ["Спостережень", data.observations.length],
  ]
    .map(([label, value]) => `<div class="report-row"><span>${label}</span><span>${escapeHtml(value)}</span></div>`)
    .join("");
}

// Рахує приблизний прогрес заповнення.
// Прогрес не є валідацією: він лише показує користувачу, скільки блоків уже має дані.
// Обов'язковість експорту визначає validate().
function renderProgress() {
  const data = collectInspection();
  const baseFields = [
    data.inspection.agronomist,
    data.inspection.date,
    data.inspection.field,
    data.inspection.area,
    data.inspection.crop,
    data.inspection.period,
    data.inspection.operation_risk,
    data.inspection.summary_comment,
  ];
  const completedBase = baseFields.filter(Boolean).length;
  const observations = data.observations;
  const completedObs = observations.filter((item) => item.score > 0 || item.numeric_value || item.choices.length || item.status || item.distribution).length;
  const requiredPhotos = requiredPhotoCount(data);
  const total = baseFields.length + Math.max(observations.length, 1) + requiredPhotos;
  const done = completedBase + completedObs + Math.min(state.photos.length, requiredPhotos);
  const percent = Math.round((done / total) * 100);
  byId("progressText").textContent = `${percent}%`;
  byId("progressBar").style.width = `${percent}%`;
}

// Збирає всі дані форми у нормалізовану структуру.
// Ця структура наближена до майбутнього API:
// - inspection: шапка огляду;
// - observations: параметричні спостереження;
// - photos: вкладені фото.
// Якщо додавати нове поле для БД, найімовірніше його треба додати саме тут.
function collectInspection() {
  // Нормалізована структура нижче максимально близька до майбутнього API:
  // inspection - шапка інспекції, observations - параметричні спостереження.
  const observations = activeRows().map((row, index) => {
    const response = state.responses[parameterKey(row, index)] || defaultResponse(row);
    return {
      parameter: row[fieldMap.parameter],
      input_type: controlLabel(row),
      score: Number(response.score || 0),
      score_label: scoreLabel(row, response),
      score_state: scoreState(row, response),
      numeric_value: response.numeric || "",
      unit: hasSlider(row) ? "" : row[fieldMap.unit],
      choices: unique([...(response.choices || []), ...(response.invasiveSpecies || [])]),
      weed_scores: response.weedScores || {},
      defect_values: response.defectValues || {},
      status: response.status || "",
      distribution: response.distribution || "",
      photo_rule: row[fieldMap.photo],
      business_meaning: row[fieldMap.business],
    };
  });

  return {
    inspection: {
      inspection_id: state.inspectionId,
      agronomist: byId("agronomist").value.trim(),
      date: byId("inspectionDate").value,
      field: byId("fieldName").value.trim(),
      area: byId("fieldArea").value,
      crop: byId("cropSelect").value,
      period: byId("periodSelect").value,
      operation_risk: byId("finalRisk").value,
      summary_comment: byId("summaryComment").value.trim(),
    },
    observations,
    photos: state.photos,
  };
}

// Перевіряє, чи звіт готовий до експорту.
// Усі danger-alerts блокують HTML/JSON/CSV експорт. Warn-рівень зараз не блокує,
// але його можна додати пізніше для м'якших рекомендацій.
function validate(data) {
  const alerts = [];
  const i = data.inspection;
  if (!i.agronomist) alerts.push({ level: "danger", text: "Вкажіть агронома, який проводить інспекцію." });
  if (!i.date) alerts.push({ level: "danger", text: "Вкажіть дату інспекції." });
  if (!i.field) alerts.push({ level: "danger", text: "Вкажіть поле або ID поля." });
  if (!i.area) alerts.push({ level: "danger", text: "Вкажіть площу поля." });
  if (!i.operation_risk) alerts.push({ level: "danger", text: "Оберіть підсумковий рівень ризику." });
  if (!i.summary_comment) alerts.push({ level: "danger", text: "Додайте короткий висновок агронома." });

  const requiredPhotos = requiredPhotoCount(data);
  if (state.photos.length < requiredPhotos) {
    alerts.push({ level: "danger", text: `Потрібно додати мінімум ${requiredPhotos} фото: 2 базові + по одному за кожну сильну проблему.` });
  }

  return alerts;
}

// Розраховує підсумковий колір/статус інспекції.
// Пріоритети такі:
// 1. Є блокуючі помилки валідації -> червоний.
// 2. Є сильна проблема в параметрах -> помаранчевий.
// 3. Є watch-стан або будь-які alerts -> жовтий.
// 4. Інакше все в нормі -> зелений.
function calculateStatus(data, alerts) {
  // Статус інспекції рахується за семантикою параметра, а не за сирою цифрою.
  // Наприклад, висота 180 см може бути нормальною для кукурудзи, але проблемною
  // для іншої культури, тому кожен слайдер повертає власний score_state.
  if (alerts.some((item) => item.level === "danger")) return "Червоний";
  if (data.observations.some(isBlockingObservation)) return "Помаранчевий";
  if (alerts.length || data.observations.some((item) => item.score_state === "state-watch")) return "Жовтий";
  return "Зелений";
}

// Сильна проблема: observation має state-bad або state-excess.
function isBlockingObservation(item) {
  return BLOCKING_STATES.includes(item.score_state);
}

// Рахує кількість сильних проблем.
// Ця цифра напряму додає вимогу по фото: +1 фото за кожну сильну проблему.
function strongProblemCount(data) {
  return data.observations.filter(isBlockingObservation).length;
}

// Мінімальна кількість фото для експорту.
// Бізнес-правило: 2 базові фото + 1 за кожну сильну проблему.
function requiredPhotoCount(data) {
  return 2 + strongProblemCount(data);
}

// Експорт дозволений лише коли немає danger-alerts.
function canExport(alerts) {
  return !alerts.some((item) => item.level === "danger");
}

// Вмикає/вимикає кнопки експорту відповідно до validate().
// Навіть якщо кнопку якось викликати вручну, ensureCanExport() повторно перевірить стан.
function updateExportButtons(alerts) {
  const disabled = !canExport(alerts);
  [byId("exportHtml"), byId("exportJson"), byId("exportCsv")].forEach((button) => {
    button.disabled = disabled;
    button.title = disabled ? "Заповніть звіт і додайте потрібні фото перед експортом." : "";
  });
}

// Захист перед кожним експортом.
// Повторно запускає validate(), оновлює звіт і скролить до помилок,
// якщо користувач спробував експортувати незавершений звіт.
function ensureCanExport(data) {
  const alerts = validate(data);
  renderReport();
  if (canExport(alerts)) return true;
  byId("alerts").scrollIntoView({ behavior: "smooth", block: "start" });
  return false;
}

// Експортує самодостатній HTML-звіт для перегляду/друку.
// Шаблон HTML живе в agro-report.js, а payload приходить із collectInspection().
function exportHtmlReport() {
  const data = collectInspection();
  if (!ensureCanExport(data)) return;
  const status = calculateStatus(data, validate(data));
  const statusClass = status === "Зелений" ? "ok" : status === "Жовтий" ? "warn" : status === "Помаранчевий" ? "orange" : "danger";
  download(
    `agro-inspection-${safeFilePart(data.inspection.field || "field")}.html`,
    window.AgroReport.buildInspectionHtmlReport({ data, status, statusClass, escapeHtml }),
    "text/html"
  );
}

// Експортує JSON, максимально близький до майбутнього payload для БД/API.
function exportDbJson() {
  const data = collectInspection();
  if (!ensureCanExport(data)) return;
  data.inspection.summary_status = calculateStatus(data, validate(data));
  download(`agro-inspection-${safeFilePart(data.inspection.field || "field")}.json`, JSON.stringify(data, null, 2), "application/json");
}

// Експортує CSV тільки по observation-рядках.
// Зручно для швидкого аналізу в таблицях або імпорту спостережень окремо від шапки.
function exportObservationsCsv() {
  const data = collectInspection();
  if (!ensureCanExport(data)) return;
  const header = ["inspection_id", "crop", "period", "parameter", "score", "score_label", "choices", "status", "distribution"];
  const lines = [
    header,
    ...data.observations.map((item) => [
      data.inspection.inspection_id,
      data.inspection.crop,
      data.inspection.period,
      item.parameter,
      item.score,
      item.score_label,
      item.choices.length ? item.choices.join("; ") : "Не виявлено",
      item.status,
      item.distribution,
    ]),
  ];
  download(`agro-observations-${safeFilePart(data.inspection.field || "field")}.csv`, lines.map((line) => line.map(csvCell).join(",")).join("\n"), "text/csv");
}
