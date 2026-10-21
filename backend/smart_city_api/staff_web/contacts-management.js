"use strict";

const contactKinds = { phone: "Телефон", email: "Почта", address: "Адрес", website: "Сайт", schedule: "График" };
const contactTemplates = [
  { id: "dispatcher", label: "Диспетчерская", title: "Диспетчерская", kind: "phone", match: /диспетчер/i, note: "Часы работы", group: "connection" },
  { id: "email", label: "Электронная почта", title: "Электронная почта", kind: "email", group: "connection" },
  { id: "website", label: "Сайт УК", title: "Сайт УК", kind: "website", group: "connection" },
  { id: "office", label: "Адрес офиса", title: "Адрес офиса", kind: "address", group: "office", wide: true },
  { id: "hours", label: "График работы", title: "График работы", kind: "schedule", match: /график|работ/i, placeholder: "Пн–пт, 9:00–18:00", group: "office" },
  { id: "reception", label: "Приём жителей", title: "Приём жителей", kind: "schedule", match: /при[её]м/i, placeholder: "Вт, 15:00–18:00", group: "office" },
  { id: "emergency", label: "Аварийная служба", title: "Телефон", kind: "phone", match: /авари|экстрен/i, note: "Часы работы", group: "emergency" },
];
let contactTemplateRecords = new Map();
let contactScope = "house";
let contactBaseline = "";
let contactCompany = "";

function contactValueAttributes(kind) {
  if (kind === "email") return 'type="email" autocomplete="email" placeholder="Адрес электронной почты"';
  if (kind === "website") return 'type="url" autocomplete="url" placeholder="https://"';
  if (kind === "phone") return 'type="tel" autocomplete="tel" placeholder="Номер телефона"';
  if (kind === "schedule") return 'type="text" placeholder="Дни и время приёма"';
  return 'type="text" autocomplete="street-address" placeholder="Улица, дом, офис"';
}

function readExtraContacts() {
  return [...$("contact-extra-rows").querySelectorAll("[data-contact-row]")].map(row => Object.fromEntries(
    [...row.querySelectorAll("[data-contact-field]")].map(input => [input.dataset.contactField, input.value.trim()])
  ));
}

function readContactDraft() {
  const items = contactTemplates.flatMap(spec => {
    const value = $("contact-" + spec.id)?.value.trim();
    if (!value) return [];
    const previous = contactTemplateRecords.get(spec.id);
    return [{ label: previous?.label || spec.label, kind: spec.kind, value, note: spec.note ? $("contact-" + spec.id + "-note").value.trim() : previous?.note || "" }];
  });
  return [...items, ...readExtraContacts()];
}

function renderExtraContacts(items) {
  $("contact-extra-rows").innerHTML = items.map((item, index) => `<fieldset class="contact-extra-row" data-contact-row>
    <legend>Дополнительный контакт ${index + 1}</legend>
    <label>Название<input data-contact-field="label" value="${esc(item.label)}" maxlength="100" required></label>
    <label>Тип<select data-contact-field="kind">${Object.entries(contactKinds).map(([kind, label]) => `<option value="${kind}"${kind === item.kind ? " selected" : ""}>${label}</option>`).join("")}</select></label>
    <label class="contact-field-wide">Контакт<input data-contact-field="value" ${contactValueAttributes(item.kind)} value="${esc(item.value)}" maxlength="300" required></label>
    <label class="contact-field-wide">Примечание<input data-contact-field="note" value="${esc(item.note)}" maxlength="200"></label>
    <button type="button" class="secondary" data-remove-contact="${index}" aria-label="Удалить дополнительный контакт ${index + 1}">Удалить</button>
  </fieldset>`).join("");
  $("contact-extra-count").textContent = items.length ? String(items.length) : "";
}

function renderContactRows(items) {
  const remaining = items.map(item => ({ ...item }));
  contactTemplateRecords = new Map();
  for (const spec of [...contactTemplates].sort((a, b) => Number(!!b.match) - Number(!!a.match))) {
    const index = remaining.findIndex(item => item.kind === spec.kind && (spec.match ? spec.match.test(item.label) : true));
    if (index !== -1) contactTemplateRecords.set(spec.id, remaining.splice(index, 1)[0]);
  }
  if (!contactTemplateRecords.has("dispatcher")) {
    const index = remaining.findIndex(item => item.kind === "phone");
    if (index !== -1) contactTemplateRecords.set("dispatcher", remaining.splice(index, 1)[0]);
  }
  $("contact-rows").innerHTML = [["connection", "Связь с УК"], ["office", "Офис и приём"], ["emergency", "Аварийная служба"]].map(([group, title]) => `<section class="contact-form-section" aria-labelledby="contact-group-${group}"><h2 id="contact-group-${group}">${title}</h2><div class="contact-form-grid">${contactTemplates.filter(spec => spec.group === group).map(spec => {
    const item = contactTemplateRecords.get(spec.id);
    const attributes = spec.placeholder ? `type="text" placeholder="${esc(spec.placeholder)}"` : contactValueAttributes(spec.kind);
    const field = `<label${spec.wide ? ' class="contact-field-wide"' : ""} for="contact-${spec.id}">${spec.title}<input id="contact-${spec.id}" data-contact-template="${spec.id}" ${attributes} value="${esc(item?.value || "")}" maxlength="300"></label>`;
    return field + (spec.note ? `<label for="contact-${spec.id}-note">${spec.note}<input id="contact-${spec.id}-note" data-contact-template-note="${spec.id}" value="${esc(item?.note || "")}" maxlength="200" placeholder="Дни и часы работы"></label>` : "");
  }).join("")}</div></section>`).join("");
  renderExtraContacts(remaining);
  contactBaseline = JSON.stringify(readContactDraft());
  updateContactPreview();
}

function contactTargets() {
  return contactScope === "all" ? state.profile.contact_houses.map(house => house.id) : [Number(contactState.house)];
}

function updateContactScope() {
  const houses = state.profile?.contact_houses || [];
  const all = contactScope === "all";
  $("contact-house-field").hidden = all;
  $("contact-all-notice").hidden = !all;
  $("contact-house-count").textContent = String(houses.length);
  $("show-contact-houses").textContent = `Посмотреть дома · ${houses.length}`;
  $("contact-target-houses").innerHTML = houses.map(house => `<li>${esc(house.address)}</li>`).join("");
  $("save-contacts").textContent = all ? `Сохранить для всех · ${houses.length}` : "Сохранить контакты";
  const house = houses.find(item => String(item.id) === contactState.house);
  $("contact-preview-address").textContent = all ? `Основа — ${house?.address || "выбранный дом"}` : house?.address || "";
}

function updateContactPreview() {
  const items = readContactDraft();
  const row = item => `<div class="contact-preview-item"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong>${item.note ? `<small>${esc(item.note)}</small>` : ""}</div>`;
  $("contact-preview-content").innerHTML = items.filter(item => item.value).map(item => item.kind === "phone" && /авари|экстрен/i.test(item.label)
    ? `<div class="contact-preview-emergency"><h3>${esc(item.label)}</h3><strong>${esc(item.value)}</strong>${item.note ? `<p>${esc(item.note)}</p>` : ""}</div>`
    : row(item)).join("") || '<p class="contact-preview-empty">Заполните нужные контакты</p>';
  $("add-contact").disabled = contactState.saving || items.length >= 12;
}

function contactBusy(busy) {
  $("contacts-fields").disabled = busy;
  $("contact-scope").disabled = busy || !state.profile?.contact_houses.length;
  $("contact-scope").querySelector('[value="all"]').disabled = busy || (state.profile?.contact_houses.length || 0) < 2;
  $("contact-house").disabled = busy || !state.profile?.contact_houses.length;
  $("refresh-contacts").disabled = busy;
  $("save-contacts").disabled = busy || !contactState.loaded;
  $("contacts-form").setAttribute("aria-busy", String(busy));
}

async function loadContacts() {
  if (!state.profile || contactState.saving) return;
  const house = $("contact-house").value;
  const request = ++contactState.request;
  contactState.house = house; contactState.loaded = false; contactState.loading = true; contactState.dirty = false;
  $("contacts-body").hidden = true; $("contacts-form").hidden = true;
  showError("contacts-error", ""); contactBusy(true); updateContactScope();
  $("contacts-status").textContent = house ? "Загружаем контакты…" : "Пока вам не назначены дома. Попросите администратора добавить доступ.";
  try {
    if (!house) return;
    const data = await api(`/houses/${encodeURIComponent(house)}/contacts`);
    if (request !== contactState.request || !state.profile) return;
    contactCompany = data.company_name; $("contact-company").textContent = contactCompany;
    renderContactRows(data.items); contactState.loaded = true;
    $("contacts-form").hidden = false; $("contacts-body").hidden = false; $("contacts-status").textContent = "";
  } catch (error) {
    if (request === contactState.request && state.profile) { showError("contacts-error", error.message); $("contacts-status").textContent = "Нажмите «Обновить», чтобы повторить загрузку."; }
  } finally {
    if (request === contactState.request) { contactState.loading = false; contactBusy(false); }
  }
}

async function canDiscardContacts() {
  return !contactState.dirty || await confirmAction({ title: "Сбросить изменения?", description: "Несохранённые контакты будут заменены данными с сервера.", confirmLabel: "Сбросить", destructive: true });
}

function contactDraftChanged() {
  contactState.dirty = JSON.stringify(readContactDraft()) !== contactBaseline;
  $("contacts-status").textContent = contactState.dirty ? "Есть несохранённые изменения." : "";
  showError("contacts-error", ""); updateContactPreview();
}

$("refresh-contacts").addEventListener("click", async () => { if (await canDiscardContacts() && state.profile) void loadContacts(); });
$("show-contact-houses").addEventListener("click", () => $("contact-houses-dialog").showModal());
$("close-contact-houses").addEventListener("click", () => $("contact-houses-dialog").close());
$("contact-houses-dialog").addEventListener("click", event => {
  const rect = event.currentTarget.getBoundingClientRect();
  if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) event.currentTarget.close();
});
$("contact-house").addEventListener("change", async () => {
  const next = $("contact-house").value; $("contact-house").value = contactState.house;
  if (await canDiscardContacts() && state.profile) { $("contact-house").value = next; void loadContacts(); }
});
$("contact-scope").addEventListener("change", event => {
  if (event.target.name !== "contact-scope" || contactState.saving || contactState.loading) return;
  contactScope = event.target.value; updateContactScope();
});
$("contacts-fields").addEventListener("input", event => { if (event.target instanceof HTMLInputElement) event.target.setCustomValidity(""); contactDraftChanged(); });
$("contacts-fields").addEventListener("invalid", event => {
  if (event.target.closest("#contact-extra")) $("contact-extra").open = true;
}, true);
$("contacts-fields").addEventListener("change", event => {
  if (event.target.dataset.contactField === "kind") {
    const input = event.target.closest("[data-contact-row]").querySelector('[data-contact-field="value"]');
    const holder = document.createElement("div"); holder.innerHTML = `<input ${contactValueAttributes(event.target.value)}>`;
    input.type = holder.firstChild.type; input.placeholder = holder.firstChild.placeholder; input.setCustomValidity("");
  }
  contactDraftChanged();
});
$("add-contact").addEventListener("click", () => {
  if (readContactDraft().length >= 12) return;
  const extra = readExtraContacts(); extra.push({ label: "", kind: "phone", value: "", note: "" });
  renderExtraContacts(extra); $("contact-extra").open = true; contactDraftChanged();
  $("contact-extra-rows").lastElementChild.querySelector("input").focus();
});
$("contact-extra-rows").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-contact]"); if (!button) return;
  const extra = readExtraContacts(); extra.splice(Number(button.dataset.removeContact), 1);
  renderExtraContacts(extra); contactDraftChanged(); $("add-contact").focus();
});

$("contacts-form").addEventListener("submit", async event => {
  event.preventDefault(); if (!contactState.loaded || contactState.saving || contactState.loading) return;
  for (const input of $("contacts-fields").querySelectorAll('input[type="tel"]')) {
    const digits = input.value.replace(/\D/g, "").length;
    input.setCustomValidity(input.value && (!/^\+?[0-9 ()-]+$/.test(input.value.trim()) || digits < 3 || digits > 15) ? "Укажите корректный номер телефона" : "");
  }
  if (!$("contacts-form").reportValidity()) return;
  const items = readContactDraft(), targets = contactTargets(), request = contactState.request, profile = state.profile;
  if (items.length > 12) { showError("contacts-error", "Можно сохранить до 12 контактов. Удалите лишние дополнительные контакты."); return; }
  const bulk = contactScope === "all";
  if ((bulk || !items.length) && !await confirmAction({ title: items.length ? `Обновить контакты в ${targets.length} домах?` : "Удалить все контакты?", description: items.length ? "Контакты из этой формы заменят текущие контакты всех выбранных домов. Их сразу увидят жители." : `В выбранных домах (${targets.length}) больше не будет контактов УК.`, confirmLabel: items.length ? "Обновить контакты" : "Удалить контакты", destructive: !items.length })) return;
  if (contactState.saving || request !== contactState.request || profile !== state.profile) return;
  contactState.saving = true; contactBusy(true); showError("contacts-error", "");
  $("contacts-status").textContent = "Сохраняем контакты…";
  try {
    const data = await api(bulk ? "/contacts/bulk" : `/houses/${targets[0]}/contacts`, { method: "POST", body: JSON.stringify(bulk ? { house_ids: targets, items } : { items }) });
    if (request !== contactState.request || !state.profile) return;
    renderContactRows(bulk ? items : data.items); contactState.dirty = false;
    $("contacts-status").textContent = bulk ? `Контакты сохранены для всех выбранных домов: ${data.updated_count}.` : "Контакты сохранены и доступны жителям этого дома.";
    toast(bulk ? `Контакты сохранены · домов: ${data.updated_count}` : "Контакты сохранены");
  } catch (error) {
    if (request === contactState.request && state.profile) { showError("contacts-error", error.message); $("contacts-status").textContent = "Изменения остались в форме. Попробуйте ещё раз."; }
  } finally { contactState.saving = false; contactBusy(contactState.loading); updateContactScope(); }
});

window.resetStaffContacts = () => {
  $("contact-houses-dialog").close();
  contactScope = "house";
  contactTemplateRecords.clear(); contactBaseline = ""; contactCompany = "";
  $("contact-scope").querySelector('[value="house"]').checked = true;
  $("contact-extra-rows").replaceChildren(); $("contact-extra").open = false;
  $("contact-preview-content").replaceChildren(); $("contacts-body").hidden = true;
};
window.loadStaffContacts = loadContacts;
if (state.profile && location.hash === "#contacts" && !contactState.loaded && !contactState.loading) void loadContacts();
