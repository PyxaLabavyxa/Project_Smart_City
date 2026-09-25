import { NavigationLinks, SectionPage } from "@/shared/ui/navigation";
import Link from "next/link";
import { demoCameras } from "../model/demo-cameras";
import { CameraStatus } from "./camera-status";
import styles from "./cameras.module.css";

export function CamerasPage() {
  return <SectionPage title="Камеры" description="Общие зоны вашего дома" backHref="/" backLabel="На главную">
    <ul className={styles.list} aria-label="Камеры общих зон">{demoCameras.map(camera => <li key={camera.id}>
      <Link href={`/cameras/${camera.id}`} className={styles.camera}>
        <h2>{camera.name}</h2><CameraStatus status={camera.status} />
      </Link>
    </li>)}</ul>
  </SectionPage>;
}

export function CameraDetailsPage({ id }: { id: string }) {
  const camera = demoCameras.find(item => item.id === id);
  return <SectionPage title={camera?.name ?? "Камера не найдена"} description={camera ? "ул. Центральная, 18 · камера общей зоны" : "Выберите камеру из списка общих зон."} backHref="/cameras" backLabel="Все камеры">
    {camera && <>
      <CameraStatus status={camera.status} />
      <p>{camera.note}</p>
      <NavigationLinks label="Место камеры" items={[{ href: "/plan", title: "Открыть план дома" }]} />
    </>}
  </SectionPage>;
}
