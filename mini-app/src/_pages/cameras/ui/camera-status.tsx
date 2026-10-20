import { cameraStatusLabels, type CameraStatus as Status } from "../model/camera";
import styles from "./cameras.module.css";

export function CameraStatus({ status }: { status: Status | "checking" }) {
  return <span className={`${styles.status} ${styles[status]}`}>{status === "checking" ? "Проверяем" : status === "unavailable" ? "Недоступна" : cameraStatusLabels[status]}</span>;
}
