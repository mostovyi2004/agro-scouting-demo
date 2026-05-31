// Довідник шкідників.
// Як і disease-reference, приховує внутрішню структуру config.pests за простим API.
(function () {
  const references = window.AgroReferences || {};

  function namesForCrop(config, fieldMap, crop) {
    return uniqueValues(
      config.pests
        .filter((row) => row[fieldMap.crop] === crop)
        .map((row) => row["Назва"])
    ).sort((a, b) => a.localeCompare(b, "uk"));
  }

  function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
  }

  references.pests = { namesForCrop };
  window.AgroReferences = references;
})();
