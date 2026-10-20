"use strict";

// Native modal owns focus, Escape, background inertness and focus restoration.
const confirmationDialog = document.createElement("dialog");
confirmationDialog.id = "confirmation-dialog";
confirmationDialog.className = "confirmation-dialog";
confirmationDialog.setAttribute("aria-labelledby", "confirmation-title");
confirmationDialog.setAttribute("aria-describedby", "confirmation-description");
confirmationDialog.innerHTML = `<form>
  <div class="confirmation-heading"><span class="confirmation-symbol" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path></path></svg></span><button type="button" class="icon-button" data-dismiss aria-label="Закрыть подтверждение">×</button></div>
  <h2 id="confirmation-title"></h2><p id="confirmation-description"></p>
  <label class="confirmation-reason" hidden>Причина отклонения<textarea name="reason" rows="4" maxlength="1000" placeholder="Объясните владельцу, что нужно исправить"></textarea><span class="form-help">До 1000 символов · будет видно владельцу</span></label>
  <div class="confirmation-actions"><button type="button" class="secondary" data-dismiss autofocus>Отмена</button><button type="submit" class="primary" data-confirm></button></div>
</form>`;
document.body.append(confirmationDialog);
let confirmationResolve = null;
const reasonField = confirmationDialog.querySelector("textarea");
confirmationDialog.querySelectorAll("[data-dismiss]").forEach(button => button.addEventListener("click", () => confirmationDialog.close("cancel")));
confirmationDialog.addEventListener("cancel", () => { confirmationDialog.returnValue = "cancel"; });
confirmationDialog.addEventListener("close", () => {
  const resolve = confirmationResolve;
  confirmationResolve = null;
  resolve?.(confirmationDialog.returnValue === "confirm" ? reasonField.required ? reasonField.value.trim() : true : null);
});
reasonField.addEventListener("input", () => reasonField.setCustomValidity(""));
confirmationDialog.querySelector("form").addEventListener("submit", event => {
  event.preventDefault();
  if (reasonField.required && !reasonField.value.trim()) {
    reasonField.setCustomValidity("Укажите причину отклонения"); reasonField.reportValidity(); return;
  }
  confirmationDialog.close("confirm");
});
function openConfirmation({ title, description, confirmLabel, destructive = false, reason = false }) {
  if (confirmationResolve) return Promise.resolve(null);
  confirmationDialog.querySelector("h2").textContent = title;
  confirmationDialog.querySelector("p").textContent = description;
  confirmationDialog.querySelector("[data-confirm]").textContent = confirmLabel;
  confirmationDialog.dataset.destructive = String(destructive);
  confirmationDialog.querySelector(".confirmation-symbol path").setAttribute("d", destructive ? "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" : "M12 3 2 21h20ZM12 9v5m0 3h.01");
  confirmationDialog.querySelector(".confirmation-reason").hidden = !reason;
  reasonField.required = reason;
  reasonField.disabled = !reason;
  reasonField.value = "";
  reasonField.setCustomValidity("");
  confirmationDialog.returnValue = "cancel";
  return new Promise(resolve => {
    confirmationResolve = resolve;
    confirmationDialog.showModal();
  });
}
async function confirmAction(options) { return (await openConfirmation(options)) === true; }
function requestCameraRejection() {
  return openConfirmation({ title: "Отклонить камеру?", description: "Камера останется доступна владельцу. Укажите, почему её нельзя сделать общедоступной.", confirmLabel: "Отклонить", destructive: true, reason: true });
}
document.addEventListener("pointerdown", () => { document.documentElement.dataset.motionInput = "pointer"; }, true);
document.addEventListener("keydown", event => { if (!event.metaKey && !event.ctrlKey && !event.altKey) document.documentElement.dataset.motionInput = "keyboard"; }, true);
