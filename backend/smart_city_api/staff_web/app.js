"use strict";

const $ = (id) => document.getElementById(id);
const apiRoot = "/api/v1/staff";
const cameraPageSize = 8;
const issuePageSize = 10;
const statuses = { new: "Новое", in_progress: "В работе", resolved: "Решено" };
const priorities = { 1: "Высокий", 2: "Средний", 3: "Низкий" };
const categories = {
  water: "Водоснабжение", heating: "Отопление", electricity: "Электричество",
  elevator: "Лифт", entrance: "Подъезд", yard: "Двор", garbage: "Мусор",
  security: "Безопасность", other: "Другое",
};
const zones = { apartment: "Квартира", corridor: "Коридор", elevator: "Лифт", stairs: "Лестница", entrance: "Входная группа", courtyard: "Двор", parking: "Парковка", house: "Общая территория дома", technical: "Техническая зона", yard: "Двор", roof: "Крыша", basement: "Подвал" };
const iconPaths = {
  inbox: '<path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.19 19a19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-2.91-8.67A2 2 0 0 1 4.27 2.14h3a2 2 0 0 1 2 1.72c.12.96.35 1.9.69 2.79a2 2 0 0 1-.45 2.11L8.24 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.89.34 1.83.57 2.79.69A2 2 0 0 1 22 16.92z"/>',
  message: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3zM7 8h10M7 12h6"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M9 21v-4h6v4M8 7h1m6 0h1M8 11h1m6 0h1"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1.01 6.74 2.82L21 8"/><path d="M21 3v5h-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  camera: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3z"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  tool: '<path d="M14.7 6.3a5 5 0 0 0-6.3 6.3l-5.7 5.7a2.1 2.1 0 0 0 3 3l5.7-5.7a5 5 0 0 0 6.3-6.3l-3 3-3-3z"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M10 12h11m-4-4 4 4-4 4"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="2"/><path d="m21 15-5-5L5 21"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  bulb: '<path d="M9 18h6M10 22h4M9 18v-2a6 6 0 1 1 6 0v2"/>',
  water: '<path d="M12 3S5 10 5 14a7 7 0 0 0 14 0c0-4-7-11-7-11zM8 14a4 4 0 0 0 4 4"/>',
  elevator: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v18M9 11v2m6-2v2"/>',
  door: '<path d="M4 21h16M6 21V4h12v17M14 12h.01"/>',
  tree: '<path d="M12 22v-7M7 18a5 5 0 0 1-3-9 6 6 0 1 1 16 0 5 5 0 0 1-3 9z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name] || iconPaths.inbox}</svg>`;
}
document.querySelectorAll("[data-icon]").forEach(node => { node.innerHTML = icon(node.dataset.icon); });
const categoryIcons = { water: "water", heating: "bulb", electricity: "bulb", elevator: "elevator", entrance: "door", yard: "tree", garbage: "trash", security: "shield", other: "tool" };
const state = { profile: null, status: "", page: 1, total: 0, detail: null, listRequest: 0, detailRequest: 0, busy: false };
const contactState = { request: 0, house: "", loaded: false, dirty: false, loading: false, saving: false };
let searchTimer, toastTimer, messageAction, statusAction, rejectionAction;
const replyDrafts = new Map();

function rememberReply() {
  if (!state.detail || !$("message-text")) return;
  const text = $("message-text").value;
  const photos = Array.from($("message-photos").files);
  if (text || photos.length) replyDrafts.set(state.detail.id, { text, photos, action: messageAction });
  else replyDrafts.delete(state.detail.id);
}

function restoreReply(id) {
  const draft = replyDrafts.get(id);
  if (!draft) return;
  $("message-text").value = draft.text;
  $("message-count").textContent = `${draft.text.length} / 1500`;
  const transfer = new DataTransfer();
  draft.photos.forEach(photo => transfer.items.add(photo));
  $("message-photos").files = transfer.files;
  if (draft.photos.length) $("chat-photo-hint").textContent = `Выбрано фото: ${draft.photos.length} / 10`;
  messageAction = draft.action;
}

window.addEventListener("beforeunload", event => {
  if (!replyDrafts.size) return;
  event.preventDefault(); event.returnValue = "";
});

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
  replyDrafts.clear();
  confirmationDialog.close("cancel");
  $("camera-action-menu").hidePopover();
  window.resetCameraManagement?.();
  window.resetStaffReport?.();
  window.resetChatManagement?.();
  window.resetStaffInbox?.();
  state.profile = null; state.detail = null; state.listRequest++; state.detailRequest++;
  $("issue-dialog").close(); $("photo-dialog").close();
  $("full-photo").removeAttribute("src"); $("detail-content").replaceChildren();
  $("registrations-body").replaceChildren();
  cameraRequest++; cameraItems = []; $("cameras-body").replaceChildren(); $("camera-table-body").replaceChildren();
  contactState.request++; contactState.house = ""; contactState.loaded = false; contactState.dirty = false; contactState.loading = false;
  window.resetStaffContacts?.();
  $("contact-rows").replaceChildren(); $("contacts-form").hidden = true;
  $("issues-body").replaceChildren(); $("workspace").hidden = true;
  $("login-screen").hidden = false; $("boot").hidden = true;
}
async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (state.profile && options.method && options.method !== "GET") headers["X-CSRF-Token"] = state.profile.csrf_token;
  let response;
  try {
    response = await fetch(apiRoot + path, { ...options, headers, credentials: "same-origin", cache: "no-store", signal: options.signal ?? AbortSignal.timeout(options.body instanceof FormData ? 120000 : path.startsWith("/cameras") ? 30000 : 20000) });
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
  $("house-filter").innerHTML = '<option value="">Все дома</option>' + state.profile.houses.map((house) => `<option value="${house.id}">${esc(house.address)}</option>`).join("");
  $("camera-house").innerHTML = $("house-filter").innerHTML;
  $("camera-status").value = "all"; $("camera-zone").value = ""; cameraPage = 1;
  $("camera-entrance").value = ""; $("camera-floor").value = "";
  updateCameraLocationOptions();
  $("priority-filter").value = ""; $("search").value = "";
  $("no-houses").hidden = state.profile.houses.length > 0;
  $("login-screen").hidden = true; $("workspace").hidden = false; $("boot").hidden = true;
  window.initStaffInbox?.({ api, esc, icon, date, open: href => {
    const issue = /^#issue-([1-9]\d*)$/.exec(href);
    location.hash = issue ? "#issues" : href;
    switchSection();
    if (issue) void openDetail(Number(issue[1]));
  } });
  window.scrollTo(0, 0);
  updateStatSelection();
  await loadList();
  switchSection();
}
function updateStatSelection() {
  $("list-title").textContent = { "": "Все обращения", new: "Новые обращения", in_progress: "Обращения в работе", resolved: "Решённые обращения" }[state.status];
  document.querySelectorAll(".stat").forEach((button) => {
    const selected = button.dataset.status === state.status;
    button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected));
  });
}
function badge(status) { return `<span class="badge ${esc(status)}"><i class="status-dot ${esc(status)}"></i>${esc(statuses[status] || status)}</span>`; }
async function loadList() {
  if (!state.profile) return;
  const request = ++state.listRequest;
  const params = new URLSearchParams({ page: state.page, page_size: issuePageSize });
  for (const [key, value] of Object.entries({ status: state.status, house_id: $("house-filter").value, priority: $("priority-filter").value, q: $("search").value.trim() })) if (value) params.set(key, value);
  $("refresh").disabled = true;
  try {
    const data = await api(`/issues?${params}`);
    if (request !== state.listRequest || !state.profile) return;
    showError("list-error", ""); state.total = data.total;
    if (state.page > 1 && (state.page - 1) * issuePageSize >= data.total) { state.page = Math.max(1, Math.ceil(data.total / issuePageSize)); return loadList(); }
    $("count-all").textContent = Object.values(data.counts).reduce((a, b) => a + b, 0);
    $("count-new").textContent = data.counts.new; $("count-progress").textContent = data.counts.in_progress;
    $("count-resolved").textContent = data.counts.resolved; $("nav-count").textContent = data.counts.new;
    $("total-label").textContent = data.total;
    $("issues-body").innerHTML = data.items.map((issue) => `<tr>
      <td><div class="issue-summary"><span class="category-icon ${esc(issue.category)}">${icon(categoryIcons[issue.category])}</span><div><button class="issue-title" data-open="${issue.id}">${esc(issue.title)}</button><span class="row-meta">№ ${issue.id} · ${esc(categories[issue.category])}${issue.photo_count ? ` · Фото: ${issue.photo_count}` : ""}</span></div></div></td>
      <td class="address-cell">${esc(issue.address)}<span class="row-meta">${esc(issue.author)}</span></td>
      <td class="priority-cell"><span class="priority p${issue.priority}">${esc(priorities[issue.priority])}</span></td>
      <td class="status-cell">${badge(issue.status)}</td><td class="date-cell">${esc(date(issue.created_at, true))}</td>
      <td class="open-cell"><button class="row-open" data-open="${issue.id}" aria-label="Открыть обращение №${issue.id}">Открыть</button></td></tr>`).join("");
    $("empty").hidden = data.total !== 0;
    $("prev-page").disabled = state.page <= 1; $("next-page").disabled = state.page * issuePageSize >= data.total;
    $("page-label").textContent = data.total ? `${(state.page - 1) * issuePageSize + 1}–${Math.min(state.page * issuePageSize, data.total)} из ${data.total} обращений` : "Нет обращений";
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
    const deliveryText = delivery ? { read: "Прочитано в мини-приложении", in_app: "Сохранено в уведомлениях · житель в мини-приложении", muted: "Уведомления в MAX отключены жителем", sent: "Уведомление отправлено в MAX", pending: "Ожидает отправки в MAX", retrying: "Бот повторит отправку в MAX", not_required: "Заметка УК" }[delivery.delivery] : "";
    return `<div class="bubble ${message.direction}"><div class="message-top"><strong>${esc(message.author)}${message.direction === "staff" ? " · УК" : " · житель"}</strong><time>${esc(date(message.created_at, true))}</time></div><p>${esc(message.text)}</p>${message.photos?.length ? `<div class="photos">${message.photos.map((photo, index) => `<button type="button" class="photo-thumb" data-chat-photo="${Number(photo.id)}" aria-label="Открыть фото сообщения ${index + 1}"><img src="${esc(apiRoot + "/chat-photos/" + Number(photo.id))}" alt="Фото в сообщении ${index + 1}" loading="lazy"></button>`).join("")}</div>` : ""}${deliveryText ? `<div class="delivery-label">${esc(deliveryText)}</div>` : ""}</div>`;
  }).join("") : '<p class="conversation-empty">Здесь можно уточнить детали у жителя. Он ответит в чате обращения мини-приложения. Если чат закрыт, бот пришлёт уведомление.</p>';
  if (!detail.resident_id) conversation.querySelector(".conversation-empty")?.replaceChildren(document.createTextNode("Заметки по звонкам и уточнениям. Видны только УК."));
  conversation.scrollTop = atEnd ? conversation.scrollHeight : oldTop;
  const pending = detail.notifications.filter((notice) => !["sent", "read", "not_required", "in_app", "muted"].includes(notice.delivery)).length;
  $("delivery-summary").textContent = pending ? `Уведомлений в очереди: ${pending}. Бот доставит их автоматически. Прочитанные в чате сообщения не дублируются.` : "Ответы и уточнения сохраняются в чате обращения.";
  $("history").innerHTML = detail.history.length ? detail.history.map((event) => `<li>${badge(event.status)}<time>${esc(date(event.created_at))}</time></li>`).join("") : `<li>${badge(detail.status)}<span class="muted">История изменений пока пуста</span></li>`;
  $("live-status").innerHTML = badge(detail.status);
  if (state.detail && detail.status !== state.detail.status) showError("detail-error", "Статус изменил другой сотрудник. Нажмите «Обновить обращение» вверху, чтобы загрузить изменения.");
}
async function openDetail(id) {
  if (state.busy) return;
  const request = ++state.detailRequest;
  try {
    const detail = await api(`/issues/${id}`);
    if (request !== state.detailRequest || !state.profile) return;
    rememberReply();
    state.detail = detail; messageAction = statusAction = null;
    $("detail-number").textContent = `ОБРАЩЕНИЕ № ${detail.id}`;
    const place = [detail.address, detail.entrance && `подъезд ${detail.entrance}`, detail.floor != null && `этаж ${detail.floor}`, detail.apartment != null && `кв. ${detail.apartment}`, detail.zone && (zones[detail.zone] || detail.zone)].filter(Boolean).join(" · ");
    $("detail-content").innerHTML = `<div class="detail-main">
      <div id="live-status">${badge(detail.status)}</div><h2 id="detail-title">${esc(detail.title)}</h2><p class="detail-place">${esc(place)}</p>
      <div class="detail-meta"><span>${esc(detail.author)}</span><span>·</span><time>${esc(date(detail.created_at))}</time><span class="priority p${detail.priority}">${esc(priorities[detail.priority])} приоритет</span></div>
      <section class="section"><h3>Что произошло</h3><p class="description">${esc(detail.description)}</p>${detail.photos.length ? `<div class="photos">${detail.photos.map((photo, index) => `<button class="photo-thumb" data-photo="${photo.id}" aria-label="Открыть фото ${index + 1}"><img src="${esc(photo.url)}" alt="Фото ${index + 1}" loading="lazy"></button>`).join("")}</div><p class="form-help">Нажмите на фото, чтобы рассмотреть его</p>` : '<p class="form-help">Житель не прикрепил фотографии</p>'}</section>
      <section class="section"><h3>Статус обращения</h3><form id="status-form" class="status-form"><label class="sr-only" for="status-select">Новый статус</label><select id="status-select">${Object.entries(statuses).map(([value, label]) => `<option value="${value}"${value === detail.status ? " selected" : ""}>${label}</option>`).join("")}</select><button class="primary" type="submit">Сохранить статус</button></form><p class="form-help">Автор получит уведомление в боте. Отмечайте обращение решённым после устранения проблемы.</p><p id="detail-error" class="error detail-error" role="alert" hidden></p><div id="delivery-summary" class="delivery-summary"></div></section>
      <section class="section"><h3>Чат с жителем</h3><div id="conversation" class="conversation" aria-live="polite"></div><form id="message-form" class="message-form"><label for="message-text">Сообщение жителю</label><textarea id="message-text" maxlength="1500" placeholder="Здравствуйте! Подскажите, пожалуйста, где именно находится неисправность?"></textarea><label class="chat-photo-label">${icon("photo")}<span>Прикрепить фотографии</span><input id="message-photos" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="chat-photo-hint" multiple></label><small id="chat-photo-hint">До 10 фото · JPG, PNG, WebP · до 10 МБ каждое</small><div class="composer-footer"><span id="message-count">0 / 1500</span><button class="primary" type="submit">${icon("send")} Отправить в чат</button></div></form><p id="message-error" class="error detail-error" role="alert" hidden></p><p class="form-help">Сообщение появится в чате обращения. Если житель не читает чат, бот уведомит его. Ответ жителя появится здесь автоматически. Показаны последние 200 сообщений.</p></section>
      <section class="section"><h3>История статусов</h3><ol id="history" class="timeline"></ol></section>
      <details class="section rejection-section"><summary>${icon("close")} Отклонить обращение</summary><form id="reject-form" class="message-form"><label for="reject-reason">Причина отклонения</label><textarea id="reject-reason" minlength="3" maxlength="1500" required placeholder="Объясните жителю, почему обращение отклонено"></textarea><p class="form-help">Обращение исчезнет из списков. Бот отправит автору указанную причину.</p><button class="danger" type="submit">Отклонить обращение</button></form><p id="reject-error" class="error detail-error" role="alert" hidden></p></details></div>`;
    renderConversation(detail);
    if (!$("issue-dialog").open) $("issue-dialog").showModal();
    if (detail.created_by || detail.reporter_phone || detail.reporter_apartment) {
      const info = document.createElement("section"); info.className = "section reporter-details";
      info.innerHTML = `<h3>Заявитель</h3><p>${esc(detail.author)}${detail.reporter_apartment ? ` · кв. ${Number(detail.reporter_apartment)}` : ""}</p>${detail.reporter_phone ? `<p><a href="tel:${esc(detail.reporter_phone.replace(/[^+0-9]/g, ""))}">${esc(detail.reporter_phone)}</a></p>` : ""}${detail.created_by ? `<p class="form-help">Приняла УК: ${esc(detail.created_by)}</p>` : ""}`;
      $("detail-content").querySelector(".detail-meta").after(info);
    }
    if (!detail.resident_id) {
      $("message-form").closest("section").querySelector("h3").textContent = "Заметки УК";
      $("message-text").placeholder = "Итоги звонка или уточнения";
      $("message-form").querySelector("label").textContent = "Заметка";
      $("message-form").querySelector('button[type="submit"]').textContent = "Сохранить заметку";
      $("message-form").closest("section").querySelector(":scope > .form-help").hidden = true;
      $("status-form").nextElementSibling.textContent = "История статусов сохраняется в обращении.";
      $("reject-form").querySelector(".form-help").textContent = "Обращение исчезнет из списка. Причина сохранится в истории.";
    }
    $("status-form").addEventListener("submit", saveStatus);
    $("reject-form").addEventListener("submit", rejectIssue);
    $("message-form").addEventListener("submit", sendMessage);
    restoreReply(id);
    $("message-photos").addEventListener("change", () => { messageAction = null; $("chat-photo-hint").textContent = `Выбрано фото: ${$("message-photos").files.length} / 10`; rememberReply(); });
    $("message-text").addEventListener("input", () => { $("message-count").textContent = `${$("message-text").value.length} / 1500`; rememberReply(); });
  } catch (error) { toast(error.message); }
}
function setBusy(value) {
  state.busy = value;
  $("detail-content").querySelectorAll("form button, form select, form textarea, form input").forEach((node) => { node.disabled = value; });
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
    toast(detail.resident_id ? "Статус сохранён. Уведомление поставлено в очередь MAX." : "Статус сохранён.");
    const updated = await api(`/issues/${detail.id}`); renderConversation(updated);
    await loadList();
  } catch (error) { if ($("detail-error")) showError("detail-error", error.message); }
  finally { setBusy(false); }
}
async function rejectIssue(event) {
  event.preventDefault(); if (state.busy || !state.detail) return;
  const detail = state.detail, reason = $("reject-reason").value.trim();
  if (reason.length < 3) { showError("reject-error", "Укажите причину: от 3 до 1500 символов"); return; }
  const key = `${detail.id}:${detail.status}:${reason}`;
  if (rejectionAction?.key !== key) rejectionAction = { key, id: uuid() };
  setBusy(true); showError("reject-error", "");
  try {
    await api(`/issues/${detail.id}/reject`, { method: "POST", body: JSON.stringify({ reason, expected_status: detail.status, request_id: rejectionAction.id }) });
    rejectionAction = null; $("issue-dialog").close();
    toast(detail.resident_id ? "Обращение отклонено. Причина поставлена в очередь отправки в MAX." : "Обращение отклонено.");
    await loadList();
  } catch (error) { if ($("reject-error")) showError("reject-error", error.message); }
  finally { setBusy(false); }
}
async function sendMessage(event) {
  event.preventDefault(); if (state.busy || !state.detail) return;
  const detail = state.detail, text = $("message-text").value.trim();
  const photos = Array.from($("message-photos").files);
  if (!text && !photos.length) { showError("message-error", "Напишите сообщение или прикрепите фото"); return; }
  if (photos.length > 10 || photos.some(file => !file.size || file.size > 10 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type))) { showError("message-error", "Выберите до 10 фотографий JPG, PNG или WebP, до 10 МБ каждая"); return; }
  const key = `${detail.id}:${text}`;
  if (messageAction?.key !== key) messageAction = { key, id: uuid() };
  setBusy(true); showError("message-error", "");
  try {
    const data = { text, request_id: messageAction.id };
    let body = JSON.stringify(data);
    if (photos.length) { body = new FormData(); body.set("data", JSON.stringify(data)); photos.forEach(photo => body.append("photos", photo)); }
    await api(`/issues/${detail.id}/messages${photos.length ? "/with-photos" : ""}`, { method: "POST", body });
    $("message-photos").value = ""; $("chat-photo-hint").textContent = "До 10 фото · JPG, PNG, WebP · до 10 МБ каждое";
    $("message-text").value = ""; $("message-count").textContent = "0 / 1500"; messageAction = null;
    replyDrafts.delete(detail.id);
    toast(detail.resident_id ? "Сообщение добавлено в чат обращения." : "Заметка сохранена.");
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
  const reason = $("reject-reason")?.value || "";
  await openDetail(state.detail.id);
  if ($("reject-reason")) $("reject-reason").value = reason;
});
document.querySelectorAll(".stat").forEach((button) => button.addEventListener("click", () => {
  state.status = button.dataset.status; state.page = 1; updateStatSelection(); loadList();
}));
for (const id of ["house-filter", "priority-filter"]) $(id).addEventListener("change", () => { state.page = 1; loadList(); });
$("search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.page = 1; loadList(); }, 300); });
$("prev-page").addEventListener("click", () => { if (state.page > 1) { state.page--; loadList(); } });
$("next-page").addEventListener("click", () => { if (state.page * issuePageSize < state.total) { state.page++; loadList(); } });
$("issues-body").addEventListener("click", (event) => { const button = event.target.closest("[data-open]"); if (button) openDetail(Number(button.dataset.open)); });
$("close-detail").addEventListener("click", () => { if (!state.busy) $("issue-dialog").close(); });
$("issue-dialog").addEventListener("cancel", (event) => { if (state.busy) event.preventDefault(); });
$("issue-dialog").addEventListener("close", () => { rememberReply(); state.detail = null; state.detailRequest++; $("detail-content").replaceChildren(); });
$("detail-content").addEventListener("click", (event) => {
  const chatPhoto = event.target.closest("[data-chat-photo]");
  if (chatPhoto) { $("full-photo").src = `${apiRoot}/chat-photos/${Number(chatPhoto.dataset.chatPhoto)}`; $("photo-dialog").showModal(); return; }
  const button = event.target.closest("[data-photo]");
  if (button) { $("full-photo").src = `${apiRoot}/photos/${Number(button.dataset.photo)}`; $("photo-dialog").showModal(); }
});
$("close-photo").addEventListener("click", () => $("photo-dialog").close());
$("photo-dialog").addEventListener("close", () => $("full-photo").removeAttribute("src"));
setInterval(async () => {
  if (!state.profile || document.hidden || state.busy || confirmationDialog.open || $("staff-camera-form-dialog").open || $("staff-camera-view-dialog").open || $("camera-action-menu").matches(":popover-open")) return;
  if (window.location.hash === "#registrations") await loadRegistrations();
  else if (window.location.hash === "#cameras") await loadCameras();
  else if (window.location.hash !== "#contacts") await loadList();
  const id = state.detail?.id;
  if (id && $("issue-dialog").open) {
    try { const detail = await api(`/issues/${id}`); if (state.detail?.id === id && !state.busy) renderConversation(detail); }
    catch (error) { if ($("detail-error")) showError("detail-error", error.message); }
  }
}, 20000);
function initializeWorkspace() {
  enterWorkspace().catch((error) => { showLogin(); if (error.status !== 401) showError("login-error", error.message); });
}
// Section scripts are deferred too: wait until their handlers are registered.
if (document.readyState === "complete") initializeWorkspace();
else document.addEventListener("DOMContentLoaded", initializeWorkspace, { once: true });


let registrationPage = 1, registrationTotal = 0, registrationRequest = 0;
let cameraPage = 1, cameraTotal = 0, cameraRequest = 0;
let cameraItems = [], cameraView = "grid";
try { if (localStorage.getItem("dompulse.staff.camera-view") === "list") cameraView = "list"; } catch { /* View selection also works without storage. */ }
function renderCameraItems(items = cameraItems) {
  cameraItems = items;
  $("camera-results-count").textContent = String(cameraTotal);
  $("camera-results-count").setAttribute("aria-label", `Найдено камер: ${cameraTotal}`);
  $("camera-action-menu").hidePopover();
  $("cameras-body").hidden = cameraView !== "grid";
  $("camera-table-view").hidden = cameraView !== "list";
  $("camera-view-grid").setAttribute("aria-pressed", String(cameraView === "grid"));
  $("camera-view-list").setAttribute("aria-pressed", String(cameraView === "list"));
  const html = cameraItems.map(camera => {
      const place = camera.place;
      const location = !place ? "Место не указано" : ["house", "courtyard", "parking"].includes(place.zone) ? zones[place.zone] : `Подъезд ${place.entrance} · этаж ${place.floor} · ${zones[place.zone] || place.zone}`;
      const decision = camera.moderation_status === "pending" ? "Заявка жителя" : camera.moderation_status === "approved" ? "Доступна жителям" : "Отклонена";
      if (cameraView === "list") return `<tr><td><strong>${esc(camera.name)}</strong><span class="row-meta">${esc(camera.owner_name)}</span></td>
        <td data-label="Место">${esc(camera.address)}<span class="row-meta">${esc(location)}</span></td>
        <td data-label="Описание"><p class="camera-list-note" title="${esc(camera.note)}">${esc(camera.note) || '<span class="muted">—</span>'}</p></td>
        <td data-label="Статус"><span class="badge camera-${esc(camera.moderation_status)}"><span class="status-dot"></span>${esc(decision)}</span></td>
        <td data-label="Пояснение">${camera.moderation_status === "rejected" && camera.moderation_reason ? `<p class="camera-explanation">${esc(camera.moderation_reason)}</p>` : '<span class="muted">—</span>'}</td>
        <td data-label="Управление"><button type="button" class="camera-menu-trigger" data-camera="${Number(camera.id)}" data-status="${esc(camera.moderation_status)}" popovertarget="camera-action-menu" aria-expanded="false" aria-label="Действия с камерой: ${esc(camera.name)}">Действия ${icon("chevron")}</button></td></tr>`;
      return `<article class="staff-camera-card">
        <button type="button" class="staff-camera-preview" data-view-camera="${Number(camera.id)}" data-name="${esc(camera.name)}" data-place="${esc(camera.address + " · " + location)}" aria-label="Смотреть камеру: ${esc(camera.name)}"><img hidden data-frame-src="${apiRoot}/cameras/${Number(camera.id)}/frame" alt=""><span class="camera-preview-fallback">${icon("camera")}<span>Получаем кадр…</span></span><span class="camera-preview-open">Смотреть камеру ↗</span></button>
        <div class="staff-camera-card-body"><span class="badge camera-${esc(camera.moderation_status)}"><span class="status-dot"></span>${esc(decision)}</span><h2>${esc(camera.name)}</h2><p class="camera-card-address">${esc(camera.address)}</p><p class="muted">${esc(location)}</p><p class="row-meta">${esc(camera.owner_name)}</p>${camera.note ? `<p class="camera-card-note">${esc(camera.note)}</p>` : ""}${camera.moderation_status === "rejected" && camera.moderation_reason ? `<p class="camera-explanation">${esc(camera.moderation_reason)}</p>` : ""}
        <button type="button" class="camera-menu-trigger" data-camera="${Number(camera.id)}" data-status="${esc(camera.moderation_status)}" popovertarget="camera-action-menu" aria-expanded="false" aria-label="Действия с камерой: ${esc(camera.name)}">Действия ${icon("chevron")}</button></div></article>`;
    }).join("");
  $("cameras-body").innerHTML = cameraView === "grid" ? html : "";
  $("camera-table-body").innerHTML = cameraView === "list" ? html : "";
  window.bindCameraPreviews?.();
}
for (const [id, view] of [["camera-view-grid", "grid"], ["camera-view-list", "list"]]) $(id).addEventListener("click", () => {
  cameraView = view;
  try { localStorage.setItem("dompulse.staff.camera-view", view); } catch { /* Optional preference. */ }
  renderCameraItems();
});

function updateCameraLocationOptions() {
  const houses = state.profile.houses.filter(house => !$("camera-house").value || String(house.id) === $("camera-house").value);
  const zone = $("camera-zone").value;
  const outdoor = ["courtyard", "parking", "house"].includes(zone);
  for (const [id, property, label, all] of [["camera-entrance", "entrances_count", "Подъезд", "Все подъезды"], ["camera-floor", "floors_count", "Этаж", "Все этажи"]]) {
    const select = $(id), previous = select.disabled ? "" : select.value;
    if (outdoor) {
      select.innerHTML = `<option value="">${id === "camera-floor" ? "Нет этажей" : "Нет подъездов"}</option>`;
      select.disabled = true;
      continue;
    }
    if (zone === "entrance" && id === "camera-floor") {
      select.innerHTML = '<option value="1">Этаж 1</option>';
      select.disabled = true;
      continue;
    }
    const count = Math.max(0, ...houses.map(house => house[property] || 0));
    select.innerHTML = `<option value="">${all}</option>` + Array.from({ length: count }, (_, index) => `<option value="${index + 1}">${label} ${index + 1}</option>`).join("");
    select.value = Number(previous) >= 1 && Number(previous) <= count ? previous : "";
    select.disabled = count === 0;
  }
}
async function loadCameras() {
  if (!state.profile) return;
  const request = ++cameraRequest;
  $("refresh-cameras").disabled = true;
  $("cameras-section").setAttribute("aria-busy", "true");
  try {
    const params = new URLSearchParams({ status: $("camera-status").value, page: cameraPage, page_size: cameraPageSize });
    for (const [key, id] of [["house_id", "camera-house"], ["entrance", "camera-entrance"], ["floor", "camera-floor"], ["zone", "camera-zone"]]) if ($(id).value) params.set(key, $(id).value);
    const data = await api(`/cameras?${params}`);
    if (!state.profile || request !== cameraRequest) return;
    cameraTotal = data.total;
    showError("cameras-error", "");
    $("camera-action-menu").hidePopover();
    renderCameraItems(data.items);
    $("cameras-empty").hidden = cameraTotal !== 0;
    $("cameras-page").textContent = cameraTotal ? `Страница ${cameraPage} из ${Math.ceil(cameraTotal / cameraPageSize)} · всего камер: ${cameraTotal}` : "Нет камер";
    $("cameras-prev").disabled = cameraPage <= 1;
    $("cameras-next").disabled = cameraPage * cameraPageSize >= cameraTotal;
  } catch (error) { if (request === cameraRequest) showError("cameras-error", error.message); }
  finally {
    if (request === cameraRequest) {
      $("refresh-cameras").disabled = false;
      $("cameras-section").setAttribute("aria-busy", "false");
    }
  }
}
$("refresh-cameras").addEventListener("click", loadCameras);
for (const id of ["camera-status", "camera-house", "camera-entrance", "camera-floor", "camera-zone"]) $(id).addEventListener("change", () => {
  if (id === "camera-house" || id === "camera-zone") updateCameraLocationOptions();
  cameraPage = 1; void loadCameras();
});
$("cameras-prev").addEventListener("click", () => { if (cameraPage > 1) { cameraPage--; void loadCameras(); } });
$("cameras-next").addEventListener("click", () => { if (cameraPage * cameraPageSize < cameraTotal) { cameraPage++; void loadCameras(); } });
let cameraMenuControl = null;
const cameraMenu = $("camera-action-menu");
$("cameras-section").addEventListener("click", event => {
  const control = event.target.closest("button[data-camera]");
  if (!control || state.busy) return;
  if (cameraMenu.matches(":popover-open") && cameraMenuControl !== control) cameraMenu.hidePopover();
  cameraMenuControl?.setAttribute("aria-expanded", "false");
  cameraMenuControl = control;
  cameraMenu.innerHTML = `<button data-decision="view">${icon("camera")}Смотреть камеру</button>${control.dataset.status === "pending" ? `<button data-decision="approved">${icon("check")}Одобрить</button><button data-decision="rejected">${icon("close")}Отклонить</button>` : ""}<button data-decision="delete" class="camera-delete">${icon("trash")}Удалить камеру</button>`;
  const rect = control.getBoundingClientRect();
  const height = 12 + cameraMenu.querySelectorAll("button").length * 46;
  cameraMenu.dataset.side = rect.bottom + height + 8 > innerHeight ? "above" : "below";
  const width = Math.min(cameraView === "grid" ? rect.width : 208, innerWidth - 16);
  cameraMenu.style.width = `${width}px`;
  cameraMenu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
  cameraMenu.style.top = `${Math.max(8, rect.bottom + height + 8 > innerHeight ? rect.top - height - 6 : rect.bottom + 6)}px`;
});
cameraMenu.addEventListener("toggle", event => {
  cameraMenuControl?.setAttribute("aria-expanded", String(event.newState === "open"));
});
window.addEventListener("resize", () => cameraMenu.hidePopover());
cameraMenu.addEventListener("keydown", event => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = [...cameraMenu.querySelectorAll("button")];
  const index = buttons.indexOf(document.activeElement);
  buttons[event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
});
cameraMenu.addEventListener("click", async event => {
  const action = event.target.closest("button[data-decision]");
  const control = cameraMenuControl;
  if (!action || !control) return;
  const decision = action.dataset.decision;
  cameraMenu.hidePopover();
  if (decision === "view") { window.openStaffCamera?.(Number(control.dataset.camera)); return; }
  if (state.busy || !["approved", "rejected", "delete"].includes(decision)) return;
  const profile = state.profile;
  if (decision === "delete" && !await confirmAction({ title: "Удалить камеру?", description: "Камера исчезнет у владельца и жителей дома. Это действие нельзя отменить.", confirmLabel: "Удалить", destructive: true })) return;
  let reason = "";
  if (decision === "rejected") {
    const answer = await requestCameraRejection();
    if (answer === null) return;
    reason = answer.trim();
    if (!reason || reason.length > 1000) { showError("cameras-error", "Укажите причину отклонения: от 1 до 1000 символов"); return; }
  }
  if (state.busy || state.profile !== profile || !control.isConnected) return;
  state.busy = true; control.disabled = true;
  try {
    if (decision === "delete") {
      await api(`/cameras/${Number(control.dataset.camera)}`, { method: "DELETE" });
      toast("Камера удалена");
    } else {
      await api(`/cameras/${Number(control.dataset.camera)}/moderate`, { method: "POST", body: JSON.stringify({ decision, reason }) });
      toast(decision === "approved" ? "Камера доступна жителям дома" : "Камера отклонена. Причина доступна владельцу");
    }
    if ((decision === "delete" || $("camera-status").value !== "all") && cameraPage > 1 && (cameraPage - 1) * cameraPageSize >= cameraTotal - 1) cameraPage--;
    await loadCameras();
  } catch (error) { showError("cameras-error", error.message); }
  finally { state.busy = false; control.disabled = false; }
});
function switchSection() {
  const registrations = window.location.hash === "#registrations";
  const contacts = window.location.hash === "#contacts";
  const cameras = window.location.hash === "#cameras";
  const maxChats = window.location.hash === "#max-chats";
  const announcements = window.location.hash === "#announcements";
  $("issues-section").hidden = registrations || contacts || cameras || maxChats || announcements;
  $("max-chats-section").hidden = !maxChats;
  $("announcements-section").hidden = !announcements;
  $("registrations-section").hidden = !registrations;
  $("contacts-section").hidden = !contacts;
  $("cameras-section").hidden = !cameras;
  $("section-name").textContent = maxChats ? "MAX-чаты" : announcements ? "Рассылки" : cameras ? "Управление камерами" : contacts ? "Контакты" : registrations ? "Заявки" : "Обращения";
  for (const [id, active] of [["nav-issues", !registrations && !contacts && !cameras && !maxChats && !announcements], ["nav-registrations", registrations], ["nav-contacts", contacts], ["nav-cameras", cameras], ["nav-max-chats", maxChats], ["nav-announcements", announcements]]) {
    $(id).classList.toggle("active", active);
    if (active) $(id).setAttribute("aria-current", "page"); else $(id).removeAttribute("aria-current");
  }
  if (registrations && state.profile) void loadRegistrations();
  if (cameras && state.profile) void loadCameras();
  if (contacts && state.profile && !contactState.loaded && !contactState.loading) void window.loadStaffContacts?.();
  if ((maxChats || announcements) && state.profile) void loadChatManagement(announcements);
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
      <td data-label="Адрес">${esc(item.address)}, кв. ${item.apartment}<span class="row-meta">${esc(item.company)}</span></td>
      <td data-label="Источник">${item.source === "bot" ? "Чатбот" : "Мини-приложение"}</td>
      <td data-label="Статус">${esc({ pending: "Ожидает решения", approved: "Принята", rejected: "Отклонена" }[item.status])}${item.auto_approved ? '<span class="row-meta">Автоматически · тестовый режим</span>' : ""}</td>
      <td data-label="Получено">${esc(date(item.created_at, true))}</td>
      <td>${item.status === "pending" ? `<button class="secondary" data-registration="${item.id}" data-decision="approve">Принять</button> <button class="text-button" data-registration="${item.id}" data-decision="reject">Отклонить</button>` : ""}
      <button class="danger" data-delete-registration="${item.id}" data-resident="${esc(item.full_name)}" data-apartment-label="${esc(item.address)}, кв. ${item.apartment}" data-status="${esc(item.status)}">Удалить заявку</button></td></tr>`).join("");
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
  const button = event.target.closest("[data-registration], [data-delete-registration]");
  if (!button || state.busy) return;
  const deleting = button.hasAttribute("data-delete-registration");
  const profile = state.profile;
  const unlinking = button.dataset.status === "approved";
  if (deleting && !await confirmAction({ title: `Удалить заявку №${Number(button.dataset.deleteRegistration)}?`, description: `Заявка «${button.dataset.resident}» на квартиру «${button.dataset.apartmentLabel}» будет удалена.${unlinking ? " Эта квартира будет отвязана от пользователя." : ""} Аккаунт, остальные заявки и квартиры, обращения и переписка сохранятся.`, confirmLabel: "Удалить заявку", destructive: true })) return;
  if (state.busy || state.profile !== profile || !button.isConnected) return;
  state.busy = true; button.disabled = true;
  try {
    if (deleting) {
      try { await api(`/registrations/${Number(button.dataset.deleteRegistration)}`, { method: "DELETE" }); }
      catch (error) { if (error.status !== 404) throw error; }
      toast(unlinking ? "Заявка удалена. Квартира отвязана от пользователя." : "Заявка удалена.");
    } else {
      await api(`/registrations/${Number(button.dataset.registration)}/${button.dataset.decision}`, { method: "POST" });
      toast(button.dataset.decision === "approve" ? "Заявка принята. Квартира привязана." : "Заявка отклонена.");
    }
    await loadRegistrations();
    if (registrationPage > 1 && (registrationPage - 1) * 25 >= registrationTotal) {
      registrationPage = Math.max(1, Math.ceil(registrationTotal / 25)); await loadRegistrations();
    }
  } catch (error) { showError("registrations-error", error.message); }
  finally { state.busy = false; button.disabled = false; }
});
