// Довідник фенологічних фаз.
// Відповідає за сортування фаз культури та повернення списку labels для слайдера.
(function () {
  const references = window.AgroReferences || {};

  function labelsForCrop(config, fieldMap, crop) {
    return config.phases
      .filter((row) => row[fieldMap.crop] === crop)
      .sort((a, b) => Number(a["№"]) - Number(b["№"]))
      .map((row) => row["Фаза для списку"]);
  }

  references.phases = { labelsForCrop };
  window.AgroReferences = references;
})();
