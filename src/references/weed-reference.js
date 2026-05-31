// Довідник бур'янів.
// Тут зібрана логіка витягування інвазивних/злісних видів із текстового поля
// Excel-конфіга. UI отримує вже чистий масив варіантів.
(function () {
  const references = window.AgroReferences || {};

  function invasiveSpeciesForCrop(config, fieldMap, crop) {
    const text = config.weeds
      .filter((row) => row[fieldMap.crop] === crop && String(row["Група бур'янів"]).toLowerCase().includes("інвазив"))
      .map((row) => row["Що обирає агроном"])
      .join("; ");

    return splitReferenceChoices(text).map((item) => item.replace(/^злісні\/інвазивні:\s*/i, "").trim());
  }

  function splitReferenceChoices(text) {
    return uniqueValues(
      String(text || "")
        .replace(/^\d+\s*групи:\s*/i, "")
        .split(/;|,|\n/)
        .map((item) => item.replace(/^\d+\s*/, "").trim())
        .filter((item) => item && item.length < 90)
    );
  }

  function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
  }

  references.weeds = { invasiveSpeciesForCrop };
  window.AgroReferences = references;
})();
