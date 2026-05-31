// Довідник хвороб.
// Файл ізолює знання про структуру config.diseases: решта системи просить
// "назви хвороб для культури" і не працює напряму з колонками довідника.
(function () {
  const references = window.AgroReferences || {};

  function namesForCrop(config, fieldMap, crop) {
    return uniqueValues(
      config.diseases
        .filter((row) => row[fieldMap.crop] === crop)
        .map((row) => row["Назва"])
    ).sort((a, b) => a.localeCompare(b, "uk"));
  }

  function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
  }

  references.diseases = { namesForCrop };
  window.AgroReferences = references;
})();
