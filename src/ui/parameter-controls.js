// UI-контроли параметрів і фото.
// Цей файл відповідає тільки за створення DOM-елементів вводу та синхронізацію
// state.responses/state.photos після дій користувача. Бізнес-правила й діапазони
// беруться з src/domain/inspection-domain.js та src/domain/agronomy-rules.js.

// Рендерить слайдер фенологічної фази.
// Значення слайдера є індексом у списку phaseOptions(), тому при зміні культури
// responses очищаються в src/core/inspection-app.js і список фаз будується заново.
function renderPhenologyControls(row, key) {
  const response = state.responses[key];
  const phases = phaseOptions();
  response.score = clamp(Number(response.score || 1), 1, Math.max(phases.length, 1));
  response.choices = [phases[response.score - 1] || ""];

  const wrap = document.createElement("div");
  wrap.className = "control-grid";
  wrap.append(sliderControl({
    label: "Фаза розвитку",
    value: response.score,
    min: 1,
    max: Math.max(phases.length, 1),
    step: 1,
    text: (value) => cleanPhaseLabel(phases[Number(value) - 1] || ""),
    state: () => "state-good",
    onInput: (value) => {
      response.score = Number(value);
      response.choices = [cleanPhaseLabel(phases[response.score - 1] || "")];
      renderReport();
      renderProgress();
    },
  }));
  return wrap;
}

// Рендерить шкалу вологозабезпечення 1-10.
// Це не фізична вологість у %, а агрономічна оцінка стану посівного шару.
function renderMoistureControls(row, key) {
  const response = state.responses[key];
  response.score = clamp(Number(response.score || 6), 1, 10);
  response.choices = [moistureScale[response.score - 1]];

  const wrap = document.createElement("div");
  wrap.className = "control-grid";
  wrap.append(sliderControl({
    label: "Вологозабезпеченість",
    value: response.score,
    min: 1,
    max: 10,
    step: 1,
    text: () => moistureScale[response.score - 1],
    state: () => moistureState(response.score),
    onInput: (value) => {
      response.score = Number(value);
      response.choices = [moistureScale[response.score - 1]];
      renderReport();
      renderProgress();
    },
  }));
  return wrap;
}

// Рендерить температуру на глибині сівби.
// Значення одночасно зберігається як score і numeric, щоб у звіті була і оцінка,
// і реальне числове значення.
function renderTemperatureControls(row, key) {
  const response = state.responses[key];
  response.score = response.score || 10;

  const wrap = document.createElement("div");
  wrap.className = "control-grid";
  wrap.append(sliderControl({
    label: "Температура на глибині сівби",
    value: response.score,
    min: 0,
    max: 20,
    step: 0.5,
    text: (value) => `${formatNumber(value)} °C - ${temperatureLabel(Number(value))}`,
    state: (value) => temperatureState(Number(value)),
    onInput: (value) => {
      response.score = Number(value);
      response.numeric = Number(value);
      response.choices = [temperatureLabel(Number(value))];
      renderReport();
      renderProgress();
    },
  }));
  return wrap;
}

// Рендерить кількість пагонів на рослину.
// Логіка така сама, як для температури: numeric потрібен для експорту як число.
function renderShootsControls(row, key) {
  const response = state.responses[key];
  response.score = response.score || 3;

  const wrap = document.createElement("div");
  wrap.className = "control-grid";
  wrap.append(sliderControl({
    label: "Кількість пагонів на рослину",
    value: response.score,
    min: 0,
    max: 10,
    step: 0.5,
    text: (value) => `${formatNumber(value)} шт/рослину - ${shootsLabel(Number(value))}`,
    state: (value) => shootsState(Number(value)),
    onInput: (value) => {
      response.score = Number(value);
      response.numeric = Number(value);
      response.choices = [shootsLabel(Number(value))];
      renderReport();
      renderProgress();
    },
  }));
  return wrap;
}

// Універсальний рендер числових слайдерів із numericSliderSpec().
// Використовується для висоти, густоти, глибини висіву, вологості зерна тощо.
function renderNumericSliderControls(row, key) {
  const response = state.responses[key];
  const spec = numericSliderSpec(row);
  response.score = clamp(Number(response.score || spec.defaultValue), spec.min, spec.max);
  response.numeric = response.score;
  response.choices = [spec.text(response.score)];

  const wrap = document.createElement("div");
  wrap.className = "control-grid";
  wrap.append(sliderControl({
    label: spec.label,
    value: response.score,
    min: spec.min,
    max: spec.max,
    step: spec.step,
    text: spec.text,
    state: spec.state,
    onInput: (value) => {
      response.score = Number(value);
      response.numeric = Number(value);
      response.choices = [spec.text(Number(value))];
      renderReport();
      renderProgress();
    },
  }));
  return wrap;
}

// Рендерить оцінку однорідності стиглості 0-5.
function renderMaturityUniformityControls(row, key) {
  const response = state.responses[key];
  response.score = clamp(Number(response.score || 3), 0, 5);
  response.choices = [maturityUniformityLabel(response.score)];

  const wrap = document.createElement("div");
  wrap.className = "control-grid";
  wrap.append(sliderControl({
    label: "Однорідність стиглості",
    value: response.score,
    min: 0,
    max: 5,
    step: 1,
    text: maturityUniformityLabel,
    state: maturityUniformityState,
    onInput: (value) => {
      response.score = Number(value);
      response.choices = [maturityUniformityLabel(Number(value))];
      renderReport();
      renderProgress();
    },
  }));
  return wrap;
}

// Рендерить блок дефектів сівби.
// Користувач спершу вибирає типи дефектів, а потім для кожного вибраного дефекту
// з'являється власний слайдер щільності. Через появу/зникнення слайдерів тут
// використовується renderAll(), щоб повністю перебудувати картку.
function renderSowingDefectControls(row, key) {
  const response = state.responses[key];
  response.defectValues ||= {};
  const wrap = document.createElement("div");
  wrap.className = "control-grid";

  const box = document.createElement("div");
  box.className = "wide";
  box.innerHTML = `<div class="field-label">Дефекти сівби</div>`;
  const list = document.createElement("div");
  list.className = "check-list";
  SOWING_DEFECTS.forEach((choice) => {
    list.append(checkItem(choice, response.choices.includes(choice), (checked) => {
      response.choices = checked ? unique([...response.choices, choice]) : response.choices.filter((item) => item !== choice);
      if (checked) response.defectValues[choice] ??= 0.5;
      if (!checked) delete response.defectValues[choice];
      response.score = Math.max(0, ...Object.values(response.defectValues).map(defectValueToScore));
      renderAll();
    }));
  });
  box.append(list);
  wrap.append(box);

  response.choices.forEach((defect) => {
    response.defectValues[defect] ??= 0.5;
    wrap.append(sliderControl({
      label: `${defect}, шт/пог. м`,
      value: response.defectValues[defect],
      min: 0.5,
      max: 10,
      step: 0.5,
      text: (value) => `${formatNumber(value)} шт/пог. м - ${defectDensityLabel(value)}`,
      state: (value) => problemState(defectValueToScore(value)),
      onInput: (value) => {
        response.defectValues[defect] = Number(value);
        response.score = Math.max(0, ...Object.values(response.defectValues).map(defectValueToScore));
        renderReport();
        renderProgress();
      },
    }));
  });

  return wrap;
}

// Рендерить забур'яненість.
// Одна відповідь може містити кілька груп бур'янів, окремі scores по групах
// і додатковий список інвазивних/злісних видів.
function renderWeedControls(row, key) {
  const response = state.responses[key];
  const wrap = document.createElement("div");
  wrap.className = "control-grid";
  response.weedScores ||= {};

  const box = document.createElement("div");
  box.className = "wide";
  box.innerHTML = `<div class="field-label">Групи бур'янів</div>`;
  const list = document.createElement("div");
  list.className = "check-list weed-list";
  WEED_GROUPS.forEach((choice) => {
    list.append(checkItem(choice, response.choices.includes(choice), (checked) => {
      response.choices = checked ? unique([...response.choices, choice]) : response.choices.filter((item) => item !== choice);
      if (!checked) {
        delete response.weedScores[choice];
        if (choice.includes("Інвазивні")) response.invasiveSpecies = [];
      } else {
        response.weedScores[choice] ??= 1;
      }
      response.score = Math.max(0, ...Object.values(response.weedScores).map(Number));
      renderAll();
    }));
  });
  box.append(list);
  wrap.append(box);

  response.choices.forEach((group) => {
    response.weedScores[group] ??= 1;
    wrap.append(sliderControl({
      label: `Рівень: ${group}`,
      value: response.weedScores[group],
      min: 1,
      max: 5,
      step: 1,
      text: thresholdScoreText,
      state: problemState,
      onInput: (value) => {
        response.weedScores[group] = Number(value);
        response.score = Math.max(0, ...Object.values(response.weedScores).map(Number));
        renderReport();
        renderProgress();
      },
    }));
  });

  if (response.choices.includes("Інвазивні / злісні")) {
    const panel = document.createElement("div");
    panel.className = "choice-panel wide";
    panel.innerHTML = `<div class="field-label">Вид інвазивного / злісного бур'яну</div>`;
    const speciesList = document.createElement("div");
    speciesList.className = "check-list";
    invasiveWeedOptions().forEach((choice) => {
      speciesList.append(checkItem(choice, response.invasiveSpecies.includes(choice), (checked) => {
        response.invasiveSpecies = checked ? unique([...response.invasiveSpecies, choice]) : response.invasiveSpecies.filter((item) => item !== choice);
        renderReport();
        renderProgress();
      }));
    });
    panel.append(speciesList);
    wrap.append(panel);
  }

  return wrap;
}

// Рендерить вибір проблем із довідникового пулу: хвороби або шкідники.
// Після вибору хоча б одного елемента показується загальний слайдер сили проблеми.
function renderProblemPoolControls(row, key, label, options) {
  const response = state.responses[key];
  const wrap = document.createElement("div");
  wrap.className = "control-grid";

  const picker = document.createElement("div");
  picker.className = "choice-panel wide";
  picker.innerHTML = `
    <label>
      <span>${label}</span>
      <select>
        <option value="">Оберіть зі списку</option>
        ${options.filter((item) => !response.choices.includes(item)).map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}
      </select>
    </label>
    <div class="selected-pool" aria-label="Вибраний пул"></div>
  `;
  const selectedPool = picker.querySelector(".selected-pool");
  renderSelectedPool(selectedPool, response.choices, (choice) => {
    response.choices = response.choices.filter((item) => item !== choice);
    renderAll();
  });
  picker.querySelector("select").addEventListener("change", (event) => {
    if (event.target.value) {
      response.choices = unique([...response.choices, event.target.value]);
      event.target.value = "";
      renderAll();
    }
  });
  wrap.append(picker);

  if (response.choices.length) {
    response.score = response.score > 0 ? response.score : 1;
    wrap.append(sliderControl({
      label: "Загальний рівень проблеми",
      value: response.score,
      min: 1,
      max: 5,
      step: 1,
      text: thresholdScoreText,
      state: problemState,
      onInput: (value) => {
        response.score = Number(value);
        renderReport();
        renderProgress();
      },
    }));
  } else {
    response.score = 0;
  }

  return wrap;
}

// Fallback-контрол для параметрів, які не мають спеціальної логіки.
// Якщо тип вводу в Excel містить чекбокси, показуємо список вибору.
// Якщо є sliderSpec(), показуємо слайдер. Інакше показуємо простий select.
function renderGenericControls(row, key) {
  const response = state.responses[key];
  const wrap = document.createElement("div");
  wrap.className = "control-grid";
  const inputType = row[fieldMap.inputType].toLowerCase();
  const slider = sliderSpec(row);
  const hasCheckboxes = inputType.includes("чекбокс") && !isSoilStructure(row);

  if (hasCheckboxes) {
    const box = document.createElement("div");
    box.className = "wide";
    box.innerHTML = `<div class="field-label">Виберіть зі списку</div>`;
    const list = document.createElement("div");
    list.className = "check-list";
    splitChoices(row[fieldMap.values]).slice(0, 8).forEach((choice) => {
      list.append(checkItem(choice, response.choices.includes(choice), (checked) => {
        response.choices = checked ? unique([...response.choices, choice]) : response.choices.filter((item) => item !== choice);
        renderReport();
        renderProgress();
      }));
    });
    box.append(list);
    wrap.append(box);
  }

  if (slider) {
    wrap.append(sliderControl({
      label: slider.label,
      value: response.score,
      min: slider.min,
      max: slider.max,
      step: slider.step,
      text: slider.text,
      state: slider.state,
      onInput: (value) => {
        response.score = Number(value);
        response.numeric = slider.numeric ? Number(value) : "";
        response.choices = [slider.text(Number(value))];
        renderReport();
        renderProgress();
      },
    }));
  }

  if (!hasCheckboxes && !slider) {
    wrap.append(selectControl("Стан", response.status || "", splitChoices(row[fieldMap.values]).slice(0, 8), (value) => {
      response.status = value;
      response.choices = value ? [value] : [];
      renderReport();
      renderProgress();
    }));
  }

  return wrap;
}

// Базовий компонент слайдера.
// Приймає функції text/state, тому один і той самий DOM-компонент працює
// для температури, вологості, густоти, дефектів і будь-яких майбутніх шкал.
function sliderControl({ label, value, min, max, step, text, state, onInput }) {
  const control = document.createElement("label");
  const currentState = state ? state(value) : problemState(value);
  control.className = `wide slider-field ${currentState}`;
  control.innerHTML = `
    <span>${label}</span>
    <div class="slider-row">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}">
      <output class="score-badge">${escapeHtml(text(value))}</output>
    </div>
  `;
  const input = control.querySelector("input");
  const output = control.querySelector("output");
  input.addEventListener("input", () => {
    const numericValue = Number(input.value);
    onInput(numericValue);
    output.textContent = text(numericValue);
    control.className = `wide slider-field ${state ? state(numericValue) : problemState(numericValue)}`;
  });
  return control;
}

// Базовий select-контрол із placeholder-опцією.
function selectControl(label, value, options, onInput) {
  const control = document.createElement("label");
  const safeOptions = ["", ...unique(options.filter(Boolean))];
  control.innerHTML = `<span>${label}</span><select>${safeOptions.map((item, index) => `<option value="${escapeHtml(item)}" ${item === value ? "selected" : ""}>${escapeHtml(item || (index === 0 ? "Оберіть значення" : item))}</option>`).join("")}</select>`;
  control.querySelector("select").addEventListener("change", (event) => onInput(event.target.value));
  return control;
}

// Базовий checkbox-елемент для списків вибору.
function checkItem(label, checked, onChange, extraClass = "") {
  const item = document.createElement("label");
  item.className = `check-item ${extraClass}`.trim();
  item.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""}><span>${escapeHtml(label)}</span>`;
  item.querySelector("input").addEventListener("change", (event) => onChange(event.target.checked));
  return item;
}

// Показує вже вибрані елементи пулу як кнопки-чипи.
// Натискання на чип видаляє елемент із відповіді.
function renderSelectedPool(container, choices, onRemove) {
  container.innerHTML = choices.length
    ? choices.map((choice) => `<button type="button" class="pool-chip" data-value="${escapeHtml(choice)}">${escapeHtml(choice)} <span>×</span></button>`).join("")
    : `<span class="empty-pool">Пул поки порожній</span>`;
  container.querySelectorAll(".pool-chip").forEach((button) => {
    button.addEventListener("click", () => onRemove(button.dataset.value));
  });
}

// Обробляє вибір фото.
// Фото читаються як dataUrl, бо експортований HTML-звіт має бути самодостатнім
// і містити зображення без посилань на локальні файли.
async function handlePhotos(event) {
  const files = [...event.target.files];
  state.photos = await Promise.all(files.map(readPhoto));
  renderPhotos();
  renderReport();
  renderProgress();
}

// Читає один файл через FileReader і повертає metadata + dataUrl.
function readPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, size: file.size, type: file.type, dataUrl: reader.result });
    reader.readAsDataURL(file);
  });
}

// Оновлює підказку про потрібну кількість фото і сітку прев'ю.
// requiredPhotoCount() враховує 2 базові фото + додаткові фото за сильні проблеми.
function renderPhotos() {
  const requiredPhotos = requiredPhotoCount(collectInspection());
  byId("photoHint").textContent = `Додано ${state.photos.length} з ${requiredPhotos} потрібних фото. Мінімум 2, плюс 1 за кожну сильну проблему.`;
  byId("photoPreview").innerHTML = state.photos
    .map((photo, index) => `<figure><img src="${photo.dataUrl}" alt="Фото ${index + 1}"><figcaption>${escapeHtml(photo.name)}</figcaption></figure>`)
    .join("");
}
