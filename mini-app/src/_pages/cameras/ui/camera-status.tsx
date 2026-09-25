import { cameraStatusLabels, type CameraStatus as Status } from "../model/demo-cameras";
import styles from "./cameras.module.css";

export function CameraStatus({ status }: { status: Status }) {
  return <span className={`${styles.status} ${styles[status]}`}>{cameraStatusLabels[status]}</span>;
}
