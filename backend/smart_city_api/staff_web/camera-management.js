"use strict";

const cmFormDialog = $("staff-camera-form-dialog");
const cmViewDialog = $("staff-camera-view-dialog");
const cmTypeLabels = { snapshot: "Снимки", rtsp: "RTSP", rtmp: "RTMP", hls: "HLS", mjpeg: "MJPEG", onvif: "ONVIF", http_video: "HTTP-видео" };
let cmTimer, cmController, cmGeneration = 0, cmVerified = null, cmRequest = null, cmSaving = false;
let cmViewing = null, cmViewTimer;

function cmConnection() {
  const kind = $("staff-camera-type").value;
  return { house_id: Number($("staff-camera-house").value), source_url: $("staff-camera-source").value.trim(), source_type: kind,
    username: $("staff-camera-username").value, password: $("staff-camera-password").value, auth_type: $("staff-camera-auth").value,
    profile: kind === "auto" || kind === "onvif" ? $("staff-camera-profile").value : "",
    rtsp_port: (kind === "auto" || kind === "onvif") && $("staff-camera-port").value ? Number($("staff-camera-port").value) : null };
}
function cmCancelProbe() { clearTimeout(cmTimer); cmController?.abort(); cmGeneration++; cmVerified = null; }
function cmCheckStatus(status, message) {
  const node = $("staff-camera-check"); node.dataset.status = status; node.textContent = message;
  $("save-staff-camera").disabled = status !== "success" || cmSaving;
  $("retry-staff-camera").hidden = !["error", "success"].includes(status);
  $("retry-staff-camera").textContent = status === "success" ? "Обновить" : "Повторить";
}
function cmQueueProbe() {
  cmCancelProbe();
  const data = cmConnection(), key = JSON.stringify(data), generation = cmGeneration;
  $("staff-camera-probe-image").hidden = true; $("staff-camera-probe-image").removeAttribute("src");
  if (!data.source_url) { cmCheckStatus("idle", "Тип определится автоматически"); return; }
  try {
    const url = new URL(data.source_url);
    const protocols = data.source_type === "auto" ? ["http:", "https:", "rtsp:", "rtsps:", "rtmp:", "rtmps:"] : data.source_type === "rtsp" ? ["rtsp:", "rtsps:"] : data.source_type === "rtmp" ? ["rtmp:", "rtmps:"] : ["http:", "https:"];
    if (!protocols.includes(url.protocol) || !url.hostname || url.username || url.password || url.hash) throw new Error();
  } catch { cmCheckStatus("invalid", "Введите корректную ссылку"); return; }
  cmCheckStatus("checking", "Проверяем камеру…");
  cmTimer = setTimeout(async () => {
    cmController = new AbortController();
    try {
      const result = await api("/cameras/probe", { method: "POST", body: key, signal: AbortSignal.any([cmController.signal, AbortSignal.timeout(27000)]) });
      if (generation !== cmGeneration || !cmFormDialog.open) return;
      if (!cmTypeLabels[result.source_type] || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(result.src)) throw new Error("Не удалось получить кадр камеры");
      cmVerified = { key, type: result.source_type };
      $("staff-camera-probe-image").src = result.src; $("staff-camera-probe-image").hidden = false;
      cmCheckStatus("success", `Кадр получен · ${cmTypeLabels[result.source_type]}`);
    } catch (error) {
      if (generation === cmGeneration && cmFormDialog.open) cmCheckStatus("error", "Не удалось подключиться");
    }
  }, 700);
}
function cmLocationOptions() {
  const house = state.profile?.houses.find(h => h.id === Number($("staff-camera-house").value));
  const zone = $("staff-camera-zone").value, outdoor = ["courtyard", "parking", "house"].includes(zone);
  for (const [id, property, label] of [["staff-camera-entrance", "entrances_count", "Подъезд"], ["staff-camera-floor", "floors_count", "Этаж"]]) {
    const select = $(id), previous = select.value;
    if (outdoor) { select.innerHTML = `<option value="">${property === "floors_count" ? "Нет этажей" : "Нет подъездов"}</option>`; select.disabled = true; continue; }
    const count = property === "floors_count" && zone === "entrance" ? 1 : house?.[property] ?? 0;
    select.innerHTML = Array.from({ length: count }, (_, index) => `<option value="${index + 1}">${label} ${index + 1}</option>`).join("");
    if (Number(previous) >= 1 && Number(previous) <= count) select.value = previous;
    select.disabled = count === 0 || (property === "floors_count" && zone === "entrance");
  }
}
$("add-staff-camera").addEventListener("click", () => {
  if (!state.profile?.houses.length) { toast("Сначала назначьте сотруднику дом"); return; }
  $("staff-camera-form").reset();
  $("staff-camera-form").querySelectorAll("details[open]").forEach(node => { node.open = false; });
  cmCancelProbe(); cmRequest = null;
  $("staff-camera-house").innerHTML = state.profile.houses.map(h => `<option value="${h.id}">${esc(h.address)}</option>`).join("");
  if ($("camera-house").value) $("staff-camera-house").value = $("camera-house").value;
  showError("staff-camera-form-error", ""); cmLocationOptions(); cmQueueProbe(); cmFormDialog.showModal();
});
for (const id of ["close-staff-camera-form", "cancel-staff-camera"]) $(id).addEventListener("click", () => { if (!cmSaving) cmFormDialog.close(); });
cmFormDialog.addEventListener("cancel", event => { if (cmSaving) event.preventDefault(); });
cmFormDialog.addEventListener("close", () => { cmCancelProbe(); $("staff-camera-password").value = ""; $("staff-camera-probe-image").removeAttribute("src"); cmRequest = null; });
for (const id of ["source", "username", "password", "type", "auth", "profile", "port"]) $("staff-camera-" + id).addEventListener("input", cmQueueProbe);
$("staff-camera-house").addEventListener("change", () => { cmLocationOptions(); cmQueueProbe(); });
$("staff-camera-zone").addEventListener("change", cmLocationOptions);
$("retry-staff-camera").addEventListener("click", cmQueueProbe);
$("staff-camera-form").addEventListener("submit", async event => {
  event.preventDefault();
  const connection = cmConnection();
  if (cmSaving || !cmVerified || cmVerified.key !== JSON.stringify(connection)) return;
  const outdoor = ["courtyard", "parking", "house"].includes($("staff-camera-zone").value);
  const data = { ...connection, source_type: cmVerified.type, name: $("staff-camera-name").value.trim(), note: $("staff-camera-note").value.trim(), is_public: true,
    place: { zone: $("staff-camera-zone").value, entrance: outdoor ? null : Number($("staff-camera-entrance").value), floor: outdoor ? null : Number($("staff-camera-floor").value) } };
  const key = JSON.stringify(data);
  if (cmRequest?.key !== key) cmRequest = { key, id: uuid() };
  cmSaving = true; $("staff-camera-fields").disabled = true; $("save-staff-camera").textContent = "Добавляем…";
  showError("staff-camera-form-error", "");
  try {
    await api("/cameras", { method: "POST", body: JSON.stringify({ ...data, request_id: cmRequest.id }) });
    cmFormDialog.close(); toast("Камера добавлена и доступна жителям дома");
    $("camera-house").value = String(connection.house_id); $("camera-status").value = "all";
    $("camera-zone").value = ""; $("camera-entrance").value = ""; $("camera-floor").value = "";
    updateCameraLocationOptions(); cameraPage = 1; await loadCameras();
  } catch (error) { showError("staff-camera-form-error", error.message); }
  finally { cmSaving = false; $("staff-camera-fields").disabled = false; $("save-staff-camera").textContent = "Добавить камеру"; cmLocationOptions(); $("save-staff-camera").disabled = !cmVerified; }
});

let cmPreviewGeneration = 0;
window.bindCameraPreviews = () => {
  const generation = ++cmPreviewGeneration;
  const images = [...$("cameras-body").querySelectorAll(".staff-camera-preview img")];
  let next = 0;
  function loadNext() {
    if (generation !== cmPreviewGeneration) return;
    const image = images[next++];
    if (!image?.isConnected) return;
    const preview = image.closest(".staff-camera-preview");
    const finish = available => {
      image.onload = image.onerror = null;
      image.hidden = !available;
      preview.dataset.status = available ? "online" : "unavailable";
      preview.querySelector(".camera-preview-fallback > span").textContent = available ? "Кадр загружен" : "Камера недоступна";
      loadNext();
    };
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = image.dataset.frameSrc;
  }
  // Bound simultaneous thumbnail requests below the isolated worker's capacity.
  for (let index = 0; index < 3; index++) loadNext();
};

function cmRefreshView() {
  clearTimeout(cmViewTimer);
  if (!cmViewing || !cmViewDialog.open) return;
  $("staff-camera-view-time").textContent = "Получаем кадр…";
  $("refresh-staff-camera-view").disabled = true;
  $("staff-camera-view-image").src = `${apiRoot}/cameras/${cmViewing}/frame?t=${Date.now()}`;
}
window.openStaffCamera = id => {
  const camera = cameraItems.find(item => Number(item.id) === id);
  if (!camera) return;
  cmViewing = id;
  const place = camera.place;
  const location = !place ? "Место не указано" : ["house", "courtyard", "parking"].includes(place.zone) ? zones[place.zone] : `Подъезд ${place.entrance} · этаж ${place.floor} · ${zones[place.zone] || place.zone}`;
  $("staff-camera-view-title").textContent = camera.name;
  $("staff-camera-view-place").textContent = `${camera.address} · ${location}`;
  $("staff-camera-view-note").textContent = camera.note;
  $("staff-camera-view-note").hidden = !camera.note;
  $("staff-camera-view-reason").textContent = camera.moderation_reason ? `Причина отклонения: ${camera.moderation_reason}` : "";
  $("staff-camera-view-reason").hidden = !camera.moderation_reason;
  $("staff-camera-view-image").hidden = true; $("staff-camera-view-error").hidden = true;
  cmViewDialog.showModal(); cmRefreshView();
};
$("cameras-section").addEventListener("click", event => {
  const control = event.target.closest("button[data-view-camera]");
  if (control) window.openStaffCamera(Number(control.dataset.viewCamera));
});
$("staff-camera-view-image").addEventListener("load", () => {
  if (!cmViewing || !cmViewDialog.open) return;
  $("staff-camera-view-image").hidden = false; $("staff-camera-view-error").hidden = true;
  $("staff-camera-view-time").textContent = `Кадр обновлён в ${new Date().toLocaleTimeString("ru-RU")}`;
  $("refresh-staff-camera-view").disabled = false;
  cmViewTimer = setTimeout(cmRefreshView, 5000);
});
$("staff-camera-view-image").addEventListener("error", () => {
  if (!cmViewing || !cmViewDialog.open) return;
  $("staff-camera-view-image").hidden = true; $("staff-camera-view-error").hidden = false;
  $("staff-camera-view-time").textContent = "Не удалось обновить кадр"; $("refresh-staff-camera-view").disabled = false;
});
$("refresh-staff-camera-view").addEventListener("click", cmRefreshView);
$("close-staff-camera-view").addEventListener("click", () => cmViewDialog.close());
cmViewDialog.addEventListener("close", () => { cmViewing = null; clearTimeout(cmViewTimer); $("staff-camera-view-image").removeAttribute("src"); });
window.resetCameraManagement = () => { cmPreviewGeneration++; cmFormDialog.close(); cmViewDialog.close(); cmCancelProbe(); };
if (cameraItems.length) window.bindCameraPreviews();
