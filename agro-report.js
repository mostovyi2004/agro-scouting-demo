// ============================================================================
// Побудова HTML-звіту
// ----------------------------------------------------------------------------
// Експорт винесений окремо, бо в реальному проєкті це часто стає окремим
// сервісом: HTML/PDF, шаблони для керівництва, друк, відправка в CRM тощо.
// ============================================================================

(function () {

function buildInspectionHtmlReport({ data, status, statusClass, escapeHtml }) {
  const rows = data.observations.map((item) => reportObservationRow(item, escapeHtml)).join("");
  const photos = reportPhotos(data.photos, escapeHtml);

  return `<!doctype html>
<html lang="uk">
<meta charset="utf-8">
<title>Звіт інспекції</title>
<style>
  :root{--ink:#17211b;--muted:#66736b;--line:#d9e2da;--soft:#f4f7f2;--green:#24745a;--warn:#b97814;--orange:#b85f22;--red:#a83a31}
  *{box-sizing:border-box}
  body{margin:0;background:#eef3ee;color:var(--ink);font-family:Arial,"Segoe UI",sans-serif;font-size:15px}
  main{width:min(1180px,100%);margin:0 auto;padding:34px 26px 48px}
  .hero{padding:26px 28px;border-radius:10px;background:white;border:1px solid var(--line);box-shadow:0 16px 36px rgba(23,33,27,.08)}
  .top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
  .top-info{display:flex;align-items:flex-start;gap:18px}
  h1{margin:0 0 10px;font-size:34px;letter-spacing:0}
  h2{margin:28px 0 12px;font-size:22px}
  .report-id{min-width:210px;padding:10px 14px;border-radius:8px;background:var(--soft);border:1px solid var(--line);color:var(--muted)}
  .report-id span{display:block;font-size:12px;font-weight:800;text-transform:uppercase}
  .report-id strong{display:block;margin-top:4px;color:var(--ink);font-size:15px;line-height:1.25;word-break:break-all}
  .status{padding:10px 14px;border-radius:999px;color:white;font-weight:800;white-space:nowrap}
  .ok{background:var(--green)}.warn{background:var(--warn)}.orange{background:var(--orange)}.danger{background:var(--red)}
  .meta{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:18px}
  .meta div{padding:12px;border-radius:8px;background:var(--soft);border:1px solid var(--line)}
  .meta span{display:block;color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase}
  .meta strong{display:block;margin-top:4px;font-size:16px}
  .summary{margin:18px 0 0;padding:14px 16px;border-left:4px solid var(--green);background:#f7faf6;border-radius:8px}
  table{width:100%;border-collapse:separate;border-spacing:0;background:white;border:1px solid var(--line);border-radius:10px;overflow:hidden}
  th{background:#e8f2ed;color:#24352b;text-align:left;font-size:13px;text-transform:uppercase}
  th,td{padding:12px 14px;border-bottom:1px solid var(--line);vertical-align:top}
  tr:last-child td{border-bottom:0}
  td.num{width:110px;text-align:center;font-weight:900;color:var(--green)}
  figure{display:inline-block;width:31%;min-width:220px;margin:0 1.5% 16px 0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:white}
  img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover}
  figcaption{padding:8px 10px;color:var(--muted);font-size:12px}
  .muted{color:var(--muted)}
  @media(max-width:760px){main{padding:18px}.top,.top-info{display:block}.report-id{margin:14px 0 0;min-width:0}.status{display:inline-block;margin-top:12px}.meta{grid-template-columns:1fr 1fr}figure{width:100%;margin-right:0}}
</style>
<main>
  <section class="hero">
    <div class="top">
      <div class="top-info">
        <div>
          <h1>Звіт агрономічної інспекції</h1>
          <p class="muted">Сформовано з польової форми агроскаутингу</p>
        </div>
        <div class="report-id"><span>ID звіту</span><strong>${escapeHtml(data.inspection.inspection_id || "-")}</strong></div>
      </div>
      <div class="status ${statusClass}">${escapeHtml(status)}</div>
    </div>
    <div class="meta">
      <div><span>Агроном</span><strong>${escapeHtml(data.inspection.agronomist || "-")}</strong></div>
      <div><span>Дата</span><strong>${escapeHtml(data.inspection.date || "-")}</strong></div>
      <div><span>Поле</span><strong>${escapeHtml(data.inspection.field || "-")}</strong></div>
      <div><span>Культура</span><strong>${escapeHtml(data.inspection.crop || "-")}</strong></div>
      <div><span>Період</span><strong>${escapeHtml(data.inspection.period || "-")}</strong></div>
    </div>
    <div class="summary"><strong>Ризики:</strong> ${escapeHtml(data.inspection.operation_risk || "-")}<br>${escapeHtml(data.inspection.summary_comment || "")}</div>
  </section>
  <h2>Спостереження</h2>
  <table><thead><tr><th>Параметр</th><th>Оцінка</th><th>Оцінка числом</th><th>Вибір</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>Фото</h2>
  ${photos}
</main>
</html>`;
}

function reportObservationRow(item, escapeHtml) {
  return `<tr><td>${escapeHtml(item.parameter)}</td><td>${escapeHtml(item.score_label || "-")}</td><td class="num">${escapeHtml(item.score || "-")}</td><td>${escapeHtml(item.choices.length ? item.choices.join(", ") : "Не виявлено")}</td></tr>`;
}

function reportPhotos(photos, escapeHtml) {
  if (!photos.length) return `<p class="muted">Фото не додано</p>`;
  return photos.map((photo) => `<figure><img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}"><figcaption>${escapeHtml(photo.name)}</figcaption></figure>`).join("");
}

window.AgroReport = { buildInspectionHtmlReport };

})();
