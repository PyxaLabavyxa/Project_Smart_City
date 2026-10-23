"use strict";

const reportDialog = $("staff-report-dialog");
let reportGeneration = 0, reportSearchGeneration = 0, reportSearchTimer, reportSearchController;
let reportOptions = null, reportPerson = null, reportPeople = [], reportPeoplePage = 1;
let reportSaving = false, reportLoading = false, reportRequest = null, reportDirty = false, reportManual = false;
const reportMode = () => reportManual ? "manual" : "resident";
const reportScope = () => $("report-scope").querySelector("input:checked").value;
const reportApartments = () => reportMode() === "resident" ? reportPerson?.apartments || [] : reportOptions?.apartments || [];

function reportSelect(id, options, empty) {
  const node = $(id), previous = node.value;
  node.innerHTML = (empty === undefined ? "" : `<option value="">${esc(empty)}</option>`) + options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("");
  if ([...node.options].some(option => option.value === previous)) node.value = previous;
}

function reportLocationOptions() {
  const house = state.profile?.houses.find(h => String(h.id) === $("report-house").value);
  if (!house || !reportOptions) return;
  const scope = reportScope(), outdoor = scope === "courtyard", apartment = scope === "apartment";
  const selectedZone = $("report-zone").value;
  reportSelect("report-zone", (outdoor ? ["courtyard", "parking", "house"] : ["corridor", "stairs", "elevator", "entrance", "technical"]).map(zone => [zone, zones[zone]]));
  if (!selectedZone) $("report-zone").value = outdoor ? "courtyard" : "corridor";
  $("report-zone-field").hidden = apartment; $("report-zone").disabled = apartment;
  $("report-location-apartment-field").hidden = !apartment;
  $("report-location-apartment").disabled = !apartment;
  $("report-location-apartment").required = apartment;
  reportSelect("report-location-apartment", reportApartments().map(a => [a.id, `Квартира ${a.number}`]), "Выберите квартиру");
  if (!$("report-location-apartment").value && reportApartments().length === 1) $("report-location-apartment").value = reportApartments()[0].id;
  const place = reportApartments().find(a => String(a.id) === $("report-location-apartment").value);
  const entrance = !apartment && $("report-zone").value === "entrance";
  reportSelect("report-entrance", outdoor ? [["", "Нет подъезда"]] : Array.from({ length: house.entrances_count || 1 }, (_, i) => [i + 1, `Подъезд ${i + 1}`]));
  reportSelect("report-floor", outdoor ? [["", "Нет этажей"]] : Array.from({ length: house.floors_count || 1 }, (_, i) => [i + 1, `Этаж ${i + 1}`]));
  if (apartment && place) { $("report-entrance").value = place.entrance; $("report-floor").value = place.floor; }
  if (entrance) $("report-floor").value = "1";
  $("report-entrance").disabled = outdoor || apartment;
  $("report-floor").disabled = outdoor || apartment || entrance;
  reportSelect("report-category", (reportOptions.categories[scope] || []).map(kind => [kind, categories[kind]]), "Выберите категорию");
}

function reportPersonOptions() {
  const manual = reportMode() === "manual";
  $("report-manual-fields").hidden = !manual;
  $("report-person-search").disabled = manual;
  $("report-person-name").disabled = !manual; $("report-person-name").required = manual;
  $("report-person-phone").required = manual; $("report-phone-optional").hidden = manual;
  reportSelect("report-person-apartment", reportApartments().map(a => [a.id, `Квартира ${a.number}`]), "Не указана");
  if (!manual && reportPerson?.apartments.length === 1) $("report-person-apartment").value = reportPerson.apartments[0].id;
  $("report-person-selected").hidden = !manual && !reportPerson;
  $("report-person-picker").hidden = manual || !!reportPerson;
  $("report-selected-name").textContent = reportPerson?.name || "Данные заявителя";
  $("report-selected-kind").textContent = reportPerson ? reportPerson.apartments.map(a => `Квартира ${a.number}`).join(", ") : "Заявка без аккаунта в приложении";
  $("report-caller-details").hidden = !manual && !reportPerson;
  reportLocationOptions();
}

async function searchReportPeople(append = false) {
  clearTimeout(reportSearchTimer); reportSearchController?.abort();
  const request = ++reportSearchGeneration, generation = reportGeneration;
  if (reportMode() !== "resident" || !reportOptions || !state.profile) return;
  reportSearchController = new AbortController();
  const page = append ? reportPeoplePage + 1 : 1;
  if (!append) { reportPeople = []; $("report-person-results").replaceChildren(); }
  if (!$("report-person-search").value.trim()) {
    $("report-search-status").textContent = ""; $("report-more-people").hidden = true; return;
  }
  $("report-search-status").textContent = "Ищем жителей…"; $("report-more-people").hidden = true;
  try {
    const params = new URLSearchParams({ q: $("report-person-search").value.trim(), page });
    const data = await api(`/houses/${$("report-house").value}/report-residents?${params}`, { signal: reportSearchController.signal });
    if (generation !== reportGeneration || request !== reportSearchGeneration || !reportDialog.open) return;
    reportPeoplePage = page; reportPeople = append ? [...reportPeople, ...data.items] : data.items;
    $("report-person-results").innerHTML = reportPeople.map(p => `<button class="report-person-option" type="button" data-report-person="${p.id}" aria-pressed="${p.id === reportPerson?.id}"><strong>${esc(p.name)}</strong><small>кв. ${p.apartments.map(a => Number(a.number)).join(", ")}</small></button>`).join("");
    $("report-search-status").textContent = data.total ? "" : "В этом доме житель не найден";
    $("report-more-people").hidden = reportPeople.length >= data.total;
  } catch (error) {
    if (generation === reportGeneration && request === reportSearchGeneration && !reportSearchController.signal.aborted) {
      $("report-search-status").textContent = error.message;
      $("report-more-people").textContent = "Повторить поиск"; $("report-more-people").hidden = false;
    }
  }
}

async function loadReportHouse() {
  const generation = ++reportGeneration;
  ++reportSearchGeneration; reportSearchController?.abort(); clearTimeout(reportSearchTimer);
  reportLoading = true; reportOptions = null; reportPerson = null; reportPeople = [];
  reportManual = false;
  for (const id of ["report-person-name", "report-person-phone", "report-person-apartment", "report-location-apartment"]) $(id).value = "";
  $("report-person-phone").setCustomValidity("");
  $("report-person-results").replaceChildren(); $("report-person-search").value = "";
  $("report-person-selected").hidden = true; $("report-person-picker").hidden = false;
  $("report-search-status").textContent = "";
  $("report-more-people").hidden = true;
  $("staff-report-fields").disabled = true; $("submit-staff-report").disabled = true;
  $("report-form-status").textContent = "Загружаем данные дома…"; showError("report-form-error", "");
  try {
    const options = await api(`/houses/${$("report-house").value}/issue-options`);
    if (generation !== reportGeneration || !reportDialog.open || !state.profile) return;
    reportOptions = options;
    $("report-form-status").textContent = "";
    reportPersonOptions();
    if (reportMode() === "resident") void searchReportPeople();
  } catch (error) {
    if (generation === reportGeneration && reportDialog.open) {
      showError("report-form-error", error.message);
      $("report-form-status").textContent = "Выберите дом ещё раз, чтобы повторить загрузку.";
    }
  } finally {
    if (generation === reportGeneration) {
      reportLoading = false; $("staff-report-fields").disabled = false;
      $("submit-staff-report").disabled = !reportOptions;
      if (reportOptions) reportPersonOptions();
    }
  }
}

$("new-staff-report").addEventListener("click", () => {
  if (reportSaving) return;
  if (!state.profile?.houses.length) { toast("Вам пока не назначены дома"); return; }
  $("staff-report-form").reset(); reportPerson = null; reportRequest = null; reportDirty = false; reportManual = false;
  reportSelect("report-house", state.profile.houses.map(h => [h.id, h.address]));
  $("report-house").value = $("house-filter").value || state.profile.houses[0].id;
  $("report-description-count").textContent = "0 / 2000";
  for (const input of $("staff-report-form").querySelectorAll("input")) input.setCustomValidity("");
  reportDialog.showModal(); reportDialog.scrollTop = 0; void loadReportHouse();
});

async function closeReport() {
  if (reportSaving) return;
  if (reportDirty && !await confirmAction({ title: "Закрыть без сохранения?", description: "Введённые данные обращения будут потеряны.", confirmLabel: "Закрыть", destructive: true })) return;
  if (!reportSaving) reportDialog.close();
}
$("close-staff-report").addEventListener("click", () => void closeReport());
$("cancel-staff-report").addEventListener("click", () => void closeReport());
reportDialog.addEventListener("cancel", event => { event.preventDefault(); void closeReport(); });
reportDialog.addEventListener("close", () => {
  ++reportGeneration; ++reportSearchGeneration; clearTimeout(reportSearchTimer); reportSearchController?.abort();
});
$("report-house").addEventListener("change", () => void loadReportHouse());
$("report-add-person").addEventListener("click", () => {
  reportManual = true; reportPerson = null;
  ++reportSearchGeneration; clearTimeout(reportSearchTimer); reportSearchController?.abort();
  const query = $("report-person-search").value.trim();
  if (!$("report-person-name").value && query && !/\d/.test(query)) $("report-person-name").value = query;
  reportPersonOptions(); reportDirty = true; $("report-person-name").focus();
});
$("report-person-search").addEventListener("input", () => {
  clearTimeout(reportSearchTimer); ++reportSearchGeneration; reportSearchController?.abort();
  reportSearchTimer = setTimeout(() => void searchReportPeople(), 250);
});
$("report-more-people").addEventListener("click", () => void searchReportPeople(reportPeople.length > 0));
$("report-change-person").addEventListener("click", () => {
  reportPerson = null; reportManual = false; reportPersonOptions();
  $("report-person-phone").value = "";
  $("report-person-phone").setCustomValidity("");
  $("report-person-name").value = "";
  $("report-person-search").focus();
  void searchReportPeople();
});
$("report-person-results").addEventListener("click", event => {
  const button = event.target.closest("[data-report-person]"); if (!button || reportSaving) return;
  reportPerson = reportPeople.find(p => p.id === Number(button.dataset.reportPerson));
  $("report-person-results").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
  reportPersonOptions(); reportDirty = true; showError("report-form-error", "");
});
for (const id of ["report-scope", "report-zone", "report-location-apartment"]) $(id).addEventListener("change", reportLocationOptions);
$("staff-report-form").addEventListener("input", event => {
  if (event.target instanceof HTMLInputElement) event.target.setCustomValidity("");
  if (event.target.id !== "report-person-search") reportDirty = true;
  $("report-description-count").textContent = `${$("report-description").value.length} / 2000`;
});
$("staff-report-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (reportSaving || reportLoading || !reportOptions) return;
  const manual = reportMode() === "manual", scope = reportScope();
  if (!manual && !reportPerson) { showError("report-form-error", "Выберите жителя или введите данные вручную."); $("report-person-search").focus(); return; }
  const phone = $("report-person-phone").value.trim();
  $("report-person-phone").setCustomValidity(phone && (!/^\+?[0-9 ()-]+$/.test(phone) || phone.replace(/\D/g, "").length < 3 || phone.replace(/\D/g, "").length > 15) ? "Укажите корректный номер телефона" : "");
  if (!$("staff-report-form").reportValidity()) return;
  const payload = {
    house_id: Number($("report-house").value), resident_id: manual ? null : reportPerson.id,
    reporter_name: manual ? $("report-person-name").value.trim() : null,
    reporter_phone: phone || null, reporter_apartment_id: Number($("report-person-apartment").value) || null,
    title: $("report-title").value.trim(), description: $("report-description").value.trim(), category: $("report-category").value, priority: Number($("report-priority").value),
    place: { zone: scope === "apartment" ? "apartment" : $("report-zone").value, entrance: scope === "courtyard" ? null : Number($("report-entrance").value), floor: scope === "courtyard" ? null : Number($("report-floor").value), apartment_id: scope === "apartment" ? Number($("report-location-apartment").value) : null },
  };
  const key = JSON.stringify(payload), generation = reportGeneration;
  if (reportRequest?.key !== key) reportRequest = { key, id: uuid() };
  reportSaving = true; $("staff-report-fields").disabled = true;
  $("submit-staff-report").disabled = true; $("close-staff-report").disabled = true; $("cancel-staff-report").disabled = true;
  $("submit-staff-report").textContent = "Создаём…"; showError("report-form-error", "");
  try {
    const created = await api("/issues", { method: "POST", body: JSON.stringify({ ...payload, request_id: reportRequest.id }) });
    if (generation !== reportGeneration || !state.profile) return;
    reportDirty = false; reportDialog.close(); toast(`Обращение №${created.id} создано`);
    $("house-filter").value = String(created.house_id); $("priority-filter").value = ""; $("search").value = "";
    state.status = ""; state.page = 1; updateStatSelection();
    await loadList(); await openDetail(created.id);
  } catch (error) {
    if (generation === reportGeneration && state.profile) showError("report-form-error", error.message);
  } finally {
    reportSaving = false; $("staff-report-fields").disabled = false;
    $("submit-staff-report").disabled = false; $("close-staff-report").disabled = false; $("cancel-staff-report").disabled = false;
    $("submit-staff-report").textContent = "Создать обращение";
  }
});

window.resetStaffReport = () => { reportDialog.close(); reportOptions = reportPerson = null; reportRequest = null; reportDirty = false; reportManual = false; };
