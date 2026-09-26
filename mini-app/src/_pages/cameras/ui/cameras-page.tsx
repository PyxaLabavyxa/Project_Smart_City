import { NavigationLinks, SectionPage } from "@/shared/ui/navigation";
import Link from "next/link";
import { demoCameras, cameraImage } from "../model/demo-cameras";
import { Icon } from "@/shared/ui/icon";
import { CameraStatus } from "./camera-status";
import styles from "./cameras.module.css";
import { CameraPreview } from "./camera-preview";

export function CamerasPage() {
  return <SectionPage title="Камеры" description="Общие зоны вашего дома" backHref="/" backLabel="На главную">
    <ul className={styles.list} aria-label="Камеры общих зон">{demoCameras.map(camera => <li key={camera.id}>
      <Link href={`/cameras/${camera.id}`} className={styles.camera}>
        <div className={styles.thumbnail} data-offline={camera.status !== "online" || undefined}>
          {/* Local SVG illustration, shared with the preview fixture. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cameraImage(camera)} alt="" width={960} height={540} />
          <span className={styles.play}><Icon name={camera.status === "online" ? "play" : "cameras"} /></span>
        </div>
        <div className={styles.cardBody}><div className={styles.row}><h2>{camera.name}</h2><CameraStatus status={camera.status} /></div><p>Камера общей зоны <span aria-hidden="true">→</span></p></div>
      </Link>
    </li>)}</ul>
  </SectionPage>;
}

export function CameraDetailsPage({ id }: { id: string }) {
  const camera = demoCameras.find(item => item.id === id);
  return <SectionPage title={camera?.name ?? "Камера не найдена"} description={camera ? "ул. Центральная, 18 · камера общей зоны" : "Выберите камеру из списка общих зон."} backHref="/cameras" backLabel="Все камеры">
    {camera && <div className={styles.detail}>
      <CameraPreview key={camera.id} camera={camera} />
      <aside className={styles.about}><h2>Об этой зоне</h2><p>{camera.name}, ул. Центральная, 18</p><p>{camera.note}</p>
        <NavigationLinks label="Место камеры" items={[{ href: "/plan", title: "Открыть план дома" }]} />
        <Link href="/issues/new" className={styles.report}>＋ Сообщить о проблеме</Link>
      </aside>
    </div>}
  </SectionPage>;
}
