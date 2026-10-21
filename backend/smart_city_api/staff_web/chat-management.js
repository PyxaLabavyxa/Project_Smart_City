"use strict";

const chatTopics = { outage: "Отключение коммунальных услуг", works: "Ремонт и обслуживание дома", meeting: "Собрание жителей", other: "Информация для жителей" };
const announcementTopics = { outage: "⚠️ Отключение коммунальных услуг", works: "🚧 Ремонт и обслуживание дома", meeting: "👥 Собрание жителей", other: "📌 Информация для жителей" };
const deliveryLabels = { draft: "Черновик", pending: "В очереди", sending: "Отправляется", sent: "Отправлено", failed: "Не отправлено", uncertain: "Нужно проверить чат", cancelled: "Отменено" };
let maxChatRows = [], maxChatRequest = 0, announcementRequest = 0, maxChatBusy = false;
let announcementPage = 1, announcementTotal = 0, announcementBusy = false;
let selectedHouseIds = new Set(), selectedResidentIds = new Set(), residentDirectory = new Map();
let residentOptions = [], residentPage = 1, residentTotal = 0, residentRequest = 0, residentSearchTimer;
let editingAnnouncement = null, previewAnnouncement = null, announcementSaved = "", connectingHouse = null;

function chatState(chat) {
  if (!chat || chat.chat_id == null) return ["disconnected", "Не подключён"];
  if (chat.menu_status === "pending" || chat.menu_status === "sending") return ["pending", "Готовим меню"];
  if (chat.status === "connected" && chat.menu_status === "ready") return ["ready", "Подключён"];
  return ["attention", "Требует внимания"];
}
function chatStatusHtml(chat) {
  const [kind, label] = chatState(chat);
  return `<span class="chat-state" data-state="${kind}">${label}</span>`;
}
function announcementSummary(item) {
  if (item.status === "draft") return "Черновик";
  const counts = {};
  for (const d of [...item.deliveries, ...(item.private_deliveries || [])]) counts[d.status] = (counts[d.status] || 0) + 1;
  return Object.entries(counts).map(([key,n]) => `${deliveryLabels[key] || key}: ${n}`).join(" · ");
}
function audienceMode() { return document.querySelector('input[name="announcement-audience"]:checked')?.value || "selected"; }
function selectedAnnouncementHouses() {
  return audienceMode() === "selected" ? [...selectedHouseIds].sort((a,b) => a-b) : maxChatRows.map(c => c.house_id).sort((a,b) => a-b);
}
function announcementBody() {
  const people = audienceMode() === "residents";
  return { topic: $("announcement-topic").value, title: $("announcement-title").value.trim(), text: $("announcement-text").value.trim(), house_ids: selectedAnnouncementHouses(), version: editingAnnouncement?.version || 1,
    channels: [!people && $("channel-groups").checked ? "groups" : null, $("channel-private").checked ? "private" : null].filter(Boolean),
    audience: people ? "residents" : "houses", resident_ids: people ? [...selectedResidentIds].sort((a,b) => a-b) : [] };
}
function announcementIsDirty() {
  const body = announcementBody();
  return (body.title || body.text || body.house_ids.length) && JSON.stringify(body) !== announcementSaved;
}
function updateAnnouncementPreview() {
  const people = audienceMode() === "residents";
  $("channel-groups").disabled = people;
  if (people) { $("channel-groups").checked = false; $("channel-private").checked = true; }
  $("announcement-channel-help").textContent = people ? "Выбранные жители получат сообщения лично от Домоведа. В общих группах публикации не будет." : "Можно выбрать оба канала. В группу попадёт одно объявление, лично — по одному сообщению каждому получателю.";
  $("house-audience-controls").hidden = people;
  $("resident-audience-controls").hidden = !people;
  $("announcement-live-topic").textContent = announcementTopics[$("announcement-topic").value] || announcementTopics.other;
  $("announcement-live-title").textContent = $("announcement-title").value || "Заголовок объявления";
  $("announcement-live-text").textContent = $("announcement-text").value || "Текст появится здесь, когда вы начнёте писать.";
  $("announcement-count").textContent = `${$("announcement-text").value.length} / 3000`;
  $("announcement-preview-label").textContent = $("channel-private").checked && !$("channel-groups").checked ? "В личном диалоге с ботом" : $("channel-private").checked ? "Текст объявления" : "В домовом чате";
  $("announcement-recipient-count").textContent = people ? `Выбрано жителей: ${selectedResidentIds.size}. Точную доставку проверим перед отправкой.` : `Выбрано домов: ${selectedAnnouncementHouses().length}. Точный список получателей появится в предпросмотре.`;
  $("announcement-house-count").textContent = `Выбрано ${selectedAnnouncementHouses().length} из ${maxChatRows.length}`;
  if (announcementIsDirty()) $("announcement-save-state").textContent = "Есть несохранённые изменения";
}
function visibleHouses() {
  const q = $("announcement-house-search").value.trim().toLocaleLowerCase("ru");
  return maxChatRows.filter(c => c.address.toLocaleLowerCase("ru").includes(q));
}
function renderAnnouncementHouses(selected) {
  if (selected) selectedHouseIds = new Set(selected);
  const all = audienceMode() === "all", rows = visibleHouses();
  $("announcement-houses").innerHTML = rows.length ? rows.map(chat => `<label class="announcement-house"><input type="checkbox" value="${chat.house_id}"${all || selectedHouseIds.has(chat.house_id) ? " checked" : ""}${all ? " disabled" : ""}><span>${esc(chat.address)}<small>${esc(chatState(chat)[1])}${chat.title ? ` · ${esc(chat.title)}` : ""}</small></span></label>`).join("") : '<p class="form-help">Дом не найден. Попробуйте другую часть адреса.</p>';
  for (const id of ["announcement-select-all","announcement-select-visible","announcement-clear-houses"]) $(id).disabled = all;
  updateAnnouncementPreview();
}
function renderResidents() {
  $("announcement-residents").innerHTML = residentOptions.length ? residentOptions.map(r => `<label class="announcement-house resident-choice"><input type="checkbox" value="${r.id}"${selectedResidentIds.has(r.id) ? " checked" : ""}${!r.available ? " disabled" : ""}><span><strong>${esc(r.name)}</strong><small>MAX ID ${r.max_user_id}</small><small>${r.apartments.map(esc).join("; ")}</small>${r.reason ? `<small class="resident-unavailable">${esc(r.reason)}</small>` : ""}</span></label>`).join("") : '<p class="form-help">Жители не найдены. Попробуйте имя, MAX ID или адрес с номером квартиры.</p>';
  $("selected-announcement-residents").innerHTML = [...selectedResidentIds].map(id => `<button type="button" class="resident-chip" data-remove-resident="${id}" aria-label="Убрать ${esc(residentDirectory.get(id)?.name || 'получателя')}">${esc(residentDirectory.get(id)?.name || 'Недоступный получатель')} <span aria-hidden="true">×</span></button>`).join("");
  $("announcement-residents-more").hidden = residentOptions.length >= residentTotal;
  updateAnnouncementPreview();
}
async function loadResidents(more = false) {
  if (!state.profile) return;
  const request = ++residentRequest, profile = state.profile;
  if (!more) residentPage = 1;
  $("announcement-residents-more").disabled = true;
  $("announcement-residents").setAttribute("aria-busy", "true");
  try {
    const data = await api(`/announcement-residents?q=${encodeURIComponent($("announcement-resident-search").value.trim())}&page=${residentPage}`);
    if (request !== residentRequest || profile !== state.profile) return;
    residentOptions = more ? [...residentOptions, ...data.items] : data.items; residentTotal = data.total;
    for (const r of data.items) residentDirectory.set(r.id, r);
    renderResidents(); showError("announcement-residents-error", "");
  } catch (error) { if (request === residentRequest && profile === state.profile) { if (more) residentPage--; showError("announcement-residents-error", error.message); } }
  finally { if (request === residentRequest) { $("announcement-residents-more").disabled = false; $("announcement-residents").removeAttribute("aria-busy"); } }
}
async function loadMaxChats() {
  if (!state.profile) return;
  const request = ++maxChatRequest, profile = state.profile;
  $("refresh-max-chats").disabled = true;
  try {
    const rows = await api("/max-chats");
    if (request !== maxChatRequest || profile !== state.profile) return;
    maxChatRows = rows;
    $("max-chats-body").innerHTML = rows.map(chat => `<tr><td><strong>${esc(chat.address)}</strong></td><td>${chat.title ? esc(chat.title) : '<span class="muted">Группа не подключена</span>'}</td><td>${chatStatusHtml(chat)}${chat.error ? `<p class="chat-row-error">${esc(chat.error)}</p>` : ""}${chat.checked_at ? `<span class="row-meta">Проверено ${esc(date(chat.checked_at, true))}</span>` : ""}</td><td><div class="chat-row-actions">${chat.chat_id == null ? `<button class="primary" data-chat-action="code" data-house="${chat.house_id}">Подключить чат</button>` : `<button class="secondary" data-chat-action="menu" data-house="${chat.house_id}"${["pending", "sending"].includes(chat.menu_status) ? " disabled" : ""}>Восстановить меню</button><button class="secondary" data-chat-action="disconnect" data-house="${chat.house_id}">Отключить</button>`}</div></td></tr>`).join("");
    $("max-chats-empty").hidden = rows.length > 0;
    renderAnnouncementHouses();
    showError("max-chats-error", "");
  } catch (error) {
    if (request === maxChatRequest && profile === state.profile) {
      showError("max-chats-error", error.message);
      if (!$("announcements-section").hidden) showError("announcements-error", error.message);
    }
  } finally { if (request === maxChatRequest) $("refresh-max-chats").disabled = false; }
}
async function loadAnnouncements() {
  if (!state.profile) return;
  const request = ++announcementRequest, profile = state.profile;
  $("refresh-announcements").disabled = true;
  try {
    const data = await api(`/announcements?page=${announcementPage}`);
    if (request !== announcementRequest || profile !== state.profile) return;
    announcementTotal = data.total;
    $("announcement-history").innerHTML = data.items.length ? data.items.map(item => `<button class="announcement-history-item" data-announcement="${item.id}"><strong>${esc(item.title)}</strong><small>${esc(chatTopics[item.topic])} · ${esc(date(item.created_at, true))}</small><small>${esc(announcementSummary(item))}</small></button>`).join("") : '<p class="form-help">Пока нет объявлений. Начните с черновика — он не отправляется жителям.</p>';
    $("announcement-prev").disabled = announcementPage <= 1;
    $("announcement-next").disabled = announcementPage * 20 >= announcementTotal;
    $("announcement-page").textContent = data.total ? `${(announcementPage - 1) * 20 + 1}–${Math.min(announcementPage * 20, data.total)} из ${data.total}` : "Нет объявлений";
    showError("announcements-error", "");
  } catch (error) { if (request === announcementRequest && profile === state.profile) showError("announcements-error", error.message); }
  finally { if (request === announcementRequest) $("refresh-announcements").disabled = false; }
}
async function loadChatManagement(withAnnouncements) {
  await Promise.all([loadMaxChats(), ...(withAnnouncements ? [loadAnnouncements()] : [])]);
}
window.resetChatManagement = () => {
  maxChatRequest++; announcementRequest++; residentRequest++; maxChatRows = [];
  selectedHouseIds.clear(); selectedResidentIds.clear(); residentDirectory.clear(); residentOptions = []; residentTotal = 0;
  clearTimeout(residentSearchTimer); $("announcement-residents").replaceChildren(); $("selected-announcement-residents").replaceChildren();
  editingAnnouncement = previewAnnouncement = null; announcementSaved = "";
  $("chat-code-dialog").close(); $("announcement-dialog").close();
  $("chat-connection-command").textContent = "";
  $("announcement-form").reset(); $("announcement-houses").replaceChildren();
  $("announcement-history").replaceChildren(); $("max-chats-body").replaceChildren();
  $("announcement-final-title").textContent = ""; $("announcement-final-text").textContent = "";
  $("announcement-deliveries").replaceChildren();
  $("announcement-editor-title").textContent = "Новое объявление";
  $("announcement-save-state").textContent = "";
  updateAnnouncementPreview();
};
$("refresh-max-chats").addEventListener("click", () => void loadMaxChats());
$("refresh-announcements").addEventListener("click", () => void loadAnnouncements());
$("close-chat-code").addEventListener("click", () => $("chat-code-dialog").close());
$("max-chats-body").addEventListener("click", async event => {
  const button = event.target.closest("button[data-chat-action]");
  if (!button || maxChatBusy) return;
  const house = maxChatRows.find(chat => chat.house_id === Number(button.dataset.house));
  if (!house) return;
  const action = button.dataset.chatAction;
  const profile = state.profile;
  if (action === "disconnect" && !await confirmAction({ title: "Отключить домовой чат?", description: `Дом «${house.address}». Новые объявления и ещё не начавшиеся отправки в эту группу прекратятся.`, confirmLabel: "Отключить", destructive: true })) return;
  if (action === "menu" && !await confirmAction({ title: "Восстановить меню?", description: house.menu_status === "uncertain" ? "Предыдущая отправка меню могла пройти. Проверьте закреп в группе перед восстановлением." : "Бот обновит и закрепит прежнее сообщение с кнопками, а если оно удалено — создаст новое. Объявления отправляться не будут.", confirmLabel: "Восстановить" })) return;
  if (maxChatBusy || state.profile !== profile || !button.isConnected) return;
  maxChatBusy = true; button.disabled = true;
  try {
    const result = await api(`/max-chats/${house.house_id}/${action}`, { method: "POST" });
    if (action === "code") {
      connectingHouse = house.house_id;
      $("chat-code-address").textContent = house.address;
      $("chat-connection-command").textContent = result.command;
      $("chat-code-expires").textContent = `Действует до ${date(result.expires_at, true)}. Новый код отменяет предыдущий.`;
      $("chat-code-dialog").showModal();
    } else toast(action === "menu" ? "Бот проверит права и восстановит закреплённое меню" : "Чат отключён от рассылок");
    await loadMaxChats();
  } catch (error) { showError("max-chats-error", error.message); }
  finally { maxChatBusy = false; button.disabled = false; }
});
$("copy-chat-command").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("chat-connection-command").textContent); toast("Команда скопирована"); }
  catch { const range = document.createRange(); range.selectNodeContents($("chat-connection-command")); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); toast("Команда выделена — скопируйте её вручную"); }
});
$("check-chat-connection").addEventListener("click", async () => {
  await loadMaxChats();
  const row = maxChatRows.find(chat => chat.house_id === connectingHouse);
  if (row?.chat_id != null) { $("chat-code-dialog").close(); toast(chatState(row)[1]); }
  else toast("Ожидаем команду от администратора группы. После отправки проверьте подключение ещё раз.");
});
$("announcement-form").addEventListener("input", updateAnnouncementPreview);
$("announcement-form").addEventListener("change", updateAnnouncementPreview);
$("announcement-select-all").addEventListener("click", () => renderAnnouncementHouses(maxChatRows.filter(c => chatState(c)[0] === "ready").map(c => c.house_id)));
$("announcement-select-visible").addEventListener("click", () => renderAnnouncementHouses([...new Set([...selectedHouseIds, ...visibleHouses().map(c => c.house_id)])]));
$("announcement-clear-houses").addEventListener("click", () => renderAnnouncementHouses([]));
$("announcement-house-search").addEventListener("input", () => renderAnnouncementHouses());
$("announcement-houses").addEventListener("change", event => { if (!event.target.matches('input[type="checkbox"]')) return; const id = Number(event.target.value); if (event.target.checked) selectedHouseIds.add(id); else selectedHouseIds.delete(id); updateAnnouncementPreview(); });
document.querySelectorAll('input[name="announcement-audience"]').forEach(radio => radio.addEventListener("change", () => { renderAnnouncementHouses(); if (audienceMode() === "residents") void loadResidents(); }));
$("announcement-resident-search").addEventListener("input", () => { clearTimeout(residentSearchTimer); residentRequest++; residentSearchTimer = setTimeout(() => void loadResidents(), 250); });
$("announcement-residents-more").addEventListener("click", () => { residentPage++; void loadResidents(true); });
$("announcement-residents").addEventListener("change", event => { if (!event.target.matches('input[type="checkbox"]')) return; const id = Number(event.target.value); if (event.target.checked) selectedResidentIds.add(id); else selectedResidentIds.delete(id); renderResidents(); });
$("selected-announcement-residents").addEventListener("click", event => { const button = event.target.closest("button[data-remove-resident]"); if (button) { selectedResidentIds.delete(Number(button.dataset.removeResident)); renderResidents(); } });
function canPublishAnnouncement(item) {
  if (!item || item.status !== "draft") return false;
  return item.deliveries.every(d => chatState(maxChatRows.find(c => c.house_id === d.house_id))[0] === "ready") && (item.deliveries.length + (item.private_deliveries || []).filter(d => d.available).length > 0);
}
function busyAnnouncement(busy) {
  announcementBusy = busy; $("announcement-fields").disabled = busy;
  for (const id of ["new-announcement", "send-announcement", "retry-announcement", "close-announcement", "edit-announcement"]) $(id).disabled = busy;
  $("send-announcement").disabled = busy || !canPublishAnnouncement(previewAnnouncement);
}
async function saveAnnouncement() {
  if (!$("announcement-form").reportValidity()) return null;
  const body = announcementBody();
  if (!body.house_ids.length) throw new Error("Выберите хотя бы один дом");
  if (!body.channels.length) throw new Error("Выберите хотя бы один канал доставки");
  if (body.audience === "residents" && !body.resident_ids.length) throw new Error("Выберите хотя бы одного жителя");
  const draft = await api(editingAnnouncement ? `/announcements/${editingAnnouncement.id}` : "/announcements", { method: editingAnnouncement ? "PUT" : "POST", body: JSON.stringify(body) });
  editingAnnouncement = draft;
  announcementSaved = JSON.stringify(announcementBody());
  $("announcement-editor-title").textContent = "Черновик объявления";
  $("announcement-save-state").textContent = "Черновик сохранён. Жителям ничего не отправлено.";
  showError("announcement-form-error", "");
  announcementPage = 1; await loadAnnouncements();
  return draft;
}
async function saveOrPreview(preview) {
  if (announcementBusy) return;
  busyAnnouncement(true);
  try {
    // Temporarily enable native validity checks; the busy guard still blocks duplicate actions.
    $("announcement-fields").disabled = false;
    if (!$("announcement-form").reportValidity()) return;
    $("announcement-fields").disabled = true;
    const draft = await saveAnnouncement();
    if (draft && preview) showAnnouncement(draft);
  } catch (error) { showError("announcement-form-error", error.message); }
  finally { busyAnnouncement(false); }
}
$("announcement-form").addEventListener("submit", event => { event.preventDefault(); void saveOrPreview(false); });
$("preview-announcement").addEventListener("click", () => void saveOrPreview(true));
function showAnnouncement(item) {
  previewAnnouncement = item;
  $("announcement-dialog-title").textContent = item.status === "draft" ? "Проверьте объявление" : "Результат отправки";
  $("announcement-final-topic").textContent = announcementTopics[item.topic] || announcementTopics.other;
  $("announcement-final-title").textContent = item.title;
  $("announcement-final-text").textContent = item.text;
  const personal = item.private_deliveries || [], draft = item.status === "draft";
  const privateCount = personal.filter(d => !draft || d.available).length;
  const groups = item.deliveries.map(d => `<div class="announcement-recipient"><strong>${esc(d.address)}</strong><span class="chat-state" data-state="${d.status === "sent" ? "ready" : ["failed","uncertain"].includes(d.status) ? d.status : "pending"}">${esc(draft ? chatState(maxChatRows.find(c => c.house_id === d.house_id))[1] : deliveryLabels[d.status])}</span>${d.chat_title ? `<small>${esc(d.chat_title)}</small>` : ""}${d.error ? `<p class="chat-row-error">${esc(d.error)}</p>` : ""}</div>`).join("");
  const people = personal.map(d => `<div class="announcement-recipient"><strong>${esc(d.name)}${d.max_user_id ? ` · MAX ID ${d.max_user_id}` : ""}</strong><small>${esc(d.address)}</small><span class="chat-state" data-state="${d.status === "sent" ? "ready" : ["failed","uncertain"].includes(d.status) ? d.status : "pending"}">${esc(draft ? d.available ? "Получит личное сообщение" : "Не будет отправлено" : deliveryLabels[d.status])}</span>${d.error ? `<p class="chat-row-error">${esc(d.error)}</p>` : ""}</div>`).join("");
  $("announcement-deliveries").innerHTML = (groups ? `<h4 class="recipient-channel-heading">Домовые чаты · ${item.deliveries.length}</h4>${groups}` : "") + (people ? `<h4 class="recipient-channel-heading">Личные сообщения · ${privateCount}</h4>${people}` : "") + (item.excluded_count ? `<p class="notice">Не включено жителей: ${item.excluded_count}. Они ещё не открыли бота или отключили объявления.</p>` : "");
  $("send-announcement").hidden = !draft;
  $("send-announcement").textContent = `Отправить · ${item.deliveries.length + privateCount}`;
  $("edit-announcement").hidden = !draft;
  $("retry-announcement").hidden = ![...item.deliveries,...personal].some(d => d.status === "failed");
  const ready = canPublishAnnouncement(item);
  $("send-announcement").disabled = !ready || announcementBusy;
  $("announcement-preview-help").textContent = draft ? (ready ? `Домовых чатов: ${item.deliveries.length}. Личных сообщений: ${privateCount}. Это точный список отправки; текст и получателей после начала изменить нельзя.` : "Проверьте подключение выбранных групп и наличие доступных личных получателей. Если изменился состав жителей, сохраните черновик заново.") : "Успешные сообщения не дублируются. Если результат неизвестен, сначала проверьте соответствующий чат или личный диалог — автоматического повтора не будет.";
  showError("announcement-preview-error", "");
  if (!$("announcement-dialog").open) $("announcement-dialog").showModal();
}
function resetAnnouncement() {
  editingAnnouncement = null; announcementSaved = "";
  $("announcement-form").reset(); selectedResidentIds.clear(); residentOptions = []; residentTotal = 0; renderResidents(); renderAnnouncementHouses([]);
  $("announcement-editor-title").textContent = "Новое объявление";
  $("announcement-save-state").textContent = ""; showError("announcement-form-error", "");
  $("announcement-fields").disabled = announcementBusy;
}
$("new-announcement").addEventListener("click", async () => {
  if (announcementBusy || (announcementIsDirty() && !await confirmAction({ title: "Начать новый черновик?", description: "Несохранённые изменения текущего объявления будут потеряны.", confirmLabel: "Начать заново", destructive: true }))) return;
  if (announcementBusy || !state.profile) return;
  resetAnnouncement(); $("announcement-title").focus();
});
$("announcement-history").addEventListener("click", async event => {
  const button = event.target.closest("button[data-announcement]");
  if (!button || announcementBusy) return;
  busyAnnouncement(true);
  try {
    const item = await api(`/announcements/${Number(button.dataset.announcement)}`);
    if (item.status === "draft") {
      if (announcementIsDirty() && !await confirmAction({ title: "Загрузить черновик?", description: "Он заменит несохранённые изменения в текущем объявлении.", confirmLabel: "Загрузить", destructive: true })) return;
      if (!state.profile) return;
      editingAnnouncement = item;
      $("announcement-topic").value = item.topic; $("announcement-title").value = item.title; $("announcement-text").value = item.text;
      selectedResidentIds = new Set(item.resident_ids || []);
      for (const r of item.private_deliveries || []) residentDirectory.set(r.user_id, { name: r.name });
      document.querySelector(`input[name="announcement-audience"][value="${item.audience === "residents" ? "residents" : "selected"}"]`).checked = true;
      $("channel-groups").checked = item.channels.includes("groups"); $("channel-private").checked = item.channels.includes("private");
      renderAnnouncementHouses(item.house_ids); renderResidents(); if (item.audience === "residents") void loadResidents();
      announcementSaved = JSON.stringify(announcementBody());
      $("announcement-editor-title").textContent = "Черновик объявления";
      $("announcement-save-state").textContent = "Черновик загружен";
      $("announcement-title").focus();
    } else showAnnouncement(item);
  } catch (error) { showError("announcements-error", error.message); }
  finally { busyAnnouncement(false); }
});
$("close-announcement").addEventListener("click", () => $("announcement-dialog").close());
$("edit-announcement").addEventListener("click", () => $("announcement-dialog").close());
$("announcement-dialog").addEventListener("cancel", event => { if (announcementBusy) event.preventDefault(); });
async function publishAnnouncement(retry) {
  if (!previewAnnouncement || announcementBusy) return;
  const item = previewAnnouncement;
  busyAnnouncement(true);
  try {
    const result = await api(`/announcements/${item.id}/${retry ? "retry" : "send"}`, { method: "POST", ...(!retry ? { body: JSON.stringify({ version: item.version }) } : {}) });
    if (!retry && editingAnnouncement?.id === item.id) resetAnnouncement();
    showAnnouncement(result);
    toast(retry ? "Неотправленные объявления возвращены в очередь" : "Объявление поставлено в очередь отправки");
    await loadAnnouncements();
  } catch (error) { showError("announcement-preview-error", error.message); }
  finally { busyAnnouncement(false); }
}
$("send-announcement").addEventListener("click", () => void publishAnnouncement(false));
$("retry-announcement").addEventListener("click", () => void publishAnnouncement(true));
$("announcement-prev").addEventListener("click", () => { if (announcementPage > 1) { announcementPage--; void loadAnnouncements(); } });
$("announcement-next").addEventListener("click", () => { if (announcementPage * 20 < announcementTotal) { announcementPage++; void loadAnnouncements(); } });
window.addEventListener("beforeunload", event => { if (announcementIsDirty()) { event.preventDefault(); event.returnValue = ""; } });
setInterval(async () => {
  if (!state.profile || document.hidden || announcementBusy || maxChatBusy || confirmationDialog.open) return;
  if (!$("max-chats-section").hidden) await loadMaxChats();
  if (!$("announcements-section").hidden) {
    await loadAnnouncements();
    if ($("announcement-dialog").open && previewAnnouncement?.status !== "draft") {
      const current = previewAnnouncement;
      try { const item = await api(`/announcements/${current.id}`); if (previewAnnouncement === current && $("announcement-dialog").open && state.profile) showAnnouncement(item); } catch (error) { showError("announcement-preview-error", error.message); }
    }
  }
}, 10000);
