type SavedConnection = { source_url: string; source_type: string; username: string; auth_type: string; profile: string; rtsp_port: number | null; password_set: boolean };
type Connection = Omit<SavedConnection, "password_set"> & { password: string };

export function cameraConnectionChanged(initial: SavedConnection | undefined, current: Connection, keepPassword: boolean) {
  if (!initial) return true;
  return current.source_url !== initial.source_url || current.source_type !== initial.source_type
    || current.username !== initial.username || current.auth_type !== initial.auth_type
    || current.profile !== initial.profile || current.rtsp_port !== initial.rtsp_port
    || !!current.password || (initial.password_set && !keepPassword);
}

export function cameraLinkError(value: string, sourceType: string) {
  try {
    const url = new URL(value.trim());
    const protocols = sourceType === "auto" ? ["rtsp:", "rtsps:", "rtmp:", "rtmps:", "http:", "https:"] : sourceType === "rtsp" ? ["rtsp:", "rtsps:"] : sourceType === "rtmp" ? ["rtmp:", "rtmps:"] : ["http:", "https:"];
    if (!protocols.includes(url.protocol) || !url.hostname || url.hash) return "Введите корректную ссылку";
    if (url.username || url.password) return "Логин и пароль укажите отдельно";
    return "";
  } catch { return "Введите корректную ссылку"; }
}
