"use client";
import { SectionPage } from "@/shared/ui/navigation";
import { RequestState } from "@/shared/ui/navigation/request-state";
import Link from "next/link";
import { useHouseSelection } from "@/entities/house";
import { useIssues } from "@/entities/issue";
import { cameraIssueContext } from "../model/camera-issue-context";
import { useCameras } from "../model/api";
import { CameraStatus } from "./camera-status";
import styles from "./cameras.module.css";
import { CameraPreview } from "./camera-preview";

export function CamerasPage() {
  const state = useCameras();
  return <SectionPage title="Камеры" description="Общие зоны вашего дома" backHref="/" backLabel="На главную">
    <RequestState {...state} />
    <ul className={styles.list} aria-label="Камеры общих зон">{state.data?.map(camera => <li key={camera.id}>
      <Link href={`/cameras/${camera.id}`} className={styles.camera}>
        <CameraPreview camera={camera} compact />
        <div className={styles.cardBody}><div className={styles.row}><h2>{camera.name}</h2><CameraStatus status={camera.status} /></div><p>{camera.note}</p></div>
      </Link>
    </li>)}</ul>
    {!state.loading && !state.error && !state.data?.length && <p>Камеры этого дома пока не подключены.</p>}
  </SectionPage>;
}

export function CameraDetailsPage({ id }: { id: string }) {
  const state = useCameras();
  const { house, select } = useHouseSelection();
  const { updateDraft } = useIssues();
  const camera = state.data?.find(item => item.id === id);
  return <SectionPage title={camera?.name ?? "Камера"} description={house.address} backHref="/cameras" backLabel="Все камеры">
    <RequestState {...state} />
    {camera && <div className={styles.detail}><CameraPreview key={camera.id} camera={camera} /><aside className={styles.about}><h2>Об этой зоне</h2><p>{camera.note}</p><Link href={`/issues/new?from=camera&camera=${encodeURIComponent(camera.id)}`} onNavigate={() => {
      const context = cameraIssueContext(camera, house);
      if (context) {
        select(context.place);
        updateDraft({ ...context, step: 1 });
      } else {
        updateDraft({ category: "", step: 0 });
      }
    }}>Сообщить о проблеме</Link></aside></div>}
    {!state.loading && !state.error && !camera && <p>Камера не найдена.</p>}
  </SectionPage>;
}
