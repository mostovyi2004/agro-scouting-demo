// Довідник культур і періодів інспектування.
// Усі функції приймають config і fieldMap явно, щоб довідник не залежав від DOM
// і міг бути повторно використаний у тестах або майбутньому API-шарі.
(function () {
  const references = window.AgroReferences || {};

  function list(config, fieldMap) {
    return uniqueValues(config.parameters.map((row) => row[fieldMap.crop]));
  }

  function periodsForCrop(config, fieldMap, crop) {
    return uniqueValues(
      config.parameters
        .filter((row) => row[fieldMap.crop] === crop)
        .map((row) => row[fieldMap.period])
    );
  }

  function parametersForSelection(config, fieldMap, crop, period) {
    return config.parameters.filter((row) => row[fieldMap.crop] === crop && row[fieldMap.period] === period);
  }

  function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
  }

  references.crops = { list, periodsForCrop, parametersForSelection };
  window.AgroReferences = references;
})();
