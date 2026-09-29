"use strict";

const $ = (id) => document.getElementById(id);
const apiRoot = "/api/v1/staff";
const statuses = { new: "Новое", in_progress: "В работе", resolved: "Решено" };
const priorities = { 1: "Высокий", 2: "Средний", 3: "Низкий" };
const categories = {
  water: "Водоснабжение", heating: "Отопление", electricity: "Электричество",
  elevator: "Лифт", entrance: "Подъезд", yard: "Двор", garbage: "Мусор",
  security: "Безопасность", other: "Другое",
};
const zones = { apartment: "Квартира", corridor: "Коридор", elevator: "Лифт", stairs: "Лестница", entrance: "Подъезд", yard: "Двор", roof: "Крыша", basement: "Подвал" };
const state = { profile: null, status: "", page: 1, total: 0, detail: null, listRequest: 0, detailRequest: 0, busy: false };
const contactState = { request: 0, house: "", loaded: false, dirty: false, loading: false, saving: false };
let searchTimer, toastTimer, messageAction, statusAction;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
const esc = escapeHtml;
function date(value, compact = false) {
  const parsed = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("ru-RU", { day: "2-digit", month: "short", ...(compact ? {} : { year: "numeric" }), hour: "2-digit", minute: "2-digit" });
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function showError(id, text) { $(id).textContent = text; $(id).hidden = !text; }
function toast(text) {
  clearTimeout(toastTimer); $("toast").textContent = text; $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 5000);
}
function showLogin() {
  state.profile = null; state.detail = null; state.listRequest++; state.detailRequest++;
  $("issue-dialog").close(); $("photo-dialog").close();
  $("full-photo").removeAttribute("src"); $("detail-content").replaceChildren();
  $("registrations-body").replaceChildren();
  contactState.request++; contactState.house = ""; contactState.loaded = false; contactState.dirty = false; contactState.loading = false;
  $("contact-rows").replaceChildren(); $("contacts-form").hidden = true;
  $("issues-body").replaceChildren(); $("workspace").hidden = true;
  $("login-screen").hidden = false; $("boot").hidden = true;
}
async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body) headers["Content-Type"] = "application/json";
  if (state.profile && options.method && options.method !== "GET") headers["X-CSRF-Token"] = state.profile.csrf_token;
  let response;
  try {
    response = await fetch(apiRoot + path, { ...options, headers, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(20000) });
  } catch {
    throw new Error("Нет связи с сервером. Проверьте подключение и повторите попытку.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== "/auth/login") showLogin();
    const message = typeof body.detail === "string" ? body.detail : response.status === 422 ? "Проверьте заполненные поля" : "Не удалось выполнить запрос. Попробуйте ещё раз";
    const error = new Error(message); error.status = response.status; throw error;
  }
  return response.status === 204 ? null : response.json();
}
async function enterWorkspace() {
  state.profile = await api("/me"); state.page = 1; state.status = "";
  $("staff-name").textContent = state.profile.name;
  $("avatar").textContent = state.profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  $("house-filter").innerHTML = '<option value="">Все мои дома</option>' + state.profile.houses.map((house) => `<option value="${house.id}">${esc(house.address)}</option>`).join("");
  $("contact-house").innerHTML = state.profile.houses.map((house) => `<option value="${house.id}">${esc(house.address)}</option>`).join("");
  $("priority-filter").value = ""; $("search").value = "";
  $("no-houses").hidden = state.profile.houses.length > 0;
  $("login-screen").hidden = true; $("workspace").hidden = false; $("boot").hidden = true;
  updateStatSelection();
  await loadList();
  switchSection();
}
function updateStatSelection() {
  document.querySelectorAll(".stat").forEach((button) => {
    const selected = button.dataset.status === state.status;
    button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected));
  });
}
function badge(status) { return `<span class="badge ${esc(status)}"><i class="status-dot ${esc(status)}"></i>${esc(statuses[status] || status)}</span>`; }
async function loadList() {
  if (!state.profile) return;
  const request = ++state.listRequest;
  const params = new URLSearchParams({ page: state.page, page_size: 25 });
  for (const [key, value] of Object.entries({ status: state.status, house_id: $("house-filter").value, priority: $("priority-filter").value, q: $("search").value.trim() })) if (value) params.set(key, value);
  $("refresh").disabled = true;
  try {
    const data = await api(`/issues?${params}`);
    if (request !== state.listRequest || !state.profile) return;
    showError("list-error", ""); state.total = data.total;
    if (state.page > 1 && (state.page - 1) * 25 >= data.total) { state.page = Math.max(1, Math.ceil(data.total / 25)); return loadList(); }
    $("count-all").textContent = Object.values(data.counts).reduce((a, b) => a + b, 0);
    $("count-new").textContent = data.counts.new; $("count-progress").textContent = data.counts.in_progress;
    $("count-resolved").textContent = data.counts.resolved; $("nav-count").textContent = data.counts.new;
    $("total-label").textContent = data.total;
    $("issues-body").innerHTML = data.items.map((issue) => `<tr>
      <td><button class="issue-title" data-open="${issue.id}">${esc(issue.title)}</button><span class="row-meta">№ ${issue.id} · ${esc(categories[issue.category])}${issue.photo_count ? ` · Фото: ${issue.photo_count}` : ""}</span></td>
      <td class="address-cell">${esc(issue.address)}<span class="row-meta">${esc(issue.author)}</span></td>
      <td class="priority-cell"><span class="priority p${issue.priority}">${esc(priorities[issue.priority])}</span></td>
      <td class="status-cell">${badge(issue.status)}</td><td class="date-cell">${esc(date(issue.created_at, true))}</td>
      <td class="open-cell"><button class="row-open" data-open="${issue.id}" aria-label="Открыть обращение №${issue.id}">↗</button></td></tr>`).join("");
    $("empty").hidden = data.total !== 0;
    $("prev-page").disabled = state.page <= 1; $("next-page").disabled = state.page * 25 >= data.total;
    $("page-label").textContent = data.total ? `${(state.page - 1) * 25 + 1}–${Math.min(state.page * 25, data.total)} из ${data.total} обращений` : "Нет обращений";
    $("sync-label").textContent = `Обновлено ${new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    if (request !== state.listRequest) return;
    showError("list-error", error.message); $("sync-label").textContent = "Нет обновлений";
    $("page-label").textContent = "Не удалось обновить список";
  } finally { if (request === state.listRequest) $("refresh").disabled = false; }
}
function renderConversation(detail) {
  if (!$("conversation")) return;
  const conversation = $("conversation"), oldTop = conversation.scrollTop;
  const atEnd = conversation.scrollHeight - conversation.scrollTop - conversation.clientHeight < 35;
  conversation.innerHTML = detail.messages.length ? detail.messages.map((message) => {
    const delivery = detail.notifications.find((notice) => notice.message_id === message.id);
    const deliveryText = delivery ? { sent: "Отправлено в MAX", pending: "Ожидает отправки в MAX", retrying: "Бот повторит отправку в MAX" }[delivery.delivery] : "";
    return `<div class="bubble ${message.direction}"><div class="message-top"><strong>${esc(message.author)}${message.direction === "staff" ? " · УК" : " · житель"}</strong><time>${esc(date(message.created_at, true))}</time></div><p>${esc(message.text)}</p>${deliveryText ? `<div class="delivery-label">${esc(deliveryText)}</div>` : ""}</div>`;
  }).join("") : '<p class="conversation-empty">Здесь можно уточнить детали у жителя. Он получит сообщение в MAX и сможет ответить через кнопку в боте.</p>';
  conversation.scrollTop = atEnd ? conversation.scrollHeight : oldTop;
  const pending = detail.notifications.filter((notice) => notice.delivery !== "sent").length;
  $("delivery-summary").textContent = pending ? `Уведомлений в очереди: ${pending}. Бот отправит их автоматически. При сбое доставка повторится.` : "Уведомления отправляются автору обращения в MAX.";
  $("history").innerHTML = detail.history.length ? detail.history.map((event) => `<li>${badge(event.status)}<time>${esc(date(event.created_at))}</time></li>`).join("") : `<li>${badge(detail.status)}<span class="muted">История изменений пока пуста</span></li>`;
  $("live-status").innerHTML = badge(detail.status);
  if (state.detail && detail.status !== state.detail.status) showError("detail-error", "Статус изменил другой сотрудник. Нажмите ↻ вверху, чтобы обновить обращение.");
}
async function openDetail(id) {
  if (state.busy) return;
  const request = ++state.detailRequest;
  try {
    const detail = await api(`/issues/${id}`);
    if (request !== state.detailRequest || !state.profile) return;
    state.detail = detail; messageAction = statusAction = null;
    $("detail-number").textContent = `ОБРАЩЕНИЕ № ${detail.id}`;
    const place = [detail.address, detail.entrance && `подъезд ${detail.entrance}`, detail.floor != null && `этаж ${detail.floor}`, detail.apartment != null && `кв. ${detail.apartment}`, detail.zone && (zones[detail.zone] || detail.zone)].filter(Boolean).join(" · ");
    $("detail-content").innerHTML = `<div class="detail-main">
      <div id="live-status">${badge(detail.status)}</div><h2 id="detail-title">${esc(detail.title)}</h2><p class="detail-place">${esc(place)}</p>
      <div class="detail-meta"><span>${esc(detail.author)}</span><span>·</span><time>${esc(date(detail.created_at))}</time><span class="priority p${detail.priority}">${esc(priorities[detail.priority])} приоритет</span></div>
      <section class="section"><h3>Что произошло</h3><p class="description">${esc(detail.description)}</p>${detail.photos.length ? `<div class="photos">${detail.photos.map((photo, index) => `<button class="photo-thumb" data-photo="${photo.id}" aria-label="Открыть фото ${index + 1}"><img src="${esc(photo.url)}" alt="Фото ${index + 1}" loading="lazy"></button>`).join("")}</div><p class="form-help">Нажмите на фото, чтобы рассмотреть его</p>` : '<p class="form-help">Житель не прикрепил фотографии</p>'}</section>
      <section class="section"><h3>Статус обращения</h3><form id="status-form" class="status-form"><label class="sr-only" for="status-select">Новый статус</label><select id="status-select">${Object.entries(statuses).map(([value, label]) => `<option value="${value}"${value === detail.status ? " selected" : ""}>${label}</option>`).join("")}</select><button class="primary" type="submit">Сохранить статус</button></form><p class="form-help">Автор получит уведомление в боте. Отмечайте обращение решённым после устранения проблемы.</p><p id="detail-error" class="error detail-error" role="alert" hidden></p><div id="delivery-summary" class="delivery-summary"></div></section>
      <section class="section"><h3>Диалог с жителем</h3><div id="conversation" class="conversation" aria-live="polite"></div><form id="message-form" class="message-form"><label for="message-text">Уточните детали</label><textarea id="message-text" maxlength="1500" required placeholder="Здравствуйте! Подскажите, пожалуйста, где именно находится неисправность?"></textarea><div class="composer-footer"><span id="message-count">0 / 1500</span><button class="primary" type="submit">Отправить в MAX ↗</button></div></form><p id="message-error" class="error detail-error" role="alert" hidden></p><p class="form-help">Ответ жителя появится здесь автоматически. Показаны последние 200 сообщений.</p></section>
      <section class="section"><h3>История статусов</h3><ol id="history" class="timeline"></ol></section></div>`;
    renderConversation(detail);
    if (!$("issue-dialog").open) $("issue-dialog").showModal();
    $("status-form").addEventListener("submit", saveStatus);
    $("message-form").addEventListener("submit", sendMessage);
    $("message-text").addEventListener("input", () => { $("message-count").textContent = `${$("message-text").value.length} / 1500`; });
  } catch (error) { toast(error.message); }
}
function setBusy(value) {
  state.busy = value;
  $("detail-content").querySelectorAll("form button, form select, form textarea").forEach((node) => { node.disabled = value; });
  $("refresh-detail").disabled = value;
}
async function saveStatus(event) {
  event.preventDefault(); if (state.busy || !state.detail) return;
  const detail = state.detail, status = $("status-select").value;
  if (status === detail.status) { toast("Этот статус уже установлен"); return; }
  const key = `${detail.id}:${detail.status}:${status}`;
  if (statusAction?.key !== key) statusAction = { key, id: uuid() };
  setBusy(true); showError("detail-error", "");
  try {
    await api(`/issues/${detail.id}/status`, { method: "POST", body: JSON.stringify({ status, expected_status: detail.status, request_id: statusAction.id }) });
    detail.status = status; statusAction = null;
    toast("Статус сохранён. Уведомление поставлено в очередь MAX.");
    const updated = await api(`/issues/${detail.id}`); renderConversation(updated);
    await loadList();
  } catch (error) { if ($("detail-error")) showError("detail-error", error.message); }
  finally { setBusy(false); }
}
async function sendMessage(event) {
  event.preventDefault(); if (state.busy || !state.detail) return;
  const detail = state.detail, text = $("message-text").value.trim();
  if (!text) { showError("message-error", "Напишите сообщение жителю"); return; }
  const key = `${detail.id}:${text}`;
  if (messageAction?.key !== key) messageAction = { key, id: uuid() };
  setBusy(true); showError("message-error", "");
  try {
    await api(`/issues/${detail.id}/messages`, { method: "POST", body: JSON.stringify({ text, request_id: messageAction.id }) });
    $("message-text").value = ""; $("message-count").textContent = "0 / 1500"; messageAction = null;
    toast("Сообщение сохранено. Бот отправит его жителю в MAX.");
    const updated = await api(`/issues/${detail.id}`); renderConversation(updated);
  } catch (error) { if ($("message-error")) showError("message-error", error.message); }
  finally { setBusy(false); }
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; button.disabled = true; showError("login-error", "");
  try {
    await api("/auth/login", { method: "POST", body: JSON.stringify({ login: $("login").value, password: $("password").value }) });
    $("password").value = ""; await enterWorkspace();
  } catch (error) { showError("login-error", error.message); }
  finally { button.disabled = false; }
});
$("toggle-password").addEventListener("click", () => {
  const hidden = $("password").type === "password";
  $("password").type = hidden ? "text" : "password";
  $("toggle-password").textContent = hidden ? "Скрыть" : "Показать";
  $("toggle-password").setAttribute("aria-label", hidden ? "Скрыть пароль" : "Показать пароль");
});
$("logout").addEventListener("click", async () => {
  try { await api("/auth/logout", { method: "POST" }); showLogin(); }
  catch (error) { toast(error.message); }
});
$("refresh").addEventListener("click", loadList);
$("refresh-detail").addEventListener("click", async () => {
  if (!state.detail) return;
  const draft = $("message-text")?.value || "";
  await openDetail(state.detail.id);
  if ($("message-text")) { $("message-text").value = draft; $("message-count").textContent = `${draft.length} / 1500`; }
});
document.querySelectorAll(".stat").forEach((button) => button.addEventListener("click", () => {
  state.status = button.dataset.status; state.page = 1; updateStatSelection(); loadList();
}));
for (const id of ["house-filter", "priority-filter"]) $(id).addEventListener("change", () => { state.page = 1; loadList(); });
$("search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.page = 1; loadList(); }, 300); });
$("prev-page").addEventListener("click", () => { if (state.page > 1) { state.page--; loadList(); } });
$("next-page").addEventListener("click", () => { if (state.page * 25 < state.total) { state.page++; loadList(); } });
$("issues-body").addEventListener("click", (event) => { const button = event.target.closest("[data-open]"); if (button) openDetail(Number(button.dataset.open)); });
$("close-detail").addEventListener("click", () => { if (!state.busy) $("issue-dialog").close(); });
$("issue-dialog").addEventListener("cancel", (event) => { if (state.busy) event.preventDefault(); });
$("issue-dialog").addEventListener("close", () => { state.detail = null; state.detailRequest++; $("detail-content").replaceChildren(); });
$("detail-content").addEventListener("click", (event) => {
  const button = event.target.closest("[data-photo]");
  if (button) { $("full-photo").src = `${apiRoot}/photos/${Number(button.dataset.photo)}`; $("photo-dialog").showModal(); }
});
$("close-photo").addEventListener("click", () => $("photo-dialog").close());
$("photo-dialog").addEventListener("close", () => $("full-photo").removeAttribute("src"));
setInterval(async () => {
  if (!state.profile || document.hidden || state.busy) return;
  if (window.location.hash === "#registrations") await loadRegistrations();
  else if (window.location.hash !== "#contacts") await loadList();
  const id = state.detail?.id;
  if (id && $("issue-dialog").open) {
    try { const detail = await api(`/issues/${id}`); if (state.detail?.id === id && !state.busy) renderConversation(detail); }
    catch (error) { if ($("detail-error")) showError("detail-error", error.message); }
  }
}, 20000);
enterWorkspace().catch((error) => { showLogin(); if (error.status !== 401) showError("login-error", error.message); });


let registrationPage = 1, registrationTotal = 0, registrationRequest = 0;
function switchSection() {
  const registrations = window.location.hash === "#registrations";
  const contacts = window.location.hash === "#contacts";
  $("issues-section").hidden = registrations || contacts;
  $("registrations-section").hidden = !registrations;
  $("contacts-section").hidden = !contacts;
  $("section-name").textContent = contacts ? "Контакты" : registrations ? "Заявки" : "Обращения";
  for (const [id, active] of [["nav-issues", !registrations && !contacts], ["nav-registrations", registrations], ["nav-contacts", contacts]]) {
    $(id).classList.toggle("active", active);
    if (active) $(id).setAttribute("aria-current", "page"); else $(id).removeAttribute("aria-current");
  }
  if (registrations && state.profile) void loadRegistrations();
  if (contacts && state.profile && !contactState.loaded && !contactState.loading) void loadContacts();
}
async function loadRegistrations() {
  if (!state.profile) return;
  const request = ++registrationRequest;
  $("refresh-registrations").disabled = true;
  try {
    const data = await api(`/registrations?page=${registrationPage}`);
    if (!state.profile || request !== registrationRequest) return;
    registrationTotal = data.total;
    showError("registrations-error", "");
    $("registrations-body").innerHTML = data.items.map(item => `<tr>
      <td><strong>${esc(item.full_name)}</strong><span class="row-meta">Заявка № ${item.id}</span></td>
      <td>${esc(item.address)}, кв. ${item.apartment}<span class="row-meta">${esc(item.company)}</span></td>
      <td>${item.source === "bot" ? "Чатбот" : "Мини-приложение"}</td>
      <td>${esc({ pending: "Ожидает решения", approved: "Принята", rejected: "Отклонена" }[item.status])}${item.auto_approved ? '<span class="row-meta">Автоматически · тестовый режим</span>' : ""}</td>
      <td>${esc(date(item.created_at, true))}</td>
      <td>${item.status === "pending" ? `<button class="secondary" data-registration="${item.id}" data-decision="approve">Принять</button> <button class="text-button" data-registration="${item.id}" data-decision="reject">Отклонить</button>` : `<span class="muted">${item.auto_approved ? "Принято автоматически" : "Рассмотрено"}</span>`}</td></tr>`).join("");
    $("registrations-empty").hidden = data.total !== 0;
    $("registrations-page").textContent = data.total ? `Страница ${registrationPage} · всего заявок: ${data.total}` : "Нет заявок";
    $("registrations-prev").disabled = registrationPage <= 1;
    $("registrations-next").disabled = registrationPage * 25 >= data.total;
  } catch (error) { if (request === registrationRequest) showError("registrations-error", error.message); }
  finally { if (request === registrationRequest) $("refresh-registrations").disabled = false; }
}
window.addEventListener("hashchange", switchSection);
$("refresh-registrations").addEventListener("click", loadRegistrations);
$("registrations-prev").addEventListener("click", () => { if (registrationPage > 1) { registrationPage--; void loadRegistrations(); } });
$("registrations-next").addEventListener("click", () => { if (registrationPage * 25 < registrationTotal) { registrationPage++; void loadRegistrations(); } });
$("registrations-body").addEventListener("click", async event => {
  const button = event.target.closest("[data-registration]");
  if (!button || state.busy) return;
  state.busy = true; button.disabled = true;
  try {
    await api(`/registrations/${Number(button.dataset.registration)}/${button.dataset.decision}`, { method: "POST" });
    toast(button.dataset.decision === "approve" ? "Заявка принята. Квартира привязана." : "Заявка отклонена.");
    await loadRegistrations();
  } catch (error) { showError("registrations-error", error.message); }
  finally { state.busy = false; button.disabled = false; }
});

const contactKinds = { phone: "Телефон", email: "Электронная почта", address: "Адрес", website: "Сайт" };
function contactValueAttributes(kind) {
  if (kind === "email") return 'type="email" placeholder="info@example.ru"';
  if (kind === "website") return 'type="url" placeholder="https://example.ru"';
  if (kind === "phone") return 'type="tel" placeholder="+7 (000) 000-00-00"';
  return 'type="text" placeholder="Адрес приёмной"';
}
function renderContactRows(items) {
  $("contact-rows").innerHTML = items.map((item, index) => `<fieldset class="contact-row" data-contact-row>
    <legend>Контакт ${index + 1}</legend>
    <label>Название<input data-contact-field="label" value="${esc(item.label)}" maxlength="100" required placeholder="Например, диспетчерская"></label>
    <label>Тип<select data-contact-field="kind">${Object.entries(contactKinds).map(([kind, label]) => `<option value="${kind}"${kind === item.kind ? " selected" : ""}>${label}</option>`).join("")}</select></label>
    <label class="contact-value">Контакт<input data-contact-field="value" ${contactValueAttributes(item.kind)} value="${esc(item.value)}" maxlength="300" required></label>
    <label class="contact-note">Примечание<input data-contact-field="note" value="${esc(item.note)}" maxlength="200" placeholder="Часы работы или пояснение"></label>
    <button type="button" class="secondary remove-contact" data-remove-contact="${index}" aria-label="Удалить контакт ${index + 1}">Удалить</button>
  </fieldset>`).join("");
  $("contacts-empty").hidden = items.length > 0;
  $("add-contact").disabled = items.length >= 12;
}
function readContactDraft() {
  return [...$("contact-rows").querySelectorAll("[data-contact-row]")].map(row => Object.fromEntries(
    [...row.querySelectorAll("[data-contact-field]")].map(input => [input.dataset.contactField, input.value.trim()])
  ));
}
function contactBusy(busy) {
  $("contacts-fields").disabled = busy;
  $("contact-house").disabled = busy || !state.profile?.houses.length;
  $("refresh-contacts").disabled = busy;
  $("contacts-form").setAttribute("aria-busy", String(busy));
}
async function loadContacts() {
  if (!state.profile || contactState.saving) return;
  const house = $("contact-house").value;
  const request = ++contactState.request;
  contactState.house = house; contactState.loaded = false; contactState.loading = true; contactState.dirty = false;
  $("contacts-form").hidden = true; $("contact-rows").replaceChildren(); $("contact-company").textContent = "";
  showError("contacts-error", ""); contactBusy(true);
  $("contacts-status").textContent = house ? "Загружаем контакты…" : "Пока вам не назначены дома. Попросите администратора добавить доступ.";
  try {
    if (!house) return;
    const data = await api(`/houses/${encodeURIComponent(house)}/contacts`);
    if (request !== contactState.request || !state.profile) return;
    $("contact-company").textContent = data.company_name;
    renderContactRows(data.items); contactState.loaded = true;
    $("contacts-form").hidden = false; $("contacts-status").textContent = "";
  } catch (error) {
    if (request === contactState.request && state.profile) { showError("contacts-error", error.message); $("contacts-status").textContent = "Нажмите «Обновить», чтобы повторить загрузку."; }
  } finally {
    if (request === contactState.request) { contactState.loading = false; contactBusy(false); }
  }
}
function canDiscardContacts() {
  return !contactState.dirty || window.confirm("Есть несохранённые контакты. Отменить изменения и загрузить данные с сервера?");
}
$("refresh-contacts").addEventListener("click", () => { if (canDiscardContacts()) void loadContacts(); });
$("contact-house").addEventListener("change", () => {
  if (canDiscardContacts()) void loadContacts(); else $("contact-house").value = contactState.house;
});
$("contact-rows").addEventListener("input", () => { contactState.dirty = true; $("contacts-status").textContent = "Есть несохранённые изменения."; });
$("contact-rows").addEventListener("change", event => {
  contactState.dirty = true;
  if (event.target.dataset.contactField === "kind") {
    const input = event.target.closest("[data-contact-row]").querySelector('[data-contact-field="value"]');
    const temporary = document.createElement("div"); temporary.innerHTML = `<input ${contactValueAttributes(event.target.value)}>`;
    input.type = temporary.firstChild.type; input.placeholder = temporary.firstChild.placeholder;
  }
});
$("add-contact").addEventListener("click", () => {
  const items = readContactDraft(); if (items.length >= 12) return;
  items.push({ label: "", kind: "phone", value: "", note: "" });
  renderContactRows(items); contactState.dirty = true;
  $("contact-rows").lastElementChild.querySelector("input").focus();
});
$("contact-rows").addEventListener("click", event => {
  const button = event.target.closest("[data-remove-contact]"); if (!button) return;
  const items = readContactDraft(); items.splice(Number(button.dataset.removeContact), 1);
  renderContactRows(items); contactState.dirty = true; $("add-contact").focus();
});
$("contacts-form").addEventListener("submit", async event => {
  event.preventDefault(); if (!contactState.loaded || contactState.saving || contactState.loading) return;
  const house = contactState.house, request = contactState.request;
  const items = readContactDraft();
  contactState.saving = true; contactBusy(true); showError("contacts-error", "");
  $("contacts-status").textContent = "Сохраняем контакты…";
  try {
    const data = await api(`/houses/${encodeURIComponent(house)}/contacts`, { method: "POST", body: JSON.stringify({ items }) });
    if (request !== contactState.request || !state.profile) return;
    renderContactRows(data.items); contactState.dirty = false;
    $("contacts-status").textContent = "Контакты сохранены и доступны жителям этого дома.";
    toast("Контакты сохранены");
  } catch (error) {
    if (request === contactState.request && state.profile) { showError("contacts-error", error.message); $("contacts-status").textContent = "Данные остались в форме. Попробуйте ещё раз."; }
  } finally { contactState.saving = false; contactBusy(contactState.loading); }
});
