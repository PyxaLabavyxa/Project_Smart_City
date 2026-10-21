export function cameraLinkError(value: string, sourceType: string) {
  try {
    const url = new URL(value.trim());
    const protocols = sourceType === "auto" ? ["rtsp:", "rtsps:", "rtmp:", "rtmps:", "http:", "https:"] : sourceType === "rtsp" ? ["rtsp:", "rtsps:"] : sourceType === "rtmp" ? ["rtmp:", "rtmps:"] : ["http:", "https:"];
    if (!protocols.includes(url.protocol) || !url.hostname || url.hash) return "Введите корректную ссылку";
    if (url.username || url.password) return "Логин и пароль укажите отдельно";
    return "";
  } catch { return "Введите корректную ссылку"; }
}
