"use strict";
(() => {
  const byId = id => document.getElementById(id);
  const dialog = byId("notification-dialog");
  const bell = byId("notification-bell");
  let api, esc, icon, date, openTarget, timer, controller, epoch = 0;
  let rows = [], cursor = null, snapshot = 0, unread = true, busy = false, count = 0;
  function updateCount(value) {
    count = value;
    byId("notification-count").textContent = value > 99 ? "99+" : String(value);
    byId("notification-count").hidden = value === 0;
    bell.setAttribute("aria-label", value ? `Уведомления: ${value} непрочитанных` : "Уведомления");
  }
  function error(message = "") { byId("notification-error").textContent = message; byId("notification-error").hidden = !message; }
  function render() {
    byId("notification-filter").disabled = busy;
    const visible = rows.filter(row => !unread || !row.read_at);
    byId("notification-list").innerHTML = visible.map(row => `<li class="notification-item${row.read_at ? "" : " is-unread"}">
      <span class="notification-symbol">${icon(row.kind.startsWith("camera") ? "camera" : row.kind === "registration" ? "users" : row.kind.includes("message") ? "message" : "inbox")}</span>
      <div class="notification-content"><div class="notification-meta"><time datetime="${esc(row.created_at)}">${esc(date(row.created_at, true))}</time>${row.read_at ? "" : '<span class="notification-dot" aria-label="Непрочитано"></span>'}</div>
      <h3>${esc(row.title)}</h3>${row.address ? `<p class="notification-address">${esc(row.address)}</p>` : ""}${row.kind === "announcement" ? `<p class="notification-body">${esc(row.body)}</p>` : ""}</div>
      <div class="notification-actions">${row.href ? `<button type="button" class="notification-open" data-notification-open="${row.id}">Открыть</button>` : ""}${row.read_at ? "" : `<button type="button" class="notification-mark" data-notification-read="${row.id}" aria-label="Отметить прочитанным: ${esc(row.title)}">${icon("check")}Отметить прочитанным</button>`}</div></li>`).join("");
    byId("notification-empty").hidden = visible.length > 0;
    byId("notification-empty").textContent = unread ? cursor ? "Эти уведомления прочитаны. Нажмите «Показать ещё», чтобы загрузить остальные." : "Всё прочитано. Новые события появятся здесь, а история доступна в фильтре «Все»." : "Здесь пока тихо. Новые обращения, заявки и ответы жителей появятся здесь.";
    byId("notification-more").hidden = cursor == null;
    byId("notification-read-all").disabled = busy || count === 0 || snapshot === 0;
    dialog.querySelectorAll("[data-notification-open], [data-notification-read], #notification-more, #notification-refresh").forEach(node => { node.disabled = busy; });
  }
  async function poll() {
    if (!api || document.visibilityState !== "visible" || controller || busy) return;
    const request = new AbortController(); controller = request;
    const version = epoch;
    try {
      const result = await api("/inbox/count", { signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]) });
      if (version === epoch && !request.signal.aborted) updateCount(result.unread_count);
    } catch { /* Existing count remains visible; opening the panel shows errors. */ }
    finally { if (controller === request) controller = null; }
  }
  async function load(append = false) {
    if (!api || busy) return;
    busy = true; error(); render();
    byId("notification-loading").hidden = false;
    const version = epoch;
    try {
      const page = await api(`/inbox?unread_only=${unread}${append && cursor ? `&before=${cursor}` : ""}`);
      if (version !== epoch) return;
      rows = append ? [...rows, ...page.items].filter((row, index, all) => all.findIndex(item => item.id === row.id) === index) : page.items;
      cursor = page.next_cursor;
      if (!append) snapshot = page.snapshot_id;
      updateCount(page.unread_count);
    } catch (failure) { if (version === epoch) error(failure.message); }
    finally { if (version === epoch) { busy = false; byId("notification-loading").hidden = true; render(); } }
  }
  async function read(id, navigate = false) {
    if (busy || !api) return;
    const row = rows.find(item => item.id === id);
    if (id && !row) return;
    controller?.abort(); controller = null;
    const version = epoch;
    busy = true; error(); render();
    try {
      if (!row?.read_at) {
        const result = await api(id ? `/inbox/${id}/read` : "/inbox/read-all", { method: "POST", body: JSON.stringify(id ? {} : { through_id: snapshot }) });
        if (version !== epoch) return;
        updateCount(result.unread_count);
        if (unread && result.unread_count === 0) cursor = null;
        rows = rows.map(item => (id ? item.id === id : item.id <= snapshot) ? { ...item, read_at: item.read_at || new Date().toISOString() } : item);
      }
      if (navigate && row && /^(?:#issue-[1-9]\d*|#cameras|#registrations)$/.test(row.href || "")) {
        dialog.close(); openTarget(row.href);
      }
    } catch (failure) { if (version === epoch) error(failure.message); }
    finally { if (version === epoch) { busy = false; render(); } }
  }
  bell.addEventListener("click", () => { if (!api) return; dialog.showModal(); bell.setAttribute("aria-expanded", "true"); void load(); });
  byId("notification-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { bell.setAttribute("aria-expanded", "false"); bell.focus(); });
  dialog.addEventListener("click", event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });
  byId("notification-refresh").addEventListener("click", () => void load());
  byId("notification-more").addEventListener("click", () => void load(true));
  byId("notification-read-all").addEventListener("click", () => void read());
  byId("notification-filter").addEventListener("change", event => { unread = event.target.value === "unread"; void load(); });
  byId("notification-list").addEventListener("click", event => {
    const button = event.target.closest("button[data-notification-open], button[data-notification-read]");
    if (button) void read(Number(button.dataset.notificationOpen || button.dataset.notificationRead), !!button.dataset.notificationOpen);
  });
  const wake = () => void poll();
  document.addEventListener("visibilitychange", wake); window.addEventListener("focus", wake);
  window.resetStaffInbox = () => {
    epoch++; clearInterval(timer); controller?.abort(); controller = null; api = null;
    rows = []; cursor = null; snapshot = 0; busy = false; unread = true; count = 0;
    byId("notification-filter").value = "unread";
    byId("notification-list").replaceChildren(); error(); updateCount(count);
    dialog.close();
  };
  window.initStaffInbox = options => {
    window.resetStaffInbox();
    ({ api, esc, icon, date, open: openTarget } = options);
    timer = setInterval(wake, 20000); wake();
  };
})();
